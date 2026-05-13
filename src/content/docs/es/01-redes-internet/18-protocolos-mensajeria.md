---
title: "Protocolos de mensajería: AMQP, MQTT y WebSockets"
description: "Protocolos de mensajería en tiempo real: AMQP (RabbitMQ), MQTT, WebSockets, Kafka, y cuándo usar cada uno."
---

# Protocolos de mensajería: AMQP, MQTT y WebSockets

> [!tip] Mensajería en una frase
> Los protocolos de mensajería permiten que aplicaciones se comuniquen de forma **asíncrona**, desacoplada y confiable — sin que emisor y receptor necesiten estar conectados al mismo tiempo.

## ¿Qué es la mensajería?

Los protocolos de mensajería son sistemas de comunicación entre aplicaciones que permiten:
- **Comunicación asíncrona**: El emisor envía y sigue trabajando, el receptor procesa cuando puede
- **Desacoplamiento**: El emisor no necesita saber quién es el receptor
- **Tolerancia a fallos**: Los mensajes se almacenan hasta que puedan ser procesados
- **Escalabilidad**: Múltiples consumidores pueden leer de la misma cola

### Tipos de mensajería

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| **Point-to-Point** (Queuing) | Un mensaje va a un solo consumidor | RabbitMQ queues |
| **Publish/Subscribe** (Pub/Sub) | Un mensaje va a todos los suscriptores | MQTT topics, Kafka |

## AMQP (Advanced Message Queuing Protocol)

**AMQP** es un protocolo de mensajería orientado a colas. El estándar de la industria, y **RabbitMQ** es la implementación más popular.

### Conceptos clave de AMQP

```
Producer → Exchange → Queue(s) → Consumer
              │
              ├─ Direct Exchange: routing key exact match
              ├─ Topic Exchange: pattern matching
              ├─ Fanout Exchange: broadcast a todos
              └─ Headers Exchange: match por headers
```

**Componentes:**
- **Producer**: Envía mensajes a un exchange
- **Exchange**: Recibe mensajes del producer y los enrouta a queues
- **Queue**: Almacena mensajes hasta que un consumer los lee
- **Consumer**: Recibe mensajes de una queue
- **Binding**: Regla que conecta un exchange a una queue

### Tipos de Exchange

| Exchange | Enrutamiento | Uso |
|----------|-------------|-----|
| **Direct** | Routing key exact match | Colas específicas |
| **Topic** | Pattern matching con wildcards (`*` = 1 palabra, `#` = 0+ palabras) | Enrutamiento flexible |
| **Fanout** | Broadcast a todas las queues | Notificaciones |
| **Headers** | Match por headers del mensaje | Casos especiales |

### Ejemplo con RabbitMQ

```javascript
// Producer
const amqp = require('amqplib');

async function publish() {
    const connection = await amqp.connect('amqp://localhost');
    const channel = await connection.createChannel();

    const exchange = 'orders';
    const message = 'New order #12345';

    channel.assertExchange(exchange, 'direct', { durable: true });
    channel.sendToExchange(exchange, 'order.created', Buffer.from(message));

    console.log('Mensaje enviado');
    await connection.close();
}

// Consumer
async function consume() {
    const connection = await amqp.connect('amqp://localhost');
    const channel = await connection.createChannel();

    const queue = 'order-processor';
    await channel.assertQueue(queue, { durable: true });
    await channel.bindQueue(queue, 'orders', 'order.created');

    channel.consume(queue, (msg) => {
        console.log('Mensaje recibido:', msg.content.toString());
        channel.ack(msg);  // Confirmar procesamiento
    });
}
```

> [!tip] Durable queues
> Una queue **durable** sobrevive a reinicios del broker. Si RabbitMQ se reinicia, los mensajes en queues durables se mantienen. Sin embargo, los mensajes individuales no son durables por defecto — necesitas marcar cada mensaje como `persistent`.

### AMQP vs otros protocolos

| Característica | AMQP | MQTT | HTTP | WebSocket |
|---------------|------|------|------|-----------|
| **Orientado a** | Colas | Topics | Request/Response | Conexión bidireccional |
| **Garantía de entrega** | Alta (ACK, persistencia) | Media (QoS 0-2) | Baja | Media |
| **Latencia** | Media | Baja | Alta | Baja |
| **Overhead** | Alto | Bajo | Medio | Medio |
| **Uso típico** | Microservicios, backend | IoT, móvil | Web, APIs | Tiempo real, chat |
| **Broker** | RabbitMQ, Apache Qpid | Mosquitto, EMQX | N/A | N/A |

## MQTT (Message Queuing Telemetry Transport)

**MQTT** es un protocolo ligero de publish/subscribe diseñado para dispositivos con recursos limitados (IoT, móvil, redes lentas).

### Conceptos clave de MQTT

```
Publish → Topic → Broker → Subscribe → Topics
```

**Componentes:**
- **Broker**: Centraliza la mensajería. Recibe mensajes y los distribuye a suscriptores.
- **Publisher**: Envía mensajes a un topic
- **Subscriber**: Recibe mensajes de topics que le interesan
- **Topic**: Ruta jerárquica del mensaje (ej: `casa/salon/temp`)

### QoS (Quality of Service) de MQTT

| Nivel | Garantía | Descripción |
|-------|----------|-------------|
| **QoS 0** | At most once | Enviar y olvidar. Puede perderse. |
| **QoS 1** | At least once | Al menos una entrega. Puede haber duplicados. |
| **QoS 2** | Exactly once | Entrega exacta. Más overhead (4 pasos). |

```
QoS 0 (At most once):
Publisher → Broker → Subscriber
(Sin confirmación)

QoS 1 (At least once):
Publisher → Broker → Subscriber → PUBACK
(Si no llega PUBACK, reenvía)

QoS 2 (Exactly once):
Publisher → Broker → PUBREC → Publisher → PUBREL → Broker → PUBCOMP
(4 pasos para garantizar entrega exacta)
```

### Tópicos y wildcards

```
casa/cocina/temp    → Temperatura de cocina
casa/cocina/hum     → Humedad de cocina
casa/ */temp        → Todos los topics /temp de primer nivel
casa/#              → Todo lo que empiece con casa/
```

### Retained messages y Last Will

```javascript
// Retained message: el broker recuerda el último mensaje de un topic
// Para que nuevos suscriptores lo reciban al suscribirse

// Last Will (Will Message): si un dispositivo se desconecta inesperadamente,
// el broker publica automáticamente un mensaje

{
    "topic": "casa/salon/online",
    "message": "offline",
    "qos": 1,
    "retain": true
}
```

> [!tip] MQTT vs AMQP
> - **MQTT**: Ligero (header de 2 bytes), ideal para IoT y redes lentas. Pub/sub nativo.
> - **AMQP**: Más pesado, más funcionalidades (colas, exchanges, routing complejo). Ideal para microservicios backend.

## WebSockets

**WebSockets** es un protocolo de comunicación **bidireccional y persistente** sobre TCP. A diferencia de HTTP (request/response), los dos lados pueden enviar datos en cualquier momento.

### Cómo funciona

```
Handshake HTTP → Upgrade a WebSocket → Conexión persistente bidireccional
```

```javascript
// Servidor (Node.js + ws)
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
    console.log('Nuevo cliente conectado');

    ws.on('message', (data) => {
        console.log('Mensaje recibido:', data.toString());
        // Reenviar a todos los demás clientes
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(data.toString());
            }
        });
    });

    ws.on('close', () => {
        console.log('Cliente desconectado');
    });
});

// Cliente (browser)
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
    console.log('Conectado');
    ws.send('Hola desde el cliente');
};

ws.onmessage = (event) => {
    console.log('Mensaje del servidor:', event.data);
};

ws.onclose = () => {
    console.log('Desconectado');
};
```

### Handshake WebSocket

```
Cliente:
  GET /ws HTTP/1.1
  Host: localhost:8080
  Upgrade: websocket
  Connection: Upgrade
  Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
  Sec-WebSocket-Version: 13

Servidor:
  HTTP/1.1 101 Switching Protocols
  Upgrade: websocket
  Connection: Upgrade
  Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

> [!note] El handshake usa HTTP
> El upgrade a WebSocket se hace sobre HTTP. Si el servidor no soporta WebSocket, responde con un error HTTP normal y la conexión se cierra.

### WebSockets vs HTTP polling

| | HTTP Polling | HTTP Long Polling | WebSockets |
|--|-------------|-------------------|------------|
| **Latencia** | Alta (intervalo de polling) | Media (cuando hay datos) | Baja (inmediato) |
| **Overhead** | Alto (headers HTTP en cada request) | Medio | Bajo (una vez, luego frames binarios) |
| **Conexiones** | Múltiples conexiones cortas | Múltiples conexiones largas | Una conexión persistente |
| **Bidireccional** | No (cliente siempre inicia) | No | Sí |

### Limitaciones de WebSockets

- **No hay semántica de mensajería**: Los frames son binarios/texto sin estructura (a diferencia de AMQP/MQTT)
- **No hay QoS**: No hay garantía de entrega ni reconexión automática
- **No hay persistence**: Si el servidor cae, los mensajes se pierden (necesitas un broker externo)
- **Firewalls**: La mayoría permiten WebSockets (puerto 80/443), pero algunos los bloquean

> [!tip] Solución práctica
> Para producción, combina WebSockets con un broker como Redis Pub/Sub, Kafka, o RabbitMQ para tener mensajería fiable. O usa frameworks como Socket.IO que manejan reconexión, fallback a polling, y rooms.

## Kafka

**Apache Kafka** es un sistema de streaming distribuido que funciona como un **log inmutable**:

```
Producer → Topic → Partition 0 → [msg1][msg2][msg3]...
                     Partition 1 → [msg4][msg5][msg6]...

Consumer → Topic → Leee mensajes en orden → Procesa
```

### Conceptos clave

| Concepto | Descripción |
|----------|-------------|
| **Topic** | Categoría donde se publican los mensajes |
| **Partition** | Cada topic se divide en particiones (para paralelismo) |
| **Offset** | Número secuencial dentro de cada partición |
| **Producer** | Envía mensajes a un topic |
| **Consumer Group** | Grupo de consumidores que leen un topic (cada mensaje va a un solo consumer del grupo) |
| **Broker** | Servidor que almacena los mensajes |

### Diferencia con AMQP/MQTT

| | Kafka | RabbitMQ (AMQP) | MQTT |
|--|-------|-----------------|------|
| **Persistencia** | Días/semanas (configurable) | Hasta que se consuma | No (por defecto) |
| **Consumo** | Retrospectivo (puedes leer mensajes viejos) | Una vez consumido, se borra | Publicar y olvidar |
| **Orden** | Ordenado por partición | Ordenado por queue | No garantizado |
| ** throughput** | Muy alto (millones de msgs/seg) | Medio | Bajo-Medio |
| **Uso** | Log, analytics, streaming | Microservicios, tasks | IoT, chat |

## Comparación final

| Característica | AMQP | MQTT | WebSocket | Kafka |
|---------------|------|------|-----------|-------|
| **Modelo** | Point-to-Point | Pub/Sub | Bidireccional | Streaming |
| **Overhead** | Alto | Bajo | Medio | Alto |
| **Orden** | Queue | Topic | Connection | Partition |
| **QoS** | Alta | Media | Baja | Alta |
| **Persistencia** | Sí (configurable) | No | No | Sí (días) |
| **Ideal para** | Microservicios | IoT, móvil | Tiempo real | Analytics, logs |

## Resumen

- **AMQP** (RabbitMQ): Colas con routing complejo, ideal para microservicios backend
- **MQTT**: Ligero, pub/sub, ideal para IoT y dispositivos con recursos limitados
- **WebSockets**: Conexión bidireccional persistente, ideal para tiempo real en browsers
- **Kafka**: Streaming distribuido con persistencia, ideal para analytics y logs

> [!quote] La clave
> No hay un protocolo "mejor" — cada uno tiene su caso de uso ideal. AMQP para mensajería fiable entre servicios, MQTT para IoT, WebSockets para tiempo real en browsers, y Kafka para streams de datos a gran escala.

## Conexión con el resto de la wiki

| Concepto tocado | Artículo en profundidad |
|-----------------|------------------------|
| APIs REST | [[11-api-rest]] (cuándo usar REST vs mensajería asíncrona) |
| HTTP/2 | [[05-http-profundo]] (cuándo usar HTTP/2 vs WebSockets) |
| Cloudflare Workers | [[19-cloudflare-completo]] (edge computing con eventos) |
