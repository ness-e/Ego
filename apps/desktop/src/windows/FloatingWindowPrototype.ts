import { BrowserWindow, screen, Display } from 'electron';
import { join } from 'node:path';

export interface FloatingWindowOptions {
  width?: number;
  height?: number;
  transparent?: boolean;
  alwaysOnTop?: boolean;
  focusable?: boolean;
  initialPosition?: 'top-right' | 'bottom-right' | 'dock';
}

export class FloatingWindowPrototype {
  private window: BrowserWindow | null = null;
  private isInteractive = false;

  constructor(private options: FloatingWindowOptions = {}) {}

  public createWindow(): BrowserWindow {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    const width = this.options.width ?? 160;
    const height = this.options.height ?? 160;

    // Posición por defecto: esquina inferior derecha sobre la bandeja del sistema
    const x = screenWidth - width - 24;
    const y = screenHeight - height - 24;

    this.window = new BrowserWindow({
      width,
      height,
      x,
      y,
      frame: false,
      transparent: this.options.transparent ?? true,
      alwaysOnTop: this.options.alwaysOnTop ?? true,
      focusable: this.options.focusable ?? false,
      skipTaskbar: true,
      resizable: false,
      hasShadow: false,
      webPreferences: {
        preload: join(__dirname, '..', 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    // Modo click-through por defecto: los eventos de ratón traspasan al escritorio
    this.setClickThrough(true);

    return this.window;
  }

  public setClickThrough(ignore: boolean): void {
    if (!this.window || this.window.isDestroyed()) return;

    if (ignore) {
      this.window.setIgnoreMouseEvents(true, { forward: true });
      this.isInteractive = false;
    } else {
      this.window.setIgnoreMouseEvents(false);
      this.isInteractive = true;
    }
  }

  public repositionToDisplay(displayPoint = screen.getCursorScreenPoint()): void {
    if (!this.window || this.window.isDestroyed()) return;

    const currentDisplay: Display = screen.getDisplayNearestPoint(displayPoint);
    const { x: areaX, y: areaY, width: areaWidth, height: areaHeight } = currentDisplay.workArea;

    const [winWidth, winHeight] = this.window.getSize();
    const newX = areaX + areaWidth - winWidth - 24;
    const newY = areaY + areaHeight - winHeight - 24;

    this.window.setPosition(newX, newY, true);
  }

  public isWindowInteractive(): boolean {
    return this.isInteractive;
  }

  public getWindow(): BrowserWindow | null {
    return this.window;
  }

  public destroy(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.close();
      this.window = null;
    }
  }
}
