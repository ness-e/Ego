// CharacterMorph.ts — Transición e Interpolación de Identidad entre Sub-Egos (CHAR-09)
// Morfología suave (350–550 ms) entre colores, ojos y atuendos con respeto estricto a prefers-reduced-motion.

import type { RGB, EyeShape } from "../core/CharacterEngine.js";
import { hexToRGB } from "../core/CharacterEngine.js";
import type { DomainCharacterPreset } from "../traits/TraitRegistry.js";

export interface MorphTarget {
  bodyColor: RGB;
  eyeShape: EyeShape;
  baseForm?: "delta-core" | "coucou-mochi";
  outfitId?: string | null;
  accentColor?: RGB;
}

/**
 * Función de aceleración cúbica (ease-in-out) para morfismos visuales naturales
 */
export function easeInOutCubic(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

/**
 * Interpola linealmente entre dos colores RGB enteros
 */
export function lerpRGB(a: RGB, b: RGB, t: number): RGB {
  const eased = easeInOutCubic(t);
  const r = Math.round(a[0] + (b[0] - a[0]) * eased);
  const g = Math.round(a[1] + (b[1] - a[1]) * eased);
  const bVal = Math.round(a[2] + (b[2] - a[2]) * eased);
  return [r, g, bVal] as const;
}

/**
 * Verifica si el usuario tiene activada la preferencia de reducción de movimiento en el SO
 */
export function isReducedMotionPreferred(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Extrae un MorphTarget a partir de un DomainCharacterPreset
 */
export function presetToMorphTarget(
  preset: DomainCharacterPreset,
  overrideOutfitId?: string | null,
  overrideBaseForm?: "delta-core" | "coucou-mochi"
): MorphTarget {
  const primaryHex = preset.bodyColors[0] || "#93c5fd";
  return {
    bodyColor: hexToRGB(primaryHex),
    eyeShape: preset.eyeShape,
    baseForm: overrideBaseForm !== undefined ? overrideBaseForm : (preset.baseForm ?? "delta-core"),
    outfitId: overrideOutfitId !== undefined ? overrideOutfitId : (preset.outfitId ?? null),
    accentColor: preset.accentColor,
  };
}

/**
 * Controlador de morphing continuo o instantáneo según accesibilidad (CHAR-09)
 */
export class CharacterMorphController {
  private fromTarget: MorphTarget | null = null;
  private toTarget: MorphTarget | null = null;
  private startTimeMs = 0;
  private durationMs: number;
  private active = false;
  private onUpdateCallback?: (current: MorphTarget, progress: number) => void;
  private onCompleteCallback?: () => void;
  private animFrameId: number | null = null;

  constructor(durationMs = 450) {
    // 350-550ms ventana canónica (mascota.md §4)
    this.durationMs = Math.max(350, Math.min(550, durationMs));
  }

  /**
   * Inicia la transición morfológica entre dos Sub-Egos
   */
  public start(
    from: MorphTarget,
    to: MorphTarget,
    onUpdate?: (current: MorphTarget, progress: number) => void,
    onComplete?: () => void
  ): void {
    this.cancel();

    this.fromTarget = from;
    this.toTarget = to;
    this.onUpdateCallback = onUpdate;
    this.onCompleteCallback = onComplete;

    // Regla de accesibilidad (mascota.md §4): si prefers-reduced-motion está activo, corte instantáneo
    if (isReducedMotionPreferred()) {
      this.onUpdateCallback?.(to, 1);
      this.onCompleteCallback?.();
      return;
    }

    this.startTimeMs = performance.now();
    this.active = true;
    this.loop();
  }

  private loop = (): void => {
    if (!this.active || !this.fromTarget || !this.toTarget) return;

    const now = performance.now();
    const elapsed = now - this.startTimeMs;
    const progress = Math.min(1, elapsed / this.durationMs);

    const currentTarget: MorphTarget = {
      bodyColor: lerpRGB(this.fromTarget.bodyColor, this.toTarget.bodyColor, progress),
      // La forma geométrica conmuta al superar el 50% de la transición
      baseForm: progress < 0.5 ? this.fromTarget.baseForm : this.toTarget.baseForm,
      // La forma de los ojos conmuta a la mitad del morphing
      eyeShape: progress < 0.5 ? this.fromTarget.eyeShape : this.toTarget.eyeShape,
      // El atuendo conmuta al superar el 50% de la transición
      outfitId: progress < 0.5 ? this.fromTarget.outfitId : this.toTarget.outfitId,
      accentColor:
        this.fromTarget.accentColor && this.toTarget.accentColor
          ? lerpRGB(this.fromTarget.accentColor, this.toTarget.accentColor, progress)
          : (progress < 0.5 ? this.fromTarget.accentColor : this.toTarget.accentColor),
    };

    this.onUpdateCallback?.(currentTarget, progress);

    if (progress >= 1) {
      this.active = false;
      this.onCompleteCallback?.();
    } else {
      if (typeof window !== "undefined" && window.requestAnimationFrame) {
        this.animFrameId = window.requestAnimationFrame(this.loop);
      }
    }
  };

  /**
   * Cancela la animación en curso si la hubiese
   */
  public cancel(): void {
    this.active = false;
    if (this.animFrameId !== null && typeof window !== "undefined" && window.cancelAnimationFrame) {
      window.cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public isActive(): boolean {
    return this.active;
  }
}
