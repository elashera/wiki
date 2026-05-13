---
title: "DNS Deep-Dive: Resolution, Cache, TTL, Record Types, DNSSEC"
description: "DNS deep-dive: how name resolution works, cache hierarchy, TTL, all record types, DNSSEC, DNS-over-HTTPS/TLS, and common DNS issues."
---

# DNS Deep-Dive: Resolution, Cache, TTL, Record Types, DNSSEC

> [!tip] DNS in a nutshell
> DNS (Domain Name System) is the phonebook of the Internet. It translates human-readable domain names (like `example.com`) into machine-readable IP addresses (like `93.184.216.34`). This article covers every aspect of DNS.

## Why DNS?

Humans are bad at remembering IP addresses. Imagine if every website you visited required you to type:

```
Go to 142.250.185.206 for Google
Go to 151.101.1.140 for Reddit
Go to 52.84.150.11 for Amazon
```

DNS saves us from this by providing a **hierarchical, distributed name resolution system**.

### How DNS fits into the OSI model

DNS operates at the **Application layer** (Layer 7 of OSI, Layer 4 of TCP/IP), but it sits above HTTP, FTP, and SMTP — meaning DNS must resolve **before** those protocols can connect.

```
┌─────────────────────────────────────────┐
│  Application Layer: HTTP, DNS, SMTP, SSH │
│  ┌─────────────────────────────────────┐│
│  │  Transport Layer: TCP, UDP           ││
│  │  ┌─────────────────────────────────┐││
│  │  │  Internet Layer: IP             │││
│  │  │  ┌─────────────────────────────┐│││
│  │  │  │  Link Layer: Ethernet, WiFi ││││
│  │  │  └─────────────────────────────┘│││
│  │  └─────────────────────────────────┘││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

## DNS architecture: A distributed database

DNS is not a single server. It is a **hierarchical, distributed database** spanning the globe:

```
                    ┌──────────────┐
                    │  Root DNS    │  (.)
                    │  13 servers  │
                    └──────┬───────┘
                           │ .com, .org, .net, etc.
                    ┌──────┴───────┐
                    │  TLD DNS     │
                    │  (.com)      │
                    └──────┬───────┘
                           │ example.com, test.com, etc.
                    ┌──────┴───────┐
                    │ Authority    │
                    │ DNS for      │
                    │ example.com  │
                    └──────┬───────┘
                           │ A, AAAA, MX, TXT records
                    ┌──────┴───────┐
                    │   IP ADDRESSES
                    └──────────────┘
```

### The hierarchy explained

| Level | Name | Examples | Managed by |
|-------|------|----------|------------|
| **Root** | `.` | (no subdomain) | 13 logical servers (A–M), operated by various orgs |
| **TLD** | Top-Level Domain | `.com`, `.org`, `.net`, `.io`, `.uk` | Registries (Verisign for `.com`, Nominet for `.uk`) |
| **Second-level** | Domain name | `example.com`, `google.com` | Domain registrars (GoDaddy, Cloudflare, Namecheap) |
| **Hostname** | Subdomain | `www.example.com`, `api.example.com` | Domain owner / DNS provider |

## DNS resolution: Step by step

When you type `www.example.com` in your browser, the DNS resolution process involves multiple caches:

### The resolution chain

```
Browser Cache → OS Cache → ISP/Resolver Cache → Root → TLD → Authoritative → IP
    (ms)         (ms)          (ms)           (ms)   (ms)     (ms)          (ms)
     │            │             │              │      │        │             │
   Hit?        Hit?         Hit?           No     No       No           Return IP
  Skip rest    Skip rest    Skip rest      query  query   query & cache
```

#### Step 1: Browser cache

Browsers cache DNS results to avoid repeated lookups. Chrome's cache can be inspected at `chrome://dns-cache`.

#### Step 2: OS-level DNS cache

Operating systems maintain their own DNS caches:

```bash
# Linux (systemd-resolved)
systemd-resolve --statistics
systemd-resolve --lookup www.example.com

# macOS
dscacheutil -q host -a name www.example.com

# Windows
ipconfig /displaydns
```

#### Step 3: Recursive resolver cache

Your ISP's recursive resolver caches results for all its users. This is often the biggest DNS cache in the chain. Public resolvers like Cloudflare (1.1.1.1) and Google (8.8.8.8) have massive caches.

#### Step 4: Root DNS query

The recursive resolver queries one of the 13 root server IP addresses:

```bash
# Query a root server for .com TLD
dig @a.root-servers.net . NS

# Output:
; <<>> DiG 1.19.6 <<>> @a.root-servers.net . NS
;; ANSWER SECTION:
.           360000  IN      NS      a.gtld-servers.net.
.           360000  IN      NS      b.gtld-servers.net.
... (34 total NS records for root, covering all TLDs)
```

#### Step 5: TLD DNS query

The resolver queries the `.com` TLD servers:

```bash
dig @a0.com.afilias-nst.info.COM. example.com NS

# Returns the authoritative nameservers for example.com:
example.com.    172800   IN   NS   ns1.example.com.
example.com.    172800   IN   NS   ns2.example.com.
```

#### Step 6: Authoritative DNS query

The resolver queries the authoritative nameserver for `example.com`:

```bash
dig @ns1.example.com example.com A

# Returns:
example.com.    300    IN    A    93.184.216.34
```

## DNS record types

DNS supports many record types. Here are the most common ones:

| Type | Description | Example |
|------|-------------|---------|
| **A** | IPv4 address | `www → 93.184.216.34` |
| **AAAA** | IPv6 address | `www → 2606:2800:220:1:248:1893:25c8:1946` |
| **CNAME** | Canonical name (alias) | `blog → example.com` |
| **MX** | Mail exchange server | `mail.example.com` with priority 10 |
| **TXT** | Text records (SPF, DKIM, verification) | `v=spf1 include:_spf.google.com ~all` |
| **NS** | Name server delegation | `ns1.example.com` |
| **SOA** | Start of Authority (zone metadata) | `ns1.example.com admin.example.com ...` |
| **SRV** | Service location | `_sip._tcp.example.com → sip.example.com:5060` |
| **PTR** | Reverse DNS (IP → hostname) | `34.216.184.93.in-addr.arpa → example.com` |
| **CAA** | Certificate Authority Authorization | `0 issue "letsencrypt.org"` |
| **CAA** | TLSA | For DANE/TLSA certificate authentication |
| **DS** | Delegation Signer (DNSSEC) | Links child zone to parent |
| **NAPTR** | NAPTR (for SIP/ENUM) | Service discovery |

### CNAME, A, and AAAA together

A domain can have multiple record types pointing to the same name:

```
; www.example.com points to example.com via CNAME
www     CNAME   example.com       300

; The root domain has an A record
@       A       93.184.216.34     300

; And an AAAA record for IPv6
@       AAAA    2606:2800:220:1:248:1893:25c8:1946  300
```

> [!tip] CNAME at the root
> A CNAME record cannot coexist with other records at the same name (RFC 1034). This means `example.com` (the root) generally cannot be a CNAME. Cloudflare's CNAME flattening and ALIAS/ANAME records work around this.

### MX records and priority

MX records have a priority value. Lower numbers = higher priority:

```
; If mail.example.com (priority 10) is down, try backup (priority 20)
@   MX  10   mail.example.com.
@   MX  20   backup-mail.example.com.
@   MX  30   tertiary-mail.example.com.
```

## TTL (Time To Live)

TTL tells caches how long to keep a DNS record before querying again:

```
; TTL of 300 seconds (5 minutes)
www     A       93.184.216.34     300

; TTL of 86400 seconds (24 hours)
@       A       93.184.216.34     86400
```

### TTL best practices

| Record type | Recommended TTL | Why |
|-------------|----------------|-----|
| **A / AAAA** | 300–3600 seconds | Fast enough for migrations, reduces DNS load |
| **CNAME** | 300–3600 seconds | Same as A records |
| **MX** | 3600–86400 seconds | Email servers change rarely |
| **TXT (SPF/DKIM)** | 3600+ seconds | Very stable records |
| **Before migration** | Lower TTL (60–300) | Reduces propagation delay |
| **After migration** | Raise TTL | Reduces DNS query volume |

### Propagation delay

When you change a DNS record, it does not update everywhere instantly. The delay is determined by the **lowest TTL** among all caches:

```
Before migration: TTL = 86400 (24 hours)
Change: A record from 1.2.3.4 to 5.6.7.8

New clients: get updated immediately (from authoritative)
Old cached: still serve 1.2.3.4 for up to 24 hours

Solution: Lower TTL to 300 seconds a few days before the migration
Then change the record → most caches update within 5 minutes
Then after migration: Raise TTL back to 3600+
```

## DNSSEC (DNS Security Extensions)

DNS was designed without security in mind. **DNSSEC** adds cryptographic signatures to DNS records, preventing cache poisoning and man-in-the-middle attacks.

### How DNSSEC works

```
Zone: example.com
Records:
  www A 93.184.216.34
  www RRSIG A <signature>

Resolver:
  1. Gets the A record
  2. Gets the RRSIG (signature) for the A record
  3. Verifies the signature using the DNSKEY
  3. DNSKEY is verified by the DS record in the parent zone
  4. Parent's DS is verified by... root DNSSEC key (trust anchor)

Result: If the signature is valid, the record is authentic.
        If not, the resolver returns SERVFAIL.
```

### DNSSEC key hierarchy

```
┌──────────────────┐
│  Root Zone Key   │  (Trust Anchor)
│  KSK + ZSK       │
└────────┬─────────┘
         │ DS record (Delegation Signer)
┌────────┴─────────┐
│  TLD Zone (.com) │
│  KSK + ZSK       │
└────────┬─────────┘
         │ DS record
┌────────┴─────────┐
│  example.com     │
│  KSK + ZSK       │
│  Signs: A, AAAA,  │
│  CNAME, MX, TXT   │
└──────────────────┘
```

**KSK (Key Signing Key):** Signs the DNSKEY record. Long-lived, very secure.
**ZSK (Zone Signing Key):** Signs all other records in the zone. Rotated frequently.

### What DNSSEC protects against

| Attack | Protected? |
|--------|-----------|
| Cache poisoning (fake DNS responses) | ✅ Yes |
| Man-in-the-middle DNS spoofing | ✅ Yes |
| DDoS against DNS servers | ❌ No |
| Privacy (who is querying) | ❌ No (DNSSEC does not encrypt queries) |

> [!note] DNSSEC vs DNS over HTTPS
> DNSSEC authenticates data but does not encrypt queries. DNS-over-HTTPS (DoH) and DNS-over-TLS (DoT) encrypt queries but do not authenticate responses. They are complementary, not competing technologies.

### DNSSEC chain of trust

```
Root DNS key (trust anchor, hardcoded in resolver software)
    │
    ▼ DS record ──→ Verisign KSK for .com
    │
    ▼ DS record ──→ example.com KSK
    │
    ▼ RRSIG ─────→ All example.com records are signed
```

## DNS query protocols: UDP vs TCP

| Protocol | Port | Use case |
|----------|------|----------|
| **UDP** | 53 | Standard DNS queries (most common, < 512 bytes) |
| **TCP** | 53 | DNS responses > 512 bytes, zone transfers |
| **DoT (DNS over TLS)** | 853 | Encrypted DNS over TCP |
| **DoH (DNS over HTTPS)** | 443 | Encrypted DNS over HTTP/HTTPS |

> [!tip] When DNS uses TCP
> TCP is used when:
> 1. The response exceeds 512 bytes (EDNS0 can increase this, but some resolvers still fall back to TCP)
> 2. The client explicitly requests TCP (QR bit set in the header)
> 3. A zone transfer is requested (AXFR/IXFR)

## Zone transfers

A **zone transfer** copies a DNS zone from a primary nameserver to a secondary nameserver for redundancy:

```
Primary NS (ns1.example.com)    Secondary NS (ns2.example.com)
        │                               │
        │── AXFR (full zone transfer)──→│
        │   or                          │
        │── IXFR (incremental transfer)→│
```

- **AXFR**: Transfers the entire zone (expensive, rarely used)
- **IXFR**: Transfers only the changes since the last transfer (efficient)

> [!caution] Never expose zone transfers to the public
> Zone transfers reveal all your DNS records. Configure them with `allow-transfer` ACLs restricting to secondary nameserver IPs only.

```
// BIND configuration example
acl "secondaries" {
    192.0.2.2;      // ns2.example.com
};

zone "example.com" {
    type master;
    allow-transfer { "secondaries"; };
    // ...
};
```

## Practical DNS tools

### dig (Domain Information Groper)

The most powerful DNS tool:

```bash
# Basic query
dig example.com A

# With specific nameserver
dig @1.1.1.1 example.com A

# Full trace from root
dig example.com +trace

# Query all record types
dig example.com ANY

# Check TXT records (for SPF, DKIM)
dig example.com TXT

# Query for a specific record type
dig example.com MX

# Check for DNSSEC
dig example.com +dnssec
```

### nslookup

A simpler, interactive DNS tool:

```bash
nslookup
> set type=MX
> example.com
> set type=CNAME
> www.example.com
```

### host

A simple command-line tool:

```bash
# Resolve a domain
host example.com
# example.com has address 93.184.216.34

# Reverse lookup
host 93.184.216.34
# 34.216.184.93.in-addr.arpa domain name pointer example.com.

# MX records
host -t MX example.com
# example.com mail is handled by 10 mail.example.com.
```

### dig vs nslookup vs host

| Tool | Best for | Protocol |
|------|----------|----------|
| **dig** | Detailed DNS analysis, debugging | UDP/TCP |
| **nslookup** | Quick queries, interactive mode | UDP/TCP |
| **host** | Simple resolution tasks | UDP |

## Common DNS issues and troubleshooting

### DNS not resolving

```bash
# 1. Check if your resolver is working
dig google.com @8.8.8.8

# 2. Check your /etc/resolv.conf
cat /etc/resolv.conf

# 3. Check DNS cache (systemd-resolved)
systemd-resolve --statistics

# 4. Flush the cache
sudo systemd-resolve --flush-caches   # systemd-resolved
sudo kill -HUP $(cat /var/run/nscd.pid)  # nscd
```

### DNS propagation issues

```bash
# Check what different resolvers see
dig example.com @8.8.8.8    # Google DNS
dig example.com @1.1.1.1    # Cloudflare DNS
dig example.com @208.67.222.222  # OpenDNS
dig example.com @ns1.example.com  # Your authoritative

# If they differ → some caches still have the old record
# Solution: Wait for TTL to expire, or lower TTL next time
```

### DNS spoofing detection

```bash
# Check if DNSSEC validation is working
dig +dnssec example.com A
# Look for "flags: ad" in the answer (authenticated data)

# Check for inconsistency across resolvers
for resolver in 8.8.8.8 1.1.1.208.67.222.222; do
    echo "=== $resolver ==="
    dig +short example.com @$resolver
done
```

## Connection with the rest of the wiki

| Concept | In-depth article |
|---------|-----------------|
| URL to page journey | [[02-url-to-page-journey]] |
| HTTPS and TLS | [[07-https-tls]] |
| Cloudflare DNS | [[04-cloudflare-intro]], [[19-cloudflare-complete]] |
| HTTP | [[05-http-deep-dive]] |

## Summary

- DNS is a **hierarchical, distributed database** spanning root, TLD, and authoritative levels.
- Resolution passes through multiple caches: browser → OS → resolver → root → TLD → authoritative.
- **TTL** controls how long records are cached; lower TTL means faster updates but more queries.
- **DNSSEC** adds cryptographic signatures to prevent cache poisoning, but does not encrypt queries.
- Common record types: **A** (IPv4), **AAAA** (IPv6), **CNAME** (alias), **MX** (email), **TXT** (verification), **NS** (delegation).
- UDP is the default for DNS; TCP is used for large responses and zone transfers.
- Tools like **dig**, **nslookup**, and **host** are essential for DNS troubleshooting.

> [!quote] The key takeaway
> DNS is one of the oldest and most critical Internet protocols. It is decentralized by design — no single entity controls it. Understanding DNS gives you visibility into how the Internet actually routes your requests.
