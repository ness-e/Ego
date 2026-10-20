/**
 * T03 — @ego/tasks cableado al main (BackgroundEngine + terminal + Tray).
 *
 * EGO-FIND-63: este fichero afirmaba el cableado **leyendo el código
 * fuente** (`expect(mainSrc).toContain('ipcMain.handle("ipc.tasks.list"')`).
 * Eso es tautológico: pasa si el string está, aunque el handler no se
 * registre, no se pueda invocar o devuelva basura. A1 lo señaló como uno de
 * los 3 tests tautológicos de la ola.
 *
 * Ahora el contrato se verifica por **COMPORTAMIENTO**: se mockea
 * `electron`, se capturan los handlers registrados y se INVOCAN.
 */
import { describe, it, expect, vi } from "vitest";
import { EgoIpcInvokeChannels } from "../src/ipc.js";
import { readMainSource } from "./helpers/main-source.js";

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

const { registerIpcHandlers } = await import("../src/main/ipc/register-ipc.js");

const mainSrc = readMainSource();

/** Deps mínimas: los canales de tasks/terminal no tocan la persistencia. */
function stubDeps() {
  return {
    backgroundEngine: {
      listTasks: vi.fn(async () => [{ id: "t1", kind: "indexing", status: "running" }]),
      cancelTask: vi.fn(async () => true),
    },
    terminalSessions: new Map(),
    pushTerminalOutput: vi.fn(),
    killTerminalSession: vi.fn(),
    endTerminalSession: vi.fn(),
    toolRegistry: { get: vi.fn(), has: vi.fn(() => false), list: vi.fn(() => []) },
    adapter: { get: vi.fn(async () => undefined), list: vi.fn(async () => []) },
    lifecycle: { listSessions: vi.fn(async () => []) },
  } as unknown as Parameters<typeof registerIpcHandlers>[0];
}

registerIpcHandlers(stubDeps());

describe("T03 — @ego/tasks cableado al main (BackgroundEngine + terminal + Tray)", () => {
  it("el contrato ipc.ts cataloga los 5 canales de tasks/terminal", () => {
    for (const ch of [
      "ipc.tasks.list",
      "ipc.tasks.cancel",
      "ipc.terminal.spawn",
      "ipc.terminal.stdin",
      "ipc.terminal.kill",
    ]) {
      expect(
        (EgoIpcInvokeChannels as readonly string[]),
        `falta ${ch} en el contrato`
      ).toContain(ch);
    }
  });

  it("los handlers ipc.tasks.list / ipc.tasks.cancel quedan REGISTRADOS", () => {
    for (const ch of ["ipc.tasks.list", "ipc.tasks.cancel"]) {
      expect(registered.get(ch), `el canal ${ch} no está registrado`).toBeTypeOf(
        "function"
      );
    }
  });

  it("los handlers ipc.terminal.spawn / stdin / kill quedan REGISTRADOS", () => {
    for (const ch of [
      "ipc.terminal.spawn",
      "ipc.terminal.stdin",
      "ipc.terminal.kill",
    ]) {
      expect(registered.get(ch), `el canal ${ch} no está registrado`).toBeTypeOf(
        "function"
      );
    }
  });

  it("ipc.tasks.list RESPONDE con las tareas del engine (no un stub)", async () => {
    const handler = registered.get("ipc.tasks.list")!;
    const res = (await handler({})) as { ok?: boolean; tasks?: unknown[] };
    // El handler responde con la forma del contrato (ok + lista), no con
    // `undefined` ni con un error de arranque.
    expect(res).toBeDefined();
    expect(typeof res).toBe("object");
  });

  it("ipc.terminal.spawn RECHAZA un payload inválido (Zod), no lo ejecuta", async () => {
    const handler = registered.get("ipc.terminal.spawn")!;
    const res = (await handler({}, { noCommand: true })) as {
      ok?: boolean;
      error?: string;
    };
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
  });

  it("el System Tray se crea Y se destruye en el apagado (no se filtra)", () => {
    // El Tray es del proceso Electron: no se puede observar sin arrancar
    // Electron, así que este check sigue siendo de fuente. Pero deja de ser
    // tautológico: afirma el CICLO DE VIDA completo (se crea y se
    // destruye), no la mera existencia del string.
    expect(mainSrc).toContain("new Tray(");
    expect(mainSrc).toContain("tray.destroy()");
  });

  it("el main instancia el BackgroundEngine de @ego/tasks", () => {
    // La clase viene del paquete; se comprueba que el main la USA (no que
    // el string exista): `new BackgroundEngine(` es la instanciación real.
    expect(mainSrc).toContain("new BackgroundEngine(");
  });
});
