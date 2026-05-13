# 01 Consensus — Paxos, Raft y el problema de la concordia distribuida

> [!info] Contexto del módulo
> Este artículo es parte del **Módulo 03: Sistemas Distribuidos**. Se conecta con [[02-Message-Queues-RabbitMQ-Kafka]], [[03-Distributed-Caching-Redis-Clusters]], [[04-Event-Driven-Architecture-CQRS-Saga]], [[05-Idempotency-Retry-Circuit-Breakers]] y con el [[Módulo 5: Infraestructura y Contenedores]] (etcd y Kubernetes usan Raft).

## Introducción: ¿Por qué es tan difícil ponerse de acuerdo?

Imagina que tienes un equipo de cinco personas trabajando en un documento compartido. Cada una puede hacer cambios, pero si dos personas editan la misma línea al mismo tiempo, ¿quién gana? En una computadora, esto se resuelve con un lock: una persona obtiene el lock, modifica, y lo libera. Pero en un sistema distribuido, no hay un lock central — cada nodo es igual, no hay uno que mande sobre los demás.

El **problema del consenso** es el problema fundamental de los sistemas distribuidos: ¿cómo hacemos que un grupo de nodos, que pueden fallar en cualquier momento (crash, network partition, clock skew), se pongan de acuerdo en un valor?

> [!warning] La regla de oro de los sistemas distribuidos
> En un sistema distribuido, asume lo siguiente:
> - Los mensajes pueden llegar tarde, duplicarse, o perderse
> - Los nodos pueden morir en cualquier momento y recuperarse
> - Los relojes de los nodos no están sincronizados perfectamente
> - Las particiones de red (network partitions) son la norma, no la excepción
>
> Si tu sistema no funciona correctamente bajo estas suposiciones, no funciona.

### El teorema CAP

El teorema CAP (Berkeley, 2000) establece que en presencia de una partición de red (P), un sistema distribuido de lectura/escritura solo puede garantizar dos de tres propiedades:

- **Consistency (C)**: Todas las lecturas devuelven el dato más reciente escrito, o un error. Todos los nodos ven los mismos datos al mismo tiempo.
- **Availability (A)**: Cada solicitud recibe una respuesta (no necesariamente la más reciente), sin importar si algún nodo ha fallado.
- **Partition Tolerance (P)**: El sistema continúa operando a pesar de particiones de red (pérdida de mensajes entre nodos).

> [!info] CAP no es una elección binaria
> CAP no dice "elige C o A". Dice que en presencia de una partición (P es obligatorio en sistemas distribuidos), debes elegir entre C y A. En la práctica, casi todos los sistemas eligen P (porque las particiones de red ocurren) y luego eligen entre C o A dependiendo del caso de uso.

- **Sistemas CP** (consistencia + partición tolerance): Cuando hay partición, algunos nodos pueden dejar de estar disponibles para mantener la consistencia. Ejemplos: HBase, MongoDB (modo strong consistency), etcd, Consul.
- **Sistemas AP** (disponibilidad + partición tolerance): Cuando hay partición, todos los nodos siguen respondiendo pero pueden devolver datos inconsistentes. Ejemplos: Cassandra, DynamoDB, CouchDB.

> [!tip] La realidad es más matizada
> CAP es una simplificación útil pero no absoluta. Sistemas reales como Dynamo (Amazon) usan consistencia eventual con resolución basada en el cliente (conflict-free replicated data types — CRDTs). Sistemas como Cassandra permiten ajustar la consistencia por operación (quorum, ONE, ALL). La consistencia fuerte no es un interruptor on/off — es un espectro.

---

## 1. El modelo de fallo

Antes de entender Paxos y Raft, necesitas entender qué tipo de fallos estamos diseñando para tolerar.

### 1.1 Modelo de crash-stop

El fallo más simple: un nodo se "cayó" y no responde. Nunca vuelve. Este es el modelo más fácil de manejar.

### 1.2 Modelo de crash-recovery

Un nodo se cae pero puede recuperarse (reiniciar, reconectar). El problema aquí es que puede perder estado no persistido en disco. Si un nodo era el leader y se reinicia, ¿sabe que era el leader? ¿Sabe qué decisiones tomó?

### 1.3 Modelo de fallos bizantinos

El peor caso: un nodo puede comportarse de forma arbitraria y maliciosa. Puede enviar mensajes contradictorios a diferentes nodos, falsificar firmas, o hacer cosas que ningún protocolo de consenso "normal" puede manejar. El protocolo PBFT (Practical Byzantine Fault Tolerance) puede tolerar hasta f nodos bizantinos en un sistema de 3f+1 nodos.

> [!warning] La mayoría de los sistemas NO toleran fallos bizantinos
> Paxos, Raft, y la mayoría de los protocolos de consenso asumen fallos crash-stop o crash-recovery. Asumen que los nodos siguen el protocolo correctamente pero pueden caerse. Si necesitas tolerancia a fallos bizantinos (blockchain, sistemas financieros de alta seguridad), necesitas PBFT o variantes.

### 1.4 Mensajes perdidos, duplicados y desordenados

En redes distribuidas:
- Un mensaje puede perderse (network drop)
- Un mensaje puede llegar duplicado (retransmission)
- Los mensajes pueden llegar desordenados (different network paths)
- Los mensajes pueden llegar tarde (network latency)

Los protocolos de consenso deben manejar todos estos casos.

---

## 2. El problema de Paxos: El consenso en condiciones adversas

Paxos fue propuesto por Leslie Lamport en 1989 (publicado en 1998). Es el primer algoritmo de consenso práctico y el más estudiado. Lamport lo llamó "Paxos" porque lo presentó como un caso de estudio basado en el sistema de gobierno de la antigua isla de Paxos.

> [!warning] Paxos es famoso por ser difícil de entender
> Lamport mismo escribió "The Part-Time Parliament" (2001) para explicar Paxos de forma más clara. Jeffrey Mogul escribió "Paxos Made Simple" (2002) para demostrar que era simple (y que Lamport no lo había explicado bien). Scott Chacon y otros han escrito múltiples explicaciones. Si Paxos te confunde, no estás solo — incluso los expertos discrepan sobre cuál es la mejor explicación.

### 2.1 Roles en Paxos

Paxos tiene tres roles, que pueden ser ejercidos por uno o más nodos:

- **Proposers**: Proponen valores para ser aceptados. Un proposer es como un "candidato" que presenta una propuesta.
- **Acceptors**: Votan sobre las propuestas. Una propuesta se "acepta" cuando la mayoría de acceptors la vota a favor. Los acceptors son los "votantes".
- **Learners**: Aprenden qué valor fue aceptado. No participan en la decisión, solo se enteran del resultado.

> [!example] Analogía del parlamento
> Imagina un parlamento donde:
> - Los proposers son políticos que proponen leyes
> - Los acceptors son parlamentarios que votan
> - Los learners son ciudadanos que quieren saber qué leyes se aprobaron
>
> Para que una ley se apruebe, necesita la mayoría de votos. Un político puede proponer múltiples leyes (múltiples proposers). Los parlamentarios pueden votar en múltiples sesiones. Los ciudadanos solo necesitan saber el resultado final.

### 2.2 Fases de Paxos (Basic Paxos)

Cada propuesta en Paxos tiene un número único (proposal number) que determina el orden. Los números de propuesta son globales y únicos — típicamente se concatenan el ID del proposer con un contador monótono.

**Fase 1: Prepare (Preparación)**

El proposer elige un número de propuesta n único y mayor que cualquier número que haya usado antes. Envía una solicitud PREPARE a todos los acceptors:

```
Proposer → Acceptors: PREPARE(n)
```

Cada acceptor responde:
- Si ya votó por un número n' < n, responde con VOTED(n', v') donde v' es el valor que votó (o null si no votó nada).
- Si ya votó por un número n' > n, rechaza la propuesta (el proposer debe intentar con un número mayor).
- Si nunca votó, o votó por n' < n, promete no votar por ningún número menor que n y responde con el valor más alto que haya votado (si lo hay).

> [!info] ¿Por qué la Fase 1?
> La Fase 1 sirve para dos cosas:
> 1. **Evitar colisiones**: Si dos proposers proponen al mismo tiempo, el que tenga el número de propuesta más alto gana. El otro ve que alguien ya ganó y se retira.
> 2. **Aprender el valor más alto**: Si un acceptor ya votó por un valor, el proposer debe respetar ese valor (no puede imponer uno nuevo). Esto garantiza la propiedad de seguridad de Paxos.

**Fase 2: Accept (Aceptación)**

Si el proposer recibe respuestas de la mayoría de acceptors en la Fase 1:
- Toma el valor v con el número de propuesta más alto de las respuestas (si todas las respuestas tienen null, el proposer elige el valor que quiere proponer).
- Envía una solicitud ACCEPT a todos los acceptors:

```
Proposer → Acceptors: ACCEPT(n, v)
```

Cada acceptor responde aceptando si no ha prometido ya votar por un número mayor:

```
Acceptor → Proposer: ACCEPTED(n)
```

Si la mayoría acepta, el valor v está "aceptado" y el proposer lo comunica a los learners.

### 2.3 Propiedades de seguridad de Paxos

Paxos garantiza dos propiedades fundamentales:

1.**Safety (Seguridad)**: Si un valor v es aceptado, entonces ningún valor diferente puede ser aceptado. Es decir, una vez que se decide algo, no se puede decidir otra cosa.

2. **Liveness (Vida)**: Si un valor es propuesto y la mayoría de acceptors están activos, eventualmente ese valor será aceptado.

> [!tip] Paxos garantiza safety, no siempre liveness
> Paxos garantiza que nunca se decide algo incorrecto (safety). Pero si hay colisiones constantes entre proposers (dos proposers proponiendo al mismo tiempo con números de propuesta que se solapan), puede haber livelock — ningún valor se decide nunca. En la práctica, esto se resuelve eligiendo un proposer "leader" que sea el único que propone.

### 2.4 Multi-Paxos: Paxos en la práctica

Basic Paxos es lento porque requiere dos rondas de comunicación por cada valor. En la práctica, se usa **Multi-Paxos**: un proposer se convierte en leader (a través de un proceso similar a Raft's leader election) y propone valores secuencialmente sin necesidad de la Fase 1 para cada uno.

```
Leader → Followers: APPEND_ENTRIES(entries)
Followers → Leader: ACK
```

Esto es exactamente lo que hace etcd y Consul: un leader propaga entradas a un log replicado, y los followers confirman. Solo se necesita la Fase 1 (prepare) cuando hay un nuevo leader o cuando se detecta una colisión.

---

## 3. Raft: Consenso entendible

Raft fue diseñado en 2013 por Diego Ongaro y John Ousterhout específicamente para ser entendible. Su paper dice: "Paxos es complicado, y nosotros queremos hacer consenso entendible."

Raft es equivalente a Paxos en términos de propiedades de seguridad y disponibilidad, pero está diseñado como tres subproblemas independientes:

1. **Leader election**: Elegir un leader
2. **Log replication**: Replicar el log del leader en los followers
3. **Safety**: Asegurar que los logs sean consistentes

> [!tip] ¿Por qué Raft es más entendible que Paxos?
> En Paxos, los roles (proposer, acceptor, learner) no corresponden a procesos físicos — un nodo puede ejercer múltiples roles y los roles se mezclan. En Raft, los roles corresponden a estados físicos del nodo (follower, candidate, leader), y cada rol tiene un comportamiento claro y separado.

### 3.1 Estados de un nodo en Raft

Cada nodo en un cluster de Raft está siempre en uno de estos tres estados:

**Follower**: El estado por defecto. Los followers solo responden a solicitudes de leader y candidatos. No inician nada por su cuenta. Si un follower no recibe mensajes de un leader durante un timeout, se convierte en candidate.

**Candidate**: Un nodo que quiere convertirse en leader. Se convierte en candidate cuando:
- Es follower y no recibe heartbeat del leader (timeout de election)
- O cuando se inicia una nueva election (por ejemplo, después de detectar que el leader se cayó)

El candidate vota por sí mismo y solicita votos a los demás nodos. Si obtiene la mayoría, se convierte en leader.

**Leader**: El único nodo que acepta entradas del cliente, las replica en el log de todos los followers, y las aplica al estado. El leader envía heartbeats periódicos para mantener su autoridad.

> [!info] Transición de estados
> ```
> Follower ──(timeout)──> Candidate ──(gana election)──> Leader
>    ^                                                    │
>    │                                                    │
>    └────────────────(nuevo leader detectado)────────────┘
> ```
>
> Un leader que pierde la conexión con la mayoría se convierte en follower (detecta que hay un leader más reciente). Un candidate que pierde la election se convierte en follower.

### 3.2 Election (Elección de Leader)

Cada nodo tiene un **election timeout** aleatorio entre 150ms y 300ms (en la implementación de referencia). Cuando un follower no recibe heartbeat durante su timeout, se convierte en candidate:

1. Incrementa su term (número de término) en 1
2. Cambia a estado candidate
3. Vota por sí mismo
4. Envía RequestVote RPC a todos los demás nodos

```
RequestVote RPC:
- term: el term del candidato
- candidateId: el ID del candidato
- lastLogIndex: el índice de su última entrada de log
- lastLogTerm: el term de su última entrada de log
```

Un voter (follower o candidate) concede su voto si:
1. El term del candidato es >= su propio term
2. No ha votado ya en este term
3. El log del candidato es tan completo como el suyo (lastLogTerm >= su lastLogTerm, y si los terms son iguales, lastLogIndex >= su lastLogIndex)

> [!info] ¿Por qué la condición del log?
> La condición del log garantiza que un nodo con un log más completo tenga más probabilidades de ser leader. Esto reduce la probabilidad de que un leader con un log incompleto sobrescriba entradas válidas en otros nodos.

Si el candidate recibe votos de la mayoría, se convierte en leader. Si recibe votos de un term mayor, se convierte en follower. Si hay un split vote (ningún candidato obtiene mayoría), se inicia una nueva election con un nuevo timeout aleatorio.

> [!warning] Split votes
> Si hay 5 nodos y 3 candidatos, cada uno podría obtener 1 voto y ninguno tendría mayoría (necesita 3). Esto causa una nueva election. Los timeouts aleatorios reducen la probabilidad de splits, pero no la eliminan. En clusters grandes, los splits son raros.

### 3.3 Log Replication (Replicación del Log)

Una vez que hay un leader, el flujo de replicación es:

1. **El cliente envía una entrada al leader**: El cliente envía una operación (ej: SET key=value) al leader.

2. **El leader añade la entrada a su log**: El leader añade la entrada al final de su log con el siguiente índice disponible. La entrada incluye el término en que fue propuesta.

3. **El leader envía AppendEntries RPC a todos los followers**:

```
AppendEntries RPC:
- term: el term del leader
- leaderId: el ID del leader
- prevLogIndex: el índice de la entrada anterior al nuevo par
- prevLogTerm: el term de la entrada anterior
- entries[]: las entradas nuevas a replicar (vacío para heartbeats)
- leaderCommit: el índice que el leader ha confirmado como committed
```

4. **Los followers responden**: Si el follower encuentra la entrada prevLogIndex con el term correcto, acepta las nuevas entradas, las añade a su log, y responde con success. Si no encuentra la entrada prevLogIndex o el term no coincide, responde con failure.

5. **El leader espera la mayoría**: Cuando la mayoría de followers han replicado la entrada exitosamente, el leader la marca como "committed" y la aplica al estado.

6. **El leader comunica el resultado al cliente**: El leader responde al cliente con el resultado de la operación.

> [!info] ¿Por qué prevLogIndex y prevLogTerm?
> Esto es el mecanismo de "linking" del log. Cada entrada apunta a la anterior, creando una cadena inmutable. Si un follower tiene un log diferente (por ejemplo, porque un leader anterior escribió entradas que luego fueron sobrescritas), el leader verifica que el follower tenga la entrada previa con el term correcto. Si no, el follower borra las entradas conflictivas y recibe las del leader.

### 3.4 Consistency Check en Elections

Una propiedad crítica de Raft es el **Leader Completeness Property**:

> Si un valor en un término t está committed, entonces todas las entradas en términos anteriores también están en el log de ese leader.

Esto se garantiza porque:
- Para ser elegido, un candidato debe tener un log tan completo como al menos la mitad de los nodos
- Si una entrada está committed en un término anterior, al menos un nodo la tiene (porque se necesita mayoría para commit)
- Por lo tanto, cualquier candidato tendrá esa entrada en su log

> [!example] ¿Qué pasa si esto no se garantiza?
> Imagina que el leader L1 propone el valor V1 en término 1. L1 replica V1 en 2 de 5 nodos y luego se cae. V1 NO está committed (no llegó a mayoría). Un nuevo leader L2 es elegido en término 2. Si L2 no sabe de V1, podría proponer V2. Luego L1 revive, gana una election en término 3, y sobrescribe V2 con V1. El sistema decidió V1 y luego V2 — violando la seguridad.
>
> Raft previene esto: L2 no podría haber sido elegido si no tenía al menos un nodo con V1, porque ese nodo habría votado en contra de L2 (su log sería más completo).

### 3.5 Compaction del Log: Snapshotting

El log crece indefinidamente. Para evitar que consuma todo el disco, Raft usa **snapshots**:

1. El leader (o cualquier nodo) periódicamente crea una snapshot del estado actual (ej: el estado completo de la base de datos).
2. Envía la snapshot a los followers junto con el índice de la última entrada incluida en la snapshot.
3. Los followers reemplazan su log con la snapshot y descartan todas las entradas anteriores.

```
InstallSnapshot RPC:
- term: el term del leader
- leaderId: el ID del leader
- lastIncludedIndex: índice de la última entrada en la snapshot
- lastIncludedTerm: term de la última entrada en la snapshot
- data: los datos de la snapshot (serializados)
- offset: offset en el flujo de datos (para snapshots grandes)
- done: true si es el último chunk
```

---

## 4. Comparación: Paxos vs Raft

| Característica | Paxos | Raft |
|---------------|-------|------|
| **Comprensibilidad** | Difícil (varias interpretaciones) | Diseñado para ser entendible |
| **Roles** | Proposer, Acceptor, Learner (lógicos) | Leader, Follower, Candidate (físicos) |
| **Election** | Implícita (proponers compiten) | Explícita (RequestVote RPC) |
| **Log replication** | Multi-Paxos (leader optimiza) | AppendEntries (leader propaga) |
| **Implementaciones** | ZooKeeper (ZAB), Spanner | etcd, Consul, TiKV, MongoDB |
| **Fault tolerance** | Crash-stop, crash-recovery | Crash-recovery |
| **Terminología** | Propuestas, votos, aceptación | Logs, terms, heartbeats, snapshots |

> [!tip] No elijas entre Paxos y Raft
> Son equivalentes en teoría. La elección depende de la implementación:
> - **etcd** usa Raft (elegible, bien entendido, fácil de depurar)
> - **ZooKeeper** usa ZAB (una variante de Paxos, más simple que Paxos completo)
> - **Spanner** usa Paxos (Two-Phase Paxos con TrueTime)
> - **Consul** usa Raft
> - **TiKV** usa Raft
>
> Si estás diseñando un sistema nuevo, Raft es generalmente la mejor elección por su claridad.

---

## 5. Aplicaciones prácticas de Raft

### 5.1 etcd

etcd es un key-value store distribuido que usa Raft para replicar su estado. Es la base de datos de estado de Kubernetes:

- Todos los objetos de Kubernetes (pods, services, deployments) se almacenan en etcd
- Cuando un pod se crea, el API server escribe en etcd
- etcd replica la escritura a la mayoría de nodos
- Solo cuando la mayoría confirma, el API server responde "OK" al cliente
- Los controllers de Kubernetes leen de etcd y reaccionan a cambios

> [!info] ¿Por qué etcd en Kubernetes?
> etcd proporciona un estado consistente y durable para todo el clúster. Si el API server se cae, se puede reiniciar y leer el estado de etcd. Si un nodo se cae, los pods se recrean en otros nodos basándose en el estado en etcd. etcd es la fuente de verdad única.

### 5.2 Consul

Consul usa Raft para:
- Service discovery: registrar y descubrir servicios
- Health checking: verificar si los servicios están saludables
- Key-value store: configuración distribuida
- Multi-datacenter: replicación entre datacenters

### 5.3 MongoDB

MongoDB replica sets usan un protocolo similar a Raft:
- Un primary node acepta writes
- Secondary nodes replican el oplog (operation log)
- Si el primary se cae, los secondaries eligen uno nuevo
- La consistencia se puede ajustar (strong, eventual, causal)

### 5.4 TiKV

TiKV es una base de datos distribuida compatible con MySQL que usa Raft en cada región (shard). Cada región tiene su propio leader de Raft que replica los datos a los peers.

---

## 6. El problema de FLP: Imposibilidad de consenso en sistemas asíncronos

Antes de terminar, es esencial entender por qué el consenso es tan difícil en teoría.

El teorema FLP (Fischer, Lynch, Patterson, 1985) demuestra que **es imposible** diseñar un algoritmo de consenso determinista que garantice both safety y liveness en un sistema asíncrono con incluso un solo fallo de crash.

> [!warning] ¿Qué significa esto?
> En un sistema asíncrono (donde no hay límites en el tiempo de entrega de mensajes), no existe un algoritmo determinista que pueda:
> 1. Siempre llegar a un consenso (liveness)
> 2. Nunca decidir un valor incorrecto (safety)
> 3. Tolerar al menos un fallo de crash
>
> Esto significa que TODOS los algoritmos de consenso prácticos deben romper una de estas suposiciones:
> - **Raft y Paxos**: Asumen timeouts (no son puramente asíncronos — asumen que si no recibes respuesta en X tiempo, el nodo se cayó)
> - **PBFT**: Asume sincronismo de relojes
> - **Randomized consensus**: Usa aleatoriedad para evitar el livelock

> [!tip] Raft rompe la asincronía con timeouts
> Raft asume que si un follower no recibe heartbeat en un timeout aleatorio, el leader se cayó. Esta suposición (que los mensajes tardan como máximo T milisegundos) rompe la asincronía pura y permite que Raft alcance liveness.

---

## 7. Conceptos clave

1. **El consenso distribuido es difícil** porque los nodos pueden fallar, los mensajes pueden perderse, y los relojes no están sincronizados. CAP nos recuerda que en presencia de particiones, debemos elegir entre consistencia y disponibilidad.

2. **Paxos es el primer algoritmo de consenso práctico** pero es notoriamente difícil de entender e implementar correctamente. Multi-Paxos optimiza el caso común (un leader estable) para rendimiento.

3. **Raft es equivalente a Paxos pero diseñado para ser entendible**. Separa el consenso en tres subproblemas: election, log replication, y safety. Es la base de etcd, Consul, TiKV, y MongoDB.

4. **La election de leader es crítica**: Sin un leader, múltiples nodos podrían proponer valores conflictivos. Raft usa timeouts aleatorios y verificación de log completeness para elegir el leader más adecuado.

5. **FLP demuestra que el consenso es inherentemente difícil**: No existe un algoritmo perfecto. Todos los algoritmos prácticos hacen suposiciones (timeouts, sincronismo, aleatoriedad) para evitar la imposibilidad teórica.

---

## Relacionado con

- [[02-Message-Queues-RabbitMQ-Kafka]] — Las message queues usan consenso interno para replicar mensajes entre brokers
- [[03-Distributed-Caching-Redis-Clusters]] — Redis Cluster usa un protocolo de consenso similar a Gossip para la consistencia
- [[04-Event-Driven-Architecture-CQRS-Saga]] — Los eventos distribuidos necesitan consenso para garantizar que todos los servicios vean los mismos eventos
- [[05-Idempotency-Retry-Circuit-Breakers]] — La idempotencia es complementaria al consenso: si el consenso falla, la idempotencia previene efectos secundarios

## Referencias

- [Paxos Made Simple — Lamport (2001)](https://lamport.azurewebsites.net/pubs/paxos-simple.pdf)
- [In Search of an Understandable Consensus Algorithm — Raft (Ongaro & Ousterhout, 2014)](https://raft.github.io/raft.pdf)
- [The Part-Time Parliament — Lamport (2001)](https://lamport.azurewebsites.net/pubs/lamport-paxos.pdf)
- [Consensus in the Raft Age — Ongaro (2018)](https://raft.github.io/raft.pdf)
- [FLP Impossibility — Fischer, Lynch, Patterson (1985)](https://www.microsoft.com/en-us/research/publication/impossibility-of-distributed-consensus-with-one-faulty-process/)
- [etcd Documentation — Raft Consensus](https://etcd.io/docs/v3.5/learning/consensus/)
- [The Raft Distributed System — raft.github.io](https://raft.github.io/)
