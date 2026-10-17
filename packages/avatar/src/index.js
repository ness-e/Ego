// index.js — punto de entrada público de ego-avatar.
// Importar esto registra el custom element <ego-avatar>.

// core — identidad determinista
export { xmur3, mulberry32, makeRng, deriveSeed, uidFor } from './core/prng.js';
export {
  generateGenome,
  temperamentProfile,
  MARKINGS,
  APPENDAGES,
} from './core/genome.js';
export { buildPalette, lerpHsl, hsl } from './core/palette.js';
export { superellipsePath, superellipsePoint, pointsToPath, lerp, clamp, smooth, seg, mix } from './core/morph.js';
export { Ease, Spring, Tracked, cubicBezier, closeCurve } from './core/anim.js';

// core — configuración (Defaults/Bounds/clamp, ARA) y timeline (coucou anim())
export {
  AVATAR_DEFAULTS,
  AVATAR_BOUNDS,
  parseSize,
  normalizeConfigValue,
  clampConfig,
  configure,
  getConfig,
  resetConfig,
} from './core/config.js';
export { createTimeline, buildPhases, piecewise } from './core/timeline.js';

// render — rig visual del robot (agent-robot-avatar)
export { renderShell } from './render/shell.js';
export { staticSVG, djb2, poseForSeed } from './render/static.js';
export { ARA_HEAD_D, ARA_HEAD } from './render/ara-head.js';
export {
  ARA_EYE,
  eyeGeometry,
  edgeSqueeze,
  surpriseSpread,
  eyesDefs,
  eyesLayer,
} from './render/eyes.js';
export {
  BODY,
  DEFAULT_ROUNDNESS,
  headRoundness,
  headHeightScale,
  bodyRadii,
  parseHeadPoints,
  flattenHeadPoints,
  superellipsePointARA,
  targetShape,
  mixPoints,
  headPathFor,
  bodyPath,
  bodyDefs,
  markingPath,
  tintLayer,
} from './render/body.js';
export { projectEye, gazeToYawPitch, EYE_SP, EYE_P } from './render/projection.js';

// runtime
export {
  STATES,
  EMOTES,
  EMOTE_NAMES,
  STATE_NAMES,
  HOOK_STATE_MAP,
  HOOK_AUTO_RETURN,
  resolveState,
  assertState,
} from './runtime/states.js';
export { POSES, POSE_NAMES, POSE_KEYS, createPoseState, lerpPose, morphDuration } from './runtime/poses.js';
export {
  requestedMotion,
  reducedMotion,
  beginAction,
  finishAction,
  cancelActiveAction,
  createAutoSleep,
} from './runtime/policy.js';
export { PresenceStateMachine, PRESENCE_MODES } from './runtime/presence.js';
// runtime — puntero, efectos oculares, micro-gestos y sonido (módulos puros)
export {
  POINTER_DEFAULTS,
  LOOK_SPEED,
  HEAD_FOLLOW,
  samplePointer,
  emptyPointer,
  isPointerFresh,
  pointerInRange,
  nextWander,
  smoothLook,
  createHeadFollow,
  stepHeadFollow,
  BORED_STEPS,
} from './runtime/pointer.js';
// fx-eyes.js: el ÚNICO módulo de matemática ocular (fusión de expressions.js +
// la parte ocular de action-fx.js). Envoltorio estándar {dx,dy,sx,sy,lid,done}.
export {
  errorEyeSweep,
  WARNING_TIMING,
  WARNING_PHASES,
  warningLids,
  warningEyeTransform,
  warningLidFactor,
  NOD_DURATION,
  nodModifier,
  ANGRY_DROP,
  angryDropModifier,
  EYE_BOB,
  eyeBobModifier,
  SURPRISE_SHAKE,
  surpriseShakeModifier,
  WAITING_ORBIT,
  waitingOrbit,
  INSPECT_DEFAULTS,
  INSPECT_KEYS,
  INSPECT_DURATION,
  inspectPhases,
  inspectLidBlend,
  inspectVerticalShift,
  inspectEye,
  LOVE_DEFAULTS,
  loveDuration,
  loveHeart,
  loveHeartGeometry,
  FAILURE_TIMING,
  FAILURE_DROP_START,
  FAILURE_TOTAL,
  failureHeadOffset,
} from './runtime/fx-eyes.js';
export {
  MICRO,
  MICRO_NAMES,
  microDuration,
  startMicro,
  badgePopSequence,
  BADGE_POP_SHRINK_MS,
  BADGE_POP_GROW_MS,
  BADGE_POP_GAP_MS,
  BLINK_KEYS,
  BLINK_DURATION,
  errorHeadKeys,
  nodKeys,
  warningHeadKeys,
} from './runtime/micro.js';
// STATE_SOUND y EMOTE_SOUND se publican SOLO desde sound.js: states.js exporta
// tablas idénticas para uso interno y duplicarlas aquí haría ambiguo el import.
export {
  SOUND_NAMES,
  SOUND_DEFAULT_VOLUME,
  SOUND_VOLUME_BOUNDS,
  SOUND_IDLE_SUSPEND_MS,
  STATE_SOUND,
  EMOTE_SOUND,
  ACTION_SOUND,
  SOUND_RECIPES,
  recipeFor,
  createSoundEngine,
} from './runtime/sound.js';

export {
  registerAvatarExtension,
  hasExtensionAction,
  listExtensions,
} from './runtime/extension-host.js';

// puente Ego → Studio (tablas puras, sin canvas)
export {
  EGO_TO_STUDIO_STATE,
  EGO_TO_STUDIO_EMOTE,
  STUDIO_TO_EGO_STATE,
  EGO_SOUND_TO_STUDIO_SOUND,
  studioStateForEgo,
  studioEmoteForEgo,
  studioConfigForGenome,
  applyGenomeToStudio,
  studioSoundFor,
  studioMicroFor,
} from './studio/adapter.js';

// elemento (define <ego-avatar>)
export { EgoAvatar } from './runtime/avatar-element.js';

export { VERSION } from './version.js';
