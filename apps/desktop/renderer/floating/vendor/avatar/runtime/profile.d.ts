// Tipos de runtime/profile.js.
//
// Este fichero sustituye a `profile.js` en la resolución de tipos de
// TypeScript (un `.d.ts` junto a un `.js` gana al `.js`). Lo consume:
//   · el renderer (`@ego/avatar/runtime/profile.js`), para cotejar vocabularios
//     en un test TIPADO (sin esto, el import falla con TS2307);
//   · la puerta `scripts/build-types.mjs`, que genera el `.d.ts` raíz del
//     paquete a partir de los `.d.ts` de cada módulo.
//
// IMPLEMENTACIÓN PROPIA DE EGO: no es un port de ningún upstream.

/** Una entrada de rasgo, normalizada. */
export interface TraitEntry {
  /** El `TraitKind` canónico (`halo`, `antennae`, …). */
  kind: string;
  /** La magnitud del rasgo, 0…1. */
  intensity: number;
  /** Si el rasgo está activo. */
  enabled: boolean;
}

/** La silueta del motor que corresponde a una forma base del perfil. */
export interface BaseFormShape {
  /** Redondeo de la silueta: 0 = cuadrado, 100 = redondo. */
  roundness: number;
  /** Aplastado vertical (≤ 1). */
  ratio: number;
}

/** El perfil resuelto: las palancas del motor que el perfil mueve. */
export interface ResolvedProfile {
  /** La silueta (roundness + ratio). */
  shape: BaseFormShape;
  /** El apéndice del genoma (`antenna`, `ears`), si el perfil lo pone. */
  appendage?: string;
  /** La marca de la cabeza (`dots`), si el perfil la pone. */
  marking?: string;
  /** El aura del genoma (la única palanca de intensidad). */
  aura?: number;
  /** El accesorio del studio (un solo hueco). */
  accessory: string;
  /** Los rasgos que el motor NO expresa (se declaran, no se inventan). */
  unmapped: string[];
  /** Los rasgos que se aplican pero cuya INTENSIDAD no tiene palanca. */
  unmappedIntensity: string[];
}

/** El perfil que llega del renderer (atributos `base-form` / `traits` / `outfit`). */
export interface CharacterProfile {
  /** La forma base (`quantum-monolith`, `energy-core`, …). */
  baseForm?: string | null;
  /** Los rasgos: nombres (`["halo"]`) o entradas canónicas (con intensidad). */
  traits?: string[] | TraitEntry[] | string | null;
  /** El outfit (`crown`, `santaHat`, …). */
  outfit?: string | null;
}

/** Formas base del perfil → la silueta del motor. */
export declare const BASE_FORMS: Readonly<Record<string, BaseFormShape>>;

/** Rango del aura del genoma: la única palanca de intensidad del motor. */
export declare const AURA_RANGE: readonly [number, number];

/** Rasgos canónicos (`TraitKind`) → lo que el motor expresa. */
export declare const TRAIT_KINDS: Readonly<Record<string, Readonly<Record<string, string | number>>>>;

/** Los rasgos que el motor NO puede expresar (y por qué). */
export declare const UNMAPPED_TRAITS: readonly string[];

/** Los rasgos que se aplican pero cuya intensidad no tiene palanca. */
export declare const UNMAPPED_INTENSITIES: readonly string[];

/** Outfits del renderer → accesorio del studio. */
export declare const OUTFITS: Readonly<Record<string, string>>;

/** Outfits que el motor no expresa (no hay pieza equivalente). */
export declare const UNMAPPED_OUTFITS: readonly string[];

/** Accesorios que el motor tiene y este módulo no usa (reservados). */
export declare const ENGINE_ACCESSORIES: readonly string[];

/** Parsea el atributo `traits` a entradas con su intensidad. */
export declare function parseTraitEntries(
  json: string | TraitEntry[] | Array<string | TraitEntry> | null | undefined,
): TraitEntry[];

/** Los NOMBRES de los rasgos del atributo `traits` (acepta las dos formas). */
export declare function parseTraits(
  json: string | TraitEntry[] | Array<string | TraitEntry> | null | undefined,
): string[];

/** Resuelve el perfil a las palancas del motor. */
export declare function resolveProfile(
  profile?: CharacterProfile | null,
): ResolvedProfile;

/** Aplica el perfil resuelto a un genoma (devuelve uno nuevo). */
export declare function applyProfileToGenome(
  genome: Record<string, unknown>,
  profile: Partial<ResolvedProfile>,
): Record<string, unknown>;
