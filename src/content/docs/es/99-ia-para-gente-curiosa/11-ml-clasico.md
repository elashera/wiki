---
title: "Machine learning clásico: el mapa antes de los LLM"
description: "Clasificación vs regresión, SVM, árboles de decisión, clustering, validación, matriz de confusión, precision, recall, F1."
---

# Capítulo 11: Machine learning clásico

## El paisaje del ML clásico

| Paradigma | Señal | Ejemplo |
|-----------|-------|---------|
| Supervisado | Etiquetas | Clasificar spam |
| No supervisado | Sin etiquetas | Agrupar clientes |
| Refuerzo | Recompensa | Juegos, robótica |
| Semi-supervisado | Pocas etiquetas + muchas sin | Híbrido |
| Auto-supervisado | Etiquetas de los propios datos | Predecir siguiente palabra |

## Clasificación vs Regresión

- **Clasificación**: salida categórica discreta. "Spam/No spam", "Gato/Perro/Pájaro".
- **Regresión**: salida numérica continua. Precio de una casa, temperatura.

## SVM (Máquinas de Vectores de Soporte)

Busca la frontera de **margen máximo**: la franja más ancha posible entre las clases.

- **Vectores de soporte**: solo los ejemplos pegados al borde determinan la frontera.
- **Pérdida bisagra (hinge)**: $\max(0, 1-m)$ — exige acierto con holgura.
- **Kernel trick**: mide similitud como si estuviera en más dimensiones sin construirlas.

## Árboles de decisión

Secuencia de preguntas sobre las features. Cada nodo elige el corte que más reduce la **impureza** (índice de Gini):

$$G = 1 - \sum_{k=1}^{C} p_k^2$$

Gini = 0 es pureza total (todos los ejemplos de la misma clase).

## Validación

- **Train/validation/test**: divide antes de tocar nada. Test se toca una sola vez.
- **Cross-validation (k-fold)**: estimación robusta con pocos datos.
- **Data leakage**: el error más insidioso. Información del futuro en el entrenamiento.
- **Data drift**: el mundo cambia, monitoriza.

## Métricas

**Matriz de confusión**:

| | Predicho Positivo | Predicho Negativo |
|---|---|---|
| **Real Positivo** | TP | FN |
| **Real Negativo** | FP | TN |

**Precision**: $\frac{TP}{TP+FP}$ — "Cuando aviso, ¿acierto?"
**Recall**: $\frac{TP}{TP+FN}$ — "De lo que debía cazar, ¿cuánto cacé?"
**F1**: $2 \cdot \frac{Precision \cdot Recall}{Precision + Recall}$ — media armónica de ambas.

## Clustering

- **k-means**: elige K, coloca centroides, asigna puntos, recalcula.
- **Jerárquico**: construye un dendrograma, cortas a la altura deseada.
- **DBSCAN**: grupos por densidad, descubre K solo, marca ruido.
- **Silueta**: $s = \frac{b-a}{\max(a,b)}$ — mide lo bien agrupado que está un punto.

## Reducción de dimensionalidad

- **PCA**: componentes principales, direcciones de máxima varianza. Proyección lineal.
- **t-SNE / UMAP**: visualización no lineal. Deforman distancias globales.

## Vocabulario clave

- **Baseline**: regla simple que el modelo debe superar.
- **Umbral**: punto de corte para convertir probabilidad en decisión.
- **Calibración**: las probabilidades predichas corresponden a frecuencias reales.
- **Overfitting**: memoriza entrenamiento, no generaliza.
- **Underfitting**: demasiado simple para capturar patrones.