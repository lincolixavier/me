---
title: "Vamos falar das sombras na web: Shadow DOM"
date: 2024-09-12
description: "Quando pensamos em construir componentes web modernos, o Shadow DOM se destaca como uma das..."
tags: ["programming", "html", "webdev"]
slug: vamos-falar-das-sombras-na-web-shadow-dom
---

Quando pensamos em construir componentes web modernos, o **Shadow DOM** se destaca como uma das tecnologias mais poderosas e promissoras. Ele permite que desenvolvedores criem componentes com estilos e comportamentos encapsulados, sem interferir nos demais elementos da página. O Shadow DOM não só traz modularidade para o código, como também previne aqueles famigerados conflitos de estilos que surgem quando tudo está no mesmo "balde" do DOM tradicional. 

A grande sacada do Shadow DOM é criar um isolamento quase perfeito entre a "shadow tree" e o resto do documento. Ou seja, o que acontece no Shadow DOM, fica no Shadow DOM. Estilos, scripts, tudo fica ali, separado, sem "vazar" para o restante do documento. Na teoria, isso é incrível para modularidade e organização do código. Por outro lado, esse isolamento pode complicar a vida de quem depende de tecnologias assistivas para navegar na web, afetando a acessibilidade =/

## Entendendo um pouco melhor alguns conceitos:
**DOM**: uma estrutura em forma de árvore de nós conectados que representa os diferentes elementos e sequências de texto que aparecem em um documento HTML

O Shadow DOM permite que árvores DOM ocultas sejam anexadas a elementos na árvore DOM regular — essa árvore DOM shadow começa com uma raiz shadow, abaixo da qual você pode anexar qualquer elemento, da mesma forma que o DOM normal.

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/om1deqvgvz3qpcjghzon.png)

**Shadow host**: Um nó padrão do DOM onde o shadow DOM está anexado.
**Shadow tree**: Um DOM separado dentro do shadow host.
**Shadow boundary**: Basicamente onde shadow DOM termina e DOM padrão começa.
**Shadow root**: Raíz do shadow DOM.

Pode parecer um pouco complicado, mas na prática, é uma maneira simples e eficaz de criar componentes com CSS e JavaScript isolados.

O Shadow DOM é amplamente utilizado em interfaces web do dia a dia. Por exemplo, um player de vídeo numa página web usa Shadow DOM para isolar seus controles, como play, pause e o controle de volume. Graças ao padrão Shadow DOM, os estilos e scripts desses controles não interferem no restante da página.

## Benefícios de Usar Shadow DOM

## Encapsulamento
Quando falamos de encapsulamento no contexto do Shadow DOM, estamos nos referindo ao isolamento de CSS e JavaScript. Isso significa que os estilos e scripts dentro de um Shadow DOM são exclusivos daquele DOM e não interferem com o restante da página.

Esse encapsulamento resolve o problema de **vazamento de CSS**, onde estilos de uma parte da aplicação acabam afetando outra, causando problemas inesperados de layout. Com o Shadow DOM, você pode estilizar elementos sem se preocupar com conflitos de estilos em outras partes da página.

## Independência
Como o Shadow DOM está anexado a um elemento específico, ele forma um ambiente independente. Isso significa que o elemento e seu Shadow DOM podem ser desenvolvidos, testados e implementados separadamente do restante da aplicação.

Essa independência facilita o gerenciamento de grandes aplicações. Os desenvolvedores podem trabalhar em componentes individuais, reduzindo a complexidade e aumentando a manutenibilidade da aplicação. Isso também melhora o desempenho, pois os navegadores podem otimizar o processo de renderização, atualizando apenas os componentes que realmente precisam.

## Reutilização
Outro benefício importante que o Shadow DOM traz ao desenvolvimento web é a reutilização. Um componente construído com Shadow DOM encapsula todos os seus estilos e comportamentos necessários, tornando-se uma unidade autônoma. Isso significa que você pode reutilizar esse componente em diferentes partes da sua aplicação, ou até em aplicações diferentes.

Essa capacidade de reutilização economiza tempo de desenvolvimento e garante consistência em toda a aplicação. Ao reutilizar componentes, você garante que cada instância se comporte e tenha a mesma aparência, proporcionando uma experiência de usuário consistente.

## Vamos ver um exemplo

Vamos criar uma página que contém dois elementos: uma lista desordenada `<ul>` com o id "menu" e uma simples `<p>` com algum texto fora do Shadow DOM:

```html
<div id="menu"></div>
<p>Este parágrafo não está no Shadow DOM</p>
```

Aqui, vamos usar o elemento com o id "menu" como o **shadow host**. Vamos chamar `attachShadow()` no host para criar o Shadow DOM. A seguir, adicionamos nós ao Shadow DOM da mesma forma que faríamos no DOM principal. Neste exemplo, vamos adicionar uma lista `<ul>` com dois itens `<li>`:

```js
const menu = document.querySelector("#menu");
const shadow = menu.attachShadow({ mode: "open" });

const ul = document.createElement("ul");
const li1 = document.createElement("li");
li1.textContent = "Item 1";
const li2 = document.createElement("li");
li2.textContent = "Item 2";

ul.appendChild(li1);
ul.appendChild(li2);
shadow.appendChild(ul);
```

O resultado será uma lista renderizada dentro do Shadow DOM, encapsulada e isolada do restante da página, garantindo que seus estilos e comportamentos não interfiram no documento principal. Enquanto isso, o parágrafo fora do Shadow DOM permanece inalterado.

O que aparece no DOM principal:

```html
<p>Este parágrafo não está no Shadow DOM</p>
```

Mas dentro do **shadow DOM**, temos:

```html
<ul>
  <li>Item 1</li>
  <li>Item 2</li>
</ul>
```

Essa abordagem permite que você crie componentes independentes, mantendo a consistência e o encapsulamento de estilos e comportamentos, sem afetar o restante da página.

## Tá, mas e no mundo real?
1. Imagine que você está criando um widget de calendário ou um player de vídeo que será reutilizado em várias partes da sua aplicação. Usar o Shadow DOM garante que os estilos do widget não sejam afetados pelos estilos globais da página e que as modificações feitas por outros desenvolvedores em diferentes seções do projeto não quebrem o funcionamento ou a aparência do componente.

2. Em uma aplicação SPA (Single Page Application), onde múltiplos componentes estão sendo constantemente atualizados, o uso do Shadow DOM pode ajudar o navegador a focar apenas nos elementos que precisam ser renderizados novamente, evitando atualizações desnecessárias em outros componentes.

3. Em uma aplicação que lida com informações sensíveis, como formulários de pagamento, o uso do Shadow DOM pode garantir que os elementos internos desses componentes estejam protegidos de manipulações externas maliciosas. Claro que todas as outras medidas de segurança precisam ser tomadas, como sanitizar conteúdo por ex.

## Shadow DOM vs Virtual DOM

Muitas vezes, os conceitos de Shadow DOM e Virtual DOM são discutidos juntos, o que leva a uma certa confusão sobre suas diferenças. Embora ambos estejam relacionados ao DOM, eles servem a propósitos diferentes e não são diretamente comparáveis.

O **Virtual DOM** é um conceito popularizado por bibliotecas como React. Ele é uma cópia leve do DOM real, onde as mudanças são feitas primeiro, antes de serem refletidas no DOM real. Esse processo, chamado de "reconciliação", otimiza o desempenho ao minimizar as manipulações do DOM.

O **Shadow DOM**, por outro lado, é um padrão web que encapsula estilos e marcação. Ele não está preocupado com otimizações de atualização do DOM, mas sim em isolar componentes para evitar conflitos de estilo e problemas de escopo global.

Em essência, Shadow DOM e Virtual DOM têm propósitos diferentes. O Shadow DOM fornece encapsulamento de estilo e comportamento para componentes reutilizáveis, enquanto o Virtual DOM otimiza a renderização desses componentes, minimizando as atualizações no DOM real.

Já tinha visto esse conceito? O que ficou em dúvida? Vamos discutir nos comentários :)

Ref: [Doc MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM)

.
.
.
.
.

Quer falar comigo? Tô por aqui:
https://instagram.com/lincoli.xavier
https://www.tiktok.com/@lincoli.xavier
https://twitter.com/lincolixavier
https://youtube.com/@lincoli.xavier/
https://www.lincolixavier.com/
