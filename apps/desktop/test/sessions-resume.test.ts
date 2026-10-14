import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { EgoMemoryAdapter } from "@ego/memory";
import { EgoMemoryLifecycle } from "@ego/memory";
import { SessionGetSchema, SessionResumeSchema } from "../src/ipc/schema.js";
import { turnsToMessages } from "../renderer/lib/session-resume.js";

const here = dirname(fileURLToPath(import.meta.url));
const mainSrc = readFileSync(join(here, "..", "src", "main.ts"), "utf-8");

/**
 * T18 — Resume real de sesión desde VantaDB (RED primero, TDD).
 * Contrato: turno → reinicio (close/reopen del adapter) → restore →
 * mensajes hidratados intactos. Sin mocks de persistencia.
 */
describe("T18: sessions-resume — turno persiste y reanuda intacto", () => {
  const tmpDir = path.join(os.tmpdir(), `ego-sessions-resume-${Date.now()}`);

  beforeAll(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterAll(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
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

  it("turno → reinicio → restore hidrata mensajes intactos (VantaDB real)", async () => {
    const sessionId = "sess_t18";
    // Turno: dos escrituras con timestamps distintos (sleep >1ms)
    const writer = new EgoMemoryAdapter(tmpDir);
    await writer.init();
    const lifecycle = new EgoMemoryLifecycle(writer);
    await lifecycle.startSession(sessionId, "default");
    await lifecycle.syncTurn(sessionId, "turn_1", "Primera pregunta", "Primera respuesta");
    await new Promise((r) => setTimeout(r, 5));
    await lifecycle.syncTurn(sessionId, "turn_2", "Segunda pregunta", "Segunda respuesta");
    await writer.close();

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
  });

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
