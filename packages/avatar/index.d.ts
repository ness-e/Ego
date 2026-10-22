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
  | 'warning'
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

/**
 * Detalle del "marking" de la cabeza: depende de que marca se sortea.
 *   · `dots`   → manchas repartidas por la silueta;
 *   · `stripe` → una franja con inclinacion;
 *   · `orbit`  → un anillo eliptico;
 *   · `none`   → sin detalle (`null`).
 */
export type MarkingDetail =
  | { count: number; spots: ReadonlyArray<{ cx: number; cy: number; r: number }> }
  | { y: number; thickness: number; tilt: number }
  | { tilt: number; ratio: number; thickness: number }
  | null;

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
  readonly markingDetail: MarkingDetail;
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
/**
 * El web component `<ego-avatar>`.
 *
 * Su declaracion vive en `src/runtime/avatar-element.d.ts` (junto al codigo) y
 * aqui solo se reexporta: declararlo dos veces hacia a que las dos copias
 * derivaran (y la del .d.ts se quedaba corta: le faltaban getGenome, setMode,
 * el modo de manos...). Una sola declaracion, una sola verdad.
 */
import { EgoAvatar } from './src/runtime/avatar-element.js';
export { EgoAvatar };

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

// ── Declaraciones completadas por scripts/build-types.mjs ──
// (las declaraciones que faltaban del barrel real; el test
//  `tests/public-surface.test.js` falla si esto y el barrel divergen)

// ---- ./runtime/sound.js ----
export declare const ACTION_SOUND: Readonly<Record<string, string>>;
export declare const EMOTE_SOUND: Readonly<Record<string, string>>;
export declare const SOUND_DEFAULT_VOLUME: number;
export declare const SOUND_IDLE_SUSPEND_MS: number;
export declare const SOUND_RECIPES: Readonly<Record<string, unknown>>;
export declare const SOUND_VOLUME_BOUNDS: readonly [number, number];
export declare const STATE_SOUND: Readonly<Record<string, string>>;

// ---- ./runtime/fx-eyes.js ----
export const ANGRY_DROP: Readonly<{
    duration: 680;
    amount: 4.8;
}>;
/**
 * Configuracion del balanceo de ojos (procede de `runtime/fx-eyes.js`).
 * El modulo la declaraba y el barrel la usaba sin declararla: el `.d.ts` raiz
 * no compilaba contra si mismo (lo delata el emit de declaraciones).
 */
export interface EyeBobCfg {
  duration: number;
  amp: number;
  cycles?: number;
}

export const EYE_BOB: Readonly<{
    happy: EyeBobCfg;
    sad: EyeBobCfg;
    cycles: number;
}>;
export const FAILURE_DROP_START: number;
export const FAILURE_TIMING: Readonly<{
    prep: 180;
    pause: 260;
    state: 320;
    drop: 720;
    hold: 720;
    rise: 520;
}>;
export const FAILURE_TOTAL: 2720;
export const INSPECT_DEFAULTS: Readonly<{
    aperture: 16;
    scanOffset: 16;
    prepPause: 120;
    close: 220;
    holdClosed: 880;
    down1: 400;
    holdDown1: 560;
    up1: 160;
    holdUp1: 580;
    center1: 140;
    holdCenter: 760;
    down2: 140;
    holdDown2: 620;
    up2: 180;
    holdUp2: 620;
    center2: 100;
    holdAfter: 940;
    open: 260;
}>;
export const INSPECT_DURATION: 6560;
export const INSPECT_KEYS: readonly string[];
export const LOVE_DEFAULTS: Readonly<{
    rx: 28;
    ry: 43;
    tilt: 42;
    cross: 13;
    centerY: 126;
    pulse: 0.155;
    prep: 120;
    morphIn: 240;
    beat: 760;
    beats: 3;
    morphOut: 360;
    swayAngle: 0;
    swayLift: 2;
    restLeft: 86;
    restRight: 154;
}>;
export const NOD_DURATION: 760;
export const SURPRISE_SHAKE: Readonly<{
    duration: 420;
}>;
export const WAITING_ORBIT: Readonly<{
    cycle: 3200;
    amplitude: 34;
    centerX: 120;
    foreshortenMin: 0.72;
    depthAmp: 0.08;
    orbits: 2;
}>;
export const WARNING_TIMING: Readonly<{
    W1: 480;
    W2: 400;
    W4: 600;
    W5: 200;
    W5P: 300;
    W6: 200;
    W6P: 500;
    W7: 100;
    W8: 800;
    W9: 227;
}>;
export function failureHeadOffset(elapsed: any): {
    dy: number;
    done: boolean;
};
export function inspectLidBlend(elapsed: any, phases: any, config?: Readonly<{
    aperture: 16;
    scanOffset: 16;
    prepPause: 120;
    close: 220;
    holdClosed: 880;
    down1: 400;
    holdDown1: 560;
    up1: 160;
    holdUp1: 580;
    center1: 140;
    holdCenter: 760;
    down2: 140;
    holdDown2: 620;
    up2: 180;
    holdUp2: 620;
    center2: 100;
    holdAfter: 940;
    open: 260;
}>): number;
export function inspectPhases(config?: Readonly<{
    aperture: 16;
    scanOffset: 16;
    prepPause: 120;
    close: 220;
    holdClosed: 880;
    down1: 400;
    holdDown1: 560;
    up1: 160;
    holdUp1: 580;
    center1: 140;
    holdCenter: 760;
    down2: 140;
    holdDown2: 620;
    up2: 180;
    holdUp2: 620;
    center2: 100;
    holdAfter: 940;
    open: 260;
}>): Readonly<{
    [x: string]: number;
}>;
export function inspectVerticalShift(elapsed: any, phases: any, offset?: 16): any;
export function loveDuration(shape?: Readonly<{
    rx: 28;
    ry: 43;
    tilt: 42;
    cross: 13;
    centerY: 126;
    pulse: 0.155;
    prep: 120;
    morphIn: 240;
    beat: 760;
    beats: 3;
    morphOut: 360;
    swayAngle: 0;
    swayLift: 2;
    restLeft: 86;
    restRight: 154;
}>): number;
export function loveHeartGeometry(morph: any, shape?: Readonly<{
    rx: 28;
    ry: 43;
    tilt: 42;
    cross: 13;
    centerY: 126;
    pulse: 0.155;
    prep: 120;
    morphIn: 240;
    beat: 760;
    beats: 3;
    morphOut: 360;
    swayAngle: 0;
    swayLift: 2;
    restLeft: 86;
    restRight: 154;
}>): {
    baseY: number;
    left: {
        x: any;
        y: any;
        tilt: number;
    };
    right: {
        x: any;
        y: any;
        tilt: number;
    };
    cy: any;
    rx: any;
    ry: any;
};
export function warningEyeTransform(elapsed: number, side: "near" | "far"): {
    dx: any;
    dy: any;
    rot: any;
    sx: any;
    sy: any;
};
export function warningLidFactor(elapsed: any, side: any): number;
export function warningLids(elapsed: any): {
    proximity: number;
    lids: number;
    lidShift: number;
    farLowOffset: number;
    farDeepLidDrop: number;
};

// ---- ./core/config.js ----
export const AVATAR_BOUNDS: Readonly<{
    size: number[];
    autoSleepMs: number[];
    fps: number[];
    blinkMinMs: number[];
    blinkMaxMs: number[];
    doubleBlinkChance: number[];
    doubleBlinkDelayMs: number[];
    gazeGain: number[];
    pointerFollow: boolean[];
    boredAfterMs: number[];
    ambientMs: number[];
    jellyResponse: number[];
    jellyDamping: number[];
}>;
export const AVATAR_DEFAULTS: Readonly<{
    size: 112;
    autoSleepMs: 45000;
    fps: 30;
    blinkMinMs: 2200;
    blinkMaxMs: 5400;
    doubleBlinkChance: 0.22;
    doubleBlinkDelayMs: 230;
    gazeGain: 1;
    pointerFollow: true;
    boredAfterMs: 10000;
    ambientMs: 1300;
    jellyResponse: 0.34;
    jellyDamping: 0.6;
}>;
export function clampConfig(config?: {}, defaults?: Readonly<{
    size: 112;
    autoSleepMs: 45000;
    fps: 30;
    blinkMinMs: 2200;
    blinkMaxMs: 5400;
    doubleBlinkChance: 0.22;
    doubleBlinkDelayMs: 230;
    gazeGain: 1;
    pointerFollow: true;
    boredAfterMs: 10000;
    ambientMs: 1300;
    jellyResponse: 0.34;
    jellyDamping: 0.6;
}>, bounds?: Readonly<{
    size: number[];
    autoSleepMs: number[];
    fps: number[];
    blinkMinMs: number[];
    blinkMaxMs: number[];
    doubleBlinkChance: number[];
    doubleBlinkDelayMs: number[];
    gazeGain: number[];
    pointerFollow: boolean[];
    boredAfterMs: number[];
    ambientMs: number[];
    jellyResponse: number[];
    jellyDamping: number[];
}>): Readonly<{
    size: 112;
    autoSleepMs: 45000;
    fps: 30;
    blinkMinMs: 2200;
    blinkMaxMs: 5400;
    doubleBlinkChance: 0.22;
    doubleBlinkDelayMs: 230;
    gazeGain: 1;
    pointerFollow: true;
    boredAfterMs: 10000;
    ambientMs: 1300;
    jellyResponse: 0.34;
    jellyDamping: 0.6;
}>;
export function configure(patch?: object): object;
export function getConfig(): Readonly<{
    size: 112;
    autoSleepMs: 45000;
    fps: 30;
    blinkMinMs: 2200;
    blinkMaxMs: 5400;
    doubleBlinkChance: 0.22;
    doubleBlinkDelayMs: 230;
    gazeGain: 1;
    pointerFollow: true;
    boredAfterMs: 10000;
    ambientMs: 1300;
    jellyResponse: 0.34;
    jellyDamping: 0.6;
}>;
export function normalizeConfigValue(key: any, value: any, defaults?: Readonly<{
    size: 112;
    autoSleepMs: 45000;
    fps: 30;
    blinkMinMs: 2200;
    blinkMaxMs: 5400;
    doubleBlinkChance: 0.22;
    doubleBlinkDelayMs: 230;
    gazeGain: 1;
    pointerFollow: true;
    boredAfterMs: 10000;
    ambientMs: 1300;
    jellyResponse: 0.34;
    jellyDamping: 0.6;
}>, bounds?: Readonly<{
    size: number[];
    autoSleepMs: number[];
    fps: number[];
    blinkMinMs: number[];
    blinkMaxMs: number[];
    doubleBlinkChance: number[];
    doubleBlinkDelayMs: number[];
    gazeGain: number[];
    pointerFollow: boolean[];
    boredAfterMs: number[];
    ambientMs: number[];
    jellyResponse: number[];
    jellyDamping: number[];
}>): any;
export function parseSize(value: any, fallback?: number): number;
export function resetConfig(): Readonly<{
    size: 112;
    autoSleepMs: 45000;
    fps: 30;
    blinkMinMs: 2200;
    blinkMaxMs: 5400;
    doubleBlinkChance: 0.22;
    doubleBlinkDelayMs: 230;
    gazeGain: 1;
    pointerFollow: true;
    boredAfterMs: 10000;
    ambientMs: 1300;
    jellyResponse: 0.34;
    jellyDamping: 0.6;
}>;

// ---- ./runtime/micro.js ----
export const BADGE_POP_GAP_MS: 100;
export const BADGE_POP_GROW_MS: 280;
export const BADGE_POP_SHRINK_MS: 90;
export const BLINK_DURATION: 200;
export const BLINK_KEYS: readonly (number | ((t: any) => number))[][];
export function badgePopSequence(): {
    shrink: (number | ((t: any) => number))[][];
    grow: (number | ((t: any) => number))[][];
};

// ---- ./render/projection.js ----
export const EYE_P: -0.12;
export const EYE_SP: 0.37;
export function gazeToYawPitch(nx: any, ny: any): {
    yaw: number;
    pitch: number;
};
export function projectEye({ side, yaw, pitch, morph, spacing, ry }: {
    side: "L" | "R";
    yaw: number;
    pitch: number;
    morph?: number;
    spacing: number;
    ry: number;
}): {
    dx: number;
    dy: number;
    fx: number;
    fy: number;
    visible: boolean;
};

// ---- ./runtime/pointer.js ----
export const HEAD_FOLLOW: Readonly<{
    track: {
        stiffness: number;
        damping: number;
    };
    settle: {
        stiffness: number;
        damping: number;
    };
    rotTrack: {
        stiffness: number;
        damping: number;
    };
    rotSettle: {
        stiffness: number;
        damping: number;
    };
    maxTranslate: 4.2;
    maxRotate: 8;
    dtCapMs: 34;
}>;
export const LOOK_SPEED: Readonly<{
    default: 0.16;
    pointer: 0.28;
    locked: 0.4;
    jelly: 0.42;
    antenna: 0.42;
    bored: 0.5;
}>;
export const POINTER_DEFAULTS: Readonly<{
    radiusFactor: 2.55;
    gainX: 0.42;
    gainY: 0.38;
    clampX: 48;
    clampY: 34;
    freshnessMs: 900;
    cancelBoredAt: 0.65;
    followMinInfluence: 0.03;
}>;
export function createHeadFollow(): {
    x: number;
    y: number;
    rot: number;
    vx: number;
    vy: number;
    vrot: number;
};
export function emptyPointer(now?: number): {
    x: number;
    y: number;
    active: boolean;
    influence: number;
    lastMove: number;
};
export function isPointerFresh(pointer: any, now: any, freshnessMs?: 900): boolean;
export function nextWander(rand: () => number, now: number): {
    x: number;
    y: number;
    nextAt: number;
};
export function pointerInRange(pointer: any, now: any, freshnessMs?: 900): boolean;
export function samplePointer(rect: {
    left: number;
    top: number;
    width: number;
    height: number;
}, pointer: {
    x: number;
    y: number;
}, now: number, cfg?: object): {
    x: number;
    y: number;
    active: boolean;
    influence: number;
    lastMove: number;
};
export function smoothLook(from: number, to: number, speed: number, dt: number): number;
export function stepHeadFollow(state: object, source: {
    x: number;
    y: number;
}, canFollowPointer: boolean, dtMs: number, cfg?: Readonly<{
    track: {
        stiffness: number;
        damping: number;
    };
    settle: {
        stiffness: number;
        damping: number;
    };
    rotTrack: {
        stiffness: number;
        damping: number;
    };
    rotSettle: {
        stiffness: number;
        damping: number;
    };
    maxTranslate: 4.2;
    maxRotate: 8;
    dtCapMs: 34;
}>): any;

// ---- ./runtime/states.js ----
export const HOOK_AUTO_RETURN: Readonly<{
    finished: 5200;
}>;

// ---- ./runtime/presence.js ----
export const PRESENCE_MODES: readonly string[];
export class PresenceStateMachine {
    constructor({ timers }?: {
        timers?: typeof globalThis;
    });
    /** @type {'hidden'|'compact'|'home'|'greet'} */
    state: "hidden" | "compact" | "home" | "greet";
    onTransition: any;
    /** home → compact delay, segundos (fsm.ts:12). */
    homeToCompactDelay: number;
    /** compact → hidden delay, segundos (fsm.ts:14). */
    compactToHiddenDelay: number;
    /** greet → compact al terminar el saludo sin hover (fsm.ts:16). */
    greetAutoCollapseDelay: number;
    /** greet → compact mientras el puntero la sostiene (fsm.ts:18). */
    greetHoverCollapseDelay: number;
    /** Una alerta esperando respuesta queda abierta aunque el puntero se vaya (fsm.ts:20). */
    pinned: boolean;
    _compactHide: any;
    _homeCollapse: any;
    _greetCollapse: any;
    _timers: typeof globalThis;
    launch(): void;
    mouseEntered(): void;
    mouseLeft(): void;
    click(): void;
    /** El saludo terminó; no pisa un timer de hover activo (fsm.ts:75-78). */
    greetComplete(): void;
    /** Evento de trabajo: muestra el modo compacto desde hidden (fsm.ts:81-86). */
    reveal(): void;
    /** Alerta o petición explícita: abre directo a expandido (fsm.ts:89-93). */
    forceHome(): void;
    forceCompact(): void;
    forceHidden(): void;
    _scheduleCompactHide(): void;
    _scheduleHomeCollapse(): void;
    _scheduleGreetCollapse(delay: any): void;
    _clear(which: any): void;
    cancelTimers(): void;
    _transition(next: any): void;
}

// ---- ./runtime/policy.js ----
export function beginAction(instance: any, action: any, source: any, continuous?: boolean, clearAutoSleep?: any): {
    id: any;
    action: any;
    source: any;
    continuous: boolean;
    terminal: boolean;
};
export function cancelActiveAction(instance: any, { silent }?: {
    silent?: boolean;
}): void;
export function createAutoSleep({ getDelayMs, isBlocked, onSleep, timers }: {
    getDelayMs: () => number;
    isBlocked: () => boolean;
    onSleep: () => void;
    timers?: {
        setTimeout: any;
        clearTimeout: any;
    };
}): {
    schedule: () => void;
    clear: () => void;
    readonly active: boolean;
};
export function finishAction(instance: any, record: any, phase?: string, scheduleAutoSleep?: any): void;
export function reducedMotion(instance: any): boolean;
export function requestedMotion(instance: any): "auto" | "full" | "reduce";

// ---- ./render/body.js ----
export function bodyDefs(uid: any, genome: any, palette: any, d: any): string;
export function flattenHeadPoints(points: any, squash?: number): any;
export function markingPath(uid: any, genome: any): string;
export function mixPoints(src: any, dst: any, amount: any): {
    x: any;
    y: any;
}[];
export function parseHeadPoints(d: any): any[];
export function superellipsePointARA(angle: any, centerX: any, centerY: any, halfW: any, halfH: any, exponent: any): {
    x: any;
    y: any;
};
export function targetShape(pts: any, exponent: any): any;
export function tintLayer(d: any): string;

// ---- ./core/timeline.js ----
export function buildPhases(timing: Readonly<Record<string, number>>, keys?: ReadonlyArray<string>): Readonly<Record<string, number>>;
export function createTimeline({ now }?: {
    now?: () => number;
}): {
    /**
     * Programa una secuencia de claves sobre un campo. Cada clave es
     * [valorObjetivo, duraciónMs, ease]. El tramo parte del valor ACTUAL del
     * campo (o de `fromValue` si se conoce por fuera) y, mientras dure, el
     * campo queda reservado: `set()` no lo puede pisar.
     * @param {string} prop
     * @param {Array<[number, number, (t:number)=>number]>} keys
     * @param {() => void} [onComplete]
     * @param {number} [fromValue]
     */
    anim(prop: string, keys: Array<[number, number, (t: number) => number]>, onComplete?: () => void, fromValue?: number): /*elided*/ any;
    /** Avanza todos los tracks y escribe sus valores. */
    update(): void;
    /** ¿El campo está reservado por un track? */
    locked(prop: any): boolean;
    /** ¿Hay algo en movimiento? */
    readonly busy: boolean;
    get(prop: any): any;
    set(prop: any, value: any): /*elided*/ any;
    /** Cancela el track de un campo (lo libera). */
    clear(prop: any): void;
    /** Cancela todos los tracks (reset). */
    clearAll(): void;
    _values: {};
};
export function piecewise(t: any, stops: Array<[number, number, number, number]>): number;

// ---- ./render/static.js ----
export function djb2(str: any): number;
export function poseForSeed(seed: any): string;

// ---- ./render/eyes.js ----
export function eyesDefs(uid: any): string;
export function eyesLayer(uid: any, genome: any, palette: any): string;

// ── fin del bloque generado ──