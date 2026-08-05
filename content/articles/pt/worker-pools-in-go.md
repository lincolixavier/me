---
title: "Usando um worker pool pra processar muitas tarefas em Go"
date: 2023-03-22
description: "Goroutines sem limite são o erro fácil. Um pool te dá throughput com um teto que você escolheu de propósito."
tags: ["go", "programming", "concurrency", "backend"]
slug: usando-worker-pool-para-processar-tarefas-em-go
---

Você tem dez mil coisas pra processar. Imagens pra redimensionar, e-mails pra enviar, linhas pra importar.

A versão tentadora em Go é uma linha só:

```go
for _, task := range tasks {
    go process(task)
}
```

Isso inicia dez mil goroutines. Go vai deixar numa boa, porque goroutine é barata.

O que não é barato é tudo que elas encostam. Dez mil conexões simultâneas de banco. Dez mil arquivos abertos. Dez mil requisições ao mesmo tempo pra uma API que te limita em cinquenta. O gargalo nunca é a goroutine.

Um worker pool resolve isso decidindo de antemão quantas coisas acontecem ao mesmo tempo.

## O formato

Um número fixo de workers lendo de um canal só.

```go
func Run(tasks []Task, workers int) {
    jobs := make(chan Task)
    var wg sync.WaitGroup

    for i := 0; i < workers; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for task := range jobs {
                process(task)
            }
        }()
    }

    for _, task := range tasks {
        jobs <- task
    }
    close(jobs)

    wg.Wait()
}
```

O padrão é esse inteiro. Três detalhes sustentam ele:

**Os workers iteram sobre o canal**, então cada um pega a próxima tarefa assim que termina a anterior. O trabalho se distribui sozinho. Um worker que pegou uma tarefa lenta não segura os outros.

**`close(jobs)` encerra os loops.** Iterar sobre um canal fechado para quando ele esvazia, e é isso que permite cada worker sair de forma limpa em vez de bloquear pra sempre.

**`wg.Wait()` bloqueia até todos terminarem**, então a função não retorna com trabalho ainda em andamento.

## Coletando resultados

Processar normalmente produz alguma coisa. Adiciona um segundo canal, e lê enquanto escreve.

```go
func Run(tasks []Task, workers int) []Result {
    jobs := make(chan Task)
    results := make(chan Result, len(tasks))
    var wg sync.WaitGroup

    for i := 0; i < workers; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for task := range jobs {
                results <- process(task)
            }
        }()
    }

    go func() {
        for _, task := range tasks {
            jobs <- task
        }
        close(jobs)
    }()

    go func() {
        wg.Wait()
        close(results)
    }()

    out := make([]Result, 0, len(tasks))
    for r := range results {
        out = append(out, r)
    }
    return out
}
```

A parte que vale reparar é a segunda goroutine anônima. O `close(results)` tem que acontecer depois que todo worker terminou, mas não pode bloquear a goroutine principal que está drenando o canal. Colocar o wait na própria goroutine é o que desata esse nó.

Erra isso e você trava tudo: workers bloqueados escrevendo num canal cheio que ninguém lê, e a goroutine principal bloqueada esperando os workers.

## Cancelamento

Nada acima pode ser interrompido. Depois que começa, roda até o fim mesmo que o usuário tenha fechado a conexão cinco segundos atrás.

Passa um context:

```go
for task := range jobs {
    select {
    case <-ctx.Done():
        return
    default:
    }
    results <- process(task)
}
```

Melhor ainda, faz o `process` receber o context pra que uma chamada HTTP lenta lá dentro morra junto com o resto. Cancelamento que você checa só entre tarefas só ajuda se as tarefas forem curtas.

## Erros

A versão acima finge que nada falha. Trabalho de verdade falha.

A escolha é se uma falha deve parar o lote inteiro. Se sim, o `errgroup` do `golang.org/x/sync` já faz isso, cancelando o context no primeiro erro. Se não, coloca o erro no resultado e conta no final.

O que você não deve fazer é logar o erro dentro do worker e seguir em frente. É assim que um lote reporta sucesso tendo silenciosamente descartado quatrocentas linhas.

## Escolhendo o número

O instinto padrão é `runtime.NumCPU()`. Isso está certo pra trabalho CPU-bound (parse, redimensionamento, compressão), onde mais workers do que cores só adiciona overhead de escalonamento.

Pra trabalho I/O-bound é baixo demais. Um worker esperando resposta de rede não está usando CPU nenhuma, e dá pra rodar muito mais do que você tem de cores com proveito.

Mas não ajuste isso pelo que a sua máquina aguenta empurrar. **Ajuste pelo que a coisa do outro lado consegue absorver.** Se o banco tem um pool de vinte conexões, trinta workers significa que dez ficam permanentemente na fila, e você adicionou latência sem adicionar throughput.

Comece pelo limite do downstream. Meça. Ajuste.

## Quando você não precisa disso

Se as tarefas são poucas, ou rápidas, ou já vêm agrupadas por qualquer coisa que você esteja chamando, um loop simples está correto e o pool é cerimônia.

O padrão ganha seu lugar quando há muitas tarefas, cada uma espera por alguma coisa, e essa coisa tem um limite que você consegue nomear.

Se você não consegue nomear o limite, ainda não está pronto pra escolher o número de workers.
