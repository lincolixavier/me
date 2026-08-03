---
title: "What happens when you type a URL into the browser"
date: 2024-11-18
description: "From parsing the URL to painting the page: the steps between pressing Enter and seeing a site."
tags: ["webdev", "browser", "web"]
---

When you type a URL into your browser and press Enter, a series of steps take place to load the requested page. Here is a simplified breakdown.

**1. URL parsing**

The browser parses the URL to determine the protocol (HTTP or HTTPS), the domain name and the path to the resource.

**2. DNS lookup**

The browser checks its cache for the IP address of the domain. If it is not there, it queries a DNS server to translate the domain name into an IP address.

**3. TCP/IP connection**

The browser establishes a TCP connection with the server using that IP address, through a three-way handshake:

1. The browser sends a SYN packet to the server.
2. The server responds with a SYN-ACK packet.
3. The browser sends an ACK packet back.

**4. HTTP/HTTPS request**

If the URL uses HTTPS, the browser starts a TLS handshake to establish a secure connection, which involves certificate verification and an encryption key exchange. It then sends the request, specifying the resource it wants.

**5. Server processing**

The server receives the request, processes it and locates the resource. That may involve fetching data from a database or running server-side code.

**6. HTTP/HTTPS response**

The server sends a response back, including a status code (200 OK, 404 Not Found and so on) and the resource itself: HTML, CSS, JavaScript, images.

**7. Rendering**

The browser receives the response and starts rendering:

- Parsing the HTML to build the DOM tree.
- Parsing the CSS to apply styles and build the CSSOM tree.
- Parsing and executing JavaScript.
- Combining the DOM and CSSOM into the render tree.

**8. Resource loading**

While parsing the HTML, the browser finds additional resources — images, stylesheets, scripts — that need loading. It sends more requests to fetch them and updates the page as they arrive.

**9. Interaction and updates**

Once the page is loaded, the browser keeps handling user interactions such as clicks and form submissions, and updates the page dynamically as needed.

All of this happens very quickly, usually within a fraction of a second, so pages feel almost instantaneous.

---

[Nomadz community](https://www.patreon.com/nomadz/membership)
