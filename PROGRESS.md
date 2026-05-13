# Wiki Progress Tracker

## Objetivo General

### 🇪🇸 Español

**Meta:** Construir una wiki técnica completa, interconectada y de nivel profesional sobre los recursos listados en `índice.md` y estructurados en `wiki-structure.md`, que funcione simultáneamente como vault de Obsidian (con enlaces bidireccionales, backlinks y navegación por grafos) y como sitio web estático legible por navegador.

**Qué significa "completa":** Cada artículo de la wiki debe cubrir un tema desde sus fundamentos hasta su aplicación práctica en el contexto de ingeniería de IA y sistemas distribuidos. No se trata de definiciones de diccionario ni de frases sueltas tipo "X es Y". Cada artículo debe incluir:

- **Explicación conceptual de nivel principiante:** ¿Qué problema resuelve este concepto? ¿Por qué existe? ¿Qué pasa si no lo entendemos? Se asume que el lector no sabe nada previo y se construye el conocimiento desde cero, con analogías cuando ayudan y con advertencias explícitas sobre malentendidos comunes.
- **Explicación intermedia con profundidad técnica:** ¿Cómo funciona internamente? ¿Cuáles son los mecanismos subyacentes? Se incluyen diagramas conceptuales (en notación Excalidraw o ASCII), especificaciones de protocolos cuando aplica, y explicaciones paso a paso de procesos (ej: el handshake TLS completo, la resolución DNS desde el resolver hasta el authoritative nameserver).
- **Explicación avanzada con detalles de implementación:** ¿Cómo se ve esto en producción? ¿Cuáles son las trampas, las optimizaciones, las decisiones de diseño? Se incluyen ejemplos de configuración real, snippets de código relevantes, métricas de rendimiento, y referencias a la documentación oficial o papers académicos.
- **Contexto en el ecosistema:** ¿Cómo se conecta este tema con los demás módulos? Cada artículo debe tener enlaces bidireccionales a artículos relacionados en Obsidian (usando `[[wiki-link]]`) y debe incluir una sección de "Relacionado con" que explique explícitamente la conexión.

**Niveles de detalle por artículo (guía no exhaustiva):**

| Nivel | Qué incluye | Ejemplo |
|-------|------------|---------|
| Nivel 1 — Fundamentos | Definición, propósito, analogía, "qué pasa si no existe" | Qué es DNS y por qué necesitamos nombres en lugar de IPs |
| Nivel 2 — Mecanismo | Paso a paso del funcionamiento interno, diagramas, protocolo | Resolución DNS: resolver → root → TLD → authoritative, con TTL y caché |
| Nivel 3 — Producción | Configuración real, troubleshooting, optimización, métricas | DNSSEC: firma de zonas, cadena de confianza, rol de KSK/ZSK, cómo verificar con `dig +dnssec` |
| Nivel 4 — Avanzado | Papers, especificaciones RFC, implementación en código, edge cases | Implementación de un resolver DNS en Rust con UDP/TCP fallback y caching LRU |

**Formato de los artículos:**

- Extensión mínima orientativa: 500-1000 líneas por artículo (aprox. 15-30k caracteres), dependiendo de la complejidad del tema. Temas como "qué es Internet" pueden ser más cortos; temas como "RLHF" o "distributed training" pueden ser significativamente más largos.
- Estructura estándar: título con número de módulo y orden, introducción contextual, cuerpo con subtítulos jerárquicos, sección de "Conceptos clave", sección de "Relacionado con", y referencias.
- Uso de bloques de nota de Obsidian: `> [!info]`, `> [!warning]`, `> [!tip]`, `> [!example]` para resaltar información importante.
- Enlaces bidireccionales: cada artículo debe enlazar a artículos relacionados con `[[nombre-del-articulo]]` y debe contener al menos 3-5 enlaces entrantes esperados.
- Código: snippets en bloques con lenguaje especificado, explicados línea por línea cuando sea relevante.
- Diagramas: ASCII art para flujos simples, referencias a diagramas Excalidraw para arquitecturas complejas.

**Requisitos de calidad:**

- No asumir conocimiento previo: si mencionas un concepto, o bien lo defines en el mismo artículo, o bien enlazas al artículo que lo explica.
- No frases vagas como "es importante" o "es fundamental" sin explicar por qué.
- No explicaciones de una sola línea. Cada afirmación técnica debe ir acompañada de una explicación de por qué es así.
- Incluir errores comunes y cómo evitarlos en cada tema.
- Cada artículo debe terminar con un resumen de 3-5 puntos clave y una lista de artículos relacionados.

**Estructura de archivos:**

```
wiki/
├── PROGRESS.md          ← Este archivo (tracker de progreso)
├── README.md            ← Descripción del proyecto
├── wiki-structure.md    ← Plan de módulos y temas
├── índice.md            ← Navegación principal con Obsidian links
├── 01-fundamentos-internet/
│   ├── 01-que-es-internet.md
│   ├── 02-como-navegar-de-url-a-pagina.md
│   ├── 03-dns-profundo.md
│   └── ...
├── 02-infraestructura/
│   └── ...
└── ...
```

Cada archivo `.md` dentro de las carpetas de módulo debe ser un artículo completo siguiendo las directrices anteriores.

---

### 🇬🇧 English

**Goal:** Build a complete, interlinked, professional-grade technical wiki on the resources listed in `índice.md` and structured in `wiki-structure.md`, functioning simultaneously as an Obsidian vault (with bidirectional links, backlinks, and graph navigation) and as a static website readable in a browser.

**What "complete" means:** Each wiki article must cover a topic from its fundamentals to its practical application in the context of AI engineering and distributed systems. This is not about dictionary definitions or standalone phrases like "X is Y." Each article must include:

- **Beginner-level conceptual explanation:** What problem does this concept solve? Why does it exist? What happens if we don't understand it? The reader is assumed to have zero prior knowledge, and knowledge is built from the ground up, with analogies where they help and explicit warnings about common misunderstandings.
- **Intermediate-level technical depth:** How does it work internally? What are the underlying mechanisms? Conceptual diagrams (in Excalidraw or ASCII notation), protocol specifications where applicable, and step-by-step explanations of processes (e.g., the complete TLS handshake, DNS resolution from the resolver to the authoritative nameserver).
- **Advanced-level implementation details:** How does this look in production? What are the pitfalls, optimizations, and design decisions? Real configuration examples, relevant code snippets, performance metrics, and references to official documentation or academic papers.
- **Ecosystem context:** How does this topic connect with the other modules? Each article must have bidirectional links to related articles in Obsidian (using `[[wiki-link]]`) and must include a "Related to" section that explicitly explains the connection.

**Detail levels per article (non-exhaustive guide):**

| Level | What it includes | Example |
|-------|-----------------|---------|
| Level 1 — Fundamentals | Definition, purpose, analogy, "what if it didn't exist" | What DNS is and why we need names instead of IPs |
| Level 2 — Mechanism | Step-by-step internal operation, diagrams, protocol | DNS resolution: resolver → root → TLD → authoritative, with TTL and cache |
| Level 3 — Production | Real configuration, troubleshooting, optimization, metrics | DNSSEC: zone signing, chain of trust, KSK/ZSK roles, how to verify with `dig +dnssec` |
| Level 4 — Advanced | Papers, RFC specifications, code-level implementation, edge cases | Implementing a DNS resolver in Rust with UDP/TCP fallback and LRU caching |

**Article format:**

- Minimum approximate length: 500-1000 lines per article (approx. 15-30k characters), depending on topic complexity. Topics like "what is Internet" can be shorter; topics like "RLHF" or "distributed training" can be significantly longer.
- Standard structure: title with module number and order, contextual introduction, body with hierarchical subsections, "Key concepts" section, "Related to" section, and references.
- Obsidian callout blocks: `> [!info]`, `> [!warning]`, `> [!tip]`, `> [!example]` to highlight important information.
- Bidirectional links: each article must link to related articles with `[[article-name]]` and must contain at least 3-5 expected incoming links.
- Code: snippets in fenced code blocks with language specified, explained line-by-line when relevant.
- Diagrams: ASCII art for simple flows, references to Excalidraw diagrams for complex architectures.

**Quality requirements:**

- Do not assume prior knowledge: if you mention a concept, either define it in the same article or link to the article that explains it.
- No vague phrases like "is important" or "is fundamental" without explaining why.
- No single-line explanations. Every technical claim must be accompanied by an explanation of why it is so.
- Include common errors and how to avoid them in each topic.
- Each article must end with a 3-5 point key summary and a list of related articles.

**File structure:**

```
wiki/
├── PROGRESS.md          ← This file (progress tracker)
├── README.md            ← Project description
├── wiki-structure.md    ← Module and topic plan
├── índice.md            ← Main navigation with Obsidian links
├── 01-fundamentos-internet/
│   ├── 01-que-es-internet.md
│   ├── 02-como-navegar-de-url-a-pagina.md
│   ├── 03-dns-profundo.md
│   └── ...
├── 02-infraestructura/
│   └── ...
└── ...
```

Each `.md` file inside the module folders must be a complete article following the above guidelines.

## Español

| Módulo | Estado | Notas |
|--------|--------|-------|
| 01 — Redes e Internet | ✅ **complete** | 21 artículos (~7,400 líneas): modelo OSI, TCP/IP, HTTP/HTTPS/REST, DNS profundo, routing/subnetting, firewalls/proxies/load balancers, SSL/TLS, Cloudflare completo, VPS, Cloud providers, mensajería |
| 02 — Infraestructura y Contenedores | ✅ **complete** | 7 artículos (~6,770 líneas): Docker fundamentos, networking, volumes, Docker Compose, Kubernetes, CI/CD, Monitoring/Observabilidad |
|| 03 — Sistemas Distribuidos | ✅ **complete** | 5 artículos (~2,060 líneas): consensus (Paxos/Raft), message queues (RabbitMQ/Kafka), distributed caching (Redis Cluster), event-driven/CQRS/Saga, idempotency/retry/circuit breakers |
| 04 — Sistemas Operativos | pending | |
| 05 — Programación y Software Engineering | pending | |
| 06 — Bases de Datos | pending | |
| 07 — Machine Learning Fundamentals | pending | |
| 08 — Deep Learning | pending | |
| 09 — LLMs — Arquitectura y Funcionamiento | pending | |
| 10 — LLMs — Entrenamiento | pending | |
| 11 — LLMs — Evaluación y Benchmarking | pending | |
| 12 — RAG y Bases de Datos Vectoriales | pending | |
| 13 — Fine-Tuning | pending | |
| 14 — Agentes IA | pending | |
| 15 — Seguridad en IA | pending | |
| 16 — Cloud e Infraestructura IA | pending | |
| 17 — MLOps y Producción | pending | |
| 18 — Multimodal y Visión por Computador | pending | |

## English

| Módulo | Status | Notes |
|--------|--------|-------|
| 01 — Networking & Internet | ✅ **complete** | 21 articles (~10,100 lines): OSI model, TCP/IP, HTTP/HTTPS/REST, DNS deep-dive, routing/subnetting/CIDR, firewalls/proxies/load balancers, SSL/TLS, Cloudflare complete, VPS, Cloud providers, messaging |
| 02 — Infrastructure & Containers | ✅ **complete** | 7 articles (~6,770 lines): Docker fundamentals, networking, volumes, Docker Compose, Kubernetes, CI/CD, Monitoring/Observability |
| 03 — Distributed Systems | pending | |
| 04 — Operating Systems | pending | |
| 05 — Programming & Software Engineering | pending | |
| 06 — Databases | pending | |
| 07 — Machine Learning Fundamentals | pending | |
| 08 — Deep Learning | pending | |
| 09 — LLMs — Architecture and Functioning | pending | |
| 10 — LLMs — Training | pending | |
| 11 — LLMs — Evaluation and Benchmarking | pending | |
| 12 — RAG and Vector Databases | pending | |
| 13 — Fine-Tuning | pending | |
| 14 — AI Agents | pending | |
| 15 — AI Security | pending | |
| 16 — Cloud and AI Infrastructure | pending | |
| 17 — MLOps and Production | pending | |
| 18 — Multimodal and Computer Vision | pending | |
