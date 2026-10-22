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

import type { Genome } from '../../index.d.ts';

/** Custom element `<ego-avatar>`: avatar generativo determinista. */
export declare class EgoAvatar extends HTMLElement {
  /** Estado actual del avatar (vocabulario de 15 estados runtime). */
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

  /* ── superficie que usan los tests (y el renderer) ─────────────────────
   * El elemento se prueba en blanco (white-box): los tests tocan miembros
   * internos para comprobar invariantes (el host del studio, el modo de
   * manos, el temporizador de auto-sleep). Declararlos aqui es lo que permite
   * que los tests entren en el typecheck del paquete (Ola 10) en vez de
   * quedar fuera.
   */

  /** Genoma actual (semilla -> genoma congelado). */
  getGenome(): Genome;
  /** Modo de render: 'svg' | 'studio'. */
  getMode(): string;
  /** Cambia el modo de render. */
  setMode(mode: string): string;
  /** Reproduce un emote. */
  play(name: string, opts?: { source?: string }): boolean;
  /** Reproduce una micro-animacion. */
  playMicro(name: string): boolean;
  /** Habla (boca + burbuja + sonido). */
  speak(text: string, seconds?: number): boolean;
  /** Fija un parametro del studio. */
  setStudioParam(key: string, value: unknown): boolean;
  /** Lee un parametro del studio. */
  getStudioParam(key: string): unknown;
  /** Atributos observados por el elemento. */
  static observedAttributes: string[];

  /* ── internos que los tests tocan (white-box) ─────────────────────────── */
  /** Modo del rig de manos: 'auto' | 'always' | 'hidden'. */
  _handsMode: string;
  /** Host del motor canvas (null en modo SVG). */
  _studioHost: unknown;
  /** Acceso al host del studio. */
  _studio(): unknown;
  /** Temporizador de auto-sleep. */
  _autoSleep: unknown;
  /** Consulta de movimiento reducido. */
  _runtimeMotionQuery: { matches: boolean } | undefined;
  /** Si el bucle de render esta corriendo. */
  _running: boolean;
  /** Adopta un estado que viene de fuera (puente Ego <-> studio). */
  _adoptExternalState(...args: any[]): void;
  /** Suena una receta del motor. */
  _playSound(...args: any[]): void;
  /** Genera una particula ambiente. */
  _spawnAmbientParticle(...args: any[]): void;
  /** Pinta la insignia del estado. */
  _applyBadgeContent(...args: any[]): void;
  /** Transforma la insignia (rotacion/escala del estado). */
  _applyBadgeTransform(...args: any[]): void;
  /** Refresca la insignia. */
  _updateBadge(...args: any[]): void;
  /** Aplica las poses y el parpadeo a los ojos. */
  _applyEyes(...args: any[]): void;
  /** Aplica el movimiento (rebote, inclinacion). */
  _applyMovement(...args: any[]): void;
  /** Pinta el tinte del estado. */
  _paintTint(...args: any[]): void;
  /** Refresca el halo. */
  _updateGlow(...args: any[]): void;
  /** Monta el avatar (SVG o studio). */
  _mount(...args: any[]): void;
  /** Arranca el bucle de render. */
  _start(...args: any[]): void;
  /** Para el bucle de render. */
  _stop(...args: any[]): void;
  /** Fija la semilla y regenera el genoma. */
  setSeed(...args: any[]): void;
  /** Silencia o activa el motor de sonido. */
  setSoundEnabled(...args: any[]): void;
  /** Volumen actual del motor de sonido. */
  getSoundVolume(): number;
  /** Suena una receta por nombre. */
  playSound(...args: any[]): boolean;
  /** Todos los parametros del studio. */
  getStudioParams(): Record<string, unknown>;
  /** Anota actividad (reinicia el auto-sleep). */
  noteActivity(...args: any[]): void;
  /** Al desconectar el elemento, se para el bucle. */
  disconnectedCallback(): void;
  /** Nodos internos del render (ojos, cuerpo, insignia). */
  _n: Record<string, unknown>;
  /** Modo de render actual: 'svg' | 'studio'. */
  _renderMode: string;
}

declare global {
  interface HTMLElementTagNameMap {
    'ego-avatar': EgoAvatar;
  }
}
