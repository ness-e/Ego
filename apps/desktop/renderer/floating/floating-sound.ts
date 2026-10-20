// floating-sound.ts — Sonido procedural del flotante (Task 8, D3 + COUC-20).
//
// Port de `repos-referencia/avatar/src/runtime/sound.js`
// (MIT, (c) Louis Raillart — ver repos-referencia/avatar/LICENSE.md § `src/runtime/sound.js`;
// a su vez de `coucou/windows/src/core/sound.ts` 28 nombres + volumen 0.12/[0,0.2]
// + idle 1500 ms + `mochi/engine.ts:106-110` STATE_SOUND).
// Solo mecanismo (tablas + wrapper del motor); NADA visual de Mochi.
//
// Reglas de este modulo (contrato Task 8):
// - Cero WAV binarios: todo se sintetiza con Web Audio (recetas del avatar).
//   Este archivo NO referencia ni carga ningun asset `.wav`.
// - `soundFor("hitl_approval") === "approval"` (contrato mecanico).
// - `muted -> no-op`: `play()` retorna false sin tocar el motor.
// - Sin AudioContext (Node/tests/SSR) -> no-op: nunca lanza.
// - Envolver `createSoundEngine()` del avatar via inyeccion (`createEngine`)
//   o carga diferida (`createFloatingSoundWithAvatar`); sin motor el
//   wrapper degrada a no-op en vez de romper el flotante.

/** Los 28 nombres de coucou (sound.ts:6-11, literal via avatar sound.js:7-12). */
export const SOUND_NAMES = Object.freeze([
  "peek",
  "open",
  "close",
  "hover",
  "blip",
  "slap",
  "annoyed",
  "dizzy",
  "greet",
  "work",
  "finish",
  "error",
  "approval",
  "question",
  "approve",
  "gulp",
  "tick",
  "send",
  "love",
  "pop",
  "proud",
  "wink",
  "yawn",
  "attach",
  "think",
  "search",
  "rate",
  "sleep",
] as const);

export type SoundName = (typeof SOUND_NAMES)[number];

/** Volumen por defecto del original (sound.ts:17 via sound.js:15). */
export const SOUND_DEFAULT_VOLUME = 0.12;

/** Rango del slider del original: [0, 0.2] (sound.ts:79 via sound.js:18). */
export const SOUND_VOLUME_BOUNDS = Object.freeze([0, 0.2] as const);

/** Suspension por inactividad: 1500 ms (sound.ts:74 via sound.js:21). */
export const SOUND_IDLE_SUSPEND_MS = 1500;

/** Estado avatar -> sonido (coucou engine.ts:106-110, literal via sound.js:24-28). */
export const STATE_SOUND: Readonly<Record<string, SoundName>> = Object.freeze({
  working: "work",
  thinking: "think",
  searching: "search",
  approval: "approval",
  question: "question",
  error: "error",
  finished: "finish",
  ratelimit: "rate",
  sleeping: "sleep",
  dizzy: "dizzy",
});

/** Emote -> sonido (acorde con avatar runtime/states.js EMOTES, via sound.js:31-35). */
export const EMOTE_SOUND: Readonly<Record<string, SoundName>> = Object.freeze({
  love: "love",
  surprised: "pop",
  proud: "proud",
  annoyed: "annoyed",
  wink: "wink",
  yawn: "yawn",
  happy: "blip",
  angry: "annoyed",
  sad: "yawn",
  surprise: "pop",
  cool: "proud",
});

/** Accion semantica -> sonido (via sound.js:38-42). */
export const ACTION_SOUND: Readonly<Record<string, SoundName>> = Object.freeze({
  success: "finish",
  error: "error",
  waiting: "tick",
  hover: "hover",
  click: "blip",
  slap: "slap",
  greet: "greet",
  pop: "pop",
  send: "send",
  approve: "approve",
});

/**
 * Mapea un estado de atencion/HITL del flotante (o nombre de sonido directo)
 * al sonido procedural a reproducir.
 *
 * Contrato Task 8: `hitl_approval -> approval`. Cobertura del mapa del plan
 * (peek/open/close/hover/blip + work/finish/error/approval/question/approve
 * + think/search/rate/sleep): claves de atencion, estados avatar y acciones
 * passthrough; desconocido -> `blip` (fallback de `recipeFor` en sound.js:188).
 */
export function soundFor(attention: string): SoundName {
  switch (attention) {
    case "hitl_approval":
    case "alert":
    case "approval":
      return "approval";
    case "question":
      return "question";
    case "error":
      return "error";
    case "finished":
    case "success":
    case "finish":
      return "finish";
    case "expanded":
    case "working":
    case "work":
      return "work";
    case "compact":
    case "thinking":
    case "think":
      return "think";
    case "searching":
    case "search":
      return "search";
    case "ratelimit":
    case "rate":
      return "rate";
    case "sleeping":
    case "sleep":
      return "sleep";
    case "approve":
      return "approve";
    case "hover":
      return "hover";
    case "open":
      return "open";
    case "close":
      return "close";
    case "peek":
      return "peek";
    case "dizzy":
      return "dizzy";
    case "waiting":
    case "tick":
      return "tick";
    case "greet":
      return "greet";
    case "send":
      return "send";
    case "pop":
      return "pop";
    case "attach":
      return "attach";
    case "proud":
      return "proud";
    case "love":
      return "love";
    case "wink":
      return "wink";
    case "yawn":
      return "yawn";
    case "annoyed":
      return "annoyed";
    case "slap":
      return "slap";
    case "gulp":
      return "gulp";
    case "blip":
      return "blip";
    default:
      // STATE/EMOTE/ACTION passthrough por si llega la clave cruda del avatar.
      if (Object.hasOwn(STATE_SOUND, attention)) return STATE_SOUND[attention] ?? "blip";
      if (Object.hasOwn(EMOTE_SOUND, attention)) return EMOTE_SOUND[attention] ?? "blip";
      if (Object.hasOwn(ACTION_SOUND, attention)) return ACTION_SOUND[attention] ?? "blip";
      if ((SOUND_NAMES as readonly string[]).includes(attention)) {
        return attention as SoundName;
      }
      // hidden/idle/listening y desconocidos: blip discreto (fallback recipeFor).
      return "blip";
  }
}

/** true si hay Web Audio disponible en este entorno (browser con gesto). */
export function hasAudioSupport(): boolean {
  const g = globalThis as Record<string, unknown>;
  return (
    typeof g["AudioContext"] === "function" ||
    typeof g["webkitAudioContext"] === "function"
  );
}

/** Subconjunto del motor avatar que el flotante necesita (sound.js:447-463). */
export interface AvatarSoundEngine {
  play(name: string): boolean;
  setVolume(v: number): number;
  getVolume(): number;
  setEnabled(on: boolean): void;
  isEnabled(): boolean;
  idle(): void;
  resume(): void;
  dispose(): void;
}

export interface FloatingSoundEngineOptions {
  audioContext?: object | null;
  masterVolume?: number;
  enabled?: boolean;
  idleMs?: number;
}

export interface FloatingSoundOptions extends FloatingSoundEngineOptions {
  /** Silenciado persistente (FloatingWindowState.muted). true -> todo no-op. */
  muted?: boolean;
  /** Alias de masterVolume (ergonomia tests/callers). */
  volume?: number;
  /**
   * Fabrica del motor avatar (`createSoundEngine`). Inyectable para tests;
   * en browser se resuelve via `createFloatingSoundWithAvatar()`.
   * Si falta o lanza, el wrapper degrada a no-op (nunca rompe el flotante).
   */
  createEngine?: (opts: FloatingSoundEngineOptions) => AvatarSoundEngine;
}

/** Clamp al rango canonico [0, 0.2] (sound.js:195-201). */
function clampVolume(v: unknown): number {
  const [min, max] = SOUND_VOLUME_BOUNDS;
  const n = Number(v);
  if (!Number.isFinite(n)) return SOUND_DEFAULT_VOLUME;
  return Math.max(min, Math.min(max, n));
}

/**
 * Wrapper presentation-only del motor procedural del avatar.
 *
 * - `muted` -> `play()` retorna false sin tocar el motor.
 * - Sin motor (sin AudioContext / sin fabrica / fallo de construccion)
 *   -> no-op: `play()` retorna false, resto de metodos no lanzan.
 * - NUNCA carga binarios WAV: delega en recetas sintetizadas Web Audio.
 */
export class FloatingSound {
  private engine: AvatarSoundEngine | null = null;
  private muted: boolean;
  private volume: number;

  constructor(opts: FloatingSoundOptions = {}) {
    this.muted = opts.muted === true;
    this.volume =
      Number.isFinite(Number(opts.masterVolume)) || typeof opts.volume === "number"
        ? clampVolume(opts.volume ?? opts.masterVolume)
        : SOUND_DEFAULT_VOLUME;
    const factory = opts.createEngine;
    if (typeof factory === "function") {
      try {
        this.engine = factory({
          audioContext: opts.audioContext ?? null,
          masterVolume: this.volume,
          enabled: !this.muted,
          idleMs: opts.idleMs ?? SOUND_IDLE_SUSPEND_MS,
        });
      } catch {
        this.engine = null;
      }
    } else {
      this.engine = null;
    }
  }

  /** true si hay motor vivo y no silenciado (browser con AudioContext). */
  get audible(): boolean {
    return !this.muted && this.engine !== null;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted === true;
    try {
      this.engine?.setEnabled(!this.muted);
    } catch {
      // best-effort: el motor puede estar disposed.
    }
  }

  getVolume(): number {
    return this.volume;
  }

  setVolume(v: number): number {
    this.volume = clampVolume(v);
    try {
      this.engine?.setVolume(this.volume);
    } catch {
      // best-effort.
    }
    return this.volume;
  }

  /** Reproduce un sonido por nombre. muted/sin-motor -> false (no-op). */
  play(name: string): boolean {
    if (this.muted) return false;
    const engine = this.engine;
    if (!engine) return false;
    try {
      return engine.play(name) === true;
    } catch {
      return false;
    }
  }

  /** Reproduce el sonido del estado de atencion (`soundFor` + `play`). */
  playFor(attention: string): boolean {
    return this.play(soundFor(attention));
  }

  /** Programa la suspension idle del contexto (1500 ms, best-effort). */
  idle(): void {
    try {
      this.engine?.idle();
    } catch {
      // no-op.
    }
  }

  resume(): void {
    if (this.muted) return;
    try {
      this.engine?.resume();
    } catch {
      // no-op.
    }
  }

  dispose(): void {
    try {
      this.engine?.dispose();
    } catch {
      // no-op.
    }
    this.engine = null;
  }
}

/** Crea el wrapper sincrono (tests/Node: sin fabrica => no-op seguro). */
export function createFloatingSound(opts: FloatingSoundOptions = {}): FloatingSound {
  return new FloatingSound(opts);
}

// FIND-12-01: sonido vendorizado bajo el root servido (ver floating-avatar.tsx:
// specifier LITERAL dentro del root, sin @vite-ignore para code-split dev+prod).

/**
 * Crea el wrapper conectado al motor real del avatar (solo browser).
 * Import diferido: sin AudioContext o si la carga falla, retorna un
 * wrapper no-op en vez de lanzar. NUNCA importa WAV.
 */
export async function createFloatingSoundWithAvatar(
  opts: Omit<FloatingSoundOptions, "createEngine"> = {},
): Promise<FloatingSound> {
  if (!hasAudioSupport() && opts.audioContext == null) {
    return new FloatingSound({ ...opts });
  }
  try {
    // Literal a propósito (ver floating-avatar.tsx): code-split dev+prod.
    //
    // A6 (Ola 1b): el PAQUETE `@ego/avatar` es la fuente canónica; el
    // espejo vendorizado no se importa (D5: la copia se mantiene en el
    // repo; importarlo además duplicaría el chunk del motor).
    const mod = (await import("@ego/avatar/runtime/sound.js")) as {
      createSoundEngine: (o: FloatingSoundEngineOptions) => AvatarSoundEngine;
    };
    if (typeof mod.createSoundEngine !== "function") {
      return new FloatingSound({ ...opts });
    }
    return new FloatingSound({ ...opts, createEngine: mod.createSoundEngine });
  } catch {
    return new FloatingSound({ ...opts });
  }
}
