import { BrowserWindow, screen, Display } from 'electron';
import { join } from 'node:path';

/**
 * FloatingWindow (WIDG-01).
 *
 * Ventana flotante frameless con click-through para la presencia persistente
 * de Ego sobre el escritorio.
 */

export interface FloatingWindowOptions {
  width?: number;
  height?: number;
  transparent?: boolean;
  alwaysOnTop?: boolean;
  focusable?: boolean;
  initialPosition?: 'top-right' | 'bottom-right' | 'dock';
}

export class FloatingWindow {
  private window: BrowserWindow | null = null;
  private isInteractive = false;

  constructor(private options: FloatingWindowOptions = {}) {}

  public createWindow(): BrowserWindow {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    const width = this.options.width ?? 240;
    const height = this.options.height ?? 240;

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
        // T11-S6 (electron-vite): esta vista compila dentro de
        // out/main/main.js; el preload vive en out/preload/preload.js.
        preload: join(__dirname, "..", "preload", "preload.js"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
      },
    });

    // SEC-01: la flotante nunca navega fuera de su bundle local.
    // Denegar-por-defecto: solo `file:`; todo http(s) se bloquea y los
    // popups (`window.open`/`_blank`) se deniegan con log.
    this.window.webContents.on("will-navigate", (event, url) => {
      let allowed = false;
      try {
        allowed = new URL(url).protocol === "file:";
      } catch {
        allowed = false;
      }
      if (!allowed) {
        console.warn(`[Electron Security] Navegación bloqueada (flotante): ${url}`);
        event.preventDefault();
      }
    });
    this.window.webContents.setWindowOpenHandler((details) => {
      console.warn(`[Electron Security] Ventana emergente bloqueada (flotante): ${details.url}`);
      return { action: "deny" as const };
    });

    // Modo click-through por defecto: los eventos de ratón traspasan al escritorio
    this.setClickThrough(true);

    // WIDG-02 (Task3): la flotante carga contenido real (avatar mini +
    // ticker + approval). Fire-and-forget con log: createWindow conserva su
    // firma síncrona (la usa FloatingWindowManager.show()).
    void this.loadContent();

    return this.window;
  }

  /**
   * Carga `floating.html`: dev vía Vite (`/floating/floating.html`) o bundle
   * prod `out/renderer/floating/floating.html` (input extra en
   * `electron.vite.config.ts`). Nunca navega fuera del bundle: el guard
   * `will-navigate file:`-only + deny de popups de arriba sigue intacto.
   */
  private async loadContent(): Promise<void> {
    if (!this.window || this.window.isDestroyed()) return;
    const devBase = (process.env.ELECTRON_RENDERER_URL ?? "").replace(/\/$/, "");
    try {
      if (devBase.startsWith("http")) {
        await this.window.loadURL(`${devBase}/floating/floating.html`);
      } else {
        // T11-S6: la vista compila dentro de out/main/main.js (bundle
        // único); `__dirname` = out/main en runtime.
        await this.window.loadFile(join(__dirname, "..", "renderer", "floating", "floating.html"));
      }
    } catch (err) {
      console.error("[FloatingWindow] Error al cargar floating.html:", err);
    }
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
    // STAB-10 (noUncheckedIndexedAccess): getSize() devuelve [w, h] siempre;
    // guards defensivos sin cambio de comportamiento.
    const newX = areaX + areaWidth - (winWidth ?? 0) - 24;
    const newY = areaY + areaHeight - (winHeight ?? 0) - 24;

    this.window.setPosition(newX, newY, true);
  }

  /**
   * Redimensiona dinámicamente la ventana flotante según el estado de atención.
   * Compact: 220x220 en la esquina inferior derecha.
   * Expanded / HITL / Alert: 720x400 en la esquina inferior derecha.
   */
  public resizeForState(attentionState: string): void {
    if (!this.window || this.window.isDestroyed()) return;

    const primaryDisplay = screen.getPrimaryDisplay();
    const workArea = primaryDisplay?.workArea || { x: 0, y: 0, width: 1920, height: 1080 };
    const areaX = workArea.x ?? 0;
    const areaY = workArea.y ?? 0;
    const screenWidth = workArea.width ?? 1920;
    const screenHeight = workArea.height ?? 1080;

    const isLarge =
      attentionState === "expanded" ||
      attentionState === "hitl_approval" ||
      attentionState === "alert";

    const targetWidth = isLarge ? 720 : 240;
    const targetHeight = isLarge ? 300 : 240;

    const newX = areaX + screenWidth - targetWidth - 24;
    const newY = areaY + screenHeight - targetHeight - 24;

    const anyWin = this.window as any;
    if (typeof anyWin?.setBounds === "function") {
      anyWin.setBounds({
        x: newX,
        y: newY,
        width: targetWidth,
        height: targetHeight,
      }, true);
    } else {
      if (typeof anyWin?.setSize === "function") {
        anyWin.setSize(targetWidth, targetHeight, true);
      }
      if (typeof anyWin?.setPosition === "function") {
        anyWin.setPosition(newX, newY, true);
      }
    }
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
