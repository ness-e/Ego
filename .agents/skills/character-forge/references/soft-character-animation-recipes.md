# Soft Character Animation Recipes Library

Este módulo cataloga las recetas de animación modulares, parametrizadas y combinables para mascotas 3D en Three.js.

---

## 1. Esquema de Receta de Animación

Toda receta declara sus límites y canales de control para evitar colisiones:

```typescript
export interface AnimationRecipe {
  id: string;
  family: "idle" | "attention" | "positive" | "negative" | "surprise" | "interaction" | "transition";
  durationMs: number;
  interruptible: boolean;
  priority: number; // 0..100
  affectedChannels: ("body_squash" | "body_pos" | "head_rotation" | "eyes" | "ears" | "tail")[];
  curves: {
    squashY: (t: number) => number;
    headPitch: (t: number) => number;
    headYaw: (t: number) => number;
    eyeBlink: (t: number) => number;
  };
}
```

---

## 2. Catálogo Canónico por Familias

### A. Familia de Reposo (Idle)
* `anim_idle_breathe`: Ciclo continuo de respiración con compresión de volumen suave.
* `anim_idle_sway`: Balanceo lateral y micro-sacadas pupilares.
* `anim_idle_drowse`: Descenso a posición de siesta con párpados pesados.

### B. Familia de Atención
* `anim_attend_focus`: Mirada fija, cabeza adelantada $10^\circ$, orejas erguidas.
* `anim_attend_inquire`: Cabeza ladeada en Roll $+18^\circ$, una oreja hacia arriba y otra relajada.

### C. Familia de Emociones Positivas
* `anim_positive_hop`: Salto alegre de 20 px con squash preparatorio al $80\%$ y elongación al $120\%$.
* `anim_positive_celebrate`: Tres saltos consecutivos en espiral con giros en Yaw.
* `anim_positive_nuzzle`: Frotamiento cariñoso hacia el cursor o pantalla.

### D. Familia de Emociones Negativas / Baja Energía
* `anim_negative_sigh`: Exhalación profunda, desinflado corporal al $90\%$, descenso de cabeza.
* `anim_negative_cower`: Repliegue defensivo con reducción de silueta.

### E. Familia de Sorpresa y Reacción
* `anim_surprise_gasp`: Retracción vertical de 30 ms con dilatación máxima de pupilas.
* `anim_surprise_shake`: Sacudida lateral de pelusa para disipar la sorpresa.

### F. Familia de Interacción
* `anim_interact_poke`: Reacción al clic del usuario: compresión elástica rápida en el punto de contacto.
* `anim_interact_follow`: Seguimiento suave del cursor acoplado con amortiguamiento crítico.
* `anim_interact_drag_file`: Anticipación ante archivo arrastrado sobre la mascota.

### G. Familia de Transición
* `anim_trans_enter`: Caída elástica desde arriba con aterrizaje amortiguado.
* `anim_trans_exit`: Encogimiento y desvanecimiento en partículas de pelusa.
