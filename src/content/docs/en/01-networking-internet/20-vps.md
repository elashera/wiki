---
title: "VPS: What It Is, How to Configure, SSH, Security, DNS"
description: "VPS explained in depth: what it is, how to configure one, SSH (keys, advanced configs), security hardening, DNS setup, and production best practices."
---

# VPS: What It Is, Configure, SSH, Security, DNS

> [!tip] VPS in one sentence
> A **VPS (Virtual Private Server)** is a dedicated virtual server inside a physical server. You have complete control — operating system, firewall, services — without sharing resources with other users.

## What is a VPS?

A VPS is a **dedicated virtual machine** created by virtualization (KVM, VMware, Xen). You share the physical hardware with other VPS instances, but each has its own:

- Operating system
- CPU (reserved or shared)
- Memory (RAM)
- Disk space
- IP address
- Full root access

### VPS vs Shared Hosting vs Cloud vs Bare Metal

| | Shared Hosting | VPS | Cloud (AWS EC2) | Bare Metal |
|--|---------------|-----|-----------------|------------|
| **Control** | Limited (cPanel) | Complete (root) | Complete | Complete |
| **Performance** | Shared | Reserved or shared | Reserved | 100% dedicated |
| **Scalability** | Low (change plan) | Medium (upgrade plan) | High (scale in minutes) | Low (change hardware) |
| **Price** | $2-10/month | $5-50/month | $5-500+/month | $50-500+/month |
| **Setup** | Pre-configured | From scratch | From scratch | From scratch |
| **Typical use** | Blogs, simple sites | APIs, apps, databases | Scalable production | High performance |

### Popular VPS providers

| Provider | Price from | Features |
|-----------|-----------|---------|
| **DigitalOcean** | $4/month | Simple, good docs, Droplets |
| **Linode (Akamai)** | $5/month | Simple, good support |
| **Vultr** | $2.50/month | Many locations, high-frequency |
| **Hetzner** | €3.99/month | Excellent price/performance (EU/US) |
| **AWS EC2** | $0.01/hour | Enterprise, comprehensive, complex |
| **Google Cloud** | $0.011/hour | Great ML tools, GCP integration |
| **Azure** | $0.0084/hour | Enterprise, Microsoft ecosystem |
| **Contabo** | €3.99/month | Lots of RAM/disk for the price |

## First steps: configuring a VPS

### 1. Choose a plan

```
Budget VPS (personal projects):
  1 vCPU, 1GB RAM, 25GB SSD → $4-5/month (DigitalOcean, Vultr)

Standard VPS (production apps):
  2 vCPU, 4GB RAM, 80GB SSD → $20-24/month

High-performance VPS:
  4+ vCPU, 8+ GB RAM, 160GB+ SSD → $40-100/month

```

### 2. Choose an operating system

| OS | Best for | Notes |
|----|---------|-------|
| **Ubuntu 22.04/24.04 LTS** | General purpose, most tutorials | Largest community |
| **Debian 12** | Stability, minimal footprint | Very stable, slower updates |
| **AlmaLinux/Rocky 9** | Enterprise (RHEL replacement) | Stable, enterprise-grade |
| **CentOS Stream** | Development (not production) | Rolling release |
| **Fedora Server** | Latest features | Not for long-running servers |
| **Alpine Linux** | Docker, containers | Very small footprint |

### 3. Create the VPS

```bash
# DigitalOcean
# 1. Log in to control panel
# 2. Click "Create Droplet"
# 3. Choose: Ubuntu 24.04 x64
# 4. Choose plan: $6/month (1 vCPU, 1GB RAM)
# 5. Choose datacenter: nearest to your users
# 6. Add SSH key (see below)
# 7. Click "Create Droplet"

# Wait 30 seconds → You get:
#   - IP address
#   - Root password (or use SSH key)
```

## SSH (Secure Shell)

SSH is the primary way to access and manage a VPS. It encrypts all communication.

### SSH key authentication (recommended)

Never use password authentication on a production server. SSH keys are much more secure.

#### Generate an SSH key pair

```bash
# On your local machine
ssh-keygen -t ed25519 -C "your_email@example.com"

# Output:
# Generating public/private ed25519 key pair.
# Enter file to save: /home/user/.ssh/id_ed25519
# Enter passphrase: (optional but recommended)

# This creates:
#   ~/.ssh/id_ed25519    → Private key (KEEP SECRET!)
#   ~/.ssh/id_ed25519.pub → Public key (put on servers)
```

#### Add the public key to your VPS

```bash
# Method 1: ssh-copy-id (if you set up a password first)
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@YOUR_VPS_IP

# Method 2: Manual
# Copy the contents of ~/.ssh/id_ed25519.pub
# Add it to ~/.ssh/authorized_keys on the VPS
# Create the file if it doesn't exist:
mkdir -p ~/.ssh
echo "ssh-ed25519 AAAA... your_email@example.com" >> ~/.ssh/authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

#### Connect using SSH

```bash
# Basic connection
ssh root@YOUR_VPS_IP

# With specific key
ssh -i ~/.ssh/id_ed25519 root@YOUR_VPS_IP

# With custom port (if SSH is on non-standard port)
ssh -p 2222 root@YOUR_VPS_IP

# Keep-alive (prevents disconnection)
ssh -o ServerAliveInterval=60 root@YOUR_VPS_IP
```

### SSH configuration file

Create `~/.ssh/config` for convenient connections:

```
# ~/.ssh/config

Host myvps
    HostName 203.0.113.5
    User root
    Port 22
    IdentityFile ~/.ssh/id_ed25519
    ServerAliveInterval 60
    ServerAliveCountMax 3

Host production
    HostName 198.51.100.10
    User deploy
    Port 2222
    IdentityFile ~/.ssh/prod_key
    ProxyJump jump-host    # Jump through bastion host

Host staging
    HostName 198.51.100.11
    User deploy
    Port 22
    IdentityFile ~/.ssh/staging_key
```

```bash
# Now you can just do:
ssh myvps
```

### SSH server configuration

Edit `/etc/ssh/sshd_config`:

```
# /etc/ssh/sshd_config - Security hardening

# Change default port (optional, reduces bot attacks)
Port 2222

# Disable root login (use a regular user with sudo)
PermitRootLogin no

# Disable password authentication (use keys only)
PasswordAuthentication no

# Use SSH protocol 2 only (protocol 1 is insecure)
Protocol 2

# Disable X11 forwarding (unless needed)
X11Forwarding no

# Maximum authentication attempts
MaxAuthTries 3

# Login grace time (seconds to authenticate)
LoginGraceTime 60

# Disable empty passwords
PermitEmptyPasswords no

# Allow only specific users
AllowUsers deploy admin

# Use only key-based authentication
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys

# Disable .rhosts
IgnoreRhosts yes

# Log verbosity
LogLevel VERBOSE

# TCP keepalive
TCPKeepAlive yes

# Allow agent forwarding (useful for deployment)
AllowAgentForwarding yes

# Max sessions
MaxSessions 10
```

```bash
# Apply changes
sudo systemctl reload sshd

# Verify configuration
sudo sshd -t
```

## Security hardening

### 1. Create a regular user

Never work as root. Create a regular user with sudo privileges:

```bash
# Create user
sudo adduser deploy
# Set password and fill information

# Add to sudo group
sudo usermod -aG sudo deploy

# Copy SSH key
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/id_ed25519.pub /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

### 2. Firewall (UFW)

```bash
# Install UFW
sudo apt install ufw

# Set default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (use your custom port if changed)
sudo ufw allow 2222/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow if needed (adjust ports as needed)
sudo ufw allow 3306/tcp  # MySQL (only if accessed from trusted IPs)
sudo ufw allow 5432/tcp  # PostgreSQL

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status verbose

# Output:
# Status: active
# To                         Action      From
# --                         ------      ----
# 2222/tcp                   ALLOW IN    Anywhere
# 80/tcp                     ALLOW IN    Anywhere
# 443/tcp                    ALLOW IN    Anywhere
```

### 3. Fail2Ban

Install Fail2Ban to automatically ban IPs after failed login attempts:

```bash
# Install Fail2Ban
sudo apt install fail2ban

# Create custom config
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Edit jail.local
sudo nano /etc/fail2ban/jail.local

# Contents:
[DEFAULT]
bantime = 3600          # Ban for 1 hour
findtime = 600          # Check 10 minutes
maxretry = 3            # Max 3 attempts
banaction = ufw

[sshd]
enabled = true
port = 2222
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 7200          # 2 hours for SSH
```

```bash
# Restart Fail2Ban
sudo systemctl restart fail2ban

# Check status
sudo fail2ban-client status
sudo fail2ban-client status sshd
```

### 4. Automatic security updates

```bash
# Install unattended-upgrades
sudo apt install unattended-upgrades

# Configure
sudo dpkg-reconfigure -plow unattended-upgrades

# Or manually edit:
sudo nano /etc/apt/apt.conf.d/50unattended-upgrades

# Enable:
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "02:00";
```

### 5. Disable unused services

```bash
# Check running services
systemctl list-units --type=service --state=running

# Disable unnecessary services
sudo systemctl stop telnet
sudo systemctl disable telnet

sudo systemctl stop ftp
sudo systemctl disable ftp
```

### 6. SELinux / AppArmor

```bash
# Ubuntu uses AppArmor
# Check status
sudo aa-status

# CentOS/RHEL uses SELinux
# Check status
sestatus

# Set to enforcing
sudo setenforce 1
# Make permanent: Edit /etc/selinux/config
# SELINUX=enforcing
```

## DNS setup for your VPS

### Pointing a domain to your VPS

```
In your DNS provider (Cloudflare, Namecheap, etc.):

Type  Name              Value             Proxy
────  ────────────────── ────────────────── ─────────
A     @                 203.0.113.5       Proxied (orange)
A     www               203.0.113.5       Proxied (orange)
A     api               203.0.113.5       Proxied (orange)
```

### Configure Nginx for your domain

```nginx
# /etc/nginx/sites-available/example.com
server {
    listen 80;
    server_name example.com www.example.com;

    root /var/www/example.com/html;
    index index.html index.htm;

    location / {
        try_files $uri $uri/ =404;
    }

    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/example.com /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Install Let's Encrypt certificate

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate (configures Nginx automatically)
sudo certbot --nginx -d example.com -d www.example.com

# Test auto-renewal
sudo certbot renew --dry-run

# Certbot installs a systemd timer for automatic renewal
sudo systemctl enable certbot.timer
```

## Installing common software

### Nginx (web server)

```bash
# Install
sudo apt install nginx

# Start and enable
sudo systemctl enable nginx
sudo systemctl start nginx

# Check status
sudo systemctl status nginx

# Nginx default directory
/var/www/html

# Configuration
sudo nano /etc/nginx/nginx.conf
sudo nano /etc/nginx/sites-available/default
```

### Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Add user to docker group (no sudo needed)
sudo usermod -aG docker $USER

# Start Docker
sudo systemctl enable docker
sudo systemctl start docker

# Test
docker run hello-world

# Verify installation
docker --version
docker compose --version
```

### Node.js

```bash
# Install Node.js (LTS version)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version   # v20.x.x
npm --version    # 10.x.x

# Or use nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install --lts
```

### Python

```bash
# Install Python
sudo apt install python3 python3-pip python3-venv

# Create virtual environment
python3 -m venv /opt/myapp/venv
source /opt/myapp/venv/bin/activate

# Install packages
pip install -r requirements.txt
```

### Database (PostgreSQL)

```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Start
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Create database and user
sudo -u postgres psql
> CREATE DATABASE myapp;
> CREATE USER myapp_user WITH ENCRYPTED PASSWORD 'secure_password';
> GRANT ALL PRIVILEGES ON DATABASE myapp TO myapp_user;
> \q

# Configure remote access (only if needed)
sudo nano /etc/postgresql/16/main/pg_hba.conf
# Add: host myapp myapp_user 10.0.0.0/8 md5

sudo nano /etc/postgresql/16/main/postgresql.conf
# Listen_addresses = 'localhost,10.0.0.0'
```

## Monitoring and maintenance

### System monitoring

```bash
# Check disk usage
df -h
# Check inode usage
df -i

# Check memory usage
free -h

# Check CPU load
top
# or
htop

# Check running processes
ps aux --sort=-%cpu | head -20

# Check open ports
sudo ss -tlnp

# Check disk I/O
iostat -x 1

# Check network connections
sudo ss -tunap

# Check system logs
journalctl -u nginx --no-pager -n 50
journalctl -u docker --no-pager -n 50
tail -f /var/log/syslog

# Check for failed services
systemctl --failed
```

### Automated backups

```bash
#!/bin/bash
# /usr/local/scripts/backup.sh

BACKUP_DIR="/var/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Backup database
pg_dump -U myapp_user myapp > "$BACKUP_DIR/db_${DATE}.sql"

# Backup files
tar -czf "$BACKUP_DIR/files_${DATE}.tar.gz" /var/www /etc/nginx /home

# Backup database configs
tar -czf "$BACKUP_DIR/config_${DATE}.tar.gz" /etc/postgresql /etc/redis /etc/nginx

# Compress
gzip "$BACKUP_DIR/db_${DATE}.sql"

# Remove old backups
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Transfer to remote storage (AWS S3, Backblaze B2, etc.)
aws s3 sync "$BACKUP_DIR" s3://myapp-backups/

echo "Backup completed: $DATE" >> "$BACKUP_DIR/backup.log"
```

```cron
# /etc/crontab
# Daily backup at 2 AM
0 2 * * * root /usr/local/scripts/backup.sh
```

### Monitoring with Uptime Kuma (simple)

```yaml
# docker-compose.yml for Uptime Kuma
services:
  uptime-kuma:
    image: louislam/uptime-kuma:1
    ports:
      - "3001:3001"
    volumes:
      - uptime-kuma-data:/app/data
    restart: unless-stopped

volumes:
  uptime-kuma-data:
```

### Monitoring with PM2 (Node.js)

```bash
# Install PM2
sudo npm install -g pm2

# Start your app
pm2 start server.js --name myapp

# Run on startup
pm2 startup
pm2 save

# Monitor
pm2 monit

# View logs
pm2 logs myapp

# Restart on crash
pm2 start server.js --name myapp --watch
```

## Disaster recovery

### Checklist for VPS setup

```
[ ] Change SSH port (optional)
[ ] Disable root SSH login
[ ] Disable password authentication
[ ] Create regular user with sudo
[ ] Set up SSH keys
[ ] Configure firewall (UFW)
[ ] Install and configure Fail2Ban
[ ] Enable automatic security updates
[ ] Set up monitoring (Uptime Kuma, PM2, or similar)
[ ] Configure backup script
[ ] Test SSH login as non-root user
[ ] Test firewall rules
[ ] Test fail2ban banning
[ ] Verify backups are running
[ ] Set up SSL certificate (Let's Encrypt)
[ ] Configure Nginx/Apache
[ ] Document everything in a runbook
```

### Recovery steps

```
Scenario: VPS is compromised
1. Isolate the VPS (disable network)
2. Take a snapshot (if possible)
3. Identify the breach point (check logs)
4. Rotate all credentials (SSH keys, database passwords, API keys)
5. Restore from last known good backup
6. Harden the system (apply all security measures)
7. Analyze the incident (what was accessed, what data was exposed)

Scenario: VPS disk full
1. Find large files: find / -type f -size +100M
2. Check disk usage: du -sh /* | sort -h
3. Clean logs: journalctl --vacuum-size=100M
4. Clear package cache: apt clean
5. Remove old backups: find /var/backups -mtime +30 -delete
6. Expand disk (if cloud provider allows)
```

## Connection with the rest of the wiki

| Concept | In-depth article |
|---------|-----------------|
| Cloudflare (CDN, WAF, SSL) | [[04-cloudflare-intro]], [[19-cloudflare-complete]] |
| DNS | [[03-dns-deep-dive]] |
| SSH and servers | [[14-servers-processes]] |
| Cloud providers | [[21-cloud-providers]] |
| Let's Encrypt | [[08-lets-encrypt]] |

## Summary

- A **VPS** gives you a virtual machine with full root access — complete control over OS, services, and security.
- **SSH keys** are the secure way to access a VPS; never use password authentication on production.
- **Security hardening** includes: disabling root login, firewall (UFW), Fail2Ban, automatic updates, and regular user management.
- **DNS setup** involves pointing your domain to the VPS IP and configuring Nginx/Apache.
- Install the software you need: Nginx, Docker, Node.js, Python, databases, etc.
- **Monitoring** and **backups** are essential for production servers.
- Always have a **disaster recovery** plan — things will go wrong.

> [!quote] The key takeaway
> A VPS is your foundation. Secure it properly from day one: SSH keys, firewall, regular users, monitoring, and backups. A well-configured VPS is reliable, secure, and cost-effective for running any application.
