import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { EgoMemoryAdapter } from "@ego/memory";
import { EgoMemoryLifecycle } from "@ego/memory";
import { SessionGetSchema, SessionResumeSchema } from "../src/ipc/schema.js";
import { turnsToMessages } from "../renderer/lib/session-resume.js";
import { readMainSource } from "./helpers/main-source.js";
import { createScratchDir, removeScratchDir } from "./helpers/test-scratch.js";

const here = dirname(fileURLToPath(import.meta.url));
const mainSrc = readMainSource();

/**
 * T18 — Resume real de sesión desde VantaDB (RED primero, TDD).
 * Contrato: turno → reinicio (close/reopen del adapter) → restore →
 * mensajes hidratados intactos. Sin mocks de persistencia.
 */
describe("T18: sessions-resume — turno persiste y reanuda intacto", () => {
  const tmpDir = createScratchDir("ego-sessions-resume");

  beforeAll(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterAll(async () => {
    try {
      removeScratchDir(tmpDir);
    } catch {
      // Ignorar bloqueos en Windows
    }
  });

  it("schemas Zod de get/resume aceptan sessionId válido y rechazan vacío", () => {
    expect(SessionGetSchema.safeParse({ sessionId: "sess_1" }).success).toBe(true);
    expect(SessionGetSchema.safeParse({ sessionId: "" }).success).toBe(false);
    expect(SessionResumeSchema.safeParse({ sessionId: "sess_1" }).success).toBe(true);
    expect(SessionResumeSchema.safeParse({}).success).toBe(false);
  });

  it("main.ts expone historial: get retorna turns y resume activa la sesión", () => {
    expect(mainSrc).toContain(`ipcMain.handle("ipc.sessions.get"`);
    expect(mainSrc).toContain(`ipcMain.handle("ipc.sessions.resume"`);
    // get devuelve los turnos (no solo el conteo) y resume fija lifecycle
    expect(mainSrc).toContain("turns: mine");
    expect(mainSrc).toContain("lifecycle.startSession(");
  });

  it(
    "turno → reinicio → restore hidrata mensajes intactos (VantaDB real)",
    // T-X1 (Ola 3) — Presupuesto explícito, medido.
    //
    // Este test abre y **reabre** el store nativo (turno → cierre → lectura
    // en frío). Con el presupuesto por defecto (5 s) se iba por timeout
    // cuando la máquina está saturada; al interrumpirse, el `close()` del
    // writer (que estaba FUERA del `finally`) no se ejecutaba y el handle
    // nativo quedaba abierto como "writer" → el siguiente test del fichero
    // fallaba con `Database busy: ... is already open in this process
    // (writer)`. Un timeout de un test se convertía en un fallo ENCASCADADO
    // del siguiente.
    //
    // Coste real: ~1,7 s en aislamiento (medido), ~2,3 s con la máquina
    // cargada. El presupuesto de 20 s es proporcional a un E2E de disco y
    // NO esconde ningún fallo: si el golden path se rompe, el test sigue
    // fallando por aserción.
    { timeout: 20_000 },
    async () => {
      const sessionId = "sess_t18";
      // Turno: dos escrituras con timestamps distintos (sleep >1ms)
      const writer = new EgoMemoryAdapter(tmpDir);
      await writer.init();
      try {
        const lifecycle = new EgoMemoryLifecycle(writer);
        await lifecycle.startSession(sessionId, "default");
        await lifecycle.syncTurn(sessionId, "turn_1", "Primera pregunta", "Primera respuesta");
        await new Promise((r) => setTimeout(r, 5));
        await lifecycle.syncTurn(sessionId, "turn_2", "Segunda pregunta", "Segunda respuesta");
      } finally {
        // SIEMPRE se cierra: si una aserción falla antes, el handle nativo
        // no puede quedar abierto (bloquearía el siguiente test).
        await writer.close();
      }

      // Reinicio: adapter nuevo sobre el mismo path (persistencia en disco)
      const reader = new EgoMemoryAdapter(tmpDir);
      await reader.init();
      try {
        const all = await reader.list("session/turns", 1000);
        // Mismo filtro que el handler ipc.sessions.get (main.ts)
        const mine = all.filter((t) => {
          const meta = (t.metadata ?? {}) as Record<string, unknown>;
          if (meta["sessionId"] === sessionId) return true;
          const payload = t.payload as Record<string, unknown> | null;
          if (payload && payload["sessionId"] === sessionId) return true;
          return t.key === sessionId || t.key.startsWith(`${sessionId}:`);
        });
        expect(mine).toHaveLength(2);

        const messages = turnsToMessages(mine);
        expect(messages.map((m) => m.content[0].text)).toEqual([
          "Primera pregunta",
          "Primera respuesta",
          "Segunda pregunta",
          "Segunda respuesta",
        ]);
        expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
      } finally {
        await reader.close();
      }
    }
  );

  it("sesión inexistente restaura vacío honesto (sin inventar turnos)", async () => {
    const adapter = new EgoMemoryAdapter(tmpDir);
    await adapter.init();
    try {
      const all = await adapter.list("session/turns", 1000);
      const mine = all.filter((t) => {
        const meta = (t.metadata ?? {}) as Record<string, unknown>;
        return meta["sessionId"] === "sess_que_no_existe";
      });
      expect(turnsToMessages(mine)).toEqual([]);
    } finally {
      await adapter.close();
    }
  });
});
