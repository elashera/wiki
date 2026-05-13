---
title: "Códigos de estado HTTP"
description: "Todos los códigos de estado HTTP explicados: 1xx información, 2xx éxito, 3xx redirección, 4xx error del cliente, 5xx error del servidor, con ejemplos y mejores prácticas."
---

# Códigos de estado HTTP

> [!tip] Status codes en una frase
> Los códigos de estado son la **respuesta numérica** del servidor a tu petición. Dicen si todo fue bien, mal, redirigido, o si el cliente hizo algo mal.

## ¿Qué son los códigos de estado?

Cuando envías una petición HTTP, el servidor responde con un **número de 3 dígitos** que indica el resultado. Se dividen en 5 grupos:

| Grupo | Significado | Ejemplos |
|-------|-------------|----------|
| **1xx** | Información | 100, 101 |
| **2xx** | Éxito | 200, 201, 204 |
| **3xx** | Redirección | 301, 302, 304 |
| **4xx** | Error del cliente | 400, 401, 403, 404, 405, 409, 422, 429 |
| **5xx** | Error del servidor | 500, 502, 503, 504 |

## 1xx — Informaciónales

Indican que la petición se recibió y se está procesando. Raro de usar en APIs modernas.

| Código | Nombre | Descripción |
|--------|--------|-------------|
| **100** | Continue | "Sigue, estoy listo para el body" (usado en uploads grandes) |
| **101** | Switching Protocols | "Cambiamos de protocolo" (ej. HTTP → WebSocket) |

## 2xx — Éxito

Significa que la petición se recibió, comprendió y aceptó correctamente.

### 200 OK

**El más común.** Significa que la petición fue procesada correctamente.

```
GET /api/users/42 HTTP/1.1
→ 200 OK
Content-Type: application/json

{"id": 42, "name": "Carlos", "email": "carlos@email.com"}
```

> [!tip] 200 no significa siempre lo mismo
> - Para GET: "Aquí están los datos"
> - Para POST: "La acción se ejecutó correctamente"
> - Para PUT/PATCH: "Los datos se actualizaron"
> - Para DELETE: "Se eliminó"

### 201 Created

Se usó en POST para crear un recurso. Siempre va acompañado de un header `Location` que apunta al nuevo recurso.

```
POST /api/users HTTP/1.1
Content-Type: application/json
{"name": "Ana", "email": "ana@email.com"}

→ 201 Created
Location: /api/users/43
Content-Type: application/json

{"id": 43, "name": "Ana", "email": "ana@email.com"}
```

### 204 No Content

La petición fue exitosa pero no hay contenido para devolver. Común en DELETE:

```
DELETE /api/users/42 HTTP/1.1
→ 204 No Content
(Sin body)
```

### Otros 2xx

| Código | Nombre | Descripción |
|--------|--------|-------------|
| **202** | Accepted | La petición se aceptó pero se está procesando asincrónicamente |
| **206** | Partial Content | Se devolvió parte del contenido (usado en range requests para streaming/video) |

## 3xx — Redirección

Significa que el recurso está en otra ubicación. El cliente debe hacer una nueva petición a la URL indicada.

### 301 Moved Permanently

El recurso se movió **permanentemente** a otra URL. Los navegadores y SEO lo procesan así:

```
GET /old-page HTTP/1.1
→ 301 Moved Permanently
Location: /new-page

# El navegador:
# 1. Saca a /old-page del caché
# 2. Actualiza sus favoritos/histórico a /new-page
# 3. Para futuras peticiones, va directo a /new-page
```

**SEO**: Los buscadores transfieren el "link juice" (autoridad) de la URL antigua a la nueva.
**Cache**: Los navegadores cachéan la redirección permanentemente.

### 302 Found (antes "Moved Temporarily")

El recurso está temporalmente en otra URL:

```
GET /maintenance HTTP/1.1
→ 302 Found
Location: /under-maintenance.html
```

**Diferencia clave con 301:**
- **301**: Redirección permanente. Los clientes cachéan la redirección.
- **302**: Redirección temporal. Los clientes NO cachéan la redirección.

### 303 See Other

Similar a 302, pero obliga al cliente a usar GET para la redirección (incluso si la original fue POST).

### 304 Not Modified

Significa "tu caché sigue siendo válida, no necesitas descargarlo de nuevo". Es una de las optimizaciones más importantes en rendimiento web.

```
GET /css/style.css HTTP/1.1
If-None-Match: "abc123"

→ 304 Not Modified
(No body, sin descargar el CSS de nuevo)
```

**Cómo funciona:**
1. Primera vez: servidor envía el archivo con `ETag: "abc123"`
2. Cliente guarda el archivo y el ETag en caché
3. Cliente vuelve a pedir el archivo con `If-None-Match: "abc123"`
4. Si no cambió, servidor responde 304 (sin body)
5. Cliente usa la versión en caché

> [!tip] 304 es crítico para el rendimiento
> Un 304 tarda ~50ms (solo headers). Un 200 con un CSS de 50KB tarda ~200ms. Ahorra ~150ms por recurso redirigido.

### 307 Temporary Redirect

Igual que 302 pero **preserva el método HTTP** (POST sigue siendo POST, no se convierte en GET).

### 308 Permanent Redirect

Igual que 301 pero **preserva el método HTTP**.

### Resumen de redirecciones

| Código | Permanente | Preserva método | Usar cuando |
|--------|-----------|-----------------|-------------|
| **301** | Sí | No (GET solo) | Redirección permanente de páginas |
| **302** | No | No | Redirección temporal |
| **303** | No | Fuerza GET | Después de POST, mostrar resultado |
| **307** | No | Sí | Redirección temporal con mismo método |
| **308** | Sí | Sí | Redirección permanente con mismo método |

## 4xx — Errores del cliente

Significa que **el cliente envió algo mal**. El problema está en la petición, no en el servidor.

### 400 Bad Request

El servidor no puede entender la petición. Generalmente por formato inválido:

```
POST /api/users HTTP/1.1
Content-Type: application/json

{ nombre: "Carlos" }    ← JSON inválido (sin comillas en la key)

→ 400 Bad Request
{ "error": "Invalid JSON: Expected property name" }
```

### 401 Unauthorized

**"No estás autenticado"** (o "tus credenciales son inválidas"). Significa que necesitas identificarte.

> [!warning] No confundir con 403
> - **401**: "No sé quién eres" (falta o inválida la autenticación)
> - **403**: "Te reconozco pero no tienes permiso" (falta autorización)

```
GET /api/admin HTTP/1.1
→ 401 Unauthorized
WWW-Authenticate: Bearer realm="api"
```

### 403 Forbidden

**"Te reconozco pero no puedes hacer esto"**. Estás autenticado pero no tienes permiso para acceder a ese recurso.

```
GET /api/admin HTTP/1.1
Authorization: Bearer eyJ... (token válido)

→ 403 Forbidden
{ "error": "Insufficient permissions" }
```

### 404 Not Found

**El recurso que pides no existe.** Es el error más conocido de Internet.

```
GET /api/users/99999 HTTP/1.1
→ 404 Not Found
{ "error": "User not found" }
```

> [!tip] 404 vs 410 Gone
> - **404**: "No encuentro este recurso" (puede ser temporal o permanente)
> - **410**: "Este recurso existía pero lo eliminé permanentemente" (los buscadores lo quitan del índice)

### 405 Method Not Allowed

El recurso existe pero el método que usas no está permitido:

```
GET /api/users/42 HTTP/1.1
→ 405 Method Not Allowed
Allow: GET, PUT, DELETE
```

### 409 Conflict

Hay un conflicto con el estado actual del recurso:

```
# Crear usuario con email duplicado:
POST /api/users HTTP/1.1
{"email": "carlos@email.com"}

→ 409 Conflict
{ "error": "Email already registered" }
```

### 422 Unprocessable Entity

La petición tiene formato correcto pero el **contenido no es válido**. Más específico que 400:

```
POST /api/users HTTP/1.1
Content-Type: application/json
{"name": "", "email": "invalid-email", "age": -5}

→ 422 Unprocessable Entity
{
  "errors": {
    "name": "No puede estar vacío",
    "email": "Formato de email inválido",
    "age": "Debe ser un número positivo"
  }
}
```

> [!tip] 422 es ideal para validación de formularios
> Si tu API recibe un JSON válido pero con datos inválidos, devuelve 422 con los errores por campo.

### 429 Too Many Requests

Has hecho demasiadas peticiones. Rate limiting:

```
POST /api/login HTTP/1.1
→ 429 Too Many Requests
Retry-After: 60
{ "error": "Too many login attempts. Try again in 60 seconds" }
```

## 5xx — Errores del servidor

Significa que **algo salió mal en el servidor**. El problema es del servidor, no del cliente.

### 500 Internal Server Error

Error genérico del servidor. Algo no salió como se esperaba pero no se categorizó mejor.

```
GET /api/users HTTP/1.1
→ 500 Internal Server Error
{ "error": "An unexpected error occurred" }
```

> [!warning] Nunca devuelvas 500 con detalles técnicos al cliente
> En producción, 500 debe devolver un mensaje genérico. Los detalles del error van en los logs del servidor, NO en la respuesta al cliente.

### 502 Bad Gateway

El servidor actuaba como proxy/gateway y recibió una respuesta inválida de otro servidor upstream:

```
# Ejemplo común: Nginx → Node.js
Nginx (proxy)          Node.js (upstream)
   │                        │
   │─── Request ───────────→│
   │                        │  (Node.js se cuelga o responde mal)
   │←── Bad Response ───────│
   │←── 502 Bad Gateway ────│  (al cliente)
```

**Causas comunes:**
- El upstream server se cayó o no responde
- El upstream server respondió con un formato que el proxy no entiende
- Timeout: el upstream tardó demasiado en responder

### 503 Service Unavailable

El servidor no puede manejar la petición porque está **sobrecargado o en mantenimiento**:

```
GET /api/users HTTP/1.1
→ 503 Service Unavailable
Retry-After: 30
{ "error": "Service temporarily unavailable. Please try again in 30 seconds" }
```

**Causas comunes:**
- Mantenimiento planificado
- Pico de tráfico (server overloaded)
- Base de datos no responde
- Dependencia externa (API de otro servicio) caída

### 504 Gateway Timeout

El servidor actuaba como proxy y no recibió respuesta del upstream a tiempo:

```
Nginx (proxy)          Node.js (upstream)
   │                        │
   │─── Request ───────────→│
   │                        │  (Node.js tarda 30s, timeout de Nginx es 10s)
   │←── 504 Gateway Timeout ──│  (al cliente)
```

## Resumen visual

```
1xx ── Información (100, 101)
2xx ── Éxito (200, 201, 204)
3xx ── Redirección (301, 302, 304, 307, 308)
4xx ── Error del cliente (400, 401, 403, 404, 405, 409, 422, 429)
5xx ── Error del servidor (500, 502, 503, 504)
```

## Errores más comunes en APIs REST

| Situación | Código correcto | Mensaje |
|-----------|----------------|---------|
| Datos faltantes en el body | 400 Bad Request | "Missing required field: email" |
| Datos mal formateados | 400 Bad Request | "Invalid JSON: Expected string" |
| Validación de campos | 422 Unprocessable Entity | { "errors": { "email": "Invalid format" } } |
| Sin autenticación | 401 Unauthorized | "Authentication required" |
| Token inválido/expirado | 401 Unauthorized | "Invalid or expired token" |
| Sin permisos | 403 Forbidden | "Insufficient permissions" |
| Recurso no existe | 404 Not Found | "User not found" |
| Método no permitido | 405 Method Not Allowed | "Method not allowed" |
| Recurso duplicado | 409 Conflict | "Email already exists" |
| Rate limiting | 429 Too Many Requests | "Too many requests, retry in 60s" |
| Error interno | 500 Internal Server Error | "An unexpected error occurred" |
| Proxy sin respuesta válida | 502 Bad Gateway | "Bad gateway" |
| Servidor sobrecargado | 503 Service Unavailable | "Service temporarily unavailable" |
| Timeout del proxy | 504 Gateway Timeout | "Gateway timeout" |

## Resumen

- 1xx: información (raros), 2xx: éxito, 3xx: redirección, 4xx: error del cliente, 5xx: error del servidor
- 301 vs 302: permanente vs temporal (caché)
- 304: caché válida (sin body) — optimización clave de rendimiento
- 401 vs 403: no autenticado vs no autorizado
- 422: validación de datos con errores detallados por campo
- 502: upstream no responde; 503: servidor sobrecargado; 504: timeout del proxy

> [!quote] La clave
> Los status codes son el lenguaje que usa el servidor para decirle al cliente "qué pasó con tu petición". Usarlos correctamente es fundamental para una buena API design.

## Conexión con el resto de la wiki

| Concepto tocado | Artículo en profundidad |
|-----------------|------------------------|
| HTTP métodos y headers | [[05-http-profundo]] |
| Autenticación (401/403) | [[10-autenticacion-api-keys-tokens]] |
| Cookies/Sesiones (304, cookies) | [[09-cookies-sesiones]] |
| REST APIs | [[11-api-rest]] |
