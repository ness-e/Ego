// index.d.ts — API pública de Ego Avatar / Robot Studio.

export type StateName =
  | 'idle'
  | 'thinking'
  | 'working'
  | 'searching'
  | 'listening'
  | 'waiting'
  | 'success'
  | 'finished'
  | 'error'
  | 'ratelimit'
  | 'approval'
  | 'question'
  | 'dizzy'
  | 'sleeping';

export type EmoteName =
  | 'love'
  | 'surprised'
  | 'proud'
  | 'annoyed'
  | 'wink'
  | 'yawn'
  | 'happy'
  | 'angry'
  | 'surprise'
  | 'sad'
  | 'cool';

export type ActionName = 'success' | 'error' | 'waiting' | 'inspect' | 'roll' | 'greet';
export type MicroName =
  | 'squash' | 'gulp' | 'errorShake' | 'approvalHop' | 'badgePop' | 'loveLift'
  | 'surpriseLift' | 'proudTilt' | 'winkTilt' | 'winkTiltShort' | 'yawn' | 'happyBlush'
  | 'greet' | 'greetHands' | 'happyBounce' | 'happyPop' | 'annoyedHead' | 'loveRock'
  | 'hop' | 'roll' | 'rollDouble';
export type SoundName =
  | 'peek' | 'open' | 'close' | 'hover' | 'blip' | 'slap' | 'annoyed' | 'dizzy'
  | 'greet' | 'work' | 'finish' | 'error' | 'approval' | 'question' | 'approve'
  | 'gulp' | 'tick' | 'send' | 'love' | 'pop' | 'proud' | 'wink' | 'yawn'
  | 'attach' | 'think' | 'search' | 'rate' | 'sleep';
export type MotionMode = 'auto' | 'full' | 'reduce';

/** Genoma inmutable de un avatar (resultado de generateGenome). */
export interface Genome {
  readonly seed: string;
  readonly shape: {
    readonly roundness: number; // 0–100 (cabeza del rig: cuadrado→redondo)
    readonly ratio: number; // alto/ancho 0.88–1.12 (solo aplasta)
  };
  readonly eyes: {
    readonly scale: number;
    readonly spacing: number;
    readonly yBias: number;
  };
  readonly palette: {
    readonly hue: number;
    readonly sat: number;
    readonly deepShift: number;
    readonly accentHue: number;
    readonly accentSat: number;
    readonly accentLight: number;
    readonly inkLight: number;
  };
  readonly marking: 'none' | 'dots' | 'stripe' | 'orbit';
  readonly markingDetail: unknown;
  readonly appendage: 'none' | 'antenna' | 'sprout' | 'ears';
  readonly aura: number;
  readonly temperament: number; // 0–1
}

/** Pose ocular del rig: 10 números + clave + mirada. */
export interface PoseState {
  key: string;
  w: number;
  h: number;
  rx: number;
  topY: number;
  bottomY: number;
  topAL: number;
  topAR: number;
  bottomAL: number;
  bottomAR: number;
  scale: number;
  gaze: number[] | null;
}

/** Delta estándar de efectos oculares (runtime/fx-eyes.js). */
export interface EyeDelta {
  dx: number;
  dy: number;
  sx: number;
  sy: number;
  lid: number | null;
  done: boolean;
}

export interface StateCfg {
  tint: string | null;
  tintStrength: number;
  pose: string;
  badge: 'dots' | 'dot' | 'bang' | 'question' | null;
  movement: string;
  glow: number;
}

export interface TemperamentProfile {
  blinkMin: number;
  blinkMax: number;
  wanderAmp: number;
  bounce: number;
  breathScale: number;
  gazeGain: number;
  doubleBlinkChance: number;
}

/** RNG determinista. */
export function xmur3(str: string): () => number;
export function mulberry32(seed: number): () => number;
export function makeRng(seed: string): {
  next(): number;
  range(min: number, max: number): number;
  int(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
  chance(p: number): boolean;
  biased(p: number): number;
};
export function deriveSeed(seed: string, label: string): string;
export function uidFor(seed: string): string;

/** Identidad: semilla → genoma (deep-freeze). */
export function generateGenome(seed: string): Genome;
export function temperamentProfile(t: number): TemperamentProfile;
export const MARKINGS: readonly string[];
export const APPENDAGES: readonly string[];

/** Paleta. */
export function buildPalette(genome: Genome): Record<string, string>;
export function lerpHsl(a: string, b: string, t: number): string;
export function hsl(h: number, s: number, l: number, a?: number): string;

/** Geometría. */
export function superellipsePath(opts: {
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  n?: number;
  steps?: number;
  wobble?: number;
  wobblePhase?: number;
}): string;
export function superellipsePoint(
  theta: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  n: number
): { x: number; y: number };
export function pointsToPath(pts: ReadonlyArray<{ x: number; y: number }>): string;
export function lerp(a: number, b: number, t: number): number;
export function clamp(v: number, lo: number, hi: number): number;
export function smooth(t: number): number;
export function seg(t: number, a: number, b: number, from: number, to: number): number;
export function mix(a: number, b: number, t: number): number;

/** Animación. */
export const Ease: Record<string, (t: number) => number>;
export class Spring {
  constructor(value?: number, response?: number, damping?: number);
  value: number;
  target: number;
  velocity: number;
  omega: number;
  zeta: number;
  configure(response: number, damping: number): void;
  set(value: number): void;
  readonly settled: boolean;
  step(dt: number): void;
}
export class Tracked {
  constructor(value?: number);
  readonly value: number;
  readonly animating: boolean;
  jump(v: number): void;
  springTo(v: number, response?: number, damping?: number): void;
  curveTo(v: number, duration?: number): void;
  update(now?: number): number;
}
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number;
export const closeCurve: (x: number) => number;

/** Render (rig SVG de 160 puntos). */
export function renderShell(uid: string, genome: Genome, palette: Record<string, string>): string;
export function staticSVG(
  seed: string,
  opts?: { state?: StateName; emote?: EmoteName; pose?: string }
): string;
export const ARA_HEAD_D: string;
export const ARA_HEAD: { min: number; max: number; cx: number; cy: number };
export const ARA_EYE: {
  leftX: number;
  rightX: number;
  y: number;
  baseRX: number;
  baseRY: number;
  mask: { x: number; y: number; w: number; h: number };
  lidW: number;
  lidTopH: number;
  lidBottomH: number;
};
export function eyeGeometry(genome: Genome): {
  left: number;
  right: number;
  y: number;
  rx: number;
  ry: number;
};
export function edgeSqueeze(
  side: 'L' | 'R',
  cx: number,
  lookX: number,
  baseW: number,
  baseH: number
): { w: number; h: number; inwardShift: number };
export function surpriseSpread(poseW: number): number;
export const BODY: { cx: number; cy: number; rx: number };
export const DEFAULT_ROUNDNESS: number;
export function headRoundness(genome: Genome): number;
export function headHeightScale(genome: Genome): number;
export function bodyRadii(genome: Genome): { rx: number; ry: number };
export function headPathFor(genome: Genome): string;
export function bodyPath(genome: Genome): string;

/** Runtime. */
export const STATES: Readonly<Record<StateName, StateCfg>>;
export const EMOTES: Readonly<
  Record<EmoteName, { pose: string; duration: number; particles?: string; movement?: string; eyes?: string; micro?: string; sound?: string; wink?: boolean }>
>;
export const EMOTE_NAMES: readonly string[];
export const STATE_NAMES: readonly string[];
export const HOOK_STATE_MAP: Readonly<Record<string, StateName>>;
export function resolveState(current: string, incoming: string): string;
export function assertState(name: string): string;
export const POSES: Readonly<Record<string, PoseState>>;
export const POSE_NAMES: readonly string[];
export const POSE_KEYS: readonly string[];
export function createPoseState(name?: string): PoseState;
export function lerpPose(from: PoseState, to: PoseState, t: number): PoseState;
export function morphDuration(fromName: string, toName: string): number;

/** Efectos oculares (envoltorio {dx,dy,sx,sy,lid,done}). */
export function nodModifier(elapsed: number): EyeDelta;
export function angryDropModifier(elapsed: number): EyeDelta;
export function eyeBobModifier(elapsed: number): EyeDelta;
export function surpriseShakeModifier(elapsed: number): EyeDelta;
export function inspectEye(elapsed: number, phases: unknown): EyeDelta;
export function loveHeart(elapsed: number): { morph: number; pulse: number; scale: number; holdEnd: number; done: boolean };
export function waitingOrbit(elapsed: number): {
  leftX: number;
  rightX: number;
  foreshorten: number;
  leftDepth: number;
  rightDepth: number;
};
export function errorEyeSweep(t: number): number;
export const WARNING_PHASES: { duration: number; [k: string]: number };
export const BORED_STEPS: ReadonlyArray<{ x: number; y: number; hold: number; lookSpeed: number }>;
export function errorHeadKeys(duration?: number): Array<[number, number, (t: number) => number]>;
export function nodKeys(duration?: number): Array<[number, number, (t: number) => number]>;
export function warningHeadKeys(p: { [k: string]: number }): Array<[number, number, (t: number) => number]>;

/** Micros y sonido. */
export const MICRO: Readonly<Record<MicroName, { fields: Record<string, Array<[number, number, (t: number) => number]>> }>>;
export const MICRO_NAMES: readonly string[];
export function microDuration(name: string): number;
export function startMicro(
  timeline: unknown,
  name: string,
  onComplete?: (name: string) => void
): boolean;
export const SOUND_NAMES: readonly string[];
export function recipeFor(name: string): unknown;
export function createSoundEngine(opts?: Record<string, unknown>): {
  play(name: string): boolean;
  setVolume(v: number): number;
  getVolume(): number;
  setEnabled(on: boolean): void;
  isEnabled(): boolean;
  idle(): void;
  resume(): void;
  dispose(): void;
};

/** Extensiones. */
export interface AvatarExtension {
  name: string;
  actions?: Record<string, (avatar: EgoAvatar, action: string) => unknown>;
  beforePlay?: (action: string, context: { source: string }) => void;
  afterPlay?: (action: string, result: unknown, context: { source: string }) => void;
  reset?: (avatar: EgoAvatar) => void;
  draw?: (avatar: EgoAvatar, now: number) => void;
}
export function registerAvatarExtension(ext: AvatarExtension): void;
export function hasExtensionAction(action: string): boolean;
export function listExtensions(): string[];

/** Eventos. */
export interface StateChangeDetail {
  state: StateName;
  previous: StateName;
}
export interface ActionStateDetail {
  action: string;
  phase: 'start' | 'end' | 'cancel';
  source: 'api' | 'interaction' | 'automatic';
}

/** Motor de render del elemento. */
export type RenderMode = 'svg' | 'studio';

/**
 * Modo de las manos flotantes articuladas (rig de 5 dedos).
 *
 * - `auto`   → las manos aparecen tras una interacción (emote, hover de una
 *   mano). Es el comportamiento por defecto del motor.
 * - `always` → siempre visibles.
 * - `hidden` → nunca visibles.
 *
 * Se fija con el atributo `hands` del elemento: `<ego-avatar hands="always">`.
 */
export type HandsMode = 'auto' | 'always' | 'hidden';

/** Custom element <ego-avatar>. */
export class EgoAvatar extends HTMLElement {
  static observedAttributes: string[];
  /** Modo de las manos flotantes articuladas (atributo `hands`). */
  hands: HandsMode;
  setState(name: StateName, opts?: { immediate?: boolean; fromAction?: boolean }): this;
  play(action: EmoteName | ActionName | string, opts?: { source?: string; duration?: number }): Promise<this>;
  playMicro(name: MicroName | string): boolean;
  playSound(name: SoundName | string): boolean;
  setSeed(seed: string): this;
  getGenome(): Genome;
  setGene(path: string | Record<string, unknown>, value?: unknown): this;
  patchGenome(patch: Record<string, unknown>): this;
  resetGenome(): this;
  setPointerFollow(on: boolean): boolean;
  isPointerFollow(): boolean;
  mute(on?: boolean): this;
  setSoundEnabled(on: boolean): this;
  setSoundVolume(v: number): number;
  getSoundVolume(): number;
  isMuted(): boolean;
  getState(): StateName;
  toSVGString(): string;
  getMode(): RenderMode;
  setMode(mode: RenderMode | string): RenderMode;
  noteActivity(wake?: boolean): this;
  setStudioParam(key: string, value: unknown): boolean;
  getStudioParam(key: string): unknown;
  getStudioParams(): Record<string, unknown> | null;
  applyStudioPreset(name: string): boolean;
  speak(text: string, seconds?: number): boolean;
  reset(): this;
  notify(hookName: keyof typeof HOOK_STATE_MAP | string, opts?: { noAutoReturn?: boolean }): this;
  addEventListener(type: 'state-change', listener: (ev: CustomEvent<StateChangeDetail>) => void): void;
  addEventListener(type: 'action-state', listener: (ev: CustomEvent<ActionStateDetail>) => void): void;
}

export const VERSION: string;

/** Puente Ego → Studio (src/studio/adapter.js). */
export const EGO_TO_STUDIO_STATE: Readonly<Record<StateName, string>>;
export const EGO_TO_STUDIO_EMOTE: Readonly<Record<string, string>>;
export const STUDIO_TO_EGO_STATE: Readonly<Record<string, StateName>>;
export const EGO_SOUND_TO_STUDIO_SOUND: Readonly<Record<string, string>>;
export function studioStateForEgo(egoState: string): string;
export function studioEmoteForEgo(emote: string): string;
export function studioConfigForGenome(genome: unknown, palette?: Record<string, string>): Record<string, unknown>;
export function applyGenomeToStudio(studio: unknown, genome: unknown, palette?: Record<string, string>): boolean;
export function studioSoundFor(name: string): string;
export function studioMicroFor(name: string): { spin: number } | { idle: true } | null;

declare global {
  interface HTMLElementTagNameMap {
    'ego-avatar': EgoAvatar;
  }
  interface Window {
    EgoAvatar: typeof EgoAvatar;
  }
}
