// studio-bridge.js — puente entre el elemento <ego-avatar> y el motor canvas.
//
// Este modulo extrae del elemento toda la logica que depende del motor canvas
// (el "modo studio"), de modo que `avatar-element.js` se quede con el
// CONTRATO del elemento (atributos, estado, API publica) y no con la
// implementacion de un renderizador concreto.
//
// Por que son funciones sueltas y no una clase mixin: el elemento es un
// `HTMLElement` y sus metodos seerializan en el shadow root; un mixin
// complicaria el orden de inicializacion sin ganar nada. Aqui cada funcion
// recibe el elemento y opera sobre el, con la misma firma que tenia el metodo.
//
// La clase `StudioHost` (el backend canvas) vive en `../studio/element-host.js`;
// este modulo solo gestiona el pegamento entre ambos.

import { StudioHost } from '../studio/element-host.js';
import { STATES } from './states.js';

/**
 * El elemento con sus campos internos.
 *
 * EXCEPCIÓN DE TIPADO (AGENTS.md §4: "`any` prohibido salvo justificación
 * explícita"). Excepción registrada en `AGENTS.md` por A1 (reasignación R12).
 *
 * - **Dónde**: `packages/avatar/src/runtime/studio-bridge.js:34` (esta
 *   typedef) y `:39`, `:50`, `:59`, `:145`, `:169` (sus cinco usos). La misma
 *   excepción, con el mismo motivo, se repite en
 *   `packages/avatar/src/runtime/svg-export.js:22`.
 * - **Qué.fields**: los campos privados por convención del elemento
 *   (`_studioHost`, `_n`, `_state`, `_cfg`, `_mounted`, `_emote`, `_action`,
 *   `_pointer`, `_lastPointerMove`, `_noteActivity`, `_cancelAction`,
 *   `_wait`, `_stop`, `_start`, `_onPointerMove`, `_onVisibility`,
 *   `_onStudioResize`, `_resizeObserver`, `_renderMode`, `_pointerFollow`,
 *   `_soundEnabled`).
 * - **Por qué**: el puente opera sobre la **instancia interna** del elemento,
 *   no sobre su superficie pública (`index.d.ts`). Esos campos se declaran en
 *   el constructor de `EgoAvatar` y los consumen esta misma familia de
 *   módulos; no son parte del contrato público. Declararlos uno a uno aquí (o
 *   en el `.d.ts` interno) duplicaría la superficie y la desincronizaría en
 *   cada cambio del elemento, que es exactamente el fallo que `checkJs` ya
 *   detectaría dos veces.
 * - **Condición de cierre**: al migrar `runtime/avatar-element.js` a
 *   TypeScript, esta typedef se sustituye por el tipo real de la clase
 *   (`EgoAvatar`) y desaparece el `any`. Sin esa migración, la alternativa
 *   sería mantener un `.d.ts` interno con 20 campos privados, que es peor.
 * - **Alcance del riesgo**: ninguno en runtime. `any` en un *type* de JSDoc no
 *   genera código ni cambia el comportamiento; sólo relaja la comprobación
 *   estática de esos cinco parámetros.
 *
 * @typedef {any} AvatarElementInternals
 */

/**
 * ¿Renderiza con el motor canvas del studio? (el atributo `mode` manda)
 * @param {AvatarElementInternals} el
 * @param {string} [renderMode] modo por defecto cuando no hay atributo
 */
export function isStudio(el, renderMode) {
  const attr = el.getAttribute?.('mode');
  return (attr ?? renderMode) === 'studio';
}

/**
 * Host del backend canvas, creado por demanda (en Node guarda pendientes
 * sin backend). Solo en modo studio; en SVG devuelve null.
 * @param {AvatarElementInternals} el
 */
export function studioHost(el) {
  if (!el._studioHost && isStudio(el, el._renderMode)) el._studioHost = new StudioHost(el);
  return el._studioHost;
}

/**
 * Monta el motor canvas dentro del shadow root del elemento.
 * @param {AvatarElementInternals} el
 * @param {string} styles hoja de estilos del shadow root
 */
export function mountStudio(el, styles) {
  if (typeof el.attachShadow !== 'function') {
    if (!el._studioHost) el._studioHost = new StudioHost(el);
    el._n = { canvas: null, svg: null };
    el._mounted = true;
    return;
  }
  if (!el.shadowRoot) el.attachShadow({ mode: 'open' });
  if (!el.shadowRoot) {
    if (!el._studioHost) el._studioHost = new StudioHost(el);
    el._n = { canvas: null, svg: null };
    el._mounted = true;
    return;
  }
  el.shadowRoot.innerHTML = `<style>${styles}</style><canvas class="studio-canvas"></canvas>`;
  const canvas = el.shadowRoot.querySelector('canvas');
  el._n = { canvas: canvas || null, svg: null };
  el._studioHost?.detach();
  // se acarrea lo ajustado por el usuario (escala, flags, pendientes)
  const prev = el._studioHost;
  const host = new StudioHost(el);
  if (prev) {
    host.userScale = prev.userScale;
    host.pointerOn = prev.pointerOn;
    host.soundOn = prev.soundOn;
    // El modo de manos también se hereda (vive en el host, no en el
    // backend: el preset lo reinicia).
    host.handsMode = prev.handsMode;
    Object.assign(host._pendingParams, prev._pendingParams);
  }
  el._studioHost = host;
  // sin DOM (Node/tests) no hay backend: la API de Ego sigue operativa
  if (typeof document === 'undefined' || !canvas) {
    el._mounted = true;
    return;
  }
  host.pointerOn = el._pointerFollow !== false;
  host.soundOn = el._soundEnabled !== false;
  const presetAttr = el.getAttribute?.('preset');
  if (presetAttr) host.applyPreset(presetAttr);
  host.attach(canvas);
  // listeners minimos (el resto los pone el studio en su canvas)
  if (typeof window !== 'undefined') {
    window.removeEventListener('pointermove', el._onPointerMove);
    window.removeEventListener('pointermove', el._onDragMove);
    window.removeEventListener('pointerup', el._onDragEnd);
    window.removeEventListener('pointercancel', el._onDragEnd);
    window.removeEventListener('resize', el._onStudioResize);
  }
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', el._onVisibility);
  }
  el.removeEventListener?.('mouseenter', el._onEnter);
  el.removeEventListener?.('mouseleave', el._onLeave);
  el.removeEventListener?.('click', el._onHostClick);
  el.removeEventListener?.('keydown', el._onKeyDown);
  el._n.svg?.removeEventListener?.('pointerdown', el._onDragStart);
  el._onPointerMove = (e) => {
    el._pointer = { x: e.clientX, y: e.clientY };
    el._lastPointerMove = performance.now();
    el._noteActivity(false);
  };
  el._onVisibility = () => (typeof document !== 'undefined' && document.hidden ? el._stop() : el._start());
  el._onStudioResize = () => el._studioHost?.resize();
  if (typeof window !== 'undefined') {
    window.addEventListener('pointermove', el._onPointerMove, { passive: true });
    window.addEventListener('resize', el._onStudioResize, { passive: true });
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', el._onVisibility);
  }
  if (typeof ResizeObserver !== 'undefined' && canvas) {
    el._resizeObserver?.disconnect();
    el._resizeObserver = new ResizeObserver(() => {
      el._studioHost?.resize();
    });
    el._resizeObserver.observe(canvas);
  }
  el._mounted = true;
}

/**
 * setState en modo studio: el vocabulario de Ego se traduce al motor canvas
 * (que pone su propio sonido/movimiento); aqui solo quedan contabilidad
 * (accion manual que interrumpe), actividad y el evento.
 *
 * @param {AvatarElementInternals} el
 * @param {string} name
 * @param {{ immediate?: boolean, fromAction?: boolean }} [opts]
 */
export function setStateStudio(el, name, opts = {}) {
  const previous = el._state;
  if (previous === name && !opts.immediate) return el;
  el._state = name;
  el._cfg = STATES[name];
  el._studioHost?.applyState(name, { silent: !!opts.immediate });
  // una accion temporal activa se invalida al cambiar de estado manual
  if (el._action && !opts.fromAction) el._cancelAction('state-change');
  el._noteActivity(false);
  // dispatch opcional: en Node (tests sin DOM) no hay EventTarget
  el.dispatchEvent?.(
    new CustomEvent('state-change', { detail: { state: name, previous }, bubbles: true, composed: true }),
  );
  return el;
}

/**
 * Emote en modo studio: el estado traducido entra al motor canvas y al
 * terminar se restaura el estado del elemento. Sin poses ni timeline SVG.
 *
 * @param {AvatarElementInternals} el
 * @param {string} name
 * @param {number|string} token token de cancelacion
 * @param {{ duration: number }} cfg
 */
export async function runEmoteStudio(el, name, token, cfg) {
  el._emote = { name, cfg };
  el._studioHost?.playEmote(name);
  const ok = await el._wait(cfg.duration, token);
  if (!ok) return { cancelled: true };
  el._emote = null;
  el._studioHost?.restore();
  return { cancelled: false };
}
