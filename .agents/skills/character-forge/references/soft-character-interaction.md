# Soft Character Interaction & Desktop Environment

Este módulo conecta la mascota 3D con eventos reales de la aplicación web o del sistema operativo (cursor, clics, archivos arrastrados, notificaciones de agentes).

---

## 1. Seguimiento de Cursor con Cinemática Biológica

* **Cono de Atención:**
  - El personaje no gira $360^\circ$ sobre su propio eje como un objeto inerte; el cuello y la mirada tienen conos de rotación limitados:
    $$\text{Yaw} \in [-1.22, 1.22]\text{ rad } (\pm 70^\circ), \quad \text{Pitch} \in [-0.61, 0.52]\text{ rad } (-35^\circ \text{ a } +30^\circ)$$
* **Zona Muerta Central y Pérdida de Interés:**
  - Si el cursor se detiene por más de $4.0\text{ s}$, la mascota relaja la mirada hacia el frente o hacia un punto secundario para no parecer un sensor robótico obsesivo.

---

## 2. Reacción Háptica a Clics y Caricias

* **Clic Simple:** Provoca una deformación elástica de compresión en el punto de contacto ($S_y = 0.88$) y un pequeño parpadeo de satisfacción o sorpresa según la personalidad.
* **Arrastre de Ratón (*Drag*):** El personaje se inclina en dirección opuesta al arrastre con inercia de péndulo en orejas y cuerpo.
* **Drag-and-Drop de Archivos:**
  - Al aproximar un archivo, la mascota entra en estado de anticipación: abre la boca o extiende las patitas hacia el icono.
  - Al soltarlo, realiza una animación de inspección analítica (escaneo visual con dilatación pupilar).
