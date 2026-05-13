---
title: "Firewalls, proxies y load balancers"
description: "Firewalls (stateful, stateless, WAF), proxies (forward, reverse), load balancers (L4 vs L7, algoritmos de balanceo), y cuándo usar cada uno."
---

# Firewalls, proxies y load balancers

> [!tip] En una frase
> Un **firewall** filtra tráfico por regla, un **proxy** actúa como intermediario, y un **load balancer** distribuye el tráfico entre múltiples servidores. Son herramientas complementarias que se usan juntas.

## Firewalls

Un firewall es un sistema que **filtra el tráfico de red** según reglas definidas. Puede ser hardware, software, o una combinación de ambos.

### Tipos de firewalls

#### Firewall stateless (sin estado)

Revisa cada packet individualmente sin contexto de la conexión:

```
Regla: Permitir todo el tráfico TCP al puerto 80
Packet 1: SYN → 80 → ✓ Permitido
Packet 2: ACK → 80 → ✓ Permitido
Packet 3: SYN → 443 → ✗ Bloqueado

Problema: No distingue entre packets legítimos y ilegítimos dentro de la misma regla
```

**Ventaja:** Rápido, simple.
**Desventaja:** No tiene contexto de las conexiones existentes.

#### Firewall stateful (con estado)

Rastrea el estado de cada conexión y toma decisiones basadas en el contexto:

```
Estado de conexiones:
  TCP 192.168.1.5:54321 → 93.184.216.34:80 → ESTABLISHED
  TCP 192.168.1.6:54322 → 93.184.216.34:443 → ESTABLISHED

Regla: Permitir tráfico de vuelta de conexiones establecidas
Packet de vuelta de 93.184.216.34:80 → ✓ Permitido (está en ESTABLISHED)
Packet nuevo de 93.184.216.34:80 → ✗ Bloqueado (no hay conexión previa)
```

**Ventaja:** Mucho más seguro — bloquea traffic que no corresponde a una conexión legítima.
**Desventaja:** Más CPU, más complejidad.

#### WAF (Web Application Firewall)

Un WAF filtra tráfico a nivel de aplicación (capa 7), no solo de red:

```
# Reglas típicas de WAF
Regla 1: Bloquear SQL injection en los parámetros
  /api/users?id=1 OR 1=1 → ✗ Bloqueado (SQL injection detectado)
  /api/users?id=42 → ✓ Permitido

Regla 2: Bloquear XSS en el body
  POST /api/comments {"body": "<script>alert('xss')</script>"} → ✗ Bloqueado

Regla 3: Rate limiting
  100 peticiones/segundo desde la misma IP → ✗ Rate limited
```

> [!tip] WAF vs Firewall tradicional
> - **Firewall tradicional**: filtra por IP, puerto, protocolo (capas 3-4)
> - **WAF**: filtra por contenido de la petición (capa 7) — SQL injection, XSS, path traversal, etc.

### iptables / nftables (Linux)

iptables es el firewall nativo de Linux:

```bash
# Ver reglas actuales
sudo iptables -L -n -v

# Bloquear todo el tráfico entrante (política default: deny)
sudo iptables -P INPUT DROP
sudo iptables -P FORWARD DROP
sudo iptables -P OUTPUT ACCEPT

# Permitir tráfico loopback
sudo iptables -A INPUT -i lo -j ACCEPT

# Permitir SSH
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Permitir HTTP y HTTPS
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Permitir tráfico de vuelta de conexiones establecidas
sudo iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# Guardar reglas (Ubuntu/Debian)
sudo netfilter-persistent save

# Guardar reglas (RHEL/CentOS)
sudo service iptables save
```

> [!tip] nftables es el reemplazo moderno de iptables
> nftables es más rápido, más limpio, y reemplaza iptables, ip6tables, arptables y ebtables. En Ubuntu 22.04+ y RHEL 9+, usa nftables por defecto.

## Proxies

Un proxy es un **intermediario** que recibe peticiones de un cliente y las reenvía a un servidor. Puede filtrar, cachear, modificar, o registrar el tráfico.

### Proxy inverso (Reverse Proxy)

Un proxy inverso se posiciona **delante de los servidores**:

```
Usuario → Cloudflare/NGINX → Servidor 1 / Servidor 2 / Servidor 3
```

**Funciones principales:**
- **TLS termination**: Maneja HTTPS, descifra y reenvía HTTP a los servers
- **Load balancing**: Distribuye tráfico entre múltiples servidores backend
- **Caché**: Sirve contenido estático directamente sin tocar los servers
- **Compresión**: Comprime respuestas antes de enviarlas al cliente
- **Rate limiting**: Limita peticiones por IP
- **Security**: Oculta la infraestructura interna

### Proxy directo (Forward Proxy)

Un proxy directo se posiciona **delante de los clientes**:

```
Usuario → Proxy → Internet
```

**Funciones principales:**
- **Caché**: Cachea contenido frecuente para reducir ancho de banda
- **Filtrado**: Bloquea sitios no deseados
- **Anonimización**: Oculta la IP del cliente al destino
- **Logging**: Registra el tráfico de los usuarios internos

## Load Balancers

Un **load balancer** distribuye el tráfico entrante entre múltiples servidores backend:

```
                ┌─────────────┐
    Cliente ───→│Load Balancer│
                └──────┬──────┘
                       │
           ┌───────────┼───────────┐
           ▼           ▼           ▼
       Server 1    Server 2    Server 3
```

### Tipos de load balancers

#### Layer 4 (Transporte)

Opera a nivel de TCP/UDP. Revisa la IP y puerto de destino, pero no el contenido:

```
LB recibe: TCP 192.168.1.100:80
           │
           ├──→ Server 1:192.168.1.10:8080
           ├──→ Server 2:192.168.1.11:8080
           └──→ Server 3:192.168.1.12:8080
```

**Ventaja:** Muy rápido (no parsea el contenido).
**Desventaja:** No puede balancear por contenido de la petición (URL, headers, etc.)

#### Layer 7 (Aplicación)

Opera a nivel de HTTP. Puede tomar decisiones basadas en el contenido de la petición:

```
LB recibe: HTTP GET /api/users
           │
           ├──→ Server 1 (API cluster)
           │
LB recibe: HTTP GET /static/logo.png
           │
           ├──→ Cache (servir directo, sin backend)
           │
LB recibe: HTTP POST /api/login
           │
           └──→ Server 2 (Auth cluster)
```

**Ventaja:** Flexible — puede balancear por URL, headers, cookies.
**Desventaja:** Más lento (necesita parsear HTTP).

### Algoritmos de balanceo

| Algoritmo | Descripción | Uso típico |
|-----------|-------------|------------|
| **Round Robin** | Distribuye en orden cíclico | Servicios sin estado iguales |
| **Least Connections** | Envía al servidor con menos conexiones | Servicios con tiempos de respuesta variables |
| **Least Response Time** | Envía al servidor más rápido | Cuando hay diferencias de performance |
| **IP Hash** | Basado en hash de la IP del cliente | Sesiones sticky |
| **Weighted** | Asigna pesos a cada servidor | Servidores con diferente capacidad |

### Health checks

Los load balancers monitorean la salud de los servidores backend:

```yaml
# Ejemplo de health check en un LB
health_check:
  path: /health
  interval: 10s
  timeout: 5s
  healthy_threshold: 3   # Cuántos checks exitosos para marcar como healthy
  unhealthy_threshold: 2 # Cuántos checks fallidos para marcar como unhealthy

# Si Server 1 falla 2 health checks consecutivos:
# 1. El LB lo marca como "unhealthy"
# 2. Deja de enviar tráfico a Server 1
# 3. Cuando recupere 3 health checks consecutivos, lo reactiva
```

## Herramientas populares

### Nginx (reverse proxy + load balancer)

```nginx
# Reverse proxy
server {
    listen 80;
    server_name ejemplo.com;

    location / {
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Load balancer
upstream backend {
    least_conn;  # Algoritmo: menos conexiones primero
    server backend1:3000 weight=3;
    server backend2:3000 weight=1;
    server backend3:3000 backup;  # Solo se usa si los otros están caídos
}
```

### HAProxy (especializado en load balancing)

```haproxy
global
    log /dev/log local0
    maxconn 4096

defaults
    log     global
    mode    http
    option  httplog
    option  dontlognull
    timeout connect 5000ms
    timeout client  50000ms
    timeout server  50000ms

frontend http_front
    bind *:80
    default_backend http_back

backend http_back
    balance leastconn
    option httpchk GET /health
    server web1 192.168.1.10:8080 check
    server web2 192.168.1.11:8080 check
    server web3 192.168.1.12:8080 check
```

### Cloudflare (WAF + CDN + DDoS)

> [[04-cloudflare-intro]] para más detalles sobre Cloudflare como WAF/CDN.

## Resumen

- **Firewall**: filtra tráfico por regla (IP, puerto, protocolo, contenido)
- **Proxy**: intermediario entre cliente y servidor (forward o reverse)
- **Load balancer**: distribuye tráfico entre múltiples servidores backend
- Stateful firewall rastrea conexiones; stateless filtra packet por packet
- WAF filtra a nivel de aplicación (SQL injection, XSS, etc.)
- Layer 4 LB usa IP+puerto; Layer 7 LB usa contenido HTTP
- Health checks aseguran que solo servidores sanos reciban tráfico

> [!quote] La clave
> En producción, se suelen usar todas estas herramientas juntas: firewall al borde, WAF para filtrar ataques web, reverse proxy (Nginx/Caddy) para TLS y caché, y load balancer para distribuir entre múltiples servidores.

## Conexión con el resto de la wiki

| Concepto tocado | Artículo en profundidad |
|-----------------|------------------------|
| Cloudflare | [[04-cloudflare-intro]] |
| Nginx/Caddy | [[14-servidores-procesos]] (como reverse proxy) |
| Docker networking | [[13-nat-red]] (puertos expuestos) |
| Routing | [[16-routing-subnetting]] (cómo los routers enroutan) |
