---
title: "HTTP Deep-Dive: Methods, Headers, Body, Pipeline, HTTP/1.1 vs HTTP/2 vs HTTP/3"
description: "HTTP deep-dive: HTTP methods (GET, POST, PUT, PATCH, DELETE), headers, request body, request pipeline, and the evolution from HTTP/1.1 to HTTP/2 to HTTP/3."
---

# HTTP Deep-Dive: Methods, Headers, Body, Pipeline, HTTP/1.1 vs HTTP/2 vs HTTP/3

> [!tip] HTTP in a nutshell
> HTTP (HyperText Transfer Protocol) is the foundation of data communication on the World Wide Web. It is an application-layer, request-response protocol where clients send requests and servers send responses. This article covers HTTP in full depth.

## What is HTTP?

HTTP is a **stateless, request-response protocol** that operates on top of TCP (and in HTTP/3, on top of QUIC/UDP). It defines how messages are formatted and transmitted, and what actions web servers and browsers should take in response.

### HTTP at the OSI model

HTTP operates at the **Application layer** (Layer 7), using TCP at the transport layer:

```
┌─────────────────────────────────┐
│  HTTP/1.1 / HTTP/2 / HTTP/3    │ ← Application layer
│  ┌─────────────────────────────┐│
│  │  TCP (HTTP/1.1 & HTTP/2)   ││ ← Transport layer
│  │  ┌─────────────────────────┐││
│  │  │  QUIC (HTTP/3 only)     │││ ← QUIC layer
│  │  ┌───────────────────────┐│││
│  │  │  UDP                  ││││ ← Transport (HTTP/3)
│  │  ┌─────────────────────┐││││
│  │  │  TCP                │││││ ← Transport (HTTP/1.1/2)
│  │  ┌───────────────────┐│││││
│  │  │  IP               ││││││ ← Network layer
│  │  └───────────────────┘│││││
│  │  └─────────────────────┘│││
│  │  └──────────────────────┘││
│  └────────────────────────────┘│
└─────────────────────────────────┘
```

### HTTP is request-response

```
Client                          Server
   │─── GET /index.html ────────→│  Request
   │   Host: example.com         │
   │   User-Agent: Chrome...     │
   │                           │
   │←── 200 OK ─────────────────│  Response
   │   Content-Type: text/html   │
   │   Content-Length: 4832      │
   │                           │
   │─── POST /api/data ─────────→│  Next request
   │                           │
   │←── 201 Created ────────────│  Next response
```

## HTTP message structure

Every HTTP message has three parts:

### 1. Start line

**Request line** (for client → server):
```
GET /index.html HTTP/1.1
```
- Method (`GET`)
- Path (`/index.html`)
- HTTP version (`HTTP/1.1`)

**Status line** (for server → client):
```
HTTP/1.1 200 OK
```
- HTTP version (`HTTP/1.1`)
- Status code (`200`)
- Reason phrase (`OK`)

### 2. Headers

```
Host: example.com
User-Agent: Mozilla/5.0 (Macintosh; Intel...)
Accept: text/html,application/xhtml+xml
Accept-Language: en-US,en;q=0.9
Accept-Encoding: gzip, br
Connection: keep-alive
```

### 3. Body (optional)

```
{
  "username": "john",
  "password": "secret123"
}
```

The body is present in requests (POST, PUT, PATCH) and most server responses, but NOT in GET or HEAD requests.

## HTTP methods

HTTP methods define **what action** the client wants to perform. They are categorized as safe, idempotent, or cacheable.

| Method | Description | Safe? | Idempotent? | Cacheable? |
|--------|-------------|-------|-------------|------------|
| **GET** | Retrieve a resource | ✅ Yes | ✅ Yes | ✅ Yes |
| **HEAD** | Same as GET but no body | ✅ Yes | ✅ Yes | ✅ Yes |
| **POST** | Submit data to a server | ❌ No | ❌ No | Sometimes |
| **PUT** | Replace a resource entirely | ❌ No | ✅ Yes | ❌ No |
| **PATCH** | Partially update a resource | ❌ No | ❌ No | ❌ No |
| **DELETE** | Remove a resource | ❌ No | ✅ Yes | ❌ No |
| **OPTIONS** | Get supported methods | ✅ Yes | ✅ Yes | ❌ No |
| **TRACE** | Echo the request back | ✅ Yes | ✅ Yes | ❌ No |

### GET vs POST

| Aspect | GET | POST |
|--------|-----|------|
| **Purpose** | Retrieve data | Submit data |
| **Body** | No body (but not forbidden) | Body with data |
| **Parameters** | In URL (`?key=value`) | In body |
| **Cacheable** | Yes | Rarely |
| **Bookmarkable** | Yes | No |
| **Length** | URL length limited (~2048 chars) | No theoretical limit |
| **Safe** | Yes (idempotent) | No |
| **Visible in URL** | Yes | No |

### PUT vs PATCH

```
PUT /api/users/123 HTTP/1.1
Content-Type: application/json

{
  "name": "John",
  "email": "john@example.com",
  "age": 30
}
→ Replaces the ENTIRE user resource. All fields must be present.

PATCH /api/users/123 HTTP/1.1
Content-Type: application/json

{
  "age": 31
}
→ Updates ONLY the specified fields. Age changes from 30 to 31. Name and email unchanged.
```

### Safe methods (no side effects)

- **GET**: Should not modify server state
- **HEAD**: Same as GET, but no body
- **OPTIONS**: Only returns metadata

> [!caution] GET should never modify data
> Even though HTTP does not technically forbid a body in GET requests, any method that changes server state should NOT use GET. This is why search queries use GET (read-only) but form submissions use POST (writes data).

## HTTP headers

HTTP headers are key-value pairs that provide metadata about the request or response.

### Request headers

| Header | Purpose | Example |
|--------|---------|---------|
| `Host` | Target domain (required in HTTP/1.1) | `Host: example.com` |
| `User-Agent` | Client identification | `User-Agent: Mozilla/5.0...` |
| `Accept` | Content types accepted | `Accept: application/json` |
| `Accept-Language` | Preferred languages | `Accept-Language: en-US` |
| `Accept-Encoding` | Compression methods | `Accept-Encoding: gzip, br` |
| `Authorization` | Credentials | `Authorization: Bearer eyJhbG...` |
| `Cookie` | Stored cookies | `Cookie: session=abc123` |
| `Referer` | Page that linked to this resource | `Referer: https://example.com/page` |
| `Origin` | Origin of cross-origin request | `Origin: https://example.com` |
| `Content-Type` | Media type of the body | `Content-Type: application/json` |
| `Content-Length` | Size of the body in bytes | `Content-Length: 234` |
| `X-Forwarded-For` | Original client IP (via proxy) | `X-Forwarded-For: 203.0.113.45` |
| `X-Request-ID` | Request tracing ID | `X-Request-ID: req-abc-123` |

### Response headers

| Header | Purpose | Example |
|--------|---------|---------|
| `Content-Type` | Media type of the response | `Content-Type: text/html; charset=utf-8` |
| `Content-Length` | Size of the response body | `Content-Length: 4832` |
| `Content-Encoding` | Compression used | `Content-Encoding: gzip` |
| `Cache-Control` | Caching directives | `Cache-Control: max-age=3600, public` |
| `ETag` | Entity tag for cache validation | `ETag: "abc123-5f3a"` |
| `Last-Modified` | Last modification timestamp | `Last-Modified: Mon, 13 May 2026` |
| `Set-Cookie` | Cookie to store | `Set-Cookie: session=xyz; HttpOnly; Secure` |
| `Location` | Redirect destination | `Location: https://example.com/new-page` |
| `Server` | Server software | `Server: nginx/1.24.0` |
| `X-Frame-Options` | Clickjacking protection | `X-Frame-Options: DENY` |
| `X-Content-Type-Options` | Prevent MIME sniffing | `X-Content-Type-Options: nosniff` |
| `Strict-Transport-Security` (HSTS) | Force HTTPS | `max-age=31536000; includeSubDomains` |
| `Access-Control-Allow-Origin` | CORS policy | `Access-Control-Allow-Origin: *` |

### Conditional requests with headers

HTTP supports conditional requests, where the server only responds if certain conditions are met:

```
# Client sends a request with ETag
GET /api/data HTTP/1.1
If-None-Match: "abc123-5f3a"

# If the resource hasn't changed, server returns:
HTTP/1.1 304 Not Modified

# If it has changed, server returns:
HTTP/1.1 200 OK
ETag: "def456-7g8h"
... (full response body)
```

```
# Client sends a request with Last-Modified
GET /api/data HTTP/1.1
If-Modified-Since: Mon, 13 May 2026 00:00:00 GMT

# Same logic: 304 if unchanged, 200 with body if changed
```

## Request body formats

The body format depends on the `Content-Type` header:

### application/json

The most common format for APIs:

```
POST /api/users HTTP/1.1
Host: example.com
Content-Type: application/json
Content-Length: 67

{
  "name": "John Doe",
  "email": "john@example.com",
  "age": 30
}
```

### application/x-www-form-urlencoded

The default format for HTML forms:

```
POST /login HTTP/1.1
Host: example.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 33

username=john&password=secret123
```

### multipart/form-data

For file uploads:

```
POST /upload HTTP/1.1
Host: example.com
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="file"; filename="photo.jpg"
Content-Type: image/jpeg

... binary file content ...
------WebKitFormBoundary
Content-Disposition: form-data; name="caption"

My vacation photo
------WebKitFormBoundary--
```

### application/xml

XML format (less common now but still used):

```
POST /api/users HTTP/1.1
Host: example.com
Content-Type: application/xml

<?xml version="1.0"?>
<user>
  <name>John Doe</name>
  <email>john@example.com</email>
</user>
```

## HTTP/1.1

HTTP/1.1 (RFC 7230-7235) is the most widely used version. It introduced several key features:

### Key features of HTTP/1.1

- **Persistent connections** (`Connection: keep-alive`): Reuse TCP connections for multiple requests
- **Chunked transfer encoding**: Send responses with unknown size
- **Host header**: Required for virtual hosting (multiple domains on one IP)
- **Range requests**: Download parts of a file (`Range: bytes=0-1000`)
- **Pipelining**: Send multiple requests without waiting for responses

### HTTP/1.1 pipelining (rarely used)

Pipelining allows multiple requests on one connection:

```
Client                          Server
   │─── GET /a HTTP/1.1 ────────→│
   │─── GET /b HTTP/1.1 ────────→│  ← Second request before first response
   │─── GET /c HTTP/1.1 ────────→│  ← Third request before second response
   │                           │
   │←── 200 /a ─────────────────│
   │←── 200 /b ─────────────────│
   │←── 200 /c ─────────────────│
```

**Problem**: Head-of-line blocking. If response A is slow, responses B and C must wait, even though they could have been faster. This is why pipelining was deprecated in practice.

### Connection: keep-alive in HTTP/1.1

```
# First request
GET /index.html HTTP/1.1
Host: example.com

# Server responds
HTTP/1.1 200 OK
Content-Type: text/html
Connection: keep-alive

# Second request on SAME connection (no new TCP handshake)
GET /style.css HTTP/1.1
Host: example.com

# Third request on SAME connection
GET /app.js HTTP/1.1
Host: example.com
```

> [!tip] Why keep-alive matters
> Without keep-alive, every request requires a full TCP 3-way handshake. For a page with 20 resources, that is 20 × 3 RTTs wasted just on connections. Keep-alive reduces this to 1 handshake + 19 requests on the same connection.

## HTTP/2

HTTP/2 (RFC 7540) was introduced to solve HTTP/1.1's performance problems. It is NOT a new protocol at the application level — the same methods, headers, and semantics apply. The changes are in **how data is transmitted**:

### Key features of HTTP/2

| Feature | HTTP/1.1 | HTTP/2 |
|---------|----------|--------|
| **Transmission** | Text-based, line by line | Binary framing |
| **Multiplexing** | One request per connection (usually) | Multiple concurrent streams per connection |
| **Header compression** | None (each request repeats headers) | HPACK compression (~70–90% reduction) |
| **Server push** | Not available | Server can push resources before requested |
| **Priority** | No priority for requests | Stream prioritization with weights |
| **Head-of-line blocking** | Yes (request by request) | At TCP level only (not application level) |

### Binary framing in HTTP/2

HTTP/2 replaces HTTP/1.1's text-based protocol with binary framing:

```
+-----------------------------------------------+
|                 Length (24)                    |
+---------------+---------------+---------------+
|   Type (8)    |   Flags (8)   |R|
+---------------+---------------+---------------+
|                        Stream Identifier (31) |
+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
|                   Frame Payload...            |
+/+/+/+/+/+/+/+/+/+/+/+/+/+/+/+/+/+/+/+/+/+/+/+
```

### Stream multiplexing

HTTP/2 allows multiple streams over a single TCP connection:

```
┌────────────────────────────────────────────────┐
│              TCP Connection                     │
│                                                │
│  Stream 1: [GET /index.html][200 OK][HTML...]  │
│  Stream 2: [GET /style.css][200 OK][CSS...]    │
│  Stream 3: [GET /app.js][200 OK][JS...]        │
│  Stream 4: [POST /api/data][201 Created]       │
│  Stream 5: [GET /image.png][200 OK][PNG...]    │
└────────────────────────────────────────────────┘
All on the same connection, all interleaved!
```

### Server push

HTTP/2 allows the server to send resources before the client requests them:

```
Client                          Server
   │─── GET /index.html ────────→│
   │                           │
   │←── 200 OK ─────────────────│  HTML
   │←── PUSH_PROMISE: /style.css     │  Server pushes CSS before asked
   │←── 200 OK ─────────────────│  CSS
   │←── PUSH_PROMISE: /app.js        │  Server pushes JS before asked
   │←── 200 OK ─────────────────│  JS

   # Server anticipates what the client will need
```

> [!caution] Server push can be harmful
> Pushing resources the client already has cached wastes bandwidth. Modern browsers allow clients to cancel pushes, and many developers disable it. Use push only for critical above-the-fold resources.

### HTTP/2 priorities

```
Stream 1 (weight 16): /index.html     ← Highest priority
  ├── Stream 2 (weight 8): /style.css  ← Secondary
  │   ├── Stream 4 (weight 4): /fonts/roboto.woff2
  │   └── Stream 5 (weight 4): /icons.svg
  └── Stream 3 (weight 8): /app.js
      └── Stream 6 (weight 4): /vendor.js
```

## HTTP/3

HTTP/3 (RFC 9114) replaces TCP with **QUIC** (Quick UDP Internet Connections) at the transport layer. This solves the fundamental problem of TCP-level head-of-line blocking.

### Key differences: HTTP/3 vs HTTP/2

| Feature | HTTP/2 | HTTP/3 |
|---------|--------|--------|
| **Transport** | TCP | QUIC (over UDP) |
| **Port** | 443 (TCP) | 443 (UDP) |
| **Multiplexing** | Yes (but TCP HOL blocking still exists) | Yes (inherent, per-stream) |
| **Handshake** | TCP + TLS (~2 RTT, ~1 RTT with TLS 1.3) | QUIC handshake (~1 RTT, ~0 RTT resumption) |
| **Connection migration** | No (IP change = new connection) | Yes (QUIC connection ID) |
| **Header compression** | HPACK | QPACK (de-coupled, no HOL blocking) |
| **Retransmission** | All streams wait for lost packet | Only affected stream waits |

### How QUIC works

```
Client                          Server
   │─── ClientHello + Key ──────→│  (UDP datagram)
   │   + Initial + Crypto        │
   │                           │
   │←── ServerHello + Key ──────│  (UDP datagram)
   │   + Initial + Crypto        │
   │                           │
   │─── ACK + Handshake ───────→│
   │                           │
   │  QUIC connection ready     │
   │  HTTP/3 on top of QUIC     │
```

QUIC combines TLS 1.3 handshake into the first round-trip:

```
RTT 0:     Client sends Initial packet (with TLS ClientHello + key exchange)
RTT 1:     Server responds with Handshake packet (TLS ServerHello + certificate)
RTT 2:     Client sends encrypted application data
```

With 0-RTT resumption:
```
RTT 0:     Client sends Initial packet (with TLS ClientHello + 0-RTT data)
           → Server accepts → Data is processed immediately!
```

### Connection migration

QUIC supports connection migration:

```
WiFi A (192.168.1.5) → Switch to WiFi B (10.0.0.5)

TCP: Connection drops. New handshake required.
QUIC: Connection persists! The connection ID identifies the session,
      not the IP address. Data flows seamlessly across network changes.
```

This is crucial for mobile devices that frequently switch networks.

### Why HTTP/3 adoption is growing

| Benefit | Explanation |
|---------|-------------|
| **Faster connection setup** | 0-RTT resumption means repeat visits are near-instant |
| **No TCP HOL blocking** | Lost UDP packets only affect one stream |
| **Better mobile experience** | Connection migration across network changes |
| **Built-in encryption** | QUIC is always encrypted (TLS 1.3) |
| **Firewall friendly** | UDP port 443 is rarely blocked |

> [!caution] HTTP/3 requires UDP support
> Some corporate firewalls and networks block or rate-limit UDP traffic. This can cause HTTP/3 connections to fail or perform worse than HTTP/2 in certain environments.

## HTTP/1.1 vs HTTP/2 vs HTTP/3: Comparison summary

| Feature | HTTP/1.1 | HTTP/2 | HTTP/3 |
|---------|----------|--------|--------|
| Year | 1999 (RFC 2616) | 2015 (RFC 7540) | 2022 (RFC 9114) |
| Transport | TCP | TCP | QUIC (UDP) |
| Header compression | None | HPACK | QPACK |
| Multiplexing | No | Yes (shared connection) | Yes (per-stream) |
| Server push | No | Yes | Limited |
| Priority | No | Yes | Yes |
| Connection migration | No | No | Yes |
| 0-RTT | No | No | Yes |
| Security | Optional (HTTPS) | Optional (HTTPS) | Required (QUIC encrypts) |
| HOL blocking | Yes (per-request) | TCP-level only | Stream-level (minimal) |
| Bandwidth overhead | High | Medium | Low |

## HTTP request lifecycle in a server

### Request parsing

```javascript
// Express.js example: what the server sees
app.post('/api/users', async (req, res) => {
  // req.method  → "POST"
  // req.url     → "/api/users"
  // req.headers → { host: '...', content-type: 'application/json', ... }
  // req.body    → { name: 'John', email: 'john@example.com' }

  // Middleware runs in order:
  // 1. Body parser: parse JSON body
  // 2. Auth middleware: verify Bearer token
  // 3. Validation middleware: check required fields
  // 4. Database operation: create user
  // 5. Send response
});
```

### Response generation flow

```
1. Parse request (method, path, headers, body)
2. Route matching (which handler handles this request?)
3. Middleware chain (auth, logging, caching, validation)
4. Business logic (database queries, API calls)
5. Generate response (status code, headers, body)
6. Serialize response (JSON, HTML, binary)
7. Send response over the connection
8. Connection: keep-alive? → Wait for next request on same connection
9. Connection: close? → Close TCP connection
```

## Connection management

### Keep-alive vs Connection close

```
# Keep-alive: reuse connection
GET /a HTTP/1.1
Connection: keep-alive
→ Server responds with Connection: keep-alive
→ Next request on same TCP connection

# Connection close: close after response
GET /a HTTP/1.1
Connection: close
→ Server responds with Connection: close
→ TCP connection closed after response
```

### Timeouts

| Timeout type | Typical value | Purpose |
|-------------|--------------|---------|
| **Connection idle timeout** | 5–65 seconds | Close idle keep-alive connections |
| **Request timeout** | 30–60 seconds | Close slow requests |
| **Read timeout** | 30 seconds | Timeout waiting for request headers/body |
| **Write timeout** | 30 seconds | Timeout sending response |

> [!tip] Cloudflare timeout values
> Cloudflare uses aggressive timeouts to free resources:
> - Read timeout: 10 seconds
> - Write timeout: 100 seconds
> - Connection keep-alive: 100 seconds

## Connection with the rest of the wiki

| Concept | In-depth article |
|---------|-----------------|
| HTTP methods and semantics | [[11-rest-api]] — REST API design |
| Status codes | [[06-status-codes]] |
| HTTPS and TLS | [[07-https-tls]] |
| Cookies and sessions | [[09-cookies-sessions]] |

## Summary

- **HTTP is a stateless request-response protocol** at the application layer.
- **Methods** define actions: GET (retrieve), POST (submit), PUT (replace), PATCH (update), DELETE (remove).
- **Headers** carry metadata: authentication, content type, caching, compression.
- **Body** carries data: JSON, form data, multipart uploads, XML.
- **HTTP/1.1** uses persistent connections and pipelining, but suffers from head-of-line blocking.
- **HTTP/2** introduces binary framing, multiplexing, header compression (HPACK), and server push.
- **HTTP/3** replaces TCP with QUIC (UDP), enabling 0-RTT resumption, connection migration, and stream-level multiplexing without TCP HOL blocking.
- Each HTTP version builds on the previous one, solving real-world performance problems.

> [!quote] The key takeaway
> HTTP has evolved from a simple text-based protocol (HTTP/1.1) to a binary, multiplexed, encrypted protocol (HTTP/3). Understanding the differences helps you choose the right version, optimize your server, and diagnose performance issues.
