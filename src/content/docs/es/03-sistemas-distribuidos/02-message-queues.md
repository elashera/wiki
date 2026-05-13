---
title: "Message Queues: RabbitMQ, Kafka y el patrón producer-consumer"
description: "Cómo funcionan las message queues: patrón producer-consumer, RabbitMQ (exchanges, queues, AMQP), Kafka (topics, partitions, brokers, consumer groups), y cómo elegir entre ellos."
---

# Message Queues: RabbitMQ, Kafka y el patrón producer-consumer

> [!tip] Message Queues en una frase
> Una **message queue** es un sistema que permite que componentes de una aplicación se comuniquen de forma asíncrona mediante mensajes, desacoplando el productor del mensaje del consumidor, y permitiendo escalado, tolerancia a fallos y procesamiento diferido.

## ¿Por qué necesitamos message queues?

Imagina que tienes una aplicación web donde los usuarios pueden subir imágenes. Cuando alguien sube una foto, necesitas:
1. Redimensionarla
2. Crear una versión en miniatura (thumbnail)
3. Analizarla con IA para detectar contenido inapropiado
4. Actualizar la base de datos
5. Enviar una notificación al usuario

Si haces todo esto de forma sincrónica (en el mismo request), el usuario esperaría varios segundos. Pero si usas una message queue:
1. El usuario sube la imagen
2. La aplicación pone un mensaje en la queue: "procesar-imagen-id-123"
3. La aplicación responde al usuario inmediatamente: "¡Imagen recibida!"
4. Varios workers procesan los mensajes de la queue en paralelo

> [!example] Analogía del restaurante
> Piensa en un restaurante:
> - **Sin queue**: El cliente le pide al chef directamente. El chef cocina, sirve, y luego atiende al siguiente cliente. Muy lento si hay muchos clientes.
> - **Con queue**: El cliente le pide al camarero. El camarero pone la orden en una bandeja (la queue). El chef coge las órdenes de la bandeja cuando puede. El camarero atiende al siguiente cliente inmediatamente.
>
> La bandeja es la message queue. El camarero es el broker (RabbitMQ/Kafka). El chef es el consumer.

---

## 1. El patrón producer-consumer

El patrón producer-consumer es el patrón fundamental detrás de todas las message queues:

```
┌──────────┐     ┌─────────────┐     ┌──────────┐
│ Producer │────>│   Queue     │────>│ Consumer │
│          │     │  (Broker)   │     │          │
└──────────┘     └─────────────┘     └──────────┘
```

- **Producer**: El componente que crea y envía mensajes a la queue.
- **Queue (Broker)**: El sistema que almacena los mensajes temporalmente y los entrega a los consumers.
- **Consumer**: El componente que recibe y procesa los mensajes de la queue.

### 1.1 Tipos de comunicación

**Point-to-Point (Queue tradicional)**: Cada mensaje es consumido por exactamente un consumer. Es como un buzón de correo: cada carta llega a un solo destinatario.

```
Producer → Queue → Consumer A  (mensaje consumido por A)
                    Consumer B  (no recibe el mensaje)
```

**Publish-Subscribe (Pub/Sub)**: Cada mensaje es enviado a todos los consumers suscritos. Es como una lista de correo: cada mensaje llega a todos los suscriptores.

```
Producer → Queue → Consumer A  (mensaje recibido)
              → Consumer B  (mensaje recibido)
              → Consumer C  (mensaje recibido)
```

> [!info] RabbitMQ soporta ambos patrones
> RabbitMQ usa exchanges para determinar cómo se distribuyen los mensajes. Puede hacer point-to-point (direct exchange) o pub/sub (fanout exchange).

> [!info] Kafka es inherentemente pub/sub
> Kafka usa topics y consumer groups. Cada mensaje en un topic es entregado a todos los consumer groups, pero dentro de un consumer group, cada partición es consumida por un solo consumer.

---

## 2. RabbitMQ: El broker flexible

RabbitMQ es un broker de mensajes que implementa el protocolo AMQP (Advanced Message Queuing Protocol). Es flexible, maduro, y perfecto para la mayoría de los casos de uso de mensajería empresarial.

### 2.1 Conceptos fundamentales de RabbitMQ

**Exchange**: El punto donde los mensajes llegan. Un producer nunca envía un mensaje directamente a una queue. Siempre lo envía a un exchange, y el exchange decide a qué queue(s) enviarlo.

```
Producer → Exchange → Queue → Consumer
```

Tipos de exchanges:

- **Direct**: Envía mensajes a queues cuya binding key coincide exactamente con el routing key del mensaje.
- **Fanout**: Envía mensajes a TODAS las queues vinculadas al exchange (pub/sub).
- **Topic**: Envía mensajes a queues basándose en un patrón de routing key (wildcards: `*` para una palabra, `#` para varias).
- **Headers**: Envía mensajes basándose en headers (atributos del mensaje) en lugar de routing keys.

> [!example] Analogía de los exchanges
> Imagina un sistema de correo:
> - **Direct**: Un correo dirigido a una dirección específica.
> - **Fanout**: Un boletín que se envía a todos los suscriptores.
> - **Topic**: Un correo categorizado por intereses (ej: "tecnologia.ia", "tecnologia.redes").
> - **Headers**: Un correo que se clasifica por contenido (ej: "urgente", "personal").

**Queue**: El buzón donde se almacenan los mensajes hasta que son consumidos.

**Binding**: La regla que conecta un exchange con una queue. Un binding tiene un routing key (para direct/topic) o es vacío (para fanout).

**Consumer**: La aplicación que se suscribe a una queue y procesa los mensajes.

**Producer**: La aplicación que envía mensajes a un exchange.

### 2.2 Durabilidad y confiabilidad

RabbitMQ ofrece varias garantías de entrega:

**Message persistence**: Si marcas un mensaje como "persistent", se escribe en disco. Si el broker se cae, los mensajes se recuperan al reiniciar.

**Durable queues**: Si creas una queue como "durable", sobrevive al reinicio del broker.

**Confirmations**: El producer puede esperar confirmación del broker de que recibió el mensaje.

**Dead Letter Queues (DLQ)**: Si un mensaje no puede ser procesado después de varios intentos, se mueve a una DLQ para análisis posterior.

```
Producer → Exchange → Queue → Consumer
                                    │
                         (si falla N veces)
                                    │
                                    ▼
                              Dead Letter Queue
```

### 2.3 AMQP: El protocolo

AMQP es un protocolo de capa de aplicación que define cómo los producers, brokers y consumers se comunican. Es más rico que HTTP para mensajería:

- **Transaccionalidad**: Puedes agrupar múltiples operaciones en una transacción.
- **Ack/nack**: El consumer confirma (ack) o rechaza (nack) un mensaje después de procesarlo.
- **QoS (Quality of Service)**: Puedes limitar cuántos mensajes se envían a un consumer sin ack (prefetch count).

```python
# Ejemplo de consumer con prefetch
channel.basic_qos(prefetch_count=1)
# Solo enviar un mensaje nuevo cuando el consumer haya hecho ack del anterior
```

> [!warning] ¿Por qué prefetch_count=1?
> Si no configuras prefetch, RabbitMQ enviará todos los mensajes disponibles a un consumer rápidamente. Si ese consumer es lento, se acumulará memoria. Con prefetch_count=1, RabbitMQ espera el ack antes de enviar el siguiente mensaje, regulando el flujo.

---

## 3. Kafka: El stream processing platform

Kafka no es solo una message queue — es una plataforma de streaming distribuida. Diseñado por LinkedIn y ahora mantenido por la Apache Software Foundation, Kafka está optimizado para alto throughput y persistencia a largo plazo.

### 3.1 Conceptos fundamentales de Kafka

**Topic**: Una categoría o feed al que se publican los mensajes. Es similar a una tabla en una base de datos o a una carpeta en un sistema de archivos.

**Partition**: Cada topic se divide en particiones (shards). Las particiones permiten paralelismo y escalado horizontal. Cada partición es un log inmutable ordenado.

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

**Broker**: Un servidor individual en el cluster de Kafka. Cada broker almacena una o más particiones.

**Producer**: Publica mensajes a un topic. Puede elegir qué partición usar (round-robin, por key, o personalizado).

**Consumer**: Suscribe a un topic y lee mensajes. Los consumers se agrupan en **consumer groups**.

**Consumer Group**: Un grupo de consumers que trabajan juntos para consumir un topic. Cada partición es consumida por exactamente un consumer dentro del grupo. Esto permite escalado horizontal: si tienes 3 particiones y 3 consumers en el mismo grupo, cada consumer procesa una partición.

```
Topic: "orders" (3 particiones)
┌──────────┐    ┌──────────┐    ┌──────────┐
│ Partition │───>│ Consumer │    │ Partition│───>│ Consumer │
│   0       │    │   A      │    │   1      │───>│   B      │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                          ┌──────────┐
                                          │ Partition│───>│ Consumer │
                                          │   2      │    │   C      │
                                          └──────────┘    └──────────┘
```

> [!info] ¿Por qué consumer groups?
> Los consumer groups permiten que múltiples consumers trabajen en paralelo sobre el mismo topic. Si tienes 1000 mensajes por segundo y cada consumer procesa 200 mensajes por segundo, necesitas 5 consumers en el mismo grupo. Si quieres que todos los consumers reciban TODOS los mensajes (ej: para logging), crea un consumer group por consumer.

### 3.2 El log de Kafka: Inmutable y persistente

Cada partición de Kafka es un log inmutable y append-only:

```
Partition 0 log:
Offset 0: {key: "user-1", value: "created", timestamp: 1000}
Offset 1: {key: "user-2", value: "updated", timestamp: 1001}
Offset 2: {key: "user-1", value: "deleted", timestamp: 1002}
Offset 3: {key: "user-3", value: "created", timestamp: 1003}
```

- **Offset**: Un número único e incremental que identifica cada mensaje dentro de una partición.
- **Inmutable**: Una vez escrito, un mensaje nunca cambia. No se puede modificar ni eliminar (solo se marca como "compacted").
- **Append-only**: Solo se pueden añadir mensajes al final.

> [!tip] ¿Por qué inmutable?
> Los logs inmutables son más simples, más rápidos, y más confiables. No hay que preocuparse por actualizaciones concurrentes, lockings, o corrupción de datos. Además, permiten replay: puedes volver a leer los mensajes desde cualquier offset.

### 3.3 Retención de mensajes

A diferencia de RabbitMQ (donde los mensajes se eliminan después de ser consumidos), Kafka retiene los mensajes durante un tiempo configurable (por defecto 7 días) o hasta que el log alcanza un tamaño máximo.

```
# Configuración de retención
log.retention.hours=168    # 7 días
log.retention.bytes=-1     # Sin límite de tamaño
log.retention.check.interval.ms=300000
```

Esto permite:
- **Replay**: Consumers pueden volver a leer mensajes desde cualquier offset.
- **Multi-consumption**: Múltiples consumer groups pueden leer el mismo topic independientemente.
- **Historia**: Los datos están disponibles para análisis histórico.

### 3.4 Exactly-once semantics

Kafka ofrece tres garantías de entrega:

1. **At-most-once**: El mensaje puede perderse pero nunca se duplica. (RabbitMQ con auto-ack)
2. **At-least-once**: El mensaje nunca se pierde pero puede duplicarse. (RabbitMQ con manual ack)
3. **Exactly-once**: El mensaje se procesa exactamente una vez. (Kafka con transactions)

> [!warning] Exactly-once es caro
> Las exactly-once semantics requieren coordinación entre producers y consumers, lo que reduce el throughput. En la mayoría de los casos, at-least-once + idempotencia es suficiente y más eficiente.

---

## 4. Comparación: RabbitMQ vs Kafka

| Característica | RabbitMQ | Kafka |
|---------------|----------|-------|
| **Protocolo** | AMQP 0.9.1 | Protocolo propio de Kafka |
| **Patrón** | Point-to-point y pub/sub | Pub/sub con consumer groups |
| **Retención** | Mensajes eliminados tras consumo | Mensajes retenidos por tiempo/tamaño |
| **Throughput** | ~10K-100K mensajes/seg | ~1M+ mensajes/seg |
| **Latencia** | Baja (< 1ms) | Baja (~1-5ms) |
| **Durabilidad** | Alta (disk persistence) | Muy alta (replicación + disk) |
| **Orden** | Orden dentro de una queue | Orden dentro de una partición |
| **Replay** | No (mensajes se eliminan) | Sí (desde cualquier offset) |
| **Consumer groups** | No (cada mensaje a un consumer) | Sí (escalado horizontal) |
| **Uso ideal** | Tareas, colas de trabajo, RPC | Streaming, event sourcing, logs |

> [!tip] ¿Cuándo usar cada uno?
> - **RabbitMQ**: Cuando necesitas routing complejo, tareas asíncronas, o patrones como work queues, RPC, o request-reply.
> - **Kafka**: Cuando necesitas alto throughput, retención a largo plazo, streaming, event sourcing, o cuando múltiples consumidores necesitan leer los mismos datos.

---

## 5. Patrones comunes con message queues

### 5.1 Work Queue (Cola de trabajo)

Múltiples consumers compiten por los mensajes de una queue. Cada mensaje es procesado por un solo consumer.

```
Producer → Queue → Consumer A  (procesa mensaje)
                 → Consumer B  (procesa siguiente mensaje)
                 → Consumer C  (procesa siguiente mensaje)
```

Uso: Procesamiento de imágenes, envío de emails, tareas background.

### 5.2 Pub/Sub (Publicar/Suscribir)

Un mensaje se envía a todos los consumers suscritos.

```
Producer → Exchange (fanout) → Queue A → Consumer A
                              → Queue B → Consumer B
                              → Queue C → Consumer C
```

Uso: Notificaciones, logging, métricas.

### 5.3 Request-Reply

Un consumer responde a un mensaje con otro mensaje.

```
Producer → Queue → Consumer → Response Queue → Producer (wait)
```

Uso: RPC asíncrono, consultas a servicios.

### 5.4 Event Sourcing

Cada cambio de estado se almacena como un evento inmutable en Kafka. El estado actual se reconstruye replayando todos los eventos.

```
Event log:
1. UserCreated(id: 1, name: "Emilio")
2. EmailUpdated(id: 1, email: "emilio@example.com")
3. PasswordChanged(id: 1)
4. UserDeleted(id: 1)

Estado actual: UserDeleted(id: 1)
```

---

## Conceptos clave

1. **Las message queues desacoplan producers de consumers**: Los producers no necesitan saber quién consume los mensajes, ni cuándo. Esto permite escalado independiente y resiliencia.

2. **RabbitMQ es flexible pero limitado en throughput**: Ideal para routing complejo, tareas asíncronas, y patrones empresariales. No es ideal para streaming de alto volumen.

3. **Kafka es un stream processing platform, no solo una queue**: Diseñado para alto throughput, retención a largo plazo, y replay de eventos. Los consumer groups permiten escalado horizontal.

4. **La durabilidad no es automática**: En RabbitMQ, necesitas marcar mensajes como persistentes y queues como durables. En Kafka, necesitas configurar replication factor > 1.

5. **El orden es parcial**: En RabbitMQ, el orden se mantiene dentro de una queue. En Kafka, el orden se mantiene dentro de una partición, no a nivel de topic.

## Relacionado con

- [[01-consensus-paxos-raft]] — Los brokers de message queues usan consenso interno para replicar datos entre nodos
- [[03-distributed-caching]] — Redis también puede usarse como message queue simple (con listas y pub/sub)
- [[04-event-driven-cqrs-saga]] — Las message queues son la base de la arquitectura event-driven y el patrón Saga
- [[05-idempotency-retry-circuit-breakers]] — La idempotencia es esencial cuando los mensajes pueden duplicarse (at-least-once delivery)

## Referencias

- [RabbitMQ Documentation](https://www.rabbitmq.com/documentation.html)
- [Apache Kafka Documentation](https://kafka.apache.org/documentation/)
- [AMQP 0.9.1 Specification](https://www.rabbitmq.com/resources/specs/amqp0-9-1.pdf)
- [Designing Data-Intensive Applications — Martin Kleppmann](https://dataintensive.net/)
- [Kafka: A Distributed Messaging System for Log Processing](https://www.confluent.io/blog/kafka-log-structured-message-system/)
