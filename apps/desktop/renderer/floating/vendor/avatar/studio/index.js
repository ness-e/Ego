// studio/index.js — barrel del motor Avatar Studio (canvas).
// El motor SVG original sigue en el barrel raíz (src/index.js); aquí vive
// el port del studio: HybridRobotAvatar + render + rig + config + adapter.

export { SoundSynthesizer, STUDIO_SOUND_NAMES } from './sound.js';
export {
  STUDIO_DEFAULTS,
  PRESET_DIM_RESET,
  STUDIO_PRESETS,
  STUDIO_STATES,
  EYE_STYLE_NAMES,
  MOUTH_STYLE_NAMES,
  ACCESSORY_NAMES,
  STATE_ACCENT,
  accentFor,
} from './config.js';
export { HybridRobotAvatar } from './avatar.js';
export {
  EGO_TO_STUDIO_STATE,
  EGO_TO_STUDIO_EMOTE,
  studioStateForEgo,
  studioEmoteForEgo,
  studioConfigForGenome,
  applyGenomeToStudio,
  STUDIO_TO_EGO_STATE,
  EGO_SOUND_TO_STUDIO_SOUND,
  studioSoundFor,
  studioMicroFor,
} from './adapter.js';
export { StudioHost, STUDIO_PARAM_KEYS, STUDIO_PRESET_NAMES } from './element-host.js';export { roundRectPath, hexToRgba, shadeColor, buildSquirclePath } from './render/helpers.js';
export { drawSquircleBody, drawRearChassis3D, drawBoxBody } from './render/body.js';
export { drawInnerVisor } from './render/visor.js';
export {
  buildEyeSilhouettePath,
  drawEyes,
  drawCyberVisorBar,
  drawSingleEye,
  drawCXArtLabEye,
} from './render/eyes.js';
export { drawMouth, updateMouth } from './render/mouth.js';
export { drawStateOverlays, getStateAccentColor } from './render/overlays.js';
export { drawRobotEars3D } from './render/ears.js';
export { drawTopAccessory } from './render/accessories.js';
export { updateEyeRig } from './rig/eyes.js';
export { updateHandsRig, drawHands, drawSingleHand } from './rig/hands.js';
export { spawnParticles, updateParticles, drawParticles } from './render/particles.js';
