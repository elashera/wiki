---
title: "Modelo OSI y TCP/IP: capas y protocolos"
description: "El modelo OSI de 7 capas explicado en profundidad: cada capa, sus protocolos, cómo funciona internamente, y cómo se compara con TCP/IP."
---

# Modelo OSI y TCP/IP

> [!tip] OSI en una frase
> El modelo OSI es un marco conceptual de **7 capas** que describe cómo se comunican los sistemas. Cada capa tiene una responsabilidad específica y se comunica con las capas adyacentes.

## ¿Qué es el modelo OSI?

El modelo **OSI** (Open Systems Interconnection) fue creado por la ISO en 1984 como un estándar para entender la comunicación de redes. Divide la comunicación en **7 capas**, cada una con responsabilidades bien definidas.

No es el modelo que se implementa en la práctica (TCP/IP es el modelo real), pero es fundamental para entender conceptos de red y diagnosticar problemas.

### Las 7 capas

```
┌────────────────────────────────────────────┐
│  7. Aplicación    (HTTP, DNS, SMTP, FTP)   │ ← Lo que el usuario ve
│  6. Presentación  (SSL/TLS, cifrado)       │ ← Cómo se ven los datos
│  5. Sesión        (manejo de sesiones)     │ ← Cómo se conversa
│  4. Transporte    (TCP, UDP)               │ ← Cómo se envían los datos
│  3. Red           (IP, routing)            │ ← Cómo llegan los datos
│  2. Enlace        (Ethernet, WiFi, MAC)    │ ← Cómo se mueven en el cable
│  1. Física        (cables, fibra, WiFi)    │ ← Los bits físicos
└────────────────────────────────────────────┘
```

> [!tip] Mnemotécnico
> De abajo hacia arriba: **"Todos Se Programan En Red Con Aplicaciones"**
> 1. **A**plicación → 2. **S**esión → 3. **P**resentación → 4. **E**nlace → 5. **R**ed → 6. **C**apa de **T**ransporte → 7. **A**plicación
>
> De arriba hacia abajo: **"A**l **S**ubir **P**or **E**stos **R**ampos, **C**aen **A**l **I**nfierno"

## Capa 7: Aplicación

La capa de aplicación es la que **interactúa directamente con el software del usuario**. Aquí es donde viven los protocolos que conocemos: HTTP, DNS, SMTP, FTP, SSH, WebSocket.

**Responsabilidad:** Proveer servicios de red directamente a las aplicaciones.

**Protocolos:**
| Protocolo | Puerto | Función |
|-----------|--------|---------|
| HTTP | 80 | Transferencia web |
| HTTPS | 443 | HTTP cifrado |
| DNS | 53 | Resolución de nombres |
| SMTP | 25 | Envío de email |
| IMAP | 993 | Recepción de email |
| SSH | 22 | Acceso remoto seguro |
| FTP | 21 | Transferencia de archivos |
| WebSocket | 443/80 | Comunicación bidireccional |

**Ejemplo:** Cuando escribes una URL en tu navegador, la capa de aplicación (HTTP) genera la petición `GET / HTTP/1.1`.

## Capa 6: Presentación

La capa de presentación se encarga del **formato y la representación de los datos**: cifrado, compresión, conversión de formato.

**Responsabilidad:** Traducir datos entre el formato que usa la aplicación y el formato que se envía por la red.

**Funciones:**
- **Cifrado/Descifrado**: TLS/SSL opera aquí (aunque en la práctica se considera parte de la capa de aplicación en TCP/IP)
- **Compresión**: gzip, brotli
- **Conversión de formato**: ASCII ↔ EBCDIC, JPEG, PNG, UTF-8 ↔ UTF-16

**Ejemplo:** Cuando tu navegador recibe una respuesta comprimida con gzip, la capa de presentación (del navegador) la descomprime antes de mostrarla.

## Capa 5: Sesión

La capa de sesión **gestiona las sesiones** de comunicación entre aplicaciones: establecimiento, mantenimiento y terminación.

**Responsabilidad:** Controlar la conversación entre dos aplicaciones.

**Funciones:**
- **Establecer sesión**: Handshake inicial
- **Sincronización**: Puntos de control para reanudar tras fallos
- **Terminar sesión**: Cierre ordenado

**Ejemplo:** En HTTP, cada petición es independiente (stateless), pero en SSH o una conexión WebSocket, la sesión se mantiene activa durante toda la interacción.

## Capa 4: Transporte

La capa de transporte se encarga de la **comunicación extremo a extremo** entre aplicaciones. Decide cómo enviar los datos: con fiabilidad (TCP) o sin ella (UDP).

**Responsabilidad:** Transferir datos entre el origen y el destino de forma fiable o rápida, según el protocolo.

### TCP (Transmission Control Protocol)

| Característica | Detalle |
|---------------|---------|
| **Conexión** | Orientado a conexión (handshake 3-way) |
| **Fiabilidad** | Garantiza que todo llegue (ACK, retransmisión) |
| **Orden** | Los datos llegan en orden |
| **Control de flujo** | Window size — ajusta velocidad según capacidad del receptor |
| **Control de congestión** | Slow start, congestion avoidance, fast retransmit |
| **Overhead** | Mayor (header de 20-60 bytes) |

**Funcionamiento interno de TCP:**

```
1. Three-way handshake:
   SYN → SYN-ACK → ACK

2. Transferencia de datos con números de secuencia:
   SEQ:100, LEN:100 → (100-199)
   SEQ:200, LEN:50  → (200-249)
   ACK:300          → "He recibido hasta el 299"

3. Control de flujo (window size):
   "Puedo enviar 65535 bytes sin ACK"
   "El receptor me pide reducir a 16384 bytes"

4. Control de congestión:
   Slow start: 1 → 2 → 4 → 8 → 16 packets por RTT
   Congestion avoidance: incrementa de 1 en 1
   Fast retransmit: 3 ACKs duplicados = retransmitir sin esperar timeout
   Slow down: reducir cwnd a la mitad

5. Four-way teardown:
   FIN → ACK → FIN → ACK
```

### UDP (User Datagram Protocol)

| Característica | Detalle |
|---------------|---------|
| **Conexión** | Sin conexión |
| **Fiabilidad** | Best-effort (puede perder paquetes) |
| **Orden** | No garantiza orden |
| **Control de flujo** | No |
| **Control de congestión** | No |
| **Overhead** | Menor (header de solo 8 bytes) |

**Uso típico de UDP:**
- **DNS**: Consultas pequeñas, si se pierde se reenvía
- **Streaming de video/audio**: Prioriza velocidad sobre fiabilidad
- **Videojuegos online**: La latencia importa más que los packets perdidos
- **DHCP**: Los clientes aún no tienen IP, no pueden usar TCP

## Capa 3: Red

La capa de red se encarga del **enrutamiento** de paquetes a través de múltiples redes. El protocolo principal es **IP** (Internet Protocol).

**Responsabilidad:** Encontrar la mejor ruta entre origen y destino, incluso si pasa por múltiples redes.

### Protocolos de la capa de red

| Protocolo | Función |
|-----------|---------|
| **IPv4** | Direccionamiento y enrutamiento (32 bits) |
| **IPv6** | Direccionamiento y enrutamiento (128 bits) |
| **ICMP** | Diagnóstico (ping, traceroute) |
| **ARP** | Resuelve IP → MAC en la misma red local |
| **OSPF, BGP** | Protocolos de enrutamiento entre routers |

### El packet IP

```
┌────────────────────────────────────────────────────┐
│                    IP Header (20-60 bytes)           │
├────────────┬────────────┬────────────┬─────────────┤
│ Version    │ IHL        │ TTL        │ Protocol    │
│ (4 bits)   │ (4 bits)   │ (8 bits)   │ (8 bits)    │
├────────────┼────────────┼────────────┼─────────────┤
│ Source IP  │ Dest IP    │            │             │
│ (32 bits)  │ (32 bits)  │            │             │
├────────────┴────────────┴────────────┴─────────────┤
│                   Payload                          │
│              (TCP segment / UDP datagram)          │
└────────────────────────────────────────────────────┘
```

**Campos clave del header IP:**
- **Version**: IPv4 (4) o IPv6 (6)
- **TTL (Time To Live)**: Número máximo de hops. Se decrementa en cada router. Si llega a 0, el packet se descarta. Previene loops infinitos.
- **Protocol**: Indica qué protocolo de capa 4 contiene el payload (6 = TCP, 17 = UDP)
- **TOS/DSCP**: Quality of Service — prioridad del packet
- **Fragmentation**: Los routers pueden fragmentar packets si exceden el MTU

### Enrutamiento

```
Tu PC (192.168.1.5) → Router (192.168.1.1) → ISP → Internet → Servidor (93.184.216.34)
```

Cada router consulta su **tabla de enrutamiento** para decidir hacia dónde enviar el packet:

```
Tabla de enrutamiento del router:
┌──────────────────┬──────────────────┬──────────────┐
│ Destination      │ Next Hop         │ Interface    │
├──────────────────┼──────────────────┼──────────────┤
│ 192.168.1.0/24   │ Directo          │ eth0         │
│ 0.0.0.0/0        │ 85.23.45.1       │ eth1         │ ← Default route
│ 10.0.0.0/8       │ 192.168.1.100    │ eth0         │
└──────────────────┴──────────────────┴──────────────┘
```

> [!tip] Default route (0.0.0.0/0)
> La ruta por defecto (0.0.0.0/0) se usa cuando no hay una ruta específica para el destino. Es la "ruta por defecto" que tu router usa para enviar tráfico a Internet.

### ARP (Address Resolution Protocol)

ARP resuelve una **IP → MAC address** en la misma red local:

```
1. Tu PC necesita enviar un packet a 192.168.1.1 (router)
2. Tu PC pregunta a toda la red: "¿Quién es 192.168.1.1? Dime tu MAC"
   (ARP Request — broadcast)
3. El router responde: "Soy yo, mi MAC es AA:BB:CC:DD:EE:FF"
   (ARP Response — unicast)
4. Tu PC guarda la respuesta en su cache ARP
```

> [!warning] ARP spoofing
> ARP no tiene autenticación. Un atacante puede responder falsamente y decir "soy el router" (Man-in-the-Middle). Por eso ARP no debe usarse en redes que se conectan a Internet sin protección.

### ICMP (Internet Control Message Protocol)

ICMP se usa para **diagnóstico y reporting** de errores:

```bash
# Ping: envía ICMP Echo Request y espera Echo Reply
ping 8.8.8.8
# PING 8.8.8.8 (8.8.8.8): 56 data bytes
# 64 bytes from 8.8.8.8: icmp_seq=0 ttl=115 time=12.345 ms

# Traceroute: usa ICMP Time Exceeded para ver cada hop
traceroute google.com
# 1  192.168.1.1     1.2 ms
# 2  10.0.0.1       15.3 ms
# 3  85.23.45.1     25.6 ms
# 4  93.184.216.34  45.8 ms

# mtr: combina ping + traceroute en tiempo real
mtr google.com
```

## Capa 2: Enlace de datos

La capa de enlace se encarga de la **comunicación entre dos dispositivos directamente conectados** (mismo segmento de red). Usa **MAC addresses** para direccionamiento.

**Responsabilidad:** Transferir frames entre dos nodos adyacentes, detectar y opcionalmente corregir errores.

### Ethernet

El estándar más común para redes cableadas:

```
┌─────────────────────────────────────────────────────────┐
│                   Ethernet Frame                         │
├────────────┬────────────┬────────────┬──────────────────┤
│ Preamble   │ Dest MAC   │ Src MAC    │ Type/Length      │
│ (8 bytes)  │ (6 bytes)  │ (6 bytes)  │ (2 bytes)        │
├────────────┼────────────┼────────────┼──────────────────┤
│                                          Payload (46-1500) │
│                                          + FCS (4 bytes) │
└────────────┴────────────┴────────────┴──────────────────┘
```

**Campos clave:**
- **Dest MAC**: Dirección MAC de destino (6 bytes = 48 bits)
- **Src MAC**: Dirección MAC de origen
- **Type**: 0x0800 = IPv4, 0x86DD = IPv6, 0x8100 = VLAN tagged
- **FCS**: Frame Check Sequence — detección de errores (CRC)

### WiFi (IEEE 802.11)

WiFi es esencialmente Ethernet inalámbrico. Usa las mismas direcciones MAC pero con mecanismos adicionales:

- **CSMA/CA**: Acceso múltiple con detección de portadora y evitación de colisiones
- **Handshakes de asociación**: 4-way handshake para conexión segura (WPA2/WPA3)
- **Beacon frames**: Los access points broadcastean su existencia

### MAC Address

Una MAC address es una dirección única de 48 bits (6 bytes = 12 hexadecimales):

```
AA:BB:CC:DD:EE:FF
│  │  │  │  │  │
│  │  │  │  │  └─ Identificador único del dispositivo
│  │  │  └─────── Identificador único del dispositivo
│  │  └────────── Identificador único del dispositivo
│  └───────────── OUI (Organizationally Unique Identifier) — fabricante
└───────────────── OUI — fabricante

Ejemplo:
00:1A:2B:3C:4D:5E
  │  │  │
  │  │  └─ Fabricante: Cisco (OUI 00:1A:2B)
  └─────── Identificador asignado por Cisco
```

> [!tip] MAC address spoofing
> Puedes cambiar tu MAC address en Linux:
> ```bash
> sudo ip link set dev eth0 address AA:BB:CC:DD:EE:FF
> ```
> Sin embargo, esto solo afecta a la red local. Internet no conoce tu MAC.

## Capa 1: Física

La capa física define cómo se transmiten los **bits** a través del medio físico: cables de cobre, fibra óptica, ondas de radio.

**Responsabilidad:** Transmitir bits crudos a través del medio físico.

**Medios:**
| Medio | Velocidad | Distancia | Descripción |
|-------|-----------|-----------|-------------|
| **Cobre (Cat5e/Cat6)** | 1-10 Gbps | 100m | Ethernet tradicional |
| **Fibra óptica** | 10-400 Gbps | Km | Luz a través de vidrio |
| **WiFi (802.11ac/ax)** | 1-10 Gbps | ~50m | Radiofrecuencia |
| **Coaxial** | 1-10 Gbps | 500m | Cable de TV/internet |
| **Radio (5G/LTE)** | 100 Mbps - 1 Gbps | Km | Telecom |

## Encapsulación: cómo se construye un packet

Cuando envías una petición HTTP, los datos pasan por cada capa y cada una añade su header:

```
1. Tu aplicación genera datos HTTP:
   "GET / HTTP/1.1\r\nHost: ejemplo.com\r\n\r\n"

2. Capa de Transporte (TCP) añade header TCP:
   [TCP header] + "GET / HTTP/1.1..."
   El TCP asigna: src port (random), dst port (80), seq number, ACK

3. Capa de Red (IP) añade header IP:
   [IP header] + [TCP header] + "GET / HTTP/1.1..."
   El IP asigna: src IP, dst IP, TTL

4. Capa de Enlace (Ethernet) añade header y trailer:
   [Ethernet header] + [IP header] + [TCP header] + datos + [FCS]
   El Ethernet asigna: src MAC, dst MAC
   El FCS calcula CRC para detección de errores

5. Capa Física: convierte todo a bits (0s y 1s) y los envía por el cable
```

### Tamaño típico de headers

| Capa | Header size |
|------|-------------|
| Ethernet | 14 bytes + 4 bytes FCS |
| IP (v4) | 20-60 bytes |
| TCP | 20-60 bytes |
| **Total overhead** | ~38-82 bytes por packet |

> [!tip] MTU (Maximum Transmission Unit)
> El MTU máximo de Ethernet es **1500 bytes** (incluye header IP). Esto significa que el payload útil (datos) es máximo 1460 bytes (1500 - 20 bytes header IP).
> Si los datos exceden 1460 bytes, se fragmentan en múltiples packets.

## TCP/IP: el modelo real

TCP/IP es el modelo que **realmente se usa** en Internet. Es más simple que OSI con solo 4 capas:

| Modelo OSI (7 capas) | Modelo TCP/IP (4 capas) | Protocolos clave |
|---------------------|------------------------|------------------|
| 7. Aplicación | 4. Aplicación | HTTP, DNS, SMTP, SSH, FTP, WebSocket |
| 6. Presentación | | SSL/TLS, TLS, gzip |
| 5. Sesión | | |
| 4. Transporte | 3. Transporte | TCP, UDP, SCTP |
| 3. Red | 2. Internet | IP, ICMP, ARP, IGMP |
| 2. Enlace de datos | 1. Acceso a red | Ethernet, WiFi, PPP, ARP |
| 1. Física | | Cables, fibra, radio |

> [!tip] ¿Por qué dos modelos?
> - **OSI** es un modelo teórico de referencia — útil para entender y diagnosticar problemas
> - **TCP/IP** es el modelo implementado — es lo que realmente funciona en Internet

## Resumen

- OSI tiene 7 capas, cada una con responsabilidades específicas
- TCP/IP tiene 4 capas y es el modelo real de Internet
- Capa 7 (Aplicación): HTTP, DNS, SMTP — lo que el usuario ve
- Capa 4 (Transporte): TCP (fiable) vs UDP (rápido)
- Capa 3 (Red): IP enrutamiento, ARP resolución, ICMP diagnóstico
- Capa 2 (Enlace): Ethernet, WiFi, MAC addresses
- Capa 1 (Física): cables, fibra, radio — bits crudos
- Los datos se encapsulan en cada capa: cada una añade su header

> [!quote] La clave
> Las capas de red son como una cadena de embalaje: cada capa envuelve los datos de la capa superior con su propio header. Para enviar un email, el SMTP (capa 7) envuelve el texto con un header TCP (capa 4), que envuelve el payload con un header IP (capa 3), que envuelve todo con un header Ethernet (capa 2).

## Conexión con el resto de la wiki

| Concepto tocado | Artículo en profundidad |
|-----------------|------------------------|
| TCP vs UDP | [[01-que-es-internet]] (capa de transporte) |
| Routing | [[16-routing-subnetting]] (routing, subnetting, CIDR) |
| Firewalls | [[17-firewalls-proxies-loadbalancers]] |
| ARP | [[12-puertos]] (MAC addresses) |
