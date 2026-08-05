---
title: "Checklist de backend para uma aplicação web real em Go"
date: 2024-05-16
description: "Tudo que existe entre um handler que devolve 200 e algo que você assinaria embaixo em produção."
tags: ["go", "backend", "checklist", "engineering"]
slug: checklist-de-backend-para-aplicacao-web-real-em-go
---

Escrever um handler HTTP em Go leva dez minutos. Escrever um backend que você deixaria rodando sem supervisão leva bem mais, e quase toda a diferença está em coisas que ninguém demonstra.

Essa é a lista que eu realmente percorro. Nem tudo se aplica a todo projeto, mas se você pulou um item, que seja porque decidiu pular, não porque esqueceu.

## 1. Organização do projeto

Agrupe por domínio, não por papel técnico. `user/`, `billing/`, `order/`, e não `handlers/`, `services/`, `repositories/` com cada funcionalidade espalhada pelos três.

Guarde `cmd/` pros pontos de entrada e `internal/` pra qualquer coisa que você não quer que seja importada de fora. O `internal/` é garantido pelo compilador, o que faz dele a fronteira arquitetural mais barata que Go te dá.

## 2. Configuração

Leia do ambiente, valide no startup, e falhe alto se algo obrigatório estiver faltando.

Um servidor que sobe sem a URL do banco e só descobre isso na primeira requisição transformou um erro de deploy em um erro na cara do usuário.

## 3. Camada HTTP

- Defina timeouts no servidor. `ReadTimeout`, `WriteTimeout`, `IdleTimeout`. O padrão é nenhum timeout, o que significa que um cliente lento pode segurar uma conexão pra sempre.
- Use o `http.ServeMux` do 1.22 ou um router pequeno. Você não precisa de framework pra roteamento.
- Middleware pra log, recovery, request ID, CORS. Mantenha a ordem deliberada: o recovery tem que ser o mais externo, senão não consegue capturar o que os outros fazem.
- Limite o corpo das requisições com `http.MaxBytesReader`. Leitura sem limite é um vetor de exaustão de memória, e não um teórico.

## 4. Context em todo lugar

Toda função que faz I/O recebe um `context.Context` como primeiro argumento, e respeita ele de verdade.

Essa é a diferença entre um cliente desconectar e sua query no banco parar, versus um cliente desconectar e sua query rodar até o fim pra ninguém.

## 5. Erros

Embrulhe com `%w` pra quem chama conseguir desembrulhar. Defina erros sentinela pras coisas em que quem chama precisa ramificar. Não devolva erro cru de banco pra um handler que vai jogar isso numa resposta.

Duas regras que poupam mais dor:

**Trate ou retorne, nunca os dois.** Logar um erro e também retornar ele significa que ele aparece duas vezes no log, vindo de camadas diferentes, e você aprende a desconfiar da contagem.

**Erro que cruza a fronteira HTTP é traduzido.** O cliente recebe um status code e uma mensagem segura. Os detalhes vão pro log com o request ID.

## 6. Banco de dados

- Defina limites do pool de conexões: `SetMaxOpenConns`, `SetMaxIdleConns`, `SetConnMaxLifetime`. O padrão é ilimitado, e é assim que um pico de tráfego derruba o banco em vez da aplicação.
- Migrations no controle de versão, aplicadas por uma ferramenta, nunca na mão.
- Prepared statements ou um query builder. Concatenar string em SQL é como injeção acontece, e Go facilita evitar isso.
- Transações onde você precisa de atomicidade, e `defer tx.Rollback()` logo depois de abrir. O commit torna isso um no-op, e te salva quando um return antecipado vazaria a transação.

## 7. Shutdown gracioso

No `SIGTERM`, pare de aceitar conexões novas, deixe as requisições em andamento terminarem dentro de um prazo, e então feche o banco.

Sem isso, todo deploy derruba o que estava no meio de uma requisição. Num serviço movimentado isso não é caso extremo, é todo deploy.

```go
ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
defer cancel()

go func() { srv.ListenAndServe() }()
<-ctx.Done()

shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
defer cancel()
srv.Shutdown(shutdownCtx)
```

## 8. Observabilidade

**Log estruturado** com `log/slog`. Inclua um request ID em toda linha pra você conseguir reconstruir uma requisição no meio de um milhão.

**Métricas** pras coisas pelas quais você acordaria alguém de madrugada: taxa de requisição, taxa de erro, percentis de latência, saturação do pool.

**Endpoints de health**, e faça dois. Liveness responde "o processo está vivo". Readiness responde "ele consegue atender tráfego", que é diferente, e a diferença importa no instante em que seu banco cai e o orquestrador começa a matar pods saudáveis.

## 9. Segurança

- Valide toda entrada na fronteira. Limite de tamanho, tipo, faixa, valores permitidos.
- Faça hash de senha com bcrypt ou argon2, nunca com algo que você mesmo inventou.
- Aplique rate limit em qualquer coisa que custa dinheiro ou envia e-mail.
- Defina headers de segurança, e configure o CORS pras origens que você usa de fato em vez de `*`.
- Mantenha segredos no ambiente. Nunca no repositório, nunca numa linha de log.

## 10. Testes

Testes orientados a tabela, porque o pacote de testes do Go é feito pra isso e eles fazem adicionar um caso virar uma linha.

Teste os handlers com `httptest`, e a camada de banco contra um banco de verdade num container em vez de um mock. Mocks confirmam que seu código chama o que você mandou chamar. Eles não confirmam que a query é válida.

## 11. Build e deploy

- Dockerfile multi-stage, imagem final `FROM scratch` ou distroless. Um binário Go não precisa de mais nada.
- `CGO_ENABLED=0` pra um binário estático, a não ser que você saiba por que precisa de cgo.
- Fixe a versão do Go no CI na mesma do `go.mod`.
- `go vet` e um linter no pipeline, quebrando o build.

## A versão curta

A maior parte dessa lista é sobre o que acontece quando algo dá errado: um cliente desconecta, o banco está lento, um deploy cai no meio de uma requisição, uma entrada é hostil.

O handler que devolve 200 é a parte fácil, e é a parte que todo tutorial cobre. Tudo acima é o que separa código que funciona na sua máquina de um serviço que você pode deixar rodando.
