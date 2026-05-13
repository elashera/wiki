---
title: "Cloudflare: Introducción"
description: "Introducción a Cloudflare: qué es, CDN, DNS, protección WAF, SSL/TLS, protección DDoS y por qué posicionarse como proxy inverso entre tu usuario y tu servidor."
---

# Cloudflare: Introducción

> [!tip] Cloudflare en una frase
> Cloudflare es un **proxy inverso global** que se posiciona entre tus usuarios y tu servidor, ofreciendo CDN, protección DDoS, firewall de aplicaciones web (WAF), DNS y SSL/TLS gratis.

## ¿Qué es Cloudflare?

Cloudflare es una plataforma de seguridad y rendimiento para Internet. No es solo un CDN: es una **red de seguridad global** con más de 300 data centers en 120+ ciudades. Su red absorbe y filtra el tráfico malicioso antes de que llegue a tu servidor.

### ¿Qué significa "proxy inverso"?

Un **proxy inverso** se posiciona delante de tus servidores:

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

**Proxy normal**: cliente → proxy → internet (el proxy actúa por el cliente)
**Proxy inverso**: internet → proxy → servidor (el proxy actúa por el servidor)

> [!tip] ¿Por qué proxy inverso?
> Porque tu servidor origin puede estar en tu red local (192.168.1.100), con puertos arbitrarios, sin necesidad de IP pública. Cloudflare expone tu sitio en internet, filtra todo el tráfico, y lo redirige a tu servidor privado.

## Los servicios de Cloudflare

### CDN (Content Delivery Network)

Cloudflare guarda caché de tu contenido en los data centers más cercanos a tus usuarios:

```
Tu servidor (Frankfurt, 100ms)
         │
         ├── Cloudflare Edge (Santiago de Chile, 20ms) ← Usuario en Buenos Aires
         ├── Cloudflare Edge (Ciudad de México, 30ms)   ← Usuario en CDMX
         ├── Cloudflare Edge (Miami, 40ms)              ← Usuario en Nueva York
         └── Cloudflare Edge (Ámsterdam, 80ms)          ← Usuario en Londres
```

Sin CDN, un usuario en Buenos Aires tendría que recorrer 200ms hasta Frankfurt. Con Cloudflare, recorre 20ms hasta Santiago.

**Qué se cachea:**
- Archivos estáticos (CSS, JS, imágenes, fuentes)
- Contenido con `Cache-Control: public`
- Páginas HTML estáticas

**Qué NO se cachea:**
- Páginas dinámicas (login, dashboard)
- APIs con datos personalizados
- Contenido con `Cache-Control: private` o `no-store`

### DNS

Cloudflare opera los servidores DNS más rápidos del mundo (1.1.1.1). También es un proveedor DNS completo con:
- Gestión de registros DNS (A, AAAA, CNAME, MX, TXT, etc.)
- DNSSEC
- DNS-over-HTTPS y DNS-over-TLS
- DDoS protection a nivel DNS

### WAF (Web Application Firewall)

Cloudflare filtra tráfico malicioso antes de que llegue a tu servidor:

| Regla | Qué hace | Ejemplo |
|-------|----------|---------|
| **IP Block** | Bloquea tráfico de una IP o rango | Bloquear tráfico de un país |
| **Rate Limiting** | Limita peticiones por tiempo | Máximo 100 peticiones/minuto por IP |
| **Bot Management** | Detecta y bloquea bots maliciosos | Bloquear scrapers, brute-force |
| **Geo Blocking** | Bloquea tráfico por país/región | Bloquear tráfico de ciertos países |
| **Custom WAF Rules** | Reglas basadas en headers, paths, user-agent | Bloquear `/wp-admin`, `/phpmyadmin` |

### Protección DDoS

Cloudflare absorbe ataques DDoS antes de que lleguen a tu servidor. Su red de 300+ Tbps puede absorber ataques de terabits por segundo.

| Tipo de ataque | Descripción | Cómo lo mitiga Cloudflare |
|----------------|-------------|---------------------------|
| **Volumétrico** | Inunda la red con tráfico | Su red de 300+ Tbps absorbe el ataque |
| **Protocolo** | Explota debilidades en TCP/IP (SYN flood) | Completa el handshake por ti |
| **Aplicación** | Satura la capa de aplicación (HTTP flood) | Cachéa contenido, rate limiting, JS challenge |

### SSL/TLS

Cloudflare ofrece certificados SSL/TLS automáticos y gratuitos:
- **Universal SSL**: Para `*.tudominio.com`, emitido por Let's Encrypt
- **Origin Certificate**: Emitido por Cloudflare, solo para tráfico Cloudflare → Origin

### Planes de Cloudflare

| Plan | Precio | Características clave |
|------|--------|----------------------|
| **Free** | $0 | CDN, SSL, DDoS básico, 1 zona DNS |
| **Pro** | $20/zona/mes | WAF avanzado, Page Rules, Analytics, Bot Fight Mode |
| **Business** | $200/zona/mes | WAF personalizado, SSL flexible, Origin Server CS, Cache Reserve |
| **Enterprise** | Custom | Todo lo anterior + SLA, SSL avanzado, Cloudflare Load Balancer, Custom error pages |

> [!tip] Para proyectos personales
> El plan **Free** es sorprendentemente completo. Para la mayoría de proyectos personales y pequeños, es más que suficiente.

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

## Registros DNS de Cloudflare

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

> [!tip] Proxy activado para web, desactivado para todo lo demás
> - `@` y `www`: Proxied (naranja) → CDN, WAF, protección
> - `mail`: DNS only (gris) → Tráfico de correo directo
> - `spf`, `dkim`, `dmarc`: DNS only → Necesario para email
> - `acme-challenge`: DNS only → Necesario para Let's Encrypt

## Página mínima de Cloudflare: configurar DNS

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

## Resumen

- Cloudflare es un proxy inverso global con CDN, WAF, DDoS protection y SSL/TLS
- Se posiciona entre tus usuarios y tu servidor, filtrando y optimizando el tráfico
- Los modos SSL van de Off (inseguro) a Full Strict (seguro)
- El WAF filtra tráfico malicioso antes de que llegue a tu servidor
- DDoS protection absorbe ataques antes de que lleguen al origin
- Configura proxy para web, DNS only para todo lo demás

> [!quote] La clave
> Cloudflare no es "solo un CDN". Es un firewall, CDN, DNS provider, SSL manager y DDoS protector en un solo producto. Y el plan free es sorprendentemente completo.

## Conexión con el resto de la wiki

| Concepto tocado | Artículo en profundidad |
|-----------------|------------------------|
| DNS en general | [[03-dns-profundo]] |
| SSL/TLS | [[07-https-tls]] |
| Certificados | [[08-lets-encrypt]] |
| Nginx/Caddy como origin | [[14-servidores-procesos]] |
| Reverse proxy | [[14-servidores-procesos]] |
