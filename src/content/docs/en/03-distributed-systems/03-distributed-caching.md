---
title: "Distributed caching: Redis, clusters, and consistency"
description: "How distributed caching works: Redis (data types, RDB/AOF persistence, pub/sub), Redis Cluster (sharding, hash slots, failover), and caching consistency patterns."
---

# Distributed caching: Redis, clusters, and consistency

> [!tip] Caching in one sentence
> **Distributed caching** is a technique that stores frequently accessed data in memory across multiple servers, reducing access latency and load on central databases.

## Why do we need distributed caching?

Databases are slow compared to memory. A PostgreSQL query can take 5-50ms. A Redis in-memory read takes 0.1-0.5ms. If you have a million users making the same query, that is a million database queries.

> [!example] Library analogy
> Imagine a huge library:
> - **Database**: Books on shelves in the basement (very slow, but everything is there).
> - **Local cache**: A book you carry in your backpack (very fast, but you can only carry one).
> - **Distributed cache**: A bookshelf in the reading room with the most popular books (fast, shared by everyone, but limited in space).
>
> Redis is that bookshelf in the reading room.

---

## 1. Redis: The in-memory data structure server

Redis (Remote Dictionary Server) is an open-source in-memory data store that supports diverse data structures. It is not just a cache — it is a versatile database used as cache, message broker, and more.

### 1.1 Redis data types

Unlike a simple key-value cache (like Memcached), Redis supports complex data structures:

**Strings**: The most basic type. A binary-safe value of up to 512MB.

```redis
SET user:1000:name "Emilio"
GET user:1000:name
# -> "Emilio"

INCR view_count:article:42
# -> 1234
```

**Hashes**: A map of fields and values. Ideal for storing objects.

```redis
HSET user:1000 name "Emilio" email "emilio@example.com" age 30
HGETALL user:1000
# -> name: Emilio, email: emilio@example.com, age: 30
```

**Lists**: Ordered lists of strings. Allow push/pop from both ends.

```redis
LPUSH notifications:user:1000 "new-order" "new-message"
LRANGE notifications:user:1000 0 -1
# -> ["new-order", "new-message"]
```

**Sets**: Unordered collections of unique strings.

```redis
SADD tags:article:42 "ai" "machine-learning" "nlp"
SMEMBERS tags:article:42
# -> {"ai", "machine-learning", "nlp"}

SINTER tags:article:42 tags:article:99
# -> Articles in both sets
```

**Sorted Sets**: Sets where each member has a score. Useful for ranking, leaderboards, and time-series.

```redis
ZADD leaderboard 1500 "player1" 2300 "player2" 980 "player3"
ZRANGE leaderboard 0 -1 WITHSCORES
# -> player3 (980), player1 (1500), player2 (2300)
```

**Bitmaps**: Individual bits representing boolean values.

```redis
SETBIT user:1000:login:2024-01-01 1
SETBIT user:1000:login:2024-01-02 1
SETBIT user:1000:login:2024-01-03 0
# -> User 1000: logged in on day 1 and 2, not on day 3
```

**HyperLogLogs**: Structure for approximate unique element counting (cardinality).

```redis
PFADD visitors "user1" "user2" "user3" "user1" "user4"
PFCOUNT visitors
# -> 4 (approximate, with 0.81% standard error)
```

### 1.2 Persistence: RDB vs AOF

Redis is in-memory, but it needs to persist data to disk to avoid losing it on restart. It offers two modes:

**RDB (Snapshotting)**: Takes periodic snapshots of the dataset into a compact binary file.

```redis
# Configuration
save 900 1      # Snapshot every 15 min if at least 1 change
save 300 10     # Snapshot every 5 min if at least 10 changes
save 60 10000   # Snapshot every 1 min if at least 10000 changes
```

- **Advantages**: Compact file, fast to restore, ideal for backups.
- **Disadvantages**: You may lose data between snapshots.

**AOF (Append Only File)**: Records each write operation in a log.

```redis
# Configuration
appendonly yes
appendfsync everysec  # Sync to disk every second
# Options: always (safe but slow), everysec (balanced), no (OS-dependent)
```

- **Advantages**: Less data loss (only the last second).
- **Disadvantages**: Larger file, slower restoration.

> [!tip] Use RDB, AOF, or both?
> The recommended configuration for production is to use both:
> - **AOF** for durability (lose only ~1 second of data)
> - **RDB** for backups and fast recovery
>
> Redis combines both on startup: loads the last RDB and replays the AOF.

### 1.3 Redis Pub/Sub

Redis includes a lightweight pub/sub system:

```redis
# Subscriber
SUBSCRIBE channel:notifications

# Publisher
PUBLISH channel:notifications "new-message"
```

> [!warning] Redis pub/sub is not durable
> Messages are lost if there are no active subscribers. Redis pub/sub is for real-time messaging, not for durable message queues. For durable queues, use Redis Lists with BLPOP/BRPOP or better yet, RabbitMQ/Kafka.

### 1.4 Lua Scripts

Redis supports atomic execution of Lua scripts:

```lua
-- Script: Increment counter only if it exists
if redis.call('EXISTS', KEYS[1]) == 1 then
    return redis.call('INCR', KEYS[1])
else
    return -1
end
```

Lua scripts execute atomically — no other command runs while the script executes. This is useful for complex operations that need atomicity without using MULTI/EXEC (transactions).

---

## 2. Redis Cluster: Automatic sharding

Redis Cluster is Redis's solution for scaling beyond a single server. It divides the key space into 16384 hash slots and distributes them across multiple nodes.

### 2.1 How sharding works

Each node in the cluster is responsible for a subset of the 16384 hash slots:

```
Node A: Hash slots 0-5460
Node B: Hash slots 5461-10922
Node C: Hash slots 10923-16383
```

When a client wants to access a key:
1. Calculates the hash slot of the key: `CRC16(key) % 16384`
2. If the slot is on the node it connected to, returns the data.
3. If the slot is on another node, responds with a MOVED redirect:

```
> GET user:1000:name
MOVED 5461 192.168.1.2:6380
# Client redirects to 192.168.1.2:6380
> GET user:1000:name
"Emilio"
```

> [!tip] Smart clients
> Modern Redis clients (jedis, redis-py, redis-clustering) handle redirects automatically. They maintain a cache of the hash slot → node mapping, so most queries go directly to the correct node.

### 2.2 Replication and failover

Each master node can have one or more replica nodes:

```
Node A (master) → Replica A1
Node B (master) → Replica B1
Node C (master) → Replica C1
```

If a master crashes:
1. Replicas detect the crash (failure detection by timeout).
2. A replica auto-promotes to master (elective failover).
3. The new master reassigns the crashed master's hash slots.
4. The cluster reconfigures and notifies clients.

```
Before failover:
Node A (master) → Replica A1

After failover:
Node A (crashed) ✗
Replica A1 (promoted to master) → Replica A2 (new replica)
```

> [!info] Why 16384 hash slots?
> 16384 is an arbitrary but reasonable number. It is large enough to scale (thousands of nodes) but small enough that each node can maintain a hash slot table in memory without issues.

### 2.3 Gossip protocol

Redis Cluster uses a Gossip protocol for communication between nodes:

- Each node periodically sends Gossip messages to random nodes.
- Messages contain information about cluster state (nodes, slots, failures).
- This enables rapid information propagation without a central node.

> [!example] Gossip analogy
> Imagine an office where:
> - Each day, each person talks to 2-3 random colleagues.
> - They share what they know about who is sick, who was late, etc.
> - Within a few days, EVERYONE knows everything.
>
> That is Gossip: information that spreads person to person, in a decentralized way.

---

## 3. Caching patterns

### 3.1 Cache-Aside (Lazy Loading)

The most common pattern. The application manages the cache:

```python
def get_user(user_id):
    # 1. Try cache
    user = redis.get(f"user:{user_id}")
    if user:
        return deserialize(user)
    
    # 2. If not in cache, query DB
    user = db.query("SELECT * FROM users WHERE id = ?", user_id)
    if user:
        # 3. Save to cache
        redis.setex(f"user:{user_id}", 3600, serialize(user))
    
    return user
```

- **Advantages**: Simple, cache only stores needed data.
- **Disadvantages**: Cache miss initial request requires DB query.

### 3.2 Read-Through / Write-Through

The cache manages read/write logic automatically (usually with a wrapper).

```python
# Read-through
user = cache.get(f"user:{user_id}")  # Cache queries DB if it does not have it

# Write-through
cache.set(f"user:{user_id}", user_data)  # Cache writes to DB automatically
```

### 3.3 Write-Behind (Write-Back)

Write goes to cache first, and the cache writes to DB asynchronously.

```python
# Written to cache immediately
cache.set(f"user:{user_id}", user_data)

# Written to DB asynchronously by the cache
# (seconds or minutes later)
```

- **Advantages**: Very fast writes.
- **Disadvantages**: If cache crashes before writing to DB, data is lost.

### 3.4 TTL (Time-To-Live) and eviction

All values in Redis can have a TTL:

```redis
SET user:1000:name "Emilio" EX 3600
# Expires in 1 hour

# Or after last access:
SET user:1000:name "Emilio" PX 3600000
# Expires in 3600000 milliseconds
```

Eviction policies when memory is full:
- **noeviction**: Returns error when memory is full.
- **allkeys-lru**: Evict the least recently used key.
- **allkeys-lfu**: Evict the least frequently used key.
- **volatile-lru**: Only evict keys with TTL, least recently used.
- **volatile-lfu**: Only evict keys with TTL, least frequently used.
- **volatile-ttl**: Evict the key with the shortest TTL.

> [!tip] Always configure a TTL
> Without TTL, keys never expire. If you do not manage them manually, the cache will fill up and start evicting keys (or fail if you use noeviction). Always set a reasonable TTL.

---

## 4. Common caching problems

### 4.1 Cache Stampede (Thundering Herd)

When a high-TTL key expires, thousands of requests hit the database simultaneously.

```
Time 0:    TTL expires for key "popular-article"
Time 0.1s: 1000 requests arrive at once
Time 0.2s:  1000 queries to the DB (!!!)
```

**Solution**: Distributed lock or "guard dog" pattern:

```python
def get_article(article_id):
    data = redis.get(f"article:{article_id}")
    if data:
        return data
    
    # Try to get the lock
    lock = redis.set(f"lock:article:{article_id}", "1", nx=True, ex=10)
    if lock:
        # I am the only one regenerating
        data = db.get_article(article_id)
        redis.setex(f"article:{article_id}", 3600, data)
        return data
    else:
        # Someone else is regenerating, wait and retry
        time.sleep(0.1)
        return get_article(article_id)  # Recursive retry
```

### 4.2 Cache Penetration

Requests for data that does not exist in the DB, filling the cache with null entries.

```python
# Malicious user requests non-existent users
for i in range(1000000):
    get_user(i * 7)  # Never exist
```

**Solution**: Cache null results with a short TTL, or use a Bloom Filter.

### 4.3 Cache Breakdown

Similar to cache stampede but for a single popular key that expires.

**Solution**: Distributed mutex (same as stampede).

---

## 5. Consistency in distributed caching

Cache is inherently inconsistent with the database. Data in cache may be stale. The key question is: how much inconsistency can you tolerate?

### 5.1 Eventual consistency (the norm)

In most systems, cache has eventual consistency: eventually data in cache will be consistent, but not immediately.

```
Time 0:    DB: user.email = "old@example.com"
Time 0:    Cache: user.email = "old@example.com"
Time 1:    User updates email → DB: user.email = "new@example.com"
Time 1.1:  Cache NOT updated yet (stale)
Time 3600: TTL expires, cache regenerates with new data
```

### 5.2 Invalidation vs Update

**Invalidation** (recommended): Remove the cache key when updated in DB. The next read regenerates the cache.

```python
def update_user(user_id, data):
    db.update_user(user_id, data)
    redis.delete(f"user:{user_id}")  # Invalidate cache
```

**Update**: Update both DB and cache.

```python
def update_user(user_id, data):
    db.update_user(user_id, data)
    redis.set(f"user:{user_id}", serialize(data))  # Update cache
```

> [!warning] Invalidation or update?
> Invalidation is safer because it avoids race conditions. With update, if the DB write fails but the cache write succeeds, you will have inconsistent data. With invalidation, the next read always gets the correct data from the DB.
>
> However, invalidation causes cache misses. If inconsistency is acceptable for a short time, update is more efficient.

---

## Key concepts

1. **Redis is much more than a cache**: It supports strings, hashes, lists, sets, sorted sets, bitmaps, HyperLogLogs, and Lua scripts. It is a versatile in-memory database.

2. **Persistence is optional but recommended**: RDB for periodic snapshots, AOF for operation logging. Using both is the typical production configuration.

3. **Redis Cluster automatic sharding**: 16384 hash slots distributed among master nodes, with replication and automatic failover. Smart clients handle redirects automatically.

4. **Caching introduces inconsistency**: Data in cache may be stale. Invalidation is safer than update, but update is more efficient. Choose based on your inconsistency tolerance.

5. **Cache failure patterns are predictable**: Cache stampede, penetration, and breakdown have well-established solutions (mutex, bloom filters, TTL).

## Related to

- [[01-consensus-paxos-raft]] — Redis Cluster uses a consensus protocol for node failover
- [[02-message-queues]] — Redis pub/sub can be used as a simple message queue, but without durability
- [[04-event-driven-cqrs-saga]] — Cache is common in CQRS for reading the query model
- [[05-idempotency-retry-circuit-breakers]] — Cache consistency affects the idempotency of operations

## References

- [Redis Documentation](https://redis.io/documentation)
- [Redis Cluster Specification](https://redis.io/docs/reference/cluster-spec/)
- [Designing Data-Intensive Applications — Chapter 9: Data and Locking](https://dataintensive.net/)
- [Redis Persistence Documentation](https://redis.io/docs/manual/persistence/)
- [Redis Cache Patterns](https://redis.io/docs/manual/patterns/)
