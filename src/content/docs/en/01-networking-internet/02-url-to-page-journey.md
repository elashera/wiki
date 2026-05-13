---
title: "From URL to Page: The Complete Journey"
description: "The complete journey from typing a URL to a rendered page: DNS resolution, TCP handshake, TLS negotiation, HTTP request/response, browser rendering, and everything in between."
---

# From URL to Page: The Complete Journey

> [!tip] In a nutshell
> When you type a URL and press Enter, a complex sequence of events unfolds in milliseconds: DNS resolution, TCP connection, TLS handshake, HTTP request and response, and finally, the browser renders the page. Here is every step.

## Overview: What happens when you press Enter?

When you type `https://example.com` into your browser and hit Enter, the following high-level sequence occurs:

```
1. DNS Resolution          → Find the IP address
2. TCP Connection          → Establish connection (3-way handshake)
3. TLS Handshake           → Negotiate encryption
4. HTTP Request            → Send the actual request
5. Server Processing       → Server generates the response
6. HTTP Response           → Send back HTML/CSS/JS/images
7. Browser Rendering       → Parse HTML, build DOM, paint pixels
```

This may happen in under a second for a fast server, but behind that speed is an extraordinary amount of work. Let us walk through every step in detail.

## Step 1: DNS Resolution

Before the browser can send an HTTP request, it needs the IP address of the server. The URL contains a domain name (`example.com`), but the Internet routes traffic by IP addresses.

### The DNS lookup process

```
Browser cache → OS cache → Recursive resolver → Root DNS → TLD DNS → Authoritative DNS → IP address
```

#### 1a. Browser cache

The browser checks its own DNS cache first. If you recently visited `example.com`, the IP may still be cached.

```
Browser DNS cache lookup:
┌─────────────────────────────────┐
│ example.com → 93.184.216.34     │ ← Found! Use it (TTL not expired)
└─────────────────────────────────┘
```

Browsers typically cache DNS entries for 1–60 minutes depending on the TTL (Time To Live) of the DNS record.

#### 1b. Operating system cache

If not in the browser cache, the OS DNS cache is checked. On Linux, this may be `systemd-resolved` or `nscd`. On macOS, it is the Bonjour cache. On Windows, it is the DNS Client service.

```bash
# Linux: Check systemd-resolved DNS cache
systemd-resolve --statistics
systemd-resolve --lookup example.com

# macOS: Check DNS cache
dscacheutil -q host -a name example.com
```

#### 1c. Recursive resolver (your ISP's DNS server)

If the OS cache misses, your computer sends a DNS query to a **recursive resolver**. This is usually your ISP's DNS server (configured in your `/etc/resolv.conf`), but many users use public resolvers:

| Resolver | Address |
|----------|---------|
| Google DNS | 8.8.8.8, 8.8.4.4 |
| Cloudflare DNS | 1.1.1.1, 1.0.0.1 |
| Quad9 | 9.9.9.9 |
| OpenDNS | 208.67.222.222 |

The recursive resolver is responsible for doing the entire DNS lookup on your behalf.

#### 1d. The chain of DNS servers

The recursive resolver follows a chain:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Root DNS    │     │  TLD DNS     │     │ Authoritative    │     │
│  (.com, .org)│────→│  (.com)      │────→│  DNS for         │────→│  IP: 93.184.216.34
│  (13 servers)│     │  (NTT, Verisign)│   │  example.com    │     │
└──────────────┘     └──────────────┘     └──────────────────┘     └──────────────────┘
     │                     │                        │
     │ "Find the .com NS"  │ "Find example.com NS"  │ "What is example.com's IP?"
```

1. **Root DNS servers** (13 IP addresses, labeled A through M) tell the resolver which servers handle the `.com` TLD.
2. **TLD DNS servers** (e.g., Verisign for `.com`) tell the resolver which servers are authoritative for `example.com`.
3. **Authoritative DNS servers** (e.g., Cloudflare, GoDaddy, or your own DNS provider) return the actual IP address.

### DNS resolution in practice

```bash
# Use dig to see the full DNS resolution chain
dig example.com +trace

# Output:
; <<>> DiG 1.19.6 <<>> example.com +trace
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR
;; QUESTION SECTION:
;example.com.                IN      A
;; ANSWER SECTION:
example.com.         172800  IN      A       93.184.216.34

;; AUTHORITY SECTION:
.                    172800  IN      NS      a.root-servers.net.
a.root-servers.net.  172800  IN      A       198.41.0.4
;; ... (followed by TLD and authoritative queries)
```

### Why DNS uses UDP (and sometimes TCP)

DNS queries are small (typically under 512 bytes), so DNS uses **UDP** by default for speed. However, if a response exceeds 512 bytes (e.g., with DNSSEC signatures), it falls back to **TCP**.

> [!tip] DNS over HTTPS (DoH)
> Modern browsers can use DNS over HTTPS (DoH) to encrypt DNS queries, preventing ISPs and third parties from seeing which domains you visit. Cloudflare's 1.1.1.1 and Google's 8.8.8.8 both support DoH.

## Step 2: TCP Connection (3-Way Handshake)

Once the browser has the IP address, it needs to establish a TCP connection to the server. This happens through the **TCP 3-way handshake**:

```
Client                          Server
   │                              │
   │─── SYN (seq=100) ──────────→│  Send: "I want to connect, starting seq=100"
   │                              │
   │←── SYN-ACK (seq=300, ack=101)│  Reply: "OK, my seq=300, got your seq=100"
   │                              │
   │─── ACK (seq=101, ack=301) ─→│  Confirm: "Connected, my seq=101"
   │                              │
   │  Connection established      │  Connection established
   │  Ready to send HTTP          │  Ready to receive HTTP
```

### What each step means

| Step | Packet | Description |
|------|--------|-------------|
| 1 | SYN | Client sends a packet with a random sequence number, indicating it wants to connect |
| 2 | SYN-ACK | Server acknowledges the client's sequence number and sends its own |
| 3 | ACK | Client acknowledges the server's sequence number |

After this handshake, both sides know each other's initial sequence numbers, and the connection is ready for data transfer.

### TCP state diagram (simplified)

```
Client:         CLOSED → SYN_SENT → ESTABLISHED
                (SYN sent)  (SYN-ACK received)

Server:         CLOSED → LISTEN → SYN_RCVD → ESTABLISHED
                (accept)    (SYN received)  (ACK received)
```

### Why not just send data immediately?

The 3-way handshake prevents several problems:
- **Old duplicate connections**: If an old SYN packet arrives late, the handshake detects it.
- **Resource allocation**: Both sides know the other is willing to connect before allocating resources.
- **Sequence number synchronization**: Both sides agree on starting sequence numbers for reliable delivery.

## Step 3: TLS Handshake (for HTTPS)

If the URL starts with `https://`, a TLS handshake must occur before any HTTP data is sent. This is where encryption is negotiated:

```
Client                          Server
   │                              │
   │─── ClientHello ────────────→│  "I support TLS 1.3, these ciphers, random bytes"
   │                              │
   │←── ServerHello ─────────────│  "TLS 1.3, cipher AES-256-GCM, here is my cert"
   │   + Certificate              │
   │   + ServerKeyExchange        │
   │                              │
   │─── ClientKeyExchange ──────→│  "Here is my key exchange data"
   │─── ChangeCipherSpec ───────→│  "From now on, everything is encrypted"
   │                              │
   │←── ChangeCipherSpec ────────│  "Me too"
   │─── Encrypted handshake...  ─→│
   │←── Encrypted handshake... ──│
   │                              │
   │  TLS tunnel established      │  TLS tunnel established
```

### ClientHello

The client lists:
- Supported TLS versions
- Cipher suites it supports (AES-256-GCM, ChaCha20-Poly1305, etc.)
- Random bytes (for key generation)
- SNI (Server Name Indication) — the domain name being requested (important for shared hosting)

### ServerHello

The server responds with:
- Selected TLS version (e.g., TLS 1.3)
- Selected cipher suite
- Its own random bytes
- Certificate (including the public key)

### TLS 1.3 vs TLS 1.2

| Feature | TLS 1.2 | TLS 1.3 |
|---------|---------|---------|
| Handshake rounds | 2 (4 round-trips) | 1 (1 round-trip) |
| Cipher suites | Many (including weak ones) | Only AEAD ciphers |
| Forward secrecy | Optional | Required |
| Session resumption | Session IDs, session tickets | PSK (Pre-Shared Keys) |
| Renegotiation | Vulnerable to attacks | Not supported (use TLS sessions) |

> [!tip] Why TLS 1.3 is faster
> TLS 1.3 reduces the handshake from 2 round-trips to 1 (0-RTT resumption is possible). This means the encrypted connection is established almost instantly on repeat visits.

### SNI (Server Name Indication)

When multiple domains share the same IP address, the client sends the requested domain name in the ClientHello. This is called **SNI**, and it allows the server to present the correct certificate.

```
┌─────────────────────────────────────┐
│ Shared IP: 93.184.216.34            │
│  ┌─────────────┐  ┌─────────────┐  │
│  │ example.com │  │ blog.com    │  │
│  │ cert: A     │  │ cert: B     │  │
│  └─────────────┘  └─────────────┘  │
└─────────────────────────────────────┘
Client sends SNI: "example.com" → Server presents cert A
Client sends SNI: "blog.com"    → Server presents cert B
```

> [!caution] SNI is sent in plaintext (in TLS 1.2)
> While the certificate content is encrypted, the SNI field itself is sent unencrypted in TLS 1.2. TLS 1.3 introduces encrypted SNI (ESNI), now called **Encrypted Client Hello (ECH)**, which encrypts the SNI as well.

## Step 4: HTTP Request

After the TLS handshake completes, the browser sends an HTTP request:

```
GET /index.html HTTP/1.1
Host: example.com
User-Agent: Mozilla/5.0 (Macintosh; Intel...
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
Accept-Language: en-US,en;q=0.5
Accept-Encoding: gzip, br
Connection: keep-alive
Upgrade-Insecure-Requests: 1
Cache-Control: max-age=0
```

### Key headers explained

| Header | Purpose |
|--------|---------|
| `Host` | The domain name (required in HTTP/1.1) |
| `User-Agent` | Browser identification |
| `Accept` | What content types the client can handle |
| `Accept-Language` | Preferred languages |
| `Accept-Encoding` | Compression methods the client supports |
| `Connection` | `keep-alive` means reuse the TCP connection |
| `Upgrade-Insecure-Requests` | Prefers HTTPS if available |

### HTTP/1.1 vs HTTP/2 vs HTTP/3

| Feature | HTTP/1.1 | HTTP/2 | HTTP/3 |
|---------|----------|--------|--------|
| **Transport** | TCP | TCP (usually) | QUIC (UDP) |
| **Multiplexing** | No (head-of-line blocking) | Yes (many streams over 1 connection) | Yes (inherently) |
| **Header compression** | No (HPACK in HTTP/2) | HPACK compression | QPACK compression |
| **Server push** | No | Yes (but often harmful) | Yes (limited) |
| **Header fields** | Text-based | Binary framing | Binary framing |
| **Head-of-line blocking** | Yes (request by request) | Yes (at TCP level) | No (at UDP level) |
| **Connection setup** | TCP + TLS (~3 RTTs) | TCP + TLS (~1 RTT TLS 1.3) | ~0 RTT (with caching) |

## Step 5: Server Processing

The server receives the HTTP request, processes it, and generates a response. What happens next depends on the server:

### Simple static response (Nginx)

```
1. Receive HTTP request on port 443
2. TLS termination: decrypt the request
3. Look up the requested file: /var/www/html/index.html
4. Read the file from disk
5. Compress with gzip/brotli
6. Send HTTP response
```

### Dynamic response (Node.js + Express)

```javascript
// Express.js middleware chain
app.get('/api/data', async (req, res) => {
  // 1. Authentication middleware checks token
  // 2. Validation middleware checks request params
  // 3. Database query middleware fetches data
  const data = await db.collection('items').find({}).toArray();
  // 4. Serialize and send response
  res.json(data);
});
```

### Server architecture

```
                   Request arrives
                         │
                    ┌────┴────┐
                    │  WAF    │ ← Cloudflare WAF / iptables
                    └────┬────┘
                         │
                    ┌────┴────┐
                    │ Load    │ ← Round-robin, least-connections
                    │ Balancer│
                    └────┬────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
         ┌─────────┐ ┌─────────┐ ┌─────────┐
         │ Server  │ │ Server  │ │ Server  │
         │  Node 1 │ │  Node 2 │ │  Node 3 │
         └────┬────┘ └────┬────┘ └────┬────┘
              │            │            │
              └────────────┼────────────┘
                           ▼
                    ┌─────────────┐
                    │  Database   │
                    │  (PostgreSQL│
                    │   / MongoDB)│
                    └─────────────┘
```

## Step 6: HTTP Response

The server sends back an HTTP response:

```
HTTP/1.1 200 OK
Date: Mon, 13 May 2026 15:00:00 GMT
Content-Type: text/html; charset=utf-8
Content-Encoding: gzip
Content-Length: 4832
Connection: keep-alive
Cache-Control: public, max-age=3600
ETag: "abc123"
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains

... compressed HTML content ...
```

### Response headers to know

| Header | Purpose |
|--------|---------|
| `Content-Type` | MIME type of the response body |
| `Content-Encoding` | Compression used (gzip, br for brotli) |
| `Cache-Control` | Caching instructions |
| `ETag` | Entity tag for cache validation |
| `X-Frame-Options` | Clickjacking protection |
| `X-Content-Type-Options` | Prevents MIME sniffing |
| `Strict-Transport-Security` (HSTS) | Forces HTTPS for future requests |

## Step 7: Browser Rendering

Once the HTML is received, the browser goes through a rendering pipeline:

```
1. Parse HTML → Build DOM (Document Object Model) tree
2. Parse CSS → Build CSSOM (CSS Object Model) tree
3. Combine DOM + CSSOM → Render Tree (visible elements only)
4. Layout → Calculate geometry (position and size of each node)
5. Paint → Render pixels to the screen
6. Composite → Combine layers into the final image
```

### Rendering pipeline details

#### DOM construction

```html
<!-- Browser parses this HTML -->
<html>
  <head><title>Hello</title></head>
  <body>
    <h1>Welcome</h1>
    <p>This is a paragraph.</p>
  </body>
</html>

<!-- Into this tree -->
<html>
  └── head
      └── title [text: "Hello"]
  └── body
      ├── h1 [text: "Welcome"]
      └── p [text: "This is a paragraph."]
```

#### Critical rendering path

```
HTML document
    │
    ▼
┌──────────────────────────┐
│ External CSS blocks       │ ← Blocks HTML parsing
│   <link rel="stylesheet"  │
│          href="style.css">│
└──────────┬───────────────┘
           ▼
┌──────────────────────────┐
│ External JS (no defer)    │ ← BLOCKS everything!
│   <script src="app.js">   │
└──────────┬───────────────┘
           ▼
Parse HTML continues...
           ▼
Build DOM + CSSOM → Render → Paint
```

> [!caution] JavaScript blocking
> By default, `<script>` tags block HTML parsing. Use `defer` to load without blocking, or `async` to load in parallel (but not in order).

#### Resources fetched after initial HTML

Once the HTML is parsed, the browser discovers additional resources:

```html
<!-- These are found during HTML parsing and fetched in parallel -->
<link rel="stylesheet" href="styles.css">    <!-- CSS -->
<script src="app.js" defer></script>          <!-- JS (deferred) -->
<img src="hero.jpg" alt="Hero image">          <!-- Image -->
<link rel="preload" href="font.woff2">         <!-- Preloaded font -->
```

### Rendering on the GPU

Modern browsers use hardware acceleration for rendering:

```
┌─────────────────────────────────────────┐
│              Browser (Compositor)        │
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │  Layer 1  │  │  Layer 2  │  │ Layer3 │ │  ← GPU-composited layers
│  │ (Background)│ (Content)  │ (Overlay) │ │
│  └──────────┘  └──────────┘  └────────┘ │
└─────────────────────────────────────────┘
```

Properties that create new compositor layers: `transform`, `opacity`, `filter`, `will-change`, `backface-visibility: hidden`.

## Performance: How fast should this be?

| Stage | Typical time | What matters |
|-------|-------------|-------------|
| DNS resolution | 20–100 ms | Cache hits, resolver speed |
| TCP handshake | 1–3 RTTs | Network latency to server |
| TLS handshake | 1 RTT (TLS 1.3) | Server-side certificate validation |
| TTFB (Time To First Byte) | 50–500 ms | Server processing speed |
| HTML parsing + render | 100–500 ms | Page size, complexity |
| Full page load | 1–3 seconds | Total resources, optimization |

> [!tip] Core Web Vitals
> Google measures three key metrics for user experience:
> - **LCP** (Largest Contentful Paint): Under 2.5s
> - **FID** (First Input Delay): Under 100ms
> - **CLS** (Cumulative Layout Shift): Under 0.1

## Connection with the rest of the wiki

| Concept | In-depth article |
|---------|-----------------|
| DNS in detail | [[03-dns-deep-dive]] |
| HTTP in detail | [[05-http-deep-dive]] |
| HTTPS and TLS | [[07-https-tls]] |
| Status codes | [[06-status-codes]] |
| Ports and IP addresses | [[12-ports]] |
| NAT and address translation | [[13-nat]] |

## Summary

- A URL to page journey involves **7 major steps**: DNS, TCP, TLS, HTTP request, server processing, HTTP response, and rendering.
- **DNS** translates domain names to IP addresses through a hierarchy of servers.
- **TCP** establishes a reliable connection via a 3-way handshake.
- **TLS** negotiates encryption, ensuring data is private and tamper-proof.
- **HTTP** carries the actual request and response with headers and body.
- **Browser rendering** builds the DOM, CSSOM, and paints pixels to the screen.
- Performance depends on every link in this chain — optimizing just one is rarely enough.

> [!quote] The key takeaway
> The journey from URL to rendered page is a carefully orchestrated sequence of protocols, each building on the previous one. Understanding each step gives you the power to diagnose and optimize any part of the stack.
