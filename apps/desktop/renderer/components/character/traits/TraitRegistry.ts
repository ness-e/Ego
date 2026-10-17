// TraitRegistry.ts — Registro y Presets de Rasgos Morfológicos y Energéticos (CHAR-07)
// Basado en docs/architecture/character-system.md §8, §10, §12 y CHAR-04.
// REGLA INNEGOCIABLE: CERO ROPA HUMANA. Solo rasgos anatómicos, geométricos y lumínicos.

import type { RGB } from "../core/CharacterEngine.js";
import { type HeadFrame, proj } from "../wardrobe/CharacterWardrobe.js";

export type TraitCategory = "sensor" | "crest" | "visor" | "aura" | "glyph";

export type TraitLayer = "back" | "body" | "front" | "overlay";

export interface CharacterTrait {
  id: string;
  name: string;
  category: TraitCategory;
  layer: TraitLayer;
  compatibleCategories: TraitCategory[];
  draw(ctx: CanvasRenderingContext2D, head: HeadFrame, color: RGB, alpha: number): void;
}

export interface DomainCharacterPreset {
  id: string;
  name: string;
  domain: string;
  bodyColors: [string, string]; // [top, bottom] gradiente en hex
  accentColor: RGB;
  eyeShape: "pill" | "wide" | "dot" | "line" | "flat" | "happy" | "cup";
  baseForm?: "delta-core" | "quantum-monolith" | "energy-core" | "fractal-polyhedron" | "coucou-mochi"; // Silueta geométrica procedural
  outfitId?: string | null;      // Cero ropa humana (default: null)
  traits: string[];              // IDs de traits activos
  description: string;
}

/**
 * Registro de rasgos compatibles y presets de especialidad.
 */
export class TraitRegistry {
  private static _traits = new Map<string, CharacterTrait>();
  private static _presets = new Map<string, DomainCharacterPreset>();
  private static _initialized = false;

  public static initialize(): void {
    if (this._initialized) return;
    this._initialized = true;

    // 1. Registro de Traits Morfológicos Nativos
    this.registerTrait({
      id: "sensor_antenna_scanner",
      name: "Antena Sensorial de Escaneo",
      category: "sensor",
      layer: "front",
      compatibleCategories: ["aura", "glyph", "visor"],
      draw: (ctx, head, color, alpha) => {
        // Antena central superior que proyecta un nodo de escaneo esférico en 3D
        const tipPos = proj(head, [0, 1.25, 0.1]);
        const basePos = proj(head, [0, 0.9, 0]);
        if (tipPos.z < -0.2) return;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = `rgba(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)}, 0.8)`;
        ctx.lineWidth = Math.max(1.5, head.R * 0.04);
        ctx.lineCap = "round";

        ctx.beginPath();
        ctx.moveTo(basePos.x, basePos.y);
        ctx.lineTo(tipPos.x, tipPos.y);
        ctx.stroke();

        // Nodo emisor orbital
        const r = head.R * 0.08;
        ctx.beginPath();
        ctx.arc(tipPos.x, tipPos.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)})`;
        ctx.fill();

        // Destello perimetral
        ctx.beginPath();
        ctx.arc(tipPos.x, tipPos.y, r * 1.6, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)}, 0.35)`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      },
    });

    this.registerTrait({
      id: "visor_analytical",
      name: "Visor Óptico Holográfico",
      category: "visor",
      layer: "front",
      compatibleCategories: ["sensor", "aura", "crest"],
      draw: (ctx, head, color, alpha) => {
        // Franja holográfica transversal semi-translúcida a la altura de los ojos
        const left = proj(head, [-0.55, -0.1, 0.75]);
        const right = proj(head, [0.55, -0.1, 0.75]);
        if (left.z <= 0 && right.z <= 0) return;

        ctx.save();
        ctx.globalAlpha = alpha * 0.75;
        const grad = ctx.createLinearGradient(left.x, left.y, right.x, right.y);
        grad.addColorStop(0, `rgba(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)}, 0.1)`);
        grad.addColorStop(0.5, `rgba(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)}, 0.45)`);
        grad.addColorStop(1, `rgba(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)}, 0.1)`);

        ctx.strokeStyle = grad;
        ctx.lineWidth = head.R * 0.16;
        ctx.beginPath();
        ctx.moveTo(left.x, left.y);
        ctx.lineTo(right.x, right.y);
        ctx.stroke();
        ctx.restore();
      },
    });

    this.registerTrait({
      id: "crest_logic_prism",
      name: "Cresta Geométrica Angular",
      category: "crest",
      layer: "back",
      compatibleCategories: ["glyph", "aura"],
      draw: (ctx, head, color, alpha) => {
        // Prisma angular en la coronilla de la cabeza que aporta silueta de precisión técnica
        const center = proj(head, [0, 0.98, -0.05]);
        const peak = proj(head, [0, 1.35, -0.1]);
        const leftWing = proj(head, [-0.35, 1.05, -0.15]);
        const rightWing = proj(head, [0.35, 1.05, -0.15]);

        ctx.save();
        ctx.globalAlpha = alpha * 0.85;
        ctx.fillStyle = `rgba(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)}, 0.9)`;
        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.lineTo(leftWing.x, leftWing.y);
        ctx.lineTo(peak.x, peak.y);
        ctx.lineTo(rightWing.x, rightWing.y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      },
    });

    this.registerTrait({
      id: "aura_harmonic_halo",
      name: "Halo Perimetral de Resonancia",
      category: "aura",
      layer: "overlay",
      compatibleCategories: ["glyph", "crest", "sensor"],
      draw: (ctx, head, color, alpha) => {
        // Anillo de resonancia perimetral que orbita suavemente
        ctx.save();
        ctx.globalAlpha = alpha * 0.4;
        ctx.strokeStyle = `rgb(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)})`;
        ctx.lineWidth = Math.max(1, head.R * 0.03);
        ctx.setLineDash([4, 6]);

        ctx.beginPath();
        ctx.ellipse(0, -head.R * 0.1, head.R * 0.95, head.R * 0.85, head.yaw * 0.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      },
    });

    this.registerTrait({
      id: "sensor_bipolar_nodes",
      name: "Nodos Bipolares de Telemetría",
      category: "sensor",
      layer: "front",
      compatibleCategories: ["aura", "glyph"],
      draw: (ctx, head, color, alpha) => {
        // Dos pequeños satélites sensoriales a los costados temporales
        const left = proj(head, [-0.85, 0.4, 0]);
        const right = proj(head, [0.85, 0.4, 0]);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgb(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)})`;
        const r = head.R * 0.055;

        if (left.z >= -0.2) {
          ctx.beginPath();
          ctx.arc(left.x, left.y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        if (right.z >= -0.2) {
          ctx.beginPath();
          ctx.arc(right.x, right.y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      },
    });

    this.registerTrait({
      id: "crest_milestone_crown",
      name: "Corona Geométrica de Fases",
      category: "crest",
      layer: "back",
      compatibleCategories: ["aura", "sensor"],
      draw: (ctx, head, color, alpha) => {
        // Arreglo de 3 agujas o satélites de hitos sobre la coronilla
        const p1 = proj(head, [-0.3, 1.2, 0]);
        const p2 = proj(head, [0, 1.35, 0]);
        const p3 = proj(head, [0.3, 1.2, 0]);

        ctx.save();
        ctx.globalAlpha = alpha * 0.9;
        ctx.fillStyle = `rgb(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)})`;
        const r = head.R * 0.045;

        for (const p of [p1, p2, p3]) {
          if (p.z >= -0.3) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      },
    });

    // 2. Registro de Presets Canónicos de Dominio (Cero Ropa Humana, Pura Geometría y Rasgos)
    this.registerPreset({
      id: "ego.nucleus",
      name: "Ego Nucleus",
      domain: "core",
      bodyColors: ["#EDEDEF", "#C4C5CA"],
      accentColor: [0.902, 0.914, 0.933],
      eyeShape: "pill",
      baseForm: "delta-core",
      outfitId: null,
      traits: [],
      description: "Coordinador general del sistema. Criatura sobria y equilibrada con proporciones canónicas Delta Core.",
    });

    this.registerPreset({
      id: "researcher",
      name: "Investigador Cognitivo",
      domain: "knowledge",
      bodyColors: ["#E0F2FE", "#BAE6FD"], // Cian zafiro claro
      accentColor: [0.06, 0.71, 0.83],
      eyeShape: "line",
      baseForm: "delta-core",
      outfitId: null,
      traits: ["sensor_antenna_scanner", "visor_analytical"],
      description: "Especialista en investigación, síntesis documental y búsqueda en VantaDB.",
    });

    this.registerPreset({
      id: "code_reviewer",
      name: "Revisor de Código",
      domain: "engineering",
      bodyColors: ["#EDE9FE", "#DDD6FE"], // Violeta índigo sobrio
      accentColor: [0.545, 0.361, 0.965],
      eyeShape: "wide",
      baseForm: "delta-core",
      outfitId: null,
      traits: ["crest_logic_prism"],
      description: "Arquitectura, verificación de contratos, análisis estático de código y suites de test.",
    });

    this.registerPreset({
      id: "copywriter",
      name: "Redactor & PRDs",
      domain: "product",
      bodyColors: ["#FEF3C7", "#FDE68A"], // Ámbar cálido / oro solar
      accentColor: [0.961, 0.62, 0.043],
      eyeShape: "happy",
      baseForm: "delta-core",
      outfitId: null,
      traits: ["aura_harmonic_halo"],
      description: "Especificaciones, diseño de producto, narrativa y claridad de comunicación.",
    });

    this.registerPreset({
      id: "analyst",
      name: "Analista de Datos",
      domain: "analytics",
      bodyColors: ["#D1FAE5", "#A7F3D0"], // Menta esmeralda
      accentColor: [0.06, 0.73, 0.51],
      eyeShape: "dot",
      baseForm: "delta-core",
      outfitId: null,
      traits: ["sensor_bipolar_nodes"],
      description: "Auditoría de cuotas, telemetría de rendimiento y modelos de consumo económico.",
    });

    this.registerPreset({
      id: "planner",
      name: "Planificador de Roadmap",
      domain: "planning",
      bodyColors: ["#F3E8FF", "#E9D5FF"], // Amatista sobrio
      accentColor: [0.659, 0.333, 0.969],
      eyeShape: "flat",
      baseForm: "delta-core",
      outfitId: null,
      traits: ["crest_milestone_crown"],
      description: "Gestión de dependencias, descomposición de tareas y ordenamiento temporal.",
    });
  }

  public static registerTrait(trait: CharacterTrait): void {
    this._traits.set(trait.id, trait);
  }

  public static getTrait(id: string): CharacterTrait | undefined {
    this.initialize();
    return this._traits.get(id);
  }

  public static listTraits(): CharacterTrait[] {
    this.initialize();
    return Array.from(this._traits.values());
  }

  public static registerPreset(preset: DomainCharacterPreset): void {
    this._presets.set(preset.id, preset);
  }

  public static getPreset(idOrDomain: string): DomainCharacterPreset {
    this.initialize();
    const exact = this._presets.get(idOrDomain);
    if (exact) return exact;

    // Búsqueda por coincidencia de dominio
    for (const preset of this._presets.values()) {
      if (preset.domain === idOrDomain || idOrDomain.toLowerCase().includes(preset.id)) {
        return preset;
      }
    }

    return this._presets.get("ego.nucleus")!;
  }

  public static listPresets(): DomainCharacterPreset[] {
    this.initialize();
    return Array.from(this._presets.values());
  }

  /**
   * Valida si un conjunto de traits es mutuamente compatible sin solapamientos.
   */
  public static validateCompatibility(traitIds: string[]): { valid: boolean; conflicts: string[] } {
    this.initialize();
    const traits = traitIds.map((id) => this._traits.get(id)).filter(Boolean) as CharacterTrait[];
    const conflicts: string[] = [];

    for (let i = 0; i < traits.length; i++) {
      for (let j = i + 1; j < traits.length; j++) {
        const a = traits[i];
        const b = traits[j];
        if (!a || !b) continue;
        if (a.category === b.category) {
          conflicts.push(`Categoría duplicada '${a.category}' entre '${a.id}' y '${b.id}'`);
        } else if (!a.compatibleCategories.includes(b.category)) {
          conflicts.push(`'${a.id}' no es compatible con la categoría '${b.category}' de '${b.id}'`);
        }
      }
    }

    return {
      valid: conflicts.length === 0,
      conflicts,
    };
  }

  /**
   * Renderiza los traits de una capa específica (`back`, `body`, `front`, `overlay`).
   */
  public static renderLayer(
    layer: TraitLayer,
    ctx: CanvasRenderingContext2D,
    head: HeadFrame,
    traitIds: string[],
    color: RGB,
    alpha = 1.0,
  ): void {
    this.initialize();
    for (const id of traitIds) {
      const trait = this._traits.get(id);
      if (trait && trait.layer === layer) {
        ctx.save();
        trait.draw(ctx, head, color, alpha);
        ctx.restore();
      }
    }
  }
}
