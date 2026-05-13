# 06 CI/CD Pipelines — Automatización del ciclo de vida del software

> [!info] Contexto del módulo
> Este artículo es parte del **Módulo 02: Infraestructura y Contenedores**. Se conecta con [[01-Docker-Fundamentos-Arquitectura-Aislamiento-Capas]], [[04-Docker-Compose-Orquestacion-Local]], [[05-Kubernetes-Fundamentals-Arquitectura-Pods-Services-Deployments]], [[07-Monitoring]] y con el [[Módulo 3: Programación y Software Engineering]].

## Introducción: ¿Qué es CI/CD y por qué importa?

Antes de la automatización, el despliegue de software era un proceso manual que involucraba copiar archivos, ejecutar scripts de base de datos, reiniciar servicios y rezar. Los errores humanos eran inevitables: alguien olvidaba reiniciar un servicio, alguien usaba la versión equivocada de una dependencia, o alguien deployeaba código de staging en producción.

CI/CD (Continuous Integration / Continuous Delivery/Deployment) es la práctica de automatizar todo el proceso desde que un desarrollador escribe código hasta que ese código está en producción. No es una herramienta específica — es un conjunto de prácticas y principios que eliminan el trabajo manual y los errores humanos del ciclo de despliegue.

**Continuous Integration (CI)**: Cada vez que un desarrollador hace push a su rama de código, se ejecuta automáticamente una serie de pasos: se compila el código, se ejecutan tests unitarios, se ejecutan tests de integración, se analiza la calidad del código, y se construye una imagen de contenedor. El objetivo es detectar errores lo antes posible — idealmente, minutos después de que se introducen.

**Continuous Delivery**: Extiende CI añadiendo la automatización del despliegue a entornos de staging y producción. El código que pasa todas las etapas de CI se despliega automáticamente a producción, pero con un paso humano de aprobación antes del último paso. Esto garantiza que el software esté siempre en un estado desplegable.

**Continuous Deployment**: Extiende Continuous Delivery eliminando el paso de aprobación humana. Todo el código que pasa las pruebas en CI se despliega automáticamente a producción. Esto requiere un nivel muy alto de confianza en las pruebas y la monitorización.

> [!warning] CI ≠ CD
> Muchos equipos confunden CI con CD. Son conceptos relacionados pero distintos:
> - **CI** se centra en la integración temprana y la detección de errores
> - **CD (Delivery)** se centra en la capacidad de desplegar en cualquier momento
> - **CD (Deployment)** se centra en el despliegue automático a producción
>
> Puedes tener CI sin CD (integración continua sin despliegue automático), pero no tiene mucho sentido tener CD sin CI.

---

## 1. Los principios fundamentales de CI/CD

Antes de entrar en herramientas específicas, es esencial entender los principios que hacen que CI/CD funcione:

### 1.1 La fuente de verdad es el repositorio de código

Todo el proceso de construcción y despliegue debe estar definido como código en el repositorio. No hay scripts de CI/CD guardados en una interfaz web o en servidores de CI/CD externos. El archivo de configuración de la pipeline (`.github/workflows/ci.yml`, `.gitlab-ci.yml`, etc.) es parte del código y se versiona junto con él.

Esto significa que:
- Cualquier persona puede entender cómo se construye y despliega la aplicación mirando el repositorio
- Los cambios en la pipeline se revisan con pull requests como cualquier otro cambio de código
- La pipeline evoluciona junto con el código que construye

### 1.2 Cada commit debe ser desplegable

El objetivo de CI/CD es que cualquier commit en la rama principal (main/master) pueda ser desplegado a producción en cualquier momento. Esto no significa que cada commit se despliegue automáticamente, sino que el sistema está diseñado para que si decides desplegar en cualquier momento, funcione.

Para lograr esto, cada commit debe:
- Compilar sin errores
- Pasar todos los tests automatizados
- Construir sin errores
- Desplegarse sin errores en entornos de prueba

Si algún paso falla, la pipeline se detiene y el commit no avanza. Esto previene que código defectuoso llegue a producción.

### 1.3 Feedback rápido

Las pipelines de CI deben ejecutarse rápidamente — idealmente en menos de 10 minutos para la fase de build y test. Si una pipeline tarda 30 minutos, los desarrolladores no querrán ejecutarla localmente y esperarán a hacer push para saber si su código funciona. Esto rompe el ciclo de feedback rápido que es el corazón de CI.

> [!tip] Estrategias para pipelines rápidas
> - **Tests en paralelo**: Ejecutar tests unitarios en múltiples jobs simultáneos
> - **Cache de dependencias**: Cachear node_modules, pip packages, Maven dependencies
> - **Tests incrementales**: Solo ejecutar tests relacionados con los archivos cambiados
> - **Linting rápido primero**: Ejecutar linters antes de tests pesados
> - **Build incremental**: Solo reconstruir lo que ha cambiado

### 1.4 Automatización total

Cada paso del proceso — desde la construcción hasta el despliegue — debe ser automatizado. Si un paso requiere intervención humana (copiar archivos, ejecutar un script manualmente, hacer click en un botón), ese paso debe automatizarse.

La única intervención humana permitida en CI/CD es la aprobación para producción (en Continuous Delivery) o la revisión de código (en pull requests). Todo lo demás debe ser automático.

---

## 2. Estructura típica de una pipeline CI/CD

Una pipeline CI/CD estándar tiene las siguientes fases, ejecutadas secuencialmente o en paralelo según corresponda:

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Checkout   │───>│   Build/     │───>│   Test/      │───>│   Deploy     │
│   Code       │    │   Compile    │    │   Analyze    │    │   & Release  │
└─────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
     │                   │                   │                   │
     ▼                   ▼                   ▼                   ▼
  Git clone         Compilar,            Lint,              Build Docker
  repositorio       resolver deps        tests unitarios     images, push
                    a registry
```

### 2.1 Checkout

La primera fase descarga el código del repositorio. En CI/CD moderno, esto incluye:
- Clonar el repositorio completo o un shallow clone (solo el commit actual)
- Obtener los tags y branches necesarios
- Configurar las credenciales de acceso

### 2.2 Build / Compile

En esta fase se prepara el código para pruebas y despliegue:
- Instalar dependencias (npm install, pip install, go mod download, etc.)
- Compilar el código (TypeScript a JavaScript, Go a binario, Java a JAR, etc.)
- Construir imágenes de contenedor
- Generar artefactos de build (archivos .jar, .war, binarios, bundles)

### 2.3 Test / Analyze

Esta fase valida la calidad del código:
- **Tests unitarios**: Prueban funciones y clases individuales
- **Tests de integración**: Prueban la interacción entre componentes
- **Tests e2e (end-to-end)**: Prueban flujos completos desde la perspectiva del usuario
- **Linting**: Verifican estilo y calidad de código (ESLint, Pylint, golangci-lint)
- **Análisis de seguridad**: Detectan vulnerabilidades en dependencias (npm audit, Snyk, Trivy)
- **Análisis de cobertura**: Miden qué porcentaje del código está cubierto por tests

### 2.4 Deploy & Release

La fase final despliega los artefactos:
- Push de imágenes de contenedor a un registry (Docker Hub, ECR, GCR, ACR)
- Despliegue a entornos de staging
- Despliegue a producción (con o sin aprobación humana)
- Verificación post-despliegue (smoke tests)
- Notificación de éxito o fallo

---

## 3. GitHub Actions: Automatización nativa de GitHub

GitHub Actions es el sistema de CI/CD integrado de GitHub. Se define en archivos YAML dentro de `.github/workflows/` y se ejecuta en runners proporcionados por GitHub (o self-hosted).

### 3.1 Conceptos fundamentales de GitHub Actions

**Workflow**: Una ejecución automatizada definida en un archivo YAML. Un workflow contiene uno o más jobs y se activa por eventos del repositorio.

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
```

**Event trigger**: Lo que inicia un workflow. Los triggers más comunes son:
- `push`: Cuando se hace push a una rama
- `pull_request`: Cuando se abre o actualiza un PR
- `workflow_dispatch`: Trigger manual desde la UI de GitHub
- `schedule`: Ejecución programada (cron)
- `release`: Cuando se crea un release

**Job**: Un conjunto de pasos que se ejecutan en el mismo runner. Los jobs dentro de un workflow se ejecutan en paralelo por defecto (a menos que se especifique `needs`).

**Step**: Una tarea individual dentro de un job. Puede ser un comando shell o un action predefinido.

**Action**: Una unidad reutilizable de código que puedes usar en tus workflows. Los actions pueden ser públicos (del marketplace de GitHub) o privados (definidos en tu repositorio).

**Runner**: La máquina (GitHub-hosted o self-hosted) que ejecuta los jobs. GitHub proporciona runners con Ubuntu, Windows y macOS.

### 3.2 Pipeline completa con GitHub Actions

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # === JOB 1: Lint y Test Unitarios ===
  lint-and-test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint code
        run: npm run lint

      - name: Run unit tests
        run: npm test
        env:
          CI: true

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results-node-${{ matrix.node-version }}
          path: coverage/

  # === JOB 2: Build y Test de Integración ===
  build-and-integration-test:
    needs: lint-and-test
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: testdb
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run database migrations
        run: npm run migrate
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/testdb

      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/testdb
          REDIS_URL: redis://localhost:6379

      - name: Build Docker image
        run: docker build -t ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} .

      - name: Run security scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          format: 'sarif'
          output: 'trivy-results.sarif'

  # === JOB 3: Deploy a Staging ===
  deploy-staging:
    needs: build-and-integration-test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    environment: staging

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Login to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Deploy to staging
        run: |
          echo "Deploying to staging environment..."
          # Usar kubectl para desplegar a staging
          kubectl set image deployment/myapp \
            myapp=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} \
            --namespace=staging
        env:
          KUBE_CONFIG: ${{ secrets.KUBE_CONFIG_STAGING }}

      - name: Run smoke tests
        run: |
          echo "Running smoke tests against staging..."
          # Scripts de verificación post-deploy
          curl -f https://staging.example.com/health || exit 1

  # === JOB 4: Deploy a Producción (con aprobación manual) ===
  deploy-production:
    needs: deploy-staging
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://production.example.com

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Login to GitHub Container Registry
        uses: actions/checkout@v4
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Deploy to production
        run: |
          echo "Deploying to production environment..."
          kubectl set image deployment/myapp \
            myapp=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} \
            --namespace=production
        env:
          KUBE_CONFIG: ${{ secrets.KUBE_CONFIG_PRODUCTION }}

      - name: Verify production deployment
        run: |
          echo "Verifying production deployment..."
          # Verificar que el rollout se completó
          kubectl rollout status deployment/myapp --namespace=production --timeout=300s
          # Smoke tests en producción
          curl -f https://production.example.com/health || exit 1

      - name: Notify success
        if: success()
        run: echo "Deployment to production successful!"

      - name: Notify failure
        if: failure()
        run: echo "Deployment to production FAILED!"
```

### 3.3 Secrets y variables de entorno

GitHub Actions proporciona un sistema seguro para gestionar secretos:

```yaml
# En el workflow
env:
  DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
  API_KEY: ${{ secrets.API_KEY }}

# Las variables de entorno no sensibles se pueden definir directamente
env:
  NODE_ENV: production
  LOG_LEVEL: info
```

Los secretos se configuran en la configuración del repositorio (Settings → Secrets and variables → Actions) o a nivel de organización/entorno. Nunca deben aparecer en los logs del workflow.

> [!warning] Seguridad de secretos en CI/CD
> - Nunca hardcodees secretos en los archivos de workflow
> - Usa secrets de GitHub para credenciales sensibles
> - Configura entornos con protecciones (requerir aprobación, restricciones de branch)
> - Limita el scope de los secrets al mínimo necesario
> - Usa tokens de corta duración cuando sea posible (como GITHUB_TOKEN)

### 3.4 Caching y optimización de rendimiento

```yaml
- name: Cache node modules
  uses: actions/cache@v4
  with:
    path: |
      ~/.npm
      node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-

- name: Cache Docker layers
  uses: actions/cache@v4
  with:
    path: /tmp/.buildx-cache
    key: ${{ runner.os }}-buildx-${{ hashFiles('**/Dockerfile') }}
    restore-keys: |
      ${{ runner.os }}-buildx-
```

El caching es crítico para el rendimiento de las pipelines. Sin caching, cada ejecución descarga e instala todas las dependencias desde cero. Con caching, las dependencias se restauran desde caché, reduciendo el tiempo de build de minutos a segundos.

---

## 4. GitLab CI/CD: Integración nativa de GitLab

GitLab CI/CD es el sistema de CI/CD integrado de GitLab. Se define en un archivo `.gitlab-ci.yml` en la raíz del repositorio.

### 4.1 Conceptos fundamentales de GitLab CI

**Pipeline**: Una ejecución completa del archivo `.gitlab-ci.yml`. Una pipeline contiene múltiples stages.

**Stage**: Una fase de la pipeline (build, test, deploy). Todos los jobs dentro de un stage se ejecutan en paralelo. Los stages se ejecutan secuencialmente.

**Job**: Una unidad de trabajo dentro de un stage. Cada job ejecuta un conjunto de comandos en un runner.

**Runner**: La máquina que ejecuta los jobs. GitLab proporciona runners compartidos (gratuitos) o puedes configurar runners self-hosted.

**Artifact**: Archivos generados por un job (build outputs, test reports, coverage reports) que se pueden pasar a jobs posteriores o descargar.

### 4.2 Pipeline completa con GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - lint
  - test
  - build
  - deploy-staging
  - deploy-production

variables:
  DOCKER_IMAGE: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
  DOCKER_DRIVER: overlay2

# === STAGE 1: Lint ===
lint:
  stage: lint
  image: node:20-alpine
  cache:
    key:
      files:
        - package-lock.json
    paths:
      - node_modules/
  script:
    - npm ci
    - npm run lint
    - npm run type-check
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
    - if: '$CI_COMMIT_BRANCH == "main"'

# === STAGE 2: Test ===
unit-tests:
  stage: test
  image: node:20-alpine
  cache:
    key:
      files:
        - package-lock.json
    paths:
      - node_modules/
  services:
    - name: postgres:15
      alias: postgres
    - name: redis:7
      alias: redis
  variables:
    DATABASE_URL: postgresql://postgres:postgres@postgres:5432/test
    REDIS_URL: redis://redis:6379
  script:
    - npm ci
    - npm test -- --coverage
  artifacts:
    reports:
      junit: test-results/junit.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
    paths:
      - coverage/
  coverage: '/Lines\s*:\s*(\d+\.?\d*)%/'

integration-tests:
  stage: test
  image: node:20-alpine
  needs:
    - job: unit-tests
      artifacts: true
  services:
    - name: postgres:15
      alias: postgres
    - name: redis:7
      alias: redis
  variables:
    DATABASE_URL: postgresql://postgres:postgres@postgres:5432/test
    REDIS_URL: redis://redis:6379
  script:
    - npm ci
    - npm run test:integration
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'

# === STAGE 3: Build ===
build-docker:
  stage: build
  image:
    name: gcr.io/kaniko-project/executor:debug
    entrypoint: [""]
  script:
    - /kaniko/executor
      --context "${CI_PROJECT_DIR}"
      --dockerfile "${CI_PROJECT_DIR}/Dockerfile"
      --destination "${DOCKER_IMAGE}"
      --cache=true
      --cache-repo="${CI_REGISTRY_IMAGE}/cache"
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'

# === STAGE 4: Deploy Staging ===
deploy-staging:
  stage: deploy-staging
  image: bitnami/kubectl:latest
  script:
    - kubectl set image deployment/myapp myapp=${DOCKER_IMAGE} --namespace=staging
    - kubectl rollout status deployment/myapp --namespace=staging --timeout=300s
  environment:
    name: staging
    url: https://staging.example.com
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'

# === STAGE 5: Deploy Production ===
deploy-production:
  stage: deploy-production
  image: bitnami/kubectl:latest
  script:
    - kubectl set image deployment/myapp myapp=${DOCKER_IMAGE} --namespace=production
    - kubectl rollout status deployment/myapp --namespace=production --timeout=300s
  environment:
    name: production
    url: https://production.example.com
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'
      when: manual
```

### 4.3 Diferencias clave entre GitHub Actions y GitLab CI

| Característica | GitHub Actions | GitLab CI/CD |
|---------------|---------------|---------------|
| Definición | Archivos en `.github/workflows/` | Archivo `.gitlab-ci.yml` en raíz |
| Modelo de ejecución | Jobs → Steps | Stages → Jobs |
| Parallelismo | Dentro de un job (matrix) | Dentro de un stage |
| Services | `services:` en job | `services:` en job |
| Artifacts | `actions/upload-artifact` | `artifacts:` en job |
| Environments | `environment:` con approval | `environment:` con approval |
| Runners | GitHub-hosted o self-hosted | GitLab-shared o self-hosted |
| Docker build | `docker build` o kaniko | kaniko (nativo) o Docker-in-Docker |
| Coste | 2000 min/mes gratis (public) | 400 min/mes gratis (shared runners) |

> [!tip] Elegir entre GitHub Actions y GitLab CI
> - Si tu código ya está en GitHub, GitHub Actions es la opción más natural — no necesitas configurar runners ni registries adicionales (GitHub Container Registry está integrado).
> - Si usas GitLab, GitLab CI/CD está más integrado con el resto de la plataforma (CI/CD variables, environments, runners compartidos).
> - Ambas herramientas son capaces y maduras. La elección debería basarse en dónde está tu código y qué ecosistema prefieres.

---

## 5. Patrones avanzados de CI/CD

### 5.1 Multi-stage Builds en Docker

Las multi-stage builds reducen el tamaño de las imágenes de producción eliminando las herramientas de build:

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

La imagen final solo contiene lo necesario para ejecutar la aplicación, no las herramientas de compilación ni las dependencias de desarrollo. Una imagen de producción típica puede reducirse de 1.5GB a 200MB.

### 5.2 Trivy: Escaneo de vulnerabilidades

Trivy es un escáner de seguridad de código abierto que analiza imágenes de contenedor, repositorios de código, y configuraciones IaC:

```yaml
# En GitHub Actions
- name: Security scan with Trivy
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
    format: 'table'
    exit-code: '1'
    severity: 'CRITICAL,HIGH'
```

Trivy detecta:
- Vulnerabilidades en paquetes del sistema operativo (Alpine, Debian)
- Vulnerabilidades en dependencias de aplicaciones (npm, pip, Maven, Go)
- Secrets expuestos en las capas de la imagen
- Configuraciones inseguras (Dockerfile best practices)

### 5.3 Blue-Green Deployments

Un patrón de despliegue donde tienes dos entornos idénticos: blue (activo) y green (inactivo). El tráfico se dirige a blue mientras green se actualiza. Cuando green está listo, se cambia el balanceador de carga de blue a green. Si algo sale mal, se vuelve a cambiar a blue instantáneamente.

```yaml
# Ejemplo conceptual de blue-green con kubectl
- name: Deploy green (nueva versión)
  run: |
    kubectl set image deployment/myapp myapp=${NEW_IMAGE} --namespace=production

- name: Verify green is healthy
  run: |
    # Esperar a que los pods nuevos estén listos
    kubectl rollout status deployment/myapp --namespace=production --timeout=300s
    # Verificar health endpoint
    curl -f https://production.example.com/health || exit 1

- name: Switch traffic to green
  run: |
    # Actualizar el Service para apuntar a las nuevas pods
    kubectl apply -f service-green.yaml

- name: Monitor green for errors
  run: |
    # Monitorear errores durante 10 minutos
    sleep 600
    # Si hay errores, rollback
    kubectl apply -f service-blue.yaml
```

### 5.4 Canary Deployments

Un canary deployment despliega la nueva versión a un subconjunto pequeño de usuarios (5%, 10%) y monitorea las métricas antes de hacer el rollout completo. Si las métricas son buenas, se escala gradualmente hasta el 100%.

```yaml
# Fase 1: Desplegar canary (5% del tráfico)
kubectl set image deployment/myapp myapp=${NEW_IMAGE}
kubectl scale deployment/myapp --replicas=10
# 1 pod nuevo, 9 viejos = ~10% canary

# Fase 2: Monitorear métricas
# Si error rate < 0.1%, latency p99 < 200ms, etc.
# Avanzar a 50%
kubectl scale deployment/myapp --replicas=20
# 10 pods nuevos, 10 viejos = 50%

# Fase 3: Rollout completo
kubectl scale deployment/myapp --replicas=20
# 20 pods nuevos = 100%
```

### 5.5 Database Migrations en CI/CD

Las migraciones de base de datos son uno de los puntos más delicados en CI/CD. Las reglas fundamentales:

1. **Las migraciones deben ser backward-compatible**: El código nuevo debe funcionar tanto con la base de datos vieja como con la nueva.
2. **Las migraciones deben ser reversibles**: Siempre debes poder rollback si algo sale mal.
3. **Las migraciones deben ejecutarse antes del deploy del nuevo código** (o después, dependiendo del patrón).

Patrón seguro para migraciones:

```
1. Deploy código nuevo (que soporta schema viejo Y nuevo)
2. Ejecutar migración de base de datos
3. El código nuevo ya usa el nuevo schema
```

O el patrón opuesto (más seguro para cambios breaking):

```
1. Ejecutar migración de base de datos (schema se expande, no se rompe)
2. Deploy código nuevo (que usa el nuevo schema)
```

> [!warning] Nunca hagas esto
> - Nunca elimines una columna que el código antiguo aún usa
> - Nunca cambies el tipo de datos de una columna que el código antiguo lee
> - Nunca ejecutes una migración que toma horas durante un deploy en producción
> - Nunca ejecutes migraciones sin rollback plan

---

## 6. Infraestructura como Código (IaC) en CI/CD

La infraestructura también debe ser versionada y probada en la pipeline:

### 6.1 Terraform en CI/CD

```yaml
terraform-plan:
  stage: plan
  image: hashicorp/terraform:latest
  script:
    - terraform init
    - terraform plan -out=tfplan
  artifacts:
    paths:
      - tfplan

terraform-apply:
  stage: apply
  image: hashicorp/terraform:latest
  needs: [terraform-plan]
  script:
    - terraform init
    - terraform apply -auto-approve tfplan
  when: manual
  environment:
    name: production
```

### 6.2 Helm en CI/CD

Helm es el gestor de paquetes de Kubernetes. Las charts de Helm se pueden versionar, testear y desplegar desde la pipeline:

```yaml
helm-deploy:
  stage: deploy
  image: bitnami/kubectl:latest
  script:
    - helm repo add stable https://charts.helm.sh/stable
    - helm repo update
    - helm upgrade --install myapp ./helm/myapp \
        --namespace=production \
        --set image.tag=${CI_COMMIT_SHA} \
        --set image.repository=${CI_REGISTRY_IMAGE} \
        --wait --timeout 300s
```

---

## 7. Best Practices de CI/CD

### 7.1 Principio de la pipeline rápida

> "Si tu pipeline tarda más de 10 minutos, estás perdiendo productividad."

- Mantén los tests unitarios rápidos (< 5 min)
- Ejecuta los tests de integración solo en la rama main o en MRs
- Usa tests e2e solo en staging, no en cada commit
- Cachea dependencias agresivamente
- Ejecuta jobs en paralelo cuando sea posible

### 7.2 Principio de la pipeline verde

> "La pipeline debe ser siempre verde en main."

- Si la pipeline falla en main, se detiene el deploy
- Se notifica inmediatamente al equipo
- Se asigna prioridad alta para arreglarlo
- No se permite merge de PRs si la pipeline falla

### 7.3 Principio de la pipeline immutable

> "Cada build debe ser immutable."

- Una vez construida, una imagen de contenedor nunca se modifica
- Cada build recibe un tag único (SHA del commit, timestamp)
- Si necesitas "rebuild", es un nuevo build con un nuevo tag
- Esto garantiza que lo que probaste en staging es exactamente lo que se despliega en producción

### 7.4 Principio de la pipeline observable

> "Si no puedes ver qué está pasando en tu pipeline, no puedes confiar en ella."

- Logs detallados de cada paso
- Reportes de cobertura y calidad del código
- Notificaciones (Slack, email, PagerDuty) para fallos
- Dashboards de métricas de pipeline (tiempo de ejecución, tasa de éxito, flaky tests)

### 7.5 Principio de la pipeline segura

> "La pipeline es un punto crítico de seguridad."

- Secrets nunca en logs ni en artefactos
- Escaneo de vulnerabilidades en cada build
- Firmado de imágenes de contenedor (Cosign, Notary)
- Verificación de integridad antes del deploy a producción
- Least privilege: cada job solo tiene acceso a lo que necesita

---

## 8. Testing en CI/CD

### 8.1 Pirámide de tests en CI

```
         /  E2E Tests  \        ← Pocos, lentos, caros
        /________________\
       /   Integration    \     ← Moderados, moderadamente lentos
      /____________________\
     /    Unit Tests       \    ← Muchos, rápidos, baratos
    /________________________\
```

- **Unit tests** (70%): Prueban funciones individuales. Rápidos (< 1ms cada uno). Se ejecutan en cada commit.
- **Integration tests** (20%): Prueban la interacción entre componentes. Moderadamente rápidos. Se ejecutan en cada PR y en main.
- **E2E tests** (10%): Prueban flujos completos desde la perspectiva del usuario. Lentos (segundos a minutos). Se ejecutan en staging y en main.

### 8.2 Flaky Tests

Los tests que fallan intermitentemente sin cambios en el código son uno de los mayores problemas en CI/CD. Un solo test flaky puede hacer que el equipo pierda confianza en toda la pipeline.

Estrategias para combatir flaky tests:
- **Identificarlos**: Monitorea la tasa de fallos intermitentes
- **Aislarlos**: Ejecútalos en un job separado con reintentos
- **Repararlos**: La única solución real es arreglar la causa raíz
- **Excluirlos temporalmente**: Si no se pueden arreglar, exclúyelos de la pipeline principal y asigna un owner para repararlos

> [!warning] El coste de los flaky tests
> Un test flaky que falla el 5% de las veces significa que en un equipo de 10 desarrolladores haciendo 10 commits al día, habrá ~5 fallos falsos al día. Cada fallo falso cuesta ~15 minutos de tiempo del equipo investigando. Eso son ~75 minutos perdidos al día, o ~6 horas a la semana, solo en investigar fallos falsos.

---

## 9. Conceptos clave

1. **CI/CD es un conjunto de prácticas, no una herramienta**: GitHub Actions, GitLab CI, Jenkins, CircleCI — todas pueden implementar CI/CD. Lo importante son las prácticas, no la herramienta.

2. **La pipeline es el contrato de calidad**: Si algo no está en la pipeline, no está garantizado que se haga. Si la pipeline dice "todos los tests deben pasar antes del merge", entonces eso es una garantía.

3. **Feedback rápido es el principio más importante**: La velocidad de la pipeline determina la velocidad de desarrollo. Una pipeline lenta es el cuello de botella más común en equipos de desarrollo.

4. **Immutable builds garantizan consistencia**: Una imagen construida en staging es exactamente la misma que se despliega en producción. No hay "funciona en mi máquina" porque la máquina es la misma (la imagen).

5. **La seguridad debe estar integrada, no añadida**: El escaneo de vulnerabilidades, la gestión de secrets, y la verificación de integridad deben ser parte de la pipeline, no pasos manuales posteriores.

---

## Relacionado con

- [[01-Docker-Fundamentos-Arquitectura-Aislamiento-Capas]] — Las imágenes de Docker son el artefacto principal que las pipelines CI/CD construyen y despliegan
- [[04-Docker-Compose-Orquestacion-Local]] — Docker Compose se usa en local; CI/CD despliega a entornos reales
- [[05-Kubernetes-Fundamentals-Arquitectura-Pods-Services-Deployments]] — Las pipelines CI/CD despliegan a Kubernetes usando kubectl y Helm
- [[07-Monitoring]] — Monitoring post-deploy es esencial para validar que el despliegue fue exitoso
- [[Módulo 3: Programación y Software Engineering]] — Testing, linting y debugging son las bases sobre las que se construye CI/CD

## Referencias

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitLab CI/CD Documentation](https://docs.gitlab.com/ee/ci/)
- [The Twelve-Factor App](https://12factor.net/) — Principios para aplicaciones modernas
- [Continuous Delivery: Deploy Safe Software Changes](https://continuousdelivery.com/) — Book by Jez Humble and David Farley
- [Docker Best Practices](https://docs.docker.com/build/building/best-practices/)
- [Kubernetes Deployment Strategies](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
