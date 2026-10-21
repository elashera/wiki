---
title: "Principios fundamentales de la inteligencia artificial"
description: "Cinco principios: aprendizaje supervisado, no supervisado, post-training, atención y scaling laws. Un único motor: el descenso de gradiente."
---

# Capítulo 03: Principios fundamentales de la IA

## Los cinco principios

### 1. Aprendizaje supervisado
Aprender con ejemplos etiquetados. Cada entrada con su salida esperada. Base del fine-tuning.

### 2. Aprendizaje no supervisado
Encontrar patrones sin etiquetas. El modelo descubre estructura por sí mismo. En los LLMs se usa la variante **auto-supervisada**: predecir la siguiente palabra del propio texto.

### 3. Post-training
Enseñar preferencias, no solo hechos, después del pre-entrenamiento masivo:
- **SFT** (Supervised Fine-Tuning): ejemplos de conversaciones de alta calidad.
- **RLHF** (Reinforcement Learning from Human Feedback): personas comparan respuestas.
- **DPO** (Direct Preference Optimization): aprende de preferencias sin modelo de recompensa.

### 4. Atención
Mirar todas las palabras de la entrada simultáneamente. Permite manejar contextos largos y capturar dependencias lejanas. Base del Transformer.

### 5. Scaling laws
El rendimiento mejora de forma predecible con la escala: más datos + más parámetros + más computación = modelo más capaz.

$$L(N, D) \approx L_\infty + \frac{A}{N^\alpha} + \frac{B}{D^\beta}$$

Hay rendimientos decrecientes. Añadir 10× más parámetros no da 10× más calidad.

## Cómo funciona por dentro

Un único motor: el **descenso de gradiente**. Lo único que cambia entre paradigmas es de dónde sale la señal de error:

| Paradigma | Fuente de la señal |
|-----------|-------------------|
| Supervisado | Etiqueta humana |
| Auto-supervisado | Estructura de los propios datos |
| Post-training (RLHF/DPO) | Preferencia humana |

Ciclo común: `forward pass → pérdida → gradiente → actualización`

$$\theta_{t+1} = \theta_t - \eta \nabla_\theta L$$

## Vocabulario clave

- **Pre-entrenamiento**: fase masiva inicial donde el modelo aprende patrones generales.
- **Fine-tuning**: ajustar un modelo pre-entrenado con ejemplos de un dominio específico.
- **Atención**: mecanismo que evalúa la relevancia de cada palabra de entrada para cada palabra de salida.
- **Perplejidad**: exponencial de la cross-entropy media. Mide entre cuántas opciones duda el modelo.