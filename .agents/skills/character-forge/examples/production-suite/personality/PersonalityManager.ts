/**
 * @file PersonalityManager.ts
 * @description Modulador de Personalidad Conductual y Reactividad Contextual en 8 Dimensiones.
 * Ajusta parámetros cinemáticos físicos (omega0, zeta, pausas, amplitudes de anticipación)
 * según el perfil conductual configurado y el estado emocional contextual.
 */

export interface PersonalityVector {
  curiosity: number;       // [0, 1] Exploración vs Indiferencia
  shyness: number;         // [0, 1] Distancia espacial y repliegue ocular
  energy: number;          // [0, 1] Velocidad y frecuencia de micro-movimientos
  diligence: number;       // [0, 1] Fidelidad de respuesta ante estímulos de trabajo
  whimsy: number;          // [0, 1] Frecuencia de comportamientos lúdicos emergentes
  skepticism: number;      // [0, 1] Suspicacia ante fallos / tiempo de observación analítica
  empathy: number;         // [0, 1] Mimetismo y sincronización con el usuario
  stoicism: number;        // [0, 1] Resistencia a sobresaltos o cambios bruscos
}

export interface PhysicalKinematicTuning {
  omega0: number;          // Frecuencia natural angular (rad/s)
  zeta: number;            // Coeficiente de amortiguamiento
  anticipationRatio: number; // Factor de compresión opuesta (-0.05 a -0.25)
  settlePauseMs: number;   // Pausa de asimilación cognitiva
  blinkFrequencyHz: number;// Frecuencia base de parpadeo
}

export type PersonalityArchetype = "zen_minimalist" | "hyperactive_scout" | "stoic_engineer" | "whimsical_companion";

export class PersonalityManager {
  private currentVector: PersonalityVector;

  constructor(archetype: PersonalityArchetype = "zen_minimalist") {
    this.currentVector = this.getArchetypePreset(archetype);
  }

  public getVector(): PersonalityVector {
    return { ...this.currentVector };
  }

  public setVector(vector: Partial<PersonalityVector>): void {
    this.currentVector = {
      ...this.currentVector,
      ...vector
    };
    this.clampVector();
  }

  public setArchetype(archetype: PersonalityArchetype): void {
    this.currentVector = this.getArchetypePreset(archetype);
  }

  /**
   * Proyecta el vector multidimensional a parámetros físicos concretos del oscilador armónico.
   */
  public deriveKinematicTuning(): PhysicalKinematicTuning {
    const { energy, stoicism, whimsy, shyness } = this.currentVector;

    // Frecuencia natural: la energía incrementa la agilidad, el estoicismo la suaviza
    // Rango operativo canónico: 12.0 a 24.0 rad/s
    const omega0 = 12.0 + (energy * 10.0) - (stoicism * 3.0);

    // Amortiguamiento zeta:
    // Ventana viva de animación elástica con peso orgánico [0.50, 0.64]
    // Produce overshoot controlado de 8% a 22%, evitando tanto rebotes histriónicos como rigidez inerte.
    const baseZeta = 0.58;
    const zetaMod = (shyness * 0.04) + (stoicism * 0.03) - (whimsy * 0.05);
    const zeta = Math.max(0.50, Math.min(0.64, baseZeta + zetaMod));

    // Anticipación: mayor picardía o energía aumentan el encogimiento preparatorio
    const anticipationRatio = -0.08 - (energy * 0.08) - (whimsy * 0.06);

    // Pausa cognitiva en reposo
    const settlePauseMs = Math.round(150 + (stoicism * 250) - (energy * 100));

    // Parpadeo ocular: menor con alta concentración o diligencia, mayor con curiosidad relajada
    const blinkFrequencyHz = 0.25 + (energy * 0.3) - (this.currentVector.diligence * 0.15);

    return {
      omega0: Number(omega0.toFixed(2)),
      zeta: Number(zeta.toFixed(3)),
      anticipationRatio: Number(anticipationRatio.toFixed(3)),
      settlePauseMs: Math.max(50, settlePauseMs),
      blinkFrequencyHz: Number(blinkFrequencyHz.toFixed(3))
    };
  }

  private clampVector(): void {
    for (const key of Object.keys(this.currentVector) as (keyof PersonalityVector)[]) {
      this.currentVector[key] = Math.max(0, Math.min(1, this.currentVector[key]));
    }
  }

  private getArchetypePreset(archetype: PersonalityArchetype): PersonalityVector {
    switch (archetype) {
      case "zen_minimalist":
        return {
          curiosity: 0.5,
          shyness: 0.3,
          energy: 0.35,
          diligence: 0.8,
          whimsy: 0.2,
          skepticism: 0.4,
          empathy: 0.7,
          stoicism: 0.85
        };
      case "hyperactive_scout":
        return {
          curiosity: 0.95,
          shyness: 0.1,
          energy: 0.9,
          diligence: 0.6,
          whimsy: 0.85,
          skepticism: 0.2,
          empathy: 0.65,
          stoicism: 0.15
        };
      case "stoic_engineer":
        return {
          curiosity: 0.7,
          shyness: 0.2,
          energy: 0.4,
          diligence: 0.95,
          whimsy: 0.1,
          skepticism: 0.9,
          empathy: 0.5,
          stoicism: 0.9
        };
      case "whimsical_companion":
        return {
          curiosity: 0.8,
          shyness: 0.25,
          energy: 0.75,
          diligence: 0.5,
          whimsy: 0.95,
          skepticism: 0.15,
          empathy: 0.85,
          stoicism: 0.3
        };
    }
  }
}
