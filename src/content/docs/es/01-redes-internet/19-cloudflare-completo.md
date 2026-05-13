---
title: "Cloudflare completo: CDN, DNS, WAF, DDoS, SSL/TLS y Workers"
description: "Cloudflare a profundidad total: CDN, DNS, WAF, protección DDoS, SSL/TLS, Workers, Argo, Stream, Image Optimizer, y cómo configurarlo todo para producción."
---

# Cloudflare completo: CDN, DNS, WAF, DDoS, SSL/TLS y Workers

> [!tip] Cloudflare en una frase
> Cloudflare es **mucho más que un CDN**: es una plataforma completa de seguridad y rendimiento que opera en el edge de Internet con más de 300 data centers en 120+ ciudades. Este artículo lo cubre TODO.

## ¿Qué es Cloudflare?

Cloudflare es un proxy inverso global que se posiciona entre tus usuarios y tu servidor origin. Todo el tráfico pasa por Cloudflare antes de llegar a tu servidor.

### La red de Cloudflare

```
                         Cloudflare Edge Network
              ┌─────────────────────────────────────────┐
              │                                         │
    Buenos Aires │    Miami      │    Frankfurt          │
    Santiago    │    Newark     │    Ámsterdam          │
    Ciudad de México│  Dallas  │    Londres           │
              │                                         │
    ───────────┴──────────────────────────────────────────┘
              │
              ▼
    Tu Servidor Origin (único punto de exposición)
```

Cloudflare opera en **más de 300 ciudades**, con una capacidad de red de **22+ Tbps** (picos de más de 71.1 Tbps durante ataques DDoS masivos).

### Lo que Cloudflare hace por ti

| Servicio | Qué hace | Plan Free | Plan Pro | Enterprise |
|----------|----------|-----------|----------|------------|
| **CDN** | Caché global de contenido | ✓ | ✓ | ✓ |
| **DNS** | Resolución de nombres rápida | ✓ | ✓ | ✓ |
| **SSL/TLS** | Certificados automáticos | ✓ | ✓ | ✓ |
| **DDoS Protection** | Absorbe ataques volumétricos | ✓ | ✓ | ✓ |
| **WAF** | Firewall de aplicaciones web | ✓ | ✓+ | ✓+ |
| **Rate Limiting** | Limita peticiones | ✓ | ✓ | ✓ |
| **Bot Management** | Detecta bots | Básico | Avanzado | Completo |
| **Argo Smart Routing** | Ruteo inteligente | ✗ | ✗ | ✓ |
| **Workers** | Edge computing | ✓ | ✓ | ✓ |
| **Stream** | Video hosting | ✗ | ✗ | ✗ |
| **Image Optimizer** | Optimización de imágenes | ✗ | ✓ | ✓ |

## 1. CDN (Content Delivery Network)

### Cómo funciona el caché de Cloudflare

```
Usuario (Buenos Aires)
       │
       │ HTTPS (20ms)
       ▼
Cloudflare Edge (Santiago)
       │
       ├── ¿Tiene caché válida? → Sirve directamente ✓ (20ms total)
       │
       └── ¿No tiene caché? → Pide al origin
              │
              │ HTTP (80ms)
              ▼
         Tu Servidor Origin (Frankfurt)
              │
              │ Guarda en caché (TTL: 2 horas)
              │
              ▼
         Devuelve al usuario y guarda copia en Edge
```

### Qué se cachea y qué no

| Se cachea | NO se cachea |
|-----------|-------------|
| Archivos estáticos (CSS, JS, imágenes, fuentes) | Páginas con `Cache-Control: private` |
| HTML con `Cache-Control: public` | Respuestas con cookies de sesión |
| Contenido con `max-age` explícito | Respuestas con `Vary: cookie` |
| Assets con hash en el nombre | Páginas dinámicas (login, dashboard) |

### Control de caché con headers

```
# En tu servidor origin, envía estos headers:
Cache-Control: public, max-age=3600          ← Cachear 1 hora
Cache-Control: public, max-age=31536000, immutable  ← Cachear 1 año (assets con hash)
Cache-Control: no-store                      ← Nunca cachear
Cache-Control: no-cache                      ← Cachear pero validar con ETag
Cache-Control: private, max-age=3600         ← Solo caché del navegador (no de CDN)
```

> [!tip] Immutable es clave para assets
> Los archivos con hash en el nombre (ej: `app.a1b2c3.js`) nunca cambian. Con `immutable`, Cloudflare y el navegador no los validan nunca — solo los sirven desde caché. Esto elimina peticiones de validación (If-None-Match / If-Modified-Since).

### Niveles de caché

| Nivel | Descripción | Plan |
|-------|-------------|------|
| **Standard** | Caché normal en edge | Todos |
| **Cache Reserve** | Caché en disco si el edge está lleno | Business+ |
| **Super Cache** | Caché de solo lectura para contenido estático | Enterprise |
| **Bypass** | Saltar caché para URLs específicas | Todos (Page Rules) |
| **No Query** | Ignorar query params al verificar caché | Pro+ |

> [!tip] Cache Reserve
> Cuando el edge de Cloudflare se queda sin memoria para caché (ocurre en sitios muy grandes con muchos URLs diferentes), Cloudflare puede leer desde un disco permanente (Cache Reserve). Es más lento que memoria pero evita caché misses costosos al origin.

### Page Rules para controlar caché

```
# Regla 1: Caché largo para assets estáticos
*.ejemplo.com/assets/*
→ Cache Level: Cache Everything
→ Edge Cache TTL: 1 month

# Regla 2: Bypass caché para la API
api.ejemplo.com/api/*
→ Cache Level: Bypass
→ Browser Cache TTL: 0

# Regla 3: Forzar HTTPS
*.ejemplo.com/*
→ Always Use HTTPS: On
→ Automatic HTTPS Rewrites: On

# Regla 4: Redirección
*.ejemplo.com/http/*
→ Forwarding URL: https://ejemplo.com/$2 (301)
```

## 2. DNS

### DNS de Cloudflare

Cloudflare opera los DNS más rápidos del mundo con **1.1.1.1** y **1.0.0.1**.

### Registros DNS que soporta

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| **A** | IPv4 | `@ → 192.0.2.1` |
| **AAAA** | IPv6 | `@ → 2001:db8::1` |
| **CNAME** | Alias | `www → example.com` |
| **MX** | Email | `@ → mail.example.com (10)` |
| **TXT** | Texto arbitrario | `@ → v=spf1 include:_spf.google.com ~all` |
| **SRV** | Servicio | `_sip._tcp → sip.example.com (5060)` |
| **CAA** | Control de CAs | `@ → 0 issue "letsencrypt.org"` |
| **NS** | Nameservers | `@ → ns1.cloudflare.com` |
| **TLSA** | TLS Authentication | Para DANE |
| **URL/FWD** | Forwarding | `blog → https://medium.com/...` |
| **SRV** | Servicio con prioridad | VoIP, XMPP |

### Proxy DNS: Proxied vs DNS only

```
Proxied (naranja ☁️):
  Usuario → Cloudflare (CDN+WAF+DDoS) → Tu Servidor
  Beneficios: CDN, WAF, DDoS protection, SSL
  Limitaciones: Solo puertos 80, 443, 2052, 2082, 2086, 2095

DNS only (gris ☁️):
  Usuario → Cloudflare DNS → Tu Servidor (directo)
  Beneficios: Puerto arbitrario, sin costo de edge
  Limitaciones: Sin CDN, sin WAF, sin protección DDoS
```

### DNSSEC

Cloudflare soporta DNSSEC para prevenir DNS spoofing/poisoning:

```
En la zona DNS:
  DNSSEC Enabled: On

Cloudflare genera y firma:
  DS Record (debes copiarlo en tu registrar)
  │
  Root → TLD → Your Zone → Records (firmados)
```

### DNS-over-HTTPS y DNS-over-TLS

Cloudflare soporta consultas DNS cifradas:

```
DNS tradicional (texto plano):
  Cliente → DNS:53 → Resolver

DNS-over-HTTPS (DoH):
  Cliente → HTTPS:443 → 1.1.1.1/dns-query

DNS-over-TLS (DoT):
  Cliente → TLS:853 → 1.1.1.1
```

> [!tip] 1.1.1.1
> Puedes configurar tu sistema para usar 1.1.1.1 como DNS:
> ```bash
> # En /etc/resolv.conf
> nameserver 1.1.1.1
> nameserver 1.0.0.1
> ```

## 3. Protección SSL/TLS

### Modos SSL/TLS de Cloudflare

| Modo | Cliente ↔ Cloudflare | Cloudflare ↔ Origin | Cuándo usar |
|------|---------------------|--------------------|-------------|
| **Off** | Sin HTTPS | Sin HTTPS | Solo pruebas locales |
| **Flexible** | HTTPS | HTTP | Origin sin SSL (⚠️ inseguro) |
| **Full** | HTTPS | HTTPS (CF auto-cert) | Origin con certificado auto-emitido |
| **Full (strict)** | HTTPS | HTTPS (válido) | **RECOMENDADO** para producción |
| **Strict** | HTTPS | HTTPS (solo válido) | Máxima seguridad |

### Certificados

| Tipo | Emisor | Validación | Duración |
|------|--------|-----------|----------|
| **Universal SSL** | Let's Encrypt (Cloudflare) | DV | 90 días (auto-renovable) |
| **Origin Certificate** | Cloudflare (CA propia) | DV | 15 años (solo Cloudflare→Origin) |
| **Advanced Certificate** | DigiCert | DV/OV/EV | 1 año (Enterprise) |

### Advanced TLS Features

```
# OCSP Stapling (verificación rápida de certificados)
TLS 1.3:
  Server → Client: Certificate + OCSP Staple
  El cliente verifica sin contactar a la CA

# Early Data (0-RTT)
  Cliente reenvía datos en el primer mensaje de TLS 1.3
  Vulnerable a replay attacks — usar con precaución

# ECH (Encrypted Client Hello)
  El SNI viaja cifrado en lugar de en texto plano
  Previene que ISPs/servidores sepan qué dominio visitas
```

## 4. WAF (Web Application Firewall)

### Security Rules

Cloudflare filtra tráfico malicioso antes de que llegue a tu servidor.

#### Ruleset: Cloudflare Managed Rules

Reglas predefinidas por Cloudflare que protegen contra las amenazas más comunes:

```yaml
ruleset: "Cloudflare Managed Rules"
rules:
  - description: "Block common web attacks (SQL injection, XSS)"
    action: "block"
    expression: "(http.payload contains \"<script>\") OR (http.request.uri.query contains \"1=1\")"

  - description: "Block PHP backdoors"
    action: "block"
    expression: "http.request.uri.path matches \".*\\.(php|asp|aspx)\""

  - description: "Block directory traversal"
    action: "block"
    expression: "http.request.uri.path contains \"../\""
```

#### Custom WAF Rules

Reglas personalizadas escritas por ti:

```
# Bloquear acceso a paths sensibles
(http.request.uri.path matches "^/wp-admin" OR
 http.request.uri.path matches "^/phpmyadmin" OR
 http.request.uri.path matches "^/\.env" OR
 http.request.uri.path matches "^/wp-login\.php")
→ Action: Block

# Bloquear scans
(http.user_agent contains "sqlmap" OR
 http.user_agent contains "nikto" OR
 http.user_agent contains "nmap" OR
 http.user_agent contains "masscan")
→ Action: Block

# Rate limiting en login
(http.request.uri.path matches "^/api/login$" AND
 http.request.method == "POST")
→ Rate Limit: 5 requests per minute per IP
→ Action: Managed Challenge (JS Challenge)
```

#### Ruleset Builder (expresiones)

Cloudflare usa un lenguaje de expresiones basado en JSON:

```json
{
  "filter": {
    "expression": "http.request.uri.path matches \"^/api/(login|register)\" and http.request.method == \"POST\"",
    "description": "Rate limit login y register endpoints"
  },
  "action": "rate_limit",
  "rate_limit": {
    "period": 60,
    "quantity": 10,
    "match": {
      "headers": [
        {
          "match_type": "ip",
          "value": "http.source_ip"
        }
      ]
    }
  }
}
```

### Bot Management

| Plan | Funcionalidad |
|------|-------------|
| **Free** | Basic bots (scrapers conocidos) |
| **Pro** | Bot Fight Mode (JavaScript challenge) |
| **Business** | Bot fights + Bot signatures |
| **Enterprise** | Full bot management (behavioral analysis, JS fingerprints) |

#### Bot types

| Bot type | Descripción | Mitigación |
|----------|-------------|------------|
| **Good bots** | Googlebot, Bingbot, etc. | Allowlist |
| **Abusive bots** | Scrapers, credential stuffing | JS challenge, Block |
| **Bad bots** | Malware, DDoz, scanners | Block |
| **Spam bots** | Comment spam, form spam | CAPTCHA, Block |

### Rate Limiting

```yaml
# Ejemplo: Rate limiting en endpoints sensibles
rate_limit:
  name: "Login rate limit"
  match:
    - headers:
        - name: "X-Forwarded-For"
          operator: "ip"
    - http:
        - method: "POST"
          path: "/api/login"
  threshold: 5
  period: 60
  response:
    status_code: 429
    body: "Too many login attempts. Try again in 60 seconds."
```

## 5. Protección DDoS

### Cloudflare absorbe ataques DDoS

Cloudflare tiene una de las redes más grandes del mundo para absorber ataques DDoS.

### Tipos de ataque y mitigación

| Tipo de ataque | Descripción | Mitigación en Cloudflare |
|----------------|-------------|-------------------------|
| **Volumétrico** | Inunda la red con tráfico (Gbps) | Su red de 22+ Tbps absorbe el tráfico |
| **Protocolo** | Explota debilidades en TCP/IP (SYN flood, UDP flood) | Completa el handshake por ti |
| **HTTP Flood** | Satura la capa de aplicación con peticiones | Caché, JS challenge, rate limiting |
| **Slowloris** | Abre muchas conexiones lentas para saturar | Timeout automático de conexiones |

### ¿Cómo funciona la protección?

```
Ataque: 100 Gbps desde 10,000 bots
       │
       ▼
┌──────────────────────────────────────────┐
│  Cloudflare Edge (22+ Tbps capacity)     │
│                                          │
│  1. Los packets llegan a cualquier Edge   │
│  2. Anycast routing distribuye el tráfico │
│  3. Análisis en tiempo real de cada packet│
│  4. Bloquea packets maliciosos            │
│  5. Cachea respuestas legítimas           │
│  6. Rate limita IPs sospechosas           │
│  7. JS challenge para nuevos visitantes   │
│  8. Solo el tráfico legítimo llega al     │
│     origin (normalmente < 1% del ataque) │
└──────────────────────────────────────────┘
       │
       ▼
Tu servidor: recibe solo ~50 Mbps legítimos
```

> [!tip] Anycast routing
> Cloudflare usa **Anycast**: la misma IP (104.16.0.0/12) se anuncia desde TODOS sus data centers. Un packet llega siempre al data center más cercano, lo que distribuye automáticamente el tráfico de ataque.

## 6. Cloudflare Workers

**Cloudflare Workers** es una plataforma de **edge computing** que te permite ejecutar código JavaScript/WASM en los data centers de Cloudflare, cerca de tus usuarios.

### Características

```
Tu código se ejecuta en el Edge de Cloudflare (300+ ciudades)
  ↓
Latencia < 50ms para cualquier usuario en el mundo
  ↓
Sin servidores que gestionar, sin cold starts, sin scaling
```

### ¿Qué puedes hacer con Workers?

| Caso de uso | Descripción |
|-------------|-------------|
| **API proxy** | Reenviar peticiones a tu backend |
| **Authentication** | Validar tokens en el edge |
| **A/B testing** | Servir versiones diferentes de tu app |
| **Redirects** | Redirigir por país, idioma, dispositivo |
| **Headers manipulation** | Añadir/modificar headers en el edge |
| **Cache control** | Lógica de caché personalizada |
| **Bot protection** | Validar requests con lógica personalizada |
| **Image manipulation** | Redimensionar imágenes en el edge |
| **Edge functions** | Ejecutar lógica antes de llegar al origin |

### Ejemplo: Worker de authentication

```javascript
// Worker que valida tokens JWT en el edge
export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Validar token solo en rutas de API
    if (url.pathname.startsWith('/api/')) {
      const token = request.headers.get('Authorization');
      if (!token || !validateJwt(token)) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    // Proxy al origin si pasa la validación
    return fetch('https://your-origin.com' + url.pathname);
  }
};
```

### Edge kv y Durable Objects

```javascript
// Edge KV: base de datos distribuida en el edge
import { getKV } from '@cloudflare/kv-asset-handler';

// Durable Objects: estado persistente en el edge
// Útil para chat, sesiones, contadores
```

### Durable Objects vs Edge KV

| | Edge KV | Durable Objects |
|--|---------|----------------|
| **Tipo** | Key-value cache (sin transaction) | Base de datos con estado |
| **Velocidad** | ~5ms lectura | ~1ms lectura |
| **Consistencia** | Eventual | Fuerte |
| **Uso** | Configuración, caché | Sesiones, chat, contadores |

## 7. Argo Smart Routing

Argo Smart Routing optimiza la ruta de tu tráfico a través de la red de Cloudflare:

```
Sin Argo:
  Usuario → Edge local → Internet pública (ruta aleatoria) → Origin

Con Argo Smart Routing:
  Usuario → Edge local → Red privada de Cloudflare (ruta óptima) → Origin

Beneficios:
  - Reduce latencia en 15-30% en rutas internacionales
  - Evita congestión de Internet pública
  - SLA de 99.99% de disponibilidad
```

## 8. Cloudflare Stream y Pages

### Cloudflare Stream

Hosting de video optimizado:

```
Subes video → Cloudflare lo transcibe (varios codecs/resoluciones)
  ↓
Reproductor integrado con adaptive bitrate
  ↓
CDN global para distribución
  ↓
Webhooks para notificaciones
```

### Cloudflare Pages

Hosting estático/SSR con CI/CD integrado:

```
Push a GitHub → Cloudflare detecta el push
  ↓
Build automático (npm run build)
  ↓
Deploy a Cloudflare Edge
  ↓
URL: https://your-app.pages.dev
  ↓
Preview deployments para PRs
```

## 10. Planes y precios

### Planes

| Característica | Free | Pro ($20) | Business ($200) | Enterprise (custom) |
|---------------|------|-----------|----------------|--------------------|
| **Banda ancha** | Ilimitada | Ilimitada | Ilimitada | Ilimitada |
| **Zonas DNS** | 1 | 5 | 5 | Ilimitadas |
| **Workers** | 100k req/día | 10M req/mes | 10M req/mes | 10M req/mes |
| **WAF** | Basic | Advanced | Custom | Custom |
| **Bot Management** | Basic | Bot Fight | Signatures | Full |
| **Rate Limiting** | 1 rule | 5 rules | 25 rules | Ilimitadas |
| **SSL** | Universal | Advanced | Advanced | Advanced |
| **Support** | Community | Email | Chat+Email | 24/7+SLA |
| **Custom SSL** | ✗ | ✓ | ✓ | ✓ |
| **Page Rules** | 3 | 25 | 50 | Ilimitadas |
| **Cache Reserve** | ✗ | ✗ | ✓ | ✓ |

### Reglas de seguridad

```
# Lista de reglas recomendadas para cualquier sitio en producción:

# 1. Bloquear paths sensibles
Block: path contains "/wp-admin" OR path contains "/phpmyadmin" OR path contains "/.env"

# 2. Rate limit en login
Rate limit: /api/login → 5 req/min per IP → Managed Challenge

# 3. Rate limit en API
Rate limit: /api/* → 100 req/min per IP → Return 429

# 4. Bot fight mode (Pro+)
Enable Bot Fight Mode

# 5. Block countries no relevantes (si aplica)
Block: country is CN, RU (solo si no esperas tráfico de esos países)

# 6. SSL/TLS → Full (strict)
Full (strict) con certificado válido en origin
```

## Resumen

- Cloudflare es una plataforma completa: CDN, DNS, WAF, DDoS, SSL, Workers
- El proxy (naranja) activa todas las protecciones; DNS only (gris) no
- Full (strict) es el modo SSL recomendado para producción
- WAF protege contra SQL injection, XSS, directory traversal, etc.
- Rate limiting protege contra brute-force y API abuse
- Workers permite edge computing con JavaScript/WASM
- Argo Smart Routing optimiza rutas internacionales
- Pages es hosting estático/SSR con CI/CD integrado

> [!quote] La clave
> Cloudflare no es un producto, es un ecosistema. Desde el plan free puedes obtener CDN, SSL y protección DDoS. Planes superiores añaden WAF avanzado, cache reserve, y más. Workers y Pages te dan edge computing y CI/CD. Para producción seria, combina: Full strict SSL, WAF con reglas custom, rate limiting, y Workers para lógica de edge.

## Conexión con el resto de la wiki

| Concepto tocado | Artículo en profundidad |
|-----------------|------------------------|
| DNS en general | [[03-dns-profundo]] |
| SSL/TLS | [[07-https-tls]] |
| Certificados | [[08-lets-encrypt]] |
| HTTP | [[05-http-profundo]] |
| Firewalls | [[17-firewalls-proxies-loadbalancers]] |
| WAF | Este artículo (WAF de Cloudflare) |
| Workers | Este artículo (Workers section) |
| VPS | [[20-vps]] (configurar servidor origin) |
