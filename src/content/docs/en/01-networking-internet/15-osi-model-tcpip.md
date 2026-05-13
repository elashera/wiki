---
title: "OSI Model and TCP/IP: Layers, Protocols, Internal Functioning"
description: "OSI model explained: 7 layers, protocols, encapsulation, how each layer works internally, and comparison with the TCP/IP model."
---

# OSI Model and TCP/IP: Layers, Protocols, Internal Functioning

> [!tip] OSI in a nutshell
> The OSI (Open Systems Interconnection) model is a conceptual framework of **7 layers** that describes how systems communicate over a network. Each layer has specific responsibilities and communicates with adjacent layers. This article covers every layer in detail.

## What is the OSI model?

The **OSI model** was created by ISO in 1984 as a standard for understanding network communication. It divides communication into **7 layers**, each with well-defined responsibilities.

It is not the model actually implemented in practice (TCP/IP is the real-world model), but it is fundamental for understanding networking concepts and diagnosing problems.

### The 7 layers

```
┌────────────────────────────────────────────┐
│  7. Application    (HTTP, DNS, SMTP, FTP)  │ ← What the user sees
│  6. Presentation   (SSL/TLS, encryption)   │ ← How data looks
│  5. Session        (managing sessions)     │ ← How systems converse
│  4. Transport      (TCP, UDP)              │ ← How data is sent
│  3. Network        (IP, routing)           │ ← How data arrives
│  2. Data Link      (Ethernet, WiFi, MAC)   │ ← How data moves on cable
│  1. Physical       (cables, fiber, WiFi)   │ ← The physical bits
└────────────────────────────────────────────┘
```

> [!tip] Mnemonic
> From top to bottom: **"All People Seem To Need Data Processing"**
> 1. **A**pplication → 2. **P**resentation → 3. **S**ession → 4. **T**ransport → 5. **N**etwork → 6. **D**ata Link → 7. **P**hysical

## Layer 7: Application

The application layer is the only layer that **interacts directly with user software**. This is where protocols we use every day live: HTTP, DNS, SMTP, FTP, SSH, WebSocket.

**Responsibility:** Provide network services directly to applications.

**Protocols:**
| Protocol | Port | Function |
|----------|------|----------|
| HTTP | 80 | Web transfer |
| HTTPS | 443 | Encrypted web transfer |
| DNS | 53 | Name resolution |
| SMTP | 25 | Email sending |
| IMAP | 993 | Email receiving |
| SSH | 22 | Secure remote access |
| FTP | 21 | File transfer |

### What the application layer does

The application layer defines:
- **Data format**: How the message is structured (JSON, XML, HTML, binary)
- **Semantics**: What the data means (GET = retrieve, POST = create)
- **Error reporting**: How to report errors to the user
- **Session establishment**: How to start/end a conversation with another application

```
Application layer PDU (Protocol Data Unit) = MESSAGE
Example: "GET /index.html HTTP/1.1\r\nHost: example.com\r\n\r\n"
```

## Layer 6: Presentation

The presentation layer is responsible for **data translation, encryption, and compression**. It ensures that data sent by the application layer of one system can be read by the application layer of another system.

### What the presentation layer does

| Function | Description | Example |
|----------|-------------|---------|
| **Encryption** | Encrypts data for confidentiality | TLS/SSL, IPsec |
| **Decryption** | Decrypts received data | TLS/SSL, IPsec |
| **Compression** | Reduces data size for transfer | gzip, JPEG, MPEG |
| **Decompression** | Restores compressed data | gunzip, JPEG decode |
| **Translation** | Converts data formats | JSON ↔ XML, ASCII ↔ UTF-8 |

### Encryption in practice (TLS at the Presentation layer)

```
Before sending (encrypt):
  Plain text:  "GET /index.html HTTP/1.1"
  ↓ TLS encrypts
  Cipher text: "U8x#kLm!pQz$7yR$tWn@jHv"

After receiving (decrypt):
  Cipher text: "U8x#kLm!pQz$7yR$tWn@jHv"
  ↓ TLS decrypts
  Plain text:  "GET /index.html HTTP/1.1"
```

> [!note] TLS as presentation layer
> While TLS operates at the boundary between layers 4 and 5, it is most commonly associated with the presentation layer because its job is to transform (encrypt) data before handing it to the session/application layer.

### Compression

```
Original data (HTML page): 50,000 bytes
After gzip compression:     12,000 bytes (76% reduction)
After brotli compression:   10,500 bytes (79% reduction)

HTTP header: Accept-Encoding: gzip, br
→ Server sends compressed data
→ Browser decompresses and renders
```

### Translation

```
Client sends: {"name": "José", "lang": "es"} (UTF-8)
Server receives: {"name": "José", "lang": "es"} (UTF-8)

If the client and server use different character encodings:
  Client: Windows-1252 → "José"
  Server: UTF-8 → "JosÃ©" (garbled without proper encoding)

The presentation layer handles the conversion so the application sees
the correct data regardless of encoding differences.
```

## Layer 5: Session

The session layer establishes, manages, and terminates **connections (sessions)** between applications.

### What the session layer does

| Function | Description | Example |
|----------|-------------|---------|
| **Session establishment** | Start a conversation between applications | TCP three-way handshake |
| **Session management** | Maintain state during the conversation | Keep-alive, session cookies |
| **Session termination** | End the conversation cleanly | TCP FIN handshake |
| **Dialog control** | Coordinate who talks when | Half-duplex vs full-duplex |
| **Synchronization** | Insert checkpoints for recovery | FTP checkpoint/restore |

### Session management in practice

```
# Session cookies (Layer 7 + 5 working together)
Server → Browser: Set-Cookie: session_id=xyz789; Path=/; HttpOnly; Secure

Browser → Server (every subsequent request):
Cookie: session_id=xyz789

Server looks up session_id=xyz789 → finds user data → serves personalized content
```

### Session examples

```
Telnet session:
  1. Client connects to server:telnet → Session established
  2. User types commands → Session active
  3. User disconnects → Session terminated

HTTP keep-alive:
  1. Client opens TCP connection → Session starts
  2. Multiple HTTP requests on same connection → Session continues
  3. Connection times out or closes → Session ends
```

## Layer 4: Transport

The transport layer is responsible for **end-to-end communication**, reliability, flow control, and congestion control.

### Two transport protocols

| Feature | TCP (Transmission Control Protocol) | UDP (User Datagram Protocol) |
|---------|-------------------------------------|------------------------------|
| **Reliability** | Guaranteed delivery | Best-effort (may lose packets) |
| **Order** | Data arrives in order | No order guarantee |
| **Speed** | Slower (acknowledgment overhead) | Faster |
| **Connection** | Connection-oriented (handshake) | Connectionless |
| **Flow control** | Yes (window size) | No |
| **Congestion control** | Yes (slow start, congestion avoidance) | No |
| **Header size** | 20–60 bytes | 8 bytes |
| **Use case** | Web, email, file transfer | Streaming, VoIP, DNS, gaming |

### TCP header structure

```
TCP Header (20 bytes minimum):
┌─────────────────────────────────────────────────────┐
│  Source Port   │  Destination Port   │  Sequence #   │
│  (16 bits)     │  (16 bits)          │  (32 bits)    │
├─────────────────────────────────────────────────────┤
│  Ack Number    │  Data Offset │ R |W|S|R|P|S|S|H|T|R|C│
│  (32 bits)     │  (4 bits)    │ F|A|F|R|F|F|F|E|N|N│ │
├─────────────────────────────────────────────────────┤
│  Window Size   │  Checksum   │ Urgent Pointer │      │
│  (16 bits)     │  (16 bits)  │  (16 bits)     │      │
├─────────────────────────────────────────────────────┤
│                    Options (optional)                │
└─────────────────────────────────────────────────────┘
```

**Key fields:**
- **Sequence number**: Tracks the order of bytes sent
- **Acknowledgment number**: Tells the sender which byte was received next
- **Window size**: How many bytes the receiver can accept (flow control)
- **Flags**: SYN, ACK, FIN, RST, PSH, URG (control connection state)
- **Checksum**: Error detection for the header and data

### TCP connection states

```
Client side:
  CLOSED → SYN_SENT → ESTABLISHED → FIN_WAIT_1 → FIN_WAIT_2 → TIME_WAIT → CLOSED

Server side:
  CLOSED → LISTEN → SYN_RCVD → ESTABLISHED → CLOSE_WAIT → LAST_ACK → CLOSED

3-way handshake:
  Client:  SYN ───────────────────→ Server
  Server:  SYN-ACK ────────────────→ Client
  Client:  ACK ────────────────────→ Server

4-way teardown:
  Client:  FIN ───────────────────→ Server  (client done sending)
  Server:  ACK ────────────────────→ Client  (got the FIN)
  Server:  FIN ───────────────────→ Client  (server done sending)
  Client:  ACK ────────────────────→ Server  (got the FIN)
```

### TCP flow control (window size)

```
Receiver has 10,000 bytes of buffer space available.

Client sends: "I can receive 10,000 bytes (window size = 10000)"
Server sends: up to 10,000 bytes before waiting for ACK
Receiver sends: "My window is now 5,000 bytes" (processed half)
Server adjusts: sends up to 5,000 bytes

If window = 0 → sender stops (receiver buffer full)
```

### TCP congestion control

```
TCP uses congestion control to avoid overwhelming the network:

1. Slow Start:
   - Start with small window (1-2 MSS)
   - Double the window every RTT (exponential growth)
   - Until congestion threshold is reached

2. Congestion Avoidance:
   - Increase window by 1 MSS per RTT (linear growth)
   - Gradual, conservative approach

3. Fast Retransmit:
   - If 3 duplicate ACKs arrive, retransmit immediately
   - Don't wait for timeout

4. Fast Recovery:
   - Reduce window size after fast retransmit
   - Enter congestion avoidance mode

Slow Start → (congestion) → Congestion Avoidance → (dup ACKs) → Fast Retransmit
         → (timeout) → Congestion Avoidance → Slow Start
```

## Layer 3: Network

The network layer is responsible for **logical addressing and routing**.

### What the network layer does

| Function | Description | Protocol |
|----------|-------------|----------|
| **Logical addressing** | Assigns IP addresses | IPv4, IPv6 |
| **Routing** | Finds the best path between networks | OSPF, BGP, EIGRP |
| **Fragmentation** | Splits packets to fit MTU | IP |
| **Packet forwarding** | Moves packets from one interface to another | IP |

### IPv4 packet structure

```
IP Header (20 bytes minimum):
┌──────────────────────────────────────────────────────────┐
│  Version (4) │ IHL (4) │  DSCP (6) │ ECN (2) │         │
├──────────────────────────────────────────────────────────┤
│              Total Length (16 bits)                       │
├──────────────────────────────────────────────────────────┤
│  Identification (16) │ Flags (3) │ Fragment Offset (13)  │
├──────────────────────────────────────────────────────────┤
│   TTL (8)  │  Protocol (8) │     Header Checksum (16)    │
├──────────────────────────────────────────────────────────┤
│                   Source IP Address (32 bits)             │
├──────────────────────────────────────────────────────────┤
│                  Destination IP Address (32 bits)         │
├──────────────────────────────────────────────────────────┤
│                    Options (optional)                     │
└──────────────────────────────────────────────────────────┘
```

### Routing at Layer 3

```
Packet travels:
  Client (192.168.1.5) → Router (192.168.1.1) → ISP → Internet → Server (93.184.216.34)

Each router makes a forwarding decision based on the destination IP:

Router 1: "Destination 93.184.216.34 → Next hop: 10.0.0.1 (ISP)"
Router 2: "Destination 93.184.216.34 → Next hop: 172.16.0.1 (Peer ISP)"
Router 3: "Destination 93.184.216.34 → Next hop: 10.1.0.5 (Cloudflare)"
Router 4: "Destination 93.184.216.34 → Directly connected → Deliver to 93.184.216.34"
```

### ICMP (Internet Control Message Protocol)

ICMP is a Layer 3 protocol used for diagnostics:

```bash
# Ping uses ICMP Echo Request / Echo Reply
ping 93.184.216.34
# PING 93.184.216.34 (93.184.216.34): 56 data bytes
# 64 bytes from 93.184.216.34: icmp_seq=0 ttl=56 time=42.3 ms
# 64 bytes from 93.184.216.34: icmp_seq=1 ttl=56 time=38.7 ms

# Traceroute uses ICMP Time Exceeded messages
traceroute 93.184.216.34
#  1  192.168.1.1 (192.168.1.1)  1.234 ms
#  2  10.0.0.1 (10.0.0.1)  5.678 ms
#  3  172.16.0.1 (172.16.0.1)  23.456 ms
#  ...
# 12  93.184.216.34 (93.184.216.34)  42.345 ms
```

## Layer 2: Data Link

The data link layer is responsible for **physical addressing and error detection** on a local network segment.

### What the data link layer does

| Function | Description | Standard |
|----------|-------------|----------|
| **Physical addressing** | MAC addresses (48-bit) | IEEE 802 |
| **Framing** | Packages data into frames | Ethernet, PPP |
| **Error detection** | CRC checksums | Ethernet FCS |
| **Flow control** | regulates data rate | IEEE 802.3 |
| **Access control** | Who can transmit on the medium | CSMA/CD, CSMA/CA |

### Ethernet frame structure

```
Ethernet Frame:
┌──────────────────────────────────────────────────────────────┐
│  Preamble (8 bytes) │ Destination MAC (6) │ Source MAC (6) │
├──────────────────────────────────────────────────────────────┤
│  Type (2) │          Payload (46-1500 bytes)               │
├──────────────────────────────────────────────────────────────┤
│  Frame Check Sequence (FCS) (4 bytes)                        │
└──────────────────────────────────────────────────────────────┘

Type field:
  0x0800 → IPv4
  0x86DD → IPv6
  0x0806 → ARP
  0x8100 → VLAN-tagged

MAC address: 6 bytes (48 bits), unique to the network interface
Format: 00:1A:2B:3C:4D:5E
  First 3 bytes = Organizationally Unique Identifier (OUI)
  Last 3 bytes = Network interface controller (NIC) specific
```

### ARP (Address Resolution Protocol)

ARP maps IP addresses to MAC addresses on the local network:

```
# Device A wants to send data to Device B
# Device A knows: 192.168.1.10 (IP of B)
# Device A needs: MAC address of B

# ARP Request (broadcast):
"Who has 192.168.1.10? Tell 192.168.1.5"
Dest MAC: FF:FF:FF:FF:FF:FF (broadcast to all devices)

# ARP Reply (unicast):
"I have 192.168.1.10, my MAC is AA:BB:CC:DD:EE:FF"
Dest MAC: AA:BB:CC:DD:EE:FF (to Device A)

# Device A caches the mapping:
192.168.1.10 → AA:BB:CC:DD:EE:FF (TTL: 15 minutes)
```

```bash
# View ARP cache
ip neigh show
# 192.168.1.1 dev eth0 lladdr aa:bb:cc:dd:ee:ff REACHABLE
# 192.168.1.10 dev eth0 lladdr 11:22:33:44:55:66 STALE

# Clear ARP cache
ip neigh flush all
```

## Layer 1: Physical

The physical layer is responsible for **transmitting raw bits over a physical medium**.

### What the physical layer does

| Function | Description | Example |
|----------|-------------|---------|
| **Bits to signals** | Converts digital data to physical signals | Electrical, optical, RF |
| **Signal encoding** | How bits are represented | NRZ, Manchester encoding |
| **Physical topology** | How devices are connected | Bus, star, mesh, ring |
| **Transmission mode** | Direction of data flow | Simplex, half-duplex, full-duplex |
| **Hardware** | Cables, connectors, transceivers | RJ45, fiber optic, antennas |

### Physical media

| Medium | Speed | Distance | Example |
|--------|-------|----------|---------|
| **Twisted pair (Cat 5e)** | 1 Gbps | 100m | Ethernet cables |
| **Twisted pair (Cat 6)** | 10 Gbps | 55m | Modern Ethernet |
| **Fiber optic (single-mode)** | 100+ Gbps | 100km+ | Long-haul, data centers |
| **Fiber optic (multi-mode)** | 40 Gbps | 550m | Short-range data centers |
| **Coaxial cable** | 1 Gbps | 500m | Cable Internet |
| **Radio (WiFi)** | 1-10 Gbps | 50-300m | WiFi 6/6E/7 |
| **Radio (5G)** | 1-20 Gbps | 1-10 km | Cellular |

## Data encapsulation: A complete example

When you send an HTTP request, data passes through all 7 layers:

```
Layer 7 - Application:
  "GET /index.html HTTP/1.1\r\nHost: example.com\r\n\r\n"
  (HTTP message)

Layer 6 - Presentation:
  [Encrypted by TLS]: "U8x#kLm!pQz$7yR$tWn@jHv..."
  (encrypted HTTP)

Layer 5 - Session:
  [Session identifier added]: {session_id: "xyz789"}
  (encrypted HTTP + session)

Layer 4 - Transport (TCP):
  [TCP Header: src=54321, dst=443, seq=1000, ack=0, flags=SYN]
  + encrypted HTTP + session
  → TCP Segment

Layer 3 - Network (IP):
  [IP Header: src=192.168.1.5, dst=93.184.216.34, TTL=64]
  + TCP Segment
  → IP Packet

Layer 2 - Data Link (Ethernet):
  [Ethernet Header: dst=AA:BB:CC:11:22:33, src=DD:EE:FF:44:55:66, type=0x0800]
  + IP Packet + FCS
  → Ethernet Frame

Layer 1 - Physical:
  [Bits]: 01011010...
  → Electrical/optical/RF signals sent over the cable
```

```
At the receiving server:

Layer 1: Convert signals to bits
Layer 2: Strip Ethernet header, verify FCS
Layer 3: Strip IP header, check destination IP
Layer 4: Strip TCP header, reassemble data stream
Layer 5: Check session identifier
Layer 6: Decrypt TLS
Layer 7: Parse HTTP message → "GET /index.html HTTP/1.1"
```

## Comparison: OSI vs TCP/IP

| OSI Model (7 layers) | TCP/IP Model (4 layers) | Internet Protocols |
|---------------------|------------------------|-------------------|
| 7. Application | 4. Application | HTTP, DNS, SMTP, SSH, FTP, TLS |
| 6. Presentation | | SSL/TLS, JPEG, GIF, ASCII/UTF-8 |
| 5. Session | | NetBIOS, RPC, SQL session |
| 4. Transport | 3. Transport | TCP, UDP |
| 3. Network | 2. Internet | IP, ICMP, ARP, IGMP |
| 2. Data Link | 1. Network Access | Ethernet, WiFi (802.11), PPP, VLAN |
| 1. Physical | | Cables, fiber, wireless |

> [!tip] Which model to use?
> - **OSI** is useful for teaching, troubleshooting, and understanding network layers conceptually.
> - **TCP/IP** is the model actually implemented in every network. Use it for practical work.
> - When diagnosing a problem, thinking in OSI layers helps you identify which layer is failing.

## Connection with the rest of the wiki

| Concept | In-depth article |
|---------|-----------------|
| What is Internet | [[01-what-is-internet]] |
| URL to page journey | [[02-url-to-page-journey]] |
| Routing and subnetting | [[16-routing-subnetting]] |
| Servers and processes | [[14-servers-processes]] |

## Summary

- The **OSI model** has 7 layers, each with specific responsibilities.
- **Layer 7 (Application)**: HTTP, DNS, SMTP — protocols the user interacts with.
- **Layer 6 (Presentation)**: Encryption (TLS), compression (gzip), encoding (UTF-8).
- **Layer 5 (Session)**: Manages connections, keeps state across requests.
- **Layer 4 (Transport)**: TCP (reliable, ordered) vs UDP (fast, unordered).
- **Layer 3 (Network)**: IP addressing, routing, ICMP.
- **Layer 2 (Data Link)**: MAC addresses, Ethernet frames, ARP.
- **Layer 1 (Physical)**: Cables, fiber, WiFi — raw bit transmission.
- **Encapsulation**: Data is wrapped layer by layer as it goes down; unwrapped layer by layer as it comes up.
- TCP/IP is the real-world model; OSI is the conceptual framework.

> [!quote] The key takeaway
> The OSI model is a mental framework for understanding network communication. When something breaks, knowing which layer it is at helps you diagnose and fix it. TCP is layer 4, IP is layer 3, Ethernet is layer 2, and HTTP is layer 7 — each layer depends on the ones below it.
