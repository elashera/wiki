---
title: "Docker Compose: orquestación de aplicaciones multi-contenedor con docker-compose.yml"
description: "Guía completa de Docker Compose: archivos compose, servicios, networks, volumes, secrets, profiles, variables, multi-stage builds, y patrones de aplicación multi-contenedor."
---

# Docker Compose: orquestación de aplicaciones multi-contenedor con docker-compose.yml

> [!tip] Docker Compose en una frase
> Docker Compose es **una herramienta para definir y ejecutar aplicaciones Docker multi-contenedor** con un solo archivo YAML (`docker-compose.yml`). Un comando levanta toda tu stack de aplicaciones: base de datos, API, caché, frontend y más.

## ¿Qué es Docker Compose?

Docker Compose es una herramienta CLI que te permite definir aplicaciones completas con múltiples contenedores, redes y volúmenes en un solo archivo. En lugar de ejecutar comandos `docker run` individuales, defines tu stack completa y Compose la gestiona.

### Sin Compose vs Con Compose

```
SIN DOCKER COMPOSE (comando por comando):

docker network create my-app-net
docker volume create pg-data
docker volume create redis-data

docker run -d \
  --name postgres \
  --network my-app-net \
  --memory=1g \
  -e POSTGRES_PASSWORD=secret \
  -v pg-data:/var/lib/postgresql/data \
  postgres:16

docker run -d \
  --name redis \
  --network my-app-net \
  --memory=256m \
  redis:7-alpine

docker run -d \
  --name api \
  --network my-app-net \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://user:secret@postgres:5432/db \
  -e REDIS_URL=redis://redis:6379 \
  my-app:latest

docker run -d \
  --name frontend \
  --network my-app-net \
  -p 80:80 \
  my-frontend:latest

# Para detener todo:
docker stop frontend api redis postgres
docker rm frontend api redis postgres
docker network rm my-app-net
docker volume rm pg-data redis-data


CON DOCKER COMPOSE (un solo archivo):

# docker-compose.yml:
services:
  postgres:
    image: postgres:16
    volumes: [pg-data:/var/lib/postgresql/data]
    environment:
      POSTGRES_PASSWORD: secret

  redis:
    image: redis:7-alpine

  api:
    image: my-app:latest
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgresql://user:secret@postgres:5432/db
      REDIS_URL: redis://redis:6379

  frontend:
    image: my-frontend:latest
    ports: ["80:80"]

volumes:
  pg-data:

# Un solo comando:
docker compose up -d    # Levanta TODO
docker compose down     # Detiene y elimina TODO
```

## Estructura del archivo docker-compose.yml

### Sintaxis v3 vs v3.9 vs v2 vs v1

```yaml
# Versión del archivo (Opcional en Compose 2.x+)
# Compose ahora usa un sistema de versionado auto-detectado
# Pero para compatibilidad con Docker Swarm:
version: "3.9"
```

### Sintaxis básica completa

```yaml
# docker-compose.yml completo

services:
  postgres:
    image: postgres:16-alpine
    container_name: my-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: appuser
      POSTGRES_PASSWORD: secretpassword
      POSTGRES_DB: appdb
    ports:
      - "5432:5432"
    volumes:
      - pg-data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - backend
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U appuser"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 1G
        reservations:
          cpus: "0.25"
          memory: 256M

  redis:
    image: redis:7-alpine
    container_name: my-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 256mb
    volumes:
      - redis-data:/data
    networks:
      - backend

  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
      args:
        NODE_ENV: production
    image: my-api:latest
    container_name: my-api
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://appuser:secretpassword@postgres:5432/appdb
      REDIS_URL: redis://redis:6379
      NODE_ENV: production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    networks:
      - backend
      - frontend
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 2G

  frontend:
    build: ./frontend
    container_name: my-frontend
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - api
    networks:
      - frontend
    deploy:
      replicas: 3

volumes:
  pg-data:
    driver: local
  redis-data:

networks:
  backend:
    driver: bridge
  frontend:
    driver: bridge
```

## Secciones principales de docker-compose.yml

### 1. services: definir contenedores

```yaml
# Cada servicio = un contenedor

services:
  web:
    image: nginx:latest
    # Todos los flags de docker run van aquí:
    container_name: web-server    # --name
    restart: always               # --restart
    ports:                        # -p
      - "8080:80"
    volumes:                      # -v
      - ./html:/usr/share/nginx/html
    environment:                  # -e
      NGINX_HOST: example.com
    networks:                     # --network
      - mynet
    depends_on:                   # --links (súper poder)
      - api
```

### 2. build: construir imágenes

```yaml
# Build desde un Dockerfile en un directorio
services:
  api:
    build: .

  # Con Dockerfile específico
  api:
    build:
      context: .
      dockerfile: Dockerfile.api

  # Con argumentos de build
  api:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        NODE_ENV: production
        API_KEY: mykey123
      target: production    # Multi-stage build

  # Build sin imagen (no se guarda como imagen)
  api:
    build: .
    # Sin image: el contenedor se construye desde el Dockerfile
    # pero no se guarda como imagen etiquetada

  # Construcción con cache
  api:
    build:
      context: .
      cache_from:
        - my-app:latest
        - my-app:previous
```

### 3. image: usar imágenes de registro

```yaml
# Imagen de Docker Hub
image: nginx:latest
image: postgres:16-alpine

# Imagen de un registry privado
image: registry.example.com/my-app:1.2.3

# Sin image y con build: Compose no guarda la imagen
services:
  api:
    build: .
    # No se necesita "image:" si se usa build
    # Pero es buena práctica definir ambas:
    image: my-api:latest
    build: .
```

### 4. ports: exponer puertos

```yaml
# Puertos: host:contenedor
ports:
  - "80:80"              # Puerto único
  - "8080:80"            # Puertos diferentes
  - "3000-3010:3000"     # Rango (no recomendado)

# Con IP (solo accesible desde localhost)
ports:
  - "127.0.0.1:8080:80"

# Con protocolo especificado
ports:
  - "80:80/tcp"
  - "53:53/udp"

# Publicar solo en un host
ports:
  - mode: host
    target: 80
    published: "8080"
    protocol: tcp
```

### 5. volumes: persistencia de datos

```yaml
# Volúmenes nombrados (gestión de Docker)
volumes:
  - pg-data:/var/lib/postgresql/data    # Volumen nombrado
  - redis-data:/data

# Bind mounts (carpetas locales)
volumes:
  - ./src:/app/src                       # Código fuente
  - ./config/nginx.conf:/etc/nginx/nginx.conf:ro
  - /var/log/myapp:/logs

# Volúmenes temporales (tmpfs)
volumes:
  - type: tmpfs
    target: /tmp
    tmpfs:
      size: 100M

# Volúmenes nombrados en la sección superior
volumes:
  pg-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/data/postgres
  redis-data:
    driver: local
```

### 6. networks: conectar servicios

```yaml
# Definir redes
networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true          # Sin acceso a internet

# Conectar servicios a redes
services:
  nginx:
    networks:
      - frontend

  api:
    networks:
      - frontend
      - backend

  postgres:
    networks:
      - backend

  # Servicio interno (no expuesto al frontend)
  worker:
    networks:
      - backend
```

### 7. environment: variables de entorno

```yaml
# Array de strings
environment:
  - DATABASE_URL=postgresql://user:pass@db:5432/db
  - REDIS_URL=redis://cache:6379

# Mapeo clave-valor
environment:
  DATABASE_URL: postgresql://user:pass@db:5432/db
  REDIS_URL: redis://cache:6379

# Desde un archivo .env
env_file:
  - .env
  - .env.production

# Combinar env_file y environment (el environment sobrescribe)
env_file:
  - .env
environment:
  NODE_ENV: production      # Sobrescribe .env si existe
```

### 8. depends_on: orden de inicio

```yaml
# Depende de que el servicio esté corriendo
depends_on:
  - postgres
  - redis

# Con condiciones (dependencias avanzadas)
depends_on:
  postgres:
    condition: service_healthy      # Espera health check
  redis:
    condition: service_started      # Espera solo que inicie
  minio:
    condition: service_completed_exit_cleanly   # Espera que termine

# Sin condition (solo que el servicio esté UP)
depends_on:
  - db
  - cache

# Versión corta (solo que estén corriendo)
depends_on:
  - db
  - cache
```

### 9. restart: políticas de reinicio

```yaml
restart: always              # Siempre reiniciar (incluye errores manuales)
restart: unless-stopped      # Reiniciar a menos que se detuvo manualmente
restart: on-failure:5        # Reiniciar solo en fallo (máximo 5 intentos)
restart: no                  # No reiniciar (default)
```

### 10. deploy: recursos (Swarm mode)

```yaml
deploy:
  replicas: 3                     # Número de replicas
  restart_policy:
    condition: on-failure
    delay: 5s
    max_attempts: 3
    window: 120s
  rollback_config:
    parallelism: 1                # Uno a uno
    delay: 10s
    failure_action: pause
  resources:
    limits:
      cpus: "0.50"
      memory: 256M
    reservations:
      cpus: "0.25"
      memory: 128M
  update_config:
    parallelism: 2                # Actualizar 2 a la vez
    delay: 10s
    failure_action: pause
    monitor: 60s
    order: start-first            # Nuevo antes que viejo

# Sin Swarm mode (solo para compose up):
# Usa deploy con --compatibility flag
```

### 11. secrets: credenciales seguras

```yaml
# Usar archivos como secretos (Compose 3.1+)
services:
  api:
    image: my-api:latest
    secrets:
      - db_password
      - api_key

# Definir secrets (desde archivo)
secrets:
  db_password:
    file: ./secrets/db-password.txt
  api_key:
    file: ./secrets/api-key.txt

# Definir secrets (desde variable de entorno)
secrets:
  db_password:
    environment: DB_PASSWORD

# Desde Docker Swarm
secrets:
  db_password:
    external: true
```

```bash
# Los secretos se montan como archivos en /run/secrets/
# Dentro del contenedor:
# /run/secrets/db_password → contenido del archivo
# /run/secrets/api_key → contenido del archivo

# Leer en la aplicación:
# Python:
with open('/run/secrets/db_password') as f:
    password = f.read().strip()

# Node.js:
const password = require('fs').readFileSync('/run/secrets/db_password', 'utf8').trim();
```

### 12. healthcheck: verificación de salud

```yaml
services:
  api:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      # O con shell:
      # test: ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Para PostgreSQL
  postgres:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U appuser"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Para Redis
  redis:
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3
```

### 13. logging: gestión de logs

```yaml
services:
  api:
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
        tag: "api"

  # Usar syslog para centralización
  api:
    logging:
      driver: syslog
      options:
        syslog-address: "tcp://log-server:5514"
        tag: "myapp"

  # Usar journald
  api:
    logging:
      driver: journald
```

### 14. profiles: servicios opcionales

```yaml
# Servicios que se activan con --profile
services:
  api:
    image: my-api:latest
    ports: ["3000:3000"]

  admin-panel:
    image: admin-panel:latest
    profiles: ["admin"]      # Solo con docker compose --profile admin up

  monitoring:
    image: grafana:latest
    profiles: ["monitoring"]  # Solo con docker compose --profile monitoring up

  # Sin profile = siempre activo
  postgres:
    image: postgres:16

# Ejecutar:
docker compose up -d                          # Solo postgres y api
docker compose --profile admin up -d           # Agrega admin-panel
docker compose --profile monitoring up -d      # Agrega grafana
docker compose --profile admin --profile monitoring up -d  # Todo
```

### 15. extend: reutilizar configuraciones

```yaml
# Usar x- para extender configuraciones reutilizables
x-common-variables: &common-variables
  NODE_ENV: production
  LOG_LEVEL: info

x-common-deploy: &common-deploy
  restart: unless-stopped
  resources:
    limits:
      cpus: "1.0"
      memory: 512M

services:
  api:
    <<: *common-variables
    <<: *common-deploy
    image: my-api:latest
    ports: ["3000:3000"]

  worker:
    <<: *common-variables
    <<: *common-deploy
    image: my-worker:latest
```

## Variables de entorno en Compose

### Archivos .env

```bash
# .env (no versionar, agregar a .gitignore)
POSTGRES_USER=appuser
POSTGRES_PASSWORD=secreto123
POSTGRES_DB=appdb
API_KEY=mi-clave-secreta
NODE_ENV=production

# docker-compose.yml los lee automáticamente
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
  # Las variables se inyectan automáticamente si existen en el .env
```

### Valores por defecto con ${VAR:-default}

```yaml
environment:
  DATABASE_URL: postgresql://${DB_USER:-appuser}:${DB_PASS:-pass}@postgres:5432/${DB_NAME:-appdb}
  PORT: ${PORT:-3000}
  NODE_ENV: ${NODE_ENV:-development}
  # Si la variable no existe, usa el valor por defecto
```

### Variables de entorno con comillas

```yaml
# Las variables con espacios o caracteres especiales
environment:
  DATABASE_URL: "${DATABASE_URL}"
  API_KEY: "${API_KEY}"

# Mejor aún: usar formato de lista
environment:
  - DATABASE_URL=${DATABASE_URL}
  - API_KEY=${API_KEY}
```

## Patrones de aplicación multi-contenedor

### Patrón 1: LAMP Stack (Linux, Apache, MySQL, PHP)

```yaml
version: "3.9"
services:
  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpass
      MYSQL_DATABASE: myapp
      MYSQL_USER: myuser
      MYSQL_PASSWORD: mypass
    volumes:
      - db-data:/var/lib/mysql
    networks:
      - internal
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  web:
    image: php:8.2-apache
    ports:
      - "80:80"
    volumes:
      - ./html:/var/www/html
    depends_on:
      db:
        condition: service_healthy
    networks:
      - internal
      - external

volumes:
  db-data:

networks:
  internal:
    driver: bridge
  external:
    driver: bridge
```

### Patrón 2: MERN Stack (Mongo, Express, React, Node)

```yaml
version: "3.9"
services:
  mongo:
    image: mongo:7
    volumes:
      - mongo-data:/data/db
    networks:
      - backend

  api:
    build: ./api
    environment:
      - MONGO_URI=mongodb://mongo:27017/myapp
      - PORT=4000
    ports:
      - "4000:4000"
    depends_on:
      - mongo
    networks:
      - backend

  web:
    build: ./web
    environment:
      - REACT_APP_API_URL=http://localhost:4000
    ports:
      - "3000:3000"
    depends_on:
      - api
    networks:
      - backend

volumes:
  mongo-data:

networks:
  backend:
    driver: bridge
```

### Patrón 3: Microservicios con Nginx

```yaml
version: "3.9"
services:
  # Load balancer
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
    depends_on:
      - users-service
      - orders-service
      - payments-service
    networks:
      - frontend
      - backend

  # Microservicios
  users-service:
    build: ./services/users
    environment:
      - PORT=3001
      - DB_HOST=postgres
    networks:
      - backend

  orders-service:
    build: ./services/orders
    environment:
      - PORT=3002
      - DB_HOST=postgres
      - MQ_URL=amqp://rabbitmq
    networks:
      - backend

  payments-service:
    build: ./services/payments
    environment:
      - PORT=3003
      - DB_HOST=postgres
      - MQ_URL=amqp://rabbitmq
    networks:
      - backend

  # Infraestructura
  postgres:
    image: postgres:16
    environment:
      - POSTGRES_PASSWORD=secret
    volumes:
      - pg-data:/var/lib/postgresql/data
    networks:
      - backend

  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"
      - "15672:15672"
    networks:
      - backend

volumes:
  pg-data:

networks:
  frontend:
  backend:
```

```nginx
# ./nginx/conf.d/default.conf

upstream users_service {
    server users-service:3001;
}

upstream orders_service {
    server orders-service:3002;
}

upstream payments_service {
    server payments-service:3003;
}

server {
    listen 80;

    location /api/users/ {
        proxy_pass http://users_service/;
    }

    location /api/orders/ {
        proxy_pass http://orders_service/;
    }

    location /api/payments/ {
        proxy_pass http://payments_service/;
    }
}
```

### Patrón 4: Desarrollo con hot-reload

```yaml
version: "3.9"
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.dev  # Dockerfile diferente para dev
    volumes:
      - ./src:/app/src              # Código montado directamente
      - /app/node_modules           # Evita exponer node_modules
    environment:
      - NODE_ENV=development
      - WATCHPACK_POLLING=true       # Para hot-reload
    ports:
      - "3000:3000"
    command: npm run dev

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    volumes:
      - ./frontend/src:/app/src
      - /app/node_modules
    environment:
      - CHOKIDAR_USEPOLLING=true    # Para hot-reload
    ports:
      - "3001:3000"
    command: npm run dev

  db:
    image: postgres:16
    environment:
      - POSTGRES_PASSWORD=devpass
    volumes:
      - pg-dev-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"                  # Para conexión directa en desarrollo

volumes:
  pg-dev-data:
```

```dockerfile
# Dockerfile.dev (solo para desarrollo)
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Sin CMD — el docker-compose.yml especifica el comando
```

## Comandos docker compose

```bash
# Levantar todos los servicios
docker compose up

# Levantar en segundo plano
docker compose up -d

# Levantar un servicio específico
docker compose up -d api

# Levantar con construcción
docker compose up -d --build

# Detener todos los servicios (mantener contenedores)
docker compose stop

# Detener y eliminar contenedores
docker compose down

# Detener, eliminar contenedores y volúmenes
docker compose down -v

# Detener, eliminar contenedores, volúmenes y redes
docker compose down -v --remove-orphans

# Ver estado de servicios
docker compose ps

# Ver logs de todos los servicios
docker compose logs

# Ver logs de un servicio específico
docker compose logs api
docker compose logs -f api         # Follow mode

# Ejecutar comando en un servicio
docker compose exec api sh
docker compose exec api npm test

# Escalar un servicio (Swarm mode)
docker compose up -d --scale api=5

# Reconstruir y levantar
docker compose up -d --build --force-recreate

# Verificar que el archivo es válido
docker compose config

# Convertir compose file a YAML válido
docker compose config --services     # Lista de servicios
docker compose config --volumes      # Lista de volúmenes
docker compose config --nets         # Lista de redes
```

## Perfiles y entornos

### Múltiples archivos Compose

```bash
# docker-compose.yml (base)
# docker-compose.prod.yml (producción)
# docker-compose.dev.yml (desarrollo)

# Combinar archivos:
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# O con alias en .env
# .env:
# COMPOSE_PROJECT_NAME=myapp

# Archivos de entorno por ambiente
# .env.development
# .env.production
# .env.staging

# Usar docker compose con diferentes archivos:
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

```yaml
# docker-compose.dev.yml (extend base)
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - ./src:/app/src
    environment:
      - NODE_ENV=development

  db:
    ports:
      - "5432:5432"  # Acceso directo en desarrollo
```

```yaml
# docker-compose.prod.yml (extend base)
services:
  api:
    image: my-api:1.2.3    # Imagen específica, no build
    restart: always
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: "2.0"
          memory: 2G

  db:
    ports: []               # No exponer al host
```

## Buenas prácticas

### 1. Usar volúmenes nombrados para datos

```yaml
# ✅ Bueno: volúmenes nombrados
volumes:
  - pg-data:/var/lib/postgresql/data

# ❌ Malo: bind mount para datos de producción
volumes:
  - ./data:/var/lib/postgresql/data
```

### 2. No versionar credenciales

```yaml
# ❌ Malo: credenciales hardcodeadas
environment:
  DATABASE_PASSWORD: mi-super-secreto

# ✅ Bueno: variables de entorno
environment:
  DATABASE_PASSWORD: ${DB_PASSWORD}
```

### 3. Versionar imágenes

```yaml
# ❌ Malo
image: nginx

# ✅ Bueno
image: nginx:1.25.3-alpine
```

### 4. Health checks para servicios críticos

```yaml
services:
  postgres:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
```

### 5. Usar networks internas para servicios que no necesitan internet

```yaml
networks:
  backend:
    internal: true     # Sin acceso a internet
```

## Debugging con Compose

```bash
# Ver todo el stack
docker compose ps -a

# Logs de un servicio específico
docker compose logs -f --tail=100 api

# Entrar a un contenedor
docker compose exec api sh
docker compose exec db psql -U appuser

# Ver red y conectividad
docker compose exec api ping db
docker compose exec api curl http://db:5432

# Inspeccionar red de compose
docker network ls
docker network inspect myapp_backend

# Reconstruir todo
docker compose down -v
docker compose up -d --build

# Verificar configuración
docker compose config
docker compose config --services

# Ver dependencias
docker compose depends-on api
```

## Resumen

- **Docker Compose** define aplicaciones multi-contenedor con un solo YAML
- **Services** = contenedores, cada uno con su configuración
- **Volumes** gestionan persistencia de datos entre reinicios
- **Networks** conectan servicios entre sí con DNS automático
- **depends_on** controla el orden de inicio
- **Health checks** aseguran que dependencias estén listas
- **Multi-file** permite entornos diferentes (dev, prod, staging)
- **Profiles** activan servicios opcionales bajo demanda
- **Secrets** manejan credenciales de forma segura

> [!quote] La clave
> Docker Compose es el puente entre la experiencia de desarrollo local y la orquestación de producción. Un archivo `docker-compose.yml` bien escrito es la documentación viviente de tu aplicación: cualquiera puede leerlo, entender la arquitectura, y levantarla con un solo comando.

## Conexión con el resto de la wiki

| Concepto tocado | Artículo en profundidad |
|-----------------|------------------------|
| Introducción a Docker | [[02-infra-contenedores/01-docker-intro]] |
| Imágenes Docker | [[02-infra-contenedores/02-docker-images]] |
| Contenedores | [[02-infra-contenedores/03-docker-containers]] |
| Networking Docker | [[02-infra-contenedores/05-docker-networking]] |
| Volúmenes Docker | [[02-infra-contenedores/06-docker-volumes]] |
