// policy.js — capa de política del runtime: movimiento reducido, registros de
// acción y auto-sleep. PORTADO de agent-robot-avatar runtime.js (MIT):
//  · requestedMotion/reducedMotion (líneas 68-83) — atributo motion=auto|reduce|full
//    con consulta fresca de prefers-reduced-motion (endurecimiento WebKit).
//  · beginAction/finishAction/cancelActiveAction/emitActionState (85-125) —
//    registro con id, terminal y continuous; el evento action-state lleva
//    {action, phase, source} y fase única por registro.
//  · scheduleAutoSleep/clearAutoSleep/autoSleepBlocked (189-233) — reprograma si
//    cambia el delay, se bloquea mientras hay acciones o puntero activo.
// Adapted from agent-robot-avatar (MIT), vendor/agent-robot-avatar/runtime.js

/** motion="auto|reduce|full" leído de cualquier fuente con getAttribute. */
export function requestedMotion(instance) {
  const value = String(instance.getAttribute?.('motion') || 'auto').trim().toLowerCase();
  return value === 'reduce' || value === 'full' ? value : 'auto';
}

/** ¿Reducir movimiento? consulta fresca de prefers-reduced-motion (ARA:73-83). */
export function reducedMotion(instance) {
  const requested = requestedMotion(instance);
  if (requested === 'reduce') return true;
  if (requested === 'full') return false;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  return instance?._runtimeMotionQuery?.matches === true;
}

/**
 * Emite el evento `action-state` (mismo shape que ARA:89-93).
 * La fase terminal solo se emite una vez por registro (record.terminal).
 */
export function emitActionState(instance, record, phase, silent = false) {
  if (!record || (phase !== 'start' && record.terminal)) return;
  if (phase !== 'start') record.terminal = true;
  if (silent) return;
  // dispatch opcional: en Node (tests sin DOM) no hay EventTarget
  instance.dispatchEvent?.(
    new CustomEvent('action-state', {
      detail: { action: record.action, phase, source: record.source },
      bubbles: true,
      composed: true,
    })
  );
}

/** Cancela la acción activa emitiendo fase 'cancel' (ARA:96-101). */
export function cancelActiveAction(instance, { silent = false } = {}) {
  const record = instance._activeActionState;
  if (!record || record.terminal) return;
  if (instance._activeActionState === record) instance._activeActionState = null;
  emitActionState(instance, record, 'cancel', silent);
}

/**
 * Abre un registro de acción: cancela la anterior, limpia auto-sleep y emite
 * 'start' (ARA:103-117).
 */
export function beginAction(instance, action, source, continuous = false, clearAutoSleep = null) {
  clearAutoSleep?.();
  cancelActiveAction(instance);
  const record = {
    id: (instance._actionStateSequence || 0) + 1,
    action,
    source,
    continuous,
    terminal: false,
  };
  instance._actionStateSequence = record.id;
  instance._activeActionState = record;
  emitActionState(instance, record, 'start');
  return record;
}

/** Cierra un registro ('end' por defecto) y reprograma auto-sleep (ARA:119-125). */
export function finishAction(instance, record, phase = 'end', scheduleAutoSleep = null) {
  if (!record || record.terminal) return;
  if (instance._activeActionState !== record) return;
  instance._activeActionState = null;
  emitActionState(instance, record, phase);
  scheduleAutoSleep?.();
}

/**
 * Scheduler de auto-sleep (ARA:189-233, portado a fábrica inyectable):
 * delay configurable, bloqueado por acciones/puntero, y reprograma si cambia
 * el delay entre llamadas.
 * @param {{getDelayMs: () => number, isBlocked: () => boolean,
 *          onSleep: () => void, timers?: {setTimeout, clearTimeout}}} opts
 */
export function createAutoSleep({ getDelayMs, isBlocked, onSleep, timers = globalThis }) {
  let timer = 0;

  function clear() {
    if (!timer) return;
    timers.clearTimeout(timer);
    timer = 0;
  }

  function schedule() {
    clear();
    const delayMs = Number(getDelayMs());
    if (!Number.isFinite(delayMs) || delayMs <= 0 || isBlocked()) return;
    timer = timers.setTimeout(() => {
      timer = 0;
      if (isBlocked()) return;
      // el delay pudo cambiar durante la espera (ARA:219-223)
      const currentDelay = Number(getDelayMs());
      if (!Number.isFinite(currentDelay) || currentDelay <= 0 || currentDelay !== delayMs) {
        schedule();
        return;
      }
      onSleep();
    }, delayMs);
  }

  return { schedule, clear, get active() { return timer !== 0; } };
}
