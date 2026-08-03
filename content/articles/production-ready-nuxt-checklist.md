---
title: "Checklist for a complete, production-ready Nuxt project"
date: 2025-03-04
description: "Fifteen areas worth settling before a Nuxt project grows: structure, state, performance, testing, security."
tags: ["nuxt", "webdev", "checklist"]
---

A complex Nuxt.js project needs a well-organised structure, the right tooling and good practices to stay performant, scalable and maintainable.

Here are the main points that may be needed.

**1. Initial setup**

- TypeScript: static typing and more safety in the code.
- ESLint and Prettier: keep the code to a standard.
- Husky and lint-staged: run checks before commits.
- Sass/SCSS/PostCSS: for complex styling.

**2. State management**

- Pinia, preferable to Vuex: reactive, scalable global state.
- Nuxt's `useState`: simple local state inside pages and composables.

**3. Consuming APIs**

- TanStack Query, `useFetch` or `useAsyncData`: fetching with SSR support and caching.
- Nuxt API routes: lightweight backends inside the project.
- Request middleware: for logging, authentication and error handling.

**4. Performance and optimisation**

- Code splitting and lazy loading: load only what is needed.
- Optimised images with `nuxt/image`: formats, sizes and loading.
- Static generation (SSG), server-side rendering (SSR) or ISG: pick according to the project.

**5. SEO and accessibility**

- `useHead()` or the Nuxt SEO module: manage metadata and SEO.
- Sitemap and robots.txt: automate generating both.
- Schema.org: structured data for advanced SEO.

**6. Authentication and authorisation**

- Nuxt Auth or OAuth2/JWT: secure login.
- Auth middleware: protect private routes.

**7. Components and UI**

- Storybook: document and develop components in isolation. Choose to use it wisely.
- Reusable UI components: build a library or use a framework such as Vuetify, MUI, Naive UI or Element Plus.
- Design tokens: centralise colours, spacing and fonts.

**8. Testing**

- Vitest: unit tests.
- Vue Testing Library: component tests.
- Cypress or Playwright with BDD: end-to-end tests. I prefer Playwright.

**9. Infrastructure and deploy**

- CI/CD with GitHub Actions or Vercel/Netlify: automate deploys and tests.
- Docker: standardise the environment.
- Monitoring and logs: tools like Sentry or LogRocket.

**10. Scalability and organisation**

- A well-defined folder structure.
- Modularisation: separate code into composables and stores.
- Always work with DDD's bounded contexts when laying out folders and files. Keep everything from the same context close together.

**11. Advanced features**

- Internationalisation with `nuxt/i18n`: multi-language support.
- WebSockets or SSE: real-time communication.
- PWA with `@nuxt/pwa`: turn the app into a Progressive Web App.

**12. Analytics and monitoring**

- Google Analytics, Plausible or Matomo: user behaviour tracking.
- Sentry: error monitoring.
- Hotjar or FullStory: heatmaps.

**13. Documentation**

- A well-written README on GitHub.
- ADRs (architecture decision records): document the decisions.
- Comments and JSDoc: to make maintenance easier.

**14. Dependency management**

- pnpm, Bun or Yarn: pick a fast package manager.
- Renovate or Dependabot: keep packages updated automatically.

**15. Security**

- Rate limiting: avoid API abuse.
- Input sanitisation: prevent XSS and code injection.

This checklist covers a robust Nuxt.js project with a focus on good practices, scalability and performance.

I think it covers nearly everything for a top-tier project today. What did I miss?
