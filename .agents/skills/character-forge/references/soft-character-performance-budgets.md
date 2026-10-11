# Soft Character Performance Budgets & Adaptive Scaling

Este módulo define los presupuestos cuantitativos de GPU, CPU y memoria para garantizar que las mascotas 3D no ralenticen el sistema operativo ni la aplicación anfitriona.

---

## 1. Presupuestos por Nivel de Hardware (Tiers)

| Métrica | Nivel Económico (Bajo/Móvil) | Nivel Intermedio (Desktop Integrada) | Nivel Alto (GPU Dedicada) |
|---|---|---|---|
| **Polígonos (Triángulos)** | $\le 4\,500$ | $\le 14\,000$ | $\le 45\,000$ |
| **Draw Calls por Frame** | 1 a 3 | 4 a 8 | 12 a 24 |
| **Técnica de Pelo / Fuzz** | Sheen PBR Nivel A | Rim Noise Shader Nivel B | Shell Fur 12 capas Nivel C |
| **Sombras** | Shadow Contact Fake (Plano) | PCF Soft Shadow 1024 | VSM / PCF Soft Shadow 2048 |
| **Tiempo CPU por Frame** | $\le 0.8\text{ ms}$ | $\le 1.8\text{ ms}$ | $\le 3.5\text{ ms}$ |
| **FPS Objetivo** | $60\text{ FPS}$ | $60\text{ FPS}$ | $120\text{ FPS}$ |

---

## 2. Degradación Progresiva y Ahorro en Segundo Plano

* **Ventana Oculta / Minimizada:** Detener de inmediato el bucle de renderizado `requestAnimationFrame` y pausar el reloj físico; conservar solo la FSM lógica en memoria.
* **Pérdida de Foco de la Ventana:** Reducir la tasa de refresco a $15\text{ FPS}$ o entrar en modo de reposo/sueño para ahorrar consumo energético de CPU/GPU.
* **Respeto a `prefers-reduced-motion`:** Congelar oscilaciones de resorte, anular el balanceo continuo de péndulos y sustituir saltos dinámicos por desvanecimientos suaves de opacidad.
