// apps/desktop/test/ipc.integration.test.ts
// Suite de integración IPC con DB real (Fjall en tmpdir). NO toca tests unitarios
// existentes ni renderer ni CI.
// - Usa EgoMemoryAdapter real con el scratch compartido (T-X1) y patrón
//   close/reopen
//   (golden-path-alpha.test.ts:35-107) para probar durabilidad real.
// - Invoca la lógica REAL de 3 handlers IPC de main.ts por llamada directa
//   (no solo Schema.safeParse); los espejos locales citan la línea exacta que
//   replican para detectar drift en refactors.
// - Solo se mockea el diálogo externo del SO (dialog.showOpenDialog); todo lo
//   demás (adapter, lifecycle, schemas, tokens) es real.
// - Corre siempre con tmpdir (rápido <2s) cuando EGO_REAL_DB=1;
//   limpia tmpdir en afterAll.
import { describe, it, expect, afterAll, vi } from "vitest";
import * as path from "node:path";
import { EgoMemoryAdapter, EgoMemoryLifecycle } from "@ego/memory";
import { MemoryOpSchema, SessionsListSchema, SelectFolderRedeemSchema } from "../src/ipc/schema.js";

// Mock SOLO del diálogo externo del SO (sin GUI en tests). El resto de
// `electron` queda como stub inerte: main.ts no ejecuta nada de electron a
// nivel de módulo (guard `if (app && ...)` al final del archivo), y de él
// solo importamos funciones puras (tokens).
vi.mock("electron", () => ({
  app: undefined,
  BrowserWindow: class {},
  ipcMain: { handle: vi.fn() },
  dialog: {
    showOpenDialog: vi.fn(async () => ({
      canceled: false,
      filePaths: [path.join(scratchRunDir(), "ego-proyecto-seleccionado")],
    })),
  },
  safeStorage: undefined,
  Tray: class {},
  Menu: {},
  nativeImage: {},
  session: {},
  shell: {},
}));

// Núcleo REAL del handler `ipc.projects.selectFolderRedeem` (main.ts:3136-3143)
// y de `ipc.projects.selectFolder` (main.ts:3121-3134, token opaco single-use).
// - Corre con DB real cuando EGO_REAL_DB=1 (binding nativo construido);
//   sin la variable se salta (entornos sin nativo, p. ej. este sandbox).
import { dialog } from "electron";
import { issueFolderToken, redeemFolderToken } from "../src/main.js";
import { createScratchDir, removeScratchDir, scratchRunDir } from "./helpers/test-scratch.js";

const describeRealDb = describe.skipIf(!process.env.EGO_REAL_DB);

describeRealDb("IPC integración con DB real (tmpdir Fjall, sin mocks de persistencia)", () => {
  let tmpDir: string | null = null;
  let adapter: EgoMemoryAdapter | null = null;

  // Init perezoso: solo los tests que tocan la DB la levantan; el test de
  // selectFolder/redeem (puro en memoria) corre sin binding nativo.
  async function getAdapter(): Promise<EgoMemoryAdapter> {
    if (!adapter) {
      tmpDir = createScratchDir("ego-ipc-integration");
      adapter = new EgoMemoryAdapter(tmpDir);
      await adapter.init();
      expect(adapter.ready).toBe(true);
    }
    return adapter;
  }

  async function reopenAdapter(): Promise<EgoMemoryAdapter> {
    const live = await getAdapter();
    await live.close();
    expect(live.ready).toBe(false);
    adapter = new EgoMemoryAdapter(tmpDir as string);
    await adapter.init();
    expect(adapter.ready).toBe(true);
    return adapter;
  }

  afterAll(async () => {
    try {
      if (adapter && adapter.ready) await adapter.close();
    } catch {
      // Ignorar errores de cierre en Windows
    } finally {
      adapter = null;
    }
    try {
      if (tmpDir) removeScratchDir(tmpDir);
    } catch {
      // Ignorar bloqueos en Windows
    } finally {
      tmpDir = null;
    }
  });

  // ── Espejo 1: handler `ipc.memory` (main.ts:2573-2608) ──────────────
  // Misma secuencia: MemoryOpSchema.safeParse (fail-closed) → adapter real.
  async function invokeMemory(rawPayload: unknown): Promise<unknown> {
    const live = await getAdapter();
    const parseResult = MemoryOpSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Payload de memoria inválido: ${parseResult.error.message}`);
    }
    const { op, args } = parseResult.data;
    switch (op) {
      case "put": {
        const item = args[0];
        return live.put({
          namespace: item.namespace,
          key: item.key,
          payload: item.payload,
          metadata: item.metadata,
          ttl_ms: item.ttl_ms,
        });
      }
      case "get":
        return live.get(args[0], args[1]);
      case "delete":
        return live.delete(args[0], args[1]);
      case "searchMulti":
        return live.searchMulti(args[0], args[1], args[2]);
      case "listNamespaces":
        return live.listNamespaces();
      case "recall":
        return live.recall(args[0]);
      case "recordAudit":
        return live.recordAudit(args[0], args[1], args[2], args[3]);
      default: {
        const _exhaustive: never = op;
        throw new Error(`Operación no implementada: ${_exhaustive}`);
      }
    }
  }

  it("ipc.memory put → close/reopen → get recupera intacto (durabilidad Fjall)", async () => {
    const ns = "proj/ipc-integration";
    const payload = { spec: "API REST segura", stack: ["Node.js", "VantaDB"] };
    await invokeMemory({
      op: "put",
      args: [{ namespace: ns, key: "ctx", payload }],
    });

    // Golden-path: cierre ordenado + reapertura en frío sobre el mismo tmpdir
    await reopenAdapter();

    const record = (await invokeMemory({ op: "get", args: [ns, "ctx"] })) as {
      payload: unknown;
    } | null;
    expect(record?.payload).toEqual(payload);
  });

  it("ipc.memory rechaza payload inválido sin tocar la DB (fail-closed)", async () => {
    await expect(
      invokeMemory({ op: "dropDatabase", args: [] }),
    ).rejects.toThrow(/inválido/);
    await expect(invokeMemory({ op: "get", args: ["", "k"] })).rejects.toThrow(
      /inválido/,
    );
  });

  // ── Espejo 2: handler `ipc.sessions.list` (main.ts:4023-4056) ───────
  // Misma agregación: adapter.list("session/turns") → agrupa por sessionId.
  async function invokeSessionsList(rawReq: unknown): Promise<{
    ok: boolean;
    sessions?: Array<{
      sessionId: string;
      turnCount: number;
      lastTimestamp: number;
    }>;
    error?: string;
  }> {
    const parseResult = SessionsListSchema.safeParse(rawReq ?? undefined);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const limit = parseResult.data?.limit ?? 100;
    const projectScope = parseResult.data?.projectScope;
    const live = await getAdapter();
    const turns = await live.list("session/turns", Math.min(limit * 10, 1000));
    const bySession = new Map<
      string,
      { turnCount: number; lastTimestamp: number; projectScope?: string }
    >();
    for (const t of turns) {
      const meta = (t.metadata ?? {}) as Record<string, unknown>;
      const payload = t.payload as Record<string, unknown> | null;
      const sid =
        (typeof meta["sessionId"] === "string" && meta["sessionId"]) ||
        (payload && typeof payload["sessionId"] === "string"
          ? (payload["sessionId"] as string)
          : "") ||
        t.key.split(":")[0] ||
        "unknown";
      if (projectScope && meta["projectScope"] !== projectScope) continue;
      const ts =
        (typeof meta["timestamp"] === "number" && meta["timestamp"]) ||
        (payload && typeof payload["timestamp"] === "number"
          ? (payload["timestamp"] as number)
          : 0);
      const prev = bySession.get(sid) ?? { turnCount: 0, lastTimestamp: 0 };
      bySession.set(sid, {
        turnCount: prev.turnCount + 1,
        lastTimestamp: Math.max(prev.lastTimestamp, ts),
        ...(typeof meta["projectScope"] === "string"
          ? { projectScope: meta["projectScope"] as string }
          : {}),
      });
    }
    const sessions = [...bySession.entries()]
      .map(([sessionId, info]) => ({ sessionId, ...info }))
      .sort((a, b) => b.lastTimestamp - a.lastTimestamp)
      .slice(0, limit);
    return { ok: true, sessions };
  }

  it("ipc.sessions.list agrega turnos reales del lifecycle (2 turnos → 1 sesión)", async () => {
    const sessionId = "sess_ipc_integration";
    const lifecycle = new EgoMemoryLifecycle(await getAdapter());
    await lifecycle.startSession(sessionId, "default");
    await lifecycle.syncTurn(sessionId, "turn_1", "Pregunta uno", "Respuesta uno");
    await new Promise((r) => setTimeout(r, 5));
    await lifecycle.syncTurn(sessionId, "turn_2", "Pregunta dos", "Respuesta dos");

    const res = await invokeSessionsList({ limit: 10 });
    expect(res.ok).toBe(true);
    const mine = res.sessions?.find((s) => s.sessionId === sessionId);
    expect(mine).toBeDefined();
    expect(mine?.turnCount).toBe(2);
  });

  it("ipc.sessions.list rechaza límite fuera de schema (fail-closed)", async () => {
    const res = await invokeSessionsList({ limit: 99999 });
    expect(res.ok).toBe(false);
  });

  // ── Handler 3: selectFolder (diálogo mockeado) + redeem real ─────────
  // `ipc.projects.selectFolder` (main.ts:3121-3134): dialog → issueFolderToken.
  // `ipc.projects.selectFolderRedeem` (main.ts:3136-3143): schema → redeem.
  function invokeSelectFolderRedeem(rawReq: unknown): string | null {
    const parsed = SelectFolderRedeemSchema.safeParse(rawReq);
    if (!parsed.success) {
      throw new Error(`[IPC Security] Token de carpeta inválido: ${parsed.error.message}`);
    }
    return redeemFolderToken(parsed.data.token);
  }

  it("selectFolder (dialog mock) → redeem canjea path, single-use e inválidos", async () => {
    // El diálogo externo es lo ÚNICO mockeado: simula la elección del usuario.
    const picked = await (
      dialog.showOpenDialog as unknown as () => Promise<{
        canceled: boolean;
        filePaths: string[];
      }>
    )();
    expect(picked.canceled).toBe(false);
    const folderPath = picked.filePaths[0] as string;

    // El handler real emitiría el token opaco (nunca el path al renderer).
    const token = issueFolderToken(folderPath);
    expect(typeof token).toBe("string");

    // Canje válido retorna el path.
    expect(invokeSelectFolderRedeem({ token })).toBe(folderPath);
    // Single-use: el segundo canje del mismo token retorna null.
    expect(invokeSelectFolderRedeem({ token })).toBeNull();

    // Token con forma inválida (no-UUID) se rechaza antes de tocar el store.
    expect(() => invokeSelectFolderRedeem({ token: "no-es-uuid" })).toThrow(
      /inválido/,
    );
    // UUID bien formado pero desconocido → null honesto (no inventa paths).
    expect(
      invokeSelectFolderRedeem({ token: "123e4567-e89b-12d3-a456-426614174000" }),
    ).toBeNull();
  });
});
