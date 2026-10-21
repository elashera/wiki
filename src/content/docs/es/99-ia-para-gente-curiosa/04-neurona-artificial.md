---
title: "La neurona artificial: el átomo del aprendizaje"
description: "La neurona artificial es una función matemática: y = f(Σ wᵢxᵢ + b). Entradas, pesos, sesgo y activación. El átomo del deep learning."
---

# Capítulo 04: La neurona artificial

## Qué es

Una neurona artificial es una **función matemática** que recibe números, los multiplica por pesos, suma un sesgo y aplica una función de activación. No hay biología, hay aritmética.

## La fórmula

$$y = f\left(\sum_{i=1}^{n} w_i \cdot x_i + b\right)$$

En forma vectorial: $z = \mathbf{w}^{T}\mathbf{x} + b$, $y = f(z)$

| Símbolo | Significado | Ejemplo |
|---------|------------|---------|
| $x_i$ | Entrada | 0.5, 0.3, 0.8 |
| $w_i$ | Peso | 0.2, -0.4, 0.7 |
| $b$ | Sesgo (bias) | 0.1 |
| $z$ | Suma ponderada | 0.64 |
| $f$ | Activación | ReLU |
| $y$ | Salida | 0.64 |

## Funciones de activación

| Función | Fórmula | Salida | Se usa en |
|---------|---------|--------|-----------|
| **ReLU** | $\max(0, x)$ | $[0, +\infty)$ | Capas ocultas (la más común) |
| **Leaky ReLU** | $\max(0.01x, x)$ | $(-\infty, +\infty)$ | Evita neuronas muertas |
| **GELU** | $x \cdot \Phi(x)$ | $\approx[-0.17, +\infty)$ | Transformers (GPT, BERT) |
| **Sigmoide** | $\frac{1}{1+e^{-x}}$ | $(0, 1)$ | Salida binaria |
| **Tanh** | $\frac{e^x-e^{-x}}{e^x+e^{-x}}$ | $(-1, 1)$ | RNNs y LSTMs |
| **Softmax** | $\frac{e^{x_i}}{\sum_j e^{x_j}}$ | Probabilidades que suman 1 | Salida multiclase |

Sin activación no lineal, una red de cien capas equivale a una sola capa lineal.

## Código

```javascript
function neurona(inputs, weights, bias) {
  const sum = inputs.reduce((acc, x, i) => acc + x * weights[i], 0);
  return activation(sum + bias);
}
```

## Vocabulario clave

- **Peso**: número que multiplica una entrada. Representa su importancia.
- **Sesgo**: valor que se suma para desplazar la salida. Permite activarse incluso con entradas nulas.
- **Perceptrón**: primera neurona artificial capaz de aprender (Rosenblatt, 1958).
- **Producto escalar**: $w^T x$, multiplicación componente a componente y suma.