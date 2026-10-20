/**
 * T2 (VERDICT R1) — Arranque real del `EgoMcpServer` desde el main.
 *
 * RED primero. Antes de este trabajo, `EgoMcpServer` tenía **0
 * instanciaciones en `src/`**: el servidor MCP de Ego no existía en
 * producción.
 *
 * Lo que se verifica:
 *  - el token bearer se genera y se PERSISTE cifrado en el almacén de
 *    credenciales (nunca en claro, nunca en el renderer),
 *  - el servidor arranca en loopback y responde,
 *  - el gate HITL fail-closed se respeta (tool destructiva sin aprobación
 *    → rechazada),
 *  - el token NO aparece en la URL ni en el handle expuesto.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { ToolRegistry } from "@ego/tools";
import { z } from "zod";
import { startEgoMcpServer } from "../src/main/mcp/mcp-server-runtime.js";

/** Almacén de credenciales en memoria (doble del keychain del SO). */
class FakeVault {
  readonly store = new Map<string, string>();
  async getSecret(service: string, account: string): Promise<string | null> {
    return this.store.get(`${service}/${account}`) ?? null;
  }
  async storeSecret(service: string, account: string, secret: string): Promise<void> {
    this.store.set(`${service}/${account}`, secret);
  }
}

function buildRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register({
    name: "leer_memoria",
    description: "Lee una clave de memoria",
    category: "memory",
    riskLevel: "safe",
    inputSchema: z.object({ key: z.string() }),
    origin: "native",
    execute: async (input: { key: string }) => `valor:${input.key}`,
  });
  registry.register({
    name: "borrar_archivo",
    description: "Borra un archivo",
    category: "filesystem",
    riskLevel: "destructive",
    requiresApproval: true,
    inputSchema: z.object({ path: z.string() }),
    origin: "native",
    execute: async () => "borrado",
  });
  return registry;
}

describe("T2 (R1): arranque del EgoMcpServer desde el main", () => {
  let vault: FakeVault;

  beforeEach(() => {
    vault = new FakeVault();
  });

  it("persiste un token bearer cifrado y arranca en loopback", async () => {
    const handle = await startEgoMcpServer({
      toolRegistry: buildRegistry(),
      credentialStore: vault,
      approvalGate: async () => true,
    });
    expect(handle).not.toBeNull();
    expect(handle!.host).toBe("127.0.0.1");
    expect(handle!.url.startsWith("http://127.0.0.1:")).toBe(true);
    // El token está en el almacén de credenciales (keychain), no en la URL.
    expect(handle!.url).not.toContain("token");
    const persisted = vault.store.get("mcp/ego-mcp-server");
    expect(typeof persisted).toBe("string");
    expect((persisted ?? "").length).toBeGreaterThanOrEqual(32);
    await handle!.close();
  });

  it("reutiliza el token persistido entre arranques (el cliente puede cachearlo)", async () => {
    const first = await startEgoMcpServer({
      toolRegistry: buildRegistry(),
      credentialStore: vault,
      approvalGate: async () => true,
    });
    const firstToken = vault.store.get("mcp/ego-mcp-server");
    await first!.close();

    const second = await startEgoMcpServer({
      toolRegistry: buildRegistry(),
      credentialStore: vault,
      approvalGate: async () => true,
    });
    expect(vault.store.get("mcp/ego-mcp-server")).toBe(firstToken);
    await second!.close();
  });

  it("el catálogo expuesto es el REAL (tools/list del ToolRegistry)", async () => {
    const handle = await startEgoMcpServer({
      toolRegistry: buildRegistry(),
      credentialStore: vault,
      approvalGate: async () => true,
    });
    const token = vault.store.get("mcp/ego-mcp-server")!;
    const res = await fetch(handle!.url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: { tools: Array<{ name: string }> } };
    expect(body.result.tools.map((t) => t.name).sort()).toEqual([
      "borrar_archivo",
      "leer_memoria",
    ]);
    await handle!.close();
  });

  it("el gate HITL fail-closed bloquea la tool destructiva", async () => {
    const handle = await startEgoMcpServer({
      toolRegistry: buildRegistry(),
      credentialStore: vault,
      approvalGate: async () => false,
    });
    const token = vault.store.get("mcp/ego-mcp-server")!;
    const res = await fetch(handle!.url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "borrar_archivo", arguments: { path: "/tmp/x" } },
      }),
    });
    const body = (await res.json()) as { error?: { message: string } };
    expect(body.error).toBeDefined();
    expect(body.error?.message).toMatch(/aprobaci/i);
    await handle!.close();
  });

  it("sin token → 401 (el servidor no es un puerto abierto)", async () => {
    const handle = await startEgoMcpServer({
      toolRegistry: buildRegistry(),
      credentialStore: vault,
      approvalGate: async () => true,
    });
    const res = await fetch(handle!.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.status).toBe(401);
    await handle!.close();
  });
});
