---
title: "Let's Encrypt y Certbot: certificados gratuitos"
description: "Obtener y renovar certificados TLS gratuitos con Let's Encrypt y Certbot: protocolo ACME, métodos de validación, configuración en Nginx y Caddy."
---

# Let's Encrypt y Certbot: certificados gratuitos

> [!tip] Let's Encrypt en una frase
> Let's Encrypt es una **Autoridad de Certificación gratuita y automatizada** que emite certificados TLS/SSL válidos para cualquier dominio. Antes de Let's Encrypt, los certificados costaban $50-500/año. Ahora son gratis y se renuevan solos.

## ¿Qué es Let's Encrypt?

Let's Encrypt es una CA (Certificate Authority) sin ánimo de lucro, lanzada en 2015 por **Electronic Frontier Foundation (EFF)**, Mozilla, Akamai y otros.

### ¿Por qué fue revolucionario?

| Antes de Let's Encrypt | Después de Let's Encrypt |
|-----------------------|--------------------------|
| Certificado gratis → solo DV básico, 1 año | Certificado gratis → DV, 90 días (renovable automáticamente) |
| Certificado profesional → $100-500/año | Certificado profesional → $0/año |
| Setup manual y complicado | Automatizado con ACME protocol |
| Pocos sitios con HTTPS | Más del 80% de la web con HTTPS |

### Tipos de certificados que emite

| Tipo | Validación | Subdominios | Descripción |
|------|-----------|-------------|-------------|
| **DV** (Domain Validated) | HTTP-01, DNS-01 o TLS-ALPN-01 | Hasta 100 por pedido | Para cualquier sitio web |
| **Wildcard** | Solo DNS-01 | `*.ejemplo.com` | Cualquier subdominio |

> [!tip] Let's Encrypt NO emite OV o EV certificates
> Solo emite DV (Domain Validated). Para OV/EV, usa DigiCert, Sectigo, etc. (o Cloudflare Origin Certificate para tráfico interno).

## El protocolo ACME

ACME (Automatic Certificate Management Environment) es el protocolo que automatiza la obtención y renovación de certificados.

### Cómo funciona ACME

```
1. Cliente (Certbot) genera un par de claves (privada + pública)
2. Cliente se registra con Let's Encrypt (proporciona un email)
3. Cliente demuestra que controla el dominio:
   - HTTP-01: Let's Encrypt visita tu web y busca un archivo específico
   - DNS-01: Let's Encrypt busca un registro TXT específico en DNS
   - TLS-ALPN-01: Let's Encrypt conecta a tu servidor y verifica un certificado temporal
4. Let's Encrypt emite el certificado
5. Certificado se guarda en /etc/letsencrypt/live/tudominio.com/
6. Cada 90 días, el proceso se repite (automático con cron)
```

### Métodos de validación

| Método | Cómo funciona | Cuándo usar |
|--------|--------------|-------------|
| **HTTP-01** | Let's Encrypt visita `http://tudominio.com/.well-known/acme-challenge/<token>` | Servidor web accesible por HTTP (puerto 80) |
| **DNS-01** | Creas un registro TXT `_acme-challenge.tudominio.com` con el valor | Sin servidor web, o detrás de un proxy/CDN |
| **TLS-ALPN-01** | Let's Encrypt conecta a `https://tudominio.com:443` con un certificado temporal | Servidor HTTPS accesible |

#### HTTP-01 en detalle

```bash
# 1. Certbot genera un token único
Token: abc123def456

# 2. Certbot escribe el token en tu servidor web
# Archivo: /var/www/acme/.well-known/acme-challenge/abc123def456
# Contenido: abc123def456.pKd7F8aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890

# 3. Let's Encrypt visita:
curl http://tudominio.com/.well-known/acme-challenge/abc123def456

# 4. Si la respuesta coincide → certificado emitido ✓
```

#### DNS-01 en detalle

```bash
# 1. Certbot genera un token único y un key authorization
Token: abc123def456
Key Auth: [KEY_AUTHORIZATION_STRING]
Base64 SHA256 hash del key auth: hash123

# 2. Creas un registro TXT en DNS:
# _acme-challenge.tudominio.com → "hash123"

# 3. Let's Encrypt consulta DNS:
dig _acme-challenge.tudominio.com TXT

# 4. Si el registro coincide → certificado emitido ✓
```

> [!tip] DNS-01 para wildcard
> Solo el método DNS-01 permite obtener certificados wildcard (`*.ejemplo.com`), porque necesitas modificar registros DNS, no servir archivos en un servidor web.

## Certbot: La herramienta oficial

Certbot es la herramienta oficial de Let's Encrypt para obtener y gestionar certificados.

### Instalación

```bash
# En Ubuntu/Debian
sudo apt update
sudo apt install certbot

# En otras distros:
# https://certbot.eff.org/instructions
```

### Obtener un certificado (HTTP-01)

```bash
# Modo automático (funciona con Nginx y Apache):
sudo certbot --nginx -d ejemplo.com -d www.ejemplo.com

# Con Caddy, Certbot se integra automáticamente
# En Caddyfile:
# tls {
#     email admin@ejemplo.com
# }

# Modo manual:
sudo certbot certonly --manual -d ejemplo.com -d www.ejemplo.com
# Te pedirá crear un registro DNS TXT manualmente
```

### Obtener un certificado wildcard (DNS-01)

```bash
# Con Cloudflare DNS plugin
sudo certbot certonly --dns-cloudflare --dns-cloudflare-credentials /root/.secrets/cloudflare.ini \
  -d '*.ejemplo.com' \
  -d 'ejemplo.com'

# El archivo cloudflare.ini:
# dns_cloudflare_api_key = TU_API_KEY
# dns_cloudflare_email = tu@email.com
```

### Estructura de archivos generados

```
/etc/letsencrypt/live/ejemplo.com/
├── cert.pem        ← Certificado del dominio
├── chain.pem       ← Certificado intermedio (Let's Encrypt)
├── fullchain.pem   ← cert.pem + chain.pem (lo que usa el servidor)
└── privkey.pem     ← Clave privada del dominio (¡NUNCA compartir!)

/etc/letsencrypt/archive/ejemplo.com/
├── cert1.pem       ← Versión 1 del certificado
├── cert2.pem       ← Versión 2 (cuando se renueva)
├── privkey1.pem
└── privkey2.pem

/etc/letsencrypt/renewal/ejemplo.com.conf
← Configuración de renovación
```

> [!tip] fullchain.pem vs cert.pem
> - **fullchain.pem**: cert + intermediate CA. Es lo que debes configurar en tu servidor web (Nginx, Caddy, etc.)
> - **cert.pem**: solo el certificado del dominio
> - Si usas solo cert.pem, algunos clientes pueden rechazarlo porque les falta la cadena de confianza

### Renovación automática

Los certificados de Let's Encrypt duran **90 días**. Certbot configura un cron job para renovar automáticamente:

```bash
# Test de renovación (no lo hace realmente, solo simula)
sudo certbot renew --dry-run

# Renovación real (la hace certbot automáticamente via cron/systemd timer)
sudo certbot renew

# Ver el estado del renewal
sudo systemctl status certbot.timer
```

> [!tip] Post-hook para recargar el servidor
> Para que el servidor web recargue los certificados después de la renovación:
>
> ```bash
> # En /etc/letsencrypt/cli.ini
> post_hook = systemctl reload nginx
>
> # O en el comando:
> sudo certbot renew --post-hook "systemctl reload nginx"
> ```

## Configuración en Nginx

```nginx
server {
    listen 80;
    server_name ejemplo.com www.ejemplo.com;
    # Redirigir todo HTTP a HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ejemplo.com www.ejemplo.com;

    # Certificados de Let's Encrypt
    ssl_certificate /etc/letsencrypt/live/ejemplo.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ejemplo.com/privkey.pem;

    # Configuración SSL robusta
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # Seguridad
    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> [!tip] ¿Por qué listen 80 aparte?
> El bloque en el puerto 80 no sirve contenido — solo redirige a HTTPS. Esto es necesario para la validación HTTP-01 de Let's Encrypt (necesita servir archivos en el puerto 80) y para que los navegadores se redirijan automáticamente.

## Configuración en Caddy

Caddy es **más simple que Nginx** para TLS porque lo hace automáticamente:

```caddyfile
# Caddyfile — ¡Así de simple!
# Caddy obtiene y renueva certificados automáticamente

ejemplo.com {
    reverse_proxy localhost:3000
}

www.ejemplo.com {
    redir https://ejemplo.com{uri}
}
```

### ¿Qué hace Caddy automáticamente?

1. Detecta que no hay certificado para `ejemplo.com`
2. Genera una clave privada
3. Solicita un certificado a Let's Encrypt (HTTP-01 challenge)
4. Instala el certificado y lo configura
5. Programa renovación automática antes de que expire (renueva a los ~60 días)
6. Si necesitas un email de contacto: `tls admin@ejemplo.com`

> [!tip] Caddy vs Nginx para TLS
> - **Caddy**: TLS automático, sin configuración. Ideal para proyectos personales y equipos pequeños.
> - **Nginx**: Requiere configuración manual (o Certbot). Más control, más flexibilidad, más complejidad.

## Cloudflare y Let's Encrypt

Cuando usas Cloudflare, hay dos certificados involucrados:

```
Usuario ──(HTTPS, cert de Cloudflare)──→ Cloudflare ──(HTTPS, cert de LE o CF)──→ Servidor Origin
```

### Opciones

| Configuración | Cloudflare → Origin | Usuario → Cloudflare | Descripción |
|--------------|--------------------|---------------------|-------------|
| **Flexible** | HTTP | HTTPS | ⚠️ No recomendado: tráfico CF→Origin NO cifrado |
| **Full** | HTTPS (CF auto-cert) | HTTPS (LE) | ✅ Básico seguro |
| **Full Strict** | HTTPS (LE/DigiCert) | HTTPS (LE) | ✅✅ Recomendado |
| **Extended** | HTTPS (self-signed) | HTTPS (LE) | ✅ Para origins con self-signed |

### Modo Full Strict con Let's Encrypt

1. Obtén un certificado de Let's Encrypt en tu servidor
2. En Cloudflare, SSL/TLS → Overview → **Full (strict)**
3. Cloudflare verifica que tu servidor tiene un certificado válido
4. Si usas un certificado autofirmado → usa **Extended** en su lugar

## Seguridad SSL/TLS: chequeos

```bash
# Verificar la configuración SSL de un dominio
openssl s_client -connect ejemplo.com:443 -servername ejemplo.com

# Verificar certificados y cadena
openssl s_client -connect ejemplo.com:443 -servername ejemplo.com -showcerts

# Herramientas online para testing:
# https://www.ssllabs.com/ssltest/ — da una grade (A+ a F)

# Herramientas CLI para testing:
testssl.sh ejemplo.com
nmap --script ssl-enum-ciphers -p 443 ejemplo.com
```

## Resumen

- Let's Encrypt emite certificados DV gratuitos automatizados con ACME
- Certbot es la herramienta oficial para obtener y renovar certificados
- HTTP-01 valida sirviendo un archivo en el dominio; DNS-01 valida con un registro TXT
- Los certificados duran 90 días, renovación automática via cron
- Configura `fullchain.pem` + `privkey.pem` en el servidor
- Caddy automatiza todo; Nginx requiere configuración manual
- Con Cloudflare, usa Full (strict) para máxima seguridad

> [!quote] La clave
> No hay excusa para no usar HTTPS. Let's Encrypt + Certbot o Caddy hacen que sea automático, gratuito y sin fricción.

## Conexión con el resto de la wiki

| Concepto tocado | Artículo en profundidad |
|-----------------|------------------------|
| TLS/HTTPS | [[07-https-tls]] |
| DNS y Cloudflare | [[04-cloudflare-intro]] (DNS-01 challenge, SSL modes) |
| DNS registros | [[03-dns-profundo]] (CAA, TXT para DNS-01) |
| Nginx | [[14-servidores-procesos]] (configuración del servidor) |
