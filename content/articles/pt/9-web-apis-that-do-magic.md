---
title: "9 Web API's que fazem mágica ⚡🧙🏻‍♀️🧙🏾‍♂️✨"
date: 2024-03-28
description: "Se voltássemos no tempo uns 20 anos, ou até menos, e falássemos para os desenvolvedores web daquela..."
tags: ["webapis", "javascript", "webdev"]
slug: 9-web-apis-que-fazem-magica
---

_Se voltássemos no tempo uns 20 anos, ou até menos, e falássemos para os desenvolvedores web daquela época o que os navegadores conseguem fazer hoje, definitivamente não acreditariam. Olhando em perspectiva o que os browsers fazem hoje com certeza garantiriam a entrada do Chrome, Firefox, Edge e outros em Hogwarts. Sabemos também quem ficaria de fora 👀 (aqueles que não devem ser mencionados IE/Safari)
Vamos dar um panorama de algumas Web Api's que fazem verdadeiras mágicas, especialmente em dispositivos móveis._

## 1. Ambient Light Events 💡
Quando o sensor de luz de um dispositivo detecta uma mudança no nível de luz, ele notifica o navegador dessa mudança. Imagine o que dá pra fazer com fotografias, ambientes escuros ou contrastes de acessibilidade Instantâneos!

Exemplo:
```javascript
 if ('ondevicelight' in window) {
      window.addEventListener('devicelight', function(event) {
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
_Compatibilidade - Firefox, Firefox Android_

## 2. Web Bluetooth API 📲
E se eu lhe dissesse que os sites podem se comunicar com dispositivos Bluetooth próximos de maneira segura e preservando a privacidade? Dessa forma, monitores de frequência cardíaca, medidores de glicemia, e muito mais poderiam interagir diretamente com um site.

Até agora, a capacidade de interagir com dispositivos Bluetooth só era possível para aplicativos específicos da plataforma. A API Web Bluetooth pretende mudar isso e trazê-lo também para navegadores da web.

Como recurso de segurança, a descoberta de dispositivos Bluetooth com navigator.bluetooth.requestDevice deve ser acionada por uma ação do usuário, como um toque ou clique do mouse. Estamos falando sobre ouvir eventos pointerup, click e touchend.

_Compatibilidade - Chrome, Edge, Opera, Chrome Android, Opera Android, Samsung Internet_

```javascript
button.addEventListener('pointerup', function(event) {
  // Call navigator.bluetooth.requestDevice
});
```

Assim você consegue acessar as informações de bateria por exemplo:

```javascript
async function onButtonClick() {
  try {
    log('Requesting Bluetooth Device...');
    const device = await navigator.bluetooth.requestDevice({
        filters: [{services: ['battery_service']}]});

    log('Connecting to GATT Server...');
    const server = await device.gatt.connect();

    log('Getting Battery Service...');
    const service = await server.getPrimaryService('battery_service');

    log('Getting Battery Level Characteristic...');
    const characteristic = await service.getCharacteristic('battery_level');

    log('Reading Battery Level...');
    const value = await characteristic.readValue();

    log('> Battery Level is ' + value.getUint8(0) + '%');
  } catch(error) {
    log('Argh! ' + error);
  }
}
```

E outras dezenas de opções estão disponíveis!

## 3. Broadcast Channel API 🛰️
Compartilhando de informações entre janelas, tabs, iframes etc, quem já teve problema em precisar integrar esse tipo de comunicação, essa api é salvação.

Tente fazer login em um de seus sites favoritos. Em seguida, abra o mesmo site em uma guia separada. Normalmente você estará logado em ambas as páginas. Em seguida, saia em uma de suas guias. Na maioria dos sites, parecerá que você está conectado em uma página e desconectado na outra.

Suas janelas estão em estados diferentes: conectado ou desconectado. Isso não é ótimo e se você é um tabber maníaco (como eu), pode causar alguma confusão.

Isso pode até ser um problema de segurança. Imagine que seu usuário está em uma cafeteria usando o painel da empresa. Ele sai para ir ao banheiro e deixa o computador ligado. Se a aplicação fosse aberta em múltiplas abas seria possível acessar os dados disponíveis nas demais abas (na tela ou talvez algum token JWT).

Compatibilidade - Chrome, Edge, Firefox, Opera, WebView Android, Chrome Android, Opera Android, Samsung Internet

## 4. Contact Picker API 👥👥
Você tem acesso aos contatos do telefone via browser (: Usar informações como nome, email, telefone, endereço e ícone se estiverem disponíveis, a aplicabilidade disso é quase infinita.

_Compatibilidade - Opera, WebView Android, Chrome Android, Opera Android, Samsung Internet_

## 5. Web Video Text Tracks Format (WebVTT) 🔠
Outra grande amiga da acessibilidade, quer colocar legenda nos seus vídeos? usando a tag `<video>` ? É possível customizar via css as legendas também. Vai fundo nessa lindeza =D

Exemplo:track.vtt
```javascript
00:01.000 --> 00:04.000
- Never drink liquid nitrogen.

00:05.000 --> 00:09.000
- It will perforate your stomach.
- You could die.
  <video controls autoplay src="video.webm">
    <track default src="track.vtt">
  </video>
```
_Compatibilidade - Todos os browsers modernos_

## 6. The WebSocket API 🔁
O protocolo Websocket é uma tecnologia que permite comunicação bidirecional e conexão persistente entre servidores e clientes

Ele oferece uma conexão única e de longa duração que é uma alternativa mais eficiente ao HTTP (apesar que o handshake, pra realizar a conexão em si é http) para aplicativos da web em tempo real.

Essa é uma verdadeira mágica! Com essa API, você pode enviar mensagens a um servidor e receber respostas orientadas a eventos sem precisar consultar o servidor para obter uma resposta. Realtime meus amigos <3

_Compatibilidade - Todos os browsers modernos_

## 7. Screen Capture API 🖥️
A mágica do print e da gravação de tela! Com essa API, sites e aplicativos na web podem gravar facilmente uma aba do navegador, uma janela específica ou até mesmo a tela inteira de um usuário. Super simples de usar!

Exemplo:
```javascript
  async function startCapture(displayMediaOptions) {
    let captureStream = null;

    try {
      captureStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
    } catch(err) {
      console.error("Error: " + err);
    }
    return captureStream;
  }
```

_Compatibilidade - Chrome, Edge, Firefox, Opera, Safari_

## 8. Proximity Events 🤳
Essa API define eventos que fornecem informações sobre a distância entre um dispositivo e um objeto, medida por um sensor de proximidade. Inicialmente fazia parte da API Sensor, posteriormente dividida e se tornou uma API independente. As especificações da API Proximity são consideradas estáveis porque atingiu o status de Recomendação Candidata do W3C em 1º de outubro de 2013.

Se você já teve ou usou um smartphone, o que presumo que já tenha, você já viu essa API em ação :)

Quer um exemplo? Pense em sua última ligação e no que você fez. Você desbloqueou seu smartphone, digitou o número para o qual deseja ligar e tocou no botão “Ligar”. Feito isso, você colocou o smartphone próximo ao ouvido e de repente algo mágico aconteceu, a tela desligou.

Bem intuitiva a implementação:

```javascript
  window.addEventListener('userproximity', function(event) {
    if (event.near) {
      // let's power off the screen
      navigator.mozPower.screenEnabled = false;
    } else {
      // Otherwise, let's power on the screen
      navigator.mozPower.screenEnabled = true;
    }
  });
```
Compatibilidade - Firefox, Firefox Android

## 9. Picture-in-Picture API
Comum no whatsapp, facebook, youtube. Essa API permite criar o vídeo flutuante em cima de outras janelas para que os usuários possam continuar a consumir mídia enquanto interagem com outros sites de conteúdo ou aplicativos em seus dispositivos.

_Compatibilidade - Chrome, Edge, Opera, Safari, iOS Safari_

E tem muito mais! São 77 API's com capacidades incríveis. Cada uma merece um artigo dedicado, vale a pena conferir e brincar com elas.

Gostou? Comenta o que é mais interessante pra ti? Qual API dessas já usou ou quer usar?

## Que a Magia esteja com você
Fonte: [MDN web docs](https://developer.mozilla.org/en-US/docs/Web/API)

.
.
.
.
.

✨ Conheça a Comunidade Nomadz  ✨
👉🏻 https://www.patreon.com/nomadz/membership

Quer falar comigo? Tô por aqui:
https://instagram.com/lincoli.xavier
https://www.tiktok.com/@lincoli.xavier
https://twitter.com/lincolixavier
https://youtube.com/@lincoli.xavier/
https://www.lincolixavier.com/
