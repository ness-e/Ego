# Taxonomía de Defectos Visuales y Diagnóstico (Visual Defect Taxonomy)

Este módulo establece el catálogo canónico de fallos que el sistema debe saber diagnosticar, clasificar y corregir de forma reproducible sin romper otras capacidades funcionales.

---

## 1. Defectos de Geometría y Rigging

### 1.1. DEF-GEO-01: Inestabilidad Polar (`Polar Singularity NaN`)
* **Síntomas**: Desaparición súbita de la malla o destellos blancos al girar la cabeza hacia arriba o abajo ($\theta \to \pm 90^\circ$).
* **Causa**: División por cero en la derivada del radio superelíptico $r'(y)$ cuando $|y| \to 1.0$.
* **Detección**: Prueba unitaria con muestreo en $y = \pm 0.9999$ buscando `isNaN(pt.x)`.
* **Corrección**: Aplicar clamp de seguridad en $|y| \le 0.999$ y evaluar los límites analíticos directos en los polos: $N(1, \lambda) = [0, 1, 0]^T$.

### 1.2. DEF-GEO-02: Penetración de Accesorios (`Accessory Body Clipping`)
* **Síntomas**: El borde del sombrero o las patillas de las gafas atraviesan el volumen del cráneo durante la rotación.
* **Causa**: Orden estático de dibujo en Canvas sin partición por profundidad $Z$.
* **Detección**: Comparación de escena `SCENE_OUTFIT_OCCLUSION` a $\psi = 45^\circ$.
* **Corrección**: Muestrear el anillo de corte transversal y dividir en dos listas: segmento trasero ($Z < 0$, antes del cuerpo) y delantero ($Z \ge 0$, tras el cuerpo).

---

## 2. Defectos de Materiales y Sombreado

### 2.1. DEF-MAT-01: Reflejo Incoherente (`Decoupled Specular Highlight`)
* **Síntomas**: El personaje gira hacia la derecha pero el brillo especular se mueve en sentido contrario o salta bruscamente.
* **Causa**: El cálculo del gradiente de brillo utiliza coordenadas de pantalla fijas en lugar de proyectar el vector normal respecto al vector de luz incidente.
* **Corrección**: Calcular la posición del highlight como $P_{\text{spec}} = (\hat{L}_x \cdot r_x \cdot k_{\text{spec}}, \hat{L}_y \cdot r_y \cdot k_{\text{spec}})$.

---

## 3. Defectos de Animación y Cinemática

### 3.1. DEF-ANI-01: Oscilación Perpetua Gomosa (`Underdamped Jiggle`)
* **Síntomas**: El personaje tiembla indefinidamente sin estabilizarse tras un clic o salto.
* **Causa**: Coeficiente de amortiguamiento $\zeta < 0.35$ en el resorte armónico.
* **Detección**: Medición de tiempo de asentamiento ($T_s > 1.5\text{ s}$).
* **Corrección**: Incrementar $\zeta \ge 0.65$ o aplicar un umbral de parada por velocidad mínima ($|v| < 10^{-4} \implies v = 0$).

### 3.2. DEF-ANI-02: Discontinuidad por Interrupción (`Snapping Velocity Glitch`)
* **Síntomas**: Corte brusco o salto visual cuando entra una alerta HITL mientras se ejecutaba un estiramiento.
* **Causa**: La interrupción resetea la posición o velocidad a cero instantáneamente.
* **Corrección**: Protocolo de interrupción limpia: transferir la posición y velocidad instantáneas actuales como valores iniciales del resorte entrante.

---

## 4. Defectos de Composición e Interacción

### 4.1. DEF-INT-01: Alerta Enmascarada en Sueño (`Silent HITL Masking`)
* **Síntomas**: El usuario no ve que el agente requiere aprobación porque la mascota permanece dormida con ojos cerrados.
* **Causa**: Ausencia de árbitro de prioridades o precedencia incorrecta de la FSM espacial sobre la FSM operativa.
* **Corrección**: En `StateArbiter`, toda condición `waitingForApproval` tiene nivel de prioridad $100$, forzando despertar inmediato y badge `bang`.
