# lincolixavier.com

Personal site with Three.js neural network animation. Articles are built from Markdown in `content/` via `scripts/build.js`.

## Setup

```bash
bun install
```

## Build

```bash
bun run build
```

Roda localmente; gera `dist/articles/*.html` a partir de `content/articles/*.md`. Deploy é só dos arquivos estáticos (raiz + `dist/`, `src/`, etc.).

## Dev

Servidor local só para preview sem CORS / `file://` (módulos ES e recursos não funcionam abrindo o HTML direto).

```bash
bun run dev
```

Abre http://localhost:3000
