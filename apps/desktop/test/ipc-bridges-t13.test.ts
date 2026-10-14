import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { EgoIpcInvokeChannels } from "../src/ipc.js";
import {
  SessionsListSchema,
  SessionGetSchema,
  SessionResumeSchema,
  DailyListApprovalsSchema,
} from "../src/ipc/schema.js";

const here = dirname(fileURLToPath(import.meta.url));
const mainSrc = readFileSync(join(here, "..", "src", "main.ts"), "utf-8");
const ipcSrc = readFileSync(join(here, "..", "src", "ipc.ts"), "utf-8");
const preloadSrc = readFileSync(join(here, "..", "src", "preload.ts"), "utf-8");
const egoSrc = readFileSync(join(here, "..", "renderer", "lib", "ego.ts"), "utf-8");

const NEW_CHANNELS = [
  "ipc.sessions.list",
  "ipc.sessions.get",
  "ipc.sessions.resume",
  "ipc.daily.listApprovals",
  "ipc.settings.getStorageInfo",
  "ipc.settings.getGovPolicies",
] as const;

describe("T13 — puentes IPC faltantes + probe-before-save (contrato)", () => {
  it("el contrato ipc.ts cataloga los 6 canales nuevos", () => {
    for (const ch of NEW_CHANNELS) {
      expect((EgoIpcInvokeChannels as readonly string[]), `falta ${ch} en contrato`).toContain(ch);
      expect(ipcSrc, `falta ${ch} en ipc.ts`).toContain(ch);
    }
  });

  it("main.ts registra handlers para los 6 canales nuevos", () => {
    for (const ch of NEW_CHANNELS) {
      expect(mainSrc, `falta handler ${ch} en main.ts`).toContain(`ipcMain.handle("${ch}"`);
    }
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

  it("preload.ts puentea tasks/terminal huérfanos + sesiones + daily.listApprovals + settings nuevos", () => {
    for (const ch of [
      "ipc.tasks.list",
      "ipc.tasks.cancel",
      "ipc.terminal.spawn",
      "ipc.terminal.stdin",
      "ipc.terminal.kill",
      ...NEW_CHANNELS,
    ]) {
      expect(preloadSrc, `falta invoke ${ch} en preload.ts`).toContain(`"${ch}"`);
    }
  });

  it("ego.ts tipa los mismos puentes y el mock lleva {mock:true} visible", () => {
    for (const token of ["sessions", "listApprovals", "getStorageInfo", "getGovPolicies", "tasks", "terminal"]) {
      expect(egoSrc, `falta puente ${token} en ego.ts`).toContain(token);
    }
    expect(egoSrc).toContain("mock: true");
  });

  describe("probe-before-save (hermes P3)", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("401 del proveedor → error accionable 'key inválida' y NO persiste", async () => {
      const { probeModelKey } = await import("../src/main.js");
      vi.stubGlobal("fetch", vi.fn(async () => new Response("unauthorized", { status: 401 })));
      await expect(probeModelKey({ provider: "openai", key: "sk-falsa" })).rejects.toThrow(/inválida/i);
    });

    it("404 del proveedor → error accionable y NO persiste", async () => {
      const { probeModelKey } = await import("../src/main.js");
      vi.stubGlobal("fetch", vi.fn(async () => new Response("not found", { status: 404 })));
      await expect(probeModelKey({ provider: "deepseek", key: "sk-falsa" })).rejects.toThrow(/inválida/i);
    });

    it("red ausente → advierte pero permite con flag (verified:false + networkUnreachable)", async () => {
      const { probeModelKey } = await import("../src/main.js");
      vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
      const r = await probeModelKey({ provider: "openai", key: "sk-real" });
      expect(r.verified).toBe(false);
      expect(r.networkUnreachable).toBe(true);
    });

    it("200 → verified:true", async () => {
      const { probeModelKey } = await import("../src/main.js");
      vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })));
      const r = await probeModelKey({ provider: "openai", key: "sk-real" });
      expect(r.verified).toBe(true);
    });

    it("la probe nunca loguea la key (ni en éxito ni en error)", () => {
      const probeRegion = mainSrc.slice(mainSrc.indexOf("probeModelKey"));
      expect(probeRegion.length).toBeGreaterThan(200);
      expect(probeRegion).not.toMatch(/console\.(log|error|warn)\([^)]*key[^)]*\)/i);
    });
  });
});
