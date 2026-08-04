---
title: "Let's talk about shadows on the web: Shadow DOM"
date: 2024-09-12
description: "Encapsulated styles and behaviour, what the isolation buys you, what it costs, and how it differs from the Virtual DOM."
tags: ["programming", "html", "webdev"]
---

When we think about building modern web components, the **Shadow DOM** stands out as one of the most powerful and promising technologies. It lets developers create components with encapsulated styles and behaviour, without interfering with the rest of the page. It brings modularity to the code and prevents those infamous style conflicts that appear when everything sits in the same bucket of the traditional DOM.

The core idea is near-perfect isolation between the shadow tree and the rest of the document. What happens in the Shadow DOM stays in the Shadow DOM. Styles, scripts, all of it stays there without leaking out. In theory that is excellent for modularity and organisation. On the other hand, that same isolation can complicate life for anyone relying on assistive technology to navigate the web, which affects accessibility.

**A few concepts first.**

**DOM**: a tree structure of connected nodes representing the different elements and runs of text that appear in an HTML document.

The Shadow DOM allows hidden DOM trees to be attached to elements in the regular DOM tree. That shadow tree starts with a shadow root, below which you can attach any element, the same way you would in the normal DOM.

- **Shadow host**: a standard DOM node that the shadow DOM is attached to.
- **Shadow tree**: a separate DOM inside the shadow host.
- **Shadow boundary**: where the shadow DOM ends and the standard DOM begins.
- **Shadow root**: the root of the shadow DOM.

It can sound complicated, but in practice it is a simple and effective way to create components with isolated CSS and JavaScript.

The Shadow DOM is widely used in everyday web interfaces. A video player on a page uses it to isolate its controls: play, pause, volume. Thanks to the standard, the styles and scripts of those controls do not interfere with the rest of the page.

## The benefits

**Encapsulation**

Encapsulation here means isolating CSS and JavaScript. Styles and scripts inside a Shadow DOM belong to that DOM and do not interfere with the rest of the page.

That solves **CSS leaking**, where styles from one part of an application end up affecting another and cause unexpected layout problems. With the Shadow DOM you can style elements without worrying about conflicts elsewhere.

**Independence**

Because the Shadow DOM is attached to a specific element, it forms an independent environment. The element and its shadow DOM can be developed, tested and deployed separately from the rest of the application.

That makes large applications easier to manage. Developers can work on individual components, which lowers complexity and improves maintainability. It also helps performance, since browsers can optimise rendering and update only the components that actually need it.

**Reuse**

A component built with Shadow DOM encapsulates all the styles and behaviour it needs, which makes it a self-contained unit. You can reuse it in different parts of your application, or in entirely different applications.

That saves development time and guarantees consistency. By reusing components you ensure every instance behaves and looks the same, which gives users a consistent experience.

## An example

Let's create a page with two elements: an unordered list with the id `menu`, and a simple paragraph outside the Shadow DOM.

```html
<div id="menu"></div>
<p>This paragraph is not in the Shadow DOM</p>
```

We use the element with id `menu` as the **shadow host**. Call `attachShadow()` on the host to create the Shadow DOM, then add nodes to it the same way you would in the main DOM. Here we add a list with two items.

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

The result is a list rendered inside the Shadow DOM, encapsulated and isolated from the rest of the page, so its styles and behaviour do not interfere with the main document. The paragraph outside stays untouched.

What appears in the main DOM:

```html
<p>This paragraph is not in the Shadow DOM</p>
```

And inside the **shadow DOM**:

```html
<ul>
  <li>Item 1</li>
  <li>Item 2</li>
</ul>
```

This approach lets you build independent components, keeping styles and behaviour consistent and encapsulated without affecting the rest of the page.

**Fine, but what about the real world?**

1. Imagine you are building a calendar widget or a video player to be reused across your application. The Shadow DOM guarantees that the widget's styles are not affected by the page's global styles, and that changes other developers make elsewhere in the project will not break how the component works or looks.

2. In a single-page application where many components are constantly updating, the Shadow DOM can help the browser focus only on the elements that need re-rendering, avoiding unnecessary updates elsewhere.

3. In an application handling sensitive information, such as payment forms, the Shadow DOM can help protect the internal elements of those components from external manipulation. Every other security measure still applies, of course: sanitising content, for one.

## Shadow DOM vs Virtual DOM

These two often get discussed together, which causes some confusion about the difference. Both relate to the DOM, but they serve different purposes and are not directly comparable.

The **Virtual DOM** is a concept popularised by libraries like React. It is a lightweight copy of the real DOM, where changes are made first before being reflected in the real thing. That process, called reconciliation, optimises performance by minimising DOM manipulation.

The **Shadow DOM** is a web standard that encapsulates styles and markup. It is not concerned with optimising DOM updates, but with isolating components to avoid style conflicts and global scope problems.

In essence: the Shadow DOM provides style and behaviour encapsulation for reusable components, while the Virtual DOM optimises how those components render by minimising updates to the real DOM.

Reference: [MDN documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM)

Thanks for reading this far.
