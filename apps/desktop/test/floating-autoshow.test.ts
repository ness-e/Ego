import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  shouldAutoShow,
  syncFromAttention,
  FloatingWindowManager,
} from "../src/windows/FloatingWindow.js";
import { BrowserWindow } from "electron";

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
    },
  };
});

describe("Task4 — autoshow flotante al minimizar (D2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra si hay tasks activas y no muted/disabled", () => {
    expect(
      shouldAutoShow({ active: 1, hitl: 0, muted: false, disabled: false })
    ).toBe(true);
  });

  it("muestra si hay HITL pendiente aunque active sea 0", () => {
    expect(
      shouldAutoShow({ active: 0, hitl: 2, muted: false, disabled: false })
    ).toBe(true);
  });

  it("no muestra en idle (sin trabajo ni HITL)", () => {
    expect(
      shouldAutoShow({ active: 0, hitl: 0, muted: false, disabled: false })
    ).toBe(false);
  });

  it("false-path: muted bloquea el autoshow aunque haya trabajo", () => {
    expect(
      shouldAutoShow({ active: 3, hitl: 1, muted: true, disabled: false })
    ).toBe(false);
  });

  it("false-path: presencia desactivada bloquea el autoshow", () => {
    expect(
      shouldAutoShow({ active: 3, hitl: 1, muted: false, disabled: true })
    ).toBe(false);
  });

  it("syncFromAttention mapea AttentionState a estado flotante", () => {
    expect(syncFromAttention("hitl_approval")).toBe("hitl_approval");
    expect(syncFromAttention("expanded")).toBe("expanded");
    expect(syncFromAttention("compact")).toBe("compact");
    expect(syncFromAttention("hidden")).toBe("hidden");
  });

  it("manager setMuted/setDisabled actualizan estado (presencia in-memory)", () => {
    const mgr = new FloatingWindowManager();
    expect(mgr.getState().muted).toBe(false);
    mgr.setMuted(true);
    expect(mgr.getState().muted).toBe(true);
    mgr.setDisabled(true);
    expect(mgr.getState().disabled).toBe(true);
    mgr.setMuted(false);
    mgr.setDisabled(false);
    expect(mgr.getState().muted).toBe(false);
    expect(mgr.getState().disabled).toBe(false);
  });

  it("manager show() usa showInactive (sin robar foco)", () => {
    const mgr = new FloatingWindowManager();
    mgr.show();
    expect(BrowserWindow).toHaveBeenCalled();
    const win = mgr.getState().visible;
    expect(win).toBe(true);
  });
});
