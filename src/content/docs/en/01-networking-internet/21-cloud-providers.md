---
title: "Cloud Providers: AWS, Azure, and GCP — Services, Pricing, IAM, Networking, Comparison"
description: "Complete comparison of the top 3 cloud providers: AWS, Azure, and GCP — services, pricing, IAM, networking, and when to choose each one."
---

# Cloud Providers: AWS, Azure, and GCP

> [!tip] Cloud providers in a nutshell
> **AWS, Azure, and GCP** are the three major public cloud providers. Each offers hundreds of services, different strengths, and distinct pricing models. This article compares them in detail.

## What is a cloud provider?

A **cloud provider** is a company that offers computing infrastructure and services over the Internet, on demand (pay-as-you-go). Instead of buying physical servers, you **rent** resources in their data centers.

### The three giants (Tier 1)

| Provider | Market Share | Data Centers | Regions | Availability Zones |
|-----------|-------------|-------------|---------|-------------------|
| **AWS** | ~31% | 300+ | 36 | 114+ |
| **Azure** | ~25% | 600+ | 60+ | 180+ |
| **GCP** | ~11% | 50+ | 40+ | 120+ |

### Fourth-tier providers

| Provider | Market Share | Specialty |
|-----------|-------------|-----------|
| **Oracle Cloud** | ~3% | Databases, enterprise |
| **IBM Cloud** | ~1% | Enterprise, hybrid |
| **Alibaba Cloud** | ~5% | Asia-Pacific |
| **DigitalOcean** | ~2% | Developer-friendly, simple |
| **Hetzner** | ~1% | EU/US, price-performance |

## AWS (Amazon Web Services)

**The pioneer** (launched in 2006), the largest and most complete.

### AWS services

#### Compute

| Service | Description | Typical use |
|----------|-------------|------------|
| **EC2** | Virtual machines (instances) | Servers, APIs, apps |
| **Lambda** | Serverless functions | Microservices, event-driven |
| **ECS / EKS** | Docker / Kubernetes containers | Container orchestration |
| **Elastic Beanstalk** | PaaS (Platform as a Service) | Fast app deployment |
| **Bare Metal** | Dedicated physical servers | High performance, compliance |

#### Storage

| Service | Description | Typical use |
|----------|-------------|------------|
| **S3** | Object storage | File storage, backups, static hosting |
| **EBS** | Block storage for EC2 | Database storage, system disks |
| **EFS** | Network file system (NFS) | Shared file storage |
| **Glacier** | Archive storage | Long-term backup, compliance |
| **Storage Gateway** | Hybrid cloud storage | On-premises to cloud storage |

#### Networking

| Service | Description | Typical use |
|----------|-------------|------------|
| **VPC** | Virtual Private Cloud | Isolated network in AWS |
| **Route 53** | DNS service | Domain registration, DNS management |
| **CloudFront** | CDN | Content delivery, edge caching |
| **Elastic Load Balancer** | Load balancing | Distribute traffic across EC2 |
| **VPN / Direct Connect** | Dedicated connections | On-premises to AWS connectivity |
| **API Gateway** | API management | REST APIs, WebSocket APIs |
| **Cognito** | User authentication | User pools, identity pools |

#### Databases

| Service | Description | Typical use |
|----------|-------------|------------|
| **RDS** | Managed relational databases | PostgreSQL, MySQL, MariaDB, Oracle, SQL Server |
| **DynamoDB** | NoSQL key-value database | High-scale, low-latency data |
| **Neptune** | Graph database | Knowledge graphs, recommendation engines |
| **Aurora** | Managed PostgreSQL/MySQL | High-performance RDS replacement |
| **Redshift** | Data warehousing | Analytics, OLAP |
| **ElastiCache** | In-memory caching | Redis, Memcached |

#### Serverless & AI

| Service | Description | Typical use |
|----------|-------------|------------|
| **Lambda** | Serverless compute | Event-driven functions |
| **Step Functions** | Workflow orchestration | Multi-step processes |
| **SageMaker** | ML platform | Model training and deployment |
| **Bedrock** | Foundation models | LLM APIs (Claude, Llama, Titan) |
| **Polly** | Text-to-speech | Voice synthesis |
| **Rekognition** | Image analysis | Object detection, face recognition |

### AWS pricing

| Service | Pricing model | Example |
|---------|--------------|---------|
| **EC2** | Per hour/second | t3.micro: ~$7/month (on-demand) |
| **S3** | Per GB stored + requests | $0.023/GB/month |
| **Lambda** | Per request + compute time | 1M free requests/month |
| **RDS** | Per hour/instance | db.t3.micro: ~$15/month |
| **Data transfer** | Per GB out | $0.09/GB after free tier |

### AWS best practices

```
1. Use IAM roles instead of access keys
2. Enable MFA on all accounts
3. Use VPC with private subnets
4. Store secrets in AWS Secrets Manager or SSM Parameter Store
5. Enable CloudTrail for audit logging
6. Use S3 bucket policies (never public)
7. Set up AWS Budgets for cost alerts
8. Use reserved instances or savings plans for predictable workloads
9. Enable versioning on S3 buckets
10. Use infrastructure as code (Terraform, CloudFormation)
```

```json
// Example IAM Policy (principle of least privilege)
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::myapp-bucket/*"
    }
  ]
}
```

## Azure (Microsoft Azure)

**The enterprise giant**, deeply integrated with Microsoft products.

### Azure services

#### Compute

| Service | Description | Typical use |
|----------|-------------|------------|
| **Virtual Machines** | VMs (Windows/Linux) | Servers, APIs, apps |
| **Azure Functions** | Serverless functions | Event-driven workloads |
| **Azure Container Instances** | Single containers | Quick container deployment |
| **AKS (Kubernetes)** | Managed Kubernetes | Container orchestration |
| **Azure App Service** | PaaS for web apps | Web apps, APIs, mobile backends |
| **Azure Batch** | Large-scale job processing | HPC, rendering |

#### Storage

| Service | Description | Typical use |
|----------|-------------|------------|
| **Blob Storage** | Object storage | File storage, static hosting |
| **Azure Files** | Managed file shares | SMB file sharing |
| **Disk Storage** | Block storage for VMs | VM system disks, data disks |
| **Archive Storage** | Cold storage | Long-term retention |
| **NetApp Files** | Enterprise NFS/SMB | High-performance file storage |

#### Networking

| Service | Description | Typical use |
|----------|-------------|------------|
| **Virtual Network (VNet)** | Private network in Azure | Isolated network |
| **Azure DNS** | DNS hosting | Domain DNS management |
| **Azure Front Door** | CDN + WAF + global LB | Global web acceleration |
| **Application Gateway** | L7 load balancer | Web traffic routing, WAF |
| **ExpressRoute** | Dedicated private connection | On-premises to Azure |
| **Azure Load Balancer** | L4 load balancer | VM traffic distribution |
| **Azure Firewall** | Managed firewall | Network security |

#### Databases

| Service | Description | Typical use |
|----------|-------------|------------|
| **Azure SQL Database** | Managed SQL Server | Relational data |
| **Cosmos DB** | Multi-model NoSQL | Global-scale NoSQL |
| **Azure Database for PostgreSQL** | Managed PostgreSQL | PostgreSQL workloads |
| **Azure Database for MySQL** | Managed MySQL | MySQL workloads |
| **Azure Cache for Redis** | In-memory cache | Caching, session storage |
| **Azure Synapse Analytics** | Data warehousing | Analytics, BI |

#### Identity & Security

| Service | Description | Typical use |
|----------|-------------|------------|
| **Azure Active Directory** | Identity management | User authentication, SSO |
| **Microsoft Entra ID** | Enterprise identity | IAM, conditional access |
| **Key Vault** | Secrets management | Keys, certificates, passwords |
| **Microsoft Defender** | Security platform | Threat protection |
| **Sentinel** | SIEM | Security monitoring |

### Azure pricing

| Service | Pricing model | Example |
|---------|--------------|---------|
| **Virtual Machines** | Per second | B2s: ~$10/month (on-demand) |
| **Blob Storage** | Per GB stored | $0.018/GB/month |
| **Functions** | Per execution + GB-seconds | 1M executions free/month |
| **SQL Database** | Per vCore/hour | Basic: ~$5/month |
| **Data transfer** | Per GB out | $0.087/GB after free tier |

### Azure best practices

```
1. Use Azure Policy for governance
2. Use Managed Identities instead of service principals
3. Deploy across multiple Availability Zones
4. Use Azure Monitor for observability
5. Implement disaster recovery with Azure Site Recovery
6. Use Azure Backup for VM and database backup
7. Implement RBAC (Role-Based Access Control)
8. Use Azure Cost Management for budget tracking
9. Deploy infrastructure as code (Bicep, Terraform)
10. Use Azure DevOps or GitHub Actions for CI/CD
```

## GCP (Google Cloud Platform)

**The innovation leader**, strong in data, AI, and Kubernetes.

### GCP services

#### Compute

| Service | Description | Typical use |
|----------|-------------|------------|
| **Compute Engine** | VMs (customizable) | Servers, APIs, custom workloads |
| **Cloud Functions** | Serverless functions | Event-driven code |
| **Cloud Run** | Managed containers | Containerized apps, APIs |
| **GKE (Kubernetes)** | Managed Kubernetes | Container orchestration |
| **App Engine** | PaaS (auto-scaling) | Web apps, mobile backends |
| **Cloud Build** | CI/CD platform | Automated builds |
| **Dataproc** | Managed Hadoop/Spark | Big data processing |

#### Storage

| Service | Description | Typical use |
|----------|-------------|------------|
| **Cloud Storage** | Object storage | File storage, backups, CDN |
| **Persistent Disk** | Block storage for VMs | System and data disks |
| **Filestore** | Managed NFS | Shared file storage |
| **Memorystore** | In-memory data store | Redis, Memcached |

#### Networking

| Service | Description | Typical use |
|----------|-------------|------------|
| **VPC** | Virtual Private Cloud | Isolated network |
| **Cloud DNS** | DNS hosting | Domain DNS management |
| **Cloud CDN** | Content delivery | Edge caching |
| **Cloud Load Balancing** | Global load balancer | Global traffic distribution |
| **Cloud Interconnect** | Dedicated connection | On-premises to GCP |
| **Cloud Armor** | DDoS/WAF protection | Edge security |

#### Databases

| Service | Description | Typical use |
|----------|-------------|------------|
| **Cloud SQL** | Managed MySQL/PostgreSQL/SQL Server | Relational databases |
| **Spanner** | Horizontally scaled SQL | Globally distributed relational data |
| **Firestore** | NoSQL document database | Mobile/web app data |
| **Bigtable** | NoSQL wide-column | IoT, analytics, time series |
| **BigQuery** | Serverless data warehouse | Analytics, BI, ML |
| **AlloyDB** | Managed PostgreSQL | High-performance PostgreSQL |

#### AI & Data

| Service | Description | Typical use |
|----------|-------------|------------|
| **Vertex AI** | ML platform | Model training, deployment |
| **AutoML** | Automated ML training | Custom ML without coding |
| **AI Platform** | ML model management | Model hosting, prediction |
| **Dataflow** | Stream/batch processing | ETL pipelines |
| **Dataform** | Data transformation | SQL-based data engineering |
| **Looker** | Business intelligence | Data visualization |

### GCP pricing

| Service | Pricing model | Example |
|---------|--------------|---------|
| **Compute Engine** | Per second | e2-micro: ~$6/month (with free tier) |
| **Cloud Storage** | Per GB stored | $0.020/GB/month |
| **Cloud Functions** | Per execution + resources | 2M invocations free/month |
| **Cloud SQL** | Per hour | db-f1-micro: ~$10/month |
| **Data transfer** | Per GB out | $0.12/GB after free tier |
| **BigQuery** | Per TB queried | First 1TB/month free |

### GCP best practices

```
1. Use Service Accounts with minimal IAM roles
2. Deploy in multiple regions for high availability
3. Use Cloud Build + Artifact Registry for CI/CD
4. Use Terraform for infrastructure (GCP is very Terraform-friendly)
5. Enable Cloud Audit Logs for compliance
6. Use Secret Manager for sensitive data
7. Implement Network Security Policy for VPC segmentation
8. Use Cloud Run for stateless containerized apps (simplest deployment)
9. Use BigQuery for analytics (serverless, fast)
10. Take advantage of sustained use discounts (automatic)
```

## Comparison: AWS vs Azure vs GCP

### Services comparison

| Category | AWS | Azure | GCP |
|----------|-----|-------|-----|
| **VMs** | EC2 | Virtual Machines | Compute Engine |
| **Serverless** | Lambda | Functions | Cloud Functions |
| **Containers** | EKS / ECS | AKS | GKE |
| **Object Storage** | S3 | Blob Storage | Cloud Storage |
| **Managed DB** | RDS | Azure SQL | Cloud SQL |
| **NoSQL** | DynamoDB | Cosmos DB | Firestore / Bigtable |
| **Serverless DB** | DynamoDB | Cosmos DB | Firestore |
| **Data Warehouse** | Redshift | Synapse | BigQuery |
| **DNS** | Route 53 | Azure DNS | Cloud DNS |
| **CDN** | CloudFront | Front Door | Cloud CDN |
| **Load Balancer** | ELB | App Gateway / LB | Cloud LB |
| **IAM** | IAM | Entra ID | IAM |
| **ML Platform** | SageMaker | Azure ML | Vertex AI |
| **Kubernetes** | EKS | AKS | **GKE** |
| **CI/CD** | CodePipeline | DevOps | Cloud Build |

### Pricing comparison

| Service | AWS | Azure | GCP |
|---------|-----|-------|-----|
| **Small VM** | ~$7/mo (t3.micro) | ~$10/mo (B2s) | ~$6/mo (e2-micro)* |
| **Storage (per GB)** | $0.023/mo | $0.018/mo | $0.020/mo |
| **Data transfer out** | $0.09/GB | $0.087/GB | $0.12/GB |
| **Serverless** | 1M free req/mo | 1M exec/mo | 2M inv/mo |
| **Managed DB** | ~$15/mo (db.t3.micro) | ~$5/mo (Basic) | ~$10/mo |

*GCP has a generous free tier ($300 credit + always-free e2-micro)

### Key differentiators

| Feature | AWS | Azure | GCP |
|---------|-----|-------|-----|
| **Market position** | #1, most services | #2, enterprise-friendly | #3, innovation-focused |
| **Best for** | General-purpose, largest service catalog | Microsoft shops, enterprises | Data, AI/ML, Kubernetes |
| **Pricing** | Complex, pay-as-you-go | Enterprise contracts, hybrid | Simple, sustained-use discounts |
| **Free tier** | Limited | $200 credit (90 days) | $300 credit + always-free |
| **Support** | Comprehensive, expensive | Enterprise-focused | Good, developer-friendly |
| **Kubernetes** | EKS (mature) | AKS (good integration) | **GKE (best-in-class)** |
| **Data analytics** | Redshift, Athena | Synapse | **BigQuery (serverless leader)** |
| **AI/ML** | SageMaker, Bedrock | Azure ML | **Vertex AI, TPUs** |
| **Global network** | Largest (300+ PoPs) | Large (600+ locations) | Premium network (low latency) |
| **Hybrid cloud** | Outposts | **Azure Arc (leader)** | Anthos |

### When to choose which

| Scenario | Recommended | Why |
|----------|------------|-----|
| **Starting fresh, no preference** | AWS | Most services, largest community, most job opportunities |
| **Microsoft-heavy company** | Azure | Active Directory integration, enterprise licensing |
| **Data science / ML / AI** | GCP | Best-in-class AI tools, BigQuery, TPUs |
| **Kubernetes** | GCP | GKE is the most managed and easiest |
| **Large enterprise** | Azure or AWS | Both have enterprise contracts, support, compliance |
| **Startup** | GCP or AWS | GCP for credits, AWS for ecosystem |
| **Cost-sensitive** | GCP | Sustained use discounts, generous free tier |
| **Multi-cloud** | Both | Use different strengths from each |

## Cloud architecture patterns

### Multi-tier web application

```
                    Internet
                       │
                  ┌────┴────┐
                  │ CloudFl │ ← CDN + WAF
                  │  are    │
                  └────┬────┘
                       │
                  ┌────┴────┐
                  │  Load   │ ← Global / regional LB
                  │  Balancer│
                  └────┬────┘
                       │
              ┌────────┼────────┐
              ▼        ▼        ▼
        ┌─────────┐ ┌─────────┐ ┌─────────┐
        │  Web    │ │  Web    │ │  Web    │  ← Auto Scaling Group
        │ Server  │ │ Server  │ │ Server  │
        └────┬────┘ └────┬────┘ └────┬────┘
             │            │            │
             └────────────┼────────────┘
                          ▼
              ┌─────────────────────┐
              │  Application API    │ ← Container orchestration
              │  (Kubernetes / ECS) │     (EC2, ECS, or EKS)
              └──────────┬──────────┘
                         ▼
              ┌─────────────────────┐
              │    Database         │ ← RDS (PostgreSQL/MySQL)
              └──────────┬──────────┘
                         ▼
              ┌─────────────────────┐
              │   Cache (Redis)     │ ← ElastiCache
              └─────────────────────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
      ┌─────────────┐     ┌─────────────┐
      │    S3       │     │    DynamoDB │
      │  (Files)    │     │  (Session)  │
      └─────────────┘     └─────────────┘
```

### Serverless architecture

```
         User Request
              │
         ┌────┴────┐
         │ API     │ ← API Gateway
         │ Gateway │
         └────┬────┘
              │
    ┌─────────┼──────────┐
    ▼         ▼          ▼
Lambda    Lambda     Lambda
  (Auth)    (Create)   (Update)
    │         │          │
    └─────────┼──────────┘
              ▼
    ┌──────────────────┐
    │  DynamoDB        │
    │  (Data store)    │
    └──────────────────┘
              │
    ┌─────────┼──────────┐
    ▼         ▼          ▼
  S3        SNS        SQS
 (Files)   (Events)   (Queue)
              │
              ▼
         Lambda
      (Process)
```

### Data pipeline architecture

```
    Data Sources
    (Apps, Logs, Events)
          │
          ▼
    ┌──────────┐
    │  Kinesis │  ← Streaming ingestion
    │ / PubSub │
    └────┬─────┘
         │
         ▼
    ┌──────────┐
    │  Glue    │  ← ETL processing
    │ / Data   │
    │  Flow    │
    └────┬─────┘
         │
         ▼
    ┌──────────┐
    │ Redshift │  ← Data warehouse
    │ / BigQuery│
    └────┬─────┘
         │
         ▼
    ┌──────────┐
    │  Athena  │  ← Ad-hoc queries
    │ / Looker │
    └──────────┘
```

## Infrastructure as Code (IaC)

### Terraform (works with all providers)

```hcl
# Main.tf - Create an AWS EC2 instance
provider "aws" {
  region = "us-east-1"
}

resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"

  tags = {
    Name = "main-vpc"
  }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  map_public_ip_on_launch = true
  availability_zone       = "us-east-1a"

  tags = {
    Name = "public-subnet"
  }
}

resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"  # Ubuntu 22.04
  instance_type = "t3.micro"
  subnet_id     = aws_subnet.public.id

  vpc_security_group_ids = [aws_security_group.web.id]

  user_data = <<-EOF
              #!/bin/bash
              apt-get update
              apt-get install -y nginx
              systemctl start nginx
              EOF

  tags = {
    Name = "web-server"
  }
}

resource "aws_security_group" "web" {
  name = "web-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

```bash
# Terraform workflow
terraform init        # Initialize the working directory
terraform plan        # Preview changes
terraform apply       # Apply changes
terraform destroy     # Clean up resources
```

### Pulumi (code-based IaC)

```typescript
import * as aws from "@pulumi/aws";

const vpc = new aws.ec2.Vpc("main", {
  cidrBlock: "10.0.0.0/16",
});

const subnet = new aws.ec2.Subnet("public", {
  vpcId: vpc.id,
  cidrBlock: "10.0.1.0/24",
  availabilityZone: "us-east-1a",
  mapPublicIpOnLaunch: true,
});

const instance = new aws.ec2.Instance("web", {
  ami: "ami-0c55b159cbfafe1f0",
  instanceType: "t3.micro",
  subnetId: subnet.id,
  tags: { Name: "web-server" },
});

export const publicIp = instance.publicIp;
```

## Cost management

### AWS Cost Management

```
1. AWS Budgets: Set spending limits and alerts
2. AWS Cost Explorer: Visualize spending over time
3. Reserved Instances: 1-3 year commitment (up to 72% savings)
4. Savings Plans: Flexible commitment (up to 66% savings)
5. Spot Instances: Bid for unused capacity (up to 90% savings)

Spot instances:
  - Use excess EC2 capacity
  - Can be terminated with 2-minute warning
  - Great for batch processing, CI/CD, stateless workloads
  - NOT for production databases or stateful services
```

### Azure Cost Management

```
1. Azure Cost Management + Billing: Track and analyze costs
2. Azure Advisor: Recommendations for cost optimization
3. Reserved VM Instances: 1-3 year commitment (up to 72%)
4. Azure Savings Plans: Compute, storage, network (up to 65%)
5. Spot VMs: Up to 90% savings for interruptible workloads
```

### GCP Cost Management

```
1. Cloud Billing: Real-time cost monitoring
2. Cost Table: Analyze costs by labels and services
3. Committed Use Discounts: 1-3 year commitment (up to 57%)
4. Sustained Use Discounts: Automatic for running resources
5. Preemptible VMs: Up to 91% savings for short-lived workloads
```

### Cost optimization checklist

```
[ ] Right-size instances (don't over-provision)
[ ] Use auto-scaling (scale down when idle)
[ ] Use reserved instances/savings plans for steady workloads
[ ] Use spot/preemptible instances for batch jobs
[ ] Delete unused resources (orphaned disks, snapshots)
[ ] Use cloud-native storage (not EBS for archives)
[ ] Use CDN to reduce data transfer costs
[ ] Use VPC endpoints (avoid NAT gateway data transfer)
[ ] Set up billing alerts
[ ] Tag all resources (for cost allocation)
[ ] Review monthly bills
[ ] Use architecture patterns that minimize cost
```

## Security comparison

| Security Feature | AWS | Azure | GCP |
|-----------------|-----|-------|-----|
| **IAM** | IAM (roles, policies) | Entra ID (RBAC) | IAM (roles) |
| **MFA** | ✅ | ✅ | ✅ |
| **Encryption** | At rest + in transit | At rest + in transit | At rest + in transit |
| **Key management** | KMS | Key Vault | Cloud Key Management |
| **Network security** | Security Groups + NACLs | NSG + Firewall | VPC Firewall |
| **Compliance** | Extensive | Extensive | Extensive |
| **DDoS protection** | Shield | DDoS Protection | Cloud Armor |
| **WAF** | AWS WAF | Azure WAF | Cloud Armor |
| **Security monitoring** | Security Hub, GuardDuty | Microsoft Defender | Security Command Center |

### Shared Responsibility Model

```
                    Cloud Provider (responsible for)        Customer (responsible for)
                    ┌────────────────────────────────────┐  ┌────────────────────────────────────┐
                    │            The Cloud               │  │          IN the Cloud              │
                    │                                    │  │                                    │
                    │  ┌────────────────────────────┐   │  │  ┌────────────────────────────┐   │
                    │  │   Physical Security        │   │  │  │   Operating System          │   │
                    │  │   Data Center               │   │  │  │   (patching, updates)      │   │
                    │  │   Hypervisor                 │   │  │  │   ┌────────────────────┐   │   │
                    │  │   Networking Hardware        │   │  │  │  │   Application       │   │   │
                    │  │   Cloud infrastructure       │   │  │  │  │   Data              │   │   │
                    │  └────────────────────────────┘   │  │  │  │  │   IAM               │   │   │
                    │                                    │  │  │  │  │   Configuration     │   │   │
                    └────────────────────────────────────┘  │  │  │  └────────────────────┘   │   │
                                                         ┌────────────────────────────────────┐
                                                         │              YOUR RESPOSIBILITY    │
                                                         └────────────────────────────────────┘
```

## Cloud provider migration

### Migration strategies (6 Rs)

| Strategy | Description | Best for |
|----------|-------------|----------|
| **Rehost** | Lift and shift (move as-is) | Quick migration, minimal change |
| **Replatform** | Minor optimizations (new OS, DB) | Better performance without rewrite |
| **Repurchase** | Replace with SaaS product | Off-the-shelf software (CRM, ERP) |
| **Refactor** | Rewrite for cloud-native | Maximum cloud benefits |
| **Retire** | Shut down unused systems | Reduce costs |
| **Retain** | Keep on-premises | Compliance, latency requirements |

### Migration tools

| Provider | Migration tools |
|----------|----------------|
| **AWS** | AWS Migration Hub, AWS DMS (database), SMS (server migration), CloudEndure |
| **Azure** | Azure Migrate, Azure Database Migration Service, Azure Site Recovery |
| **GCP** | Migrate for Compute Engine, Database Migration Service, Transfer Appliance |

## Connection with the rest of the wiki

| Concept | In-depth article |
|---------|-----------------|
| VPS | [[20-vps]] |
| Cloudflare | [[04-cloudflare-intro]], [[19-cloudflare-complete]] |
| DNS | [[03-dns-deep-dive]] |
| Servers and processes | [[14-servers-processes]] |

## Summary

- **AWS** is the largest and most comprehensive cloud provider with the most services and maturity. Best for general-purpose workloads.
- **Azure** is the enterprise favorite, especially for Microsoft shops. Best for companies using Windows Server, Active Directory, and .NET.
- **GCP** excels in data analytics, AI/ML, and Kubernetes (GKE). Best for data-heavy workloads and containerized applications.
- All three follow the **shared responsibility model**: the provider secures the cloud, you secure what's in it.
- **Infrastructure as Code** (Terraform, Pulumi) is essential for managing cloud resources at scale.
- **Cost management** is critical: set budgets, use reserved instances, right-size resources, and review bills monthly.
- Security best practices: **least privilege IAM**, **MFA**, **encryption at rest and in transit**, **VPC segmentation**, and **continuous monitoring**.

> [!quote] The key takeaway
> There is no "best" cloud provider. Each has strengths: AWS for breadth, Azure for enterprise integration, GCP for data and AI. Most successful companies use **multi-cloud** strategies, leveraging the best service from each provider. Start with one, understand it deeply, and expand from there.
