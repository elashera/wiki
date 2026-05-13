---
title: "Autenticación: Basic Auth, Bearer tokens, API keys, OAuth 2.0"
description: "Todos los mecanismos de autenticación explicados: Basic Auth, Bearer tokens (JWT, opaque), API keys, OAuth 2.0 con PKCE, MFA, MTLS, y mejores prácticas de seguridad."
---

# Autenticación: Basic Auth, Bearer tokens, API keys, OAuth 2.0

> [!tip] Autenticación en una frase
> La autenticación responde a la pregunta **"¿quién eres?"**. Hay múltiples formas de demostrarlo: contraseña, token, API key, certificado, biometría...

## Diferencia: Autenticación vs Autorización

```
Autenticación → ¿Quién eres?
Autorización  → ¿Qué puedes hacer?
```

| | Autenticación | Autorización |
|--|--------------|-------------|
| **Pregunta** | ¿Quién eres? | ¿Qué puedes hacer? |
| **Ejemplo** | Login con password, token JWT | Permiso para acceder a /admin |
| **Cuándo** | Primero | Después |

> [!caution] Confusión común
> Muchos desarrolladores confunden 401 con 403:
> - **401 Unauthorized** → No estás autenticado (no demostraste quién eres)
> - **403 Forbidden** → Estás autenticado pero no tienes permiso (autorización falla)

## Tipos de autenticación

### 1. Basic Auth

El método más simple: envía `usuario:contraseña` codificado en base64 en cada petición.

```
Authorization: Basic [YOUR_BASE64_CREDENTIALS]
# Y2FybG9zOm1pcGFzc3dvcmQxMjM= = "carlos:mipassword123" en base64
```

> [!warning] Basic Auth solo sobre HTTPS
> Base64 no es cifrado — cualquiera que intercepte la petición puede leer las credenciales. **NUNCA uses Basic Auth sin HTTPS.**

```bash
# Con curl
curl -u carlos:mipassword123 https://api.ejemplo.com/users
# Equivale a:
curl -H "Authorization: Basic [BASE64_CREDENTIALS]" https://api.ejemplo.com/users
```

**Estado**: En desuso para APIs modernas. Solo para herramientas internas o APIs legacy.

### 2. Bearer Tokens (JWT, opaque tokens)

El método más común en APIs modernas. El cliente envía un token en el header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### JWT (ver [[09-cookies-sesiones]])

Token autocontenido con firma criptográfica. El servidor puede validar el token sin consultar una base de datos.

#### Opaque Token

Token que es solo un string aleatorio. El servidor necesita consultar una base de datos para saber qué usuario representa.

```
# Ejemplo: Opaque token
Authorization: Bearer a1b2c3d4e5f6g7h8i9j0

# El servidor consulta:
SELECT user_id, role, expires_at FROM tokens WHERE token = 'a1b2c3d4e5f6g7h8i9j0'
```

### 3. API Keys

Una clave secreta larga que identifica a un cliente (usuario o servicio).

```
X-API-Key: [TU_API_KEY_AQUI]
Authorization: Bearer [TU_TOKEN_AQUI]
```

#### API Key vs Token

| | API Key | Token (JWT/OPAQUE) |
|--|---------|-------------------|
| **Identifica** | Cliente / API consumer | Usuario / Sesión |
| **Expira** | Rara vez (rotar manualmente) | Siempre (minutos/horas/días) |
| **Ámbito** | Suele ser fijo | Puede tener scopes/permissions |
| **Revocación** | Rotar la key | Invalidar el token |
| **Uso típico** | Servicios, integraciones, SaaS | Usuarios finales, sesiones |

> [!tip] Best practices para API Keys
> 1. **Nunca las expongas en el frontend** (JS del navegador). Úsalas solo en backend.
> 2. **Rótalas regularmente** (cada 3-6 meses)
> 3. **Usa scopes/permissions** si tu proveedor lo soporta
> 4. **Almacénalas en variables de entorno**, nunca en código
> 5. **Loggea el uso** para detección de abuso

### 4. OAuth 2.0 / OpenID Connect

OAuth 2.0 es un **protocolo de autorización** que permite que una aplicación acceda a recursos de un usuario en nombre suyo, sin compartir sus credenciales.

#### El flujo de OAuth 2.0 (Authorization Code + PKCE)

```
1. Usuario hace click en "Login with Google"
   ↓
2. Redirige a Google:
   https://accounts.google.com/o/oauth2/v2/auth?
     client_id=TU_CLIENT_ID&
     redirect_uri=https://app.ejemplo.com/callback&
     response_type=code&
     scope=openid+email+profile&
     state=random_state_token&
     code_challenge=BASE64(SHA256(code_verifier))

3. Usuario hace login en Google y autoriza tu app
   ↓
4. Google redirige de vuelta con un code:
   https://app.ejemplo.com/callback?code=AUTORIZATION_CODE&state=random_state_token

5. Tu servidor intercambia el code por tokens:
   POST https://oauth2.googleapis.com/token
   Content-Type: application/x-www-form-urlencoded
   grant_type=authorization_code&
   code=AUTORIZATION_CODE&
   redirect_uri=https://app.ejemplo.com/callback&
   client_id=TU_CLIENT_ID&
   client_secret=TU_CLIENT_SECRET&
   code_verifier=ORIGINAL_CODE_VERIFIER

6. Google responde con:
   {
     "access_token": "[ACCESS_TOKEN]",
     "expires_in": 3599,
     "refresh_token": "[REFRESH_TOKEN]",
     "id_token": "[ID_TOKEN]"
   }

7. Tu servidor usa el access_token para llamar a la API de Google
8. Tu servidor extrae los datos del usuario del id_token
```

> [!tip] ¿Por qué Authorization Code + PKCE?
> - **Authorization Code**: El code se intercambia en el **backend** (donde es seguro guardar el client_secret). El code solo tiene vida útil muy corta.
> - **PKCE** (Proof Key for Code Exchange): Previene ataques de interceptación del code en aplicaciones públicas (SPAs, móviles). El `code_verifier` se usa para verificar que el cliente que recibe el code es el mismo que lo pidió.

#### OAuth 2.0: Flujos disponibles

| Flujo | Uso | Seguridad |
|-------|-----|-----------|
| **Authorization Code + PKCE** | SPAs, móviles, apps de servidor | ✅✅ Máxima |
| **Authorization Code** | Apps de servidor (backend) | ✅ Alta |
| **Implicit** | ~~En desuso~~ — No usar | ❌ Inseguro |
| **Client Credentials** | Servicio a servicio (sin usuario) | ✅ Alta |
| **Device Code** | Dispositivos sin teclado (TV, consolas) | ✅ Media |

#### OpenID Connect (OIDC)

OIDC es una capa sobre OAuth 2.0 que añade **autenticación**. OAuth 2.0 solo autoriza; OIDC dice quién eres.

```
OAuth 2.0 → "Puedes acceder a estos recursos del usuario"
OIDC      → "Este usuario es Carlos con email carlos@email.com"

OIDC añade:
- id_token (JWT que contiene claims del usuario)
- /userinfo endpoint (para obtener más datos del usuario)
- Standardized claims (sub, name, email, email_verified, etc.)
```

### 5. MFA / 2FA (Multi-Factor Authentication)

MFA requiere **dos o más factores** de autenticación:

| Factor | Ejemplo |
|--------|---------|
| **Algo que sabes** | Password, PIN |
| **Algo que tienes** | Teléfono (OTP app), token hardware (YubiKey) |
| **Algo que eres** | Huella digital, Face ID, retina |

#### MFA común en la práctica

```
# TOTP (Time-based One-Time Password) - Google Authenticator, Authy
# Código de 6 dígitos que cambia cada 30 segundos
123456

# WebAuthn / FIDO2 - YubiKey, Face ID, Touch ID
# Usan criptografía de clave pública, no Phishing-resistant

# SMS 2FA
# Código enviado por SMS
# ⚠️ Vulnerable a SIM swapping

# Email 2FA
# Código enviado por email
# ⚠️ Menos seguro que SMS
```

### 6. Certificados mutuos (mTLS)

Ambas partes verifican certificados TLS. Se usa en:
- Comunicación entre microservicios
- API interna
- IoT

```
Cliente → Servidor: ClientHello + Client Certificate
Servidor → Cliente: ServerHello + Server Certificate
Ambos verifican: ¿El certificado está firmado por una CA de confianza?
```

## Cuándo usar qué

| Escenario | Recomendación | Por qué |
|-----------|--------------|---------|
| **Web app tradicional** (servidor renderiza HTML) | Sessiones + cookies | Más seguro, más simple |
| **SPA** (React/Vue/Angular) | JWT + HttpOnly cookie | Stateless, CSRF protection con SameSite |
| **API REST** (frontend móvil o web) | JWT bearer token | Stateless, fácil de escalar |
| **Servicio a servicio** | API Key o mTLS | No hay usuario, solo servicios |
| **Login con Google/GitHub** | OAuth 2.0 + OIDC | No gestiones contraseñas tú |
| **Máxima seguridad** | Password + TOTP/WebAuthn | MFA obligatorio para cuentas sensibles |

## Seguridad de autenticación

### Passwords

**NUNCA almacenes passwords en texto plano.**

```javascript
// MALO: texto plano
db.users.create({ password: "mipassword123" })

// MALO: MD5/SHA1 (demasiado rápido, vulnerable a rainbow tables)
db.users.create({ password: sha256("mipassword123") })

// BIEN: bcrypt (con salt y work factor)
db.users.create({ password: bcrypt.hash("mipassword123", 12) })
// $2b$12$WApznUPhDubN0oeveSXHrOuE9/.lZdF.5DEdRZSJPjYRUfQfOekLe
```

> [!tip] Algoritmos recomendados para passwords
> 1. **Argon2** (ganador de Password Hashing Competition) — mejor resistencia a GPU attacks
> 2. **bcrypt** — ampliamente soportado, seguro si usas work factor >= 12
> 3. **scrypt** — bueno, menos soportado
>
> NUNCA uses MD5, SHA1, SHA256 directamente para passwords. Son demasiado rápidos.

### Rate Limiting para login

```
# Protección contra brute-force
POST /api/login
→ 429 Too Many Requests (después de 5 intentos fallidos en 5 minutos)
Retry-After: 300

# Protección contra credential stuffing
POST /api/login
→ 401 Unauthorized (con mensaje genérico: "Credenciales inválidas")
   ← NO decir "el email no existe" o "el password es incorrecto"
```

### Best practices

1. **HTTPS siempre** — sin HTTPS, cualquier auth es insegura
2. **Passwords con bcrypt/Argon2** — nunca en texto plano ni hash simple
3. **MFA para cuentas sensibles** — TOTP o WebAuthn
4. **Tokens con TTL corto** — access tokens 15min, refresh tokens 7-30 días
5. **Headers seguros** — HttpOnly, Secure, SameSite para cookies
6. **No expongas mensajes de error específicos** — "Credenciales inválidas" en vez de "El password es incorrecto"
7. **Rate limiting en login** — protege contra brute-force y credential stuffing
8. **Rotación de API keys** — cada 3-6 meses
9. **Loggear intentos de auth fallidos** — para detección de ataques

## Resumen

- Autenticación = "¿quién eres?", Autorización = "¿qué puedes hacer?"
- Basic Auth: simple, pero obsoleto (solo sobre HTTPS)
- Bearer Tokens (JWT): stateless, ideal para APIs
- API Keys: para servicios, no para usuarios finales
- OAuth 2.0 + OIDC: para login con proveedores (Google, GitHub, etc.)
- MFA: dos factores de verificación para mayor seguridad
- NUNCA almacenes passwords en texto plano o con hash simple
- Rate limiting es esencial en endpoints de login

> [!quote] La clave
> La autenticación perfecta no existe. Cada método tiene trade-offs entre seguridad, usabilidad y complejidad. Elige según tu caso de uso y nunca te quedes con lo obsoleto.

## Conexión con el resto de la wiki

| Concepto tocado | Artículo en profundidad |
|-----------------|------------------------|
| Cookies y sesiones | [[09-cookies-sesiones]] |
| JWT | [[09-cookies-sesiones]] |
| HTTP headers | [[05-http-profundo]] |
| Status codes (401, 403) | [[06-status-codes]] |
| HTTPS/TLS | [[07-https-tls]] |
