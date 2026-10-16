// studio/index.js — SHIM local FIND-12-01 (NO existe en la referencia).
//
// El `import('./index.js')` dinámico de `element-host.js:84` (carga perezosa
// del motor canvas HybridRobotAvatar, solo `mode="studio"`) debe RESOLVER en
// el transform de Vite (dev y build): sin este archivo el transform falla
// con "Failed to resolve import" y tumba TODA la cadena del avatar.
// El flotante usa modo SVG: este módulo nunca se ejecuta en la práctica; si
// algún día se intenta `mode="studio"`, los constructores lanzan y el
// `.catch(() => null)` de `StudioHost.ensure()` degrada a null sin romper.
// Solo se exporta lo que `element-host.js` consume: SoundSynthesizer +
// HybridRobotAvatar. El motor canvas real vive en `src/studio/` de la
// referencia y NO se vendoriza a propósito (ver ../README.md).
function unavailable() {
  throw new Error(
    "studio canvas engine no vendorizado (FIND-12-01: el flotante usa modo SVG)",
  );
}

export class SoundSynthesizer {
  constructor() {
    unavailable();
  }
}

export class HybridRobotAvatar {
  constructor() {
    unavailable();
  }
}
