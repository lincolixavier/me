---
title: "Hash tables são geniais"
date: 2025-04-30
description: "Uma das soluções mais elegantes da ciência da computação"
tags: ["programming", "algorithms", "fundamentals"]
slug: hash-tables-sao-geniais
---

Hash tables são geniais por que elas resolvem um problema fundamental com uma elegância absurda: como encontrar algo o mais rápido possível Hoje parece até trivial, mas imagine essa idéia nos anos 50... e mais louco ainda, foi inventado por alguém que nasceu no século 19.

## O problema

Se você tem uma lista de itens (por exemplo, nomes de pessoas), e quer saber se "João" está lá, as opções são:

- Percorrer tudo (O(n)) — lento.

- Ordenar e usar busca binária (O(log n)) — melhor, mas ainda precisa ordenar.

## A solução mágica

> Com Hash Tables, você faz isso em **tempo constante, O(1)** (na média).

Como? Usando uma **função hash** para converter a chave (tipo uma string) em um índice de array.

```
"Lincoli" -> função hash -> índice 42 -> olha na posição 42 do array
```

Boom. Rápido, direto, sem rodeios.

## ⚙️ O que torna isso possível?

- **Funções hash** boas: distribuem os dados bem, evitando colisões.

- **Estruturas de colisão inteligentes**: listas encadeadas, open addressing, etc.

- **Chave -> valor**: perfeito para mapas, dicionários, caches, bancos de dados, e muito mais.

---

### 🧠 Casos de uso clássicos

- Dicionários em Python (`dict`)

- Objetos em JavaScript

- Mapas em Go, Rust, Java, etc.

- Caches

- Indexação de dados em bancos como Redis

Hash Tables são incríveis porque transformam o problema de buscar algo de forma lenta e trabalhosa em **uma simples conta matemática**.

Vem:

Subscrevere:

[Deixe um comentário](https://lincolixavier.substack.com/p/hash-tables-sao-geniais/comments)

=D
