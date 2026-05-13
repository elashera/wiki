---
title: "Routing, subnetting y CIDR"
description: "Enrutamiento de paquetes, subnetting, CIDR, máscaras de red, VLSM, route summarization, y cómo funciona el enrutamiento entre redes."
---

# Routing, subnetting y CIDR

> [!tip] Routing en una frase
> **Routing** es el proceso de decidir hacia dónde enviar un packet de red. Cada router consulta su tabla de enrutamiento y elige la mejor ruta hacia el destino.

## ¿Qué es routing?

El **enrutamiento** es el proceso de seleccionar la ruta que siguen los packets a través de una red. Cuando un packet necesita ir de tu PC a un servidor en otro continente, pasa por múltiples routers, cada uno tomando una decisión sobre a dónde enviar el packet a continuación.

### El packet IP y la tabla de enrutamiento

Cada router mantiene una **tabla de enrutamiento** que le dice hacia dónde enviar cada destino:

```
Tabla de enrutamiento típica:
┌──────────────────┬──────────────────┬──────────────┬──────────┐
│ Destination      │ Next Hop         │ Interface    │ Metric   │
├──────────────────┼──────────────────┼──────────────┼──────────┤
│ 192.168.1.0/24   │ Directo          │ eth0         │ 0        │
│ 0.0.0.0/0        │ 10.0.0.1         │ eth1         │ 100      │ ← Default route
│ 10.0.0.0/8       │ 192.168.1.100    │ eth0         │ 20       │
│ 172.16.0.0/12    │ 10.0.0.5         │ eth1         │ 30       │
└──────────────────┴──────────────────┴──────────────┴──────────┘
```

**Campos:**
- **Destination**: La red de destino (en formato CIDR)
- **Next Hop**: El siguiente router hacia el destino (o "Directo" si está en la red local)
- **Interface**: La interfaz de red por donde enviar
- **Metric**: Costo de la ruta (menor = mejor)

### Longest Prefix Match

Cuando un packet llega a un router, el router busca la ruta con la coincidencia **más larga** (más específica):

```
Packet con destino: 172.16.5.10
Tabla del router:
  172.16.0.0/12  → Next Hop A
  172.16.5.0/24  → Next Hop B
  0.0.0.0/0      → Default

El router busca la coincidencia más larga:
  172.16.5.0/24 → 24 bits coinciden → MÁS ESPECÍFICO → Usa Next Hop B
```

## Subnetting

**Subnetting** es el proceso de dividir una red grande en subredes más pequeñas. Esto permite:
- Mejor organización (departamentos, edificios, funciones)
- Menor tráfico broadcast
- Mejor seguridad (segmentación)
- Uso más eficiente de IPs

### Máscaras de red

Una **máscara de subred** indica qué parte de una IP es la red y qué parte es el host:

```
IP:          192.168.1.50
Máscara:     255.255.255.0
Binario:     11111111.11111111.11111111.00000000
             │││││││││││││││││││││││││││││││││││││││││││││
             │└───────────────│ └───────── Host (50)
             │
             └──────────────── Red (192.168.1)
```

La máscara 255.255.255.0 = `/24` (24 bits para la red, 8 bits para hosts = 254 hosts utilizables).

### Ejemplo de subnetting

Imagina que tienes la red `192.168.1.0/24` (254 hosts) y la necesitas dividir en 4 subredes:

```
Subred 1: 192.168.1.0/26  → 64 hosts  → 192.168.1.1 - 192.168.1.62
Subred 2: 192.168.1.64/26 → 64 hosts  → 192.168.1.65 - 192.168.1.126
Subred 3: 192.168.1.128/26→ 64 hosts  → 192.168.1.129 - 192.168.1.190
Subred 4: 192.168.1.192/26→ 64 hosts  → 192.168.1.193 - 192.168.1.254
```

Para dividir en 4 subredes, necesitamos 2 bits extra (2² = 4), así que pasamos de /24 a /26.

### Cálculo de hosts utilizables

| Máscara | CIDR | Total IPs | Hosts utilizables | Broadcast |
|---------|------|-----------|-------------------|-----------|
| 255.255.255.252 | /30 | 4 | 2 | .3 |
| 255.255.255.248 | /29 | 8 | 6 | .7 |
| 255.255.255.240 | /28 | 16 | 14 | .15 |
| 255.255.255.224 | /27 | 32 | 30 | .31 |
| 255.255.255.192 | /26 | 64 | 62 | .63 |
| 255.255.255.128 | /25 | 128 | 126 | .127 |
| 255.255.255.0 | /24 | 256 | 254 | .255 |
| 255.255.0.0 | /16 | 65536 | 65534 | .255.255 |

> [!tip] Fórmula rápida
> Hosts utilizables = 2^(32 - CIDR) - 2
> Los -2 son para la dirección de red (primera) y la de broadcast (última).
>
> Ejemplo: /24 → 2^(32-24) - 2 = 2^8 - 2 = 256 - 2 = 254 hosts

## CIDR (Classless Inter-Domain Routing)

**CIDR** reemplazó el antiguo sistema de clases (A, B, C) que era rígido e ineficiente. Con CIDR, puedes crear subredes de cualquier tamaño.

### Formato CIDR

```
192.168.1.0/24  → 256 IPs (192.168.1.0 a 192.168.1.255)
10.0.0.0/8      → 16,777,216 IPs
172.16.0.0/12   → 1,048,576 IPs
192.168.0.0/16  → 65,536 IPs
```

### Comparación: Clases vs CIDR

| | Clases (obsoleto) | CIDR (moderno) |
|--|------------------|----------------|
| **Clase A** | 10.0.0.0/8 (16M IPs) | 10.0.0.0/24 (256 IPs) — flexible |
| **Clase B** | 172.16.0.0/16 (65K IPs) | 172.16.0.0/20 (4096 IPs) |
| **Clase C** | 192.168.0.0/24 (256 IPs) | 192.168.0.0/27 (32 IPs) |

### Route Summarization (Sumarización)

Route summarization agrupa múltiples subredes en un solo route:

```
Tenemos estas subredes:
  192.168.1.0/24
  192.168.2.0/24
  192.168.3.0/24
  192.168.4.0/24

Podemos sumarizarlas en:
  192.168.0.0/22
  (cubre de 192.168.0.0 a 192.168.3.255 — 1024 IPs)
```

Esto reduce el tamaño de las tablas de enrutamiento y es fundamental para la escalabilidad de Internet (los routers de borde de Internet solo tienen ~1M de routes, no ~1 billones).

## Route types

### Static routes

Configuradas manualmente por un administrador:

```bash
# Linux
ip route add 10.0.0.0/8 via 192.168.1.1 dev eth0

# Cisco
ip route 10.0.0.0 255.0.0.0 192.168.1.1
```

**Ventaja:** Simple, predecible, sin overhead de CPU.
**Desventaja:** No se adapta a cambios de topología, requiere intervención manual.

### Dynamic routes

Protocolos de enrutamiento que descubren rutas automáticamente:

| Protocolo | Tipo | Uso | Descripción |
|-----------|------|-----|-------------|
| **OSPF** | Interior (IGP) | Redes internas | Basado en enlaces (link-state), converge rápido |
| **BGP** | Exterior (EGP) | Internet | Basado en políticas, escala a Internet global |
| **EIGRP** | Interior (IGP) | Cisco-only | Mejorado de RIP, converge rápido |
| **RIP** | Interior (IGP) | Redes pequeñas | Obsoleto, basado en hops |

#### OSPF (Open Shortest Path First)

OSPF es el protocolo de enrutamiento interior más usado:

```
Topología:
  R1 —— R2 —— R3
   │             │
  R4 —— R5 —— R6

OSPF funciona así:
1. Cada router descubre sus vecinos por multicast
2. Cada router envía su LSAs (Link State Advertisements)
3. Todos los routers construyen la misma base de datos topológica (SPF tree)
4. Cada router calcula el camino más corto (Dijkstra)
5. Se actualizan las tablas de enrutamiento
```

#### BGP (Border Gateway Protocol)

BGP es el protocolo que hace funcionar Internet. Es el **único** protocolo de enrutamiento que se usa entre ISPs:

```
ISP A (AS 64500) —— Peer ——— ISP B (AS 64501)
     │                                      │
  Tu empresa                    Otro ISP
  (AS 64500)                     (AS 64502)

BGP es un protocolo de "ruta-vector":
- Cada route tiene una lista de ASes por los que pasa
- Los routers eligen rutas basándose en políticas, no solo métricas
- BGP escala a ~1M+ routes en la tabla global de Internet
```

## Route metrics

Los protocolos de enrutamiento dinámico usan diferentes métricas para elegir la mejor ruta:

| Protocolo | Métrica | Qué mide |
|-----------|---------|----------|
| **RIP** | Hop count | Número de routers que atraviesa |
| **OSPF** | Costo (basado en bandwidth) | Ancho de banda de la enlace |
| **EIGRP** | Composite metric | Bandwidth + delay + load + reliability |
| **BGP** | Múltiples atributos | AS path, local preference, MED, etc. |

## IPv6 subnetting

El subnetting en IPv6 es más simple porque se usa **solo /64** para la mayoría de redes:

```
Tu asignación: 2001:db8:abcd:0012::/48

Subredes disponibles (/64):
  2001:db8:abcd:0001::/64  → Red 1 (64 hosts, en realidad 2^64)
  2001:db8:abcd:0002::/64  → Red 2
  2001:db8:abcd:0003::/64  → Red 3
  2001:db8:abcd:0004::/64  → Red 4
  ...
  2001:db8:abcd:ffff::/64  → Red 65536
```

En IPv6, cada subred /64 tiene 2⁶⁴ direcciones. No necesitas preocuparte por el "tamaño" de la subred — siempre es /64.

## Resumen

- Routing es el proceso de decidir hacia dónde enviar cada packet
- La tabla de enrutamiento conecta destinos con next hops y interfaces
- Longest prefix match: el router elige la coincidencia más específica
- Subnetting divide una red grande en subredes más pequeñas
- CIDR (/24, /16, /8) es el formato moderno para especificar redes
- Route summarización agrupa múltiples subredes en un solo route
- OSPF para enrutamiento interior, BGP para enrutamiento entre ISPs
- IPv6 usa /64 como estándar para todas las subredes

> [!quote] La clave
> Routing es la inteligencia de Internet. Cada router toma una decisión local (mi tabla de enrutamiento) que, colectivamente, crea la ruta global de un packet desde el origen hasta el destino.

## Conexión con el resto de la wiki

| Concepto tocado | Artículo en profundidad |
|-----------------|------------------------|
| Modelo OSI | [[15-modelo-osi-tcpip]] (capa de red) |
| NAT | [[13-nat-red]] (cómo NAT interactúa con routing) |
| Firewalls | [[17-firewalls-proxies-loadbalancers]] (firewalls que filtran routes) |
| Puertos | [[12-puertos]] (dirección IP + puerto = destino completo) |
