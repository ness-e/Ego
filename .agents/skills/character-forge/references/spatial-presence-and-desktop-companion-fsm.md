# Máquina de Estados de Presencia Espacial y Ciclo de Vida en el Escritorio (Desktop Companion FSM)

Este módulo establece la arquitectura de presencia espacial del personaje en el sistema operativo, desacoplando estrictamente la ubicación física y la interacción de proximidad de las FSMs emocionales y operativas del agente inteligente.

---

## 1. La Arquitectura Jerárquica Desacoplada de 3 Dominios

Para evitar que una animación de curiosidad o un estado de sueño anulen una alerta crítica de seguridad humana (HITL), el sistema mantiene tres máquinas de estado concurrentes gobernadas por un **Árbitro de Prioridades**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. FSM ESPACIAL (Spatial Presence):                                         │
│    hidden ──> docked ──> flying ──> onDesktop ──> sleeping ──> dragging     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. FSM EMOCIONAL (Emotional & Expressive):                                  │
│    neutral, happy, curious, astonished, skeptical, proud, worried           │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. FSM OPERATIVA DEL AGENTE (Agent Runtime State):                          │
│    idle, thinking, tool_running, waiting_approval, error, rate_limited      │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ÁRBITRO DE PRIORIDADES (State Arbiter):                                     │
│ Evalúa precedencia: Urgente/HITL > Acción Usuario > Emoción > Idle Espacial │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Catálogo de Estados Espaciales y Transiciones

```
             ┌──────────┐
             │  HIDDEN  │
             └────┬─────┘
                  │ wake()
                  ▼
             ┌──────────┐   flyOut() (Bézier balístico)   ┌─────────────┐
             │  DOCKED  │ ──────────────────────────────> │ ON_DESKTOP  │
             │  (Edge)  │ <────────────────────────────── │   (Libre)   │
             └──────────┘      retractAlert() (HITL)      └──────┬──────┘
                                                                 │
                  ┌──────────────────────────────────────────────┤
                  │ inactividad > 120s                           │ mousedown
                  ▼                                              ▼
             ┌──────────┐                                   ┌──────────┐
             │ SLEEPING │                                   │ DRAGGING │
             └──────────┘                                   └──────────┘
```

| Estado Espacial | Definición Operativa | Comportamiento del Render |
|---|---|---|
| `hidden` | Oculto tras el marco de la pantalla o Notch. | Dibujo suspendido (0% CPU). |
| `docked` | Anclado en la barra de menú o borde superior. | Renderizado compacto tipo píldora o silueta asomada. |
| `flying` | En tránsito balístico entre anclaje y escritorio. | Trayectoria paramétrica con escala variable y squash al aterrizar. |
| `onDesktop` | Flotando libremente sobre el escritorio. | Renderizado completo con Look-At reactivo al cursor. |
| `sleeping` | Inactivo tras timeout de usuario. | Ojos cerrados, respiración lenta, partículas de sueño. |
| `dragging` | Arrastrado activamente por el puntero del usuario. | Squash alargado, mirada de sorpresa e inercia suspendida. |

---

## 3. Detección de Proximidad Radial con Histéresis

El compañero monitorea la distancia euclidiana respecto al cursor en coordenadas lógicas de pantalla:

$$d = \sqrt{(x_{\text{cursor}} - x_{\text{personaje}})^2 + (y_{\text{cursor}} - y_{\text{personaje}})^2}$$

### 3.1. Umbrales e Histéresis de Activación
Para prevenir parpadeos o cambios erráticos de estado cuando el usuario sitúa el ratón cerca del límite:
* **Umbral de Despertar ($d_{\text{wake}}$)**: $d \le 120\text{ px}$. Provoca el despertar inmediato con micro-sobresalto elástico ($S_y = 1.15$).
* **Umbral de Distancia de Sueño ($d_{\text{sleep}}$)**: $d \ge 160\text{ px}$.
* **Timeout de Inactividad de Agente ($T_{\text{idle}}$)**: $120\text{ segundos}$ continuos sin eventos de agente ni clics.

Condición formal para entrar en sueño:
$$\text{puedeDormir} = (T_{\text{inactividad}} > T_{\text{idle}}) \land (d \ge d_{\text{sleep}}) \land (\text{estadoAgente} = \text{idle})$$

---

## 4. Trayectorias de Vuelo Balísticas (Bézier Cuadrática Paramétrica)

El viaje entre la posición de anclaje $P_0$ (Notch/Borde) y la posición objetivo en el escritorio $P_2$ se modela mediante una curva de Bézier cuadrática de 3 puntos:

$$P(t) = (1 - t)^2 P_0 + 2(1 - t)t P_1 + t^2 P_2, \quad t \in [0, 1]$$

Donde el punto de control $P_1$ define la cúspide del arco de salto:
$$P_1 = \begin{bmatrix} \frac{P_{0, x} + P_{2, x}}{2} \\ \min(P_{0, y}, P_{2, y}) - h_{\text{arco}} \end{bmatrix}, \quad h_{\text{arco}} \approx 80\text{ a } 140\text{ px}$$

* **Amortiguación de Impacto**: Al llegar a $t = 1.0$, se inyecta una perturbación de resorte en el cuerpo ($S_y = 0.78, S_x = 1.22$) absorbiendo la energía del aterrizaje.

---

## 5. Gestión Multi-Monitor, Límites y Escala DPI

Para evitar que la mascota desaparezca o quede atrapada fuera de los límites visibles:

### 5.1. Clamping en el Marco Visible
```typescript
export function clampToVisibleScreen(
  pos: { x: number; y: number },
  panelSize: number,
  screenRect: { minX: number; minY: number; maxX: number; maxY: number },
  margin: number = 24
): { x: number; y: number } {
  return {
    x: Math.min(Math.max(pos.x, screenRect.minX + margin), screenRect.maxX - panelSize - margin),
    y: Math.min(Math.max(pos.y, screenRect.minY + margin), screenRect.maxY - panelSize - margin),
  };
}
```

### 5.2. Coordenadas Lógicas vs Físicas
* En Tauri 2 y macOS, los eventos de ratón se notifican en **píxeles lógicos**, mientras que los buffers de render operan en **píxeles físicos** multiplicados por `devicePixelRatio`.
* La FSM espacial calcula siempre distancias y trayectorias en **píxeles lógicos**. El escalado DPI se aplica únicamente en la llamada de renderizado `ctx.scale(dpr, dpr)`.
