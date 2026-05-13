# DNS en profundidad

> [!tip] DNS en una frase
> DNS (Domain Name System) es **el libro de teléfono de Internet**: traduce nombres que los humanos podemos recordar (`google.com`) a números que las máquinas entienden (`142.250.80.46`).

## ¿Qué es DNS?

DNS es un **sistema de nombres de dominio distribuido y jerárquico**. No es una base de datos centralizada (eso sería imposible a escala de Internet), sino una red de servidores que cooperan.

### La jerarquía de nombres de dominio

```
                        . (root — el punto final, a menudo omitido)
                       / \
                      /   \
                  .com    .org    .net    .es    .de ...
                  /            \
        ejemplo.com         wikipedia.org
           /
   www.ejemplo.com
     /
  server1.www.ejemplo.com
```

Cada nivel se llama **label**:
- `server1` es un **subdominio** de `www`
- `www` es un **subdominio** de `ejemplo.com`
- `ejemplo.com` es un **dominio de segundo nivel** (SLD)
- `.com` es un **TLD** (Top Level Domain)
- El punto final `.` es el **root** (raíz)

> [!tip] El punto final
> En DNS, `ejemplo.com.` con punto al final es técnicamente el nombre completo. El punto es el root. En la práctica, casi nunca lo escribimos porque el cliente DNS lo añade automáticamente.

## Tipos de registros DNS

Cada nombre de dominio puede tener múltiples **registros** asociados. Estos son los más importantes:

### Registros de resolución (los que traducen nombres)

| Registro | Qué hace | Ejemplo |
|----------|----------|---------|
| **A** | Dominio → dirección IPv4 | `www → 93.184.216.34` |
| **AAAA** | Dominio → dirección IPv6 | `www → 2606:2800:220:1:248:1893:25c8:1946` |
| **CNAME** | Alias: un nombre apunta a otro nombre | `www → ejemplo.com` (no a una IP) |
| **NS** | Nombre de servidor autoritativo | `ejemplo.com → ns1.registrar.com` |

#### A vs AAAA

```
Dominio        Tipo    Valor
─────────────────────────────────────────
www.ejemplo.com  A       93.184.216.34    (IPv4)
www.ejemplo.com  AAAA    2606:2800::1      (IPv6)
```

- **A**: Traduce a una dirección IPv4 (4 bytes = 32 bits, ej. 192.0.2.1)
- **AAAA**: Traduce a una dirección IPv6 (16 bytes = 128 bits)
- Muchas páginas tienen ambos registros para ser accesibles desde IPv4 e IPv6

#### CNAME (Alias canónico)

Un CNAME es un alias de **otro nombre**, no de una IP:

```
CNAME: www → example.com
A: example.com → 93.184.216.34
```

Cuando consultas `www`, DNS primero busca el CNAME (`www → example.com`), luego busca el A de `example.com` (`93.184.216.34`).

> [!caution] Regla de los CNAME
> - Un mismo nombre **no puede** tener un CNAME y otros registros (excepto DNSSEC y algunos específicos). Es un o un otro.
> - Para evitar esto, existe el **ALIAS** (o ANAME) que es como un CNAME pero puede coexistir con otros registros. Es una extensión no estándar, pero muchos proveedores DNS lo soportan.

### Registros de correo

| Registro | Qué hace | Ejemplo |
|----------|----------|---------|
| **MX** | Mail exchange — qué servidor recibe email para este dominio | `ejemplo.com → mail.ejemplo.com (prioridad 10)` |
| **TXT** | Texto arbitrario — usado para verificación, SPF, DKIM, DMARC | `v=spf1 include:_spf.google.com ~all` |

#### MX (Mail Exchange)

```
Dominio        Tipo  Prioridad  Valor
───────────────────────────────────────────────────
ejemplo.com      MX  10         mail1.ejemplo.com
ejemplo.com      MX  20         mail2.ejemplo.com
```

- El valor es **otro nombre de dominio** (no una IP directa)
- La **prioridad** es numérica: **menor número = mayor prioridad**. Si el mail 1 no responde, se intenta el 2
- Puedes tener múltiples MX para redundancia

#### TXT (Text) — más que texto arbitrario

Los registros TXT se usan para **verificación de dominio y seguridad de email**:

```
# Verificación de dominio (Google, Apple, etc.)
google-site-verification=abc123def456

# SPF (Sender Policy Framework) — quién puede enviar email en tu nombre
@ v=spf1 include:_spf.google.com ~all

# DKIM (DomainKeys Identified Mail) — firma criptográfica de emails
default._domainkey v=DKIM1; k=rsa; p=MIGfMA0GCS...

# DMARC — qué hacer con emails que fallan SPF/DKIM
_dmarc v=DMARC1; p=reject; pct=100; rua=mailto:dmarc@ejemplo.com
```

- **SPF**: Lista de servidores autorizados para enviar emails. Si un email viene de un servidor no listado → posiblemente spam
- **DKIM**: Cada email lleva una firma digital verificable con la clave pública del dominio (guardada en DNS)
- **DMARC**: Política de qué hacer con los emails que no pasan SPF/DKIM (`none`, `quarantine`, `reject`)

> [!tip] Configuración recomendada de email
> 1. Configura SPF (imprescindible)
> 2. Configura DKIM (imprescindible)
> 3. Configura DMARC en `p=none` primero, monitoriza, luego sube a `p=quarantine` y finalmente `p=reject`
> 4. Sin esto, tus emails pueden acabar en spam o ser suplantados

### Otros registros importantes

| Registro | Qué hace | Uso típico |
|----------|----------|------------|
| **PTR** | Reverse DNS — IP → nombre | Verificación de servidores de correo |
| **SRV** | Servicio → ubicación (host:puerto) | VoIP, XMPP, servicios internos |
| **SOA** | Start of Authority — metadata del dominio | Serial, refresh, retry, expire, TTL mínimo |
| **CAA** | Certificate Authority Authorization — quién puede emitir certificados para tu dominio | Seguridad SSL |

#### SOA (Start of Authority)

Cada zona DNS tiene un registro SOA que contiene metadata administrativa:

```
ejemplo.com.  IN  SOA  ns1.ejemplo.com. admin.ejemplo.com. (
    2024010101  ; Serial (aumenta cada vez que cambias algo)
    3600        ; Refresh (cada cuánto el secundario consulta al primario)
    900         ; Retry (si falla, reintentar después de 900s)
    604800      ; Expire (si el secundario no puede contactar al primario, dejar de responder después de 7 días)
    86400       ; Minimum TTL (TTL por defecto para registros sin TTL explícito)
)
```

> [!tip] El serial es crítico
> El serial se incrementa cada vez que cambias la configuración DNS. Formato recomendado: `YYYYMMDDNN` (año, mes, día, número de cambio ese día). Si subes la configuración DNS y no funciona, verifica que el serial se incrementó.

#### CAA (Certificate Authority Authorization)

```
ejemplo.com.  IN  CAA  0 issue "letsencrypt.org"
ejemplo.com.  IN  CAA  0 issue "digicert.com"
```

Esto dice: "Solo Let's Encrypt y DigiCert pueden emitir certificados para ejemplo.com". Sin CAA, cualquier CA puede emitir un certificado para tu dominio (lo cual es un riesgo de seguridad).

> [!warning] CAA y Let's Encrypt
> Si tienes un CAA que solo permite CA específicas, Let's Encrypt **no podrá emitir certificados para tu dominio**. Añade `0 issue "letsencrypt.org"` si quieres que funcione.

## La resolución DNS en detalle

### Resolución recursiva (el flujo completo)

Cuando tu navegador necesita resolver `www.ejemplo.com`:

```
1. Navegador consulta su cache DNS (TTL: ~30s)
   ├── Hit → Devuelve la IP directamente
   └── Miss → Continua...

2. SO (System Resolver) consulta su cache
   ├── Hit → Devuelve la IP
   └── Miss → Continua...

3. Resolver DNS local (ISP o público: 1.1.1.1, 8.8.8.8)
   ├── Hit en cache (TTL del resolver: puede ser horas)
   │   └── Devuelve la IP al cliente (rápido!)
   └── Miss → Resolución recursiva al sistema DNS global:
                │
                ▼
        4. DNS Root Servers (13 grupos A-M)
           │ → "Los TLD .com están en estos servidores..."
           ▼
        5. TLD Server (.com)
           │ → "El authoritative de ejemplo.com está en ns1.ejemplo.com"
           ▼
        6. Authoritative DNS Server de ejemplo.com
           │ → "www.ejemplo.com → 93.184.216.34"
           │
           ▼
        7. El resolver local guarda en cache (TTL: 300s)
        8. Devuelve la IP al cliente
```

### Resolución iterativa (entre servidores DNS)

Cuando los servidores DNS se preguntan entre sí, usan resolución iterativa:

```
Resolver (1.1.1.1) ──→ Root (A)  "No sé la de .com, pero aquí están los TLD .com"
Resolver (1.1.1.1) ──→ TLD (.com) "No sé la de ejemplo.com, pero aquí está el authoritative"
Resolver (1.1.1.1) ──→ Authoritative "www.ejemplo.com → 93.184.216.34"
Resolver (1.1.1.1) ──→ Cliente "Aquí tienes: 93.184.216.34"
```

Cada servidor responde con:
1. La respuesta (si la tiene)
2. **NS records de los siguientes servidores** para que el cliente pueda seguir preguntando

### TTL y propagación

Cuando cambias un registro DNS:

```
T = 0: Cambias el registro DNS de 93.184.216.34 → 104.21.45.67
T = +5min: Los resolvers con TTL de 300s ya olvidaron el valor viejo ✓
T = +15min: Los resolvers con TTL de 900s olvidan el valor viejo ✓
T = +1h: Todos los resolvers tienen el nuevo valor ✓
```

> [!warning] Propagación DNS
> "La propagación DNS" no es mágica: es simplemente el tiempo que tarda en expirar el TTL de cada resolver. Si tu TTL era 86400 (24 horas), tardará 24 horas en propagarse completamente.
>
> **Regla de oro:**
> - **Pre-cambio**: Baja el TTL a 60s al menos 24h antes de hacer un cambio crítico
> - **Post-cambio**: Espera el TTL nuevo antes de asumir que todo está propagado
> - **Para cambios urgentes**: No puedes forzar la propagación. Solo puedes esperar o haber previsto con anticipación

### DNS en tu sistema operativo

#### Linux

```bash
# Ver qué resolver DNS usa tu sistema
cat /etc/resolv.conf
# nameserver 1.1.1.1
# nameserver 8.8.8.8

# Consultar DNS desde la línea de comandos
dig ejemplo.com              # Consulta A
dig AAAA ejemplo.com         # Consulta AAAA
dig MX ejemplo.com           # Consulta MX
dig TXT example.com          # Consulta TXT
dig www.ejemplo.com CNAME    # Consulta CNAME
dig +trace example.com       # Muestra toda la cadena de resolución
```

#### macOS

```bash
dig example.com
nslookup example.com
```

#### Windows

```cmd
nslookup example.com
ipconfig /displaydns   # Muestra la cache DNS del sistema
ipconfig /flushdns     # Limpia la cache DNS
```

#### Comandos útiles de `dig`

```bash
# Ver la cadena completa de resolución
dig +trace example.com

# Ver solo la respuesta (sin toda la información extra)
dig +short example.com
# 93.184.216.34

# Ver los tiempos de respuesta
dig example.com +stats
# Query time: 12 msec
# SERVER: 1.1.1.1#53(1.1.1.1)
# WHEN: Thu May 11 12:00:00 CEST 2024
# MSG SIZE  received: 112

# Forzar usar un resolver específico
dig @8.8.8.8 example.com
```

## DNSSEC

DNSSEC (DNS Security Extensions) añade **firmas criptográficas** a los registros DNS para verificar que la respuesta es legítima y no ha sido manipulada.

### El problema: DNS poisoning / spoofing

Sin DNSSEC, un atacante en tu red puede:
1. Interceptar tu consulta DNS
2. Responder más rápido que el servidor legítimo
3. Decirte "google.com → 666.666.666.666"
4. Redirigirte a una página phishing

### La solución: DNSSEC

DNSSEC firma cada zona DNS con **claves criptográficas**:

```
          Clave Pública DNSSEC (en el root)
                │
        Firma digital ✓
                │
        ┌───────┴────────┐
        │                │
   .com (TLD)      example.com (Zona)
   Firma digital    Firma digital
        │                │
        └───────┬────────┘
                │
        Verificación de la cadena
        desde el root hasta el registro
```

**Chain of trust**: El root firma al TLD (.com), el TLD firma a la zona (ejemplo.com), la zona firma a sus registros. Cada eslabón se verifica desde arriba hacia abajo.

> [!note] DNSSEC ≠ HTTPS
> DNSSEC solo garantiza que la respuesta DNS es auténtica. No cifra la conexión. Para eso necesitas HTTPS/TLS. Son complementarios:
> - DNSSEC → "la IP que me das es la verdadera"
> - TLS → "la comunicación con esa IP está cifrada"

## CDN y Cloudflare

Cloudflare es un proveedor de CDN que se posiciona **entre tu usuario y tu servidor**. Todo el tráfico pasa por Cloudflare antes de llegar a tu servidor.

```
Usuario                 Cloudflare                  Tu Servidor
   │                         │                            │
   ├─── HTTPS ──────────────→│                            │
   │                         ├─── ¿En caché? ────────────→│
   │                         │     SÍ → Devuelve caché   │
   │                         │     NO → Pide al origin  │
   │                         │                            │
   │←── HTTPS ───────────────┤←── HTTP ──────────────────│
   │                         │   (puerto 80/8080/etc.)   │
```

Esto permite:
- **Caché global**: El contenido se sirve desde el edge más cercano al usuario (no desde tu servidor)
- **Protección DDoS**: Cloudflare absorbe el ataque antes de que llegue a tu servidor
- **WAF**: Firewall de aplicaciones web que filtra tráfico malicioso
- **SSL/TLS gratuito**: Certificados automáticos con Let's Encrypt
- **Rate limiting**: Limita cuántas peticiones puede hacer un usuario

> [!tip] Modo de proxy Cloudflare
> - **DNS only (proxi desactivado)**: Cloudflare solo responde DNS. El tráfico va directo al servidor. Sin CDN, sin WAF, sin protección.
> - **Proxied (proxi activado)**: El tráfico pasa por Cloudflare. Tienes CDN, WAF, DDoS protection, etc.
>
> Se indica con el icono de nube naranja (proxi) vs gris (solo DNS).

## Resumen

- DNS es jerárquico: root → TLD (.com) → dominio (ejemplo.com) → subdominio (www)
- Los registros A y AAAA traducen a IPs; CNAME crea aliases; MX gestiona email; TXT hace verificación y seguridad
- La resolución recursiva consulta: cache → resolver local → root → TLD → authoritative
- TTL controla cuánto tiempo se cachéa cada respuesta
- DNSSEC firma los registros DNS para prevenir spoofing
- Cloudflare posiciona entre usuario y servidor: CDN, WAF, protección DDoS

> [!quote] La clave
> DNS es un sistema distribuido, jerárquico y con caché. Cada nivel optimiza para un aspecto diferente: jerarquía para escalabilidad, distribución para no tener un único punto de fallo, caché para velocidad.

## Conexión con el resto de la wiki

| Concepto tocado | Artículo en profundidad |
|-----------------|------------------------|
| DNS en la navegación | [[02-como-navegar-de-url-a-pagina]] |
| CDN y Cloudflare | [[04-dns-cdn-y-cdnflare]] |
| Let's Encrypt y certificados | [[08-lets-encrypt-certificados]] (los certificados tienen CAA en DNS) |
| HTTPS | [[07-https-tls]] |
| Nginx/Caddy como reverse proxy | [[14-servidores-procesos-processos]] |
