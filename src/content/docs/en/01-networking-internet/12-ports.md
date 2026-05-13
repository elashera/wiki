---
title: "Ports, Localhost, Loopback, IPv4 vs IPv6, Well-Known vs Ephemeral"
description: "Network ports explained: localhost, loopback interfaces, IPv4 vs IPv6 addressing, well-known vs ephemeral ports, and port mapping."
---

# Ports, Localhost, Loopback, IPv4 vs IPv6, Well-Known vs Ephemeral

> [!tip] Ports in a nutshell
> A port is a number that identifies a specific service running on a machine. Ports work together with IP addresses to deliver data to the correct application. This article covers ports, loopback, IPv4, IPv6, and the port number ranges.

## What is a port?

A **port** is a 16-bit number (0–65535) that identifies a specific service or application on a networked device. Combined with an IP address, it forms an **endpoint** for network communication.

### The mailing analogy

```
IP address = Street address of a building
Port       = Apartment number inside the building

Package → 123 Main Street (IP) → Apartment 4B (Port)
```

### Socket address

```
Socket = IP Address + Port Number

Examples:
  192.168.1.10:80       → HTTP server
  192.168.1.10:443      → HTTPS server
  192.168.1.10:3306     → MySQL database
  127.0.0.1:5432        → PostgreSQL (localhost)
  [::1]:6379            → Redis (localhost IPv6)
```

### How ports work in a request

```
Browser requests: https://example.com:443/api/data

Client → Server:
  Destination IP:   93.184.216.34 (resolved from DNS)
  Destination Port: 443 (HTTPS)
  Protocol:         TCP

Server receives the packet on port 443 → delivers it to the web server process
listening on that port.
```

## Port number ranges

Ports are divided into three ranges:

| Range | Number | Name | Description |
|-------|--------|------|-------------|
| **0** | 0 | Reserved | System use only (not for applications) |
| **1–1023** | 1023 | Well-Known Ports | Assigned by IANA (HTTP=80, HTTPS=443, etc.) |
| **1024–49151** | 48128 | Registered Ports | Registered for specific applications |
| **49152–65535** | 16384 | Ephemeral (Dynamic) Ports | Temporary, assigned by OS for client connections |

### Well-Known Ports (some of the most common)

| Port | Protocol | Service |
|------|----------|---------|
| 20 | TCP | FTP data transfer |
| 21 | TCP | FTP control |
| 22 | TCP | SSH |
| 23 | TCP | Telnet (insecure!) |
| 25 | TCP | SMTP (email sending) |
| 53 | UDP/TCP | DNS |
| 80 | TCP | HTTP |
| 110 | TCP | POP3 (email receiving) |
| 123 | UDP | NTP (time synchronization) |
| 143 | TCP | IMAP (email receiving) |
| 443 | TCP | HTTPS |
| 465 | TCP | SMTPS (encrypted SMTP) |
| 587 | TCP | SMTP (submission, STARTTLS) |
| 993 | TCP | IMAPS (encrypted IMAP) |
| 995 | TCP | POP3S (encrypted POP3) |
| 3306 | TCP | MySQL |
| 5432 | TCP | PostgreSQL |
| 6379 | TCP | Redis |
| 8080 | TCP | HTTP (alternative) |
| 8443 | TCP | HTTPS (alternative) |
| 27017 | TCP | MongoDB |

### Ephemeral Ports

When a client makes a connection, the OS assigns an ephemeral port:

```
Client: 192.168.1.5 → Server: 93.184.216.34
Client port (ephemeral): 54321 → Server port (well-known): 443

The return traffic:
Server: 93.184.216.34:443 → Client: 192.168.1.5:54321

The OS uses the ephemeral port to know which application should receive the response.
```

```bash
# See ephemeral port range on Linux
cat /proc/sys/net/ipv4/ip_local_port_range
# Output: 32768   60999

# See a process listening on a port
sudo lsof -i :80
# COMMAND  PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
# nginx   1234 root    6u  IPv4  12345      0t0  TCP *:http (LISTEN)

# See all listening ports
sudo netstat -tlnp
# Active Internet connections (only servers)
# Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name
# tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN      567/sshd
# tcp        0      0 127.0.0.1:3306          0.0.0.0:*               LISTEN      890/mysqld
# tcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN      1234/nginx
```

## Localhost and Loopback

**Loopback** is a virtual network interface that allows a machine to communicate with itself. The loopback address is `127.0.0.1` for IPv4 and `::1` for IPv6.

### Loopback interfaces

```
IPv4 loopback:  127.0.0.0/8  (any address in 127.x.x.x)
IPv6 loopback:  ::1          (single address)

The most common:
  127.0.0.1  → IPv4 loopback
  ::1        → IPv6 loopback
  localhost  → Hostname that resolves to 127.0.0.1 (or ::1)
```

### Why use loopback?

```bash
# Start a web server on localhost
# Only accessible from the same machine
python3 -m http.server 8000
# Serving at http://localhost:8000/

# Or specifically on 127.0.0.1
python3 -m http.server -b 127.0.0.1 8000

# Try to access from another machine → connection refused!
# Only this machine can reach it.
```

### Differences between 0.0.0.0, 127.0.0.1, and a specific IP

| Binding address | Accessible from | Description |
|----------------|-----------------|-------------|
| `0.0.0.0` | All interfaces | Listens on every network interface (external + internal) |
| `127.0.0.1` | Only local machine | Listens only on loopback interface |
| `192.168.1.10` | Same network | Listens only on that specific interface |

```
Server binds to 0.0.0.0:3000:
  ┌─────────────────────────────────────┐
  │  Server on 0.0.0.0:3000             │
  │                                     │
  │  127.0.0.1:3000  ← Local access     │
  │  192.168.1.10:3000  ← LAN access    │
  │  203.0.113.5:3000  ← External access│
  └─────────────────────────────────────┘

Server binds to 127.0.0.1:3000:
  ┌─────────────────────────────────────┐
  │  Server on 127.0.0.1:3000           │
  │                                     │
  │  127.0.0.1:3000  ← Local access     │
  │  192.168.1.10:3000  ← NOT accessible│
  │  203.0.113.5:3000  ← NOT accessible │
  └─────────────────────────────────────┘
```

> [!caution] Never bind databases and internal services to 0.0.0.0
> Always bind databases (MySQL, PostgreSQL, Redis) to 127.0.0.1 or a specific internal IP. Binding to 0.0.0.0 exposes them to the entire network.

### Hostname resolution

```
# localhost resolves to 127.0.0.1 on most systems
# Check /etc/hosts (Linux/macOS) or C:\Windows\System32\drivers\etc\hosts (Windows)

cat /etc/hosts
# 127.0.0.1   localhost
# ::1         localhost ip6-localhost ip6-loopback
```

## IPv4 vs IPv6

### IPv4

IPv4 uses **32-bit** addresses, giving ~4.3 billion unique addresses:

```
Format:  four octets separated by dots
Example: 192.168.1.1

Binary:  11000000.10101000.00000001.00000001

Range:   0.0.0.0 to 255.255.255.255
```

**Private (reserved) IPv4 ranges** (not routable on the Internet):

| Range | Size | CIDR | Common use |
|-------|------|------|-----------|
| 10.0.0.0 – 10.255.255.255 | 16,777,216 | 10.0.0.0/8 | Large networks |
| 172.16.0.0 – 172.31.255.255 | 1,048,576 | 172.16.0.0/12 | Medium networks |
| 192.168.0.0 – 192.168.255.255 | 65,536 | 192.168.0.0/16 | Home/office networks |

### IPv6

IPv6 uses **128-bit** addresses, giving ~3.4 × 10³⁸ unique addresses:

```
Format: eight groups of four hex digits, separated by colons
Example: 2001:0db8:85a3:0000:0000:8a2e:0370:7334

Compressed: 2001:db8:85a3::8a2e:370:7334

Zero groups can be compressed to ::
Only one :: per address (cannot compress in two places)
Leading zeros in each group can be omitted
```

**IPv6 address types:**

| Type | Prefix | Description | Example |
|------|--------|-------------|---------|
| **Unspecified** | `::` | All zeros, "no address" | `::` |
| **Loopback** | `::1` | Same as 127.0.0.1 | `::1` |
| **Unique Local** | `fd00::/8` | Private addresses (IPv6 equivalent of 10.0.0.0/8) | `fd00::1` |
| **Link-Local** | `fe80::/10` | Only on local network segment | `fe80::1%eth0` |
| **Global Unicast** | `2000::/3` | Public addresses (routable on Internet) | `2001:db8::1` |

### IPv4 vs IPv6 comparison

| Feature | IPv4 | IPv6 |
|---------|------|------|
| **Address size** | 32 bits (4 bytes) | 128 bits (16 bytes) |
| **Address format** | Dotted decimal (192.168.1.1) | Hex groups (2001:db8::1) |
| **Address space** | ~4.3 billion | ~3.4 × 10³⁸ |
| **Header size** | 20–60 bytes (variable) | 40 bytes (fixed) |
| **Auto-configuration** | DHCP required | SLAAC (Stateless Address Auto-Configuration) |
| **NAT** | Required (addresses exhausted) | Not needed (plenty of addresses) |
| **IPsec** | Optional | Built-in |
| **Checksum** | Yes (header only) | No (relied on higher layers) |
| **Fragmentation** | Routers can fragment | Only source can fragment |

### How IPv6 addresses are assigned

```
# SLAAC (Stateless Address Auto-Configuration):
# Router advertises a prefix, device appends its own interface identifier
Router Advertisement: "Network prefix is 2001:db8:1::/64"
Device: "I'll use 2001:db8:1::1" (or generates its own via EUI-64)

# DHCPv6 (Stateful):
# Router advertises: "Use DHCP for address configuration"
# Device requests an address from DHCP server
```

### Dual-stack (IPv4 + IPv6)

Most systems run both protocols simultaneously:

```bash
# Check addresses on Linux
ip addr show
# eth0:
#   inet 192.168.1.10/24 brd 192.168.1.255 scope global eth0  ← IPv4
#   inet6 2001:db8::1/64 scope global                        ← IPv6
#   inet6 fe80::1%eth0/64 scope link                         ← IPv6 link-local

# Check DNS resolution
dig example.com A        # IPv4 address
dig example.com AAAA     # IPv6 address
```

## Port mapping (NAT port forwarding)

Port forwarding allows external devices to reach a service on an internal network:

```
Internet
   │
   ▼
┌──────────────────────────────────────┐
│  Router (Public IP: 203.0.113.5)     │
│                                      │
│  Port 80  → 192.168.1.10:80 (Nginx) │
│  Port 22  → 192.168.1.10:22 (SSH)   │
│  Port 3000 → 192.168.1.20:3000 (App)│
└──────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────┐
│  Internal Network                    │
│  192.168.1.10 (Web Server)           │
│  192.168.1.20 (App Server)           │
│  192.168.1.30 (Database)             │
└──────────────────────────────────────┘
```

```bash
# Linux: iptables port forwarding
sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j DNAT --to-destination 192.168.1.10:80
sudo iptables -t nat -A POSTROUTING -j MASQUERADE

# Linux: nftables
nft add rule ip nat prerouting tcp dport 80 dnat to 192.168.1.10:80
```

> [!warning] Exposing services to the Internet
> Port forwarding opens a hole in your firewall. Always use:
> 1. Strong authentication (SSH keys, not passwords)
> 2. Firewall rules (allow only necessary ports)
> 3. VPN for administrative access (SSH)
> 4. Reverse proxy (Cloudflare) for web services

## Connection with the rest of the wiki

| Concept | In-depth article |
|---------|-----------------|
| TCP/IP model | [[01-what-is-internet]] |
| NAT | [[13-nat]] |
| Routing and subnetting | [[16-routing-subnetting]] |
| DNS | [[03-dns-deep-dive]] |

## Summary

- **Ports** are 16-bit numbers (0–65535) that identify specific services on a machine.
- **Well-known ports** (0–1023) are assigned by IANA for standard services.
- **Ephemeral ports** (49152–65535) are assigned by the OS for outgoing client connections.
- **Loopback** (127.0.0.1 / ::1) allows a machine to communicate with itself.
- **0.0.0.0** binds to all interfaces; **127.0.0.1** binds only to loopback.
- **IPv4** uses 32-bit addresses (~4.3 billion); **IPv6** uses 128-bit addresses (~3.4 × 10³⁸).
- Private IPv4 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) are not routable on the Internet.
- **Port forwarding** allows external access to internal services but requires careful security configuration.

> [!quote] The key takeaway
> Ports are the bridge between IP addresses and applications. Understanding ports, loopback, and the difference between IPv4 and IPv6 is essential for network debugging, server configuration, and understanding how services communicate on a network.
