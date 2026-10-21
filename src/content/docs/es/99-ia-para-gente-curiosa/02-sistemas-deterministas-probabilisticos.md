---
title: "Sistemas deterministas frente a sistemas probabilísticos"
description: "Diferencia entre funciones puras y sistemas con muestreo. Temperatura, top-p, top-k, y cómo testear código con LLMs validando propiedades, no texto exacto."
---

# Capítulo 02: Sistemas deterministas frente a sistemas probabilísticos

## Qué es un sistema determinista

**Misma entrada, misma salida. Siempre.** `sumar(2, 3) = 5` siempre, en cualquier servidor. Es el contrato silencioso de la ingeniería de software clásica.

## No determinismo en IA

No toda IA es no determinista. Un árbol de decisión entrenado o una red en modo inferencia con pesos fijos pueden ser deterministas. El no determinismo aparece en:

- **Muestreo de tokens** (el principal)
- Semillas aleatorias
- Diferencias de precisión numérica en GPU
- Batching y kernels de GPU
- Documentos recuperados que cambian (RAG)
- Herramientas externas con estado distinto

## Cómo funciona por dentro

Viaje del prompt al token generado: `Texto → Tokenización → Distribución de probabilidades → Muestreo → Token elegido`

Los parámetros de muestreo controlan la aleatoriedad:

$$P(t_i \mid c) = \frac{e^{z_i / T}}{\sum_j e^{z_j / T}}$$

| Parámetro | Función |
|-----------|---------|
| **temperature** | Controla lo plana o picuda que es la distribución. Baja (cerca de 0) → más predecible. Alta (cerca de 2) → más creativa. |
| **top-p** | Solo considera los tokens más probables hasta que su probabilidad suma `p` |
| **top-k** | Solo considera los `k` tokens más probables |

**Importante**: `temperature=0` NO garantiza determinismo absoluto. La suma en coma flotante no es asociativa y el orden en GPU puede variar.

## En el día a día

- **Tests para código con LLMs**: validar propiedades, no texto exacto. `assert "Rust" in respuesta` en lugar de `assert respuesta == "Rust es un lenguaje..."`
- **Depurar**: ejecutar múltiples veces, medir tasa de error, buscar patrones.
- **Diseñar UX**: la variabilidad puede ser ventaja (creatividad) o fuente de confusión. Diseñar para tolerarla.

## Vocabulario clave

- **Sistema determinista**: misma entrada, misma salida.
- **Sistema estocástico**: misma entrada puede producir salidas diferentes.
- **Muestreo**: elegir un valor de una distribución de probabilidad.
- **Temperatura**: controla la aleatoriedad del muestreo.
- **Logit**: puntuación cruda antes de softmax.
- **Entropía**: medida de incertidumbre de una distribución.
- **Semilla**: valor que fija el punto de partida del muestreo para reproducibilidad.