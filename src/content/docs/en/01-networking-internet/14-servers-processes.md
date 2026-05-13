---
title: "Servers and Processes: What Is a Process, PID, Daemon, Zombie, What Happens Under curl"
description: "Servers explained: what is a process, PID, daemon, zombie process, sockets, signals, concurrency models (event loop, fork, threads), and management with PM2, Systemd, and Docker."
---

# Servers and Processes: What Is a Process, PID, Daemon, Zombie, What Happens Under curl

> [!tip] Servers in a nutshell
> A **server** is simply a **process** (or set of processes) that **listens on a port** and responds to requests. It is not magic — it is just software. This article covers the operating system concepts that power every server.

## What is a process?

A **process** is a program in execution. Every running program on your system is a process.

### Process attributes

Each process has:
- A **PID** (Process ID) — a unique number assigned by the OS
- Its own memory space (heap, stack, data segments)
- One or more **threads** of execution
- Open file descriptors (including network sockets)
- A **state** (running, sleeping, zombie, etc.)
- **Resources** allocated (CPU time, memory, disk I/O)

```bash
# View all running processes
ps aux

# Example output:
USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root         1  0.0  0.0 169392 13104 ?        Ss   08:00   0:02 /sbin/init
www-data  1234  0.1  0.3 524288 52428 ?        S    08:01   0:15 nginx: worker process
emilio    5678  2.5  4.2 2097152 680000 ?      Sl   08:02   1:30 node server.js
root      9012  0.0  0.1 412345 18000 ?        Ss   08:00   0:01 /usr/lib/postgresql/16/bin/postgres
```

### Process states

| State | Meaning | Code | Description |
|-------|---------|------|-------------|
| **Running** | Executing or ready to execute | R | In the run queue or on a CPU |
| **Sleeping (Interruptible)** | Waiting for an event (I/O, signal) | S | Can be woken by a signal |
| **Sleeping (Uninterruptible)** | Waiting for I/O (disk) | D | Cannot be killed or interrupted |
| **Zombie** | Terminated but not reaped by parent | Z | Entry remains in process table |
| **Stopped** | Suspended (Ctrl+Z, debugger) | T | Waiting to be resumed |
| **Dead** | Being destroyed | X | Transient, disappears quickly |

```
Process lifecycle:

  Fork → Exec → Run → ... → Exit → Zombie → Reap
  (parent creates)  (child runs)   (child calls exit())  (parent calls wait())
```

### Zombie processes

A **zombie** is a process that has finished executing but whose entry still exists in the process table because the parent has not called `wait()` to read its exit status:

```bash
# Find zombie processes
ps aux | grep -w Z

# Example output:
USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
emilio    5679  0.0  0.0      0     0 ?        Z    08:02   0:00 [defunct]
```

You cannot kill a zombie directly. You must kill its parent process so it calls `wait()`, or wait for the parent to exit (then init adopts the zombie and reaps it).

## What is a daemon?

A **daemon** is a background process that runs without user interaction. In Linux, daemons typically end in `d`:

```
Common daemons:
  sshd     → SSH server daemon
  nginx    → Nginx web server (not daemon suffix, but a daemon)
  postgres → PostgreSQL database server
  cron     → Cron job scheduler
  systemd  → System and service manager
  dockerd  → Docker daemon
  redis-server → Redis server
```

### Starting a daemon

```bash
# Systemd (modern Linux)
sudo systemctl start nginx
sudo systemctl enable nginx    # Start on boot
sudo systemctl status nginx    # Check status

# Process tree
sudo systemctl cat nginx
# Shows the unit file, including ExecStart, User, Group, etc.
```

```
Systemd process hierarchy:

systemd (PID 1)
├── nginx (master process, root)
│   ├── nginx (worker process, www-data)
│   │   └── nginx (worker process, www-data)
│   │       └── worker threads...
│   ├── nginx (worker process, www-data)
│   └── nginx (worker process, www-data)
├── postgres (main, postgres)
│   └── postgres (wal writer, postgres)
│       └── postgres (autovacuum launcher, postgres)
└── sshd (root)
    └── sshd (user session, user)
```

## What is a server?

A **server** is a process that:
1. **Opens a socket** on a specific port
2. **Listens** for incoming connections
3. **Accepts** incoming connections
4. **Reads** the request data
5. **Processes** the request
6. **Writes** the response data
7. **Closes** the connection (or keeps it alive)

### A minimal server in Python

```python
import socket

# Create a TCP socket
server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

# Bind to an address and port
server_socket.bind(('0.0.0.0', 8080))

# Listen for connections (backlog = 5)
server_socket.listen(5)

print("Server listening on port 8080...")

while True:
    # Accept a connection (blocks until a client connects)
    client_socket, client_address = server_socket.accept()
    print(f"Connection from {client_address}")

    # Read the request
    request = client_socket.recv(4096).decode()

    # Simple response
    response = "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nHello, World!"

    # Send the response
    client_socket.sendall(response.encode())

    # Close the connection
    client_socket.close()
```

### What happens under the hood when you run `curl`

```bash
# You type:
curl https://example.com

# Behind the scenes:
# 1. DNS resolution → find IP address for example.com
# 2. Create TCP socket → socket()
# 3. TCP 3-way handshake → connect()
# 4. TLS handshake (for https://) → SSL_connect()
# 5. Send HTTP request → write()
# 6. Receive HTTP response → read()
# 7. Print response to stdout
# 8. Close socket → close()
```

### The curl source flow

```
curl main()
  │
  ├── Curl_resolv()          → DNS lookup
  ├── Curl_connect()         → TCP connect (3-way handshake)
  ├── ssl_connect()          → TLS handshake (if HTTPS)
  ├── Curl_send()            → HTTP request
  ├── Curl_read()            → HTTP response headers + body
  ├── Curl_write()           → Output to stdout
  └── Curl_done()            → Cleanup, close sockets
```

## Sockets

A **socket** is an endpoint for network communication. It is identified by an IP address and a port.

### Socket types

| Type | Description | Example |
|------|-------------|---------|
| **Stream (SOCK_STREAM)** | TCP, reliable, ordered | Web servers, SSH |
| **Datagram (SOCK_DGRAM)** | UDP, unreliable, unordered | DNS, video streaming |
| **Raw (SOCK_RAW)** | Direct IP access | Ping, custom protocols |

### Socket lifecycle

```
Server:
  1. socket()     → Create socket
  2. bind()       → Bind to address and port
  3. listen()     → Listen for connections
  4. accept()     → Wait for incoming connection
  5. read/write() → Communicate with client
  6. close()      → Close connection

Client:
  1. socket()     → Create socket
  2. connect()    → Connect to server
  3. write()      → Send data
  4. read()       → Receive data
  5. close()      → Close connection
```

### Socket file descriptors

Every socket is represented as a file descriptor in the OS:

```bash
# View open sockets
sudo ss -tlnp
# State  Recv-Q Send-Q Local Address:Port  Peer Address:Port  Process
# LISTEN 0      128    0.0.0.0:22           0.0.0.0:*          users:(("sshd",pid=567,fd=3))
# LISTEN 0      511    0.0.0.0:80           0.0.0.0:*          users:(("nginx",pid=1234,fd=6))
# LISTEN 0      511    0.0.0.0:443          0.0.0.0:*          users:(("nginx",pid=1234,fd=7))
# LISTEN 0      80     127.0.0.1:3306       0.0.0.0:*          users:(("mysqld",pid=890,fd=20))

# View a process's open file descriptors
ls -la /proc/1234/fd
# lrwx------ 1 root root 64 May 13 08:01 0 -> /dev/null
# lrwx------ 1 root root 64 May 13 08:01 1 -> /dev/null
# lrwx------ 1 root root 64 May 13 08:01 2 -> /dev/null
# lrwx------ 1 root root 64 May 13 08:01 3 -> socket:[12345]
# lrwx------ 1 root root 64 May 13 08:01 4 -> socket:[12346]
# lrwx------ 1 root root 64 May 13 08:01 5 -> socket:[12347]
# 3, 4, 5 are socket file descriptors
```

## Concurrency models

Servers must handle multiple connections simultaneously. There are three main concurrency models:

### 1. Forking (one process per connection)

Each connection is handled by a new process:

```
Parent process (listening)
  ├── Fork → Child 1 handles connection 1
  ├── Fork → Child 2 handles connection 2
  ├── Fork → Child 3 handles connection 3
  └── Fork → Child N handles connection N

Pros: Isolation — a crash in one process does not affect others
Cons: High overhead — each fork creates a new process (memory, CPU)

Used by: Nginx (pre-forked workers), Apache (prefork MPM)
```

### 2. Threading (one thread per connection)

Each connection is handled by a new thread within the same process:

```
Main process
  ├── Thread 1 handles connection 1
  ├── Thread 2 handles connection 2
  ├── Thread 3 handles connection 3
  └── Thread N handles connection N

Pros: Threads share memory (no need to serialize/deserialize data)
Cons: Shared memory means a crash can affect all threads; race conditions

Used by: Apache (worker MPM), Python threading module, Java servlet containers
```

### 3. Event loop (single thread, non-blocking I/O)

A single thread handles all connections using non-blocking I/O and an event loop:

```
Event Loop (single thread)
  │
  ├── Connection 1: reading request → waiting for data (registered in event loop)
  ├── Connection 2: processing request → CPU bound
  ├── Connection 3: writing response → waiting for network (registered in event loop)
  ├── Connection 4: reading request → waiting for data
  └── ... thousands more connections handled by the same thread

Pros: Extremely efficient — one process, one thread handles thousands of connections
Cons: CPU-bound tasks block all connections; no parallelism on multi-core

Used by: Node.js, Nginx (worker model), Redis, Python asyncio, Go (goroutines)
```

### Concurrency model comparison

| Model | Process overhead | Memory usage | Concurrency | Complexity | Best for |
|-------|-----------------|-------------|-------------|------------|----------|
| **Forking** | High | High (copy on write) | Medium | Low | C, Nginx, Apache |
| **Threading** | Low (shared process) | Medium | High | Medium | Java, Python (GIL-limited) |
| **Event loop** | Very low | Low | Very high | High | Node.js, Go, Redis |

> [!tip] Go goroutines
> Go uses a hybrid approach: lightweight threads (goroutines) managed by the Go runtime. Thousands of goroutines can run on a single OS thread, with automatic scheduling. This combines the efficiency of event loops with the simplicity of threading.

## Signals

Processes receive **signals** from the OS to control their behavior:

| Signal | Number | Default action | Purpose |
|--------|--------|---------------|---------|
| **SIGINT** | 2 | Terminate | Interrupt (Ctrl+C) |
| **SIGTERM** | 15 | Terminate | Graceful shutdown |
| **SIGKILL** | 9 | Terminate | Force kill (cannot be caught) |
| **SIGHUP** | 1 | Terminate | Hangup (reload config) |
| **SIGUSR1** | 10 | Terminate | User-defined (log rotation) |
| **SIGUSR2** | 12 | Terminate | User-defined (graceful reload) |

```bash
# Send signals to processes
kill -SIGTERM 1234    # Graceful shutdown
kill -SIGHUP 1234     # Reload configuration (Nginx, PostgreSQL)
kill -SIGUSR1 1234    # Rotate logs (many daemons)
kill -9 1234          # Force kill (last resort)

# Example: Reload Nginx configuration
sudo nginx -s reload    # Sends SIGHUP to the master process
# Master process reads new config, spawns new workers, gracefully shuts down old workers
```

## Server process management

### PM2 (Node.js process manager)

```bash
# Install
npm install -g pm2

# Start an application
pm2 start server.js --name "my-app"

# Common commands
pm2 list                    # List all processes
pm2 logs my-app             # View logs
pm2 restart my-app          # Restart
pm2 stop my-app             # Stop
pm2 delete my-app           # Delete from PM2
pm2 startup                 # Auto-start on boot
pm2 save                    # Save process list
pm2 monit                   # Monitor processes

# Configuration
pm2 start server.js --name "my-app" --instances 4 --exec-mode cluster
# → Starts 4 instances (one per CPU core) in cluster mode
```

### Systemd (Linux service manager)

```ini
# /etc/systemd/system/myapp.service
[Unit]
Description=My Web Application
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/myapp
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/www/myapp

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl enable myapp
sudo systemctl start myapp
sudo systemctl status myapp
sudo journalctl -u myapp -f    # Follow logs
```

### Docker container as a server

```dockerfile
# Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
USER node
CMD ["node", "server.js"]
```

```bash
# Build and run
docker build -t myapp .
docker run -d --name myapp -p 3000:3000 myapp

# Docker manages the process lifecycle, networking, and resource limits
```

## Connection with the rest of the wiki

| Concept | In-depth article |
|---------|-----------------|
| What is Internet | [[01-what-is-internet]] |
| URL to page journey | [[02-url-to-page-journey]] |
| VPS configuration | [[20-vps]] |
| Cloudflare as reverse proxy | [[04-cloudflare-intro]] |

## Summary

- A **process** is a running program with a unique PID, its own memory, and file descriptors.
- **Zombie processes** are finished processes whose parents have not reaped them.
- A **daemon** is a background service that runs without user interaction.
- A **server** is a process that opens a socket, listens for connections, and responds to requests.
- The three **concurrency models** are forking (one process per connection), threading (one thread per connection), and event loops (single thread, non-blocking I/O).
- **Signals** control processes: SIGTERM for graceful shutdown, SIGHUP for config reload, SIGKILL for force kill.
- Process management tools: **PM2** (Node.js), **Systemd** (Linux services), **Docker** (containers).

> [!quote] The key takeaway
> Every web server, API, database, and messaging system is just a process that opens a socket and listens on a port. Understanding processes, sockets, signals, and concurrency models gives you the power to debug, optimize, and architect any server application.
