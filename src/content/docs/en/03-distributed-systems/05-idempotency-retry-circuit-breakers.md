---
title: "Idempotency, retry patterns, and circuit breakers"
description: "Resilience patterns in distributed systems: idempotency, exponential backoff with jitter, circuit breaker, bulkhead, rate limiting, and retry policies."
---

# Idempotency, retry patterns, and circuit breakers

> [!tip] In one sentence
> **Idempotency** guarantees that repeating an operation does not change the result, **retry patterns** handle temporary failures with intelligent retries, and **circuit breakers** prevent a downed service from overwhelming others.

## Why is resilience essential?

In distributed systems, things FAIL. Constantly. It is not a question of IF something will fail, but WHEN. Servers crash, networks cut out, databases lock up, timeouts fire. Your system needs to be designed to FAIL GRACEFULLY — that is, to keep working (or at least degrade in a controlled way) when something goes wrong.

> [!warning] The law of distributed systems
> Assume that anything that can fail, WILL fail. At some point. In production. With real users. Under maximum load.
>
> - Network calls can timeout
> - Database connections can close
> - Disks can fill up
> - Services can have latency spikes
> - External dependencies can have downtime
>
> If your code assumes everything will work, it is broken.

---

## 1. Idempotency: Repeating does not change the result

An operation is **idempotent** if executing it once or multiple times produces the same result.

### 1.1 Idempotent vs non-idempotent operations

| Operation | Idempotent | Why? |
|-----------|-----------|------|
| `GET /api/users` | ✅ Yes | Reading does not change anything |
| `DELETE /api/users/1` | ✅ Yes | Deleting once or a thousand times = deleted |
| `PUT /api/users/1` (replace) | ✅ Yes | Replacing with the same data = same result |
| `POST /api/orders` | ❌ No | Creating an order once vs a thousand times = 1 vs 100 orders |
| `POST /api/payments` | ❌ No | Charging once vs charging 10 times = $100 vs $1000 |
| `PATCH /api/users/1` (increment) | ❌ No | Incrementing the counter once vs twice = 10 vs 11 |

> [!tip] PUT vs PATCH vs POST
> - **PUT** to an existing resource is idempotent (replaces the entire resource).
> - **PATCH** can be idempotent or not, depending on the operation (e.g., `PATCH /users/1/points/increment` is not idempotent).
> - **POST** is never idempotent (always creates something new). To make it idempotent, you need an idempotency token.

### 1.2 Idempotency tokens

The most common way to make POST idempotent is to use an idempotency token:

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

The server stores the idempotency token along with the result:

```
Idempotency database:
┌──────────────────┬───────────┬──────────────┬──────────────┐
│  idempotency_key │  status   │  response    │  created_at  │
├──────────────────┼───────────┼──────────────┼──────────────┤
│  abc-123-def-456 │ COMPLETED │ {id: "pay-1"}│ 10:30:00.000 │
└──────────────────┴───────────┴──────────────┴──────────────┘
```

When a second request with the same token arrives:
```
1. Search for token "abc-123-def-456" in DB
2. Found with status "COMPLETED"
3. Return the original response: {id: "pay-1"}
4. DO NOT process the payment again
```

> [!warning] The token must be unique per request
> The client must generate a unique token for each request (e.g., a UUID). Do not reuse tokens for different requests. If you reuse a token for different requests, you will receive the response from the first one (which may be wrong for the second).

### 1.3 Idempotency in the context of message queues

In message queues with at-least-once delivery (RabbitMQ manual ack, Kafka without transactions), messages may be duplicated. Idempotency of the consumer is essential:

```python
# Idempotent consumer
def process_payment(payment_event):
    # Check if we already processed this event
    if redis.exists(f"processed_event:{payment_event.id}"):
        logger.info(f"Event already processed: {payment_event.id}")
        return  # Skip, already processed
    
    # Process
    result = charge_user(payment_event.user_id, payment_event.amount)
    
    # Mark as processed
    redis.setex(f"processed_event:{payment_event.id}", 86400, "1")
    
    return result
```

> [!tip] TTL on processed event tracking
> Use a TTL (e.g., 24 hours) for "processed event" marks. If an event is duplicated after 24 hours, it is acceptable to process it again (or ignore it if the payment system detects it).

---

## 2. Retry Patterns: Retrying with intelligence

When an operation fails, sometimes the simplest solution is to retry. But retrying without intelligence can make the problem worse (thundering herd, saturation).

### 2.1 Simple retry (NOT recommended)

```python
# ❌ Bad: retry without limits or delays
for _ in range(3):
    try:
        result = call_external_api()
        break
    except Exception:
        pass  # Immediately retry
```

Problems:
- No delay, saturates the destination service
- No retry limit, infinite loop
- No backoff, all clients retry at the same time

### 2.2 Exponential Backoff with Jitter

The recommended pattern: wait longer between attempts, with randomness to avoid the thundering herd.

```
Attempt 1 → Fail → Wait 100ms
Attempt 2 → Fail → Wait 200ms
Attempt 3 → Fail → Wait 400ms
Attempt 4 → Success!
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
                raise  # Last attempt failed, re-raise
            
            # Exponential backoff with jitter
            delay = min(base_delay * (2 ** attempt), max_delay)
            jitter = random.uniform(0, delay * 0.1)  # 10% jitter
            actual_delay = delay + jitter
            
            logger.warning(
                f"Attempt {attempt + 1} failed: {e}. "
                f"Retrying in {actual_delay:.2f}s"
            )
            time.sleep(actual_delay)
```

> [!example] Why jitter?
> Without jitter, if 1000 clients retry at the same time after a failure, all 1000 hit the destination service at the same time again (thundering herd). With jitter, the 1000 clients retry at different times, distributing the load.
>
> Jitter = 10% means: the actual delay = calculated delay ± 10%. Not much, but enough to distribute the load.

### 2.3 Retry policies by error type

Not all errors should be retried:

```python
def should_retry(error):
    # Retry on temporary errors
    if isinstance(error, (ConnectionError, TimeoutError, RequestTimeout)):
        return True
    
    # Retry on server errors (5xx)
    if hasattr(error, 'status_code') and error.status_code >= 500:
        return True
    
    # DO NOT retry on client errors (4xx)
    if hasattr(error, 'status_code') and 400 <= error.status_code < 500:
        return False
    
    # DO NOT retry on validation errors
    if isinstance(error, ValidationError):
        return False
    
    return False
```

> [!warning] Never retry client errors
> A 400 (Bad Request) or 401 (Unauthorized) error will not be solved by retrying. You are just wasting resources and delaying the correct response to the user.

---

## 3. Circuit Breaker Pattern

The circuit breaker prevents a downed service from overwhelming others. It works like an electrical switch: if there is a short circuit, the switch trips and cuts the power.

### 3.1 Circuit Breaker states

```
                    ┌─────────┐
         (success)  │         │   (error)
Closed ──────────>│         │───> Open
                   │         │   <───────────────┐
         (success)  └─────────┘                  │
                   <─────────────────────────────┘
                               (timeout)
                                   │
                                   ▼
                            ┌───────────────┐
                            │               │  (success)
                   half-open│               │───> Closed
                            │               │
                            │               │  (error)
                            │               │───> Open
                            └───────────────┘
```

**Closed (Closed)**: Everything is working normally. Requests pass. Failures are counted.

**Open (Open)**: The failure threshold has been reached. All requests fail immediately without calling the service. A timeout is waited.

**Half-Open (Half-Open)**: After the timeout, ONE test request is allowed. If it works, the breaker closes. If it fails, it opens again.

### 3.2 Circuit Breaker configuration

```python
class CircuitBreaker:
    def __init__(
        self,
        failure_threshold=5,      # Number of failures to open the breaker
        recovery_timeout=30,      # Seconds before going to half-open
        half_open_max_calls=1,    # How many test calls in half-open
        success_threshold=1,      # Successes needed to close in half-open
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

### 3.3 Usage example

```python
# Initialize circuit breaker
payment_breaker = CircuitBreaker(
    failure_threshold=5,
    recovery_timeout=30,
)

# Use in code
def process_payment(user_id, amount):
    # Check if the circuit breaker is open
    if payment_breaker.is_open():
        raise PaymentServiceUnavailable("Payment service is unavailable")
    
    try:
        result = call_payment_service(user_id, amount)
        
        # If success, record it
        payment_breaker.record_success()
        return result
        
    except Exception as e:
        # If failure, record it
        payment_breaker.record_failure()
        raise
```

### 3.4 Circuit Breaker metrics

```python
def record_success(self):
    if self.state == "HALF_OPEN":
        self.half_open_calls += 1
        if self.half_open_calls >= self.success_threshold:
            self.state = "CLOSED"
            self.failure_count = 0
            logger.info("Circuit breaker CLOSED after half-open success")
    elif self.state == "CLOSED":
        self.failure_count = 0  # Reset on success

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

### 3.5 Where to put circuit breakers?

- **Between services**: Yes, always. Every call between microservices needs a circuit breaker.
- **To database**: Yes, if the DB can saturate and affect other clients.
- **To third-party services (external APIs)**: Yes, especially if they have rate limits.
- **Between web client and API gateway**: Generally NO (web clients do not need circuit breakers for themselves).

> [!tip] Circuit breaker != rate limiter
> - **Circuit breaker**: Opens when the destination service is FAILING. Protects the client from calling a downed service.
> - **Rate limiter**: Limits how many requests you can make, regardless of whether the service is failing or not. Protects the destination service from overload.
>
> The two are usually used together: rate limiter first, then circuit breaker.

---

## 4. Bulkhead Pattern

The bulkhead pattern isolates resources so that a failure in one component does not affect all others. It is named after the watertight compartments of a ship: if one compartment fills with water, the ship does not sink.

### 4.1 Connection pool with bulkhead

```python
# Without bulkhead: single connection pool for everything
pool = ConnectionPool(max_size=10)

# WITH bulkhead: separate pools per service
payment_pool = ConnectionPool(max_size=5)
inventory_pool = ConnectionPool(max_size=3)
notification_pool = ConnectionPool(max_size=2)
```

If the notifications service saturates and consumes all connections from the shared pool, the payment and inventory services are NOT affected because they have separate pools.

### 4.2 Python implementation

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

Rate limiting controls how many requests a client (or your service) can make in a time period.

### 5.1 Rate limiting strategies

**Fixed Window**: Count requests in fixed time windows.

```
Window: 00:00 - 00:59 → 100 requests
Window: 01:00 - 01:59 → 100 requests
```

Problem: In the last seconds of window 1 and the first of window 2, you can make double the requests.

**Sliding Window**: Count requests in a continuously shifting window.

```
Now is 00:30 → count requests from 00:00 to 00:30
```

More precise but more computationally expensive.

**Token Bucket**: Each bucket has a limit of tokens that regenerate at a constant rate. Each request consumes one token.

```
Bucket: 100 tokens
Regeneration: 10 tokens/second

0s: 100 tokens (full)
→ 50 requests → 50 tokens remaining
1s: 60 tokens (10 regenerated)
→ 40 requests → 20 tokens remaining
...
```

> [!tip] Token bucket is the most practical
> It is easy to implement, allows controlled bursts, and has predictable behavior. Redis supports it natively with `INCR` and `EXPIRE`.

### 5.2 Redis implementation

```python
def check_rate_limit(redis, key, limit, window):
    """
    key: "rate_limit:api:user:123"
    limit: 100 requests
    window: 60 seconds
    """
    current = redis.incr(key)
    if current == 1:
        redis.expire(key, window)  # Only on first request
    return current <= limit
```

---

## 6. Pattern Summary

| Pattern | Problem it solves | When to use |
|---------|-------------------|-------------|
| **Idempotency** | Request duplication | POST, payments, message queues |
| **Retry + Backoff** | Temporary failures | Network calls, DB, external APIs |
| **Circuit Breaker** | Downed service overwhelms client | Calls between microservices |
| **Bulkhead** | One component affects all | Connection pools, threads |
| **Rate Limiting** | Service overload | Public APIs, client limiting |

---

## Key concepts

1. **Idempotency is essential in distributed systems**: Retries, at-least-once message queues, and network reconnections can duplicate requests. Without idempotency, duplicating a request can charge twice, create two orders, or send two emails.

2. **Retry with exponential backoff and jitter is the standard pattern**: Retrying immediately without delay saturates the service. Retrying always with the same delay causes thundering herd. Exponential backoff + jitter distributes retries over time and reduces load.

3. **The circuit breaker protects against cascading failures**: If a service is down, there is no point in continuing to call it. The circuit breaker cuts off calls, allows the service to recover, and then tests with a diagnostic request.

4. **Bulkhead and rate limiting are complementary**: Bulkhead isolates internal resources (pools, threads). Rate limiting controls external traffic (APIs, clients). Both prevent one component from overwhelming the system.

5. **Nothing in production always works**: Assume that EVERYTHING will fail at some point. Design for failure from the start, not as an afterthought.

## Related to

- [[01-consensus-paxos-raft]] — Compensations in Sagas need to be idempotent
- [[02-message-queues]] — Message queues with at-least-once delivery require idempotency in consumers
- [[03-distributed-caching]] — Circuit breakers protect calls to Redis Cluster
- [[04-event-driven-cqrs-saga]] — Sagas need idempotency in compensating transactions

## References

- [Microsoft Anti-Patterns — Retry](https://learn.microsoft.com/en-us/azure/architecture/best-practices/retry-service-specific/retry-service-specific#retry)
- [Martin Fowler — Circuit Breaker](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Microsoft Saga Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga)
- [Netflix Hystrix — Circuit Breaker](https://github.com/Netflix/Hystrix/wiki)
- [Designing Data-Intensive Applications — Chapter 7: Resource Pooling](https://dataintensive.net/)
