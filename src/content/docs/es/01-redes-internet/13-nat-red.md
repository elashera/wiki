---
title: "NAT: Network Address Translation"
description: "NAT explicado a fondo: SNAT, DNAT, port forwarding, masquerading, NAT y Docker, NAT traversal (STUN, TURN, ICE), IPv6."
---

# NAT: Network Address Translation

> [!tip] NAT en una frase
> NAT es el mecanismo que permite que **múltiples dispositivos en tu red local** compartan **una sola IP pública**, traduciéndolos automáticamente.

## El problema: pocas IPs públicas, muchos dispositivos

Cada dispositivo que se conecta a Internet necesita una IP pública. Pero las IPv4 se agotaron en 2011. La solución: NAT.

```
Tu red local (192.168.1.x — IPs privadas)
┌─────────────────────────────────────────┐
│  Laptop (192.168.1.5)  ──┐              │
│  Teléfono (192.168.1.6)  ──┤             │
│  Smart TV (192.168.1.7)   ──┤             │
│  Servidor NAS (192.168.1.8) ──→ Router ──→ IP pública: 85.23.45.67 (una sola!)
│  Consola (192.168.1.9)   ──┘             │
└─────────────────────────────────────────┘
```

## ¿Cómo funciona NAT?

### SNAT (Source NAT) — El más común

Cuando tu laptop hace una petición a Internet:

```
Dentro de tu red:
  Origen: 192.168.1.5:54321
  Destino: 93.184.216.34:80

Fuera de tu red (en el router):
  Origen: 85.23.45.67:12345    (¡cambia el origen!)
  Destino: 93.184.216.34:80

Respuesta:
  Destino: 85.23.45.67:12345   (el servidor responde a la IP pública)
  Origen: 93.184.216.34:80

Router traduce de vuelta:
  Destino: 192.168.1.5:54321
```

El router mantiene una **tabla de traducción**:

```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ Internal IP │ Internal PT │ External IP │ External PT │
├─────────────┼─────────────┼─────────────┼─────────────┤
│ 192.168.1.5 │ 54321       │ 85.23.45.67 │ 12345       │
│ 192.168.1.6 │ 54322       │ 85.23.45.67 │ 12346       │
│ 192.168.1.7 │ 54323       │ 85.23.45.67 │ 12347       │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

> [!tip] Cada conexión tiene un puerto diferente
> Si dos dispositivos acceden al mismo servidor, el router les asigna puertos externos diferentes para poder distinguir las respuestas.

### DNAT (Destination NAT) — Port forwarding

Cuando alguien desde Internet quiere acceder a un servicio en tu red:

```
Alguien en Internet:
  Origen: 123.45.67.89:54321
  Destino: 85.23.45.67:8080

Router traduce:
  Origen: 123.45.67.89:54321
  Destino: 192.168.1.100:3000

Resultado: La petición llega a tu servidor en localhost:3000
```

```bash
# En el router (iptables):
# Redirigir puerto 8080 del router al puerto 3000 del servidor interno
iptables -t nat -A PREROUTING -p tcp --dport 8080 -j DNAT --to-destination 192.168.1.100:3000

# Y permitir el tráfico:
iptables -A FORWARD -p tcp -d 192.168.1.100 --dport 3000 -j ACCEPT
```

> [!warning] Port forwarding expone tu red al Internet
> Cuando haces port forwarding, estás abriendo una puerta desde Internet directamente a tu servidor interno. Esto es un riesgo de seguridad. **NUNCA** expongas servicios directamente a Internet sin un firewall o reverse proxy.

## Masquerading (NAT dinámico)

Masquerading es una forma de SNAT donde el router usa su propia IP como origen:

```bash
# En Linux (iptables):
iptables -t nat -A POSTROUTING -s 192.168.1.0/24 -o eth0 -j MASQUERADE
# ← Todo el tráfico de la red 192.168.1.0/24 que salga por eth0
#    se mascarea con la IP de eth0
```

> [!tip] ¿Diferencia entre SNAT y Masquerade?
> - **SNAT**: IP fija (útil si tu IP pública es estática)
> - **Masquerade**: IP dinámica (útil si tu IP cambia, como en conexión móvil)
> - En la práctica, masquerade es más común porque la mayoría de conexiones domésticas tienen IP dinámica

## NAT y Docker

### El problema: contenedores detrás de NAT

```
Tu máquina (192.168.1.5)
├── Docker container (172.17.0.2)
│   └── App en puerto 3000
├── Docker container (172.17.0.3)
│   └── PostgreSQL en puerto 5432

# ¿Cómo accedes desde tu máquina?
curl http://localhost:3000     → Connection refused (si no mapeaste el puerto)
curl http://localhost:5432     → Connection refused

# ¿Por qué?
# El contenedor está en 172.17.0.2 (red interna de Docker)
# Tu máquina no sabe cómo llegar allí
```

### Solución: `-p` (port mapping) = DNAT

```bash
docker run -p 3000:3000 mi-app
# Docker hace DNAT automáticamente:
# Puerto 3000 del host → Puerto 3000 del contenedor
# Es como hacer port forwarding pero automático
```

### Red interna de Docker

```
Docker usa una red bridge: 172.17.0.0/16

Contenedor A (172.17.0.2) ──┐
                            ├── Red bridge de Docker
Contenedor B (172.17.0.3) ──┘
                            │
                            │ NAT hacia tu red local
                            │
                       192.168.1.5 (tu máquina)
```

> [!tip] Puertos entre contenedores
> - **Entre contenedores**: Se comunican por la red interna de Docker (sin NAT, sin `-p`). Usa el nombre del servicio como hostname.
> - **Del host al contenedor**: Necesitas `-p` (DNAT). El contenedor NO es accesible desde el host por defecto.
> - **Del Internet al contenedor**: Necesitas `-p` + firewall abierto.

## NAT y bases de datos

### ¿Por qué NO expones la base de datos a Internet?

```
# INCORRECTO: Base de datos accesible desde Internet
docker run -p 5432:5432 postgres:16
# Cualquiera en Internet puede intentar conectar a tu PostgreSQL

# CORRECTO: Base de datos solo accesible desde otros contenedores
docker run postgres:16  # Sin -p
# Solo accesible desde otros contenedores en la misma red Docker
```

### Pattern común en Docker Compose

```yaml
services:
  # Frontend accesible desde Internet (a través de reverse proxy)
  web:
    build: ./frontend
    ports:
      - "80:80"
      - "443:443"

  # Backend accesible desde el frontend (red interna)
  api:
    build: ./backend
    expose:
      - "3000"  # Solo dentro de Docker, no al host
    # NUNCA uses ports: aquí

  # Base de datos solo accesible desde el backend
  db:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data
    # Sin ports, sin expose — solo volumen de datos

volumes:
  pgdata:
```

## NAT Traversal (cuando las cosas se complican)

### El problema: P2P detrás de NAT

Cuando dos dispositivos detrás de NAT quieren comunicarse directamente (P2P):

```
Dispositivo A (NAT)          Dispositivo B (NAT)
192.168.1.5:54321 ──→ 85.23.45.67:12345    192.168.2.10:12345 ──→ 91.123.45.67:54321
                           (NAT table)                       (NAT table)

A no conoce B, B no conoce A. ¿Cómo se conectan?
```

### Soluciones

| Técnica | Descripción | Uso |
|---------|-------------|-----|
| **STUN** | Descubre tu IP pública y mapeo de puertos | WebRTC, VoIP |
| **TURN** | Reenvía todo el tráfico a través de un servidor | Cuando P2P directo no funciona |
| **ICE** | Combina STUN + TURN para la mejor ruta | WebRTC |
| **UPnP / NAT-PMP** | Permite que aplicaciones abran puertos automáticamente | Raro hoy en día (seguridad) |

## Resumen

- NAT permite que múltiples dispositivos compartan una IP pública
- SNAT traduce direcciones de origen (todos los dispositivos salientes)
- DNAT traduce direcciones de destino (port forwarding, acceso entrante)
- Docker usa NAT por defecto — necesitas `-p` para exponer contenedores
- Nunca expongas bases de datos directamente a Internet
- IPv6 elimina la necesidad de NAT (cada dispositivo tiene IP pública)

> [!quote] La clave
> NAT es un "parche" para la escasez de IPv4. Funciona bien para la mayoría de casos, pero rompe la conectividad P2P directa. IPv6 lo resolverá eventualmente.

## Conexión con el resto de la wiki

| Concepto tocado | Artículo en profundidad |
|-----------------|------------------------|
| Puertos y localhost | [[12-puertos]] |
| Servidores y procesos | [[14-servidores-procesos]] |
| Reverse proxy | [[14-servidores-procesos]] (Nginx/Caddy como proxy) |
