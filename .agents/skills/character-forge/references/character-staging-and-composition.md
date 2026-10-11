# Composición, Silueta y Puesta en Escena del Personaje (Character Staging & Composition)

Este módulo establece los principios de dirección visual, jerarquía de masas y puesta en escena en el escritorio para que el personaje mantenga legibilidad inmediata y no compita intrusivamente con el espacio de trabajo del usuario.

---

## 1. El Test de Silueta Bicolor (Black & White Silhouette Test)

Un diseño de personaje profesional debe ser **reconocible al $100\%$ por su silueta exterior sin depender del color ni de detalles internos**:

```
[Silueta en Negro Sólido]               [Silueta en Blanco Sólido]
  (sobre fondo claro #F1F5F9)              (sobre fondo oscuro #0D1117)
          ╭─────────╮                              ╭─────────╮
         │  ███████  │                            │  ░░░░░░░  │
         │ █████████ │                            │ ░░░░░░░░░ │
          ╰─────────╯                              ╰─────────╯
```

### Reglas de Evaluación:
1. **Reconocimiento de Orientación**: La silueta en negro puro debe permitir identificar si el personaje mira al frente, a la izquierda o arriba.
2. **Espacio Negativo Limpio**: La separación entre el cuerpo y las manitas o accesorios debe ser nítida; evitar masas fusionadas indistinguibles.
3. **Legibilidad en 32 px**: Al reducir la silueta a tamaño de icono de notificación ($32 \times 32\text{ px}$), la forma base debe ser inmediatamente discernible.

---

## 2. Lenguaje Morfológico de Formas (Shape Language Parameters)

El diseño del personaje debe gobernarse por un vector de morfología explícito:

| Arquetipo de Forma | Exponente Superelíptico ($p$) | Dinámica de Silueta | Connotación Psicológica |
|---|---|---|---|
| **Circular / Mochi** | $p \in [2.2, 2.8]$ | Curvas amplias, masa blanda elástica. | Amistoso, accesible, orgánico, protector. |
| **Angular / Facetado** | $p = \text{Poliédrico (plano)}$ | Bordes rectos, normales duras, aristas. | Preciso, técnico, analítico, estructurado. |
| **Squircle / Compacto**| $p \in [3.2, 4.5]$ | Esquinas redondeadas, base plana. | Robusto, tecnológico, estable, fiable. |
| **Asimétrico Botánico** | Curvas polinomiales Bézier | Ramificaciones, costillas, espinas. | Misterioso, natural, orgánico, vivo. |

---

## 3. Puesta en Escena en el Escritorio (Desktop Staging Contexts)

La mascota adapta su composición visual según el entorno de la interfaz:

1. **Modo Isla / Notch Anclado**:
   - Encuadre superior centrado ($Y$ comprimido).
   - Supresión de extremidades inferiores.
   - Enfoque total en ojos y badge operativo.
2. **Modo Flotante Libre (Desktop Companion)**:
   - Sombra de contacto suave en el plano inferior.
   - Centro visual levemente desplazado hacia arriba ($1/3$ de la altura) para dotar de presencia viva.
3. **Modo Concurrencia con Trabajo Complejo**:
   - Cuando el usuario utiliza editores de código o navegadores con alta densidad visual:
     - El personaje atenúa contrastes agresivos.
     - Reduce micro-movimientos para evitar distracciones periféricas en la visión del usuario.
