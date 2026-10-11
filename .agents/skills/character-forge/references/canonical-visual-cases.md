# Casos Canónicos y Galería de Referencia (Canonical Visual Cases)

Este módulo cataloga casos de estudio originales que resuelven retos técnicos y visuales específicos en el diseño de personajes digitales mediante código.

---

## Caso Canónico 1: El Ojo Anamórfico sobre Curva 2.5D (Técnica Coucou)
* **Problema Técnico**: Al girar la cabeza en un plano 2D, los ojos dibujados planos no transmiten profundidad esférica y parecen flotar fuera de la cara.
* **Principio Visual**: Proyección esférica con compresión anamórfica de escala en el eje mayor $X$.
* **Tecnología**: Canvas 2D / JavaScript.
* **Fórmula Clave**:
  $$x_{\text{ojo}} = \sin(\lambda) \cdot \cos(\theta) \cdot r_x, \quad y_{\text{ojo}} = -\sin(\theta) \cdot r_y$$
  $$\text{scale}_x = \max(0.18, \cos(\lambda))$$
* **Error Frecuente que Evita**: Dislocación de la mirada y efecto "pegatina plana".

---

## Caso Canónico 2: El Anillo Doble de Oclusión para Sombreros (Double-Ring Occlusion)
* **Problema Técnico**: Un sombrero o corona que rodea la cabeza debe verse por delante en la frente y por detrás en la nuca.
* **Principio Visual**: Ordenamiento por signo de profundidad $Z$ en Canvas 2D sin Z-buffer de GPU.
* **Tecnología**: Canvas 2D + Superelipsoide Analítico.
* **Técnica**: Muestrear la elipse de corte $C(\lambda)$, clasificar los vértices en lista posterior ($Z < 0$) y lista frontal ($Z \ge 0$), y renderizar en dos pasadas separadas por el cuerpo principal.
* **Error Frecuente que Evita**: Que el ala del sombrero atraviese visualmente el cráneo al girar en 3/4.

---

## Caso Canónico 3: El Rebote Amortiguado No Lineal de Aterrizaje
* **Problema Técnico**: Los saltos que terminan con una interpolación lineal o senoidal simple se sienten mecánicos o ingrávidos.
* **Principio Visual**: Transferencia de energía cinética a deformación elástica de masa blanda (*Squash & Stretch* con resorte).
* **Tecnología**: Oscilador armónico amortiguado $\ddot{x} + 2\zeta\omega_0 \dot{x} + \omega_0^2 x = 0$.
* **Parámetros**: $\omega_0 = 16.0\text{ rad/s}, \zeta = 0.72$, deformación inicial $S_y = 0.76, S_x = 1.14$.
* **Error Frecuente que Evita**: Movimiento rígido o temblor infinito no realista.
