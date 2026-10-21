---
title: "Del token al embedding: cómo el modelo representa lenguaje"
description: "Tokenización BPE, embeddings densos, similitud coseno, modelos de embedding, Matryoshka. El puente entre texto y matemáticas."
---

# Capítulo 09: Del token al embedding

## Qué es un token

Un token es la **unidad mínima** que el modelo procesa. No es una palabra, aunque a veces coincide.

Ejemplos con BPE:
- `"Hola mundo"` → `["Hola", " mundo"]` (2 tokens)
- `"desarrolladores"` → `["des", "arrol", "ladores"]` (3 tokens)

**El modelo no ve texto.** Ve secuencias de números (IDs de token). El vocabulario típico: 50K-250K tokens.

**El español gasta más tokens que el inglés.** "Machine learning is great" = 4 tokens; "El aprendizaje automático es genial" = 7-8.

### BPE (Byte Pair Encoding)
1. Empieza con caracteres individuales.
2. Encuentra el par de tokens consecutivos más frecuente.
3. Fusiona ese par en un nuevo token.
4. Repite miles de veces.

## Qué es un embedding

Un **embedding** es un vector denso de números reales (768-4096 dimensiones) que captura el significado del token.

Las dimensiones **no tienen etiquetas**. El significado emerge de la posición relativa del vector completo.

**Similitud coseno**: mide el coseno del ángulo entre dos vectores.

$$\text{sim}(\mathbf{a}, \mathbf{b}) = \cos\theta = \frac{\mathbf{a} \cdot \mathbf{b}}{\lVert \mathbf{a} \rVert \lVert \mathbf{b} \rVert} = \frac{\sum_i a_i b_i}{\sqrt{\sum_i a_i^2} \sqrt{\sum_i b_i^2}}$$

**Aritmética de significado**: $\mathbf{v}_{\text{rey}} - \mathbf{v}_{\text{hombre}} + \mathbf{v}_{\text{mujer}} \approx \mathbf{v}_{\text{reina}}$

## Modelos de embedding (2026)

| Modelo | Proveedor | Dimensiones |
|--------|-----------|-------------|
| `text-embedding-3-large` | OpenAI | 3072 (reducible) |
| `voyage-4-large` | Voyage AI | 1024 (256-2048) |
| `Qwen3-Embedding-8B` | Qwen (open) | hasta 4096 |
| `BGE-M3` | BAAI (open) | 1024 |
| `embed-v4` | Cohere | 1536 (256-1536) |

**Embeddings Matryoshka**: funcionan bien a cualquier dimensionalidad. Puedes usar 256 dimensiones para búsquedas rápidas y 1024 para máxima precisión.

## Vocabulario clave

- **BPE**: algoritmo de tokenización por pares de bytes.
- **Subtokens**: fragmentos de palabras largas o poco frecuentes.
- **Hipótesis distribucional**: el significado de una palabra se deduce de las palabras con las que aparece.
- **Producto escalar**: suma de productos componente a componente de dos vectores.
- **Norma**: longitud de un vector.
- **Base de datos vectorial**: almacenamiento optimizado para buscar vectores cercanos por similitud.