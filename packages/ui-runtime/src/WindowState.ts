export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayInfo {
  id?: number | string;
  bounds?: Rectangle;
  workArea: Rectangle;
}

export interface SanitizedWindowState {
  width: number;
  height: number;
  isMaximized: boolean;
  x?: number;
  y?: number;
  boundsCapturedFullScreen?: boolean;
}

export const MIN_WINDOW_WIDTH = 480;
export const MIN_WINDOW_HEIGHT = 640;
export const MIN_VISIBLE_MARGIN = 48;

/**
 * WindowState - Lógica pura de geometría y restauración de ventanas (Patrón Hermes HERM-08).
 * Side-effect free para permitir pruebas unitarias deterministas sin inicializar Electron.
 */
export class WindowStateHelper {
  /**
   * Sanea y valida un objeto de estado de ventana persistido.
   * Rechaza valores NaN, infinitos o malformados y aplica dimensiones mínimas.
   */
  public static sanitize(raw?: any): SanitizedWindowState | null {
    if (!raw || typeof raw !== "object") return null;

    const width = Number(raw.width);
    const height = Number(raw.height);

    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      return null;
    }

    const state: SanitizedWindowState = {
      width: Math.max(MIN_WINDOW_WIDTH, Math.round(width)),
      height: Math.max(MIN_WINDOW_HEIGHT, Math.round(height)),
      isMaximized: raw.isMaximized === true,
    };

    if (raw.boundsCapturedFullScreen === true) {
      state.boundsCapturedFullScreen = true;
    }

    const x = Number(raw.x);
    const y = Number(raw.y);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      state.x = Math.round(x);
      state.y = Math.round(y);
    }

    return state;
  }

  /**
   * Encuentra el monitor/área de trabajo con la mayor área de solapamiento con los bounds propuestos.
   */
  public static matchingWorkArea(
    bounds: { x: number; y: number; width: number; height: number },
    displays: DisplayInfo[],
    minVisible: number = MIN_VISIBLE_MARGIN
  ): Rectangle | null {
    if (!Array.isArray(displays) || displays.length === 0) return null;

    let bestArea: Rectangle | null = null;
    let maxOverlapArea = 0;

    for (const display of displays) {
      const a = display.workArea;
      if (!a) continue;

      const overlapX = Math.min(bounds.x + bounds.width, a.x + a.width) - Math.max(bounds.x, a.x);
      const overlapY = Math.min(bounds.y + bounds.height, a.y + a.height) - Math.max(bounds.y, a.y);

      if (overlapX < minVisible || overlapY < minVisible) {
        continue;
      }

      const area = overlapX * overlapY;
      if (area > maxOverlapArea) {
        maxOverlapArea = area;
        bestArea = a;
      }
    }

    return bestArea;
  }

  /**
   * Calcula los bounds finales seguros para abrir la ventana.
   * Si las coordenadas guardadas caen fuera de los monitores actuales (ej. pantalla desenchufada),
   * recentra la ventana en el monitor primario.
   */
  public static resolveSafeBounds(
    saved: SanitizedWindowState | null,
    displays: DisplayInfo[]
  ): { x: number; y: number; width: number; height: number; isMaximized: boolean } {
    const primary = displays[0]?.workArea ?? { x: 0, y: 0, width: 1280, height: 800 };

    if (!saved) {
      // Centrado por defecto en monitor principal
      const width = Math.min(1200, primary.width - 80);
      const height = Math.min(800, primary.height - 80);
      return {
        width,
        height,
        x: Math.round(primary.x + (primary.width - width) / 2),
        y: Math.round(primary.y + (primary.height - height) / 2),
        isMaximized: false,
      };
    }

    const proposedWidth = Math.min(saved.width, primary.width);
    const proposedHeight = Math.min(saved.height, primary.height);

    if (saved.x != null && saved.y != null) {
      const workArea = this.matchingWorkArea(
        { x: saved.x, y: saved.y, width: proposedWidth, height: proposedHeight },
        displays
      );

      if (workArea) {
        // La ventana es visible en un monitor actual; clampeamos para asegurar que la barra de título no quede oculta
        const safeX = Math.max(workArea.x, Math.min(saved.x, workArea.x + workArea.width - proposedWidth));
        const safeY = Math.max(workArea.y, Math.min(saved.y, workArea.y + workArea.height - proposedHeight));
        return {
          x: safeX,
          y: safeY,
          width: proposedWidth,
          height: proposedHeight,
          isMaximized: saved.isMaximized,
        };
      }
    }

    // Fallback recentrado en monitor primario
    return {
      x: Math.round(primary.x + (primary.width - proposedWidth) / 2),
      y: Math.round(primary.y + (primary.height - proposedHeight) / 2),
      width: proposedWidth,
      height: proposedHeight,
      isMaximized: saved.isMaximized,
    };
  }
}
