# Soft Character Quality Lab & Automated Verification

Este módulo define las pruebas automatizadas y criterios de inspección para certificar la calidad visual, cinemática y conductual de mascotas 3D.

---

## 1. Tríada de Evaluación de Calidad

### A. Calidad Visual (Render & Geometría)
* **Silueta:** Prueba en fondo negro y blanco puro a 32 px, 128 px y 512 px. La figura debe ser distinguible sin depender del color.
* **Artefactos de Sombreado:** Detección de normales invertidas, polígonos degenerados y pinchazos en polos.
* **Oclusión de Accesorios:** Verificar que los accesorios no intersecten erróneamente la malla del cráneo al girar en Yaw/Pitch.
* **Legibilidad Facial:** Los ojos y la expresión deben leerse con claridad incluso en distancias lejanas.

### B. Calidad de Animación (Cinemática Continua)
* **Overshoot Controlado:** $M_p \in [8.0\%, 22.0\%]$ para garantizar peso elástico sin histeria.
* **Settling Time:** $T_s \le 0.50\text{ s}$ ante entradas escalón.
* **Jitter RMS:** Derivada de aceleración (jerk noise) $< 0.15$.
* **Continuidad Temporal:** Cero saltos de posición entre fases dramáticas.

### C. Calidad Conductual (Reactividad & FSM)
* **Prevalencia HITL:** Las alertas de confirmación de agentes interrumpen de inmediato cualquier animación de reposo o sueño.
* **Diversidad de Respuestas:** El personaje no repite mecánicamente la misma actuación ante estímulos sucesivos; utiliza una política de barajado con semilla fija.
