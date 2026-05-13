---
title: "Docker containers: ejecutar, gestionar y administrar contenedores en producción"
description: "Guía completa de contenedores Docker: ciclo de vida, ejecución, stop/sigkill, gestión de recursos (CPU, memoria, I/O), health checks, logs, exec, y patrones de gestión en producción."
---

# Docker containers: ejecutar, gestionar y administrar contenedores en producción

> [!tip] Contenedores Docker en una frase
> Un contenedor Docker es **una instancia en ejecución de una imagen**, aislada por namespaces y controlada por cgroups. Dominar la gestión de contenedores (crear, ejecutar, monitorizar, escalar, depurar) es esencial para cualquier pipeline de producción.

## El ciclo de vida de un contenedor

Entender el ciclo de vida completo es la base para gestionar contenedores eficientemente:

```
┌───────────┐     ┌───────────┐     ┌───────────┐     ┌───────────┐
│ Created   │────▶│ Running   │────▶│ Stopped   │────▶│ Removed   │
│           │     │           │     │           │     │           │
│ docker    │     │ docker    │     │ docker    │     │ docker    │
│ create    │     │ start     │     │ stop      │     │ rm        │
└───────────┘     └───────────┘     └───────────┘     └───────────┘
     │                │                │
     │ docker start   │ docker kill    │ docker rm
     │                │                │
  ┌──┴──┐          ┌──┴──┐         ┌──┴──┐
  │ 1   │          │ 0   │         │ N/A │
  └─────┘          └─────┘         └─────┘

Estados adicionales:
  Paused     → docker pause (suspender)
  Restarting → docker stop + auto-restart configurado
  Dead       → Contenedor eliminado forzosamente por el daemon
```

### Crear vs Ejecutar

```bash
# docker create: crea el contenedor pero NO lo ejecuta
# Útil para: preparar contenedores para ejecutar después, debugging
docker create --name mi-app -p 8080:3000 mi-app:1.2.3

# docker run: crea + inicia en un solo comando
docker run -d --name mi-app -p 8080:3000 mi-app:1.2.3

# docker start: inicia un contenedor creado con docker create
docker start mi-app

# Verificar
docker ps          # Solo ejecutándose
docker ps -a       # Todos los estados
```

```
¿Cuándo usar docker create vs docker run?

docker run: el 99% de los casos. Simple, directo, todo en uno.
docker create + start: cuando necesitas configurar algo entre crear y ejecutar,
  o cuando un orquestador (K8s, Swarm) gestiona el ciclo de vida.
```

## Ejecutando contenedores: comandos esenciales

### Modo detached vs interactivo

```bash
# Detached (segundo plano, sin terminal) — modo producción
docker run -d --name web-server nginx:latest

# Interactivo (terminal, para debugging)
docker run -it --name my-shell alpine:3.19 sh

# Modo interactivo sin detach (tu terminal queda "pegada" al contenedor)
docker run -it --name my-shell alpine:3.19 sh
# (Ctrl+P Ctrl+Q para detach sin matar el contenedor)

# TTY + stdin para interactuar como en una terminal real
docker run -it --name my-shell alpine:3.19 sh
# Se siente como ssh al servidor
```

### Gestión de puertos

```bash
# Mapeo de puerto único
docker run -d -p 8080:80 nginx:latest
# localhost:8080 → contenedor:80

# Mapear el mismo puerto interno a puertos externos diferentes
docker run -d -p 8001:80 --name web1 nginx:latest
docker run -d -p 8002:80 --name web2 nginx:latest
docker run -d -p 8003:80 --name web3 nginx:latest

# Mapear múltiples puertos
docker run -d \
  -p 8080:80 \
  -p 8443:443 \
  -p 9090:9090 \
  nginx:latest

# Solo para IPv4 o IPv6
docker run -d -p 127.0.0.1:8080:80 nginx:latest    # Solo localhost IPv4
docker run -d -p ::1:8080:80 nginx:latest          # Solo localhost IPv6

# ⚠️ IMPORTANTE: vincular a 127.0.0.1 para servicios sensibles
docker run -d -p 127.0.0.1:5432:5432 postgres:16
# Esto evita que la base de datos sea accesible desde la red externa
```

### Variables de entorno y configuración

```bash
# Pasando variables con -e
docker run -d \
  --name api-server \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e DATABASE_URL=postgresql://user:pass@db:5432/mydb \
  -e REDIS_URL=redis://cache:6379 \
  -e LOG_LEVEL=info \
  api-server:latest

# Desde un archivo de variables
# .env file:
# DATABASE_URL=postgresql://...
# API_KEY=secret123
# LOG_LEVEL=debug

docker run -d --env-file .env api-server:latest

# Verificar variables en un contenedor
docker exec api-server env
docker exec api-server printenv DATABASE_URL
```

```bash
# Configurar hostname del contenedor
docker run -d --hostname web-server-01 nginx:latest
# El contenedor responde a "web-server-01" en vez de su ID largo

# Configurar DNS personalizado
docker run -d --dns 8.8.8.8 --dns 8.8.4.4 nginx:latest

# Configurar el host.docker.internal (útil en Mac/Windows)
docker run -d --add-host=host.docker.internal:host-gateway nginx:latest
```

## Gestión de recursos: límites y restricciones

Los cgroups permiten limitar los recursos que un contenedor consume:

### Límites de CPU

```bash
# Usar un fraction de CPU (0.5 = medio core, 2.0 = dos cores)
docker run -d --cpus=0.5 nginx:limited
docker run -d --cpus=2.0 nginx:heavy

# Porcentaje de CPU con --cpu-percent (Windows)
# En Linux, --cpus es el equivalente
docker run -d --cpu-shares=512 nginx:light    # 50% de CPU por defecto
docker run -d --cpu-shares=1024 nginx:heavy   # 100% de CPU

# Restringir a CPU específicas
docker run -d --cpuset-cpus="0,1" nginx:app   # Solo cores 0 y 1
docker run -d --cpuset-cpus="0-3" nginx:app   # Cores 0, 1, 2, 3
```

```
CPU Shares vs CPU Quota:
┌─────────────────┬───────────────────────┬──────────────────────┐
│                   │  CPU Shares           │  CPU Quota (cpus)    │
├─────────────────┼───────────────────────┼──────────────────────┤
│  Tipo           │  Relativo             │  Absoluto            │
│  Comportamiento │  Si no hay contención,│  Límite rígido       │
│                 │  puede usar 100%      │  (no excede el límite)│
│  Ejemplo        │  --cpu-shares=512     │  --cpus=0.5          │
│  Equivalente    │  50% vs default 1024  │  50% de un core      │
│  Uso recomendado│  Prioridades relativas│  Límites estrictos   │
└─────────────────┴───────────────────────┴──────────────────────┘
```

### Límites de memoria

```bash
# Memoria total (hard limit)
docker run -d --memory=512m --memory-swap=512m nginx:limited
# --memory: límite de RAM (512 MB)
# --memory-swap: límite total (RAM + swap). Si es igual a --memory, no hay swap.

# Swap (memoria de intercambio)
docker run -d --memory=512m --memory-swap=1g nginx:limited
# 512 MB RAM + 512 MB swap = 1 GB total

# Memoria mínima (reservada)
docker run -d --memory=512m --memory-reservation=256m nginx:limited
# Siempre puede usar al menos 256 MB, máximo 512 MB

# Límite de intercambio
docker run -d --memory=1g --memory-swappiness=0 nginx:limited
# 0 = no usar swap (preference)
# 100 = usar swap como cualquier proceso normal

# Límite de shared memory (/dev/shm)
docker run -d --shm-size=256m nginx:limited
# Útil para bases de datos (MySQL, PostgreSQL usan /dev/shm)
```

```
¿Qué pasa cuando un contenedor excede su límite?
──────────────────────────────────────────────

--memory=256m (hard limit):
  Uso de memoria → 256 MB
  ┌─────────────────────────┐
  │  Contenedor             │
  │                         │
  │  Kernel OOM Killer      │ ← El kernel mata el proceso del contenedor
  │  (Out of Memory)        │
  └─────────────────────────┘

--memory=256m --memory-swappiness=0:
  Uso de memoria → 256 MB
  ┌─────────────────────────┐
  │  Contenedor             │
  │                         │
  │  OOM-Killed             │ ← Se mata el proceso
  │                         │
  │  Estado: Exited (137)   │ ← Código 137 = SIGKILL
  └─────────────────────────┘
```

```bash
# Ver código de salida 137
docker ps -a
# CONTAINER  STATUS
# abc123     Exited (137) 2 minutes ago  ← OOM Killed
# def456     Exited (1) 5 minutes ago   ← Error de aplicación
```

### Límites de I/O de disco

```bash
# Limitar tasa de escritura (bandwidth)
docker run -d --device-write-bps /dev/sda:1mb nginx:limited

# Limitar tasa de lectura
docker run -d --device-read-bps /dev/sda:5mb nginx:limited

# Limitar operaciones de I/O (IOPS)
docker run -d --device-write-iops /dev/sda:100 nginx:limited

# Pesos de I/O (relativos, no hard limits)
docker run -d --blkio-weight=100 nginx:light
docker run -d --blkio-weight=500 nginx:heavy
# Default weight es 500
```

### Ver límites de recursos

```bash
# Ver uso de recursos en tiempo real
docker stats
# CONTAINER  CPU %  MEM USAGE/LIMIT  MEM %  NET I/O  BLOCK I/O
# web        0.50%  15MiB/512MiB     2.9%   1.2kB/0B 0B/0B
# api        2.30%  85MiB/1GiB      8.4%   45kB/12kB 128kB/0B
# db         1.10%  256MiB/512MiB    50.0%  2.1MB/5MB 512kB/128MB

# Ver recursos de un contenedor específico
docker stats web --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# Ver recursos configurados
docker inspect --format='{{.HostConfig.CpuQuota}}' web
docker inspect --format='{{.HostConfig.Memory}}' web
```

## Health Checks: monitorización de contenedores

Los health checks permiten a Docker saber si tu aplicación dentro del contenedor está funcionando:

```bash
# health check inline
docker run -d \
  --name mi-app \
  --health-cmd="curl -f http://localhost:3000/health || exit 1" \
  --health-interval=30s \
  --health-timeout=10s \
  --health-retries=3 \
  --health-start-period=40s \
  mi-app:latest
```

```
Parámetros del health check:
┌────────────────────────┬──────────────────────────────────────────┐
│  Parámetro              │  Descripción                             │
├────────────────────────┼──────────────────────────────────────────┤
│  --health-cmd          │  Comando a ejecutar dentro del           │
│                        │  contenedor. 0 = healthy, !=0 =          │
│                        │  unhealthy.                              │
│  --health-interval     │  Tiempo entre checks (default: 30s)      │
│  --health-timeout      │  Máximo tiempo por comando (default: 30s)│
│  --health-retries      │  Intentos antes de "unhealthy"           │
│                        │  (default: 3)                            │
│  --health-start-period │  Tiempo de gracia para arrancar          │
│                        │  (default: 0s). No cuenta para retries.  │
└────────────────────────┴──────────────────────────────────────────┘
```

```
Estados de health check:
─────────────────────

  starting    → El contenedor se está iniciando. No se cuenta para retries.
  healthy     → El health check pasó.
  unhealthy   → El health check falló N veces (retries).

Ejemplo con start-period:
  T=0s   → Contenedor arranca (starting)
  T=5s   → health check #1 falla (count=1) — contando
  T=35s  → health check #2 pasa (count=0) — reset
  T=65s  → health check #3 pasa (count=0) — healthy!
```

### Health checks comunes

```bash
# HTTP endpoint
--health-cmd="curl -f http://localhost:3000/health || exit 1"

# TCP check (sin curl)
--health-cmd="nc -z localhost 3000 || exit 1"

# Script de verificación
--health-cmd="/app/healthcheck.sh"

# Comando con timeout
--health-cmd="timeout 5 bash -c 'cat > /dev/tcp/localhost/3000' || exit 1"

# PostgreSQL check
--health-cmd="pg_isready -U postgres || exit 1"

# MySQL check
--health-cmd="mysqladmin ping -h localhost || exit 1"
```

### Auto-restart con health checks

```bash
# Restart policy: cuándo reiniciar un contenedor
docker run -d --restart=always nginx:latest          # Siempre reiniciar
docker run -d --restart=on-failure nginx:latest       # Solo en fallo
docker run -d --restart=on-failure:5 nginx:latest     # Máximo 5 reinicios
docker run -d --restart=unless-stopped nginx:latest   # Excepto si se detuvo manualmente

# Combinar health check con restart
docker run -d \
  --name mi-app \
  --restart=on-failure:3 \
  --health-cmd="curl -f http://localhost:3000/health || exit 1" \
  --health-interval=30s \
  --health-timeout=10s \
  --health-retries=3 \
  mi-app:latest

# Si el health check falla 3 veces, Docker reinicia el contenedor (hasta 5 veces)
```

## Gestión de logs

```bash
# Ver logs de un contenedor
docker logs web-server

# Logs en tiempo real (follow)
docker logs -f web-server

# Logs con timestamp
docker logs -f --timestamps web-server

# Últimas N líneas
docker logs --tail=100 web-server

# Logs entre timestamps
docker logs --since 2024-01-15T10:00:00 web-server
docker logs --until 2024-01-15T11:00:00 web-server

# Combinar filtros
docker logs -f --tail=50 --timestamps web-server
```

### Drivers de logging

```bash
# Driver por defecto: json-file (logs en /var/lib/docker/containers/)
# Problema: los logs pueden llenar el disco

# Configurar driver de logging por contenedor
docker run -d \
  --log-driver=json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  --name web-server \
  nginx:latest

# O usar syslog para centralizar logs
docker run -d \
  --log-driver=syslog \
  --log-opt syslog-address=tcp://log-server:5514 \
  --log-opt tag="nginx" \
  nginx:latest

# O usar journald para integrar con systemd
docker run -d \
  --log-driver=journald \
  --name web-server \
  nginx:latest
```

```
Driver de logging JSON-FILE con rotación:
┌──────────────────────────────────────────────────┐
│  /var/lib/docker/containers/abc123/              │
│    abc123-json.log        ← 10 MB (actual)       │
│    abc123-json.log.1      ← 10 MB (anterior)     │
│    abc123-json.log.2      ← 10 MB (anterior)     │
│    abc123-json.log.3      ← 10 MB (anterior)     │
│                                                  │
│  max-size=10m       → 10 MB por archivo          │
│  max-file=3         → Máximo 3 archivos          │
│  total = 30 MB máximo                            │
└──────────────────────────────────────────────────┘

# Configurar a nivel global en /etc/docker/daemon.json:
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

## Ejecutar comandos dentro de contenedores

```bash
# Entrar a un contenedor en ejecución (sh/bash)
docker exec -it web-server sh
docker exec -it web-server bash    # Si el contenedor tiene bash

# Ejecutar un comando sin entrar a la terminal
docker exec web-server cat /etc/nginx/nginx.conf
docker exec web-server ls -la /var/log/nginx/
docker exec web-server nginx -t

# Ejecutar como un usuario específico
docker exec -u root web-server whoami
docker exec -u www-data web-server whoami

# Ejecutar en segundo plano (sin -it)
docker exec web-server touch /tmp/test-file

# Verificar si un contenedor está sano
docker exec web-server curl -f http://localhost:80 || echo "DOWN"
```

```bash
# Copiar archivos dentro de un contenedor
docker cp config/nginx.conf web-server:/etc/nginx/conf.d/
docker cp web-server:/var/log/nginx/access.log ./access.log

# Copiar un archivo FUERA de un contenedor
docker exec web-server tail -f /var/log/nginx/access.log > /tmp/access.log
```

## Inspeccionar y depurar contenedores

```bash
# Información detallada de un contenedor
docker inspect web-server

# Extraer campos específicos con format
docker inspect --format='{{.State.Running}}' web-server
docker inspect --format='{{.NetworkSettings.IPAddress}}' web-server
docker inspect --format='{{.Mounts}}' web-server
docker inspect --format='{{.Config.Env}}' web-server
docker inspect --format='{{.HostConfig.Memory}}' web-server

# Logs de errores en formato JSON
docker inspect --format='{{range .LogPath}}{{.}}{{end}}' web-server

# Top proceso de un contenedor
docker top web-server

# Distribución de red de un contenedor
docker port web-server

# Networking
docker network ls
docker network inspect bridge
docker network inspect web-server_webnet
```

## Prácticas comunes de gestión

### Patrón de un solo proceso por contenedor

```
❌ MALO: múltiples procesos en un contenedor
┌───────────────────────────────────┐
│  Contenedor: mi-app               │
│  CMD: /usr/local/bin/start.sh     │  ← Supervisord o init
│  ┌───────────────────────────────┐│
│  │  App (Node.js)                ││
│  │  Log rotator                  ││
│  │  Cron jobs                    ││
│  │  Health check script          ││
│  └───────────────────────────────┘│
│  Problema: si muere el init,     │
│  no puedes ver qué proceso falló  │
└───────────────────────────────────┘

✅ BUENO: un proceso por contenedor
┌──────────────────────────┐  ┌──────────────────────────┐  ┌──────────────────────────┐
│  Contenedor: api-server   │  │  Contenedor: log-rotator  │  │  Contenedor: cron-jobs   │
│  CMD: node server.js     │  │  CMD: logrotate -f /etc  │  │  CMD: crond -f          │
│  Puertos: 3000           │  │  Puertos: none            │  │  Puertos: none            │
│  Volúmenes: /app/data    │  │  Volúmenes: /app/logs     │  │  Volúmenes: /app/data   │
└──────────────────────────┘  └──────────────────────────┘  └──────────────────────────┘
  Docker gestiona cada proceso   Docker gestaña cada proceso   Docker gestiona cada proceso
  Individualmente               Individualmente               Individualmente
```

### Patrón de contenedores efímeros

```
Contenedores efímeros: nacen, viven, mueren

Nacimiento:
  docker build -t mi-app:1.2.3 .
  docker run -d --name api mi-app:1.2.3

Vida:
  docker exec api curl /health
  docker logs -f api
  docker stats api

Muerte (grácil):
  docker stop api         → Envía SIGTERM
  docker kill api         → Envía SIGKILL (instantáneo)
  docker rm api           → Elimina el contenedor

Reciclaje:
  docker run -d --name api-new mi-app:1.3.0
  docker stop api && docker rm api
  # Nuevo contenedor reemplaza al viejo
```

### Graceful shutdown con SIGTERM

```dockerfile
# Tu aplicación debe manejar SIGTERM para cerrar limpiamente:

# Node.js
process.on('SIGTERM', async () => {
  console.log('SIGTERM recibido, cerrando gracefulmente...');
  server.close(async () => {
    await db.disconnect();  // Cerrar conexiones DB
    console.log('Conexiones cerradas, salida...');
    process.exit(0);
  });
});

# Python (FastAPI/Flask)
import signal
import sys

def shutdown_handler(signum, frame):
    print(f'Signal {signum} received, shutting down...')
    sys.exit(0)

signal.signal(signal.SIGTERM, shutdown_handler)
```

```bash
# docker stop envía SIGTERM primero, espera 10 segundos, luego SIGKILL
docker stop --time=30 web-server
# ↑ 30 segundos para shutdown graceful antes de force kill

# Verificar tiempo de stop
docker inspect --format='{{.HostConfig.StopTimeout}}' web-server
# 10000000000 = 10 segundos (nanosegundos)
```

## Gestión avanzada: networking en contenedores

### Redes bridge (por defecto)

```bash
# Red bridge por defecto
docker network ls
# NETWORK ID  NAME       DRIVER
# abc123      bridge      bridge
# def456      host       host
# ghi789      none       null

# Cada contenedor en la red bridge tiene su IP
docker inspect --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' web-server

# Redes bridge personalizadas (recomendado)
docker network create --driver bridge --subnet 172.20.0.0/16 my-net

# Crear contenedores en la red personalizada
docker run -d --name db --network my-net --ip 172.20.0.10 postgres:16
docker run -d --name api --network my-net app:latest
# api puede acceder a db con "db" (DNS automático)
# api puede acceder a db con "172.20.0.10" (IP)
```

### Network modes

```bash
# Bridge (por defecto) — red aislada, NAT
docker run -d --network bridge nginx:latest

# Host — sin aislamiento de red, comparte red del host
docker run -d --network host nginx:latest
# Puerto 80 accesible en localhost:80 directamente

# None — sin red
docker run -d --network none alpine:3.19
# Sin interfaz de red

# Container — compartir red de otro contenedor
docker run -d --name api --network none python:3.12-slim
docker run -d --name worker --network container:api python:3.12-slim
# api y worker comparten la misma stack de red
```

## Patrones de gestión en producción

### Pattern: API + Base de datos

```bash
# Crear red dedicada
docker network create app-net

# Base de datos
docker run -d \
  --name postgres-db \
  --network app-net \
  --memory=1g --memory-swap=1g \
  --cpus=1 \
  -e POSTGRES_PASSWORD=secreto \
  -v pg-data:/var/lib/postgresql/data \
  postgres:16

# API
docker run -d \
  --name api-server \
  --network app-net \
  --memory=512m --memory-swap=512m \
  --cpus=0.5 \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://user:secreto@postgres-db:5432/mydb \
  --health-cmd="curl -f http://localhost:3000/health || exit 1" \
  --restart=unless-stopped \
  api-server:1.2.3

# Volúmenes se crean automáticamente
docker volume ls
```

### Patrón: Nginx + API (reverse proxy)

```bash
# Docker Compose se usa para esto (ver artículo dedicado)
# Pero manualmente:

# Red compartida
docker network create proxy-net

# API (no expone puertos al host)
docker run -d --name api1 --network proxy-net -e PORT=3000 api-server:1.2.3
docker run -d --name api2 --network proxy-net -e PORT=3000 api-server:1.2.3

# Nginx (expone solo al host)
docker run -d \
  --name nginx \
  --network proxy-net \
  -p 80:80 \
  -v ./nginx.conf:/etc/nginx/nginx.conf:ro \
  nginx:latest

# nginx.conf:
# upstream api {
#   server api1:3000;
#   server api2:3000;
# }
```

### Patrón: Escalado horizontal

```bash
# Escalar de 1 a N instancias
for i in 1 2 3 4 5; do
  docker run -d \
    --name api-$i \
    --network proxy-net \
    -e PORT=3000 \
    -e INSTANCE_ID=$i \
    api-server:1.2.3
done

# Estado de los contenedores
docker ps --filter "name=api"
# CONTAINER  IMAGE          STATUS    PORTS
# api-1      api-server:1.2.3  Up
# api-2      api-server:1.2.3  Up
# api-3      api-server:1.2.3  Up
# api-4      api-server:1.2.3  Up
# api-5      api-server:1.2.3  Up

# Escalar hacia abajo
docker stop api-5 && docker rm api-5
```

### Patrón: Rolling update manual

```bash
# Update gradual sin downtime
docker run -d --name api-v2-1 --network proxy-net api-server:1.3.0
docker run -d --name api-v2-2 --network proxy-net api-server:1.3.0

# Verificar que el v2 funciona
curl http://api-v2-1:3000/health  # OK
curl http://api-v2-2:3000/health  # OK

# Actualizar el nginx para que apunte al v2
# (recargar nginx.conf con los nuevos upstreams)
docker exec nginx nginx -s reload

# Eliminar el v1
docker stop api-v1-1 && docker rm api-v1-1
docker stop api-v1-2 && docker rm api-v1-2
```

## Errores comunes

| Error | Causa | Solución |
|-------|-------|----------|
| `Exit 137` | OOM Killed (memoria excedida) | Aumentar `--memory` o optimizar la app |
| `Exit 143` | SIGTERM recibido (docker stop) | Shutdown graceful, revisar logs |
| `Exit 1` | Error de la aplicación | `docker logs nombre-contenedor` |
| `Exit 0` inesperado | Aplicación terminó normal | Verificar que CMD es correcto |
| `bind: address already in use` | Puerto ocupado | `lsof -i :8080` o cambiar puerto |
| Contenedor se detiene solo | OOM, error de app, o límite | `docker inspect` y `docker logs` |
| No acceso a internet | Red bridge sin DNS | `--network host` o configurar DNS |
| `permission denied` | Propietario de volúmenes | `--user` o `chown` en volumen |

## Resumen

- **Ciclo de vida**: created → running → stopped → removed
- **docker run** crea y ejecuta; **docker create** solo prepara
- **Recursos**: límites de CPU (`--cpus`), memoria (`--memory`), I/O (`--device-write-bps`)
- **Health checks**: monitorean la salud de la aplicación con `--health-cmd`
- **Logs**: `docker logs -f`, drivers de logging con rotación
- **exec**: para comandos y debugging sin entrar a la terminal
- **Un solo proceso por contenedor**: sigue el principio de responsabilidad única
- **Graceful shutdown**: manejar SIGTERM para cerrar limpiamente
- **Restart policies**: `always`, `on-failure`, `unless-stopped` para alta disponibilidad

> [!quote] La clave
> Los contenedores Docker son **efímeros**: están diseñados para nacer, vivir su vida y morir. No los gestiones como servidores tradicionales. En su lugar, usa images versionadas, health checks, restart policies y volúmenes para datos. Si un contenedor falla, déjalo morir y crea uno nuevo — ese es el espíritu de la computación efímera.

## Conexión con el resto de la wiki

| Concepto tocado | Artículo en profundidad |
|-----------------|------------------------|
| Arquitectura Docker | [[02-infra-contenedores/01-docker-intro]] |
| Creando imágenes | [[02-infra-contenedores/02-docker-images]] |
| Docker Compose | [[02-infra-contenedores/04-docker-compose]] |
| Networking Docker | [[02-infra-contenedores/05-docker-networking]] |
| Volúmenes Docker | [[02-infra-contenedores/06-docker-volumes]] |
