import { FloatingWindowPrototype } from './FloatingWindowPrototype.js';

export interface FloatingWindowState {
  visible: boolean;
  muted: boolean;
  activeSubEgoId?: string;
  attentionState: 'hidden' | 'compact' | 'expanded' | 'alert' | 'hitl_approval';
}

export class FloatingWindowManager {
  private prototype: FloatingWindowPrototype;
  private state: FloatingWindowState;

  constructor() {
    this.prototype = new FloatingWindowPrototype({
      width: 180,
      height: 180,
      transparent: true,
      alwaysOnTop: true,
      focusable: false,
    });

    this.state = {
      visible: false,
      muted: false,
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

  public destroy(): void {
    this.prototype.destroy();
    this.state.visible = false;
  }
}
