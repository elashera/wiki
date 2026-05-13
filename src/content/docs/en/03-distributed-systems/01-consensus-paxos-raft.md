---
title: "Consensus in distributed systems: Paxos, Raft, and the agreement problem"
description: "How distributed systems agree: Paxos, Raft, the CAP theorem, and the FLP theorem. Explained from scratch with diagrams and practical examples."
---

# Consensus in distributed systems: Paxos, Raft, and the agreement problem

> [!tip] Consensus in one sentence
> **Distributed consensus** is the problem of making multiple nodes, which can fail at any time, agree on a single consistent value — without a central server commanding all of them.

## Why is it so hard to agree?

Imagine you have a team of five people working on a shared document. Each can make changes, but if two people edit the same line at the same time, who wins? On a single computer, this is solved with a lock: one person gets the lock, modifies, and releases it. But in a distributed system, there is no central lock — every node is equal, there is no one who commands the others.

The **consensus problem** is the fundamental problem of distributed systems: how do we make a group of nodes, which can fail at any time (crash, network partition, clock skew), agree on a value?

> [!warning] The golden rule of distributed systems
> In a distributed system, assume the following:
> - Messages can arrive late, be duplicated, or be lost
> - Nodes can die at any time and recover
> - Node clocks are not perfectly synchronized
> - Network partitions are the norm, not the exception
>
> If your system does not work correctly under these assumptions, it does not work.

### The CAP theorem

The CAP theorem (Berkeley, 2000) states that in the presence of a network partition (P), a distributed read/write system can only guarantee two of three properties:

- **Consistency (C)**: All reads return the most recent write, or an error. All nodes see the same data at the same time.
- **Availability (A)**: Every request receives a response (not necessarily the most recent), regardless of whether any node has failed.
- **Partition Tolerance (P)**: The system continues to operate despite network partitions (loss of messages between nodes).

> [!info] CAP is not a binary choice
> CAP does not say "choose C or A." It says that in the presence of a partition (P is mandatory in distributed systems), you must choose between C and A. In practice, almost all systems choose P (because network partitions happen) and then choose between C or A depending on the use case.

- **CP systems** (consistency + partition tolerance): When there is a partition, some nodes may become unavailable to maintain consistency. Examples: HBase, MongoDB (strong consistency mode), etcd, Consul.
- **AP systems** (availability + partition tolerance): When there is a partition, all nodes continue to respond but may return inconsistent data. Examples: Cassandra, DynamoDB, CouchDB.

> [!tip] Reality is more nuanced
> CAP is a useful simplification but not absolute. Real systems like Dynamo (Amazon) use eventual consistency with client-side resolution (conflict-free replicated data types — CRDTs). Systems like Cassandra allow adjusting consistency per operation (quorum, ONE, ALL). Strong consistency is not an on/off switch — it is a spectrum.

---

## 1. The failure model

Before understanding Paxos and Raft, you need to understand what types of failures we are designing to tolerate.

### 1.1 Crash-stop model

The simplest failure: a node "crashed" and does not respond. It never comes back. This is the easiest model to handle.

### 1.2 Crash-recovery model

A node crashes but can recover (restart, reconnect). The problem here is that it may lose state not persisted to disk. If a node was the leader and restarts, does it know it was the leader? Does it know what decisions it made?

### 1.3 Byzantine failure model

The worst case: a node can behave arbitrarily and maliciously. It can send contradictory messages to different nodes, forge signatures, or do things that no "normal" consensus protocol can handle. The PBFT (Practical Byzantine Fault Tolerance) protocol can tolerate up to f Byzantine nodes in a system of 3f+1 nodes.

> [!warning] Most systems do NOT tolerate Byzantine failures
> Paxos, Raft, and most consensus protocols assume crash-stop or crash-recovery failures. They assume nodes follow the protocol correctly but can crash. If you need Byzantine fault tolerance (blockchain, high-security financial systems), you need PBFT or variants.

### 1.4 Lost, duplicated, and out-of-order messages

In distributed networks:
- A message can be lost (network drop)
- A message can arrive duplicated (retransmission)
- Messages can arrive out of order (different network paths)
- Messages can arrive late (network latency)

Consensus protocols must handle all these cases.

---

## 2. Paxos: Consensus under adverse conditions

Paxos was proposed by Leslie Lamport in 1989 (published in 1998). It is the first practical consensus algorithm and the most studied. Lamport called it "Paxos" because he presented it as a case study based on the government system of the ancient island of Paxos.

> [!warning] Paxos is famous for being hard to understand
> Lamport himself wrote "The Part-Time Parliament" (2001) to explain Paxos more clearly. Jeffrey Mogul wrote "Paxos Made Simple" (2002) to demonstrate that it was simple (and that Lamport had not explained it well). Scott Chacon and others have written multiple explanations. If Paxos confuses you, you are not alone — even experts disagree on which is the best explanation.

### 2.1 Roles in Paxos

Paxos has three roles, which can be exercised by one or more nodes:

- **Proposers**: Propose values to be accepted. A proposer is like a "candidate" presenting a proposal.
- **Acceptors**: Vote on proposals. A proposal is "accepted" when the majority of acceptors vote for it. Acceptors are the "voters."
- **Learners**: Learn which value was accepted. They do not participate in the decision, only find out the result.

> [!example] Parliament analogy
> Imagine a parliament where:
> - Proposers are politicians proposing laws
> - Acceptors are parliamentarians voting
> - Learners are citizens wanting to know which laws were passed
>
> For a law to pass, it needs a majority of votes. A politician can propose multiple laws (multiple proposers). Parliamentarians can vote in multiple sessions. Citizens only need to know the final result.

### 2.2 Paxos Phases (Basic Paxos)

Each proposal in Paxos has a unique number (proposal number) that determines the order. Proposal numbers are global and unique — typically the proposer ID is concatenated with a monotonic counter.

**Phase 1: Prepare (Preparation)**

The proposer chooses a unique proposal number n greater than any number it has used before. It sends a PREPARE request to all acceptors:

```
Proposer → Acceptors: PREPARE(n)
```

Each acceptor responds:
- If it already voted for a number n' < n, it responds with VOTED(n', v') where v' is the value it voted for (or null if it did not vote for anything).
- If it already voted for a number n' > n, it rejects the proposal (the proposer must try with a higher number).
- If it never voted, or voted for n' < n, it promises not to vote for any number less than n and responds with the highest value it has voted for (if any).

> [!info] Why Phase 1?
> Phase 1 serves two purposes:
> 1. **Avoid collisions**: If two proposers propose at the same time, the one with the higher proposal number wins. The other sees that someone already won and withdraws.
> 2. **Learn the highest value**: If an acceptor already voted for a value, the proposer must respect that value (it cannot impose a new one). This guarantees Paxos's safety property.

**Phase 2: Accept (Acceptance)**

If the proposer receives responses from the majority of acceptors in Phase 1:
- It takes the value v with the highest proposal number from the responses (if all responses are null, the proposer chooses the value it wants to propose).
- It sends an ACCEPT request to all acceptors:

```
Proposer → Acceptors: ACCEPT(n, v)
```

Each acceptor responds accepting if it has not already promised to vote for a higher number:

```
Acceptor → Proposer: ACCEPTED(n)
```

If the majority accepts, value v is "accepted" and the proposer communicates it to the learners.

### 2.3 Safety Properties of Paxos

Paxos guarantees two fundamental properties:

1.**Safety (Safety)**: If a value v is accepted, then no different value can be accepted. That is, once something is decided, nothing else can be decided.

2. **Liveness (Liveness)**: If a value is proposed and the majority of acceptors are active, eventually that value will be accepted.

> [!tip] Paxos guarantees safety, not always liveness
> Paxos guarantees that nothing incorrect is ever decided (safety). But if there are constant collisions between proposers (two proposers proposing at the same time with overlapping proposal numbers), there can be livelock — no value is ever decided. In practice, this is resolved by choosing a "leader" proposer that is the only one proposing.

### 2.4 Multi-Paxos: Paxos in practice

Basic Paxos is slow because it requires two rounds of communication per value. In practice, **Multi-Paxos** is used: a proposer becomes a leader (through a process similar to Raft's leader election) and proposes values sequentially without needing Phase 1 for each one.

```
Leader → Followers: APPEND_ENTRIES(entries)
Followers → Leader: ACK
```

This is exactly what etcd and Consul do: a leader propagates entries to a replicated log, and followers confirm. Phase 1 (prepare) is only needed when there is a new leader or when a collision is detected.

---

## 3. Raft: Understandable consensus

Raft was designed in 2013 by Diego Ongaro and John Ousterhout specifically to be understandable. Their paper says: "Paxos is complicated, and we want to make consensus understandable."

Raft is equivalent to Paxos in terms of safety and availability properties, but it is designed as three independent subproblems:

1. **Leader election**: Choosing a leader
2. **Log replication**: Replicating the leader's log to followers
3. **Safety**: Ensuring logs are consistent

> [!tip] Why is Raft more understandable than Paxos?
> In Paxos, roles (proposer, acceptor, learner) do not correspond to physical processes — a node can exercise multiple roles and roles are mixed. In Raft, roles correspond to physical states of the node (follower, candidate, leader), and each role has a clear, separate behavior.

### 3.1 Node States in Raft

Each node in a Raft cluster is always in one of these three states:

**Follower**: The default state. Followers only respond to leader and candidate requests. They do not initiate anything on their own. If a follower does not receive messages from a leader for a timeout, it becomes a candidate.

**Candidate**: A node that wants to become a leader. It becomes a candidate when:
- It is a follower and does not receive a leader heartbeat (election timeout)
- Or when a new election is started (e.g., after detecting the leader crashed)

The candidate votes for itself and requests votes from other nodes. If it gets a majority, it becomes a leader.

**Leader**: The only node that accepts client entries, replicates them to all followers' logs, and applies them to state. The leader sends periodic heartbeats to maintain its authority.

> [!info] State transitions
> ```
> Follower ──(timeout)──> Candidate ──(wins election)──> Leader
>    ^                                                    │
>    │                                                    │
>    └──────────────(new leader detected)─────────────────┘
> ```
>
> A leader that loses connection with the majority becomes a follower (detects a more recent leader). A candidate that loses the election becomes a follower.

### 3.2 Election (Leader Election)

Each node has an **election timeout** between 150ms and 300ms (in the reference implementation). When a follower does not receive a heartbeat during its timeout, it becomes a candidate:

1. Increments its term by 1
2. Changes to candidate state
3. Votes for itself
4. Sends RequestVote RPC to all other nodes

```
RequestVote RPC:
- term: the candidate's term
- candidateId: the candidate's ID
- lastLogIndex: the index of its last log entry
- lastLogTerm: the term of its last log entry
```

A voter (follower or candidate) grants its vote if:
1. The candidate's term is >= its own term
2. It has not already voted in this term
3. The candidate's log is at least as up-to-date as its own (lastLogTerm >= its lastLogTerm, and if terms are equal, lastLogIndex >= its lastLogIndex)

> [!info] Why the log condition?
> The log condition ensures that a node with a more complete log has a higher chance of becoming leader. This reduces the probability that a leader with an incomplete log overwrites valid entries on other nodes.

If the candidate receives votes from the majority, it becomes a leader. If it receives votes from a higher term, it becomes a follower. If there is a split vote (no candidate gets a majority), a new election is started with a new random timeout.

> [!warning] Split votes
> If there are 5 nodes and 3 candidates, each could get 1 vote and none would have a majority (needs 3). This causes a new election. Random timeouts reduce the probability of splits, but do not eliminate them. In large clusters, splits are rare.

### 3.3 Log Replication

Once there is a leader, the replication flow is:

1. **The client sends an entry to the leader**: The client sends an operation (e.g., SET key=value) to the leader.

2. **The leader appends the entry to its log**: The leader appends the entry to the end of its log with the next available index. The entry includes the term in which it was proposed.

3. **The leader sends AppendEntries RPC to all followers**:

```
AppendEntries RPC:
- term: the leader's term
- leaderId: the leader's ID
- prevLogIndex: the index of the entry before the new pair
- prevLogTerm: the term of the previous entry
- entries[]: the new entries to replicate (empty for heartbeats)
- leaderCommit: the index the leader has confirmed as committed
```

4. **Followers respond**: If the follower finds the prevLogIndex entry with the correct term, it accepts the new entries, appends them to its log, and responds with success. If it does not find the prevLogIndex entry or the term does not match, it responds with failure.

5. **The leader waits for the majority**: When the majority of followers have successfully replicated the entry, the leader marks it as "committed" and applies it to state.

6. **The leader communicates the result to the client**: The leader responds to the client with the operation result.

> [!info] Why prevLogIndex and prevLogTerm?
> This is the log "linking" mechanism. Each entry points to the previous one, creating an immutable chain. If a follower has a different log (e.g., because a previous leader wrote entries that were later overwritten), the leader verifies that the follower has the previous entry with the correct term. If not, the follower deletes conflicting entries and receives the leader's entries.

### 3.4 Consistency Check in Elections

A critical property of Raft is the **Leader Completeness Property**:

> If a value in term t is committed, then all entries in previous terms are also in that leader's log.

This is guaranteed because:
- To be elected, a candidate must have a log at least as complete as at least half of the nodes
- If an entry is committed in a previous term, at least one node has it (because a majority is needed for commit)
- Therefore, any candidate will have that entry in its log

> [!example] What if this is not guaranteed?
> Imagine leader L1 proposes value V1 in term 1. L1 replicates V1 to 2 of 5 nodes and then crashes. V1 is NOT committed (did not reach majority). A new leader L2 is elected in term 2. If L2 does not know about V1, it could propose V2. Then L1 revives, wins an election in term 3, and overwrites V2 with V1. The system decided V1 and then V2 — violating safety.
>
> Raft prevents this: L2 could not have been elected if it did not have at least one node with V1, because that node would have voted against L2 (its log would be more complete).

### 3.5 Log Compaction: Snapshotting

The log grows indefinitely. To prevent it from consuming all disk space, Raft uses **snapshots**:

1. The leader (or any node) periodically creates a snapshot of the current state (e.g., the full database state).
2. It sends the snapshot to followers along with the index of the last entry included in the snapshot.
3. Followers replace their log with the snapshot and discard all previous entries.

```
InstallSnapshot RPC:
- term: the leader's term
- leaderId: the leader's ID
- lastIncludedIndex: index of the last entry in the snapshot
- lastIncludedTerm: term of the last entry in the snapshot
- data: the snapshot data (serialized)
- offset: offset in the data stream (for large snapshots)
- done: true if this is the last chunk
```

---

## 4. Comparison: Paxos vs Raft

| Feature | Paxos | Raft |
|---------|-------|------|
| **Understandability** | Hard (multiple interpretations) | Designed to be understandable |
| **Roles** | Proposer, Acceptor, Learner (logical) | Leader, Follower, Candidate (physical) |
| **Election** | Implicit (proposers compete) | Explicit (RequestVote RPC) |
| **Log replication** | Multi-Paxos (leader optimizes) | AppendEntries (leader propagates) |
| **Implementations** | ZooKeeper (ZAB), Spanner | etcd, Consul, TiKV, MongoDB |
| **Fault tolerance** | Crash-stop, crash-recovery | Crash-recovery |
| **Terminology** | Proposals, votes, acceptance | Logs, terms, heartbeats, snapshots |

> [!tip] Don't choose between Paxos and Raft
> They are equivalent in theory. The choice depends on the implementation:
> - **etcd** uses Raft (elegant, well-understood, easy to debug)
> - **ZooKeeper** uses ZAB (a Paxos variant, simpler than full Paxos)
> - **Spanner** uses Paxos (Two-Phase Paxos with TrueTime)
> - **Consul** uses Raft
> - **TiKV** uses Raft
>
> If you are designing a new system, Raft is generally the best choice due to its clarity.

---

## 5. Practical applications of Raft

### 5.1 etcd

etcd is a distributed key-value store that uses Raft to replicate its state. It is the state database for Kubernetes:

- All Kubernetes objects (pods, services, deployments) are stored in etcd
- When a pod is created, the API server writes to etcd
- etcd replicates the write to the majority of nodes
- Only when the majority confirms, the API server responds "OK" to the client
- Kubernetes controllers read from etcd and react to changes

> [!info] Why etcd in Kubernetes?
> etcd provides a consistent and durable state for the entire cluster. If the API server crashes, it can restart and read the state from etcd. If a node crashes, pods are recreated on other nodes based on the state in etcd. etcd is the single source of truth.

### 5.2 Consul

Consul uses Raft for:
- Service discovery: register and discover services
- Health checking: verify if services are healthy
- Key-value store: distributed configuration
- Multi-datacenter: replication between datacenters

### 5.3 MongoDB

MongoDB replica sets use a Raft-like protocol:
- A primary node accepts writes
- Secondary nodes replicate the oplog (operation log)
- If the primary crashes, secondaries elect a new one
- Consistency can be adjusted (strong, eventual, causal)

### 5.4 TiKV

TiKV is a MySQL-compatible distributed database that uses Raft on each region (shard). Each region has its own Raft leader that replicates data to peers.

---

## 6. The FLP problem: Impossibility of consensus in asynchronous systems

Before finishing, it is essential to understand why consensus is so difficult in theory.

The FLP theorem (Fischer, Lynch, Patterson, 1985) proves that it is **impossible** to design a deterministic consensus algorithm that guarantees both safety and liveness in an asynchronous system with even a single crash failure.

> [!warning] What does this mean?
> In an asynchronous system (where there are no bounds on message delivery time), there is no deterministic algorithm that can:
> 1. Always reach a consensus (liveness)
> 2. Never decide an incorrect value (safety)
> 3. Tolerate at least one crash failure
>
> This means ALL practical consensus algorithms must break one of these assumptions:
> - **Raft and Paxos**: Assume timeouts (they are not purely asynchronous — they assume if you don't receive a response in X time, the node crashed)
> - **PBFT**: Assumes clock synchronization
> - **Randomized consensus**: Uses randomness to avoid livelock

> [!tip] Raft breaks asynchrony with timeouts
> Raft assumes that if a follower does not receive a heartbeat within a random timeout, the leader has crashed. This assumption (that messages take at most T milliseconds) breaks pure asynchrony and allows Raft to achieve liveness.

---

## Key concepts

1. **Distributed consensus is difficult** because nodes can fail, messages can be lost, and clocks are not synchronized. CAP reminds us that in the presence of partitions, we must choose between consistency and availability.

2. **Paxos is the first practical consensus algorithm** but is notoriously difficult to understand and implement correctly. Multi-Paxos optimizes the common case (a stable leader) for performance.

3. **Raft is equivalent to Paxos but designed to be understandable**. It separates consensus into three subproblems: election, log replication, and safety. It is the foundation of etcd, Consul, TiKV, and MongoDB.

4. **Leader election is critical**: Without a leader, multiple nodes could propose conflicting values. Raft uses random timeouts and log completeness verification to choose the most suitable leader.

5. **FLP proves that consensus is inherently difficult**: There is no perfect algorithm. All practical algorithms make assumptions (timeouts, synchronization, randomness) to avoid the theoretical impossibility.

## Related to

- [[02-message-queues]] — Message queues use internal consensus to replicate messages between brokers
- [[03-distributed-caching]] — Redis Cluster uses a Gossip-like consensus protocol for consistency
- [[04-event-driven-cqrs-saga]] — Distributed events need consensus to ensure all services see the same events
- [[05-idempotency-retry-circuit-breakers]] — Idempotency is complementary to consensus: if consensus fails, idempotency prevents side effects

## References

- [Paxos Made Simple — Lamport (2001)](https://lamport.azurewebsites.net/pubs/paxos-simple.pdf)
- [In Search of an Understandable Consensus Algorithm — Raft (Ongaro & Ousterhout, 2014)](https://raft.github.io/raft.pdf)
- [The Part-Time Parliament — Lamport (2001)](https://lamport.azurewebsites.net/pubs/lamport-paxos.pdf)
- [FLP Impossibility — Fischer, Lynch, Patterson (1985)](https://www.microsoft.com/en-us/research/publication/impossibility-of-distributed-consensus-with-one-faulty-process/)
- [etcd Documentation — Raft Consensus](https://etcd.io/docs/v3.5/learning/consensus/)
- [The Raft Distributed System — raft.github.io](https://raft.github.io/)
