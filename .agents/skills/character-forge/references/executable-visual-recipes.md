# Biblioteca de Recetas Visuales Ejecutables (Executable Visual Recipes)

Este módulo establece el contrato tipado y los procedimientos técnicos reproducibles para construir materiales, texturas, efectos y superficies mediante código, vinculando cada receta a los renderizadores compatibles y prohibiendo la simulación de propiedades 3D en 2D sin aproximaciones explícitas.

---

## 1. Esquema Obligatorio de una Receta Visual (`VisualRecipe`)

Toda receta registrada en la biblioteca implementa el siguiente contrato TypeScript estricto:

```typescript
export type RendererFamily = "canvas2d" | "svg" | "pseudo3d" | "webgl" | "threejs";

export interface VisualRecipe {
  id: string;                                   // Identificador único estable
  name: string;                                 // Nombre canónico
  category: "soft" | "ceramic" | "textile" | "natural" | "hard" | "pictorial";
  description: string;                          // Descripción visual y justificación
  supportedRenderers: RendererFamily[];         // Tecnologías que pueden ejecutarla
  inputs: Record<string, { type: "number" | "color" | "boolean"; default: any; range?: [number, number] }>;
  defaults: Record<string, any>;
  constraints: { requiresNormals: boolean; requiresDepthWrite: boolean };
  lightingModel: "flat" | "lambert_approx" | "phong_approx" | "cook_torrance_pbr";
  performanceProfile: { estimatedCost: "low" | "medium" | "high"; allocsPerFrame: number };
  limitations: string[];
  version: string;

  /**
   * Ejecución para Canvas 2D
   */
  applyCanvas2D?(
    ctx: CanvasRenderingContext2D,
    bounds: { cx: number; cy: number; rx: number; ry: number },
    params: Record<string, any>,
    lightNorm: { x: number; y: number },
    seed?: number
  ): void;

  /**
   * Ejecución para Three.js
   */
  createThreeMaterial?(
    params: Record<string, any>,
    seed?: number
  ): any; // Devuelve THREE.Material
}
```

---

## 2. Generador de Ruido Procedural Determinista con Semilla (PRNG)

Para garantizar que texturas como grano, fibras de fieltro o grietas de cerámica se reproduzcan de forma idéntica en pruebas de regresión, se utiliza un generador pseudoaleatorio Mulberry32:

```typescript
export class DeterministicPRNG {
  private state: number;

  constructor(seed: number = 1337) {
    this.state = seed;
  }

  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}
```

---

## 3. Catálogo Canónico de 5 Recetas de Producción

### 3.1. `recipe_glazed_ceramic` (Cerámica Esmaltada Kintsugi)
* **Categoría**: `ceramic`
* **Tecnologías**: `canvas2d`, `pseudo3d`, `threejs`
* **Aproximación en Canvas 2D**: Gradiente difuso analítico + Penumbra interna profunda + Highlight especular concentrado ($r = 0.35 R$) + Trazado vectorial de grietas con oro metálico.
* **Aproximación en Three.js**: `MeshPhysicalMaterial` con `roughness = 0.18`, `clearcoat = 0.95`, `clearcoatRoughness = 0.05` y mapa de rugosidad procedural.

### 3.2. `recipe_peach_fuzz_felt` (Fieltro Textil Artesanal)
* **Categoría**: `textile`
* **Tecnologías**: `canvas2d`, `threejs`
* **Aproximación en Canvas 2D**: Micro-patrón de ruido de alta frecuencia amortiguado + Contorno suave con feathering + Resplandor de borde (*Rim light*) difuso simulando microvellosidades textiles.
* **Aproximación en Three.js**: Shader Fresnel Rim con decaimiento suave y textura procedural de ruido Perlin.

### 3.3. `recipe_matte_vinyl_toy` (Vinilo Mate Art Toy)
* **Categoría**: `soft`
* **Tecnologías**: `canvas2d`, `svg`, `threejs`
* **Aproximación en Canvas 2D**: Gradiente suave con baja saturación en sombras + Reflejo especular amplio y atenuado (dispersión difusa) sin brillo punzante.

### 3.4. `recipe_translucent_gel` (Gel / Goma Translúcida)
* **Categoría**: `soft`
* **Tecnologías**: `canvas2d` (aproximación estilizada), `threejs` (SSS)
* **Aproximación en Canvas 2D**: Núcleo interno más brillante con gradiente radial invertido (luz transmitida a través del cuerpo) + Borde semitransparente con `globalAlpha = 0.82`.

### 3.5. `recipe_copperplate_ink` (Tinta y Grabado al Aguafuerte)
* **Categoría**: `pictorial`
* **Tecnologías**: `canvas2d`, `svg`
* **Aproximación**: Silueta en tinta ferrogálica con patrones geométricos de hachurado cruzado (*cross-hatching*) a 45° cuya densidad se modula inversamente a la luz.

---

## 4. Matriz de Compatibilidad Técnica de Materiales

| Receta Visual | Canvas 2D | SVG | WebGL / Three.js | Coste CPU / GPU |
|---|---|---|---|---|
| **Cerámica Esmaltada** | ✅ Aproximación (Gradientes + Especular) | ✅ Filtro FeSpecularLighting | ✅ PBR Nativo (Cook-Torrance) | Bajo en 2D / Medio en 3D |
| **Fieltro Peach-Fuzz** | ✅ Patrón de Ruido + Rim | ⚠️ Alto coste de filtros | ✅ Shader Fresnel Nativo | Medio en 2D / Bajo en 3D |
| **Vinilo Mate** | ✅ Nativo (Gradiente lineal) | ✅ Nativo | ✅ PBR Nativo | Muy bajo |
| **Gel Translúcido** | ⚠️ Aproximación (Núcleo luminoso) | ⚠️ Limitado | ✅ SSS / Transmisión PBR | Bajo en 2D / Alto en 3D |
| **Grabado al Aguafuerte**| ✅ Patrones de trama SVG/Canvas | ✅ Patrón `<pattern>` | ⚠️ Requiere shader de trama | Bajo en 2D / Medio en 3D |
