/**
 * T4 (Ola 1c) — Ciclo de vida del `EgoMcpServer`: cerrar es cerrar de verdad.
 *
 * RED primero. Antes de este trabajo:
 *  - el servidor se cerraba (el puerto se liberaba) pero **el token bearer
 *    seguía en el keychain**: el siguiente arranque lo reutilizaba, así que
 *    un token que el usuario creía revocado seguía siendo válido para
 *    cualquier cliente externo que lo hubiera cacheado;
 *  - el `McpManager` (y con él el `secretResolver`, que captura el
 *    `CredentialManager` del keychain) no se liberaba en el apagado: las
 *    referencias a credenciales sobrevivían al cierre de la app.
 *
 * Lo que se verifica:
 *  1. arrancar → usar → cerrar → **el puerto ya no acepta conexiones**;
 *  2. al cerrar, **el token se revoca** (desaparece del almacén);
 *  3. el siguiente arranque genera un token **distinto** (el revocado no
 *     se reutiliza);
 *  4. al cerrar, el servidor **no retiene** el token en memoria.
 */
import { describe, it, expect } from "vitest";
import { ToolRegistry } from "@ego/tools";
import { z } from "zod";
import {
  startEgoMcpServer,
  MCP_SERVER_TOKEN_SERVICE,
  MCP_SERVER_TOKEN_ACCOUNT,
  type McpTokenVault,
} from "../src/main/mcp/mcp-server-runtime.js";

/** Vault en memoria (doble del keychain del SO). */
class FakeVault implements McpTokenVault {
  readonly store = new Map<string, string>();
  async getSecret(service: string, account: string): Promise<string | null> {
    return this.store.get(`${service}/${account}`) ?? null;
  }
  async storeSecret(service: string, account: string, secret: string): Promise<void> {
    this.store.set(`${service}/${account}`, secret);
  }
  async deleteSecret(service: string, account: string): Promise<void> {
    this.store.delete(`${service}/${account}`);
  }
  get token(): string | undefined {
    return this.store.get(`${MCP_SERVER_TOKEN_SERVICE}/${MCP_SERVER_TOKEN_ACCOUNT}`);
  }
}

function registry(): ToolRegistry {
  const r = new ToolRegistry();
  r.register({
    name: "leer_memoria",
    description: "Lee una clave de memoria",
    category: "memory",
    riskLevel: "safe",
    inputSchema: z.object({ key: z.string() }),
    origin: "native",
    execute: async (input: { key: string }) => `valor:${input.key}`,
  });
  return r;
}

/** ¿Sigue escuchando el puerto? */
async function puertoVivo(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    return res.status > 0;
  } catch {
    return false;
  }
}

describe("T4: ciclo de vida del servidor MCP de Ego", () => {
  it("arrancar → usar → cerrar: el puerto deja de aceptar conexiones", async () => {
    const vault = new FakeVault();
    const handle = await startEgoMcpServer({
      toolRegistry: registry(),
      credentialStore: vault,
      approvalGate: async () => true,
    });

    // 1. Con token, el catálogo real responde.
    const token = vault.token!;
    const ok = await fetch(handle.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(ok.status).toBe(200);

    // 2. Al cerrar, el puerto muere.
    await handle.close();
    expect(await puertoVivo(handle.url)).toBe(false);
  });

  it("al cerrar, el token bearer se REVOCA (desaparece del almacén)", async () => {
    const vault = new FakeVault();
    const handle = await startEgoMcpServer({
      toolRegistry: registry(),
      credentialStore: vault,
      approvalGate: async () => true,
    });
    expect(vault.token).toBeTruthy();

    await handle.close();

    expect(
      vault.token,
      "el token debe revocar al cerrar: si no, sigue siendo válido para un cliente que lo cacheó"
    ).toBeUndefined();
  });

  it("el token revocado NO se reutiliza: el siguiente arranque genera otro", async () => {
    const vault = new FakeVault();
    const first = await startEgoMcpServer({
      toolRegistry: registry(),
      credentialStore: vault,
      approvalGate: async () => true,
    });
    const firstToken = vault.token!;
    await first.close();

    const second = await startEgoMcpServer({
      toolRegistry: registry(),
      credentialStore: vault,
      approvalGate: async () => true,
    });
    expect(vault.token).toBeTruthy();
    expect(vault.token).not.toBe(firstToken);
    await second.close();
  });

  it("el token antiguo deja de servir tras el cierre y el reinicio", async () => {
    const vault = new FakeVault();
    const first = await startEgoMcpServer({
      toolRegistry: registry(),
      credentialStore: vault,
      approvalGate: async () => true,
    });
    const oldToken = vault.token!;
    const url = first.url;
    await first.close();

    const second = await startEgoMcpServer({
      toolRegistry: registry(),
      credentialStore: vault,
      approvalGate: async () => true,
    });
    const res = await fetch(second.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${oldToken}`,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.status, "el token revocado no debe autenticar").toBe(401);
    await second.close();
    void url;
  });

  it("cerrar dos veces no lanza (idempotente)", async () => {
    const vault = new FakeVault();
    const handle = await startEgoMcpServer({
      toolRegistry: registry(),
      credentialStore: vault,
      approvalGate: async () => true,
    });
    await handle.close();
    await expect(handle.close()).resolves.toBeUndefined();
  });
});
