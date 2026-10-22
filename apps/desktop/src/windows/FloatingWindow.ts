import { FloatingWindow } from './FloatingWindowView.js';
import { probeIslandCompositing } from './floating-compositing-probe.js';

/** Re-export del nombre definitivo (WIDG-01): la vista vive en `FloatingWindowView.ts`. */
export { FloatingWindow } from './FloatingWindowView.js';

export interface FloatingWindowState {
  visible: boolean;
  muted: boolean;
  /** Presencia desactivada (Task4 D2): bloquea el autoshow; persistencia → Task10. */
  disabled?: boolean;
  activeSubEgoId?: string;
  attentionState: 'hidden' | 'compact' | 'expanded' | 'alert' | 'hitl_approval';
}

/**
 * Estado agregado del System Tray (T03, COUC-19 alcance mínimo): verde idle,
 * azul pensando, rojo HITL. El main deriva el mismo semáforo del
 * BackgroundEngine; este helper mapea la ventana flotante al mismo código.
 */
export type TrayStatus = 'idle' | 'thinking' | 'hitl';

export function toTrayStatus(state: FloatingWindowState): TrayStatus {
  if (state.attentionState === 'alert' || state.attentionState === 'hitl_approval') {
    return 'hitl';
  }
  if (state.attentionState === 'compact' || state.attentionState === 'expanded') {
    return 'thinking';
  }
  return 'idle';
}

/**
 * Snapshot de trabajo para la decisión D2 (Task4): el flotante se
 * auto-muestra al minimizar SOLO si hay trabajo activo o HITL pendiente,
 * y nunca si está silenciado o con presencia desactivada.
 */
export interface AutoShowSnapshot {
  active: number;
  hitl: number;
  muted: boolean;
  disabled?: boolean;
}

export function shouldAutoShow(s: AutoShowSnapshot): boolean {
  if (s.muted || s.disabled) return false;
  return s.active > 0 || s.hitl > 0;
}

/**
 * Gate de PRESENCIA (EGO-FIND-104): decide si la isla puede mostrarse.
 *
 * Regla canónica tras el fix: `muted` es SOLO audio y **nunca** forma parte
 * del gate de presencia. Antes el mute (desde el propio botón de la isla)
 * mataba el autoshow al minimizar y el pop de HITL, y al vivir el unmute
 * EN la isla desaparecida quedaba un deadlock sin path de recuperación.
 * La presencia la gobiernan `disabled` y `presenceMode` únicamente.
 *
 * (`shouldAutoShow` queda como utilidad pura legado: ya no gobierna el
 * minimize desde el commit `d50a050`, pero su contrato se conserva en
 * `tests/e2e/contract/floating-wiring.contract.test.ts`.)
 */
export function isPresenceAllowed(g: {
  disabled?: boolean;
  presenceMode?: "auto" | "always" | "never";
}): boolean {
  if (g.disabled) return false;
  return (g.presenceMode ?? "auto") !== "never";
}

/**
 * Costura Task1→Task4 (Task7 la enriquece): traduce un AttentionState de la
 * FSM pura a `attentionState` del flotante. Hoy es identidad con fallback
 * defensivo a 'hidden' (misma unión de 5 estados en ambos lados).
 */
export function syncFromAttention(
  a: FloatingWindowState['attentionState']
): FloatingWindowState['attentionState'] {
  switch (a) {
    case 'hidden':
    case 'compact':
    case 'expanded':
    case 'alert':
    case 'hitl_approval':
      return a;
    default:
      return 'hidden';
  }
}

/**
 * EGO-FIND-104b: modo de composición de la isla.
 * - `transparent`: superficie DirectComposition con transparencia real.
 * - `opaque`: ventana opaca de emergencia (`transparent:false` + fondo
 *   tinta) — la única variante que compone SIEMPRE al escritorio.
 * - `auto`: arranca transparente y la sonda de composición verifica los
 *   píxeles reales; si no compone, migra a `opaque` (y lo notifica para
 *   persistir la decisión).
 */
export type FloatingOpacityMode = 'transparent' | 'opaque' | 'auto';

export interface FloatingWindowManagerOptions {
  /** Modo persistido por Task10 (`window-state.json`). Default `auto`. */
  opacityMode?: FloatingOpacityMode;
  /**
   * Activa la sonda de composición (EGO-FIND-104b). Solo el main real la
   * activa: los tests instancian el manager sin esta opción y no deben
   * lanzar capturas de escritorio.
   */
  enableCompositingProbe?: boolean;
  /** Modo resuelto definitivamente tras la sonda (para persistir en Task10). */
  onOpacityModeDecided?: (mode: 'transparent' | 'opaque') => void;
}

export class FloatingWindowManager {
  private prototype: FloatingWindow;
  private state: FloatingWindowState;
  private opacityMode: FloatingOpacityMode;
  private resolvedOpacity: 'transparent' | 'opaque';
  private envForcedOpaque: boolean;
  private probeCapable = false;
  private probeDone = false;
  private probeTimer: NodeJS.Timeout | null = null;
  private opaqueVerifyTimer: NodeJS.Timeout | null = null;
  private decidedCb: ((mode: 'transparent' | 'opaque') => void) | null = null;

  constructor(options: FloatingWindowManagerOptions = {}) {
    this.envForcedOpaque = process.env.EGO_ISLAND_OPAQUE === '1';
    if (this.envForcedOpaque) {
      // Override de emergencia: manda sobre la persistencia mientras la env exista.
      this.opacityMode = 'opaque';
    } else {
      this.opacityMode = options.opacityMode ?? 'auto';
    }
    this.resolvedOpacity = this.opacityMode === 'opaque' ? 'opaque' : 'transparent';
    this.prototype = this.buildPrototype(this.resolvedOpacity);
    this.decidedCb = options.onOpacityModeDecided ?? null;
    if (options.enableCompositingProbe) {
      this.probeCapable = true;
    }

    this.state = {
      visible: false,
      muted: false,
      disabled: false,
      attentionState: 'hidden',
    };
  }

  private buildPrototype(mode: 'transparent' | 'opaque'): FloatingWindow {
    return new FloatingWindow({
      width: 180,
      height: 180,
      transparent: mode === 'transparent',
      opaque: mode === 'opaque',
      alwaysOnTop: true,
      focusable: false,
      // EGO-FIND-104: el push de estado hecho justo tras `showInactive()` se
      // pierde cuando la ventana se crea en caliente (primer minimize: la
      // renderer aún no tiene el listener del preload) y la isla quedaba
      // pintada en `hidden` (CSS opacity: 0). Al terminar la carga se
      // re-empuja el estado ACTUAL del manager, una vez por carga.
      onContentLoaded: () => this.pushState(),
    });
  }

  public getOpacityMode(): FloatingOpacityMode {
    return this.opacityMode;
  }

  public isOpaque(): boolean {
    return this.resolvedOpacity === 'opaque';
  }

  /**
   * EGO-FIND-104b: fija el modo de composición (restaurado por Task10).
   * Cambiar de variante destruye y recrea la ventana conservando el estado
   * (visible, tamaño por attentionState, click-through y push de estado).
   */
  public setOpacityMode(requested: FloatingOpacityMode | undefined): void {
    if (!requested) return;
    if (this.envForcedOpaque && requested !== 'opaque') {
      console.warn(
        '[FloatingWindow] EGO_ISLAND_OPAQUE=1 manda: se ignora opacityMode="' + requested + '".',
      );
      return;
    }
    this.opacityMode = requested;
    const target: 'transparent' | 'opaque' = requested === 'opaque' ? 'opaque' : 'transparent';
    if (target === this.resolvedOpacity) return;
    this.recreateWithOpacity(target);
    this.decidedCb?.(target);
  }

  /** EGO-FIND-104b: activa la sonda (solo main real). Idempotente. */
  public enableCompositingProbe(
    onOpacityModeDecided?: (mode: 'transparent' | 'opaque') => void,
  ): void {
    if (onOpacityModeDecided) {
      this.decidedCb = onOpacityModeDecided;
    }
    this.probeCapable = true;
    if (this.opacityMode === 'auto' && !this.probeDone) {
      this.armProbe();
    }
  }

  private recreateWithOpacity(target: 'transparent' | 'opaque'): void {
    const wasVisible = this.state.visible;
    const current = this.prototype.getWindow();
    if (current && !current.isDestroyed()) {
      try {
        current.destroy();
      } catch {
        // noop: la recreación nunca tumba la flotante
      }
    }
    this.resolvedOpacity = target;
    this.prototype = this.buildPrototype(target);
    if (!wasVisible) return;
    // show() recrea la ventana y repone estado visible; updateState({}) repone
    // click-through según el attentionState actual y re-empuja el estado.
    this.show();
    if (this.state.attentionState !== 'hidden') {
      this.prototype.resizeForState(this.state.attentionState);
    }
    this.updateState({});
  }

  private armProbe(): void {
    if (!this.probeCapable || this.probeDone || this.probeTimer) return;
    // Diferencia suficiente para que la primera composición (show + carga del
    // DOM + rAF) ya deba haberse presentado al escritorio.
    this.probeTimer = setTimeout(() => {
      this.probeTimer = null;
      void this.runCompositingProbe();
    }, 4200);
    this.probeTimer.unref?.();
  }

  private async runCompositingProbe(): Promise<void> {
    if (this.probeDone || this.opacityMode !== 'auto' || this.resolvedOpacity !== 'transparent') {
      return;
    }
    try {
      const win = this.prototype.getWindow();
      if (!win || win.isDestroyed() || !win.isVisible()) {
        // Nada visible que sondear: la sonda queda armada para el próximo show().
        return;
      }
      const painted = await probeIslandCompositing(win);
      if (painted) {
        this.probeDone = true;
        this.decidedCb?.('transparent');
        return;
      }
      // EGO-FIND-104b window-level contract intacto (isVisible=true, DOM vivo)
      // pero 0 píxeles compuestos: migrar al modo que compone siempre.
      console.warn(
        '[FloatingWindow] EGO-FIND-104b: la isla transparente no compone al escritorio (ventana visible, DOM vivo, 0 píxeles). Migrando a modo opaco.',
      );
      this.probeDone = true;
      this.setOpacityMode('opaque');
      this.opaqueVerifyTimer = setTimeout(() => void this.verifyOpaqueOnce(), 4200);
      this.opaqueVerifyTimer.unref?.();
    } catch (err) {
      // La sonda muerde el polvo antes que la flotante: si falla, mantener transparente.
      console.warn('[FloatingWindow] Sonda de composición falló (se mantiene transparente):', err);
      this.probeDone = true;
    }
  }

  private async verifyOpaqueOnce(): Promise<void> {
    if (this.resolvedOpacity !== 'opaque') {
      this.probeDone = true;
      return;
    }
    try {
      const win = this.prototype.getWindow();
      if (win && !win.isDestroyed() && win.isVisible()) {
        const painted = await probeIslandCompositing(win);
        console.log(
          `[FloatingWindow] EGO-FIND-104b: modo opaco compone=${painted ? 'sí' : 'no'} (medición por píxeles).`,
        );
      }
    } catch {
      // noop: la verificación nunca tumba la flotante
    } finally {
      this.probeDone = true;
    }
  }

  /** Push canónico del estado actual al renderer de la isla (si existe). */
  private pushState(): void {
    const win = this.prototype.getWindow();
    if (!win || win.isDestroyed()) return;
    win.webContents.send('ipc.floating.state_changed', this.state);
  }

  public show(): void {
    let win = this.prototype.getWindow();
    if (!win || win.isDestroyed()) {
      win = this.prototype.createWindow();
    }
    win.showInactive();
    this.state.visible = true;
    if (this.opacityMode === 'auto' && !this.probeDone) {
      this.armProbe();
    }
  }

  public hide(): void {
    const win = this.prototype.getWindow();
    if (win && !win.isDestroyed()) {
      win.hide();
    }
    this.state.visible = false;
  }

  public updateState(partial: Partial<FloatingWindowState>): void {
    // PERF: el recompute de atencion corre en rutas calientes (cada evento de
    // tarea). Sin esta guarda, cada evento reenviaba el estado a la isla (un
    // IPC) aunque NADA hubiera cambiado. El estado es plano (todo primitivos)
    // => la comparacion superficial es exacta.
    //
    // ⚠️ La guarda es SOLO del push: los efectos (resize, click-through) deben
    // aplicarse SIEMPRE, aunque el estado no cambie (p. ej. el estado inicial
    // ya es "hidden" y hay que re-afirmar el click-through).
    const previous = this.state;
    const next: FloatingWindowState = { ...previous, ...partial };
    const changed = (Object.keys(next) as (keyof FloatingWindowState)[]).some(
      (k) => next[k] !== previous[k],
    );
    this.state = next;

    const win = this.prototype.getWindow();
    if (!win || win.isDestroyed()) return;

    if (partial.attentionState) {
      this.prototype.resizeForState(this.state.attentionState);
    }

    if (this.state.attentionState === 'hidden') {
      // EGO-FIND-104: click-through solo cuando la isla está en hidden
      // (invisible: no debe bloquear clics del escritorio). `muted` era
      // audio, no interacción: muted igual dejaba la isla inalcanzable
      // para el unmute (segmento del deadlock).
      this.prototype.setClickThrough(true);
    } else {
      // En cualquier otro estado ("compact", "expanded", "hitl_approval", "alert"),
      // permitir interacción directa para que el usuario siempre pueda hacer clic
      this.prototype.setClickThrough(false);
    }

    // Push del estado (canal único; `pushState` no-op si la ventana murió).
    // Solo si el estado CAMBIÓ: el push es un IPC al renderer de la isla y
    // esta vía es caliente (cada evento de tarea).
    if (changed) this.pushState();
  }

  public resizeForState(attentionState: string): void {
    this.prototype.resizeForState(attentionState);
  }

  public getState(): FloatingWindowState {
    return { ...this.state };
  }

  /** Silenciado Task4 (vía `ipc.floating.setMuted` en main): sin sonido ni autoshow. */
  public setMuted(muted: boolean): void {
    this.updateState({ muted });
  }

  /** Presencia on/off Task4 (in-memory; persistencia → Task10). */
  public setDisabled(disabled: boolean): void {
    this.updateState({ disabled });
  }

  public destroy(): void {
    if (this.probeTimer) {
      clearTimeout(this.probeTimer);
      this.probeTimer = null;
    }
    if (this.opaqueVerifyTimer) {
      clearTimeout(this.opaqueVerifyTimer);
      this.opaqueVerifyTimer = null;
    }
    this.probeDone = true;
    this.prototype.destroy();
    this.state.visible = false;
  }

  /**
   * Task10 (WIDG-05/COUC-19): reposiciona la flotante al display actual
   * (llamado desde `main.ts` en `display-metrics-changed`/`display-added`/
   * `display-removed`; gap Task4: nunca se llamaba desde main).
   */
  public repositionToDisplay(displayPoint?: { x: number; y: number }): void {
    this.prototype.repositionToDisplay(displayPoint);
  }

  /** Task10: aplica la posición restaurada de la persistencia. */
  public setPosition(x: number, y: number): void {
    const win = this.prototype.getWindow();
    if (win && !win.isDestroyed()) {
      win.setPosition(x, y, true);
    }
  }

  /** Task10: expone la ventana para `trackFloatingWindow` (persistencia). */
  public getFloatingWindow(): import('electron').BrowserWindow | null {
    return this.prototype.getWindow();
  }
}
