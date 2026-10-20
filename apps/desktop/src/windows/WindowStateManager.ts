import * as fs from "node:fs";
import * as path from "node:path";
import { BrowserWindow, screen, Display } from "electron";
import { z } from "zod";
import { WindowStateHelper, type DisplayInfo } from "@ego/ui-runtime";

export const WindowStateSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().default(1440),
  height: z.number().default(900),
  isMaximized: z.boolean().default(false),
  displayId: z.number().optional(),
});

export type WindowState = z.infer<typeof WindowStateSchema>;

/**
 * Task10 (WIDG-05): estado persistente de la ventana flotante.
 * `presenceMode`: "auto" (autoshow por trabajo/HITL) | "always" (siempre
 * visible) | "never" (nunca; equivale a presencia desactivada). Sin TTL:
 * persiste indefinidamente igual que `main_window` (restore tras crash).
 */
export const FloatingPresenceModeSchema = z.enum(["auto", "always", "never"]);

export type FloatingPresenceMode = z.infer<typeof FloatingPresenceModeSchema>;

export const FloatingWindowPersistSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  muted: z.boolean().default(false),
  disabled: z.boolean().default(false),
  presenceMode: FloatingPresenceModeSchema.default("auto"),
});

export type FloatingWindowPersist = z.infer<typeof FloatingWindowPersistSchema>;

export interface FloatingWindowExtra {
  muted: boolean;
  disabled?: boolean;
  presenceMode?: FloatingPresenceMode;
}

/** Envelope del fallback local: ambas ventanas en un solo `window-state.json`. */
const WindowStateFileSchema = z.object({
  main_window: WindowStateSchema.optional(),
  floating_window: FloatingWindowPersistSchema.optional(),
});

export interface WindowStateManagerOptions {
  userDataDir: string;
  adapter?: any;
  defaultWidth?: number;
  defaultHeight?: number;
}

/**
 * Adapta los `Display` de Electron al `DisplayInfo` del helper canónico.
 * Electron siempre expone `workArea`; el fallback a `bounds` existe para
 * los dobles de test que solo finely `bounds`.
 */
function toDisplayInfos(displays: Display[]): DisplayInfo[] {
  return displays.map((d) => ({
    id: d.id,
    bounds: d.bounds,
    workArea: d.workArea ?? d.bounds,
  }));
}

export class WindowStateManager {
  private readonly fallbackFilePath: string;
  private readonly adapter?: any;
  private readonly defaultWidth: number;
  private readonly defaultHeight: number;
  private saveTimeout: NodeJS.Timeout | null = null;
  private trackedWindow: BrowserWindow | null = null;
  /** Task10: debounce y ventana independientes para la flotante. */
  private floatingSaveTimeout: NodeJS.Timeout | null = null;
  private trackedFloatingWindow: BrowserWindow | null = null;

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

    // 2. Guardar en archivo fallback local (envelope, preservando flotante)
    try {
      const envelope = this.readEnvelopeFile();
      envelope.main_window = state;
      this.writeEnvelopeFile(envelope);
    } catch (err) {
      console.warn("[WindowStateManager] Advertencia al persistir en archivo fallback:", err);
    }
  }

  /**
   * Task10 (WIDG-05): restaura el estado persistente de la flotante
   * (posición + mute + presencia). Sin registro previo → defaults
   * `{ muted: false, disabled: false, presenceMode: "auto" }`.
   */
  public async restoreFloatingState(): Promise<FloatingWindowPersist> {
    const loaded = await this.loadFloatingState();
    const state: FloatingWindowPersist = loaded ?? {
      muted: false,
      disabled: false,
      presenceMode: "auto",
    };
    return this.validateFloatingBoundsAgainstDisplays(state);
  }

  /**
   * Task10: conecta el movimiento de la flotante con guardado mediante
   * debounce de 500ms (igual que la principal). `getExtra` aporta
   * muted/disabled/presenceMode vivos del `FloatingWindowManager`.
   * Re-llamar con la misma ventana no duplica listeners.
   */
  public trackFloatingWindow(
    win: BrowserWindow,
    getExtra: () => FloatingWindowExtra
  ): void {
    if (this.trackedFloatingWindow === win) {
      return;
    }
    this.trackedFloatingWindow = win;

    const debouncedSave = () => {
      if (this.floatingSaveTimeout) {
        clearTimeout(this.floatingSaveTimeout);
      }
      this.floatingSaveTimeout = setTimeout(() => {
        void this.saveCurrentFloatingState(getExtra);
      }, 500);
    };

    win.on("move", debouncedSave);

    win.on("close", () => {
      if (this.floatingSaveTimeout) {
        clearTimeout(this.floatingSaveTimeout);
      }
      void this.saveCurrentFloatingState(getExtra);
    });
  }

  /** Task10: guarda la posición actual de la flotante + extras vivos. */
  public async saveCurrentFloatingState(
    getExtra?: () => FloatingWindowExtra
  ): Promise<void> {
    if (!this.trackedFloatingWindow || this.trackedFloatingWindow.isDestroyed()) {
      return;
    }

    const bounds = this.trackedFloatingWindow.getBounds();
    const extra: FloatingWindowExtra = getExtra ? getExtra() : { muted: false };

    await this.persistFloatingState({
      x: bounds.x,
      y: bounds.y,
      muted: extra.muted ?? false,
      disabled: extra.disabled ?? false,
      presenceMode: extra.presenceMode ?? "auto",
    });
  }

  /** Task10: persiste la flotante en VantaDB (`floating_window`) + fallback. */
  public async persistFloatingState(state: FloatingWindowPersist): Promise<void> {
    const parsed = FloatingWindowPersistSchema.safeParse(state);
    const payload = parsed.success ? parsed.data : state;

    if (this.adapter && typeof this.adapter.put === "function") {
      try {
        await this.adapter.put({
          namespace: "system/window-state",
          key: "floating_window",
          payload,
          metadata: { updated_at: Date.now() },
        });
      } catch (err) {
        console.warn("[WindowStateManager] Advertencia al persistir flotante en VantaDB:", err);
      }
    }

    try {
      const envelope = this.readEnvelopeFile();
      envelope.floating_window = parsed.success
        ? parsed.data
        : FloatingWindowPersistSchema.parse({
            ...state,
            presenceMode: (state as { presenceMode?: unknown }).presenceMode ?? "auto",
          });
      this.writeEnvelopeFile(envelope);
    } catch (err) {
      console.warn("[WindowStateManager] Advertencia al persistir flotante en fallback:", err);
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

      // HERM-08: la geometría la decide el helper CANÓNICO de
      // `@ego/ui-runtime` (`WindowStateHelper`), no una implementación
      // paralela. Antes esta clase reimplementaba la visibilidad y el
      // recentrado con otros parámetros (margen de 50 px frente al
      // `MIN_VISIBLE_MARGIN` canónico, y `bounds` de la pantalla primaria
      // frente a su `workArea`, que excluye la barra de tareas).
      const safe = WindowStateHelper.resolveSafeBounds(
        {
          x: state.x,
          y: state.y,
          width: state.width,
          height: state.height,
          isMaximized: state.isMaximized,
        },
        toDisplayInfos(displays)
      );

      return {
        ...state,
        x: safe.x,
        y: safe.y,
        width: safe.width,
        height: safe.height,
      };
    } catch {
      // Si la API screen no está disponible (ej. en ciertos entornos de test), conservar state
    }

    return state;
  }

  public static isVisibleOnAnyDisplay(
    bounds: { x: number; y: number; width: number; height: number },
    displays: Display[]
  ): boolean {
    // HERM-08: la visibilidad la decide el helper canónico
    // (`matchingWorkArea`), que exige un solapamiento visible mínimo
    // (`MIN_VISIBLE_MARGIN`).
    return WindowStateHelper.matchingWorkArea(bounds, toDisplayInfos(displays)) !== null;
  }

  /**
   * Task10: valida la posición flotante contra las pantallas conectadas.
   * La flotante es 180×180; si quedó en un monitor desconectado se
   * resetea a posición por defecto (x/y undefined) conservando
   * muted/disabled/presenceMode. `displays` inyectable para tests.
   */
  public validateFloatingBoundsAgainstDisplays(
    state: FloatingWindowPersist,
    displays?: Display[]
  ): FloatingWindowPersist {
    if (state.x === undefined || state.y === undefined) {
      return state;
    }

    try {
      const all =
        displays ??
        (screen && typeof screen.getAllDisplays === "function"
          ? screen.getAllDisplays()
          : []);
      if (!all || all.length === 0) {
        return state;
      }

      const isVisible = WindowStateManager.isVisibleOnAnyDisplay(
        { x: state.x, y: state.y, width: 180, height: 180 },
        all
      );

      if (!isVisible) {
        const { x: _x, y: _y, ...rest } = state;
        return { ...rest };
      }
    } catch {
      // Sin API screen (tests) se conserva el estado.
    }

    return state;
  }

  private async loadFloatingState(): Promise<FloatingWindowPersist | null> {
    // 1. VantaDB (`floating_window`); tolera registros viejos sin presenceMode.
    if (this.adapter && typeof this.adapter.get === "function") {
      try {
        const record = await this.adapter.get("system/window-state", "floating_window");
        if (record) {
          let payload = record;
          if (typeof record === "object" && record !== null && "payload" in record) {
            payload = (record as { payload: unknown }).payload;
          }
          const parsed = FloatingWindowPersistSchema.safeParse({
            ...(payload as Record<string, unknown>),
            presenceMode:
              (payload as { presenceMode?: unknown }).presenceMode ?? "auto",
          });
          if (parsed.success) {
            return parsed.data;
          }
        }
      } catch {
        // fallback
      }
    }

    // 2. Fallback local (envelope).
    try {
      const envelope = this.readEnvelopeFile();
      if (envelope.floating_window) {
        return envelope.floating_window;
      }
    } catch {
      // noop
    }

    return null;
  }

  /** Lee el envelope local; tolera el shape viejo plano (solo main). */
  private readEnvelopeFile(): {
    main_window?: WindowState;
    floating_window?: FloatingWindowPersist;
  } {
    if (!fs.existsSync(this.fallbackFilePath)) {
      return {};
    }
    try {
      const raw = fs.readFileSync(this.fallbackFilePath, "utf8");
      const json = JSON.parse(raw) as unknown;
      const envelope = WindowStateFileSchema.safeParse(json);
      if (envelope.success) {
        return { ...envelope.data };
      }
      // Shape legado plano = estado de la principal.
      const legacy = WindowStateSchema.safeParse(json);
      if (legacy.success) {
        return { main_window: legacy.data };
      }
    } catch {
      // noop: archivo corrupto → envelope vacío
    }
    return {};
  }

  private writeEnvelopeFile(envelope: {
    main_window?: WindowState;
    floating_window?: FloatingWindowPersist;
  }): void {
    const dir = path.dirname(this.fallbackFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.fallbackFilePath, JSON.stringify(envelope, null, 2), "utf8");
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

    // 2. Intentar cargar desde archivo fallback local (envelope o legado plano)
    try {
      const envelope = this.readEnvelopeFile();
      if (envelope.main_window) {
        return envelope.main_window;
      }
    } catch {
      // noop
    }

    return null;
  }
}
