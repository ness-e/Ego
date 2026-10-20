// Tipos de runtime/sound.js.
//
// Este fichero NO es un stub mínimo: sustituye a `sound.js` en la resolución
// de tipos de TypeScript (un `.d.ts` junto a un `.js` gana al `.js`), así que
// debe declarar TODA la superficie pública del módulo, no solo el subconjunto
// que consume el flotante.
//
// Declarados aquí:
//  - El motor procedural (`createSoundEngine`) que consume el renderer
//    (`apps/desktop/renderer/floating/floating-sound.ts`).
//  - Las tablas y el catálogo de recetas que reexporta el barrel del paquete
//    (`src/index.js`).
//
// La API pública completa del paquete vive en `index.d.ts` (raíz).

/** Los 28 nombres de sonido del catálogo. */
export declare const SOUND_NAMES: readonly string[];

/** Volumen por defecto del motor (0.12). */
export declare const SOUND_DEFAULT_VOLUME: number;

/** Rango de volumen admitido: [0, 0.2]. */
export declare const SOUND_VOLUME_BOUNDS: readonly [number, number];

/** Suspende el contexto de audio tras esta ms de inactividad. */
export declare const SOUND_IDLE_SUSPEND_MS: number;

/** Estado del avatar → nombre de sonido. */
export declare const STATE_SOUND: Readonly<Record<string, string>>;

/** Emote del avatar → nombre de sonido. */
export declare const EMOTE_SOUND: Readonly<Record<string, string>>;

/** Acción semántica → nombre de sonido. */
export declare const ACTION_SOUND: Readonly<Record<string, string>>;

/** Recetas de síntesis: nombre → pasos de oscillator/gain. */
export declare const SOUND_RECIPES: Readonly<Record<string, unknown>>;

/** Devuelve la receta de un nombre de sonido (o `null` si no existe). */
export declare function recipeFor(name: string): unknown;

/** Motor de sonido procedural. */
export interface VendorAvatarSoundEngine {
  play(name: string): boolean;
  setVolume(v: number): number;
  getVolume(): number;
  setEnabled(on: boolean): void;
  isEnabled(): boolean;
  idle(): void;
  resume(): void;
  dispose(): void;
}

/** Opciones de construcción del motor. */
export interface VendorAvatarSoundEngineOptions {
  audioContext?: object | null;
  masterVolume?: number;
  enabled?: boolean;
  idleMs?: number;
}

/** Crea el motor de sonido procedural. */
export declare function createSoundEngine(
  opts?: VendorAvatarSoundEngineOptions,
): VendorAvatarSoundEngine;
