---
title: "Entrenamiento frente a inferencia: dos mundos distintos"
description: "Las tres fases del entrenamiento (pre-entrenamiento, SFT, alineamiento). Prefill y decode, KV cache, cuantización, LoRA, pipeline ML completo."
---

# Capítulo 10: Entrenamiento frente a inferencia

## Entrenamiento vs Inferencia

| Aspecto | Entrenamiento | Inferencia |
|---------|--------------|------------|
| Qué hace | Ajusta parámetros | Usa parámetros ya ajustados |
| Duración | Minutos a meses | Milisegundos a minutos |
| Coste | De barato a enorme | Por petición/token |
| Frecuencia | Cuando cambian datos | Cada petición |

## Las tres fases del entrenamiento

1. **Pre-entrenamiento**: masivo, billones de tokens, predecir siguiente palabra. 99% del coste.
2. **Post-entrenamiento (SFT)**: ejemplos de conversaciones de alta calidad.
3. **Alineamiento (RLHF/DPO)**: personas comparan respuestas para refinar comportamiento.

## Cómo funciona la inferencia

**Autoregresiva**: produce un token cada vez, cada token depende de todos los anteriores.

- **Fase 1: Prefill** — El prompt se procesa entero de una sola pasada. Se guardan keys y values en la **KV cache**.
- **Fase 2: Decode** — Genera respuesta token a token, reutilizando la KV cache.

Métricas clave: **time to first token** (domina prefill) y **tokens por segundo** (domina decode).

## Cuantización

Reducir la precisión numérica de los pesos: FP16 (2 bytes) → INT8 (1 byte) → INT4 (0.5 bytes).

$$memoria \approx P \times b$$

Ejemplo: modelo 7B en FP16 = 14 GB; en INT4 = 3.5 GB.

La **KV cache** NO se cuantiza con los pesos. Crece con la longitud del contexto.

Formatos: GGUF (CPU), GPTQ/AWQ (GPU), BitsAndBytes (Python/Hugging Face).

## LoRA y QLoRA

**LoRA**: congela los pesos del modelo y entrena matrices pequeñas de bajo rango. Produce adaptadores de pocos MB.

**QLoRA**: cuantiza el modelo base a 4 bits y entrena LoRA encima. Permite ajustar modelos enormes en hardware modesto.

## Pipeline ML completo

```
Decisión → Datos → Etiquetas → Entrenamiento → Evaluación → Registro → Despliegue → Monitorización
```

Criterio de release: `release_ok = data_ok AND eval_ok AND safety_ok AND rollback_ok`

## Vocabulario clave

- **KV cache**: memoria de keys y values de la atención durante inferencia.
- **Fine-tuning**: reentrenamiento parcial de un modelo existente.
- **Pruning**: eliminar pesos o neuronas poco útiles.
- **Destilación**: modelo grande enseña a uno pequeño.
- **Batching**: agrupar peticiones para mayor throughput.