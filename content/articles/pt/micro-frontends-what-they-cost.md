---
title: "Micro-frontends, e o que eles custam de verdade"
date: 2022-11-08
description: "Eu arquitetei um em oito módulos de produto. Aqui está o que resolveu, o que não resolveu, e como saber qual dos dois problemas você tem."
tags: ["frontend", "architecture", "webdev", "engineering"]
slug: micro-frontends-e-o-que-eles-custam-de-verdade
---

Passei um ano arquitetando um micro-frontend em oito módulos de produto, com Vue, Nuxt e Single-SPA. Funcionou. Eu faria de novo na mesma situação e recusaria na maioria das outras.

Essa distinção é o texto inteiro.

## O que o padrão é de fato

Pega um frontend grande e divide em aplicações construídas e deployadas de forma independente, compostas em tempo de execução em algo que o usuário percebe como um produto só.

A palavra em que as pessoas se agarram é "independente". É esse o ponto. Não código menor. Release independente.

## O que resolveu pra gente

**Os times pararam de fazer fila uns atrás dos outros.** Oito módulos significavam oito trens de release. Antes, o build quebrado de um time era a tarde bloqueada de todo mundo.

**A propriedade virou real.** Um módulo tinha um time, um deploy e um plantão. "Quem é dono disso" deixou de ser uma pergunta que alguém precisava fazer em reunião.

**A stack pôde se mover aos poucos.** Dá pra atualizar um módulo e deixar os outros sete quietos. Isso é muito difícil de dizer de um frontend monolítico, onde uma atualização é um evento da empresa inteira.

## O que custou

**Estado compartilhado fica difícil na hora.** Autenticação, feature flags, o objeto do usuário. Todo módulo precisa deles e nenhum é dono. Você acaba construindo uma camada de contrato, e essa camada vira uma coisa que time nenhum é dono também.

**Duplicação é o padrão.** Cada módulo entrega o próprio runtime do framework, a não ser que você trabalhe pra evitar. Deixado por conta, um visitante baixa Vue várias vezes. Resolver isso significa dependências compartilhadas, o que significa coordenação de versão, que é exatamente o acoplamento do qual você se dividiu pra fugir.

**O design system deixa de ser opcional.** Com um app só, inconsistência aparece no review. Com oito, ninguém enxerga o produto inteiro de uma vez, e a coisa desvia em silêncio. A gente construiu o design system com Storybook e padronizou estado com Pinia, não como um extra bacana, mas porque sem isso os módulos teriam se separado visualmente em questão de meses.

**Debug atravessa fronteiras.** Um bug que mora entre dois módulos não pertence a nenhum. Esses foram os que levaram mais tempo pra corrigir, sempre.

## Como saber se você precisa

Uma pergunta: **seu gargalo é o código ou a coordenação?**

Se os deploys são lentos porque o build é lento, micro-frontends não vão ajudar. Isso é problema de build, e você vai continuar com ele depois, uma vez por módulo.

Se os deploys são lentos porque cinco times precisam concordar sobre quando lançar, isso é coordenação, e esse padrão ataca o problema direto.

Quase todo time que me perguntou sobre micro-frontends tinha o primeiro problema e queria a solução do segundo.

## O que eu diria pra um time menor

Não faça.

Abaixo de uns três times, o custo de coordenação que você paga hoje é menor que o custo de coordenação que você está prestes a comprar. Você vai gastar meses construindo infraestrutura compartilhada pra resolver um problema que daria pra resolver com uma política de branch.

Um monolito modular te dá quase todos os benefícios de propriedade sem nada da composição em runtime. Fronteiras claras num codebase só, um deploy, um lugar pra debugar. É por aí que eu começaria, todas as vezes.

## O resumo honesto

Micro-frontends são uma solução organizacional vestida de fantasia técnica.

Eles resolvem um problema de gente (times se bloqueando) pagando em complexidade. Quando você genuinamente tem esse problema de gente, é uma boa troca. Quando não tem, você comprou a complexidade e não levou nada em troca.

Pergunte o que está lento de verdade antes de escolher a arquitetura que já assume a resposta.
