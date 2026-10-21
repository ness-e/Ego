// eyes.js — Rig ocular paramétrico (puerto verbatim del avatar studio).
// Fuente: repos-referencia/avatar/avatar_studio_cx_artlab_mochi_2_0.html
//   updateEyeRig: líneas 1531-1751.
// Vanilla ESM, sin dependencias. `S` es el objeto plano de estado del avatar
// (nunca se importa la clase — evita ciclos). Muta S.leftEye / S.rightEye.
// Adapted from ego-avatar-studio (licencia no declarada en el origen), repos-referencia/avatar/avatar_studio_cx_artlab_mochi_2_0.html

export function updateEyeRig(S, dt) {
  const hoverDilate = 1.0 + S.bodyHoverAmount * 0.08;
  const L = {
    w: 26 * S.eyeWidthRatio,
    h: 36 * S.eyeHeightRatio,
    radius: 12 * Math.min(S.eyeWidthRatio, S.eyeHeightRatio),
    topLid: 0, bottomLid: 0, slant: 0,
    happyArch: 0, sadArch: 0,
    offX: 0, offY: 0, rot: 0,
    cross: 0, ring: 0, pupilScale: hoverDilate
  };
  const R = { ...L };

  const t = S.time;
  const st = S.stateTimer;
  const ew = S.eyeWidthRatio;
  const eh = S.eyeHeightRatio;

  switch (S.state) {
    case 'idle':
      L.h = R.h = (36 + Math.sin(t * 2.5) * 1.0 + S.bodyHoverAmount * 1.5) * eh;
      if (S.isHoveringLeftHand || S.isHoveringRightHand) {
        L.happyArch = R.happyArch = 0.22;
      }
      break;

    case 'talk': {
      const talkBounce = Math.sin(t * 14) * 2.0;
      L.w = R.w = 27 * ew;
      L.h = R.h = (36 + talkBounce) * eh;
      L.bottomLid = R.bottomLid = 0.08 + S.mouthOpen * 0.14;
      L.pupilScale = R.pupilScale = 1.08;
      break;
    }

    case 'bored':
      L.w = R.w = 28 * ew;
      L.h = R.h = 34 * eh;
      L.topLid = R.topLid = 0.50 + Math.sin(t * 1.5) * 0.04;
      L.bottomLid = R.bottomLid = 0.08;
      L.slant = R.slant = -0.12;
      L.offY = R.offY = 3;
      L.pupilScale = R.pupilScale = 0.85;
      break;

    case 'waiting': {
      const waveL = Math.sin(t * 8.5);
      const waveR = Math.sin(t * 8.5 - 1.35);
      L.h = (24 + waveL * 9) * eh;
      R.h = (24 + waveR * 9) * eh;
      L.w = (25 - waveL * 2.0) * ew;
      R.w = (25 - waveR * 2.0) * ew;
      L.offY = -waveL * 3.5;
      R.offY = -waveR * 3.5;
      break;
    }

    case 'input': {
      const pulse = Math.sin(t * 18) * 1.5;
      L.w = R.w = 27 * ew;
      L.h = R.h = (28 + pulse) * eh;
      L.topLid = R.topLid = 0.18;
      L.bottomLid = R.bottomLid = 0.2;
      L.pupilScale = R.pupilScale = 0.92;
      break;
    }

    case 'send': {
      if (st < 0.18) {
        L.w = R.w = 31 * ew;
        L.h = R.h = 18 * eh;
        L.offY = R.offY = 5;
      } else {
        const decay = Math.max(0, 1 - (st - 0.18) * 1.2);
        L.w = R.w = (23 + (1 - decay) * 3) * ew;
        L.h = R.h = (42 * decay + 36 * (1 - decay)) * eh;
        L.happyArch = R.happyArch = 0.35 * decay;
        L.offY = R.offY = -5 * decay;
        L.pupilScale = R.pupilScale = 1.25;
      }
      break;
    }

    case 'success':
    case 'wake':
    case 'spin':
      L.w = R.w = 28 * ew;
      L.h = R.h = 32 * eh;
      L.happyArch = R.happyArch = 1.0;
      L.offY = R.offY = -2 + Math.sin(t * 10) * 1.5;
      L.pupilScale = R.pupilScale = 1.22;
      break;

    case 'failure':
      L.w = R.w = 28 * ew;
      L.h = R.h = 30 * eh;
      L.topLid = R.topLid = 0.42;
      L.slant = R.slant = -0.45;
      L.sadArch = R.sadArch = 0.65;
      L.offY = R.offY = 6;
      L.pupilScale = R.pupilScale = 0.8;
      break;

    case 'warning': {
      const alertPulse = Math.sin(t * 12) * 2.0;
      L.w = R.w = 27 * ew;
      L.h = R.h = (34 + alertPulse) * eh;
      L.topLid = R.topLid = 0.28;
      L.slant = R.slant = 0.42;
      L.pupilScale = R.pupilScale = 0.78;
      break;
    }

    case 'inspect':
      L.w = 32 * ew; L.h = 40 * eh; L.radius = 15 * ew;
      L.bottomLid = 0.08;
      L.offY = -2;
      L.pupilScale = 1.3;
      R.w = 28 * ew; R.h = 22 * eh; R.radius = 8 * ew;
      R.topLid = 0.28; R.bottomLid = 0.28;
      R.slant = 0.24;
      R.offY = 2;
      R.pupilScale = 0.75;
      break;

    case 'blocked':
      L.w = R.w = 29 * ew;
      L.h = R.h = 24 * eh;
      L.topLid = R.topLid = 0.34;
      L.bottomLid = R.bottomLid = 0.24;
      L.slant = R.slant = 0.44;
      L.pupilScale = R.pupilScale = 0.75;
      break;

    case 'error':
      L.w = R.w = 28 * ew;
      L.h = R.h = 28 * eh;
      L.cross = R.cross = 1.0;
      L.offX = (Math.random() - 0.5) * 3.5;
      R.offX = (Math.random() - 0.5) * 3.5;
      L.offY = (Math.random() - 0.5) * 3.5;
      R.offY = (Math.random() - 0.5) * 3.5;
      break;

    case 'surprise': {
      const shockBounce = Math.sin(t * 16) * Math.max(0, 1 - st * 0.8) * 3.5;
      L.w = R.w = (31 + shockBounce * 0.5) * ew;
      L.h = R.h = (40 + shockBounce) * eh;
      L.radius = R.radius = 15 * ew;
      L.ring = R.ring = 0.85;
      L.pupilScale = R.pupilScale = 0.62;
      break;
    }

    case 'sleep':
      L.w = R.w = 28 * ew;
      L.h = R.h = 10 * eh;
      L.sadArch = R.sadArch = 0.9;
      L.offY = R.offY = 6;
      break;

    case 'poke':
      L.w = R.w = 29 * ew;
      L.h = R.h = 25 * eh;
      L.topLid = R.topLid = 0.40;
      L.bottomLid = R.bottomLid = 0.22;
      L.slant = R.slant = 0.52;
      L.pupilScale = R.pupilScale = 0.72;
      break;

    case 'wave':
      L.w = 27 * ew; L.h = 34 * eh; L.happyArch = 0.9;
      R.w = 27 * ew; R.h = 36 * eh; R.happyArch = 0.2;
      L.pupilScale = R.pupilScale = 1.15;
      break;

    case 'listen': {
      const eqL = Math.abs(Math.sin(t * 14)) * 11;
      const eqR = Math.abs(Math.cos(t * 14)) * 11;
      L.h = (28 + eqL) * eh;
      R.h = (28 + eqR) * eh;
      L.pupilScale = R.pupilScale = 1.05 + Math.sin(t * 14) * 0.1;
      break;
    }

    case 'love':
      L.w = R.w = 30 * ew;
      L.h = R.h = 34 * eh;
      L.pupilScale = R.pupilScale = 1.32;
      break;
  }

  // Petting reaction overrides eyes into blissful happy arches
  if (S.pettingAmount > 0.25) {
    L.happyArch = Math.max(L.happyArch, Math.min(1, S.pettingAmount));
    R.happyArch = Math.max(R.happyArch, Math.min(1, S.pettingAmount));
  }

  // Targeted side poke flinch
  if (S.leftFlinch > 0.05) {
    L.topLid = Math.max(L.topLid, S.leftFlinch * 0.62);
    L.bottomLid = Math.max(L.bottomLid, S.leftFlinch * 0.42);
  }
  if (S.rightFlinch > 0.05) {
    R.topLid = Math.max(R.topLid, S.rightFlinch * 0.62);
    R.bottomLid = Math.max(R.bottomLid, S.rightFlinch * 0.42);
  }

  // Smooth blink closure on top of current state
  const blink = Math.min(1, S.blinkProgress);
  if (blink > 0.01 && S.state !== 'error') {
    L.h = L.h * (1 - blink * 0.88) + 4 * blink;
    R.h = R.h * (1 - blink * 0.88) + 4 * blink;
  }

  const speed = Math.min(1, dt * 16);
  for (const key of Object.keys(L)) {
    S.leftEye[key] += (L[key] - S.leftEye[key]) * speed;
    S.rightEye[key] += (R[key] - S.rightEye[key]) * speed;
  }
}
