// Tipos mínimos FIND-12-01 para el import literal de floating-sound.ts.
// Reflejan el subconjunto que el flotante consume (ver runtime/sound.js de la
// referencia: `createSoundEngine` + motor con play/volumen/enabled/idle).
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

export interface VendorAvatarSoundEngineOptions {
  audioContext?: object | null;
  masterVolume?: number;
  enabled?: boolean;
  idleMs?: number;
}

export declare function createSoundEngine(
  opts?: VendorAvatarSoundEngineOptions,
): VendorAvatarSoundEngine;
