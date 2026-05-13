# CDN y Cloudflare

> [!tip] CDN en una frase
> Un CDN (Content Delivery Network) es una **red de servidores repartidos por el mundo** que guardan caché de tu contenido para servirlo desde la ubicación más cercana al usuario.

## ¿Qué es un CDN?

### El problema que resuelve

Imagina que tu servidor está en Frankfurt (Alemania). Un usuario en Buenos Aires quiere cargar tu página:

```
Buenos Aires ──────────────────────────────────────────→ Frankfurt
               200ms solo ida (ping alto)
               + 200ms vuelta
               = 400ms solo para el TCP handshake
               + 400ms para el TLS handshake
               = ~1 segundo SOLO para conectar
```

Eso es sin contar el tiempo de descarga. Un CDN soluciona esto.

### La solución del CDN

```
                  Cloudflare Edge (Santiago de Chile)
                              │
                   20ms ←─── Usuario (Buenos Aires)
                              │
                    80ms ───→ Cloudflare Edge (Frankfurt)
                              │
                    Tu Servidor (Origin)
```

El usuario en Buenos Aires se conecta a un servidor de Cloudflare en Santiago (20ms en lugar de 200ms). Si Cloudflare ya tiene caché de tu contenido, lo sirve directamente. Si no, lo pide a tu servidor origin (Frankfurt), lo cachéa, y lo sirve al usuario.

### ¿Qué cachéa un CDN?

| Qué se cachea | Qué NO se cachea |
|---------------|------------------|
| Archivos estáticos (CSS, JS, imágenes, fuentes) | Páginas dinámicas (login, dashboard) |
| Contenido de blogs, documentación | APIs que devuelven datos personalizados |
| Páginas HTML con `Cache-Control: public` | Respuestas con `Cache-Control: private` |
| | Respuestas con cookie de sesión |

> [!tip] Control de caché
> El CDN respeta los headers HTTP que envías desde tu servidor:
> - `Cache-Control: max-age=3600` → Cachear 1 hora
> - `Cache-Control: no-store` → Nunca cachear
> - `Cache-Control: public, max-age=31536000, immutable` → Cachear 1 año (para archivos con hash en el nombre)

## Cloudflare: El ecosistema

Cloudflare es mucho más que un CDN. Es una plataforma completa de red.

### Posicionamiento: ¿Qué es un proxy inverso?

Cloudflare se posiciona **entre tu usuario y tu servidor**. Se llama **proxy inverso** porque:
- Un proxy normal: cliente → proxy → internet (el proxy actúa por el cliente)
- Un proxy inverso: internet → proxy → servidor (el proxy actúa por el servidor)

```
Internet          Cloudflare                    Tu Servidor
   │                    │                             │
   ├─── HTTPS ────────→│  (Edge, WAF, CDN)           │
   │                    │  Cache, compresión,         │
   │                    │  DDoS protection            │
   │                    │  SSL/TLS termination        │
   │                    │─── HTTP ───────────────────→│
   │                    │   (sin TLS, en tu red local)│
   │←── HTTPS ─────────├─── HTTP ←───────────────────│
   │                    │   (respuesta del origin)    │
```

### Planes de Cloudflare

| Plan | Precio | Características clave |
|------|--------|----------------------|
| **Free** | $0 | CDN, SSL, DDoS básico, 1 zona DNS |
| **Pro** | $20/zona/mes | WAF avanzado, Page Rules, Analytics, Bot Fight Mode |
| **Business** | $200/zona/mes | WAF personalizado, SSL flexible, Origin Server CS, Cache Reserve |
| **Enterprise** | Custom | Todo lo anterior + SLA, SSL avanzado, Cloudflare Load Balancer, Custom error pages, etc. |

> [!tip] Para proyectos personales
> El plan **Free** es sorprendentemente completo. Para la mayoría de proyectos personales y pequeños, es más que suficiente.

### Registros DNS de Cloudflare

Cuando usas Cloudflare como proxy DNS:

| Tipo | Value | Proxy status | Descripción |
|------|-------|-------------|-------------|
| A | IP del servidor | Proxied (naranja) | Tráfico pasa por Cloudflare |
| A | IP del servidor | DNS only (gris) | Tráfico va directo al servidor |
| CNAME | otro.dominio.com | Proxied | Alias con proxy |
| CAA | 0 issue "letsencrypt.org" | DNS only | Seguridad SSL |
| TXT | v=spf1... | DNS only | Verificación email |
| MX | mail.dominio.com | DNS only | Servidor de correo |

> [!warning] Proxy vs DNS only
> - **Proxied (naranja)**: Cloudflare intercepta todo el tráfico. Tienes CDN, WAF, protección DDoS. Pero NO puedes usar puertos arbitrarios (solo 80, 443, 2052, 2082, 2086, 2095).
> - **DNS only (gris)**: Cloudflare solo responde DNS. El tráfico va directo a tu servidor. Necesario para puertos no HTTP, SSH, etc.

## Configuración SSL/TLS en Cloudflare

### Modos de SSL

| Modo | Descripción | Cuándo usar |
|------|-------------|-------------|
| **Off** | No usa HTTPS en absoluto | Pruebas locales, desarrollo |
| **Flexible** | Cliente ↔ Cloudflare (HTTPS), Cloudflare ↔ Origin (HTTP) | Tu origin no tiene SSL configurado |
| **Full** | Cliente ↔ Cloudflare (HTTPS), Cloudflare ↔ Origin (HTTPS) | Tu origin tiene SSL (auto-emitido por Cloudflare) |
| **Full (strict)** | Igual que Full, pero verifica que el certificado del origin sea válido | **RECOMENDADO** para producción |
| **Strict** | Igual que Full strict, pero rechaza certificados autofirmados | Máxima seguridad |

> [!caution] Flexible vs Full Strict
> - **Flexible** es peligroso: crea un cuello de botella de seguridad. El tráfico entre Cloudflare y tu servidor NO está cifrado.
> - **Full (strict)** es lo correcto: cifra todo el camino. Necesitas un certificado válido en tu servidor origin.
> - Para producción, **siempre usa Full (strict)** con un certificado válido en el origin.

### Certificados SSL de Cloudflare

Cloudflare ofrece dos tipos de certificados:

| Tipo | Emisor | Validez | Descripción |
|------|--------|---------|-------------|
| **Universal SSL** | Let's Encrypt (Cloudflare) | 90 días (auto-renovable) | Para `*.tudominio.com` |
| **Origin Certificate** | Cloudflare (CA propia) | 15 años | Solo para el tráfico Cloudflare → Origin. NO lo instales en tu servidor como certificado público |

> [!tip] Flujo recomendado
> 1. En Cloudflare, genera un **Origin Certificate** (solo para tráfico interno)
> 2. Instala ese certificado en tu servidor origin (Nginx, Caddy, etc.)
> 3. Configura Cloudflare en modo **Full (strict)**
> 4. Cloudflare usa su propio certificado (Let's Encrypt) para el tráfico Cliente ↔ Cloudflare
> 5. El origin usa su certificado auto-emitido para el tráfico Cloudflare → Origin

## WAF (Web Application Firewall)

Cloudflare tiene un **firewall de aplicaciones web** integrado que filtra tráfico malicioso antes de que llegue a tu servidor.

### Reglas comunes

| Regla | Qué hace | Ejemplo |
|-------|----------|---------|
| **IP Block** | Bloquea tráfico de una IP o rango | Bloquear tráfico de un país |
| **IP Allow** | Solo permite tráfico de IPs específicas | Acceso SSH solo desde tu IP |
| **Rate Limiting** | Limita peticiones por tiempo | Máximo 100 peticiones/minuto por IP |
| **Bot Management** | Detecta y bloquea bots maliciosos | Bloquear scrapers, brute-force |
| **Geo Blocking** | Bloquea tráfico por país/región | Bloquear todo tráfico de ciertos países |
| **Custom WAF Rules** | Reglas basadas en headers, paths, user-agent, etc. | Bloquear `/wp-admin`, `/phpmyadmin` |

### Ejemplos de reglas WAF

```bash
# Bloquear acceso a paths comunes de ataques
Path contains "/wp-admin" → Block

# Rate limiting para login
Path matches "^/api/login$" → Rate limit (5 requests/minute per IP)

# Bloquear scanners
User-Agent contains "sqlmap" → Block
User-Agent contains "nikto" → Block
```

> [!tip] WAF en producción
> Siempre activa al menos:
> 1. Bloqueo de paths sensibles (`/wp-admin`, `/phpmyadmin`, `/.env`, `/wp-login.php`)
> 2. Rate limiting en endpoints de login y API
> 3. Bot Fight Mode (en planes Pro+)

## DDoS Protection

Cloudflare absorbe ataques DDoS antes de que lleguen a tu servidor.

### Tipos de ataque DDoS

| Tipo | Descripción | Cómo lo mitiga Cloudflare |
|------|-------------|---------------------------|
| **Volumétrico** | Inunda la red con tráfico (bits/segundo) | Su red de 300+ Tbps absorbe el ataque |
| **Protocolo** | Explota debilidades en TCP/IP (SYN flood) | Completa el handshake por ti |
| **Aplicación** | Satura la capa de aplicación (HTTP flood) | Cachéa contenido, rate limiting, JS challenge |

### ¿Cómo funciona la protección?

```
Ataque DDoS: 100 Gbps desde 10,000 bots
       │
       ▼
┌──────────────────────────────────────┐
│  Cloudflare Edge (300+ Tbps capacity) │
│                                      │
│  1. Absorbe el tráfico volumétrico    │
│  2. Analiza cada petición             │
│  3. Cachea respuestas legítimas       │
│  4. Rate limita IPs sospechosas       │
│  5. Desafía JS a nuevos visitantes    │
│  6. Solo el tráfico legítimo           │
│     llega a tu servidor origin        │
└──────────────────────────────────────┘
       │
       ▼
Tu servidor: recibe solo 50 Mbps legítimos
```

## Page Rules

Las **Page Rules** te permiten personalizar el comportamiento de Cloudflare para URLs específicas:

| Regla | Qué hace |
|-------|----------|
| **Cache Level** | Forzar caché, deshabilitar caché, caché básico |
| **SSL/TLS** | Forzar HTTPS, bypass SSL, origin server settings |
| **Automatic HTTPS Rewrites** | Redirigir de HTTP a HTTPS automáticamente |
| **Browser Cache TTL** | Controlar cuánto cachéa el navegador del usuario |
| **Forwarding URL** | Redirigir a otra URL (301, 302, etc.) |
| **Security Level** | Bajo, medio, alto, casi online (JS challenge) |
| **Disable Performance** | Desactivar compresión, auto minify, etc. |
| **Edge Cache TTL** | Cuánto tiempo cachéa Cloudflare en el edge |

### Ejemplos de Page Rules

```
# Forzar HTTPS en todo el sitio
*.ejemplo.com/* → Forwarding URL → https://ejemplo.com/$1 (301 Permanent Redirect)

# Deshabilitar caché para la API
api.ejemplo.com/api/* → Cache Level → Bypass

# Caché largo para assets estáticos
*.ejemplo.com/assets/* → Edge Cache TTL → 1 month

# Deshabilitar caché para el panel de administración
ejemplo.com/admin/* → Cache Level → Bypass
```

## Firewall Rules (vs Page Rules)

> [!note] Evolución
> Cloudflare ha migrado de Firewall Rules a **Security Rules** (parte de WAF) y **Access Rules**. Las Page Rules siguen existiendo pero son menos usadas hoy en día.

### Security Rules (WAF)

```
# Bloquear por user-agent
Rule: User-Agent contains "curl" → Block (en production)
Rule: User-Agent contains "curl" → Pass (en API interna)

# Bloquear por IP
Rule: Source IP is 1.2.3.4 → Block

# Bloquear por país
Rule: Country is China → Challenge (o Block, según tu caso)

# Rate limiting
Rule: Path matches "^/api/login" → Rate Limit (5 requests/minute per IP)
```

## Configurar DNS en Cloudflare

### Paso a paso

1. **Añade tu dominio** en Cloudflare (te pide que cambies los nameservers)
2. **Cambia los nameservers** en tu registrar (GoDaddy, Namecheap, etc.) a los de Cloudflare:
   - `earl.ns.cloudflare.com`
   - `zita.ns.cloudflare.com`
   (varían según tu zona)
3. **Espera la propagación** (puede tardar de minutos a 48h)
4. **Añade tus registros DNS** en Cloudflare

### Registros DNS mínimos

```
Tipo  Name              Value              Proxy
───────────────────────────────────────────────────────
A     @                 IP_DE_TU_SERVIDOR   Proxied (naranja)
A     www               IP_DE_TU_SERVIDOR   Proxied (naranja)
CAA   @                 0 issue "letsencrypt.org"  DNS only
TXT   @                 v=spf1 include:_spf.google.com ~all   DNS only
MX    @                 mail.ejemplo.com   DNS only (prioridad 10)
```

> [!tip] Proxy activado para web, desactivado para todo lo demás
> - `@` y `www`: Proxied (naranja) → CDN, WAF, protección
> - `mail`: DNS only (gris) → Tráfico de correo directo
> - `spf`, `dkim`, `dmarc`: DNS only → Necesario para email
> - `acme-challenge`: DNS only → Necesario para Let's Encrypt

## Resumen

- Un CDN reduce la latencia sirviendo contenido desde el edge más cercano al usuario
- Cloudflare es un CDN + WAF + DDoS protection + DNS provider
- Los modos SSL van de Off (inseguro) a Full Strict (seguro)
- El WAF filtra tráfico malicioso antes de que llegue a tu servidor
- Page Rules personalizan el comportamiento por URL
- DDoS protection absorbe ataques antes de que lleguen al origin
- Configura proxy para web, DNS only para todo lo demás

> [!quote] La clave
> Cloudflare no es "solo un CDN". Es un firewall, CDN, DNS provider, SSL manager y DDoS protector en un solo producto. Y el plan free es sorprendentemente completo.

## Conexión con el resto de la wiki

| Concepto tocado | Artículo en profundidad |
|-----------------|------------------------|
| DNS en general | [[03-dns-profundo]] |
| SSL/TLS | [[07-https-tls]] |
| Certificados | [[08-lets-encrypt-certificados]] |
| Nginx/Caddy como origin | [[14-servidores-procesos-processos]] |
| Reverse proxy | [[14-servidores-procesos-processos]] |
