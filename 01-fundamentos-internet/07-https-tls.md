# HTTPS y TLS

> [!tip] HTTPS en una frase
> HTTPS = HTTP + TLS (cifrado). TLS es el protocolo criptográfico que garantiza que tu comunicación con el servidor es privada, íntegra y auténtica.

## ¿Qué es TLS?

TLS (Transport Layer Security) es el protocolo que **cifra** la comunicación entre cliente y servidor. HTTPS es simplemente HTTP sobre TLS.

### La evolución

| Versión | Año | Estado |
|---------|-----|--------|
| SSL 1.0 | 1994 | Nunca publicado (flawed) |
| SSL 2.0 | 1995 | Vulnerable, descontinuado |
| SSL 3.0 | 1996 | Vulnerable (POODLE), descontinuado |
| TLS 1.0 | 1999 | Debilitado, descontinuado |
| TLS 1.1 | 2006 | Debilitado, descontinuado |
| **TLS 1.2** | 2008 | Seguro pero lento |
| **TLS 1.3** | 2018 | **Recomendado** — rápido y seguro |

> [!caution] TLS 1.0 y 1.1 están MUERTOS
> Desde 2020, todos los navegadores principales rechazan TLS 1.0 y 1.1. Si tu servidor aún los soporta, **desactívalos inmediatamente**. TLS 1.2 es el mínimo aceptable; TLS 1.3 es lo ideal.

## TLS por dentro: el Handshake

El handshake de TLS es el proceso de establecimiento de la conexión segura.

### TLS 1.3 Handshake (el moderno y rápido)

```
Cliente                          Servidor
   │                                │
   │─── ClientHello ──────────────→ │
   │  • Versiones TLS que soporta   │
   │  • Cipher suites que soporta   │
   │  • Random bytes                │
   │  • PSK (si reanudó conexión)   │
   │                                │
   │←── ServerHello ────────────────│
   │  • Versión acordada (TLS 1.3)  │
   │  • Cipher suite acordada       │
   │  • Random bytes del servidor   │
   │  • Server's certificate        │
   │  • CertificateRequest (opcional)│
   │  • ServerFinished              │
   │                                │
   │─── ClientCertificate ──────────→│ (opcional, mTLS)
   │─── ClientFinished ─────────────→│
   │                                │
   │══════ Claves de sesión generadas ══════
   │     (AES-256-GCM o ChaCha20-Poly1305)
   │══════ Comunicación cifrada ════════
```

**Total: 1-RTT** (una ronda de ida y vuelta). Con PSK (resumed session): **0-RTT** (instantáneo).

### TLS 1.2 Handshake (el antiguo pero aún usado)

```
Cliente                          Servidor
   │                                │
   │─── ClientHello ──────────────→ │  "Hola, soporto TLS 1.2, estos cipher suites..."
   │                                │
   │←── ServerHello ────────────────│  "TLS 1.2, cipher suite AES_256_GCM"
   │←── Certificate ────────────────│  "Aquí mi certificado"
   │←── ServerKeyExchange ──────────│  "Mis parámetros Diffie-Hellman"
   │←── ServerHelloDone ────────────│
   │                                │
   │─── ClientKeyExchange ──────────→│  "Clave premaster generada con RSA/ECDHE"
   │─── ChangeCipherSpec ───────────→│
   │─── Finished ───────────────────→│
   │                                │
   │←── ChangeCipherSpec ────────────│
   │←── Finished ────────────────────│
   │                                │
   │══════ Comunicación cifrada ════════
```

**Total: 2-RTT** (dos rondas de ida y vuelta).

> [!tip] ¿Por qué TLS 1.3 es mejor?
> 1. **Más rápido**: 1-RTT vs 2-RTT (0-RTT con resumption)
> 2. **Más seguro**: Elimina cipher suites vulnerables (RSA key exchange, CBC mode, MD5, SHA1)
> 3. **Forward secrecy obligatoria**: Siempre usa ECDHE, nunca RSA key exchange
> 4. **Menos complejidad**: 4 mensajes vs 8-10 en TLS 1.2

## Cipher suites

Una **cipher suite** es un conjunto de algoritmos criptográficos que se negocian durante el handshake.

### TLS 1.3 Cipher Suites (solo 4)

```
TLS_AES_256_GCM_SHA384         → AES-256-GCM + SHA384
TLS_AES_128_GCM_SHA256         → AES-128-GCM + SHA256
TLS_CHACHA20_POLY1305_SHA256   → ChaCha20-Poly1305 + SHA256
TLS_AES_128_CCM_SHA256         → AES-128-CCM + SHA256
```

TLS 1.3 eliminó todo lo demás. Solo quedan los que son seguros y eficientes.

### TLS 1.2 Cipher Suites (decenas de opciones, muchas malas)

```
# Buenas (con ECDHE para forward secrecy):
ECDHE-RSA-AES256-GCM-SHA384
ECDHE-RSA-AES128-GCM-SHA256
ECDHE-ECDSA-AES256-GCM-SHA384

# Malas (sin forward secrecy):
RSA-AES256-GCM-SHA384        ← Si el servidor se compromete, TODO el tráfico pasado se descifra

# Muy malas (ya no deberían usarse):
RC4-SHA                      ← RC4 está roto
3DES-SHA                     ← vulnerable a Sweet32
NULL-SHA                     ← ¡sin cifrado!
```

> [!tip] Forward secrecy (PFS)
> **Forward secrecy** significa que si la clave privada del servidor se compromete en el futuro, los mensajes del pasado NO pueden descifrarse.
>
> - Con **ECDHE** (Differential Hellman Elliptic Curve): cada sesión genera claves temporales diferentes. PFS ✓
> - Con **RSA** key exchange: la clave de sesión se cifra con la clave RSA del servidor. Si se roba esa clave, todo el tráfico pasado se descifra. PFS ✗
>
> **TLS 1.3 obliga a PFS. TLS 1.2 lo hace opcional. Siempre usa ECDHE.**

## Certificados digitales

### ¿Qué es un certificado?

Un certificado digital es un documento que vincula una **identidad** (dominio) con una **clave pública**, firmado por una **Autoridad de Confianza (CA)**.

```
┌────────────────────────────────────────────────────────────┐
│                  CERTIFICADO TLS                            │
├────────────────────────────────────────────────────────────┤
│ Subject: CN=ejemplo.com                                    │
│ Subject Alternative Names:                                 │
│   - ejemplo.com                                            │
│   - www.ejemplo.com                                        │
│ Valid From: 2024-01-01 00:00:00 UTC                        │
│ Valid To:   2024-04-01 00:00:00 UTC                        │
│ Public Key: RSA 2048-bit / ECDSA P-256                    │
│ Issuer: Let's Encrypt Authority X3                        │
│ Signature: [firma criptográfica de Let's Encrypt]          │
└────────────────────────────────────────────────────────────┘
```

### Chain of Trust (cadena de confianza)

```
Client
  │
  │ Verifica la firma del certificado
  │
  ▼
Certificado del dominio (ejemplo.com)
  │ Firmado por
  ▼
Certificado intermedio (Let's Encrypt Authority X3)
  │ Firmado por
  ▼
Certificado raíz (ISRG Root X1)
  │ Pre-installado en todos los navegadores
  ▼
Trust Store del navegador (raíz de confianza)
```

1. El servidor envía su certificado + certificado intermedio
2. El cliente verifica la firma del intermedio con la CA raíz
3. El cliente verifica que la CA raíz está en su trust store (pre-instalada)
4. Si todo verifica → el certificado es válido

### Tipos de validación de certificados

| Tipo | Validación | Duración máxima | Casos de uso |
|------|-----------|-----------------|-------------|
| **DV** (Domain Validated) | Solo demuestra control del dominio | 90 días (Let's Encrypt) | Blogs, portfolios, proyectos personales |
| **OV** (Organization Validated) | Validación de dominio + datos de la organización | 1 año | Empresas, SaaS |
| **EV** (Extended Validation) | Validación máxima (legal, financiera, operativa) | 1 año | Bancos, gobiernos, grandes corporaciones |

> [!note] EV certificates están en desuso
> Chrome eliminó el indicador verde de EV en 2019. Los certificados EV se ven exactamente igual que los DV en la barra de direcciones (un candado). Solo las verificaciones OV/DV importan.

### ¿Qué es el SAN (Subject Alternative Name)?

El campo SAN permite incluir **múltiples dominios** en un solo certificado:

```
Subject Alternative Names:
  - ejemplo.com
  - www.ejemplo.com
  - api.ejemplo.com
  - *.internal.ejemplo.com    ← wildcard
```

> [!tip] Wildcard certificates
> `*.ejemplo.com` cubre cualquier subdominio de primer nivel:
> - www.ejemplo.com ✓
> - api.ejemplo.com ✓
> - app.ejemplo.com ✓
> - mail.ejemplo.com ✓
>
> Pero NO cubre subdominios anidados:
> - sub.www.ejemplo.com ✗
>
> Y tampoco cubre el dominio base:
> - ejemplo.com ✗

## SNI (Server Name Indication)

**SNI** permite que un servidor físico albergue múltiples sitios HTTPS con diferentes certificados en la misma IP.

### El problema sin SNI

```
IP: 1.2.3.4
Puerto: 443

¿Qué certificado envio al cliente?
- ¿El de ejemplo.com?
- ¿El de otro-sitio.com?
- ¿El de mi-app.io?

Todos están en la misma IP, mismo puerto.
```

### La solución: SNI

```
Cliente                          Servidor
   │                                │
   │─── ClientHello ──────────────→ │
   │  SNI: www.ejemplo.com          │  "Hola, quiero conectar con www.ejemplo.com"
   │                                │
   │←── ServerHello + Certificate ──│  "Aquí va el certificado de ejemplo.com"
```

El cliente indica **qué dominio quiere** EN el propio ClientHello (antes de que empiece el handshake). El servidor entonces envía el certificado correcto.

> [!tip] SNI es universal hoy en día
> Todos los navegadores modernos envían SNI. Es parte del estándar desde 2003. El único problema es que SNI viaja en texto plano (no está cifrado), por lo que un observador de red puede saber qué dominio estás visitando. Esto se está corrigiendo con **Encrypted SNI (ESNI/ECH)** en TLS 1.3.

## HSTS (HTTP Strict Transport Security)

HSTS es un header que le dice al navegador: "Solo comunícate conmigo por HTTPS, nunca por HTTP":

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### ¿Qué hace?

```
1. Usuario escribe: http://ejemplo.com
   ↓
2. Petición llega al servidor (en claro, sin cifrar)
   ↓
3. Servidor responde:
   Strict-Transport-Security: max-age=31536000
   (redirige a https://ejemplo.com)
   ↓
4. El navegador guarda esta instrucción durante max-age segundos
5. La próxima vez que el usuario escriba http://ejemplo.com,
   el navegador UPGRADE automáticamente a https://ejemplo.com
   SIN hacer la petición HTTP
```

### Parámetros

| Parámetro | Descripción |
|-----------|-------------|
| `max-age=31536000` | Duración en segundos (1 año) |
| `includeSubDomains` | Aplica a todos los subdominios |
| `preload` | Permite añadir a la lista preload del navegador |

> [!caution] Preload HSTS
> Cuando activas `preload`, tu dominio se añade a una lista hardcodeada en todos los navegadores. **Esto es irreversible** — una vez en la lista, no puedes quitarte.
>
> Solo usa preload si:
> 1. Tienes HSTS activo en TODOS los subdominios
> 2. Tienes un `max-age` de al menos 31536000 (1 año)
> 3. Tienes un header `includeSubDomains`
> 4. Aceptas que no podrás revertir fácilmente

### Verificar HSTS

```bash
# Verificar si un dominio tiene HSTS activo
curl -I https://ejemplo.com | grep strict-transport-security

# Verificar si un dominio está en la lista preload
curl https://hstspreload.org/api/v2/domains/ejemplo.com
```

## Certificados: autofirmados vs CA

| Característica | Autofirmado (Self-Signed) | CA (Let's Encrypt, DigiCert) |
|---------------|--------------------------|------------------------------|
| Firman | Tú mismo | Una CA de confianza |
| Confianza del navegador | ❌ No confiable (warning) | ✅ Confiable |
| Validación | Ninguna | Validación de dominio |
| Coste | Gratis | Gratis (Let's Encrypt) a $100+/año |
| Duración | Ilimitada (tú decides) | 90 días (LE) a 1-2 años |
| Uso | Desarrollo, testing, internal | Producción |

> [!tip] Certificados autofirmados en producción
> En algunos casos internos (servidores internos, APIs privadas, Kibana, Grafana), usar certificados autofirmados tiene sentido. En ese caso:
> 1. Genera un certificado autofirmado
> 2. Distribuye el certificado público manualmente a todos los clientes
> 3. Configura los clientes para confiar en ese certificado

## Comparación rápida: TLS vs SSH vs IPSec

| | TLS | SSH | IPSec |
|--|-----|-----|-------|
| **Capa** | Capa de aplicación | Capa de aplicación | Capa de red |
| **Uso** | Web, email, DNS over TLS | Acceso remoto a servidores | VPNs |
| **Cifrado** | Sí (AES, ChaCha20) | Sí (AES, ChaCha20) | Sí (AES, 3DES) |
| **Autenticación** | Certificado + clave pública | Clave pública + contraseña | Pre-shared key o certificado |
| **Forward secrecy** | Con ECDHE | Siempre | Opcional |

## Resumen

- TLS 1.3 es el estándar: 1-RTT, forward secrecy obligatoria, solo cipher suites seguras
- El handshake negocia versión, cipher suite, autentica el servidor con certificado
- Forward secrecy (ECDHE) protege contra compromiso futuro de claves
- SAN permite múltiples dominios en un certificado
- SNI permite hosting de múltiples dominios HTTPS en una IP
- HSTS fuerza el uso de HTTPS y previene ataques de downgrade

> [!quote] La clave
> TLS no es solo "cifrado". Es un protocolo completo que garantiza: confidencialidad (cifrado), integridad (no se puede modificar), y autenticidad (el servidor es quien dice ser). TLS 1.3 es rápido, simple y seguro.

## Conexión con el resto de la wiki

| Concepto tocado | Artículo en profundidad |
|-----------------|------------------------|
| Cómo navega de URL a página | [[02-como-navegar-de-url-a-pagina]] (paso 6: TLS handshake) |
| DNS y CAA | [[03-dns-profundo]] (CAA controla quién puede emitir certificados) |
| Let's Encrypt | [[08-lets-encrypt-certificados]] (cómo obtener certificados gratuitos) |
| Nginx/Caddy como TLS terminator | [[14-servidores-procesos-processos]] |
| Cloudflare SSL modes | [[04-dns-cdn-y-cdnflare]] |
