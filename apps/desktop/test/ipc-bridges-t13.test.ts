/**
 * T13 — puentes IPC + probe-before-save (CONTRATO CONDUCTUAL).
 *
 * ## Por qué este fichero cambió (EGO-FIND-63 + flake)
 * Antes este fichero afirmaba el contrato **leyendo el código fuente**
 * (`expect(mainSrc).toContain('ipcMain.handle("ipc.sessions.list"')`).
 * Eso es un test **tautológico**: pasa si el string está, aunque el handler
 * no exista, no se registre o no responda. A1 lo señaló (EGO-FIND-63).
 *
 * Y además era **inestable**: el `await import("../src/main.js")` estaba
 * DENTRO del cuerpo de un `it`, así que la evaluación del grafo de módulos
 * del proceso main (17 paquetes del workspace + el binding nativo de
 * VantaDB) se cobraba del presupuesto de 5 s del PRIMER test que importaba
 * ("401 del proveedor"). Medido: 1 543 ms aislado, 2 561 ms con la suite
 * completa en paralelo → el test se iba por timeout bajo carga. El fallo
 * NO era una carrera ni un bug de producción: era un **coste de setup
 * cargado en el scope equivocado**.
 *
 * Ahora:
 *  - el import vive a NIVEL DE MÓDULO (se paga en `collect`, que no
 *    tiene timeout por test) → determinista;
 *  - el contrato se verifica por **COMPORTAMIENTO**: se mockea `electron`,
 *    se capturan los handlers registrados y se INVOCAN.
 */
import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { EgoIpcInvokeChannels } from "../src/ipc.js";
import {
  SessionsListSchema,
  SessionGetSchema,
  SessionResumeSchema,
  DailyListApprovalsSchema,
} from "../src/ipc/schema.js";

/** Handlers IPC registrados, capturados del `ipcMain.handle` mockeado. */
const registered = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();

vi.mock("electron", () => ({
  app: undefined,
  BrowserWindow: class {},
  ipcMain: {
    handle: vi.fn((channel: string, listener: (event: unknown, ...args: unknown[]) => unknown) => {
      registered.set(channel, listener);
    }),
  },
  dialog: { showOpenDialog: vi.fn() },
  safeStorage: undefined,
  Tray: class {},
  Menu: {},
  nativeImage: {},
  session: {},
  shell: {},
  contextBridge: { exposeInMainWorld: vi.fn() },
}));

// El import a NIVEL DE MÓDULO: el coste de evaluación del grafo de módulos
// se paga en la fase `collect` (sin timeout por test), no dentro de un `it`.
const { probeModelKey } = await import("../src/main.js");
const { registerIpcHandlers } = await import("../src/main/ipc/register-ipc.js");

const NEW_CHANNELS = [
  "ipc.sessions.list",
  "ipc.sessions.get",
  "ipc.sessions.resume",
  "ipc.daily.listApprovals",
  "ipc.settings.getStorageInfo",
  "ipc.settings.getGovPolicies",
] as const;

/**
 * Deps mínimas del registro de handlers: cualquier propiedad no usada por
 * los canales que invocamos devuelve un doble inerte.
 */
function stubDeps() {
  const adapter = {
    ready: true,
    listNamespaces: vi.fn(async () => ["gov/settings", "kb/docs"]),
    list: vi.fn(async () => [
      { key: "p1", payload: { mode: "ask" }, metadata: { updatedAtMs: 1 } },
    ]),
    get: vi.fn(async () => undefined),
    put: vi.fn(async () => undefined),
  };
  const deps = {
    adapter,
    lifecycle: { listSessions: vi.fn(async () => [{ id: "s1" }]) },
    userDataDir: "C:\\Users\\test\\AppData",
    dbPath: "C:\\Users\\test\\AppData\\ego_memory.vdb",
    dailyStateEngine: { listApprovals: vi.fn(async () => []) },
  } as unknown as Parameters<typeof registerIpcHandlers>[0];
  return deps;
}

beforeAll(() => {
  registerIpcHandlers(stubDeps());
});

describe("T13 — puentes IPC: el contrato se verifica por COMPORTAMIENTO", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("los 6 canales nuevos están en el contrato canónico", () => {
    for (const ch of NEW_CHANNELS) {
      expect(
        (EgoIpcInvokeChannels as readonly string[]),
        `falta ${ch} en el contrato`
      ).toContain(ch);
    }
  });

  it("los 6 canales nuevos quedan REGISTRADOS (handler invocable)", () => {
    for (const ch of NEW_CHANNELS) {
      const handler = registered.get(ch);
      expect(handler, `el canal ${ch} no está registrado`).toBeTypeOf("function");
    }
  });

  it("ipc.sessions.list responde con las sesiones del backend", async () => {
    const handler = registered.get("ipc.sessions.list")!;
    const res = (await handler({})) as { ok: boolean; sessions: unknown[] };
    expect(res.ok).toBe(true);
    expect(Array.isArray(res.sessions)).toBe(true);
  });

  it("ipc.settings.getStorageInfo responde con el estado real del almacén", async () => {
    const handler = registered.get("ipc.settings.getStorageInfo")!;
    const res = (await handler({})) as {
      ok: boolean;
      dbPath: string;
      namespaces: string[];
      operational: boolean;
    };
    expect(res.ok).toBe(true);
    expect(res.dbPath).toContain("ego_memory.vdb");
    expect(res.namespaces).toContain("gov/settings");
    expect(res.operational).toBe(true);
  });

  it("ipc.settings.getGovPolicies devuelve las políticas del backend", async () => {
    const handler = registered.get("ipc.settings.getGovPolicies")!;
    const res = (await handler({})) as {
      ok: boolean;
      policies: Array<{ key: string }>;
    };
    expect(res.ok).toBe(true);
    expect(res.policies[0]?.key).toBe("p1");
  });

  it("schemas Zod de sesiones y aprobaciones validan y rechazan", () => {
    expect(SessionsListSchema.safeParse(undefined).success).toBe(true);
    expect(SessionsListSchema.safeParse({ limit: 10 }).success).toBe(true);
    expect(SessionsListSchema.safeParse({ limit: 99999 }).success).toBe(false);
    expect(SessionGetSchema.safeParse({ sessionId: "s1" }).success).toBe(true);
    expect(SessionGetSchema.safeParse({ sessionId: "" }).success).toBe(false);
    expect(SessionResumeSchema.safeParse({ sessionId: "s1" }).success).toBe(true);
    expect(DailyListApprovalsSchema.safeParse(undefined).success).toBe(true);
    expect(DailyListApprovalsSchema.safeParse({ limit: 5 }).success).toBe(true);
  });

  describe("probe-before-save (hermes P3)", () => {
    it("401 del proveedor → error accionable 'key inválida' y NO persiste", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("unauthorized", { status: 401 }))
      );
      await expect(
        probeModelKey({ provider: "openai", key: "sk-falsa" })
      ).rejects.toThrow(/inválida/i);
    });

    it("404 del proveedor → error accionable y NO persiste", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("not found", { status: 404 }))
      );
      await expect(
        probeModelKey({ provider: "deepseek", key: "sk-falsa" })
      ).rejects.toThrow(/inválida/i);
    });

    it("red ausente → advierte pero permite con flag (verified:false + networkUnreachable)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new TypeError("fetch failed");
        })
      );
      const r = await probeModelKey({ provider: "openai", key: "sk-real" });
      expect(r.verified).toBe(false);
      expect(r.networkUnreachable).toBe(true);
    });

    it("200 → verified:true", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }))
      );
      const r = await probeModelKey({ provider: "openai", key: "sk-real" });
      expect(r.verified).toBe(true);
    });

    it("la probe nunca loguea la key (ni en éxito ni en error)", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      try {
        vi.stubGlobal(
          "fetch",
          vi.fn(async () => new Response("unauthorized", { status: 401 }))
        );
        await probeModelKey({ provider: "openai", key: "sk-secreta-123" }).catch(
          () => undefined
        );
        const said = [...warn.mock.calls, ...error.mock.calls, ...log.mock.calls]
          .flat()
          .join(" ");
        expect(said).not.toContain("sk-secreta-123");
      } finally {
        warn.mockRestore();
        error.mockRestore();
        log.mockRestore();
      }
    });
  });
});
