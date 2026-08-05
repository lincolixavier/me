---
title: "Design tokens na prática"
date: "2026-02-10"
description: "Como CSS custom properties substituem um framework de design system e mantêm sua UI consistente."
tags: ["css", "design", "frontend"]
slug: design-tokens-na-pratica
---

Design tokens são as menores decisões de um design system: cores, espaçamentos, tamanhos de fonte, raios de borda. São os átomos que sustentam todo o resto.

## Por que tokens importam

Sem tokens, você acaba com `color: #333` em quarenta arquivos. Mudou a cor da marca? Boa sorte pra achar todos.

Com tokens:

```css
:root {
  --color-text: rgba(255, 255, 255, 0.92);
  --color-accent: #ff2d6d;
  --spacing-sm: 1rem;
  --spacing-md: 1.5rem;
}
```

Uma fonte de verdade só. Muda uma vez, propaga pra tudo.

## CSS custom properties bastam

Você não precisa de Tailwind. Não precisa de Style Dictionary. Não precisa de um pacote de design system com 400 dependências.

Um único arquivo `tokens.css` com variáveis bem nomeadas cobre 90% dos casos. Importa em todo lugar. Pronto.

## Convenções de nome

Eu uso uma abordagem plana e semântica:

- `--color-bg`, `--color-text`, `--color-muted`, `--color-accent`
- `--spacing-sm`, `--spacing-md`, `--spacing-lg`
- `--font-size-sm`, `--font-size-base`, `--font-size-xl`

Nada de `--blue-500`. Nada de `--space-4`. O nome descreve o propósito, não o valor.

## O efeito composto

Com os tokens no lugar, construir componente novo fica rápido. Você para de pensar em pixel e passa a pensar em relação. Tudo se alinha porque as restrições são compartilhadas.

Pouca disciplina, muito retorno.
