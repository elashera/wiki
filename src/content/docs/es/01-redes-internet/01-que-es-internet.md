---
title: "¿Qué es Internet?"
description: "Fundamentos de Internet: qué es realmente, el modelo cliente-servidor, el protocolo TCP/IP y cómo funciona la red de redes a nivel técnico."
---

# ¿Qué es Internet?

> [!tip] Para empezar
> Piensa en Internet como una red de carreteras que conecta ciudades (ordenadores). Cada ciudad tiene direcciones (IPs), hay camiones de reparto (paquetes), y protocolos de tráfico (TCP/IP) que garantizan que la mercancía llegue a su destino.

## ¿Qué es Internet en términos técnicos?

Internet es **una red global de redes interconectadas** que utiliza el protocolo TCP/IP para comunicarse. No es un cable, no es una nube, es una infraestructura física formada por:

- **Millones de dispositivos** (servidores, routers, switches, ordenadores, móviles)
- **Cables de fibra óptica submarinos y terrestres** (sí, la mayor parte del tráfico viaja por cables bajo el mar)
- **Centros de datos** por todo el mundo
- **Proveedores de Internet (ISP)** que conectan a sus clientes con el resto de la red

### La red de redes

Cada red (de una empresa, de una universidad, de un ISP) se conecta con otras a través de **puntos de intercambio de Internet (IXP — Internet Exchange Points)**. Esto es fundamental: Internet no es propiedad de nadie, es el resultado de miles de redes independientes que decidieron comunicarse entre sí usando las mismas reglas.

```
Tu ISP (Movistar/Orange/Vodafone)
       │
       ▼
┌─────────────────────┐
│    Backbone ISP      │──────┐
│  (fibra óptica 100G) │      │
└─────────────────────┘      │
       │                      │
       ▼                      ▼
┌─────────────────────┐  ┌─────────────────────┐
│     IXP local         │  │    Router de borde    │
│ (punto de intercambio)│  │ (tu router de casa)   │
└─────────────────────┘  └─────────────────────┘
       │                            │
       ▼                            ▼
Centros de datos            Tu router doméstico
(CDN, clouds)               (192.168.1.1)
```

### Los actores principales

| Actor | Qué hace | Ejemplo |
|-------|----------|---------|
| **ISP (Internet Service Provider)** | Vende acceso a Internet a usuarios y empresas | Movistar, Orange, Vodafone, Telmex |
| **IXP (Internet Exchange Point)** | Punto físico donde las redes se conectan entre sí | AMS-IX (Ámsterdam), DE-CIX (Frankfurt), MEX-IX (México) |
| **Tier 1 ISP** | Redes que cubren continentes enteros y no pagan por transitación | AT&T, NTT, Deutsche Telekom, Telmex |
| **CDN (Content Delivery Network)** | Red distribuida de servidores para caché de contenido | Cloudflare, Akamai, Fastly, AWS CloudFront |
| **Data Center** | Instalaciones con servidores, redundancia eléctrica y de red | AWS, Google Cloud, Azure, Equinix |

> [!tip] ¿Cuántos cables hay bajo el mar?
> Existen más de **1.3 millones de kilómetros** de cables submarinos. Si los pusieras en fila, darían la vuelta al mundo 30 veces. El tráfico de Internet cruza los océanos por estos cables, no por satélites.

## El modelo cliente-servidor

La mayoría de las interacciones en Internet siguen el modelo **cliente-servidor**:

| Rol | Qué hace | Ejemplo |
|-----|----------|---------|
| **Cliente** | Inicia la conexión, pide información | Tu navegador (Chrome, Firefox), curl, un app móvil |
| **Servidor** | Escucha conexiones, responde con datos | Un servidor web (Nginx, Apache, Caddy) |

### Un ejemplo concreto

Cuando escribes `https://google.com` en tu navegador:

1. Tu navegador (cliente) envía una petición
2. Esa petición viaja por tu red → tu ISP → Internet → el servidor de Google
3. El servidor de Google responde con el HTML de la página
4. Tu navegador recibe el HTML y lo muestra

Pero esto es una simplificación enorme. En la práctica, lo que ocurre entre el punto 2 y 3 es el tema del siguiente artículo: [[02-como-navegar-de-url-a-pagina]].

### Cliente-servidor vs P2P

El modelo cliente-servidor no es el único:

| Modelo | Descripción | Ejemplo |
|--------|-------------|---------|
| **Cliente-servidor** | Un servidor responde a muchos clientes | Web, email, APIs |
| **P2P (peer-to-peer)** | Los participantes son clientes y servidores | BitTorrent, Bitcoin, WebRTC |
| **Pub/Sub (publicar/suscribir)** | Un emisor publica, varios suscriptores reciben | MQTT, Redis pub/sub, Kafka |

> [!note] P2P en la práctica
> Aunque BitTorrent y Bitcoin son P2P, la mayor parte de Internet sigue siendo cliente-servidor. Los videojuegos online también usan este modelo: tu consola se conecta a un servidor centralizado del juego.

## El modelo TCP/IP

Para que todo esto funcione, los dispositivos necesitan **un lenguaje común**. TCP/IP es ese lenguaje: un conjunto de protocolos que define cómo se envían y reciben los datos.

### ¿Por qué TCP/IP y no algo más?

Imagina que dos personas de países distintos quieren hablar. Si cada uno habla un idioma diferente, no hay comunicación. TCP/IP es el "idioma común" que todos los dispositivos de Internet entienden. Fue diseñado en los años 70 por **Vint Cerf y Bob Kahn**, y ha sobrevivido a décadas de tecnología porque es:

- **Simple**: Protocolos bien definidos y fáciles de implementar
- **Extensible**: Nuevos protocolos se añaden sin romper los existentes
- **Escalable**: Funciona desde un smartphone hasta un supercomputador

### Capas del modelo TCP/IP (simplificado)

Piensa en TCP/IP como una cadena de embalaje:

```
┌─────────────────────────────────┐
│  Capa de Aplicación (HTTP, DNS) │ ← Tu petición "get /home"
│  ┌─────────────────────────────┐│
│  │  Capa de Transporte (TCP)   │ ← "Dividir en trozos, ordenarlos, reenviar si falta algo"
│  │  ┌─────────────────────────┐│
│  │  │  Capa de Internet (IP)  │ ← "Poner dirección de destino, buscar la ruta"
│  │  │  ┌─────────────────────┐│
│  │  │  │  Capa de Enlace      │ ← "Poner en el cable/WiFi"
│  │  │  │  (Ethernet, WiFi)   ││
│  │  │  └─────────────────────┘│
│  │  └─────────────────────────┘│
│  └─────────────────────────────┘│
└─────────────────────────────────┘
```

Cada capa **encapsula** la información de la capa superior:

```
Tu mensaje: "GET / HTTP/1.1"
  ↓ [Capa de Aplicación añade HTTP]
GET / HTTP/1.1
  ↓ [Capa de Transporte añade TCP]
[TCP header: src port, dst port, seq, ack] + "GET / HTTP/1.1"
  ↓ [Capa de Internet añade IP]
[IP header: src IP, dst IP] + [TCP header + datos]
  ↓ [Capa de Enlace añade Ethernet]
[Ethernet header: src MAC, dst MAC] + [IP header + TCP + datos]
  ↓ [Se envía por el cable/WiFi]
```

#### Capa de Aplicación

Aquí es donde viven HTTP, DNS, FTP, SMTP, SSH, WebSocket. Es la capa que tú usas directamente. Cada protocolo de aplicación define su propio formato de mensaje y semántica.

**Protocolos principales:**

| Protocolo | Puerto | Función |
|-----------|--------|---------|
| HTTP | 80 | Transferencia web |
| HTTPS | 443 | HTTP cifrado (HTTP sobre TLS) |
| DNS | 53 | Resolución de nombres |
| SMTP | 25 | Envío de email |
| IMAP/POP3 | 143/993 / 110/995 | Recepción de email |
| SSH | 22 | Acceso remoto seguro |
| FTP | 21 | Transferencia de archivos |
| WebSocket | 443 (o 80) | Comunicación bidireccional en tiempo real |

> [!tip] Tu navegador usa múltiples protocolos simultáneamente
> Cuando visitas una página web, tu navegador usa:
> 1. **DNS** (puerto 53, UDP) para resolver el dominio
> 2. **TCP** (puerto 443) para establecer la conexión
> 3. **TLS** (puerto 443) para cifrar
> 4. **HTTP** (puerto 443) para pedir la página
> 5. **WebSocket** (opcional) para actualizaciones en tiempo real

#### Capa de Transporte (TCP vs UDP)

Esta capa decide **cómo** se envían los datos:

| Característica | TCP (Transmission Control Protocol) | UDP (User Datagram Protocol) |
|----------------|-------------------------------------|------------------------------|
| **Fiabilidad** | Garantiza que todo llegue (reenvía lo perdido) | Best-effort (puede perder paquetes) |
| **Orden** | Los datos llegan en orden | No garantiza orden |
| **Velocidad** | Más lento (overhead de confirmaciones) | Más rápido |
| **Conexión** | Orientado a conexión (handshake) | Sin conexión |
| **Control de flujo** | Sí (window size) | No |
| **Control de congestión** | Sí (slow start, congestion avoidance) | No |
| **Uso típico** | Web (HTTP), email, FTP | Streaming, videojuegos, DNS |

**¿Por qué HTTP usa TCP?** Porque necesitas que todas las imágenes, todo el HTML, todo el CSS llegue completo y en orden. Si se pierde un byte de una imagen, la imagen se corrompe. TCP garantiza que no pase.

**¿Por qué DNS usa UDP?** Una pregunta de DNS es muy pequeña (unas pocas decenas de bytes). Si se pierde, el cliente reenvía la consulta. Es más rápido. Sin embargo, si la respuesta supera los 512 bytes, DNS usa TCP.

**¿Por qué el streaming de video usa UDP (a menudo)?** Si se pierde un frame de video, no importa — el siguiente frame llega en su lugar. Lo que importa es la velocidad y la fluidez, no la perfección.

> [!tip] Regla mnemotécnica
> - Si el dato **tiene que llegar completo** (página web, email, archivo) → TCP
> - Si es más importante la **velocidad** que la perfección (video en directo, voz, DNS) → UDP

#### Capa de Internet (IP)

IP (Internet Protocol) se encarga de:
- **Direccionamiento**: Cada dispositivo tiene una dirección IP única en su red
- **Enrutamiento**: Encontrar el camino más eficiente entre origen y destino

Tu dispositivo tiene una IP privada (192.168.1.5, por ejemplo) dentro de tu red local, y tu router tiene una IP pública que es la que se ve en Internet. La conexión entre ambas es **NAT**, sobre lo que puedes leer en [[13-nat-red]].

**IPv4 vs IPv6:**

| | IPv4 | IPv6 |
|--|------|------|
| **Tamaño** | 32 bits (4 bytes) | 128 bits (16 bytes) |
| **Formato** | 192.168.1.1 | 2001:0db8:85a3::8a2e:370:7334 |
| **Direcciones** | ~4.3 mil millones | ~3.4 × 10³⁸ |
| **Cabecera** | 20-60 bytes | 40 bytes fijos |
| **Autoconfiguración** | Requiere DHCP | SLAAC (sin DHCP) |
| **Seguridad** | IPsec opcional | IPsec integrado |

> [!caution] Agotamiento de IPv4
> Las direcciones IPv4 se agotaron oficialmente en 2011. Con NAT pudimos延长时间, pero IPv6 es la solución definitiva. Cada dispositivo puede tener su propia IP pública sin necesidad de NAT.

#### Capa de Enlace

Ethernet, WiFi, Bluetooth. Es la capa física más cercana a tu hardware. Aquí se definen los **MAC addresses** (direcciones físicas de las tarjetas de red).

**¿Qué es un MAC address?** Es una dirección única asignada al fabricante de tu tarjeta de red. Tiene 6 pares de hexadecimales: `00:1A:2B:3C:4D:5E`. No cambia (a menos que lo spoofees), a diferencia de la IP que puede cambiar cada vez que te conectas a una red.

### Lo que necesitas entender de TCP/IP

- **Los datos viajan fragmentados**: Ninguna petición HTTP se envía como un bloque gigante. Se divide en **packets** de ~1500 bytes (MTU — Maximum Transmission Unit).
- **Cada packet lleva**: la dirección de destino, un número de secuencia, checksums (para verificar integridad) y más metadatos.
- **Los routers solo miran la capa de Internet**: Los routers de Internet solo ven las direcciones IP de origen y destino. No saben qué contiene el paquete (HTTP, DNS, lo que sea).
- **TCP reensambla en destino**: El servidor (o cliente) reordena los packets según el número de secuencia y reconstituye el mensaje original.
- **Los switches trabajan en la capa de Enlace**, los routers en la capa de Internet: Esta distinción es fundamental para entender la red.

### El modelo OSI: 7 capas vs TCP/IP: 4 capas

Existe otro modelo de red que verás en los libros: el **modelo OSI** (Open Systems Interconnection), que tiene 7 capas. TCP/IP es más práctico con 4. Ambos modelos describen lo mismo, pero con diferente nivel de detalle:

| Modelo OSI (7 capas) | Modelo TCP/IP (4 capas) | Protocolos |
|---------------------|------------------------|------------|
| 7. Aplicación | 4. Aplicación | HTTP, DNS, SMTP, SSH |
| 6. Presentación | | SSL/TLS, JPEG, GIF |
| 5. Sesión | | NetBIOS, RPC |
| 4. Transporte | 3. Transporte | TCP, UDP |
| 3. Red | 2. Internet | IP, ICMP, ARP |
| 2. Enlace de datos | 1. Acceso a red | Ethernet, WiFi, ARP |
| 1. Física | | Cables, hubs, fibra |

> [!tip] ¿Cuál usar?
> En la práctica, TCP/IP es el modelo real que se usa. OSI es útil para entender conceptos y para diagnóstico (cuando algo falla, puedes identificar en qué capa). Veremos el modelo OSI en detalle en [[15-modelo-osi-tcpip]].

## Conexexión con el resto de la wiki

| Concepto | Artículo siguiente |
|----------|-------------------|
| ¿Qué pasa después de escribir una URL? | [[02-como-navegar-de-url-a-pagina]] — El viaje completo |
| ¿Qué es esa dirección IP? | [[03-dns-profundo]] — DNS, [[12-puertos]] — Puertos e IPs |
| ¿Cómo viajan los datos? | [[14-servidores-procesos]] — Servidores y procesos |
| ¿Qué es un servidor web? | [[14-servidores-procesos]] — Un servidor es un proceso que escucha en un puerto |

## Resumen

- Internet es una **red de redes**, no es una entidad única.
- Funciona porque todos usan **TCP/IP**, un conjunto de reglas acordado globalmente.
- El modelo **cliente-servidor** es la forma más común de interacción: un cliente pide, un servidor responde.
- Los datos viajan **fragmentados en packets** a través de múltiples routers.
- TCP garantiza fiabilidad (todo llega), UDP prioriza velocidad.
- Cada capa de TCP/IP tiene una función específica: aplicación (datos), transporte (fiabilidad), internet (enrutamiento), enlace (hardware).

> [!quote] La clave
> Internet no es mágica. Es una cadena de procesos cada uno con un trabajo específico, conectados por protocolos que todos entienden. Si entiendes qué hace cada pieza, entiendes Internet.
