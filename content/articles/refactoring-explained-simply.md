---
title: "Refactoring, explained simply"
date: 2025-06-11
description: "Not a cleanup marathon. A series of small changes that keep the behaviour and improve everything else."
tags: ["programming", "refactoring", "productivity", "engineering"]
---

Refactoring is tidying code that already exists without building anything new. You take the messy version and turn it into something readable and simple to maintain.

A lot of people think refactoring means clearing everything out in one go. It does not. And it certainly does not mean redoing things for the sake of it.

Refactoring is a set of small changes that keep the behaviour identical and leave the code far better organised.

## What it actually is

Changing the internal structure of the code without changing what it does for the user.

The goal is to:

- Improve quality and readability
- Reduce complexity
- Make the architecture simpler and clearer
- Sometimes gain performance along the way

You get there through many micro-refactorings: small, targeted changes that each preserve behaviour.

## Why bother

Usually you decide to refactor when you run into code smells:

- Very long methods
- Duplicated code
- Comments that only exist because the code is unclear
- Badly named variables

Fixing those makes the code easier to understand, easier to maintain and extend, and occasionally faster.

But the biggest reason is none of those. **The biggest reason is economic.**

When you hit those goals, building software gets cheaper. The real motive is productivity, and productivity turns into results for the company or the product.

That, incidentally, is the version every manager wants to hear. If you are asking for time to refactor and framing it as craftsmanship, you are making the argument harder than it needs to be.

## What gets in the way

Refactoring is not just poking at code. There are real obstacles.

**Understanding the system.** You need to know how the code is structured and how the pieces connect. You cannot safely change what you cannot follow.

**Preserving the architecture.** There is no point making it pretty and breaking the logic underneath.

**Having the right tools.** You need to be able to see dependencies, execution paths and the impact of a change.

## Tests come first

Before you start, have automated tests — unit tests especially. They are what stops you breaking something on the way.

The cycle is simple:

1. Make a small change
2. Run the tests
3. Check everything still works
4. Repeat until the code looks the way you want

The faster the tests, the better this works. That is exactly why agile methods like Extreme Programming push tests and continuous refactoring together. They are not two practices. One makes the other possible.

## Common techniques

There is a well-documented catalogue of these. Refactoring Guru has good examples of each, and Martin Fowler's book is the original reference.

Some of the most used:

- **Extract conditional** — pull a large condition into a named constant
- **Generalise type** — create broader types so code can be reused
- **Extract class** — move part of the logic into its own class
- **Extract method** — split a long method into pieces
- **Move method** — put the method on the class where it actually belongs
- **Rename method** — make the name say what it does
- **Remove dead code** — delete what is no longer used

The last one is the easiest and the most avoided. Delete it. It is in version control.

## A bit of history

The term first appeared in 1990, in a paper by William Opdyke and Ralph Johnson. But it was Martin Fowler's book, published in 1999 and updated in 2018, that made the practice mainstream.

## In short

Refactoring keeps what works and improves what is underneath.

It is not a cleanup marathon. It is many small, constant changes. Once it becomes part of the day rather than a project you have to ask permission for, the code stays clean and stays easy to evolve.

Thanks for reading this far.
