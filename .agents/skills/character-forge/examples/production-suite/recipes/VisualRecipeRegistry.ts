/**
 * @file VisualRecipeRegistry.ts
 * @description Registro y ejecutor de recetas visuales tipadas para Canvas 2D, SVG y WebGL/Three.js.
 * Incluye generador determinista de números pseudoaleatorios (PRNG) para texturas consistentes.
 */

export type RendererFamily = "canvas2d" | "svg" | "pseudo3d" | "webgl" | "threejs";

export interface Canvas2DInstruction {
  layer: string;
  operation: "fill_gradient" | "stroke" | "radial_glow" | "hatch_pattern" | "specular_spot";
  params: Record<string, any>;
}

export interface VisualRecipe {
  id: string;
  name: string;
  category: "soft" | "ceramic" | "textile" | "natural" | "hard" | "pictorial";
  description: string;
  targetRenderers: RendererFamily[];
  defaults: Record<string, any>;
  lightingModel: "flat" | "lambert_approx" | "phong_approx" | "cook_torrance_pbr";
  noiseSeedBehavior: "deterministic_prng" | "none" | "dynamic_noise";
  compileCanvas2D(seed?: number): Canvas2DInstruction[];
  applyCanvas2D?(
    ctx: any,
    bounds: { cx: number; cy: number; rx: number; ry: number },
    params: Record<string, any>,
    lightNorm: { x: number; y: number }
  ): void;
}

/**
 * Generador determinista simple splitmix32 para semillas reproducibles.
 */
export function splitmix32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x9e3779b9) | 0;
    let t = seed ^ (seed >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    return ((t = t ^ (t >>> 15)) >>> 0) / 4294967296;
  };
}

export class VisualRecipeRegistry {
  private static recipes: Map<string, VisualRecipe> = new Map();
  private static initialized: boolean = false;

  private static ensureInit(): void {
    if (this.initialized) return;
    this.registerDefaults();
    this.initialized = true;
  }

  public static register(recipe: VisualRecipe): void {
    this.ensureInit();
    this.recipes.set(recipe.id, recipe);
  }

  public static getRecipe(id: string): VisualRecipe | undefined {
    this.ensureInit();
    return this.recipes.get(id);
  }

  public static getAllRecipes(): VisualRecipe[] {
    this.ensureInit();
    return Array.from(this.recipes.values());
  }

  public static compileToCanvas2D(id: string, seed: number = 42): Canvas2DInstruction[] {
    this.ensureInit();
    const recipe = this.recipes.get(id);
    if (!recipe) {
      throw new Error(`Receta '${id}' no encontrada en el registro.`);
    }
    return recipe.compileCanvas2D(seed);
  }

  // Compatibilidad de instancia
  public register(recipe: VisualRecipe): void {
    VisualRecipeRegistry.register(recipe);
  }
  public get(id: string): VisualRecipe | undefined {
    return VisualRecipeRegistry.getRecipe(id);
  }
  public getAll(): VisualRecipe[] {
    return VisualRecipeRegistry.getAllRecipes();
  }

  private static registerDefaults(): void {
    // 1. Cerámica Esmaltada Kintsugi
    this.recipes.set("ceramic_kintsugi", {
      id: "ceramic_kintsugi",
      name: "Cerámica Esmaltada Kintsugi",
      category: "ceramic",
      description: "Porcelana marfil con penumbra profunda y highlight especular concentrado",
      targetRenderers: ["canvas2d", "pseudo3d", "threejs"],
      defaults: { baseColor: "#f8fafc", shadeColor: "#cbd5e1", clearcoat: 0.95 },
      lightingModel: "phong_approx",
      noiseSeedBehavior: "none",
      compileCanvas2D: () => [
        { layer: "diffuse_base", operation: "fill_gradient", params: { stops: ["#f8fafc", "#cbd5e1"] } },
        { layer: "subsurface_bounce", operation: "radial_glow", params: { color: "#e2e8f0", opacity: 0.3 } },
        { layer: "specular_highlight", operation: "specular_spot", params: { radiusRatio: 0.12, intensity: 0.85 } }
      ]
    });

    // 2. Fieltro Textil Peach-Fuzz
    this.recipes.set("felt_wool_peachfuzz", {
      id: "felt_wool_peachfuzz",
      name: "Fieltro Textil Artesanal Peach-Fuzz",
      category: "textile",
      description: "Superficie de lana mate con resplandor difuso en bordes y microfibras",
      targetRenderers: ["canvas2d", "threejs"],
      defaults: { baseColor: "#e2e8f0", rimColor: "#ffffff", fuzzDensity: 0.4 },
      lightingModel: "lambert_approx",
      noiseSeedBehavior: "deterministic_prng",
      compileCanvas2D: (seed: number = 101) => {
        const prng = splitmix32(seed);
        const microfibers = Array.from({ length: 8 }, () => Number((prng() * 1.5).toFixed(2)));
        return [
          { layer: "wool_matte_base", operation: "fill_gradient", params: { color: "#e2e8f0" } },
          { layer: "fuzz_rim_scattering", operation: "radial_glow", params: { edgeColor: "rgba(255,255,255,0.35)" } },
          { layer: "microfiber_stipple", operation: "hatch_pattern", params: { microfibers } }
        ];
      }
    });

    // 3. Vinilo Mate Art Toy
    this.recipes.set("vinyl_toy_matte", {
      id: "vinyl_toy_matte",
      name: "Vinilo Mate Art Toy",
      category: "soft",
      description: "Plástico suave sin brillos duros ni reflejos especulares punzantes",
      targetRenderers: ["canvas2d", "svg", "threejs"],
      defaults: { baseColor: "#38bdf8", shadeColor: "#0284c7" },
      lightingModel: "lambert_approx",
      noiseSeedBehavior: "none",
      compileCanvas2D: () => [
        { layer: "smooth_vinyl_base", operation: "fill_gradient", params: { stops: ["#38bdf8", "#0284c7"] } },
        { layer: "soft_wrap_lighting", operation: "radial_glow", params: { ambientOcclusion: 0.25 } }
      ]
    });

    // 4. Gel Translúcido Estilizado
    this.recipes.set("translucent_gel", {
      id: "translucent_gel",
      name: "Gel Translúcido Estilizado",
      category: "soft",
      description: "Masa gomosa con núcleo luminoso interno por dispersión subsuperficial",
      targetRenderers: ["canvas2d", "threejs"],
      defaults: { baseColor: "#ec4899", coreGlow: "#fbcfe8" },
      lightingModel: "phong_approx",
      noiseSeedBehavior: "none",
      compileCanvas2D: () => [
        { layer: "gel_outer_membrane", operation: "fill_gradient", params: { color: "#ec4899" } },
        { layer: "internal_core_glow", operation: "radial_glow", params: { glowColor: "#fbcfe8", radius: 0.55 } },
        { layer: "glossy_clearcoat", operation: "specular_spot", params: { intensity: 0.65 } }
      ]
    });

    // 5. Tinta y Grabado al Aguafuerte
    this.recipes.set("ink_etching_paper", {
      id: "ink_etching_paper",
      name: "Tinta y Grabado al Aguafuerte",
      category: "pictorial",
      description: "Estilo monocromo ferrogálico con tramas geométricas de hachurado",
      targetRenderers: ["canvas2d", "svg"],
      defaults: { inkColor: "#18181b", paperBase: "#fef3c7" },
      lightingModel: "flat",
      noiseSeedBehavior: "none",
      compileCanvas2D: () => [
        { layer: "paper_base", operation: "fill_gradient", params: { color: "#fef3c7" } },
        { layer: "contour_ink_stroke", operation: "stroke", params: { strokeWidth: 1.8, color: "#18181b" } },
        { layer: "geometric_hatching", operation: "hatch_pattern", params: { density: 12, angleDeg: 45 } }
      ]
    });
  }
}
