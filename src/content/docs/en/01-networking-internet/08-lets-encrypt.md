---
title: "Let's Encrypt and Certbot: Free SSL Certificates in Production"
description: "Let's Encrypt and Certbot: getting free SSL certificates in production, automated renewal, ACME protocol, wildcards, and best practices for secure certificate management."
---

# Let's Encrypt and Certbot: Free SSL Certificates in Production

> [!tip] Let's Encrypt in a nutshell
> Let's Encrypt is a free, automated, and open Certificate Authority. It uses the ACME protocol to issue and manage TLS certificates. Certbot is the most popular tool for interacting with Let's Encrypt. This article covers everything you need to run Let's Encrypt in production.

## What is Let's Encrypt?

Let's Encrypt is a **free, automated, open Certificate Authority (CA)** run by the Internet Security Research Group (ISRG). Its mission is to encrypt the entire Internet.

### Why Let's Encrypt changed the game

Before Let's Encrypt:
- SSL certificates cost $50–$500+ per year
- Manual installation was error-prone
- Many small websites ran without HTTPS

After Let's Encrypt:
- **Free** certificates
- **Automated** issuance and renewal
- **Programmatic** management via ACME protocol
- HTTPS adoption skyrocketed (now ~90% of all websites use HTTPS)

## The ACME Protocol

ACME (Automatic Certificate Management Environment) is the protocol that defines how clients communicate with CAs.

### ACME workflow

```
┌────────────┐     ┌─────────────┐     ┌──────────────┐
│  Certbot   │     │  Let's      │     │  Your        │
│  (Client)  │────→│  Encrypt    │────→│  Server      │
│            │     │  (CA)       │     │              │
│ 1. Register│     │             │     │              │
│ 2. Identify│     │             │     │              │
│ 3. Prove   │     │             │     │ 4. Serve     │
│    control │     │ 5. Verify   │     │    challenge │
│ 4. Receive │     │             │     │ 6. Issue     │
│    cert    │     │ 7. Sign     │     │    cert      │
└────────────┘     └─────────────┘     └──────────────┘
```

### ACME steps in detail

#### 1. Registration

The client creates an account with the CA:

```bash
# Register an account with Let's Encrypt
certbot register --agree-tos --email admin@example.com
```

This creates an account key pair. The public key is registered with Let's Encrypt.

#### 2. Identify the domain

The client tells the CA which domains it needs certificates for:

```bash
certbot certonly --webroot -w /var/www/html -d example.com -d www.example.com
```

#### 3. Prove domain control

Let's Encrypt needs to verify that the client actually controls the domain. There are two main challenge types:

| Challenge Type | How it works | Port needed | DNS? |
|---------------|-------------|-------------|------|
| **HTTP-01** | Server serves a token at `/.well-known/acme-challenge/<token>` | 80 | No |
| **TLS-ALPN-01** | Server presents cert with special extension on port 443 | 443 | No |
| **DNS-01** | Client creates a TXT record `_acme-challenge.example.com` | N/A | Yes |
| **HTTP-01 (manual)** | Client manually creates the challenge file | 80 | No |

#### 4. Receive the certificate

After verification, the CA issues the certificate:

```
Certificate:
├── Certificate (example.com)
├── Certificate (intermediate: R13)
└── Certificate (root: ISRG Root X1)

Private Key:
└── example.com key (kept on your server)
```

## Certbot: The Let's Encrypt Client

Certbot is the most popular ACME client. It automates certificate issuance and renewal.

### Installation

```bash
# Ubuntu/Debian
sudo apt install certbot

# CentOS/RHEL
sudo dnf install certbot

# Using snap (recommended for latest version)
sudo snap install certbot --classic
```

### Certificate issuance methods

#### Standalone mode (stops web server temporarily)

```bash
# Certbot starts its own HTTP server on port 80
certbot certonly --standalone -d example.com -d www.example.com
```

Use case: No existing web server, or you can stop the web server.

#### Webroot mode (uses existing web server)

```bash
# Certbot places challenge files in your web root
certbot certonly --webroot -w /var/www/html -d example.com -d www.example.com
```

Nginx configuration for webroot:

```nginx
server {
    listen 80;
    server_name example.com www.example.com;

    root /var/www/html;

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        allow all;
    }

    # Redirect all HTTP to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}
```

#### Nginx plugin (automatic configuration)

```bash
# Certbot configures Nginx automatically
sudo certbot --nginx -d example.com -d www.example.com
```

What Certbot does with the Nginx plugin:
1. Creates a temporary HTTP server block for the challenge
2. Completes the HTTP-01 challenge
3. Installs the certificate
4. Creates an HTTPS server block with HSTS
5. Sets up automatic HTTP-to-HTTPS redirect
6. Configures OCSP stapling

#### DNS-01 challenge (for wildcard certificates)

```bash
# DNS-01 is required for wildcard certificates
certbot certonly --dns-cloudflare -d example.com -d '*.example.com' \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  --email admin@example.com
```

Cloudflare credentials file (`/etc/letsencrypt/cloudflare.ini`):

```ini
dns_cloudflare_email = admin@example.com
dns_cloudflare_api_key = your_api_key_here
```

> [!caution] Protect your API key
> Restrict the API key to DNS only and never commit it to version control. Use environment variables or secrets management.

### Certificate files

After issuance, Certbot stores certificates in:

```
/etc/letsencrypt/live/example.com/
├── cert.pem        ← Certificate (server cert only)
├── chain.pem       ← Certificate chain (intermediate)
├── fullchain.pem   ← cert.pem + chain.pem (what servers need)
└── privkey.pem     ← Private key (KEEP THIS SECURE!)
```

### Nginx configuration with Let's Encrypt

```nginx
server {
    listen 443 ssl http2;
    server_name example.com www.example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # TLS configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/example.com/chain.pem;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;

    # ... your application ...
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name example.com www.example.com;
    return 301 https://$host$request_uri;
}
```

## Automatic renewal

Certificates are valid for **90 days**. Certbot automatically renews them before expiration.

### How renewal works

```bash
# Test renewal (dry run)
certbot renew --dry-run

# Actual renewal
certbot renew
```

Certbot checks all certificates every time it runs. If a certificate is less than 30 days from expiration, it renews it.

### Setting up automatic renewal

```bash
# Certbot installs a systemd timer automatically
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Check timer status
systemctl list-timers | grep certbot

# The timer runs twice daily (at 00:00 and 12:00)
```

Manual cron alternative:

```cron
# /etc/crontab
0 0,12 * * * root certbot renew --quiet --deploy-hook "systemctl reload nginx"
```

### What happens during renewal

```
1. Certbot timer fires
2. Checks all certificates in /etc/letsencrypt/live/
3. Finds certificates expiring in < 30 days
4. Runs renewal for those certificates
5. Challenges are validated (HTTP-01 or DNS-01)
6. New certificates are written to /etc/letsencrypt/live/
7. --deploy-hook runs (e.g., nginx -s reload)
8. Old certificates are cleaned up after 90 days
```

> [!tip] Webroot vs Standalone for renewal
> Renewal uses the same method as the original issuance. If you used `--standalone`, you need to stop the web server during renewal. `--webroot` is recommended for production.

## Wildcard certificates

Wildcard certificates cover all subdomains:

```
*.example.com → covers:
  www.example.com
  api.example.com
  mail.example.com
  *.example.com → covers:
    sub1.sub2.example.com  ← Wildcards only work one level deep!
```

```
# Not covered by *.example.com:
example.com          ← Must be explicitly listed
a.b.example.com      ← Wildcards are single-level only
```

```bash
# Wildcard requires DNS-01 challenge
certbot certonly --dns-cloudflare -d '*.example.com' \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini
```

## Certificate lifecycle management

### Checking certificate validity

```bash
# Check all certificates
certbot certificates

# Check a specific certificate
openssl x509 -in /etc/letsencrypt/live/example.com/cert.pem -text -noout | grep -A 2 "Validity"

# Check expiration date
openssl x509 -in /etc/letsencrypt/live/example.com/cert.pem -noout -enddate
```

### Renewing a specific certificate

```bash
# Renew a specific certificate
certbot renew --cert-name example.com

# Force renewal (not recommended, rate limits apply)
certbot certonly --force-renewal -d example.com
```

### Revoking a certificate

```bash
# Revoke a certificate
certbot revoke --cert-path /etc/letsencrypt/live/example.com/cert.pem
```

> [!note] Why revoke?
> Common reasons: private key compromised, domain sold, certificate issued for wrong domains.

## ACME alternatives

| Tool | Protocol | Features |
|------|---------|----------|
| **Certbot** | ACME v2 | Most popular, many plugins |
| **acme.sh** | ACME v2 | Shell script, no dependencies, cron support |
| **lego** | ACME v2 | Go-based, programmatic API |
| **ffi** | ACME v2 | Let's Encrypt's own Go library |
| **Custom scripts** | ACME v2 | Full control over the process |

## Let's Encrypt rate limits

| Limit | Value |
|-------|-------|
| **Certificates per registered account per week** | 400 |
| **Failing authorizations per account per week** | 5 |
| **New orders per account per hour** | 300 |
| **Failed validations per IP per hour** | 20 |
| **Certificates per domain per week** | 5 |

> [!caution] Don't hit rate limits
> Use `--dry-run` to test. Never run certbot in a loop without checking. Set up automatic renewal properly.

## Production best practices

### 1. Use OCSP Stapling

```nginx
ssl_stapling on;
ssl_stapling_verify on;
ssl_trusted_certificate /path/to/chain.pem;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;
```

OCSP Stapling means the server sends the OCSP response with the certificate, avoiding client-side OCSP checks.

### 2. Use Diffie-Hellman parameters

```bash
# Generate strong DH parameters (takes a while)
sudo openssl dhparam -out /etc/ssl/certs/dhparam.pem 4096

# Use in Nginx
ssl_dhparam /etc/ssl/certs/dhparam.pem;
```

### 3. Set up monitoring

```bash
#!/bin/bash
# /usr/local/bin/check-ssl-cert.sh
EXPIRY=$(echo | openssl s_client -connect example.com:443 -servername example.com 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s)
NOW_EPOCH=$(date +%s)
DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))

if [ $DAYS_LEFT -lt 7 ]; then
    echo "WARNING: Certificate for example.com expires in $DAYS_LEFT days"
    # Send alert (Slack, email, PagerDuty, etc.)
fi
```

### 4. Backup private keys

```bash
# Always backup private keys!
sudo cp /etc/letsencrypt/live/example.com/privkey.pem /backup/ssl/
sudo chmod 600 /backup/ssl/privkey.pem
```

### 5. Use a staging environment for testing

```bash
# Let's Encrypt has a staging environment for testing
# (Rate limits are much higher, but certs are NOT trusted by browsers)
certbot certonly --webroot -w /var/www/html -d test.example.com \
  --staging
```

## Connection with the rest of the wiki

| Concept | In-depth article |
|---------|-----------------|
| HTTPS and TLS | [[07-https-tls]] |
| Cloudflare SSL/TLS | [[04-cloudflare-intro]], [[19-cloudflare-complete]] |
| HTTP security headers | [[05-http-deep-dive]] |

## Summary

- Let's Encrypt provides **free, automated, open** SSL certificates via the ACME protocol.
- Certbot is the most popular client, with plugins for Nginx, Apache, Cloudflare, and more.
- Certificates are valid for **90 days** and should be renewed automatically.
- **HTTP-01** challenges work with a running web server; **DNS-01** is required for wildcards.
- Production setups should use OCSP stapling, strong DH parameters, and certificate monitoring.
- Protect private keys and set up backups.

> [!quote] The key takeaway
> Let's Encrypt eliminated the cost and complexity of SSL certificates. With Certbot, you can automate the entire lifecycle — issuance, renewal, and deployment — in minutes. There is no excuse for not using HTTPS in 2026.
