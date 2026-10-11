import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { WindowStateManager, WindowState } from "../src/windows/WindowStateManager.js";

describe("WindowStateManager (WIDG-05, HERM-04)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ego-window-state-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
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
});
