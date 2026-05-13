# 02-02 — Docker Networking: Bridge, Host, Overlay y Más

> [!info] About This Article
> This article covers Docker networking from the ground up: how Docker connects containers to each other and to the outside world, the internal Linux kernel mechanisms that make it possible (veth pairs, Linux bridges, iptables/NAT), all five built-in network modes, overlay networks for multi-host communication, DNS and service discovery, custom network plugins, and production-grade troubleshooting. It assumes zero prior knowledge of Docker networking and builds understanding progressively.

## Why Container Networking Is Different

Before diving into Docker's networking features, you need to understand why container networking is fundamentally different from traditional networking. This difference is not a minor implementation detail — it is the core challenge that makes containers both powerful and complex.

In a traditional environment, each application runs on a physical server or a virtual machine, each with its own network interface card (NIC), its own IP address assigned by the network's DHCP server, and its own position in the datacenter's network topology. Networking is simple in concept: each machine has one or more interfaces with known IP addresses, and routing tables direct traffic between them. You can `ping` any machine from any other machine, and if it doesn't work, you trace the route with `traceroute` and check the firewalls along the way.

In a container environment, **networking is virtualized at the process level**. A container does not have a physical NIC. It does not have a physically assignable IP address. Instead, it has a **virtual network namespace** — a complete, isolated network stack that lives inside a process. This namespace contains its own interfaces, routing table, ARP table, iptables rules, and port space. The container's `eth0` interface is not connected to a cable; it is a virtual endpoint connected to a virtual bridge on the host.

```
Traditional VM Networking:          Container Networking:
┌──────────────┐                    ┌──────────────────────┐
│  VM 1        │                    │  Container 1         │
│  eth0: 10.0. │  eth0: 10.0.0.10  │  eth0 (veth)         │
│  10/24       │◄────────────────►│  172.17.0.2          │
└──────────────┘                    │  NET namespace       │
┌──────────────┐                    └──────┬───────────────┘
│  VM 2        │                           │ veth pair
│  eth0: 10.0. │                           ▼
│  10/24       │                    ┌──────────────────┐
└──────────────┘                    │  docker0 bridge   │
Physical switch/Ethernet            │  172.17.0.1/16   │
                                    └────────┬─────────┘
                                             │
                                     Host's network stack
```

> [!warning] The Core Mental Model Shift
> In traditional networking, you think in terms of machines and their IP addresses. In Docker networking, you think in terms of **network namespaces** and **virtual interfaces**. The container's network stack is completely independent from the host's — it has its own routing table, its own iptables rules, its own DNS configuration. The container doesn't "get an IP address" from your network's DHCP server. Instead, Docker's daemon assigns it an IP from an internal, host-local subnet.

This is why a container can bind to port 80 even if the host already has nginx listening on port 80 — they are in different namespaces, and port conflicts only occur within the same namespace. It is also why a container cannot simply `ping` the host's `eth0` address — the container's routing table doesn't know about the host's external network. You must configure the routing (and usually NAT) to make it work.

> [!example] Analogy
> Think of a network namespace as a separate fishbowl. Each container lives in its own fishbowl with its own tiny internet. The docker0 bridge is like a tube connecting all the fishbowls to the outside world. Inside a fishbowl, the fish (packets) behave exactly as they would in a real network. But from the fish's perspective, the world outside the glass doesn't exist until the tube provides a path.

The key insight from [[02-infraestructura-contenedores/01-Docker-Fundamentos-Arquitectura-Aislamiento-Capas]] is that this isolation comes from the Linux NET namespace — one of the six namespace types that make containers possible. The NET namespace gives each container its own independent network stack. Docker networking is the system that makes these isolated network stacks communicate with each other and with the outside world.

## How Docker Networking Works Under the Hood

When you run `docker run --name myapp nginx`, Docker doesn't just start a process — it sets up an entire networking stack. Here's exactly what happens, from the Linux kernel's perspective.

### veth Pairs

A **veth pair** (virtual ethernet pair) is a virtual network interface that comes in pairs. Whatever you send into one end of the pair arrives at the other end — it is a tunnel. This is the fundamental building block of Docker networking.

When Docker creates a container with the default bridge network, it performs these steps:

1. Creates a veth pair: `vethXXXXX` (host side) and `eth0` (container side).
2. Moves the container-side interface into the container's network namespace, renaming it to `eth0`.
3. Attaches the host-side interface to the `docker0` bridge.
4. Assigns an IP address from the bridge's subnet to both interfaces.

```bash
# What you see on the host after docker run --name myapp nginx
$ ip link show
1: lo: <LOOPBACK,UP,LOWER_UP> ...
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> ...  ← Host's physical NIC
3: docker0: <BROADCAST,MULTICAST,UP,LOWER_UP> ...  ← Docker's bridge
12: vetha1b2c3d@if11: <BROADCAST,MULTICAST,UP,LOWER_UP> ...  ← Host side of veth pair

# Inside the container
$ ip link show
1: lo: <LOOPBACK,UP,LOWER_UP> ...
11: eth0@if12: <BROADCAST,MULTICAST,UP,LOWER_UP> ...  ← Container side of veth pair
```

The `@if12` suffix on the container's `eth0` indicates it is a veth pair endpoint connected to interface 12 (the host-side `vetha1b2c3d`). The container's `eth0` and the host's `vetha1b2c3d` are the two ends of the same virtual cable.

```
Container Network Namespace:          Host Network Namespace:
┌──────────────────────────┐          ┌──────────────────────────┐
│  PID 1: nginx            │          │  PID 100: dockerd        │
│                          │          │                          │
│  eth0 (172.17.0.2)       │◄────────►│  vetha1b2c3d (on bridge) │
│  (interface 11)          │  veth    │  (interface 12)          │
│  MAC: aa:bb:cc:dd:ee:01  │  pair    │  MAC: aa:bb:cc:dd:ee:02  │
│                          │          │                          │
│  Routing table:          │          │  docker0 bridge:         │
│  172.17.0.0/16 → eth0    │          │  docker0 (172.17.0.1)    │
│  default → docker0 gw    │          │  Forwarding: veth↔bridge │
│  172.17.0.1 (docker0)    │          └──────────────────────────┘
└──────────────────────────┘
```

> [!info] Why veth Pairs Are Used
> veth pairs are used because they provide a seamless, zero-cost data path between two network namespaces. The kernel can copy packets between namespaces with minimal overhead — the data is simply copied in kernel memory. There is no serialization, no protocol conversion, no tunneling. A packet leaving the container's `eth0` appears immediately on the host-side veth interface. This is why container networking has virtually no overhead compared to a bare process.

> [!warning] Common Misconception
> Many people think Docker creates a "virtual cable" between the container and the bridge. This is approximately correct, but the implementation is slightly different: Docker creates a veth pair and then "plugs" one end into a Linux bridge using the `ip link set dev vethXXX master docker0` command. This effectively adds the veth interface to the bridge's forwarding domain, making the container part of the bridge's L2 (Layer 2) domain.

### Linux Bridges

A **Linux bridge** is a software-based Layer 2 (data link layer) switch. It operates at the same level as a physical Ethernet switch — it forwards frames between ports based on MAC addresses. Docker uses a Linux bridge (`docker0` by default) to connect all containers that use the default bridge network.

```bash
# The docker0 bridge on the host
$ ip addr show docker0
3: docker0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP
    link/ether 02:42:ac:11:00:01 brd ff:ff:ff:ff:ff:ff
    inet 172.17.0.1/16 scope global docker0
       valid_lft forever preferred_lft forever

$ brctl show docker0
bridge name     bridge id               STP port
docker0         8000.0242ac110001       no
                                                        port
                                                        id      state   designation
                                                        1       8000    forwarding
```

The bridge has an IP address (`172.17.0.1`) because it also serves as the **default gateway** for all containers on the bridge. This IP is the container's "exit door" to the outside world.

Here's how a packet flows from a container to the internet:

```
Container (172.17.0.2) sends packet to 8.8.8.8 (Google DNS):
1. Container checks its routing table: "Is 8.8.8.8 on my local subnet (172.17.0.0/16)?"
   → No, it's not. So the packet goes to the default gateway: 172.17.0.1 (docker0)
2. Container sends an ARP request: "Who has 172.17.0.1?" 
   → The docker0 bridge responds with its MAC address (02:42:ac:11:00:01)
3. Container sends the packet to docker0's MAC address, through the veth pair
4. The Linux bridge receives the packet on the veth port and checks its forwarding table.
   → The destination MAC is the bridge's own MAC, so the packet is delivered to the bridge.
5. The bridge checks the IP destination (8.8.8.8) against its routing table.
   → 8.8.8.8 is not local, so it forwards the packet to the host's routing table.
6. The host's kernel applies NAT (iptables) to translate the source IP:
   → Source 172.17.0.2 becomes the host's external IP (e.g., 203.0.113.5)
7. The packet goes out through the host's eth0 to the internet.
8. Return traffic comes back to the host's external IP, and iptables reverses the NAT.
9. The host routes the packet back to docker0, then through the appropriate veth pair
   to the container's eth0.
```

This NAT process is handled by `iptables` rules that Docker automatically configures. Without NAT, containers on the private `172.17.0.0/16` subnet would not be able to reach the internet, because the internet doesn't know how to route packets to private IP addresses.

> [!tip] How Docker Chooses the Subnet
> By default, Docker tries to find a private subnet that doesn't conflict with the host's existing networks. It tries `172.17.0.0/16` first, then `172.18.0.0/16`, and so on, until it finds a subnet that the host doesn't already have a route to. If all default subnets are taken, Docker will fail to start. You can check which subnet Docker is using with:
> ```bash
> docker network inspect bridge
> ```

### iptables and NAT

Docker automatically manages `iptables` rules to enable container networking. These rules are critical because they perform **Network Address Translation (NAT)**, which is what allows containers on private IP addresses to reach the outside world.

When Docker creates a container on the default bridge, it adds these iptables rules:

```bash
# POSTROUTING rule: Masquerade (SNAT) outgoing container traffic
-A POSTROUTING -s 172.17.0.0/16 ! -o docker0 -j MASQUERADE

# PREROUTING rule: DNAT incoming published port traffic
-A PREROUTING -m addrtype --dst-type LOCAL -j DOCKER

# OUTPUT rule: DNAT incoming published port traffic (for local clients)
-A OUTPUT -m addrtype --dst-type LOCAL ! --dst 127.0.0.0/8 -j DOCKER

# DOCKER chain: route published ports to containers
-A DOCKER -i docker0 -j RETURN
-A DOCKER -! -i docker0 -p tcp -m tcp --dport 8080 -j DNAT --to-destination 172.17.0.2:80
```

Let me explain each rule:

**MASQUERADE (SNAT):** When a container (source IP `172.17.0.2`) sends a packet to the internet, the MASQUERADE rule in the POSTROUTING chain replaces the source IP with the host's external IP address. This is essential because the internet doesn't have routes to private IPs. MASQUERADE is preferred over SNAT for dynamic IPs (like DHCP or PPP connections) because it automatically uses the current IP of the outgoing interface.

**DNAT:** When an external client sends a packet to the host's IP on a published port (e.g., `203.0.113.5:8080`), the DNAT rule in the PREROUTING chain redirects the packet to the container's IP and port (e.g., `172.17.0.2:80`). This is how port publishing works — it's just iptables DNAT magic.

> [!warning] iptables Rule Cleanup
> When containers are removed, Docker should clean up the iptables rules it created. However, if Docker crashes or is killed ungracefully, stale iptables rules can accumulate. This can cause port conflicts (multiple containers appearing to bind the same port) or routing errors. Always restart Docker to clean up stale rules, or manually flush the DOCKER chain:
> ```bash
> iptables -F DOCKER
> ```

**Important:** Docker's iptables rules are managed automatically and **should not be manually modified**. If you add custom iptables rules, they will conflict with Docker's rules. To add custom rules, use the `DOCKER-USER` chain, which Docker appends after its own rules and does not flush.

```bash
# Custom rules that survive Docker restarts
iptables -I DOCKER-USER -i eth0 -p tcp --dport 22 -j DROP
```

## Docker Network Modes

Docker provides several **network modes** — different ways a container's network namespace can be connected (or not connected) to the host and other containers. Each mode serves a different use case, and understanding when to use each one is critical for production deployments.

### Bridge Network (Default)

The **bridge network** is Docker's default networking mode. Every container that doesn't specify a `--network` flag uses the default bridge network. This is a user-level Linux bridge (`docker0`) that connects all containers on the same host.

```bash
# Create a container with default bridge networking (implicit)
docker run -d --name web nginx

# Inspect the network
docker network inspect bridge
```

The output shows the network configuration:

```json
{
  "Name": "bridge",
  "Id": "abc123...",
  "Driver": "bridge",
  "IPAM": {
    "Config": [
      {
        "Subnet": "172.17.0.0/16",
        "Gateway": "172.17.0.1"
      }
    ]
  },
  "Containers": {
    "web": {
      "IPv4Address": "172.17.0.2/16",
      "IPv6Address": "",
      "Name": "web"
    }
  }
}
```

**Key characteristics of the default bridge network:**

- Containers can communicate with each other using IP addresses (e.g., `ping 172.17.0.2`).
- **Containers on the default bridge CANNOT resolve each other by name using DNS.** This is the most common source of confusion. The default bridge does NOT provide automatic DNS resolution between containers. If you need name-based service discovery, you must use a custom bridge network (see the Custom Bridge Networks section below).
- Each container gets an IP address from the `172.17.0.0/16` subnet.
- Port publishing (`-p` flag) works the same way on the default bridge and custom bridges.
- The bridge network is created automatically when Docker starts and cannot be deleted (Docker requires at least one bridge).

> [!info] Why the Default Bridge Lacks DNS
> The default bridge was Docker's first networking implementation, designed before Docker Compose and microservices became popular. At that time, IP-based communication was sufficient. When Docker Compose was created, it needed reliable DNS-based service discovery, so Docker introduced the **network plugin API** and custom bridge networks with built-in DNS. The default bridge was never updated to include DNS to maintain backward compatibility. This is why the default bridge is often called the "legacy bridge" in Docker documentation.

### Host Network

The **host network** mode removes all network isolation between the container and the host. The container shares the host's network namespace — it sees all of the host's network interfaces, uses the host's IP addresses, and binds to the same ports.

```bash
# Run a container with host networking
docker run -d --network host --name nginx-host nginx
```

With host networking:
- The container can bind directly to host ports (no `-p` flag needed).
- The container accesses the host's network interfaces directly — no NAT, no port mapping, no bridge.
- The container's processes see all host network traffic.
- **There is no `docker0` bridge for the container.** The container's `eth0` IS the host's `eth0`.

```
Bridge Network:              Host Network:
┌─────────────────┐          ┌──────────────────────────┐
│ Container       │          │ Container shares          │
│ eth0: 172.17.0.2│          │ host's full network       │
│ NAT via docker0 │          │ stack directly. No NAT.   │
└────────┬────────┘          │ Container can bind to     │
         │ Port mapping:     │ port 80 directly (if it's │
         │ 8080:80           │ the container's entry     │
         ▼                   │ point)                    │
Host ──────────────────────► └──────────────────────────┘
```

**When to use host networking:**

- **Performance-critical applications**: Host networking eliminates the NAT overhead and the extra context switch through the bridge. For high-throughput, low-latency workloads (e.g., a high-performance web server handling 10,000+ requests/second), this can provide measurable improvement (typically 5-20% throughput increase, sub-millisecond latency reduction).
- **Applications that need to bind to privileged ports** (below 1024) without `--cap-add=NET_BIND_SERVICE`.
- **Applications that need to access the host's loopback interface** (`localhost`). In bridge mode, `localhost` inside the container is the container's loopback, not the host's. In host mode, `localhost` IS the host — which can be useful for accessing services running on the host (like a local database).
- **Kubernetes pods**: Kubernetes uses host networking internally for its `kube-proxy` and CNI plugins, though user pods rarely use it.

**When NOT to use host networking:**

- **Running multiple containers that need the same port**. Since all containers share the host's port space, you can only run one container per port per host. With bridge networking, multiple containers can all bind to port 80 internally, and the host's iptables rules route different published ports to different containers.
- **Security-sensitive deployments**. Host networking removes the network namespace isolation, making it easier for a compromised container to observe or interfere with host network traffic.
- **Cloud environments with security groups**. If you're running containers on AWS ECS, GCP GKE, or Azure ACI, host networking may interfere with the cloud provider's load balancer and security group configurations.

> [!warning] Host Network Gotcha
> When using host networking with `docker-compose`, the `ports` section in your compose file is **ignored**. This is because port mapping doesn't make sense when the container already has full access to the host's port space. If your compose file uses `network_mode: host`, remove the `ports` section or set `network_mode: host` only on specific services.

> [!tip] Host Network and Docker Compose
> ```yaml
> # In docker-compose.yml
> services:
>   nginx:
>     image: nginx
>     network_mode: host    # No ports section needed
>     # ports:
>     #   - "80:80"        # IGNORED with host networking
> ```

### None Network

The **none network** mode gives the container no network connectivity at all. The container's network namespace exists but has no interfaces other than the loopback (`lo`).

```bash
# Run a container with no network
docker run --network none --name isolated alpine ip addr show
# Only shows: 1: lo: <LOOPBACK,UP,LOWER_UP> ...
# No eth0, no veth, no nothing.
```

This is useful for:

- **Security-critical workloads** that don't need any network access (e.g., batch processing jobs that read from mounted volumes).
- **Testing and debugging** network behavior in isolation.
- **Containers that should never have outbound connectivity** — useful as a baseline when building more complex network configurations.

You can manually add network interfaces to a `--network none` container using `ip link` and `ip netns`, which is useful for advanced use cases like custom network configurations.

### Custom Bridge Networks

**Custom bridge networks** are user-defined bridges that solve the limitations of the default bridge. They provide built-in DNS resolution, better isolation, and more control over network configuration.

```bash
# Create a custom bridge network
docker network create --driver bridge --subnet 10.0.0.0/24 --gateway 10.0.0.1 my-bridge

# Run containers on the custom network
docker run -d --network my-bridge --name web nginx
docker run -d --network my-bridge --name db postgres

# Containers can now resolve each other by name!
docker exec web ping db
# PING db (10.0.0.2): 56 data bytes
# 64 bytes from 10.0.0.2: seq=0 ttl=64 time=0.042 ms
```

**Key differences between the default bridge and custom bridges:**

| Feature | Default Bridge (`bridge`) | Custom Bridge |
|---------|--------------------------|---------------|
| DNS resolution | ❌ No (IP only) | ✅ Yes (container name as hostname) |
| Network isolation | ❌ All containers share one bridge | ✅ Containers only see explicitly connected containers |
| Subnet configuration | ❌ Auto-selected | ✅ User-defined |
| Creation | Auto-created by Docker | Created with `docker network create` |
| Deletable | ❌ No | ✅ Yes |
| Multi-host | ❌ No | ❌ No (use overlay for multi-host) |

**Why custom bridges are better than the default bridge for almost everything:**

1. **DNS-based service discovery**: Each container on a custom bridge gets an entry in the embedded DNS server. If you name a container `web`, other containers can reach it at `http://web` without knowing its IP address. The IP can change (when a container is recreated), but the name stays the same.

2. **Isolation**: Containers on different custom bridges cannot communicate with each other, even on the same host. This provides a simple firewall-like isolation layer. To allow communication between bridges, you must explicitly connect a container to both networks.

3. **Multiple subnets**: A single custom bridge can have multiple subnets, allowing you to create complex network topologies on a single host.

```bash
# Connecting a container to multiple networks
docker network create frontend
docker network create backend

docker run -d --name web --network frontend nginx
docker run -d --name api --network frontend,backend myapp
docker run -d --name db --network backend postgres

# web can reach api (both on frontend)
# api can reach db (both on backend)
# web CANNOT reach db (no shared network)
```

**How DNS works on custom bridges:**

Docker includes an **embedded DNS server** that runs inside each container on a custom bridge. When a container needs to resolve a hostname, it queries this DNS server instead of using the system's `/etc/resolv.conf` nameservers.

```bash
# Inside a container on a custom bridge
$ cat /etc/resolv.conf
nameserver 127.0.0.11    ← Docker's embedded DNS server
options ndots:0

# This DNS server knows about all containers on the network
$ nslookup web
Server:    127.0.0.11
Address:   127.0.0.11:53

Name:      web
Address:   172.18.0.2
```

The DNS server runs on `127.0.0.11` inside every container, and it responds to queries for:
- Container names (e.g., `web`, `db`)
- Container names with network suffix (e.g., `web.mynet`, if the network is named `mynet`)
- Container IDs (the short form)

> [!tip] Naming Containers Matters
> Because DNS resolution uses the container's name, always give your containers meaningful names: `docker run --name api-server nginx` instead of `docker run nginx`. If you don't specify a name, Docker generates a random one (like `eager_bose`), which is impossible for humans to remember and type.
>
> In `docker-compose.yml`, service names become the DNS names automatically:
> ```yaml
> services:
>   api-server:       # This name is used for DNS resolution
>     image: myapp
>   db:               # This name is used for DNS resolution
>     image: postgres
> ```

### Overlay Networks

**Overlay networks** enable containers on different Docker hosts to communicate securely as if they were on the same bridge network. They are the backbone of Docker Swarm's multi-host networking.

An overlay network works by creating a **tunnel** between Docker hosts. Each container gets a virtual IP on the overlay network, and traffic between containers on different hosts is encapsulated in VXLAN (Virtual Extensible LAN) packets.

```
Host A                                    Host B
┌──────────────────────┐                  ┌──────────────────────┐
│  Container: web      │                  │  Container: db       │
│  IP: 10.0.0.2        │                  │  IP: 10.0.0.3        │
│                      │    VXLAN         │                      │
│  veth pair           │◄────tunnel──────►│  veth pair           │
│                      │    (UDP 4789)    │                      │
└──────────────────────┘                  └──────────────────────┘
     │                                        │
  docker0                                     docker0
     │                                        │
  Host eth0 (203.0.113.10)              Host eth0 (203.0.113.20)
```

**How overlay networks work internally:**

1. **Encapsulation (VXLAN)**: When container `web` on Host A sends a packet to `db` on Host B, Docker's overlay driver encapsulates the original Ethernet frame inside a UDP packet (port 4789), adds a VXLAN header, and wraps it in an IP packet with Host A's and Host B's IP addresses. This UDP packet travels across the physical network (internet or datacenter) to Host B.

2. **Decapsulation**: When the packet arrives at Host B, Docker's overlay driver strips off the outer UDP/IP/VXLAN headers and delivers the original Ethernet frame to the `db` container.

3. **Key (VNI)**: Each overlay network has a unique VNI (VXLAN Network Identifier), a 24-bit number that allows multiple overlay networks to coexist on the same physical infrastructure. VXLAN supports up to 16 million (2^24) overlay networks.

> [!info] VXLAN RFC 7348
> VXLAN (Virtual Extensible LAN) is defined in RFC 7348. It encapsulates Layer 2 Ethernet frames inside Layer 4 UDP packets. The VXLAN header includes the VNI (24 bits), which identifies the virtual network. This allows overlapping IP subnets across different physical networks — crucial for cloud environments where multiple tenants might use the same IP ranges.

**Creating an overlay network requires Swarm mode:**

```bash
# Initialize Swarm mode on the first host
docker swarm init --advertise-addr 203.0.113.10

# Create the overlay network
docker network create --driver overlay --subnet 10.0.0.0/24 my-overlay

# Join additional hosts to the swarm
docker swarm join --token <swarm-token> 203.0.113.10:2377

# Deploy a service that uses the overlay network
docker service create --name web --network my-overlay -p 80:80 nginx
docker service create --name db --network my-overlay postgres

# The overlay network is automatically available on all swarm nodes
```

**Control plane vs data plane in overlay networks:**

The overlay network has two distinct components:

- **Control plane**: Manages network state and service discovery. In Docker Swarm, the Swarm manager maintains the cluster state (using RAFT consensus) and distributes network configuration to all nodes. Each node has a lightweight agent (dockerd) that receives updates from the manager and configures the local overlay network accordingly. For Docker Swarm, the control plane is built-in. For Docker Compose with custom plugins (e.g., Weave), the control plane might use Consul, etcd, or a built-in mesh network.
  
- **Data plane**: Handles actual packet forwarding between containers. Each node runs a VXLAN endpoint (vxlan0) that performs encapsulation and decapsulation. The data path is:
  ```
  Container → veth pair → local bridge → vxlan0 (encapsulate) → 
  host eth0 → physical network → ... → 
  host eth0 → vxlan0 (decapsulate) → local bridge → veth pair → Container
  ```

> [!warning] Overlay Network Performance
> Overlay networks add overhead: each packet is encapsulated (added ~50-80 bytes of headers) and decapsulated, requiring CPU cycles on each host. In practice, the overhead is small (typically 1-5% of throughput) on modern hardware with hardware VXLAN offload. For performance-critical workloads on a single host, use a custom bridge instead. For workloads across multiple hosts, overlay is the standard approach.

> [!tip] Overlay Networks in Kubernetes
> Kubernetes does NOT use Docker's built-in overlay networking for pod communication. Instead, Kubernetes uses CNI (Container Network Interface) plugins like Calico, Cilium, Weave, or Flannel. These plugins handle pod networking differently — some use overlay (Flannel VXLAN), some use routing (Calico BGP), and some use eBPF (Cilium). The Docker overlay network is Swarm-specific.

### Macvlan Networks

**Macvlan** networks give each container its own MAC address and IP address on the physical network. Unlike bridge or overlay networks, Macvlan does not use NAT or port forwarding — the container appears as a physical device on the network.

```bash
# Create a macvlan network
docker network create -d macvlan \
  --subnet 192.168.1.0/24 \
  --gateway 192.168.1.1 \
  -o parent=eth0 \
  my-macvlan

# Run a container with a macvlan network
docker run -d --network my-macvlan --ip 192.168.1.100 --name web nginx
```

With Macvlan, the container gets an IP address from your physical network's subnet (e.g., `192.168.1.100`), and it communicates directly with other devices on the physical network without any NAT. The container's MAC address is assigned by Docker and appears to the physical switch as a new device.

```
Traditional (Bridge + NAT):      Macvlan:
Container (172.17.0.2)          Container (192.168.1.100)
    │                               │
docker0 bridge                      │  (directly on physical network)
    │                               │
Host eth0 (NAT applied)             Host eth0 (no NAT)
    │                               │
Physical switch / router            Physical switch / router
```

**When to use Macvlan:**

- **When containers need to appear as physical devices** on the network (e.g., for appliances that other systems discover via ARP or DHCP).
- **When you need full bidirectional communication** without port mapping. Every port on the container is automatically accessible from the physical network.
- **When you need the lowest possible latency**. Macvlan has no NAT or bridge overhead — it operates at the kernel's network driver level.
- **Legacy applications** that expect to be on the physical network (e.g., databases that need to be visible to external monitoring tools).

**When NOT to use Macvlan:**

- **Laptop development**. Most laptops use DHCP and wireless networking, which don't support Macvlan. Macvlan requires a static IP configuration and a physical Ethernet interface.
- **Shared hosting environments** where multiple users run Docker. Macvlan can conflict with the network administrator's DHCP assignments and ARP tables.
- **When you need container-to-host communication on the same subnet**. By default, the host cannot communicate with Macvlan containers on the same subnet because the host's interface is the parent. You can work around this by creating a macvlan interface on the host itself (a "dummy" interface on the same subnet).

> [!warning] Linux Kernel Limitation
> By default, Linux does not allow a packet received on a macvlan interface to be sent back to the same interface. This means the host (which owns the parent interface `eth0`) cannot communicate directly with macvlan containers on the same subnet. To enable host-to-container communication, you need to create a special "dummy" macvlan interface on the host.

## Port Publishing and Mapping

Port publishing is one of the most commonly used Docker features. It allows containers to expose their internal ports to the outside world. Understanding how it works internally is essential for debugging port conflicts, understanding firewall rules, and optimizing network performance.

### The `-p` Flag Mechanics

The `-p` (or `--publish`) flag tells Docker to create a port mapping between a port on the host and a port inside the container. The syntax is:

```bash
-p [host_ip:]host_port:container_port[/protocol]
```

The protocol part (`/tcp` or `/udp`) is optional — TCP is the default. If you omit `host_ip`, Docker binds to all interfaces (`0.0.0.0`).

```bash
# Map host port 8080 to container port 80 (TCP)
docker run -p 8080:80 nginx

# Map host port 8080 to container port 80, only on localhost
docker run -p 127.0.0.1:8080:80 nginx

# Map a range of ports
docker run -p 8000-8010:8000-8010 nginx

# Map to a UDP port
docker run -p 53:53/udp nginx

# Map to both TCP and UDP
docker run -p 53:53 -p 53:53/udp nginx
```

### Published vs Container Ports

It's important to understand the distinction between **published ports** (on the host) and **container ports** (inside the container):

```
Host: 203.0.113.5:8080 ──► Container: 172.17.0.2:80
         (published)              (container)
```

- The **container port** (80) is the port the application inside the container listens on.
- The **published port** (8080) is the port on the host that maps to the container port.
- The two ports can be the same (e.g., `-p 80:80`) or different (e.g., `-p 8080:80`).

> [!info] Why Map Different Ports?
> You might map `-p 8080:80` so that the container's nginx listens on port 80 (as it expects) while the host exposes it on port 8080. This is useful when:
> - Port 80 is already in use by another service on the host.
> - You're running multiple containers, each exposing a different web application, and you want them on different host ports (8080, 8081, 8082).
> - You want to avoid running as root — on Linux, ports below 1024 are privileged. The host can listen on port 8080 (unprivileged) and forward to the container's port 80.

### How Port Publishing Works Under the Hood

Port publishing works through **iptables DNAT (Destination NAT)**. When you specify `-p 8080:80`, Docker adds these iptables rules:

```bash
# 1. The DOCKER chain routes incoming traffic to the container
-A DOCKER -i docker0 -j RETURN
-A DOCKER ! -i docker0 -p tcp -m tcp --dport 8080 -j DNAT --to-destination 172.17.0.2:80

# 2. The MASQUERADE rule handles the return traffic (SNAT)
-A POSTROUTING -s 172.17.0.0/16 ! -o docker0 -j MASQUERADE
```

Here's the complete packet flow for a request to `203.0.113.5:8080`:

```
1. Client sends: SYN 203.0.113.5:54321 → 203.0.113.5:8080
2. Packet arrives at host's eth0. Kernel checks routing table.
3. PREROUTING chain: Packet matches DOCKER chain rule for port 8080.
   DNAT applied: Source → 172.17.0.2:80
4. FORWARD chain: Packet is forwarded to docker0 bridge.
5. Bridge delivers packet to container's veth pair.
6. Container receives: SYN 203.0.113.5:54321 → 172.17.0.2:80
7. Container responds: SYN-ACK 172.17.0.2:80 → 203.0.113.5:54321
8. Packet goes through FORWARD → POSTROUTING.
   MASQUERADE applied: Source 172.17.0.2 → 203.0.113.5
9. Client receives: SYN-ACK 203.0.113.5:8080 → 203.0.113.5:54321
   (Client never knows about the container or NAT — the connection 
   appears to be directly with the host)
```

> [!info] Connection Tracking (conntrack)
> Docker's NAT relies on the kernel's connection tracking (conntrack) system. conntrack maintains a table of all active connections, including the NAT mappings. When the return packet comes back, conntrack reverses the DNAT automatically. This is why both directions of the connection work transparently.
>
> conntrack has a limited table size (default ~65,536 entries on most systems). Under high load (e.g., a busy web server with many short-lived connections), the conntrack table can fill up, causing new connections to be dropped. You can check the current usage with:
> ```bash
> conntrack -C        # table size
> conntrack -C -c     # current usage and percentage
> ```

### Ephemeral Ports

When you use `-p` with a port number of `0`, Docker allocates a **random available port** from the host's ephemeral port range:

```bash
# Docker picks a random available port
docker run -p 0:80 nginx
# Example output: 0.0.0.0:45678 -> 80/tcp

# You can see the mapped port with:
docker port <container-name>
# Output: 80/tcp -> 0.0.0.0:45678
```

The **ephemeral port range** is controlled by the kernel parameter `net.ipv4.ip_local_port_range` (or `net.ipv6.ip_local_port_range` for IPv6):

```bash
# Check the ephemeral port range
cat /proc/sys/net/ipv4/ip_local_port_range
# Output: 32768	60999
# This means the range is 32768 to 60999, providing 28,232 available ports

# On newer kernels (Linux 3.8+), the default range is wider:
# 32768 to 60999 (28,232 ports)
```

> [!warning] Ephemeral Port Exhaustion
> If you run many containers each publishing a random port (`-p 0:80`), you can exhaust the ephemeral port range on the host. When the range is exhausted, new containers fail to start with "port already allocated" errors. Each published port consumes one entry from the ephemeral range, even though the container only uses a small number of connections.

### `-P` Flag (Publish All)

The `-P` (capital P) flag publishes **all exposed ports** from the Dockerfile to random ephemeral ports:

```dockerfile
FROM nginx
EXPOSE 80
EXPOSE 443
```

```bash
# -P publishes ALL EXPOSE'd ports to random host ports
docker run -P nginx
# Output might show:
# 0.0.0.0:49153->80/tcp, 0.0.0.0:49154->443/tcp

# -p overrides specific ports while -P handles the rest
docker run -p 8080:80 -P nginx
# 80 maps to 8080 explicitly, 443 gets a random port
```

### Common Port Publishing Issues

**Issue 1: "Port is already allocated"**

```bash
$ docker run -p 8080:80 nginx
docker: Error response from daemon: driver failed programming external connectivity on endpoint myapp (abc123): Error starting userland proxy: Bind for 0.0.0.0:8080 failed: port is already allocated.
```

This error occurs when another process (or another container) is already listening on host port 8080. The Docker daemon tries to create an iptables rule and a userland proxy (or ebpf proxy with `--network-bridge`) to forward traffic, but the port is already bound.

```bash
# Find what's using the port
sudo lsof -i :8080
# Or: sudo ss -tlnp | grep 8080

# Solutions:
# 1. Stop the conflicting process
# 2. Use a different host port: docker run -p 8081:80 nginx
# 3. Bind to a specific interface: docker run -p 127.0.0.1:8080:80 nginx
```

**Issue 2: "Cannot connect to the container from localhost"**

When you bind to `0.0.0.0` (the default), the port is accessible from all interfaces, including the host itself. But on some systems (especially macOS and Windows, which run Docker in a VM), `localhost` refers to the VM's localhost, not the host's localhost. You may need to use the VM's IP address.

On Linux, if you've explicitly bound to a specific IP (e.g., `127.0.0.1:8080:80`), the port is NOT accessible from other machines on the network — only from the host itself. This is a security feature, not a bug.

## DNS and Service Discovery

Docker provides built-in DNS resolution through an **embedded DNS server** that runs inside each container. This is the primary mechanism for service discovery in Docker environments.

### Embedded DNS Server

When a container joins a user-defined network (custom bridge or overlay), Docker injects a DNS server at `127.0.0.11` into the container's `/etc/resolv.conf`:

```bash
# Inside a container on a custom network
$ cat /etc/resolv.conf
nameserver 127.0.0.11
options ndots:0
```

The embedded DNS server resolves:
- **Container names**: If a container is named `web`, other containers on the same network can resolve `web` to the container's IP.
- **Container IDs**: The full and short Docker container ID can be used as hostnames.
- **Service names in Swarm**: In Docker Swarm mode, service names are resolved to the service's virtual IP (VIP), which load-balances across all replicas.

> [!info] DNS Server Implementation
> The embedded DNS server runs inside every container as a lightweight DNS daemon (a modified version of SkyDNS, which is a DNS server written in Go). It listens on UDP port 53 and TCP port 53 at `127.0.0.11`. Because it runs locally inside the container's network namespace, DNS queries are extremely fast — typically sub-millisecond.

### How DNS Resolution Works in Detail

When a container resolves a hostname (e.g., `db`), the following happens:

```
1. Application calls: getaddrinfo("db", ...)
2. glibc checks /etc/resolv.conf → sees nameserver 127.0.0.11
3. DNS query sent to 127.0.0.11:53 (UDP, port 53)
4. Embedded DNS server checks its internal store:
   - Is "db" registered on this network?
   - If yes: return the container's IP
   - If no: return NXDOMAIN (non-existent domain)
5. Application receives IP address and connects
```

The DNS server's internal store is populated by the Docker daemon. When a container is created on a network, Docker registers its name and IP in the DNS server's store. When the container is removed, the DNS entry is automatically cleaned up.

### DNS Resolution in Docker Compose

Docker Compose automatically creates a custom bridge network and assigns each service a DNS name based on its service name:

```yaml
# docker-compose.yml
services:
  web:
    image: nginx
    ports:
      - "80:80"
  api:
    image: myapp
    environment:
      - DATABASE_URL=postgresql://db:5432/mydb  # "db" is resolved by Docker DNS
  db:
    image: postgres
    environment:
      - POSTGRES_PASSWORD=secret
```

In this configuration, the `api` container can connect to `postgresql://db:5432/mydb` because Docker's DNS resolves `db` to the `db` container's IP address. This is one of the most powerful features of Docker networking.

> [!tip] DNS Resolution and Startup Order
> DNS resolution works even if the target container hasn't started yet. The DNS server will return NXDOMAIN for containers that aren't running, so your application needs to handle DNS failures gracefully (with retries and timeouts). This is why services with dependencies (like an API depending on a database) should implement retry logic.

### Service Discovery in Docker Swarm

In Docker Swarm mode, DNS resolution provides **built-in load balancing**. When a service has multiple replicas, DNS resolves the service name to a **virtual IP (VIP)**, and Docker's iptables rules load-balance traffic across all replicas:

```bash
# Create a swarm service with 3 replicas
docker service create --name api --replicas 3 myapp

# DNS resolves "api" to a virtual IP
nslookup api
Server:    127.0.0.11
Address:   127.0.0.11:53

Name:      api
Address:   10.0.0.10   ← This is a VIP, not a real container IP

# The VIP load-balances across all 3 replicas using iptables rules
# docker0 forwards traffic to different container IPs based on
# a round-robin or random algorithm
```

> [!warning] DNS Load Balancing vs TCP Connections
> Docker Swarm's DNS-based load balancing operates at the DNS level, not the connection level. Each DNS resolution returns the VIP, and iptables load-balances the first packet of each new connection. However, existing connections are not re-balanced — a client's subsequent packets for the same connection go to the same container (connection persistence). This is generally what you want for stateful applications.
>
> For more sophisticated load balancing (HTTP-level routing, SSL termination, sticky sessions), use a reverse proxy like Nginx or Traefik in front of the Swarm services.

### DNS Edge Cases

**Case 1: Overriding DNS servers**

You can override the embedded DNS server by specifying custom nameservers:

```bash
docker run --dns 8.8.8.8 --dns 8.8.4.4 nginx
# This replaces 127.0.0.11 with 8.8.8.8 and 8.8.4.4 in /etc/resolv.conf
# The embedded DNS server is NOT used for this container
```

> [!warning] Overriding DNS Removes Service Discovery
> When you specify custom `--dns` servers, the embedded Docker DNS server (127.0.0.11) is NOT included. This means containers can no longer resolve other containers by name. If you need both external DNS and Docker DNS, use `--dns-opt` to add options instead:
> ```bash
> docker run --dns 8.8.8.8 --network mynet nginx
> # Docker automatically adds 127.0.0.11 to the resolv.conf
> ```

**Case 2: The `ndots` option**

The `ndots:0` setting in `/etc/resolv.conf` tells the resolver to try the name as-is before appending search domains. The default in many systems is `ndots:5`, which means the resolver tries the name with up to 5 search domain suffixes before giving up. In Docker containers, `ndots:0` is the default because containers typically don't have search domains, and `ndots:5` would cause unnecessary DNS queries.

> [!tip] Custom DNS Search Domains
> If you need search domains in Docker, specify them explicitly:
> ```bash
> docker run --dns-search example.com nginx
> # This adds "search example.com" to /etc/resolv.conf
> ```

## Network Plugins

Docker's plugin system allows you to install custom network drivers that replace or extend Docker's built-in networking. Network plugins can provide features that the built-in drivers don't support, such as multi-host networking without Swarm, advanced traffic filtering, or integration with specific cloud providers.

### Installing Network Plugins

Network plugins are installed using the `docker plugin install` command. They run as separate processes (containerized) and communicate with the Docker daemon via a gRPC API.

```bash
# Install a network plugin (example: Weave)
docker plugin install weaveworks/weave-plugin:latest --alias weave --grant-all-permissions

# Enable the plugin
docker plugin enable weave

# The plugin is now available as a network driver
docker network create -d weave my-net
```

After installation, the plugin creates a new driver that you can reference with `-d <plugin-name>` when creating networks:

```bash
docker network create -d <plugin-driver> \
  --opt encrypted \
  my-network
```

### Popular Network Plugins

**Weave Net:**
Weave is a popular multi-host networking solution that works without Swarm mode. It creates a mesh network between Docker hosts, automatically routing traffic between containers on different hosts.

```bash
# Install Weave
docker plugin install weaveworks/weave-plugin:latest --alias weave --grant-all-permissions

# Create a Weave network
docker network create -d weave --opt encrypted my-weave-net
```

Weave works by creating a **mesh network** of peer-to-peer connections between hosts. Each host runs a Weave container that maintains TCP connections to every other host. Containers on any host can communicate with containers on any other host, with automatic encryption (Weave uses TLS between peers).

```
Host A                          Host B                          Host C
┌──────────────┐                ┌──────────────┐                ┌──────────────┐
│ Container 1  │                │ Container 3  │                │ Container 5  │
│ Weave peer   │────TCP mesh────│ Weave peer   │────TCP mesh────│ Weave peer   │
│ Container 2  │    connection   │ Container 4  │    connection   │ Container 6  │
└──────────────┘                └──────────────┘                └──────────────┘
```

**Calico:**
Calico is a more advanced networking plugin that provides **network policy enforcement** at the kernel level. It uses BGP (Border Gateway Protocol) for routing instead of overlay tunnels, which means it doesn't add encapsulation overhead.

```bash
# Calico is typically used with Kubernetes, but can be used with standalone Docker
docker network create -d calico \
  --opt calico.intf=eth1 \
  --opt calico.ipam=host-ip \
  my-calico-net
```

Calico's key advantage is that it provides **L3 (Layer 3) routing** instead of L2 (Layer 2) bridging. Each container gets its own IP on the physical network's subnet, and Calico's agents on each host use BGP to advertise routes to the rest of the network. This means:
- No NAT overhead.
- No encapsulation overhead (packets are not tunneled).
- Native routing through the datacenter's existing BGP infrastructure.

**Cilium:**
Cilium is the most advanced networking plugin, using **eBPF (extended Berkeley Packet Filter)** instead of iptables for packet filtering and load balancing. eBPF allows you to run sandboxed programs in the Linux kernel without modifying kernel source code or loading kernel modules.

> [!info] What Is eBPF?
> eBPF is a technology that was added to the Linux kernel in version 3.18 (2014) and significantly improved in version 4.9 (2017). It allows you to write programs that run in the kernel in response to events (network packets, system calls, tracepoints). The programs are compiled to a bytecode format, validated for safety by the kernel's verifier, and then executed. Cilium uses eBPF to implement network policies, load balancing, and observability entirely in the kernel, bypassing iptables entirely.
>
> The advantage over iptables: iptables rules are evaluated in a linear chain (or series of chains), meaning the more rules you have, the slower the evaluation. eBPF programs can be optimized by the kernel's Just-In-Time (JIT) compiler and don't have the same linear lookup penalty. For large clusters with hundreds or thousands of network policies, Cilium can be orders of magnitude faster than iptables-based solutions.

Cilium's architecture looks like this:

```
Container → veth pair → cilium_vxlan0 (VXLAN decap) → 
ebpf program (network policy check) → 
cilium_host (L3 routing) → host eth0 → network
```

The eBPF program performs three functions:
1. **Network policy enforcement**: Checks if the packet is allowed by the network policy. If not, drops it.
2. **Load balancing**: For services, load-balances across backend pods.
3. **Observability**: Logs all L3/L4/L7 (HTTP) traffic for monitoring.

> [!tip] Choosing a Network Plugin
> For most use cases, Docker's built-in networking (bridge + overlay) is sufficient. Use a network plugin when:
> - You need multi-host networking without Swarm (Weave).
> - You need advanced network policies with zero performance overhead (Cilium).
> - You need to integrate with your datacenter's BGP routing (Calico).
> - You need specific cloud provider integration (AWS VPC CNI for ECS/EKS).

## Troubleshooting Container Networking

Network issues in Docker can be challenging because they involve multiple layers: the container's network namespace, the host's network stack, iptables rules, and potentially external network infrastructure. Here's a systematic approach to diagnosing and resolving common networking problems.

### The Troubleshooting Methodology

When a container has networking issues, follow this progression:

1. **Can the container resolve DNS?** → DNS issue
2. **Can the container reach its default gateway (docker0)?** → Local network issue
3. **Can the container reach the host's external IP?** → NAT/routing issue
4. **Can the container reach an external IP (8.8.8.8)?** → Outbound connectivity issue
5. **Can external clients reach the container's published port?** → Port mapping/firewall issue

### Checking Container Network Configuration

```bash
# Check the container's network interfaces
docker exec <container> ip addr show

# Check the container's routing table
docker exec <container> ip route show

# Check the container's DNS configuration
docker exec <container> cat /etc/resolv.conf

# Check if DNS resolution works
docker exec <container> nslookup google.com

# Check connectivity to the gateway
docker exec <container> ping -c 3 172.17.0.1
```

### Using nsenter for Deep Inspection

Sometimes you need to inspect the container's network namespace from the host side. `nsenter` allows you to enter the container's network namespace and run commands as if you were inside the container:

```bash
# Find the container's PID
CONTAINER_PID=$(docker inspect -f '{{.State.Pid}}' <container-name>)

# Enter the container's network namespace
nsenter -t $CONTAINER_PID -n ip addr show
nsenter -t $CONTAINER_PID -n ip route show
nsenter -t $CONTAINER_PID -n ip neigh show
nsenter -t $CONTAINER_PID -n cat /etc/resolv.conf

# Compare with the host's network configuration
ip addr show
ip route show
```

This is particularly useful for diagnosing:
- **Routing issues**: The container's routing table may have unexpected entries.
- **ARP problems**: `ip neigh show` shows the ARP cache. If the gateway's MAC address is missing, ARP resolution is failing.
- **Interface problems**: The container may have multiple interfaces that shouldn't be there.

### Checking iptables Rules

Docker manages iptables rules automatically, but sometimes they get out of sync or conflict with other tools (like firewalld, ufw, or fail2ban). Check Docker's iptables rules:

```bash
# Show all NAT rules (where port mapping happens)
iptables -t nat -L -n -v

# Show all filter rules in the DOCKER chain
iptables -t filter -L DOCKER -n -v

# Show the DOCKER-USER chain (custom rules that persist)
iptables -t filter -L DOCKER-USER -n -v

# Check conntrack table size and usage
conntrack -C
conntrack -C -c
```

> [!warning] iptables Conflicts with firewalld
> If you're using `firewalld` on RHEL/CentOS/Fedora, it manages iptables rules and may flush Docker's rules when it restarts. To prevent this, add a rule in firewalld to allow Docker's traffic:
> ```bash
> firewall-cmd --permanent --zone=docker --add-source=172.17.0.0/16
> firewall-cmd --reload
> ```
>
> Alternatively, disable firewalld's iptables management and use nftables instead.

### Using tcpdump Inside a Container

To capture and analyze network traffic, you can run `tcpdump` inside a container (if it's installed) or run a separate debugging container:

```bash
# Run a debugging container with tcpdump
docker run --rm -it --network container:<target-container> \
  nicolaka/netshoot tcpdump -i eth0 -n

# Or capture on the host side (on the docker0 bridge)
sudo tcpdump -i docker0 -n

# Capture on the veth pair
sudo tcpdump -i veth12345 -n

# Capture with packet counting and display
sudo tcpdump -i docker0 -nn -c 10
```

The `nicolaka/netshoot` image is a diagnostic Swiss army knife for containers. It includes `tcpdump`, `ip`, `ping`, `nslookup`, `curl`, `telnet`, `nmap`, `dig`, and many other networking tools:

```bash
# Interactive debugging session
docker run --rm -it --network container:<target-container> nicolaka/netshoot

# Then run any diagnostic command:
# ip addr show
# ping -c 3 8.8.8.8
# nslookup db
# curl -v http://db:5432
# telnet db 5432
# tcpdump -i eth0 -n
```

### Common Networking Issues and Solutions

**Issue 1: Container can't reach the internet**

```bash
# Check: Can the container ping the gateway?
docker exec <container> ping -c 3 172.17.0.1
# If this fails: Check the container's routing table
docker exec <container> ip route show
# Expected: default via 172.17.0.1 dev eth0

# Check: Does the host have masquerading enabled?
iptables -t nat -L POSTROUTING -n -v | grep MASQUERADE

# Check: Is IP forwarding enabled on the host?
cat /proc/sys/net/ipv4/ip_forward
# Should be: 1
# If 0, enable it:
echo 1 > /proc/sys/net/ipv4/ip_forward
# Or permanently: sysctl -w net.ipv4.ip_forward=1
```

**Issue 2: External clients can't reach the container**

```bash
# Check: Is the port published correctly?
docker port <container>
# Output: 80/tcp -> 0.0.0.0:8080

# Check: Are there firewall rules blocking the port?
sudo iptables -L INPUT -n -v | grep 8080
sudo ufw status

# Check: Is the container's application listening on the right interface?
docker exec <container> ss -tlnp | grep 80
# Should show: LISTEN 0 128 0.0.0.0:80
# NOT: LISTEN 0 128 127.0.0.1:80 (localhost only!)
```

> [!warning] The localhost Listening Trap
> A very common issue: the application inside the container listens on `127.0.0.1:80` instead of `0.0.0.0:80`. In this case, only the container itself can connect to the port. The container's iptables/forwarding rules can deliver packets to `127.0.0.1`, but if the application isn't listening on all interfaces, external traffic will be dropped. This is especially common with application frameworks that default to "localhost only" for security (e.g., Flask's development server, Spring Boot's default).

**Issue 3: DNS resolution failing inside containers**

```bash
# Check the container's DNS configuration
docker exec <container> cat /etc/resolv.conf

# Check if Docker's embedded DNS is responding
docker exec <container> nslookup google.com

# If DNS is broken, try a custom nameserver
docker run --dns 8.8.8.8 --dns 8.8.4.4 nginx

# For custom networks, check if the DNS server is healthy
docker inspect <container> | grep -A 5 "Dns"
```

**Issue 4: Container can't reach other containers by name**

This usually means the containers are on different networks. Only containers on the same user-defined network can resolve each other by name.

```bash
# Check which networks each container is on
docker inspect --format '{{range .NetworkSettings.Networks}}{{.NetworkName}}{{"\n"}}{{end}}' <container1>
docker inspect --format '{{range .NetworkSettings.Networks}}{{.NetworkName}}{{"\n"}}{{end}}' <container2>

# If they're on different networks, connect one to the other's network
docker network connect <network-name> <container-name>
```

**Issue 5: Port conflicts between containers**

```bash
# Find what's listening on a specific port
sudo ss -tlnp | grep 8080
# Or: sudo lsof -i :8080

# List all published ports for all containers
docker ps --format "table {{.Names}}\t{{.Ports}}"

# Clean up stale Docker iptables rules
docker network prune
# Then restart Docker:
sudo systemctl restart docker
```

## Best Practices and Common Pitfalls

### DO: Use Custom Bridge Networks for Multi-Container Applications

The default bridge network lacks DNS resolution between containers. Always use custom bridge networks for applications with multiple containers:

```bash
# BAD: All containers on default bridge, no DNS between them
docker run --name web nginx
docker run --name db postgres

# GOOD: Custom bridge with DNS-based service discovery
docker network create myapp-net
docker run --name web --network myapp-net nginx
docker run --name db --network myapp-net postgres
# web can reach db via hostname: docker exec web ping db
```

> [!warning] Docker Compose Uses Custom Bridges Automatically
> When you use `docker-compose.yml`, Docker Compose automatically creates a custom bridge network and puts all services on it. This means service names are automatically resolved via DNS. The `--network` flag is NOT needed in compose files.

### DO: Bind to Specific Interfaces When Needed

```bash
# Only accessible from localhost
docker run -p 127.0.0.1:8080:80 nginx

# Only accessible from a specific network interface
docker run -p 192.168.1.10:8080:80 nginx

# Accessible from all interfaces (default, potentially less secure)
docker run -p 8080:80 nginx
```

> [!tip] Security Best Practice
> If the service doesn't need to be accessed from other machines, bind it to `127.0.0.1`. This prevents the service from being reachable from the network, reducing the attack surface.

### DO: Use `--network-alias` for Multiple Network Connections

When a container needs to be reachable by different names on different networks:

```bash
docker run --name api \
  --network frontend \
  --network-alias web-service \
  --network backend \
  --network-alias api-service \
  myapp
```

The container `api` is reachable as `web-service` on the `frontend` network and as `api-service` on the `backend` network.

### DON'T: Rely on the Default Bridge for New Projects

The default bridge is maintained for backward compatibility. It lacks DNS resolution and provides no isolation between containers. Always use custom bridges for new projects.

### DON'T: Manually Modify Docker's iptables Rules

Docker manages its own iptables rules. Manual modifications can be overwritten when containers start or stop. If you need custom firewall rules, use the `DOCKER-USER` chain:

```bash
# Rules in DOCKER-USER are NOT flushed by Docker
iptables -I DOCKER-USER -i eth0 -p tcp --dport 22 -j DROP
```

### DON'T: Use Host Networking Unless You Have a Specific Reason

Host networking removes network isolation and makes port management difficult. Only use it when you need the performance benefit or need to access the host's loopback interface.

> [!warning] Container Escape via Host Networking
> A container using host networking has access to all of the host's network interfaces and can potentially intercept or modify network traffic from other containers or services. This significantly increases the attack surface. In production, prefer bridge networking with explicit port publishing and firewall rules.

### Best Practice: Network Segmentation with Multiple Bridges

For production applications, create separate networks for different tiers:

```bash
# Frontend: public-facing
docker network create frontend

# Backend: internal services only
docker network create backend

# Data: database tier, no external access
docker network create data

# Deploy with appropriate network membership
docker run -d --name web --network frontend -p 80:80 nginx
docker run -d --name api --network frontend,backend myapi
docker run -d --name db --network data postgres

# Traffic flow:
# Internet → web (frontend) → api (frontend + backend) → db (data)
# The web container cannot directly reach the db (no shared network)
# The db container has NO public access at all
```

This segmentation provides defense-in-depth: even if an attacker compromises the `web` container, they cannot directly access the `db` container because they are on different networks.

## Key Concepts

1. **Containers have their own network namespace.** Each container gets an independent network stack (interfaces, routing table, iptables rules, port space) via Linux NET namespaces. This is the foundation of all Docker networking.

2. **veth pairs are the building blocks.** Every container connection to a Docker network uses a veth pair: one end in the container's namespace, the other end in the host's namespace, connected to a bridge or the host's network stack.

3. **The default bridge lacks DNS resolution.** Containers on Docker's default bridge (`docker0`) can only communicate by IP address, not by name. Always use custom bridge networks (`docker network create`) for multi-container applications to get built-in DNS-based service discovery.

4. **Port publishing is iptables NAT.** When you use `-p 8080:80`, Docker creates iptables DNAT rules that redirect traffic from the host's port 8080 to the container's port 80, plus MASQUERADE rules for return traffic. Understanding this helps diagnose port conflicts and connectivity issues.

5. **Overlay networks use VXLAN encapsulation.** For multi-host communication, overlay networks encapsulate container traffic in VXLAN packets (UDP 4789), allowing containers on different Docker hosts to communicate as if they were on the same LAN. This requires Swarm mode and a key-value store for service discovery.

## Related Articles

- [[02-infraestructura-contenedores/01-Docker-Fundamentos-Arquitectura-Aislamiento-Capas]] — Docker Fundamentals: Architecture, Isolation and Layers. Covers the Linux kernel features (namespaces, cgroups, unionfs) that make container networking possible.
- [[02-infraestructura-contenedores/03-Docker-Volumes-Storage]] — Docker Volumes and Storage: persistent data management. Networks and storage are the two primary persistence dimensions in Docker.
- [[02-infraestructura-contenedores/04-Docker-Compose]] — Docker Compose: multi-container orchestration for local development. Compose automatically creates custom bridge networks with DNS resolution.
- [[03-automatizacion-orchestracion/01-Kubernetes-Introduccion-Arquitectura]] — Kubernetes Introduction and Architecture. Kubernetes uses CNI plugins for pod networking, which is the next evolution of Docker networking at scale.
- [[01-fundamentos-internet/15-protocolos-red-internet]] — Internet and Network Protocols. Understanding TCP/IP, DNS, and routing is essential for troubleshooting container networking issues.
