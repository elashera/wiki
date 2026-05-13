# 02-04 — Docker Compose: Multi-Container Orchestration for Development and Staging

> [!info] About This Article
> This article covers Docker Compose from the ground up: what it is, why it exists, how docker-compose.yml works, services, networks, volumes, environment variables, health checks, and best practices. It assumes you understand basic Docker concepts (covered in article 01) and builds understanding progressively.

## Why Docker Compose Exists: The Multi-Container Problem

Before understanding Docker Compose, consider this scenario. You are building a web application. It needs three components:

1. **A web server** (Nginx) serving your frontend
2. **An application server** (Node.js/Python/Go) running your API
3. **A database** (PostgreSQL/MySQL) storing your data

Without Docker Compose, you would need to:

```bash
# Step 1: Start the database
docker run -d --name mydb -e POSTGRES_PASSWORD=secret postgres:16

# Step 2: Wait for the database to be ready... (how long? 5 seconds? 30?)
# Step 3: Start the application, pointing to the database
docker run -d --name myapp --link mydb -e DB_HOST=mydb myapp:latest

# Step 4: Start the web server, pointing to the application
docker run -d --name myweb -p 80:80 --link myapp myweb:latest
```

This works, but it is fragile. What if the database takes 30 seconds to initialize and your app crashes on startup? What if you need to recreate all three services? What if you want to scale the application to 3 replicas while keeping the database as a single instance? What if your colleague clones your repo and needs to run all three services with the correct configuration?

Docker Compose solves this by letting you **define the entire multi-container application in a single YAML file** and then **create or destroy all services with a single command**.

> [!example] Analogy
> Imagine you have a recipe for a complex dish. Without Docker Compose, you have to remember every step: "First boil the water, then add the pasta, then start the sauce..." With Docker Compose, you write the recipe once and say "execute recipe" — it does everything in the right order, with the right timing, every time.

Docker Compose was originally written by a company called Orchard Labs, which was acquired by Docker Inc. in 2014. The original codebase was called `fig`, and it was renamed to Docker Compose. In 2020, Docker announced that Compose V2 (written in Go, integrated into the Docker CLI) would replace Compose V1 (written in Python, installed separately). Compose V2 is now the default when you install Docker Desktop or Docker Engine.

## Understanding docker-compose.yml

The heart of Docker Compose is the `docker-compose.yml` file (or `compose.yaml`). It is a YAML file that declaratively describes your multi-container application.

> [!info] YAML Basics for Compose
> YAML (YAML Ain't Markup Language) is a human-readable data serialization format. In Compose:
> - Indentation matters: 2 spaces per level
> - Lists use `- ` prefix
> - Key-value pairs use `key: value` format
> - Strings can be quoted or unquoted (unquoted is preferred unless the value contains special characters)
> - `true/false` are booleans, not strings
> - Numbers are integers (no quotes), unless they represent IDs or versions

### The Top-Level Structure

A Compose file has three top-level sections:

```yaml
version: "3.9"          # Compose file format version (optional in V2)

services:               # Define your containers
  web:
    image: nginx:latest
    ports:
      - "8080:80"
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: secret

volumes:                # Define named volumes
  postgres_data:

networks:               # Define custom networks
  app_network:
```

> [!warning] Version Field
> In Compose V2 (integrated into Docker CLI), the `version` field is **optional** and primarily for documentation. Docker automatically uses the newest Compose specification supported by your Docker Engine. When you run `docker compose` (V2), the version field is ignored. When you run `docker-compose` (V1, deprecated), it affects feature availability. Always use `docker compose` (two words).

## Services: The Core Building Block

A service is a container that runs as part of your application. In Compose, each service definition describes one or more containers running the same image.

### Service Definition Structure

```yaml
services:
  web:                          # Service name (also becomes the container name prefix)
    image: nginx:1.25-alpine    # Docker image to use
    container_name: my-web      # Optional: explicit container name
    ports:                      # Port mappings
      - "8080:80"
      - "443:443"
    environment:                # Environment variables
      - NODE_ENV=production
      - DB_HOST=db
    env_file:                   # Load from file
      - .env
    volumes:                    # Mount volumes
      - ./html:/usr/share/nginx/html
      - logs:/var/log/nginx
    depends_on:                 # Dependency on other services
      - api
    networks:                   # Connect to networks
      - frontend
    restart: unless-stopped     # Restart policy
    deploy:                     # Deployment config (for Swarm mode)
      replicas: 3
      resources:
        limits:
          cpus: "0.5"
          memory: 256M
    healthcheck:                # Health check
      test: ["CMD", "curl", "-f", "http://localhost"]
      interval: 30s
      timeout: 10s
      retries: 3
    logging:                    # Log configuration
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  api:
    build:                      # Build from Dockerfile
      context: .
      dockerfile: Dockerfile.api
      args:
        NODE_ENV: production
    image: myapp/api:latest
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/myapp
    volumes:
      - ./src:/app/src
    networks:
      - frontend
      - backend
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: myapp
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - backend
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d myapp"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    networks:
      - backend

volumes:
  postgres_data:
  redis_data:

networks:
  frontend:
  backend:
```

### Key Service Fields Explained

#### `image` vs `build`

Every service needs either an `image` or a `build` (or both):

```yaml
# Use a pre-built image from a registry
services:
  nginx:
    image: nginx:1.25-alpine

# Build from a Dockerfile
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.api
      target: production          # Multi-stage build target
      args:
        NODE_ENV: production
      cache_from:
        - myapp/api:latest        # Use this image as build cache

# Both: build first, then tag as an image
services:
  api:
    build: .
    image: myapp/api:latest
```

> [!tip] When to Use `build` vs `image`
> - Use `build` for development: you modify code frequently and want automatic rebuilds
> - Use `image` for production: you pull a specific, tested image from a registry
> - Use both (build + image tag) when you want to build locally but also tag the result for CI/CD

#### `depends_on`: Service Ordering and Readiness

`depends_on` controls startup order, but by default it only waits for the service to start, **not for it to be ready**.

```yaml
# Basic depends_on: waits for the container to start
services:
  web:
    depends_on:
      - db
      - redis

# Advanced depends_on: waits for health check to pass
services:
  web:
    depends_on:
      db:
        condition: service_healthy    # Wait for db healthcheck to pass
      redis:
        condition: service_started    # Just wait for redis to start (default)
```

> [!warning] Common Mistake: depends_on Does Not Wait for Readiness
> The default `depends_on` behavior is to wait for the container to start (the process is running), NOT for the application inside to be ready. PostgreSQL might report "started" but take 10 more seconds to accept connections. This is why health checks are essential:

```yaml
# Always pair depends_on with healthchecks
services:
  web:
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $POSTGRES_USER -d $POSTGRES_DB"]
      interval: 5s
      timeout: 3s
      retries: 5
```

#### `restart` Policies

| Policy | Behavior | When to Use |
|--------|----------|-------------|
| `no` (default) | Never restart | One-off tasks, batch jobs |
| `always` | Always restart, even on `docker compose stop` | Production services |
| `unless-stopped` | Always restart except when manually stopped | Most production services |
| `on-failure[:max-retries]` | Restart only if exit code is non-zero | Services that might crash temporarily |

```yaml
services:
  # Restart unless explicitly stopped (recommended for most services)
  web:
    restart: unless-stopped

  # Restart up to 5 times if it crashes
  worker:
    restart: on-failure:5

  # Never restart (one-off task)
  migration:
    restart: "no"
```

## Networks in Compose

By default, Docker Compose creates a single network for all services in a compose file. All services can reach each other by service name (DNS resolution is automatic).

```yaml
services:
  web:
    image: nginx
    # Can reach 'db' at 'db:5432' automatically
  db:
    image: postgres

# Both services are on the same network: compose_default
# web can reach db via DNS: db:5432
# db can reach web via DNS: web:80
```

### Custom Networks for Isolation

When you have multiple compose files or want to segment services, define custom networks:

```yaml
services:
  web:
    networks:
      - frontend      # Public-facing

  api:
    networks:
      - frontend      # Receives traffic from web
      - backend       # Connects to internal services

  db:
    networks:
      - backend       # Internal only, not accessible from web

  redis:
    networks:
      - backend

networks:
  frontend:           # Public-facing network
    driver: bridge
  backend:            # Private network (no external access by default)
    driver: bridge
    internal: true    # No external network access at all
```

> [!info] How DNS Resolution Works in Compose
> When you define a service named `db`, Docker Compose automatically registers it in an embedded DNS server at `127.0.0.11` (Docker's internal DNS). Any service on the same network can resolve `db` to the container's IP address. This is how `--link` (deprecated) used to work, but now it is built-in and automatic.

> [!tip] Network Aliases
> You can give a service multiple DNS names within a network:

```yaml
services:
  db:
    image: postgres:16
    networks:
      default:
        aliases:
          - database
          - primary-db

# Now other services can reach this container as 'db', 'database', or 'primary-db'
```

## Volumes in Compose

Volumes persist data beyond the lifecycle of a single container. In Compose, you define volumes at the top level and reference them in services.

### Volume Types in Compose

```yaml
services:
  # 1. Named volume (Docker-managed)
  db:
    volumes:
      - postgres_data:/var/lib/postgresql/data

  # 2. Bind mount (host directory to container)
  api:
    volumes:
      - ./src:/app/src          # Relative path (from compose file location)
      - /absolute/path:/data    # Absolute path
      - ~/project:/app          # Home directory

  # 3. tmpfs mount (in-memory, not persisted)
  redis:
    volumes:
      - redis_tmp:/data
      type: tmpfs
      tmpfs:
        size: 100M

  # 4. Named volume with options
  app:
    volumes:
      - app_data:/data:ro       # Read-only mount

volumes:
  postgres_data:                # Named volume
  redis_tmp:
    driver: local
    driver_opts:
      type: tmpfs
      o: size=100m
      device: tmpfs
  app_data:
```

> [!warning] Bind Mounts vs Named Volumes
> Use **named volumes** for data that needs to persist (databases, caches). Use **bind mounts** for development (source code that changes frequently). Bind mounts expose the host filesystem to the container, which can cause permission issues (files created as root inside the container are owned by root on the host).

### The `nocopy` Option

By default, when a container starts, Docker copies any data from the image's volume path into the named volume. This is useful for databases that ship with default data (like MongoDB or Elasticsearch). If your container doesn't ship with data, use `nocopy` to skip this copy:

```yaml
services:
  postgres:
    volumes:
      - postgres_data:/var/lib/postgresql/data
      # PostgreSQL doesn't need initial data copied from image

  mongodb:
    volumes:
      - mongodb_data:/data/db
      # MongoDB ships with default data that should be copied on first run

volumes:
  postgres_data:
    nocopy: true        # Skip the copy (PostgreSQL creates its own data)
  mongodb_data:         # Default: copy from image on first run
```

## Environment Variables

Environment variables are how you configure your application at runtime without modifying the image.

### Three Ways to Set Environment Variables

```yaml
services:
  api:
    # 1. Direct inline values
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://user:pass@db:5432/myapp

    # 2. From a file (useful for many variables)
    env_file:
      - .env
      - .env.production     # Multiple files, later overrides earlier

    # 3. Mixed: file + override
    env_file:
      - .env
    environment:
      DATABASE_URL: postgresql://override:pass@db:5432/myapp  # Overrides .env
```

> [!warning] Order of Precedence
> Environment variables are resolved in this order (later overrides earlier):
> 1. `env_file` (multiple files: later file wins)
> 2. `environment:` block in compose file
> 3. Host environment variables (when not explicitly set in compose)

### Variable Interpolation

Compose supports basic variable interpolation using the syntax `${VAR}` or `${VAR:-default}` (use default if VAR is not set):

```yaml
services:
  api:
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASS}@db:5432/${DB_NAME}
      LOG_LEVEL: ${LOG_LEVEL:-info}     # Default to 'info' if not set
      DEBUG: ${DEBUG:-false}

  # This references the service's own port
  web:
    ports:
      - "${WEB_PORT:-8080}:80"
```

> [!tip] .env File Convention
> Docker Compose automatically loads a `.env` file in the same directory as your compose file. This file should contain `KEY=VALUE` pairs (no quotes, no spaces around `=`):

```bash
# .env file
DB_USER=myuser
DB_PASS=secret123
DB_NAME=myapp
POSTGRES_PASSWORD=secret123
REDIS_URL=redis://redis:6379
```

```yaml
# docker-compose.yml
services:
  api:
    environment:
      - DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@db:5432/${DB_NAME}
```

> [!warning] Security: Never Commit Secrets to Version Control
> Your `.env` file typically contains passwords, API keys, and other secrets. Add it to `.gitignore`:

```bash
# .gitignore
.env
.env.local
.env.production
```

> [!example] Docker Compose v2 Interpolation Syntax Change
> In Compose V1, environment variables were referenced as `$VAR` or `${VAR}`. In Compose V2, the syntax is `${VAR}` or `${VAR:-default}`. If you reference a variable that does not exist, Compose V2 inserts an empty string (not an error). To use the old behavior (error on missing variable), use `${?VAR}`:

```yaml
services:
  api:
    environment:
      # If REQUIRED_VAR is not set, Compose inserts empty string
      - MY_VAR=${REQUIRED_VAR}
      # If REQUIRED_VAR is not set, Compose errors
      - MY_VAR=${?REQUIRED_VAR}
      # If OPTIONAL_VAR is not set, use default
      - MY_VAR=${OPTIONAL_VAR:-default_value}
```

## Docker Compose Commands

The `docker compose` command (two words, V2) replaces the old `docker-compose` (one word, V1, deprecated).

### Core Commands

```bash
# Start all services in background (detached mode)
docker compose up -d

# Start all services and show logs
docker compose up

# Start a specific service
docker compose up -d web db

# Stop all services (containers remain, volumes intact)
docker compose stop

# Stop and remove all containers
docker compose down

# Stop and remove containers, networks (but NOT volumes)
docker compose down --volumes

# Remove everything: containers, networks, volumes, images
docker compose down --volumes --rmi all

# View logs from all services
docker compose logs

# View logs from a specific service, with tail
docker compose logs -f --tail=100 web

# Execute a command inside a running container
docker compose exec web ls -la /app

# Execute an interactive shell
docker compose exec -it web /bin/sh

# View running containers
docker compose ps

# Pause/unpause all services
docker compose pause
docker compose unpause

# Pull updated images
docker compose pull

# Rebuild and restart
docker compose up -d --build

# Scale a service to N replicas
docker compose up -d --scale web=5

# Check the effective configuration
docker compose config

# Start/stop a service without recreating
docker compose start web
docker compose stop web
```

### The `-f` Flag: Multiple Compose Files

You can use multiple compose files, with later files overriding earlier ones:

```bash
# Use custom compose file
docker compose -f production.yml up -d

# Use default + override
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d
```

> [!tip] Override Files Convention
> Docker Compose automatically looks for `docker-compose.override.yml` in the same directory as `docker-compose.yml`. If both files exist, Compose merges them. This is useful for development:

```yaml
# docker-compose.yml (base configuration)
services:
  api:
    image: myapp/api:latest
    environment:
      NODE_ENV: production
    volumes:
      - api_data:/data

volumes:
  api_data:
```

```yaml
# docker-compose.override.yml (development overrides)
services:
  api:
    build: .                      # Override image with build
    environment:
      NODE_ENV: development       # Override environment
    volumes:
      - ./src:/app/src            # Bind mount source code for live reload
    ports:
      - "3000:3000"               # Expose for debugging

# Note: api_data volume is preserved (not overridden)
```

## Health Checks

Health checks allow Compose to determine if a service is actually healthy, not just running.

### Health Check Syntax

```yaml
services:
  db:
    image: postgres:16
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $POSTGRES_USER -d $POSTGRES_DB"]
      interval: 10s       # How often to check
      timeout: 5s         # How long to wait for the command
      retries: 5          # How many consecutive failures before unhealthy
      start_period: 30s   # Grace period for startup (no health checks during this time)

  web:
    image: nginx
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Health Check Result States

| State | Meaning |
|-------|---------|
| `starting` | Health check hasn't succeeded yet (during `start_period`) |
| `healthy` | Health check passed (consecutive successes reach threshold) |
| `unhealthy` | Health check failed (consecutive failures reach `retries`) |

### Health Checks in `depends_on`

When you use `depends_on` with `condition: service_healthy`, Compose waits for the dependency to pass its health check before starting the dependent service:

```yaml
services:
  web:
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $POSTGRES_USER -d $POSTGRES_DB"]
      interval: 5s
      timeout: 3s
      retries: 10
```

> [!tip] Health Check Tips
> - Always set a `start_period` for databases and slow-starting services. PostgreSQL might need 10-30 seconds to initialize, and you do not want health checks to fail during this time.
> - Use lightweight health check commands. `curl` adds dependencies; consider `wget --spider` or `pg_isready` instead.
> - Health checks consume resources. Don't check every second — 10-30 seconds is usually sufficient.

## Extending Compose Files

### Using `include` (Compose V2.20+)

The `include` directive allows you to compose multiple files:

```yaml
# docker-compose.yml
services:
  web:
    image: nginx

  api:
    build: .

include:
  - monitoring.yml      # Load monitoring services
  - database.yml        # Load database services
```

### Profiles

Profiles allow you to enable/disable groups of services:

```yaml
services:
  web:
    image: nginx
    profiles: ["web"]

  api:
    build: .
    profiles: ["web", "full"]

  db:
    image: postgres:16
    profiles: ["database", "full"]

  redis:
    image: redis:7
    profiles: ["cache", "full"]

  monitoring:
    image: prom/prometheus
    profiles: ["monitoring"]
```

```bash
# Start only web services
docker compose --profile web up -d

# Start database and cache
docker compose --profile database --profile cache up -d

# Start everything (full profile is pulled in automatically)
docker compose up -d

# List available profiles
docker compose config --profiles
```

> [!tip] Profile Strategy
> Use profiles to separate concerns: `database`, `cache`, `worker`, `monitoring`, `development`. Each developer can start only the services they need.

## Logging Configuration

Control how Docker captures and stores logs:

```yaml
services:
  web:
    image: nginx
    logging:
      driver: json-file           # Default driver
      options:
        max-size: "10m"           # Each log file max 10MB
        max-file: "3"             # Keep 3 rotated files
        compress: "true"          # Compress rotated logs

  # Use journald driver on systemd systems
  api:
    logging:
      driver: journald
      options:
        tag: "myapp/api"

  # Use syslog driver for external log aggregation
  worker:
    logging:
      driver: syslog
      options:
        syslog-address: "tcp://log-server:514"
        tag: "myapp/worker"
```

> [!warning] Log File Growth
> Without `max-size` and `max-file` limits, Docker log files will grow indefinitely and can fill your disk. Always set these options for production services.

## Troubleshooting

### Common Issues and Solutions

#### Issue 1: "port is already allocated"

```bash
# Error: Bind for 0.0.0.0:80 failed: port is already allocated
```

This means another process is using port 80 on your host.

**Solutions:**
```bash
# Find what's using the port
sudo lsof -i :80
# OR
sudo netstat -tlnp | grep :80

# Fix: Use a different host port
# In docker-compose.yml:
ports:
  - "8080:80"    # Host port 8080 → container port 80
```

#### Issue 2: "connection refused" between services

```bash
# Web service cannot connect to API service
# Error: ECONNREFUSED 127.0.0.1:3000
```

**Cause:** The API service has not fully started yet, or DNS resolution is failing.

**Solutions:**
```yaml
# Solution 1: Add depends_on with health check
services:
  web:
    depends_on:
      api:
        condition: service_healthy

  api:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 5s
      timeout: 3s
      retries: 10

# Solution 2: Add retry logic in your application code
# (recommended: always implement retries in the client, not just in Compose)
```

#### Issue 3: Permission denied on bind mounts

```bash
# Error: EACCES: permission denied, open '/app/config.json'
```

**Cause:** The container runs as root, but your host user has different UID. Files created in bind mounts are owned by the UID inside the container.

**Solutions:**
```yaml
# Solution 1: Run as your host user's UID
services:
  api:
    user: "${UID:-1000}:${GID:-1000}"

# Solution 2: Create a non-root user in the Dockerfile
# In Dockerfile:
# RUN adduser --disabled-password --gecos "" appuser
# USER appuser

# Solution 3: Use named volumes instead of bind mounts for data directories
services:
  web:
    volumes:
      - app_data:/app/data       # Named volume, Docker manages ownership
      - ./src:/app/src           # Bind mount only for code (read-only)
```

#### Issue 4: "database not ready"

```bash
# Application crashes because database is not accepting connections yet
```

**Cause:** The database container has started (process is running), but the database server inside is not ready to accept connections.

**Solutions:**
```yaml
# Solution 1: Use health check (recommended)
services:
  web:
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $POSTGRES_USER"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 30s    # Give PostgreSQL time to initialize

# Solution 2: Add a wait script in your application startup
# (also recommended as a defense-in-depth measure)
```

### Debugging Commands

```bash
# View effective configuration (merged files, interpolated variables)
docker compose config

# View logs with timestamps
docker compose logs -t

# Follow logs from all services
docker compose logs -f

# Follow logs from a specific service
docker compose logs -f --tail=50 web

# Execute a command in a specific service
docker compose exec api ls -la /app

# Open an interactive shell
docker compose exec -it api /bin/sh

# Check if a service is healthy
docker compose ps

# Inspect a container
docker inspect <container_name>

# Check network configuration
docker network ls
docker network inspect compose_default

# Check volume mounts
docker volume ls
docker volume inspect compose_postgres_data
```

## Best Practices and Common Pitfalls

### DO: Use Specific Image Tags

```yaml
# GOOD: Pin to specific version
services:
  db:
    image: postgres:16.2-alpine

# BAD: Use floating tag
services:
  db:
    image: postgres:latest
```

> [!warning] Why Not `latest`?
> The `latest` tag is a moving target. Your local `postgres:latest` might be version 16.1, while a colleague's is 16.2. This causes "works on my machine" issues. Pin to a specific version, and even better, use a digest (`postgres:16.2@sha256:...`).

### DO: Use `.env` Files for Configuration

```yaml
# .env file
DB_HOST=db
DB_PORT=5432
DB_NAME=myapp
DB_USER=myuser
DB_PASS=secret123

# docker-compose.yml
services:
  api:
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}
```

> [!warning] Never Hardcode Secrets
> Do not put passwords directly in `docker-compose.yml`. They will be in your version control history. Use `.env` files (added to `.gitignore`) or a secrets manager.

### DO: Set Resource Limits

```yaml
services:
  api:
    image: myapp/api:latest
    deploy:
      resources:
        limits:
          cpus: "1.0"       # Max 1 CPU core
          memory: 512M       # Max 512MB RAM
        reservations:
          cpus: "0.25"      # Guarantee 0.25 cores
          memory: 128M       # Guarantee 128MB RAM
```

> [!tip] Resource Limits Matter
> Without limits, a single container can consume all host resources, crashing the system. Always set limits in production. The `reservations` field is optional but helpful for scheduling.

### DON'T: Use `links`

The `--links` flag and `links:` directive are deprecated. Use custom networks instead. Services on the same Compose network can reach each other by service name via DNS, which is more flexible and reliable.

```yaml
# OLD (deprecated):
services:
  web:
    links:
      - db

# NEW (correct):
services:
  web:
    networks:
      - default
  db:
    networks:
      - default
# Both services can reach each other by name automatically
```

### DON'T: Forget Health Checks for Dependencies

If service A depends on service B, and B takes time to become ready (databases, caches), always use health checks. `depends_on` without `condition: service_healthy` only waits for the container to start, not for the application inside to be ready.

### DO: Use `restart: unless-stopped` for Production Services

```yaml
services:
  web:
    restart: unless-stopped
  api:
    restart: unless-stopped
```

This ensures services automatically recover from crashes and survive host reboots (if configured via systemd or Docker's daemon config).

## Key Concepts

1. **Docker Compose is for defining multi-container applications.** A single `docker-compose.yml` file declaratively describes all services, networks, and volumes. One command (`docker compose up -d`) creates the entire application stack.

2. **Services run on user-defined networks by default.** All services in a compose file share a network and can reach each other by service name via Docker's embedded DNS server (127.0.0.11). Custom networks provide isolation.

3. **Volumes persist data beyond container lifecycles.** Named volumes (Docker-managed) are recommended for databases and persistent data. Bind mounts (host directories) are recommended for development source code.

4. **`depends_on` controls startup order, not readiness.** By default, it waits for the container to start. Pair it with `healthcheck` and `condition: service_healthy` to wait for the application to be ready.

5. **`.env` files separate configuration from infrastructure.** Use them for secrets and environment-specific values. They are automatically loaded by Compose and should be added to `.gitignore`.

## Related Articles

- [[02-infraestructura-contenedores/01-Docker-Fundamentos-Arquitectura-Aislamiento-Capas]] — Docker internals: namespaces, cgroups, overlay2
- [[02-infraestructura-contenedores/02-Docker-Networking-Redes-Bridge-Host-Overlay-Mas]] — Docker networking modes, bridge networks, port mapping
- [[02-infraestructura-contenedores/03-Docker-Volumes-Storage]] — Volume types, storage drivers, backup strategies
- [[02-infraestructura-contenedores/05-Kubernetes-Fundamentals]] — Kubernetes: orchestration beyond Docker Compose
- [[02-infraestructura-contenedores/06-CICD-Pipelines]] — CI/CD pipelines for building and deploying containerized applications
