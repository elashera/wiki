---
title: "HTTPS and TLS: Handshake Step by Step, Certificates, Cipher Suites, SNI, HSTS"
description: "HTTPS and TLS explained step by step: TLS handshake, certificates, cipher suites, SNI, HSTS, certificate pinning, and the security properties of HTTPS."
---

# HTTPS and TLS: Handshake Step by Step, Certificates, Cipher Suites, SNI, HSTS

> [!tip] HTTPS in a nutshell
> HTTPS is HTTP encrypted by TLS (Transport Layer Security). TLS provides confidentiality (encryption), integrity (tamper detection), and authentication (server identity verification). This article covers every layer of the TLS protocol.

## What is HTTPS?

HTTPS is **HTTP over TLS/SSL**. It encrypts the communication between client and server, protecting against eavesdropping, tampering, and man-in-the-middle attacks.

```
HTTP (port 80):
  Client ──→ [plaintext: GET /index.html] ──→ Server
  Server ──→ [plaintext: HTML response] ──→ Client
  Any middlebox can read or modify this traffic

HTTPS (port 443):
  Client ──→ [encrypted: U8x#kLm!pQz...] ──→ Server
  Server ──→ [encrypted: 7yR$tWn@jHv...] ──→ Client
  Middlebox cannot read or modify the traffic
```

## TLS vs SSL

| | SSL (Secure Sockets Layer) | TLS (Transport Layer Security) |
|--|--------------------------|-------------------------------|
| **Version** | 1.0 (1995), 2.0 (1996), 3.0 (1996) | 1.0 (1999), 1.1 (2006), 1.2 (2008), 1.3 (2018) |
| **Security** | Insecure (POODLE, BEAST vulnerabilities) | Secure (TLS 1.3 is the current standard) |
| **Status** | Deprecated everywhere | Required for modern security |
| **TLS 1.0/1.1** | Also deprecated (RFC 8996, 2021) | TLS 1.2 widely supported, TLS 1.3 recommended |

> [!caution] Disable SSL entirely
> No modern server should use SSL 1.0, 2.0, or 3.0. They have known cryptographic vulnerabilities. Disable all SSL versions and only support TLS 1.2+. TLS 1.3 is the current gold standard.

## The TLS 1.3 Handshake (Step by Step)

This is the most detailed, precise walkthrough of the TLS handshake.

### Step 0: Prerequisites

Before the handshake begins, the client and server need:
- TCP connection established
- Client knows the server's IP address (from DNS)

### Step 1: ClientHello

The client initiates the handshake:

```
Client → Server: ClientHello

Contents:
├── TLS Version: 0x0303 (TLS 1.2) [used for compatibility]
├── Client Random: 32 bytes of random data (for key generation)
├── Session ID: (empty for new connection, or ID from previous session)
├── Cipher Suites List (in order of preference):
│   ├── TLS_AES_256_GCM_SHA384 (TLS 1.3)
│   ├── TLS_CHACHA20_POLY1305_SHA256 (TLS 1.3)
│   └── TLS_AES_128_GCM_SHA256 (TLS 1.3)
├── Supported Groups (key exchange):
│   ├── x25519
│   ├── secp256r1
│   └── secp384r1
├── Signature Algorithms:
│   ├── ecdsa_secp256r1_sha256
│   └── rsa_pss_rsae_sha256
├── Extension: Server Name Indication (SNI)
│   └── server_name: "example.com"
├── Extension: Supported Versions
│   └── TLS 1.3, TLS 1.2
├── Extension: Key Share
│   ├── x25519: <client's public key>
│   └── secp256r1: <client's public key>
└── Extension: PSK (Pre-Shared Key)
    └── (if resuming a previous session)
```

### What happens in ClientHello

1. The client tells the server: "I want a secure connection. Here are the features I support."
2. The **Cipher Suites List** tells the server what encryption algorithms the client can handle.
3. The **Key Share** extension sends the client's public key for the key exchange.
4. **SNI** tells the server which domain the client is connecting to (for shared hosting).
5. The **Client Random** is used in key derivation.

### Step 2: ServerHello

The server responds:

```
Server → Client: ServerHello

Contents:
├── TLS Version: 0x0303 (TLS 1.2) [used for compatibility]
├── Server Random: 32 bytes of random data (for key generation)
├── Cipher Suite Selected: TLS_AES_256_GCM_SHA384
├── Extension: Key Share
│   └── x25519: <server's public key>
└── Extension: Supported Versions
    └── TLS 1.3
```

### What happens in ServerHello

1. The server picks the best cipher suite from the client's list.
2. The server sends its own random bytes.
3. The server sends its public key (for key exchange).

### Step 3: Server Certificate and Key Exchange

```
Server → Client: EncryptedExtensions + Certificate + CertificateVerify + Finished

Contents:
├── EncryptedExtensions (empty, but establishes encryption)
├── Certificate:
│   ├── Certificate:
│   │   ├── Subject: CN=example.com
│   │   ├── Issuer: CN=R13 (Let's Encrypt)
│   │   ├── Public Key: RSA 2048-bit / ECDSA P-256
│   │   ├── Valid From: Jan 1 2026
│   │   └── Valid To: Apr 1 2026
│   ├── Certificate: (intermediate certificate)
│   │   ├── Subject: CN=R13
│   │   ├── Issuer: CN=ISRG Root X1
│   │   └── ... (signed by root)
│   └── Certificate: (root certificate - usually not sent)
│       ├── Subject: CN=ISRG Root X1
│       └── ... (self-signed, trusted by the client)
├── CertificateVerify:
│   └── Signature: <signature of all handshake messages>
└── Finished:
    └── VerifyData: <MAC of all handshake messages>
```

### How the client verifies the certificate

```
1. Check expiration dates (not after / not before)
2. Check hostname matches (example.com matches the SNI)
3. Build the certificate chain:
   Server cert → Intermediate cert → Root cert
4. Verify the root cert is in the client's trust store (pre-installed)
5. Verify signatures at each level:
   - Server cert signed by Intermediate? ✓
   - Intermediate cert signed by Root? ✓
6. Check for revocation (OCSP Stapling or CRL)
7. If all checks pass → trust the server
```

### Certificate Chain of Trust

```
┌─────────────────────────────────────┐
│  ISRG Root X1 (Root CA)             │  ← Trust anchor (pre-installed in OS/browsers)
│  (Self-signed)                      │
└────────────┬────────────────────────┘
             │ Signed by Root X1
┌────────────▼────────────────────────┐
│  R13 (Intermediate CA)              │  ← Let's Encrypt intermediate
│  (Signed by ISRG Root X1)           │
└────────────┬────────────────────────┘
             │ Signed by R13
┌────────────▼────────────────────────┐
│  example.com (Server Certificate)   │  ← The leaf certificate
│  (Signed by R13)                    │
└─────────────────────────────────────┘
```

### Step 4: Key Exchange (ECDHE)

Both client and server compute the shared secret using their private keys and the other party's public key:

```
Client:
  Private Key: <client_private_key>
  Server Public Key: <server_public_key> (from ServerHello)
  Shared Secret: client_private × server_public  (ECDH computation)

Server:
  Private Key: <server_private_key>
  Client Public Key: <client_public_key> (from ClientHello)
  Shared Secret: server_private × client_public  (ECDH computation)

Result: Both sides compute the SAME shared secret
```

This is called **ECDHE** (Elliptic Curve Diffie-Hellman Ephemeral). The "E" (Ephemeral) means the keys are temporary — they change every handshake. This provides **Perfect Forward Secrecy**:

> [!tip] Perfect Forward Secrecy (PFS)
> If the server's long-term private key is stolen tomorrow, an attacker cannot decrypt past conversations. Each session has its own ephemeral key. Past sessions cannot be reconstructed.

### Step 5: Finished Messages

Both sides send a "Finished" message, encrypted with the derived session keys:

```
Client:
  1. Derive session keys from:
     - Client Random + Server Random
     - Shared Secret (from ECDHE)
     - Cipher Suite (TLS_AES_256_GCM_SHA384)
  2. Compute Finished message = PRF(Finished Key, "client finished", Handshake Hash)
  3. Send encrypted Finished message

Server:
  1. Derive same session keys
  2. Compute and send encrypted Finished message

Both sides verify: if the Finished messages match, the handshake succeeded!
```

### The complete TLS 1.3 handshake in network flow

```
RTT 0:     Client ──→ Server: ClientHello [with key share]
RTT 1:     Server ──→ Client: ServerHello + Certificate + Finished
RTT 2:     Client ──→ Server: Certificate (optional) + Finished
           → Connection established! Encrypted data transfer begins!

Total: 1-RTT for a full handshake
```

With PSK (session resumption from a previous connection):
```
RTT 0:     Client ──→ Server: ClientHello [with PSK + key share]
RTT 1:     Server ──→ Client: ServerHello + Finished
RTT 2:     Client ──→ Server: Finished

With 0-RTT data (resumption):
RTT 0:     Client ──→ Server: ClientHello [with PSK + 0-RTT data]
           → Server processes the 0-RTT data immediately!
```

## Cipher Suites

A cipher suite defines the set of algorithms used for a TLS connection:

```
TLS_AES_256_GCM_SHA384
│     │       │    │
│     │       │    └──→ Hash function (SHA-384)
│     │       └───────→ AEAD mode (GCM = Galois/Counter Mode)
│     └───────────────→ Encryption algorithm (AES-256)
└─────────────────────→ TLS 1.3 suite prefix
```

### TLS 1.3 cipher suites

| Cipher Suite | Encryption | Hash | Key Exchange |
|-------------|-----------|------|-------------|
| `TLS_AES_256_GCM_SHA384` | AES-256-GCM | SHA-384 | ECDHE |
| `TLS_AES_128_GCM_SHA256` | AES-128-GCM | SHA-256 | ECDHE |
| `TLS_CHACHA20_POLY1305_SHA256` | ChaCha20-Poly1305 | SHA-256 | ECDHE |

### TLS 1.2 cipher suites (legacy)

| Cipher Suite | Encryption | Hash | Notes |
|-------------|-----------|------|-------|
| `TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384` | AES-256-GCM | SHA-384 | Recommended |
| `TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256` | AES-128-GCM | SHA-256 | Recommended |
| `TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384` | AES-256-GCM | SHA-384 | ECDSA cert |
| `TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305` | ChaCha20-Poly1305 | SHA-256 | Mobile-friendly |
| `TLS_RSA_WITH_AES_128_CBC_SHA` | AES-128-CBC | SHA-1 | **DEPRECATED** |

> [!caution] Avoid these cipher suites
> CBC mode ciphers (vulnerable to padding oracle attacks), RSA key exchange (no PFS), SHA-1 based hashes (collisions found), and RC4 (completely broken).

### How to check your server's cipher suites

```bash
# Test with ssllabs
openssl s_client -connect example.com:443 -cipher ALL

# List supported ciphers
openssl s_client -connect example.com:443 -cipher HIGH:MEDIUM:!aNULL:!MD5:!RC4

# Check for weak ciphers
nmap --script ssl-enum-ciphers -p 443 example.com
```

## SNI (Server Name Indication)

When multiple domains share the same IP address, the client sends the requested domain in the ClientHello:

```
ClientHello:
├── Server Name Indication Extension
│   └── server_name: "example.com"

Server selects and presents:
├── Certificate for example.com
├── Private key for example.com
└── All subsequent traffic encrypted with example.com's keys
```

Without SNI, a server with one IP address could only serve one domain securely.

### SNI and shared hosting

```
┌──────────────────────────────────┐
│  Shared Server IP: 1.2.3.4       │
│                                  │
│  SNI: "example.com"     → cert A │
│  SNI: "blog.com"      → cert B   │
│  SNI: "shop.org"      → cert C   │
│  SNI: "app.dev"       → cert D   │
└──────────────────────────────────┘
All on the same IP, different certificates based on SNI.
```

### Encrypted SNI (ESNI / ECH)

In TLS 1.2, SNI is sent in plaintext, so ISPs and firewalls can see which domains you visit. TLS 1.3 introduces **Encrypted Client Hello (ECH)**, which encrypts the SNI:

```
TLS 1.2 (SNI visible):
  Client ──→ [ClientHello + SNI: "example.com"] ──→ Server
                        ↑
                 ISP can see this

TLS 1.3 + ECH (SNI encrypted):
  Client ──→ [Encrypted ClientHello] ──→ Server
              (ISP only sees encrypted blob)
```

> [!note] ECH adoption
> ECH is still being adopted. Browsers and CDNs need to support it. As of 2026, Cloudflare and some browsers support ECH.

## HSTS (HTTP Strict Transport Security)

HSTS tells the browser to **always use HTTPS** for future requests to this domain:

```
Server response:
HTTP/1.1 200 OK
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### HSTS parameters

| Parameter | Purpose |
|-----------|---------|
| `max-age=SECONDS` | How long to remember the HSTS policy (seconds) |
| `includeSubDomains` | Apply to all subdomains |
| `preload` | Allow inclusion in browser preload lists |

### HSTS preload list

Major browsers ship with a built-in list of domains that must always use HTTPS:

```
# HSTS preload list (simplified excerpt)
google.com
facebook.com
github.com
amazon.com
wikipedia.org
... (over 20,000 domains)
```

### How to enable HSTS

```nginx
# Nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

```apache
# Apache
Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
```

```javascript
// Express.js
const helmet = require('helmet');
app.use(helmet.hsts({
  maxAge: 31536000,
  includeSubDomains: true,
  preload: true
}));
```

### HSTS attack prevention

HSTS prevents SSL stripping attacks:

```
Without HSTS:
  User types: http://example.com
  Attacker (MITM) intercepts → serves plain HTTP
  User unknowingly browses over HTTP

With HSTS:
  User types: http://example.com
  Browser checks HSTS cache → "This domain requires HTTPS!"
  Browser automatically converts to: https://example.com
  Attacker cannot intercept because the browser enforces HTTPS
```

## Certificate authorities and how to get certificates

### Types of certificates

| Type | Validation | Use case | Price |
|------|-----------|---------|-------|
| **DV (Domain Validated)** | Prove control of domain | Basic websites | Free–$10/year |
| **OV (Organization Validated)** | Prove organization identity | Business websites | $50–$200/year |
| **EV (Extended Validated)** | Deep organization verification | Banks, large corporations | $100–$500/year |
| **Wildcard** | Any subdomain (*.example.com) | Sites with many subdomains | Free–$50/year |

### Certificate chains in practice

```
# Verify certificate chain
openssl s_client -connect example.com:443 -showcerts

# Output:
depth=0 CN = example.com
verify return:1
depth=1 CN = R13
verify return:1
depth=2 CN = ISRG Root X1
verify return:1
```

### Self-signed certificates (development only)

```bash
# Generate a self-signed certificate (for local development only)
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365

# Usage in Node.js
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

https.createServer(options, app).listen(443);
```

> [!caution] Never use self-signed certificates in production
> Browsers will show a security warning. Self-signed certificates have no chain of trust and are vulnerable to MITM attacks.

## HTTPS performance

### TLS overhead

TLS adds overhead in two areas:
1. **CPU**: Encryption and decryption of data
2. **Latency**: Handshake round-trips

| Operation | Latency added | CPU impact |
|-----------|--------------|-----------|
| Full handshake (TLS 1.3) | 1 RTT | Moderate (ECDHE computation) |
| Session resumption | 0 RTT or 1 RTT | Low (PSK lookup) |
| 0-RTT data | 0 RTT | Low |
| Data encryption/decryption | 0 RTT | Low to moderate (hardware accelerated) |

### TLS performance optimization

| Optimization | Impact |
|-------------|--------|
| Use TLS 1.3 | 1-RTT instead of 2-RTT |
| Enable session tickets | Resumption without server state |
| Use hardware acceleration | AES-NI (CPU), QAT (Intel) |
| OCSP Stapling | Faster certificate revocation checks |
| Prefer ChaCha20 on mobile | Faster on devices without AES-NI |

## Connection with the rest of the wiki

| Concept | In-depth article |
|---------|-----------------|
| Let's Encrypt | [[08-lets-encrypt]] — Free certificates |
| Cloudflare SSL/TLS | [[04-cloudflare-intro]], [[19-cloudflare-complete]] |
| HTTP methods | [[05-http-deep-dive]] |

## Summary

- **TLS 1.3** is the current standard: 1-RTT handshake, required forward secrecy, only AEAD ciphers.
- The handshake involves: ClientHello → ServerHello → Certificate → Key Exchange → Finished.
- **ECDHE** provides Perfect Forward Secrecy: past sessions cannot be decrypted if the server key is compromised.
- **Cipher suites** define encryption algorithm, hash function, and key exchange method.
- **SNI** allows multiple HTTPS domains on one IP address.
- **HSTS** forces browsers to use HTTPS, preventing SSL stripping attacks.
- Certificate validation follows a chain of trust from leaf → intermediate → root CA.

> [!quote] The key takeaway
> HTTPS is not just "encryption". It is a complete security system providing confidentiality, integrity, and authentication. TLS 1.3 is fast, secure, and the mandatory standard for all modern web applications.
