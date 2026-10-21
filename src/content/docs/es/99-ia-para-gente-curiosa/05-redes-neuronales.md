---
title: "Redes neuronales: capas, arquitectura y flujo"
description: "De la neurona a la red: capas, matrices de pesos, forward pass, contratos de forma, jerarquía de representaciones y presupuesto de parámetros."
---

# Capítulo 05: Redes neuronales: capas, arquitectura y flujo

## De la neurona a la capa

Una capa es un conjunto de neuronas que reciben las mismas entradas. En notación matricial:

$$z^{(l)} = W^{(l)}a^{(l-1)} + b^{(l)}$$
$$a^{(l)} = f^{(l)}(z^{(l)})$$

| Símbolo | Forma | Significado |
|---------|-------|-------------|
| $a^{(l-1)}$ | $d_{l-1}$ | Activaciones de la capa anterior |
| $W^{(l)}$ | $d_l \times d_{l-1}$ | Matriz de pesos |
| $b^{(l)}$ | $d_l$ | Vector de sesgos |
| $a^{(l)}$ | $d_l$ | Salida tras activación |

Parámetros de una capa: $d_l \cdot d_{l-1} + d_l$

## Arquitectura MLP

```
Capa de entrada → Capa(s) oculta(s) → Capa de salida
```

- **Capa de entrada**: recibe los datos, una neurona por feature.
- **Capas ocultas**: transforman la representación en algo más abstracto.
- **Capa de salida**: produce la predicción final.

## Qué aprende cada capa

- **Capas tempranas**: patrones elementales (bordes, letras, colores).
- **Capas intermedias**: combinaciones (formas, texturas, relaciones sintácticas).
- **Capas profundas**: abstracciones (objetos, significado semántico, intención).

## Lo que hace entrenable una red profunda

1. **Inicialización de pesos** — He para ReLU, Xavier/Glorot para tanh/sigmoide.
2. **Normalización** — LayerNorm (la que usan los Transformers) normaliza cada ejemplo por separado.
3. **Conexiones residuales** — $salida = x + f(x)$. El gradiente fluye directo hacia atrás.
4. **Dropout y regularización** — Apaga neuronas al azar para evitar sobreajuste.

## Presupuesto de parámetros

Ejemplo: clasificador 48→32→3: 1.667 parámetros. 48→128→64→3: 14.723. 48→1024→1024→3: 1.102.851.

## Vocabulario clave

- **MLP**: perceptrón multicapa, conexión completa entre capas adyacentes.
- **Forward pass**: recorrido determinista de los datos de entrada a salida.
- **Deep learning**: entrenamiento de redes con muchas capas (decenas o cientos).
- **Contrato de forma**: la salida de una capa debe tener la dimensión que espera la siguiente.