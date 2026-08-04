---
title: "Five rendering modes for your web app"
date: 2026-08-04
description: "SSR, SPA, SSG, ISR and ESR. What each one actually does, what it costs, and the questions that pick one for you."
tags: ["webdev", "frontend", "architecture", "performance"]
---

Every few months someone asks me which framework to use, and almost always the real question underneath is which rendering mode they need. The framework follows from that, not the other way around.

So here are the five, what each one really does, and where I would use it.

## SSR: Server-Side Rendering

Old but gold. The server builds the HTML and the browser gets a finished page.

Fast first paint, friendly to search engines, and the content is there before any JavaScript runs. You pay for it with a server that has to do work on every request.

**Use it when** content changes constantly and timing matters: news, forums, marketplaces, anything where a page from ten minutes ago is already wrong.

Frameworks: classic MVC, Next, Nuxt, Angular Universal.

## SPA: Single Page Application

The app loads once and JavaScript takes over from there. Moving between routes costs nothing because there is no round trip.

The experience is smooth. The cost is the first load, which has to ship and boot the whole application before anyone sees anything, and search engines get a mostly empty document unless you do extra work.

**Use it when** the thing behind a login does not need SEO: dashboards, internal tools, editors. If nobody is finding it on Google, you are paying the SEO penalty on an empty account.

Frameworks: Vue, React, Angular, Svelte.

## SSG: Static Site Generation

Every page is rendered once, at build time. What ships is HTML sitting on a CDN.

This is the fastest and the safest of the five, and it needs no application server at all. The catch is obvious: content only changes when you rebuild.

**Use it when** the content changes on a human schedule rather than a machine one: documentation, marketing sites, blogs. This site is SSG, and the whole build takes about a hundred milliseconds.

Frameworks: Hugo, Jekyll, Astro, Eleventy, or a script you wrote yourself.

## ISR: Incremental Static Regeneration

The middle ground. Pages are static, but they regenerate in the background at an interval you choose.

A reader gets the old version instantly while the new one is being built, and the next reader gets the new one. You keep static speed and lose the rebuild-for-every-typo problem.

**Use it when** the content updates often but nobody is harmed by being an hour behind. A blog with comments. A product catalogue. It does need a host that supports it, and Vercel and Netlify do.

## ESR: Edge-Side Rendering

Rendering that happens on the CDN itself, physically close to the reader.

The obvious win is latency: the render happens a few hundred kilometres away instead of a few thousand. The interesting win is that you can personalise a response without giving up the edge: geolocation, A/B tests, feature flags.

The constraint is real, though. Edge runtimes are not full Node. No filesystem, limited APIs, tight execution budgets. Code that works locally can fail there for reasons that have nothing to do with your logic.

Platforms: Vercel Edge Functions, Cloudflare Workers, Lambda@Edge.

## Choosing without agonising over it

Four questions get you most of the way:

**Does it need SEO?** No means SPA is on the table. Yes rules it out unless you are willing to do the work.

**How often does the content change?** Weekly or less is SSG. Hourly is ISR. Constantly is SSR.

**Do you want to run a server?** If the answer is no, you are choosing between SSG and SPA.

**Does the first load matter?** If someone is going to bounce during it, that pushes you toward anything that renders ahead of time.

A worked example: SEO matters, content updates weekly, you would rather not run a server, and first load is important. That is SSG, and you did not need a meeting to get there.

## One thing worth understanding

Every mode except pure SPA still renders on the client afterwards. The server sends HTML, then the framework boots and takes over the same markup, which is hydration.

That is why "SSR" does not mean "no JavaScript". It means the first paint does not wait for it.

People pick SSR expecting the bundle to disappear, then wonder why the page is still heavy. The bundle is still there. What changed is when the reader first sees something.

---

Which one are you using most? I have moved almost everything I own to SSG and I have not missed the server once.
