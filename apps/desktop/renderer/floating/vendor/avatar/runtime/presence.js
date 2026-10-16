// presence.js — FSM de presencia del avatar (modos de mostrarse).
// PORTADO de coucou windows/src/island/fsm.ts (IslandStateMachine, MIT):
// máquina hidden → petit → home → coucou con temporizadores de colapso
// (petit 60 s, home 15 s, saludo 0.6 s / 10 s en hover) y modo "pinned"
// para alertas que no deben colapsar. Adaptación: timers inyectables (Node
// testeable) y nombres de modo orientados a Ego:
//   hidden (no visible) · compact (miniatura) · home (expandido) · greet (saludo)

export const PRESENCE_MODES = Object.freeze(['hidden', 'compact', 'home', 'greet']);

export class PresenceStateMachine {
  /** @type {'hidden'|'compact'|'home'|'greet'} */
  state = 'hidden';

  onTransition = null; // (from, to) => void

  /** home → compact delay, segundos (fsm.ts:12). */
  homeToCompactDelay = 15;
  /** compact → hidden delay, segundos (fsm.ts:14). */
  compactToHiddenDelay = 60;
  /** greet → compact al terminar el saludo sin hover (fsm.ts:16). */
  greetAutoCollapseDelay = 0.6;
  /** greet → compact mientras el puntero la sostiene (fsm.ts:18). */
  greetHoverCollapseDelay = 10;
  /** Una alerta esperando respuesta queda abierta aunque el puntero se vaya (fsm.ts:20). */
  pinned = false;

  _compactHide = null;
  _homeCollapse = null;
  _greetCollapse = null;

  constructor({ timers = globalThis } = {}) {
    this._timers = timers;
  }

  // ── entradas (fsm.ts:28-103) ──────────────────────────────────────────────

  launch() {
    this.cancelTimers();
    this._transition('greet');
  }

  mouseEntered() {
    switch (this.state) {
      case 'hidden':
        this.cancelTimers();
        this._transition('compact');
        break;
      case 'compact':
        this._clear('_compactHide');
        break;
      case 'home':
        this._clear('_homeCollapse');
        break;
      case 'greet':
        this._scheduleGreetCollapse(this.greetHoverCollapseDelay);
        break;
      default:
        break;
    }
  }

  mouseLeft() {
    switch (this.state) {
      case 'compact':
        this._scheduleCompactHide();
        break;
      case 'home':
        this._scheduleHomeCollapse();
        break;
      case 'greet':
        this._clear('_greetCollapse');
        this._transition('compact');
        break;
      default:
        break;
    }
  }

  click() {
    if (this.state !== 'compact') return;
    this.cancelTimers();
    this._transition('home');
  }

  /** El saludo terminó; no pisa un timer de hover activo (fsm.ts:75-78). */
  greetComplete() {
    if (this.state !== 'greet') return;
    if (this._greetCollapse == null) this._scheduleGreetCollapse(this.greetAutoCollapseDelay);
  }

  /** Evento de trabajo: muestra el modo compacto desde hidden (fsm.ts:81-86). */
  reveal() {
    if (this.state !== 'hidden') return;
    this.cancelTimers();
    this._transition('compact');
    this._scheduleCompactHide();
  }

  /** Alerta o petición explícita: abre directo a expandido (fsm.ts:89-93). */
  forceHome() {
    this.cancelTimers();
    this._transition('home');
  }

  forceCompact() {
    this.cancelTimers();
    this._transition('compact');
  }

  forceHidden() {
    this.cancelTimers();
    this._transition('hidden');
  }

  // ── temporizadores (fsm.ts:107-142) ───────────────────────────────────────

  _scheduleCompactHide() {
    this._clear('_compactHide');
    this._compactHide = this._timers.setTimeout(() => {
      this._compactHide = null;
      if (this.state === 'compact') this._transition('hidden');
    }, this.compactToHiddenDelay * 1000);
  }

  _scheduleHomeCollapse() {
    this._clear('_homeCollapse');
    if (this.pinned) return;
    this._homeCollapse = this._timers.setTimeout(() => {
      this._homeCollapse = null;
      if (this.state === 'home') this._transition('compact');
    }, this.homeToCompactDelay * 1000);
  }

  _scheduleGreetCollapse(delay) {
    this._clear('_greetCollapse');
    this._greetCollapse = this._timers.setTimeout(() => {
      this._greetCollapse = null;
      if (this.state === 'greet') this._transition('compact');
    }, delay * 1000);
  }

  _clear(which) {
    const id = this[which];
    if (id != null) this._timers.clearTimeout(id);
    this[which] = null;
  }

  cancelTimers() {
    this._clear('_compactHide');
    this._clear('_homeCollapse');
    this._clear('_greetCollapse');
  }

  _transition(next) {
    if (next === this.state) return;
    const from = this.state;
    this.state = next;
    this.onTransition?.(from, next);
  }
}
