---
title: "CNNs y RNNs: redes para visión y secuencias"
description: "Convoluciones, filtros, pooling, stride. RNNs, LSTMs, GRUs. Comparación con Transformer. Por qué el Transformer ganó."
---

# Capítulo 08: CNNs y RNNs

## CNNs: cómo ve una máquina

Una CNN aplica **filtros** (matrices pequeñas como 3×3) que se deslizan por la imagen detectando patrones locales.

**Flujo**: `Imagen → Convoluciones → Pooling → Más convoluciones → Pooling → Clasificación`

**Convolución**: el filtro se desliza por la imagen. En cada posición multiplica sus valores por los píxeles correspondientes y suma.

$$(I * K)_{i,j} = \sum_{m=1}^{k} \sum_{n=1}^{k} I_{i+m, j+n} \cdot K_{m,n}$$

**Hiperparámetros**:
- **Stride**: cuántos píxeles avanza el filtro en cada salto.
- **Padding**: píxeles de ceros añadidos al borde.

Tamaño de salida: $\text{salida} = \lfloor \frac{N - K + 2P}{S} \rfloor + 1$

**Pooling**: reduce resolución (ej: max pooling 2×2 se queda con el valor máximo de cada zona).

**Canales**: imagen RGB tiene 3 canales. Una capa convolucional puede recibir 3 y entregar 64 mapas de características.

## RNNs y LSTMs

**RNN**: procesa secuencias elemento a elemento manteniendo un **estado oculto**.

$$h_t = \tanh(W_h h_{t-1} + W_x x_t + b)$$

Problema: el estado oculto se sobrescribe y la información se diluye (desvanecimiento del gradiente).

**LSTM**: añade compuertas de olvido, entrada y salida para recordar a más largo plazo.

**GRU**: simplificación de LSTM con solo 2 compuertas. Menos parámetros, más rápida.

**RNNs bidireccionales**: dos RNNs en paralelo (izquierda→derecha y derecha→izquierda).

## RNN vs LSTM vs Transformer

| Característica | RNN | LSTM | Transformer |
|---------------|-----|------|-------------|
| Procesamiento | Secuencial | Secuencial | **Paralelo** |
| Contexto práctico | Limitado | Mejor, pero secuencial | Ventana explícita de atención |
| Paralelizable | No | No | **Sí** |
| Velocidad | Lenta | Lenta | **Rápida** |

El Transformer ganó por: 1) **paralelismo** (procesa todos los tokens a la vez), 2) **atención directa** (cada token puede mirar directamente a cualquier otro).

## Vocabulario clave

- **CNN**: red neuronal convolucional para datos con estructura de rejilla.
- **Convolución**: operación que aplica un filtro deslizante sobre la entrada.
- **Filtro/kernel**: matriz pequeña de pesos aprendidos que detecta un patrón.
- **Mapa de características**: salida de un filtro al recorrer la entrada.
- **ViT**: Vision Transformer, divide imagen en parches y usa atención.
- **Estado oculto**: vector que resume el contexto previo en una RNN.