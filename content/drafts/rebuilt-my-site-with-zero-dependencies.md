---
title: "I rebuilt my site with zero dependencies, and almost everything I got right came from measuring"
date: 2026-08-04
description: "No framework, no bundler, no node_modules. 100/100 on Lighthouse. The road there was mostly me being wrong in public."
tags: ["webdev", "performance", "engineering"]
---

I rebuilt lincoli.me from scratch. No framework, no bundler, no `node_modules` in the build. Just Node and a folder of Markdown.

The result is 47 pages, 39 articles, 100/100 on Lighthouse for desktop and mobile.

But let me be straight with you: that number is the ending. The middle was me being confidently wrong several times in a row, and the only reason it got fixed is that I eventually stopped guessing and started measuring.

That is the actual post. The zero-dependency part is just the setting.

## What zero dependencies really costs

The build has no dependencies. That means I wrote by hand:

- A Markdown parser
- Syntax highlighting for code blocks
- A CSS minifier
- A social preview image generator
- The static site generator itself

Before you think this is purity theatre, understand where I drew the line. Three.js still comes from a CDN, because writing a WebGL engine is not a weekend and I am not pretending otherwise. The font is self-hosted, but I did not draw it.

The rule I actually followed is narrower than "no dependencies": **do not install a package to do something I can write in an afternoon and will need to understand later.**

A Markdown parser for five languages of code blocks and my own posts is an afternoon. A 3D renderer is not.

## The parser was eating my content

The old build used a Markdown parser I had written earlier, and I trusted it. That was the mistake.

I ran the real posts through it and watched what came out:

```
[my post](https://ex.com/a_b_c)   →  href="https://ex.com/a<em>b</em>c"
`snake_case_name`                 →  <code>snake<em>case</em>name</code>
- item                            →  the line after the list disappeared
![alt](img.png)                    →  rendered as a link, not an image
> quote                            →  &gt; quote
```

Look at the third one. A line following a list was **silently deleted**. Not mangled, not escaped. Gone. I had been publishing with that.

The cause was ordering. Emphasis ran before links, so an underscore inside a URL became italic before the link rule ever saw it. And the block parser split on blank lines, which meant any line that did not match a rule fell through a gap.

The rewrite is line-driven: every line gets consumed by exactly one branch, so nothing can fall through. Code spans and URLs get pulled out of the text before emphasis runs, and put back afterwards.

Fifteen tests now cover exactly the cases that used to break. Every one of them is a bug that shipped.

**If you wrote your own tooling, run your real content through it and read the output.** Not a sample. The actual thing.

## Twenty-three seconds of blocking time

This is the part worth reading.

I had a full-screen animated WebGL background. I optimised it properly: bloom at half resolution, geometry counted, antialiasing turned off where it did nothing. I measured with Lighthouse and got 500ms of Total Blocking Time on desktop. Fine.

Then the real PageSpeed report came back: **23,550ms**.

Twenty-three seconds. Two orders of magnitude off what I measured.

I re-ran my tests. Still 500ms. Ran them again. Still 500ms.

The difference was not the code. **The machines that run PageSpeed have no GPU.** They fall back to SwiftShader, a software rasteriser, and every pixel of every frame of my beautiful background was being drawn by the CPU.

My laptop has a GPU. I had been measuring a scenario that was not the user's.

The fix was not to tune the shader. It was to ask the renderer what it actually is:

```js
const gl = renderer.getContext();
const info = gl.getExtension("WEBGL_debug_renderer_info");
const name = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "";
const isSoftware = /swiftshader|llvmpipe|software/i.test(name);
```

If there is no GPU, draw the scene once and leave it still. It would stutter on that machine anyway. Stopping is the correct behaviour, not a trick to score points.

I reproduced it locally with `--disable-gpu --use-gl=swiftshader` and confirmed both sides:

```
with a GPU          score 100, TBT 20ms   (animation runs, unchanged)
software rendering  score 100, TBT 0ms    (was 23,550ms)
```

The lesson is not about WebGL. It is that **your measuring environment is a variable, and if you do not control for it you are measuring yourself.**

## The cascade caught me three times

Same bug, three different symptoms, three separate sessions of me fixing the wrong thing.

A media query does not raise specificity. A later rule of equal weight wins regardless of the query it sits in. My mobile overrides were in a block halfway up a 1,900-line stylesheet, and the desktop rules they were meant to beat were defined further down.

Symptom one: the about text was half a screen wide on mobile.
Symptom two: the article page was clipped to 208 pixels.
Symptom three: the actions rail was invisible on phones.

I fixed the first two by adjusting padding. Both came back somewhere else, because I was treating symptoms.

What finally worked was opening a headless browser at phone width and printing the numbers:

```
.about-content   245px wide on a 485px viewport
.prose           140px
.listing-page    208px tall
doc scrollHeight 1306 against a 757px screen
```

Two minutes of that told me more than three rounds of tweaking. The desktop layout is a fixed-height app shell with panes that scroll internally, and a phone needs an ordinary flowing document. I had been patching panes instead of converting the shell.

One variable was doing most of the damage. `--content-padding-left` indents content 80px so the text clears the 3D background. On a phone the container already has page padding, so the two stacked, and **every wrapper that used the variable lost 80px off its left edge.** Zeroing it once fixed the about page, the life page, the gear cards and the articles at the same time.

## The other things measuring found

Once I started actually looking, the rest fell out quickly.

**A third of every frame was rendered off screen.** The canvas was 100% wide, pushed 33% past the right edge. I did not shrink the design. I sized the canvas to the visible strip and used `camera.setViewOffset()` to render exactly that sub-rectangle of the original frustum. Same framing, a third fewer pixels.

**The stylesheets loaded in a chain.** Four `@import` rules, which the browser cannot even discover until the first file has arrived and parsed. Worse, it left a window where the document was rendering but custom properties were not readable yet, which broke the canvas on cold loads and worked perfectly on every reload. Classic. The build concatenates them now.

**The font was costing 780ms of render blocking.** A DNS lookup, a TLS handshake and a stylesheet round trip on Google's origin before a single glyph could be requested. Self-hosted it is one request on a connection that is already open. I also shipped four weights instead of six, because two of them were never used by any rule on the site.

**The CSS had no cache key.** One filename, one hour of cache. A deploy could hand a browser new markup while it kept applying the old stylesheet. That is exactly what happened, and it looked like broken CSS rather than a stale cache. The link carries a content hash now.

## What is actually dynamic

The site is static, but three things are not: view counts, likes and the newsletter.

Those run as Vercel Functions against Upstash Redis. `INCR` is atomic, which is the entire reason to use Redis here instead of object storage: two people hitting an article at the same time cannot lose a count.

No dependency for that either. Upstash and Resend both have REST APIs, so it is `fetch`.

And nothing identifying is stored. Whether *you* viewed or liked something lives in your own `localStorage`; the server only ever moves a number. Clearing your storage lets you like twice. For a personal blog that is a much better trade than tracking people, and it means no cookie banner, by design and not by omission.

While auditing this I found a real hole: **the counters had no rate limit.** Eight consecutive requests took a post from 1 like to 8. Anyone with a loop could have written any number they wanted. Writes are limited per address now; reads stay open.

I only found it because I sat down and tried to break my own endpoints. Do that.

## What I would not do again

**Committing 7.8MB of preview images.** They work and the deploy never depends on a browser being installed, but the repository carries the weight of every regeneration forever.

**Leaving the CSS as one 1,900-line file.** Three bugs came out of ordering in that file. CSS layers would have made the order explicit instead of accidental.

**Putting off the CSP.** It is still not there. It is the largest remaining gap and I knew it a week ago.

## The actual takeaway

I got the architecture right on instinct. Static generation, no dependencies, content in Markdown. None of that needed measuring, and none of it caused a single problem.

Every real bug was in the layer where I assumed instead of checked. The parser I trusted. The performance I measured on the wrong machine. The CSS I fixed by adjusting padding until it looked right on my screen.

The fastest tool I used on this project was not a framework. It was a headless browser printing `getBoundingClientRect()` at phone width.

**Guessing is faster right up until it is not.**

---

The site is at [lincoli.me](https://www.lincoli.me). If you have rebuilt your own and hit something similar, I want to hear it.
