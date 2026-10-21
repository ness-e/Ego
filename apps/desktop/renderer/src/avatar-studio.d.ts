// Tipos del puente del studio del motor de personaje (`@ego/avatar/studio`).
//
// El paquete `@ego/avatar` es JS puro: su `exports` no expone declaraciones
// de tipos para el sub-path `./studio` (solo `./runtime/avatar-element.js` y
// `./runtime/sound.js` tienen `.d.ts` propio, mapeados por `paths` en
// `tsconfig.json`). Sin esta declaración ambiental, `import ... from
// "@ego/avatar/studio"` falla el typecheck con TS7016.
//
// Mismo patrón que `src/lodash.d.ts` (dependencia sin tipos).
//
// Solo se declara la superficie que consume el renderer (el guard del
// round-trip `test/avatar-studio-roundtrip.test.ts`).
declare module "@ego/avatar/studio" {
  /** Catálogo de estados del studio (26: 15 con dueño de Ego + 11 canvas-native). */
  export const STUDIO_STATES: ReadonlyArray<{
    name: string;
    label: string;
    emoji: string;
  }>;
  /** Estado de Ego → estado del studio. */
  export const EGO_TO_STUDIO_STATE: Readonly<Record<string, string>>;
  /** Estado del studio → estado de Ego (el viaje de vuelta). */
  export const STUDIO_TO_EGO_STATE: Readonly<Record<string, string>>;
  /** Traduce un estado de Ego al del studio (identidad si ya es válido). */
  export function studioStateForEgo(egoState: string): string;
  /** Emote de Ego → emote/acción del studio. */
  export function studioEmoteForEgo(emote: string): string;
}
