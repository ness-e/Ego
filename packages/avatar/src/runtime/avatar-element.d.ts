// Tipos de runtime/avatar-element.js.
//
// Este fichero sustituye a `avatar-element.js` en la resolución de tipos de
// TypeScript (un `.d.ts` junto a un `.js` gana al `.js`), así que debe
// declarar la superficie pública que el barrel del paquete reexporta.
//
// Dos consumidores:
//  - `src/index.js` reexporta la clase `EgoAvatar`.
//  - `apps/desktop/renderer/floating/floating-avatar.tsx` importa el módulo
//    SOLO por efecto (registra el custom element `<ego-avatar>`); no consume
//    ningún binding.
//
// La declaración completa de la clase (con todos sus métodos) vive en
// `index.d.ts` (raíz del paquete).

/** Custom element `<ego-avatar>`: avatar generativo determinista. */
export declare class EgoAvatar extends HTMLElement {
  /** Estado actual del avatar (vocabulario de 14 estados runtime). */
  getState(): string;
  /** Fija el estado del avatar. */
  setState(name: string, opts?: { immediate?: boolean }): void;
  /** Semilla -> genoma congelado. */
  setGene(path: string, value: unknown): unknown;
  /** Fusiona un parche en el genoma. */
  patchGenome(patch: Record<string, unknown>): unknown;
  /** Restablece el genoma al de la semilla. */
  resetGenome(): unknown;
  /** Activa o desactiva el seguimiento del puntero. */
  setPointerFollow(on: boolean): boolean;
  /** Estado del seguimiento del puntero. */
  isPointerFollow(): boolean;
  /** Silencia el motor de sonido. */
  mute(): void;
  /** Activa el motor de sonido. */
  unmute(): void;
  /** Estado de silencio. */
  isMuted(): boolean;
  /** Fija el volumen del motor de sonido. */
  setSoundVolume(v: number): number;
  /** Aplica un preset del studio. */
  applyStudioPreset(name: string): boolean;
  /** Serializa el avatar a SVG (vacío en modo studio). */
  toSVGString(): string;
  /** Versión del motor. */
  readonly version: string;
}

declare global {
  interface HTMLElementTagNameMap {
    'ego-avatar': EgoAvatar;
  }
}
