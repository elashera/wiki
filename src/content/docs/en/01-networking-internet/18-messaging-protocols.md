---
title: "Messaging Protocols: AMQP, MQTT, WebSockets"
description: "Real-time messaging protocols: AMQP (RabbitMQ), MQTT, WebSockets, Kafka, and when to use each one."
---

# Messaging Protocols: AMQP, MQTT, WebSockets

> [!tip] Messaging in a nutshell
> Messaging protocols enable applications to communicate **asynchronously**, decoupled and reliably — without sender and receiver needing to be connected at the same time. This article covers AMQP, MQTT, WebSockets, and Kafka.

## What is messaging?

Messaging protocols are communication systems between applications that allow:
- **Asynchronous communication**: The sender sends and keeps working, the receiver processes when it can
- **Decoupling**: The sender doesn't need to know who the receiver is
- **Fault tolerance**: Messages are stored until they can be processed
- **Scalability**: Multiple consumers can read from the same queue

### Types of messaging

| Type | Description | Example |
|------|-------------|---------|
| **Point-to-Point** (Queuing) | One message goes to one consumer | RabbitMQ queues |
| **Publish/Subscribe** (Pub/Sub) | One message goes to all subscribers | MQTT topics, Kafka |

## AMQP (Advanced Message Queuing Protocol)

**AMQP** is a message queuing protocol oriented toward queues. The industry standard, and **RabbitMQ** is the most popular implementation.

### Key AMQP concepts

```
Producer → Exchange → Queue(s) → Consumer
              │
              ├─ Direct Exchange: exact routing key match
              ├─ Topic Exchange: pattern matching
              ├─ Fanout Exchange: broadcast to all
              └─ Headers Exchange: match by headers
```

**Components:**
- **Producer**: Sends messages to an exchange
- **Exchange**: Receives messages from the producer and routes them to queues
- **Queue**: Stores messages until a consumer reads them
- **Consumer**: Receives messages from a queue
- **Binding**: Rule that connects an exchange to a queue

### Exchange types

| Exchange | Routing | Use case |
|----------|---------|----------|
| **Direct** | Exact match on routing key | Task queues, error handling |
| **Topic** | Pattern matching with wildcards | Log aggregation, alerting |
| **Fanout** | Broadcast to all bound queues | Notifications, broadcasting |
| **Headers** | Match by message headers | Complex filtering |

### AMQP message properties

```javascript
// AMQP message structure
{
  properties: {
    content_type: 'application/json',
    delivery_mode: 2,       // 1 = transient, 2 = persistent
    priority: 0,            // 0-9 (9 = highest priority)
    correlation_id: 'req-123',
    reply_to: 'reply_queue',
    expiration: '60000',    // Message TTL in milliseconds
    message_id: 'msg-456',
    timestamp: 1684000000,
    type: 'user_signup',
    user_id: 'user-789',
    headers: {
      region: 'us-east-1',
      trace_id: 'trace-abc'
    }
  },
  body: JSON.stringify({ userId: 123, action: 'signup', email: 'john@example.com' })
}
```

### RabbitMQ in practice

```bash
# Install RabbitMQ
sudo apt install rabbitmq-server
sudo systemctl enable rabbitmq-server

# Management UI
sudo rabbitmq-plugins enable rabbitmq_management
# Available at http://localhost:15672 (guest/guest)

# Command line
rabbitmqctl list_queues                    # List all queues
rabbitmqctl list_bindings                  # List all bindings
rabbitmqctl list_exchanges                 # List all exchanges
rabbitmqctl set_policy HA "^ha-" '.*' '{"ha-mode":"all"}'
```

### RabbitMQ durability and reliability

```javascript
// Ensure messages survive broker restart
channel.assertQueue('task_queue', {
  durable: true          // Queue survives broker restart
});

// Mark message as persistent
channel.sendToQueue('task_queue', Buffer.from(msg), {
  persistent: true       // Message survives broker restart
});

// Acknowledge after processing (not on receive)
channel.consume('task_queue', (msg) => {
  if (msg) {
    try {
      processTask(msg.content);
      channel.ack(msg);   // Confirm after successful processing
    } catch (err) {
      channel.nack(msg, false, true);  // Requeue on error
    }
  }
});
```

> [!tip] Why acknowledge after processing?
> If RabbitMQ delivers a message and the consumer crashes before processing, the message is lost unless it was acknowledged. With `basic.ack` after processing, unacknowledged messages are redelivered to another consumer.

## MQTT (Message Queuing Telemetry Transport)

**MQTT** is a lightweight publish/subscribe messaging protocol designed for constrained devices and low-bandwidth, high-latency, or unreliable networks. It was created in 1999 for satellite links between oil pipelines and is now widely used in IoT.

### MQTT architecture

```
                    ┌─────────────┐
                    │   MQTT      │
                    │   Broker    │  ← Central server
                    │  (Mosquitto │
                    │   RabbitMQ) │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Sensor A │ │ Sensor B │ │ App C    │
        │ Publish  │ │ Publish  │ │ Subscribe│
        └──────────┘ └──────────┘ └──────────┘
```

### MQTT message flow

```
1. CONNECT: Client connects to broker
   Client → Broker: CONNECT (client_id, keep_alive, clean_session)
   Broker → Client: CONNACK (return_code)

2. PUBLISH: Client publishes a message to a topic
   Sensor A → Broker: PUBLISH ("sensors/temperature/1", "23.5°C", qos=1)
   Broker → Sensor B: PUBLISH ("sensors/temperature/1", "23.5°C", qos=1)

3. SUBSCRIBE: Client subscribes to a topic
   App C → Broker: SUBSCRIBE ("sensors/#", qos=0)
   Broker → App C: SUBACK

4. UNSUBSCRIBE: Client unsubscribes
   App C → Broker: UNSUBSCRIBE ("sensors/#")

5. DISCONNECT: Client disconnects
   App C → Broker: DISCONNECT
```

### MQTT QoS levels

| Level | Name | Delivery guarantee | Use case |
|-------|------|-------------------|----------|
| **0** | At most once | No guarantee, fire and forget | Sensor readings, telemetry |
| **1** | At least once | Message delivered at least once (may duplicate) | Status updates, notifications |
| **2** | Exactly once | Message delivered exactly once | Financial transactions, command and control |

```
QoS 0 (At most once):
  Publisher → Broker → Subscriber
  (No acknowledgment, no retry)

QoS 1 (At least once):
  Publisher → Broker: PUBLISH → PUBACK → Broker → Subscriber: PUBLISH → PUBACK
  (Duplicates possible if PUBACK lost)

QoS 2 (Exactly once):
  Publisher → Broker: PUBLISH → PUBREC → Broker → Subscriber: PUBLISH → PUBREL → Subscriber → Broker: PUBCOMP
  (Four-step handshake ensures exactly once delivery)
```

### MQTT topics

```
Topic structure: hierarchical, using / as separator

# = matches any number of levels (wildcard)
+ = matches exactly one level (wildcard)

Topics:
  sensors/temperature/1      → Specific sensor
  sensors/temperature/+      → All temperature sensors
  sensors/#                  → All sensors
  home/livingroom/light/on   → Specific command
  home/+/light/on            → All lights in all rooms
  home/#                     → All topics under home

Retained messages:
  Broker stores the last message for a topic
  New subscribers immediately receive the retained message

  Sensor publishes: "sensors/temperature/1" → "23.5°C" (retained=true)
  New subscriber connects later → Immediately receives "23.5°C"
```

### MQTT use cases

| Use case | QoS | Description |
|----------|-----|-------------|
| **IoT sensors** | 0 | Temperature, humidity, motion sensors |
| **Device commands** | 1 or 2 | Turn on/off devices, configure settings |
| **Location tracking** | 0 | GPS coordinates of vehicles |
| **Chat messaging** | 1 | Real-time messaging apps |
| **Heartbeat monitoring** | 0 | Device online/offline status |

### MQTT vs AMQP comparison

| Feature | MQTT | AMQP (RabbitMQ) |
|---------|------|-----------------|
| **Model** | Publish/Subscribe | Point-to-Point + Pub/Sub |
| **Protocol overhead** | Very low (2-byte minimum header) | Moderate |
| **QoS levels** | 0, 1, 2 | No QoS (reliability via persistence) |
| **Last will & testament** | Yes (message if client disconnects) | No (requires application logic) |
| **Retained messages** | Yes | No (requires custom code) |
| **Best for** | IoT, constrained devices | Enterprise messaging, task queues |
| **Complexity** | Simple | More complex |

## WebSockets

**WebSockets** provide a full-duplex communication channel over a single TCP connection. Unlike HTTP, data can flow in both directions at any time — the server can push data to the client without the client requesting it.

### WebSocket connection lifecycle

```
1. HTTP Upgrade Request:
   GET /ws/chat HTTP/1.1
   Host: example.com
   Upgrade: websocket
   Connection: Upgrade
   Sec-WebSocket-Key: <client-generated-key>
   Sec-WebSocket-Version: 13

2. HTTP Upgrade Response:
   HTTP/1.1 101 Switching Protocols
   Upgrade: websocket
   Connection: Upgrade
   Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=

3. WebSocket Communication:
   Client ──────→ Server: "Hello from client"
   Client ←────── Server: "Hello from server"
   Client ──────→ Server: { "type": "message", "text": "Hi!" }
   Client ←────── Server: { "type": "message", "text": "Hey there!" }
   ... (bidirectional, no request/response overhead)
```

### WebSocket vs HTTP polling

| Method | Description | Latency | Bandwidth | Complexity |
|--------|-------------|---------|-----------|------------|
| **HTTP Long Polling** | Client requests, server holds until data available | Medium | High (many requests) | Medium |
| **HTTP Short Polling** | Client polls at intervals | High (polling interval) | Very high | Low |
| **WebSocket** | Persistent bidirectional connection | Low | Low (single connection) | Medium |

```
HTTP Long Polling:
  Client: GET /messages → Wait... → Server: [message data] → Client: GET /messages → Wait...
  ↑ Each response requires a new request
  
WebSocket:
  Client: Open connection → Server: [message 1] → Server: [message 2] → Server: [message 3]
  ↑ Single persistent connection, no request overhead per message
```

### WebSocket frames

```
WebSocket Frame:
┌────────┬────────┬──────────────────────────┬──────────────────────────┐
│FIN(1)│RSV(3)│OpCode(4)│Mask(1)│Payload Length(7) │  Extension data        │
│      │      │        │     │+(16/64 bits)    │                          │
├────────┴────────┴──────────────────────────┴──────────────────────────┤
│                     Application Data (Payload)                         │
└──────────────────────────────────────────────────────────────────────┘

OpCode:
  0x0 = Continuation frame
  0x1 = Text frame
  0x2 = Binary frame
  0x8 = Connection close
  0x9 = Ping
  0xA = Pong
```

### WebSocket in Node.js

```javascript
// Server (using ws library)
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws, req) => {
  console.log('New client connected');

  // Send a message to the client
  ws.send(JSON.stringify({ type: 'connected', id: Date.now() }));

  // Listen for messages
  ws.on('message', (data) => {
    const message = JSON.parse(data);
    console.log('Received:', message);

    // Broadcast to all connected clients
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'message',
          from: message.userId,
          text: message.text
        }));
      }
    });
  });

  // Handle disconnection
  ws.on('close', (code, reason) => {
    console.log(`Client disconnected: ${code} ${reason}`);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Keep alive: send ping periodically
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('pong', () => {
  console.log('Pong received');
});
```

### WebSocket limitations

| Limitation | Workaround |
|------------|-----------|
| **Not NAT-friendly** | Use HTTP/2 Server Push or polling as fallback |
| **No built-in security** | Use WSS (WebSocket over TLS) |
| **Firewall issues** | Use port 443 (same as HTTPS) |
| **Browser support** | Fallback to Server-Sent Events (SSE) or long polling |
| **Stateful** | Requires sticky sessions on load balancer |

### WebSocket vs Server-Sent Events (SSE)

| Feature | WebSocket | SSE |
|---------|-----------|-----|
| **Direction** | Bidirectional | Server → Client only |
| **Protocol** | Full-duplex | Half-duplex |
| **Binary data** | Yes | No (text only) |
| **Reconnection** | Manual | Automatic |
| **Browser support** | Good (fallbacks available) | Good (except IE) |
| **Best for** | Chat, gaming, real-time bidirectional | Live feeds, notifications, stock prices |

```
SSE example:
  Client → Server: GET /events HTTP/1.1
  Server → Client: Event: user-activity
  Server → Client: Data: {"userId": 123, "action": "login"}
  Server → Client:
  Server → Client: Event: order-updated
  Server → Client: Data: {"orderId": 456, "status": "shipped"}

  Client handles events with JavaScript:
  const eventSource = new EventSource('/events');
  eventSource.onmessage = (event) => { /* handle */ };
  eventSource.addEventListener('user-activity', (event) => { /* handle */ });
```

## Kafka

**Kafka** is a distributed event streaming platform. It's a publish/subscribe messaging system with built-in persistence, scalability, and fault tolerance.

### Kafka architecture

```
Producer → Kafka Cluster (Brokers) → Consumer

Kafka Cluster:
┌───────────────────────────────────────┐
│  Broker 1 (Kafka Node 1)              │
│  Topic: orders                        │
│    Partition 0: [msg1, msg2, msg3]    │
│    Partition 1: [msg4, msg5, msg6]    │
│                                       │
│  Broker 2 (Kafka Node 2)              │
│  Topic: orders                        │
│    Partition 0: [replica of 1]        │
│    Partition 1: [replica of 1]        │
└───────────────────────────────────────┘

Key concepts:
  - Topic: Category for messages (e.g., "orders", "users")
  - Partition: Ordered, immutable sequence of messages
  - Offset: Position of a message in a partition
  - Consumer Group: Set of consumers reading from a topic
  - Replication: Partitions replicated across brokers for fault tolerance
```

### Kafka vs other messaging systems

| Feature | Kafka | RabbitMQ (AMQP) | MQTT Broker |
|---------|-------|-----------------|-------------|
| **Throughput** | Very high (millions/sec) | Medium | Medium |
| **Latency** | Low (ms) | Very low (sub-ms) | Very low |
| **Message retention** | Days to years (configurable) | Until consumed | Until consumed |
| **Ordering** | Ordered within partition | Ordered per queue | Ordered per topic |
| **Scalability** | Highly scalable (distributed) | Limited by single broker | Limited by broker |
| **Use case** | Event streaming, logs, analytics | Task queues, microservices | IoT, devices |

### Connection with the rest of the wiki

| Concept | In-depth article |
|---------|-----------------|
| HTTP methods | [[05-http-deep-dive]] |
| REST APIs | [[11-rest-api]] |

## Summary

- **AMQP** (RabbitMQ) is a robust message queuing protocol with exchanges, queues, and binding rules. Best for enterprise messaging and task queues.
- **MQTT** is a lightweight publish/subscribe protocol designed for constrained environments. Best for IoT devices and real-time telemetry.
- **WebSockets** provide a full-duplex connection over a single TCP link. Best for real-time bidirectional communication (chat, gaming).
- **Kafka** is a distributed event streaming platform with high throughput and persistent message storage. Best for event sourcing and analytics.
- Choose the right protocol based on: need for bidirectional communication, message persistence, QoS requirements, and network constraints.

> [!quote] The key takeaway
> Messaging protocols solve the problem of asynchronous, decoupled communication. No single protocol is the best for all cases — MQTT for IoT, AMQP for enterprise queues, WebSockets for real-time apps, Kafka for event streaming. Match the protocol to your use case.
