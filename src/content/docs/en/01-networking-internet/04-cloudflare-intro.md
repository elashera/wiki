---
title: "Cloudflare: Introduction — CDN, DNS, WAF, DDoS Protection"
description: "Introduction to Cloudflare: what it is, CDN, DNS, WAF protection, SSL/TLS, DDoS protection, and why it positions itself as a reverse proxy between your user and your server."
---

# Cloudflare: Introduction

> [!tip] Cloudflare in one sentence
> Cloudflare is a **global reverse proxy** that sits between your users and your server, offering CDN, DDoS protection, a web application firewall (WAF), DNS, and free SSL/TLS.

## What is Cloudflare?

Cloudflare is a security and performance platform for the Internet. It is not just a CDN: it is a **global security network** with more than 300 data centers in 120+ cities. Its network absorbs and filters malicious traffic before it reaches your server.

### What does "reverse proxy" mean?

A **reverse proxy** sits in front of your servers:

```
Internet          Cloudflare                    Your Server
   │                    │                             │
   ├─── HTTPS ────────→│  (Edge, WAF, CDN)           │
   │                    │  Cache, compression,         │
   │                    │  DDoS protection            │
   │                    │  SSL/TLS termination        │
   │                    │─── HTTP ───────────────────→│
   │                    │   (no TLS, on your network) │
   │←── HTTPS ─────────├─── HTTP ←───────────────────│
   │                    │   (response from origin)    │
```

**Normal proxy**: client → proxy → internet (the proxy acts on behalf of the client)
**Reverse proxy**: internet → proxy → server (the proxy acts on behalf of the server)

> [!tip] Why a reverse proxy?
> Because your origin server can be on your local network (192.168.1.100), with arbitrary ports, without needing a public IP. Cloudflare exposes your site on the Internet, filters all traffic, and forwards it to your private server.

## Cloudflare's services

### CDN (Content Delivery Network)

Cloudflare caches your content in data centers closest to your users:

```
Your server (Frankfurt, 100ms)
         │
         ├── Cloudflare Edge (Santiago, Chile, 20ms) ← User in Buenos Aires
         ├── Cloudflare Edge (Mexico City, 30ms)     ← User in Mexico City
         ├── Cloudflare Edge (Miami, 40ms)           ← User in New York
         └── Cloudflare Edge (Amsterdam, 80ms)       ← User in London
```

Without CDN, a user in Buenos Aires would travel 200ms to Frankfurt. With Cloudflare, they travel 20ms to Santiago.

**What gets cached:**
- Static files (CSS, JS, images, fonts)
- Content with `Cache-Control: public`
- Static HTML pages

**What does NOT get cached:**
- Dynamic pages (login, dashboard)
- APIs with personalized data
- Content with `Cache-Control: private` or `no-store`

### DNS

Cloudflare operates the fastest DNS resolvers in the world (1.1.1.1). It is also a full DNS provider with:
- DNS record management (A, AAAA, CNAME, MX, TXT, etc.)
- DNSSEC
- DNS-over-HTTPS and DNS-over-TLS
- DDoS protection at the DNS level

### WAF (Web Application Firewall)

Cloudflare filters malicious traffic before it reaches your server:

| Rule | What it does | Example |
|------|-------------|---------|
| **IP Block** | Blocks traffic from an IP or range | Block traffic from a country |
| **Rate Limiting** | Limits requests per time window | Max 100 requests/minute per IP |
| **Bot Management** | Detects and blocks malicious bots | Block scrapers, brute-force |
| **Geo Blocking** | Blocks traffic by country/region | Block traffic from certain countries |
| **Custom WAF Rules** | Rules based on headers, paths, user-agent | Block `/wp-admin`, `/phpmyadmin` |

### DDoS Protection

Cloudflare absorbs DDoS attacks before they reach your server. Its 300+ Tbps network can absorb attacks measured in terabits per second.

| Attack type | Description | How Cloudflare mitigates it |
|-------------|-------------|-----------------------------|
| **Volumetric** | Floods the network with traffic | Its 300+ Tbps network absorbs the attack |
| **Protocol** | Exploits TCP/IP weaknesses (SYN flood) | Completes the handshake on your behalf |
| **Application** | Saturates the application layer (HTTP flood) | Caches content, rate limiting, JS challenge |

### SSL/TLS

Cloudflare offers automatic and free SSL/TLS certificates:
- **Universal SSL**: For `*.yourdomain.com`, issued by Let's Encrypt
- **Origin Certificate**: Issued by Cloudflare, only for Cloudflare → Origin traffic

### Cloudflare plans

| Plan | Price | Key features |
|------|-------|-------------|
| **Free** | $0 | CDN, SSL, basic DDoS, 1 DNS zone |
| **Pro** | $20/zone/month | Advanced WAF, Page Rules, Analytics, Bot Fight Mode |
| **Business** | $200/zone/month | Custom WAF, Flexible SSL, Origin Server CS, Cache Reserve |
| **Enterprise** | Custom | All of the above + SLA, advanced SSL, Cloudflare Load Balancer, Custom error pages |

> [!tip] For personal projects
> The **Free** plan is surprisingly complete. For most personal and small projects, it is more than enough.

## SSL/TLS modes in Cloudflare

### SSL modes

| Mode | Description | When to use |
|------|-------------|-------------|
| **Off** | No HTTPS at all | Local testing, development |
| **Flexible** | Client ↔ Cloudflare (HTTPS), Cloudflare ↔ Origin (HTTP) | Your origin does not have SSL configured |
| **Full** | Client ↔ Cloudflare (HTTPS), Cloudflare ↔ Origin (HTTPS) | Your origin has SSL (auto-issued by Cloudflare) |
| **Full (strict)** | Same as Full, but verifies the origin's certificate is valid | **RECOMMENDED** for production |
| **Strict** | Same as Full strict, but rejects self-signed certificates | Maximum security |

> [!caution] Flexible vs Full Strict
> - **Flexible** is dangerous: it creates a security bottleneck. Traffic between Cloudflare and your server is NOT encrypted.
> - **Full (strict)** is the right choice: encrypts the entire path. You need a valid certificate on your origin server.
> - For production, **always use Full (strict)** with a valid certificate on the origin.

## Cloudflare DNS records

When using Cloudflare as a proxy DNS:

| Type | Value | Proxy status | Description |
|------|-------|-------------|-------------|
| A | Server IP | Proxied (orange) | Traffic passes through Cloudflare |
| A | Server IP | DNS only (gray) | Traffic goes directly to the server |
| CNAME | other.domain.com | Proxied | Alias with proxy |
| CAA | 0 issue "letsencrypt.org" | DNS only | SSL security |
| TXT | v=spf1... | DNS only | Email verification |
| MX | mail.domain.com | DNS only (priority 10) | Mail server |

> [!warning] Proxied vs DNS only
> - **Proxied (orange)**: Cloudflare intercepts all traffic. You get CDN, WAF, DDoS protection. But you cannot use arbitrary ports (only 80, 443, 2052, 2082, 2086, 2095).
> - **DNS only (gray)**: Cloudflare only answers DNS. Traffic goes directly to your server. Required for non-HTTP ports, SSH, etc.

> [!tip] Proxy on for web, off for everything else
> - `@` and `www`: Proxied (orange) → CDN, WAF, protection
> - `mail`: DNS only (gray) → Direct mail traffic
> - `spf`, `dkim`, `dmarc`: DNS only → Required for email
> - `acme-challenge`: DNS only → Required for Let's Encrypt

## Minimal Cloudflare setup: configuring DNS

### Step by step

1. **Add your domain** in Cloudflare (it asks you to change the nameservers)
2. **Change the nameservers** at your registrar (GoDaddy, Namecheap, etc.) to Cloudflare's:
   - `earl.ns.cloudflare.com`
   - `zita.ns.cloudflare.com`
   (these vary by zone)
3. **Wait for propagation** (can take minutes to 48 hours)
4. **Add your DNS records** in Cloudflare

### Minimal DNS records

```
Type  Name              Value                Proxy
────────────────────────────────────────────────────────────
A     @                 YOUR_SERVER_IP        Proxied (orange)
A     www               YOUR_SERVER_IP        Proxied (orange)
CAA   @                 0 issue "letsencrypt.org"  DNS only
TXT   @                 v=spf1 include:_spf.google.com ~all  DNS only
MX    @                 mail.example.com      DNS only (priority 10)
```

## Summary

- Cloudflare is a global reverse proxy with CDN, WAF, DDoS protection, and SSL/TLS
- It sits between your users and your server, filtering and optimizing traffic
- SSL modes range from Off (insecure) to Full Strict (secure)
- The WAF filters malicious traffic before it reaches your server
- DDoS protection absorbs attacks before they reach the origin
- Configure proxy for web, DNS only for everything else

> [!quote] The key takeaway
> Cloudflare is not "just a CDN". It is a firewall, CDN, DNS provider, SSL manager, and DDoS protector in a single product. And the free plan is surprisingly complete.

## Connection with the rest of the wiki

| Concept covered | In-depth article |
|-----------------|-----------------|
| DNS in general | [[03-dns-deep-dive]] |
| SSL/TLS | [[07-https-tls]] |
| Certificates | [[08-lets-encrypt]] |
| Nginx/Caddy as origin | [[14-servers-processes]] |
| Reverse proxy | [[14-servers-processes]] |
