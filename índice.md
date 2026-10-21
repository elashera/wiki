# 📚 Índice de la Wiki

Guía interconectada de fundamentos de Internet, infraestructura y desarrollo moderno.

## 01 — Fundamentos de Internet

> [!info] Filosofía
> Estos conceptos son la base de **todo** lo que viene después. Domina estos y el resto fluye naturalmente.

- [[01-fundamentos-internet/01-que-es-internet]] — Qué es Internet, cómo funciona a alto nivel, cliente-servidor, el modelo TCP/IP
- [[01-fundamentos-internet/02-como-navegar-de-url-a-pagina]] — El viaje completo: desde que escribes una URL en el navegador hasta que ves la página
- [[01-fundamentos-internet/03-dns-profundo]] — DNS en profundidad: resolución, caché, TTL, registros (A, AAAA, CNAME, MX, TXT, NS, PTR, SRV, SOA), DNSSEC
- [[01-fundamentos-internet/04-dns-cdn-y-cdnflare]] — CDN, Cloudflare: cómo aceleran tu sitio y protegen contra ataques
- [[01-fundamentos-internet/05-http-profundo]] — HTTP en profundidad: métodos, headers, cuerpo de la petición, pipeline, keep-alive, HTTP/1.1 vs HTTP/2 vs HTTP/3
- [[01-fundamentos-internet/06-status-codes]] — Códigos de estado: qué significan cada grupo (1xx, 2xx, 3xx, 4xx, 5xx), cuándo se usan, errores comunes
- [[01-fundamentos-internet/07-https-tls]] — HTTPS y TLS: handshake paso a paso, certificados, cipher suites, SNI, HSTS
- [[01-fundamentos-internet/08-lets-encrypt-certificados]] — Let's Encrypt y Certbot: cómo obtener certificados gratuitos en producción
- [[01-fundamentos-internet/09-cookies-sesiones]] — Cookies y sesiones: tipos, atributos, JWT, tokens, stateless vs stateful
- [[01-fundamentos-internet/10-autenticacion-api-keys-tokens]] — Autenticación: Basic Auth, Bearer tokens, API keys, OAuth 2.0, diferencias y cuándo usar cada una
- [[01-fundamentos-internet/11-res-todo-sobre-api-rest]] — REST: principios, recursos, verbos HTTP, HATEOAS, diferencias con GraphQL/RPC, buenas prácticas
- [[01-fundamentos-internet/12-puertos-localhot-localhost]] — Puertos, localhost, loopback: qué son, cómo funcionan, IPv4 vs IPv6, well-known vs ephemeral
- [[01-fundamentos-internet/13-nat-red]] — NAT: traducción de direcciones, SNAT, DNAT, masquerading, por qué no podemos acceder a un contenedor sin redirigir puertos
- [[01-fundamentos-internet/14-servidores-procesos-processos]] — Servidores y procesos: qué es un proceso, PID, daemon, zombie, qué pasa bajo `curl localhost:3000`

## 02 — Infraestructura Moderna Práctica

- [Próximamente]

## 03 — DevOps Práctico

- [Próximamente]

## 04 — Arquitectura Moderna

- [Próximamente]

## 99 — IA para gente curiosa (Fascículo 01)

> [!info] Fuente externa
> Resumen del Facsímil 01 del proyecto [IA para gente curiosa](https://www.iaparagentecuriosa.686f6c61.dev/) por [686f6c61](https://x.com/686f6c61). Licencia CC BY 4.0 + MIT.

- [[ES/99-ia-para-gente-curiosa/index|Índice completo]] — 12 capítulos sobre fundamentos de IA
- [[ES/99-ia-para-gente-curiosa/01-que-es-ia|01 — Qué es y qué no es la IA]] — Predicción del siguiente token, tokenización, logits, softmax
- [[ES/99-ia-para-gente-curiosa/02-sistemas-deterministas-probabilisticos|02 — Sistemas deterministas vs probabilísticos]] — Temperatura, top-p, top-k, tests por propiedades
- [[ES/99-ia-para-gente-curiosa/03-principios-fundamentales|03 — Principios fundamentales]] — Supervisado, no supervisado, post-training, atención, scaling laws
- [[ES/99-ia-para-gente-curiosa/04-neurona-artificial|04 — La neurona artificial]] — y = f(Σ wᵢxᵢ + b), pesos, sesgo, activaciones
- [[ES/99-ia-para-gente-curiosa/05-redes-neuronales|05 — Redes neuronales]] — Capas, matrices, forward pass, contratos de forma
- [[ES/99-ia-para-gente-curiosa/06-retropropagacion|06 — Retropropagación]] — Gradientes, regla de la cadena, ejemplo numérico
- [[ES/99-ia-para-gente-curiosa/07-perdida-optimizadores|07 — Pérdida y optimizadores]] — Cross-entropy, MSE, Adam, AdamW, Muon
- [[ES/99-ia-para-gente-curiosa/08-cnns-rnns|08 — CNNs y RNNs]] — Convoluciones, LSTMs, comparación con Transformer
- [[ES/99-ia-para-gente-curiosa/09-token-embedding|09 — Tokens y embeddings]] — BPE, similitud coseno, modelos de embedding
- [[ES/99-ia-para-gente-curiosa/10-entrenamiento-inferencia|10 — Entrenamiento vs inferencia]] — Prefill, decode, KV cache, cuantización, LoRA
- [[ES/99-ia-para-gente-curiosa/11-ml-clasico|11 — ML clásico]] — SVM, árboles, clustering, precision, recall, F1
- [[ES/99-ia-para-gente-curiosa/12-recapitulacion|12 — Recapitulación]] — Revisión activa con preguntas de autoevaluación
