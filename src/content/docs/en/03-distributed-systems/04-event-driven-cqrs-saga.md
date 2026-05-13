---
title: "Event-driven architecture, CQRS, and the Saga Pattern"
description: "Advanced distributed systems patterns: event-driven architecture, CQRS (Command Query Responsibility Segregation), event sourcing, and the Saga Pattern for distributed transactions."
---

# Event-driven architecture, CQRS, and the Saga Pattern

> [!tip] In one sentence
> **Event-driven architecture** communicates services through events, **CQRS** separates read and write operations, and the **Saga Pattern** manages distributed transactions that need eventual consistency.

## Why do we need integration patterns?

When you split an application into microservices, each service has its own database. How do you make two services maintain consistent data without using ACID transactions (which do not work across different databases)?

```
Microservice A (DB A) ──→ Microservice B (DB B)
```

A normal SQL transaction cannot span both databases. You need special patterns.

---

## 1. Event-Driven Architecture (EDA)

An event-driven architecture is one where components communicate by producing and consuming events, rather than calling each other directly.

### 1.1 What is an event?

An event is a fact that happened in the past, irreversible, and relevant to the system.

```
Typical events:
- UserCreated(userId: 1, email: "emilio@example.com", timestamp: 2024-01-15T10:30:00Z)
- OrderPlaced(orderId: 42, userId: 1, total: 99.99, timestamp: 2024-01-15T10:31:00Z)
- PaymentCompleted(paymentId: 7, orderId: 42, timestamp: 2024-01-15T10:32:00Z)
- InventoryReserved(inventoryId: 15, orderId: 42, items: [...], timestamp: 2024-01-15T10:32:01Z)
```

> [!info] Events are named in the past tense
> Event names should describe something that HAS ALREADY happened: `UserCreated`, not `CreateUser`; `OrderPlaced`, not `PlaceOrder`; `PaymentFailed`, not `FailPayment`.

### 1.2 EDA vs RPC (REST/gRPC)

**RPC (synchronous)**:
```
Client → API Gateway → Service A → Service B → Service C
                ↑           ↑           ↑
              Waits       Waits       Waits
              (takes time) (takes time) (takes time)
```

**EDA (asynchronous)**:
```
Client → Service A → [Event: UserCreated] → Service B (reads when available)
                                     → Service C (reads when available)
                                     → Service D (reads when available)
```

> [!tip] EDA completely decouples services
> In RPC, Service A needs to know Service B's URL. If Service B changes servers, Service A breaks. In EDA, Service A only publishes an event. Service B subscribes to the event it is interested in. Neither knows the other.

### 1.3 EDA components

**Event Producers**: Services that create and publish events.

**Event Consumers (Listeners/Handlers)**: Services that listen to events and react.

**Event Broker/Stream**: The system that stores and delivers events (Kafka, RabbitMQ, AWS SNS/SQS, Azure Event Grid).

**Event Schema**: The format of events. Must be versioned and stabilized.

```
┌──────────────────────────────────────────────────────────┐
│                    Event Broker (Kafka)                   │
│                                                          │
│  Topic: events                                           │
│  ├── Partition 0: UserCreated, OrderPlaced, PaymentDone   │
│  ├── Partition 1: UserCreated, InventoryReserved         │
│  └── Partition 2: PaymentFailed, OrderCancelled          │
└──────────────────────────────────────────────────────────┘
         ↑              ↑               ↑
         │              │               │
    Service A      Service B      Service C
  (processes)      (reacts)       (reacts)
```

---

## 2. Event Sourcing

Event Sourcing is a pattern where an entity's state is stored as a sequence of events, not as a snapshot of the current state.

### 2.1 How it works

Instead of storing: `user:1000 → {email: "new@example.com", name: "Emilio"}`

You store:
```
Events for user 1000:
1. UserCreated(userId: 1000, email: "old@example.com", name: "Emilio")
2. EmailUpdated(userId: 1000, email: "new@example.com")
3. NameUpdated(userId: 1000, name: "Emilio Garcia")
```

The current state is reconstructed by replaying all events:

```
Initial state: {}
→ UserCreated → {email: "old@example.com", name: "Emilio"}
→ EmailUpdated → {email: "new@example.com", name: "Emilio"}
→ NameUpdated → {email: "new@example.com", name: "Emilio Garcia"}
```

> [!example] Accounting book analogy
> An accounting book does not store the current balance. It stores each transaction (debit, credit). The current balance is calculated by summing all transactions.
>
> Event Sourcing is exactly that: you do not store the balance, you store the transactions. The balance is recalculated when you need it.

### 2.2 Advantages of Event Sourcing

1. **Complete audit trail**: Every change is recorded with its reason and timestamp.
2. **Replay**: You can reconstruct state at any point in time.
3. **Debugging**: You can see exactly which events caused a given state.
4. **Natural integration**: Events can be published to other services automatically.

### 2.3 Disadvantages of Event Sourcing

1. **Complexity**: It is an advanced pattern that changes how you design applications.
2. **Complex querying**: Queries are made against events, not a linear state.
3. **Event migration**: If an event schema changes, you need to migrate all existing events.
4. **Eventual consistency**: State is not immediately available after writing an event.

---

## 3. CQRS: Command Query Responsibility Segregation

CQRS separates read operations (query) from write operations (command).

### 3.1 The traditional model

```
┌─────────────────────────────────────┐
│         Application                 │
│                                     │
│  GET /user/1000  →  SELECT * FROM users WHERE id = 1000
│  PUT /user/1000  →  UPDATE users SET email = ? WHERE id = 1000
│                                     │
│  Single database for everything     │
└─────────────────────────────────────┘
```

### 3.2 The CQRS model

```
┌─────────────────────────────────────────────────────────────┐
│                    Application                              │
│                                                             │
│  PUT /user/1000 ──→ Command Model ──→ Write DB (PostgreSQL) │
│                                                             │
│  GET /user/1000 ──→ Query Model  ──→ Read DB (Redis/ES)    │
│                                                             │
│  Two separate databases, optimized for their workload       │
└─────────────────────────────────────────────────────────────┘
         │
         │ Update events
         │
         ▼
  Read DB is updated asynchronously
```

**Command Model**: Optimized for writes. Validates business rules, applies transactions.

**Query Model**: Optimized for reads. Can be a materialized view, a cache, or an Elasticsearch index.

### 3.3 Syncing Write DB to Read DB

```
1. Command executes in Write DB
2. An event is generated: UserUpdated(userId: 1000, email: "new@example.com")
3. The event is published to the event broker
4. A handler updates the Query Model with the new data
5. The next read uses the updated Query Model
```

> [!warning] Eventual consistency
> There is a lag between writing to the Command Model and updating the Query Model. During that lag, a read may return stale data. This is acceptable for most applications, but not all.

### 3.4 When to use CQRS?

- **High read vs write load**: If you have 100 reads for every write, having separate models allows optimizing each independently.
- **Complex read models**: If you need materialized views, Elasticsearch indexes, or heavy aggregations.
- **Independent scaling**: If you need to scale reads and writes separately.

> [!warning] Do not use CQRS by default
> CQRS adds significant complexity. Only use it when you have a clear reason: high asymmetric load, complex read models, or need for independent scaling. For most applications, a traditional CRUD model is sufficient.

---

## 4. Saga Pattern: Distributed transactions

When an operation needs to modify data in multiple services, and you cannot use an ACID transaction, you need the Saga Pattern.

### 4.1 The problem

```
Order Service (DB A) ──→ Payment Service (DB B) ──→ Inventory Service (DB C)
```

An order needs to:
1. Create the order in Order Service
2. Charge the user in Payment Service
3. Reserve inventory in Inventory Service

If step 2 succeeds but step 3 fails, how do you undo step 2? You cannot use a database rollback because each service has its own DB.

### 4.2 Saga: Choreography

Each saga is a sequence of local steps. Each step publishes an event that triggers the next step.

```
Step 1: OrderService.createOrder()
    → Event: OrderCreated(orderId: 42, userId: 1, total: 99.99)
    
Step 2: PaymentService.handleOrderCreated()
    → Charge the user
    → If success: Event: PaymentCompleted(paymentId: 7, orderId: 42)
    → If failure: Event: PaymentFailed(orderId: 42, reason: "insufficient_funds")
    
Step 3 (if success): InventoryService.handlePaymentCompleted()
    → Reserve inventory
    → If success: Event: InventoryReserved(inventoryId: 15, orderId: 42)
    → If failure: Event: InventoryReservationFailed(orderId: 42, reason: "out_of_stock")
    
Step 4 (if failure in step 2 or 3): OrderService.handleFailure()
    → Cancel the order
    → Event: OrderCancelled(orderId: 42, reason: "payment_failed")
```

```
┌──────────┐  OrderCreated   ┌──────────┐  PaymentCompleted  ┌──────────┐
│  Order   │────────────────>│ Payment  │───────────────────>│ Inventory│
│ Service  │                 │ Service  │                    │ Service  │
└──────────┘                 └──────────┘                    └──────────┘
     ▲                              │                              │
     │                              │ PaymentFailed/               │ InventoryReservationFailed
     │ CancelOrder                  └──────────────────────────────┘
     │
┌────┴────────────────────────────────────────────────────────────┐
│                   Event Broker (Kafka)                          │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Saga: Orchestration

Instead of each service publishing events and reacting to others (choreography), a central orchestrator coordinates all steps.

```
                 ┌─────────────┐
                 │  Orchest.   │
                 │  (Saga)     │
                 └──────┬──────┘
                        │
           ┌────────────┼────────────┐
           │            │            │
           ▼            ▼            ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │  Order   │  │ Payment  │  │ Inventory│
    │ Service  │  │ Service  │  │ Service  │
    └──────────┘  └──────────┘  └──────────┘
```

The orchestrator:
1. Calls OrderService.createOrder()
2. If success, calls PaymentService.charge()
3. If success, calls InventoryService.reserve()
4. If any step fails, calls compensations in reverse order

```python
# Saga Orchestrator
class OrderSagaOrchestrator:
    async def execute(self, order_data):
        compensation_steps = []
        
        try:
            # Step 1: Create order
            order = await order_service.create(order_data)
            compensation_steps.append(lambda: order_service.cancel(order.id))
            
            # Step 2: Charge
            payment = await payment_service.charge(order.id, order_data.total)
            compensation_steps.append(lambda: payment_service.refund(payment.id))
            
            # Step 3: Reserve inventory
            await inventory_service.reserve(order.id, order_data.items)
            
            # All success!
            return {"status": "success", "order": order}
            
        except Exception as e:
            # Compensation in reverse order
            for step in reversed(compensation_steps):
                try:
                    await step()
                except Exception as compensating_error:
                    log.error(f"Compensation failed: {compensating_error}")
            
            return {"status": "failed", "error": str(e)}
```

### 4.4 Choreography vs Orchestration

| Feature | Choreography | Orchestration |
|---------|-------------|---------------|
| **Control** | Decentralized (each service reacts) | Centralized (orchestrator coordinates) |
| **Coupling** | Low (services do not know each other) | Medium (services know the orchestrator) |
| **Visibility** | Difficult (need to track events) | Easy (orchestrator knows the full flow) |
| **Complexity** | Simple for short sagas | More complex to implement |
| **Reusability** | Hard to reuse the flow | Easy to reuse the orchestrator |
| **Debugging** | Difficult (distributed traces) | Easy (centralized orchestrator log) |

> [!tip] When to use each?
> - **Choreography**: For simple flows with few services. Easy to implement, low coupling.
> - **Orchestration**: For complex flows with many services, compensations, and alternative paths. Easier to debug and maintain.

### 4.5 Compensating Transactions

Each saga step must have a **compensating transaction** that undoes its effects if a later step fails.

```
Normal step:          Compensation:
─────────           ─────────
createOrder()       cancelOrder()
chargePayment()     refundPayment()
reserveInventory()  releaseInventory()
sendEmail()         sendCancellationEmail()
```

> [!warning] Compensations must be idempotent
> If a compensation fails and is retried, it must produce the same effect. cancelOrder() twice must be equal to cancelOrder() once. This is essential for resilience.

---

## 5. Outbox Pattern

The Outbox Pattern guarantees that an event is published to the broker only if the database transaction is committed.

### 5.1 The problem

```python
# Without outbox: risk of inconsistency
def create_order(order_data):
    db.query("INSERT INTO orders ...")       # 1. Write to DB
    kafka.publish("OrderCreated", ...)       # 2. Publish event
    # If step 2 fails, the event is lost
    # If step 1 fails, the event should not be published
```

### 5.2 The solution: outbox table

```python
def create_order(order_data):
    with db.transaction():
        # 1. Write the order to the main table
        db.query("INSERT INTO orders ...")
        
        # 2. Write the event to the outbox table
        db.query("INSERT INTO outbox (event_type, payload) VALUES (?, ?)",
                 "OrderCreated", json.dumps(order_data))
        
        # The transaction commits BOTH writes simultaneously
        # If either fails, nothing is written
```

A separate process (outbox poller) reads the outbox table and publishes events to the broker:

```python
# Outbox poller (runs every second)
events = db.query("SELECT * FROM outbox WHERE published = false LIMIT 100")
for event in events:
    kafka.publish(event.event_type, event.payload)
    db.query("UPDATE outbox SET published = true WHERE id = ?", event.id)
```

> [!info] Why does it work?
> Writing to the outbox table and writing to the main table are in the same transaction. Either both are committed, or neither. The poller is responsible for publishing events to the broker asynchronously. If the broker is down, events stay in the outbox until it recovers.

---

## Key concepts

1. **Event-Driven Architecture decouples services**: Services communicate through events, not direct calls. This enables independent scaling and resilience.

2. **Event Sourcing stores the change history**: Instead of storing the current state, you store all events that led to that state. This enables complete audit trails and replay.

3. **CQRS separates read from write**: The Command Model optimizes writes and validation. The Query Model optimizes reads and views. Synchronization through events (eventual consistency).

4. **Saga Pattern for distributed transactions**: When you cannot use ACID across multiple services, you divide the transaction into local steps with compensations. Choreography (decentralized) or Orchestration (centralized).

5. **The Outbox Pattern guarantees event delivery**: Write the event to an outbox table within the same transaction as your business operation. A poller publishes events to the broker asynchronously.

## Related to

- [[01-consensus-paxos-raft]] — Systems that use events (like etcd) use consensus to replicate the event log
- [[02-message-queues]] — Kafka is the ideal event broker for EDA and Sagas
- [[03-distributed-caching]] — The Query Model in CQRS is often implemented with Redis as a cache
- [[05-idempotency-retry-circuit-breakers]] — Compensations in Sagas must be idempotent

## References

- [Event-Driven Architecture - Microsoft Azure](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/event-driven)
- [CQRS Pattern - Microsoft Azure](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs)
- [Saga Pattern - Microsoft Azure](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga)
- [Event Sourcing - EventStore](https://eventstore.com/)
- [Designing Data-Intensive Applications — Chapter 9: Transactions](https://dataintensive.net/)
