---
title: "Cookies y sesiones"
description: "HTTP es stateless: cookies, sesiones del servidor (Redis), JWT (stateless), refresh tokens, atributos de seguridad (HttpOnly, Secure, SameSite)."
---

# Cookies y sesiones

> [!tip] Cookies y sesiones en una frase
> HTTP es **stateless** (no recuerda nada entre peticiones). Las cookies y las sesiones son mecanismos para **añadir estado** a una conexión sin estado.

## El problema: HTTP es stateless

```
Petición 1: GET /page1  →  Servidor: "¿Quién eres? No te conozco"
Petición 2: GET /page2  →  Servidor: "¿Quién eres? No te conozco (de nuevo)"
```

Cada petición HTTP es independiente. El servidor no tiene memoria de peticiones anteriores. Para mantener un usuario "logueado", necesitamos mecanismos de estado.

## Cookies: el mecanismo básico

Una **cookie** es un pequeño fragmento de datos (nombre=valor) que el servidor envía al navegador, y el navegador lo reenvía en cada petición siguiente.

### Cómo funcionan

```
Servidor                      Navegador
  │                               │
  │←── Set-Cookie: session_id=abc123; Path=/; HttpOnly; Secure ──│
  │                               │  [Guarda la cookie]
  │                               │
  │─── GET /page2 ──────────────→ │
  │      Cookie: session_id=abc123│  [Reenvía automáticamente]
  │                               │
  │←── Response ──────────────────│
  │                               │
  │─── GET /page3 ──────────────→ │
  │      Cookie: session_id=abc123│  [Sigue reenviando]
```

### Atributos de las cookies

| Atributo | Descripción | Ejemplo |
|----------|-------------|---------|
| **Name** | Nombre de la cookie (identificador) | `session_id`, `csrf_token` |
| **Value** | Valor de la cookie | `abc123def456` |
| **Domain** | Dominios para los que es válida | `.ejemplo.com`, `api.ejemplo.com` |
| **Path** | Rutas para las que es válida | `/`, `/api`, `/admin` |
| **Expires/Max-Age** | Cuándo expira | `Max-Age=3600` (1 hora) |
| **Secure** | Solo se envía por HTTPS | `Secure` |
| **HttpOnly** | No accesible desde JavaScript | `HttpOnly` |
| **SameSite** | Prevención de CSRF | `Strict`, `Lax`, `None` |

### Ejemplos de cookies

```
# Cookie de sesión estándar
Set-Cookie: session_id=abc123; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600

# Cookie de preferencia (más abierta)
Set-Cookie: theme=dark; Path=/; Max-Age=31536000; SameSite=Lax

# Cookie de analytics (terceros)
Set-Cookie: _ga=GA1.2.123456.1234567890; Domain=.ejemplo.com; Max-Age=63072000
```

> [!tip] Máximo tamaño y cantidad
> - **Tamaño máximo**: ~4KB por cookie (varía por navegador)
> - **Cantidad máxima**: ~20 cookies por dominio
> - **Total por navegador**: ~300 cookies
>
> Si necesitas más datos, usa **localStorage** (client-side) o **JWT tokens** (en headers)

### SameSite (CSRF protection)

SameSite controla **cuándo se envían las cookies en peticiones cross-site**:

| Valor | Descripción | Uso |
|-------|-------------|-----|
| **Strict** | Nunca envía cookies en peticiones cross-site | Máxima protección (puede romper UX) |
| **Lax** (default) | Envía solo en navegaciones top-level (GET links) | Balanceado, default en la mayoría de navegadores |
| **None** | Envía siempre (requiere Secure) | Necesario para iframes, embeds, etc. |

> [!warning] SameSite es la defensa contra CSRF
> CSRF (Cross-Site Request Forgery) es cuando un sitio malicioso hace que tu navegador envíe peticiones a tu sitio bancario con tus cookies. SameSite=Lax o Strict bloquea esto.

### HttpOnly y Secure

```
# HttpOnly: No accesible desde JavaScript
Set-Cookie: session_id=abc123; HttpOnly

# Esto NO funciona:
document.cookie // → session_id=abc123 NO aparece

# Secure: Solo se envía por HTTPS
Set-Cookie: session_id=abc123; Secure

# Esto NO funciona:
http://ejemplo.com → Cookie NO se envía
https://ejemplo.com → Cookie SÍ se envía
```

> [!caution] Nunca almacenes datos sensibles en cookies
> Las cookies viajan en cada petición al dominio. Si alguien intercepta el tráfico (MITM), puede leerlas. Siempre usa:
> 1. `Secure` (solo HTTPS)
> 2. `HttpOnly` (no accesible desde JS)
> 3. No almacenes datos sensibles, solo un **token/session ID**

## Sesiones del servidor (server-side sessions)

Las cookies contienen un **session ID** que el servidor usa para buscar la sesión guardada en su base de datos o caché.

### Flujo de sesión

```
1. Usuario hace login → Credenciales válidas
2. Servidor crea una sesión en su base de datos/caché:
   SessionStore.set(session_id, {
       user_id: 42,
       username: "carlos",
       role: "admin",
       created_at: "2024-01-15T10:00:00Z"
   })
3. Servidor envía cookie con el session_id:
   Set-Cookie: session_id=sess_abc123; Path=/; HttpOnly; Secure
4. Cada petición siguiente incluye la cookie
5. Servidor busca la sesión por session_id y verifica el estado
```

### Almacenamiento de sesiones

| Almacenamiento | Pros | Contras | Escalabilidad |
|---------------|------|---------|---------------|
| **In-memory** | Muy rápido | Se pierde al reiniciar el servidor | Baja (no funciona con múltiples servidores) |
| **Redis** | Rápido, persistente, compartido | Requiere infraestructura | Alta |
| **Base de datos** | Persistente, fácil de gestionar | Más lento que Redis | Media |

#### Sesiones con Redis (recomendado)

```javascript
// Express + connect-redis
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const redis = require('redis');

const redisClient = redis.createClient({ url: 'redis://localhost:6379' });

app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: 'tu-secreto-aqui',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: true,       // solo en producción (HTTPS)
        maxAge: 24 * 60 * 60 * 1000,  // 24 horas
        sameSite: 'lax'
    }
}));
```

> [!tip] Por qué Redis es ideal
> - **Velocidad**: Operaciones en ~1ms
> - **TTL automático**: Redis expira automáticamente las sesiones viejas
> - **Compartido entre servidores**: Múltiples instancias del servidor comparten la misma sesión
> - **Persistencia opcional**: `savePoints` o RDB/AOF

## JWT (JSON Web Tokens) — Stateless auth

JWT es una alternativa a las sesiones del servidor. En lugar de guardar la sesión en el servidor, el servidor **firma un token** que contiene los datos del usuario.

### Estructura de un JWT

```
+-----------------------------+---------------------------+
│        Header               │        Signature        │
│    (algoritmo + tipo)       │     (HMAC-SHA256)       │
│                             │                         │
│        Payload              │                         │
│   (datos del usuario)       └─────────────────────────┘
```

Cada parte está **base64url encoded**:

```json
// Header
{
    "alg": "HS256",
    "typ": "JWT"
}

// Payload (claims)
{
    "sub": "1234567890",
    "name": "Carlos",
    "role": "admin",
    "iat": 1516239022,
    "exp": 1516242622,
    "iss": "api.ejemplo.com"
}

// Firma
HMACSHA256(
    base64UrlEncode(header) + "." + base64UrlEncode(payload),
    "tu-secreto-muy-secreto"
)
```

> [!caution] El payload de JWT NO está cifrado
> Cualquier persona puede decodificar un JWT y leer el payload. **Nunca pongas datos sensibles (passwords, tokens de API, PII) en un JWT.** Solo pon datos no sensibles.

### JWT vs Sessiones del servidor

| Característica | JWT (Stateless) | Sesiones (Stateful) |
|---------------|-----------------|---------------------|
| **Almacenamiento** | Cliente (token en cookie/header) | Servidor (Redis, DB) |
| **Escalabilidad** | Alta (no necesita estado en servidor) | Media (necesita shared store) |
| **Logout** | Difícil (JWT no se puede revocar fácilmente) | Fácil (eliminar sesión de Redis/DB) |
| **Renovación** | Refresh tokens necesarios | Sesión expira automáticamente |
| **Tamaño** | Mayor (payload + firma) | Menor (solo session_id en cookie) |
| **Carga del servidor** | Menor (no necesita lookup) | Mayor (necesita lookup en cada petición) |
| **Privacidad** | Menor (payload visible) | Mayor (solo session_id) |
| **Uso típico** | APIs REST, microservicios, SPAs | Apps monolíticas, web tradicionales |

### Refresh Tokens

Para JWT, se usa un par de tokens:

```
Access Token (JWT):
  - Vida corta (15 minutos)
  - Se usa para cada petición a la API
  - Si expira, se renueva con el refresh token

Refresh Token:
  - Vida larga (7-30 días)
  - Solo se usa para obtener un nuevo access token
  - Se guarda en una cookie HttpOnly + Secure
  - Se guarda en el servidor (para poder revocar)
```

```
# Flujo:
1. Login → Acceso + Refresh Token
2. Petición API → Access Token en header
3. Access Token expira → Usar Refresh Token para obtener uno nuevo
4. Refresh Token expira → Re-login
```

## Comparación: Cookies vs JWT vs API Keys

| | Cookie (Session) | JWT | API Key |
|--|-----------------|-----|---------|
| **Dónde se guarda** | Cliente (cookie) | Cliente (token) | Servidor/Cliente (secreto) |
| **Se reenvía en** | Automáticamente en cada petición | Header Authorization | Header / Query param |
| **Revocable** | Sí (borrar de servidor) | Difícil (blacklist necesario) | Sí (rotar) |
| **Escala** | Requiere shared state | Sin estado | Sin estado |
| **Seguridad** | Alta (HttpOnly + Secure) | Media (no revocable fácilmente) | Alta (si se protege bien) |
| **Uso** | Sesiones de usuario | APIs, microservicios, OAuth | APIs de terceros, servicios internos |

## Resumen

- HTTP es stateless: cada petición es independiente
- Las cookies permiten mantener estado reenviando datos en cada petición
- Los atributos `HttpOnly`, `Secure`, `SameSite` son críticos para seguridad
- Las sesiones del servidor (con Redis) son el enfoque tradicional
- JWT es stateless: el servidor no necesita guardar estado
- JWT es ideal para APIs y microservicios; sesiones son mejores para apps web tradicionales
- El par Access Token + Refresh Token es el pattern moderno para JWT

> [!quote] La clave
> La elección entre JWT y sesiones depende del contexto:
> - **App web monolítica** → Sesiones del servidor (más simple, más seguro)
> - **API REST + SPA** → JWT (stateless, escala bien)
> - **Microservicios** → JWT (cada servicio puede validar el token sin consultar DB)
> - **OAuth/OIDC** → JWT (estándar en el ecosistema)

## Conexión con el resto de la wiki

| Concepto tocado | Artículo en profundidad |
|-----------------|------------------------|
| Autenticación completa | [[10-autenticacion-api-keys-tokens]] |
| HTTP headers | [[05-http-profundo]] (cómo se envían las cookies) |
| HTTPS/TLS | [[07-https-tls]] (Secure flag requiere HTTPS) |
| REST APIs | [[11-api-rest]] (auth en APIs REST) |
