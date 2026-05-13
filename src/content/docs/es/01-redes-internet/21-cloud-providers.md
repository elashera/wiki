---
title: "Cloud providers: AWS, Azure y GCP"
description: "Comparación completa de los 3 principales cloud providers: AWS, Azure y GCP — servicios, pricing, IAM, networking, y cuándo elegir cada uno."
---

# Cloud providers: AWS, Azure y GCP

> [!tip] Cloud providers en una frase
> **AWS, Azure y GCP** son los tres principales proveedores de nube pública. Cada uno tiene cientos de servicios, diferentes fortalezas, y modelos de pricing distintos. Este artículo los compara en detalle.

## ¿Qué es un cloud provider?

Un **cloud provider** es una empresa que ofrece infraestructura y servicios de computación a través de Internet, bajo demanda (pay-as-you-go). En lugar de comprar servidores físicos, "alquilas" recursos en sus data centers.

### Los tres gigantes (Tier 1)

| Proveedor | Partes del mercado | Data centers | Regiones | Zonas de disponibilidad |
|-----------|-------------------|-------------|----------|------------------------|
| **AWS** | ~31% | 300+ | 36 | 114+ |
| **Azure** | ~25% | 600+ | 60+ | 180+ |
| **GCP** | ~11% | 50+ | 40+ | 120+ |

### Proveedores de cuarto nivel

| Proveedor | Partes del mercado | Especialidad |
|-----------|-------------------|-------------|
| **Oracle Cloud** | ~3% | Bases de datos, enterprise |
| **IBM Cloud** | ~1% | Enterprise, hybrid |
| **Alibaba Cloud** | ~5% | Asia-Pacific |
| **DigitalOcean** | ~2% | Developer-friendly, simple |
| **Hetzner** | ~1% | EU/US, price-performance |

## AWS (Amazon Web Services)

**El pionero** (lanzado en 2006), el más grande y más completo.

### Servicios principales

#### Compute

| Servicio | Descripción | Uso típico |
|----------|-------------|------------|
| **EC2** | Máquinas virtuales (instances) | Servers, APIs, apps |
| **Lambda** | Serverless functions | Microservicios, event-driven |
| **ECS / EKS** | Docker / Kubernetes containers | Container orchestration |
| **Elastic Beanstalk** | PaaS (Platform as a Service) | Deploy rápido de apps |
| **Bare Metal** | Servidores físicos dedicados | High performance, compliance |

#### Storage

| Servicio | Descripción | Uso típico |
|----------|-------------|------------|
| **S3** | Object storage | Archivos, backups, CDN origin |
| **EBS** | Block storage para EC2 | Discos duros virtuales |
| **EFS** | File storage (NFS) | Compartido entre EC2 |
| **Glacier** | Storage de frío (archive) | Backups a largo plazo |
| **Storage Gateway** | Conecta on-premise con S3 | Hybrid cloud |

#### Databases

| Servicio | Descripción | Uso típico |
|----------|-------------|------------|
| **RDS** | DB managed (PostgreSQL, MySQL, MariaDB, Oracle, SQL Server) | Relacional managed |
| **DynamoDB** | NoSQL (key-value, document) | High-scale, low-latency |
| **Aurora** | DB relacional compatible MySQL/PostgreSQL | Alta performance, auto-scaling |
| **Redshift** | Data warehouse | Analytics, BI |
| **DocumentDB** | NoSQL compatible MongoDB | Document database |
| **Neptune** | Graph database | Graph queries, recommendations |

#### Networking

| Servicio | Descripción | Uso típico |
|----------|-------------|------------|
| **VPC** | Red virtual privada | Aislar recursos |
| **CloudFront** | CDN global | Distribución de contenido |
| **Route 53** | DNS management | DNS, health checks, routing |
| **ELB** | Load balancer (ALB, NLB, GWLB) | Distribuir tráfico |
| **Direct Connect** | Conexión dedicada a AWS | On-premise → AWS |

#### IAM (Identity and Access Management)

```
IAM Hierarchy:
Root Account
├── IAM Users (personas)
├── IAM Groups (colecciones de users)
└── IAM Roles (permisos temporales)

Policies (JSON):
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::mi-bucket/*"
        }
    ]
}
```

### Pricing de AWS

| Servicio | Modelo de precio | Ejemplo |
|----------|----------------|---------|
| **EC2** | On-demand / Spot / Reserved / Savings Plans | t3.micro: $0.0104/hr |
| **S3** | Por GB almacenado + requests | $0.023/GB/month |
| **Lambda** | Por invocación + tiempo de ejecución | $0.20/million requests |
| **RDS** | Por instancia hora + IOPS | db.t3.micro: $0.017/hr |
| **CloudFront** | Por GB transferido + requests | $0.085/GB first 10TB |

### AWS Free Tier

| Servicio | Free |
|----------|------|
| **EC2** | 750 hrs/mes de t2.micro/t3.micro (12 meses) |
| **S3** | 5 GB (12 meses) |
| **Lambda** | 1 millón de requests/mes (12 meses) |
| **DynamoDB** | 25 GB (12 meses) |
| **RDS** | 750 hrs/mes de db.t2.micro (12 meses) |

### Ventajas y desventajas de AWS

| ✅ Ventajas | ❌ Desventajas |
|------------|---------------|
| Más servicios (200+) | Complejo, curva de aprendizaje alta |
| Mayor madurez y docs | Pricing puede ser confuso |
| Mayor comunidad y ecosystem | Los costos pueden escapar sin monitorizar |
| Mejor disponibilidad global | Más superficie de error (too many options) |

## Azure (Microsoft Azure)

**El favorito enterprise**, especialmente para empresas que usan Microsoft.

### Servicios principales

#### Compute

| Servicio | Descripción | Uso típico |
|----------|-------------|------------|
| **Virtual Machines** | Máquinas virtuales | Servers, APIs, apps |
| **App Service** | PaaS (web, API, mobile) | Deploy rápido de web apps |
| **Azure Functions** | Serverless functions | Event-driven, microservicios |
| **AKS** | Kubernetes managed | Container orchestration |
| **Azure Container Instances** | Containers sin orchestration | Micro-contenedores rápidos |

#### Storage

| Servicio | Descripción | Uso típico |
|----------|-------------|------------|
| **Blob Storage** | Object storage | Archivos, media, backups |
| **Azure Files** | File storage (SMB/NFS) | Compartido, file shares |
| **Disk Storage** | Block storage | Discos para VMs |
| **Archive Storage** | Cold storage | Backups a largo plazo |

#### Databases

| Servicio | Descripción | Uso típico |
|----------|-------------|------------|
| **SQL Database** | SQL Server managed | Relacional enterprise |
| **Cosmos DB** | NoSQL multi-model | Globally distributed |
| **PostgreSQL on Azure** | Azure Database for PostgreSQL | PostgreSQL managed |
| **MySQL on Azure** | Azure Database for MySQL | MySQL managed |
| **Redis Cache** | Managed Redis | Caching, session store |

#### Networking

| Servicio | Descripción | Uso típico |
|----------|-------------|------------|
| **VNet** | Red virtual | Aislar recursos |
| **Azure CDN** | CDN global | Distribución de contenido |
| **Azure DNS** | DNS management | DNS hosting |
| **Load Balancer** | Load balancer L4/L7 | Distribuir tráfico |
| **ExpressRoute** | Conexión dedicada a Azure | On-premise → Azure |

#### Identity

| Servicio | Descripción |
|----------|-------------|
| **Azure AD** | Identity management (successor de Active Directory) |
| **Entra ID** | Rebranding de Azure AD (cloud-first) |
| **Conditional Access** | Access policies based on context |
| **PIM** | Privileged Identity Management |

### Azure Pricing

| Servicio | Modelo de precio | Ejemplo |
|----------|----------------|---------|
| **VMs** | Standard / Spot / Low Priority / Reserved | B2s: $0.0384/hr |
| **Blob Storage** | Hot / Cool / Archive tiers | Hot: $0.018/GB/month |
| **Functions** | Consumption / Premium | $0.20/million executions |
| **AKS** | Control plane free, nodes by VM | b2s: $0.0384/hr |
| **SQL Database** | DTU / vCore models | Basic: $5/month |

### Ventajas y desventajas de Azure

| ✅ Ventajas | ❌ Desventajas |
|------------|---------------|
| Excelente integración con Microsoft | Menos servicios que AWS |
| Azure AD es el mejor identity | Pricing complejo |
| Excelente soporte enterprise | UI más confusa que AWS |
| Hybrid cloud (Azure Arc) | Latencia en regiones fuera de EU/US |

## GCP (Google Cloud Platform)

**El preferido para ML, AI y data analytics**. Tecnología de Google.

### Servicios principales

#### Compute

| Servicio | Descripción | Uso típico |
|----------|-------------|------------|
| **Compute Engine** | Máquinas virtuales (GCE) | Servers, APIs, apps |
| **Cloud Functions** | Serverless functions (v1 y v2) | Event-driven |
| **Cloud Run** | Containers serverless | Microservicios sin infra |
| **GKE** | Kubernetes managed | Container orchestration |
| **App Engine** | PaaS serverless | Apps serverless |

#### Storage

| Servicio | Descripción | Uso típico |
|----------|-------------|------------|
| **Cloud Storage** | Object storage | Archivos, backups, ML data |
| **Persistent Disk** | Block storage (SSD/HDD) | Discos para VMs |
| **Filestore** | NFS file storage | Compartido entre VMs |
| **Tape Gateway** | Virtual tape library | Archive, backup |

#### Databases

| Servicio | Descripción | Uso típico |
|----------|-------------|------------|
| **Cloud SQL** | MySQL, PostgreSQL, SQL Server | Relacional managed |
| **Spanner** | Relacional distributed global | Global scale, ACID |
| **Firestore** | NoSQL document (MongoDB-like) | Mobile/web apps |
| **Bigtable** | NoSQL wide-column | Time-series, IoT |
| **BigQuery** | Data warehouse serverless | Analytics, BI, ML |
| **Memorystore** | Redis / Memcached managed | Caching |
| **AlloyDB** | PostgreSQL compatible (managed) | Enterprise OLTP |

#### Networking

| Servicio | Descripción | Uso típico |
|----------|-------------|------------|
| **VPC** | Red virtual | Aislar recursos |
| **Cloud CDN** | CDN (basado en Cloud Front) | Distribución de contenido |
| **Cloud DNS** | DNS management | DNS hosting |
| **Load Balancing** | Global load balancer | Distribuir tráfico global |
| **Cloud Interconnect** | Conexión dedicada | On-premise → GCP |

#### AI / ML

| Servicio | Descripción |
|----------|-------------|
| **Vertex AI** | ML platform unificada |
| **AutoML** | ML sin escribir código |
| **AI Platform** | Training y deployment de modelos |
| **Natural Language API** | Análisis de texto |
| **Vision API** | Análisis de imágenes |
| **Speech-to-Text** | Transcripción |
| **Dialogflow** | Chatbots / conversational AI |

### GCP Pricing

| Servicio | Modelo de precio | Ejemplo |
|----------|----------------|---------|
| **Compute Engine** | On-demand / Preemptible / Committed | e2-micro: $0.01038/hr |
| **Cloud Storage** | Standard / Nearline / Coldline / Archive | Standard: $0.020/GB/month |
| **Cloud Functions** | Por invocación + memory-seconds | $0.40/million invocations |
| **Cloud Run** | Por request + memory-seconds | $0.40/million requests |
| **BigQuery** | Por TB scan / slot-seconds | $6.25/TB first TB/month |

### GCP Free Tier

| Servicio | Free |
|----------|------|
| **Compute Engine** | 1 e2-micro (no EU/UK) |
| **Cloud Storage** | 5 GB |
| **Cloud Functions** | 2 millones invocations/mes |
| **BigQuery** | 1 TB query/month |
| **Cloud Run** | 2 millones requests/mes |

### Ventajas y desventajas de GCP

| ✅ Ventajas | ❌ Desventajas |
|------------|---------------|
| Mejor para ML/AI y data | Menor market share |
| BigQuery es el mejor DW | Menos servicios que AWS/Azure |
| GKE es el mejor K8s | Comunidad más pequeña |
| Mejor networking global | Menos regiones que AWS |
| Precio competitivo | Menos enterprise features |

## Comparación directa

### Compute

| | AWS | Azure | GCP |
|--|-----|-------|-----|
| **VMs** | EC2 | Virtual Machines | Compute Engine |
| **Serverless** | Lambda | Functions | Cloud Functions / Cloud Run |
| **Containers** | ECS/EKS | AKS/Azure Container Apps | GKE/Cloud Run |
| **PaaS** | Elastic Beanstalk | App Service | App Engine |
| **Mejor para** | Todo | Enterprise MS | ML/Data |

### Databases

| | AWS | Azure | GCP |
|--|-----|-------|-----|
| **Relacional** | RDS / Aurora | SQL Database | Cloud SQL / AlloyDB |
| **NoSQL** | DynamoDB | Cosmos DB | Firestore / Bigtable |
| **Data Warehouse** | Redshift | Synapse | **BigQuery** |
| **Caching** | ElastiCache | Redis Cache | Memorystore |
| **Mejor para** | DynamoDB scale | Enterprise SQL | BigQuery analytics |

### Networking

| | AWS | Azure | GCP |
|--|-----|-------|-----|
| **VPC** | VPC | VNet | VPC |
| **CDN** | CloudFront | Azure CDN | Cloud CDN |
| **DNS** | Route 53 | Azure DNS | Cloud DNS |
| **Load Balancer** | ELB | Load Balancer | Cloud Load Balancing |
| **Global** | CloudFront (el más rápido) | Azure Front Door | **Global Load Balancer** |
| **Mejor para** | CDN (CloudFront) | Enterprise hybrid | **Networking global** |

### IAM

| | AWS | Azure | GCP |
|--|-----|-------|-----|
| **Identity** | IAM | Azure AD / Entra ID | IAM |
| **Permissions** | Policies (JSON) | RBAC + Policies | IAM policies |
| **Groups** | Groups | Azure Groups | Service accounts |
| **Mejor para** | Granularidad | **Enterprise identity** | Simpleza |

## Decision-making: ¿Cuál elegir?

### Escenario → Recomendación

| Escenario | Recomendación | Por qué |
|-----------|--------------|---------|
| **Startup que empieza desde cero** | GCP o AWS | GCP para ML, AWS para todo lo demás |
| **Empresa que usa Microsoft** | **Azure** | AD integration, Office 365, Windows |
| **Proyecto de ML/AI** | **GCP** | Vertex AI, BigQuery ML, TensorFlow |
| **E-commerce / Web app** | AWS | CloudFront + EC2 + RDS (el más maduro) |
| **Mobile backend** | AWS / Firebase | DynamoDB + API Gateway |
| **Big Data / Analytics** | **GCP** | BigQuery es insuperable |
| **Enterprise on-premise** | **Azure** | Hybrid (Azure Arc, Azure Stack) |
| **Kubernetes** | **GCP** | GKE fue el primero managed, más simple |
| **Multi-cloud** | Cualquiera + Terraform | Usa IaC para no depender de uno |

### Cost comparison (ejemplo: 1 VM + 100GB storage)

| Servicio | AWS | Azure | GCP |
|----------|-----|-------|-----|
| **t3.small / B2s / e2-medium** | $18.72/mes | $17.52/mes | $15.00/mes |
| **100GB storage** | $2.30/mes (S3) | $1.90/mes (Hot) | $2.00/mes (Standard) |
| **100GB transfer out** | $9.00/mes | $8.70/mes | ~$0.08/GB first 1TB |
| **Total estimado** | ~$30/mes | ~$28/mes | ~$23/mes |

> [!tip] Herramienta de comparación: AWS Pricing Calculator
> Cada provider tiene una calculadora de precios. Úsala para comparar escenarios reales.

## Terraform: Multi-cloud con IaC

Si no quieres depender de un solo provider, usa **Terraform**:

```hcl
# Ejemplo: Crear una VM en AWS y otra en GCP
provider "aws" {
    region = "us-east-1"
}

provider "google" {
    project = "mi-proyecto-gcp"
    region  = "us-central1"
}

# VM en AWS
resource "aws_instance" "web" {
    ami           = "ami-0c55b159cbfafe1f0"
    instance_type = "t3.micro"

    tags = {
        Name = "web-server-aws"
    }
}

# VM en GCP
resource "google_compute_instance" "api" {
    name         = "api-server"
    machine_type = "e2-micro"
    zone         = "us-central1-a"

    boot_disk {
        initialize_params {
            image = "debian-cloud/debian-11"
        }
    }

    network_interface {
        network = "default"
        access_config {}
    }

    labels = {
        environment = "production"
    }
}
```

## Resumen

- **AWS**: El más completo, maduro, y con más servicios. Ideal para todo.
- **Azure**: El mejor para empresas Microsoft. Excelente identity (Azure AD) y hybrid cloud.
- **GCP**: El mejor para ML, AI, Big Data y Kubernetes. Networking global excepcional.
- No hay un "mejor" — depende de tu stack, equipo, y casos de uso
- Usa **Terraform** para multi-cloud y evitar vendor lock-in
- Todos tienen free tiers para experimentar

> [!quote] La clave
> AWS es el "todo terrenal", Azure es el "enterprise Microsoft", y GCP es el "data/ML/AI specialist". Para la mayoría de proyectos, cualquier uno funciona. La decisión más importante es: ¿tu equipo ya conoce alguno? La curva de aprendizaje importa.

## Conexión con el resto de la wiki

| Concepto tocado | Artículo en profundidad |
|-----------------|------------------------|
| VPS | [[20-vps]] (VPS vs Cloud) |
| Cloudflare | [[19-cloudflare-completo]] (CDN + Cloud providers) |
| Containers | Docker/Kubernetes en cualquier provider |
| DNS | [[03-dns-profundo]] (Route 53, Azure DNS, Cloud DNS) |
| Networking | [[15-modelo-osi-tcpip]] |
| Firewalls | [[17-firewalls-proxies-loadbalancers]] (Security Groups, NSGs, Firewall Rules) |
