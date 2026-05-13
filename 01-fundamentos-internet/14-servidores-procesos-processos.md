# Servidores y procesos

> [!tip] Servidores en una frase
> Un **servidor** es simplemente un **proceso** (o conjunto de procesos) que **escucha en un puerto** y responde a las peticiones que recibe. No es mágico, es solo software.

## ¿Qué es un proceso?

Un **proceso** es un programa en ejecución. Cada proceso tiene:

- Un **PID** (Process ID) — número único
- Memoria propia (heap, stack, data)
- Uno o más **hilos** (threads)
- Archivos abiertos (descriptores de archivo)
- Un **estado** (running, sleeping, zombie, etc.)
- **Recursos** asignados (CPU, memoria, archivos de red)

```bash
# Ver todos los procesos en ejecución
ps aux

# Ejemplo de salida:
USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root         1  0.0  0.0 169392 13104 ?        Ss   08:00   0:02 /sbin/init
www-data  1234  0.1  0.3 524288 52428 ?        S    08:01   0:15 nginx: worker process
emilio    5678  2.5  4.2 2097152 680000 ?      Sl   08:02   1:30 node server.js
root      9012  0.0  0.1 412345 18000 ?        Ss   08:00   0:01 /usr/lib/postgresql/16/bin/postgres
```

### Estado de un proceso

| Estado | Significado | Código |
|--------|-------------|--------|
| **Running** | Se está ejecutando (o en cola de ejecución) | R |
| **Sleeping (Interruptible)** | Esperando un evento (I/O, señal) | S |
| **Sleeping (Uninterruptible)** | Esperando I/O de disco (no puede ser terminado) | D |
| **Zombie** | Terminó pero su padre no recogió su estado | Z |
| **Stopped** | Detenido (por una señal, como Ctrl+Z) | T |
| **Dead** | En proceso de ser eliminado | X |

> [!tip] Zombie process
> Un proceso zombie ya no existe realmente. Solo su entrada en la tabla de procesos sigue ahí porque el padre no llamó `wait()`. Puedes eliminarlo matando al padre (raro) o reiniciando.

## ¿Qué es un daemon?

Un **daemon** es un proceso que se ejecuta en segundo plano (background), sin interacción con el usuario. En Linux, los demonios suelen terminar en `d`:

```
sshd    — SSH daemon
nginx   — Nginx (a veces termina en d, a veces no)
postgres — PostgreSQL
redis-server — Redis
cron    — Cron daemon
```

### Cómo se gestionan los daemons

```bash
# Systemd (la mayoría de distros modernas)
systemctl status nginx        # Ver estado
systemctl start nginx         # Iniciar
systemctl stop nginx          # Detener
systemctl restart nginx       # Reiniciar
systemctl enable nginx        # Arrancar automáticamente al boot
systemctl disable nginx       # No arrancar al boot

# Ver logs de un daemon
journalctl -u nginx           # Logs de nginx
journalctl -u nginx --since "1 hour ago"
journalctl -u nginx -f        # Follow (como tail -f)

# service (alternativa más antigua)
service nginx status
service nginx restart
```

## ¿Qué es un servidor?

Un **servidor** es un proceso (o grupo) que:
1. Escucha en un **puerto** de red
2. Recibe **peticiones** de clientes
3. Las **procesa**
4. Envía una **respuesta**

### Ejemplos de servidores

| Servidor | Lenguaje | Puerto | Qué hace |
|----------|----------|--------|----------|
| **Nginx** | C | 80/443 | Servidor web, reverse proxy |
| **Node.js** | JavaScript | 3000 | Servidor HTTP (Express, Fastify) |
| **Python (Flask)** | Python | 5000 | Servidor web ligero |
| **PostgreSQL** | C | 5432 | Servidor de base de datos |
| **Redis** | C | 6379 | Servidor de caché/key-value |
| **SSH** | C | 22 | Servidor de acceso remoto |

> [!tip] Un "servidor" no es necesariamente una máquina
> - Un servidor web (Nginx) es un proceso
> - Un servidor de base de datos (PostgreSQL) es un proceso
> - Un servidor SSH (sshd) es un proceso
> - Pero también podemos decir "el servidor de producción" refiriéndonos a una máquina física o virtual

## ¿Qué pasa cuando haces `curl localhost:3000`?

Todo el viaje desde tu terminal hasta el servidor y vuelta:

```
1. curl abre una conexión TCP a localhost:3000
   │
2. El kernel busca el PID que escucha en el puerto 3000
   │   (usando /proc/net/tcp o ss)
   │
3. TCP handshake con el proceso (3-way handshake)
   │
4. curl envía la petición HTTP:
   GET / HTTP/1.1
   Host: localhost:3000
   User-Agent: curl/8.5.0
   Accept: */*
   │
5. El proceso (ej. Node.js/Express) recibe la petición
   │
6. Express busca la ruta "/" en sus routes
   │
7. Express ejecuta el handler:
   res.send('<h1>Hola</h1>')
   │
8. Express envía la respuesta:
   HTTP/1.1 200 OK
   Content-Type: text/html
   Content-Length: 14
   Connection: keep-alive

   <h1>Hola</h1>
   │
9. curl recibe la respuesta y la imprime en pantalla
```

> [!tip] ¿Por qué `curl localhost:3000` funciona pero el navegador no?
> Porque `localhost` es una interfaz de red interna (loopback). Tu proceso Node.js escucha en `0.0.0.0:3000` o `127.0.0.1:3000`, y `localhost` se resuelve a `127.0.0.1`.
>
> Si tu app Node.js hace `app.listen(3000)`, por defecto escucha en `0.0.0.0:3000`, accesible desde cualquier interfaz.

## Sockets

Un **socket** es el punto final de comunicación entre dos procesos. Un socket tiene:

- Dirección IP (de origen o destino)
- Puerto (de origen o destino)
- Protocolo (TCP o UDP)

```
Socket = IP + Puerto + Protocolo
Ejemplo: (127.0.0.1, 3000, TCP)

Un servidor tiene un socket escuchando.
Un cliente se conecta a ese socket.
```

### Cómo funciona un socket de servidor

```
1. Crear socket
   socket(AF_INET, SOCK_STREAM, IPPROTO_TCP)

2. Bind — asociar socket a IP y puerto
   bind(sock, "0.0.0.0", 3000)

3. Listen — empezar a escuchar conexiones
   listen(sock, backlog=128)

4. Accept — esperar conexiones entrantes
   client_sock = accept(sock, ...)

5. Read/Write — leer/escribir datos
   recv(client_sock, buffer)
   send(client_sock, response)

6. Close — cerrar conexión
   close(client_sock)
```

> [!tip] Backlog en listen()
> El backlog es el número máximo de conexiones pendientes de ser aceptadas. Cuando un cliente intenta conectar y todos los slots del backlog están ocupados, la conexión se rechaza.

## Modelos de concurrencia

### ¿Cómo maneja un servidor múltiples conexiones?

| Modelo | Descripción | Ejemplo |
|--------|-------------|---------|
| **Fork** | Crea un nuevo proceso por conexión | Apache MPM Prefork |
| **Thread** | Crea un nuevo hilo por conexión | Apache MPM Worker |
| **Event loop** | Un solo hilo maneja todas las conexiones | Node.js, Nginx |
| **Async/Goroutines** | Threads ligeros (corutinas) | Go, Java NIO |

### Node.js: Event Loop

```javascript
const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello World\n');
});

server.listen(3000, () => {
    console.log('Servidor escuchando en puerto 3000');
});
```

Node.js maneja miles de conexiones con **un solo hilo** usando el event loop:

```
Event Loop de Node.js:
┌─────────────────────────────────────┐
│    ┌───┐    ┌──────┐    ┌──────┐   │
│ ──→│Tim│───→│Poll  │───→│Check │───┘│
│    │ers│    │      │    │      │   │
│    └───┘    └──────┘    └──────┘   │
│       ↑         │         │         │
│       └─────────┴─────────┘         │
└─────────────────────────────────────┘

1. Timers: setTimeout, setInterval
2. Poll: I/O pendiente (sockets, archivos)
3. Check: setImmediate
4. Close: sockets cerrados

Cada vez que un socket recibe datos → se dispara un callback
TODO en un solo hilo, sin locks, sin deadlocks
```

> [!tip] ¿Por qué un solo hilo?
> Porque no compite por recursos (no hay locks), es predecible (no hay race conditions), y es increíblemente eficiente para I/O bound tasks (peticiones web, base de datos). Lo que NO es bueno para CPU intensive tasks (procesamiento de imágenes, cálculos pesados).

### Nginx: Worker processes

```nginx
# nginx.conf
worker_processes 4;  # 4 workers = 4 procesos independientes

events {
    worker_connections 1024;  # Cada worker maneja 1024 conexiones
}
```

```
Master Process (root)
  │
  ├── Worker 1 (PID 1234) — maneja ~1000 conexiones
  ├── Worker 2 (PID 1235) — maneja ~1000 conexiones
  ├── Worker 3 (PID 1236) — maneja ~1000 conexiones
  └── Worker 4 (PID 1237) — maneja ~1000 conexiones
```

Cada worker es independiente (no comparten memoria). Si un worker se cae, los otros siguen funcionando.

## Gestión de procesos en Linux

### Comandos útiles

```bash
# Ver proceso por PID
ps -p 1234 -f

# Ver procesos de un usuario
ps -u emilio

# Ver todos los procesos con árbol
ps auxf

# Ver proceso por nombre
pgrep -f node
pidof nginx

# Ver archivos abiertos por un proceso
lsof -p 1234

# Ver puertos abiertos por un proceso
lsof -i -P -n | grep 3000

# Ver consumo de recursos
top -p 1234
htop  # versión interactiva de top

# Ver用量 de un proceso en tiempo real
pidstat -p 1234 1  # cada segundo

# Ver señales enviadas a un proceso
strace -p 1234 -e trace=signal

# Kill un proceso
kill 1234           # SIGTERM (gracia para cerrar)
kill -9 1234        # SIGKILL (matado inmediatamente, no puede atraparlo)
kill -15 1234       # Igual que kill (SIGTERM es default)
pkill -f node       # Matar todos los procesos que contienen "node" en el nombre
```

### Señales de Linux

| Señal | Código | Descripción | ¿Puede atraparse? |
|-------|--------|-------------|------------------|
| **SIGTERM** | 15 | Terminar graciosamente | Sí |
| **SIGKILL** | 9 | Matar inmediatamente | No (nunca) |
| **SIGHUP** | 1 | Hangup (reload config) | Sí |
| **SIGINT** | 2 | Interrupt (Ctrl+C) | Sí |
| **SIGUSR1** | 10 | User-defined 1 | Sí |
| **SIGUSR2** | 11 | User-defined 2 | Sí |

```bash
# Reloading configuración sin reiniciar
nginx -s reload  # Envía SIGHUP a los workers

# Graceful shutdown de Node.js
process.on('SIGTERM', () => {
    server.close(() => {
        console.log('Servidor cerrado graciosamente');
        process.exit(0);
    });
});

# Ctrl+C envía SIGINT
# Ctrl+\ envía SIGQUIT
# Ctrl+Z envía SIGTSTP (suspende el proceso)
```

## Gestión de procesos en producción

### Supervisores de procesos

```bash
# PM2 (para Node.js)
pm2 start server.js --name "mi-app"
pm2 list
pm2 stop mi-app
pm2 restart mi-app
pm2 logs mi-app
pm2 monit              # Monitor en tiempo real
pm2 startup            # Auto-start al boot
pm2 save               # Guardar la lista de procesos

# Docker (contenedores como procesos)
docker ps              # Ver contenedores corriendo
docker restart mi-app
docker logs -f mi-app
docker inspect mi-app
docker compose up -d   # Iniciar en background
docker compose down    # Detener

# Systemd (para cualquier proceso)
systemctl status mi-app
systemctl restart mi-app
systemctl enable mi-app
journalctl -u mi-app -f
```

### ¿PM2 vs Systemd?

| | PM2 | Systemd |
|--|-----|---------|
| **Propósito** | Gestión de procesos Node.js | Gestión de servicios del sistema |
| **Auto-restart** | Sí (crash detection) | Sí (Restart=always) |
| **Logging** | Sí (pm2 logs) | journalctl |
| **Hot reload** | Sí (reload) | No (restart) |
| **Cluster mode** | Sí (multiplexa Workers) | No (múltiples servicios) |
| **Multi-linguaje** | No (solo Node) | Sí (cualquier proceso) |

> [!tip] Para Node.js en producción
> - **PM2**: Si necesitas hot reload, cluster mode, o gestión específica de Node
> - **Systemd**: Si quieres la gestión nativa del sistema (reinicios al boot, logging centralizado)
> - **Docker + Systemd**: Lo más común — Docker para contenerización, systemd para gestionar el contenedor

### Graceful shutdown

```javascript
// Un servidor bien comportado:
// 1. Deja de aceptar nuevas conexiones
// 2. Espera a que las conexiones existentes terminen
// 3. Libera recursos (DB, Redis, archivos)
// 4. Sale limpiamente

const server = app.listen(3000);

const gracefulShutdown = (signal) => {
    console.log(`Recibido ${signal}, cerrando graciosamente...`);

    // 1. Dejar de aceptar nuevas conexiones
    server.close(() => {
        // 2. Cerrar conexiones a dependencias
        dbPool.end()
            .then(() => {
                console.log('Todos los recursos liberados. Saliendo.');
                process.exit(0);
            })
            .catch((err) => {
                console.error('Error al cerrar:', err);
                process.exit(1);
            });
    });

    // 3. Timeout de seguridad (si algo falla, forzar salida en 30s)
    setTimeout(() => {
        console.error('Timeout forzado. Saliendo.');
        process.exit(1);
    }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

## Resumen

- Un proceso es un programa en ejecución con PID, memoria y recursos
- Un daemon es un proceso que corre en segundo plano
- Un servidor es un proceso que escucha en un puerto y responde peticiones
- Un socket = IP + Puerto + Protocolo
- Node.js usa event loop (un hilo), Nginx usa worker processes (múltiples procesos)
- Señales como SIGTERM permiten shutdown gracioso
- PM2, Docker y Systemd gestionan procesos en producción

> [!quote] La clave
> Todo "servidor" en Internet es solo un proceso escuchando en un puerto. El hardware es irrelevante — lo que importa es el software y cómo se gestiona.

## Conexión con el resto de la wiki

| Concepto tocado | Artículo en profundidad |
|-----------------|------------------------|
| Puertos y localhost | [[12-puertos-localhot-localhost]] |
| Cómo navega de URL a página | [[02-como-navegar-de-url-a-pagina]] (el servidor que procesa la petición) |
| Docker | [[13-nat-red]] (contenedores como procesos aislados) |
| Reverse proxy | [[14-servidores-procesos-processos]] (Nginx/Caddy como proxy) |
