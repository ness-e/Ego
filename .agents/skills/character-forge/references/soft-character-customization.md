# Soft Character Customization & User Dressing System

Este módulo define la arquitectura que permite a los usuarios personalizar el aspecto, materiales, colores, proporciones y accesorios de la mascota en tiempo real.

---

## 1. Esquema de Configuración Personalizable

```typescript
export interface CharacterCustomizationConfig {
  version: "1.0.0";
  characterId: string;
  morphology: {
    bodyScaleY: number;        // [0.8, 1.2]
    bodyRoundness: number;     // Exponente superelipsoidal [1.8, 3.5]
    earScale: number;          // [0.5, 1.5]
    eyeSpacing: number;        // [0.30, 0.48]
  };
  surface: {
    materialRecipeId: string;  // "mat_short_plush", "mat_velvet_fuzz", etc.
    primaryColor: string;      // Hex
    secondaryColor: string;    // Hex
    bellyPatchColor?: string;  // Parche abdominal de diferente color
    fuzzDensity: number;       // [0.0, 1.0]
    roughnessMultiplier: number;
  };
  accessories: {
    headgearId?: string;       // "hat_beanie", "headphones_retro", "leaf_sprout"
    eyewearId?: string;        // "glasses_round", "monocle_brass", "sleep_mask"
    neckwearId?: string;       // "scarf_knit", "bell_collar", "bowtie"
  };
  personalityPreset: string;   // "curious_active", "zen_minimalist", etc.
}
```

---

## 2. Actualización Dinámica sin Reconstrucción de Escena

* **Materiales:** Se actualizan vía propiedades directas de uniformes GLSL o propiedades PBR (`material.color.setHex()`, `material.roughness = val`) sin reinstanciar mallas ni recargar geometrías.
* **Geometría:** Se deforma mediante *Morph Targets* precompilados o escala local de huesos del rig sin reinicializar el grafo de escena.
* **Accesorios:** Se acoplan a los sockets semánticos predefinidos (`HeadAttachmentSocket`, `ChestAttachmentSocket`) heredando la orientación y la inercia del cuerpo.
