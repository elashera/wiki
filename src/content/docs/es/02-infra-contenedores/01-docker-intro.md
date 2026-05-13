---
title: "Docker en profundidad: qué es, por qué los contenedores importan y su arquitectura"
description: "Docker explicado desde cero: qué son los contenedores, por qué cambiaron la industria, arquitectura completa (cliente, daemon, imágenes, contenedores, registros) y cómo funciona internamente."
---

# Docker en profundidad: qué es, por qué los contenedores importan y su arquitectura

> [!tip] Docker en una frase
> Docker es **una plataforma para crear, distribuir y ejecutar aplicaciones dentro de contenedores ligeros**: paquetes autónomos que incluyen todo lo que necesita un software para correr — código, runtime, herramientas del sistema, bibliotecas y configuraciones — garantizando que siempre funcione igual, sin importar dónde se ejecute.

## ¿Qué son los contenedores?

Los contenedores son **una tecnología de virtualización a nivel de sistema operativo**. A diferencia de las máquinas virtuales tradicionales que emulan hardware completo y ejecutan un sistema operativo entero por cada instancia, los contenedores comparten el kernel del sistema operativo host pero ejecutan procesos aislados.

### La analogía de los contenedores de envío

Antes de Docker, entregar software era como enviar mercancía sin estandarizar: cada empresa tenía cajas de tamaño diferente, métodos de apilamiento diferentes y reglas propias. Los **contenedores de envío estandarizados** (inventados en 1956 por Malcom McLean) resolvieron este problema:

```
Antes de los contenedores (cada app era diferente):
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  App "X"         │  │  App "Y"         │  │  App "Z"         │
│  Librería A v1.2 │  │  Librería B v3.0 │  │  Librería C v0.9 │
│  Runtime Java 8  │  │  Runtime Node 12 │  │  Runtime Python 3.7│
│  Config específico│ │  Config específico│ │  Config específico│
│  SO específico    │  │  SO específico    │  │  SO específico    │
└──────────────────┘  └──────────────────┘  └──────────────────┘
                          ❌ Cada uno necesita un servidor

Después de los contenedores (todos estandarizados):
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Container   │  │ Container   │  │ Container   │
│ "App X"     │  │ "App Y"     │  │ "App Z"     │
│ (estándar)  │  │ (estándar)  │  │ (estándar)  │
└─────────────┘  └─────────────┘  └─────────────┘
       │                │                │
       └────────────────┼────────────────┘
                        ▼
              ┌─────────────────┐
              │   Contenedor de  │
              │     envío único  │
              │   (Docker)       │
              └─────────────────┘
                        ▼
              Se puede mover a cualquier servidor
              que tenga Docker instalado
```

### Lo que un contenedor incluye

```
┌──────────────────────────────────────────┐
│       Imagen de Docker (Contenedor)       │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  Tu aplicación (código fuente)      │  │
│  ├────────────────────────────────────┤  │
│  │  Runtime (Node, Python, Java...)   │  │
│  ├────────────────────────────────────┤  │
│  │  Dependencias (npm, pip, maven...) │  │
│  ├────────────────────────────────────┤  │
│  │  Bibliotecas del sistema (libc...) │  │
│  ├────────────────────────────────────┤  │
│  │  Configuraciones                    │  │
│  ├────────────────────────────────────┤  │
│  │  Variables de entorno               │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

## ¿Por qué los contenedores cambiaron la industria?

### El problema: "En mi máquina funciona"

Antes de Docker, este era uno de los problemas más comunes en desarrollo de software:

```
Desarrollador: "En mi máquina funciona perfectamente"
              → Linux con Node 18, base de datos local,
                configuraciones en /etc/
              
Tester:        "Aquí no funciona, da error de módulo faltante"
              → Su máquina tiene Node 16, diferente SO,
                diferentes dependencias del sistema

Producción:    "¡ERROR EN PRODUCCIÓN!"
              → El servidor de producción tiene una versión
                distinta de todas las bibliotecas
```

Este problema se llama **"incompatibilidad de entornos"**, y costaba a las empresas billones de dólares en productividad perdida.

### La solución: contenedores = entornos reproducibles

```
Contenedor creado en desarrollo → Se envía a testing → Se ejecuta en producción
        ═══════════════════════════════════════════════════════════
                           MISMO ENTORNOS SIEMPRE
```

### Los tres pilares de la revolución Docker

| Problema anterior | Solución con Docker | Impacto |
|-------------------|---------------------|---------|
| **Incompatibilidad de entornos** | Contenedores con todo incluido | "Funciona en cualquier parte" |
| **Servidores sobrecargados** | Múltiples contenedores en un solo servidor | Reducción de 5-10x en infraestructura |
| **Despliegues lentos y riesgosos** | Imágenes versionadas, despliegue en segundos | Despliegues múltiples veces al día |

## Docker: historia rápida

| Año | Evento |
|-----|--------|
| 2008 | Docker Inc. (entonces dotCloud) es fundada por Solomon Hykes |
| 2013 | Docker 0.1 lanzado como proyecto open source |
| 2014 | Docker 1.0 — primer lanzamiento estable |
| 2015 | Docker Swarm (orquestación nativa), Docker Compose |
| 2016 | Google, Microsoft y otros forman el OCI (Open Container Initiative) |
| 2017 | Kubernetes gana como estándar de orquestación |
| 2020 | Docker Desktop cambia licencia (empresas grandes pagan) |
| 2021+ | Podman, Buildah, Kaniko ganan popularidad como alternativas |

> [!note] Docker no es el único
> Docker popularizó los contenedores, pero no los inventó. Tecnologías anteriores como LXC (Linux Containers) ya existían. Docker mejoró la experiencia de usuario, el ecosistema de registros y la herramienta `docker CLI` que todos conocemos.

## Arquitectura de Docker

Docker se basa en una **arquitectura cliente-servidor**. Esta es la clave para entender cómo funciona:

```
                    Docker Architecture
                    ────────────────

┌─────────────┐     ┌──────────────────────────────────────┐
│  Docker CLI  │────▶│           Docker Daemon              │
│  (docker)    │     │         (dockerd)                    │
│              │     │                                      │
│ docker run   │     │  ┌─────────┐  ┌──────────────────┐  │
│ docker build │     │  │ Images  │  │ Container Engine │  │
│ docker ps    │     │  │ (cache) │  │  (runc)          │  │
│ docker exec  │     │  └─────────┘  └──────────────────┘  │
│              │     │                                      │
│ docker push  │     │  ┌─────────────────────────────────┐ │
│ docker pull  │     │  │   Containers (procesos aislados) │ │
│              │     │  └─────────────────────────────────┘ │
└─────────────┘     └──────────────────────────────────────┘
                            │
                            ▼
                     Sistema Operativo Host
                     (Kernel Linux, cgroups,
                      namespaces, overlay fs)
```

### Los componentes principales

#### 1. Docker CLI (el cliente)

Es la herramienta que usas desde la terminal. Todo lo que escribes con el prefijo `docker` va aquí:

```bash
docker run nginx                    # Iniciar un contenedor
docker build -t mi-app .            # Construir una imagen
docker ps                           # Listar contenedores
docker images                       # Listar imágenes
docker-compose up                   # Levantar aplicaciones multi-container
```

**¿Qué hace internamente?**
- Parsea tu comando
- Lo convierte en una solicitud API (HTTP/Unix socket)
- La envía al Docker Daemon
- Muestra la respuesta en la terminal

```bash
# Los comandos CLI se comunican con el daemon así:
docker CLI ──── HTTP API / Unix Socket ────▶ Docker Daemon (dockerd)
# En Linux: /var/run/docker.sock
# En Windows/Mac: Docker Desktop expone un socket Unix virtualizado
```

#### 2. Docker Daemon (dockerd)

Es el **cerebro de Docker**. Se ejecuta como un servicio en segundo plano y es responsable de:

| Responsabilidad | Descripción |
|-----------------|-------------|
| **Construir imágenes** | Procesa el `Dockerfile` y crea capas |
| **Ejecutar contenedores** | Crea y gestiona contenedores a partir de imágenes |
| **Redes** | Configura redes bridge, overlay, etc. |
| **Volúmenes** | Gestiona almacenamiento persistente |
| **Comunicación** | Escucha solicitudes de la CLI y de otros Docker daemons |
| **Orquestación** | Si usas Docker Swarm, gestiona el cluster |

```bash
# Verificar que el daemon está corriendo
sudo systemctl status docker
# ● docker.service - Docker Application Container Engine
#     Active: active (running) since Lun 2024-01-15 10:30:00 UTC

# Verificar la versión del daemon
docker info
# Client:
#  Version:           25.0.3
#  Context:           default
# Server:
#  Engine:
#   Version:          25.0.3
#   Architecture:     x86_64
#   Operating System: Ubuntu 22.04.3 LTS
#   CPUs:             8
#   Total Memory:     15.6GiB
```

#### 3. Registros de Docker (Docker Registries)

Un registro es un **almacén de imágenes Docker**. El más conocido es **Docker Hub** (hub.docker.com), pero puedes usar cualquier registro:

```
Registros de Docker populares:
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Docker Hub      │  │  GitHub GHCR     │  │  Google GCR      │
│  hub.docker.com  │  │  ghcr.io         │  │  gcr.io          │
│  - Más grande     │  │  - Integrado con │  │  - Nativo de GCP   │
│  - Público/priv. │  │    repos         │  │  - IAM integrado  │
│  - Comunidades   │  │  - Acceso con GH │  │  - Cloud NATI    │
└──────────────────┘  └──────────────────┘  └──────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  AWS ECR         │  │  GitLab Registry │  │  Registry propio  │  │  Quay.io        │
│  amazonaws.com   │  │  registry.gitlab │  │  (Harbor,        │  │  - OCI comp.   │
│  - Nativo de AWS  │  │  - GitLab CI/CD │  │   Docker Reg.)   │  │  - CNCF project │
│  - IAM           │  │    integrado    │  │  - Open source   │  │                  │
└──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────────┘
```

#### 4. Imágenes Docker

Una imagen es una **plantilla de solo lectura** que contiene todo lo necesario para ejecutar una aplicación. Piensa en ella como la plantilla para crear contenedores:

```
Relación Imagen → Contenedor:

  Imagen                    Contenedores
  (solo lectura)     ────── (ejecutables, múltiples)
  ══════════════          ═══════════════════════
  Plantilla de cocina     Platos servidos a clientes
  (receta, ingredientes)  (cada uno puede modificarse)

  nginx:latest   ───▶  Contenedor1 (nginx) — puerto 80
  nginx:latest   ───▶  Contenedor2 (nginx) — puerto 81
  nginx:latest   ───▶  Contenedor3 (nginx) — puerto 82
  mi-app:v1.2    ───▶  Contenedor4 (mi-app)
  postgres:16    ───▶  Contenedor5 (postgres)
```

#### 5. Contenedores

Un contenedor es una **instancia ejecutable de una imagen**. Es donde tu aplicación realmente corre:

```
Ciclo de vida de un contenedor:
─────────────────────────────

┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  creado  │────▶│  ejecut. │────▶│  detenido│────▶│  elimin. │     │  elimin. │
│ created  │     │  running │     │  stopped │     │  removed │     │  exited  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                │                │
     │ docker create  │ docker start   │ docker stop    │ docker rm
     │                │                │                │
  Estado:   Estado:    Estado:          Estado:
  No corre   Corre      No corre,       Borrado
  nada       datos      existe en       completamente
             persisten  disco
```

## ¿Cómo funciona Docker internamente?

Docker no usa máquinas virtuales. Usa **funciones nativas de Linux** para crear el aislamiento. Esta es la magia:

### Namespaces: aislamiento de procesos

Linux tiene **namespaces** que permiten que grupos de procesos se vean a sí mismos como si fueran los únicos en el sistema:

```
Namespaces que usa Docker:
┌─────────────────┬──────────────────────────────────────────┐
│  Namespace      │  ¿Qué aísla?                            │
├─────────────────┼──────────────────────────────────────────┤
│  PID            │  Procesos (cada contenedor ve solo     │
│                 │  sus procesos)                           │
│  Network        │  Interfaces de red, puertos, routes      │
│  Mount          │  Sistema de archivos                     │
│  UTS            │  Nombre de host y dominio               │
│  IPC            │  Comunicación entre procesos (semáforos) │
│  User           │  Mapeo de usuarios (UID/GID)            │
└─────────────────┴──────────────────────────────────────────┘
```

```
Ejemplo: Namespace PID

En el host:
  PID 1    →   Init (systemd)
  PID 100  →   docker container A
  PID 200  →   docker container B
  PID 300  →   docker container C

Dentro del container A:
  PID 1    →   Tu proceso principal (ej. nginx)
  PID 2    →   nginx worker process
  (PID 100 del host NO se ve desde dentro del container)

Dentro del container B:
  PID 1    →   Tu proceso principal (ej. postgres)
  (PID 100 y 200 del host NO se ven desde dentro del container)
```

### cgroups: límite de recursos

Los **control groups (cgroups)** permiten limitar, contar y aislar el uso de recursos (CPU, memoria, disco, red):

```
cgroups en acción:

┌─────────────────────────────────────────────┐
│  Host Server: 16 GB RAM, 8 CPU Cores        │
│                                             │
│  cgroup docker                              │
│  ├── container-db (limitado a:              │
│  │    4 GB RAM, 2 CPU cores)                │
│  ├── container-web (limitado a:             │
│  │    2 GB RAM, 1 CPU core)                 │
│  └── container-worker (limitado a:          │
│       2 GB RAM, 1 CPU core)                 │
│                                             │
│  Total asignado: 8 GB, 4 cores              │
│  Restante: 8 GB, 4 cores → para otros usos  │
└─────────────────────────────────────────────┘
```

### Overlay2: sistema de archivos en capas

Docker usa **overlay2** como su driver de almacenamiento por defecto. Las imágenes se construyen en **capas de solo lectura** y los contenedores añaden una **capa de escritura**:

```
Estructura de capas de una imagen:

  Imagen: node:20-alpine

  ┌──────────────────────┐  ← Capa superior (solo lectura)
  │  Capa: node bin       │  (último comando del Dockerfile)
  ├──────────────────────┤
  │  Capa: npm + yarn     │
  ├──────────────────────┤
  │  Capa: Python         │
  ├──────────────────────┤
  │  Capa: Alpine base    │  ← Capa inferior
  │  (alpine:3.19)        │     (~5 MB, sistema base mínimo)
  └──────────────────────┘

Contenedor creado a partir de esta imagen:
  ┌──────────────────────┐  ← Capa de escritura (rw) — solo existe en este contenedor
  │  Contenedor rw       │
  ├──────────────────────┤  ← Capas de solo lectura (compartidas con otros contenedores)
  │  Capa: node bin       │
  ├──────────────────────┤
  │  Capa: npm + yarn     │
  ├──────────────────────┤
  │  Capa: Python         │
  ├──────────────────────┤
  │  Capa: Alpine base    │
  └──────────────────────┘

⚡ Ventaja de capas: Si dos contenedores usan node:20-alpine, las 4 capas
   de solo lectura se comparten en disco. Solo la capa de escritura es
   única por contenedor.
```

### runc: el motor de contenedores

Por debajo, Docker usa **runc** (del runtime de Docker) para crear y gestionar contenedores. runc sigue el **OCI (Open Container Initiative)**:

```
Flujo completo de un "docker run":

  1.  docker CLI envía "docker run nginx" a dockerd
  2.  dockerd busca la imagen "nginx" localmente
  3.  Si no está, dockerd la descarga de Docker Hub
  4.  dockerd le dice a runc: "crea un contenedor con esta imagen"
  5.  runc:
      a. Crea un nuevo namespace PID
      b. Crea un nuevo namespace Network
      c. Configura cgroups (límites de recursos)
      d. Monta el sistema de archivos overlay
      e. Ejecuta el proceso principal (CMD del Dockerfile)
  6.  El contenedor está corriendo ✓
```

## Docker vs Máquinas Virtuales

Esta es la comparación más importante para entender por qué Docker es diferente:

```
MÁQUINAS VIRTUALES (VM) vs CONTENEDORES (Docker)

┌────────────────────┬──────────────────────┬──────────────────────┐
│  Característica     │  Máquina Virtual      │  Contenedor Docker   │
├────────────────────┼──────────────────────┼──────────────────────┤
│  Qué virtualiza    │  Hardware completo    │  Sistema operativo   │
│  Guest OS          │  Sí (SO completo)     │  No (comparte host)  │
│  Tamaño            │  GBs (5-40 GB)        │  MBs (10-500 MB)     │
│  Inicio            │  Minutos              │  Milisegundos        │
│  Overhead          │  Alto (Hipervisor)    │  Muy bajo            │
│  Aislamiento       │  Fuerte (SO diferente)│  Bueno (mismo SO)    │
│  Imágenes          │  ISOs de SO           │  Capas de imagen     │
│  Rendimiento       │  Ligera penalización  │  Nativo casi 1:1     │
│  Ejemplo           │  VirtualBox, KVM,     │  Docker, Podman      │
│                     │  VMware               │                      │
└────────────────────┴──────────────────────┴──────────────────────┘
```

### Diagrama comparativo

```
MÁQUINA VIRTUAL:

┌─────────────────────────────────────────┐  Host OS (Linux)
│  ┌───────────────────────────────────┐  │
│  │  Hypervisor (KVM/VMware)           │  │
│  │  ┌───────────────────────────────┐│  │
│  │  │  Guest OS (Ubuntu)             ││  │
│  │  │  ┌─────────────────────────┐  ││  │
│  │  │  │  Node.js + App          │  ││  │
│  │  │  └─────────────────────────┘  ││  │
│  │  └───────────────────────────────┘│  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  Hypervisor (KVM/VMware)           │  │
│  │  ┌───────────────────────────────┐│  │
│  │  │  Guest OS (Windows)            ││  │
│  │  │  ┌─────────────────────────┐  ││  │
│  │  │  │  .NET + App             │  ││  │
│  │  │  └─────────────────────────┘  ││  │
│  │  └───────────────────────────────┘│  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
        ↑            ↑
     4 GB RAM       4 GB RAM
     2 cores        2 cores
     Inicio: 2 min  Inicio: 2 min


CONTENEDOR (Docker):

┌─────────────────────────────────────────┐  Host OS (Linux)
│  Kernel Linux (compartido)              │
│  ┌───────────────────────────────────┐  │
│  │  Container 1 (node:20)             │  │
│  │  Node.js + App                     │  │
│  │  ~150 MB RAM                       │  │
│  │  Inicio: 0.5 seg                   │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  Container 2 (postgres:16)         │  │
│  │  PostgreSQL                        │  │
│  │  ~50 MB RAM                        │  │
│  │  Inicio: 0.3 seg                   │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  Container 3 (nginx:latest)        │  │
│  │  Nginx                             │  │
│  │  ~10 MB RAM                        │  │
│  │  Inicio: 0.2 seg                   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
        ↑
     ~215 MB total
     Inicio: < 1 seg total
```

## Comandos esenciales de Docker

### Gestión de contenedores

```bash
# Descargar una imagen
docker pull nginx:latest

# Ejecutar un contenedor en segundo plano (-d = detached)
docker run -d --nombre web-server -p 8080:80 nginx:latest

# Listar contenedores en ejecución
docker ps

# Listar TODOS los contenedores (incluidos los detenidos)
docker ps -a

# Ver logs de un contenedor
docker logs web-server

# Ver logs en tiempo real (follow mode)
docker logs -f web-server

# Entrar a un contenedor en ejecución
docker exec -it web-server sh

# Detener un contenedor
docker stop web-server

# Iniciar un contenedor detenido
docker start web-server

# Eliminar un contenedor
docker rm web-server

# Eliminar un contenedor y sus volúmenes
docker rm -v web-server
```

### Gestión de imágenes

```bash
# Listar imágenes locales
docker images

# Construir una imagen desde un Dockerfile
docker build -t mi-app:1.0 .

# Etiqueta una imagen con una versión
docker tag mi-app:1.0 mi-app:latest

# Eliminar una imagen
docker rmi mi-app:1.0

# Limpiar imágenes no usadas
docker image prune

# Limpiar TODO lo no usado (imágenes, contenedores, volúmenes)
docker system prune -a
```

### Gestión de redes

```bash
# Listar redes
docker network ls

# Crear una red personalizada
docker network create mi-red

# Conectar un contenedor a una red
docker network connect mi-red web-server

# Ver información de una red
docker network inspect mi-red
```

### Gestión de volúmenes

```bash
# Listar volúmenes
docker volume ls

# Crear un volumen
docker volume create mi-volumen

# Montar un volumen en un contenedor
docker run -d -v mi-volumen:/data nginx:latest

# Mount directo de carpeta (bind mount)
docker run -d -v $(pwd)/datos:/data nginx:latest
```

## Conceptos clave para dominar Docker

### Imágenes vs Contenedores

```
┌──────────────────┬──────────────────────────────────────────┐
│  Imagen           │  Contenedor                             │
├──────────────────┼──────────────────────────────────────────┤
│  Plantilla estática│  Instancia en ejecución                │
│  Solo lectura      │  Lectura/escritura (capa extra)        │
│  En disco          │  En memoria (RAM)                      │
│  Nombre:tag        │  Nombre único + ID                     │
│  Ejemplo           │  Ejemplo                               │
│  node:20-alpine    │  "confused_swanson" (node:20-alpine)   │
│  nginx:latest      │  "jolly_brown" (nginx:latest)          │
└──────────────────┴──────────────────────────────────────────┘
```

### Puertos: mapeo de puertos

Docker expone puertos usando el flag `-p`:

```bash
# Sintaxis: -p [host-puerto]:[contenedor-puerto]
docker run -d -p 8080:80 nginx:latest
#           ↑          ↑
#           │          └── Puertopuerto interno del contenedor (nginx escucha en 80)
#           └── Puerto en tu máquina (accesible en http://localhost:8080)
```

### Variables de entorno

```bash
# Pasar variables de entorno a un contenedor
docker run -d \
  --name mi-app \
  -e DATABASE_HOST=postgres \
  -e DATABASE_PORT=5432 \
  -e DATABASE_NAME=mibase \
  -e DATABASE_USER=usuario \
  -e DATABASE_PASSWORD=secreto123 \
  mi-app:latest

# Dentro de la app, se accede como variables normales:
# Python: os.environ['DATABASE_HOST']
# Node: process.env.DATABASE_HOST
# Java: System.getenv("DATABASE_HOST")
```

### Health checks

Docker puede verificar si un contenedor está funcionando:

```bash
docker run -d \
  --name mi-app \
  --health-cmd="curl -f http://localhost:3000/health || exit 1" \
  --health-interval=30s \
  --health-timeout=10s \
  --health-retries=3 \
  mi-app:latest

# Ver estado de health
docker inspect --format='{{.State.Health.Status}}' mi-app
# healthcheck → healthy | unhealthy | starting
```

## Docker: buenas prácticas iniciales

### 1. Usa imágenes oficiales

```bash
# ✅ Buena: imágenes oficiales verificadas
docker pull nginx:latest
docker pull node:20-alpine
docker pull postgres:16

# ❌ Mala: imágenes de usuarios no verificados
docker pull someuser/nginx
```

### 2. Nunca ejecutes como root dentro del contenedor

```dockerfile
# ❌ Malo
FROM node:20-alpine
RUN npm install
CMD ["node", "server.js"]

# ✅ Bueno: crear un usuario no root
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
CMD ["node", "server.js"]
```

### 3. Usa .dockerignore

```bash
# .dockerignore
node_modules
.git
*.md
.env
dist/
.next/
```

### 4. Usa versiones específicas (no solo `latest`)

```bash
# ❌ Malo: "latest" puede cambiar sin avisar
docker pull node:latest

# ✅ Bueno: versión específica, reproducible
docker pull node:20.11.0-alpine

# En Dockerfile:
# ❌ FROM node:latest
# ✅ FROM node:20.11.0-alpine
```

## Errores comunes de principiantes

| Error | Causa | Solución |
|-------|-------|----------|
| `permission denied while trying to connect to the Docker daemon socket` | Usuario no está en el grupo `docker` | `sudo usermod -aG docker $USER` y reiniciar sesión |
| `port is already allocated` | Otro proceso usando ese puerto | `lsof -i :8080` para encontrar qué lo usa |
| `image does not have a sha256digest` | Imagen corrupta o descarga incompleta | `docker system prune` y `docker pull` de nuevo |
| Contenedor se detiene inmediatamente | El CMD/CMD no está corriendo o falla | `docker logs nombre-contenedor` para ver el error |
| No se puede acceder a la app por puerto 80 | Puerto no mapeado | Agregar `-p 80:80` al `docker run` |
| Datos se pierden al borrar contenedor | No se usaron volúmenes | Usar `docker volume` o bind mounts |

## Resumen

- **Docker** es una plataforma de contenedores que permite empaquetar aplicaciones con todo su entorno
- **Los contenedores** comparten el kernel del host pero están aislados (namespaces, cgroups)
- **Arquitectura**: CLI (cliente) → Daemon (dockerd) → runc (motor) → Kernel Linux
- **Imágenes** son plantillas de solo lectura; **contenedores** son instancias ejecutables
- **Registros** (Docker Hub, GHCR, GCR, ECR) almacenan imágenes para distribuir
- **Docker vs VM**: contenedores son más ligeros, más rápidos, y comparten el SO
- **Capas de imagen**: se comparten entre contenedores, ahorrando espacio en disco
- Buenas prácticas: imágenes oficiales, versión fija, .dockerignore, no root, health checks

> [!quote] La clave
> Docker no es magia: es una forma estandarizada de empaquetar software usando funciones nativas de Linux. Una imagen es la receta (Dockerfile), el contenedor es el plato cocinado, y un registro es el restaurante que sirve el plato a otros. Entender esta metáfora te ayuda a dominar Docker: imagenes = plantillas, contenedores = instancias, registros = distribución.

## Conexión con el resto de la wiki

| Concepto tocado | Artículo en profundidad |
|-----------------|------------------------|
| Redes (puertos, TCP/IP) | [[01-redes-internet/01-que-es-internet]] |
| Servidores y procesos | [[01-redes-internet/014-servidores-procesos]] |
| Firewalls | [[01-redes-internet/017-firewalls-proxies-loadbalancers]] |
| VPS | [[01-redes-internet/020-vps]] (donde correrás tus contenedores) |
