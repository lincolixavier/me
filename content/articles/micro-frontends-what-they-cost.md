---
title: "Micro-frontends, and what they actually cost"
date: 2022-11-08
description: "I architected one across eight product modules. Here is what it solved, what it did not, and how to tell which one you have."
tags: ["frontend", "architecture", "webdev", "engineering"]
---

I spent a year architecting a micro-frontend across eight product modules, with Vue, Nuxt and Single-SPA. It worked. I would do it again in the same situation and I would refuse it in most others.

That distinction is the whole post.

## What the pattern actually is

Take one large frontend and split it into independently built and deployed applications, composed at runtime into something the user experiences as a single product.

The word people latch onto is "independent". That is the point. Not smaller code. Independent release.

## What it solved for us

**Teams stopped queuing behind each other.** Eight modules meant eight release trains. Before, one team's broken build was everyone's blocked afternoon.

**Ownership got real.** A module had a team, a deploy and a pager. "Who owns this" stopped being a question anyone had to ask in a meeting.

**The stack could move gradually.** You can upgrade one module and leave the other seven alone. That is very hard to say about a monolithic frontend, where an upgrade is a company-wide event.

## What it cost

**Shared state gets hard immediately.** Auth, feature flags, the user object. Every module needs them and none of them owns them. You end up building a contract layer, and that layer becomes something no team owns either.

**Duplication is the default.** Every module ships its own framework runtime unless you work at it. Left alone, a visitor downloads Vue several times. Solving that means shared dependencies, which means version coordination, which is exactly the coupling you split to escape.

**The design system stops being optional.** With one app, inconsistency shows up in review. With eight, nobody sees the whole product at once, and it drifts silently. We built the design system with Storybook and standardised state with Pinia — not as a nice extra, but because without it the modules would have visually separated within months.

**Debugging crosses boundaries.** A bug that lives between two modules belongs to neither. Those took the longest to fix, every time.

## How to tell if you need it

One question: **is your bottleneck the code, or the coordination?**

If deploys are slow because the build is slow, micro-frontends will not help. That is a build problem, and you will still have it afterwards, once per module.

If deploys are slow because five teams have to agree on when to ship, that is coordination, and this pattern attacks it directly.

Almost every team that asked me about micro-frontends had the first problem and wanted the second one's solution.

## What I would tell a smaller team

Do not.

Under roughly three teams the coordination cost you are paying is smaller than the coordination cost you are about to buy. You will spend months building shared infrastructure to solve a problem you could have solved with a branch policy.

A modular monolith gets you most of the ownership benefits with none of the runtime composition. Clear boundaries in one codebase, one deploy, one place to debug. That is where I would start, every time.

## The honest summary

Micro-frontends are an organisational solution wearing a technical costume.

They fix a people problem — teams blocking each other — by paying in complexity. When you genuinely have that people problem, it is a good trade. When you do not, you have bought the complexity and got nothing back.

Ask what is actually slow before you pick the architecture that assumes the answer.
