---
title: "Imágenes Docker: creando imágenes optimizadas con Dockerfile, capas y multi-stage builds"
description: "Guía completa de imágenes Docker: Dockerfile paso a paso, mejor prácticas, sistema de capas, multi-stage builds, optimización de tamaño, etiquetas semánticas y gestión de registros."
---

# Imágenes Docker: creando imágenes optimizadas con Dockerfile, capas y multi-stage builds

> [!tip] Imágenes Docker en una frase
> Una imagen Docker es **una plantilla de solo lectura construida a partir de capas**, definida por un `Dockerfile`. Es el resultado de empaquetar tu aplicación con todo su entorno para que pueda ejecutarse idénticamente en cualquier lugar.

## ¿Qué es una imagen Docker?

Una imagen Docker es una **plantilla inmutable** que contiene todo lo necesario para ejecutar una aplicación: código, runtime, bibliotecas, variables de entorno y configuración. Las imágenes se construyen en **capas apiladas**, cada una representando un paso en la creación.

### Imagen vs Contenedor: la analogía

```
┌─────────────────────────────────────────┐
│  Relación Imagen ↔ Contenedor           │
│                                          │
│  Imagen       = Clase (en POO)           │
│  Contenedor   = Instancia                │
│                                          │
│  Imagen       = Foto en un libro         │
│  Contenedor   = Foto impresa             │
│                                          │
│  Imagen       = Receta de cocina         │
│  Contenedor   = Plato preparado          │
│                                          │
│  Imagen       = Molde de galletas        │
│  Contenedor   = Galleta hecha            │
└─────────────────────────────────────────┘
```

### Estructura de una imagen

```
┌──────────────────────────────────────────┐
│         Imagen Docker                    │
│         (ej: node:20-alpine)             │
│                                          │
│  ┌─ Layer 5 (top): tu código + app      │
│  ├─ Layer 4: dependencias instaladas     │
│  ├─ Layer 3: runtime (Node.js)          │
│  ├─ Layer 2: herramientas del sistema    │
│  └─ Layer 1 (base): sistema operativo    │
│      (alpine:3.19 ~ 5MB)                │
│                                          │
│  Tamaño total: ~170 MB                  │
└──────────────────────────────────────────┘
```

## El Dockerfile: guía completa

Un **Dockerfile** es un script que Docker lee para construir una imagen automáticamente. Cada instrucción crea una nueva capa.

### Sintaxis básica

```dockerfile
# La línea 1 siempre debe ser FROM
FROM node:20-alpine

# Instrucciones que crean capas:
COPY package.json /app/
RUN npm install
COPY . /app
CMD ["node", "server.js"]
```

### Instrucciones del Dockerfile

#### FROM: la base de todo

```dockerfile
# Sintaxis básica
FROM imagen:tag

# Con AS (para multi-stage builds)
FROM node:20-alpine AS build-stage
FROM node:20-alpine AS production-stage

# Imagen base popular:
FROM alpine:3.19          # ~5 MB, mínimo absoluto
FROM debian:bookworm-slim # ~70 MB, más herramientas
FROM ubuntu:22.04         # ~77 MB, más completo
FROM node:20-alpine       # ~170 MB, Node.js + Alpine
FROM python:3.12-slim     # ~130 MB, Python + Debian slim
FROM golang:1.22-alpine   # ~400 MB, Go + Alpine
FROM rust:1.75-slim       # ~600 MB, Rust + Debian slim
```

#### WORKDIR: directorio de trabajo

```dockerfile
# Establece el directorio de trabajo para las instrucciones posteriores
WORKDIR /app
# Es equivalente a hacer "mkdir -p /app && cd /app"

# WORKDIR vs RUN cd
# ❌ Malo: WORKDIR es persistente, RUN cd no
FROM node:20-alpine
RUN cd /app                    # ❌ El cd se pierde después de esta instrucción
COPY . /app                    # ❌ Termina en /
CMD ["node", "index.js"]       # Error: no encuentra index.js en /

# ✅ Bueno: WORKDIR persiste entre capas
FROM node:20-alpine
WORKDIR /app
COPY . .
CMD ["node", "index.js"]       # ✅ index.js está en /app
```

```
WORKDIR también crea la carpeta si no existe:
FROM node:20-alpine
WORKDIR /app                   # Crea /app
WORKDIR src                    # Crea /app/src
WORKDIR ../tmp                 # Crea /tmp (sube un nivel desde /app/src)
# El WORKDIR actual ahora es /tmp
CMD ["pwd"]                    # /tmp
```

#### COPY vs ADD

```dockerfile
# COPY: copia archivos locales al contenedor
COPY origen/ destino/
COPY package.json /app/
COPY *.txt /docs/              # Soporta wildcards
COPY --chown=appuser:appgroup archivo /app/  # Cambia propietario

# ADD: como COPY pero con funcionalidades extra
ADD archivo.tar.gz /app/       # ✅ Descomprime automáticamente
ADD http://ejemplo.com/archivo /app/  # ✅ Descarga de URL
ADD --chown=appuser:appgroup archivo /app/  # Cambia propietario
```

```
COPY vs ADD: ¿cuál usar?
┌─────────────────┬──────────────┬──────────────┐
│  Caso           │  COPY        │  ADD         │
├─────────────────┼──────────────┼──────────────┤
│  Copia local    │  ✅ Recomendado │ ✅           │
│  URL remota     │  ❌          │ ✅           │
│  .tar.gz auto   │  ❌          │ ✅           │
│  Checksum       │  ❌          │ --chown      │
│  Claridad       │  ✅           │ Menos claro  │
└─────────────────┴──────────────┴──────────────┘

Regla: Usa COPY siempre que puedas.
Usa ADD SOLO si necesitas:
- Descomprimir archivos .tar.gz automáticamente
- Descargar desde URLs (aunque curl o wget en RUN es preferible)
```

#### RUN: ejecutar comandos

```dockerfile
# Shell form: se ejecuta en un shell (sh -c)
RUN npm install

# Exec form: se ejecuta directamente (sin shell)
RUN ["npm", "install"]

# Múltiples RUN (cada uno crea una capa):
RUN apt-get update && apt-get install -y curl
RUN apt-get install -y wget
RUN apt-get install -y git

# Mejor: combinar en un solo RUN para menos capas:
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    && rm -rf /var/lib/apt/lists/*

# ⚠️ Nota: cada RUN crea una nueva capa
# Las capas previas se "congelan" — cambios en instrucciones
# posteriores no afectan capas ya construidas
```

```bash
# ¿Cuántas capas crea cada enfoque?

# ❌ Malo: 5 capas
RUN apt-get update
RUN apt-get install -y curl
RUN apt-get install -y wget
RUN apt-get install -y git
RUN rm -rf /var/lib/apt/lists/*

# ✅ Bueno: 1 capa
RUN apt-get update && apt-get install -y \
    curl wget git \
    && rm -rf /var/lib/apt/lists/*
```

#### CMD vs ENTRYPOINT

```dockerfile
# CMD: valores por defecto que el usuario puede sobrescribir
FROM node:20-alpine
CMD ["node", "server.js"]

# El usuario puede ejecutar:
# docker run mi-app              → node server.js (default)
# docker run mi-app npm test     → npm test (CMD sobrescrito)
# docker run mi-app node debug   → node debug (CMD sobrescrito)


# ENTRYPOINT: el comando principal que NO se sobrescribe fácilmente
FROM node:20-alpine
ENTRYPOINT ["node", "server.js"]

# El usuario puede agregar argumentos:
# docker run mi-app              → node server.js
# docker run mi-app --debug      → node server.js --debug
# docker run mi-app --help       → node server.js --help
```

```
CMD vs ENTRYPOINT: la diferencia clave

CMD (valores por defecto):
  docker run mi-app:latest              → node server.js
  docker run mi-app:latest npm test     → npm test (CMD se REEMPLAZA)
  docker run mi-app:latest --debug      → --debug (CMD se REEMPLAZA)

ENTRYPOINT (comando fijo):
  docker run mi-app:latest              → node server.js
  docker run mi-app:latest npm test     → node server.js npm test (se AGREGA)
  docker run mi-app:latest --debug      → node server.js --debug (se AGREGA)

# Combina ambos para configurabilidad:
FROM node:20-alpine
ENTRYPOINT ["node"]
CMD ["server.js"]

# docker run mi-app             → node server.js
# docker run mi-app debug.js    → node debug.js
# docker run mi-app --inspect   → node --inspect
```

#### ENV: variables de entorno

```dockerfile
# Sintaxis KEY=VALUE
ENV NODE_ENV=production
ENV APP_PORT=3000

# Sintaxis con shell (útil para valores con espacios):
ENV GREETING="Hello World"

# Referenciar variables en el mismo Dockerfile:
ENV APP_DIR=/app
WORKDIR $APP_DIR

# Verificar variables en un contenedor:
docker run --env DATABASE_URL="postgresql://..." mi-app
docker run -e NODE_ENV=production -e API_KEY=abc123 mi-app
```

#### ARG: variables de construcción

```dockerfile
# ARG: solo existe durante la construcción (no en el contenedor)
ARG NODE_VERSION=20
ARG BUILD_VERSION=1.0.0

FROM node:${NODE_VERSION}-alpine

RUN echo "Construyendo versión ${BUILD_VERSION}"

# Al construir, puedes pasar valores:
# docker build --build-arg NODE_VERSION=18 --build-arg BUILD_VERSION=2.0.0 -t mi-app .

# Valores por defecto si no se pasa:
FROM alpine:3.19
ARG HTTP_PORT=80
ARG APP_ENV=production

RUN echo "Puerto: ${HTTP_PORT}"
RUN echo "Ambiente: ${APP_ENV}"
```

```bash
ARG vs ENV: ¿cuándo usar cada uno?
┌─────────────────┬──────────────┬──────────────┐
│                   │  ARG         │  ENV         │
├─────────────────┼──────────────┼──────────────┤
│  Durante build  │  ✅ Sí       │  También     │
│  En contenedor  │  ❌ No       │  ✅ Sí       │
│  docker run -e  │  ❌          │  ✅ Sí       │
│  docker inspect │  ❌          │  ✅ Sí       │
│  Uso típico     │  Versiones   │  Configuración│
│                 │  del build   │  de la app   │
└─────────────────┴──────────────┴──────────────┘
```

#### EXPOSE: documentación de puertos

```dockerfile
# EXPOSE no publica puertos — es documentación
# La publicación real se hace con -p en docker run
FROM node:20-alpine
EXPOSE 3000

# docker run -p 8080:3000 mi-app
#                         ↑
#  EXPOSE dice "esta app usa el puerto 3000 internamente"
#  -p dice "mapear el puerto 3000 interno al 8080 externo"
```

#### USER: cambiar usuario

```dockerfile
# ⚠️ Nunca ejecutes como root
FROM node:20-alpine

# Crear usuario no-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Cambiar al usuario no-root
USER appuser

# O puedes especificar UID:GID
USER 1000:1000
```

#### VOLUME: volúmenes

```dockerfile
# Declara un punto de montaje como volumen
FROM node:20-alpine
VOLUME ["/app/data", "/app/logs"]

# Esto crea volúmenes anónimos automáticamente
# docker run mi-app creará volúmenes gestionados por Docker
```

#### HEALTHCHECK: verificación de salud

```dockerfile
FROM nginx:latest
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

# Parámetros:
# --interval: tiempo entre checks (default: 30s)
# --timeout: tiempo máximo por check (default: 30s)
# --start-period: tiempo antes del primer check (default: 0s)
# --retries: intentos antes de marcar "unhealthy" (default: 3)

# Comprobación en contenedor:
docker inspect --format='{{.State.Health.Status}}' mi-contenedor
# healthy | unhealthy | starting
```

## Construcción de capas: el sistema de caché

Entender cómo Docker construye capas es **fundamental** para crear imágenes rápidas:

```
Proceso de construcción con caché:

Dockerfile:
  FROM node:20-alpine        ← Capa 1: Si node:20-alpine no cambió → ✅ caché
  WORKDIR /app               ← Capa 2: Si no cambió → ✅ caché
  COPY package.json .        ← Capa 3: Si package.json NO cambió → ✅ caché
  RUN npm install            ← Capa 4: Si la capa anterior fue caché → ✅ caché
  COPY . .                   ← Capa 5: Si el directorio cambió → ❌ reconstruye
  CMD ["node", "server.js"]  ← Capa 6: nueva imagen

Resultado:
  - Capas 1-4: usadas del caché (segundos)
  - Capa 5: reconstruida (solo si algo cambió)
  - Capa 6: nueva imagen

⚡ Con caché: build de 5 segundos
❌ Sin caché: build de 2 minutos (npm install)
```

### El orden importa: pon los archivos menos cambiantes primero

```dockerfile
# ❌ Malo: cada cambio en el código invalida npm install
FROM node:20-alpine
WORKDIR /app
COPY . .                   ← Cambia TODO → invalida todas las capas siguientes
RUN npm install            ← Siempre se reconstruye (❌ lento)
CMD ["node", "server.js"]

# ✅ Bueno: package.json separado del código
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./  ← Cambia RARO
RUN npm install                            ← Se usa caché la mayor parte del tiempo
COPY . .                                 ← Cambia FRECUENTE, pero npm install no se toca
CMD ["node", "server.js"]
```

## Multi-stage builds: la técnica más importante

Los **multi-stage builds** permiten usar múltiples `FROM` en un mismo Dockerfile. Cada `FROM` es una nueva etapa con su propia base:

### ¿Por qué multi-stage builds?

```
Problema: imágenes enormes con herramientas de build innecesarias

❌ Imagen sin multi-stage (3.2 GB):
┌─────────────────────────────────────┐
│  FROM golang:latest (1.4 GB)        │
│  RUN apt-get update                 │
│  RUN apt-get install -y git         │  ← git no se necesita en producción
│  RUN go build                       │
│  COPY . .                           │
│  CMD ["./myapp"]                    │
│  ┌─────────────────────────────────┐│
│  │  Go compiler + stdlib            ││  ← 1.4 GB
│  │  build-essential                 ││  ← 200 MB
│  │  git                             ││  ← 50 MB
│  │  Tu aplicación compilada         ││  ← 50 MB
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
Total: ~3.2 GB


✅ Imagen con multi-stage (50 MB):
Stage 1 (build):
┌─────────────────────────────────────┐
│  FROM golang:latest (1.4 GB)        │
│  ... build the app ...              │
│  /app/bin/myapp (50 MB compilado)   │
└─────────────────────────────────────┘
  │
  │  COPY --from=build-stage /app/bin/myapp
  ▼
Stage 2 (production):
┌─────────────────────────────────────┐
│  FROM alpine:3.19 (5 MB)            │
│  COPY --from=build-stage /app/bin/myapp /myapp
│  CMD ["/myapp"]                     │
│  ┌─────────────────────────────────┐│
│  │  Alpine base                     ││  ← 5 MB
│  │  Tu aplicación compilada         ││  ← 50 MB
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
Total: ~55 MB (60x más pequeña!)
```

### Ejemplo real: aplicación Node.js

```dockerfile
# ═══════════════════════════════════════════
# Stage 1: Dependencias y caché
# ═══════════════════════════════════════════
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

# ═══════════════════════════════════════════
# Stage 2: Build (si tu app necesita compilación)
# ═══════════════════════════════════════════
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ═══════════════════════════════════════════
# Stage 3: Producción — imagen mínima
# ═══════════════════════════════════════════
FROM node:20-alpine AS production
# Crear usuario no-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copiar solo lo necesario de stages anteriores
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./

# Cambiar a usuario no-root
USER appuser

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
```

### Ejemplo real: aplicación Python con PyInstaller

```dockerfile
# ═══════════════════════════════════════════
# Stage 1: Build de la aplicación
# ═══════════════════════════════════════════
FROM python:3.12-slim AS builder
WORKDIR /app

# Instalar PyInstaller
RUN pip install --no-cache-dir pyinstaller

# Copiar fuentes
COPY . .

# Compilar a binario
RUN pyinstaller --onefile --clean main.py

# ═══════════════════════════════════════════
# Stage 2: Producción — solo el binario
# ═══════════════════════════════════════════
FROM alpine:3.19
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app
COPY --from=builder /app/dist/main /app/main
RUN chmod +x /app/main

USER appuser

CMD ["/app/main"]
```

### Ejemplo real: aplicación Go con cross-compilation

```dockerfile
# ═══════════════════════════════════════════
# Stage 1: Compilar
# ═══════════════════════════════════════════
FROM golang:1.22-alpine AS builder
WORKDIR /app

# Instalar dependencias de build
RUN apk add --no-cache git ca-certificates tzdata

# Copiar y descargar dependencias
COPY go.mod go.sum ./
RUN go mod download

# Copiar todo el código
COPY . .

# Compilar de forma estática
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o /app/server .

# ═══════════════════════════════════════════
# Stage 2: Producción — imagen super pequeña
# ═══════════════════════════════════════════
FROM scratch
# scratch es la imagen más pequeña posible: 0 MB

WORKDIR /app
COPY --from=builder /app/server /server
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo

EXPOSE 8080

CMD ["/server"]
```

```
💡 Con FROM scratch, la imagen Go contiene:
  - El binario compilado estáticamente (sin dependencias)
  - Certificados CA (para HTTPS)
  - Zoneinfo (para manejo de zonas horarias)

Tamaño final: ~10-15 MB
```

## Optimización de imágenes

### Estrategias para imágenes más pequeñas

#### 1. Elegir la imagen base correcta

```
Tamaño de imágenes base populares:
┌──────────────────────────────────┬──────────────┐
│  Imagen base                     │  Tamaño      │
├──────────────────────────────────┼──────────────┤
│  alpine:3.19                     │  ~5 MB       │
│  scratch                         │  0 MB        │
│  distroless                      │  ~2-4 MB     │
│  busybox                         │  ~1.5 MB     │
│  debian:bookworm-slim            │  ~70 MB      │
│  ubuntu:22.04                    │  ~77 MB      │
│  node:20-alpine                  │  ~170 MB     │
│  node:20                         │  ~950 MB     │
│  python:3.12-slim                │  ~130 MB     │
│  golang:1.22-alpine              │  ~400 MB     │
└──────────────────────────────────┴──────────────┘
```

#### 2. Usar `.dockerignore`

```bash
# .dockerignore — EXCLUSO archivos del contexto de build
node_modules
.git
.gitignore
*.md
.env
.env.*
*.log
*.swp
*.swo
*~
.vscode
.idea
dist
build
.next
.nuxt
coverage
.nyc_output
.DS_Store
thunder-collection.json
src/**/*.test.ts
src/**/*.spec.ts
```

```
Con .dockerignore:
  Contexto de build: 150 MB → 3 MB (50x más pequeño)
  
Sin .dockerignore:
  node_modules/ se copia al contexto de build
  Cada cambio en node_modules invalida el caché de COPY
  Build se vuelve increíblemente lento
```

#### 3. Combinar RUN con && y &&

```dockerfile
# ❌ Malo: 5 capas
RUN apt-get update
RUN apt-get install -y curl
RUN apt-get install -y wget
RUN apt-get install -y git
RUN rm -rf /var/lib/apt/lists/*

# ✅ Bueno: 1 capa (limpieza incluida)
RUN apt-get update && apt-get install -y \
    curl wget git && \
    rm -rf /var/lib/apt/lists/*
```

#### 4. Eliminar archivos temporales en la misma capa

```dockerfile
# ❌ Malo: los archivos temporales permanecen en la capa
RUN wget http://ejemplo.com/archivo-grande.tar.gz
RUN tar -xzf archivo-grande.tar.gz
RUN rm archivo-grande.tar.gz
# Los 3 RUN = 3 capas. Los 100 MB del .tar.gz están en las 3 capas.

# ✅ Bueno: todo en un RUN, el tar.gz no queda en la imagen final
RUN wget http://ejemplo.com/archivo-grande.tar.gz && \
    tar -xzf archivo-grande.tar.gz && \
    rm archivo-grande.tar.gz
# 1 sola capa. El archivo tar.gz fue descargado, extraído y eliminado
# en la misma capa.
```

#### 5. Usar `--no-cache-dir` con pip

```dockerfile
# ❌ Malo: caché de pip queda en la imagen
RUN pip install requests flask

# ✅ Bueno: limpia el caché de pip
RUN pip install --no-cache-dir requests flask

# Para npm también:
RUN npm ci --only=production && npm cache clean --force
```

#### 6. Usar Distroless (Google)

```dockerfile
# Google Distroless: imágenes sin shell, sin package manager, SO mínimo
# Solo contienen tu app y sus dependencias de runtime

# Node.js sin shell, sin bash, sin package manager
FROM gcr.io/distroless/nodejs20-debian12
COPY server.js /
CMD ["/server.js"]
# Tamaño: ~100 MB vs ~170 MB de node:20-alpine
# Seguridad: superficie de ataque mínima (no hay bash, ni apt, ni user add)
```

#### 7. Usar BuildKit (optimización automática)

```bash
# BuildKit habilitado por defecto en Docker 23.0+
# Forzar BuildKit:
export DOCKER_BUILDKIT=1

# Con BuildKit puedes usar:
# - mount=type=cache para caché de dependencias
# - secret para credenciales seguras en build time
# - ssh para clonar repos privados

# Ejemplo: caché de npm
# syntax=docker/dockerfile:1
FROM node:20-alpine
RUN --mount=type=cache,target=/root/.npm npm ci
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
```

## Etiquetado semántico de imágenes

```
Versionado de imágenes Docker:

┌─────────────────────────────────────────────────────┐
│  Semver para Docker                                 │
│                                                     │
│  mi-app:1.2.3       ← Versión exacta (recomendado)  │
│  mi-app:1.2         ← Última 1.2.x                  │
│  mi-app:1           ← Última 1.x.x                  │
│  mi-app:latest      ← Última versión (NO para prod) │
│                                                     │
│  git commit short   ← mi-app:abc123                 │
│  git tag            ← mi-app:v2.1.0                 │
│  git branch         ← mi-app:main                   │
└─────────────────────────────────────────────────────┘
```

```bash
# Construir con etiqueta de versión
docker build -t mi-app:1.2.3 .

# Construir con SHA del commit
docker build -t mi-app:$(git rev-parse --short HEAD) .

# Construir con tag y latest (para fácil referencia)
docker build -t mi-app:1.2.3 -t mi-app:latest .

# ⚠️ Advertencia sobre "latest"
# "latest" no significa "más reciente". Significa "la última que etiqueté como latest".
# Puede apuntar a una versión antigua si no la actualizaste.

# Para producción, SIEMPRE usa versión específica:
docker run mi-app:1.2.3        # ✅ Reproducible
docker run mi-app:latest       # ❌ No determinista
```

## Registro de imágenes

### Autenticación

```bash
# Iniciar sesión en Docker Hub
docker login

# Iniciar sesión en un registry privado
docker login registry.gitlab.com
docker login gcr.io
docker login 123456789.dkr.ecr.us-east-1.amazonaws.com

# Push de imagen a registry
docker tag mi-app:1.2.3 registry.gitlab.com/mi-usuario/mi-app:1.2.3
docker push registry.gitlab.com/mi-usuario/mi-app:1.2.3
```

### Políticas de imágenes

```yaml
# Políticas recomendadas para imágenes en producción:

# 1. Imágenes oficiales siempre que sea posible
✅ FROM nginx:1.25-alpine
❌ FROM myuser/nginx:1.25

# 2. Versiones específicas, no "latest"
✅ FROM node:20.11.0-alpine
❌ FROM node:latest

# 3. Scaneo de vulnerabilidades (Clair, Trivy, Grype)
docker scan mi-app:1.2.3

# 4. Firmar imágenes (Cosign, Notary)
cosign sign registry.example.com/mi-app:1.2.3

# 5. Limitar tamaño máximo en el registry
# Configurar en registry para rechazar imágenes > 1 GB
```

## Debugging de imágenes

```bash
# Ver el historial de una imagen (qué capas contiene)
docker history mi-app:1.2.3

# Ver capas detalladas
docker history mi-app:1.2.3 --no-trunc

# Ejecutar un contenedor y entrar en modo shell
docker run -it --entrypoint sh mi-app:1.2.3

# Ejecutar un solo comando en la imagen
docker run --rm mi-app:1.2.3 cat /etc/os-release
docker run --rm mi-app:1.2.3 node --version

# Escanear vulnerabilidades
docker scan mi-app:1.2.3

# Inspeccionar metadatos
docker inspect mi-app:1.2.3

# Ver variables de entorno de la imagen
docker run --rm mi-app:1.2.3 env

# Contar capas
docker history mi-app:1.2.3 | wc -l
```

## Resumen

- **Imágenes** son plantillas de solo lectura construidas en capas
- **Dockerfile** define las capas: FROM, COPY, RUN, CMD, etc.
- **El orden importa**: archivos menos cambiantes primero para aprovechar el caché
- **Multi-stage builds** reducen imágenes de GBs a MBs separando build de producción
- **Optimización**: .dockerignore, combinar RUN, limpiar caché, usar Alpine/Distroless
- **Etiquetado semántico**: versiona imágenes (1.2.3) nunca uses latest para producción
- **Registro**: push a Docker Hub, GHCR, GCR, ECR, o registry privado
- **Debug**: docker history, docker run --rm, docker inspect para diagnosticar problemas

> [!quote] La clave
> Las imágenes Docker más importantes no son las que corren más rápido (aunque eso importa), sino las que son **deterministas y reproducibles**. Una imagen con etiqueta de versión fija, construida con multi-stage y limpiada con .dockerignore, es la base de un pipeline de despliegue confiable.

## Conexión con el resto de la wiki

| Concepto tocado | Artículo en profundidad |
|-----------------|------------------------|
| Introducción a Docker | [[02-infra-contenedores/01-docker-intro]] |
| Gestión de contenedores | [[02-infra-contenedores/03-docker-containers]] |
| Docker Compose | [[02-infra-contenedores/04-docker-compose]] |
| Volúmenes Docker | [[02-infra-contenedores/06-docker-volumes]] |
