---
title: "Caching distribuido: Redis, clusters y consistencia"
description: "Cómo funciona el caching distribuido: Redis (tipos de datos, persistencia RDB/AOF, pub/sub), Redis Cluster (sharding, hash slots, failover), y patrones de consistencia en caché."
---

# Caching distribuido: Redis, clusters y consistencia

> [!tip] Caching en una frase
> El **caching distribuido** es una técnica que almacena datos frecuentemente accedidos en memoria en múltiples servidores, reduciendo la latencia de acceso y la carga sobre las bases de datos centrales.

## ¿Por qué necesitamos caching distribuido?

Las bases de datos son lentas comparadas con la memoria. Una consulta a PostgreSQL puede tardar 5-50ms. Una lectura de Redis en memoria tarda 0.1-0.5ms. Si tienes un millón de usuarios haciendo la misma consulta, eso es millones de consultas a la base de datos.

> [!example] Analogía de la biblioteca
> Imagina una biblioteca enorme:
> - **Base de datos**: Los libros en los estantes del sótano (lentísimo, pero todo está ahí).
> - **Cache local**: Un libro que llevas en la mochila (rapidísimo, pero solo puedes llevar uno).
> - **Cache distribuido**: Una estantería en la sala de lectura con los libros más populares (rápido, compartido por todos, pero limitado en espacio).
>
> Redis es esa estantería en la sala de lectura.

---

## 1. Redis: El servidor de estructuras de datos en memoria

Redis (Remote Dictionary Server) es un almacén de datos en memoria de código abierto que soporta estructuras de datos diversas. No es solo un cache — es una base de datos versatile que se usa como cache, message broker, y más.

### 1.1 Tipos de datos en Redis

A diferencia de un cache key-value simple (como Memcached), Redis soporta estructuras de datos complejas:

**Strings**: El tipo más básico. Un valor binario-safe de hasta 512MB.

```redis
SET user:1000:name "Emilio"
GET user:1000:name
# -> "Emilio"

INCR view_count:article:42
# -> 1234
```

**Hashes**: Un mapa de campos y valores. Ideal para almacenar objetos.

```redis
HSET user:1000 name "Emilio" email "emilio@example.com" age 30
HGETALL user:1000
# -> name: Emilio, email: emilio@example.com, age: 30
```

**Lists**: Listas ordenadas de strings. Permiten push/pop desde ambos extremos.

```redis
LPUSH notifications:user:1000 "nueva-orden" "nuevo-mensaje"
LRANGE notifications:user:1000 0 -1
# -> ["nueva-orden", "nuevo-mensaje"]
```

**Sets**: Colecciones no ordenadas de strings únicos.

```redis
SADD tags:article:42 "ia" "machine-learning" "nlp"
SMEMBERS tags:article:42
# -> {"ia", "machine-learning", "nlp"}

SINTER tags:article:42 tags:article:99
# -> Artículos en ambos sets
```

**Sorted Sets**: Sets donde cada miembro tiene un score. Útil para ranking, leaderboards, y time-series.

```redis
ZADD leaderboard 1500 "player1" 2300 "player2" 980 "player3"
ZRANGE leaderboard 0 -1 WITHSCORES
# -> player3 (980), player1 (1500), player2 (2300)
```

**Bitmaps**: Bits individuales que representan valores booleanos.

```redis
SETBIT user:1000:login:2024-01-01 1
SETBIT user:1000:login:2024-01-02 1
SETBIT user:1000:login:2024-01-03 0
# -> Usuario 1000: login el día 1 y 2, no el día 3
```

**HyperLogLogs**: Estructura para conteo aproximado de elementos únicos (cardinality).

```redis
PFADD visitors "user1" "user2" "user3" "user1" "user4"
PFCOUNT visitors
# -> 4 (aproximado, con error estándar de 0.81%)
```

### 1.2 Persistencia: RDB vs AOF

Redis es en memoria, pero necesita persistir datos en disco para no perderlos al reiniciar. Ofrece dos modos:

**RDB (Snapshotting)**: Toma snapshots periódicos del dataset en un archivo binario compacto.

```redis
# Configuración
save 900 1      # Snapshot cada 15 min si hay al menos 1 cambio
save 300 10     # Snapshot cada 5 min si hay al menos 10 cambios
save 60 10000   # Snapshot cada 1 min si hay al menos 10000 cambios
```

- **Ventajas**: Archivo compacto, rápido de restaurar, ideal para backups.
- **Desventajas**: Puedes perder datos entre snapshots.

**AOF (Append Only File)**: Registra cada operación de escritura en un log.

```redis
# Configuración
appendonly yes
appendfsync everysec  # Sync al disco cada segundo
# Opciones: always (seguro pero lento), everysec (balanceado), no (depende del SO)
```

- **Ventajas**: Menos pérdida de datos (solo la última segundo).
- **Desventajas**: Archivo más grande, restauración más lenta.

> [!tip] ¿Usar RDB, AOF, o ambos?
> La configuración recomendada para producción es usar ambos:
> - **AOF** para durabilidad (solo pierdes ~1 segundo de datos)
> - **RDB** para backups y recuperaciones rápidas
>
> Redis combina ambos al iniciar: carga el último RDB y replay el AOF.

### 1.3 Pub/Sub de Redis

Redis incluye un sistema de pub/sub ligero:

```redis
# Subscriber
SUBSCRIBE channel:notifications

# Publisher
PUBLISH channel:notifications "nuevo-mensaje"
```

> [!warning] Pub/Sub de Redis no es durable
> Los mensajes se pierden si no hay suscriptores activos. Redis pub/sub es para mensajería en tiempo real, no para colas de mensajes durables. Para colas durables, usa Redis Lists con BLPOP/BRPOP o mejor aún, RabbitMQ/Kafka.

### 1.4 Scripts con Lua

Redis soporta ejecución de scripts Lua atómicos:

```lua
-- Script: Incrementar contador solo si existe
if redis.call('EXISTS', KEYS[1]) == 1 then
    return redis.call('INCR', KEYS[1])
else
    return -1
end
```

Los scripts Lua se ejecutan de forma atómica — ningún otro comando se ejecuta mientras el script corre. Esto es útil para operaciones complejas que necesitan atomicidad sin usar MULTI/EXEC (transacciones).

---

## 2. Redis Cluster: Sharding automático

Redis Cluster es la solución de Redis para escalar más allá de un solo servidor. Divide el espacio de claves en 16384 hash slots y los distribuye entre múltiples nodos.

### 2.1 Cómo funciona el sharding

Cada nodo en el cluster es responsable de un subconjunto de los 16384 hash slots:

```
Nodo A: Hash slots 0-5460
Nodo B: Hash slots 5461-10922
Nodo C: Hash slots 10923-16383
```

Cuando un cliente quiere acceder a una clave:
1. Calcula el hash slot de la clave: `CRC16(key) % 16384`
2. Si el slot está en el nodo al que se conectó, devuelve el dato.
3. Si el slot está en otro nodo, responde con un redirect MOVED:

```
> GET user:1000:name
MOVED 5461 192.168.1.2:6380
# El cliente redirige a 192.168.1.2:6380
> GET user:1000:name
"Emilio"
```

> [!tip] Clientes inteligentes
> Los clientes de Redis modernos (jedis, redis-py, redis-clustering) manejan los rediriges automáticamente. Mantienen un cache del mapeo hash slot → nodo, así que la mayoría de las consultas van directo al nodo correcto.

### 2.2 Replicación y failover

Cada nodo principal (master) puede tener uno o más nodos réplica (slave):

```
Nodo A (master) → Replica A1
Nodo B (master) → Replica B1
Nodo C (master) → Replica C1
```

Si un master se cae:
1. Las replicas detectan la caída (falcon detection por timeout).
2. Una replica se auto-promueve a master (elective failover).
3. El nuevo master reasigna los hash slots del master caído.
4. El cluster se reconfigura y notifica a los clientes.

```
Antes del failover:
Nodo A (master) → Replica A1

Después del failover:
Nodo A (caído) ✗
Replica A1 (promovido a master) → Replica A2 (nueva réplica)
```

> [!info] ¿Por qué 16384 hash slots?
> 16384 es un número arbitrario pero razonable. Es lo suficientemente grande para escalar (miles de nodos) pero lo suficientemente pequeño para que cada nodo pueda mantener una tabla de hash slots en memoria sin problemas.

### 2.3 Gossip protocol

Redis Cluster usa un protocolo Gossip para la comunicación entre nodos:

- Cada nodo envía periódicamente mensajes Gossip a nodos aleatorios.
- Los mensajes contienen información sobre el estado del cluster (nodos, slots, fallos).
- Esto permite la propagación rápida de información sin un nodo central.

> [!example] Analogía del chismoso
> Imagina una oficina donde:
> - Cada día, cada persona habla con 2-3 colegas al azar.
> - Les cuentan qué saben sobre quién está enfermo, quién llegó tarde, etc.
> - En pocos días, TODA la oficina sabe todo.
>
> Eso es Gossip: información que se propaga de persona a persona, de forma descentralizada.

---

## 3. Patrones de caching

### 3.1 Cache-Aside (Lazy Loading)

El patrón más común. La aplicación maneja el cache:

```python
def get_user(user_id):
    # 1. Intentar en cache
    user = redis.get(f"user:{user_id}")
    if user:
        return deserialize(user)
    
    # 2. Si no está, buscar en DB
    user = db.query("SELECT * FROM users WHERE id = ?", user_id)
    if user:
        # 3. Guardar en cache
        redis.setex(f"user:{user_id}", 3600, serialize(user))
    
    return user
```

- **Ventajas**: Simple, el cache solo almacena datos que se necesitan.
- **Desventajas**: Cache miss inicial requiere consulta a DB.

### 3.2 Read-Through / Write-Through

El cache gestiona la lógica de lectura/escritura automáticamente (normalmente con un wrapper).

```python
# Read-through
user = cache.get(f"user:{user_id}")  # Cache busca en DB si no tiene

# Write-through
cache.set(f"user:{user_id}", user_data)  # Cache escribe en DB automáticamente
```

### 3.3 Write-Behind (Write-Back)

La escritura va primero al cache, y el cache escribe en DB de forma asíncrona.

```python
# Escrito al cache inmediatamente
cache.set(f"user:{user_id}", user_data)

# Escrito a DB de forma asíncrona por el cache
# (segundo o minutos después)
```

- **Ventajas**: Escrituras muy rápidas.
- **Desventajas**: Si el cache se cae antes de escribir en DB, se pierden datos.

### 3.4 TTL (Time-To-Live) y eviction

Todos los valores en Redis pueden tener un TTL:

```redis
SET user:1000:name "Emilio" EX 3600
# Expira en 1 hora

# O después de acceder por última vez:
SET user:1000:name "Emilio" PX 3600000
# Expira en 3600000 milisegundos
```

Políticas de eviction cuando se llena la memoria:
- **noeviction**: Devuelve error cuando se llena la memoria.
- **allkeys-lru**: Eviction de la clave menos recientemente usada.
- **allkeys-lfu**: Eviction de la clave menos frecuentemente usada.
- **volatile-lru**: Solo evict claves con TTL, la menos recientemente usada.
- **volatile-lfu**: Solo evict claves con TTL, la menos frecuentemente usada.
- **volatile-ttl**: Evict la clave con TTL más corto.

> [!tip] Configura siempre un TTL
> Sin TTL, las claves nunca expiran. Si no las gestionas manualmente, el cache se llenará y empezará a evict claves (o fallará si usas noeviction). Siempre establece un TTL razonable.

---

## 4. Problemas comunes del caching

### 4.1 Cache Stampede (Thundering Herd)

Cuando una clave con TTL alto expira, miles de requests llegan simultáneamente a la base de datos.

```
Tiempo 0:    TTL expira para key "popular-article"
Tiempo 0.1s: 1000 requests llegan a la vez
Tiempo 0.2s:  1000 queries a la BD (!!!)
```

**Solución**: Lock distribuido o "guard dog" pattern:

```python
def get_article(article_id):
    data = redis.get(f"article:{article_id}")
    if data:
        return data
    
    # Intentar obtener el lock
    lock = redis.set(f"lock:article:{article_id}", "1", nx=True, ex=10)
    if lock:
        # Soy el único que regera
        data = db.get_article(article_id)
        redis.setex(f"article:{article_id}", 3600, data)
        return data
    else:
        # Otro está regenerando, espera y reintentar
        time.sleep(0.1)
        return get_article(article_id)  # Recursive retry
```

### 4.2 Cache Penetration

Requests por datos que no existen en la DB, llenando el cache con entradas null.

```python
# Usuario malicioso pide usuarios inexistentes
for i in range(1000000):
    get_user(i * 7)  # Nunca existen
```

**Solución**: Cachea también los resultados null con un TTL corto, o usa un Bloom Filter.

### 4.3 Cache Breakdown

Similar al cache stampede pero para una sola clave popular que expira.

**Solución**: Mutex distribuido (igual que stampede).

---

## 5. Consistencia en caching distribuido

El cache es inherentemente inconsistente con la base de datos. Los datos en cache pueden estar obsoletes (stale). La pregunta clave es: ¿cuánta inconsistencia puedes tolerar?

### 5.1 Consistencia eventual (la norma)

En la mayoría de los sistemas, el cache tiene consistencia eventual: eventualmente los datos en cache serán consistentes, pero no inmediatamente.

```
Tiempo 0:    DB: user.email = "old@example.com"
Tiempo 0:    Cache: user.email = "old@example.com"
Tiempo 1:    User actualiza email → DB: user.email = "new@example.com"
Tiempo 1.1:  Cache NO se actualiza aún (stale)
Tiempo 3600: TTL expira, cache se regenera con dato nuevo
```

### 5.2 Invalidación vs Actualización

**Invalidación** (recomendada): Elimina la clave del cache cuando se actualiza en la DB. La próxima lectura regenera el cache.

```python
def update_user(user_id, data):
    db.update_user(user_id, data)
    redis.delete(f"user:{user_id}")  # Invalidar cache
```

**Actualización**: Actualiza tanto la DB como el cache.

```python
def update_user(user_id, data):
    db.update_user(user_id, data)
    redis.set(f"user:{user_id}", serialize(data))  # Actualizar cache
```

> [!warning] ¿Invalidación o actualización?
> La invalidación es más segura porque evita race conditions. Con la actualización, si el write a DB falla pero el write al cache succeeds, tendrás datos inconsistentes. Con la invalidación, la próxima lectura siempre obtiene el dato correcto de la DB.
>
> Sin embargo, la invalidación causa cache misses. Si la inconsistencia es acceptable por un corto tiempo, la actualización es más eficiente.

---

## Conceptos clave

1. **Redis es mucho más que un cache**: Soporta strings, hashes, lists, sets, sorted sets, bitmaps, HyperLogLogs, y scripts Lua. Es una base de datos en memoria versátil.

2. **La persistencia es opcional pero recomendada**: RDB para snapshots periódicos, AOF para registro de operaciones. Usar ambos es la configuración de producción típica.

3. **Redis Cluster sharding automático**: 16384 hash slots distribuidos entre nodos masters, con replicación y failover automático. Los clientes inteligentes manejan los rediriges automáticamente.

4. **El caching introduce inconsistencia**: Los datos en cache pueden estar obsoletes. La invalidación es más segura que la actualización, pero la actualización es más eficiente. Elige según tu tolerancia a la inconsistencia.

5. **Los patrones de fallo del cache son predecibles**: Cache stampede, penetration, y breakdown tienen soluciones bien establecidas (mutex, bloom filters, TTL).

## Relacionado con

- [[01-consensus-paxos-raft]] — Redis Cluster usa un protocolo de consenso para el failover de nodos
- [[02-message-queues]] — Redis pub/sub puede usarse como message queue simple, pero sin durabilidad
- [[04-event-driven-cqrs-saga]] — El cache es común en CQRS para leer el modelo de query
- [[05-idempotency-retry-circuit-breakers]] — La consistencia del cache afecta la idempotencia de las operaciones

## Referencias

- [Redis Documentation](https://redis.io/documentation)
- [Redis Cluster Specification](https://redis.io/docs/reference/cluster-spec/)
- [Designing Data-Intensive Applications — Chapter 9: Data and Locking](https://dataintensive.net/)
- [Redis Persistence Documentation](https://redis.io/docs/manual/persistence/)
- [Redis Cache Patterns](https://redis.io/docs/manual/patterns/)
