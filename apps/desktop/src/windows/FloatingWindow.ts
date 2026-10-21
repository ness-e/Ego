import { FloatingWindow } from './FloatingWindowView.js';

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

export class FloatingWindowManager {
  private prototype: FloatingWindow;
  private state: FloatingWindowState;

  constructor() {
    this.prototype = new FloatingWindow({
      width: 180,
      height: 180,
      transparent: true,
      alwaysOnTop: true,
      focusable: false,
      // EGO-FIND-104: el push de estado hecho justo tras `showInactive()` se
      // pierde cuando la ventana se crea en caliente (primer minimize: la
      // renderer aún no tiene el listener del preload) y la isla quedaba
      // pintada en `hidden` (CSS opacity: 0). Al terminar la carga se
      // re-empuja el estado ACTUAL del manager, una vez por carga.
      onContentLoaded: () => this.pushState(),
    });

    this.state = {
      visible: false,
      muted: false,
      disabled: false,
      attentionState: 'hidden',
    };
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
  }

  public hide(): void {
    const win = this.prototype.getWindow();
    if (win && !win.isDestroyed()) {
      win.hide();
    }
    this.state.visible = false;
  }

  public updateState(partial: Partial<FloatingWindowState>): void {
    this.state = { ...this.state, ...partial };

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
    this.pushState();
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
