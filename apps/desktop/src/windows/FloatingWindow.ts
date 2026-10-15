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
    });

    this.state = {
      visible: false,
      muted: false,
      disabled: false,
      attentionState: 'hidden',
    };
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

    if (this.state.muted || this.state.attentionState === 'hidden') {
      this.prototype.setClickThrough(true);
    } else if (this.state.attentionState === 'hitl_approval') {
      // Cuando se requiere confirmación HITL, permitir interacción directa
      this.prototype.setClickThrough(false);
    }

    // Transmitir estado actualizado al renderizador de la ventana flotante si está cargado
    win.webContents.send('floating:state_changed', this.state);
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
}
