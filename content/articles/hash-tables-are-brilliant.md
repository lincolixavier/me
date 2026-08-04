---
title: "Hash tables are brilliant"
date: 2025-04-30
description: "How do you find something as fast as possible? The answer turns searching into a single arithmetic step."
tags: ["programming", "algorithms", "fundamentals"]
---

Hash tables are brilliant because they solve a fundamental problem with absurd elegance: how do you find something as fast as possible?

Today it looks almost trivial. But imagine having this idea in the 1950s. Crazier still, it came from someone born in the 19th century.

## The problem

If you have a list of items (say, people's names) and you want to know whether "João" is in there, your options are:

- Walk through everything, O(n). Slow.
- Sort it and use binary search, O(log n). Better, but you still have to sort.

## The magic solution

With hash tables you do it in constant time, O(1) on average.

How? By using a hash function to turn the key, a string for instance, into an array index.

```
"Lincoli" → hash function → index 42 → look at position 42 of the array
```

Fast, direct, no detours.

## What makes it possible

- **Good hash functions**, which distribute data well and avoid collisions.
- **Smart collision handling**: linked lists, open addressing and so on.
- **Key to value**, which is perfect for maps, dictionaries, caches, databases and much more.

## Classic uses

- Dictionaries in Python (`dict`)
- Objects in JavaScript
- Maps in Go, Rust, Java and others
- Caches
- Data indexing in stores like Redis

Hash tables are remarkable because they turn the slow, laborious problem of searching for something into a simple piece of arithmetic.
