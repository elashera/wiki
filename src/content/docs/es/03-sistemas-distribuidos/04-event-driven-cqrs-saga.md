---
title: "Arquitectura event-driven, CQRS y Saga Pattern"
description: "Patrones avanzados de sistemas distribuidos: event-driven architecture, CQRS (Command Query Responsibility Segregation), event sourcing, y el Saga Pattern para transacciones distribuidas."
---

# Arquitectura event-driven, CQRS y Saga Pattern

> [!tip] En una frase
> La **arquitectura event-driven** comunica servicios mediante eventos, **CQRS** separa las operaciones de lectura de escritura, y el **Saga Pattern** gestiona transacciones distribuidas que necesitan consistencia eventual.

## ¿Por qué necesitamos patrones de integración?

Cuando divides una aplicación en microservicios, cada servicio tiene su propia base de datos. ¿Cómo haces que dos servicios mantengan datos consistentes sin usar transacciones ACID (que no funcionan a través de bases de datos diferentes)?

```
Microservicio A (DB A) ──→ Microservicio B (DB B)
```

Una transacción SQL normal no puede abarcar ambas bases de datos. Necesitas patrones especiales.

---

## 1. Arquitectura Event-Driven (EDA)

Una arquitectura event-driven es aquella en la que los componentes se comunican produciendo y consumiendo eventos, en lugar de llamarse directamente entre sí.

### 1.1 ¿Qué es un evento?

Un evento es un hecho que ocurrió en el pasado, irreversible y relevante para el sistema.

```
Eventos típicos:
- UserCreated(userId: 1, email: "emilio@example.com", timestamp: 2024-01-15T10:30:00Z)
- OrderPlaced(orderId: 42, userId: 1, total: 99.99, timestamp: 2024-01-15T10:31:00Z)
- PaymentCompleted(paymentId: 7, orderId: 42, timestamp: 2024-01-15T10:32:00Z)
- InventoryReserved(inventoryId: 15, orderId: 42, items: [...], timestamp: 2024-01-15T10:32:01Z)
```

> [!info] Los eventos se nombran en pasado
> Los nombres de eventos deben describir algo que YA ocurrió: `UserCreated`, no `CreateUser`; `OrderPlaced`, no `PlaceOrder`; `PaymentFailed`, no `FailPayment`.

### 1.2 EDA vs RPC (REST/gRPC)

**RPC (sincrónico)**:
```
Client → API Gateway → Service A → Service B → Service C
                ↑           ↑           ↑
              Espera      Espera      Espera
              (tarda)     (tarda)     (tarda)
```

**EDA (asincrónico)**:
```
Client → Service A → [Evento: UserCreated] → Service B (lee cuando pueda)
                                     → Service C (lee cuando pueda)
                                     → Service D (lee cuando pueda)
```

> [!tip] EDA desacopla completamente los servicios
> En RPC, Service A necesita saber la URL de Service B. Si Service B cambia de servidor, Service A se rompe. En EDA, Service A solo publica un evento. Service B se suscribe al evento que le interesa. Ninguno conoce al otro.

### 1.3 Componentes de EDA

**Event Producers**: Servicios que crean y publican eventos.

**Event Consumers (Listeners/Handlers)**: Servicios que escuchan eventos y reaccionan.

**Event Broker/Stream**: El sistema que almacena y entrega eventos (Kafka, RabbitMQ, AWS SNS/SQS, Azure Event Grid).

**Event Schema**: El formato de los eventos. Debe ser versionado y estabilizado.

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
  (procesa)      (reacciona)    (reacciona)
```

---

## 2. Event Sourcing

Event Sourcing es un patrón donde el estado de una entidad se almacena como una secuencia de eventos, no como un snapshot del estado actual.

### 2.1 Cómo funciona

En lugar de almacenar: `user:1000 → {email: "new@example.com", name: "Emilio"}`

Almacenas:
```
Eventos del user 1000:
1. UserCreated(userId: 1000, email: "old@example.com", name: "Emilio")
2. EmailUpdated(userId: 1000, email: "new@example.com")
3. NameUpdated(userId: 1000, name: "Emilio García")
```

El estado actual se reconstruye replayando todos los eventos:

```
Estado inicial: {}
→ UserCreated → {email: "old@example.com", name: "Emilio"}
→ EmailUpdated → {email: "new@example.com", name: "Emilio"}
→ NameUpdated → {email: "new@example.com", name: "Emilio García"}
```

> [!example] Analogía del libro de contabilidad
> Un libro de contabilidad no almacena el saldo actual. Almacena cada transacción (débito, crédito). El saldo actual se calcula sumando todas las transacciones.
>
> Event Sourcing es exactamente eso: no almacenas el saldo, almacenas las transacciones. El saldo se recalcula cuando lo necesitas.

### 2.2 Ventajas del Event Sourcing

1. **Auditoría completa**: Cada cambio queda registrado con su motivo y timestamp.
2. **Replay**: Puedes reconstruir el estado en cualquier punto del tiempo.
3. **Debugging**: Puedes ver exactamente qué eventos causaron un estado dado.
4. **Integración natural**: Los eventos se pueden publicar a otros servicios automáticamente.

### 2.3 Desventajas del Event Sourcing

1. **Complejidad**: Es un patrón avanzado que cambia la forma de diseñar aplicaciones.
2. **Querying complejo**: Las consultas se hacen sobre eventos, no sobre un estado lineal.
3. **Migration de eventos**: Si cambia el esquema de un evento, necesitas migrar todos los eventos existentes.
4. **Eventual consistency**: El estado no está disponible inmediatamente después de escribir un evento.

---

## 3. CQRS: Command Query Responsibility Segregation

CQRS separa las operaciones de lectura (query) de las operaciones de escritura (command).

### 3.1 El modelo tradicional

```
┌─────────────────────────────────────┐
│         Aplicación                 │
│                                     │
│  GET /user/1000  →  SELECT * FROM users WHERE id = 1000
│  PUT /user/1000  →  UPDATE users SET email = ? WHERE id = 1000
│                                     │
│  Una sola base de datos para todo   │
└─────────────────────────────────────┘
```

### 3.2 El modelo CQRS

```
┌─────────────────────────────────────────────────────────────┐
│                    Aplicación                               │
│                                                             │
│  PUT /user/1000 ──→ Command Model ──→ Write DB (PostgreSQL) │
│                                                             │
│  GET /user/1000 ──→ Query Model  ──→ Read DB (Redis/ES)    │
│                                                             │
│  Two separate databases, optimized for their workload       │
└─────────────────────────────────────────────────────────────┘
         │
         │ Eventos de actualización
         │
         ▼
  Read DB se actualiza de forma asíncrona
```

**Command Model**: Optimizado para escrituras. Valida reglas de negocio, aplica transacciones.

**Query Model**: Optimizado para lecturas. Puede ser una vista materializada, un caché, o un índice Elasticsearch.

### 3.3 Sincronización de Write DB a Read DB

```
1. Command se ejecuta en Write DB
2. Se genera un evento: UserUpdated(userId: 1000, email: "new@example.com")
3. El evento se publica al event broker
4. Un handler actualiza el Query Model con los nuevos datos
5. La próxima lectura usa el Query Model actualizado
```

> [!warning] Consistencia eventual
> Hay un lag entre la escritura en el Command Model y la actualización del Query Model. Durante ese lag, una lectura puede devolver datos obsoletos. Esto es aceptable para la mayoría de las aplicaciones, pero no para todas.

### 3.4 ¿Cuándo usar CQRS?

- **Alta carga de lectura vs escritura**: Si tienes 100 lecturas por cada escritura, tener modelos separados permite optimizar cada uno independently.
- **Modelos de lectura complejos**: Si necesitas vistas materializadas, índices Elasticsearch, o agregaciones pesadas.
- **Escalado independiente**: Si necesitas escalar las lecturas y escrituras por separado.

> [!warning] No uses CQRS por default
> CQRS añade complejidad significativa. Solo úsalo cuando tengas una razón clara: alta carga asimétrica, modelos de lectura complejos, o necesidad de escalado independiente. Para la mayoría de aplicaciones, un modelo CRUD tradicional es suficiente.

---

## 4. Saga Pattern: Transacciones distribuidas

Cuando una operación necesita modificar datos en múltiples servicios, y no puedes usar una transacción ACID, necesitas el Saga Pattern.

### 4.1 El problema

```
Order Service (DB A) ──→ Payment Service (DB B) ──→ Inventory Service (DB C)
```

Una orden necesita:
1. Crear la orden en Order Service
2. Cobrar al usuario en Payment Service
3. Reservar el inventario en Inventory Service

Si el paso 2 funciona pero el paso 3 falla, ¿cómo deshaces el paso 2? No puedes usar un rollback de base de datos porque cada servicio tiene su propia DB.

### 4.2 Saga: Choreography

Cada saga es una secuencia de pasos locales. Cada paso publica un evento que dispara el siguiente paso.

```
Paso 1: OrderService.createOrder()
    → Evento: OrderCreated(orderId: 42, userId: 1, total: 99.99)
    
Paso 2: PaymentService.handleOrderCreated()
    → Cobra al usuario
    → Si éxito: Evento: PaymentCompleted(paymentId: 7, orderId: 42)
    → Si fallo: Evento: PaymentFailed(orderId: 42, reason: "insufficient_funds")
    
Paso 3 (si éxito): InventoryService.handlePaymentCompleted()
    → Reserva inventario
    → Si éxito: Evento: InventoryReserved(inventoryId: 15, orderId: 42)
    → Si fallo: Evento: InventoryReservationFailed(orderId: 42, reason: "out_of_stock")
    
Paso 4 (si fallo en paso 2 o 3): OrderService.handleFailure()
    → Cancela la orden
    → Evento: OrderCancelled(orderId: 42, reason: "payment_failed")
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

En lugar de que cada servicio publique eventos y reactive a otros (choreography), un orquestador central coordina todos los pasos.

```
                 ┌─────────────┐
                 │  Orquestr.  │
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

El orquestador:
1. Llama a OrderService.createOrder()
2. Si éxito, llama a PaymentService.charge()
3. Si éxito, llama a InventoryService.reserve()
4. Si algún paso falla, llama a los compensaciones en orden inverso

```python
# Orquestador de Saga
class OrderSagaOrchestrator:
    async def execute(self, order_data):
        compensation_steps = []
        
        try:
            # Paso 1: Crear orden
            order = await order_service.create(order_data)
            compensation_steps.append(lambda: order_service.cancel(order.id))
            
            # Paso 2: Cobrar
            payment = await payment_service.charge(order.id, order_data.total)
            compensation_steps.append(lambda: payment_service.refund(payment.id))
            
            # Paso 3: Reservar inventario
            await inventory_service.reserve(order.id, order_data.items)
            
            # ¡Todo éxito!
            return {"status": "success", "order": order}
            
        except Exception as e:
            # Compensación en orden inverso
            for step in reversed(compensation_steps):
                try:
                    await step()
                except Exception as compensating_error:
                    log.error(f"Compensación falló: {compensating_error}")
            
            return {"status": "failed", "error": str(e)}
```

### 4.4 Choreography vs Orchestration

| Característica | Choreography | Orchestration |
|---------------|-------------|---------------|
| **Control** | Descentralizado (cada service reacciona) | Centralizado (orquestador coordina) |
| **Acoplamiento** | Bajo (services no se conocen) | Medio (services conocen al orquestador) |
| **Visibilidad** | Difícil (necesitas跟踪 events) | Fácil (el orquestador conoce todo el flujo) |
| **Complejidad** | Simple para sagas cortas | Más compleja de implementar |
| **Reusabilidad** | Difícil de reusar el flujo | Fácil de reusar el orquestador |
| **Debugging** | Difícil (trazas distribuidas) | Fácil (log centralizado del orquestador) |

> [!tip] ¿Cuándo usar cada uno?
> - **Choreography**: Para flujos simples con pocos servicios. Fácil de implementar, bajo acoplamiento.
> - **Orchestration**: Para flujos complejos con muchos servicios, compensaciones, y rutas alternativas. Más fácil de debuggear y mantener.

### 4.5 Compensating Transactions

Cada paso de una saga debe tener una **compensating transaction** que deshaga sus efectos si un paso posterior falla.

```
Paso normal:        Compensación:
─────────           ─────────
createOrder()       cancelOrder()
chargePayment()     refundPayment()
reserveInventory()  releaseInventory()
sendEmail()         sendCancellationEmail()
```

> [!warning] Las compensaciones deben ser idempotentes
> Si una compensación falla y se reintentar, debe producir el mismo efecto. cancelOrder() dos veces debe ser igual que cancelOrder() una vez. Esto es esencial para la resiliencia.

---

## 5. Patrón Outbox

El patrón Outbox garantiza que un evento se publique al broker solo si la transacción de base de datos se confirma.

### 5.1 El problema

```python
# Sin outbox: riesgo de inconsistencia
def create_order(order_data):
    db.query("INSERT INTO orders ...")       # 1. Escribe en DB
    kafka.publish("OrderCreated", ...)       # 2. Publica evento
    # Si el paso 2 falla, el evento se pierde
    # Si el paso 1 falla, el evento no debería publicarse
```

### 5.2 La solución: tabla outbox

```python
def create_order(order_data):
    with db.transaction():
        # 1. Escribe la orden en la tabla principal
        db.query("INSERT INTO orders ...")
        
        # 2. Escribe el evento en la tabla outbox
        db.query("INSERT INTO outbox (event_type, payload) VALUES (?, ?)",
                 "OrderCreated", json.dumps(order_data))
        
        # La transacción confirma AMBAS escrituras simultáneamente
        # Si alguna falla, nada se escribe
```

Un proceso separado (outbox poller) lee la tabla outbox y publica los eventos al broker:

```python
# Outbox poller (ejecuta cada segundo)
events = db.query("SELECT * FROM outbox WHERE published = false LIMIT 100")
for event in events:
    kafka.publish(event.event_type, event.payload)
    db.query("UPDATE outbox SET published = true WHERE id = ?", event.id)
```

> [!info] ¿Por qué funciona?
> La escritura a la tabla outbox y la escritura a la tabla principal están en la misma transacción. O ambas se confirman, o ninguna. El poller se encarga de publicar los eventos al broker de forma asíncrona. Si el broker está caído, los eventos se quedan en la outbox hasta que se recupere.

---

## Conceptos clave

1. **Event-Driven Architecture desacopla servicios**: Los servicios se comunican mediante eventos, no mediante llamadas directas. Esto permite escalado independiente y resiliencia.

2. **Event Sourcing almacena el historial de cambios**: En lugar de almacenar el estado actual, almacenas todos los eventos que llevaron a ese estado. Esto permite auditoría completa y replay.

3. **CQRS separa lectura de escritura**: El Command Model optimiza escrituras y validación. El Query Model optimiza lecturas y vistas. Sincronización mediante eventos (consistencia eventual).

4. **Saga Pattern para transacciones distribuidas**: Cuando no puedes usar ACID a través de múltiples servicios, divides la transacción en pasos locales con compensaciones. Choreography (descentralizado) u Orchestration (centralizado).

5. **El patrón Outbox garantiza la entrega de eventos**: Escribe el evento en una tabla outbox dentro de la misma transacción que tu operación de negocio. Un poller publica los eventos al broker de forma asíncrona.

## Relacionado con

- [[01-consensus-paxos-raft]] — Los sistemas que usan eventos (como etcd) usan consenso para replicar el log de eventos
- [[02-message-queues]] — Kafka es el broker de eventos ideal para EDA y Sagas
- [[03-distributed-caching]] — El Query Model en CQRS a menudo se implementa con Redis como cache
- [[05-idempotency-retry-circuit-breakers]] — Las compensaciones en Sagas deben ser idempotentes

## Referencias

- [Event-Driven Architecture - Microsoft Azure](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/event-driven)
- [CQRS Pattern - Microsoft Azure](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs)
- [Saga Pattern - Microsoft Azure](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga)
- [Event Sourcing - Event Sourcing.com](https://eventstore.com/)
- [Designing Data-Intensive Applications — Chapter 9: Transactions](https://dataintensive.net/)
