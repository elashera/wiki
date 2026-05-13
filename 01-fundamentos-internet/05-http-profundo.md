# HTTP en profundidad

> [!tip] HTTP en una frase
> HTTP (HyperText Transfer Protocol) es el **lenguaje** que usan los navegadores y servidores para comunicarse. Peticiones y respuestas, una y otra vez.

## ¿Qué es HTTP?

HTTP es un protocolo de solicitud/respuesta de **capa de aplicación**. Funciona sobre TCP (por defecto puerto 80, o 443 si es HTTPS).

### Características clave

| Característica | Descripción |
|---------------|-------------|
| **Request/Response** | El cliente pide, el servidor responde |
| **Stateless** | Cada petición es independiente. El servidor no "recuerda" la anterior (a menos que uses cookies/sesiones — ver [[09-cookies-sesiones]]) |
| **Sin conexión** | HTTP/1.1 mantiene la conexión (keep-alive), pero HTTP/1.0 la cierra después de cada respuesta |
| **Mediador** | Puedes pasar por proxies, CDN, load balancers sin que cambie el protocolo |
| **Extensible** | Nuevos métodos, headers y códigos se añaden sin romper compatibilidad |

## Estructura de una petición HTTP

```
GET /index.html HTTP/1.1
Host: www.ejemplo.com
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
Accept-Language: es-ES,es;q=0.9,en;q=0.8
Accept-Encoding: gzip, deflate, br
Connection: keep-alive
Cookie: session_id=abc123def456
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

[Cuerpo — vacío en GET]
```

### La línea de solicitud

```
GET /index.html HTTP/1.1
│     │            │
│     │            └── Versión del protocolo
│     │
│     └── Path (recurso solicitado)
│         /index.html
│         /api/users/42
│         /search?q=hello&page=1
│
└── Método HTTP
```

### Métodos HTTP

| Método | Seguro | Idempotente | Qué hace | Ejemplo |
|--------|--------|-------------|----------|---------|
| **GET** | Sí | Sí | Leer un recurso | `GET /api/users` |
| **HEAD** | Sí | Sí | Igual que GET pero sin body | `HEAD /api/users` |
| **POST** | No | No | Crear un recurso / ejecutar acción | `POST /api/users` con body |
| **PUT** | No | Sí | Reemplazar un recurso completo | `PUT /api/users/42` |
| **PATCH** | No | No | Actualizar parcialmente un recurso | `PATCH /api/users/42` |
| **DELETE** | No | Sí | Eliminar un recurso | `DELETE /api/users/42` |
| **OPTIONS** | Sí | Sí | Ver qué métodos soporta un recurso | `OPTIONS /api/users` |
| **CONNECT** | No | No | Crear tunnel (para HTTPS/WS) | `CONNECT www.ejemplo.com:443` |

#### Definiciones importantes

- **Seguro**: No modifica datos en el servidor. GET y HEAD son seguros.
- **Idempotente**: Hacer la misma petición múltiples veces produce el mismo resultado. GET, PUT, DELETE son idempotentes. POST NO lo es (crear el mismo usuario dos veces crea dos usuarios).

> [!caution] GET ≠ siempre leer
> Técnicamente, GET no debería tener efectos secundarios. Pero en la práctica, muchas APIs usan GET para métricas, logging, etc. Las buenas prácticas dicen que **GET no debe modificar datos**, pero la realidad es más gris.

#### POST vs PUT vs PATCH

```
# POST: Crear nuevo recurso
POST /api/users
Body: { "name": "Carlos", "email": "carlos@email.com" }
→ Crea un nuevo usuario. ID lo asigna el servidor.
→ NO es idempotente: dos POSTs = dos usuarios

# PUT: Reemplazar recurso completo
PUT /api/users/42
Body: { "name": "Carlos", "email": "carlos.nuevo@email.com", "age": 30 }
→ Reemplaza TODOS los campos del usuario 42. Si no envías "age", se borra.
→ ES idempotente: dos PUTs iguales = mismo resultado

# PATCH: Actualizar parcialmente
PATCH /api/users/42
Body: { "email": "carlos.nuevo@email.com" }
→ Solo cambia el campo que envías. Los demás se mantienen.
→ NO es idempotente (depende de la implementación)
```

## Headers de petición

Los headers son metadatos que acompañan a la petición. Se dividen en categorías:

### Headers universales (sirven en petición y respuesta)

| Header | Ejemplo | Descripción |
|--------|---------|-------------|
| `Cache-Control` | `max-age=3600` | Política de caché |
| `Connection` | `keep-alive` | Gestión de conexión |
| `Content-Length` | `1234` | Tamaño del cuerpo en bytes |
| `Content-Type` | `application/json` | Tipo de contenido del cuerpo |
| `Date` | `Thu, 11 May 2024 12:00:00 GMT` | Fecha de creación |
| `Host` | `www.ejemplo.com` | Dominio solicitado (requerido en HTTP/1.1) |
| `Trailer` | `Digest` | Headers que vienen al final del body |
| `Transfer-Encoding` | `chunked` | Cómo se codifica el body |
| `Upgrade` | `websocket` | Cambio de protocolo |
| `Via` | `1.1 proxy` | Protocolos usados por proxies |

### Headers de petición específicos

| Header | Ejemplo | Descripción |
|--------|---------|-------------|
| `Accept` | `text/html,application/json` | Qué tipos de respuesta acepta |
| `Accept-Encoding` | `gzip, br` | Qué codificaciones de compresión acepta |
| `Accept-Language` | `es-ES,es;q=0.9` | Idiomas preferidos (con pesos) |
| `Authorization` | `Bearer eyJ...` | Credenciales de autenticación |
| `Cookie` | `session_id=abc123` | Cookies del dominio |
| `If-Modified-Since` | `Thu, 01 May 2024 00:00:00 GMT` | Solo devuelve si cambió después |
| `If-None-Match` | `"abc123"` | Solo devuelve si ETag cambió |
| `Origin` | `https://app.ejemplo.com` | Origen de la petición (CORS) |
| `Referer` | `https://app.ejemplo.com/dashboard` | Desde qué página vino |
| `User-Agent` | `Mozilla/5.0...` | Identificación del cliente |
| `X-Request-ID` | `req-12345` | ID único para tracking |

### Ejemplo práctico de headers

```
# Petición típica de un navegador
GET /api/users/me HTTP/1.1
Host: api.ejemplo.com
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)
Accept: application/json
Accept-Language: es-ES,es;q=0.9,en;q=0.8
Accept-Encoding: gzip, deflate, br
Accept-Encoding: gzip, deflate, br
Connection: keep-alive
Cookie: session=xyz789
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
If-None-Match: "v2-abc123"
```

## Estructura de una respuesta HTTP

```
HTTP/1.1 200 OK
Date: Thu, 11 May 2024 12:00:00 GMT
Content-Type: application/json
Content-Length: 456
Connection: keep-alive
Cache-Control: public, max-age=3600
ETag: "v2-abc123"
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
Server: nginx/1.24.0

{"id": 42, "name": "Carlos", "email": "carlos@email.com"}
```

### La línea de estado

```
HTTP/1.1 200 OK
│       │    │
│       │    └── Razón (descripción legible)
│       │
│       └── Código de estado (ver [[06-status-codes]])
│
└── Versión del protocolo
```

Para más detalles sobre los códigos de estado, ver [[06-status-codes]].

### Headers de respuesta específicos

| Header | Ejemplo | Descripción |
|--------|---------|-------------|
| `Access-Control-Allow-Origin` | `https://app.ejemplo.com` | CORS |
| `Content-Disposition` | `attachment; filename="report.pdf"` | Indica si se muestra o descarga |
| `Content-Language` | `es-ES` | Idioma del contenido |
| `Content-Security-Policy` | `default-src 'self'` | CSP — previene XSS |
| `Location` | `/new-page` | Para redirecciones (3xx) |
| `Refresh` | `60;url=/` | Recargar página después de N segundos |
| `Retry-After` | `120` | Para 429/503: esperar N segundos |
| `Set-Cookie` | `session=xyz; HttpOnly; Secure` | Establecer una cookie |
| `Vary` | `Accept-Encoding, User-Agent` | La respuesta varía según estos headers |
| `WWW-Authenticate` | `Bearer realm="api"` | Para 401: qué método de auth usar |

### Headers de seguridad importantes

```
# HSTS (HTTP Strict Transport Security)
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
# Dice al navegador: "Solo usa HTTPS durante 1 año, incluyendo subdominios"

# X-Content-Type-Options: nosniff
# Evita que el navegador intente "adivinar" el tipo de contenido
# Si dice application/json y el navegador ve HTML, no lo ejecutará como script

# X-Frame-Options
X-Frame-Options: DENY         # Nunca permitir en iframe
X-Frame-Options: SAMEORIGIN   # Solo permitir en iframe del mismo dominio

# Content-Security-Policy (CSP)
Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.example.com
# Define qué fuentes están permitidas para cargar recursos
```

> [!tip] CSP es la defensa más potente contra XSS
> Un buen CSP puede bloquear el 99% de los ataques XSS sin código adicional. Define explícitamente qué scripts, estilos, imágenes, etc. pueden cargar tus páginas.

## El cuerpo de la petición (body)

El body contiene los datos que envías al servidor. El `Content-Type` del header indica **cómo están codificados** esos datos:

### application/json (el más común)

```
POST /api/users HTTP/1.1
Content-Type: application/json

{"name": "Carlos", "email": "carlos@email.com", "age": 30}
```

### application/x-www-form-urlencoded (formularios HTML clásicos)

```
POST /login HTTP/1.1
Content-Type: application/x-www-form-urlencoded

username=carlos&password=mipassword123
```

### multipart/form-data (subida de archivos)

```
POST /upload HTTP/1.1
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="avatar"; filename="foto.jpg"
Content-Type: image/jpeg

[binary data of the image]
------WebKitFormBoundary--
```

### application/xml y text/plain

```
POST /api/data HTTP/1.1
Content-Type: application/xml

<user><name>Carlos</name><age>30</age></user>

POST /api/data HTTP/1.1
Content-Type: text/plain

Hola, esto es texto plano
```

> [!tip] JSON vs form-urlencoded vs multipart
> - **JSON**: Para APIs. Estructurado, fácil de parsear, soporta objetos anidados.
> - **Form-urlencoded**: Para formularios HTML simples. Muy limitado (solo strings).
> - **Multipart**: Para subir archivos. Soporta datos binarios.
> - **XML**: En desuso (excepto en legacy/enterprise). JSON lo reemplazó en casi todo.

## Keep-Alive y conexiones persistentes

### HTTP/1.0 vs HTTP/1.1

```
HTTP/1.0 (sin keep-alive):
Cliente          Servidor
  │─── Request ───→│
  │←── Response ───│  (conexión cerrada)
  │─── Request ───→│  (nueva conexión TCP + TLS)
  │←── Response ───│  (conexión cerrada)
  │─── Request ───→│  (nueva conexión TCP + TLS)
  │←── Response ───│  (conexión cerrada)

HTTP/1.1 (con keep-alive):
Cliente          Servidor
  │─── Request ───→│
  │←── Response ───│  (conexión mantiene abierta)
  │─── Request ───→│  (misma conexión, más rápido)
  │←── Response ───│  (misma conexión)
  │─── Request ───→│  (misma conexión)
  │←── Response ───│  (conexión cerrada después de un timeout)
```

> [!tip] Keep-Alive es default en HTTP/1.1
> En HTTP/1.0, necesitabas `Connection: keep-alive` explícito. En HTTP/1.1, es el default. Puedes cerrar con `Connection: close`.

### Pipelining (raro de usar)

Con keep-alive puedes enviar múltiples peticiones sin esperar la respuesta de la anterior:

```
Request 1 →
Request 2 →
Request 3 →
← Response 1
← Response 2
← Response 3
```

**Problema**: Head-of-line blocking. Si la respuesta 1 tarda, las 2 y 3 se bloquean. Por eso **casi nadie usa pipelining en la práctica**. En su lugar, se usa HTTP/2 con multiplexación.

## HTTP/2

HTTP/2 es la evolución de HTTP/1.1. Las mejoras principales:

### Multiplexación

En HTTP/1.1, necesitabas 6 conexiones paralelas para cargar 6 recursos en paralelo (límite del navegador). En HTTP/2, **todo va por una sola conexión** y se multiplexa:

```
HTTP/1.1 (6 conexiones):
Conn 1: style.css
Conn 2: script.js
Conn 3: image1.jpg
Conn 4: image2.jpg
Conn 5: font.woff2
Conn 6: favicon.ico

HTTP/2 (1 conexión, streams multiplexados):
Stream 1 |── style.css
Stream 2 |── script.js
Stream 3 |── image1.jpg
Stream 4 |── image2.jpg
Stream 5 |── font.woff2
Stream 6 |── favicon.ico
         │ (todo por UNA conexión TCP)
```

### Binary protocol

HTTP/1.1 usa texto plano (fácil de leer pero propenso a errores de parsing). HTTP/2 es **binario** (más eficiente, menos errores).

### Header compression (HPACK)

HTTP/1.1 envía los mismos headers en cada petición:

```
GET /page1 HTTP/1.1
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)
Accept: text/html,application/xhtml+xml,...
Accept-Language: es-ES,es;q=0.9,en;q=0.8
Accept-Encoding: gzip, deflate, br
Cookie: session=xyz

GET /page2 HTTP/1.1                          ← Mismos headers de nuevo
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)
Accept: text/html,application/xhtml+xml,...
Accept-Language: es-ES,es;q=0.9,en;q=0.8
Accept-Encoding: gzip, deflate, br
Cookie: session=xyz
```

HTTP/2 usa **HPACK** para comprimir headers. El primero se envía completo, los siguientes solo envían los cambios.

### Server Push

El servidor puede enviar recursos que anticipa que el cliente necesitará:

```
Cliente: GET /index.html
Servidor:
  1. Responde con /index.html
  2. Push: /css/style.css (ya lo tengo, te lo mando antes de que lo pidas)
  3. Push: /js/app.js (ya lo tengo, te lo mando antes de que lo pidas)
```

> [!caution] Server Push es controversial
> Muchos desarrolladores lo desactivan porque:
> - Si el cliente ya tiene los recursos en caché, se desperdicia ancho de banda
> - No hay mecanismo para cancelar un push que el cliente no quiere
> - HTTP/3 y multiplexación reducen su utilidad
>
> La tendencia actual es **no usar Server Push** y confiar en la precarga (`<link rel="preload">`) en el HTML.

### Prioridades de streams

```
Stream 1 (prioridad alta): /css/style.css     ← Bloquea render
Stream 2 (prioridad media): /js/app.js         ← Bloquea interactividad
Stream 3 (prioridad baja): /images/lazy.jpg    ← No urgente
```

Cada stream puede tener un peso (1-256) y una dependencia de otros streams.

## HTTP/3 (quiche)

HTTP/3 es la versión más moderna. Cambia lo más fundamental:

### De TCP a QUIC

| | HTTP/2 (sobre TCP) | HTTP/3 (sobre QUIC) |
|--|-------------------|---------------------|
| Transporte | TCP | QUIC (sobre UDP) |
| Handshake | 1-RTT TCP + 1-RTT TLS | 0-RTT o 1-RTT (todo en uno) |
| Head-of-line blocking | Sí (en TCP, un packet perdido bloquea todo) | No (por stream) |
| Conexión migration | No (cambiar IP rompe la conexión) | Sí (mismo ID de conexión) |

### ¿Por qué QUIC sobre UDP?

Porque en TCP, si un packet se pierde, **todo se detiene** hasta que se reenvía. En QUIC (sobre UDP), cada stream es independiente: si un packet de un stream se pierde, los otros streams siguen fluyendo.

```
HTTP/2 sobre TCP (un packet perdido = todo bloqueado):
Packet 1  [OK]
Packet 2  [PERDIDO] ← Todo se detiene aquí
Packet 3  [OK pero no se puede procesar hasta que llegue el 2]
Packet 4  [OK pero no se puede procesar hasta que llegue el 2]

HTTP/3 sobre QUIC (stream independiente):
Stream 1: Packet 1 [OK] → Stream 2: Packet 1 [OK] → Funciona!
Stream 1: Packet 2 [PERDIDO]
Stream 2: Packet 2 [OK, sigue fluyendo aunque stream 1 esté bloqueado]
```

> [!tip] Cloudflare fue pionero en HTTP/3
> Cloudflare lanzó HTTP/3 (QUIC) en 2018 y fue el primer proveedor grande en ofrecerlo. Hoy es soportado por todos los navegadores modernos.

## CORS (Cross-Origin Resource Sharing)

CORS es un mecanismo de seguridad del navegador que controla **desde qué orígenes** tu página web puede hacer peticiones a un servidor.

### ¿Qué es un "origen"?

Un origen = protocolo + dominio + puerto:

```
https://app.ejemplo.com:443  ← Este origen
https://api.ejemplo.com:443  ← Otro origen (diferente dominio)
http://app.ejemplo.com:80    ← Otro origen (diferente protocolo y puerto)
https://app.ejemplo.com:443  ← Mismo origen (todo igual)
```

### Ejemplo de CORS

Tu frontend está en `https://app.ejemplo.com` y tu API en `https://api.ejemplo.com`. Cuando el frontend intenta llamar a la API:

```
Petición del navegador:
GET https://api.ejemplo.com/users HTTP/1.1
Origin: https://app.ejemplo.com

Respuesta del servidor (si CORS está mal configurado):
HTTP/1.1 200 OK
(El navegador RECHAZA la respuesta porque no hay header CORS)

Respuesta del servidor (si CORS está bien configurado):
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://app.ejemplo.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
```

### Preflight (OPTIONS)

Para peticiones "no simples" (con headers custom, methods como PUT/DELETE, o Content-Type application/json), el navegador primero hace una petición OPTIONS:

```
OPTIONS /api/users HTTP/1.1
Origin: https://app.ejemplo.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Content-Type, Authorization

Respuesta:
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.ejemplo.com
Access-Control-Allow-Methods: POST, GET, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

> [!tip] CORS solo afecta al navegador
> Si haces una petición con `curl`, Python requests, o Node.js fetch, CORS **no se aplica**. CORS es una restricción del navegador, no del protocolo HTTP.

## Resumen

- HTTP es un protocolo request/response, stateless, basado en texto (HTTP/1.x) o binario (HTTP/2+)
- Los métodos GET, POST, PUT, PATCH, DELETE tienen significados semánticos específicos
- Los headers son metadatos que controlan caché, seguridad, autenticación, compresión, etc.
- El body puede estar en JSON, form-urlencoded, multipart, XML, etc.
- HTTP/2 añade multiplexación, header compression, server push
- HTTP/3 cambia a QUIC (UDP), eliminando head-of-line blocking de TCP
- CORS controla desde qué orígenes se puede acceder a tu API

> [!quote] La clave
> HTTP es simple en teoría (pide, responde) pero complejo en la práctica (seguridad, rendimiento, compatibilidad). Los headers son donde vive la mayoría de la complejidad.

## Conexión con el resto de la wiki

| Concepto tocado | Artículo en profundidad |
|-----------------|------------------------|
| URL → página | [[02-como-navegar-de-url-a-pagina]] |
| Status codes | [[06-status-codes]] |
| HTTPS/TLS | [[07-https-tls]] |
| Cookies/Sesiones | [[09-cookies-sesiones]] |
| Autenticación | [[10-autenticacion-api-keys-tokens]] |
| REST APIs | [[11-res-todo-sobre-api-rest]] |
