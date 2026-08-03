---
title: "9 Web APIs that do actual magic"
date: 2024-03-28
description: "Light sensors, Bluetooth, cross-tab messaging, screen capture and more — things the browser can do that it has no business doing."
tags: ["webapis", "javascript", "webdev"]
---

*If we went back twenty years, or even less, and told the web developers of the time what browsers can do today, they would not believe us. Looking at it in perspective, what browsers do now would surely earn Chrome, Firefox and Edge a place at Hogwarts. We also know who would be left out. Here is a tour of some Web APIs that pull off real magic, particularly on mobile.*

## 1. Ambient Light Events

When a device's light sensor detects a change in light level, it notifies the browser. Think about what you could do with photography, dark environments, or instant accessibility contrast adjustments.

```javascript
if ('ondevicelight' in window) {
  window.addEventListener('devicelight', function (event) {
    var body = document.querySelector('body');
    if (event.value < 50) {
      body.classList.add('darklight');
      body.classList.remove('brightlight');
    } else {
      body.classList.add('brightlight');
      body.classList.remove('darklight');
    }
  });
} else {
  console.log('devicelight event not supported');
}
```

*Support: Firefox, Firefox Android.*

## 2. Web Bluetooth API

What if I told you websites can talk to nearby Bluetooth devices securely and with privacy preserved? Heart rate monitors, glucose meters and much more could interact directly with a site.

Until now, interacting with Bluetooth devices was only possible for platform-specific apps. The Web Bluetooth API aims to change that and bring it to browsers too.

As a security measure, discovering devices with `navigator.bluetooth.requestDevice` must be triggered by a user action such as a tap or a mouse click. That means listening for `pointerup`, `click` and `touchend`.

```javascript
button.addEventListener('pointerup', function (event) {
  // Call navigator.bluetooth.requestDevice
});
```

That is how you reach battery information, for example:

```javascript
async function onButtonClick() {
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: ['battery_service'] }],
    });

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService('battery_service');
    const characteristic = await service.getCharacteristic('battery_level');
    const value = await characteristic.readValue();

    log('Battery level is ' + value.getUint8(0) + '%');
  } catch (error) {
    log('Argh! ' + error);
  }
}
```

And dozens of other options are available.

*Support: Chrome, Edge, Opera, Chrome Android, Opera Android, Samsung Internet.*

## 3. Broadcast Channel API

Sharing information between windows, tabs and iframes. If you have ever had to integrate that kind of communication, this API is a lifesaver.

Try logging into one of your favourite sites. Then open the same site in a separate tab. Normally you are logged in on both. Now log out in one of them. On most sites it will look like you are signed in on one page and signed out on the other.

Your windows are in different states. That is not great, and if you are a compulsive tabber like me, it causes confusion.

It can even be a security problem. Imagine a user in a café with the company dashboard open. They step away to the bathroom and leave the machine on. If the application is open in multiple tabs, the data in the other tabs is still reachable — on screen, or perhaps a JWT.

*Support: Chrome, Edge, Firefox, Opera, WebView Android, Chrome Android, Opera Android, Samsung Internet.*

## 4. Contact Picker API

You get access to the phone's contacts through the browser. Name, email, phone, address and icon where available. The applications for this are almost endless.

*Support: Opera, WebView Android, Chrome Android, Opera Android, Samsung Internet.*

## 5. WebVTT (Web Video Text Tracks Format)

Another great friend of accessibility. Want captions on your videos using the `<video>` tag? You can style them with CSS too.

```html
<video controls autoplay src="video.webm">
  <track default src="track.vtt">
</video>
```

*Support: all modern browsers.*

## 6. The WebSocket API

The WebSocket protocol allows bidirectional communication over a persistent connection between servers and clients.

It gives you a single, long-lived connection that is a more efficient alternative to HTTP for real-time web applications — although the handshake that establishes the connection is itself HTTP.

This one is real magic. You can send messages to a server and receive event-driven responses without polling for them.

*Support: all modern browsers.*

## 7. Screen Capture API

The magic of screenshots and screen recording. With this API, sites and web apps can record a browser tab, a specific window, or the user's entire screen. Very simple to use.

```javascript
async function startCapture(displayMediaOptions) {
  let captureStream = null;

  try {
    captureStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
  } catch (err) {
    console.error('Error: ' + err);
  }
  return captureStream;
}
```

*Support: Chrome, Edge, Firefox, Opera, Safari.*

## 8. Proximity Events

This API defines events carrying information about the distance between a device and an object, measured by a proximity sensor. It was originally part of the Sensor API and was later split out into its own.

If you have ever owned a smartphone, which I assume you have, you have seen this in action. Think about your last phone call. You unlocked the phone, typed the number, tapped call, brought the phone to your ear, and something magical happened: the screen switched off.

The implementation is quite intuitive:

```javascript
window.addEventListener('userproximity', function (event) {
  if (event.near) {
    navigator.mozPower.screenEnabled = false;
  } else {
    navigator.mozPower.screenEnabled = true;
  }
});
```

*Support: Firefox, Firefox Android.*

## 9. Picture-in-Picture API

Common in WhatsApp, Facebook and YouTube. This API creates a floating video on top of other windows so users can keep watching while interacting with other sites or apps.

*Support: Chrome, Edge, Opera, Safari, iOS Safari.*

---

And there is far more. There are 77 APIs with remarkable capabilities. Each deserves a dedicated article, and all of them are worth playing with.

**May the magic be with you.**

Source: [MDN web docs](https://developer.mozilla.org/en-US/docs/Web/API)

---

[Nomadz community](https://www.patreon.com/nomadz/membership)
