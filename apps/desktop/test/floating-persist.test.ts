import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  WindowStateManager,
  FloatingWindowPersistSchema,
} from "../src/windows/WindowStateManager.js";
import { pauseAllTasks } from "../src/main/tray-status.js";
import { BackgroundEngine } from "@ego/tasks";

vi.mock("electron", () => {
  const webContents = {
    send: vi.fn(),
    on: vi.fn(),
    setWindowOpenHandler: vi.fn(() => ({ action: "deny" as const })),
  };
  const mockWin = {
    showInactive: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    close: vi.fn(),
    focus: vi.fn(),
    restore: vi.fn(),
    loadURL: vi.fn(async () => undefined),
    loadFile: vi.fn(async () => undefined),
    isMinimized: vi.fn(() => false),
    isDestroyed: vi.fn(() => false),
    setIgnoreMouseEvents: vi.fn(),
    getSize: vi.fn(() => [180, 180]),
    setPosition: vi.fn(),
    webContents,
  };
  return {
    BrowserWindow: vi.fn(() => mockWin),
    screen: {
      getPrimaryDisplay: vi.fn(() => ({
        workAreaSize: { width: 1920, height: 1080 },
        workArea: { x: 0, y: 0, width: 1920, height: 1080 },
      })),
      getDisplayNearestPoint: vi.fn(() => ({
        workArea: { x: 0, y: 0, width: 1920, height: 1080 },
      })),
      getCursorScreenPoint: vi.fn(() => ({ x: 500, y: 500 })),
      getAllDisplays: vi.fn(() => [
        { bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
      ]),
      on: vi.fn(),
    },
  };
});

const here = dirname(fileURLToPath(import.meta.url));
const mainSrc = readFileSync(join(here, "..", "src", "main.ts"), "utf-8");

function mockAdapter() {
  const records: Record<string, any> = {};
  return {
    records,
    put: async (item: any) => {
      records[`${item.namespace}:${item.key}`] = item.payload;
    },
    get: async (ns: string, key: string) => records[`${ns}:${key}`],
  };
}

class FakeWindow extends EventEmitter {
  private bounds = { x: 10, y: 20, width: 180, height: 180 };
  getBounds() {
    return { ...this.bounds };
  }
  isDestroyed() {
    return false;
  }
  setPosition(x: number, y: number) {
    this.bounds.x = x;
    this.bounds.y = y;
  }
}

describe("Task10 — persistencia flotante (WIDG-05)", () => {
  let tmpDir: string;

  beforeEach(() => {
    vi.useFakeTimers();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ego-floating-persist-"));
  });

  afterEach(() => {
    vi.useRealTimers();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("schema floating_window con defaults (presenceMode auto)", () => {
    const parsed = FloatingWindowPersistSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.muted).toBe(false);
      expect(parsed.data.disabled).toBe(false);
      expect(parsed.data.presenceMode).toBe("auto");
    }
  });

  it("persist roundtrip: pos/mute/disabled/presenceMode sobreviven", async () => {
    const adapter = mockAdapter();
    const mgr = new WindowStateManager({ userDataDir: tmpDir, adapter });
    await mgr.persistFloatingState({
      x: 123,
      y: 456,
      muted: true,
      disabled: false,
      presenceMode: "always",
    });
    const restored = await mgr.restoreFloatingState();
    expect(restored.x).toBe(123);
    expect(restored.y).toBe(456);
    expect(restored.muted).toBe(true);
    expect(restored.disabled).toBe(false);
    expect(restored.presenceMode).toBe("always");
    // Clave separada de main_window en el mismo namespace.
    expect(adapter.records["system/window-state:floating_window"]).toBeDefined();
  });

  it("restore tolera registro viejo sin presenceMode (migración)", async () => {
    const adapter = mockAdapter();
    adapter.records["system/window-state:floating_window"] = {
      x: 5,
      y: 6,
      muted: false,
      disabled: true,
    };
    const mgr = new WindowStateManager({ userDataDir: tmpDir, adapter });
    const restored = await mgr.restoreFloatingState();
    expect(restored.presenceMode).toBe("auto");
    expect(restored.disabled).toBe(true);
  });

  it("track: move con debounce 500ms persiste posición", async () => {
    const adapter = mockAdapter();
    const mgr = new WindowStateManager({ userDataDir: tmpDir, adapter });
    const win = new FakeWindow();
    mgr.trackFloatingWindow(win as any, () => ({
      muted: false,
      disabled: false,
      presenceMode: "auto" as const,
    }));
    win.setPosition(300, 400);
    win.emit("move");
    expect(adapter.records["system/window-state:floating_window"]).toBeUndefined();
    await vi.advanceTimersByTimeAsync(600);
    const saved = adapter.records["system/window-state:floating_window"];
    expect(saved).toBeDefined();
    expect(saved.x).toBe(300);
    expect(saved.y).toBe(400);
  });

  it("validateFloatingBounds: fuera de pantallas resetea a default", () => {
    const mgr = new WindowStateManager({ userDataDir: tmpDir });
    const displays = [
      { bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
    ] as any[];
    const fixed = mgr.validateFloatingBoundsAgainstDisplays(
      { x: 5000, y: 3000, muted: false, disabled: false, presenceMode: "auto" },
      displays
    );
    expect(fixed.x).toBeUndefined();
    expect(fixed.y).toBeUndefined();
    expect(fixed.muted).toBe(false);
  });
});

describe("Task10 — Pause pausa el BackgroundEngine (COUC-19)", () => {
  it("pauseAllTasks pausa running + queued sin cerrar nada", async () => {
    const engine = new BackgroundEngine({ maxConcurrent: 1 });
    let released: (() => void) | null = null;
    const gate = new Promise<void>((res) => {
      released = res;
    });
    engine.submit({
      id: "t-run",
      title: "running",
      execute: async () => {
        await gate;
        return null;
      },
    });
    engine.submit({
      id: "t-queue",
      title: "queued",
      execute: async () => null,
    });
    // Deja que el engine arranque la primera.
    await new Promise((res) => setTimeout(res, 20));
    const paused = pauseAllTasks(engine as any);
    expect(paused).toContain("t-run");
    expect(paused).toContain("t-queue");
    expect(engine.getTask("t-run")?.status).toBe("paused");
    expect(engine.getTask("t-queue")?.status).toBe("paused");
    released?.();
  });
});

describe("Task10 — wiring main.ts (tray completo + screen-changed)", () => {
  it("tray: menú Open/Settings/Pause/Quit + emit tray:id", () => {
    expect(mainSrc).toContain("pauseAllBackgroundTasks");
    expect(mainSrc).toContain("tray:id");
    for (const label of ["Abrir Ego", "Pausar", "Reanudar", "Configuraci", "Salir"]) {
      expect(mainSrc).toContain(label);
    }
  });

  it("screen-changed/display-metrics-changed → repositionToDisplay", () => {
    expect(mainSrc).toContain("repositionToDisplay");
    expect(mainSrc).toContain("display-metrics-changed");
  });
});
