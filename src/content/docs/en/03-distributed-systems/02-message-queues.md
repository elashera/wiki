---
title: "Message Queues: RabbitMQ, Kafka, and the producer-consumer pattern"
description: "How message queues work: producer-consumer pattern, RabbitMQ (exchanges, queues, AMQP), Kafka (topics, partitions, brokers, consumer groups), and how to choose between them."
---

# Message Queues: RabbitMQ, Kafka, and the producer-consumer pattern

> [!tip] Message Queues in one sentence
> A **message queue** is a system that enables components of an application to communicate asynchronously through messages, decoupling the message producer from the consumer, and enabling scaling, fault tolerance, and deferred processing.

## Why do we need message queues?

Imagine you have a web application where users can upload images. When someone uploads a photo, you need to:
1. Resize it
2. Create a thumbnail version
3. Analyze it with AI to detect inappropriate content
4. Update the database
5. Send a notification to the user

If you do all this synchronously (in the same request), the user would wait several seconds. But if you use a message queue:
1. The user uploads the image
2. The application puts a message in the queue: "process-image-id-123"
3. The application responds to the user immediately: "Image received!"
4. Various workers process the queue messages in parallel

> [!example] Restaurant analogy
> Think of a restaurant:
> - **Without queue**: The customer orders directly from the chef. The chef cooks, serves, and then attends to the next customer. Very slow if there are many customers.
> - **With queue**: The customer orders from the waiter. The waiter puts the order on a tray (the queue). The chef picks up orders from the tray when available. The waiter attends to the next customer immediately.
>
> The tray is the message queue. The waiter is the broker (RabbitMQ/Kafka). The chef is the consumer.

---

## 1. The producer-consumer pattern

The producer-consumer pattern is the fundamental pattern behind all message queues:

```
┌──────────┐     ┌─────────────┐     ┌──────────┐
│ Producer │────>│   Queue     │────>│ Consumer │
│          │     │  (Broker)   │     │          │
└──────────┘     └─────────────┘     └──────────┘
```

- **Producer**: The component that creates and sends messages to the queue.
- **Queue (Broker)**: The system that temporarily stores messages and delivers them to consumers.
- **Consumer**: The component that receives and processes messages from the queue.

### 1.1 Communication types

**Point-to-Point (Traditional queue)**: Each message is consumed by exactly one consumer. It is like a mailbox: each letter arrives at a single recipient.

```
Producer → Queue → Consumer A  (message consumed by A)
                    Consumer B  (does not receive the message)
```

**Publish-Subscribe (Pub/Sub)**: Each message is sent to all subscribed consumers. It is like a mailing list: each message arrives at all subscribers.

```
Producer → Queue → Consumer A  (message received)
              → Consumer B  (message received)
              → Consumer C  (message received)
```

> [!info] RabbitMQ supports both patterns
> RabbitMQ uses exchanges to determine how messages are distributed. It can do point-to-point (direct exchange) or pub/sub (fanout exchange).

> [!info] Kafka is inherently pub/sub
> Kafka uses topics and consumer groups. Each message in a topic is delivered to all consumer groups, but within a consumer group, each partition is consumed by a single consumer.

---

## 2. RabbitMQ: The flexible broker

RabbitMQ is a message broker that implements the AMQP (Advanced Message Queuing Protocol). It is flexible, mature, and perfect for most enterprise messaging use cases.

### 2.1 RabbitMQ fundamental concepts

**Exchange**: The point where messages arrive. A producer never sends a message directly to a queue. It always sends it to an exchange, and the exchange decides which queue(s) to send it to.

```
Producer → Exchange → Queue → Consumer
```

Types of exchanges:

- **Direct**: Sends messages to queues whose binding key exactly matches the message's routing key.
- **Fanout**: Sends messages to ALL queues bound to the exchange (pub/sub).
- **Topic**: Sends messages to queues based on a routing key pattern (wildcards: `*` for one word, `#` for multiple).
- **Headers**: Sends messages based on message headers (attributes) rather than routing keys.

> [!example] Exchange analogy
> Imagine a mail system:
> - **Direct**: A letter addressed to a specific address.
> - **Fanout**: A newsletter sent to all subscribers.
> - **Topic**: A letter categorized by interests (e.g., "technology.ai", "technology.networking").
> - **Headers**: A letter classified by content (e.g., "urgent", "personal").

**Queue**: The mailbox where messages are stored until consumed.

**Binding**: The rule connecting an exchange to a queue. A binding has a routing key (for direct/topic) or is empty (for fanout).

**Consumer**: The application that subscribes to a queue and processes messages.

**Producer**: The application that sends messages to an exchange.

### 2.2 Durability and reliability

RabbitMQ offers several delivery guarantees:

**Message persistence**: If you mark a message as "persistent", it is written to disk. If the broker crashes, messages are recovered on restart.

**Durable queues**: If you create a queue as "durable", it survives the broker restart.

**Confirmations**: The producer can wait for broker confirmation that it received the message.

**Dead Letter Queues (DLQ)**: If a message cannot be processed after several attempts, it is moved to a DLQ for further analysis.

```
Producer → Exchange → Queue → Consumer
                                    │
                         (fails N times)
                                    │
                                    ▼
                              Dead Letter Queue
```

### 2.3 AMQP: The protocol

AMQP is an application layer protocol that defines how producers, brokers, and consumers communicate. It is richer than HTTP for messaging:

- **Transactions**: You can group multiple operations in a transaction.
- **Ack/nack**: The consumer confirms (ack) or rejects (nack) a message after processing it.
- **QoS (Quality of Service)**: You can limit how many messages are sent to a consumer without ack (prefetch count).

```python
# Consumer example with prefetch
channel.basic_qos(prefetch_count=1)
# Only send one new message when the consumer has acked the previous one
```

> [!warning] Why prefetch_count=1?
> Without prefetch, RabbitMQ will send all available messages to a consumer quickly. If that consumer is slow, memory will accumulate. With prefetch_count=1, RabbitMQ waits for the ack before sending the next message, regulating the flow.

---

## 3. Kafka: The stream processing platform

Kafka is not just a message queue — it is a distributed streaming platform. Designed by LinkedIn and now maintained by the Apache Software Foundation, Kafka is optimized for high throughput and long-term persistence.

### 3.1 Kafka fundamental concepts

**Topic**: A category or feed to which messages are published. It is similar to a table in a database or a folder in a file system.

**Partition**: Each topic is divided into partitions (shards). Partitions enable parallelism and horizontal scaling. Each partition is an ordered, immutable log.

```
Topic: "orders"
┌─────────────────────────────────────────┐
│ Partition 0  │ Partition 1  │ Partition 2 │
│ ──────────── │ ─────────── │ ─────────── │
│ msg-001      │ msg-010     │ msg-020     │
│ msg-002      │ msg-011     │ msg-021     │
│ msg-003      │ msg-012     │ msg-022     │
└─────────────────────────────────────────┘
```

**Broker**: An individual server in the Kafka cluster. Each broker stores one or more partitions.

**Producer**: Publishes messages to a topic. Can choose which partition to use (round-robin, by key, or custom).

**Consumer**: Subscribes to a topic and reads messages. Consumers are grouped into **consumer groups**.

**Consumer Group**: A group of consumers working together to consume a topic. Each partition is consumed by exactly one consumer within the group. This enables horizontal scaling: if you have 3 partitions and 3 consumers in the same group, each consumer processes one partition.

```
Topic: "orders" (3 partitions)
┌──────────┐    ┌──────────┐    ┌──────────┐
│ Partition │───>│ Consumer │    │ Partition│───>│ Consumer │
│   0       │    │   A      │    │   1      │───>│   B      │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                          ┌──────────┐
                                          │ Partition│───>│ Consumer │
                                          │   2      │    │   C      │
                                          └──────────┘    └──────────┘
```

> [!info] Why consumer groups?
> Consumer groups enable multiple consumers to work in parallel on the same topic. If you have 1000 messages per second and each consumer processes 200 messages per second, you need 5 consumers in the same group. If you want all consumers to receive ALL messages (e.g., for logging), create one consumer group per consumer.

### 3.2 Kafka's log: Immutable and persistent

Each Kafka partition is an immutable, append-only log:

```
Partition 0 log:
Offset 0: {key: "user-1", value: "created", timestamp: 1000}
Offset 1: {key: "user-2", value: "updated", timestamp: 1001}
Offset 2: {key: "user-1", value: "deleted", timestamp: 1002}
Offset 3: {key: "user-3", value: "created", timestamp: 1003}
```

- **Offset**: A unique, incremental number that identifies each message within a partition.
- **Immutable**: Once written, a message never changes. It cannot be modified or deleted (only marked as "compacted").
- **Append-only**: Only new messages can be added to the end.

> [!tip] Why immutable?
> Immutable logs are simpler, faster, and more reliable. No need to worry about concurrent updates, locking, or data corruption. Additionally, they enable replay: you can re-read messages from any offset.

### 3.3 Message retention

Unlike RabbitMQ (where messages are deleted after being consumed), Kafka retains messages for a configurable time (default 7 days) or until the log reaches a maximum size.

```
# Retention configuration
log.retention.hours=168    # 7 days
log.retention.bytes=-1     # No size limit
log.retention.check.interval.ms=300000
```

This enables:
- **Replay**: Consumers can re-read messages from any offset.
- **Multi-consumption**: Multiple consumer groups can read the same topic independently.
- **History**: Data is available for historical analysis.

### 3.4 Exactly-once semantics

Kafka offers three delivery guarantees:

1. **At-most-once**: The message may be lost but never duplicated. (RabbitMQ with auto-ack)
2. **At-least-once**: The message is never lost but may be duplicated. (RabbitMQ with manual ack)
3. **Exactly-once**: The message is processed exactly once. (Kafka with transactions)

> [!warning] Exactly-once is expensive
> Exactly-once semantics require coordination between producers and consumers, which reduces throughput. In most cases, at-least-once + idempotency is sufficient and more efficient.

---

## 4. Comparison: RabbitMQ vs Kafka

| Feature | RabbitMQ | Kafka |
|---------|----------|-------|
| **Protocol** | AMQP 0.9.1 | Kafka's own protocol |
| **Pattern** | Point-to-point and pub/sub | Pub/sub with consumer groups |
| **Retention** | Messages deleted after consumption | Messages retained by time/size |
| **Throughput** | ~10K-100K messages/sec | ~1M+ messages/sec |
| **Latency** | Low (< 1ms) | Low (~1-5ms) |
| **Durability** | High (disk persistence) | Very high (replication + disk) |
| **Ordering** | Ordered within a queue | Ordered within a partition |
| **Replay** | No (messages deleted) | Yes (from any offset) |
| **Consumer groups** | No (each message to one consumer) | Yes (horizontal scaling) |
| **Ideal use** | Tasks, work queues, RPC | Streaming, event sourcing, logs |

> [!tip] When to use each?
> - **RabbitMQ**: When you need complex routing, async tasks, or patterns like work queues, RPC, or request-reply.
> - **Kafka**: When you need high throughput, long-term retention, streaming, event sourcing, or when multiple consumers need to read the same data.

---

## 5. Common patterns with message queues

### 5.1 Work Queue (Work Queue)

Multiple consumers compete for messages from a queue. Each message is processed by a single consumer.

```
Producer → Queue → Consumer A  (processes message)
                 → Consumer B  (processes next message)
                 → Consumer C  (processes next message)
```

Use: Image processing, email sending, background tasks.

### 5.2 Pub/Sub (Publish/Subscribe)

A message is sent to all subscribed consumers.

```
Producer → Exchange (fanout) → Queue A → Consumer A
                              → Queue B → Consumer B
                              → Queue C → Consumer C
```

Use: Notifications, logging, metrics.

### 5.3 Request-Reply

A consumer responds to a message with another message.

```
Producer → Queue → Consumer → Response Queue → Producer (wait)
```

Use: Async RPC, service queries.

### 5.4 Event Sourcing

Each state change is stored as an immutable event in Kafka. The current state is reconstructed by replaying all events.

```
Event log:
1. UserCreated(id: 1, name: "Emilio")
2. EmailUpdated(id: 1, email: "emilio@example.com")
3. PasswordChanged(id: 1)
4. UserDeleted(id: 1)

Current state: UserDeleted(id: 1)
```

---

## Key concepts

1. **Message queues decouple producers from consumers**: Producers do not need to know who consumes the messages, nor when. This enables independent scaling and resilience.

2. **RabbitMQ is flexible but limited in throughput**: Ideal for complex routing, async tasks, and enterprise patterns. Not ideal for high-volume streaming.

3. **Kafka is a stream processing platform, not just a queue**: Designed for high throughput, long-term retention, and event replay. Consumer groups enable horizontal scaling.

4. **Durability is not automatic**: In RabbitMQ, you need to mark messages as persistent and queues as durable. In Kafka, you need to configure replication factor > 1.

5. **Ordering is partial**: In RabbitMQ, order is maintained within a queue. In Kafka, order is maintained within a partition, not at the topic level.

## Related to

- [[01-consensus-paxos-raft]] — Message queue brokers use internal consensus to replicate data between nodes
- [[03-distributed-caching]] — Redis can also be used as a simple message queue (with lists and pub/sub)
- [[04-event-driven-cqrs-saga]] — Message queues are the foundation of event-driven architecture and the Saga pattern
- [[05-idempotency-retry-circuit-breakers]] — Idempotency is essential when messages may be duplicated (at-least-once delivery)

## References

- [RabbitMQ Documentation](https://www.rabbitmq.com/documentation.html)
- [Apache Kafka Documentation](https://kafka.apache.org/documentation/)
- [AMQP 0.9.1 Specification](https://www.rabbitmq.com/resources/specs/amqp0-9-1.pdf)
- [Designing Data-Intensive Applications — Martin Kleppmann](https://dataintensive.net/)
- [Kafka: A Distributed Messaging System for Log Processing](https://www.confluent.io/blog/kafka-log-structured-message-system/)
