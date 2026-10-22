// tests/e2e/floating-window-surface.test.ts
//
// EGO-FIND-63 (Ola 11 · A7) — SUPERFICIE PÚBLICA de la isla flotante,
// verificada por **COMPORTAMIENTO**, no por texto de fuente.
//
// ANTES (lo que este fichero sustituye):
//   `tests/e2e/contract/floating-wiring.contract.test.ts` afirmaba sobre el
//   TEXTO de `apps/desktop/src/windows/FloatingWindow.ts`:
//     expect(viewSrc).toMatch(/export function shouldAutoShow\(/);
//     expect(viewSrc).toMatch(/export function syncFromAttention\(/);
//     expect(viewSrc).toMatch(/export class FloatingWindowManager/);
//   Eso no falla cuando el producto se rompe: sólo cuando alguien reescribe
//   el fichero. El inventario de asertos tautológicos lo contaba como "prueba"
//   (3 asserts) sin que midiera nada.
//
// AHORA:
//   · se IMPORTA el módulo y se LLAMA a su API: si `shouldAutoShow` cambia de
//     semántica, el aserto falla por comportamiento;
//   · si el símbolo desaparece, el import falla (error de módulo), no un
//     `toMatch` sobre texto.
//
// Los contratos que NO se pueden comprobar por comportamiento (el wiring del
// proceso main, que tiene efectos de módulo) viven en
// `apps/desktop/scripts/lint/source-contracts.lint.mjs` (A4): un ejecutable
// que falla con exit 1 y NO ensucia el recuento del inventario.
//
// E2E-RESOLVE: `electron` NO es dependencia de `@ego/e2e-tests`, así que el
// bare specifier no resuelve desde este archivo y `vi.mock("electron")` no
// interceptaría la copia que importa `FloatingWindowView.ts` (resuelve vía
// `apps/desktop/node_modules` → mismo realpath pnpm store). Se mockea por ruta
// relativa con idéntico realpath (patrón probado en `floating-minimize.test.ts`).
import { describe, it, expect, vi } from "vitest";
import {
  shouldAutoShow,
  syncFromAttention,
  FloatingWindowManager,
  isPresenceAllowed,
} from "../../apps/desktop/src/windows/FloatingWindow.js";

vi.mock("../../apps/desktop/node_modules/electron", () => {
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
    setBounds: vi.fn(),
    setSize: vi.fn(),
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
      getAllDisplays: vi.fn(() => [{ bounds: { x: 0, y: 0, width: 1920, height: 1080 } }]),
      on: vi.fn(),
    },
  };
});

describe("COMPORTAMIENTO — `shouldAutoShow` (regla: trabajo o HITL; nunca muted/disabled)", () => {
  it("no muestra sin trabajo ni HITL", () => {
    expect(shouldAutoShow({ active: 0, hitl: 0, muted: false })).toBe(false);
  });

  it("muestra si hay trabajo activo", () => {
    expect(shouldAutoShow({ active: 1, hitl: 0, muted: false })).toBe(true);
  });

  it("muestra si hay HITL pendiente", () => {
    expect(shouldAutoShow({ active: 0, hitl: 1, muted: false })).toBe(true);
  });

  it("NO muestra si está silenciado (muted es sólo audio)", () => {
    expect(shouldAutoShow({ active: 5, hitl: 5, muted: true })).toBe(false);
  });

  it("NO muestra si la presencia está desactivada", () => {
    expect(shouldAutoShow({ active: 5, hitl: 5, muted: false, disabled: true })).toBe(false);
  });
});

describe("COMPORTAMIENTO — `isPresenceAllowed` (EGO-FIND-104: el mute no bloquea la presencia)", () => {
  it("permite por defecto", () => {
    expect(isPresenceAllowed({})).toBe(true);
  });

  it("bloquea con `disabled`", () => {
    expect(isPresenceAllowed({ disabled: true })).toBe(false);
  });

  it("bloquea con `presenceMode: never`", () => {
    expect(isPresenceAllowed({ presenceMode: "never" })).toBe(false);
  });

  it("permite con `presenceMode: always` aunque esté disabled=false", () => {
    expect(isPresenceAllowed({ presenceMode: "always" })).toBe(true);
  });

  it("el mute NO forma parte del gate de presencia", () => {
    // El mute es sólo audio: la presencia lo gobiernan `disabled` y
    // `presenceMode`. Antes, `muted` mataba el autoshow (deadlock EGO-FIND-104).
    expect(isPresenceAllowed({ muted: true } as never)).toBe(true);
  });
});

describe("COMPORTAMIENTO — `syncFromAttention` (costura FSM → flotante)", () => {
  it("devuelve el mismo estado para los 5 estados de la FSM", () => {
    for (const s of ["hidden", "compact", "expanded", "alert", "hitl_approval"] as const) {
      expect(syncFromAttention(s)).toBe(s);
    }
  });

  it("cae en `hidden` ante un estado desconocido (fallback defensivo)", () => {
    expect(syncFromAttention("inventado" as never)).toBe("hidden");
  });
});

describe("COMPORTAMIENTO — `FloatingWindowManager` (la clase que el proceso main usa)", () => {
  it("arranca oculta, sin silenciar y en `hidden`", () => {
    const mgr = new FloatingWindowManager();
    const state = mgr.getState();
    expect(state.visible).toBe(false);
    expect(state.muted).toBe(false);
    expect(state.attentionState).toBe("hidden");
    mgr.destroy();
  });

  it("refleja el estado que se le impone", () => {
    const mgr = new FloatingWindowManager();
    mgr.updateState({ attentionState: "compact" });
    mgr.setMuted(true);
    const state = mgr.getState();
    expect(state.attentionState).toBe("compact");
    expect(state.muted).toBe(true);
    mgr.destroy();
  });

  it("expone el modo de opacidad (auto por defecto)", () => {
    const mgr = new FloatingWindowManager();
    expect(mgr.getOpacityMode()).toBe("auto");
    mgr.destroy();
  });
});
