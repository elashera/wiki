# Cómo navegar: de URL a página

> [!tip] El viaje completo
> Cuando escribes `https://www.ejemplo.com:8443/index.html` y presionas Enter, ocurre una cadena de **más de 30 pasos**. Este artículo los explica todos, uno por uno.

## La URL descompuesta

```
https://www.ejemplo.com:8443/index.html
│     │             │     │     │
│     │             │     │     └─ Ruta (path)
│     │             │     └─────── Puerto (port) — opcional, default 443 si HTTPS
│     │             └───────────── Dominio (hostname)
│     └─────────────────────────── Protocolo (scheme)
└────────────────────────────────── La URL completa
```

Cada parte tiene un trabajo específico en el viaje:

| Parte | Qué hace | ¿Necesaria? |
|-------|----------|-------------|
| `https://` | Protocolo — decide si la conexión es segura | Sí |
| `www.ejemplo.com` | Dominio — qué servidor quieres | Sí |
| `:8443` | Puerto — qué "puerta" del servidor | No (usa default: 80 HTTP, 443 HTTPS) |
| `/index.html` | Ruta — qué recurso dentro del servidor | No (por default `/`) |

> [!important] Default de puertos
> - HTTP → puerto 80 (si escribes `http://ejemplo.com` va al 80)
> - HTTPS → puerto 443 (si escribes `https://ejemplo.com` va al 443)
> - Si usas otro puerto (ej. :8080), tienes que escribirlo explícitamente

---

## El viaje paso a paso

### Paso 1: El navegador analiza la URL

Tu navegador parsea la URL y extrae:
- Protocolo: `https`
- Host: `www.ejemplo.com`
- Puerto: `8443`
- Path: `/index.html`

También verifica si la URL tiene sentido. Si escribes `htp://`, te dará un error porque no reconoce el protocolo.

### Paso 2: El navegador consulta su caché

Antes de hacer **cualquier** petición de red, el navegador consulta varias cachés internas:

```
¿Tengo esta página en caché?
    │
    ├── ¿Está en el histórico de navegación? (para el botón "atrás")
    ├── ¿Tengo el HTML en memory cache? (recarga con F5)
    ├── ¿Tengo el HTML en disk cache? (recarga con Ctrl+Shift+R)
    └── ¿Tengo el DNS en caché? (para consultas futuras)
```

Si todo está en caché y es reciente, se salta todos los pasos siguientes y muestra la página al instante.

### Paso 3: DNS Lookup (Resolución de nombre)

El navegador **no sabe** qué es `www.ejemplo.com`. Solo entiende números (direcciones IP). Necesita un **traductor**: el DNS.

#### Cómo funciona la resolución DNS

El navegador consulta **su propia caché DNS primero**, luego el sistema operativo:

```
1. ¿Está en el DNS cache del navegador?
       ├── SÍ → Usar esa IP. Listo.
       └── NO → Continuar...
              │
              ▼
2. ¿Está en el DNS cache del sistema operativo?
       ├── SÍ → Usar esa IP. Listo.
       └── NO → Continuar...
              │
              ▼
3. ¿Dónde está el resolver DNS?
       ├── Router de casa (DNS del ISP, ej. 192.168.1.1)
       ├── DNS público (ej. 1.1.1.1 de Cloudflare, 8.8.8.8 de Google)
       └── Configurado manualmente (en /etc/resolv.conf en Linux)
              │
              ▼
4. El resolver pregunta al DNS
       ├── ¿Tiene esta IP en su caché? → Respuesta rápida ✓
       └── NO → Hacer consulta recursiva al sistema DNS global
                ├── Root DNS server (.com)
                ├── TLD DNS server (ejemplo.com)
                └── Authoritative DNS server (www.ejemplo.com)
```

> [!note] DNS recursivo vs iterativo
> - **Recursive**: El resolver (tu DNS, ej. 1.1.1.1) hace **todo** el trabajo. Tú solo esperas la respuesta. Es lo que hacen los clientes DNS normalmente.
> - **Iterativo**: Cada servidor te dice "ve a preguntar a otro". Es lo que hacen los servidores entre ellos.

#### Los servidores raíz

Hay solo **13 grupos de servidores raíz** en el mundo (identificados por letras A-M). Cada grupo tiene cientos de servidores físicos repartidos por el mundo (anycast).

```
¿Quién tiene la IP de ejemplo.com?
    │
    ▼
Root DNS Server (A-M)
    │ → "No sé la de ejemplo.com, pero los servers .com están aquí: ..."
    ▼
TLD Server (.com)
    │ → "No sé la de www, pero el authoritative de ejemplo.com está aquí: ..."
    ▼
Authoritative DNS Server de ejemplo.com
    │ → "www.ejemplo.com tiene la IP 93.184.216.34"
```

**TTL (Time To Live)**: Cada respuesta DNS tiene un TTL, por ejemplo 300 segundos (5 minutos). Esto significa:
- El resolver guarda esa IP en caché durante 5 minutos
- Cualquier otra persona que pregunte por `ejemplo.com` en esos 5 min recibe la misma IP guardada
- Después de 5 minutos, el resolver olvida la IP y vuelve a consultar

> [!tip] TTL bajo vs TTL alto
> - **TTL bajo** (ej. 60s): Útil cuando cambias de servidor frecuentemente. La propagación es rápida.
> - **TTL alto** (ej. 86400 = 24h): Mejora el rendimiento del DNS porque los resolvers cachéan más tiempo.

### Paso 4: DNS cache del navegador

Si el DNS cache del sistema operativo tampoco tenía la IP, ahora el resolver devuelve la respuesta y **el navegador la guarda en su propia caché** para consultas futuras al mismo dominio.

### Paso 5: Creación de la conexión TCP (TCP Handshake)

Ahora que tenemos la IP (ej. `93.184.216.34`), necesitamos establecer una conexión. Como usamos HTTPS, en realidad hacemos TLS sobre TCP, pero primero viene el handshake de TCP:

```
Cliente                          Servidor
   │                                │
   │───── SYN ──────────────────────→ │  "Hola, quiero conectar"
   │                                │
   │←──── SYN-ACK ───────────────────│  "Te oí, yo también quiero"
   │                                │
   │───── ACK ──────────────────────→ │  "Perfecto, conexión establecida"
```

Esto se llama **TCP three-way handshake** y son 3 rondas de ida y vuelta (RTT). Después de esto, el canal TCP está listo.

> [!note] ¿Por qué hace falta el handshake?
> Porque Internet es inherentemente no confiable. Los paquetes pueden perderse. El handshake garantiza que:
> 1. El cliente puede enviar datos
> 2. El servidor puede recibir datos
> 3. Ambos están de acuerdo en los números de secuencia iniciales

### Paso 6: TLS Handshake (si es HTTPS)

Esto es **más complejo** que el TCP handshake. Aquí es donde se negocia la seguridad.

```
Cliente                          Servidor
   │                                │
   │─── ClientHello ──────────────→ │  "Hola, soporto TLS 1.3, estos son mis cipher suites"
   │                                │
   │←── ServerHello ────────────────│  "OK, TLS 1.3. Usamos cipher suite X. Aquí mi certificado"
   │                                │
   │←── Certificate ────────────────│  "Mi certificado firmado por una CA de confianza"
   │                                │
   │←── ServerKeyExchange ──────────│  "Aquí mis parámetros criptográficos"
   │                                │
   │─── ClientKeyExchange ──────────→ │  "Generé una clave pública. Aquí está"
   │                                │
   │←── ServerFinished ─────────────│  "Verifica mi hash para confirmar que soy yo"
   │                                │
   │─── ClientFinished ────────────→ │  "Y aquí el mío"
   │                                │
   │══════ Canal cifrado listo ══════│
```

#### ¿Qué pasa durante el TLS handshake?

1. **Negociación de versión**: Cliente y servidor acuerdan qué versión de TLS usar (TLS 1.2, 1.3). TLS 1.3 es más rápido y seguro.

2. **Autenticación del servidor**: El servidor muestra su certificado. El cliente verifica:
   - ¿Está firmado por una **CA (Certificate Authority)** de confianza? (Let's Encrypt, DigiCert, etc.)
   - ¿El certificado es para **este dominio**? (verifica el Common Name o SAN)
   - ¿El certificado **no ha expirado**?

3. **Intercambio de claves**: Se genera una clave de sesión simétrica (AES, ChaCha20) que se usará para cifrar toda la comunicación. Esto se hace con **asymmetric cryptography** (RSA, ECDHE) para evitar enviar la clave en claro.

4. **Confirmación final**: Ambos lados confirman que el handshake fue exitoso.

> [!tip] TLS 1.2 vs TLS 1.3
> | Característica | TLS 1.2 | TLS 1.3 |
> |----------------|---------|---------|
> | RTT del handshake | 2 rondas (3 pasos) | 1 ronda (1-0 RTT) |
> | Cipher suites | ~300 opciones | ~10 opciones (solo las seguras) |
> | Forward secrecy | Opcional (con DHE) | Obligatorio (con ECDHE) |
> | Compressión | Permitida | Deshabilitada (ataque CRIME) |
> | Resumption | Session ID, session tickets | PSK (Pre-Shared Keys) |

### Paso 7: La petición HTTP

Ahora que el canal seguro está establecido, el navegador envía la petición HTTP:

```
GET /index.html HTTP/2
Host: www.ejemplo.com
User-Agent: Mozilla/5.0 ...
Accept: text/html
Accept-Encoding: gzip, br
Accept-Language: es-ES
Cookie: session=abc123
```

> [!tip] ¿Qué es una petición HTTP?
> Una petición HTTP tiene 4 partes:
> 1. **Método**: GET, POST, PUT, DELETE, etc. (dice **qué quieres hacer**)
> 2. **URI/Path**: `/index.html` (dice **a qué recurso**)
> 3. **Headers**: Metadatos (user-agent, accept, cookies, etc.)
> 4. **Body**: Datos adicionales (vacío en GET, contenido en POST)

Para más detalles, ver [[05-http-profundo|HTTP en profundidad]] y [[06-status-codes|Códigos de estado]].

### Paso 8: El servidor procesa la petición

El servidor web (Nginx, Apache, etc.) recibe la petición y:
1. Parsea la petición
2. Busca el archivo `index.html` en su directorio de documentos
3. Si no existe, verifica si hay un `index.html` en un subdirectorio
4. Lee el archivo del disco
5. Aplica cualquier procesamiento (SSR, rewriting, proxy a otro servicio)
6. Envía la respuesta

### Paso 9: La respuesta HTTP

El servidor responde:

```
HTTP/2 200 OK
Content-Type: text/html; charset=UTF-8
Content-Length: 4567
Cache-Control: public, max-age=3600
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Frame-Options: DENY
ETag: "abc123-4567"

<!DOCTYPE html>
<html>
<head>...</head>
<body><h1>¡Hola!</h1></body>
</html>
```

El primer bloque de líneas (antes del doble salto de línea) son los **headers de respuesta**. Después viene el **body** (el HTML).

> [!tip] Status codes
> - **200 OK**: Éxito
> - **301/302**: Redirección
> - **304 Not Modified**: Usar la caché (si ya la tienes)
> - **404**: No encontrado
> - **500**: Error del servidor

### Paso 10: El navegador renderiza la página

El navegador recibe el HTML y:
1. Parsea el HTML y construye el **DOM tree**
2. Si encuentra `<link>` o `<style>`, descarga y construye el **CSSOM**
3. Combina DOM + CSSOM en el **render tree**
4. Calcula la **layout** (dónde está cada elemento en la pantalla)
5. **Pinta** los píxeles en pantalla
6. Si encuentra `<script>`, los ejecuta
7. Si encuentra `<img>`, descarga las imágenes

### Paso 11: Peticiones de recursos adicionales

El HTML suele hacer referencia a otros recursos: CSS, JavaScript, imágenes, fuentes. El navegador los descarga en **paralelo** (varias conexiones simultáneas):

```
GET /css/style.css         HTTP/2 → 200 (15KB)
GET /js/app.js             HTTP/2 → 200 (120KB)
GET /images/hero.jpg       HTTP/2 → 200 (200KB)
GET /fonts/roboto.woff2    HTTP/2 → 200 (45KB)
```

> [!note] HTTP/2 multiplexación
> Con HTTP/1.1, estas peticiones se hacían en serie (una tras otra) o con conexiones paralelas limitadas (6 por dominio). Con HTTP/2, todas van por **una sola conexión** pero multiplexadas (intercaladas), así que no hay head-of-line blocking.

### Paso 12: Fin

La página está completamente renderizada. El usuario la puede ver e interactuar.

---

## Resumen del flujo completo

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Usuario escribe URL en el navegador                               │
│    https://www.ejemplo.com:8443/index.html                          │
├─────────────────────────────────────────────────────────────────────┤
│ 2. Navegador consulta su caché                                       │
├─────────────────────────────────────────────────────────────────────┤
│ 3. DNS lookup → traduce dominio a IP                                │
│    www.ejemplo.com → 93.184.216.34 (ver [[03-dns-profundo]])        │
├─────────────────────────────────────────────────────────────────────┤
│ 4. TCP handshake (3-way) → establece conexión                       │
├─────────────────────────────────────────────────────────────────────┤
│ 5. TLS handshake → establece canal cifrado                          │
│    (ver [[07-https-tls]])                                           │
├─────────────────────────────────────────────────────────────────────┤
│ 6. Envía petición HTTP con headers y cookies                        │
│    (ver [[05-http-profundo]], [[09-cookies-sesiones]])              │
├─────────────────────────────────────────────────────────────────────┤
│ 7. Servidor procesa y responde con HTTP                             │
│    (ver [[06-status-codes]])                                        │
├─────────────────────────────────────────────────────────────────────┤
│ 8. Navegador descarga recursos adicionales (CSS, JS, imágenes)      │
├─────────────────────────────────────────────────────────────────────┤
│ 9. Navegador renderiza la página                                    │
└─────────────────────────────────────────────────────────────────────┘
```

## Conexión con el resto de la wiki

| Concepto tocado | Artículo en profundidad |
|-----------------|------------------------|
| DNS | [[03-dns-profundo]] |
| HTTP / Headers | [[05-http-profundo]] |
| Status codes | [[06-status-codes]] |
| TLS / HTTPS | [[07-https-tls]] |
| Cookies / Sesiones | [[09-cookies-sesiones]] |
| Puertos | [[12-puertos-localhot-localhost]] |
| Servidores | [[14-servidores-procesos-processos]] |

## Resumen

- Una URL tiene 4 partes: protocolo, dominio, puerto (opcional), ruta
- El navegador consulta cachés antes de hacer cualquier cosa
- DNS traduce nombres a IPs (puede tardar 20-200ms)
- TCP handshake necesita 3 rondas
- TLS handshake necesita varios pasos (negociación, certificado, claves)
- La petición HTTP lleva headers, cookies, método y path
- El servidor responde con status code + headers + body
- El navegador renderiza y descarga recursos adicionales en paralelo

> [!quote] La clave
> Todo este proceso (escribiendo a mano) toma entre 200ms y 2 segundos dependiendo de la velocidad de red y la caché. Si todo está en caché, puede ser instantáneo. Por eso las buenas prácticas de caché son tan importantes en el rendimiento web.
