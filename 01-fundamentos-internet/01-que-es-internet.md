# Qué es Internet

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

## El modelo cliente-servidor

La mayoría de las interacciones en Internet siguen el modelo **cliente-servidor**:

| Rol | Qué hace | Ejemplo |
|-----|----------|---------|
| **Cliente** | Inicia la conexión, pide información | Tu navegador (Chrome, Firefox) |
| **Servidor** | Escucha conexiones, responde con datos | Un servidor web (Nginx, Apache) |

### Un ejemplo concreto

Cuando escribes `https://google.com` en tu navegador:

1. Tu navegador (cliente) envía una petición
2. Esa petición viaja por tu red → tu ISP → Internet → el servidor de Google
3. El servidor de Google responde con el HTML de la página
4. Tu navegador recibe el HTML y lo muestra

Pero esto es una simplificación enorme. En la práctica, lo que ocurre entre el punto 2 y 3 es el tema del siguiente artículo: [[02-como-navegar-de-url-a-pagina|Cómo navegar de URL a página]].

## El modelo TCP/IP

Para que todo esto funcione, los dispositivos necesitan **un lenguaje común**. TCP/IP es ese lenguaje: un conjunto de protocolos que define cómo se envían y reciben los datos.

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

#### Capa de Aplicación

Aquí es donde viven HTTP, DNS, FTP, SMTP. Es la capa que tú usas directamente. Cuando tu navegador pide una página web, está usando HTTP (que a su vez viaja sobre TCP).

#### Capa de Transporte (TCP vs UDP)

Esta capa decide **cómo** se envían los datos:

| Característica | TCP (Transmission Control Protocol) | UDP (User Datagram Protocol) |
|----------------|-------------------------------------|------------------------------|
| **Fiabilidad** | Garantiza que todo llegue (reenvía lo perdido) | Best-effort (puede perder paquetes) |
| **Orden** | Los datos llegan en orden | No garantiza orden |
| **Velocidad** | Más lento (overhead de confirmaciones) | Más rápido |
| **Uso típico** | Web (HTTP), email, FTP | Streaming, videojuegos, DNS |

**¿Por qué HTTP usa TCP?** Porque necesitas que todas las imágenes, todo el HTML, todo el CSS llegue completo y en orden. Si se pierde un byte de una imagen, la imagen se corrompe. TCP garantiza que no pase.

**¿Por qué DNS usa UDP?** Una pregunta de DNS es muy pequeña (unas pocas decenas de bytes). Si se pierde, el cliente reenvía la consulta. Es más rápido.

> [!tip] Regla mnemotécnica
> - Si el dato **tiene que llegar completo** (página web, email, archivo) → TCP
> - Si es más importante la **velocidad** que la perfección (video en directo, voz, DNS) → UDP

#### Capa de Internet (IP)

IP (Internet Protocol) se encarga de:
- **Direccionamiento**: Cada dispositivo tiene una dirección IP única en su red
- **Enrutamiento**: Encontrar el camino más eficiente entre origen y destino

Tu dispositivo tiene una IP privada (192.168.1.5, por ejemplo) dentro de tu red local, y tu router tiene una IP pública que es la que se ve en Internet. La conexión entre ambas es **NAT**, sobre lo que puedes leer en [[13-nat-red|NAT]].

#### Capa de Enlace

Ethernet, WiFi, Bluetooth. Es la capa física más cercana a tu hardware. Aquí se definen los **MAC addresses** (direcciones físicas de las tarjetas de red).

### Lo que necesitas entender de TCP/IP

- **Los datos viajan fragmentados**: Ninguna petición HTTP se envía como un bloque gigante. Se divide en **packets** de ~1500 bytes (MTU).
- **Cada packet lleva**: la dirección de destino, un número de secuencia, checksums (para verificar integridad) y más metadatos.
- **Los routers solo miran la capa de Internet**: Los routers de Internet solo ven las direcciones IP de origen y destino. No saben qué contiene el paquete (HTTP, DNS, lo que sea).
- **TCP reensambla en destino**: El servidor (o cliente) reordena los packets según el número de secuencia y reconstituye el mensaje original.

## Conexión con el resto de la wiki

| Concepto | Artículo siguiente |
|----------|-------------------|
| ¿Qué pasa después de escribir una URL? | [[02-como-navegar-de-url-a-pagina]] — El viaje completo |
| ¿Qué es esa dirección IP? | [[03-dns-profundo]] — DNS, [[12-puertos-localhot-localhost]] — Puertos e IPs |
| ¿Cómo viajan los datos? | [[14-servidores-procesos-processos]] — Servidores y procesos |
| ¿Qué es un servidor web? | [[14-servidores-procesos-processos]] — Un servidor es un proceso que escucha en un puerto |

## Resumen

- Internet es una **red de redes**, no es una entidad única.
- Funciona porque todos usan **TCP/IP**, un conjunto de reglas acordado globalmente.
- El modelo **cliente-servidor** es la forma más común de interacción: un cliente pide, un servidor responde.
- Los datos viajan **fragmentados en packets** a través de múltiples routers.
- TCP garantiza fiabilidad, UDP da velocidad a cambio de posibilidad de pérdida.

> [!quote] La clave
> Internet no es mágica. Es una cadena de procesos cada uno con un trabajo específico, conectados por protocolos que todos entienden. Si entiendes qué hace cada pieza, entiendes Internet.
