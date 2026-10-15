import { describe, it, expect } from "vitest";
import { turnsToMessages, type SessionTurnRecord } from "../lib/session-resume.js";

/**
 * T18 — Resume real de sesión desde VantaDB (RED primero, TDD).
 * Contrato: turnos persistidos (`session/turns` vía `ipc.sessions.get`)
 * se hidratan a mensajes de chat; vacío honesto, nunca inventar.
 */
describe("T18: session-resume — turnos persistidos hidratan mensajes", () => {
  const turn = (over: Partial<SessionTurnRecord> = {}): SessionTurnRecord => ({
    key: "sess_1:turn_1",
    payload: {
      sessionId: "sess_1",
      turnId: "turn_1",
      timestamp: 1000,
      userPrompt: "¿Cuál es la tarifa base?",
      assistantReply: "La tarifa base es $150 USD/hora.",
      recalledKeys: [],
    },
    metadata: { sessionId: "sess_1", timestamp: 1000 },
    ...over,
  });

  it("un turno persistido hidrata un par user + assistant con textos exactos", () => {
    const msgs = turnsToMessages([turn()]);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]?.role).toBe("user");
    expect(msgs[0]?.content[0]?.text).toBe("¿Cuál es la tarifa base?");
    expect(msgs[1]?.role).toBe("assistant");
    expect(msgs[1]?.content[0]?.text).toBe("La tarifa base es $150 USD/hora.");
  });

  it("ordena por timestamp ascendente aunque el listado llegue desordenado", () => {
    const t2 = turn({
      key: "sess_1:turn_2",
      payload: {
        sessionId: "sess_1",
        turnId: "turn_2",
        timestamp: 2000,
        userPrompt: "Segunda pregunta",
        assistantReply: "Segunda respuesta",
        recalledKeys: [],
      },
      metadata: { sessionId: "sess_1", timestamp: 2000 },
    });
    const msgs = turnsToMessages([t2, turn()]);
    expect(msgs.map((m) => m.content[0]?.text)).toEqual([
      "¿Cuál es la tarifa base?",
      "La tarifa base es $150 USD/hora.",
      "Segunda pregunta",
      "Segunda respuesta",
    ]);
  });

  it("tolera los nombres legacy userMessage/assistantResponse", () => {
    const msgs = turnsToMessages([
      turn({
        payload: {
          sessionId: "sess_1",
          turnId: "turn_9",
          timestamp: 3000,
          userPrompt: "",
          assistantReply: "",
          userMessage: "legacy user",
          assistantResponse: "legacy assistant",
          recalledKeys: [],
        },
      }),
    ]);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]?.content[0]?.text).toBe("legacy user");
    expect(msgs[1]?.content[0]?.text).toBe("legacy assistant");
  });

  it("sesión sin turnos hidrata vacío honesto (sin inventar mensajes)", () => {
    expect(turnsToMessages([])).toEqual([]);
  });

  it("omite turnos sin texto pero conserva los válidos", () => {
    const empty = turn({
      key: "sess_1:turn_x",
      payload: {
        sessionId: "sess_1",
        turnId: "turn_x",
        timestamp: 1500,
        userPrompt: "   ",
        assistantReply: "",
        recalledKeys: [],
      },
    });
    const msgs = turnsToMessages([empty, turn()]);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]?.content[0]?.text).toBe("¿Cuál es la tarifa base?");
  });

  it("omite payloads no-objeto sin romper la hidratación", () => {
    const msgs = turnsToMessages([
      { key: "sess_1:bad", payload: "texto plano", metadata: {} },
      turn(),
    ]);
    expect(msgs).toHaveLength(2);
  });
});
