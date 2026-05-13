# 07 Monitoring — Observabilidad con Prometheus, Grafana y Logging

> [!info] Contexto del módulo
> Este artículo es parte del **Módulo 02: Infraestructura y Contenedores**. Se conecta con [[01-Docker-Fundamentos-Arquitectura-Aislamiento-Capas]], [[05-Kubernetes-Fundamentals-Arquitectura-Pods-Services-Deployments]], [[06-CICD-Pipelines]] y con el [[Módulo 6: Sistemas Distribuidos]].

## Introducción: ¿Por qué monitorizar?

En sistemas distribuidos modernos — microservicios, contenedores, Kubernetes — las aplicaciones ya no se ejecutan en una sola máquina donde puedes hacer `top`, `tail -f logs`, y `netstat`. Se ejecutan en docenas o cientos de contenedores distribuidos en múltiples nodos, con tráfico fluyendo entre ellos a través de redes virtuales, balanceadores de carga y service meshes. Si una API responde lentamente, ¿cómo sabes si el problema está en la aplicación, en la base de datos, en la red, en el balanceador de carga, o en el proveedor de nube?

Sin observabilidad, responder a esa pregunta es como buscar una aguja en un pajar mientras el pajar se está quemando. La monitorización (monitoring) y la observabilidad (observability) son las disciplinas que te permiten entender el estado interno de tu sistema basándote en los datos externos que produce.

> [!info] Diferencia entre Monitoring y Observabilidad
> - **Monitoring**: Responde a preguntas que ya sabes que necesitas hacer. "¿Está el servidor vivo?", "¿Cuánta CPU está usando?", "¿Cuántos errores 500 hay?"
> - **Observabilidad**: La capacidad de hacer preguntas que *no* sabías que necesitabas hacer, basándote en los datos del sistema. "¿Por qué este usuario específico tiene una experiencia lenta?" o "¿Qué microservicio está causando el aumento de latencia?"
>
> La observabilidad se construye sobre tres pilares: **Métricas**, **Logs** y **Traces**.

---

## 1. Los tres pilares de la observabilidad

### 1.1 Métricas (Metrics)

Las métricas son datos numéricos medidos a lo largo del tiempo. Son ligeras, eficientes y perfectas para alertas y dashboards en tiempo real.

Tipos de métricas:
- **Counter**: Un valor que solo aumenta (o se resetea). Ejemplo: número total de requests HTTP, número de errores, número de bytes enviados.
- **Gauge**: Un valor que puede subir y bajar. Ejemplo: memoria usada, número de conexiones activas, temperatura del CPU.
- **Histogram**: Mide la distribución de valores (latencia, tamaño de responses). Calculabuckets (rangs) y cuenta cuántos valores caen en cada uno. También calcula sumas y counts.
- **Summary**: Similar al histogram pero calculado en el cliente (no en el servidor de métricas). Útil cuando necesitas percentiles precisos.

> [!example] Analogía
> Las métricas son como el velocímetro, el tacómetro y el medidor de combustible de un coche. Te dicen números concretos en tiempo real: velocidad, RPM, nivel de gasolina. No te dicen *por qué* el coche va lento, pero te dicen *qué* está pasando.

### 1.2 Logs

Los logs son registros textuales (o estructurados) de eventos que ocurren en tu aplicación. Son ideales para debugging y para entender el contexto exacto de un evento.

```json
{
  "timestamp": "2024-05-13T14:32:01Z",
  "level": "ERROR",
  "service": "api-gateway",
  "request_id": "abc-123-def",
  "message": "Database connection timeout",
  "duration_ms": 5000,
  "user_id": "user-456",
  "endpoint": "/api/orders"
}
```

> [!tip] Logging estructurado
> Siempre usa logging estructurado (JSON) en producción. Los logs en texto plano son imposibles de analizar programáticamente. El logging estructurado permite indexar, filtrar y correlacionar logs automáticamente.

### 1.3 Traces (Trazas distribuidas)

Un trace rastrea una única request a través de todos los microservicios que toca. Cada trace tiene un `trace_id` único, y cada paso dentro del trace tiene un `span_id`. Esto permite ver el camino completo de una request y cuánto tiempo pasó en cada servicio.

```
Trace ID: a1b2c3d4e5f6
├── [Span 1] API Gateway (0-50ms)
│   ├── [Span 2] Auth Service (10-25ms)
│   └── [Span 3] Order Service (30-45ms)
│       ├── [Span 4] Database (35-42ms)
│       └── [Span 5] Cache (32-34ms)
└── [Span 6] Response (45-50ms)
```

---

## 2. Prometheus: La base de las métricas

Prometheus es un sistema de monitorización y alerting de código abierto creado por SoundCloud y ahora mantenido por la CNCF. Es el estándar de facto para monitorización en entornos Kubernetes y cloud-native.

### 2.1 Arquitectura de Prometheus

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Targets    │────>│   Prometheus  │────>│   Grafana    │
│ (apps,       │ Pull│   Server     │     │   / UI       │
│  exporters)  │     │              │     │              │
└─────────────┘     └──────────────┘     └──────────────┘
                         │
                         ▼
                   ┌──────────────┐
                   │  Alertmanager│
                   │  (alertas)   │
                   └──────────────┘
```

**Pull-based**: Prometheus no recibe métricas de los targets (no usa push). En su lugar, Prometheus hace polling (pull) de los targets en intervalos configurables (por defecto cada 15 segundos). Esto tiene ventajas:
- Los targets no necesitan saber nada de Prometheus
- Si un target se cae, Prometheus lo detecta automáticamente (deja de responder al pull)
- Es más fácil hacer scraping de múltiples targets

**Time Series Database (TSDB)**: Prometheus almacena todas las métricas como series temporales en disco local. Cada serie temporal se identifica por su nombre y un conjunto de labels (pares clave-valor).

```
http_requests_total{method="GET", handler="/api/users", status="200"}  15234
http_requests_total{method="POST", handler="/api/orders", status="500"}  42
node_cpu_seconds_total{cpu="0", mode="idle"}  98234.56
```

### 2.2 Tipos de métricas en Prometheus

**Node Exporter**: Exporta métricas del sistema operativo (CPU, memoria, disco, red) desde cada nodo. Se ejecuta como un daemon en cada máquina.

**cAdvisor (Container Advisor)**: Exporta métricas de contenedores Docker (uso de CPU, memoria, red, disco por contenedor). Se ejecuta en cada nodo y scrapea todos los contenedores locales.

**Blackbox Exporter**: Permite hacer checks de blackbox (HTTP, TCP, DNS, ICMP) desde Prometheus. Útil para monitorizar endpoints externos.

**Custom Application Metrics**: Tu aplicación expone sus propias métricas en el endpoint `/metrics` en formato Prometheus.

### 2.3 PromQL: El lenguaje de consultas de Prometheus

PromQL (Prometheus Query Language) es un lenguaje DSL (Domain Specific Language) diseñado específicamente para consultar series temporales.

```promql
# Requests por segundo para un endpoint específico
rate(http_requests_total{handler="/api/orders"}[5m])

# P99 de latencia de respuestas
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# Memoria usada por pod (en porcentaje)
(container_memory_usage_bytes{namespace="production"} / container_memory_limit_bytes{namespace="production"}) * 100

# Error rate (porcentaje de respuestas 5xx)
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100

# Upvotes por segundo (counter)
rate(upvotes_total[1m])

# Uptime (gauge que solo baja cuando hay reboot)
(1 - increase(node_reboots_total[1h])) * 100
```

> [!tip] Funciones clave de PromQL
> - `rate()`: Calcula la tasa por segundo de un counter en un intervalo. Siempre úsala con counters.
> - `increase()`: Calcula el incremento absoluto de un counter en un intervalo.
> - `histogram_quantile()`: Calcula percentiles (p50, p90, p99) a partir de histograms.
> - `sum()`, `avg()`, `min()`, `max()`: Agregaciones.
> - `without()`, `by()`: Agrupación y exclusión de labels.
> - `delta()`: Diferencia entre el primer y último valor en un intervalo (solo para gauges).
> - `absent()`: Retorna un valor si una serie no existe (útil para alertas).

### 2.4 Alerting con Alertmanager

Prometheus envía alertas a Alertmanager, que se encarga de deduplicar, agrupar, silenciar y enrutar las alertas a los canales correctos (Slack, PagerDuty, email, etc.).

```yaml
# alertmanager.yml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'slack-notifications'
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty-critical'
    - match:
        severity: warning
      receiver: 'slack-warnings'

receivers:
  - name: 'slack-notifications'
    slack_configs:
      - api_url: '$SLACK_WEBHOOK_URL'
        channel: '#monitoring-alerts'
        send_resolved: true

  - name: 'pagerduty-critical'
    pagerduty_configs:
      - service_key: '$PAGERDUTY_KEY'
```

Regla de alerta de ejemplo:

```yaml
# prometheus-rules.yml
groups:
  - name: application-alerts
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m]))
          /
          sum(rate(http_requests_total[5m]))
          > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Tasa de error alta en {{ $labels.service }}"
          description: "La tasa de error es {{ $value | humanizePercentage }} durante los últimos 2 minutos."

      - alert: HighLatency
        expr: |
          histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
          > 1.0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Latencia p99 alta en {{ $labels.service }}"
          description: "El p99 de latencia es {{ $value }}s durante los últimos 5 minutos."

      - alert: PodCrashLooping
        expr: |
          rate(kube_pod_container_status_restarts_total[15m]) * 60 * 15 > 0
        for: 0m
        labels:
          severity: warning
        annotations:
          summary: "Pod {{ $labels.namespace }}/{{ $labels.pod }} está en crash loop"
```

> [!warning] Alertas y ruido
> El mayor error con las alertas es tener demasiadas. Si recibes 50 alertas al día, las ignorarás. La regla de oro: cada alerta debe requerir una acción concreta. Si no hay acción, no es una alerta, es un dashboard.
>
> - **Critical**: Requiere acción inmediata (página en PagerDuty). Algo está roto y afecta a usuarios.
> - **Warning**: Requiere atención pero no es urgente (Slack). Algo podría romperse pronto.
> - **Info**: Solo para contexto (Slack o email diario). Nada roto, solo información.

---

## 3. Grafana: Visualización y Dashboards

Grafana es la herramienta de visualización líder para métricas. Se conecta a Prometheus (y muchas otras fuentes de datos) y permite crear dashboards interactivos, configurar alertas, y compartir visualizaciones.

### 3.1 Conceptos de Grafana

**Dashboard**: Una colección de paneles (panels) organizados en una página. Cada dashboard tiene un propósito específico (ej: "Dashboard de API Gateway", "Dashboard de Base de Datos").

**Panel**: Un gráfico, tabla, o estadística individual dentro de un dashboard. Cada panel tiene su propia consulta (PromQL) y visualización.

**Data Source**: La fuente de datos (Prometheus, Loki, Jaeger, Elasticsearch, MySQL, etc.). Grafana puede consultar múltiples data sources en el mismo dashboard.

**Variable**: Parámetros dinámicos que permiten filtrar todos los paneles de un dashboard simultáneamente. Ejemplo: una variable `$namespace` que filtra todos los gráficos por namespace.

### 3.2 Dashboard típico de aplicación

Un buen dashboard de aplicación debería responder a las preguntas:
1. ¿Está la aplicación viva?
2. ¿Está respondiendo correctamente?
3. ¿Está respondiendo rápido?
4. ¿Está consumiendo recursos de forma saludable?

**Paneles esenciales:**

1. **Uptime / Availability**: `1 - (sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])))`
2. **Request Rate (QPS)**: `sum(rate(http_requests_total[5m])) by (service)`
3. **Error Rate**: `sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)`
4. **Latency (p50, p90, p99)**: `histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))`
5. **CPU Usage**: `rate(container_cpu_usage_seconds_total[5m])`
6. **Memory Usage**: `container_memory_usage_bytes`
7. **Active Connections**: `go_goroutines` o `node_netstat_Tcp_CurrEstab`
8. **Goroutines / Threads**: `go_goroutines` (Go apps) o `process_threads` (general)
9. **Database Connections**: `pg_stat_activity_count` (PostgreSQL) o `mysql_global_status_threads_connected`
10. **Queue Depth**: `rabbitmq_queue_messages_ready` o `kafka_consumer_lag`

> [!tip] Regla de los 5 segundos
> Un dashboard debe responder a las preguntas críticas en menos de 5 segundos. Si tienes que hacer clic en 5 paneles para entender si la aplicación está bien, tu dashboard está mal diseñado. Lo más importante debe estar arriba y visible sin scroll.

### 3.3 Alerting en Grafana

Grafana puede alertar directamente desde los dashboards, lo cual es útil para alertas basadas en múltiples fuentes de datos o visualizaciones complejas:

```yaml
# En Grafana UI, configurar una alert rule:
Condition: A (query to Prometheus)
Evaluator: Math > 0.05 (5% error rate)
For: 5m (must be true for 5 minutes)
Notifications: Send to Slack #alerts, PagerDuty critical
```

> [!info] Prometheus vs Grafana alerting
> - **Prometheus Alertmanager**: Mejor para alertas basadas en métricas puras. Más preciso, menos latencia, deduplicación nativa.
> - **Grafana Alerting**: Mejor para alertas que combinan múltiples fuentes de datos (métricas + logs + traces). Soporta silencing y pausing desde la UI.
>
> Lo ideal es usar Prometheus para alertas de infraestructura y aplicación, y Grafana para alertas de negocio y multi-source.

---

## 4. Logging: Centralización y análisis

Los logs individuales de cada contenedor son inútiles en producción. Necesitas centralizarlos, indexarlos y hacerlos buscables.

### 4.1 Stack EFK / ELK

**ELK** = Elasticsearch + Logstash + Kibana
**EFK** = Elasticsearch + Fluentd + Kibana

La diferencia entre Logstash y Fluentd es que Fluentd es más ligero y se usa más en entornos Kubernetes.

**Fluentd / Fluent Bit**: Agentes que se ejecutan en cada nodo, leen los logs de los contenedores (de `/var/lib/docker/containers/` o del stdout/stderr de Kubernetes) y los envían a Elasticsearch.

**Elasticsearch**: Base de datos especializada en texto, con motor de búsqueda full-text y agregaciones. Almacena los logs indexados.

**Kibana**: Interfaz de usuario para explorar, visualizar y alertar sobre logs.

### 4.2 Loki: El logging de Grafana

Loki es un sistema de logging inspirado en Prometheus. A diferencia de Elasticsearch, Loki no indexa el contenido de los logs. En su lugar, indexa solo los labels (metadata) y almacena los logs comprimidos en bloques.

```
Loki Architecture:
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Promtail    │     │   Loki       │────>│   Grafana    │
│  (log        │ Push│   (ingest    │     │   (query     │
│   collector) │────>│    & query)  │     │    & viz)    │
└─────────────┘     └──────────────┘     └──────────────┘
```

**Ventajas de Loki sobre Elasticsearch:**
- Mucho más barato (almacena logs comprimidos, no indexa texto)
- Más simple (sin clusters complejos de Elasticsearch)
- Integración nativa con Grafana y Prometheus (misma infraestructura)
- Mejor para logs de Kubernetes (los labels de Kubernetes se mapean directamente a labels de Loki)

**Desventajas:**
- Búsquedas full-text menos potentes que Elasticsearch
- No es ideal para logs no estructurados de aplicaciones legacy

```logql
# LogQL: Lenguaje de consultas de Loki
# Logs de un servicio específico con nivel ERROR
{namespace="production", service="api-gateway"} |= "ERROR"

# Logs con un pattern específico
{namespace="production"} |= "database connection timeout"

# Logs agrupados por servicio
{namespace="production"} | logfmt | unwrap duration_ms | sum by (service)

# Logs de un trace específico
{trace_id="a1b2c3d4e5f6"}
```

### 4.3 Structured Logging en la aplicación

Independientemente de la herramienta de logging, la aplicación debe producir logs estructurados:

```python
# Python ejemplo con structlog
import structlog

logger = structlog.get_logger()

def handle_request(request):
    logger.info(
        "request_started",
        method=request.method,
        path=request.path,
        user_id=request.user.id,
        request_id=request.id,
        ip=request.remote_addr
    )
    
    try:
        result = process(request)
        logger.info(
            "request_completed",
            duration_ms=result.duration,
            status=200,
            request_id=request.id
        )
        return result
    except DatabaseError as e:
        logger.error(
            "database_error",
            error=str(e),
            query=result.query,
            duration_ms=result.duration,
            request_id=request.id,
            stack_info=True  # Incluir stack trace
        )
        raise
```

> [!tip] Niveles de log
> - **DEBUG**: Información detallada para debugging. Solo en desarrollo.
> - **INFO**: Eventos normales del flujo de la aplicación (request start/end, job completed).
> - **WARN**: Algo inesperado pero recuperable (retry attempt, deprecated API call).
> - **ERROR**: Algo falló pero la aplicación puede recuperarse (database timeout, external API failure).
> - **FATAL**: Algo crítico, la aplicación no puede continuar.
>
> En producción, normalmente se registran INFO y superiores. DEBUG se activa solo cuando se necesita debugging.

---

## 5. Distributed Tracing: OpenTelemetry

OpenTelemetry (OTel) es el estándar unificado para tracing, métricas y logs de la CNCF. Antes de OTel, cada framework tenía su propio sistema de tracing (Jaeger, Zipkin, Datadog Agent, etc.). OTel unifica todo en un solo SDK.

### 5.1 Conceptos de OpenTelemetry

**Trace**: Un árbol de spans que representa una request completa a través de los servicios.

**Span**: Una operación individual dentro de un trace. Tiene:
- `name`: Qué se hizo (ej: "HTTP GET /api/users")
- `start_time` y `end_time`: Duración
- `attributes`: Metadata (HTTP method, status code, database query)
- `events`: Marcas temporales (ej: "cache hit", "db query started")
- `links`: Conexiones a otros spans (ej: en async processing)
- `status`: OK, ERROR, o UNSET

**Context Propagation**: El mecanismo por el cual el `trace_id` y `span_id` se pasan de un servicio a otro. En HTTP, se hace mediante headers:
- `traceparent`: W3C Trace Context standard
- `tracestate`: Vendor-specific data

```
HTTP Request Headers:
Traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
Tracestate: consul=00000000000000000000000000000001
```

### 5.2 Instrumentación automática vs manual

**Auto-instrumentation**: El SDK instrumenta automáticamente frameworks populares (Express, Django, Spring Boot, gRPC) sin cambiar el código de la aplicación.

**Manual instrumentation**: El desarrollador añade spans explícitamente para operaciones de negocio (ej: "procesar pedido", "calcular precio").

Lo ideal es usar ambas: auto-instrumentación para infraestructura (HTTP, DB, cache) y manual para lógica de negocio.

```python
# Python con OpenTelemetry + auto-instrumentation
from opentelemetry.instrumentation.flask import FlaskInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

FlaskInstrumentor().instrument_app(app)
SQLAlchemyInstrumentor().instrument_engine(engine)

# Manual instrumentation para lógica de negocio
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

def process_order(order):
    with tracer.start_as_current_span("process_order") as span:
        span.set_attribute("order_id", order.id)
        span.set_attribute("user_id", order.user_id)
        
        # Validar
        validate_order(order)
        
        # Calcular precio
        price = calculate_price(order)
        span.set_attribute("calculated_price", price)
        
        # Guardar en DB
        save_order(order, price)
        
        return price
```

### 5.3 Visualización de traces: Jaeger y Tempo

**Jaeger**: El tracer más maduro. Almacena traces en Elasticsearch o Cassandra. Interfaz web para explorar traces, ver flame graphs, y filtrar por servicio, operación, o duración.

**Tempo**: El tracer de Grafana, diseñado para ser ligero y económico (similar a cómo Loki es para logs). Almacena traces en S3/GCS y usa Loki para indexación. Integración nativa con Grafana.

---

## 6. SRE: SLIs, SLOs y SLAs

La Site Reliability Engineering (SRE) introduce un enfoque métrico para la fiabilidad. En lugar de decir "la aplicación debe estar disponible", se definen objetivos medibles.

### 6.1 SLI (Service Level Indicator)

Un SLI es una métrica que mide un aspecto del servicio desde la perspectiva del usuario.

Ejemplos:
- **Availability**: `requests_successful / requests_total`
- **Latency**: `p99 response time`
- **Throughput**: `requests per second`
- **Correctness**: `percentage of responses with valid data`

### 6.2 SLO (Service Level Objective)

Un SLO es el objetivo target para un SLI. Define el nivel de fiabilidad que el equipo se compromete a alcanzar.

```
SLI: Error rate (percentage of 5xx responses)
SLO: 99.9% of requests must succeed (error rate < 0.1%)
```

> [!tip] Error Budget
> Si tu SLO es 99.9% de disponibilidad, tu error budget es 0.1% (43 minutos de downtime al mes). Cada vez que fallas el SLO, gastas error budget. Cuando el budget se agota, se detiene el desarrollo de features y el equipo se centra en fiabilidad hasta que el budget se recupere.
>
> Esto alinea incentives: los desarrolladores pueden lanzar features rápido mientras haya error budget, pero deben priorizar fiabilidad cuando el budget se acaba.

### 6.3 SLA (Service Level Agreement)

Un SLA es un contrato con los usuarios/clientes que define las consecuencias de no cumplir los SLOs. Generalmente incluye compensaciones económicas (créditos de servicio).

```
SLA: 99.95% availability. Si cae por debajo, se otorga un crédito del 10% del mensual.
SLO: 99.98% availability (más ambicioso que el SLA para tener margen).
SLI: Monitoring de uptime con checks cada 1 minuto.
```

---

## 7. Kubernetes Monitoring: Métricas específicas

Kubernetes genera sus propias métricas que son críticas para la operación del clúster:

### 7.1 Métricas del Control Plane

```promql
# API Server latency p99
histogram_quantile(0.99, rate(apiserver_request_duration_seconds_bucket[5m]))

# etcd commit duration
histogram_quantile(0.99, rate(etcd_disk_wal_fsync_duration_seconds_bucket[5m]))

# Scheduler latency
histogram_quantile(0.99, rate(scheduler_e2e_scheduling_duration_seconds_bucket[5m]))

# Number of API requests by verb
sum(rate(apiserver_request_total[5m])) by (verb)
```

### 7.2 Métricas de Nodes

```promql
# Node CPU usage
rate(node_cpu_seconds_total{mode!="idle"}[5m])

# Node memory pressure
node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes

# Node disk pressure
1 - (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"})

# Node not ready
kube_node_status_condition{condition="Ready",status="true"} == 0
```

### 7.3 Métricas de Pods

```promql
# Pod restarts
rate(kube_pod_container_status_restarts_total[15m]) * 60 * 15

# Pod CPU throttling
rate(container_cpu_cfs_throttled_seconds_total[5m])

# Pod OOM kills
kube_pod_container_status_last_terminated_reason{reason="OOMKilled"}

# Pod pending (scheduled = 0)
kube_pod_status_phase{phase="Pending"}
```

### 7.4 kube-state-metrics

`kube-state-metrics` es un service que expone métricas sobre el estado de los recursos de Kubernetes (pods, deployments, nodes, jobs, etc.). No mide rendimiento — mide estado.

```promql
# Number of replicas desired vs available for each deployment
kube_deployment_spec_replicas - kube_deployment_status_replicas_available

# Jobs that have failed
kube_job_status_failed > 0

# PVCs that are not bound
kube_persistentvolumeclaim_status_phase{phase!="Bound"} == 1
```

### 7.5 Metrics Server

El Metrics Server es un scaler de métricas agregadas que se usa para HPA (Horizontal Pod Autoscaler) y `kubectl top`. No almacena métricas históricas — solo las expone en tiempo real.

```bash
# Ver uso de recursos de pods
kubectl top pods -n production

# Ver uso de recursos de nodes
kubectl top nodes
```

---

## 8. Herramientas clave: Resumen

| Herramienta | Propósito | Tipo |
|------------|-----------|------|
| **Prometheus** | Métricas y alerting | Time-series DB |
| **Grafana** | Visualización de métricas | Dashboard UI |
| **Loki** | Logging centralizado | Log aggregation |
| **Jaeger / Tempo** | Distributed tracing | Trace storage |
| **Alertmanager** | Gestión de alertas | Alert routing |
| **kube-state-metrics** | Estado de recursos K8s | Metrics exporter |
| **node-exporter** | Métricas de nodos | Metrics exporter |
| **cAdvisor** | Métricas de contenedores | Metrics exporter |
| **Blackbox Exporter** | Checks de blackbox | Metrics exporter |
| **OpenTelemetry** | SDK unificado para observabilidad | Instrumentation |

---

## 9. Best Practices de Monitoring

### 9.1 Principio de la alertabilidad

> "Si no puedes alertar sobre ello, no lo estás monitorizando."

Cada métrica importante debe tener una alerta o un dashboard. Si una métrica no tiene alerta ni dashboard, probablemente no sea importante (o alguien se olvidó de configurarlo).

### 9.2 Principio de los 4 golden signals

Edmondson et al. (Google SRE Book) definen 4 señales doradas que todo sistema debería monitorizar:

1. **Latencia**: Tiempo en servir una request (excluyendo requests fallidas).
2. **Traffic**: Demanda del sistema (QPS, ancho de banda, tamaño de cola).
3. **Errors**: Tasa de fallos (5xx, timeouts, excepciones).
4. **Saturation**: Cuán "lleno" está el sistema (CPU, memoria, disco, conexiones).

### 9.3 Principio de la acción

> "Cada alerta debe tener un runbook."

Un runbook es un documento que describe exactamente qué hacer cuando se recibe una alerta:
- ¿Qué significa esta alerta?
- ¿Cómo se reproduce el problema?
- ¿Cuáles son los pasos de resolución?
- ¿A quién contactar si no se puede resolver?

Sin runbook, una alerta es solo ruido.

### 9.4 Principio de la correlación

Las métricas, logs y traces deben estar correlacionados. Si ves un spike de latencia en Prometheus, deberías poder hacer clic y ver los logs relevantes y los traces de esas requests. OpenTelemetry facilita esto con `trace_id` que se pasa a través de métricas, logs y traces.

### 9.5 Principio de la progresión

> "Monitoriza la progresión del sistema, no solo el estado actual."

No solo mires el valor actual de una métrica — mira su tendencia. Un error rate del 0.5% puede ser aceptable, pero si está subiendo un 10% cada hora, algo se está rompiendo y necesitas actuar antes de que llegue al umbral de alerta.

```promql
# Derivative: cuánto está cambiando una métrica por segundo
deriv(http_errors_total[1h])

# Rate of change
increase(http_errors_total[1h]) / 3600
```

---

## 10. Conceptos clave

1. **Observabilidad > Monitoring**: El monitoring responde preguntas conocidas; la observabilidad permite hacer preguntas nuevas. Los tres pilares (métricas, logs, traces) son complementarios, no sustitutos.

2. **Prometheus es pull-based**: Hace scraping de los targets, no recibe push. Esto simplifica la arquitectura y hace que la detección de fallos sea automática.

3. **Las alertas deben requerir acción**: Si una alerta no tiene un runbook o no requiere una acción concreta, no es una alerta — es un dashboard.

4. **Error budget alinea incentives**: Cuando hay budget, los desarrolladores pueden lanzar features rápido. Cuando se acaba, se prioriza la fiabilidad. Esto evita el conflicto clásico entre velocidad y estabilidad.

5. **Kubernetes genera sus propias métricas**: El clúster mismo es un sistema distribuido que necesita monitorización. kube-state-metrics, node-exporter, y las métricas del control plane son esenciales para operar Kubernetes en producción.

---

## Relacionado con

- [[01-Docker-Fundamentos-Arquitectura-Aislamiento-Capas]] — Los contenedores generan métricas (CPU, memoria, red) que Prometheus monitoriza
- [[05-Kubernetes-Fundamentals-Arquitectura-Pods-Services-Deployments]] — Kubernetes tiene sus propias métricas y requiere monitorización específica
- [[06-CICD-Pipelines]] — Las pipelines CI/CD necesitan monitorización post-deploy para validar los rollouts
- [[Módulo 6: Sistemas Distribuidos]] — La observabilidad es esencial para debugging en sistemas distribuidos

## Referencias

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Google SRE Book: Chapter 6 - Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Loki Documentation](https://grafana.com/docs/loki/latest/)
- [The Four Golden Signals](https://sre.google/sre-book/search-experience/)
- [Monitoring Distributed Systems with Prometheus](https://prometheus.io/docs/operating/integration/)
