---
title: "Idempotencia, retry patterns y circuit breakers"
description: "Patrones de resiliencia en sistemas distribuidos: idempotencia, exponential backoff con jitter, circuit breaker, bulkhead, rate limiting, y retry policies."
---

# Idempotencia, retry patterns y circuit breakers

> [!tip] En una frase
> La **idempotencia** garantiza que repetir una operación no cambia el resultado, los **retry patterns** manejan fallos temporales con reintentos inteligentes, y los **circuit breakers** previenen que un servicio caído sature a los demás.

## ¿Por qué la resiliencia es esencial?

En sistemas distribuidos, las cosas FALLAN. Constantemente. No es una pregunta de SI va a fallar, sino de CUÁNDO. Los servidores se caen, las redes se cortan, las bases de datos se bloquean, los timeouts se disparan. Tu sistema necesita estar diseñado para FALLAR GRACIELOSMENTE — es decir, seguir funcionando (o al menos degradarse de forma controlada) cuando algo sale mal.

> [!warning] La ley de los sistemas distribuidos
> Asume que cualquier cosa que pueda fallar, FALLARÁ. En algún momento. En producción. Con usuarios reales. Bajo carga máxima.
>
> - Las llamadas de red pueden timeout
> - Las conexiones a base de datos pueden cerrarse
> - Los discos pueden llenarse
> - Los servicios pueden tener picos de latencia
> - Las dependencias externas pueden tener downtime
>
> Si tu código asume que todo funcionará siempre, está roto.

---

## 1. Idempotencia: Repetir no cambia el resultado

Una operación es **idempotente** si se ejecuta una o múltiples veces, el resultado es el mismo.

### 1.1 Operaciones idempotentes vs no-idempotentes

| Operación | Idempotente | ¿Por qué? |
|-----------|------------|-----------|
| `GET /api/users` | ✅ Sí | Leer no cambia nada |
| `DELETE /api/users/1` | ✅ Sí | Borrar una vez o mil veces = borrado |
| `PUT /api/users/1` (reemplazar) | ✅ Sí | Reemplazar con los mismos datos = mismo resultado |
| `POST /api/orders` | ❌ No | Crear una orden una vez vs mil veces = 1 vs 100 órdenes |
| `POST /api/payments` | ❌ No | Cobrar una vez vs cobrar 10 veces = $100 vs $1000 |
| `PATCH /api/users/1` (incrementar) | ❌ No | Incrementar el contador una vez vs dos = 10 vs 11 |

> [!tip] PUT vs PATCH vs POST
> - **PUT** a un recurso existente es idempotente (reemplaza el recurso completo).
> - **PATCH** puede ser idempotente o no, dependiendo de la operación (ej: `PATCH /users/1/points/increment` no es idempotente).
> - **POST** nunca es idempotente (siempre crea algo nuevo). Para hacerla idempotente, necesitas un token de idempotencia.

### 1.2 Tokens de idempotencia

La forma más común de hacer POST idempotente es usar un token de idempotencia:

```http
POST /api/payments
Idempotency-Key: abc-123-def-456
Content-Type: application/json

{
  "amount": 100.00,
  "currency": "EUR",
  "recipient": "merchant-123"
}
```

El servidor almacena el token de idempotencia junto con el resultado:

```
Base de datos de idempotencia:
┌──────────────────┬───────────┬──────────────┬──────────────┐
│  idempotency_key │  status   │  response    │  created_at  │
├──────────────────┼───────────┼──────────────┼──────────────┤
│  abc-123-def-456 │ COMPLETED │ {id: "pay-1"}│ 10:30:00.000 │
└──────────────────┴───────────┴──────────────┴──────────────┘
```

Cuando llega un segundo request con el mismo token:
```
1. Buscar token "abc-123-def-456" en BD
2. Encontrado con status "COMPLETED"
3. Devolver la respuesta original: {id: "pay-1"}
4. NO procesar el pago nuevamente
```

> [!warning] El token debe ser único por request
> El cliente debe generar un token único para cada request (ej: un UUID). No reutilices tokens de requests diferentes. Si reutilizas un token para requests diferentes, recibirás la respuesta del primero (que puede ser incorrecta para el segundo).

### 1.3 Idempotencia en el contexto de message queues

En message queues con entrega at-least-once (RabbitMQ manual ack, Kafka sin transactions), los mensajes pueden duplicarse. La idempotencia del consumer es esencial:

```python
# Consumer idempotente
def process_payment(payment_event):
    # Verificar si ya procesamos este evento
    if redis.exists(f"processed_event:{payment_event.id}"):
        logger.info(f"Evento ya procesado: {payment_event.id}")
        return  # Skip, ya procesado
    
    # Procesar
    result = charge_user(payment_event.user_id, payment_event.amount)
    
    # Marcar como procesado
    redis.setex(f"processed_event:{payment_event.id}", 86400, "1")
    
    return result
```

> [!tip] TTL en el tracking de eventos procesados
> Usa un TTL (ej: 24 horas) para las marcas de "evento procesado". Si un evento se duplica después de 24 horas, es aceptable procesarlo de nuevo (o ignorarlo si el sistema de pagos lo detecta).

---

## 2. Retry Patterns: Reintentar con inteligencia

Cuando una operación falla, a veces la solución más simple es reintentar. Pero reintentar sin inteligencia puede empeorar el problema (thundering herd, saturación).

### 2.1 Retry simple (NO recomendado)

```python
# ❌ Mal: retry sin límites ni delays
for _ in range(3):
    try:
        result = call_external_api()
        break
    except Exception:
        pass  # Inmediatamente reintentar
```

Problemas:
- Sin delay, saturas el servicio destino
- Sin límite de intentos, loop infinito
- Sin backoff, todos los clientes reintentan al mismo tiempo

### 2.2 Exponential Backoff con Jitter

El patrón recomendado: espera cada vez más tiempo entre intentos, con aleatoriedad para evitar el thundering herd.

```
Intent 1 → Fallo → Esperar 100ms
Intent 2 → Fallo → Esperar 200ms
Intent 3 → Fallo → Esperar 400ms
Intent 4 → Éxito!
```

```python
import random
import time

def retry_with_backoff(func, max_retries=3, base_delay=0.1, max_delay=10.0):
    for attempt in range(max_retries + 1):
        try:
            return func()
        except Exception as e:
            if attempt == max_retries:
                raise  # Último intento falló, re-lanzar
            
            # Exponential backoff con jitter
            delay = min(base_delay * (2 ** attempt), max_delay)
            jitter = random.uniform(0, delay * 0.1)  # 10% de jitter
            actual_delay = delay + jitter
            
            logger.warning(
                f"Attempt {attempt + 1} failed: {e}. "
                f"Retrying in {actual_delay:.2f}s"
            )
            time.sleep(actual_delay)
```

> [!example] ¿Por qué jitter?
> Sin jitter, si 1000 clientes reintentan al mismo tiempo después de un fallo, los 1000 llegan al servicio destino al mismo tiempo de nuevo (thundering herd). Con jitter, los 1000 clientes reintentan en momentos diferentes, distribuyendo la carga.
>
> Jitter = 10% significa: el delay real = delay calculado ± 10%. No es mucho, pero suficiente para distribuir la carga.

### 2.3 Retry policies por tipo de error

No todos los errores deben reintentarse:

```python
def should_retry(error):
    # Retry en errores temporales
    if isinstance(error, (ConnectionError, TimeoutError, RequestTimeout)):
        return True
    
    # Retry en errores de servidor (5xx)
    if hasattr(error, 'status_code') and error.status_code >= 500:
        return True
    
    # NO retry en errores del cliente (4xx)
    if hasattr(error, 'status_code') and 400 <= error.status_code < 500:
        return False
    
    # NO retry en errores de validación
    if isinstance(error, ValidationError):
        return False
    
    return False
```

> [!warning] Nunca retryes errores del cliente
> Un error 400 (Bad Request) o 401 (Unauthorized) no se solucionará reintentando. Solo desperdicias recursos y retrasas la respuesta correcta al usuario.

---

## 3. Circuit Breaker Pattern

El circuit breaker previene que un servicio caído sature a los demás. Funciona como un interruptor eléctrico: si hay un cortocircuito, el interruptor se dispara y corta la corriente.

### 3.1 Estados del Circuit Breaker

```
                    ┌─────────┐
         (éxito)    │         │   (error)
Closed ──────────>│         │───> Open
                   │         │   <───────────────┐
         (éxito)    └─────────┘                  │
                   <─────────────────────────────┘
                               (timeout)
                                   │
                                   ▼
                            ┌───────────────┐
                            │               │  (éxito)
                   half-open│               │───> Closed
                            │               │
                            │               │  (error)
                            │               │───> Open
                            └───────────────┘
```

**Closed (Cerrado)**: Todo funciona normalmente. Las requests pasan. Se cuentan los fallos.

**Open (Abierto)**: Se han alcanzado el umbral de fallos. Todas las requests fallan inmediatamente sin llamar al servicio. Se espera un timeout.

**Half-Open (Semicerrado)**: Después del timeout, se permite UNA request de prueba. Si funciona, se cierra el breaker. Si falla, se vuelve a abrir.

### 3.2 Configuración del Circuit Breaker

```python
class CircuitBreaker:
    def __init__(
        self,
        failure_threshold=5,      # Número de fallos para abrir el breaker
        recovery_timeout=30,      # Segundos antes de ir a half-open
        half_open_max_calls=1,    # Cuántas llamadas de prueba en half-open
        success_threshold=1,      # Éxitos necesarios para cerrar en half-open
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls
        self.success_threshold = success_threshold
        
        self.failure_count = 0
        self.state = "CLOSED"
        self.last_failure_time = None
        self.half_open_calls = 0
```

### 3.3 Ejemplo de uso

```python
# Inicializar circuit breaker
payment_breaker = CircuitBreaker(
    failure_threshold=5,
    recovery_timeout=30,
)

# Usar en el código
def process_payment(user_id, amount):
    # Verificar si el circuit breaker está abierto
    if payment_breaker.is_open():
        raise PaymentServiceUnavailable("Payment service is unavailable")
    
    try:
        result = call_payment_service(user_id, amount)
        
        # Si éxito, registrar
        payment_breaker.record_success()
        return result
        
    except Exception as e:
        # Si fallo, registrar
        payment_breaker.record_failure()
        raise
```

### 3.4 Métricas del Circuit Breaker

```python
def record_success(self):
    if self.state == "HALF_OPEN":
        self.half_open_calls += 1
        if self.half_open_calls >= self.success_threshold:
            self.state = "CLOSED"
            self.failure_count = 0
            logger.info("Circuit breaker CLOSED after half-open success")
    elif self.state == "CLOSED":
        self.failure_count = 0  # Reset al tener éxito

def record_failure(self):
    self.failure_count += 1
    self.last_failure_time = time.time()
    
    if self.state == "HALF_OPEN":
        self.state = "OPEN"
        logger.warning("Circuit breaker re-OPENED from half-open")
    elif self.state == "CLOSED" and self.failure_count >= self.failure_threshold:
        self.state = "OPEN"
        logger.warning(
            f"Circuit breaker OPENED after {self.failure_count} failures"
        )
```

### 3.5 ¿Dónde poner circuit breakers?

- **Entre servicios**: Sí, siempre. Cada llamada entre microservicios necesita un circuit breaker.
- **Hacia base de datos**: Sí, si la BD puede saturarse y afectar a otros clientes.
- **Hacia servicios de terceros (APIs externas)**: Sí, especialmente si tienen rate limits.
- **Entre el cliente web y el API gateway**: Generalmente NO (los clientes web no necesitan circuit breakers para sí mismos).

> [!tip] Circuit breaker != rate limiter
> - **Circuit breaker**: Se abre cuando el servicio destino está FALLANDO. Protege al cliente de llamar a un servicio caído.
> - **Rate limiter**: Limita cuántas requests puedes hacer, independientemente de si el servicio está fallando o no. Protege al servicio destino de sobrecarga.
>
> Los dos suelen usarse juntos: rate limiter primero, luego circuit breaker.

---

## 4. Bulkhead Pattern

El bulkhead pattern aísla recursos para que un fallo en un componente no afecte a todos los demás. Se llama así como los compartimentos estancos de un barco: si un compartimento se llena de agua, el barco no se hunde.

### 4.1 Pool de conexiones con bulkhead

```python
# Sin bulkhead: un solo pool de conexiones para todo
pool = ConnectionPool(max_size=10)

# CON bulkhead: pools separados por servicio
payment_pool = ConnectionPool(max_size=5)
inventory_pool = ConnectionPool(max_size=3)
notification_pool = ConnectionPool(max_size=2)
```

Si el servicio de notificaciones se satura y consume todas las conexiones del pool compartido, los servicios de pago e inventario NO se ven afectados porque tienen pools separados.

### 4.2 Implementación en Python

```python
import threading
from concurrent.futures import ThreadPoolExecutor

class Bulkhead:
    def __init__(self, max_concurrent=10, max_queue=100):
        self.max_concurrent = max_concurrent
        self.max_queue = max_queue
        self.semaphore = threading.Semaphore(max_concurrent)
        self.executor = ThreadPoolExecutor(
            max_workers=max_concurrent,
            thread_name_prefix="bulkhead"
        )
    
    def execute(self, func, *args, **kwargs):
        if not self.semaphore.acquire(timeout=5):
            raise BulkheadFullException(
                f"Bulkhead full: {self.max_concurrent} concurrent, "
                f"queue full: {self.max_queue}"
            )
        try:
            future = self.executor.submit(func, *args, **kwargs)
            return future.result(timeout=30)
        finally:
            self.semaphore.release()
```

---

## 5. Rate Limiting

El rate limiting controla cuántas requests puede hacer un cliente (o tu servicio) en un periodo de tiempo.

### 5.1 Estrategias de rate limiting

**Fixed Window**: Cuenta requests en ventanas fijas de tiempo.

```
Ventana: 00:00 - 00:59 → 100 requests
Ventana: 01:00 - 01:59 → 100 requests
```

Problema: En los últimos segundos de la ventana 1 y los primeros de la ventana 2, puedes hacer el doble de requests.

**Sliding Window**: Cuenta requests en una ventana que se desplaza continuamente.

```
Ahora es 00:30 → contar requests desde 00:00 hasta 00:30
```

Más preciso pero más costoso computacionalmente.

**Token Bucket**: Cada bucket tiene un límite de tokens que se regeneran a tasa constante. Cada request consume un token.

```
Bucket: 100 tokens
Regeneración: 10 tokens/segundo

0s: 100 tokens (lleno)
→ 50 requests → 50 tokens restantes
1s: 60 tokens (regenerados 10)
→ 40 requests → 20 tokens restantes
...
```

> [!tip] Token bucket es el más práctico
> Es fácil de implementar, permite ráfagas controladas, y tiene un comportamiento predecible. Redis lo soporta nativamente con `INCR` y `EXPIRE`.

### 5.2 Implementación con Redis

```python
def check_rate_limit(redis, key, limit, window):
    """
    key: "rate_limit:api:user:123"
    limit: 100 requests
    window: 60 seconds
    """
    current = redis.incr(key)
    if current == 1:
        redis.expire(key, window)  # Solo en el primer request
    return current <= limit
```

---

## 6. Pattern Summary

| Pattern | Problema que resuelve | Cuándo usar |
|---------|----------------------|-------------|
| **Idempotencia** | Duplicación de requests | POST, payments, mensajes de queues |
| **Retry + Backoff** | Fallos temporales | Llamadas a red, DB, APIs externas |
| **Circuit Breaker** | Servicio caído satura al cliente | Llamadas entre microservicios |
| **Bulkhead** | Un componente afecta a todos | Pools de conexiones, threads |
| **Rate Limiting** | Sobrecarga del servicio | APIs públicas, limitación de clientes |

---

## Conceptos clave

1. **La idempotencia es esencial en sistemas distribuidos**: Los retries, las message queues at-least-once, y las reconexiones de red pueden duplicar requests. Sin idempotencia, duplicar una request puede cobrar dos veces, crear dos órdenes, o enviar dos emails.

2. **El retry con exponential backoff y jitter es el patrón estándar**: Retry inmediatamente sin delay satura el servicio. Retry siempre con el mismo delay causa thundering herd. Exponential backoff + jitter distribuye los reintentos en el tiempo y reduce la carga.

3. **El circuit breaker protege contra fallos en cascada**: Si un servicio se cae, no tiene sentido seguir llamándolo. El circuit breaker corta las llamadas, permite al servicio recuperarse, y luego prueba con una request de diagnóstico.

4. **Bulkhead y rate limiting son complementarios**: Bulkhead aísla recursos internos (pools, threads). Rate limiting controla el tráfico externo (APIs, clientes). Ambos previenen que un componente sature al sistema.

5. **Nada en producción funciona siempre**: Asume que TODO va a fallar en algún momento. Diseña para el fallo desde el principio, no como un afterthought.

## Relacionado con

- [[01-consensus-paxos-raft]] — Las compensaciones en Sagas necesitan ser idempotentes
- [[02-message-queues]] — Las message queues con at-least-once delivery requieren idempotencia en los consumers
- [[03-distributed-caching]] — Los circuit breakers protegen las llamadas a Redis Cluster
- [[04-event-driven-cqrs-saga]] — Los Sagas necesitan idempotencia en las compensating transactions

## Referencias

- [Microsoft Anti-Patterns — Retry](https://learn.microsoft.com/en-us/azure/architecture/best-practices/retry-service-specific/retry-service-specific#retry)
- [Martin Fowler — Circuit Breaker](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Microsoft Saga Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga)
- [Netflix Hystrix — Circuit Breaker](https://github.com/Netflix/Hystrix/wiki)
- [Designing Data-Intensive Applications — Chapter 7: Resource Pooling](https://dataintensive.net/)
