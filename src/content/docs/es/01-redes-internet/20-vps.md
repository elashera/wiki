---
title: "VPS: qué es, configurar, SSH, seguridad y DNS"
description: "VPS explicado a fondo: qué es, cómo configurar uno, SSH (claves, configs avanzadas), hardening de seguridad, DNS setup, y mejores prácticas de producción."
---

# VPS: qué es, configurar, SSH, seguridad y DNS

> [!tip] VPS en una frase
> Un **VPS (Virtual Private Server)** es un servidor virtual dedicado dentro de un servidor físico. Lo controlas completamente — sistema operativo, firewall, servicios — sin compartir recursos con otros usuarios.

## ¿Qué es un VPS?

Un VPS es una **máquina virtual dedicada** creada por virtualización (KVM, VMware, Xen). Compartes el hardware físico con otros VPS, pero cada uno tiene su propio:

- Sistema operativo
- CPU (reservado o compartido)
- Memoria RAM
- Disco
- Dirección IP
- Acceso root completo

### VPS vs Hosting compartido vs Cloud

| | Shared Hosting | VPS | Cloud (AWS EC2, etc.) | Bare Metal |
|--|---------------|-----|----------------------|------------|
| **Control** | Limitado (cPanel) | Completo (root) | Completo | Completo |
| **Rendimiento** | Compartido | Reservado o compartido | Reservado | 100% dedicado |
| **Escalabilidad** | Baja (cambiar plan) | Media (upgrade plan) | Alta (escalar en minutos) | Baja (cambiar hardware) |
| **Precio** | $2-10/mes | $5-50/mes | $5-500+/mes | $50-500+/mes |
| **Configuración** | Preconfigurado | Desde cero | Desde cero | Desde cero |
| **Uso típico** | Blogs, sitios simples | APIs, apps, bases de datos | Producción escalable | High performance |

### Proveedores de VPS populares

| Proveedor | Precio desde | Características |
|-----------|-------------|----------------|
| **DigitalOcean** | $4/mes | Simple, good docs, droplets |
| **Linode (Akamai)** | $5/mos | Simple, buen soporte |
| **Vultr** | $2.50/mes | Muchos locations, high-frequency |
| **Hetzner** | €3.99/mes | Excelente precio/rendimiento (EU/US) |
| **AWS EC2** | $0.01/hr | Enterprise, todo incluido, complejo |
| **Google Cloud** | $0.011/hr | Good ML tools, GCP integration |
| **Azure** | $0.0084/hr | Enterprise, Microsoft ecosystem |
| **Contabo** | €3.99/mes | Mucha RAM/Disk por precio |

## Primeros pasos: configurar un VPS

### 1. Elegir el plan

```
Para empezar (proyectos personales):
  - CPU: 1-2 vCPUs
  - RAM: 1-2 GB
  - Disk: 25-50 GB SSD
  - OS: Ubuntu 22.04 LTS o Debian 12
  - Location: más cercano a tus usuarios

Para producción (APIs, apps):
  - CPU: 2-4 vCPUs
  - RAM: 4-8 GB
  - Disk: 80-100 GB NVMe
  - OS: Ubuntu 22.04 LTS o Debian 12
  - Location: múltiples regiones si posible
```

### 2. Conexión inicial

```bash
# Conectar por SSH (el proveedor te da IP + password)
ssh root@TU_IP_DEL_VPS

# Una vez dentro, crear usuario:
useradd -m -s /bin/bash tu_usuario
passwd tu_usuario

# Dar privilegios sudo:
usermod -aG sudo tu_usuario

# O en Debian:
usermod -aG wheel tu_usuario

# Probar con tu nuevo usuario:
ssh tu_usuario@TU_IP_DEL_VPS
```

### 3. Configuración básica del sistema

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar herramientas esenciales
sudo apt install -y curl wget git htop tmux unzip net-tools

# Configurar hostname
sudo hostnamectl set-hostname mi-servidor

# Configurar timezone
sudo timedatectl set-timezone America/Mexico_City
```

## SSH: la herramienta esencial

### SSH sin contraseña (claves SSH)

**NUNCA uses contraseña para SSH en producción.** Usa claves SSH.

```bash
# En tu computadora LOCAL (no en el VPS):
# Generar par de claves (si no tienes):
ssh-keygen -t ed25519 -C "tu@email.com"
# o con RSA (compatibilidad máxima):
ssh-keygen -t rsa -b 4096 -C "tu@email.com"

# Copiar la clave pública al VPS:
ssh-copy-id -i ~/.ssh/id_ed25519.pub tu_usuario@TU_IP_DEL_VPS

# O manualmente:
cat ~/.ssh/id_ed25519.pub
# Copia la salida y haz:
ssh root@TU_IP_DEL_VPS "mkdir -p ~/.ssh && echo 'PASTE_KEY_AQUI' >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
```

### Archivos de configuración SSH

```
# ~/.ssh/config (en tu computadora local):
Host mi-vps
    HostName TU_IP_DEL_VPS
    User tu_usuario
    IdentityFile ~/.ssh/id_ed25519
    Port 22
    ServerAliveInterval 60
    ServerAliveCountMax 3

# Ahora puedes hacer:
ssh mi-vps
```

```bash
# /etc/ssh/sshd_config (en el VPS):
# Cambiar puerto (seguridad por oscuridad, ayuda contra bots)
Port 2222

# Desactivar login con contraseña
PasswordAuthentication no

# Desactivar login root
PermitRootLogin no

# Limitar usuarios con SSH
AllowUsers tu_usuario

# Timeout de inactividad
ClientAliveInterval 300
ClientAliveCountMax 2

# Número máximo de intentos
MaxAuthTries 3

# Usar solo SSH v2
Protocol 2

# Restart sshd después de cambiar config:
sudo systemctl restart sshd
```

### SSH con llave privada protegida por passphrase

```bash
# Al generar la clave:
ssh-keygen -t ed25519 -C "tu@email.com"
# Te pedirá un passphrase (recomendado)

# Para no escribir el passphrase cada vez:
ssh-add ~/.ssh/id_ed25519
# Se guarda en memoria (agent) hasta que reinicias
```

### SSH Agent

```bash
# Agregar clave al agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# Ver claves cargadas
ssh-add -l

# SSH Agent forwarding (conectar a otro server desde tu VPS)
# En ~/.ssh/config:
Host mi-vps
    HostName TU_IP_DEL_VPS
    User tu_usuario
    ForwardAgent yes

# Desde el VPS puedes SSH a otro server sin copiar la clave:
ssh otro-servidor
```

## Hardening de seguridad del VPS

### Firewall (UFW)

```bash
# Instalar UFW (Uncomplicated Firewall)
sudo apt install -y ufw

# Configurar políticas por defecto
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Permitir SSH (¡IMPORTANTE: hazlo antes de activar!)
sudo ufw allow 2222/tcp  # O tu puerto SSH personalizado

# Permitir HTTP/HTTPS (si es un servidor web)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Activar firewall
sudo ufw enable

# Ver estado
sudo ufw status verbose

# Para añadir reglas adicionales:
sudo ufw allow from 192.168.1.0/24  # Solo tu red local
sudo ufw deny 8080/tcp               # Bloquear un puerto específico
```

### Fail2Ban

Fail2Ban bloquea IPs que hacen muchos intentos fallidos de SSH:

```bash
# Instalar
sudo apt install -y fail2ban

# Configurar para SSH
sudo nano /etc/fail2ban/jail.local

# Contenido:
[sshd]
enabled = true
port = 2222
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600       # 1 hora de ban
findtime = 600       # En 10 minutos
banaction = ufw
```

### SSH con llave + fail2ban + UFW = Seguridad básica

```
Capas de seguridad:
1. UFW: firewall básico (solo puertos necesarios abiertos)
2. SSH key-only: sin contraseña, solo llaves
3. Fail2Ban: bloquea IPs con intentos fallidos
4. Actualizaciones automáticas: security patches
5. Monitoreo de logs
```

### Actualizaciones automáticas

```bash
# Instalar unattended-upgrades
sudo apt install -y unattended-upgrades

# Configurar
sudo dpkg-reconfigure -plow unattended-upgrades

# Ver logs
cat /var/log/unattended-upgrades/unattended-upgrades.log
```

### Chroot SSH (ssh-chroot / jailing)

Para limitar qué puede hacer un usuario con SSH:

```bash
# Crear un jailing environment para usuarios SFTP
sudo useradd -m -s /bin/false sftp_user
sudo mkdir -p /home/sftp_user/uploads
sudo chown root:root /home/sftp_user
sudo chmod 755 /home/sftp_user

# Configurar SFTP-only en sshd_config:
# Match Group sftponly
#   ChrootDirectory /home/%u
#   ForceCommand internal-sftp
#   AllowTcpForwarding no
```

### Audit de seguridad

```bash
# Ver puertos abiertos
sudo ss -tlnp

# Ver procesos corriendo
ps aux --sort=-%cpu | head -20

# Ver usuarios con shell
grep -v -E "^(#|$)" /etc/passwd | awk -F: '$7 ~ /bash|sh/ {print $1}'

# Ver servicios activos
sudo systemctl list-units --type=service --state=running

# Ver archivos con SUID
find / -perm -4000 -type f 2>/dev/null

# Ver conexiones activas
sudo ss -tnp
```

### SSH hardening checklist

```
✅ Cambiar puerto SSH de 22 a algo arbitrario
✅ Desactivar login root por SSH (PermitRootLogin no)
✅ Usar solo claves SSH (PasswordAuthentication no)
✅ Limitar usuarios con SSH (AllowUsers / AllowGroups)
✅ Configurar MaxAuthTries a 3
✅ Instalar y configurar fail2ban
✅ Configurar UFW firewall
✅ Actualizaciones automáticas activadas
✅ Monitorear logs con journalctl
✅ Backup del VPS
```

## DNS para tu VPS

### Configurar DNS en Cloudflare

```
# Ejemplo: tu VPS tiene IP 192.0.2.1
Tipo  Name              Value              Proxy
───────────────────────────────────────────────────────
A     @                 192.0.2.1          Proxied (naranja)
A     www               192.0.2.1          Proxied (naranja)
AAAA  @                 2001:db8::1        Proxied (si IPv6)
TXT   @                 v=spf1 include:_spf.google.com ~all
MX    @                 mail.ejemplo.com   DNS only (10)
```

### Configurar DNS en tu proveedor (DigitalOcean, Linode, etc.)

```
# Si NO usas Cloudflare, configuras DNS directamente en tu proveedor:
A     @                 192.0.2.1          DNS only
A     www               192.0.2.1          DNS only
AAAA  @                 2001:db8::1        DNS only
CNAME   mail            mail.provider.com  DNS only
TXT     @               v=spf1 include:_spf.google.com ~all
```

### DNS de tu VPS

```bash
# Configurar resolver DNS en el VPS:
sudo nano /etc/resolv.conf
# nameserver 1.1.1.1
# nameserver 8.8.8.8

# En systemd-resolved:
sudo nano /etc/systemd/resolved.conf
# [Resolve]
# DNS=1.1.1.1 8.8.8.8
# FallbackDNS=1.0.0.1 8.8.4.4
```

## Servidores web en tu VPS

### Nginx

```bash
# Instalar Nginx
sudo apt install -y nginx

# Configurar sitio
sudo nano /etc/nginx/sites-available/mi-sitio

# Contenido:
server {
    listen 80;
    server_name ejemplo.com www.ejemplo.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ejemplo.com www.ejemplo.com;

    ssl_certificate /etc/letsencrypt/live/ejemplo.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ejemplo.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    root /var/www/mi-sitio;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# Activar y reiniciar
sudo ln -s /etc/nginx/sites-available/mi-sitio /etc/nginx/sites-enabled/
sudo nginx -t  # Verificar configuración
sudo systemctl restart nginx
```

### Caddy (auto-HTTPS)

```caddyfile
# Caddyfile — Auto-HTTPS
ejemplo.com {
    root * /var/www/mi-sitio
    file_server
    encode gzip

    handle_path /api/* {
        reverse_proxy localhost:3000
    }
}

www.ejemplo.com {
    redir https://ejemplo.com{uri}
}
```

### Docker en tu VPS

```bash
# Instalar Docker
curl -fsSL https://get.docker.com | sh

# Agregar usuario al grupo docker
sudo usermod -aG docker tu_usuario

# Instalar Docker Compose
sudo apt install -y docker-compose-plugin

# docker-compose.yml
version: '3.8'
services:
  web:
    build: ./frontend
    ports:
      - "8080:80"
  api:
    build: ./backend
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/mydb
  db:
    image: postgres:16
    environment:
      - POSTGRES_PASSWORD=secreto
    volumes:
      - pgdata:/var/lib/postgresql/data
  redis:
    image: redis:7

volumes:
  pgdata:
```

## Monitoreo del VPS

### Herramientas

```bash
# htop — monitor de procesos
sudo apt install -y htop
htop

# Prometheus + Node Exporter
# Instalar node_exporter para métricas del sistema
# Configurar Grafana para visualización

# Uptime Kuma — Monitoreo de uptime simple
docker run -d --restart=unless-stopped \
  -v uptime-kuma:/app/data \
  -p 3001:3001 \
  louislam/uptime-kuma:1

# Prometheus + Grafana para métricas completas
# Node Exporter → Prometheus → Grafana
```

### Logs

```bash
# Ver logs del sistema
journalctl -u nginx -f
journalctl -u ssh -f
journalctl -u docker -f

# Ver logs de fail2ban
journalctl -u fail2ban -f

# Buscar errores en los logs
journalctl -p err -b
```

## Resumen

- Un VPS es un servidor virtual dedicado con control root completo
- Configura SSH con claves (no contraseñas) y cambia el puerto
- Usa UFW como firewall, fail2ban contra brute-force
- Desactiva login root por SSH
- Configura DNS apuntando al VPS
- Usa certificados Let's Encrypt (Certbot) o Caddy para HTTPS
- Monitorea con htop, Prometheus, Uptime Kuma
- Mantiene el sistema actualizado con unattended-upgrades

> [!quote] La clave
> Un VPS te da control total. La seguridad empieza con SSH por claves, firewall, fail2ban, y actualizaciones automáticas. Desde ahí puedes instalar cualquier software que necesites.

## Conexión con el resto de la wiki

| Concepto tocado | Artículo en profundidad |
|-----------------|------------------------|
| Cloudflare | [[19-cloudflare-completo]] (usar Cloudflare delante del VPS) |
| Certificados | [[08-lets-encrypt]] (Let's Encrypt en tu VPS) |
| Nginx | [[14-servidores-procesos]] (servidores como Nginx) |
| Docker | [[01-que-es-internet]] (contenedores en el VPS) |
| Puertos | [[12-puertos]] (qué puertos abrir en tu VPS) |
| Firewalls | [[17-firewalls-proxies-loadbalancers]] |
