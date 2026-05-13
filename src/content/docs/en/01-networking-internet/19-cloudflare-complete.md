---
title: "Cloudflare Complete: CDN, DNS, WAF, DDoS, SSL/TLS, Workers, Argo, Stream"
description: "Cloudflare in complete depth: CDN, DNS, WAF, DDoS protection, SSL/TLS, Workers, Argo Smart Routing, Stream, Image Optimizer, and production configuration."
---

# Cloudflare Complete: CDN, DNS, WAF, DDoS, SSL/TLS, Workers

> [!tip] Cloudflare in one sentence
> Cloudflare is **much more than a CDN**: it is a complete security and performance platform that operates at the edge of the Internet with more than 300 data centers in 120+ cities. This article covers EVERYTHING.

## What is Cloudflare?

Cloudflare is a global reverse proxy that sits between your users and your origin server. All traffic passes through Cloudflare before reaching your server.

### Cloudflare's edge network

```
                         Cloudflare Edge Network
              ┌─────────────────────────────────────────┐
              │                                         │
    Buenos Aires │    Miami      │    Frankfurt          │
    Santiago    │    Newark     │    Amsterdam          │
    Mexico City │  Dallas  │    London           │
              │                                         │
    ───────────┴──────────────────────────────────────────┐
              │
              ▼
    Your Origin Server (single exposure point)
```

Cloudflare operates in **120+ cities** with a network capacity of **22+ Tbps** (peaks of more than 71.1 Tbps during massive DDoS attacks).

### What Cloudflare provides

| Service | What it does | Free | Pro | Enterprise |
|----------|-------------|---------|---------|
| **CDN** | Global content cache | ✓ | ✓ | ✓ |
| **DNS** | Fast name resolution | ✓ | ✓ | ✓ |
| **SSL/TLS** | Automatic certificates | ✓ | ✓ | ✓ |
| **DDoS Protection** | Absorbs volumetric attacks | ✓ | ✓ | ✓ |
| **WAF** | Web application firewall | ✓ | ✓+ | ✓+ |
| **Rate Limiting** | Limits requests | ✓ | ✓ | ✓ |
| **Bot Management** | Detects bots | Basic | Advanced | Complete |
| **Argo Smart Routing** | Smart routing | ✗ | ✗ | ✓ |
| **Workers** | Edge computing | ✓ | ✓ | ✓ |
| **Stream** | Video hosting | ✗ | ✗ | ✗ |
| **Image Optimizer** | Image optimization | ✗ | ✓ | ✓ |

## 1. CDN (Content Delivery Network)

Cloudflare caches your content in data centers closest to your users:

```
Your server (Frankfurt, 100ms latency)
         │
         ├── Cloudflare Edge (Santiago, Chile, 20ms) → User in Buenos Aires
         ├── Cloudflare Edge (Mexico City, 30ms)     → User in Mexico City
         ├── Cloudflare Edge (Miami, 40ms)           → User in New York
         └── Cloudflare Edge (Amsterdam, 80ms)       → User in London
```

Without CDN, a user in Buenos Aires would have 200ms latency to Frankfurt. With Cloudflare, only 20ms to Santiago.

### What gets cached

```
Cacheable content:
  ✓ Static files (CSS, JS, images, fonts)
  ✓ Content with Cache-Control: public
  ✓ Static HTML pages
  ✓ API responses with Cache-Control: public
  ✓ RSS/Atom feeds

Non-cacheable content:
  ✗ Dynamic pages (login, dashboard)
  ✗ APIs with personalized data
  ✗ Content with Cache-Control: private or no-store
  ✗ Cookies present in request (unless using Cache Rules)
```

### Cache-Control headers

```
# Make a page cacheable for 1 hour
Cache-Control: public, max-age=3600
# → Cloudflare caches for 1 hour (Edge + Browser cache)

# Make a page cacheable for 1 hour at Edge, 1 minute in browser
Cache-Control: public, max-age=3600, s-maxage=60
# → Edge caches for 1 hour, browser caches for 1 minute

# Never cache (for authenticated pages)
Cache-Control: no-store, private
# → No caching at any level

# Cache but revalidate (stale-while-revalidate)
Cache-Control: public, max-age=300, stale-while-revalidate=600
# → Serve cached version for 300s, revalidate up to 600s after expiry
```

### Cloudflare cache rules

```
# Cache Rules in Cloudflare dashboard:
# URL: /api/data*
# Edge TTL: 300 seconds
# Browser TTL: 60 seconds
# Bypass cache: If Cookie contains "admin=true"

# Or via API:
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/cachepurge" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":false,"files":["https://example.com/page1","https://example.com/page2"]}'
```

### Cache purge

```bash
# Purge specific URL
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://example.com/page1","https://example.com/page2"]}'

# Purge all cached content
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'

# Programmatic cache tags (Pro and above)
# Set cache tags on your origin:
Cache-Control: public, max-age=3600, "cf-cache-tags":"users,posts,home"

# Purge by tag:
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  --data '{"cache_tags":["users"]}'
```

### Caching at the edge vs origin

```
Request flow with caching:
  User → Cloudflare Edge → (Cache HIT) → Serve cached content
                                      → (Cache MISS) → Forward to origin
                                                        → Cache response
                                                        → Serve to user
                                                        → Next request = HIT

Cache status codes in Cloudflare response headers:
  CF-Cache-Status: HIT     → Served from Cloudflare cache
  CF-Cache-Status: MISS    → Not in cache, fetched from origin
  CF-Cache-Status: DYNAMIC → Bypassed cache (by rules or Cache-Control)
  CF-Cache-Status: EXPIRED → Stale content, revalidating
  CF-Cache-Status: BYPASS  → Bypassed by Cache Rules
  CF-Cache-Status: REVALIDATED → Freshened stale content
```

## 2. DNS

Cloudflare operates the fastest DNS resolvers in the world (1.1.1.1) and is a full DNS provider.

### Cloudflare DNS management

When using Cloudflare as your DNS provider:

| Type | Value | Proxy status | Description |
|------|-------|-------------|-------------|
| A | Server IP | Proxied (orange) | Traffic passes through Cloudflare |
| A | Server IP | DNS only (gray) | Traffic goes directly to the server |
| CNAME | other.domain.com | Proxied | Alias with proxy |
| CNAME | other.domain.com | DNS only | Alias without proxy |
| CAA | 0 issue "letsencrypt.org" | DNS only | SSL certificate security |
| TXT | v=spf1 include:_spf.google.com ~all | DNS only | Email verification |
| MX | mail.domain.com | DNS only (priority 10) | Mail server |
| TXT | v=DMARC1... | DNS only | DMARC policy |
| TXT | google-site-verification=... | DNS only | Site ownership verification |
| SRV | _sip._tcp.domain.com | DNS only | Service location |

### Proxy status: Proxied (Orange) vs DNS Only (Gray)

| Feature | Proxied (Orange) | DNS Only (Gray) |
|---------|-----------------|-----------------|
| **CDN** | ✓ | ✗ |
| **WAF** | ✓ | ✗ |
| **DDoS Protection** | ✓ | ✗ |
| **SSL/TLS** | Managed by Cloudflare | Need your own cert |
| **Anonymized** | Your IP hidden | Your IP exposed |
| **Port restriction** | Only 80, 443, 2052, 2082, 2086, 2095 | Any port |
| **Performance** | Optimized | No optimization |

> [!tip] Orange proxy for web, gray for everything else
> - `@` and `www`: Proxied (orange) → CDN, WAF, protection
> - `mail`: DNS only (gray) → Direct mail traffic
> - `spf`, `dkim`, `dmarc`: DNS only → Required for email
> - `acme-challenge`: DNS only → Required for Let's Encrypt
> - SSH on port 22: DNS only (gray)

### DNS records explained

#### A and AAAA records

```
; A record maps a name to an IPv4 address
@       A       93.184.216.34     300     Proxied
www     A       93.184.216.34     300     Proxied

; AAAA record maps a name to an IPv6 address
www     AAAA    2606:2800:220:1:248:1893:25c8:1946  300     Proxied
```

#### CNAME records

```
; CNAME points one name to another
blog    CNAME   blog.example.com  300     DNS only
api     CNAME   api.example.com   300     Proxied
docs    CNAME   docs-site.pages.dev  300  Proxied
```

> [!caution] CNAME at the root domain
> A CNAME record cannot coexist with other records at the same name (RFC 1034). Cloudflare's CNAME flattening and ALIAS/ANAME records work around this limitation.

#### MX records

```
; MX records for email delivery (priority 10 is highest)
@       MX  10   mail.example.com.
@       MX  20   backup-mail.example.com.

; MX records must point to A or AAAA records, not CNAMEs
; (RFC 2181)
```

#### TXT records

```
; SPF (Sender Policy Framework)
@       TXT     v=spf1 include:_spf.google.com ~all

; DKIM (DomainKeys Identified Mail)
default._domainkey  TXT     k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4G...

; DMARC (Domain-based Message Authentication)
_dmarc        TXT     v=DMARC1; p=reject; rua=mailto:dmarc@example.com

; Google Verification
@       TXT     google-site-verification=abc123def456

; AWS Verification
@       TXT     amazon-verification=xyz789
```

#### CAA records

```
; CAA controls which CAs can issue certificates for your domain
@       CAA     0 issue "letsencrypt.org"
@       CAA     0 issue "sectigo.com"
@       CAA     0 iodef "mailto:security@example.com"

; Block all CAs except Let's Encrypt:
@       CAA     0 issue "letsencrypt.org"
@       CAA     0 issuewild ";"
```

#### SRV records

```
; SRV records for service discovery
_sip._tcp       SRV     10 60 5060 sip.example.com.
_xmpp-server._tcp SRV   5 0 5269 xmpp.example.com.

; Format: Priority Weight Port Target
```

### DNSSEC in Cloudflare

Cloudflare supports DNSSEC natively:

```
Enable DNSSEC in Cloudflare dashboard:
  DNS → DNSSEC → Activate

Cloudflare signs your DNS records with:
  - Zone Signing Key (ZSK)
  - Key Signing Key (KSK)

Your domain registrar must have a DS record pointing to Cloudflare:
  DS record format:
  39405 13 1 2B92DC8F... (truncated)
  39405 13 2 82B9... (truncated)
```

> [!tip] DS record at registrar
> After activating DNSSEC in Cloudflare, you must add the DS records to your domain registrar's DNS settings. Without this, validation will fail.

## 3. WAF (Web Application Firewall)

Cloudflare's WAF filters malicious traffic before it reaches your server.

### Built-in rules

| Rule Set | What it protects | Free | Pro |
|----------|-----------------|------|----- |
| **OWASP Core Ruleset** | SQL injection, XSS, command injection | ✓ | ✓ |
| **SQL Injection** | Specific SQL injection patterns | ✓ | ✓ |
| **XSS** | Cross-site scripting | ✓ | ✓ |
| **LFI** | Local file inclusion | ✓ | ✓ |
| **RFI** | Remote file inclusion | ✓ | ✓ |
| **PHP Injection** | PHP-specific attacks | ✓ | ✓ |
| **Protocol attacks** | HTTP protocol violations | ✓ | ✓ |

### Custom WAF rules

```
# Cloudflare Rules → Security → WAF → Custom Rules

# Rule 1: Block requests to common admin paths
Expression:
  (http.request.uri.path contains "/wp-admin") or
  (http.request.uri.path contains "/phpmyadmin") or
  (http.request.uri.path contains "/wp-login.php")
Action: Block
```

```
# Rule 2: Block specific user agents (scrapers, bots)
Expression:
  http.request.headers["User-Agent"] contains "Scrapy" or
  http.request.headers["User-Agent"] contains "python-requests" or
  http.request.headers["User-Agent"] contains "curl"
Action: Block (or Challenge)
```

```
# Rule 3: Protect specific API endpoints
Expression:
  http.request.uri.path starts with "/api/internal"
Action: Block
```

```
# Rule 4: Geo-blocking (block all traffic from certain countries)
Expression:
  ip.geois.country in {"CN", "RU", "KP"} and
  not ip.src in {"10.0.0.0/8", "192.168.0.0/16"}
Action: Block
```

### WAF managed rules

```
# Cloudflare Managed Rules (Pro and above)
# Pre-built rulesets from Cloudflare's security team:
# - Critical Elements: Rules for most critical vulnerabilities
# - OWASP CDN WAF Ruleset: OWASP Top 10 coverage
# - DDoS Ruleset: DDoS mitigation rules
# - Bot Fight Mode: Bot detection (Free and Pro)
```

### WAF actions

| Action | Behavior | Use case |
|--------|---------|----------|
| **Block** | Immediately block the request | Known malicious patterns |
| **JS Challenge** | Serve JavaScript challenge page | Verify browser is real |
| **Managed Challenge** | CAPTCHA or browser check | Suspicious traffic |
| **Allow** | Whitelist the request | False positives |
| **Log** | Only log, don't block | Monitoring |
| **Simulate** | Log and simulate block | Testing rules |

## 4. DDoS Protection

Cloudflare absorbs DDoS attacks before they reach your server.

### Types of DDoS attacks Cloudflare mitigates

| Attack type | Description | Cloudflare mitigation |
|-------------|-------------|----------------------|
| **Volumetric** | Floods the network with traffic | Absorbs in 300+ Tbps edge network |
| **SYN Flood** | Floods with SYN packets | Completes handshake at edge |
| **HTTP Flood** | Floods with HTTP requests | Cache content, JS challenge, rate limiting |
| **DNS Amplification** | Amplifies DNS responses | Filters and absorbs |
| **NTP Amplification** | Amplifies NTP responses | Filters and absorbs |
| **Slowloris** | Holds connections open | Timeout idle connections |
| **Slow POST** | Slowly sends request body | Timeout slow request body |
| **SSDP Amplification** | Amplifies SSDP responses | Filters and absorbs |

### DDoS protection at each layer

```
Layer 3/4 (Volumetric):
  Cloudflare absorbs attacks at the network level
  - 300+ Tbps global capacity
  - AnyCast routing (attack traffic distributed globally)
  - No action needed from origin

Layer 7 (Application):
  Cloudflare filters malicious HTTP requests
  - Cache static content (reduces origin load)
  - Rate limiting (limits requests per IP/time)
  - JS Challenge (requires JavaScript execution)
  - Bot Management (identifies and blocks bots)
```

## 5. SSL/TLS

Cloudflare offers comprehensive SSL/TLS management.

### SSL/TLS modes

| Mode | Client → Cloudflare | Cloudflare → Origin | When to use |
|------|-------------------|-------------------|-------------|
| **Off** | No HTTPS | No HTTPS | Local testing only |
| **Flexible** | HTTPS | HTTP | Origin has no SSL |
| **Full** | HTTPS | HTTPS (any cert) | Origin has any SSL cert |
| **Full (strict)** | HTTPS | HTTPS (valid cert) | **RECOMMENDED** |
| **Strict** | HTTPS | HTTPS (valid, verified) | Maximum security |

> [!caution] Never use Flexible in production
> Flexible mode creates a security gap: the connection between Cloudflare and your origin is NOT encrypted. An attacker on the network between Cloudflare and your origin can intercept or modify traffic. Always use Full (strict) or higher.

### Cloudflare Origin Certificates

```
Cloudflare Origin Certificate:
  - Issued by Cloudflare (not Let's Encrypt)
  - Only valid for traffic coming from Cloudflare
  - Domain-validated (no org verification needed)
  - Valid for 15 years
  - Install on your origin server for Full (strict) mode

Usage:
  1. Generate Origin Certificate in Cloudflare dashboard
  2. Install cert + key on your Nginx/Apache
  3. Set Cloudflare SSL mode to Full (strict)
```

### TLS 1.3 support

```
Cloudflare supports TLS 1.3 by default.

Cipher suites supported:
  - TLS_AES_256_GCM_SHA384
  - TLS_AES_128_GCM_SHA256
  - TLS_CHACHA20_POLY1305_SHA256

Check TLS version:
  openssl s_client -connect example.com:443 -tls1_3
```

### HSTS

```
Cloudflare enables HSTS for all proxied domains:
  Strict-Transport-Security: max-age=15552000; includeSubDomains; preload

You can customize this in the Cloudflare dashboard:
  SSL/TLS → Edge Certificates → HSTS
```

## 6. Cloudflare Workers

Cloudflare Workers is Cloudflare's serverless compute platform. Code runs on Cloudflare's edge network, close to users.

### How Workers work

```
                   Cloudflare Edge Network
              ┌─────────────────────────────────┐
              │                                 │
    Chile    │   Miami     │   Frankfurt         │
    NYC      │   London    │   Amsterdam         │
              │                                 │
    ───────────┴──────────────────────────────────┐
              │
    Workers run on EVERY edge location
    Response: ~0ms additional latency
```

### Workers runtime

```
V8 isolate (isolated execution environment)
  ├─ JavaScript/TypeScript/Wasm
  ├─ Fetch API (intercept and modify requests)
  ├─ KV (key-value store)
  ├─ D1 (SQLite database)
  ├─ R2 (object storage, S3-compatible)
  ├─ Queues (async messaging)
  └─ Email API

Cold start: ~0ms (warm instances)
Execution limit: 5ms (Free), 50ms (Paid)
```

### Example: Workers basic proxy

```javascript
// worker.js
export default {
  async fetch(request, env, ctx) {
    // Log the request
    console.log(`Received request: ${request.method} ${request.url}`);

    // Modify the request
    const url = new URL(request.url);
    if (url.pathname === '/api/time') {
      return new Response(JSON.stringify({
        time: new Date().toISOString(),
        server: 'Cloudflare Edge'
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Forward to origin
    return fetch(request);
  }
};
```

### Example: Workers caching with KV

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Try cache first
    const cache = caches.default;
    const cachedResponse = await cache.match(url);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Fetch from origin
    let response = await fetch(request);

    // Cache the response for 1 hour
    const cacheControl = response.headers.get('Cache-Control') || 'public, max-age=3600';
    await cache.put(url, response.clone());

    return response;
  }
};
```

### Example: Workers with KV

```javascript
// Bind KV namespace in wrangler.toml
// [[kv_namespaces]]
// binding = "COUNTER"
// id = "your-kv-id"

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/counter') {
      let count = parseInt(await env.COUNTER.get('visits') || '0');
      count++;
      await env.COUNTER.put('visits', count.toString());
      return new Response(`Visit count: ${count}`, {
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    return new Response('Hello from Cloudflare Workers!', {
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};
```

### Workers pricing

| Plan | Price | Requests/month | CPU ms/month |
|------|-------|---------------|-------------|
| **Free** | $0 | 100,000 | 10,000 |
| **Pro** | $5 | 10,000,000 | 1,000,000 |
| **Enterprise** | Custom | Unlimited | Unlimited |

## 7. Argo Smart Routing

Argo Smart Routing optimizes the path your traffic takes through the Internet:

```
Standard routing:
  User → ISP → Cloudflare → ISP → Origin
  (uses public Internet, variable quality)

Argo Smart Routing:
  User → ISP → Cloudflare → Argo backbone → Origin
  (uses private fiber network, lower latency, less jitter)
```

```
Benefits:
  - Lower latency: Private network avoids congested public peering
  - Less jitter: More consistent response times
  - Reduced packet loss: Private backbone
  - 5-15% latency improvement on average
  - Up to 50% reduction in packet loss

Pricing:
  - Argo Smart Routing: $0.50/GB of traffic
  - Argo Tunnel: $5/month (no traffic charge)
```

## 8. Additional services

### Cloudflare Stream

Video hosting and delivery platform:

```
Cloudflare Stream:
  - Upload videos once
  - Automatically transcodes to multiple formats
  - Delivers via CDN (same network as web traffic)
  - Player with captions, subtitles, DVR controls
  - No storage or bandwidth limits

Pricing:
  - Upload: Free (first 10,000 minutes)
  - Storage: $1/1000 GB/month after free tier
  - Playback: $0.01/GB after free tier (5,000 GB/month)
```

### Cloudflare R2

S3-compatible object storage with no egress fees:

```
Cloudflare R2 vs AWS S3:
  R2:    $0.015/GB/month storage, $0/GB egress
  S3:    $0.023/GB/month storage, $0.09/GB egress

  R2 has NO egress fees. S3 charges for data transfer out.

  - Compatible with S3 API
  - No cold storage fees
  - No request fees
  - Global distribution through Cloudflare network
```

### Cloudflare Pages

Static site hosting with CI/CD:

```
Cloudflare Pages:
  - Connect GitHub/GitLab repository
  - Automatically build and deploy on push
  - Preview deployments for pull requests
  - Free: 500 builds/month, 500 GB bandwidth
  - Pro: $20/month, unlimited builds

  Frameworks supported:
  - Next.js, Nuxt, SvelteKit, Remix, Hugo, Jekyll, Gatsby
  - Vite, Astro, 11ty, and more
```

## Production configuration checklist

### DNS setup

```
@       A       YOUR_ORIGIN_IP   Proxied (orange)
www     A       YOUR_ORIGIN_IP   Proxied (orange)
api     CNAME   your-origin.com  Proxied (orange)
mail    A       MAIL_SERVER_IP   DNS only (gray)
@       MX  10  mail.domain.com  DNS only
@       TXT   v=spf1 include:_spf.google.com ~all  DNS only
@       CAA   0 issue "letsencrypt.org"  DNS only
```

### SSL/TLS settings

```
SSL/TLS Mode: Full (strict)
Minimum TLS Version: TLS 1.2
TLS 1.3: Enabled
Automatic HTTPS Revisions: On
HSTS: Enabled (max-age=31536000)
HTTP Strict Transport Security Preloading: On (if eligible)
Always Use HTTPS: On
Early Hints: On
```

### Performance settings

```
Brotli: On
Minimum Expires Header: 0 seconds
Auto Minify: CSS, JavaScript, HTML (if safe)
Rocket Loader: Off (can break JavaScript)
Development Mode: Off
Server Side Excludes: Off
```

### Security settings

```
Bot Fight Mode: On (Free and Pro)
WAF: OWASP Core Ruleset enabled
Rate Limiting:
  - 5 requests/second per IP to /api/*
  - 100 requests/minute per IP to /login
  - 200 requests/minute per IP to /

Zero Trust: Enable for internal access
Access Rules: Block specific countries/ASNs
IP Access Rules: Block known bad actors
```

## Connection with the rest of the wiki

| Concept | In-depth article |
|---------|-----------------|
| DNS deep-dive | [[03-dns-deep-dive]] |
| HTTPS/TLS | [[07-https-tls]] |
| Cloudflare intro | [[04-cloudflare-intro]] |
| Let's Encrypt | [[08-lets-encrypt]] |

## Summary

- Cloudflare is a **complete platform**: CDN, DNS, WAF, DDoS protection, SSL/TLS, Workers, Argo, Stream, and more.
- The **CDN** caches content globally, reducing latency by serving from edge locations.
- **DNS** management with proxy options (orange = proxied, gray = DNS only).
- **WAF** provides built-in rules (OWASP) and custom rules for application-specific protection.
- **DDoS protection** absorbs volumetric and application-layer attacks before they reach your origin.
- **SSL/TLS** modes range from Off (insecure) to Full Strict (recommended for production).
- **Workers** enable serverless compute at the edge with 0ms cold starts.
- **Argo Smart Routing** uses a private network backbone for lower latency.
- Always use **Full (strict)** SSL mode, enable **HSTS**, and configure **rate limiting** for production.

> [!quote] The key takeaway
> Cloudflare is not "just a CDN". It is a comprehensive security and performance platform that handles CDN, DNS, WAF, DDoS protection, SSL/TLS management, and edge computing. The free plan is remarkably complete — for most projects, it provides more than enough protection and performance.
