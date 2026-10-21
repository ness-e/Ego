// HybridRobotAvatar — clase principal del estudio avatar (ESM puro, sin dependencias).
// Adapted from ego-avatar/avatar_studio_cx_artlab_mochi_2_0.html (MIT),
// líneas 4131-4810: se adapta el patrón (bucle de render, máquina de estados
// del canvas, catálogo de estados y aplicación de presets); la geometría vive
// en ./render/ y es propia de Ego.
//   - constructor ............ líneas 707-872 del fichero fuente
//   - resize ................. líneas 874-894
//   - activateHands .......... líneas 983-986
//   - triggerSurfaceRipple ... líneas 988-991
//   - triggerIdleMicroAnimation líneas 993-1022
//   - impulse ................ líneas 1029-1046
//   - triggerSpin ............ líneas 1048-1053
//   - say .................... líneas 1055-1064
//   - speak .................. líneas 1066-1077
//   - spawnParticles ......... líneas 1079-1092 (delegado a render/particles.js)
//   - play ................... líneas 1094-1213
//   - update ................. líneas 1215-1529 (pasos 0-11)
//   - draw ................... líneas 2098-2222
//   - attachInteractions .... nuevo: oyentes de 4158-4345 (el constructor NO los registra)
//   - startLoop .............. nuevo: bucle de 4137-4146
//   - applyPreset ............ líneas 4732-4781 (cierre DOMContentLoaded)
// NOTA: `this` sigue siendo `this` (es la clase).
// Convención de delegación (fijada por los tests hermanos studio-*.test.js):
// las funciones de render reciben el ctx 2D PRIMERO y el estado (S, normalmente
// esta instancia) SEGUNDO, conservando el resto de la firma original:
//   drawSquircleBody(ctx, S, rx, ry, n) · drawRearChassis3D(ctx, S, rx, ry, sin, cos)
//   drawBoxBody(ctx, S, rx, ry) · drawInnerVisor(ctx, S, rx, ry)
//   drawEyes(ctx, S, rx, ry) · drawMouth(ctx, S, rx, ry)
//   drawStateOverlays(ctx, S, rx, ry) · getStateAccentColor(S)
//   drawRobotEars3D(ctx, S, rx, ry, capa, sin?, cos?)
//   drawTopAccessory(ctx, S, rx, ry, turnShiftX?, sin?) · drawHands(ctx, S, capa)
//   buildSquirclePath(ctx, rx, ry, n) y hexToRgba(hex, alpha) son puros (sin S).
// El rig y las partículas reciben S primero: updateEyeRig(S, dt),
// updateHandsRig(S, dt), updateMouth(S, dt), spawnParticles(S, tipo, n),
// updateParticles(S, dt), drawParticles(ctx, S).
// Seguridad Node: todo acceso a document/window va tras HAS_DOM/HAS_WINDOW; los
// oyentes de canvas/window solo se registran en attachInteractions().

import { STUDIO_DEFAULTS, STUDIO_PRESETS } from './config.js';
import { hexToRgba, buildSquirclePath } from './render/helpers.js';
import { drawSquircleBody, drawRearChassis3D, drawBoxBody } from './render/body.js';
import { drawInnerVisor } from './render/visor.js';
import { drawEyes, drawCyberVisorBar } from './render/eyes.js';
import { updateEyeRig } from './rig/eyes.js';
import { drawMouth, updateMouth } from './render/mouth.js';
import { drawStateOverlays, getStateAccentColor } from './render/overlays.js';
import { drawRobotEars3D } from './render/ears.js';
import { drawTopAccessory } from './render/accessories.js';
import { drawHands, updateHandsRig } from './rig/hands.js';
import {
  spawnParticles as spawnParticlesOn,
  updateParticles,
  drawParticles,
} from './render/particles.js';

const HAS_DOM = typeof document !== 'undefined';
const HAS_WINDOW = typeof window !== 'undefined';

// Referencia al contrato de hermanos: drawCyberVisorBar lo usa internamente el
// módulo render/eyes.js (fuente: línea 2577, dentro de drawEyes); se importa aquí
// para fijar el contrato del módulo hermano aunque esta clase no lo llame directa.
void drawCyberVisorBar;

export class HybridRobotAvatar {
  constructor(canvas, sound) {
    this.canvas = canvas ?? null;
    this.ctx = canvas?.getContext?.('2d') ?? null;
    this.sound = sound;

    // Core Faithful Variant ('cx-faithful' or 'coucou-mochi')
    this.variantMode = 'cx-faithful';
    this.bodyColor = '#1e222d';
    this.visorColor = '#06080e';
    this.showVisor = true;
    this.showSidePods = true;
    this.eyeColor = '#dbf59d';
    this.autoStateColors = true;
    this.eyeStyle = 'cx-led';
    this.mouthStyle = 'none';
    this.accessory = 'none';

    // Full Configurable Dimensions & Parameters
    this.bodyWidthRatio = 1.0;
    this.bodyHeightRatio = 1.0;
    this.globalScale = 1.0;
    this.squircleN = 4.0;

    this.visorWidthRatio = 1.0;
    this.visorHeightRatio = 1.0;
    this.visorCornerRadius = 30;

    this.eyeWidthRatio = 1.0;
    this.eyeHeightRatio = 1.0;
    this.eyeSpacing = 28;
    this.eyeOffsetY = -2;
    this.eyeGlowBlur = 18;

    this.mouthScale = 1.0;
    this.mouthOffsetY = 24;

    this.accessoryScale = 1.0;
    this.accessoryOffsetY = 0;
    this.accessoryBounce = 1.0;

    this.jellyIntensity = 1.0;
    this.parallaxIntensity = 1.0;
    this.liveliness = 1.0;

    // Hands Mode: 'auto' (10s), 'always', 'hidden'
    this.handsMode = 'auto';
    this.handScaleConfig = 1.0;
    this.handsActiveTimer = 0;
    this.handVisibility = 0;

    // Speech & Lip-Sync Engine
    this.isTalking = false;
    this.talkTimer = 0;
    this.mouthOpen = 0;
    this.mouthWidth = 1;

    // State machine (22 states)
    this.state = 'idle';
    this.stateTimer = 0;
    this.time = 0;

    // Position & Undistorted 3D Floating Spring Physics
    const vw = (HAS_WINDOW && window.innerWidth) || 800;
    const vh = (HAS_WINDOW && window.innerHeight) || 600;
    this.width = vw;
    this.height = vh;
    this.homeX = this.width / 2;
    this.homeY = this.height / 2;
    this.x = this.homeX;
    this.y = this.homeY;
    this.vx = 0;
    this.vy = 0;
    this.isDragging = false;
    this.dragStretchX = 0;
    this.dragStretchY = 0;

    // Interactive Hover Sensors (Body, Left/Right Ear Pods, Left/Right Hands)
    this.isHoveringBody = false;
    this.isHoveringLeftPod = false;
    this.isHoveringRightPod = false;
    this.isHoveringLeftHand = false;
    this.isHoveringRightHand = false;
    this.bodyHoverAmount = 0;
    this.leftPodHoverAmount = 0;
    this.rightPodHoverAmount = 0;
    this.leftHandHoverAmount = 0;
    this.rightHandHoverAmount = 0;

    // Autonomous Idle Micro-Animations (Position & 3D Gaze only — zero shape distortion)
    this.idleMicroType = 'none';
    this.idleMicroTimer = 0;
    this.nextIdleMicroIn = 3.2;

    // Head 3D Spherical Inertia, Pointer Velocity & Face Parallax
    this.pointerX = this.width / 2;
    this.pointerY = this.height / 2;
    this.prevPointerX = this.pointerX;
    this.prevPointerY = this.pointerY;
    this.headLookX = 0;
    this.headLookY = 0;
    this.eyeLookX = 0;
    this.eyeLookY = 0;

    // Strictly Volume-Preserving Micro-Scale (max ±3.5% so shape never distorts) & 3D Spin
    this.scaleX = 1;
    this.scaleY = 1;
    this.velSX = 0;
    this.velSY = 0;
    this.rotation = 0;
    this.velRot = 0;
    this.spinAngle = 0;
    this.spinTarget = 0;

    // Interactive Head-Petting & Targeted Poke Flinches
    this.pettingAmount = 0;
    this.leftFlinch = 0;
    this.rightFlinch = 0;
    this.visorGlowBoost = 0;

    // Secondary Top-of-Head Accessory Physics Pendulum + 3D Ear Perk
    this.antennaAngle = 0;
    this.antennaVel = 0;
    this.earPerk = 0;

    // Articulated 5-Finger Floating Hands Rig
    this.leftHand = {
      x: -112, y: 20, vx: 0, vy: 0,
      rot: -0.15, vRot: 0, scale: 1,
      pose: 'normal', layer: 'front',
      hoverReach: 0, fingerWave: 0,
    };
    this.rightHand = {
      x: 112, y: 20, vx: 0, vy: 0,
      rot: 0.15, vRot: 0, scale: 1,
      pose: 'normal', layer: 'front',
      hoverReach: 0, fingerWave: 0,
    };

    // Autonomous Blinking, Double-Blinks, Saccades & Micro-Glances
    this.blinkTimer = 2.0;
    this.isBlinking = false;
    this.blinkProgress = 0;
    this.saccadeX = 0;
    this.saccadeY = 0;
    this.saccadeTimer = 0.8;
    this.idleGlanceTimer = 3.0;
    this.glanceOffsetX = 0;
    this.glanceOffsetY = 0;
    this.pokeCount = 0;
    this.lastPoke = 0;

    // Parametric Spring Eye Rig (True Silhouette — No Eyebrows)
    this.leftEye = {
      w: 26, h: 36, radius: 12,
      topLid: 0, bottomLid: 0, slant: 0,
      happyArch: 0, sadArch: 0,
      offX: 0, offY: 0, rot: 0,
      cross: 0, ring: 0, pupilScale: 1,
    };
    this.rightEye = { ...this.leftEye };

    this.particles = [];
    this.bubbleTimeout = null;

    // Estado de arrastre para los manejadores de attachInteractions()
    this._dragStartX = 0;
    this._dragStartY = 0;
    this._movedDuringDrag = false;
    this._lastPetParticleTime = 0;

    this.resize();
    this._onResize = () => this.resize();
    if (HAS_WINDOW && typeof window.addEventListener === 'function') {
      window.addEventListener('resize', this._onResize);
    }
  }

  resize() {
    const dpr = (HAS_WINDOW && window.devicePixelRatio) || 1;
    let w = 0;
    let h = 0;
    if (HAS_DOM) {
      const container = typeof document.getElementById === 'function' ? document.getElementById('stage-container') : null;
      const target = container || this.canvas;
      const rect = target?.getBoundingClientRect?.() || null;
      w = rect?.width || 0;
      h = rect?.height || 0;
      if (!w && HAS_WINDOW) w = window.innerWidth;
      if (!h && HAS_WINDOW) h = window.innerHeight - 240;
    } else if (this.canvas) {
      w = this.canvas.clientWidth || this.canvas.width || 0;
      h = this.canvas.clientHeight || this.canvas.height || 0;
    }
    this.width = Math.max(300, w || 800);
    this.height = Math.max(200, h || 600);
    if (this.canvas) {
      this.canvas.width = this.width * dpr;
      this.canvas.height = this.height * dpr;
    }
    if (this.ctx && typeof this.ctx.setTransform === 'function') {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const prevHomeX = this.homeX;
    this.homeX = this.width / 2;
    this.homeY = this.height / 2 + 12;

    if (!this.isDragging) {
      if (!prevHomeX || Math.abs(this.x - prevHomeX) < 60) {
        this.x = this.homeX;
        this.y = this.homeY;
      }
    }
  }

  activateHands(duration = 10.0) {
    if (this.handsMode === 'hidden') return;
    this.handsActiveTimer = Math.max(this.handsActiveTimer, duration);
  }

  triggerSurfaceRipple(angle = 0, amp = 1.0) {
    // Uses a non-distorting 3D internal specular pulse instead of warping body vertices
    this.visorGlowBoost = Math.min(1.0, this.visorGlowBoost + amp * 0.45);
  }

  triggerIdleMicroAnimation(forcedType = null) {
    const types = ['curious-tilt', 'happy-hop', 'float-sway', 'ear-perk', 'look-around', 'gentle-breath'];
    const chosen = forcedType || types[Math.floor(Math.random() * types.length)];
    this.idleMicroType = chosen;
    this.idleMicroTimer = 0;

    switch (chosen) {
      case 'curious-tilt':
        this.velRot += (Math.random() < 0.5 ? 1 : -1) * 0.08 * this.liveliness;
        this.glanceOffsetX = (Math.random() - 0.5) * 0.35;
        break;
      case 'happy-hop':
        this.impulse(0.97, 1.03, -8 * this.liveliness, 0);
        break;
      case 'float-sway':
        this.vx += (Math.random() < 0.5 ? -1 : 1) * 3.5 * this.liveliness;
        break;
      case 'ear-perk':
        this.antennaVel += 0.25 * this.accessoryBounce;
        this.earPerk = Math.min(1.2, this.earPerk + 0.65);
        break;
      case 'look-around':
        this.glanceOffsetX = (Math.random() < 0.5 ? -0.52 : 0.52);
        this.glanceOffsetY = -0.15;
        break;
      case 'gentle-breath':
        this.impulse(0.98, 1.02, -4 * this.liveliness, 0);
        break;
    }
  }

  /*
   * Volume-Preserving Micro-Impulse:
   * Keeps the avatar's silhouette 100% recognizable and undistorted (max ±4% scale cushion)
   * while transferring kinetic energy into vertical bounce, 3D tilt, antenna whip, and hands!
   */
  impulse(sx, sy, vy = 0, rot = 0, vx = 0) {
    const j = Math.min(1.2, this.jellyIntensity * 0.22);
    const dSX = Math.max(-0.04, Math.min(0.04, (sx - 1) * j));
    const dSY = -dSX; // Strictly volume-preserving so size never distorts
    this.scaleX = 1 + dSX;
    this.scaleY = 1 + dSY;
    this.vx += vx;
    this.vy += vy * 0.85;
    this.velRot += Math.max(-0.14, Math.min(0.14, rot * 0.65));
    this.antennaVel -= (rot * 1.8 + vx * 0.012) * this.accessoryBounce;
    this.visorGlowBoost = Math.min(1.0, this.visorGlowBoost + 0.35);
    if (this.leftHand && this.rightHand) {
      this.leftHand.vy -= vy * 0.55;
      this.rightHand.vy -= vy * 0.55;
      this.leftHand.vx -= dSX * 90;
      this.rightHand.vx += dSX * 90;
    }
  }

  triggerSpin(direction = 1) {
    this.spinTarget += Math.PI * 2 * direction;
    this.impulse(0.97, 1.03, -12, 0.10 * direction);
    this.spawnParticles('star', 10);
    if (this.sound && typeof this.sound.play === 'function') this.sound.play('spin');
  }

  say(text, durationMs = 2600) {
    if (!HAS_DOM) return;
    const bubble = document.getElementById('avatar-bubble');
    if (!bubble) return;
    bubble.textContent = text;
    bubble.style.opacity = '1';
    clearTimeout(this.bubbleTimeout);
    this.bubbleTimeout = setTimeout(() => {
      bubble.style.opacity = '0';
    }, durationMs);
  }

  speak(text, duration = 3.2) {
    if (this.mouthStyle === 'none') {
      this.mouthStyle = 'led-wave';
      if (HAS_DOM) {
        /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.mouth-btn')).forEach((b) => {
          b.classList.toggle('active', b.dataset.mouth === this.mouthStyle);
        });
      }
    }
    this.isTalking = true;
    this.talkTimer = duration;
    this.say(text, duration * 1000);
    if (this.sound && typeof this.sound.play === 'function') this.sound.play('talk');
  }

  spawnParticles(type, count = 8) {
    spawnParticlesOn(this, type, count);
  }

  play(stateName, options = {}) {
    this.state = stateName;
    this.stateTimer = 0;
    this.idleMicroType = 'none';
    if (!options.silent) {
      if (this.sound && typeof this.sound.play === 'function') this.sound.play(stateName);
    }

    if (stateName !== 'idle' && !options.keepHandsHidden) {
      this.activateHands(10.0);
    }

    if (HAS_DOM) {
      const hud = document.getElementById('hud-api-call');
      if (hud) hud.textContent = `avatar.play('${stateName}')`;
      /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.state-btn')).forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.state === stateName);
      });
    }

    switch (stateName) {
      case 'idle':
        this.impulse(1.06, 0.94, 0, 0);
        if (!options.silent) this.say('Listo · Esperando instrucciones');
        break;
      case 'talk':
        this.impulse(1.08, 0.93, -6, 0.05);
        this.speak('¡Hola! Todo mi cuerpo, ojos, boca y accesorios reaccionan en tiempo real.', 3.8);
        break;
      case 'bored':
        this.impulse(1.12, 0.88, 6, 0.06, 0);
        this.say('😒 Qué aburrimiento... nada que procesar');
        break;
      case 'waiting':
        this.impulse(0.95, 1.06, -4, 0);
        this.say('⏳ Pensando / Esperando respuesta del agente...');
        break;
      case 'input':
        this.impulse(1.08, 0.93, 2, -0.04);
        this.say('⌨️ Leyendo lo que escribes token por token...');
        break;
      case 'send':
        this.impulse(1.24, 0.76, 8, 0);
        this.triggerSurfaceRipple(-Math.PI / 2, 1.1);
        this.spawnParticles('spark', 10);
        this.say('🚀 ¡Prompt enviado a toda velocidad!');
        break;
      case 'success':
        this.impulse(0.82, 1.25, -18, 0);
        this.triggerSurfaceRipple(-Math.PI / 2, 0.8);
        this.spawnParticles('star', 12);
        this.say('✅ ¡Tarea completada con éxito!');
        break;
      case 'failure':
        this.impulse(1.24, 0.78, 14, -0.14, 0);
        this.say('🫠 La tarea falló en el último paso...');
        break;
      case 'warning':
        this.impulse(0.9, 1.14, -8, 0.12);
        this.triggerSurfaceRipple(0, 0.7);
        this.say('⚠️ Atención: revisa los permisos o parámetros');
        break;
      case 'thinking':
        this.impulse(0.94, 1.06, 0, 0.06);
        this.say('💭 Pensando…');
        break;
      case 'approval':
        this.impulse(1.1, 0.92, 0, 0.14);
        this.triggerSurfaceRipple(0, 0.6);
        this.say('✋ Necesito tu aprobación para continuar');
        break;
      case 'question':
        this.impulse(1.04, 0.98, 0, -0.1);
        this.say('❓ Tengo una pregunta');
        break;
      case 'ratelimit':
        this.impulse(0.96, 1.05, 0, 0.05);
        this.say('⏳ El proveedor nos está limitando: espero');
        break;
      case 'inspect':
        this.impulse(1.1, 0.92, -3, 0.08, 0);
        this.say('🧐 Inspeccionando código y trazas al detalle...');
        break;
      case 'blocked':
        this.impulse(1.18, 0.85, 0, -0.18, 0);
        this.triggerSurfaceRipple(Math.PI, 0.9);
        this.say('🛑 Acción bloqueada por política o firewall');
        break;
      case 'error':
        this.impulse(1.25, 0.8, -6, 0.25);
        this.triggerSurfaceRipple(0, 1.3);
        this.spawnParticles('glitch', 12);
        this.say('⚡ ERROR CRÍTICO DE SISTEMA');
        break;
      case 'surprise':
        this.impulse(0.76, 1.32, -20, 0);
        this.triggerSurfaceRipple(-Math.PI / 2, 1.1);
        this.say('😲 ¡¿Qué acaba de pasar?!');
        break;
      case 'sleep':
        this.impulse(1.1, 0.9, 5, 0.08);
        this.say('😴 Modo reposo activado... Zzz');
        break;
      case 'wake':
        this.impulse(0.85, 1.22, -14, -0.08);
        this.spawnParticles('star', 6);
        this.say('🌅 ¡Despierto y calibrado al 100%!');
        break;
      case 'wave':
        this.impulse(1.14, 0.88, -10, -0.1);
        this.say('Coucou ! 👋 ¡Hola humano!');
        break;
      case 'poke':
        this.impulse(1.24, 0.8, -6, (Math.random() - 0.5) * 0.35);
        this.say('😠 ¡Oye! ¡No me pinches el chasis!');
        break;
      case 'dizzy':
        this.impulse(1.2, 0.84, -8, 0.4);
        this.say('😵‍💫 Demasiados toques... giroscopio mareado');
        break;
      case 'spin':
        this.triggerSpin(Math.random() < 0.5 ? 1 : -1);
        this.say('🔄 ¡Vuelta acrobática de 360°!');
        break;
      case 'box':
        this.impulse(1.28, 0.75, -6, 0);
        this.say('📦 ¡Archivo recibido y empaquetado!');
        break;
      case 'listen':
        this.impulse(0.92, 1.1, -4, 0);
        this.say('🎙️ Escuchando tu voz en tiempo real...');
        break;
      case 'love':
        this.impulse(0.86, 1.2, -14, 0);
        this.spawnParticles('heart', 10);
        this.say('😍 ¡Me encanta construir contigo!');
        break;
    }
  }

  update(dt) {
    this.time += dt;
    this.stateTimer += dt;
    const live = this.liveliness;

    // 0. Smoothly interpolate hover sensor intensities
    this.bodyHoverAmount += ((this.isHoveringBody ? 1 : 0) - this.bodyHoverAmount) * 0.18;
    this.leftPodHoverAmount += ((this.isHoveringLeftPod ? 1 : 0) - this.leftPodHoverAmount) * 0.22;
    this.rightPodHoverAmount += ((this.isHoveringRightPod ? 1 : 0) - this.rightPodHoverAmount) * 0.22;
    this.leftHandHoverAmount += ((this.isHoveringLeftHand ? 1 : 0) - this.leftHandHoverAmount) * 0.22;
    this.rightHandHoverAmount += ((this.isHoveringRightHand ? 1 : 0) - this.rightHandHoverAmount) * 0.22;
    this.visorGlowBoost *= 0.88;

    // 1. Position & Smooth 3D Hover Spring back to Home Center
    if (!this.isDragging) {
      const springK = 0.14;
      const damping = 0.78;

      // Subtle magnetic 3D lean toward cursor when hovering or nearby
      const ptrDX = this.pointerX - this.homeX;
      const ptrDY = this.pointerY - this.homeY;
      const ptrDist = Math.hypot(ptrDX, ptrDY);
      const magPull = (ptrDist < 280 && this.state !== 'sleep')
        ? (1 - ptrDist / 280) * (6 + this.bodyHoverAmount * 4) * this.parallaxIntensity
        : 0;
      const magX = ptrDist > 1 ? (ptrDX / ptrDist) * magPull : 0;
      const magY = ptrDist > 1 ? (ptrDY / ptrDist) * magPull - this.bodyHoverAmount * 4 : 0;

      // State-specific positional choreography (translational only — never distorts body size)
      let stateOffsetX = 0;
      let stateOffsetY = Math.sin(this.time * 2.4) * 3.5 * live; // Gentle 3D floating levitation
      if (this.state === 'send') {
        if (this.stateTimer < 0.18) {
          stateOffsetY = 12;
        } else if (this.stateTimer < 0.85) {
          stateOffsetY = -36 * Math.sin(((this.stateTimer - 0.18) / 0.67) * Math.PI);
        }
      } else if (this.state === 'failure') {
        stateOffsetY = 10;
      } else if (this.state === 'bored') {
        stateOffsetY = 6;
        stateOffsetX = -4;
      } else if (this.state === 'waiting') {
        stateOffsetX = Math.sin(this.time * 2.4) * 6 * live;
        stateOffsetY = Math.cos(this.time * 4.8) * 4 * live;
      } else if (this.state === 'blocked') {
        stateOffsetX = Math.sin(this.time * 26) * Math.max(0, 1 - this.stateTimer * 0.6) * 8;
      }

      const targetHomeX = this.homeX + magX + stateOffsetX;
      const targetHomeY = this.homeY + magY + stateOffsetY;

      const ax = (targetHomeX - this.x) * springK;
      const ay = (targetHomeY - this.y) * springK;
      this.vx = (this.vx + ax) * damping;
      this.vy = (this.vy + ay) * damping;
      this.x += this.vx;
      this.y += this.vy;

      this.dragStretchX *= 0.80;
      this.dragStretchY *= 0.80;
    }

    // Decay targeted poke flinches & head petting
    this.leftFlinch *= 0.86;
    this.rightFlinch *= 0.86;
    this.pettingAmount = Math.max(0, this.pettingAmount - dt * 0.85);

    // 2. Autonomous Idle Micro-Behaviors (Zero shape distortion)
    if (this.state === 'idle' && !this.isDragging && live > 0.1) {
      this.nextIdleMicroIn -= dt * live;
      if (this.nextIdleMicroIn <= 0) {
        this.triggerIdleMicroAnimation();
        this.nextIdleMicroIn = 4.0 + Math.random() * 4.5;
      }
    }

    let microRot = 0;
    if (this.idleMicroType !== 'none') {
      this.idleMicroTimer += dt;
      const mt = this.idleMicroTimer;
      if (this.idleMicroType === 'curious-tilt') {
        microRot = Math.sin(mt * 4.2) * 0.065 * Math.max(0, 1 - mt * 0.55);
        if (mt > 1.8) this.idleMicroType = 'none';
      } else if (mt > 1.5) {
        this.idleMicroType = 'none';
      }
    }

    // 3. Undistorted Body Scale & Subtle 3D Attitude Tilt
    const breath = Math.sin(this.time * 2.4) * 0.006 * live;
    let targetSX = 1.0 - breath + this.dragStretchX;
    let targetSY = 1.0 + breath + this.dragStretchY;
    let targetRot = (this.vx * 0.0045) + microRot + (this.headLookX * 0.035);

    if (this.pettingAmount > 0.15) {
      targetRot += Math.sin(this.time * 6) * 0.045 * this.pettingAmount;
    }

    if (this.state === 'waiting') {
      targetRot += Math.sin(this.time * 3) * 0.035 * live;
    } else if (this.state === 'bored') {
      targetRot = 0.04;
    } else if (this.state === 'failure') {
      targetRot = -0.05;
    } else if (this.state === 'blocked' || this.state === 'warning') {
      targetRot += Math.sin(this.time * 18) * 0.04;
    } else if (this.state === 'error') {
      targetRot += (Math.random() - 0.5) * 0.08;
    } else if (this.state === 'success' || this.state === 'love') {
      if (Math.sin(this.time * 10) > 0.88 && Math.abs(this.y - this.homeY) < 6) {
        this.vy = -5.5 * live;
      }
      targetRot += Math.sin(this.time * 5) * 0.04;
    } else if (this.state === 'inspect') {
      targetRot = 0.045;
    } else if (this.state === 'dizzy') {
      targetRot = Math.sin(this.time * 8) * 0.11;
    } else if (this.state === 'wave') {
      targetRot = Math.sin(this.time * 9) * 0.055;
    } else if (this.state === 'sleep') {
      targetRot = 0.045;
      if (Math.random() < 0.035) {
        this.particles.push({
          type: 'zzz',
          x: this.x + 45 * this.globalScale,
          y: this.y - 65 * this.globalScale,
          vx: 0.6,
          vy: -1.1,
          life: 1.0,
        });
      }
    }

    // Tight spring solver for scale (clamped to ±4% max) & rotation (clamped to ±12°)
    this.velSX = (this.velSX + (targetSX - this.scaleX) * 0.24) * 0.72;
    this.velSY = (this.velSY + (targetSY - this.scaleY) * 0.24) * 0.72;
    this.scaleX = Math.max(0.96, Math.min(1.04, this.scaleX + this.velSX));
    this.scaleY = Math.max(0.96, Math.min(1.04, this.scaleY + this.velSY));

    this.velRot = (this.velRot + (targetRot - this.rotation) * 0.18) * 0.76;
    this.rotation = Math.max(-0.20, Math.min(0.20, this.rotation + this.velRot));

    // Smooth 360° 3D Y-axis turntable spin interpolation
    this.spinAngle += (this.spinTarget - this.spinAngle) * 0.14;
    if (Math.abs(this.spinTarget - this.spinAngle) < 0.005) {
      this.spinAngle = 0;
      this.spinTarget = 0;
    }

    // 4. Secondary Antenna / Head-Accessory Whip Physics + 3D Emotional & Hover Ear Perk
    let targetEarPerk = (this.bodyHoverAmount * 0.35) + Math.max(this.leftPodHoverAmount, this.rightPodHoverAmount) * 0.45;
    if (['surprise', 'wake', 'success', 'inspect', 'listen', 'love', 'send'].includes(this.state)) {
      targetEarPerk = 1.0;
    } else if (['failure', 'bored', 'sleep', 'poke', 'blocked'].includes(this.state)) {
      targetEarPerk = -0.85;
    }
    this.earPerk += (targetEarPerk - this.earPerk) * 0.14;

    const antennaTarget = (-this.rotation * 1.6 - (this.vx * 0.02) - (this.spinTarget - this.spinAngle) * 0.2) * this.accessoryBounce;
    this.antennaVel = (this.antennaVel + (antennaTarget - this.antennaAngle) * 0.25) * 0.82;
    this.antennaAngle += this.antennaVel;

    // 5. Hands Visibility Mode & Timer
    if (this.handsMode === 'always') {
      this.handsActiveTimer = 10.0;
    } else if (this.handsMode === 'hidden') {
      this.handsActiveTimer = 0;
    } else {
      if (this.isDragging) {
        this.handsActiveTimer = 10.0;
      } else if (this.handsActiveTimer > 0) {
        this.handsActiveTimer = Math.max(0, this.handsActiveTimer - dt);
      }
    }
    const targetHandVis = (this.handsMode === 'always' || (this.handsMode === 'auto' && this.handsActiveTimer > 0)) ? 1.0 : 0.0;
    this.handVisibility += (targetHandVis - this.handVisibility) * (targetHandVis > 0.5 ? 0.22 : 0.14);

    if (HAS_DOM) {
      const handsBadge = document.getElementById('hands-timer-badge');
      if (handsBadge) {
        if (this.handsMode === 'always') {
          handsBadge.textContent = '✋ Manos: Fijas ON';
          handsBadge.className = 'mono text-[11px] px-2 py-0.5 rounded-full bg-[#dbf59d]/15 text-[#dbf59d] border border-[#dbf59d]/30';
        } else if (this.handsMode === 'hidden') {
          handsBadge.textContent = '✋ Manos: OFF';
          handsBadge.className = 'mono text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-zinc-500';
        } else if (this.handsActiveTimer > 0.05) {
          handsBadge.textContent = `✋ Manos: ${this.handsActiveTimer.toFixed(1)}s`;
          handsBadge.className = 'mono text-[11px] px-2 py-0.5 rounded-full bg-[#dbf59d]/15 text-[#dbf59d] border border-[#dbf59d]/30';
        } else {
          handsBadge.textContent = '✋ Manos: Ocultas';
          handsBadge.className = 'mono text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-zinc-400';
        }
      }
    }

    // 6. Speech & Lip-Sync Articulation Update (delegado a render/mouth.js)
    updateMouth(this, dt);

    // 7. Autonomous Micro-Glances, Saccades & Smooth Blinking
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      if (!this.isBlinking) {
        this.isBlinking = true;
        this.blinkTimer = 0.11;
      } else {
        this.isBlinking = false;
        this.blinkTimer = Math.random() < 0.22 ? 0.16 : (2.2 + Math.random() * 3.2);
      }
    }
    const blinkTarget = (this.isBlinking || this.state === 'sleep') ? 1.0 : 0.0;
    this.blinkProgress += (blinkTarget - this.blinkProgress) * (this.isBlinking ? 0.48 : 0.32);

    this.saccadeTimer -= dt;
    if (this.saccadeTimer <= 0) {
      this.saccadeTimer = 0.35 + Math.random() * 0.9;
      this.saccadeX = (Math.random() - 0.5) * 0.07 * live;
      this.saccadeY = (Math.random() - 0.5) * 0.05 * live;
    }

    this.idleGlanceTimer -= dt;
    if (this.idleGlanceTimer <= 0) {
      this.idleGlanceTimer = 2.5 + Math.random() * 4.0;
      if (Math.random() < 0.45 && live > 0.2) {
        this.glanceOffsetX = (Math.random() - 0.5) * 0.45;
        this.glanceOffsetY = (Math.random() - 0.5) * 0.3;
      } else {
        this.glanceOffsetX = 0;
        this.glanceOffsetY = 0;
      }
    }

    // 8. Pointer Tracking with Dual 3D Spherical Inertia
    const dx = this.pointerX - this.x;
    const dy = this.pointerY - this.y;
    const dist = Math.hypot(dx, dy);
    const maxDist = 340;
    const norm = Math.min(dist / maxDist, 1.0) * this.parallaxIntensity;
    const angle = Math.atan2(dy, dx);

    let targetLookX = Math.cos(angle) * norm + this.glanceOffsetX + this.saccadeX;
    let targetLookY = Math.sin(angle) * norm + this.glanceOffsetY + this.saccadeY;

    if (this.state === 'input') {
      const linePhase = (this.time * 1.9) % 1;
      targetLookX = -0.65 + linePhase * 1.3;
      targetLookY = 0.25 + Math.floor((this.time * 1.9) % 3) * 0.14;
    } else if (this.state === 'waiting') {
      targetLookX = Math.sin(this.time * 3.2) * 0.52;
      targetLookY = -0.35 + Math.cos(this.time * 6.4) * 0.22;
    } else if (this.state === 'bored') {
      targetLookX = -0.42 + Math.sin(this.time * 0.8) * 0.18;
      targetLookY = 0.32;
    } else if (this.state === 'sleep') {
      targetLookX = 0;
      targetLookY = 0.35;
    } else if (this.state === 'send') {
      const launchPhase = Math.min(1, this.stateTimer * 2.5);
      targetLookX = 0;
      targetLookY = -0.75 * (1 - launchPhase * 0.4);
    } else if (this.state === 'inspect') {
      targetLookX = Math.sin(this.time * 2.4) * 0.35;
      targetLookY = Math.cos(this.time * 1.7) * 0.2;
    } else if (this.state === 'failure') {
      targetLookX = 0;
      targetLookY = 0.58;
    }

    // Clamp look vectors to [-1, 1] so eyes and visor always stay cleanly inside the head
    targetLookX = Math.max(-0.95, Math.min(0.95, targetLookX));
    targetLookY = Math.max(-0.90, Math.min(0.90, targetLookY));

    this.eyeLookX += (targetLookX - this.eyeLookX) * 0.24;
    this.eyeLookY += (targetLookY - this.eyeLookY) * 0.24;
    this.headLookX += (targetLookX - this.headLookX) * 0.10;
    this.headLookY += (targetLookY - this.headLookY) * 0.10;

    // 9. Update Parametric Eye Rig & Hands Rig
    updateEyeRig(this, dt);
    updateHandsRig(this, dt);

    // 10. Update floating speech bubble position
    if (HAS_DOM) {
      const bubble = document.getElementById('avatar-bubble');
      if (bubble) {
        const totalH = 82 * this.bodyHeightRatio * this.globalScale * this.scaleY;
        bubble.style.left = `${this.x}px`;
        bubble.style.top = `${this.y - totalH - 38}px`;
      }
    }

    // 11. Update world-space particles
    updateParticles(this, dt);
  }

  draw() {
    const ctx = this.ctx;
    if (!ctx || typeof ctx.clearRect !== 'function') return;
    ctx.clearRect(0, 0, this.width, this.height);

    const baseR = 84;
    const rx = baseR * this.bodyWidthRatio;
    const ry = (baseR * 0.92) * this.bodyHeightRatio;
    const accent = getStateAccentColor(this);

    // True 3D Spherical Rotation Angles (Body never flattens; features wrap in 3D!)
    const totalYaw = this.spinAngle + this.headLookX * 0.28;
    const cosYaw = Math.cos(totalYaw);
    const sinYaw = Math.sin(totalYaw);
    const isFrontView = Math.cos(this.spinAngle) >= 0;
    const turnShiftX = Math.sin(this.spinAngle) * rx * 0.62;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.globalScale, this.globalScale);

    // Floor 3D Ambient Occlusion + Contact Shadow + State Aura Reflection
    const shadowScale = Math.max(0.45, 1 - Math.abs(this.y - this.homeY) / 190);
    ctx.save();
    const floorGrad = ctx.createRadialGradient(
      this.headLookX * 8, ry + 26, 4,
      this.headLookX * 8, ry + 26, rx * 0.95 * shadowScale,
    );
    floorGrad.addColorStop(0, 'rgba(0, 0, 0, 0.68)');
    floorGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.32)');
    floorGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = floorGrad;
    ctx.beginPath();
    ctx.ellipse(this.headLookX * 6, ry + 26, rx * 0.95 * shadowScale, 14 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    if (this.showVisor || this.autoStateColors || this.bodyHoverAmount > 0.05) {
      const auraAlpha = (0.18 + this.bodyHoverAmount * 0.12) * shadowScale;
      ctx.fillStyle = hexToRgba(accent, auraAlpha);
      ctx.beginPath();
      ctx.ellipse(this.headLookX * 10, ry + 26, rx * 0.60 * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.handVisibility > 0.05) {
      ctx.fillStyle = `rgba(0, 0, 0, ${0.34 * this.handVisibility})`;
      ctx.beginPath();
      ctx.ellipse(this.leftHand.x * 0.92, ry + 28, 16 * shadowScale * this.handVisibility, 5 * shadowScale * this.handVisibility, 0, 0, Math.PI * 2);
      ctx.ellipse(this.rightHand.x * 0.92, ry + 28, 16 * shadowScale * this.handVisibility, 5 * shadowScale * this.handVisibility, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Apply subtle 3D Attitude Tilt + Undistorted Volume-Preserving Scale
    ctx.rotate(this.rotation);
    ctx.scale(this.scaleX, this.scaleY);

    // 0. Back-layer Hands & Far-Side 3D Acoustic Ear Pod
    if (this.handVisibility > 0.03) {
      drawHands(ctx, this, 'back');
    }
    if ((this.showSidePods || this.accessory === 'cx-full-kit') && this.state !== 'box') {
      drawRobotEars3D(ctx, this, rx, ry, 'back', sinYaw, cosYaw);
    }

    // 1. Main Body (Cardboard Box in 'box' state, otherwise Pure Undistorted 3D Squircle)
    if (this.state === 'box') {
      drawBoxBody(ctx, this, rx, ry);
    } else {
      drawSquircleBody(ctx, this, rx, ry, this.squircleN);
    }

    // 2. Front Face vs Rear 3D Backplate (Clipped to 3D Body Contour during 360° Spin!)
    if (this.state !== 'box') {
      ctx.save();
      buildSquirclePath(ctx, rx, ry, this.squircleN);
      ctx.clip();

      if (isFrontView) {
        const faceCos = Math.max(0.28, Math.cos(this.spinAngle));
        ctx.save();
        ctx.translate(turnShiftX, 0);
        ctx.scale(faceCos, 1);

        if (this.showVisor) {
          drawInnerVisor(ctx, this, rx, ry);
        }
        drawEyes(ctx, this, rx, ry);
        if (this.mouthStyle !== 'none') {
          drawMouth(ctx, this, rx, ry);
        }
        ctx.restore();
      } else {
        drawRearChassis3D(ctx, this, rx, ry, Math.sin(this.spinAngle), Math.cos(this.spinAngle));
      }
      ctx.restore();
    }

    // 3. State Overlays (Loupe, Keyboard, Thinking Dots, Orbiting Stars)
    if (isFrontView && this.state !== 'box') {
      ctx.save();
      ctx.translate(turnShiftX, 0);
      drawStateOverlays(ctx, this, rx, ry);
      ctx.restore();
    }

    // 4. Near-Side 3D Acoustic Ear Pod (drawn in front of body edge when head turns!)
    if ((this.showSidePods || this.accessory === 'cx-full-kit') && this.state !== 'box') {
      drawRobotEars3D(ctx, this, rx, ry, 'front', sinYaw, cosYaw);
    }

    // 5. Top-of-Head 3D Accessories
    if (this.state !== 'box' && this.accessory !== 'none') {
      drawTopAccessory(ctx, this, rx, ry, turnShiftX, sinYaw);
    }

    // 6. Front-layer Articulated 5-Finger Hands
    if (this.handVisibility > 0.03) {
      drawHands(ctx, this, 'front');
    }

    ctx.restore();

    // 7. World-Space Particles
    drawParticles(ctx, this);
  }

  // Aplica uno de los presets de Ego (ver STUDIO_PRESETS en ./config.js).
  // Cada preset fija una identidad completa: chasis, visor, ojos, boca,
  // accesorio y estado inicial.
  applyPreset(presetName) {
    if (HAS_DOM) {
      /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.preset-btn')).forEach((b) => b.classList.toggle('active', b.dataset.preset === presetName));
    }

    // Reset parametric dimensions to clean 100% defaults when switching base model
    const D = /** @type {Record<string, number>} */ (STUDIO_DEFAULTS ?? {});
    this.bodyWidthRatio = D.bodyWidthRatio ?? 1.0;
    this.bodyHeightRatio = D.bodyHeightRatio ?? 1.0;
    this.globalScale = D.globalScale ?? 1.0;
    this.visorWidthRatio = D.visorWidthRatio ?? 1.0;
    this.visorHeightRatio = D.visorHeightRatio ?? 1.0;
    this.visorCornerRadius = D.visorCornerRadius ?? 30;
    this.eyeWidthRatio = D.eyeWidthRatio ?? 1.0;
    this.eyeHeightRatio = D.eyeHeightRatio ?? 1.0;
    this.eyeSpacing = D.eyeSpacing ?? 28;
    this.eyeOffsetY = D.eyeOffsetY ?? -2;
    this.eyeGlowBlur = D.eyeGlowBlur ?? 18;
    this.mouthScale = D.mouthScale ?? 1.0;
    this.mouthOffsetY = D.mouthOffsetY ?? 24;
    this.accessoryScale = D.accessoryScale ?? 1.0;
    this.accessoryOffsetY = D.accessoryOffsetY ?? 0;
    this.accessoryBounce = D.accessoryBounce ?? 1.0;

    const p = STUDIO_PRESETS[presetName] || STUDIO_PRESETS['cx-faithful'];
    this.variantMode = p.variantMode;
    this.bodyColor = p.bodyColor;
    this.visorColor = p.visorColor ?? '#06080e';
    this.showVisor = p.showVisor;
    this.showSidePods = p.showSidePods;
    this.eyeColor = p.eyeColor;
    this.autoStateColors = p.autoStateColors;
    this.eyeStyle = p.eyeStyle;
    this.mouthStyle = p.mouthStyle;
    this.accessory = p.accessory;
    this.squircleN = p.squircleN;
    this.handsActiveTimer = p.handsActiveTimer ?? 0;
    this.play(p.play, p.playOptions);
  }

  // Registra todos los oyentes de canvas/window de las líneas 4158-4345.
  // La llama la demo; el constructor NO la llama (seguro en Node).
  attachInteractions() {
    if (!this.canvas || typeof this.canvas.addEventListener !== 'function') return;
    this.detachInteractions(); // evita duplicados al re-vincular el canvas
    this._dragStartX = 0;
    this._dragStartY = 0;
    this._movedDuringDrag = false;
    this._lastPetParticleTime = 0;

    const onDown = (e) => this._onPointerDown(e);
    const onMove = (e) => this._onPointerMove(e);
    const onUp = (e) => this._onPointerUp(e);
    const onDragOver = (e) => e.preventDefault();
    const onDrop = (e) => this._onDrop(e);
    const onWheel = (e) => this._onWheel(e);
    const onDbl = (e) => this._onDblClick(e);
    this._boundHandlers = { onDown, onMove, onUp, onDragOver, onDrop, onWheel, onDbl };
    this.canvas.addEventListener('pointerdown', onDown);
    if (HAS_WINDOW) {
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('dragover', onDragOver);
      window.addEventListener('drop', onDrop);
    }
    this.canvas.addEventListener('wheel', onWheel, { passive: false });
    this.canvas.addEventListener('dblclick', onDbl);
  }

  /** Suelta los oyentes de attachInteractions (re-montaje/desconexión). */
  detachInteractions() {
    try {
      if (HAS_WINDOW && typeof window.removeEventListener === 'function' && this._onResize) {
        window.removeEventListener('resize', this._onResize);
      }
    } catch {
      /* entorno sin DOM */
    }
    const b = this._boundHandlers;
    if (!b) return;
    this._boundHandlers = null;
    try {
      this.canvas?.removeEventListener?.('pointerdown', b.onDown);
      this.canvas?.removeEventListener?.('wheel', b.onWheel);
      this.canvas?.removeEventListener?.('dblclick', b.onDbl);
      if (HAS_WINDOW && typeof window.removeEventListener === 'function') {
        window.removeEventListener('pointermove', b.onMove);
        window.removeEventListener('pointerup', b.onUp);
        window.removeEventListener('dragover', b.onDragOver);
        window.removeEventListener('drop', b.onDrop);
      }
    } catch {
      /* entorno sin DOM */
    }
  }

  _onPointerDown(e) {
    if (this.sound && typeof this.sound.init === 'function') this.sound.init();
    const rect = this.canvas.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;

    // 1. Direct Click on Visible Hand = High-Five / Choca esos cinco!
    if (this.handVisibility > 0.35) {
      const relX = (localX - this.x) / this.globalScale;
      const relY = (localY - this.y) / this.globalScale;
      const distLH = Math.hypot(relX - this.leftHand.x, relY - this.leftHand.y);
      const distRH = Math.hypot(relX - this.rightHand.x, relY - this.rightHand.y);
      if (distLH < 34 || distRH < 34) {
        const targetHand = distLH < 34 ? this.leftHand : this.rightHand;
        targetHand.vy = -12;
        targetHand.scale = 1.3;
        this.activateHands(10.0);
        this.impulse(0.97, 1.03, -8, distLH < 34 ? -0.08 : 0.08);
        this.spawnParticles('star', 8);
        if (this.sound && typeof this.sound.play === 'function') this.sound.play('highfive');
        this.say('✋ ¡Choca esos cinco! ¡Qué buen equipo!');
        return;
      }
    }

    const hitRadius = 135 * this.globalScale * Math.max(this.bodyWidthRatio, this.bodyHeightRatio);
    const dist = Math.hypot(localX - this.x, localY - this.y);
    if (dist <= hitRadius) {
      this.isDragging = true;
      this._movedDuringDrag = false;
      this._dragStartX = localX;
      this._dragStartY = localY;
      this.activateHands(10.0);
      try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    }
  }

  _onPointerMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;

    const moveDX = localX - this.prevPointerX;
    this.prevPointerX = localX;
    this.prevPointerY = localY;

    this.pointerX = localX;
    this.pointerY = localY;

    if (this.isDragging) {
      const dx = localX - this._dragStartX;
      const dy = localY - this._dragStartY;
      if (Math.hypot(dx, dy) > 6) this._movedDuringDrag = true;

      // Elastic 3D floating tether (keeps squircle undistorted, max ±3.5% scale)
      this.x = this.homeX + dx * 0.52;
      this.y = this.homeY + dy * 0.52;
      const stretch = Math.max(-0.035, Math.min(0.035, (Math.abs(dx) - Math.abs(dy)) * 0.0004 * this.jellyIntensity));
      this.dragStretchX = stretch;
      this.dragStretchY = -stretch;
    } else {
      // Interactive Hover Detection over Body, 3D Ear Pods, Forehead, and Hands
      const relX = (localX - this.x) / this.globalScale;
      const relY = (localY - this.y) / this.globalScale;
      const rx = 84 * this.bodyWidthRatio;
      const ry = 78 * this.bodyHeightRatio;

      const wasHoveringBody = this.isHoveringBody;
      this.isHoveringBody = (Math.abs(relX) < rx * 1.05 && Math.abs(relY) < ry * 1.05);

      // Hovering over Left or Right 3D Ear Pod
      this.isHoveringLeftPod = this.showSidePods && Math.hypot(relX - (-rx), relY) < 28;
      this.isHoveringRightPod = this.showSidePods && Math.hypot(relX - rx, relY) < 28;

      // Hovering over Left or Right Hand (also wakes hands in auto mode if cursor approaches hand zone)
      const distLH = Math.hypot(relX - this.leftHand.x, relY - this.leftHand.y);
      const distRH = Math.hypot(relX - this.rightHand.x, relY - this.rightHand.y);
      this.isHoveringLeftHand = distLH < 46;
      this.isHoveringRightHand = distRH < 46;

      if (!wasHoveringBody && this.isHoveringBody) {
        if (this.sound && typeof this.sound.play === 'function') this.sound.play('hover');
        if (this.handsMode === 'auto') this.activateHands(10.0);
      }
      if ((this.isHoveringLeftHand || this.isHoveringRightHand) && this.handsMode === 'auto') {
        this.activateHands(10.0);
      }

      // Dynamic cursor feedback
      if (this.canvas.style) {
        if (this.isHoveringLeftHand || this.isHoveringRightHand || this.isHoveringLeftPod || this.isHoveringRightPod) {
          this.canvas.style.cursor = 'pointer';
        } else if (this.isHoveringBody) {
          this.canvas.style.cursor = 'grab';
        } else {
          this.canvas.style.cursor = 'default';
        }
      }

      // Interactive Head Petting when rubbing cursor across the top of the head
      const nowMs = (typeof performance !== 'undefined' && performance.now()) || Date.now();
      const topEdge = -ry;
      if (Math.abs(relX) < rx * 0.85 && relY < topEdge + 42 && relY > topEdge - 42 && Math.abs(moveDX) > 4) {
        this.pettingAmount = Math.min(1.2, this.pettingAmount + 0.14);
        this.antennaVel += moveDX * 0.004 * this.accessoryBounce;
        if (nowMs - this._lastPetParticleTime > 380 && this.pettingAmount > 0.5) {
          this._lastPetParticleTime = nowMs;
          this.spawnParticles('heart', 2);
          this.say('🥰 ¡Mmmm, qué buenas caricias!');
        }
      }
    }
  }

  _onPointerUp(e) {
    if (!this.isDragging) return;
    this.isDragging = false;
    try { this.canvas.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }

    const rect = this.canvas.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;

    if (!this._movedDuringDrag) {
      const clickOffsetX = localX - this.x;
      const clickOffsetY = localY - this.y;
      const hitAngle = Math.atan2(clickOffsetY, clickOffsetX);
      this.triggerSurfaceRipple(hitAngle, 1.15);

      if (clickOffsetX < -10) {
        this.leftFlinch = 1.0;
        this.impulse(1.22, 0.82, -5, 0.22, 6);
      } else if (clickOffsetX > 10) {
        this.rightFlinch = 1.0;
        this.impulse(1.22, 0.82, -5, -0.22, -6);
      } else {
        this.impulse(1.24, 0.78, -6, 0);
      }

      const now = (typeof performance !== 'undefined' && performance.now()) || Date.now();
      this.pokeCount = (now - this.lastPoke < 1800) ? this.pokeCount + 1 : 1;
      this.lastPoke = now;
      if (this.pokeCount >= 4) {
        this.play('dizzy');
        this.pokeCount = 0;
      } else {
        this.play('poke');
      }
    } else {
      // Elastic snap-back ripple on release
      const snapAngle = Math.atan2(this.homeY - this.y, this.homeX - this.x);
      this.triggerSurfaceRipple(snapAngle, 0.95);
      if (this.sound && typeof this.sound.play === 'function') this.sound.play('wake');
    }
  }

  _onWheel(e) {
    e.preventDefault();
    const dir = Math.sign(e.deltaY);
    if (dir > 0) {
      this.impulse(1.18, 0.82, 9, 0);
      this.triggerSurfaceRipple(Math.PI / 2, 0.65);
    } else {
      this.impulse(0.84, 1.20, -11, 0);
      this.triggerSurfaceRipple(-Math.PI / 2, 0.65);
    }
    if (this.sound && typeof this.sound.play === 'function') this.sound.play('inspect');
  }

  _onDblClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const hitRadius = 145 * this.globalScale * Math.max(this.bodyWidthRatio, this.bodyHeightRatio);
    if (Math.hypot(localX - this.x, localY - this.y) <= hitRadius) {
      const dir = localX >= this.x ? 1 : -1;
      this.activateHands(10.0);
      this.play('spin', { silent: true });
      this.triggerSpin(dir);
    }
  }

  _onDrop(e) {
    e.preventDefault();
    this.activateHands(10.0);
    this.play('box');
  }

  // Bucle de render a 60 FPS de las líneas 4137-4146. Sin requestAnimationFrame
  // (Node) es un no-op que devuelve un detenedor vacío. Devuelve stop().
  startLoop() {
    if (typeof requestAnimationFrame === 'undefined') return () => {};
    let lastTime = (typeof performance !== 'undefined' && performance.now()) || Date.now();
    let stopped = false;
    const loop = (now) => {
      if (stopped) return;
      const dt = Math.min(Math.max((now - lastTime) / 1000, 0.001), 0.1);
      lastTime = now;
      this.update(dt);
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return () => { stopped = true; };
  }
}
