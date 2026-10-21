---
title: "Cómo aprende una red: retropropagación"
description: "El bucle de entrenamiento: forward, pérdida, backward, actualizar. Cálculo manual de gradientes con regla de la cadena y ejemplo numérico completo."
---

# Capítulo 06: Cómo aprende una red: retropropagación

## El bucle de entrenamiento

```
1. Forward pass → 2. Calcular pérdida → 3. Backward pass → 4. Actualizar pesos → (repetir)
```

```python
for epoch in range(num_epochs):
    for batch in dataloader:
        optimizer.zero_grad()
        prediction = model.forward(batch.input)   # 1. Forward
        loss = loss_fn(prediction, batch.target)   # 2. Pérdida
        loss.backward()                            # 3. Gradientes
        optimizer.step()                           # 4. Actualizar
```

## Ejemplo numérico completo

| Símbolo | Valor | Significado |
|---------|-------|-------------|
| $x$ | 2 | Entrada |
| $w$ | 0.40 | Peso |
| $b$ | -0.10 | Sesgo |
| $z = wx + b$ | 0.70 | Preactivación |
| $a = \sigma(z)$ | 0.668 | Activación (sigmoide) |
| $y$ | 1 | Etiqueta real |
| $E = \frac{1}{2}(a-y)^2$ | 0.055 | Error (MSE) |
| $\eta$ | 0.1 | Learning rate |

### Forward pass
$z = 0.40 \times 2 + (-0.10) = 0.70$
$a = \sigma(0.70) \approx 0.668$
$E = \frac{1}{2}(0.668 - 1)^2 \approx 0.055$

### Backward pass (regla de la cadena)

1. $\frac{\partial E}{\partial a} = a - y = 0.668 - 1 = -0.332$
2. $\frac{\partial E}{\partial z} = \frac{\partial E}{\partial a} \cdot \sigma'(z) = -0.332 \times 0.222 \approx -0.074$
3. $\frac{\partial E}{\partial w} = \frac{\partial E}{\partial z} \cdot x = -0.074 \times 2 = -0.148$
4. $\frac{\partial E}{\partial b} = \frac{\partial E}{\partial z} \approx -0.074$

### Actualización
$w_{nuevo} = 0.40 - 0.1 \times (-0.148) \approx 0.415$
$b_{nuevo} = -0.10 - 0.1 \times (-0.074) \approx -0.093$

## Vocabulario clave

- **Gradiente**: vector de derivadas parciales que indica cuánto cambia el error al modificar cada parámetro.
- **Regla de la cadena**: $\frac{\partial E}{\partial w} = \frac{\partial E}{\partial a} \cdot \frac{\partial a}{\partial z} \cdot \frac{\partial z}{\partial w}$
- **Learning rate ($\eta$)**: tamaño del paso en la actualización de pesos.
- **Mini-batch**: grupo pequeño de ejemplos procesados juntos en cada iteración.
- **Época**: una pasada completa por todos los ejemplos del dataset.
- **SGD**: descenso de gradiente estocástico, entrenar con lotes pequeños.
- **Gradient clipping**: reescalar el gradiente cuando su norma supera un umbral.
- **Diferenciación automática**: cálculo automático de gradientes (autograd).