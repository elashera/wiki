// Navigation data for sidebar
// This file defines the complete structure of the wiki's navigation.
// It is used by the Sidebar component and by the search index.

export interface NavItem {
  id: string;
  title: string;
  description: string;
  slug: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const enNavData: NavSection[] = [
  {
    title: 'Fundamentals',
    items: [
      {
        id: 'mod-1',
        title: 'Networking & Internet',
        description: 'OSI model, TCP/IP, HTTP/HTTPS, DNS, routing, firewalls, SSL/TLS, Cloudflare, VPS, Cloud providers',
        slug: '/01-networking-internet',
      },
      {
        id: 'mod-2',
        title: 'Infrastructure & Containers',
        description: 'Docker, Kubernetes, CI/CD pipelines, Monitoring',
        slug: '/02-infrastructure-containers',
      },
      {
        id: 'mod-3',
        title: 'Distributed Systems',
        description: 'Consensus, message queues, distributed caching, event-driven architecture',
        slug: '/03-distributed-systems',
      },
      {
        id: 'mod-4',
        title: 'Operating Systems',
        description: 'Linux internals, kernel, filesystems, memory, networking, syscalls',
        slug: '/04-operating-systems',
      },
      {
        id: 'mod-5',
        title: 'Programming & Software Engineering',
        description: 'Advanced Python, design patterns, testing, Git, debugging',
        slug: '/05-programming-software-engineering',
      },
      {
        id: 'mod-6',
        title: 'Databases',
        description: 'PostgreSQL, MongoDB, Redis, CAP theorem, replication, sharding',
        slug: '/06-databases',
      },
    ],
  },
  {
    title: 'Artificial Intelligence',
    items: [
      {
        id: 'mod-7',
        title: 'Machine Learning Fundamentals',
        description: 'Supervised learning, neural networks, loss functions, optimizers',
        slug: '/07-ml-fundamentals',
      },
      {
        id: 'mod-8',
        title: 'Deep Learning',
        description: 'CNNs, RNNs, Transformers, PyTorch, GPU computing',
        slug: '/08-deep-learning',
      },
      {
        id: 'mod-9',
        title: 'LLMs — Architecture and Functioning',
        description: 'Tokenization, decoder-only architecture, attention, KV cache',
        slug: '/09-llm-architecture',
      },
      {
        id: 'mod-10',
        title: 'LLMs — Training',
        description: 'Pre-training, distributed training, RLHF, alignment',
        slug: '/10-llm-training',
      },
      {
        id: 'mod-11',
        title: 'LLMs — Evaluation & Benchmarking',
        description: 'MMLU, LM-Eval, hallucination, red teaming',
        slug: '/11-llm-evaluation',
      },
      {
        id: 'mod-12',
        title: 'RAG & Vector Databases',
        description: 'Vector embeddings, vector databases, RAG architecture',
        slug: '/12-rag-vector-databases',
      },
      {
        id: 'mod-13',
        title: 'Fine-Tuning',
        description: 'LoRA, QLoRA, PEFT, instruction tuning',
        slug: '/13-fine-tuning',
      },
      {
        id: 'mod-14',
        title: 'AI Agents',
        description: 'Tool use, ReAct, agentic frameworks, multi-agent',
        slug: '/14-ai-agents',
      },
      {
        id: 'mod-15',
        title: 'AI Security',
        description: 'Prompt injection, jailbreaking, guardrails, PII',
        slug: '/15-ai-security',
      },
      {
        id: 'mod-16',
        title: 'Cloud & AI Infrastructure',
        description: 'GPU cloud, serverless inference, Terraform, cost optimization',
        slug: '/16-cloud-ia',
      },
      {
        id: 'mod-17',
        title: 'MLOps & Production',
        description: 'Model serving, monitoring, CI/CD for ML',
        slug: '/17-mlops',
      },
      {
        id: 'mod-18',
        title: 'Multimodal & Computer Vision',
        description: 'ViT, CLIP, diffusion models, multimodal LLMs',
        slug: '/18-multimodal',
      },
    ],
  },
];

const esNavData: NavSection[] = [
  {
    title: 'Fundamentos',
    items: [
      {
        id: 'mod-1',
        title: 'Redes e Internet',
        description: 'Modelo OSI, TCP/IP, HTTP/HTTPS, DNS, routing, firewalls, SSL/TLS, Cloudflare, VPS, Cloud providers',
        slug: '/01-redes-internet',
      },
      {
        id: 'mod-2',
        title: 'Infraestructura y Contenedores',
        description: 'Docker, Kubernetes, CI/CD pipelines, Monitoring',
        slug: '/02-infra-contenedores',
      },
      {
        id: 'mod-3',
        title: 'Sistemas Distribuidos',
        description: 'Consensus, message queues, distributed caching, event-driven architecture',
        slug: '/03-sistemas-distribuidos',
      },
      {
        id: 'mod-4',
        title: 'Sistemas Operativos',
        description: 'Linux internals, kernel, filesystems, memory, networking, syscalls',
        slug: '/04-sistemas-operativos',
      },
      {
        id: 'mod-5',
        title: 'Programación y Software Engineering',
        description: 'Python avanzado, patrones de diseño, testing, Git, debugging',
        slug: '/05-programacion',
      },
      {
        id: 'mod-6',
        title: 'Bases de Datos',
        description: 'PostgreSQL, MongoDB, Redis, CAP theorem, replicación, sharding',
        slug: '/06-bases-datos',
      },
    ],
  },
  {
    title: 'Inteligencia Artificial',
    items: [
      {
        id: 'mod-7',
        title: 'Machine Learning Fundamentals',
        description: 'Supervised learning, neural networks, loss functions, optimizers',
        slug: '/07-ml-fundamentos',
      },
      {
        id: 'mod-8',
        title: 'Deep Learning',
        description: 'CNNs, RNNs, Transformers, PyTorch, GPU computing',
        slug: '/08-deep-learning',
      },
      {
        id: 'mod-9',
        title: 'LLMs — Arquitectura y Funcionamiento',
        description: 'Tokenization, decoder-only architecture, attention, KV cache',
        slug: '/09-llm-arquitectura',
      },
      {
        id: 'mod-10',
        title: 'LLMs — Entrenamiento',
        description: 'Pre-training, distributed training, RLHF, alignment',
        slug: '/10-llm-entrenamiento',
      },
      {
        id: 'mod-11',
        title: 'LLMs — Evaluación y Benchmarking',
        description: 'MMLU, LM-Eval, hallucination, red teaming',
        slug: '/11-llm-evaluacion',
      },
      {
        id: 'mod-12',
        title: 'RAG y Bases de Datos Vectoriales',
        description: 'Vector embeddings, vector databases, RAG architecture',
        slug: '/12-rag-bases-vectoriales',
      },
      {
        id: 'mod-13',
        title: 'Fine-Tuning',
        description: 'LoRA, QLoRA, PEFT, instruction tuning',
        slug: '/13-fine-tuning',
      },
      {
        id: 'mod-14',
        title: 'Agentes IA',
        description: 'Tool use, ReAct, agentic frameworks, multi-agent',
        slug: '/14-agentes-ia',
      },
      {
        id: 'mod-15',
        title: 'Seguridad en IA',
        description: 'Prompt injection, jailbreaking, guardrails, PII',
        slug: '/15-seguridad-ia',
      },
      {
        id: 'mod-16',
        title: 'Cloud e Infraestructura IA',
        description: 'GPU cloud, serverless inference, Terraform, cost optimization',
        slug: '/16-cloud-ia',
      },
      {
        id: 'mod-17',
        title: 'MLOps y Producción',
        description: 'Model serving, monitoring, CI/CD for ML',
        slug: '/17-mlops',
      },
      {
        id: 'mod-18',
        title: 'Multimodal y Visión por Computador',
        description: 'ViT, CLIP, diffusion models, multimodal LLMs',
        slug: '/18-multimodal',
      },
    ],
  },
];

export const getNavigation = (lang: 'es' | 'en' = 'es'): NavSection[] => {
  if (lang === 'en') return enNavData;
  return esNavData;
};
