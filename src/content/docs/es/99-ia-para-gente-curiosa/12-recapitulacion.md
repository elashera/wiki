---
title: "Lo que deberías saber: recapitulación de fundamentos"
description: "Revisión activa de los 12 capítulos. Preguntas de autoevaluación para verificar que los cimientos están sólidos antes de avanzar."
---

# Capítulo 12: Recapitulación de fundamentos

## Revisión capítulo a capítulo

### 1. Qué es y qué no es la IA
La IA no es consciente, no "piensa" y no es infalible. Es un sistema de predicción estadística de tokens. La elocuencia no es corrección.

**Pregunta**: ¿Puedes explicar por qué un LLM no "piensa" ni "entiende", usando el concepto de predicción del siguiente token?

### 2. Sistemas deterministas vs probabilísticos
`sumar(2,3)` siempre da 5. `preguntar("¿Qué es Rust?")` puede dar respuestas distintas. Validar propiedades, no texto exacto.

**Pregunta**: ¿Sabes por qué `temperature=0` no garantiza que el modelo dé siempre la misma respuesta?

### 3. Los cinco principios
Aprendizaje supervisado, no supervisado, post-training, atención y scaling laws. Un único motor: descenso de gradiente.

**Pregunta**: ¿Puedes nombrar los cinco principios y dar un ejemplo concreto de cada uno?

### 4. La neurona artificial
$y = f(\sum_i w_i x_i + b)$. Tres líneas de código. El átomo del deep learning.

**Pregunta**: ¿Puedes escribir la fórmula de memoria y calcular la salida para valores concretos?

### 5. Redes neuronales
Composición de capas. Las primeras detectan patrones simples; las profundas, conceptos abstractos.

**Pregunta**: ¿Puedes dibujar la estructura de una red con capa de entrada, dos ocultas y una de salida?

### 6. Retropropagación
$\frac{\partial E}{\partial w} = \frac{\partial E}{\partial a} \cdot \sigma'(z) \cdot x$. La ecuación más importante del deep learning.

**Pregunta**: ¿Puedes calcular a mano el gradiente para una neurona con $x=2, w=0.4, b=-0.1, y=1$?

### 7. Funciones de pérdida y optimizadores
Cross-entropy para clasificar, MSE para regresión. AdamW es el estándar para Transformers.

**Pregunta**: ¿Sabes cuándo usar cross-entropy y cuándo MSE? ¿Qué hace Adam que no hace SGD?

### 8. CNNs y RNNs
CNNs para visión, RNNs/LSTMs para secuencias. El Transformer las superó con paralelismo y atención directa.

**Pregunta**: ¿Puedes comparar CNN, RNN, LSTM y Transformer explicando la principal ventaja de cada uno?

### 9. Tokens y embeddings
Token = unidad mínima de texto. Embedding = vector denso que representa significado. Similitud coseno para comparar.

**Pregunta**: ¿Entiendes la diferencia entre token y embedding? ¿Sabes qué mide la similitud coseno?

### 10. Entrenamiento vs inferencia
Entrenar cambia pesos. Inferir usa pesos ya aprendidos. Cuantización reduce precisión para ahorrar memoria.

**Pregunta**: ¿Puedes explicar la diferencia entre entrenamiento, inferencia, fine-tuning y cuantización?

### 11. Machine learning clásico
Precision, recall, F1, validación, overfitting. El ML clásico no ha muerto: para datos tabulares sigue siendo la mejor opción.

**Pregunta**: ¿Sabes qué mide precision y qué mide recall? ¿Cuándo sacrificarías una por la otra?

## Diagnóstico

- **10-12 respuestas sólidas**: puedes avanzar al facsímil 2.
- **7-9**: repasa los capítulos que fallaste.
- **Menos de 7**: vuelve a leer el facsímil con calma.

## Recursos para seguir

- **TensorFlow Playground**: `playground.tensorflow.org` — ver una red aprender en el navegador.
- **CNN Explainer**: `poloclub.github.io/cnn-explainer` — mirar dentro de una CNN.
- **OpenAI Tokenizer**: `platform.openai.com/tokenizer` — contar tokens.
- **Embedding Projector**: `projector.tensorflow.org` — visualizar embeddings.
- **Teachable Machine**: `teachablemachine.withgoogle.com` — entrenar clasificador con webcam.
- **3Blue1Brown**: serie sobre redes neuronales en YouTube.
- **Librerías**: PyTorch, TensorFlow/Keras, scikit-learn, Hugging Face.