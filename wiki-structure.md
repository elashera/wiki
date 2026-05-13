# AI Engineer Wiki - Proposed Structure

## MÓDULO 1: Redes e Internet
- Modelo OSI y TCP/IP (capas, protocolos, funcionamiento interno)
- HTTP/HTTPS, REST, gRPC, WebSocket
- DNS, TCP/IP, routing, subnetting
- Firewalls, proxies, load balancers
- SSL/TLS handshake, certificados
- Protocolos de mensajería (AMQP, MQTT, WebSockets)

## MÓDULO 2: Sistemas Operativos
- Linux internals: kernel, procesos, threads, scheduling
- Sistema de ficheros, permisos, pipes, sockets
- Memoria virtual, swap, cgroups, namespaces
- Red del kernel: netfilter/iptables, conntrack
- Syscalls, signals, IPC (pipes, shared memory, semaphores)

## MÓDULO 3: Programación y Software Engineering
- Python avanzado (asyncio, GIL, decorators, metaclasses)
- Patrones de diseño (singleton, factory, observer, strategy)
- Testing (unit, integration, TDD)
- Git, branching strategies, CI/CD basics
- Debugging y profiling

## MÓDULO 4: Bases de Datos
- SQL: PostgreSQL (ACID, transactions, indexing, query optimization)
- NoSQL: MongoDB, Redis (caching, pub/sub, data structures)
- Modelado de datos, normalización, CAP theorem
- Replicación, sharding, consistency models

## MÓDULO 5: Infraestructura y Contenedores
- Docker (images, containers, compose, networking, volumes)
- Kubernetes fundamentals (pods, services, deployments, ingress)
- CI/CD pipelines (GitHub Actions, GitLab CI)
- Monitoring (Prometheus, Grafana, logging)

## MÓDULO 6: Sistemas Distribuidos
- Consensus (Paxos, Raft)
- Message queues (RabbitMQ, Kafka)
- Distributed caching (Redis clusters)
- Event-driven architecture, CQRS, saga pattern
- Idempotency, retry patterns, circuit breakers

## MÓDULO 7: Machine Learning Fundamentals
- Supervised learning (linear/logistic regression, decision trees, SVM, random forest, gradient boosting)
- Unsupervised learning (clustering, PCA, autoencoders)
- Neural networks fundamentals (perceptron, backprop, activation functions)
- Loss functions, optimizers (SGD, Adam, AdamW)
- Regularization (L1/L2, dropout, batch norm)
- Cross-validation, bias-variance tradeoff
- Feature engineering, data preprocessing

## MÓDULO 8: Deep Learning
- CNNs (architecture, transfer learning)
- RNNs, LSTMs, GRUs
- Transformers architecture (attention mechanism, multi-head attention, positional encoding)
- Training deep networks (gradient descent variants, learning rate schedules, warmup)
- Frameworks: PyTorch fundamentals (tensors, autograd, modules, dataloaders)
- GPU computing basics (CUDA, cuDNN, mixed precision)

## MÓDULO 9: LLMs - Arquitectura y Funcionamiento
- Tokenization (BPE, WordPiece, SentencePiece)
- Decoder-only architecture (GPT-style)
- Attention mechanisms (scaled dot-product, multi-head, causal masking)
- Positional encodings (RoPE, ALiBi, learned)
- Feed-forward layers, layer normalization, RMSNorm
- KV cache, inference optimization (speculative decoding, quantization)
- Scaling laws (Chinchilla, Kaplan/Gopher)

## MÓDULO 10: LLMs - Entrenamiento
- Pre-training: data collection, tokenization, compute budget, distributed training
- Data parallelism, tensor parallelism, pipeline parallelism
- FSDP, DeepSpeed, Megatron-LM
- RLHF (Reinforcement Learning from Human Feedback)
- PPO, DPO, ORPO, DPO variants
- Alignment techniques, safety training
- Evaluation during training (loss curves, perplexity)

## MÓDULO 11: LLMs - Evaluación y Benchmarking
- MMLU, GSM8K, HellaSwag, ARC, TruthfulQA
- LM-Eval harness architecture
- Custom evaluation pipelines
- Hallucination detection, factuality metrics
- Red teaming, adversarial evaluation
- Prompt evaluation frameworks

## MÓDULO 12: RAG y Bases de Datos Vectoriales
- Vector embeddings (Word2Vec, BERT embeddings, text-embeddings models)
- Vector databases (Pinecone, Weaviate, Milvus, FAISS, Chroma)
- Similarity search (cosine, dot product, Euclidean)
- RAG architecture (retrieval, chunking, embedding, ranking, generation)
- Chunking strategies, metadata filtering
- Re-ranking (cross-encoders, ColBERT)
- Hybrid search (BM25 + vector)
- Evaluation of RAG (faithfulness, answer relevance, context precision)

## MÓDULO 13: Fine-Tuning
- Full fine-tuning vs parameter-efficient methods
- LoRA, QLoRA, AdaLoRA, IA³
- LoRA mechanics (rank decomposition, alpha, dropout)
- QLoRA (4-bit NF4 quantization, double quantization)
- Training loops (accelerate, peft, trl)
- Dataset preparation, instruction tuning
- Hyperparameter tuning for fine-tuning
- Evaluation post-fine-tuning

## MÓDULO 14: Agentes IA
- Tool use/function calling (OpenAI, Anthropic, Google)
- ReAct pattern (Reason + Act)
- Agentic frameworks (LangChain, LangGraph, LlamaIndex, AutoGen)
- Multi-agent architectures
- Planning, memory, reflection patterns
- Structured output (JSON mode, Pydantic, guidance)
- Evaluation of agents

## MÓDULO 15: Seguridad en IA
- Prompt injection (direct, indirect, adversarial)
- Jailbreaking techniques and defenses
- Data poisoning, model extraction
- Prompt leaking, PII leakage
- Guardrails (NeMo Guardrails, Llama Guard, Guardrails AI)
- Secure prompt engineering patterns
- Content moderation

## MÓDULO 16: Cloud e Infraestructura IA
- Cloud providers (AWS, GCP, Azure)
- Infrastructure as Code (Terraform, Pulumi)
- GPU cloud instances (A100, H100, L4, A10)
- Serverless inference (vLLM, TGI, BentoML)
- Cost optimization for ML workloads
- Kubernetes for ML (Kubeflow, KServe)

## MÓDULO 17: MLOps y Producción
- Model serving (FastAPI, Triton, vLLM, TGI)
- Model versioning (MLflow, DVC, Weights & Biases)
- Monitoring (drift detection, performance monitoring)
- A/B testing, canary deployments
- Pipeline orchestration (Airflow, Prefect, Dagster)
- Feature stores
- CI/CD for ML

## MÓDULO 18: Multimodal y Visión por Computador
- Vision transformers (ViT, Swin)
- CLIP, DALL-E, Stable Diffusion
- Multimodal LLMs (LLaVA, GPT-4V, Gemini)
- Object detection, segmentation
- Image generation fundamentals (diffusion models)
