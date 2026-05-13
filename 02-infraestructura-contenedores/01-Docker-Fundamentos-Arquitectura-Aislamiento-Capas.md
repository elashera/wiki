# 02-01 — Docker Fundamentos: Arquitectura, Aislamiento y Capas

> [!info] About This Article
> This article covers Docker fundamentals from the ground up: what Docker is, why containers exist, Docker's architecture, the Linux kernel features that make containers possible (namespaces, cgroups, unionfs), images and layers, and how containerd and runc work together. It assumes zero prior knowledge and builds understanding progressively.

## Why Containers? The Problem They Solve

Before understanding what containers are, you must understand the problem they solve. Imagine you develop a Python application on your laptop. It works perfectly: you test it, you run it, it produces the correct output. You hand the source code to a colleague, and it fails. The deployment script crashes in staging. The production server refuses to start it. Why?

The root cause is **environmental inconsistency**. Your laptop has Python 3.11, a colleague's machine has Python 3.9. Your system library `libssl` is version 1.1, the production server has 3.0. The database driver you depend on requires a specific version of a dependency that conflicts with another library on the staging server. These are not theoretical problems — they are the most common cause of "it works on my machine," which is estimated to account for 30-40% of development delays in software projects.

> [!warning] Common Misunderstanding
> Many people think "I'll just use a virtual environment." Virtual environments (like Python's `venv` or Node's `npm`) solve dependency conflicts for a single language runtime, but they do NOT solve library-level conflicts, system package conflicts, kernel-level differences, or filesystem differences. If your application depends on a specific version of `glibc`, a virtual environment cannot help you.

The traditional solution was virtual machines (VMs). A VM runs a complete guest operating system on top of a hypervisor, which virtualizes the underlying hardware. This works — each VM has its own kernel, its own system libraries, its own everything. But it has a critical downside: **heavyweight overhead**. Each VM requires gigabytes of RAM just for the guest OS (even an idle Ubuntu server uses ~500MB RAM), tens of gigabytes of disk space for the OS image, and seconds to minutes to boot. If you want to run 10 microservices, you might need 10 VMs, consuming 50GB RAM and 300GB disk just for operating systems.

Containers solve this by **sharing the host kernel**. A container is not a full operating system — it is an isolated process (or group of processes) on the host machine, with its own filesystem, network stack, and process table. Containers share the host's Linux kernel, which means they start in milliseconds, use megabytes (not gigabytes) of RAM, and can be run at massive scale on a single machine.

> [!example] Analogy
> Think of a VM as a detached house: each has its own foundation, plumbing, electrical system, everything. It's isolated, but expensive and slow to build. A container is like an apartment in a shared building: each unit has its own walls and utilities, but the foundation, plumbing infrastructure, and electrical grid are shared. You get isolation at a fraction of the cost.

## What Is Docker?

Docker is not a container technology per se — it is a **platform** that makes containers easy to build, ship, and run. Under the hood, Docker leverages Linux kernel features (which have existed since kernel 2.4, with major additions in 3.8+) that enable process isolation. Docker's innovation was packaging all of these kernel features into a developer-friendly toolchain with a consistent interface.

Docker consists of several components:

- **Docker CLI** (`docker`): The command-line interface you interact with. When you run `docker run`, this is the tool parsing your command and communicating with the Docker daemon.
- **Docker Engine (dockerd)**: The background service (daemon) that manages containers, images, networks, and volumes. It listens on a Unix socket (`/var/run/docker.sock`) or TCP port for API requests.
- **Containerd**: An industry-standard container runtime that manages the full container lifecycle: image transfer and storage, container execution and supervision, restarts, and low-level storage and network attachment. Docker uses containerd under the hood — when Docker first emerged (2013), it included its own runtime called `libcontainer`. In 2016, Docker donated `libcontainer` to the Cloud Native Computing Foundation (CNCF), where it evolved into `containerd`. Docker then wrapped containerd with its own CLI and management features.
- **runc**: The low-level tool that actually creates and runs containers according to the OCI (Open Container Initiative) specification. Every time you run `docker run`, Docker asks containerd to create a container, containerd asks `runc` to create the container, and `runc` uses Linux namespaces and cgroups to set it up.
- **OCI (Open Container Initiative)**: A Linux Foundation project that standardizes container formats. It defines two specifications: the **Runtime Specification** (runc uses this to know how to create a container) and the **Image Specification** (Docker uses this to know how to build and store container images).

> [!info] The Docker Stack
> When you install "Docker," you are actually installing multiple components:
> 1. `docker-cli` — your command-line tool
> 2. `docker-engine` (dockerd) — the daemon that manages everything
> 3. `containerd` — the container runtime daemon
> 4. `runc` — the tool that actually creates containers
> 5. `docker-buildx` / `buildkit` — the image building system
> 
> You typically interact only with `docker-cli`, but understanding the layers beneath is essential for debugging and optimization.

## Docker Architecture: How It All Works Together

Docker follows a **client-server architecture**. The `docker` CLI client sends commands to the `dockerd` daemon, which orchestrates and manages containers.

```
┌─────────────────────────────────────────────────────────┐
│                     Docker Client (CLI)                  │
│              docker run, docker build, docker ps         │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP/API requests
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  Docker Daemon (dockerd)                 │
│  Manages: images, containers, networks, volumes          │
│  Talks to: containerd, Docker Registry                   │
└────────────────────┬────────────────────────────────────┘
                     │ gRPC calls
                     ▼
┌─────────────────────────────────────────────────────────┐
│                    containerd                            │
│  Manages: image lifecycle, container lifecycle           │
│  Talks to: runc, image storage                           │
└────────────────────┬────────────────────────────────────┘
                     │ OCI runtime calls
                     ▼
┌─────────────────────────────────────────────────────────┐
│                       runc                               │
│  Creates containers using:                               │
│  - Linux namespaces (isolation)                          │
│  - Linux cgroups (resource limits)                       │
│  - Unionfs (filesystem layers)                           │
└─────────────────────────────────────────────────────────┘
```

When you run `docker run nginx`:

1. The **CLI** parses your command and sends a request to the **Docker daemon** (`dockerd`).
2. The **daemon** checks if the `nginx:latest` image exists locally. If not, it contacts the **Docker Registry** (Docker Hub by default), downloads the image, and stores it locally.
3. The **daemon** asks **containerd** to create a container from that image.
4. **containerd** creates a task (a handle for the container) and asks **runc** to run it.
5. **runc** performs the actual work: it creates Linux namespaces to isolate the process, sets up cgroups to limit resources, mounts the container's filesystem layers, and executes the container's entrypoint command.
6. The container runs as a process on your host machine, fully isolated from other containers.

> [!tip] Key Insight
> The container is NOT a separate machine. It IS your host machine's process, but with restricted visibility. If you `ps aux` on the host, you will NOT see the container's processes by default — that is because the container's PID namespace hides them. This is the core of container isolation.

## Linux Kernel Features: The Real Magic

Containers are not a Docker invention. They are a Linux kernel feature that has existed for decades. Docker simply provides a user-friendly wrapper. Understanding the kernel features is essential because when containers break, these are usually the features causing the issue.

### Namespaces: Isolation

Linux namespaces provide **isolation**. Each container gets its own view of the system. There are six types of namespaces in Linux, each isolating a different resource:

#### PID Namespace (Process ID Isolation)

The PID namespace isolates process IDs. Without a PID namespace, all processes share a global numbering system starting from 1 (the init process). With a PID namespace, the first process inside the container gets PID 1, and the container cannot see processes outside its namespace.

```
Host PID Namespace:        Container PID Namespace:
PID 1: systemd              PID 1: my-app (inside container)
PID 42: nginx               PID 23: worker-process
PID 100: dockerd             PID 45: another-process
PID 1000: your-shell
```

> [!warning] Important Distinction
> "PID 1 is init" is a convention, not a kernel requirement. The first process in any PID namespace gets PID 1, regardless of what it does. In a container, if your main process crashes and no other process is running, the container exits — because PID 1 has nowhere to send SIGCHLD signals for orphaned children. This is why Docker by default runs containers with `--init` (tini), a tiny init process that reaps zombie processes.

#### NET Namespace (Network Isolation)

The NET namespace gives the container its own network stack: its own interfaces, routing table, iptables rules, and port space. This is why a container can bind to port 80 without conflicting with another container (or the host) binding to port 80 — they are different namespaces.

Inside a container, the network interface named `eth0` is not the same as the host's `eth0`. It is a virtual interface (veth pair) that is connected to the host's network bridge.

```
Container Network Stack:
┌─────────────────┐
│  eth0 (172.17.0.2)│   ← Virtual interface inside container
└────────┬────────┘
         │ veth pair
         ▼
┌─────────────────┐
│  docker0 bridge  │   ← Virtual bridge on host
│  (172.17.0.1)   │
└────────┬────────┘
         │
         ▼
   Host Network Stack
```

#### MNT Namespace (Filesystem Isolation)

The MNT namespace gives the container its own mount points. The container sees its own root filesystem (`/`) which is completely different from the host's `/`. When Docker creates a container, it mounts the container's layered filesystem at `/` inside the MNT namespace. Processes inside the container cannot access files outside this mount point (unless explicitly mounted).

```
Host Filesystem:          Container Filesystem:
/                           /
├── home/                   ├── app/           ← Your app code
├── etc/                    ├── etc/           ← Container's /etc
├── usr/                    ├── usr/           ← Container's /usr
├── var/                    ├── var/           ← Container's /var
└── ...                     └── ...
```

> [!tip] Practical Implication
> This is why you need to use Docker volumes to persist data. If you write data to `/data` inside a container, and that directory is part of the container's filesystem layers, the data is written to the writable layer. When the container is deleted, that layer is deleted too, and the data disappears. Volumes bypass this by mounting a host directory directly into the container's filesystem.

#### UTS Namespace (Hostname Isolation)

The UTS (UNIX Timesharing) namespace isolates the hostname and domain name. Each container can have its own hostname without affecting the host or other containers. When you run `docker run --hostname myserver nginx`, the container's hostname is `myserver`, even if the host's hostname is `vps-prod-01`.

#### IPC Namespace (Inter-Process Communication Isolation)

The IPC namespace isolates inter-process communication mechanisms: shared memory segments, semaphores, and message queues. Processes in one container cannot communicate with processes in another container using IPC primitives — they have separate IPC namespaces.

#### USER Namespace (User/Group ID Isolation)

The USER namespace maps user and group IDs between the host and the container. This allows a process inside the container to run as root (UID 0) while actually running as an unprivileged user on the host. This is a critical security feature: even if a container escape exploit is found, the attacker would be running as a low-privilege user on the host.

USER namespaces were added to the Linux kernel in version 3.8 (2013), which is after Docker's initial release. Docker added support for USER namespaces later, and they are now enabled by default in recent Docker versions.

```
Host User Mapping:          Container User Mapping:
UID 1000 (emilio)    →     UID 0 (root)    ← Container thinks it's root
UID 0 (root)         →     UID 65534 (nobody) ← Host root is nobody inside
UID 1001 (docker)    →     UID 1000 (app)   ← App user inside container
```

> [!warning] USER Namespace Gotcha
> When USER namespaces are enabled and you run a container as root, that root is actually mapped to an unprivileged user on the host. This means files created by the container as "root" will actually be owned by the mapped user on the host, which can cause permission surprises when using volumes.

### Control Groups (cgroups): Resource Limits

While namespaces provide **isolation**, cgroups provide **resource management**. Without cgroups, a container could theoretically consume all CPU, all memory, and all disk I/O on the host, starving other containers and the host OS itself. cgroups solve this by placing limits on how much of each resource a container can use.

Linux cgroups (introduced in kernel 2.6.24, significantly improved in 3.14 with cgroups v2) have several subsystems, each controlling a different resource:

#### CPU Controller (`cpu` / `cpuacct`)

The CPU controller limits how much CPU time a container can use. You can set:

- **CPU shares**: Relative weight compared to other containers (e.g., a container with 1024 shares gets twice as much CPU as one with 512, when both are CPU-saturated).
- **CPU quota and period**: Absolute limit (e.g., allow 0.5 CPU cores = `--cpus=0.5`).
- **CPU mask**: Pin the container to specific CPU cores.

```bash
# Allow a container to use at most 50% of one CPU core
docker run --cpus=0.5 nginx

# Give this container twice the CPU priority of others
docker run --cpu-shares=1024 nginx
```

> [!info] CPU Shares Explained
> CPU shares do NOT guarantee a minimum amount of CPU. They only define relative priority when CPU is contended. If a container has 1024 shares and no other container is using CPU, it can use 100% of a core. If another container also has 1024 shares and both are maxed out, each gets 50%.

#### Memory Controller (`memory`)

The memory controller limits how much RAM a container can use. It can set:

- **Memory limit**: Maximum total memory (RAM + swap). If exceeded, the kernel OOM killer terminates the container's processes.
- **Memory swap limit**: How much swap the container can use. Setting this to 0 disables swap for the container (recommended, as swap severely degrades performance).
- **Memory reservation**: Soft limit — when memory is tight, containers above their reservation are killed first.

```bash
# Limit to 512MB RAM, no swap
docker run --memory=512m --memory-swap=512m nginx

# Set a soft limit of 256MB, hard limit of 512MB
docker run --memory-reservation=256m --memory=512m nginx
```

> [!warning] OOM Killer
> When a container exceeds its memory limit, the Linux OOM (Out Of Memory) killer terminates processes inside the container. By default, it kills the process with the highest "oom_score" — usually the one using the most memory. You can control this with `--oom-kill-disable` (dangerous, can crash the host) or by tuning per-process oom_score_adj.

#### blkio Controller

The blkio controller limits block device I/O (disk reads/writes). It can set:

- **Weight**: Relative I/O priority (10-1000, default 500).
- **Throttle**: Maximum IOPS or throughput for specific devices.

```bash
# Limit read throughput to 10MB/s for /dev/sda
docker run --device-read-bps=/dev/sda:10MB nginx
```

#### Devices Controller

The devices controller controls which device nodes (like `/dev/sda`, `/dev/null`) a container can access. By default, containers can access `/dev/null`, `/dev/zero`, `/dev/random`, and `/dev/urandom`. Other devices are blocked unless explicitly allowed.

```bash
# Grant access to a specific GPU
docker run --device=/dev/nvidia0:/dev/nvidia0 --gpus all nvidia/cuda
```

#### PIDs Controller

The PIDs controller limits the number of processes a container can create, preventing fork bombs.

```bash
# Limit container to 50 processes
docker run --pids-limit=50 nginx
```

> [!tip] cgroups v1 vs v2
> Linux cgroups evolved from v1 (introduced in 2.6.24) to v2 (merged into kernel 5.0, widely adopted in Ubuntu 20.04+/Debian 11+). Key differences:
> - v1 has separate subsystems that operate independently (a cgroup can be limited in memory but unlimited in CPU).
> - v2 has a unified hierarchy where all controllers are applied together, preventing configuration inconsistencies.
> - v2 requires a single hierarchy mounted at `/sys/fs/cgroup`, while v1 allows multiple hierarchies.
> 
> Docker supports both, but v2 is preferred. Check your system with `cat /proc/filesystems | grep cgroup2`.

### Union Filesystems (OverlayFS): The Layered Filesystem

The final piece of the container puzzle is the **union filesystem**. A union filesystem allows multiple directories (called "branches" or "layers") to be mounted at a single mount point, presenting a unified view. Changes are written to the topmost layer only, while lower layers remain read-only.

Docker uses **OverlayFS** (introduced in Linux kernel 3.18) as its default storage driver. OverlayFS has two layers:

- **upper (writable)**: Where changes to the container's filesystem are written. This is the container's "writable layer."
- **lower (read-only)**: The image layers that make up the base image. Multiple lower layers can be stacked.
- **work (required)**: A temporary directory used by OverlayFS for operations that require modifying a lower layer (like deleting a file that exists in a lower layer).

```
OverlayFS Structure:
┌─────────────────────────────────┐
│  Mount Point (container root)   │
│  /app/config.json  ← NEW file   │ ← written to upper layer
│  /app/data/        ← NEW dir    │ ← written to upper layer
│  /etc/hostname     ← merged     │ ← from lower layers
│  /usr/bin/python ← merged       │ ← from lower layers
├─────────────────────────────────┤
│  Upper Layer (writable)         │
│  /app/config.json               │
│  /app/data/                     │
│  /etc/hostname                  │
│  (changes to existing files     │
│   create whiteout files)        │
├─────────────────────────────────┤
│  Work Layer (temporary)         │
│  (used by kernel for ops)       │
├─────────────────────────────────┤
│  Lower Layer 2 (read-only)      │
│  /etc/passwd, /usr/bin/...      │
├─────────────────────────────────┤
│  Lower Layer 1 (read-only)      │
│  /bin, /lib, /usr/lib/...       │
└─────────────────────────────────┘
```

> [!example] Copy-on-Write Explained
> When a container modifies a file that exists in a read-only layer, OverlayFS uses "copy-on-write" (CoW): it copies the file to the upper (writable) layer, then applies the modification. The original file in the lower layer remains unchanged. This is why containers can share read-only images efficiently — the image layers are never modified, only the writable layer differs per container.

## Docker Images: Structure and Building

A Docker image is a **read-only template** for creating containers. It is composed of multiple layers, each representing a set of filesystem changes. Images are built from a `Dockerfile`, a text file that describes the steps to assemble the image.

```dockerfile
# Example Dockerfile
FROM python:3.11-slim          # Base layer: Python 3.11 on Debian

WORKDIR /app                    # Create /app directory

COPY requirements.txt .         # Copy requirements file

RUN pip install -r requirements.txt  # Install dependencies

COPY . .                        # Copy application code

CMD ["python", "app.py"]        # Default command to run
```

Each instruction in a Dockerfile creates a new layer (except `WORKDIR`, `ENV`, `LABEL`, and a few others that don't create filesystem layers):

```
Layer 5: CMD ["python", "app.py"]           (metadata, no filesystem change)
Layer 4: COPY . .                           (application code: ~50MB)
Layer 3: RUN pip install -r requirements.txt (installed packages: ~200MB)
Layer 2: COPY requirements.txt .            (requirements file: ~1KB)
Layer 1: FROM python:3.11-slim              (Python + Debian base: ~150MB)
─────────────────────────────────────────────────
Total image size: ~400MB (before deduplication)
```

> [!info] Layer Caching
> Docker caches each layer. When you rebuild an image, Docker starts from the first layer whose instruction has changed. If you change only `COPY . .` (layer 4), Docker reuses layers 1-3. This is why the order of Dockerfile instructions matters: put stable, rarely-changing instructions (like `RUN pip install`) before volatile ones (like `COPY . .`) to maximize cache hits.

### How Docker Build Works Step by Step

1. Docker reads the `Dockerfile` from top to bottom.
2. For each instruction, it checks if the layer cache exists and is still valid.
3. If the cache is invalid (or missing), Docker executes the instruction, creating a new layer.
4. After all instructions are processed, Docker saves the image (all layers) locally.
5. The image can then be pushed to a registry or used to create containers.

> [!tip] Multi-Stage Builds
> One of Docker's most powerful features for reducing image size. You can use multiple `FROM` statements in a single Dockerfile. Each `FROM` starts a new build stage. You can copy files FROM one stage into another, keeping only the final artifacts.

```dockerfile
# Stage 1: Build
FROM golang:1.21 AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -o myapp

# Stage 2: Production
FROM alpine:3.19
COPY --from=builder /app/myapp /usr/local/bin/myapp
CMD ["myapp"]
```

This produces an image of ~10MB instead of ~800MB (the Go builder image + source code + build tools are discarded).

## Running Containers: The Lifecycle

When you run `docker run <image>`, the following lifecycle occurs:

```
1. CREATE     → Docker creates the container metadata
2. START      → Docker asks containerd to create the container
3. RUN        → runc sets up namespaces, cgroups, filesystem
4. EXEC       → The container's entrypoint command starts
5. MONITOR    → Docker/containerd monitor the container
6. STOP       → Container receives SIGTERM, then SIGKILL after timeout
7. REMOVE     → Container metadata and writable layer are deleted
```

> [!warning] Container State vs Process State
> A container can be in state "running" while its process has crashed. This happens when the init process (PID 1) exits but Docker is still monitoring it. Docker does NOT automatically restart containers unless you configure `--restart` policies. Always monitor your application's health, not just the container's state.

### Container States

| State | Description |
|-------|-------------|
| `created` | Container has been created but not started. Filesystem is set up, but the process is not running. |
| `running` | The container's process is running. May or may not be healthy. |
| `paused` | All processes in the container are suspended (using cgroup freezer). CPU is not consumed, but memory is held. |
| `exited` | The container's process has stopped (exit code 0 = success, non-zero = error). Filesystem still exists. |
| `dead` | The container is in an unrecoverable error state (rare). |

### Restart Policies

Restart policies control what Docker does when a container stops:

| Policy | Behavior | Use Case |
|--------|----------|----------|
| `no` (default) | Never restart | One-off tasks |
| `on-failure[:max-retries]` | Restart only if exit code is non-zero | Services that should retry on crash |
| `always` | Always restart, even on deliberate stop | Production services |
| `unless-stopped` | Always restart except when manually stopped | Services that should survive reboots |

```bash
# Restart a container up to 3 times if it crashes
docker run --restart=on-failure:3 nginx

# Always restart unless manually stopped
docker run --restart=unless-stopped nginx
```

## Best Practices and Common Pitfalls

### DO: Use Specific Image Tags

```bash
# GOOD: Pin to a specific version
docker run nginx:1.25.3-alpine

# BAD: Use the floating "latest" tag
docker run nginx:latest
```

> [!warning] Why Not `latest`?
> The `latest` tag is not a guarantee — it is a convention. When you pull `nginx:latest`, you might get nginx 1.25.3 today and nginx 1.25.4 tomorrow. This makes your deployments non-reproducible. Always pin to a specific version, and even better, use a digest (`nginx@sha256:...`).

### DO: Minimize Image Layers

Each `RUN`, `COPY`, and `ADD` instruction creates a new layer. More layers mean:

- Larger image size (each layer is stored separately and takes up space in the registry).
- Slower pulls (more HTTP requests to the registry).
- Slower builds (more cache invalidation risk).

Combine commands in a single `RUN` to reduce layers:

```dockerfile
# BAD: 3 layers
RUN apt-get update
RUN apt-get install -y curl
RUN apt-get install -y wget

# GOOD: 1 layer
RUN apt-get update && \
    apt-get install -y curl wget && \
    rm -rf /var/lib/apt/lists/*
```

> [!info] The Cleanup Step
> Note `rm -rf /var/lib/apt/lists/*` — this is essential. The `apt-get update` command downloads package lists to `/var/lib/apt/lists/`. These lists are needed for package installation but are not needed after installation. If you don't remove them, they take up 50-100MB in the image layer, and that space is never reclaimed (Docker layers are append-only).

### DO: Use .dockerignore

Create a `.dockerignore` file to exclude unnecessary files from the build context:

```
node_modules/
.git/
*.md
.env
.docker-compose*.yml
```

> [!warning] Build Context Matters
> When you run `docker build`, Docker sends the entire build context (the directory you run the command in) to the Docker daemon. If your project contains `node_modules/` (which can be hundreds of MB), Docker sends all of it over the network before even starting to build. A `.dockerignore` file prevents this.

### DON'T: Run Privileged Containers

```bash
# DANGEROUS: Full host access
docker run --privileged nginx

# SAFE: Only what you need
docker run nginx
```

A privileged container has access to ALL host devices, can load kernel modules, and has full access to the host's capabilities. This essentially defeats all container isolation. Only use `--privileged` for specific use cases like running Docker-in-Docker (which has its own safer alternatives like `docker:dind` with TCP socket).

### DON'T: Store Secrets in Images

```dockerfile
# BAD: Secret is in the image layer
FROM ubuntu
RUN echo "supersecret" > /etc/myapp/password

# GOOD: Use build args or runtime secrets
FROM ubuntu
ARG MY_PASSWORD
RUN echo "$MY_PASSWORD" > /etc/myapp/password
# Or use Docker BuildKit secrets:
# RUN --mount=type=secret,id=password cat /run/secrets/password > /etc/myapp/password
```

> [!warning] Why Layers Are the Problem
> Even if you `RUN rm /etc/myapp/password` after creating it, the file still exists in the layer where it was created. Anyone who pulls your image can reconstruct the layer and read the file. Use Docker BuildKit secrets, runtime environment variables, or external secret managers (HashiCorp Vault, AWS Secrets Manager).

## Related Articles

- [[01-fundamentos-internet/14-servidores-procesos-processos]] — Servers and Processes: What happens under `curl localhost:3000`?
- [[02-infraestructura-contenedores/02-Docker-Networking]] — Docker Networking: bridge, host, overlay networks explained
- [[02-infraestructura-contenedores/03-Docker-Volumes-Storage]] — Docker Volumes and Storage: persistent data management
- [[02-infraestructura-contenedores/04-Docker-Compose]] — Docker Compose: multi-container orchestration for local development

## Key Concepts

1. **Containers isolate processes, not machines.** A container is a set of isolated processes on the host, using Linux namespaces for isolation and cgroups for resource limits. It shares the host kernel.
2. **Docker is a platform, not a technology.** Under the hood, Docker uses containerd and runc (which implement the OCI specification) to create containers using Linux kernel features that have existed since 2013.
3. **Images are layered.** Each Dockerfile instruction creates a new layer (or reuses a cached one). Layers are union-mounted using OverlayFS, enabling efficient storage and fast container creation.
4. **Copy-on-write is fundamental.** When a container modifies a file from a read-only image layer, the file is copied to the writable upper layer. The original layer is never modified.
5. **Namespaces and cgroups work together.** Namespaces provide isolation (the container sees its own process table, network stack, filesystem). cgroups provide resource limits (the container can only use so much CPU, memory, disk I/O).
