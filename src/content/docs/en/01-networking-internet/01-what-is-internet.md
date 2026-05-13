---
title: "What Is the Internet?"
description: "Internet fundamentals: what it really is, the client-server model, the TCP/IP protocol suite, and how the network of networks works at the technical level."
---

# What Is the Internet?

> [!tip] To get started
> Think of the Internet as a global road network connecting cities (computers). Each city has addresses (IPs), there are delivery trucks (packets), and traffic protocols (TCP/IP) that ensure cargo reaches its destination.

## What is the Internet in technical terms?

The Internet is **a global network of interconnected networks** that uses the TCP/IP protocol suite to communicate. It is not a cable, not a cloud — it is a physical infrastructure formed by:

- **Millions of devices** (servers, routers, switches, computers, mobile phones)
- **Undersea and terrestrial fiber-optic cables** (yes, the vast majority of traffic travels under the ocean)
- **Data centers** around the world
- **Internet Service Providers (ISPs)** that connect their customers to the rest of the network

### The network of networks

Each network (of a company, a university, an ISP) connects to others through **Internet Exchange Points (IXPs)**. This is fundamental: the Internet is not owned by anyone. It is the result of thousands of independent networks that decided to communicate using the same rules.

```
Your ISP (Comcast/AT&T/Verizon)
       │
       ▼
┌─────────────────────┐
│    ISP Backbone      │──────┐
│  (100G fiber optics) │      │
└─────────────────────┘      │
       │                      │
       ▼                      ▼
┌─────────────────────┐  ┌─────────────────────┐
│      IXP             │  │    Edge Router      │
│ (exchange point)     │  │ (your home router)  │
└─────────────────────┘  └─────────────────────┘
       │                            │
       ▼                            ▼
Data Centers (CDNs, clouds)     Your home router
                                (192.168.1.1)
```

### The main actors

| Actor | What they do | Example |
|-------|-------------|---------|
| **ISP (Internet Service Provider)** | Sells Internet access to users and businesses | Comcast, AT&T, BT, Telmex |
| **IXP (Internet Exchange Point)** | Physical point where networks connect to each other | AMS-IX (Amsterdam), DE-CIX (Frankfurt), MEX-IX (Mexico City) |
| **Tier 1 ISP** | Networks covering entire continents, no transit payments | AT&T, NTT, Deutsche Telekom, Telmex |
| **CDN (Content Delivery Network)** | Distributed network of servers for content caching | Cloudflare, Akamai, Fastly, AWS CloudFront |
| **Data Center** | Facilities with servers, electrical and network redundancy | AWS, Google Cloud, Azure, Equinix |

> [!tip] How many cables are under the sea?
> There are more than **1.3 million kilometers** of undersea cables. If lined up end to end, they would circle the Earth 30 times. Internet traffic crosses oceans via these cables, not satellites.

## The client-server model

Most interactions on the Internet follow the **client-server** model:

| Role | What they do | Example |
|------|-------------|---------|
| **Client** | Initiates the connection, requests information | Your browser (Chrome, Firefox), curl, a mobile app |
| **Server** | Listens for connections, responds with data | A web server (Nginx, Apache, Caddy) |

### A concrete example

When you type `https://google.com` in your browser:

1. Your browser (client) sends a request
2. That request travels through your network → your ISP → the Internet → Google's server
3. Google's server responds with the HTML of the page
4. Your browser receives the HTML and renders it

But this is a massive oversimplification. What happens between steps 2 and 3 is the topic of the next article: [[02-url-to-page-journey]].

### Client-server vs P2P

The client-server model is not the only one:

| Model | Description | Example |
|-------|-------------|---------|
| **Client-server** | One server responds to many clients | Web, email, APIs |
| **P2P (peer-to-peer)** | Participants are both clients and servers | BitTorrent, Bitcoin, WebRTC |
| **Pub/Sub (publish/subscribe)** | One publisher sends, multiple subscribers receive | MQTT, Redis pub/sub, Kafka |

> [!note] P2P in practice
> While BitTorrent and Bitcoin are P2P, most of the Internet is still client-server. Online video games also use this model: your console connects to a centralized game server.

## The TCP/IP model

For all of this to work, devices need **a common language**. TCP/IP is that language: a set of protocols that defines how data is sent and received.

### Why TCP/IP and not something else?

Imagine two people from different countries trying to talk. If each speaks a different language, there is no communication. TCP/IP is the "common language" that every Internet device understands. It was designed in the 1970s by **Vint Cerf and Bob Kahn**, and has survived decades of technology because it is:

- **Simple**: Well-defined protocols, easy to implement
- **Extensible**: New protocols added without breaking existing ones
- **Scalable**: Works from a smartphone to a supercomputer

### TCP/IP layers (simplified)

Think of TCP/IP as a chain of wrapping layers:

```
┌─────────────────────────────────┐
│  Application Layer (HTTP, DNS)  │ ← Your "get /home" request
│  ┌─────────────────────────────┐│
│  │  Transport Layer (TCP)      │ ← "Split into pieces, order them, resend if lost"
│  │  ┌─────────────────────────┐│
│  │  │  Internet Layer (IP)    │ ← "Add destination address, find the route"
│  │  │  ┌─────────────────────┐│
│  │  │  │ Link Layer          │ ← "Put it on the cable/WiFi"
│  │  │  │ (Ethernet, WiFi)    ││
│  │  │  └─────────────────────┘│
│  │  └─────────────────────────┘│
│  └─────────────────────────────┘│
└─────────────────────────────────┘
```

Each layer **encapsulates** the information from the layer above:

```
Your message: "GET / HTTP/1.1"
  ↓ [Application layer adds HTTP]
GET / HTTP/1.1
  ↓ [Transport layer adds TCP]
[TCP header: src port, dst port, seq, ack] + "GET / HTTP/1.1"
  ↓ [Internet layer adds IP]
[IP header: src IP, dst IP] + [TCP header + data]
  ↓ [Link layer adds Ethernet]
[Ethernet header: src MAC, dst MAC] + [IP header + TCP + data]
  ↓ [Sent over cable/WiFi]
```

#### Application Layer

This is where HTTP, DNS, FTP, SMTP, SSH, and WebSocket live. It is the layer you interact with directly. Each application protocol defines its own message format and semantics.

**Main protocols:**

| Protocol | Port | Function |
|----------|------|----------|
| HTTP | 80 | Web transfer |
| HTTPS | 443 | Encrypted HTTP (HTTP over TLS) |
| DNS | 53 | Name resolution |
| SMTP | 25 | Email sending |
| IMAP/POP3 | 143/993 / 110/995 | Email receiving |
| SSH | 22 | Secure remote access |
| FTP | 21 | File transfer |
| WebSocket | 443 (or 80) | Real-time bidirectional communication |

> [!tip] Your browser uses multiple protocols simultaneously
> When you visit a web page, your browser uses:
> 1. **DNS** (port 53, UDP) to resolve the domain
> 2. **TCP** (port 443) to establish the connection
> 3. **TLS** (port 443) to encrypt
> 4. **HTTP** (port 443) to request the page
> 5. **WebSocket** (optional) for real-time updates

#### Transport Layer (TCP vs UDP)

This layer decides **how** data is sent:

| Characteristic | TCP (Transmission Control Protocol) | UDP (User Datagram Protocol) |
|----------------|-------------------------------------|------------------------------|
| **Reliability** | Guarantees everything arrives (resends lost data) | Best-effort (may lose packets) |
| **Order** | Data arrives in order | No order guarantee |
| **Speed** | Slower (acknowledgment overhead) | Faster |
| **Connection** | Connection-oriented (handshake) | Connectionless |
| **Flow control** | Yes (window size) | No |
| **Congestion control** | Yes (slow start, congestion avoidance) | No |
| **Typical use** | Web (HTTP), email, FTP | Streaming, video games, DNS |

**Why does HTTP use TCP?** Because you need all images, all HTML, all CSS to arrive complete and in order. If one byte of an image is lost, the image is corrupted. TCP guarantees that won't happen.

**Why does DNS use UDP?** A DNS query is very small (a few dozen bytes). If it is lost, the client resends. It is faster. However, if the response exceeds 512 bytes, DNS uses TCP.

**Why does video streaming often use UDP?** If a video frame is lost, it does not matter — the next frame arrives in its place. What matters is speed and smoothness, not perfection.

> [!tip] Mnemonic rule
> - If data **must arrive complete** (web page, email, file) → TCP
> - If **speed** matters more than perfection (live video, voice, DNS) → UDP

#### Internet Layer (IP)

IP (Internet Protocol) is responsible for:
- **Addressing**: Each device has a unique IP address in its network
- **Routing**: Finding the most efficient path between source and destination

Your device has a private IP (e.g., 192.168.1.5) within your local network, and your router has a public IP that is visible on the Internet. The connection between the two is **NAT**, which you can read about in [[13-nat]].

**IPv4 vs IPv6:**

| | IPv4 | IPv6 |
|--|------|------|
| **Size** | 32 bits (4 bytes) | 128 bits (16 bytes) |
| **Format** | 192.168.1.1 | 2001:0db8:85a3::8a2e:370:7334 |
| **Addresses** | ~4.3 billion | ~3.4 × 10³⁸ |
| **Header** | 20-60 bytes | 40 bytes fixed |
| **Auto-configuration** | Requires DHCP | SLAAC (no DHCP needed) |
| **Security** | IPsec optional | IPsec built-in |

> [!caution] IPv4 address exhaustion
> IPv4 addresses were officially exhausted in 2011. NAT allowed us to extend them, but IPv6 is the definitive solution. Every device can have its own public IP without needing NAT.

#### Link Layer

Ethernet, WiFi, Bluetooth. This is the layer closest to your hardware. Here, **MAC addresses** (physical network card addresses) are defined.

**What is a MAC address?** It is a unique address assigned by the manufacturer of your network card. It consists of 6 pairs of hexadigits: `00:1A:2B:3C:4D:5E`. It does not change (unless you spoof it), unlike an IP address that can change every time you connect to a network.

### What you need to understand about TCP/IP

- **Data travels fragmented**: No HTTP request is sent as one giant block. It is split into **packets** of ~1500 bytes (MTU — Maximum Transmission Unit).
- **Each packet carries**: The destination address, a sequence number, checksums (to verify integrity), and other metadata.
- **Routers only look at the Internet layer**: Internet routers only see source and destination IPs. They do not know what the packet contains (HTTP, DNS, whatever).
- **TCP reassembles at destination**: The server (or client) reorders packets by sequence number and reconstructs the original message.
- **Switches work at the Link layer, routers at the Internet layer**: This distinction is fundamental to understanding networking.

### The OSI model: 7 layers vs TCP/IP: 4 layers

There is another networking model you will see in textbooks: the **OSI model** (Open Systems Interconnection), which has 7 layers. TCP/IP is more practical with 4. Both models describe the same thing, but with different levels of detail:

| OSI Model (7 layers) | TCP/IP Model (4 layers) | Protocols |
|---------------------|------------------------|------------|
| 7. Application | 4. Application | HTTP, DNS, SMTP, SSH |
| 6. Presentation | | SSL/TLS, JPEG, GIF |
| 5. Session | | NetBIOS, RPC |
| 4. Transport | 3. Transport | TCP, UDP |
| 3. Network | 2. Internet | IP, ICMP, ARP |
| 2. Data Link | 1. Network Access | Ethernet, WiFi, ARP |
| 1. Physical | | Cables, hubs, fiber |

> [!tip] Which one to use?
> In practice, TCP/IP is the model actually used. OSI is useful for understanding concepts and diagnostics (when something fails, you can identify which layer it is). We will cover the OSI model in detail in [[15-osi-model-tcpip]].

## Connection with the rest of the wiki

| Concept | Next article |
|---------|-------------|
| What happens after typing a URL? | [[02-url-to-page-journey]] — The full journey |
| What is that IP address? | [[03-dns-deep-dive]] — DNS, [[12-ports]] — Ports and IPs |
| How does data travel? | [[14-servers-processes]] — Servers and processes |
| What is a web server? | [[14-servers-processes]] — A server is a process listening on a port |

## Summary

- The Internet is a **network of networks**, not a single entity.
- It works because everyone uses **TCP/IP**, a globally agreed set of rules.
- The **client-server** model is the most common form of interaction: a client requests, a server responds.
- Data travels **fragmented in packets** through multiple routers.
- TCP guarantees reliability (everything arrives), UDP prioritizes speed.
- Each TCP/IP layer has a specific function: application (data), transport (reliability), internet (routing), link (hardware).

> [!quote] The key takeaway
> The Internet is not magic. It is a chain of processes, each with a specific job, connected by protocols that everyone understands. If you understand what each piece does, you understand the Internet.
