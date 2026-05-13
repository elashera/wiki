# 02-03 — Docker Volumes y Storage: Persistencia de Datos

> [!info] Para empezar
> Piensa en un contenedor Docker como una caja desechable. Cada vez que abres una caja nueva, está vacía. Si guardas documentos dentro y luego tiras la caja, los documentos desaparecen. Los **volumes** son como un archivador externo al que la caja puede acceder: aunque tires la caja, los documentos en el archivador siguen ahí.

## Why Containers Lose Data

Docker containers are, by design, **ephemeral**. This is not a bug — it is a fundamental architectural decision that makes containers lightweight, portable, and reproducible. But it also means that **any data written inside a container is lost when the container is removed**.

Understanding this requires understanding how Docker's filesystem works. When you create a container from an image, Docker layers the image on top of a writable layer. This is the first thing you need to know about the problem:

```
┌─────────────────────────────────────────────────────┐
│  Docker Container Filesystem                          │
│                                                       │
│  ┌─────────────────────────────────────────────────┐  │
│  │  Layer 0: Base Image (e.g., Ubuntu 24.04)       │  │
│  │  (read-only, part of the image)                  │  │
│  ├─────────────────────────────────────────────────┤  │
│  │  Layer 1: pip install flask                     │  │
│  │  (read-only, part of the image)                  │  │
│  ├─────────────────────────────────────────────────┤  │
│  │  Layer 2: COPY app.py /app/                     │  │
│  │  (read-only, part of the image)                  │  │
│  ├─────────────────────────────────────────────────┤  │
│  │  Layer 3: WRITABLE LAYER                        │  │
│  │  (RW, temporary, destroyed when container dies)  │  │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

This writable layer (Layer 3) uses the **Union File System (UnionFS)** overlay mechanism. Every write, delete, or modify operation on a container affects only this topmost layer. When you run:

```bash
docker run -d --name myapp -p 8080:8080 myapp:latest
```

Docker creates a new container and attaches a new writable layer on top of the image's read-only layers. Everything written inside this container — database files, logs, user uploads, session data, temporary cache — goes to this writable layer.

**Here is what happens when the container is removed:**

```bash
docker stop myapp      # Stops the container process
docker rm myapp        # Removes the container AND its writable layer
```

When you execute `docker rm`, Docker deletes the entire writable layer. This is the root cause of the data-loss problem. The read-only layers (the image) remain on disk — they are stored in `/var/lib/docker/overlay2/` and are shared across all containers using the same image — but everything written at runtime is gone forever.

> [!warning] The common mistake
> Many developers run containers like this:
> ```bash
> docker run -d --name db mysql:8
> ```
> Then write data to `/var/lib/mysql` inside the container. When the container crashes (which will happen — in production, things crash), they run the same command again to "fix" it. The new container is a fresh copy with an empty `/var/lib/mysql`. All the data is gone. This is the **number one data loss incident** in Docker environments.

### What data is at risk?

Any data that needs to survive beyond the lifecycle of a single container instance must be stored outside the container's writable layer. This includes:

- **Database data**: PostgreSQL WAL files, MySQL InnoDB tablespaces, MongoDB data files. Losing this data means losing the entire database.
- **User-uploaded content**: Images, documents, videos. If stored inside the container, they vanish on restart.
- **Configuration files**: Generated certificates, SSH keys, API tokens. Regenerating these can be complex and error-prone.
- **Application state**: Session data, job queues, cache files. Losing these can break functionality.
- **Log files**: While logs don't typically need to survive container restarts, keeping them in a shared location enables centralized log aggregation.

> [!example] A real-world scenario
> A startup runs a Django application with a PostgreSQL database. The developer runs:
> ```bash
> docker run -d --name postgres postgres:15
> ```
> The app works fine for two weeks. Then the server reboots, and the developer runs:
> ```bash
> docker run -d --name postgres postgres:15
> ```
> PostgreSQL starts fresh with an empty database. All user accounts, orders, and transactions are gone. The backup was never set up because "it was just a quick deployment."
>
> The fix is a single flag: `-v pgdata:/var/lib/postgresql/data`. With that flag, the data survives container removal.

## How Docker Storage Works

Before diving into volumes, you need to understand how Docker's storage driver works, because volumes and the container's writable layer interact with it in specific ways.

### Storage Drivers: overlay2

Docker's default storage driver on Linux is **overlay2** (formerly known as `overlay`). It is a UnionFS implementation that stacks filesystem layers on top of each other.

#### How overlay2 works internally

Overlay2 uses two lower filesystems and one upper filesystem:

```
┌───────────────────────────────────────────────────────────────┐
│  Overlay2 Mount Point (what the container sees)                │
│  /var/lib/docker/overlay2/abc123/merged                        │
│  (unified view of all layers)                                  │
│       ▲                                                        │
│       │  (unified view — reads from lower, writes to upper)    │
│  ┌────┴─────┐                                                  │
│  │  Lower   │  Read-only layers (image layers)                 │
│  │  dirs    │  /var/lib/docker/overlay2/lAYER1:               │
│  │          │  /var/lib/docker/overlay2/lAYER2:               │
│  └────┬─────┘                                                  │
│       │  (read-only)                                           │
│  ┌────┴─────┐                                                  │
│  │  Upper   │  Read-write layer (container's writable layer)   │
│  │  dir     │  /var/lib/docker/overlay2/UPPERDIR:             │
│  └──────────┘  (new files go here, existing files can be       │
│               overwritten by creating a whiteout file)         │
└───────────────────────────────────────────────────────────────┘
```

**Key mechanism — copy-on-write (CoW):** When the container tries to modify a file that exists in a lower (read-only) layer, overlay2 does not actually modify the lower layer. Instead:

1. It copies the file from the lower layer to the upper (writable) layer.
2. It then applies the modification to the copy in the upper layer.
3. The original in the lower layer remains untouched.

This copy-on-write behavior has performance implications:

- **First write to a file is expensive** — it requires a copy operation across layers.
- **Frequent small writes** (e.g., a database writing WAL entries) generate massive amounts of CoW overhead because each write may trigger a copy.
- **Read performance** from lower layers is nearly as fast as reading directly from disk because of the kernel's page cache.

```bash
# See which storage driver your Docker is using
docker info | grep -i "storage driver"

# Typical output:
# Storage Driver: overlay2
```

#### Why volumes bypass overlay2

This is a critical distinction: **volumes are stored directly on the host filesystem, NOT inside overlay2**. When you create a named volume, Docker creates a directory outside the overlay2 hierarchy:

```
/var/lib/docker/volumes/pgdata/_data   ← Volume data (ext4, not overlay2)
/var/lib/docker/overlay2/              ← Container writable layers (overlay2)
```

The volume directory is then **bind-mounted** into the container at the mount point. This means:

1. Data written to a volume does NOT go through the overlay2 copy-on-write mechanism.
2. It uses the host's native filesystem directly (ext4, xfs, btrfs, etc.).
3. This is why volumes offer significantly better write performance than writing to the container's writable layer.

```bash
# Inspect a volume to see its mountpoint
docker volume inspect pgdata
```

```json
{
  "CreatedAt": "2025-01-15T10:30:00Z",
  "Driver": "local",
  "Labels": null,
  "Mountpoint": "/var/lib/docker/volumes/pgdata/_data",
  "Name": "pgdata",
  "Options": null,
  "Scope": "local"
}
```

Notice that the `Mountpoint` path is `/var/lib/docker/volumes/pgdata/_data` — this is a regular directory on the host filesystem, managed by Docker. It is NOT inside `/var/lib/docker/overlay2/`.

> [!info] The volume path on disk
> Every named volume lives at `/var/lib/docker/volumes/<volume-name>/_data`. The `_data` directory is where all the actual files live. The parent directory contains metadata files like `_journal` for the volume driver. This path is always an **absolute path from the host's perspective**, even when referenced from inside the container.

### The container filesystem vs volume storage — a side-by-side

| Aspect | Container Writable Layer | Named Volume |
|--------|--------------------------|--------------|
| Storage mechanism | overlay2 (UnionFS) | Direct host filesystem (ext4/xfs) |
| Location on disk | `/var/lib/docker/overlay2/<id>/` | `/var/lib/docker/volumes/<name>/_data/` |
| Copy-on-write | Yes — every first write copies from lower | No — writes go directly to disk |
| Performance (write) | Poor for frequent writes | Near-native host performance |
| Survives container removal | No | Yes |
| Shared between containers | No (each container has its own layer) | Yes (multiple containers can mount the same volume) |
| Can mount a host directory | No | Yes (bind mounts) |
| Cleanup on `docker rm` | Automatically deleted | Not deleted unless explicitly specified |

## Volume Types

Docker provides four distinct mechanisms for persisting and sharing data: **bind mounts**, **named volumes**, **anonymous volumes**, and **tmpfs mounts**. Each has different use cases, performance characteristics, and trade-offs.

### Bind Mounts

A **bind mount** attaches a directory or file from the host filesystem directly into a container. This is the most direct form of storage passthrough.

#### How bind mounts work

When you specify a bind mount, Docker creates a mount point inside the container that points to a specific path on the host:

```bash
docker run -d \
  --name myapp \
  -v /home/emilio/myapp/config:/app/config \
  myapp:latest
```

The syntax is: `-v <host-path>:<container-path>`

What happens internally:

```
Host filesystem:                           Container filesystem:
┌──────────────────────┐                   ┌──────────────────────┐
│ /home/emilio/myapp/  │   bind mount      │ /app/                │
│   config/            │──────────────────→│   config/            │
│     app.conf         │   (same files)    │     app.conf         │
│     db.env           │   (bidirectional) │     db.env           │
└──────────────────────┘                   └──────────────────────┘
```

Changes made inside the container at `/app/config/` appear immediately in `/home/emilio/myapp/config/` on the host, and vice versa. This is because there is no intermediate storage layer — the container's view IS the host's directory.

#### Use cases for bind mounts

Bind mounts are ideal for:

1. **Development workflows** — You want the container's filesystem to reflect changes you make on your host without rebuilding the image. This is the canonical Docker Compose development pattern:

```yaml
services:
  web:
    image: myapp:latest
    volumes:
      - ./src:/app/src        # Code changes are reflected immediately
      - ./config:/app/config  # Config changes without rebuilding
```

2. **Configuration management** — Sharing configuration files between the host and container:

```bash
docker run -d \
  --name nginx \
  -v /etc/nginx/nginx.conf:/etc/nginx/nginx.conf:ro \
  -v /etc/nginx/conf.d:/etc/nginx/conf.d:ro \
  nginx:alpine
```

3. **Accessing host logs** — Collecting container logs into host directories for log aggregation:

```bash
docker run -d \
  --name myapp \
  -v /var/log/myapp:/app/logs \
  myapp:latest
```

4. **Hardware access** — Mounting USB devices, GPUs, or other host resources:

```bash
docker run -d \
  --name gpu-app \
  -v /dev/nvidia0:/dev/nvidia0 \
  --gpus all \
  nvidia/cuda:12-base
```

#### Advantages of bind mounts

- **Direct host access**: You can edit files on the host and the container sees them immediately. No rebuild, no restart.
- **Predictable paths**: You know exactly where the data lives because it is at a path you chose on the host.
- **No Docker metadata**: Bind mounts do not create Docker objects. They are pure filesystem mounts. You can use `ls` on the host and see everything.
- **Fine-grained control**: You can mount individual files, not just directories.

#### Disadvantages and risks of bind mounts

- **Tight coupling to the host**: Bind mounts reference host-specific paths. This makes the container configuration less portable. A bind mount configuration that works on `/home/emilio/app/config` will not work on a different host without changes.
- **Permission issues**: The container runs as a specific user (by default, root in the container). When the container writes to a bind-mounted host directory, the file is owned by whatever UID/GID the container process uses. This can cause permission problems:

```bash
# Run a container as root (default)
docker run -d -v /host/dir:/container/dir alpine touch /container/dir/file.txt

# On the host, check ownership
ls -la /host/dir/
# Output: -rw-r--r-- 1 root root 0 Jan 15 10:30 file.txt
# Owned by root because the container ran as root
```

If you then run a different container that needs to access that file, it might not have permission. You can work around this with `--user` flags or by adjusting host permissions, but it is a persistent headache.

- **Security**: Bind mounts give the container direct access to the host filesystem. A compromised container with a bind mount to `/` can read and modify any file on the host. This is why bind mounts should be used with `:ro` (read-only) whenever possible.

> [!warning] Absolute paths are mandatory for bind mounts
> Unlike named volumes, bind mounts MUST use absolute paths on the host. If you write `-v ./config:/app/config`, Docker will interpret `./config` as a relative path and resolve it based on the Docker daemon's working directory, not your current directory. On most Linux systems, this resolves to something unexpected. Always use absolute paths:
> ```bash
> # BAD — relative path
> docker run -v ./config:/app/config app
>
> # GOOD — absolute path
> docker run -v /home/emilio/config:/app/config app
> ```

### Named Volumes

**Named volumes** are Docker-managed storage locations. Unlike bind mounts, Docker controls the directory structure, and volumes are independent of any host directory path.

#### How named volumes work

When you create a named volume:

```bash
docker volume create pgdata
```

Docker creates a directory at `/var/lib/docker/volumes/pgdata/_data` on the host. The volume is managed entirely by Docker. You never need to create or reference the directory directly.

Using the volume:

```bash
docker run -d \
  --name postgres \
  -v pgdata:/var/lib/postgresql/data \
  postgres:15
```

Docker automatically creates the volume if it does not exist, and mounts it at the specified path inside the container:

```
┌─────────────────────────────────────────────────────────┐
│  Host filesystem                                          │
│                                                             │
│  /var/lib/docker/volumes/pgdata/_data/ ← Volume data       │
│    ├── base/        ← PostgreSQL base files                │
│    ├── global/      ← PostgreSQL global catalog            │
│    ├── pg_wal/      ← Write-ahead logs                     │
│    ├── pg_stat/     ← Statistics                          │
│    └── PG_VERSION   ← Version number                      │
│                                                             │
│  Container filesystem                                        │
│    /var/lib/postgresql/data/ → /var/lib/docker/volumes/    │
│                              pgdata/_data/ (bind mount)    │
└─────────────────────────────────────────────────────────┘
```

#### Advantages of named volumes over bind mounts

Named volumes offer several advantages that make them the **default choice for production data persistence**:

1. **Docker manages the lifecycle** — You can create, inspect, list, and delete volumes with Docker commands. Bind mounts have no lifecycle to manage because they are just directories.

2. **Portability** — Named volumes do not reference host paths. The Docker Compose file or docker run command does not need to know where on disk the data is stored. This makes the configuration portable across different hosts.

3. **Backup and migration** — Docker can backup, copy, and migrate named volumes without knowing their contents. This is critical for operational workflows.

4. **Performance** — Named volumes use the host's native filesystem (ext4, xfs, btrfs) directly. They bypass overlay2 copy-on-write, making them significantly faster than writing to the container's writable layer.

5. **Multiple container access** — The same named volume can be mounted into multiple containers simultaneously:

```bash
# Container 1 writes data
docker run -d --name writer -v shared:/data alpine sh -c "echo 'hello' > /data/file.txt"

# Container 2 reads the same data
docker run --rm --read-only -v shared:/data:ro alpine cat /data/file.txt
```

6. **Works with Docker Swarm** — Named volumes are the only storage option that works with Docker Swarm's built-in volume management. Bind mounts cannot be used in Swarm.

#### Creating and managing named volumes

```bash
# Create a named volume explicitly
docker volume create myapp-data

# Create a volume with specific options
docker volume create \
  --driver local \
  --opt type=nfs \
  --opt o=addr=192.168.1.100,rw \
  --opt device=:/path/to/nfs \
  nfs-data

# List all volumes
docker volume ls

# Inspect a volume (shows mount point, size, labels)
docker volume inspect myapp-data

# Remove a specific volume
docker volume rm myapp-data

# Remove all unused volumes (dangling volumes)
docker volume prune

# Remove all unused volumes, including those referenced by stopped containers
docker volume prune --force --all
```

> [!info] Volume lifecycle
> A named volume persists even after the container that uses it is deleted. This is by design — the volume is a separate Docker object. The volume is only deleted when you explicitly run `docker volume rm` or `docker volume prune`. This is different from bind mounts, which are just directories that exist independently of Docker.

### Anonymous Volumes

**Anonymous volumes** are unnamed Docker-managed storage locations. They are created automatically when you specify a mount point inside the container without a name on the host side:

```bash
# Anonymous volume — no name before the colon
docker run -d --name myapp -v /app/data myapp:latest
```

The volume is created with a randomly generated name (a long hash like `a1b2c3d4e5f6...`) and stored at `/var/lib/docker/volumes/a1b2c3d4e5f6/_data/`.

#### When anonymous volumes appear

Anonymous volumes are created in two scenarios:

1. **Dockerfile VOLUME instruction** — When an image declares a volume:

```dockerfile
FROM postgres:15
VOLUME /var/lib/postgresql/data
```

Any container created from this image gets an anonymous volume at `/var/lib/postgresql/data` unless explicitly overridden with `-v`.

2. **docker run with anonymous mount** — When you specify a container path without a host path or name:

```bash
docker run -v /data app    # Anonymous volume
docker run -v /data:/data app  # Named volume (same name for host and container)
docker run -v myvol:/data app    # Named volume (explicit name)
```

#### Why anonymous volumes are generally a bad idea

Anonymous volumes have significant operational problems:

- **No predictable name** — The volume name is a random hash. You cannot reference it in `docker inspect` or `docker volume rm` without first finding its hash.
- **Hard to identify** — `docker volume ls` shows a list of anonymous volumes that look identical. Without additional metadata, you cannot tell which anonymous volume belongs to which container.
- **Not shareable** — You cannot reattach an anonymous volume to a different container because you do not know its name.
- **Cleanup is difficult** — You need to `docker inspect` the container to find the anonymous volume's hash, then delete both.

> [!tip] The golden rule
> **Always use named volumes instead of anonymous volumes.** Named volumes are easier to manage, backup, migrate, and debug. The extra effort of giving a volume a name (`-v pgdata:/var/lib/postgresql/data` instead of just `-v /var/lib/postgresql/data`) pays off exponentially during operational workflows.

#### How to identify anonymous volumes

```bash
# List all volumes
docker volume ls

# Filter for anonymous volumes (those without a name, shown as <none>:<none>)
docker volume ls -f dangling=true

# Find anonymous volumes for a specific container
docker inspect myapp --format '{{range .Mounts}}{{if eq .Type "volume"}}{{if eq .Name ""}}ANONYMOUS: {{.Destination}}{{else}}NAMED: {{.Name}} → {{.Destination}}{{end}}{{end}}{{end}}'
```

> [!warning] Anonymous volumes and docker system prune
> When you run `docker system prune`, Docker removes anonymous volumes that are not associated with any running container. Named volumes are not affected by `prune` unless you use `--all`. This is another reason to prefer named volumes — they survive more aggressive cleanup operations.

### tmpfs Mounts

**tmpfs mounts** create an in-memory filesystem inside the container. Data stored in a tmpfs mount exists only in the host's RAM and is **lost when the container stops**. There is no persistent storage.

#### How tmpfs mounts work

```bash
# Create a tmpfs mount inside a container
docker run -d \
  --name myapp \
  --tmpfs /app/tmp:noexec,nosuid,size=100m \
  myapp:latest
```

tmpfs mounts are created using the Linux `tmpfs` filesystem, which is a RAM-based filesystem. Unlike volumes and bind mounts, tmpfs does not persist anything to disk.

#### When to use tmpfs mounts

tmpfs mounts are appropriate when you need temporary storage that **should not** persist:

1. **Secrets and credentials** — Storing API keys, certificates, or database passwords in memory so they are not written to disk. Disk encryption helps, but tmpfs provides defense in depth — the data never touches the disk at all:

```yaml
services:
  web:
    image: myapp:latest
    tmpfs:
      - /run/secrets:noexec,nosuid,size=10m
```

2. **Temporary files** — Cache files, temp uploads, or processing scratch space that does not need to survive:

```bash
docker run -d \
  --name image-processor \
  --tmpfs /tmp/cache:size=512m \
  image-processor:latest
```

3. **Sensitive session data** — Web sessions or tokens that should not persist to disk for security reasons.

4. **Reducing disk I/O** — For high-frequency write operations that do not need persistence (e.g., counters, temporary analytics), tmpfs avoids disk I/O entirely.

#### tmpfs vs volumes vs bind mounts

| Aspect | tmpfs | Named Volume | Bind Mount |
|--------|-------|-------------|------------|
| Persistence | No — lost on container stop | Yes | Yes |
| Storage location | Host RAM | Host filesystem | Host filesystem |
| Performance | Fastest (RAM) | Near-native (disk) | Near-native (disk) |
| Size limit | Must specify size | Unlimited (host disk) | Unlimited (host disk) |
| Security | Highest (no disk) | Standard | Lower (host path accessible) |
| Survives `docker rm` | No | Yes | N/A (host dir exists) |

#### tmpfs options

You can control tmpfs behavior with mount options:

```bash
# Basic tmpfs (no size limit — uses all available RAM)
docker run --tmpfs /tmp app

# With size limit (critical in production to prevent RAM exhaustion)
docker run --tmpfs /tmp:size=500m app

# Additional security options
docker run --tmpfs /tmp:noexec,nosuid,nodev,size=100m app
```

| Option | Effect |
|--------|--------|
| `size=<bytes>` | Maximum size of the tmpfs. Without this, the tmpfs can grow to use all available host RAM, which is a DoS risk. |
| `noexec` | Prevents execution of binaries from the tmpfs. Prevents attackers from running payloads after compromising the container. |
| `nosuid` | Ignores setuid and setgid bits. Prevents privilege escalation. |
| `nodev` | Prevents device files from being created. |

> [!warning] tmpfs and host memory
> Because tmpfs uses host RAM, it is subject to the host's memory limits. If you create a tmpfs of 10GB but the host only has 8GB of free RAM, the container will encounter OOM (Out of Memory) errors when writing large amounts of data. Always set a reasonable `size` limit and monitor host memory.

## Volume Management

Once you understand the different volume types, you need to know how to manage them in production: creating, backing up, migrating, and extending storage through volume drivers.

### Creating and Managing Volumes

#### Volume creation commands

```bash
# Create a volume with a specific name
docker volume create myvolume

# Create a volume with labels (for management and identification)
docker volume create \
  --label environment=production \
  --label team=backend \
  --label purpose=postgres-data \
  postgres-prod-data

# Inspect volume details (mount point, size, driver, labels)
docker volume inspect postgres-prod-data

# Volume with driver options (NFS, for example)
docker volume create \
  --driver local \
  --opt type=nfs \
  --opt o=addr=10.0.0.50,rw,noatime \
  --opt device=:/mnt/nfs/postgres \
  postgres-nfs-data
```

#### The complete volume management workflow

```bash
# List all volumes with human-readable details
docker volume ls --format "table {{.Name}}\t{{.Driver}}\t{{.Mountpoint}}"

# Check volume usage (Docker does not natively show volume disk usage)
# Workaround: inspect the mount point
VOLUME_PATH=$(docker volume inspect --format='{{.Mountpoint}}' myvolume)
du -sh "$VOLUME_PATH"

# Remove a single volume
docker volume rm myvolume

# Remove all dangling (unused) volumes
docker volume prune -f

# Remove ALL unused volumes (including those referenced by stopped containers)
docker volume prune -f --all

# Safely remove a volume referenced by a stopped container
# First, find which container references it
docker volume inspect pgdata --format '{{json .Spec.Name}}'

# Then remove the volume (the container must be removed or updated first)
docker rm -f stopped-container
docker volume rm pgdata
```

#### Docker Compose volume management

Docker Compose provides volume management commands:

```bash
# Create volumes defined in docker-compose.yml without starting containers
docker compose up -d --remove-orphans

# Remove volumes (this deletes all data — use with extreme caution)
docker compose down -v

# Remove specific named volumes
docker compose down -v --remove-orphans

# List volumes created by a compose project
docker compose ls

# Inspect compose project volumes
docker compose inspect | jq '.[0].Mounts'
```

> [!danger] docker compose down -v deletes ALL data
> The `-v` flag in `docker compose down` removes ALL named volumes defined in the compose file. This is irreversible. Always create a backup before running this command:
> ```bash
> # Before: backup all data
> docker compose down
> docker run --rm -v pgdata:/data -v backup:/backup alpine tar czf /backup/pgdata.tar.gz -C /data .
>
> # After: restore from backup
> docker compose up -d
> docker run --rm -v pgdata:/data -v backup:/backup alpine tar xzf /backup/pgdata.tar.gz -C /data
> ```

### Volume Backups and Migrations

Backing up Docker volumes is one of the most critical operational tasks. The standard pattern is to use a temporary container that mounts both the source volume and a backup directory, then use `tar` to create an archive.

#### The backup pattern

```bash
# Step 1: Stop the container using the volume (to ensure consistency)
docker compose down

# Step 2: Create a backup using a temporary container
# The pattern: run an alpine container, mount the source volume as /data
# and a backup directory as /backup, then tar the data
docker run --rm \
  -v pgdata:/data:ro \
  -v /home/emilio/backups:/backup \
  -w /data \
  alpine \
  tar czf /backup/pgdata-$(date +%Y%m%d-%H%M%S).tar.gz .

# Step 3: Restart the containers
docker compose up -d
```

This works because:
- The temporary container mounts the volume as **read-only** (`:ro`) to prevent data corruption.
- It also mounts a host directory as the backup destination.
- The `tar` command creates a compressed archive from the volume's contents.
- The `--rm` flag removes the temporary container after the backup is done.

> [!tip] Automating backups with a script
> ```bash
> #!/bin/bash
> # backup-volumes.sh — Backup all Docker volumes
> BACKUP_DIR="/home/emilio/backups"
> DATE=$(date +%Y%m%d-%H%M%S)
>
> mkdir -p "$BACKUP_DIR"
>
> # Get list of all volumes
> VOLUMES=$(docker volume ls -q)
>
> for VOLUME in $VOLUMES; do
>   echo "Backing up volume: $VOLUME"
>   docker run --rm \
>     -v "${VOLUME}:/data:ro" \
>     -v "${BACKUP_DIR}:/backup" \
>     -w /data \
>     alpine \
>     tar czf "/backup/${VOLUME}-${DATE}.tar.gz" .
>
>   if [ $? -eq 0 ]; then
>     echo "✓ Backup complete: ${VOLUME}-${DATE}.tar.gz"
>   else
>     echo "✗ Backup failed: ${VOLUME}"
>   fi
> done
>
> # Clean up old backups (keep last 30 days)
> find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete
> echo "Cleanup complete. Old backups removed."
> ```

#### Restoring from a backup

```bash
# Step 1: Stop the container
docker compose down

# Step 2: Remove or rename the existing volume (to start fresh)
docker volume rm pgdata

# Step 3: Recreate the volume (Docker auto-creates on first container run)
docker volume create pgdata

# Step 4: Restore from backup
docker run --rm \
  -v pgdata:/data \
  -v /home/emilio/backups:/backup \
  -w /data \
  alpine \
  tar xzf /backup/pgdata-20250115-103000.tar.gz -C /data .

# Step 5: Fix permissions if necessary
# (Important for databases — PostgreSQL needs specific permissions)
docker run --rm \
  -v pgdata:/data \
  postgres:15 chown -R 999:999 /data

# Step 6: Start the container
docker compose up -d
```

#### Migrating volumes between hosts

When migrating a Docker volume from one host to another:

```bash
# On SOURCE host:
# 1. Stop the container
docker stop myapp

# 2. Create a backup tarball
docker run --rm \
  -v mydata:/data:ro \
  -v /tmp:/backup \
  -w /data \
  alpine \
  tar czf /backup/mydata.tar.gz .

# 3. Transfer the tarball to the destination host
scp /tmp/mydata.tar.gz user@new-host:/tmp/

# On DESTINATION host:
# 1. Transfer the tarball to a permanent location
scp user@old-host:/tmp/mydata.tar.gz /var/lib/docker/volumes/

# 2. Create a new volume on the destination host
docker volume create mydata

# 3. Extract the data into the volume
docker run --rm \
  -v mydata:/data \
  -v /tmp:/backup \
  -w /data \
  alpine \
  tar xzf /backup/mydata.tar.gz -C /data .

# 4. Start your container with the volume
docker run -d -v mydata:/data myapp:latest
```

For larger migrations or when SCP is not feasible, you can use Docker's built-in tar streaming:

```bash
# On SOURCE host — stream the volume to stdout
docker run --rm \
  -v mydata:/data:ro \
  -w /data \
  alpine \
  tar c . | ssh user@new-host "docker run --rm -i -v mydata:/data -w /data alpine tar x -C /data"

# This pipes the tar stream directly over SSH, without creating an intermediate file
```

### Volume Drivers

Docker volume drivers extend Docker's storage capabilities beyond the local filesystem. They enable integration with cloud storage, network filesystems, and enterprise storage solutions.

#### Built-in volume drivers

Docker ships with a few built-in volume drivers:

| Driver | Purpose | Use Case |
|--------|---------|----------|
| **local** (default) | Local host filesystem | Most common, default choice |
| **nfs** | Network File System | Shared storage across containers |
| **volumerouter** | Custom routing | Plugin ecosystem |

#### NFS volume driver

Mounting an NFS share as a Docker volume:

```bash
# Create an NFS-backed volume
docker volume create \
  --driver local \
  --opt type=nfs \
  --opt o=addr=192.168.1.100,rw,noatime,nolock,hard,intr \
  --opt device=:/mnt/nfs/shared \
  nfs-shared-data
```

Options explained:
- `addr`: The NFS server's IP address.
- `rw`: Read-write mount.
- `noatime`: Do not update file access times (performance optimization, see Performance section below).
- `nolock`: Disable file locking (can cause issues with some applications but improves compatibility).
- `hard`: Hard mount — the client keeps trying to access the NFS share indefinitely if it is unavailable.
- `intr`: Allow processes accessing the NFS share to be interrupted if the server becomes unresponsive.

#### Third-party volume drivers

Commercial and community volume drivers provide integration with cloud storage:

| Driver | Provider | Type | Description |
|--------|----------|------|-------------|
| **EBS CSI** | AWS | Block storage | Elastic Block Store volumes for Docker nodes |
| **GCE PD** | Google Cloud | Block storage | Persistent Disk volumes |
| **Azure Disk** | Azure | Block storage | Managed Disk volumes |
| **Portworx** | Portworx | Distributed | Enterprise distributed storage |
| **Ceph RBD** | Ceph | Block storage | Ceph RBD (RADOS Block Device) volumes |
| **NetApp Trident** | NetApp | Block/File | NetApp ONTAP storage |
| **CloudByte** | CloudByte | Distributed | Distributed storage with encryption |

#### AWS EBS CSI driver example

The AWS Elastic Block Store Container Storage Interface (CSI) driver allows Docker (and Kubernetes) to provision EBS volumes dynamically:

```bash
# Create an EBS-backed volume (this provisions a new EBS volume in AWS)
docker volume create \
  --driver volgrp/aws-ebs \
  --opt fsType=xfs \
  --opt region=us-east-1 \
  --opt availabilityZone=us-east-1a \
  --opt iops=3000 \
  --opt volumeType=io2 \
  aws-pgdata

# Use the volume
docker run -d \
  --name postgres \
  -v aws-pgdata:/var/lib/postgresql/data \
  postgres:15
```

> [!info] CSI vs Docker volume drivers
> The Container Storage Interface (CSI) is the industry standard for storage plugins in container orchestration. While Docker supports volume drivers natively, Kubernetes exclusively uses CSI for external storage. For cloud-native deployments, the CSI approach is becoming the default. Docker's native volume driver API is being superseded by the container-storage-interface (CSI) specification, which provides a unified API across container runtimes.

## Docker Compose Volumes

Docker Compose provides a declarative way to define volumes, making it the preferred interface for multi-container applications.

### Basic volume syntax

In a `docker-compose.yml` file, volumes are defined in two places: the `volumes` section of each service, and a top-level `volumes` section that declares named volumes.

```yaml
version: "3.8"

services:
  web:
    image: nginx:alpine
    volumes:
      - ./html:/usr/share/nginx/html        # Bind mount (development)
      - certs-data:/etc/nginx/certs:ro      # Named volume, read-only
      - /dev/null:/dev/stdout               # File bind mount

  app:
    image: myapp:latest
    volumes:
      - uploads-data:/app/uploads           # Named volume
      - /var/log/myapp:/app/logs            # Bind mount (production log collection)
    tmpfs:
      - /tmp/cache:size=256m,noexec,nosuid  # tmpfs mount

  postgres:
    image: postgres:15
    volumes:
      - pgdata:/var/lib/postgresql/data     # Named volume
      - ./init-scripts:/docker-entrypoint-initdb.d:ro  # Bind mount for init scripts

volumes:
  # Top-level volume declarations with optional configuration
  pgdata:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/ssd/postgres  # Explicit host path for performance

  uploads-data:
    driver: local
    labels:
      app: myapp
      purpose: user-uploads

  certs-data:
    driver: local
```

### Volume syntax forms in Docker Compose

Docker Compose supports multiple volume syntax forms, which correspond to the `docker run -v` and `docker run --mount` options:

```yaml
services:
  app:
    image: myapp:latest

    # Form 1: Short syntax (string) — bind mount with absolute path
    volumes:
      - /host/path:/container/path              # Bind mount
      - /host/path:/container/path:ro           # Read-only bind mount
      - /host/path:/container/path:rw           # Read-write bind mount (default)
      - ./relative/path:/container/path         # Bind mount with relative path
      - volume-name:/container/path             # Named volume
      - volume-name:/container/path:ro          # Named volume, read-only

    # Form 2: Long syntax (dictionary) — more explicit and powerful
    volumes:
      # Named volume with options
      - type: volume
        source: mydata
        target: /data
        read_only: true
        volume:
          nocopy: true  # Do not copy image data into volume on creation

      # Bind mount with options
      - type: bind
        source: ./config
        target: /app/config
        read_only: true
        bind:
          propagation: private  # Mount propagation: private, rprivate, shared, rshared, slave, rslave

      # tmpfs mount
      - type: tmpfs
        target: /tmp/data
        tmpfs:
          size: 100000000  # Bytes (100 MB)
          mode: 0755       # Linux file mode
```

#### Understanding `nocopy`

The `nocopy: true` option is important for performance. By default, when Docker creates a named volume, it copies any existing data from the image's mount point into the volume (this is the "volume initialization" behavior). With `nocopy: true`, Docker skips this step, which is useful when:

- The image's mount point is empty (no data to copy).
- The data is large and copying it is unnecessary (e.g., a large initial dataset already present on the volume from a previous deployment).
- The volume is pre-populated from a backup or migration.

```yaml
volumes:
  - type: volume
    source: pgdata
    target: /var/lib/postgresql/data
    read_only: false
    volume:
      nocopy: true  # Skip copying /var/lib/postgresql/data from the image
```

#### Understanding mount propagation

Mount propagation controls whether mounts within a volume are shared with other containers or the host:

| Propagation | Effect |
|-------------|--------|
| `private` (default) | The mount is not shared with anything else. |
| `rprivate` | Fully private — no shared mounts in any direction. |
| `shared` | The mount can be shared with peers that are mounted on the same path. Changes on either side are propagated. |
| `rshared` | Recursive shared — shared propagation applies to all sub-mounts. |
| `slave` | Receives shared mounts from the origin but does not propagate back. |
| `rslave` | Recursive slave. |

Mount propagation is primarily used in Kubernetes and Docker Swarm environments, not in standalone Docker setups.

### Volume aliases and references

Docker Compose allows you to reference the same volume in multiple services:

```yaml
services:
  postgres:
    image: postgres:15
    volumes:
      - shared-data:/var/lib/postgresql/data

  redis:
    image: redis:7
    volumes:
      - shared-data:/data  # Same volume, different mount point

volumes:
  shared-data:
    driver: local
```

This enables:
- **Data sharing**: Multiple containers access the same data.
- **Data migration**: One container can write data while another reads it.
- **Backup**: A dedicated backup container can mount all volumes and create archives.

> [!warning] Write conflicts with shared volumes
> If multiple containers write to the same volume simultaneously, you can get data corruption unless the application handles concurrent access properly. This is fine for databases (they handle their own locking) but dangerous for arbitrary file writes. Always ensure that write access to a shared volume is coordinated.

### Docker Compose volume best practices

```yaml
# GOOD: Explicit volume declarations with labels
version: "3.8"
services:
  postgres:
    image: postgres:15
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
    driver: local
    labels:
      service: postgres
      environment: production
      backup-schedule: "0 2 * * *"
```

```yaml
# GOOD: Separate development and production configs
# docker-compose.dev.yml
services:
  web:
    volumes:
      - ./src:/app/src:ro  # Development: code mounted from host
      - node_modules:/app/node_modules  # Avoid leaking node_modules into volume

volumes:
  node_modules:  # Named volume to prevent host files from appearing in container
    driver: local

# docker-compose.prod.yml
services:
  web:
    volumes:
      - pgdata:/var/lib/postgresql/data
      - nginx-config:/etc/nginx/conf.d:ro

volumes:
  pgdata:
  nginx-config:
```

> [!tip] Docker Compose file naming convention
> It is common practice to have multiple compose files:
> - `docker-compose.yml` — default configuration (production)
> - `docker-compose.dev.yml` — development overrides
> - `docker-compose.prod.yml` — production overrides
> - `docker-compose.override.yml` — local overrides (git-ignored)
>
> Run with: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d`

## Performance and Security

This section covers performance optimization and security hardening for Docker volumes in production environments.

### Performance Considerations

#### Filesystem type impact

The underlying filesystem of the volume dramatically affects I/O performance. Different filesystems have different strengths:

| Filesystem | Strengths | Weaknesses | Best for |
|------------|-----------|------------|----------|
| **ext4** | Mature, stable, widely supported | Slower at high concurrency | General purpose, moderate I/O |
| **xfs** | Excellent for large files and high throughput | Poor for many small files | Databases, large datasets |
| **btrfs** | Copy-on-write, snapshots, compression | Less mature, higher CPU usage | Development, snapshot workflows |
| **zfs** | Snapshots, checksums, compression, self-healing | High memory consumption (1GB RAM per TB) | Enterprise storage, data integrity |

**XFS for databases**: PostgreSQL and MySQL perform significantly better on XFS because:
- XFS uses extent-based allocation (contiguous blocks), which is efficient for large sequential writes.
- ext4 uses block-based allocation with indirect blocks for large files, adding overhead.
- XFS handles high-concurrency I/O patterns better due to its parallel design.

```bash
# Format a volume with XFS for optimal database performance
mkfs.xfs /dev/sdb1

# Mount with optimal options for databases
mount -o noatime,nodiratime,allocsize=64m /dev/sdb1 /mnt/data

# noatime: Do not update access timestamps (reduces unnecessary writes)
# nodiratime: Do not update directory access timestamps
# allocsize=64m: Pre-allocate 64MB extents for better write performance
```

#### The `noatime` option

The `noatime` mount option is one of the easiest performance optimizations for Docker volumes. By default, Linux updates the **access time (atime)** of a file every time it is read. This means:

```
Without noatime:
  Container reads /data/file.txt  →  Kernel updates atime → WRITE to disk
  Container reads /data/file.txt  →  Kernel updates atime → WRITE to disk
  (Every read = one unnecessary write)

With noatime:
  Container reads /data/file.txt  →  Kernel skips atime update → NO write
  Container reads /data/file.txt  →  Kernel skips atime update → NO write
  (Reads are pure reads — no disk write overhead)
```

For workloads with high read frequency (databases, web servers, caching), disabling atime updates can reduce disk I/O by 10-30%.

```bash
# Check current mount options for a volume
mount | grep /var/lib/docker/volumes

# Add noatime at the Docker daemon level (affects ALL volumes)
# Edit /etc/docker/daemon.json
{
  "storage-opts": ["overlay2.override_kernel_check=true"]
}

# For bind mounts, add noatime explicitly:
docker run -v /data:/app/data:rw,bind,noatime app

# For named volumes, you can remount the underlying filesystem
# (requires host-level access)
mount -o remount,noatime /var/lib/docker/volumes/myvolume/_data
```

#### Bind mount vs named volume — performance comparison

| Operation | Bind mount | Named volume |
|-----------|-----------|-------------|
| Sequential write | Near-native (direct filesystem) | Near-native (direct filesystem) |
| Random write | Near-native | Near-native |
| Read performance | Near-native | Near-native |
| Copy-on-write overhead | None | None |
| NFS-mounted volume | Significantly slower (network latency) | Significantly slower (network latency) |
| Performance difference | Usually < 2% | Usually < 2% |

In practice, the performance difference between bind mounts and named volumes on the local filesystem is negligible (< 2%). The significant performance differences come from:
1. **Filesystem type** (xfs vs ext4)
2. **Mount options** (noatime, barrier=0)
3. **Storage medium** (NVMe SSD vs SATA SSD vs NFS)
4. **Network latency** (local vs remote volumes)

> [!tip] Benchmarking storage performance
> ```bash
> # Quick disk I/O test on a volume
> docker run --rm -v mydata:/data alpine sh -c "dd if=/dev/zero of=/data/testfile bs=1M count=1024 oflag=direct && rm /data/testfile"
>
> # Expected results:
> # NVMe SSD:  ~2000-5000 MB/s
> # SATA SSD:  ~500-550 MB/s
> # HDD:       ~100-200 MB/s
> # NFS (1Gbps): ~100 MB/s (limited by network)
> ```

#### Docker Compose for performance tuning

```yaml
services:
  postgres:
    image: postgres:15
    volumes:
      - pgdata:/var/lib/postgresql/data
    # Performance tuning via environment variables
    environment:
      POSTGRES_INITDB_ARGS: "--auth-host=scram-sha-256"
    # Use a tmpfs for PostgreSQL's temporary files (faster than disk)
    tmpfs:
      - /tmp:size=1g,noexec,nosuid,nodev

volumes:
  pgdata:
    driver_opts:
      type: none
      o: bind
      device: /mnt/fast-storage/postgres  # Use a fast NVMe drive
```

### Security Considerations

#### Read-only volumes

Mounting volumes as read-only (`:ro`) is a critical security practice. It prevents processes inside the container from modifying the mounted data, even if they are compromised:

```bash
# Mount configuration files as read-only
docker run -v /etc/myapp/config:/app/config:ro myapp:latest

# Mount a data directory as read-only (the application only reads data)
docker run -v readonly-data:/data:ro myapp:latest
```

> [!warning] Read-only does NOT mean tamper-proof
> If the container has root access, it can unmount the volume or modify other paths. Read-only mounts only prevent writes through the mounted path. For defense in depth, combine read-only mounts with `--read-only` (makes the entire container writable layer read-only) and `--cap-drop=ALL` (removes all Linux capabilities):

```bash
docker run \
  --read-only \
  --cap-drop=ALL \
  -v pgdata:/var/lib/postgresql/data:rw \
  --tmpfs /tmp:size=100m \
  postgres:15
```

This makes the container:
1. Read-only except for explicitly writable mounts.
2. Without any Linux capabilities (no ability to modify network settings, mount filesystems, etc.).
3. With a temporary `/tmp` directory for operations that need write access.

#### Permission management with volumes

When a container writes to a volume, the file ownership depends on the UID/GID of the process inside the container:

```bash
# Default behavior — root inside container = root on host
docker run -d -v mydata:/data postgres:15
ls -la /var/lib/docker/volumes/mydata/_data/
# Output: drwx------ 2 root root 4096 ...

# Fix: Run as the correct user (PostgreSQL runs as UID 999)
docker run -d \
  --user 999:999 \
  -v mydata:/data postgres:15
ls -la /var/lib/docker/volumes/mydata/_data/
# Output: drwx------ 2 999 999 4096 ...
```

For databases, always match the container's UID/GID to the database's expected user:

| Database | Default UID | How to find |
|----------|-----------|-------------|
| PostgreSQL | 999 | `docker run --rm postgres:15 id` |
| MySQL | 999 | `docker run --rm mysql:8 id` |
| MongoDB | 999 | `docker run --rm mongo:7 id` |
| Redis | 999 | `docker run --rm redis:7 id` |

#### SELinux labels (:Z and :z)

On systems with SELinux enabled (RHEL, CentOS, Fedora), volumes require special mount labels:

| Label | Effect |
|-------|--------|
| `:z` | Shared label — multiple containers can read and write the same volume. SELinux allows concurrent access. |
| `:Z` | Private label — only this container can access the volume. SELinux creates a unique label. |

```bash
# For a single-container setup (most common)
docker run -v /home/emilio/data:/data:Z myapp:latest

# For multiple containers sharing a volume
docker run -v /home/emilio/shared:/data:z myapp1:latest
docker run -v /home/emilio/shared:/data:z myapp2:latest
```

> [!warning] SELinux and Docker
> If you see mount errors like "permission denied" when using bind mounts on SELinux-enabled systems, this is the most likely cause. Adding `:Z` (for private volumes) or `:z` (for shared volumes) resolves the issue:
> ```bash
> # Without SELinux label — FAILS on RHEL/CentOS
> docker run -v /data:/app/data myapp
>
> # With SELinux label — WORKS
> docker run -v /data:/app/data:Z myapp
> ```

#### AppArmor profiles

AppArmor is Ubuntu's mandatory access control system. Docker containers run with a default AppArmor profile that restricts certain system calls. For most use cases, this is sufficient. However, for specialized workloads (e.g., GPU computing, kernel module loading), you may need a custom AppArmor profile:

```bash
# Check the current AppArmor profile for a container
docker inspect myapp --format '{{.HostConfig.SecurityOpt}}'

# Custom AppArmor profile (disable for debugging, use cautiously in production)
docker run --security-opt apparmor=unconfined myapp:latest

# Custom AppArmor profile (production — restrict specific operations)
docker run --security-opt apparmor=my-custom-profile myapp:latest
```

#### Security checklist for Docker volumes

| Check | Command/Config | Why |
|-------|---------------|-----|
| Mount as read-only when possible | `-v config:/config:ro` | Prevents unauthorized writes |
| Use `--read-only` for container | `--read-only` | Makes entire filesystem read-only |
| Drop all capabilities | `--cap-drop=ALL` | Removes unnecessary Linux privileges |
| Use non-root user | `--user 1000:1000` | Limits blast radius of container escape |
| Limit tmpfs size | `--tmpfs /tmp:size=100m` | Prevents memory exhaustion |
| Use tmpfs for secrets | `--tmpfs /run/secrets` | Secrets never touch disk |
| Label SELinux volumes | `:Z` or `:z` | Prevents access conflicts |
| Avoid bind mounting `/` | Never use `-v /:/host` | Complete host compromise |
| Restrict volume permissions | `chmod 700` on host path | Limits host-level access |
| Audit volume mounts | `docker inspect <container>` | Verify mount configuration |

## Best Practices and Common Pitfalls

### Common Errors and How to Avoid Them

#### Error 1: Data loss on container restart

**Symptom**: Running `docker rm myapp` and then `docker run` again results in a fresh container with no data.

**Cause**: No volume was declared for the data directory inside the container.

```bash
# BAD — data is stored in the container's writable layer
docker run -d --name db -p 5432:5432 postgres:15

# GOOD — data is stored in a named volume
docker run -d --name db -p 5432:5432 -v pgdata:/var/lib/postgresql/data postgres:15

# GOOD — data is stored in a bind mount
docker run -d --name db -p 5432:5432 -v /mnt/ssd/postgres:/var/lib/postgresql/data postgres:15
```

**Fix**: Always declare a volume for any path that contains persistent data.

#### Error 2: Permission denied when accessing volume files from host

**Symptom**: Files in a Docker volume appear owned by root or an unexpected UID, and the host user cannot access them.

```bash
# Container writes as root (default)
docker run -v /host/dir:/container/data alpine touch /container/data/file.txt

# Host user cannot access
ls -la /host/dir/
# -rw-r--r-- 1 root root 0 ...

# Host user tries to read
cat /host/dir/file.txt
# bash: /host/dir/file.txt: Permission denied
```

**Cause**: The container process runs as a different UID than the host user.

**Fix**: Run the container as the correct user, or set explicit permissions:

```bash
# Option 1: Run container with matching UID
docker run -d --user $(id -u):$(id -g) -v /host/dir:/container/data alpine

# Option 2: Change ownership on the host after the container writes
chown -R 1000:1000 /host/dir

# Option 3: Use group permissions
chmod -R g+rw /host/dir
```

#### Error 3: Disk space exhaustion

**Symptom**: The host disk fills up because Docker volumes, images, and containers accumulate over time.

**Cause**: Docker does not automatically clean up unused volumes, images, or build cache.

```bash
# Check Docker disk usage
docker system df

# Typical output:
# TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
# Images          42        15        8.5GB     5.2GB (61%)
# Containers      28        10        250MB     100MB (40%)
# Local Volumes   35        20        12.3GB    8.1GB (65%)
# Build Cache     1         0         4.2GB     4.2GB (100%)
```

**Fix**: Regular cleanup:

```bash
# Remove stopped containers
docker container prune -f

# Remove unused images
docker image prune -f

# Remove unused volumes
docker volume prune -f --all

# Remove unused build cache
docker builder prune -f

# Or do everything at once (caution — removes everything unused)
docker system prune -a --volumes -f
```

**Prevention**: Use `.dockerignore` files, prune regularly, and set up automated cleanup:

```bash
# Automated daily cleanup with cron
echo "0 3 * * * docker system prune -af --volumes 2>/dev/null" | crontab -
```

#### Error 4: Volume not mounting

**Symptom**: The container starts but the expected directory is empty, or shows the container's default content instead of the volume's data.

```bash
# Container starts but volume is empty
docker run -d --name test -v mydata:/data alpine sh -c "ls -la /data && echo 'hello' > /data/test.txt"
docker exec test ls -la /data
# Output: total 8
# drwxr-xr-x 2 root root 4096 ... .
# drwxr-xr-x 2 root root 4096 ... ..
# (no test.txt — volume was not mounted or was overwritten)
```

**Common causes**:

1. **Typo in volume name**: The volume name does not match.
2. **Missing volume declaration in Compose**: The volume exists but is not declared in the top-level `volumes` section.
3. **Path resolution**: Relative paths resolve to the wrong directory.
4. **Volume already contains data**: Docker's volume initialization behavior copies image data into the volume on first creation, overwriting any pre-existing data.

```bash
# Diagnose volume mounting issues
docker inspect test --format '{{range .Mounts}}{{.Name}} → {{.Destination}} (Type: {{.Type}}){{end}}'

# Check if the volume exists
docker volume ls | grep mydata

# Check the volume's actual contents on disk
ls -la /var/lib/docker/volumes/mydata/_data/

# Check if volume initialization overwrote data
# (Docker copies data from the image to the volume on first creation)
# Solution: use nocopy: true in compose or mount the volume with :ro during initialization
```

#### Error 5: Docker Compose volume conflicts

**Symptom**: After upgrading a docker-compose.yml, volumes are not created correctly or data is lost.

```yaml
# v1 — old format
services:
  db:
    image: postgres:14
    volumes:
      - pgdata:/var/lib/postgresql/data

# v2 — updated (changed the volume name)
services:
  db:
    image: postgres:15
    volumes:
      - postgres-data:/var/lib/postgresql/data  # Changed the name!

# Docker creates a NEW volume 'postgres-data'
# The old 'pgdata' volume becomes orphaned and unused
# The container starts with an EMPTY new volume
# ALL DATA IS GONE
```

**Fix**: When renaming volumes in Docker Compose, migrate the data:

```bash
# 1. Back up old volume
docker run --rm -v pgdata:/data -v /tmp:/backup -w /data alpine tar czf /backup/pgdata.tar.gz .

# 2. Update docker-compose.yml (rename the volume)

# 3. Create the new volume and restore data
docker volume create postgres-data
docker run --rm -v postgres-data:/data -v /tmp:/backup -w /data alpine tar xzf /backup/pgdata.tar.gz -C /data .

# 4. Remove old volume
docker volume rm pgdata
```

## Key Concepts

- **Containers are ephemeral by design**: The writable layer of a container is temporary. Any data written to it disappears when the container is removed. This is not a limitation but an architectural choice that enables reproducibility and portability.

- **Volumes bypass overlay2**: Named volumes are stored directly on the host filesystem (`/var/lib/docker/volumes/<name>/_data/`) and bypass the copy-on-write overlay2 mechanism. This gives them near-native disk performance, which is critical for databases and high-I/O workloads.

- **Four volume types for different use cases**: Named volumes (default for persistence), bind mounts (development and config), anonymous volumes (auto-generated, avoid in production), and tmpfs mounts (in-memory, for secrets and temp data). Choose based on your persistence, performance, and security requirements.

- **The backup pattern is universal**: The standard backup approach — run a temporary container that mounts the source volume and a backup directory, then use `tar` to create an archive — works for any volume type and any host OS. Automate it and test it regularly.

- **Security is a layered approach**: Combine `:ro` mounts, `--read-only` containers, `--cap-drop=ALL`, non-root users, and tmpfs for secrets. No single measure is sufficient, but together they create a strong defense-in-depth strategy for container storage security.

## Related Articles

- [[02-infraestructura-contenedores/01-Docker-Fundamentos-Arquitectura-Aislamiento-Capas]] — Docker fundamentals: container architecture, layers, namespaces, and cgroups. Volumes build on the container filesystem model explained here.
- [[02-infraestructura-contenedores/02-Docker-Networking-Redes-Bridge-Host-Overlay-Mas]] — Docker networking: bridge, host, overlay, and Macvlan networks. Networking and storage are the two pillars of container infrastructure.
- [[01-fundamentos-internet/14-servidores-procesos-processos]] — Linux processes and daemons: how container processes relate to host processes, signal handling, and process lifecycle. Understanding containers as isolated processes helps explain why volumes are needed.
