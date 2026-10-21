/**
 * E6/Ola 2 (A4) — Estado vivo del avatar: comportamiento, no texto de fuente.
 *
 * ## Por qué una función pura
 * La resolución del estado del avatar vivía dentro de un `useMemo` de un
 * componente enorme (`ego-chat.tsx`): no era testeable sin montar todo el
 * chat. Se extrajo a `components/character/avatar-live-state.ts` como función
 * pura: la misma lógica, sin hooks, determinista y testeable.
 *
 * ## Qué afirma
 * 1. La **precedencia** de las señales: aprobación humana > error duro >
 *    aviso de tool > trabajo en curso > usuario escribiendo > reposo.
 * 2. Que el aviso (`warning`) está **acotado al turno en curso**: un
 *    `tool_error` de un turno anterior no puede pintar de ámbar un turno
 *    nuevo (los `toolEvents` son acumulativos: el panel los muestra como
 *    historial).
 * 3. Que el aviso **cede** cuando llega el evento de tool siguiente (la
 *    herramienta se reintenta y funciona → el avatar vuelve al trabajo).
 */
import { describe, it, expect } from "vitest";
import {
  resolveAvatarLiveState,
  type AvatarLiveStateInput,
} from "../components/character/avatar-live-state.js";

const base: AvatarLiveStateInput = {
  pendingApprovals: 0,
  activeError: false,
  isStreaming: true,
  toolEvents: [],
  lastMessageRole: "assistant",
  lastAssistantText: "texto del asistente",
  composerText: "",
};

describe("resolveAvatarLiveState — precedencia de señales", () => {
  it("sin señales: el avatar trabaja (generating)", () => {
    expect(resolveAvatarLiveState(base)).toBe("generating");
  });

  it("una tool de búsqueda → searching", () => {
    expect(
      resolveAvatarLiveState({
        ...base,
        toolEvents: [{ kind: "tool_call", toolName: "fs_search" }],
      })
    ).toBe("searching");
  });

  it("una tool normal → using_tool", () => {
    expect(
      resolveAvatarLiveState({
        ...base,
        toolEvents: [{ kind: "tool_call", toolName: "fs_write" }],
      })
    ).toBe("using_tool");
  });

  it("el texto del asistente en <thinking> → thinking", () => {
    expect(
      resolveAvatarLiveState({
        ...base,
        lastAssistantText: "<thinking>razonando",
      })
    ).toBe("thinking");
  });

  it("si el último mensaje NO es del asistente → thinking (turno recién abierto)", () => {
    expect(
      resolveAvatarLiveState({
        ...base,
        lastMessageRole: "user",
        lastAssistantText: "",
      })
    ).toBe("thinking");
  });

  it("el usuario escribiendo (fuera de streaming) → listening", () => {
    expect(
      resolveAvatarLiveState({
        ...base,
        isStreaming: false,
        composerText: "hola",
      })
    ).toBe("listening");
  });

  it("reposo → idle", () => {
    expect(
      resolveAvatarLiveState({ ...base, isStreaming: false, composerText: "" })
    ).toBe("idle");
  });
});

describe("resolveAvatarLiveState — el estado `warning` (A6, Ola 2)", () => {
  it("una tool que falló y el turno continúa → warning", () => {
    expect(
      resolveAvatarLiveState({
        ...base,
        toolEvents: [
          { kind: "tool_call", toolName: "fs_read" },
          { kind: "tool_error", toolName: "fs_read" },
        ],
      })
    ).toBe("warning");
  });

  it("el error DURO (fallo del turno) tiene prioridad sobre el aviso", () => {
    expect(
      resolveAvatarLiveState({
        ...base,
        activeError: true,
        toolEvents: [{ kind: "tool_error", toolName: "fs_read" }],
      })
    ).toBe("error");
  });

  it("la aprobación humana tiene prioridad sobre el aviso", () => {
    expect(
      resolveAvatarLiveState({
        ...base,
        pendingApprovals: 1,
        toolEvents: [{ kind: "tool_error", toolName: "fs_read" }],
      })
    ).toBe("approval_required");
  });

  it("si el turno YA NO está en streaming, el aviso no queda colgado", () => {
    expect(
      resolveAvatarLiveState({
        ...base,
        isStreaming: false,
        toolEvents: [{ kind: "tool_error", toolName: "fs_read" }],
      })
    ).toBe("idle");
  });

  it("una tool nueva después del error devuelve al trabajo normal", () => {
    expect(
      resolveAvatarLiveState({
        ...base,
        toolEvents: [
          { kind: "tool_error", toolName: "fs_read" },
          { kind: "tool_call", toolName: "fs_write" },
        ],
      })
    ).toBe("using_tool");
  });

  it("un RESULTADO OK después del error también cierra el aviso", () => {
    // La herramienta se reintenta y funciona: el último evento ya no es un
    // error → el avatar deja de avisar.
    expect(
      resolveAvatarLiveState({
        ...base,
        toolEvents: [
          { kind: "tool_error", toolName: "fs_read" },
          { kind: "tool_result", toolName: "fs_read" },
        ],
      })
    ).toBe("generating");
  });

  it("el aviso persiste mientras el modelo escribe (el texto no es una señal de tool)", () => {
    // Decisión razonada (ver handoff §3): el estado del avatar es función del
    // ÚLTIMO EVENTO DE TOOL, no del texto. Un aviso que durase un token
    // (~50 ms) sería invisible; el de un turno completo es el que el usuario
    // puede percibir y el que le dice "algo falló y el modelo sigue".
    expect(
      resolveAvatarLiveState({
        ...base,
        toolEvents: [{ kind: "tool_error", toolName: "fs_read" }],
        lastAssistantText: "no encontré el archivo, aquí va la alternativa",
      })
    ).toBe("warning");
  });
});

describe("resolveAvatarLiveState — el aviso está acotado al TURNO en curso", () => {
  it("un tool_error de un turno ANTERIOR no pinta de ámbar un turno nuevo", () => {
    // `toolEvents` es acumulativo (el panel los muestra como historial), así
    // que sin acotar, un error viejo dejaría al avatar en ámbar para siempre.
    expect(
      resolveAvatarLiveState({
        ...base,
        toolEvents: [{ kind: "tool_error", toolName: "fs_read", seq: 7 }],
        turnStartToolSeq: 7,
      })
    ).toBe("generating");
  });

  it("el tool_error del turno en curso sí se ve (seq posterior al corte)", () => {
    expect(
      resolveAvatarLiveState({
        ...base,
        toolEvents: [
          { kind: "tool_error", toolName: "fs_read", seq: 3 },
          { kind: "tool_error", toolName: "fs_read", seq: 9 },
        ],
        turnStartToolSeq: 7,
      })
    ).toBe("warning");
  });

  it("sin corte de turno (turnStartToolSeq ausente) se aplica el último evento", () => {
    expect(
      resolveAvatarLiveState({
        ...base,
        toolEvents: [{ kind: "tool_error", toolName: "fs_read" }],
      })
    ).toBe("warning");
  });
});
