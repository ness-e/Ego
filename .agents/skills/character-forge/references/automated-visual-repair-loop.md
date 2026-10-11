# Ciclo Automatizado de Evaluación y Reparación Visual (Automated Visual Repair Loop)

Este módulo establece el ciclo cerrado de diagnóstico, reparación focalizada y prevención de regresiones para mejorar iterativamente los personajes sin romper capacidades previas.

---

## 1. El Bucle Controlado de 11 Pasos

Queda prohibido realizar cambios especulativos no verificados o alterar múltiples subsistemas a ciegas. Toda reparación sigue la secuencia:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Generar / Compilar Variante de Código                                    │
│ 2. Ejecutar en Entorno Real o Simulador Determinista                        │
│ 3. Capturar Telemetría (FPS, MAE, Métricas de Movimiento) y Framebuffer      │
│ 4. Ejecutar Suite de Aserciones y Pruebas Unitarias                         │
│ 5. Detectar Discrepancia o Defecto Específico                               │
│ 6. Clasificar según Taxonomía (DEF-GEO, DEF-MAT, DEF-ANI, etc.)             │
│ 7. Formular Corrección Focalizada Aislada                                   │
│ 8. Modificar Exclusivamente las Variables Vinculadas al Defecto             │
│ 9. Repetir la Suite Completa de Pruebas                                     │
│ 10. Comparar Métricas con la Línea Base Anterior (Evitar Regresión)         │
│ 11. Aceptar Cambio si Todas las Pruebas Pasan; Revertir si hay Degradación  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Prevención Estricta de Regresiones (Non-Regression Protocol)

Toda modificación debe someterse a la regla de no-regresión:
* **Al ajustar un material (ej. brillo de cerámica)**: El tiempo de asentamiento de la animación ($T_s$) y el cálculo de la silueta en blanco y negro deben mantenerse idénticos.
* **Al corregir una oclusión de accesorio**: La posición de los ojos y la respuesta al click-through no deben verse alteradas.
* **Si una prueba preexistente falla tras el cambio**: La corrección se **revierte automáticamente** para replantear la hipótesis.

---

## 3. Regla de Integridad y Honestidad en la Verificación

> [!CAUTION]
> **Prohibición de Alucinación de Validación**: Si el entorno de ejecución no dispone de un navegador sin cabeza (*headless browser*) para capturar la imagen o de una GPU para evaluar el sombreado, **está terminantemente prohibido afirmar que la imagen fue visualmente inspeccionada**. Se debe reportar que la verificación matemática y lógica en CPU fue exitosa, dejando asentado de forma transparente que la validación estética por píxel permanece pendiente de confirmación en el runtime real.
