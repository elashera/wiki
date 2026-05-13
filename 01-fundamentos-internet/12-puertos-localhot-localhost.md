# Puertos, localhost y loopback

> [!tip] Puertos en una frase
> Un **puerto** es como el número de apartamento en un edificio: la IP es el edificio (servidor), el puerto es la puerta específica (servicio) por donde entra la comunicación.

## ¿Qué es un puerto?

Un puerto es un **número de 16 bits** (0-65535) que identifica un servicio específico en un servidor. Piensa en un servidor como un edificio con múltiples puertas:

```
Servidor: 192.168.1.100 (la dirección del edificio)

Puerto 22  → SSH (acceso remoto)
Puerto 80  → HTTP (servidor web)
Puerto 443 → HTTPS (servidor web seguro)
Puerto 3000 → Tu app de desarrollo
Puerto 5432 → PostgreSQL (base de datos)
Puerto 6379 → Redis (caché)
Puerto 8080 → Proxy inverso alternativo
```

### La analogía del teléfono

```
IP = Número de teléfono del servidor
Puerto = Extensión dentro del servidor

Llamar al 666-555-1234 → Conectas al servidor
Extensión 22 → SSH
Extensión 80 → Web
Extensión 443 → Web segura
```

### Rangos de puertos

| Rango | Nombre | Uso típico |
|-------|--------|-----------|
| **0-1023** | Well-known / System ports | Servicios estándar: SSH(22), HTTP(80), HTTPS(443), DNS(53), SMTP(25) |
| **1024-49151** | Registered ports | Servicios registrados: PostgreSQL(5432), MySQL(3306), MongoDB(27017) |
| **49152-65535** | Dynamic / Ephemeral | Puertos temporales del cliente (conexiones salientes) |

> [!tip] ¿Por qué 65535?
> Porque un puerto es 16 bits: 2^16 = 65536 valores posibles (0-65535).

## localhost / 127.0.0.1 / ::1

**localhost** es un nombre que siempre apunta a **tu propia máquina**.

### Direcciones equivalentes

| Nombre | IPv4 | IPv6 | Significado |
|--------|------|------|-------------|
| `localhost` | `127.0.0.1` | `::1` | Tu máquina local |
| `0.0.0.0` | `::` | **Ninga máquina** (no se puede conectar) | "Todas las interfaces" |

### ¿Por qué 0.0.0.0 no es "tu máquina"?

```
# Bind a 127.0.0.1 (solo acceso local)
node server.js --host 127.0.0.1 --port 3000
# Accesible desde: localhost:3000
# No accesible desde: otra máquina en la red

# Bind a 0.0.0.0 (acceso desde cualquier interfaz)
node server.js --host 0.0.0.0 --port 3000
# Accesible desde: localhost:3000, 192.168.1.5:3000, cualquier IP del servidor
# No accesible desde: Internet (a menos que el firewall lo permita)
```

> [!warning] 0.0.0.0 NO es localhost
> - `0.0.0.0` significa "escucha en TODAS las interfaces de red"
> - `127.0.0.1` significa "solo escucha en la interfaz loopback"
> - Cuando ves `http://localhost:3000` en docs de desarrollo, normalmente el servidor necesita binding a `0.0.0.0` para que funcione dentro de Docker

## El loopback (la interfaz de red interna)

El **loopback** es una interfaz de red virtual que tu sistema operativo crea. Los paquetes que envías a `127.0.0.1` nunca salen de tu máquina:

```
Tu proceso                  Loopback interface
   │                              │
   │─── Paquete → 127.0.0.1 ────→ │
   │                              │ (nunca toca la tarjeta de red)
   │                              │ (nunca toca el cable/WiFi)
   │←── Paquete ←─────────────────│ (el SO lo maneja internamente)
```

> [!tip] El loopback es increíblemente rápido
> Porque los paquetes no salen de la máquina, el loopback es orders de magnitud más rápido que cualquier interfaz de red real. Latencia: ~0.01ms vs ~1ms para una interfaz local.

## Puertos en Docker

### El problema: contenedores tienen su propia red

```
# Dentro del contenedor:
# Tu app corre en localhost:3000
# Pero localhost dentro del contenedor NO es localhost de tu máquina

# Desde tu máquina (host):
curl http://localhost:3000  → Connection refused! (porque el contenedor NO está en tu localhost)

# Solución: puertos expuestos
docker run -p 3000:3000 mi-app
# ↑     ↑    ↑     ↑
# host  │    container
# puerto │    puerto
```

### Cómo funciona `-p host:container`

```
Tu máquina (host)                    Contenedor
                    │
                    │  Docker bridge network
                    │
 3000 ←─────────────│─────────────→ 3000
 (localhost:3000)   │    (app:3000)

# El puerto 3000 del host redirige al puerto 3000 del contenedor
```

### Ejemplos de mapeo de puertos

```bash
# Puerto igual en host y container
docker run -p 3000:3000 mi-app
# Acceso: http://localhost:3000

# Puerto diferente
docker run -p 8080:3000 mi-app
# Acceso: http://localhost:8080  (redirige al 3000 dentro del contenedor)

# Múltiples puertos
docker run -p 3000:3000 -p 5432:5432 mi-app
# Acceso: localhost:3000 y localhost:5432

# Solo accesible desde localhost
docker run -p 127.0.0.1:3000:3000 mi-app
# No accesible desde otra máquina en la red

# Accesible desde cualquier IP (¡cuidado en producción!)
docker run -p 0.0.0.0:3000:3000 mi-app
```

### Puertos en Docker Compose

```yaml
# docker-compose.yml
services:
  web:
    build: .
    ports:
      - "3000:3000"
      - "127.0.0.1:8080:8080"  # Solo accesible desde localhost

  db:
    image: postgres:16
    ports:
      - "5432:5432"  # Accesible desde localhost y desde otros contenedores

  # Los puertos internos NUNCA se exponen al host (solo entre contenedores)
  redis:
    image: redis:7
    ports: []  # Sin puertos expuestos — solo accessible desde otros contenedores
               # docker compose
```

> [!important] Puertos internos vs expuestos
> - **Sin puertos expuestos**: Los contenedores se comunican por la red interna de Docker. No se pueden acceder desde tu máquina host.
> - **Con puertos expuestos**: Se pueden acceder desde tu máquina con `localhost:puerto`.
>
> **Regla práctica**: Expone solo los puertos del frontend al host. El backend, DB, Redis, etc., solo necesitan ser accesibles entre contenedores.

## Docker networking (concepto)

### Default bridge network

```
Contenedor A          Contenedor B
   │                      │
   │─── red de Docker ────│
   │   (172.17.0.0/16)    │
   │                      │

# Los contenedores se pueden comunicar entre sí por nombre de servicio
# (en docker-compose, no en docker run)
```

### Host networking

```bash
docker run --network host mi-app
# El contenedor usa la red del host directamente
# No necesitas mapear puertos (-p)
# El contenedor accede a localhost:3000 directamente
```

### Redes personalizadas

```bash
# Crear una red personalizada
docker network create mi-red

# Conectar contenedores
docker run --network mi-red --name app mi-app
docker run --network mi-red --name db postgres:16

# app puede acceder a db por nombre:
# db:5432 (no localhost:5432)
```

> [!tip] En docker-compose, los servicios se comunican por nombre
> ```yaml
> # docker-compose.yml
> services:
>   web:
>     depends_on: [api]
>     environment:
>       API_URL: http://api:3000  # ← usa el nombre del servicio, no localhost
>   api:
>     ports:
>       - "3000:3000"
> ```

## Ver puertos abiertos

### Linux

```bash
# Ver puertos que están escuchando (sudo necesario)
sudo ss -tlnp
# Estado  Recv-Q Send-Q Local Address:Port  Peer Address:Port Process
# LISTEN  0      128    0.0.0.0:22         0.0.0.0:*      users:(("sshd",pid=1234,fd=3))
# LISTEN  0      128    0.0.0.0:80         0.0.0.0:*      users:(("nginx",pid=5678,fd=6))
# LISTEN  0      128    0.0.0.0:3000       0.0.0.0:*      users:(("node",pid=9012,fd=15))
# LISTEN  0      128    127.0.0.1:5432     0.0.0.0:*      users:(("postgres",pid=3456,fd=5))

# Versión simplificada
sudo netstat -tlnp

# Ver puertos en uso por un proceso específico
sudo lsof -i -P -n | grep 3000
# node    9012 emilio   15u  IPv4  123456      0t0  TCP *:3000 (LISTEN)
```

### ¿Qué significa `0.0.0.0:3000` vs `127.0.0.1:3000`?

| Bind address | Accesible desde |
|-------------|-----------------|
| `0.0.0.0:3000` | localhost + cualquier IP de la máquina |
| `127.0.0.1:3000` | Solo localhost |
| `192.168.1.5:3000` | Solo desde esa IP específica |

> [!tip] Por qué ver `0.0.0.0` vs `127.0.0.1` importa
> Si tu app node.js hace `app.listen(3000)` por defecto, escucha en `0.0.0.0`. Si hace `app.listen(3000, '127.0.0.1')`, solo escucha en localhost.
>
> En Docker, necesitas que escuche en `0.0.0.0` (o `::`) para que el puerto mapeado funcione.

## Puertos comunes que necesitas conocer

| Puerto | Servicio | Protocolo |
|--------|----------|-----------|
| 22 | SSH | TCP |
| 53 | DNS | UDP/TCP |
| 80 | HTTP | TCP |
| 443 | HTTPS | TCP |
| 3000 | Node.js (dev) | TCP |
| 3001 | Node.js (dev alternativo) | TCP |
| 5432 | PostgreSQL | TCP |
| 3306 | MySQL | TCP |
| 6379 | Redis | TCP |
| 27017 | MongoDB | TCP |
| 8080 | Proxy/Alt HTTP | TCP |
| 8443 | Alt HTTPS | TCP |
| 9200 | Elasticsearch | TCP |
| 5672 | RabbitMQ | TCP |
| 15672 | RabbitMQ Management | TCP |
| 2375 | Docker API (sin TLS) | TCP |
| 2376 | Docker API (con TLS) | TCP |
| 8888 | Jupyter, Prometheus | TCP |

## IPv4 vs IPv6

### IPv4 (32 bits)

```
Formato: 4 grupos de 8 bits, separados por puntos
192.168.1.100

Rangos privados (no enrutables en Internet):
10.0.0.0/8        (10.0.0.0 - 10.255.255.255)
172.16.0.0/12     (172.16.0.0 - 172.31.255.255)
192.168.0.0/16    (192.168.0.0 - 192.168.255.255)

Total: ~4.3 mil millones de direcciones
```

### IPv6 (128 bits)

```
Formato: 8 grupos de 4 hexadecimales, separados por dos puntos
2001:0db8:85a3:0000:0000:8a2e:0370:7334

Compresión: los ceros a la izquierda y bloques consecutivos de ceros se pueden omitir
2001:db8:85a3::8a2e:370:7334

Rango local (equivalente a 127.0.0.1):
::1 (loopback)

Total: 3.4 × 10^38 direcciones (prácticamente infinito)
```

> [!tip] Por qué necesitamos IPv6
> El IPv4 se agotó en 2011. Con NAT (ver [[13-nat-red|NAT]]) pudimos延长时间, pero IPv6 es la solución definitiva. Cada dispositivo puede tener su propia IP pública.

## Resumen

- Un puerto identifica un servicio específico en un servidor (número 0-65535)
- localhost (127.0.0.1) siempre apunta a tu máquina; 0.0.0.0 significa "todas las interfaces"
- En Docker, necesitas `-p host:container` para exponer puertos al host
- Los servicios expuestos a Internet deben tener firewall configurado (solo abrir puertos necesarios)
- IPv6 es el futuro (más direcciones, sin necesidad de NAT)

> [!quote] La clave
> Puertos + IP = dirección completa. La IP dice "dónde" (qué servidor), el puerto dice "a qué servicio" (qué puerta). Sin puerto, no sabes a qué servicio conectar.

## Conexión con el resto de la wiki

| Concepto tocado | Artículo en profundidad |
|-----------------|------------------------|
| Cómo navega de URL a página | [[02-como-navegar-de-url-a-pagina]] (el puerto se extrae de la URL) |
| NAT | [[13-nat-red]] (cómo el mapeo de puertos en NAT conecta mundo exterior e interior) |
| Servidores y procesos | [[14-servidores-procesos-processos]] (un servidor es un proceso escuchando en un puerto) |
| Docker networking | [[13-nat-red]] (NAT es lo que Docker usa por defecto) |
