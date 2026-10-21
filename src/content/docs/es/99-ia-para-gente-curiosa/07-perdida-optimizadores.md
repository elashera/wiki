---
title: "Funciones de pérdida y optimizadores"
description: "Cross-entropy, MSE, pérdida bisagra, margen. Optimizadores SGD, Adam, AdamW, Muon. Contrato mínimo de una run de entrenamiento."
---

# Capítulo 07: Funciones de pérdida y optimizadores

## Funciones de pérdida

| Función | Se usa en | Fórmula |
|---------|-----------|---------|
| **Cross-entropy** (binaria) | Clasificación binaria | $-[y\log(p) + (1-y)\log(1-p)]$ |
| **Cross-entropy** (multiclase) | Clasificación, LLMs | $-\log(p_y)$ |
| **MSE** | Regresión | $\frac{1}{n}\sum_i(\hat{y_i} - y_i)^2$ |
| **Triplet loss** | Embeddings, búsqueda semántica | $\max(0, d(a,p) - d(a,n) + m)$ |

**Cross-entropy** es la reina de la IA moderna. Su gradiente con softmax es elegantemente simple:

$$\frac{\partial E}{\partial z_i} = p_i - y_i$$

El gradiente es el error directo: lo que predijo menos lo que debía predecir.

**Perplejidad**: $PPL = e^{H}$, donde $H$ es la cross-entropy media. Mide entre cuántas opciones duda el modelo de media.

### El margen
Para clasificación con etiquetas $+1/-1$: $margen = puntuación \cdot y$. Positivo = acierto, negativo = error. Las pérdidas sustitutas (surrogate) reemplazan a la pérdida 0-1 (plana, sin gradiente):

- **Bisagra (hinge)**: $\max(0, 1-m)$ — SVM. Exige holgura.
- **Logística**: $\log_2(1+e^{-m})$ — nunca llega a cero del todo.

## Optimizadores

| Optimizador | Idea clave | Cuándo usarlo |
|-------------|-----------|---------------|
| **SGD** | Gradiente con mini-lotes | Control total sobre lr y momentum |
| **Adam** | Learning rate adaptativo por parámetro | Estándar para la mayoría |
| **AdamW** | Adam + weight decay desacoplado | Estándar para LLMs y Transformers |
| **Muon** | Ortogonaliza el momentum | Modelos grandes donde el cómputo aprieta |

### Cómo funciona Adam

Para cada peso, Adam mantiene dos medias móviles:

**Primer momento** (momentum): $m_t = \beta_1 \cdot m_{t-1} + (1-\beta_1) \cdot g_t$
**Segundo momento** (varianza): $v_t = \beta_2 \cdot v_{t-1} + (1-\beta_2) \cdot g_t^2$

Actualización: $\theta_t = \theta_{t-1} - \eta \cdot \frac{\hat{m}_t}{\sqrt{\hat{v}_t} + \epsilon}$

## Contrato mínimo de una run

| Elemento | Decisión | Ejemplo |
|----------|---------|---------|
| Tarea | Clasificación/regresión | Priorizar tickets |
| Pérdida | Según tarea | Cross-entropy |
| Métrica | Según coste del error | F1 macro |
| Optimizador | Algoritmo + hiperparámetros | AdamW, lr=1e-3 |
| Validación | Partición | 80/20 estratificado |
| Parada | Early stopping | 5 épocas sin mejora |

## Vocabulario clave

- **Overfitting**: el modelo memoriza los datos de entrenamiento.
- **Underfitting**: el modelo es demasiado simple para capturar patrones.
- **Weight decay**: regularización que penaliza pesos grandes.
- **Label smoothing**: suavizar etiquetas (0.9 en lugar de 1) para mejorar calibración.
- **Warmup**: learning rate bajo al inicio que sube progresivamente.