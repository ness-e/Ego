# Soft Character Rigging, Deformations & Elastic Continuity

Este módulo define la jerarquía de esqueletos procedurales, morph targets y sistemas de deformación para mascotas 3D suaves.

---

## 1. Jerarquía Esquelética Desacoplada

Para soportar morfologías sin forzar un rig bípedo humano estándar, se utiliza un esqueleto nodal adaptable:

```
Root (Posición en escena + Orientación global)
 └─ CenterOfMass_Bone (Desplazamiento dinámico y squash base)
     ├─ Spine_Squash_Bone (Control elástico vertical Sy y horizontal Sx/Sz)
     │   ├─ Head_Bone (Rotación Yaw, Pitch, Roll de la cabeza)
     │   │   ├─ EyeSocket_L & EyeSocket_R (Sockets de ojos)
     │   │   ├─ Ear_L_Root -> Ear_L_Tip (Cadena secundaria de oreja)
     │   │   └─ Ear_R_Root -> Ear_R_Tip
     │   └─ Accessory_Socket (Anclaje de sombreros, gafas o monóculos)
     ├─ Limb_L_Bone (Patita izquierda, si aplica)
     └─ Limb_R_Bone (Patita derecha, si aplica)
```

---

## 2. Conservación de Volumen en Squash & Stretch

Para mantener la sensación de un objeto físico blando (arcilla, masa de pastel o cojín relleno), cualquier compresión en el eje $Y$ debe compensarse radialmente en $X$ y $Z$:
$$S_x = S_z = \frac{1}{\sqrt{S_y}}$$
* **Límites de Deformación en Mascotas Suaves:**
  - Compresión preparatoria máxima: $S_y \ge 0.65 \implies S_x \le 1.24$.
  - Elongación de despegue máxima: $S_y \le 1.35 \implies S_x \ge 0.86$.
  - Sobrepasar estos límites destruye la anatomía y genera artefactos de estiramiento de texturas.

---

## 3. Deformación Secundaria por Resortes (Secondary Physics)

Orejas, colas y antenas operan como cadenas de péndulos invertidos gobernados por la ecuación de oscilador armónico amortiguado:
$$\ddot{\theta} + 2\zeta\omega_0 \dot{\theta} + \omega_0^2 \theta = -\frac{\vec{a}_{\text{head}} \cdot \hat{n}_{\perp}}{L}$$
* $\zeta \in [0.25, 0.45]$ confiere inercia elástica orgánica a las orejas largas, balanceándose suavemente tras cada parada de la cabeza.
