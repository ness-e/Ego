// extension-host.js — sistema de extensiones del avatar.
// MISMO PATRÓN que vendor/agent-robot-avatar/extension-host.js (MIT, CX ArtLab):
// un módulo externo registra acciones/hooks sin tocar el core:
//
//   registerAvatarExtension({
//     name: 'glitch',
//     actions: { glitch: (avatar) => … },
//     beforePlay(action, ctx) {}, afterPlay(action, result, ctx) {},
//     reset(avatar) {}, draw(avatar, now) {},
//   });
//
// Diferencia con el original: aquí el host expone funciones runner que el
// elemento consulta (en vez de monkey-patch del prototipo), para mantener
// el core legible. Semántica idéntica: orden de registro = orden de ejecución.

const extensionNames = new Set();
const actionHandlers = new Map();
const beforePlayHooks = [];
const afterPlayHooks = [];
const resetHooks = [];
const drawHooks = [];

/**
 * Registra una extensión. Lanza si `name` se repite o falta.
 */
export function registerAvatarExtension({ name, actions = {}, beforePlay, afterPlay, reset, draw }) {
  if (!name) throw new Error('[ego-avatar] extensión sin name');
  if (extensionNames.has(name)) throw new Error(`[ego-avatar] extensión ya registrada: ${name}`);
  extensionNames.add(name);
  for (const [action, handler] of Object.entries(actions)) {
    if (actionHandlers.has(action)) {
      throw new Error(`[ego-avatar] la acción "${action}" ya tiene handler (extensión ${name})`);
    }
    actionHandlers.set(action, handler);
  }
  if (beforePlay) beforePlayHooks.push(beforePlay);
  if (afterPlay) afterPlayHooks.push(afterPlay);
  if (reset) resetHooks.push(reset);
  if (draw) drawHooks.push(draw);
}

export function hasExtensionAction(action) {
  return actionHandlers.has(action);
}

export function runBeforePlay(action, context) {
  for (const hook of beforePlayHooks) hook(action, context);
}

export function runAfterPlay(action, result, context) {
  for (const hook of afterPlayHooks) hook(action, result, context);
}

export function runExtensionAction(avatar, action) {
  const handler = actionHandlers.get(action);
  return handler ? handler(avatar, action) : undefined;
}

export function runReset(avatar) {
  for (const hook of resetHooks) hook(avatar);
}

export function runDraw(avatar, now) {
  for (const hook of drawHooks) hook(avatar, now);
}

/** Lista de extensiones registradas (introspección/demo). */
export function listExtensions() {
  return [...extensionNames];
}
