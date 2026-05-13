---
title: "Firewalls, Proxies, Load Balancers: Stateful, Stateless, WAF, Reverse Proxy, Load Balancing Algorithms"
description: "Firewalls (stateful, stateless, WAF), proxies (forward, reverse), load balancers (L4 vs L7, algorithms), and when to use each one."
---

# Firewalls, Proxies, Load Balancers: Stateful, Stateless, WAF, Reverse Proxy, Load Balancing Algorithms

> [!tip] In a nutshell
> A **firewall** filters traffic by rules, a **proxy** acts as an intermediary, and a **load balancer** distributes traffic across multiple servers. They are complementary tools used together in modern architectures.

## Firewalls

A firewall is a system that **filters network traffic** based on defined rules. It can be hardware, software, or a combination of both.

### Types of firewalls

#### Stateless firewall (packet filtering)

Reviews each packet individually without connection context:

```
Rule: Allow all TCP traffic to port 80
Packet 1: SYN → 80 → ✓ Allowed
Packet 2: ACK → 80 → ✓ Allowed
Packet 3: SYN → 443 → ✗ Blocked

Problem: Cannot distinguish between legitimate and illegitimate packets within the same rule
```

**Pros:** Fast, simple.
**Cons:** No context for existing connections.

#### Stateful firewall (connection tracking)

Tracks the state of each connection and makes decisions based on context:

```
Connection state table:
  TCP 192.168.1.5:54321 → 93.184.216.34:80 → ESTABLISHED
  TCP 192.168.1.6:54322 → 93.184.216.34:443 → ESTABLISHED

Rule: Allow return traffic for established connections
Packet from 93.184.216.34:80 → ✓ Allowed (in ESTABLISHED state)
Packet from 93.184.216.34:80 → ✗ Blocked (no prior connection)
```

**Pros:** Much more secure — blocks traffic that doesn't match a legitimate connection.
**Cons:** More CPU usage, more complex.

#### Application-layer firewall (L7)

Inspects the content of packets at the application layer:

```
Rule: Block requests containing SQL injection patterns
GET /users?id=1' OR '1'='1 → ✗ Blocked
GET /users?id=42 → ✓ Allowed

Rule: Block requests with known attack signatures
POST /login Body: {"username": "<script>alert(1)</script>"} → ✗ Blocked
```

### iptables (Linux firewall)

`iptables` is the standard Linux firewall tool:

```bash
# View current rules
sudo iptables -L -n -v

# Allow SSH from any IP
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow HTTP and HTTPS from anywhere
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Allow return traffic for established connections
sudo iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# Drop all other incoming traffic
sudo iptables -A INPUT -j DROP

# Allow outgoing traffic
sudo iptables -A OUTPUT -j ACCEPT

# NAT for outgoing traffic
sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
```

> [!tip] Modern Linux uses nftables or firewall-d
> `iptables` is deprecated in favor of `nftables`. Most distributions provide `firewalld` or `ufw` as frontends.

```bash
# UFW (Uncomplicated Firewall) - Ubuntu
sudo ufw allow 22/tcp    # Allow SSH
sudo ufw allow 80/tcp    # Allow HTTP
sudo ufw allow 443/tcp   # Allow HTTPS
sudo ufw enable          # Enable the firewall

# Check status
sudo ufw status verbose
```

### Cloud firewall (Security Groups / NACLs)

Cloud providers offer firewall-like features:

| Feature | AWS | GCP | Azure |
|---------|-----|-----|-------|
| **Ingress rules** | Security Groups | Firewall rules | NSG |
| **Egress rules** | Security Groups | Firewall rules | NSG |
| **Stateful** | Yes | Yes | Yes |
| **Level** | Instance/ENI level | VPC level | Subnet/VNet level |
| **WAF** | AWS WAF | Cloud Armor | Application Gateway WAF |

```
AWS Security Group (stateful, at instance level):

Inbound:
  Type    Protocol  Port  Source      Action
  ──────────────────────────────────────────────
  HTTP    TCP       80    0.0.0.0/0   Allow
  HTTPS   TCP       443   0.0.0.0/0   Allow
  SSH     TCP       22    10.0.0.0/8    Allow (only from VPN)
  All     All       All   0.0.0.0/0   Deny (implicit)

Outbound:
  All traffic allowed by default (can restrict)
```

## WAF (Web Application Firewall)

A WAF filters **HTTP/HTTPS traffic** based on application-layer rules. It sits in front of web servers and blocks malicious requests.

### WAF rules types

| Rule Type | What it blocks | Example |
|-----------|---------------|---------|
| **SQL Injection** | SQL injection attacks | `' OR 1=1--` |
| **XSS** | Cross-site scripting | `<script>alert(1)</script>` |
| **Path traversal** | Directory traversal | `../../etc/passwd` |
| **Command injection** | OS command injection | `; rm -rf /` |
| **Rate limiting** | Too many requests | > 100 req/min per IP |
| **Geo blocking** | Requests from specific countries | Block all traffic from Country X |
| **Custom rules** | Custom patterns | Block `/wp-admin`, `/phpmyadmin` |
| **Bot management** | Malicious bots | Block scrapers, credential stuffing |

### WAF deployment models

| Model | Description | Example |
|-------|-------------|---------|
| **Cloud-based** | WAF hosted by a provider | Cloudflare WAF, AWS WAF |
| **Hardware** | Physical appliance | F5 BIG-IP ASM, Imperva |
| **Software** | Self-hosted software | ModSecurity, OWASP Core Rule Set |
| **SaaS** | Software-as-a-Service | ModSecurity Cloud |

### OWASP Core Rule Set (CRS)

```apache
# ModSecurity example rules
SecRule REQUEST_URI "@contains /wp-admin" "id:1001,phase:1,deny,status:403,msg:'Block WordPress admin'"
SecRule ARGS "@rx (\d+ OR 1=1)" "id:1002,phase:2,deny,status:403,msg:'SQL Injection attempt'"
SecRule ARGS "@rx (<script|javascript:)" "id:1003,phase:2,deny,status:403,msg:'XSS attempt'"
```

## Proxies

A **proxy** is an intermediary that sits between clients and servers.

### Forward proxy

Acts on behalf of clients (used within an organization or by individual users):

```
Client → Forward Proxy → Internet → Server
    (encrypts)  (filters)  (anonymous)  (sees proxy)

Use cases:
  - Corporate proxy: Filter and monitor employee traffic
  - VPN proxy: Route traffic through a different location
  - Caching proxy: Cache frequently accessed content
```

```bash
# Configure curl to use a forward proxy
export http_proxy=http://proxy.corporate.com:8080
export https_proxy=http://proxy.corporate.com:8080

curl https://example.com
# Traffic goes through proxy.corporate.com:8080
```

### Reverse proxy

Acts on behalf of servers (sits in front of web servers):

```
Internet → Reverse Proxy → Internal Server(s)
    (filters)  (routes)     (sees proxy)

Use cases:
  - SSL termination: Decrypt HTTPS traffic
  - Load balancing: Distribute traffic across multiple servers
  - Caching: Serve cached content
  - WAF: Filter malicious requests
  - Compression: Compress responses
```

```
                    Reverse Proxy (Nginx)
                    ┌─────────────────────┐
                    │                     │
  Internet ────────→│  SSL Termination    │
                    │  Load Balancing     │──→ Server 1 (app.example.com)
                    │  Caching            │──→ Server 2 (api.example.com)
                    │  Compression        │──→ Server 3 (static.example.com)
                    │  WAF                │
                    └─────────────────────┘
```

### Nginx as reverse proxy

```nginx
server {
    listen 443 ssl;
    server_name app.example.com;

    ssl_certificate /etc/letsencrypt/live/app.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}
```

## Load Balancers

A **load balancer** distributes incoming traffic across multiple servers to ensure no single server is overwhelmed.

### Layer 4 vs Layer 7 load balancing

| Feature | L4 (Transport) | L7 (Application) |
|---------|---------------|-----------------|
| **Works at** | TCP/UDP level | HTTP/HTTPS level |
| **Routing based on** | IP + Port | URL path, headers, cookies |
| **SSL termination** | Passthrough | Decrypt and re-encrypt |
| **Content inspection** | No | Yes |
| **Performance** | Faster (less processing) | Slower (more processing) |
| **Use case** | TCP services (SSH, game servers) | Web traffic, APIs |

### Load balancing algorithms

| Algorithm | Description | Best for |
|-----------|-------------|----------|
| **Round Robin** | Distribute equally in order | Equal-capacity servers |
| **Least Connections** | Send to server with fewest active connections | Varying request lengths |
| **Least Response Time** | Send to fastest server | Variable response times |
| **IP Hash** | Hash of client IP determines server | Session persistence |
| **Random** | Random server selection | Simple scenarios |
| **Weighted Round Robin** | Servers get traffic proportional to weight | Mixed-capacity servers |

```
Round Robin:
  Server 1, Server 2, Server 3, Server 1, Server 2, Server 3...

Least Connections:
  Server 1: 5 active connections
  Server 2: 15 active connections
  Server 3: 8 active connections
  → New request → Server 1 (fewest connections)

Weighted Round Robin:
  Server 1 (weight 3): ──┐
  Server 2 (weight 1): ──┼── 1,1,1,2,3,3,3,1,1,1,2...
  Server 3 (weight 2): ──┘
  → Server 1 gets 3x traffic, Server 2 gets 1x, Server 3 gets 2x
```

### Load balancer in practice (Nginx upstream)

```nginx
upstream web_servers {
    least_conn;  # Use least connections algorithm

    server 192.168.1.10:3000 weight=3;
    server 192.168.1.11:3000 weight=1;
    server 192.168.1.12:3000 backup;  # Only used if primary servers are down
}

server {
    listen 80;
    server_name app.example.com;

    location / {
        proxy_pass http://web_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Health checks

Load balancers perform health checks to detect and remove unhealthy servers:

```nginx
upstream web_servers {
    server 192.168.1.10:3000;
    server 192.168.1.11:3000;
    server 192.168.1.12:3000;

    # Health check (requires nginx plus or open source module)
    # Health checks every 5 seconds, mark as down after 3 failures
}
```

```bash
# AWS ALB health check configuration
# Path: /health
# Port: 8080
# Interval: 30 seconds
# Healthy threshold: 3
# Unhealthy threshold: 2
# Timeout: 5 seconds
```

## Comparison: Firewall vs Proxy vs Load Balancer

| Feature | Firewall | Proxy | Load Balancer |
|---------|----------|-------|---------------|
| **Primary function** | Filter traffic | Intermediary | Distribute traffic |
| **Direction** | Inbound/Outbound | Client→Server or Server→Client | Server→Server |
| **Level** | L3/L4 or L7 | L4 or L7 | L4 or L7 |
| **SSL termination** | No | Yes (reverse proxy) | Yes |
| **Caching** | No | Yes | Yes (sometimes) |
| **Load distribution** | No | No | Yes |
| **Best used with** | Everything | Web servers | Web servers, APIs |

## Connection with the rest of the wiki

| Concept | In-depth article |
|---------|-----------------|
| Cloudflare WAF | [[04-cloudflare-intro]], [[19-cloudflare-complete]] |
| Reverse proxy | [[14-servers-processes]] |
| Ports and networking | [[12-ports]], [[13-nat]] |

## Summary

- **Firewalls** filter traffic by rules: stateless (no context), stateful (connection tracking), and application-layer (content inspection).
- **WAF** specifically filters HTTP traffic to block web application attacks (SQL injection, XSS, etc.).
- **Forward proxies** act on behalf of clients; **reverse proxies** act on behalf of servers.
- **Load balancers** distribute traffic across servers to improve availability and performance.
- **L4 load balancing** routes by IP/port; **L7 load balancing** routes by HTTP headers, paths, and cookies.
- Health checks are essential to remove unhealthy servers from the pool.
- Use firewalls for security, proxies for intermediary functions, and load balancers for distribution.

> [!quote] The key takeaway
> Firewalls, proxies, and load balancers are complementary tools. A typical modern stack uses all three: a firewall for network security, a reverse proxy for SSL termination and caching, and a load balancer for distributing traffic across multiple application servers.
