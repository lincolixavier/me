---
title: "O que acontece quando você digita uma URL no navegador"
date: 2024-11-18
description: "Do parse da URL até a pintura da página: os passos entre apertar Enter e ver um site."
tags: ["webdev", "browser", "web"]
slug: o-que-acontece-quando-voce-digita-uma-url-no-navegador
---

Quando você digita uma URL no navegador e aperta Enter, uma série de passos acontece pra carregar a página pedida. Aqui vai uma versão simplificada.

**1. Parse da URL**

O navegador analisa a URL pra determinar o protocolo (HTTP ou HTTPS), o nome de domínio e o caminho até o recurso.

**2. Consulta DNS**

O navegador procura no cache o IP do domínio. Se não estiver lá, consulta um servidor DNS pra traduzir o nome de domínio em um endereço IP.

**3. Conexão TCP/IP**

O navegador estabelece uma conexão TCP com o servidor usando esse IP, através de um handshake de três vias:

1. O navegador envia um pacote SYN pro servidor.
2. O servidor responde com um pacote SYN-ACK.
3. O navegador devolve um pacote ACK.

**4. Requisição HTTP/HTTPS**

Se a URL usa HTTPS, o navegador inicia um handshake TLS pra estabelecer uma conexão segura, o que envolve verificação de certificado e troca de chaves de criptografia. Depois envia a requisição, especificando o recurso que quer.

**5. Processamento no servidor**

O servidor recebe a requisição, processa e localiza o recurso. Isso pode envolver buscar dados num banco ou executar código server-side.

**6. Resposta HTTP/HTTPS**

O servidor devolve uma resposta, incluindo um status code (200 OK, 404 Not Found e por aí vai) e o recurso em si: HTML, CSS, JavaScript, imagens.

**7. Renderização**

O navegador recebe a resposta e começa a renderizar:

- Faz o parse do HTML pra montar a árvore DOM.
- Faz o parse do CSS pra aplicar estilos e montar a árvore CSSOM.
- Faz o parse e executa o JavaScript.
- Combina DOM e CSSOM na render tree.

**8. Carregamento de recursos**

Enquanto faz o parse do HTML, o navegador encontra recursos adicionais (imagens, folhas de estilo, scripts) que precisam ser carregados. Envia mais requisições pra buscá-los e atualiza a página conforme eles chegam.

**9. Interação e atualizações**

Com a página carregada, o navegador continua tratando as interações do usuário, como cliques e envios de formulário, e atualiza a página dinamicamente conforme necessário.

Tudo isso acontece muito rápido, normalmente numa fração de segundo, então as páginas parecem quase instantâneas.

---

[Comunidade Nomadz](https://www.patreon.com/nomadz/membership)
