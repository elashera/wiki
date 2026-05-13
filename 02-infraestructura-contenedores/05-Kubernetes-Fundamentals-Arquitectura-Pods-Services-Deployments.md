# 05 Kubernetes Fundamentals — Arquitectura, Pods, Services, Deployments

> [!info] Contexto del módulo
> Este artículo es parte del **Módulo 02: Infraestructura y Contenedores**. Se conecta con [[01-Docker-Fundamentos-Arquitectura-Aislamiento-Capas]], [[02-Docker-Networking-Redes-Bridge-Host-Overlay-Mas]], [[03-Docker-Volumes-Storage]], [[04-Docker-Compose-Orquestacion-Local]], [[06-CICD-Pipelines]], [[07-Monitoring]] y con el [[Módulo 6: Sistemas Distribuidos]].

## Introducción: ¿Por qué Kubernetes?

Docker resuelve un problema: empaquetar una aplicación y sus dependencias en un contenedor portátil. Pero ¿qué ocurre cuando esa aplicación necesita escalarse a decenas o cientos de contenedores, distribuidos en múltiples servidores, con necesidad de auto-reparación, balanceo de carga y actualizaciones sin downtime? Aquí es donde Docker por sí solo se queda corto. Docker Compose funciona perfectamente para un entorno de desarrollo con pocos servicios, pero no proporciona ninguna de las capacidades de orquestación que se necesitan en producción.

Kubernetes (abreviado K8s) es un sistema de orquestación de contenedores de código abierto creado originalmente por Google, ahora mantenido por la Cloud Native Computing Foundation (CNCF). No es solo una herramienta para ejecutar contenedores — es un sistema operativo distribuido completo para tu clúster de máquinas. Piensa en Docker como una caja que contiene tu aplicación, y en Kubernetes como la fábrica que gestiona cientos o miles de esas cajas: decide dónde colocarlas, cómo replicarlas, cómo actualizarlas, qué hacer cuando una máquina se cae, y cómo exponer las aplicaciones al exterior.

> [!warning] Error común
> Kubernetes no es un reemplazo de Docker. Kubernetes usa Docker (u otros contenedores runtimes) como motor de contenedores subyacente, pero añade capas de abstracción para la gestión a escala. No necesitas Kubernetes para ejecutar un solo contenedor — si solo tienes una o dos aplicaciones simples, Docker Compose es suficiente. Kubernetes introduce complejidad significativa que solo se justifica cuando escalas.

> [!tip] ¿Cuándo usar Kubernetes?
> - Tienes múltiples microservicios que necesitan comunicarse entre sí
> - Necesitas escalado automático basado en carga
> - Quieres actualizaciones sin downtime (zero-downtime deployments)
> - Tu infraestructura está distribuida en múltiples máquinas o proveedores de nube
> - Necesitas auto-reparación automática cuando fallan contenedores o nodos
>
> Si tu aplicación cabe en una sola máquina y no escala mucho, Kubernetes es overkill.

---

## 1. Arquitectura de Kubernetes

Kubernetes sigue una arquitectura cliente-servidor distribuida compuesta por dos tipos de nodos: **nodes maestros** (control plane) y **nodes de trabajo** (worker nodes). Cada uno tiene componentes específicos.

### 1.1 Control Plane (Master Node)

El control plane es el cerebro del clúster. Decide dónde colocar los contenedores, monitorea su estado y garantiza que el estado actual coincida con el estado deseado que tú defines. No ejecuta tus aplicaciones — solo las gestiona.

**Componentes del control plane:**

**API Server (`kube-apiserver`)**: Es la puerta de entrada frontal del clúster. Todas las interacciones — desde `kubectl` hasta los demás componentes internos — pasan por la API de Kubernetes. Es el punto central de comunicación y el único componente que accede directamente al etcd. Si el API server se cae, no puedes gestionar el clúster en absoluto.

El API server es una REST API que expone endpoints como `/api/v1/pods` o `/apis/apps/v1/namespaces/default/deployments`. Cuando ejecutas `kubectl get pods`, tu comando se convierte en una llamada HTTP GET a `/api/v1/namespaces/default/pods`. El API server autentica tu solicitud, la valida, y la procesa.

**etcd**: Es una base de datos distribuida key-value que almacena el estado completo de todo el clúster. Cada configuración, cada pod, cada servicio, cada secret, cada evento — todo está almacenado en etcd. Si pierdes etcd, pierdes todo el estado de tu clúster. etcd garantiza consistencia fuerte usando el protocolo Raft, lo que significa que cualquier lectura devuelve el dato más reciente confirmado por la mayoría de los nodos del cluster de etcd.

etcd no solo almacena el estado deseado (lo que tú pediste), sino también el estado actual (lo que realmente existe). El componente de control que compara estos dos estados es:

**Controller Manager (`kube-controller-manager`)**: Ejecuta múltiples controllers en bucles infinitos que comparan el estado actual con el estado deseado y toman acciones para reconciliarlos. Hay varios controllers:

- **Node Controller**: Monitorea el estado de los nodos y responde cuando se informa que no están funcionando.
- **Replication Controller**: Garantiza que el número de réplicas especificadas en un ReplicaSet estén siempre funcionando.
- **Endpoint Controller**: Rellena los objetos Endpoint (que conectan Services con Pods) y se crea cada vez que se crea o elimina un Pod.
- **Service and Endpoints Controller**: Como su nombre indica, vigila las solicitudes de objetos Service y crea objetos Endpoint para representar todas las versiones del servicio correspondiente.

Cada controller tiene un bucle de reconciliación: lee el estado actual desde etcd, lee el estado deseado desde etcd, calcula la diferencia, y ejecuta las acciones necesarias para eliminar esa diferencia. Este bucle se ejecuta típicamente cada 15-30 segundos.

**Scheduler (`kube-scheduler`)**: Es el responsable de decidir en qué nodo trabajador se ejecutará cada pod recién creado. Cuando se crea un pod, el scheduler lo "enqueuea" y evalúa todos los nodos disponibles basándose en:

- **Requests y limits de recursos**: CPU, memoria, GPU. El scheduler no permite que un pod se planifique en un nodo que no tenga suficientes recursos disponibles.
- **Affinity y anti-affinity rules**: Puedes decir "el pod A debe ejecutarse en el mismo nodo que el pod B" (affinity) o "los pods de la misma aplicación deben distribuirse en nodos diferentes" (anti-affinity, útil para alta disponibilidad).
- **Taints y tolerations**: Los nodos pueden tener "taints" (manchas) que indican que no deben aceptar ciertos pods. Los pods pueden tener "tolerations" que les permiten programarse en nodos con taints específicos. Esto se usa para nodos especiales: por ejemplo, un nodo con GPU tendría un taint que solo los pods que requieren GPU podrían tolerar.
- **Topology spread constraints**: Distribuir pods uniformemente a través de zonas de disponibilidad, racks, o regiones.
- **Pod topology spread constraints y node selector**: Puedes forzar que un pod se ejecute en un nodo con ciertas etiquetas usando `nodeSelector` o expressions de `nodeAffinity`.

**Cloud Controller Manager**: Un controller que interactúa con las APIs de proveedores de nube (AWS, GCP, Azure) para gestionar recursos como load balancers, routes, y volúmenes.

### 1.2 Worker Nodes

Los worker nodes son las máquinas (físicas o virtuales) que ejecutan tus aplicaciones. Cada nodo tiene los siguientes componentes:

**kubelet**: Es el agente que se ejecuta en cada nodo y es responsable de garantizar que los contenedores descritos en los pods de Kubernetes se estén ejecutando y funcionando correctamente. Habla directamente con el container runtime (containerd, CRI-O, o Docker). kubelet recibe instrucciones del API server, crea o elimina contenedores según corresponda, y reporta el estado del nodo al control plane.

Si kubelet detecta que un contenedor ha fallado, lo reinicia automáticamente. También ejecuta health checks (liveness probes y readiness probes) en los contenedores y reporta los resultados al API server.

**kube-proxy**: Es un proxy de red que se ejecuta en cada nodo y mantiene las reglas de red que permiten la comunicación con tus pods desde el interior o exterior del clúster. kube-proxy crea reglas de iptables o ipvs (en sistemas Linux modernos, ipvs es más eficiente) que redirigen el tráfico al pod correcto. Es responsable de la funcionalidad de los Services.

Cada Service en Kubernetes tiene un IP virtual (ClusterIP) y kube-proxy establece reglas de reenvío que distribuyen el tráfico entre los pods subyacentes. Cuando un pod nuevo se crea, kube-proxy detecta el cambio y actualiza las reglas de reenvío.

**Container Runtime**: El software responsable de ejecutar los contenedores. Aunque Docker fue el runtime original, Kubernetes ahora usa el Container Runtime Interface (CRI), que es un plugin API estándar. Los runtimes compatibles más comunes son:

- **containerd**: El runtime más común actualmente. Es un runtime de contenedores de nivel industrial que gestiona el ciclo de vida completo de los contenedores, incluyendo la distribución y transferencia de imágenes, el almacenamiento y la recuperación de imágenes, la ejecución y el envío de contenedores, y la gestión delower level storage y redes.
- **CRI-O**: Un runtime más ligero optimizado específicamente para Kubernetes.
- **Docker Engine**: Ya no es oficialmente soportado desde Kubernetes 1.24, pero sigue funcionando en versiones anteriores.

> [!info] Evolución del container runtime
> Originalmente, Kubernetes usaba Docker directamente. Pero como Docker hace muchas cosas más allá de ejecutar contenedores (build de imágenes, daemon con API propia, etc.), Kubernetes abstraó la capa de runtime con CRI. Esto permite usar cualquier runtime que implemente la interfaz CRI. Desde Kubernetes 1.24, Docker shim ha sido completamente eliminado, y se recomienda usar containerd o CRI-O.

### 1.3 Flujo de creación de un Pod

Para entender cómo todo encaja, veamos el flujo completo de cuando creas un pod:

```
1. Usuario ejecuta: kubectl apply -f pod.yaml
2. kubectl envía la solicitud al API Server (HTTPS, porta 6443)
3. API Server autentica la solicitud (usando tokens, certificates, o service accounts)
4. API Server valida la solicitud y la almacena en etcd
5. API Server notifica al Scheduler de que hay un pod sin asignar
6. Scheduler evalúa los nodos disponibles y selecciona el mejor nodo
7. API Server actualiza el pod con la información del nodo asignado (guarda en etcd)
8. kubelet en el nodo seleccionado detecta que hay un pod asignado a él
9. kubelet habla con el container runtime (containerd)
10. containerd descarga la imagen si no está en caché
11. containerd crea y arranca el contenedor
12. kubelet reporta al API Server que el pod está corriendo
13. kube-proxy actualiza las reglas de iptables/ipvs para incluir el nuevo pod
```

Cada paso de este flujo es crítico y cada componente tiene un rol específico. Si algo falla en cualquier paso, el pod no se pone en estado Running.

---

## 2. Pods: La unidad más pequeña

Un Pod es la unidad más pequeña y simple de despliegue en Kubernetes. Un Pod representa un proceso específico en ejecución en tu clúster. Cada Pod es asignado a un nodo trabajador, y permanece allí hasta su término (completado o eliminado) según la configuración.

### 2.1 ¿Qué es realmente un Pod?

Un Pod es un grupo de uno o más contenedores con recursos y especificaciones de red compartidos. Los contenedores dentro de un Pod:

- Se ejecutan en el mismo host (nodo)
- Comparten el mismo espacio de nombres de red (IP y puertos)
- Comparten el mismo espacio de nombres de almacenamiento (volumes)
- Seorchestran juntos como una única entidad

> [!example] Analogía
> Piensa en un Pod como un apartamento en un edificio. Cada contenedor es una habitación. Las habitaciones comparten la misma dirección IP (el edificio), pueden comunicarse entre sí a través de `localhost` (paredes entre habitaciones), y comparten el mismo sistema de archivos compartido (una despensa común en el piso). Pero el apartamento es la unidad básica de alquiler — no puedes alquilar una sola habitación independientemente.

Los pods casi siempre contienen un solo contenedor. Esta es la forma más común: un pod con un solo contenedor que ejecuta tu aplicación. Pero hay casos donde multi-container pods son útiles:

- **Sidecar containers**: Un contenedor principal que ejecuta tu aplicación, y un contenedor secundario que hace algo como loguear, hacer tail de archivos, o hacer syncing de archivos. Por ejemplo, el patrón sidecar es común para recolectar logs — un contenedor como Fluentd o Logstash que lee los logs del contenedor principal y los envía a un sistema centralizado.
- **Ambassador containers**: Un contenedor que actúa como proxy para conexiones externas. Por ejemplo, un ambassador para conectar a un servicio en la nube.
- **Adapter containers**: Un contenedor que adapta la salida de un contenedor principal a un formato que el sistema de monitoring pueda entender.

### 2.2 Estructura de un Pod

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: mi-app-pod
  namespace: default
  labels:
    app: mi-app
    version: v1
spec:
  containers:
    - name: app-container
      image: nginx:1.25
      ports:
        - containerPort: 80
      resources:
        requests:
          memory: "64Mi"
          cpu: "250m"
        limits:
          memory: "128Mi"
          cpu: "500m"
      env:
        - name: ENVIRONMENT
          value: "production"
      livenessProbe:
        httpGet:
          path: /health
          port: 80
        initialDelaySeconds: 15
        periodSeconds: 10
      readinessProbe:
        httpGet:
          path: /ready
          port: 80
        initialDelaySeconds: 5
        periodSeconds: 5
      volumeMounts:
        - name: config-volume
          mountPath: /etc/config
  volumes:
    - name: config-volume
      configMap:
        name: mi-app-config
```

Desglosando esta estructura:

**`apiVersion: v1`**: La versión de la API de Kubernetes. Para Pods, siempre es `v1`. Otros recursos como Deployments usan `apps/v1`, Services usan `v1`, etc.

**`kind: Pod`**: El tipo de recurso que estás creando. Kubernetes tiene docenas de tipos de recursos (kinds): Pod, Deployment, Service, ConfigMap, Secret, PersistentVolume, etc.

**`metadata`**: Información sobre el objeto:
- `name`: El nombre único del pod dentro del namespace
- `namespace`: El namespace donde se crea el pod (por defecto, `default`)
- `labels`: Pares clave-valor que se usan para seleccionar y agrupar pods. Son fundamentales para Services, Deployments, y otras abstracciones.
- `annotations`: Pares clave-valor arbitrarios que no se usan para selección, sino para herramientas y bibliotecas (metadatos de despliegue, información de CI/CD, etc.)

**`spec`**: La especificación deseada — lo que quieres que haga el pod:
- `containers`: La lista de contenedores que componen este pod. Cada contenedor tiene su propia imagen, configuración, y recursos.
- `volumes`: Los volúmenes compartidos por todos los contenedores del pod.

### 2.3 Resource Requests y Limits

Los recursos son uno de los conceptos más importantes en Kubernetes. Cada contenedor dentro de un pod debe definir cuántos recursos necesita (`requests`) y cuál es el máximo que puede usar (`limits`).

**Requests**: Son la garantía mínima de recursos que el scheduler necesita para colocar el pod en un nodo. El scheduler solo pondrá el pod en un nodo donde los recursos disponibles sean al menos los requests.

**Limits**: Son el máximo absoluto de recursos que el contenedor puede usar. Si un contenedor excede su limit de CPU, será throttleado (limitado en su uso de CPU). Si excede su limit de memoria, será terminado (OOM Killed — Out of Memory).

```yaml
resources:
  requests:
    memory: "128Mi"
    cpu: "250m"
  limits:
    memory: "256Mi"
    cpu: "500m"
```

> [!tip] Notación de CPU
> - `250m` = 250 millicores = 0.25 CPUs (un núcleo completo = 1000m = 1000 millicores)
> - `1` = 1 CPU completo
> - `2` = 2 CPUs completos
> - `0.5` = medio núcleo

> [!warning] ¿Por qué son importantes los limits de memoria?
> Si un contenedor excede su limit de CPU, Kubernetes simplemente limita su uso (throttling). Pero si excede su limit de memoria, el kernel Linux mata el proceso con OOM Killer. Esto significa que un pod que excede su límite de memoria se reiniciará automáticamente — y dependiendo de la configuración, podría entrar en un ciclo de reinicio infinito si no se corrige el problema de consumo de memoria.

### 2.4 Liveness y Readiness Probes

Los probes son mecanismos de health check que Kubernetes usa para gestionar el ciclo de vida de tus contenedores:

**Liveness Probe**: Determina si el contenedor está vivo. Si el probe falla, Kubernetes mata el contenedor y lo reinicia según la política de reinicio (`restartPolicy`). Esto se usa para detectar deadlocks: cuando tu aplicación se está ejecutando pero no puede hacer progreso.

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 15
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3
```

**Readiness Probe**: Determina si el contenedor está listo para aceptar tráfico. Si el probe falla, el pod es eliminado de los endpoints de todos los Services que lo seleccionan. Esto significa que el tráfico dejará de ser enviado a este pod, pero el pod NO se reinicia — simplemente no recibe tráfico hasta que el readiness probe vuelva a pasar.

```yaml
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
  failureThreshold: 3
```

**Startup Probe**: Un tipo adicional de probe introducido para aplicaciones que necesitan mucho tiempo para arrancar. Deshabilita los liveness y readiness probes hasta que el startup probe pase.

```yaml
startupProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 0
  periodSeconds: 10
  failureThreshold: 30
  periodSeconds: 10
  # Máximo tiempo de inicio: 30 * 10 = 300 segundos (5 minutos)
```

> [!info] Tipos de probes
> - **HTTP GET**: Kubernetes hará una petición HTTP GET al path y port especificados. Si el código de estado es >= 200 y <= 399, el probe pasa.
> - **Exec**: Ejecuta un comando dentro del contenedor. Si el código de salida es 0, el probe pasa.
> - **TCP Socket**: Intenta hacer un handshake TCP al port especificado. Si el puerto está abierto, el probe pasa.
>
> HTTP GET es el más común para aplicaciones web. Exec es útil para verificar estado de bases de datos o servicios. TCP es el más ligero y se usa cuando no necesitas verificar contenido.

---

## 3. Deployments: Gestión del ciclo de vida de aplicaciones

Crear pods directamente es práctico para pruebas, pero en producción necesitas una abstracción que gestione el ciclo de vida completo de tu aplicación. Aquí es donde entran los Deployments.

### 3.1 ¿Qué es un Deployment?

Un Deployment es un recurso de Kubernetes que proporciona declaraciones declarativas para la actualización de Pods y ReplicaSets. Usas un Deployment para:

1. **Declarar la configuración deseada** de tu aplicación: qué imagen usar, cuántas réplicas, qué variables de entorno, etc.
2. **Actualizar tu aplicación** con rollouts controlados (rolling updates, blue-green, canary).
3. **Hacer rollback** a una versión anterior si la actualización introduce problemas.
4. **Escalar tu aplicación** horizontalmente (cambiar el número de réplicas).
5. **Pausar y reanudar** los rollouts cuando sea necesario.

Un Deployment no gestiona pods directamente — gestiona ReplicaSets, que a su vez gestionan pods. Esta jerarquía:

```
Deployment → ReplicaSet → Pods
```

Cada vez que creas o actualizas un Deployment, Kubernetes crea un nuevo ReplicaSet. El Deployment rastrea todos los ReplicaSets que ha creado y los gestiona para realizar el rollout.

### 3.2 Estructura de un Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mi-app-deployment
  labels:
    app: mi-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mi-app
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: mi-app
        version: v2
    spec:
      containers:
        - name: app
          image: mi-registry/mi-app:v2.1.0
          ports:
            - containerPort: 8080
          resources:
            requests:
              memory: "256Mi"
              cpu: "500m"
            limits:
              memory: "512Mi"
              cpu: "1000m"
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: mi-app-secrets
                  key: database-url
            - name: LOG_LEVEL
              valueFrom:
                configMapKeyRef:
                  name: mi-app-config
                  key: log_level
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 5
```

**`replicas: 3`**: Indica que quieres 3 réplicas (pods idénticos) ejecutándose siempre. Si uno falla, el controller del Deployment creará uno nuevo automáticamente.

**`selector.matchLabels`**: Este es un campo crítico. Define cómo el Deployment identifica qué pods le pertenecen. Los pods creados por el Deployment deberán tener las etiquetas especificadas aquí (`app: mi-app`). Este selector es un selector de etiquetas inmutable — una vez que se crea el Deployment, no se puede cambiar.

> [!warning] Regla de los labels en Deployments
> Los labels en `spec.selector.matchLabels` deben coincidir exactamente con los labels en `spec.template.metadata.labels`. Si no coinciden, el Deployment no podrá gestionar los pods. Este es uno de los errores más comunes para principiantes.

**`strategy`**: Define cómo el Deployment actualiza las réplicas cuando la imagen o la configuración cambia. Hay dos tipos principales:

- **`RollingUpdate`** (por defecto): Reemplaza gradualmente los pods viejos por los nuevos. `maxSurge` controla cuántos pods adicionales se pueden crear sobre el número deseado de réplicas durante la actualización. `maxUnavailable` controla cuántos pods pueden estar no disponibles durante la actualización. La configuración `maxSurge: 1, maxUnavailable: 0` significa: crear un pod nuevo antes de eliminar uno viejo, garantizando cero downtime.

- **`Recreate`**: Elimina todos los pods viejos y luego crea los nuevos. Esto causa downtime porque durante la transición no hay pods disponibles.

### 3.3 Rolling Updates: El corazón de las actualizaciones sin downtime

El rolling update es la estrategia por defecto y la más utilizada. Cuando cambias la imagen de un contenedor en un Deployment (o cualquier otro campo que afecte al pod template), Kubernetes realiza un rollout automático:

1. Crea un nuevo ReplicaSet con la nueva configuración
2. Incrementa gradualmente el número de réplicas del nuevo ReplicaSet
3. Mientras tanto, decrementa el número de réplicas del viejo ReplicaSet
4. El proceso continúa hasta que todas las réplicas ejecutan la nueva versión

Con `maxSurge: 1` y `maxUnavailable: 0` y 3 réplicas:

```
Estado inicial (v1.0):
ReplicaSet-v1: [Pod-1, Pod-2, Pod-3]
ReplicaSet-v2: [none]

Paso 1 — Crear nuevo pod:
ReplicaSet-v1: [Pod-1, Pod-2, Pod-3]  (3 pods)
ReplicaSet-v2: [Pod-4]                 (1 pod nuevo)
Total: 4 pods (3 + 1 surge)

Paso 2 — Eliminar un pod viejo:
ReplicaSet-v1: [Pod-1, Pod-2]          (2 pods)
ReplicaSet-v2: [Pod-4, Pod-5]          (2 pods nuevos)
Total: 4 pods

Paso 3 — Eliminar otro pod viejo:
ReplicaSet-v1: [Pod-1]                 (1 pod)
ReplicaSet-v2: [Pod-4, Pod-5, Pod-6]   (3 pods nuevos)
Total: 4 pods

Paso 4 — Eliminar último pod viejo:
ReplicaSet-v1: [none]
ReplicaSet-v2: [Pod-4, Pod-5, Pod-6]   (3 pods)
Total: 3 pods — ¡actualización completa!
```

> [!tip] Verificación del rollout
> Después de una actualización, usa `kubectl rollout status deployment/mi-app-deployment` para verificar que el rollout se completó correctamente. Si algo salió mal, usa `kubectl rollout undo deployment/mi-app-deployment` para hacer rollback a la versión anterior.

### 3.4 Rollbacks

Kubernetes guarda un historial de todos los ReplicaSets creados por un Deployment (por defecto, guarda las últimas 10 revisiones). Si una actualización falla, puedes revertir:

```bash
# Ver historial de rollouts
kubectl rollout history deployment/mi-app-deployment

# Revertir a la revisión anterior
kubectl rollout undo deployment/mi-app-deployment

# Revertir a una revisión específica
kubectl rollout undo deployment/mi-app-deployment --to-revision=3

# Ver qué cambió entre dos revisiones
kubectl rollout history deployment/mi-app-deployment --revision=3
```

Cada vez que haces rollback, Kubernetes crea un nuevo ReplicaSet con la configuración revertida y realiza un nuevo rollout.

> [!warning] Limitaciones del rollback
> Solo puedes rollback a versiones que estén en el historial (limitado por `revisionHistoryLimit`, default 10). Si has hecho más de 10 actualizaciones sin rollback, las revisiones más antiguas se eliminan. Configura `revisionHistoryLimit` si necesitas más control sobre esto.

### 3.5 Escalado

Escalar un Deployment es tan simple como cambiar el número de replicas:

```bash
# Escalar a 5 réplicas
kubectl scale deployment/mi-app-deployment --replicas=5

# O editando el YAML directamente
kubectl edit deployment/mi-app-deployment
# Cambiar replicas: 3 → replicas: 5

# O usando autoscaling horizontal (más avanzado, ver más abajo)
kubectl autoscale deployment/mi-app-deployment --min=3 --max=10 --cpu-percent=70
```

El autoscaling horizontal (HPA — Horizontal Pod Autoscaler) es un componente que escala automáticamente los pods basándose en métricas como CPU, memoria, o métricas custom (como la longitud de una cola de mensajes en Kafka).

---

## 4. Services: Redireccionamiento y descubrimiento de red

Los pods en Kubernetes son efímeros: se crean y se destruyen constantemente. Cada pod recibe una dirección IP única, pero esa IP cambia cada vez que el pod se recrea. Si tu aplicación tiene múltiples componentes que necesitan comunicarse entre sí, ¿cómo haces para que un pod encuentre a otro cuando las IPs de los pods cambian constantemente?

Un Service es una abstracción que define un conjunto lógico de pods y un política para acceder a ellos. Los Services proporcionan un endpoint estable (una IP virtual) que redirige el tráfico a los pods subyacentes, incluso cuando los pods se crean, destruyen o mueven.

### 4.1 Tipos de Services

**ClusterIP** (por defecto): Expone el Service dentro del clúster con una IP interna (ClusterIP). Es el tipo más común para comunicación interna entre servicios. Ningún acceso externo es posible — solo pods dentro del clúster pueden acceder.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mi-app-service
spec:
  type: ClusterIP
  selector:
    app: mi-app
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
```

**NodePort**: Expone el Service en cada nodo del clúster en un puerto estático (rango 30000-32767). Kubernetes crea una regla en kube-proxy que redirige el tráfico desde el puerto del nodo al ClusterIP del Service. Útil para acceso externo desde fuera del clúster, aunque no es la mejor solución en producción.

```yaml
spec:
  type: NodePort
  ports:
    - port: 80
      targetPort: 8080
      nodePort: 30080
```

**LoadBalancer**: Usa la capacidad de balanceo de carga del proveedor de nube (AWS ELB, GCP Load Balancer, Azure Load Balancer) para exponer el Service. Crea automáticamente un Service de tipo NodePort y ClusterIP, y luego configura el balanceador de carga del proveedor para redirigir el tráfico al NodePort.

```yaml
spec:
  type: LoadBalancer
  ports:
    - port: 80
      targetPort: 8080
```

**ExternalName**: Mapea un Service a un DNS name externo (usando un registro CNAME). No usa selector ni crea proxy — solo retorna el valor de `externalName` como respuesta a cualquier consulta DNS.

```yaml
spec:
  type: ExternalName
  externalName: my.database.example.com
```

### 4.2 Cómo funcionan los Services internamente

Cuando creas un Service, ocurren varias cosas:

1. **El API Server asigna una ClusterIP** (una IP virtual del pool de IPs del clúster)
2. **kube-proxy crea reglas de iptables/ipvs** que redirigen el tráfico a la ClusterIP hacia las IPs de los pods seleccionados
3. **CoreDNS crea un registro DNS** para el Service en el formato `<service-name>.<namespace>.svc.cluster.local`

Los pods pueden acceder a otros Services usando el nombre DNS del Service:

```bash
# Desde dentro de un pod, acceder a mi-app-service:
curl http://mi-app-service.default.svc.cluster.local:80/api/health
# O simplemente (si está en el mismo namespace):
curl http://mi-app-service:80/api/health
```

> [!info] ¿Cómo kube-proxy balancea el tráfico?
> Por defecto, kube-proxy usa iptables para crear reglas de balanceo de carga que distribuyen el tráfico entre los pods de manera aleatoria (round-robin). En clusters grandes, se recomienda usar ipvs en lugar de iptables porque ipvs tiene mejor rendimiento y soporte para algoritmos de balanceo más sofisticados (least connections, weighted round-robin, etc.).

### 4.3 Endpoints

Un Endpoint es un objeto que Kubernetes crea automáticamente para vincular un Service con los Pods que selecciona. Cuando un pod correspondiente al selector de un Service cambia (se crea, se elimina, o sus IPs cambian), el objeto Endpoint se actualiza automáticamente.

Puedes inspeccionar los Endpoints de un Service con:

```bash
kubectl get endpoints mi-app-service
# Output:
# NAME               ENDPOINTS                                         AGE
# mi-app-service     10.244.0.5:8080,10.244.0.6:8080,10.244.0.7:8080   5d
```

Cada endpoint es una IP:port de un pod específico. Cuando un pod se cae, su IP se elimina automáticamente de la lista de endpoints, y kube-proxy deja de enviarle tráfico. Cuando un pod nuevo se crea, su IP se añade.

> [!tip] Ready vs Unready endpoints
> Kubernetes separa los endpoints en "Ready" y "Unready". Solo los pods cuyo readiness probe ha pasado están en la lista de endpoints Ready. Los pods con readiness probe fallando están en "Unready" y no reciben tráfico nuevo — pero existen en el clúster. Puedes ver esto con:
> ```bash
> kubectl get endpoints mi-app-service -o yaml
> ```

---

## 5. Namespaces: Aislamiento lógico

Los namespaces permiten dividir un clúster de Kubernetes en múltiples entornos virtuales. Son útiles cuando múltiples equipos o proyectos comparten el mismo clúster, o cuando necesitas separar entornos (desarrollo, staging, producción) dentro del mismo clúster.

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: produccion
  labels:
    environment: production
```

```bash
# Crear un namespace
kubectl create namespace staging

# Crear un pod en un namespace específico
kubectl apply -f pod.yaml -n staging

# Ver recursos de un namespace
kubectl get pods -n produccion

# Crear recursos en un namespace por defecto
kubectl config set-context --current --namespace=staging
```

> [!warning] Namespaces no son sandbox de seguridad
> Los namespaces proporcionan un alcance para los nombres de recursos (dos pods pueden tener el mismo nombre si están en namespaces diferentes), pero NO proporcionan aislamiento de red ni de seguridad. Si no configuras NetworkPolicies, un pod en un namespace puede comunicarse con un pod en otro namespace. Para aislamiento de red entre namespaces, necesitas usar NetworkPolicies.

> [!info] Namespaces por defecto
> Kubernetes crea tres namespaces por defecto:
> - `default`: Para recursos que no se asignan a ningún otro namespace
> - `kube-system`: Para recursos creados por el sistema (coredns, kube-proxy, etc.)
> - `kube-public`: Para recursos que deben ser legibles por todos los usuarios (públicos)

---

## 6. ConfigMaps y Secrets

Los ConfigMaps y Secrets son objetos de Kubernetes que permiten desacoplar la configuración de los contenedores. En lugar de hardcodear configuraciones dentro de la imagen del contenedor, las almacenas como objetos de Kubernetes y las inyectas en los pods.

### 6.1 ConfigMaps

Un ConfigMap almacena configuración no sensible como pares clave-valor:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mi-app-config
data:
  database_url: "postgresql://db:5432/myapp"
  log_level: "info"
  max_connections: "100"
  feature_flags: |
    enable_new_ui: true
    enable_beta_api: false
```

Se pueden inyectar en los pods como variables de entorno o como archivos montados:

```yaml
# Como variables de entorno
env:
  - name: DATABASE_URL
    valueFrom:
      configMapKeyRef:
        name: mi-app-config
        key: database_url
  - name: LOG_LEVEL
    valueFrom:
      configMapKeyRef:
        name: mi-app-config
        key: log_level

# Como archivo montado
volumeMounts:
  - name: config-volume
    mountPath: /etc/config
volumes:
  - name: config-volume
    configMap:
      name: mi-app-config
```

### 6.2 Secrets

Un Secret es similar a un ConfigMap pero está diseñado para almacenar información sensible (contraseñas, tokens, claves SSH). Los Secrets se almacenan en etcd y deberían estar cifrados en reposo.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: mi-app-secrets
type: Opaque
data:
  database-password: cGFzc3dvcmQxMjM=  # base64 encoded
  api-key: c2VjcmV0LWtleS14eHh4  # base64 encoded
```

> [!warning] Secrets y cifrado
> Los secrets por defecto están solo codificados en base64 en etcd, NO cifrados. Para cifrar secrets en reposo, necesitas habilitar el EncryptionConfiguration en Kubernetes, que cifrará los secrets en etcd usando AES-CBC o AES-GCM. Sin esta configuración, cualquiera con acceso a etcd puede leer tus secrets.

---

## 7. Ingress: Control de acceso HTTP/HTTPS

Mientras que un Service expone los pods a la red interna, un Ingress expone los servicios internos de Kubernetes al tráfico HTTP/HTTPS externo. Un Ingress es un objeto que configura un balanceador de carga HTTP (generalmente un proxy inverso como Nginx o Traefik) que gestiona las rutas del tráfico.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mi-app-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - mi-app.example.com
      secretName: mi-app-tls-secret
  rules:
    - host: mi-app.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: mi-app-service
                port:
                  number: 80
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: mi-app-api-service
                port:
                  number: 8080
```

> [!info] Ingress vs LoadBalancer
> Un Ingress no es un tipo de Service — es un recurso independiente que configura un balanceador de carga HTTP en capa 7. Necesitas un Ingress Controller (como Nginx Ingress Controller, Traefik, o HAProxy) instalado en el clúster para que los objetos Ingress funcionen. Sin un Ingress Controller, los objetos Ingress son ignorados.

> [!tip] TLS/SSL
> Un Ingress puede gestionar terminaciones TLS. Usas un `IngressTLS` y un `Secret` que contiene el certificado y la clave privada. El Ingress Controller maneja el handshake TLS y reenvía el tráfico HTTP sin cifrar al backend.

---

## 8. StatefulSets: Aplicaciones con estado

Mientras que los Deployments son ideales para aplicaciones stateless (sin estado), los StatefulSets están diseñados para aplicaciones que necesitan estado: bases de datos, caches distribuidos, sistemas de mensajería, etc.

Diferencias clave entre Deployments y StatefulSets:

| Característica | Deployment | StatefulSet |
|---------------|-----------|-------------|
| Nombres de pods | Aleatorios (`app-xyz123`) | Estables y predecibles (`app-0`, `app-1`) |
| Orden de creación | Paralelo | Secuencial (0, 1, 2...) |
| Orden de escalado | Paralelo | Secuencial (al revés: 2, 1, 0) |
| Networking | IPs volátiles | DNS estable (`app-0.default.svc.cluster.local`) |
| Storage | Opcional, compartido | Volumes persistentes vinculados a cada replica |

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: database
spec:
  serviceName: "database"
  replicas: 3
  selector:
    matchLabels:
      app: database
  template:
    metadata:
      labels:
        app: database
    spec:
      containers:
        - name: postgres
          image: postgres:15
          ports:
            - containerPort: 5432
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 10Gi
```

Cada réplica de un StatefulSet obtiene su propio PersistentVolumeClaim basado en el `volumeClaimTemplate`. Esto garantiza que cada réplica tenga su propio almacenamiento persistente que sobrevive a reinicios y reprogramaciones.

---

## 9. DaemonSets y Jobs

**DaemonSets**: Garantizan que una copia de un pod se ejecute en todos (o algunos) los nodos del clúster. Son ideales para:

- Agentes de logging (Fluentd, Filebeat)
- Monitores de nodos (Prometheus Node Exporter)
- Network plugins (Calico, Flannel)
- Storage daemons

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-monitor
spec:
  selector:
    matchLabels:
      app: node-monitor
  template:
    metadata:
      labels:
        app: node-monitor
    spec:
      containers:
        - name: monitor
          image: prom/node-exporter:latest
```

**Jobs**: Ejecutan pods hasta que un trabajo específico se completa con éxito. Son ideales para tareas batch:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: migration-job
spec:
  completions: 1
  template:
    spec:
      containers:
        - name: migration
          image: mi-app:migration-tool
          command: ["./run-migrations.sh"]
      restartPolicy: Never
```

**CronJobs**: Ejecutan Jobs de forma programada, similar a cron en Linux:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: daily-backup
spec:
  schedule: "0 2 * * *"  # A las 2:00 AM cada día
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: mi-app:backup-tool
              command: ["./backup.sh"]
          restartPolicy: OnFailure
```

---

## 10. Networking en el clúster

Cada pod recibe su propia IP única dentro del clúster. La política de networking de Kubernetes establece que:

1. Todos los pods pueden comunicarse entre sí sin NAT (Network Address Translation)
2. Todos los nodos pueden comunicarse con todos los pods sin NAT
3. La IP que un contenedor ve para sí mismo es la misma que la que ven los demás contenedores/pods

Este modelo requiere un **CNI (Container Network Interface)** plugin que proporcione la networking subyacente. Los plugins CNI más populares son:

- **Calico**: Usa BGP para routing entre nodos. Ofrece tanto networking como network policies. Muy popular en producción.
- **Flannel**: Más simple, usa VXLAN para tunneling entre nodos. Fácil de configurar, ideal para clusters pequeños.
- **Cilium**: Usa eBPF (Extended Berkeley Packet Filter) para networking y seguridad. Ofrece visibilidad profunda, load balancing, y network policies a nivel de kernel. Cada vez más popular.
- **Weave Net**: Usa overlay networking con encriptación automática.
- **Canal**: Combina Flannel para networking y Calico para network policies.

> [!info] ¿Qué es eBPF?
> eBPF es un framework que permite ejecutar programas en el kernel de Linux de forma segura y eficiente. Cilium usa eBPF para realizar routing, load balancing, network policies, y observabilidad directamente en el kernel, sin necesidad de iptables. Esto resulta en un rendimiento significativamente mejor y visibilidad más profunda.

---

## 11. Health Checks y Self-Healing

Kubernetes tiene un sistema de auto-reparación integrado que se basa en los health checks que defines:

1. **Liveness probe falla** → Kubernetes mata el contenedor y lo reinicia. Si falla N veces consecutivas (configurable via `failureThreshold`), el pod entra en estado CrashLoopBackOff y el controller puede escalonar los reintentos.

2. **Readiness probe falla** → El pod se elimina de los endpoints del Service pero NO se reinicia. Recibirá tráfico de nuevo cuando el readiness probe pase.

3. **El pod se cae** (no responde, se elimina) → El controller del Deployment/ReplicaSet detecta que el número de pods activos es inferior al deseado y crea uno nuevo.

4. **El nodo se cae** → El Node Controller detecta que el nodo no responde (después de un timeout configurable, por defecto 5 minutos) y marca el nodo como NotReady. Los pods en ese nodo se marcan como Fallen, y los controllers crean nuevos pods en otros nodos disponibles.

> [!warning] Drenaje de nodos
> Cuando necesitas hacer mantenimiento en un nodo (actualización del kernel, actualización de sistema, etc.), no debes simplemente apagarlo. Debes drenarlo primero:
> ```bash
> # Marcar el nodo como NoSchedule (no crear pods nuevos)
> kubectl cordon node-name
>
> # Eliminar los pods del nodo (con grace period)
> kubectl drain node-name --ignore-daemonsets --delete-emptydir-data
> ```
>
> Esto permite que los controllers de Kubernetes creen reemplazos de los pods eliminados en otros nodos antes de que el nodo quede fuera de servicio.

---

## 12. RBAC: Control de acceso basado en roles

RBAC (Role-Based Access Control) es el sistema de autorización integrado de Kubernetes. Permite definir quién puede hacer qué en el clúster.

```yaml
# Role: define permisos en un namespace específico
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: produccion
  name: app-reader
rules:
  - apiGroups: [""]
    resources: ["pods", "services", "configmaps"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list", "watch"]

# RoleBinding: asigna el Role a un User, Group, o ServiceAccount
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-apps-in-prod
  namespace: produccion
subjects:
  - kind: User
    name: dev-user
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: app-reader
  apiGroup: rbac.authorization.k8s.io
```

> [!info] ClusterRole vs Role
> Un **Role** aplica solo dentro de un namespace. Un **ClusterRole** aplica a nivel de clúster completo y puede gestionar recursos que no están namespaceados (como nodos, persistent volumes, etc.). Un **ClusterRoleBinding** asigna un ClusterRole a nivel de clúster, mientras que un **RoleBinding** lo hace dentro de un namespace.

---

## 13. Recursos Clave — Resumen Rápido

| Recurso | Propósito | Cuándo usar |
|---------|-----------|-------------|
| Pod | Unidad mínima de despliegue | Pruebas rápidas, debugging |
| Deployment | Gestión de réplicas stateless | Aplicaciones web, APIs, microservicios |
| StatefulSet | Gestión de pods con estado | Bases de datos, caches, sistemas distribuidos |
| DaemonSet | Un pod por nodo | Logging, monitoring, network plugins |
| Service | Estabilidad de red para pods | Comunicación interna y externa |
| Ingress | Routing HTTP/HTTPS externo | Exposición de aplicaciones web al internet |
| ConfigMap | Configuración no sensible | Variables de entorno, archivos de config |
| Secret | Información sensible | Contraseñas, tokens, claves TLS |
| Namespace | Aislamiento lógico | Multi-tenant, separar ambientes |
| PVC/PV | Almacenamiento persistente | Datos que sobreviven a reinicios de pods |
| HPA | Escalado automático | Aplicaciones con carga variable |

---

## 14. Kubernetes vs Docker Compose

Es fundamental entender cuándo usar cada herramienta:

**Docker Compose** es ideal cuando:
- Tienes 1-5 servicios que se ejecutan en una sola máquina
- Estás en desarrollo o staging local
- No necesitas escalado automático, rolling updates, ni auto-reparación
- Tu equipo es pequeño y el operativo es simple

**Kubernetes** se justifica cuando:
- Necesitas escalar horizontalmente a cientos o miles de instancias
- Tu infraestructura está distribuida en múltiples máquinas o cloud providers
- Necesitas actualizaciones sin downtime para aplicaciones críticas
- Necesitas auto-reparación automática y alta disponibilidad
- Múltiples equipos comparten la misma infraestructura
- Necesitas políticas de red细granulares, gestión de secretos, y RBAC

> [!warning] Complejidad vs Valor
> Kubernetes introduce una complejidad significativa en operación, debugging, y aprendizaje. Si tu aplicación cabe cómodamente en Docker Compose, no cambies a Kubernetes solo porque "es la tecnología de moda". El mejor sistema de orquestación es el que resuelve tus problemas reales sin introducir complejidad innecesaria.

---

## 15. Conceptos clave

1. **Kubernetes es una plataforma distribuida**: No es solo un scheduler de contenedores — es un sistema operativo completo para infraestructura cloud-native con API server, base de datos distribuida (etcd), controllers, y schedulers.

2. **Declarativo vs Imperativo**: En Kubernetes, declaras el estado deseado (qué quieres) y el sistema se encarga de hacer que el estado actual coincida con el deseado. No le dices "crea este pod, luego crea otro" — le dices "quiero 3 réplicas de esta aplicación" y Kubernetes lo gestiona.

3. **Los pods son efímeros**: Nunca debes depender de la IP de un pod o de que un pod específico permanezca disponible. Usa Services para acceder a grupos de pods, y Deployments/StatefulSets para gestionarlos.

4. **Las etiquetas (labels) son fundamentales**: Prácticamente todo en Kubernetes se selecciona y filtra por labels — Servicios seleccionan pods por labels, Deployments rastrean ReplicaSets por labels, NetworkPolicies aplican reglas por labels.

5. **Kubernetes no resuelve todo**: Solo orquesta contenedores que ya existen. No construye aplicaciones, no gestiona datos de forma inteligente, no balancea cargas de forma sofisticada sin ayuda de otras herramientas. Es un sistema de orquestación — necesitas complementar con Helm, operators, service meshes, y otras herramientas para una experiencia completa.

---

## Relacionado con

- [[01-Docker-Fundamentos-Arquitectura-Aislamiento-Capas]] — Docker es el runtime de contenedores subyacente en Kubernetes
- [[02-Docker-Networking-Redes-Bridge-Host-Overlay-Mas]] — Los conceptos de networking de Docker se extienden y abstraeen en Kubernetes
- [[03-Docker-Volumes-Storage]] — Los volumes de Docker se abstraeen en Kubernetes con PVs, PVCs, y StorageClasses
- [[04-Docker-Compose-Orquestacion-Local]] — Docker Compose es para orquestación local; Kubernetes es para producción a escala
- [[06-CICD-Pipelines]] — Las pipelines CI/CD despliegan las aplicaciones orquestadas por Kubernetes
- [[07-Monitoring]] — Prometheus y Grafana monitorean tanto pods como clústeres de Kubernetes
- [[Módulo 6: Sistemas Distribuidos]] — Kubernetes implementa muchos patrones de sistemas distribuidos (consensus con Raft, service discovery, load balancing)

## Referencias

- [Documentación oficial de Kubernetes](https://kubernetes.io/docs/)
- [Kubernetes Concepts](https://kubernetes.io/docs/concepts/)
- [Kubernetes Networking Documentation](https://kubernetes.io/docs/concepts/cluster-administration/networking/)
- [Kubernetes Architecture](https://kubernetes.io/docs/concepts/architecture/)
- [Container Runtime Interface (CRI)](https://kubernetes.io/docs/concepts/extend-kubernetes/compute-storage-net/device-plugins/)
- [CNI Plugins](https://kubernetes.io/docs/concepts/extend-kubernetes/compute-storage-net/network-plugins/)
