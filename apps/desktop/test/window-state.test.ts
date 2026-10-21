import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { WindowStateManager, WindowState } from "../src/windows/WindowStateManager.js";
import { WindowStateHelper } from "@ego/ui-runtime";
import { createScratchDir, removeScratchDir } from "./helpers/test-scratch.js";

describe("WindowStateManager (WIDG-05, HERM-04)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createScratchDir("ego-window-state-test");
  });

  afterEach(() => {
    try {
      removeScratchDir(tmpDir);
    } catch {
      // ignore
    }
  });

  it("retorna dimensiones por defecto si no existe estado previo", async () => {
    const manager = new WindowStateManager({
      userDataDir: tmpDir,
      defaultWidth: 1280,
      defaultHeight: 800,
    });

    const state = await manager.restoreState();
    expect(state.width).toBe(1280);
    expect(state.height).toBe(800);
    expect(state.isMaximized).toBe(false);
  });

  it("persiste y recupera el estado de ventana desde archivo y adaptador", async () => {
    const persistedRecords: Record<string, any> = {};
    const mockAdapter = {
      put: async (item: any) => {
        persistedRecords[`${item.namespace}:${item.key}`] = item.payload;
      },
      get: async (ns: string, key: string) => {
        return persistedRecords[`${ns}:${key}`];
      },
    };

    const manager = new WindowStateManager({
      userDataDir: tmpDir,
      adapter: mockAdapter,
    });

    const targetState: WindowState = {
      x: 100,
      y: 150,
      width: 1600,
      height: 1000,
      isMaximized: false,
    };

    await manager.persistState(targetState);

    // Comprobar archivo en disco
    const fallbackFile = path.join(tmpDir, "window-state.json");
    expect(fs.existsSync(fallbackFile)).toBe(true);

    // Recuperar
    const restored = await manager.restoreState();
    expect(restored.x).toBe(100);
    expect(restored.y).toBe(150);
    expect(restored.width).toBe(1600);
    expect(restored.height).toBe(1000);
  });

  it("detecta correctamente si los bounds son visibles en pantallas conectadas", () => {
    const mockDisplays = [
      { bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
      { bounds: { x: 1920, y: 0, width: 1920, height: 1080 } },
    ] as any[];

    // Visible en pantalla primaria
    expect(
      WindowStateManager.isVisibleOnAnyDisplay(
        { x: 100, y: 100, width: 1200, height: 800 },
        mockDisplays
      )
    ).toBe(true);

    // Visible en pantalla secundaria
    expect(
      WindowStateManager.isVisibleOnAnyDisplay(
        { x: 2000, y: 100, width: 1200, height: 800 },
        mockDisplays
      )
    ).toBe(true);

    // Fuera de cualquier pantalla (ej. monitor desconectado)
    expect(
      WindowStateManager.isVisibleOnAnyDisplay(
        { x: 5000, y: 2000, width: 1200, height: 800 },
        mockDisplays
      )
    ).toBe(false);
  });

  it("HERM-08: la geometría la decide el WindowStateHelper canónico (workArea, no bounds)", () => {
    // Una pantalla con barra de tareas: `bounds` (1920×1080) incluye la
    // barra, `workArea` (1920×1000) no. Una ventana guardada 100 px por
    // DEBAJO del workArea es "visible" según la implementación paralela
    // (que miraba `bounds`) pero NO según el helper canónico (que mira
    // `workArea`) → debe recolocarse dentro del área de trabajo.
    const mockDisplays = [
      {
        id: 1,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        workArea: { x: 0, y: 0, width: 1920, height: 1000 },
      },
    ] as any[];

    // Bajo el workArea → el helper canónico dice que NO es visible.
    expect(
      WindowStateManager.isVisibleOnAnyDisplay(
        { x: 100, y: 1030, width: 800, height: 600 },
        mockDisplays
      )
    ).toBe(false);

    // Dentro del workArea → visible.
    expect(
      WindowStateManager.isVisibleOnAnyDisplay(
        { x: 100, y: 500, width: 800, height: 600 },
        mockDisplays
      )
    ).toBe(true);
  });

  it("HERM-08: una ventana parcialmente fuera se RECOLOCA dentro del workArea", () => {
    const manager = new WindowStateManager({ userDataDir: tmpDir });
    const mockDisplays = [
      {
        id: 1,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        workArea: { x: 0, y: 0, width: 1920, height: 1000 },
      },
    ] as any[];

    // Simula el caso: la ventana se guardó asomando por debajo del
    // workArea. El helper canónico la deja dentro.
    const safe = WindowStateHelper.resolveSafeBounds(
      { x: 100, y: 1030, width: 800, height: 600, isMaximized: false },
      mockDisplays
    );
    expect(safe.y + safe.height).toBeLessThanOrEqual(1000);
    expect(safe.x).toBeGreaterThanOrEqual(0);
  });
});
