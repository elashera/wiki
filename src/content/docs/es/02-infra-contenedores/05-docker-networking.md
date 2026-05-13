---
title: "Docker networking: bridge, host, overlay, redes personalizadas, mapeo de puertos y DNS en contenedores"
description: "Redes Docker explicadas a fondo: bridge, host, overlay, redes personalizadas, port mapping, DNS interno, networking entre contenedores, y troubleshooting de red."
---

# Docker networking: bridge, host, overlay, redes personalizadas, mapeo de puertos y DNS en contenedores

> [!tip] Networking Docker en una frase
> Docker networking es **el sistema que permite a los contenedores comunicarse entre sí y con el mundo exterior**. Por defecto usa redes bridge con NAT, pero también soporta redes host, overlay para Swarm/Kubernetes, y redes personalizadas con DNS automático.

## ¿Por qué networking Docker es diferente?

Los contenedores son procesos aislados — cada uno tiene su propio namespace de red, su propio conjunto de interfaces, su propio espacio de direcciones IP. Esto hace que la networking de Docker sea un problema único de resolver.

```
Contenedor A                    Host                    Contenedor B
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  PID Namespace    │      │  PID Namespace    │      │  PID Namespace    │
│  Network Namespace │      │  Network Namespace│      │  Network Namespace│
│                  │      │                  │      │                  │
│  eth0: 172.17.0.2│      │  eth0: 10.0.0.1   │      │  eth0: 172.17.0.3│
│  IP: 172.17.0.2  │      │  IP: 10.0.0.1     │      │  IP: 172.17.0.3  │
│  Puerto 3000     │      │  Puerto 8080:3000 │      │  Puerto 5432     │
│                  │      │  iptables NAT     │      │                  │
└──────────────────┘      └──────────────────┘      └──────────────────┘
          │                        │                        │
          └────────────────────────┼────────────────────────┘
                                   │
                           docker0 bridge (172.17.0.1)
```

## Tipos de redes Docker

### 1. Red bridge (por defecto)

La red bridge es el **modo de red por defecto** de Docker. Crea una pasarela virtual para cada host Docker.

```
Red bridge por defecto (docker0):

┌──────────────────────────────────────────────────────────────────────┐
│  Host: 10.0.2.15                     docker0: 172.17.0.1/16          │
│  eth0: 10.0.2.15 ───┐                                               │
│                     │        ┌──────────────────────────────────┐    │
│                     └────────│ docker0 bridge                    │    │
│                              │ 172.17.0.1 (gateway)             │    │
│                              │                                  │    │
│                              │  ┌──────────────────┐           │    │
│                              │  │ container: web    │           │    │
│                              │  │  172.17.0.2      │           │    │
│                              │  │  eth0: eth0       │           │    │
│                              │  └──────────────────┘           │    │
│                              │                                  │    │
│                              │  ┌──────────────────┐           │    │
│                              │  │ container: db     │           │    │
│                              │  │  172.17.0.3       │           │    │
│                              │  │  eth0: eth0       │           │    │
│                              │  └──────────────────┘           │    │
│                              └──────────────────────────────────┘    │
│                                                                      │
│  iptables (NAT):                                                     │
│  PREROUTING: docker0 → contenedores                                 │
│  POSTROUTING: contenedores → host (MASCARADA)                       │
│  FORWARD: host ↔ contenedores                                        │
└──────────────────────────────────────────────────────────────────────┘
```

```bash
# Ver la red bridge por defecto
docker network ls
# NETWORK ID  NAME      DRIVER    SCOPE
# abc123      bridge    bridge    local
# def456      host      host      local
# ghi789      none      null      local

# Inspeccionar la red bridge
docker network inspect bridge
# [
#   {
#     "Name": "bridge",
#     "Driver": "bridge",
#     "IPAM": {
#       "Config": [{"Subnet": "172.17.0.0/16", "Gateway": "172.17.0.1"}]
#     }
#   }
# ]

# Los contenedores conectados a la red bridge
# Se comunican con IPs como 172.17.0.x
# NO se comunican por nombre (sin red personalizada)
```

```
Características de la red bridge por defecto:
┌─────────────────────┬──────────────────────────────────────┐
│  Característica     │  Detalle                             │
├─────────────────────┼──────────────────────────────────────┤
│  Driver             │  bridge (iptables)                   │
│  Subnet             │  172.17.0.0/16 (por defecto)         │
│  Gateway            │  172.17.0.1                          │
│  DNS interno        │  ❌ No (no resuelve nombres)         │
│  Comunicación       │  Solo por IP                         │
│  Aislamiento        │  Alto (necesita --network)           │
│  Puerto mapeo       │  -p flag                             │
└─────────────────────┴──────────────────────────────────────┘
```

### 2. Red bridge personalizada (RECOMENDADA)

Las redes bridge personalizadas **resuelven el problema de DNS interno** de la red bridge por defecto:

```bash
# Crear una red bridge personalizada con subnet específica
docker network create \
  --driver bridge \
  --subnet 172.20.0.0/16 \
  --gateway 172.20.0.1 \
  --opt com.docker.network.bridge.name=br-myapp \
  myapp-network

# Conectar servicios a la red
docker run -d --name web --network myapp-network nginx:latest
docker run -d --name db --network myapp-network postgres:16
# web y db pueden comunicarse por NOMBRE: db responde a "db", web responde a "web"
```

```
DNS en red bridge personalizada:
─────────────────────────────────

┌──────────────────────────────────────────────┐
│  myapp-network (bridge personalizado)         │
│                                              │
│  web (172.20.0.2) ──DNS──▶ 172.20.0.3 (db)   │
│    │                                      │   │
│    │ host: db                              │   │
│    │ host: 172.20.0.3                      │   │
│    │                                       │   │
│  api (172.20.0.4) ──DNS──▶ 172.20.0.3 (db)  │
│    │                                      │   │
│    │ host: db                              │   │
│    │                                       │   │
│  cache (172.20.0.5)                        │   │
│    │ host: db                              │   │
│    │ host: web                             │   │
│    │ host: api                             │   │
│    │ host: cache                           │   │
│    └───────────────────────────────────────┘   │
└──────────────────────────────────────────────┘

⚡ Los nombres de los contenedores se resuelven automáticamente
   a sus IPs en la red. No necesitas configurar DNS manualmente.
```

```yaml
# docker-compose.yml con red personalizada
services:
  web:
    image: nginx:latest
    networks:
      - myapp-net
    ports:
      - "80:80"

  api:
    image: my-api:latest
    environment:
      DATABASE_URL: postgresql://user:pass@db:5432/mydb
    networks:
      - myapp-net

  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: secret
    networks:
      - myapp-net

networks:
  myapp-net:
    driver: bridge
    ipam:
      config:
        - subnet: 172.25.0.0/16
```

### 3. Red host

La red host **comparte la red del host** directamente. No hay aislamiento de red ni NAT:

```bash
# Red host: el contenedor usa la red del host directamente
docker run -d --network host nginx:latest
# Nginx escucha en el puerto 80 del HOST directamente
# http://localhost:80 → nginx en el host (sin mapeo de puertos)

# ⚠️ Con host networking NO se usa -p (mapeo de puertos)
# docker run -d --network host -p 8080:80 nginx:latest
# Esto da ERROR porque --network host ignora -p
```

```
Comparación host vs bridge:

REDA HOST:
┌────────────────────────────────────┐
│  Host Server: 10.0.2.15            │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  Container: nginx            │  │  ← Misma red que el host
│  │  Puerto: 80 (directo)        │  │  ← Sin NAT, sin bridge
│  │  IP: 10.0.2.15 (la del host) │  │  ← Misma IP
│  └──────────────────────────────┘  │
│                                     │
│  http://10.0.2.15:80 → nginx       │
└────────────────────────────────────┘

REDA BRIDGE (por defecto):
┌────────────────────────────────────────────┐
│  Host Server: 10.0.2.15                    │
│                                             │
│  ┌───────────────────────────────────┐     │
│  │  docker0 bridge: 172.17.0.1/16    │     │
│  │                                    │     │
│  │  ┌──────────────────────────┐     │     │
│  │  │  Container: nginx        │     │     │
│  │  │  IP: 172.17.0.2          │     │     │
│  │  │  Puerto: 80              │     │     │
│  │  └──────────────────────────┘     │     │
│  └───────────────────────────────────┘     │
│                                             │
│  iptables -t nat:                           │
│  :8080 → :172.17.0.2:80                    │
│                                             │
│  http://10.0.2.15:8080 → nginx             │
└────────────────────────────────────────────┘
```

```
Cuándo usar host networking:
┌─────────────────────┬────────────────────────────────────┐
│  Caso               │  ¿Usar host?                       │
├─────────────────────┼────────────────────────────────────┤
│  API web estándar   │  ❌ bridge + -p                    │
│  Base de datos      │  ❌ bridge (o host si máximo perf) │
│  máximo rendimiento │  ✅ host (evita NAT)               │
│  múltiples cont.    │  ❌ host (colisión de puertos)     │
│  networking         │                                    │
│  Contenedor         │  ✅ host (sin NAT overhead)      │
│  de logging/        │                                    │
│  monitoreo          │                                    │
└─────────────────────┴────────────────────────────────────┘

Ventajas host:
  - Cero overhead de red (sin NAT, sin bridge)
  - Acceso directo a interfaces de red del host
  - IP real visible en logs (sin IP de bridge)

Desventajas host:
  - No hay aislamiento de red
  - Colisión de puertos (no puedes tener 2 servicios en el puerto 80)
  - No se puede usar -p con --network host
  - Riesgo de seguridad (contenedor ve toda la red del host)
```

### 4. Red none

La red **none** elimina toda la red del contenedor:

```bash
# Sin red
docker run -d --network none alpine:3.19
# El contenedor tiene NO interfaz de red en absoluto

# Para debugging: cuando necesitas ejecutar un contenedor
# sin acceso a la red (ej: procesar datos offline)

# Para añadir red manualmente después:
docker run -d --network none --name my-container alpine:3.19
# ... configurar manualmente la red después ...
```

### 5. Red overlay (Docker Swarm)

Las redes overlay conectan contenedores en **diferentes hosts de un cluster Swarm**:

```
Cluster Swarm con 3 nodos:

┌────────────────────┐     ┌────────────────────┐     ┌────────────────────┐
│  Node 1            │     │  Node 2            │     │  Node 3            │
│  10.0.1.10         │     │  10.0.1.20         │     │  10.0.1.30         │
│                    │     │                    │     │                    │
│  ┌──────────────┐  │     │  ┌──────────────┐  │     │  ┌──────────────┐  │
│  │ container    │  │     │  │ container    │  │     │  │ container    │  │
│  │ web:1        │  │     │  │ web:2        │  │     │  │ web:3        │  │
│  │ 10.0.96.2    │  │     │  │ 10.0.96.3    │  │     │  │ 10.0.96.4    │  │
│  └──────────────┘  │     │  └──────────────┘  │     │  └──────────────┘  │
│                    │     │                    │     │                    │
│  ┌──────────────┐  │     │  ┌──────────────┐  │     │  ┌──────────────┐  │
│  │ container    │  │     │  │ container    │  │     │  │ container    │  │
│  │ db:1         │  │     │  │ db:2         │  │     │  │ db:3         │  │
│  │ 10.0.97.2    │  │     │  │ 10.0.97.3    │  │     │  │ 10.0.97.4    │  │
│  └──────────────┘  │     │  └──────────────┘  │     │  └──────────────┘  │
└────────────────────┘     └────────────────────┘     └────────────────────┘
         │                          │                          │
         └──────────────────────────┼──────────────────────────┘
                                    │
                           ┌────────▼────────┐
                           │  Overlay Network │
                           │  myapp-overlay   │
                           │  (red virtual    │
                           │   sobre la       │
                           │   infraestructura)│
                           └─────────────────┘
```

```bash
# Crear un cluster Swarm
docker swarm init --advertise-addr 10.0.1.10
docker swarm join --token <token> 10.0.1.10:2377

# Crear red overlay (disponible en todos los nodos)
docker network create \
  --driver overlay \
  --attachable \
  myapp-overlay

# Ahora los contenedores en cualquier nodo
# pueden comunicarse a través de esta red overlay
```

```
Overlay vs Bridge:
┌─────────────────────┬──────────────┬──────────────┐
│  Característica     │  Bridge      │  Overlay     │
├─────────────────────┼──────────────┼──────────────┤
│  Scope              │  Un solo     │  Multi-node  │
│                     │  host        │  (Swarm)     │
│  Uso                │  docker      │  Docker      │
│                     │  compose /   │  Swarm       │
│                     │  docker run  │              │
│  Comunicación       │  IP/Nombre   │  IP/Nombre   │
│  Inter-host         │  ❌ No       │  ✅ Sí       │
│  Encapsulamiento    │  No          │  VXLAN       │
│  Complejidad        │  Baja        │  Media       │
└─────────────────────┴──────────────┴──────────────┘
```

## Mapeo de puertos

### El sistema de puertos Docker

```
El mapeo de puertos conecta el puerto del contenedor con el puerto del host:

┌────────────────────────────────────────────────────────────────┐
│  Host: 192.168.1.100                                           │
│                                                                 │
│  docker0 bridge: 172.17.0.1                                    │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  iptables NAT Rules (resumen):                            │  │
│  │                                                          │  │
│  │  PREROUTING (DNAT):                                      │  │
│  │    -j DOCKER ! -i docker0                                │  │
│  │      -p tcp --dport 8080 -> 172.17.0.2:80               │  │
│  │    -j DOCKER ! -i docker0                                │  │
│  │      -p tcp --dport 3000 -> 172.17.0.3:3000             │  │
│  │    -j DOCKER ! -i docker0                                │  │
│  │      -p tcp --dport 5432 -> 172.17.0.4:5432             │  │
│  │                                                          │  │
│  │  POSTROUTING (MASQUERADE):                               │  │
│  │    -s 172.17.0.0/16 -o eth0 -j MASQUERADE               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Acceso:                                                        │
│  http://192.168.1.100:8080 → nginx en 172.17.0.2:80           │
│  http://192.168.1.100:3000 → api en 172.17.0.3:3000           │
│  psql -h 192.168.1.100 -p 5432 → postgres en 172.17.0.4:5432  │
└────────────────────────────────────────────────────────────────┘
```

```bash
# Sintaxis: -p [host-ip:]host-port:container-port[/protocol]
docker run -d -p 8080:80 nginx:latest
#           ↑          ↑     ↑
#           │          │     └── Puerto del contenedor
#           │          └── Puerto del host (si no se especifica IP, escucha en todas)
#           └── IP del host (opcional)

# Puerto específico de host IP
docker run -d -p 127.0.0.1:8080:80 nginx:latest
# Solo accesible desde localhost, no desde la red externa

# Puerto UDP
docker run -d -p 5353:53/udp nginx:latest

# Rango de puertos del host
docker run -d -p 8000-8010:80 nginx:latest
# ⚠️ No recomendado — usa puertos individuales

# Puerto aleatorio del host (útil para pruebas)
docker run -d -p 80 nginx:latest
# Docker asigna un puerto aleatorio. Verlo con:
docker port <container-name>
# Ejemplo de salida: 80/tcp -> 0.0.0.0:49153
```

### Escenarios comunes de mapeo de puertos

```bash
# Escenario 1: API interna (solo localhost)
docker run -d -p 127.0.0.1:3000:3000 my-api:latest
# Solo accesible desde la máquina local

# Escenario 2: API pública (toda la red)
docker run -d -p 3000:3000 my-api:latest
# Accesible desde cualquier IP que pueda llegar al host

# Escenario 3: Base de datos interna
docker run -d -p 127.0.0.1:5432:5432 postgres:16
# Solo localhost (buena práctica para BDD)

# Escenario 4: Varios contenedores en mismos puertos internos
docker run -d -p 8001:80 --name web1 nginx:latest
docker run -d -p 8002:80 --name web2 nginx:latest
docker run -d -p 8003:80 --name web3 nginx:latest
# Acceder:
# http://localhost:8001  → web1
# http://localhost:8002  → web2
# http://localhost:8003  → web3
```

### Publicación en Docker Compose

```yaml
# docker-compose.yml
services:
  web:
    image: nginx:latest
    ports:
      - "80:80"                 # Todos los interfaces
      - "127.0.0.1:443:443"     # Solo localhost

  api:
    image: my-api:latest
    ports:
      - target: 3000            # Puerto del contenedor
        published: "8080"       # Puerto del host
        protocol: tcp           # Protocolo
        mode: host              # host = directo al host

  # Puertos en Swarm
  worker:
    image: my-worker:latest
    ports:
      - mode: ingress
        target: 8080
        published: "8080"
```

## DNS en contenedores

### DNS de la red bridge personalizada

En redes bridge personalizadas, Docker usa un **resolver DNS integrado** que resuelve:

1. Nombres de contenedores → IPs
2. Nombres de servicios → IPs
3. Hosts del host → IPs

```
┌──────────────────────────────────────────────────┐
│  DNS en red bridge personalizada                  │
│                                                  │
│  docker network create my-app-net                │
│                                                  │
│  docker run -d --name web --network my-app-net   │
│             nginx:latest                          │
│                                                  │
│  docker run -d --name api --network my-app-net   │
│             my-api:latest                        │
│                                                  │
│  docker run -d --name db --network my-app-net    │
│             postgres:16                          │
│                                                  │
│  DNS disponible en TODOS los contenedores:       │
│  - web → resuelve a 172.20.0.2                   │
│  - api → resuelve a 172.20.0.3                   │
│  - db  → resuelve a 172.20.0.4                   │
│                                                  │
│  También funciona desde dentro del contenedor:   │
│  curl http://api:3000                            │
│  psql -h db -U user                              │
│  wget http://web:80                              │
└──────────────────────────────────────────────────┘
```

### DNS configuration

```bash
# Configurar DNS personalizado para contenedores
docker run -d --dns 8.8.8.8 --dns 8.8.4.4 nginx:latest

# Usar DNS del host
docker run -d --dns=host nginx:latest

# Configuración global en /etc/docker/daemon.json:
{
  "dns": ["8.8.8.8", "8.8.4.4"],
  "dns-search": ["mycompany.local"],
  "dns-opt": ["ndots:2"]
}
```

### DNS interno y resolución

```
DNS resolution flow:

Contenedor quiere resolver "db"
  │
  ▼
1. /etc/resolv.conf del contenedor
   nameserver 127.0.0.11  ← DNS interno de Docker
   search docker          ← Search domain

  │
  ▼
2. DNS interno de Docker (127.0.0.11)
   │
   ├── Si "db" es nombre de contenedor → resuelve IP
   ├── Si "db" es nombre de servicio en compose → resuelve IP
   ├── Si "google.com" → proxy a DNS configurado
   └── Si no encuentra → proxy a DNS configurado
   │
   ▼
3. DNS externo configurado (8.8.8.8, etc.)
   │
   ▼
4. Resultado devuelto al contenedor
```

```bash
# Ver el DNS interno de Docker
docker run --rm alpine:3.19 cat /etc/resolv.conf
# nameserver 127.0.0.11
# options ndots:2

# Ver DNS en un contenedor con red personalizada
docker run --rm --network my-app-net alpine:3.19 cat /etc/resolv.conf
# nameserver 127.0.0.11
# options ndots:2

# Test DNS
docker run --rm --network my-app-net alpine:3.19 nslookup db
# Server:  127.0.0.11
# Address: 127.0.0.11:53
#
# Non-authoritative answer:
# db.my-app-net.default.svc.cluster.local
# Name:      db
# Address: 172.20.0.4
```

## Networking entre contenedores

### Patrón: API + Base de datos

```bash
# Crear red dedicada
docker network create app-net

# Base de datos en la red
docker run -d \
  --name postgres \
  --network app-net \
  -e POSTGRES_PASSWORD=secret \
  postgres:16

# API conectada a la misma red
# La API accede a postgres con el nombre "postgres"
docker run -d \
  --name api \
  --network app-net \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://postgres:secret@postgres:5432/mydb \
  my-api:latest
```

```
Arquitectura de red:

┌──────────────────────────────────────────────┐
│  app-net (bridge personalizado)               │
│                                              │
│  api (172.22.0.2)                              │
│    ├── Puerto: 3000 (mapeado a host:3000)     │
│    └── DB_URL: postgresql://postgres:5432     │
│         ↑                                    │
│         │ HTTP                               │
│         │ TCP                                │
│         ▼                                    │
│  postgres (172.22.0.3)                         │
│    ├── Puerto: 5432 (NO mapeado al host)      │
│    └── Solo accesible desde app-net           │
│                                              │
│  ⚠️ postgres NO es accesible desde fuera      │
│     de la red app-net (bueno para seguridad)  │
└──────────────────────────────────────────────┘
```

### Patrón: Reverse proxy con Nginx

```bash
# Red frontend (accesible desde fuera)
docker network create proxy-net

# Nginx (expone al mundo)
docker run -d \
  --name nginx \
  --network proxy-net \
  -p 80:80 \
  -p 443:443 \
  -v ./nginx.conf:/etc/nginx/nginx.conf:ro \
  nginx:latest

# API services (solo accesibles desde proxy-net)
docker network create app-net
docker network connect proxy-net api-1
docker network connect proxy-net api-2
docker network connect proxy-net api-3

# api-1, api-2, api-3 accesibles desde nginx con nombre
# nginx.conf:
# upstream api {
#   server api-1:3000;
#   server api-2:3000;
#   server api-3:3000;
# }
```

```nginx
# ./nginx.conf
upstream api_backend {
    server api-1:3000;
    server api-2:3000;
    server api-3:3000;
}

upstream websocket {
    server websocket-1:8080;
}

server {
    listen 80;
    server_name example.com;

    location /api/ {
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /ws/ {
        proxy_pass http://websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location / {
        proxy_pass http://api_backend;
    }
}
```

### Patrón: Servicio con red interna y externa

```
┌────────────────────────────────────────────┐
│  Multi-tier networking                      │
│                                             │
│  external-net                               │
│  ┌──────────┐    ┌────────────────────┐    │
│  │  Nginx   │    │                    │    │
│  │  :80,443 │    │  app-net           │    │
│  └──────────┘    │  ┌────────────┐    │    │
│      │           │  │  api-1     │    │    │
│      │           │  │  api-2     │    │    │
│      │           │  └────────────┘    │    │
│      │  HTTP │    │  ┌────────────┐    │    │
│      │  HTTPS│    │  │  db        │    │    │
│      ▼       │    │  │  :5432     │    │    │
│  ┌──────────┐│    │  └────────────┘    │    │
│  │  API     ││    │  ┌────────────┐    │    │
│  │  :3000   ││    │  │  cache     │    │    │
│  └──────────┘│    │  │  :6379     │    │    │
│      │       │    │  └────────────┘    │    │
│      │       │    │  ┌────────────┐    │    │
│      │       │    │  │  worker    │    │    │
│      ▼       │    │  │  (solo     │    │    │
│  ┌──────────┐│    │  │   interno) │    │    │
│  │  Worker  ││    │  └────────────┘    │    │
│  │  (sin    │    │                    │    │
│  │  puertos)│    └────────────────────┘    │
│  └──────────┘                             │
│                                             │
│  external-net: solo nginx (accesible fuera) │
│  app-net: todos los servicios              │
│                                             │
│  worker no tiene puertos expuestos           │
│  db y cache no tienen puertos expuestos      │
└────────────────────────────────────────────┘
```

## Troubleshooting de red

### Herramientas de diagnóstico

```bash
# 1. Ver contenedores conectados a una red
docker network inspect myapp-net

# 2. Ver la configuración de red de un contenedor
docker inspect --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' my-container

# 3. Entrar al contenedor y hacer ping
docker exec -it my-container ping -c 3 other-container
docker exec -it my-container nslookup other-container
docker exec -it my-container cat /etc/resolv.conf

# 4. Ver reglas de iptables
sudo iptables -t nat -L -n -v
sudo iptables -t nat -L DOCKER -n -v

# 5. Ver estadísticas de red del contenedor
docker stats my-container
# NET I/O muestra bytes transmitidos/recibidos

# 6. Ver conexiones activas
docker exec -it my-container netstat -tlnp
docker exec -it my-container ss -tlnp
docker exec -it my-container curl -I http://other-container:3000/health

# 7. Ver logs de red del daemon
sudo journalctl -u docker.service --since "10 min ago" | grep -i network
```

### Problemas comunes

| Problema | Causa | Solución |
|----------|-------|----------|
| `name or service not known` | DNS no resuelve | Verificar que los contenedores están en la misma red |
| `connection refused` | Servicio no está corriendo | `docker ps`, verificar health check |
| `connection timed out` | Puerto no mapeado / firewall | Verificar `-p`, verificar firewall del host |
| Puertos internos colisionan | Múltiples contenedores en mismo puerto | Usar `-p host1:cont:80 -p host2:cont:80` |
| Contenedor no puede acceder a internet | DNS no configurado | `--dns 8.8.8.8` o `--network host` |
| No se accede desde otro host | Puerto mapeado a 127.0.0.1 | Usar `0.0.0.0:puerto` o solo `puerto` |
| Red no creada antes del contenedor | Network no existe | Crear red antes o usar `--network` |
| Contenedores en redes diferentes no se comunican | Redes no compartidas | Conectar contenedor a ambas redes |

### Debug: conectar contenedor a red existente

```bash
# Un contenedor en ejecución en una red diferente
docker network connect myapp-net my-running-container

# Ahora puede comunicarse con otros contenedores en myapp-net
docker exec my-running-container ping other-container

# Desconectar
docker network disconnect myapp-net my-running-container
```

## Networking en producción

### Seguridad de red

```bash
# 1. No exponer bases de datos al host
docker run -d --name db \
  --network backend-net \
  -e POSTGRES_PASSWORD=secret \
  postgres:16
# Sin -p → solo accesible desde backend-net

# 2. Red interna para servicios sensibles
docker network create --internal backend-net
# --internal: sin acceso a internet, sin acceso al host

# 3. Proxy reverso para toda la entrada
# Solo nginx/proxy expone puertos al host
# Todos los demás servicios en red interna

# 4. Limitar acceso por IP (si es necesario)
docker run -d -p 127.0.0.1:8080:80 my-api:latest
# Solo accesible desde localhost
```

### Performance de red

```bash
# Para máxima performance, evitar NAT:
# 1. Usar --network host (si no hay colisión de puertos)
docker run -d --network host nginx:latest

# 2. Usar IPv6 directo (evita NAT)
# Configurar IPv6 en daemon.json:
{
  "ip6tables": true,
  "ipv6": true,
  "fixed-cidr-v6": "2001:db8:1::/64"
}

# 3. Usar macvlan para IP dedicada
docker network create \
  --driver macvlan \
  --subnet=192.168.1.0/24 \
  --gateway=192.168.1.1 \
  -o parent=eth0 \
  macvlan-net

docker run -d --network macvlan-net --ip 192.168.1.100 nginx:latest
# El contenedor tiene su IP propia en la red física
# Máxima performance, sin NAT
```

## Resumen

- **Red bridge por defecto**: aislamiento de red, DNS por IP (no nombre)
- **Red bridge personalizada**: DNS automático por nombre, recomendada para compose
- **Red host**: sin aislamiento, máxima performance, sin NAT
- **Red overlay**: para clusters Swarm/Kubernetes, comunicación inter-host
- **Red none**: sin red, para contenedores offline
- **Port mapping**: `-p host:container` con opciones de IP y protocolo
- **DNS**: resuelve nombres de contenedores y servicios automáticamente en redes personalizadas
- **Múltiples redes**: un contenedor puede estar en varias redes simultáneamente
- **Seguridad**: no exponer puertos de BDD, usar redes internas para servicios sensibles
- **Debug**: docker network inspect, docker exec + nslookup, iptables

> [!quote] La clave
> La regla de oro de Docker networking es: **cada contenedor vive en su propia red aislada, y se comunica a través de pasarelas controladas**. Usa redes bridge personalizadas para el 99% de los casos, y solo salte a redes host/macvlan cuando el rendimiento sea crítico y comprendas las implicaciones de seguridad.

## Conexión con el resto de la wiki

| Concepto tocado | Artículo en profundidad |
|-----------------|------------------------|
| Introducción a Docker | [[02-infra-contenedores/01-docker-intro]] |
| Imágenes Docker | [[02-infra-contenedores/02-docker-images]] |
| Contenedores | [[02-infra-contenedores/03-docker-containers]] |
| Docker Compose | [[02-infra-contenedores/04-docker-compose]] |
| Volúmenes Docker | [[02-infra-contenedores/06-docker-volumes]] |
| Modelos OSI/TCP-IP | [[01-redes-internet/015-modelo-osi-tcpip]] |
