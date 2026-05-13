---
title: "NAT: Address Translation, SNAT, DNAT, Masquerading, Port Forwarding"
description: "NAT (Network Address Translation) explained: SNAT, DNAT, masquerading, port forwarding, how private addresses reach the Internet, and how Cloudflare hides your origin."
---

# NAT: Network Address Translation — SNAT, DNAT, Masquerading, Port Forwarding

> [!tip] NAT in a nutshell
> NAT (Network Address Translation) allows multiple devices on a private network to share a single public IP address. It translates between private IP addresses (192.168.x.x) and public IP addresses, enabling devices to communicate with the Internet while remaining hidden.

## What is NAT?

**NAT (Network Address Translation)** is a technique that modifies IP address information in packet headers while in transit. It allows devices with private IP addresses to communicate with the Internet using a single public IP address.

### Why NAT exists

```
Problem: IPv4 addresses are limited (~4.3 billion)
Solution: Use private addresses internally, translate to public addresses at the gateway

Private addresses (not routable on the Internet):
  10.0.0.0/8        → Large organizations
  172.16.0.0/12     → Medium organizations
  192.168.0.0/16    → Home networks

Public addresses (routable on the Internet):
  Assigned by ISPs to routers/gateways
```

### Your home router IS a NAT device

```
Your home network:
┌─────────────────────────────────────┐
│  Router (Public IP: 203.0.113.5)    │  ← NAT gateway
│                                     │
│  LAN: 192.168.1.1                   │
│                                     │
│  Device 1: 192.168.1.5 (your PC)    │
│  Device 2: 192.168.1.6 (your phone) │
│  Device 3: 192.168.1.7 (your TV)    │
│                                     │
│  All three share the public IP      │
│  203.0.113.5                        │
└─────────────────────────────────────┘

When your PC sends a request to Google:
  Source: 192.168.1.5:54321 → Google: 142.250.185.206:443
  Router translates: 203.0.113.5:12345 → Google: 142.250.185.206:443

When Google responds:
  Google → Router: 142.250.185.206:443 → 203.0.113.5:12345
  Router translates back: 142.250.185.206:443 → 192.168.1.5:54321
```

## Types of NAT

### SNAT (Source NAT)

SNAT changes the **source IP address** of outgoing packets. This is the most common type — it is what your home router does.

```
Inside network          NAT gateway         Internet
                          (Public: 203.0.113.5)
   192.168.1.5:54321 ──→ │                  │
   192.168.1.6:54322 ──→ │  SNAT:           │
   192.168.1.7:54323 ──→ │  src IP:         │
                          │  203.0.113.5     │──→ 142.250.185.206:443
                          │  src port:       │
                          │  12345           │

Google sees: 203.0.113.5:12345 → 142.250.185.206:443
Google doesn't know about 192.168.1.5, .6, .7

Return traffic:
  142.250.185.206:443 → 203.0.113.5:12345
  NAT translates:     → 192.168.1.5:54321
```

### DNAT (Destination NAT)

DNAT changes the **destination IP address** of incoming packets. This is used for port forwarding and load balancing.

```
Internet                    NAT gateway            Inside network
                            (Public: 203.0.113.5)
                              │
    Web request:              │  DNAT: dst IP:
    ─────────────→ 203.0.113.5:80 │  192.168.1.10:80
                              │
                              ▼
                          192.168.1.10:80 (Web server)
```

```bash
# iptables DNAT example
sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j DNAT --to-destination 192.168.1.10:80
```

### PAT (Port Address Translation) / NAT Overload

PAT is a form of SNAT that also translates **port numbers**, allowing many private IPs to share one public IP simultaneously.

```
Multiple devices → Same public IP, different ports:

  192.168.1.5:54321  → 203.0.113.5:1024  → external server A
  192.168.1.5:54322  → 203.0.113.5:1025  → external server B
  192.168.1.6:54323  → 203.0.113.5:1024  → external server A  ← Same port as above!
  192.168.1.6:54324  → 203.0.113.5:1026  → external server C
```

## NAT types compared

| Type | What it changes | Direction | Use case |
|------|----------------|-----------|----------|
| **SNAT** | Source IP (and optionally port) | Outgoing | Home router, many-to-one |
| **DNAT** | Destination IP (and optionally port) | Incoming | Port forwarding, load balancing |
| **PAT** | Source IP + Source port | Outgoing | Multiple devices sharing one IP |
| **Masquerade** | Source IP to interface IP | Outgoing | Dynamic public IPs (DSL, mobile) |

## Masquerading

**Masquerading** is a special form of SNAT that automatically uses the IP address of the outgoing network interface. This is useful when the public IP address changes (e.g., DSL lines, mobile connections).

```bash
# iptables masquerade (Linux)
sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE

# This is equivalent to:
# sudo iptables -t nat -A POSTROUTING -o eth0 -j SNAT --to-source <dynamic-IP>
# But MASQUERADE adapts automatically when the IP changes.

# nftables equivalent
nft add rule ip nat postrouting oifname eth0 masquerade
```

### Masquerade vs SNAT

| | SNAT | MASQUERADE |
|--|------|-----------|
| **IP address** | Static, must be specified | Dynamic, reads from interface |
| **Performance** | Slightly faster (cached IP) | Slightly slower (reads IP each time) |
| **Use when** | Public IP is static | Public IP is dynamic (DHCP, PPPoE) |
| **Typical use** | Data center servers | Home routers, mobile gateways |

> [!tip] In modern data centers, the difference is negligible. Use SNAT for static IPs and MASQUERADE for dynamic ones.

## Port Forwarding

Port forwarding is a form of DNAT that maps a specific port on the public IP to a specific internal IP and port.

### How port forwarding works

```
Internet:
  Request → 203.0.113.5:80

Router port forwarding rule:
  Port 80  → 192.168.1.10:80 (web server)
  Port 22  → 192.168.1.10:22 (SSH)
  Port 3000 → 192.168.1.20:3000 (Node.js app)

Inside network:
  192.168.1.10 → Nginx (port 80)
  192.168.1.20 → Node.js app (port 3000)
  192.168.1.30 → Database (port 5432, NOT forwarded!)
```

```bash
# iptables port forwarding
sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j DNAT --to-destination 192.168.1.10:80
sudo iptables -t nat -A PREROUTING -p tcp --dport 22 -j DNAT --to-destination 192.168.1.10:22

# Don't forget to enable forwarding!
sudo sysctl -w net.ipv4.ip_forward=1
# Persist: echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf

# And allow the traffic through the filter table
sudo iptables -A FORWARD -p tcp -d 192.168.1.10 --dport 80 -j ACCEPT
sudo iptables -A FORWARD -p tcp -d 192.168.1.10 --dport 22 -j ACCEPT
```

### Nginx reverse proxy (application-level forwarding)

Instead of port forwarding at the network level, you can use Nginx as a reverse proxy:

```nginx
# Single public IP, multiple services on one port (443)
server {
    listen 443 ssl;
    server_name app.example.com;

    ssl_certificate /etc/letsencrypt/live/app.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;

    location / {
        proxy_pass http://192.168.1.20:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    listen 443 ssl;
    server_name api.example.com;

    ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    location / {
        proxy_pass http://192.168.1.21:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

> [!tip] Reverse proxy vs port forwarding
> | | Port Forwarding (DNAT) | Reverse Proxy (Nginx) |
> |--|----------------------|----------------------|
> | **Level** | Network (L4) | Application (L7) |
> | **Routing by** | Port number | Domain name + path |
> | **SSL/TLS** | Not terminated at proxy | Terminated at proxy |
> | **Multiple services** | Need different ports | Same port, different domains |
> | **Recommended for** | SSH, databases (with VPN) | Web services, APIs |

## NAT Traversal

### The problem

Since NAT hides internal devices, external devices cannot initiate connections to them:

```
  Client (Public IP) ──→ Server (Public IP, 443)  ✓ Easy (outgoing connection)
  Client (Public IP) ──→ Internal Server (192.168.1.10, 80)  ✗ Blocked (no port forwarding)
```

### NAT hole punching

For peer-to-peer communication through NAT:

```
  Client A (behind NAT A)    Client B (behind NAT B)
  
  1. Both connect to a public signaling server
  2. Signaling server learns A's public IP:port and B's public IP:port
  3. Signaling server tells A about B and B about A
  4. A and B try to connect directly to each other's public IPs
  5. If NATs allow it → direct P2P connection established!
```

### STUN, TURN, and ICE

| Protocol | Purpose | Use case |
|----------|---------|----------|
| **STUN** | Learn public IP and port | WebRTC, video calls |
| **TURN** | Relay traffic when direct connection fails | When NAT blocks direct P2P |
| **ICE** | Framework that tries STUN first, falls back to TURN | WebRTC connection establishment |

## NAT in cloud environments

### AWS VPC and NAT

```
Public Subnet                    Private Subnet
┌─────────────────────┐         ┌─────────────────────┐
│ EC2 Instance        │         │ EC2 Instance (DB)   │
│ Public IP           │         │ Private IP          │
│ NAT Gateway ──────→ Internet  │                     │
│ (manages outgoing   │         │ ← No direct access  │
│  traffic only)      │         │  from Internet      │
└─────────────────────┘         └─────────────────────┘
```

```bash
# AWS NAT Instance (alternative to NAT Gateway)
# Run on an EC2 instance with two network interfaces
sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
sudo sysctl -w net.ipv4.ip_forward=1

# AWS NAT Gateway (managed service, recommended)
# AWS manages the NAT. You just configure the route tables.
# Private subnet route table:
#   0.0.0.0/0 → NAT Gateway (nat-xxxxx)
```

### Cloudflare as NAT for your origin

Cloudflare effectively acts as a NAT:

```
Internet → Cloudflare (198.51.100.1) → Your Origin (192.168.1.10)

Cloudflare:
  Listens on public IPs: 198.51.100.1
  Forwards traffic to: 192.168.1.10 (your private origin)
  Origin IP is hidden from the Internet
```

```bash
# Verify your origin IP is hidden
curl -I https://yourdomain.com
# Server: cloudflare
# Cloudflare's IP is visible, not yours

# Use CF-Connecting-IP header to get the real client IP
# Cloudflare adds this header to forwarded requests
# X-Forwarded-For contains the original client IP
```

## Connection with the rest of the wiki

| Concept | In-depth article |
|---------|-----------------|
| IPv4 vs IPv6 | [[12-ports]] |
| Routing | [[16-routing-subnetting]] |
| Cloudflare | [[04-cloudflare-intro]], [[19-cloudflare-complete]] |
| Ports | [[12-ports]] |

## Summary

- **NAT** translates between private and public IP addresses, enabling multiple devices to share one public IP.
- **SNAT** modifies the source IP (outgoing traffic). **DNAT** modifies the destination IP (incoming traffic).
- **PAT** (Port Address Translation) also translates source ports, allowing many-to-one mapping.
- **Masquerading** is SNAT with a dynamic IP — useful for changing public IPs (DSL, mobile).
- **Port forwarding** (DNAT) maps external ports to internal services.
- **Reverse proxy** (Nginx) is preferred over port forwarding for web services — it routes by domain name, not just port.
- **Cloudflare** acts as a reverse proxy + NAT, hiding your origin IP from the Internet.
- Always use a firewall to control what traffic reaches your internal services.

> [!quote] The key takeaway
> NAT is the reason your home network works. It is also why external devices cannot reach your internal services without port forwarding. Understanding NAT is essential for network debugging, server configuration, and understanding cloud networking.
