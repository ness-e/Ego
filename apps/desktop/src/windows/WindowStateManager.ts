import * as fs from "node:fs";
import * as path from "node:path";
import { BrowserWindow, screen, Display } from "electron";
import { z } from "zod";

export const WindowStateSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().default(1440),
  height: z.number().default(900),
  isMaximized: z.boolean().default(false),
  displayId: z.number().optional(),
});

export type WindowState = z.infer<typeof WindowStateSchema>;

export interface WindowStateManagerOptions {
  userDataDir: string;
  adapter?: any;
  defaultWidth?: number;
  defaultHeight?: number;
}

export class WindowStateManager {
  private readonly fallbackFilePath: string;
  private readonly adapter?: any;
  private readonly defaultWidth: number;
  private readonly defaultHeight: number;
  private saveTimeout: NodeJS.Timeout | null = null;
  private trackedWindow: BrowserWindow | null = null;

  constructor(options: WindowStateManagerOptions) {
    this.fallbackFilePath = path.join(options.userDataDir, "window-state.json");
    this.adapter = options.adapter;
    this.defaultWidth = options.defaultWidth ?? 1440;
    this.defaultHeight = options.defaultHeight ?? 900;
  }

  /**
   * Restaura el estado previo de geometría de la ventana validando su visibilidad
   * en las pantallas actualmente conectadas para evitar ventanas fuera del viewport.
   */
  public async restoreState(): Promise<WindowState> {
    let state = await this.loadState();

    if (!state) {
      state = {
        width: this.defaultWidth,
        height: this.defaultHeight,
        isMaximized: false,
      };
    }

    // Validación defensiva contra displays desconectados
    return this.validateBoundsAgainstDisplays(state);
  }

  /**
   * Conecta los listeners de redimensionamiento y movimiento de la ventana
   * con guardado mediante debounce para no saturar I/O.
   */
  public trackWindow(win: BrowserWindow): void {
    this.trackedWindow = win;

    const debouncedSave = () => {
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
      }
      this.saveTimeout = setTimeout(() => {
        this.saveCurrentWindowState();
      }, 500);
    };

    win.on("resize", debouncedSave);
    win.on("move", debouncedSave);
    win.on("maximize", debouncedSave);
    win.on("unmaximize", debouncedSave);

    win.on("close", () => {
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
      }
      this.saveCurrentWindowState();
    });
  }

  /**
   * Guarda el estado actual de la ventana en VantaDB y en archivo local.
   */
  public async saveCurrentWindowState(): Promise<void> {
    if (!this.trackedWindow || this.trackedWindow.isDestroyed()) {
      return;
    }

    const isMaximized = this.trackedWindow.isMaximized();
    const bounds = this.trackedWindow.getBounds();

    const state: WindowState = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized,
    };

    await this.persistState(state);
  }

  public async persistState(state: WindowState): Promise<void> {
    // 1. Guardar en VantaDB si está disponible
    if (this.adapter && typeof this.adapter.put === "function") {
      try {
        await this.adapter.put({
          namespace: "system/window-state",
          key: "main_window",
          payload: state,
          metadata: { updated_at: Date.now() },
        });
      } catch (err) {
        console.warn("[WindowStateManager] Advertencia al persistir en VantaDB:", err);
      }
    }

    // 2. Guardar en archivo fallback local
    try {
      const dir = path.dirname(this.fallbackFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.fallbackFilePath, JSON.stringify(state, null, 2), "utf8");
    } catch (err) {
      console.warn("[WindowStateManager] Advertencia al persistir en archivo fallback:", err);
    }
  }

  public validateBoundsAgainstDisplays(state: WindowState): WindowState {
    if (state.x === undefined || state.y === undefined) {
      return state;
    }

    try {
      if (!screen || typeof screen.getAllDisplays !== "function") {
        return state;
      }

      const displays = screen.getAllDisplays();
      if (!displays || displays.length === 0) {
        return state;
      }

      const isVisible = WindowStateManager.isVisibleOnAnyDisplay(
        { x: state.x, y: state.y, width: state.width, height: state.height },
        displays
      );

      if (!isVisible) {
        const primary = screen.getPrimaryDisplay() || displays[0];
        const primaryBounds = primary.bounds;

        // Centrar en pantalla primaria
        return {
          ...state,
          x: Math.round(primaryBounds.x + (primaryBounds.width - state.width) / 2),
          y: Math.round(primaryBounds.y + (primaryBounds.height - state.height) / 2),
        };
      }
    } catch {
      // Si la API screen no está disponible (ej. en ciertos entornos de test), conservar state
    }

    return state;
  }

  public static isVisibleOnAnyDisplay(
    bounds: { x: number; y: number; width: number; height: number },
    displays: Display[]
  ): boolean {
    return displays.some((d) => {
      const db = d.bounds;
      const horizontalOverlap =
        bounds.x + bounds.width > db.x + 50 && bounds.x < db.x + db.width - 50;
      const verticalOverlap =
        bounds.y + bounds.height > db.y + 50 && bounds.y < db.y + db.height - 50;
      return horizontalOverlap && verticalOverlap;
    });
  }

  private async loadState(): Promise<WindowState | null> {
    // 1. Intentar cargar desde VantaDB
    if (this.adapter && typeof this.adapter.get === "function") {
      try {
        const record = await this.adapter.get("system/window-state", "main_window");
        if (record) {
          let payload = record;
          if (typeof record === "object" && record !== null && "payload" in record) {
            payload = (record as { payload: unknown }).payload;
          }
          const parsed = WindowStateSchema.safeParse(payload);
          if (parsed.success) {
            return parsed.data;
          }
        }
      } catch {
        // fallback
      }
    }

    // 2. Intentar cargar desde archivo fallback local
    if (fs.existsSync(this.fallbackFilePath)) {
      try {
        const raw = fs.readFileSync(this.fallbackFilePath, "utf8");
        const parsed = WindowStateSchema.safeParse(JSON.parse(raw));
        if (parsed.success) {
          return parsed.data;
        }
      } catch {
        // noop
      }
    }

    return null;
  }
}
