---
title: "Routing, Subnetting, CIDR: Packet Routing, Subnet Masks, VLSM, Route Summarization"
description: "Packet routing, subnetting, CIDR notation, subnet masks, VLSM, route summarization, and how routers make forwarding decisions between networks."
---

# Routing, Subnetting, CIDR: Packet Routing, Subnet Masks, VLSM, Route Summarization

> [!tip] Routing in a nutshell
> **Routing** is the process of deciding where to send a network packet. Each router consults its routing table and chooses the best path to the destination. **Subnetting** is dividing a large network into smaller subnets. **CIDR** is the notation used to describe these networks. This article covers all three in depth.

## What is routing?

**Routing** is the process of selecting paths for traffic on a network. When a packet needs to go from your PC to a server on another continent, it passes through multiple routers, each making a decision about where to send the packet next.

### The IP packet and the routing table

Each router maintains a **routing table** that tells it where to send each destination:

```
Typical routing table:
┌──────────────────┬──────────────────┬──────────────┬──────────┐
│ Destination      │ Next Hop         │ Interface    │ Metric   │
├──────────────────┼──────────────────┼──────────────┼──────────┤
│ 192.168.1.0/24   │ Direct           │ eth0         │ 0        │
│ 0.0.0.0/0        │ 10.0.0.1         │ eth1         │ 100      │ ← Default route
│ 10.0.0.0/8       │ 192.168.1.100    │ eth0         │ 20       │
│ 172.16.0.0/12    │ 10.0.0.5         │ eth1         │ 30       │
└──────────────────┴──────────────────┴──────────────┴──────────┘
```

**Fields:**
- **Destination**: The network destination (in CIDR format)
- **Next Hop**: The next router to forward to (or "Direct" if on the local network)
- **Interface**: The network interface to send through
- **Metric**: The cost of the route (lower = better)

### Longest Prefix Match

When a packet arrives at a router, the router looks for the **longest matching prefix** (most specific):

```
Packet with destination: 172.16.5.10
Router's table:
  172.16.0.0/12  → Next Hop A
  172.16.5.0/24  → Next Hop B
  0.0.0.0/0      → Default

The router finds the longest match:
  172.16.5.0/24 → 24 bits match → MOST SPECIFIC → Use Next Hop B
```

> [!tip] Why longest prefix?
> A more specific route (longer prefix) is always better than a less specific one. A /24 subnet is more specific than a /12 supernetwork, which is more specific than the default route.

## CIDR (Classless Inter-Domain Routing)

CIDR is the notation used to describe IP networks and their size:

```
Format:  IP_address/prefix_length
Example: 192.168.1.0/24

The /24 means the first 24 bits are the network portion, the remaining 8 bits are for hosts.
```

### Understanding CIDR notation

```
192.168.1.0/24:
  Network:  192.168.1.0    (first 24 bits)
  Host:     0.0.0.0 - 255.255.255.255  (last 8 bits)
  Total IPs: 2^(32-24) = 2^8 = 256
  Usable:    256 - 2 = 254 (network + broadcast addresses reserved)
  Range:     192.168.1.1 - 192.168.1.254

10.0.0.0/8:
  Network:  10.0.0.0       (first 8 bits)
  Host:     0.0.0.0 - 255.255.255.255  (last 24 bits)
  Total IPs: 2^(32-8) = 2^24 = 16,777,216
  Usable:    16,777,214

172.16.0.0/12:
  Network:  172.16.0.0     (first 12 bits)
  Host:     0.0.0.0 - 15.255.255.255  (last 20 bits)
  Total IPs: 2^(32-12) = 2^20 = 1,048,576
  Usable:    1,048,574
```

### CIDR to subnet mask conversion

| CIDR | Subnet Mask | Wildcard Mask | Host bits | Usable hosts |
|------|-------------|---------------|-----------|-------------|
| /8   | 255.0.0.0   | 0.255.255.255 | 24        | 16,777,214  |
| /12  | 255.240.0.0 | 0.15.255.255  | 20        | 1,048,574   |
| /16  | 255.255.0.0 | 0.0.255.255   | 16        | 65,534      |
| /20  | 255.255.240.0 | 0.0.15.255  | 12        | 4,094       |
| /24  | 255.255.255.0 | 0.0.0.255   | 8         | 254         |
| /26  | 255.255.255.192 | 0.0.0.63  | 6         | 62          |
| /27  | 255.255.255.224 | 0.0.0.31  | 5         | 30          |
| /28  | 255.255.255.240 | 0.0.0.15  | 4         | 14          |
| /30  | 255.255.255.252 | 0.0.0.3   | 2         | 2           |
| /32  | 255.255.255.255 | 0.0.0.0   | 0         | 1 (single host) |

### Binary calculation

```
CIDR /26 subnet mask:
11111111.11111111.11111111.11000000
= 255.255.255.192

CIDR /28 subnet mask:
11111111.11111111.11111111.11110000
= 255.255.255.240

Wildcard mask = bitwise NOT of subnet mask:
  /24:  255.255.255.0 → 0.0.0.255
  /26:  255.255.255.192 → 0.0.0.63
  /28:  255.255.255.240 → 0.0.0.15
```

## Subnetting: Dividing networks

**Subnetting** is the process of dividing a large network into smaller sub-networks (subnets).

### Why subnet?

| Reason | Benefit |
|--------|---------|
| **Security** | Isolate departments, limit broadcast domains |
| **Performance** | Reduce broadcast traffic, improve efficiency |
| **Organization** | Logical grouping (HR, Engineering, IoT) |
| **Address management** | Use IP space efficiently |

### Subnetting example

Starting with: `192.168.1.0/24` (254 usable hosts)

Need to create subnets for:
- Engineering: 50 hosts
- HR: 10 hosts
- IoT devices: 5 hosts
- Point-to-point links: 2 hosts each

```
Solution using VLSM (Variable Length Subnet Masking):

1. Engineering: Need 50 hosts → /26 (62 usable hosts)
   192.168.1.0/26
   Range: 192.168.1.1 - 192.168.1.62
   Broadcast: 192.168.1.63

2. HR: Need 10 hosts → /28 (14 usable hosts)
   192.168.1.64/28
   Range: 192.168.1.65 - 192.168.1.78
   Broadcast: 192.168.1.79

3. IoT: Need 5 hosts → /29 (6 usable hosts)
   192.168.1.80/29
   Range: 192.168.1.81 - 192.168.1.86
   Broadcast: 192.168.1.87

4. Link to ISP: Need 2 hosts → /30 (2 usable hosts)
   192.168.1.88/30
   Range: 192.168.1.89 - 192.168.1.90
   Broadcast: 192.168.1.91

Remaining: 192.168.1.92/30 to 192.168.1.255/32 available for future use
```

### VLSM (Variable Length Subnet Masking)

VLSM allows different subnets within the same network to have different sizes:

```
Traditional (fixed-length):
  192.168.1.0/26  → 62 hosts each → All 4 subnets get 62 hosts
  → HR uses 10 of 62 → 52 wasted IPs!

VLSM:
  192.168.1.0/26  → Engineering: 62 hosts (50 used, 12 wasted)
  192.168.1.64/28 → HR: 14 hosts (10 used, 4 wasted)
  192.168.1.80/29 → IoT: 6 hosts (5 used, 1 wasted)
  → Efficient use of IP addresses
```

> [!tip] VLSM is mandatory with CIDR
> Classful networking (fixed subnet sizes) is obsolete. CIDR + VLSM allow efficient IP address allocation.

### Supernetting (Route Aggregation)

Combining multiple smaller networks into a single larger route:

```
Four /24 networks:
  192.168.1.0/24
  192.168.2.0/24
  192.168.3.0/24
  192.168.4.0/24

Can be aggregated to:
  192.168.0.0/22

Router only needs ONE route entry instead of four!
```

```
Binary comparison:
  192.168.1.0  = 11000000.10101000.00000001.00000000
  192.168.2.0  = 11000000.10101000.00000010.00000000
  192.168.3.0  = 11000000.10101000.00000011.00000000
  192.168.4.0  = 11000000.10101000.00000100.00000000

Common prefix: 11000000.10101000.000000  (22 bits)
Result: 192.168.0.0/22
```

## Route types

### Static routes

Manually configured by the network administrator:

```bash
# Linux: Add a static route
sudo ip route add 10.0.0.0/8 via 192.168.1.1
sudo ip route add default via 192.168.1.1

# Nginx: Show routing table
ip route show
# default via 192.168.1.1 dev eth1 proto dhcp metric 100
# 10.0.0.0/8 via 192.168.1.1 dev eth0 proto static metric 20
# 192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.10 metric 100
```

**Pros:** Simple, predictable, no overhead
**Cons:** Must be manually updated, doesn't adapt to failures

### Dynamic routes (routing protocols)

#### OSPF (Open Shortest Path First)

Link-state routing protocol used within a single organization (Interior Gateway Protocol):

```
Router 1 ─── Router 2 ─── Router 3
    │              │              │
    └──────────────┴──────────────┘

OSPF:
1. All routers discover neighbors
2. Each router builds a map of the entire network (link-state database)
3. Each router runs Dijkstra's algorithm to calculate shortest paths
4. Each router builds its own routing table
5. If a link fails, routers recalculate

Key features:
  - Convergence: All routers eventually have the same view
  - Fast convergence: Routes update quickly when topology changes
  - Uses SPF (Shortest Path First) algorithm
  - Area-based: Hierarchical (Area 0 = backbone)
  - Metric: Cost based on bandwidth
```

#### BGP (Border Gateway Protocol)

Path-vector routing protocol used between organizations (Exterior Gateway Protocol). BGP is what makes the Internet work:

```
AS 64500 (MyCompany)  ────  AS 1299 (Telia)  ────  AS 3356 (Level3)
       │                         │                         │
       └─────────────────────────┴─────────────────────────┘

BGP:
1. Each AS announces its IP prefixes to neighbors
2. BGP peers exchange routing information
3. Route selection based on multiple attributes:
   - AS Path length (shorter is better)
   - Local Preference (higher is better)
   - MED (lower is better)
   - Origin type (IGP > EGP > Incomplete)
4. No shortest-path algorithm — policy-based routing
5. Convergence can take minutes, not seconds

Key features:
  - Policy-based (not just shortest path)
  - Path vector (not link-state)
  - Handles thousands of routes per peer
  - Uses TCP (port 179) for reliable communication
  - The protocol that actually runs the Internet
```

### Default route

The default route (0.0.0.0/0) is used when no more specific route matches:

```
Packet destination: 8.8.8.8

Routing table:
  10.0.0.0/8     → 192.168.1.100 (no match)
  172.16.0.0/12  → 10.0.0.5 (no match)
  0.0.0.0/0      → 192.168.1.1 (MATCH!)

→ Forward to gateway 192.168.1.1
```

## Practical subnetting calculations

### How to calculate subnet information

Given: `192.168.10.50/27`

```
Step 1: Determine network address
  /27 = 255.255.255.224
  IP:   11000000.10101000.00001010.00110010
  Mask: 11111111.11111111.11111111.11100000
  AND:  11000000.10101000.00001010.00100000
  = 192.168.10.32 (Network address)

Step 2: Determine broadcast address
  Network: 11000000.10101000.00001010.00100000
  Host all 1s: 11000000.10101000.00001010.00111111
  = 192.168.10.63 (Broadcast address)

Step 3: Usable range
  First host:  192.168.10.33
  Last host:   192.168.10.62

Step 4: Number of hosts
  Host bits: 32 - 27 = 5
  Total IPs: 2^5 = 32
  Usable: 32 - 2 = 30
```

### Quick reference table

| Subnet | Network | First Host | Last Host | Broadcast | Usable |
|--------|---------|-----------|-----------|-----------|--------|
| 192.168.1.0/25 | .0 | .1 | .126 | .127 | 126 |
| 192.168.1.128/25 | .128 | .129 | .254 | .255 | 126 |
| 10.0.0.0/26 | .0 | .1 | .62 | .63 | 62 |
| 10.0.0.64/26 | .64 | .65 | .126 | .127 | 62 |
| 10.0.0.128/26 | .128 | .129 | .190 | .191 | 62 |
| 10.0.0.192/26 | .192 | .193 | .254 | .255 | 62 |

## Connection with the rest of the wiki

| Concept | In-depth article |
|---------|-----------------|
| What is Internet | [[01-what-is-internet]] |
| Ports | [[12-ports]] |
| NAT | [[13-nat]] |
| OSI Model | [[15-osi-model-tcpip]] |

## Summary

- **Routing** is how packets find their way across networks; each router uses a routing table to make forwarding decisions.
- **CIDR** notation (/prefix) describes networks and their size — the prefix is the number of bits in the network portion.
- **Subnetting** divides a large network into smaller subnets for security, organization, and efficiency.
- **VLSM** allows subnets of different sizes within the same address space.
- **Route summarization** combines multiple routes into a single entry, reducing routing table size.
- **OSPF** is for internal routing (within an organization); **BGP** is for external routing (between organizations, i.e., the Internet).
- Always choose the right subnet size to avoid wasting IP addresses.

> [!quote] The key takeaway
> Routing and subnetting are fundamental networking skills. Whether you're designing a home network, configuring a cloud VPS, or troubleshooting connectivity, understanding CIDR, subnet masks, and longest prefix match is essential.
