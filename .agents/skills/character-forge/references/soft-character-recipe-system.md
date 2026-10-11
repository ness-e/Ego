# Soft Character Recipe System Specification

Este módulo define el estándar de datos canónico para recetas de materiales, geometría y actuación ejecutable en Character Forge.

---

## 1. Esquema Canónico de Receta

```typescript
export interface UniversalCharacterRecipe {
  id: string;
  version: string;
  category: "geometry" | "material" | "facial" | "acting" | "lighting";
  supportedRenderers: ("threejs" | "r3f" | "canvas2d" | "svg")[];
  requiredCapabilities: ("webgl2" | "pbr_physical" | "float_textures" | "morph_targets")[];
  
  inputs: Record<string, {
    type: "number" | "color" | "string" | "boolean";
    default: any;
    range?: [number, number];
    description: string;
  }>;

  implementation: {
    entryFunction: string;
    dependencies: string[];
    glslChunks?: {
      vertexShaderChunk?: string;
      fragmentShaderChunk?: string;
    };
  };

  performanceProfile: {
    drawCalls: number;
    estimatedTriangles: number;
    gpuMemoryKb: number;
    tierTarget: "budget" | "medium" | "high";
  };

  previewCases: {
    name: string;
    params: Record<string, any>;
  }[];

  limitations: string[];
  provenance: string;
  license: "MIT" | "Apache-2.0";
}
```

---

## 2. Validación de Esquema y Fallbacks

* Toda receta debe declarar un `fallbackRecipeId` de nivel inferior (ej. si la GPU no soporta Shell Fur, degrada a `MeshPhysicalMaterial` con Sheen nivel A).
* Los parámetros numéricos se someten a `clamp()` estricto contra el rango permitido antes de enviarse al pipeline de renderizado.
