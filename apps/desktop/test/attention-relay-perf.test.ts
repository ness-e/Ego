// PERF (Ola 13): el relay de atención no debe inundar al renderer.
//
// El recompute de atención corre en rutas calientes (cada evento de tarea, sin
// coalescer). Publicar el estado en cada recompute metía eventos `ipc.event`
// idénticos en el renderer; cada uno hacía un `set()` del store => re-render de
// la app entera y los `<ego-avatar>` se quedaban sin CPU (su rAF no llegaba).
//
// El contrato: **solo se publica cuando el estado cambia de verdad**.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { publishAttentionState, setWin } from "../src/main/state/app-context.js";

function fakeWindow(): { send: ReturnType<typeof vi.fn>; win: unknown } {
  const send = vi.fn();
  const win = {
    isDestroyed: () => false,
    webContents: { send },
  };
  return { send, win };
}

describe("PERF — el relay de atención publica solo los cambios", () => {
  beforeEach(() => {
    setWin(null);
  });

  it("el MISMO estado repetido se publica UNA vez", () => {
    const { send, win } = fakeWindow();
    setWin(win as never);
    publishAttentionState("expanded");
    publishAttentionState("expanded");
    publishAttentionState("expanded");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("un cambio de estado sí se publica (una vez por cambio)", () => {
    const { send, win } = fakeWindow();
    setWin(win as never);
    publishAttentionState("expanded");
    publishAttentionState("expanded");
    publishAttentionState("compact");
    publishAttentionState("compact");
    publishAttentionState("hidden");
    expect(send).toHaveBeenCalledTimes(3);
    expect(send).toHaveBeenLastCalledWith("ipc.event", {
      kind: "attention.state",
      state: "hidden",
    });
  });

  it("una ventana NUEVA recibe el estado otra vez (el renderer nuevo no sabe nada)", () => {
    const { send, win } = fakeWindow();
    setWin(win as never);
    publishAttentionState("expanded");
    expect(send).toHaveBeenCalledTimes(1);
    // Se recrea la ventana: el renderer nuevo parte de cero.
    setWin(null);
    setWin(win as never);
    publishAttentionState("expanded");
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("sin ventana no se publica nada (y no revienta)", () => {
    setWin(null);
    expect(() => publishAttentionState("expanded")).not.toThrow();
  });
});
