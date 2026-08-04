---
title: "Design tokens in practice"
date: "2026-02-10"
description: "How CSS custom properties can replace a design system framework and keep your UI consistent."
tags: ["css", "design", "frontend"]
---

Design tokens are the smallest decisions in a design system: colors, spacing, font sizes, border radii. They're the atoms that everything else is built from.

## Why tokens matter

Without tokens, you end up with `color: #333` in forty files. Change the brand color? Good luck finding them all.

With tokens:

```css
:root {
  --color-text: rgba(255, 255, 255, 0.92);
  --color-accent: #ff2d6d;
  --spacing-sm: 1rem;
  --spacing-md: 1.5rem;
}
```

One source of truth. Change it once, it propagates everywhere.

## CSS custom properties are enough

You don't need Tailwind. You don't need Style Dictionary. You don't need a design system package with 400 dependencies.

A single `tokens.css` file with well-named variables covers 90% of use cases. Import it everywhere. Done.

## Naming conventions

I use a flat, semantic approach:

- `--color-bg`, `--color-text`, `--color-muted`, `--color-accent`
- `--spacing-sm`, `--spacing-md`, `--spacing-lg`
- `--font-size-sm`, `--font-size-base`, `--font-size-xl`

No `--blue-500`. No `--space-4`. Names describe purpose, not value.

## The compound effect

Once tokens are in place, building new components is fast. You stop thinking about pixels and start thinking about relationships. Everything aligns because the constraints are shared.

Small discipline, big payoff.
