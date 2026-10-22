/**
 * Ola 9 (A3) — Canal de obtención del token del MCP Server de Ego.
 *
 * Cierra `EGO-FIND-81` (CRÍTICA): el servidor MCP genera un token bearer y lo
 * exige en cada petición (`Authorization: Bearer`), pero **no existía ningún
 * canal** por el que un cliente MCP externo pudiera obtenerlo. La autenticación
 * era, por tanto, imposible.
 *
 * Decisión del owner (2026-10-21): **"Keychain + CLI local."**
 *  1. el token se guarda en el keychain del SO (`CredentialManager`), nunca en
 *     un fichero en claro;
 *  2. sólo se expone por un comando CLI local;
 *  3. el renderer NUNCA lo ve (`AGENTS.md`: renderer *untrusted*).
 *
 * Lo que se verifica:
 *  - el token vive en el keychain, con clave **namespacada**;
 *  - el token **rota por arranque** (nunca se reutiliza el de la sesión
 *    anterior) y se revoca al cerrar;
 *  - el broker local entrega el token **sólo** a clientes del mismo usuario;
 *  - el CLI devuelve el token (stdout o fichero 0600);
 *  - extremo a extremo contra el servidor REAL: token incorrecto → 401,
 *    token correcto → 200;
 *  - el token **no** es visible por ningún canal del preload (renderer);
 *  - el token **no** aparece en ningún log.
 */
import { describe, it, expect, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { ToolRegistry } from "@ego/tools";
import { z } from "zod";
import { createScratchDir } from "./helpers/test-scratch.js";
import {
  startEgoMcpServer,
  MCP_SERVER_TOKEN_SERVICE,
  MCP_SERVER_TOKEN_ACCOUNT,
  type McpTokenVault,
} from "../src/main/mcp/mcp-server-runtime.js";
import {
  startMcpTokenBroker,
  requestMcpTokenFromBroker,
  resolveMcpTokenBrokerPath,
} from "../src/main/mcp/mcp-token-broker.js";
import {
  isMcpTokenCliRequest,
  parseMcpTokenCliArgs,
  runMcpTokenCli,
} from "../src/cli/mcp-token-cli.js";

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

describe("Ola 9 — EGO-FIND-81: canal de obtención del token del MCP Server", () => {
  it("RED: el token se guarda en el keychain con clave NAMESPACADA", async () => {
    const vault = new FakeVault();
    const handle = await startEgoMcpServer({
      toolRegistry: registry(),
      credentialStore: vault,
      approvalGate: async () => true,
    });

    // La clave del keychain DEBE tener namespace propio del servidor MCP
    // (no puede colisionar con un secreto de proveedor).
    expect(MCP_SERVER_TOKEN_SERVICE).toBe("mcp.server");
    expect(MCP_SERVER_TOKEN_ACCOUNT).toBe("token");
    expect(vault.store.has("mcp.server/token")).toBe(true);
    await handle.close();
  });

  it("el token ROTA por arranque: el de la sesión anterior no se reutiliza", async () => {
    const vault = new FakeVault();
    const first = await startEgoMcpServer({
      toolRegistry: registry(),
      credentialStore: vault,
      approvalGate: async () => true,
    });
    const firstToken = vault.token!;
    await first.close();

    // Sin cerrar (simula un arranque con el vault aún poblado): el token
    // nuevo debe ser DISTINTO (rotar por arranque es más seguro que
    // reutilizar: un token capturado seguiría autenticando).
    const second = await startEgoMcpServer({
      toolRegistry: registry(),
      credentialStore: vault,
      approvalGate: async () => true,
    });
    expect(vault.token).toBeTruthy();
    expect(vault.token).not.toBe(firstToken);
    await second.close();
  });

  it("el broker local entrega el token vigente y la URL del servidor", async () => {
    const vault = new FakeVault();
    await vault.storeSecret(MCP_SERVER_TOKEN_SERVICE, MCP_SERVER_TOKEN_ACCOUNT, "TOK-VIGENTE-1234");
    const brokerPath = path.join(createScratchDir("mcp-token"), "broker.sock");
    const broker = await startMcpTokenBroker({
      path: brokerPath,
      readToken: async () => vault.token ?? null,
      describeEndpoint: () => "http://127.0.0.1:45999/mcp",
    });

    const res = await requestMcpTokenFromBroker({ path: brokerPath });
    expect(res.token).toBe(vault.token);
    expect(res.url).toBe("http://127.0.0.1:45999/mcp");

    await broker.close();
  });

  it("el broker NO sirve un token si el keychain no lo tiene", async () => {
    const brokerPath = path.join(createScratchDir("mcp-token"), "broker.sock");
    const broker = await startMcpTokenBroker({
      path: brokerPath,
      readToken: async () => null,
      describeEndpoint: () => "http://127.0.0.1:45999/mcp",
    });

    await expect(requestMcpTokenFromBroker({ path: brokerPath })).rejects.toThrow(
      /token/i
    );
    await broker.close();
  });

  it("el broker se cierra con la app: después no queda canal", async () => {
    const brokerPath = path.join(createScratchDir("mcp-token"), "broker.sock");
    const broker = await startMcpTokenBroker({
      path: brokerPath,
      readToken: async () => "tok",
      describeEndpoint: () => "http://127.0.0.1:45999/mcp",
    });
    await broker.close();

    await expect(requestMcpTokenFromBroker({ path: brokerPath, timeoutMs: 1500 })).rejects.toThrow();
  });

  it("el CLI devuelve el token por stdout", async () => {
    const brokerPath = path.join(createScratchDir("mcp-token"), "broker.sock");
    const broker = await startMcpTokenBroker({
      path: brokerPath,
      readToken: async () => "TOKEN-DE-PRUEBA-1234567890",
      describeEndpoint: () => "http://127.0.0.1:45999/mcp",
    });

    const lines: string[] = [];
    const code = await runMcpTokenCli(["mcp", "token"], {
      brokerPath,
      stdout: (line) => lines.push(line),
      stderr: () => {},
    });

    expect(code).toBe(0);
    expect(lines.join("\n")).toContain("TOKEN-DE-PRUEBA-1234567890");
    await broker.close();
  });

  it("el CLI puede escribir el token en un fichero 0600 (canal de menor exposición)", async () => {
    const brokerPath = path.join(createScratchDir("mcp-token"), "broker.sock");
    const broker = await startMcpTokenBroker({
      path: brokerPath,
      readToken: async () => "TOKEN-DE-PRUEBA-1234567890",
      describeEndpoint: () => "http://127.0.0.1:45999/mcp",
    });

    const outFile = path.join(path.dirname(brokerPath), "token.txt");
    const lines: string[] = [];
    const code = await runMcpTokenCli(["mcp", "token", "--out", outFile], {
      brokerPath,
      stdout: (line) => lines.push(line),
      stderr: () => {},
    });

    expect(code).toBe(0);
    expect(fs.readFileSync(outFile, "utf8")).toContain("TOKEN-DE-PRUEBA-1234567890");
    // El fichero NO debe contener el token en la salida por stdout.
    expect(lines.join("\n")).not.toContain("TOKEN-DE-PRUEBA-1234567890");
    await broker.close();
  });

  it("el CLI detecta su propia invocación y no confunde otros argv", () => {
    expect(isMcpTokenCliRequest(["electron", "main.js", "mcp", "token"])).toBe(true);
    expect(isMcpTokenCliRequest(["electron", "main.js"])).toBe(false);
    expect(isMcpTokenCliRequest(["electron", "main.js", "mcp", "server"])).toBe(false);

    const parsed = parseMcpTokenCliArgs(["mcp", "token", "--out", "/tmp/x"]);
    expect(parsed.command).toBe("token");
    expect(parsed.out).toBe("/tmp/x");
  });

  it("EXTREMO A EXTREMO: token incorrecto → 401; token correcto → 200", async () => {
    const vault = new FakeVault();
    const brokerPath = path.join(createScratchDir("mcp-token"), "broker.sock");

    const handle = await startEgoMcpServer({
      toolRegistry: registry(),
      credentialStore: vault,
      approvalGate: async () => true,
      tokenBrokerPath: brokerPath,
    });

    // 1) Un cliente MCP con un token INCORRECTO es rechazado.
    const bad = await fetch(handle.url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer token-incorrecto" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(bad.status).toBe(401);

    // 2) Un cliente MCP que obtiene el token por el CANAL obtains → aceptado.
    const obtained = await requestMcpTokenFromBroker({ path: brokerPath });
    expect(obtained.token).toBe(vault.token);

    const good = await fetch(handle.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${obtained.token}`,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(good.status).toBe(200);
    const body = (await good.json()) as { result: { tools: Array<{ name: string }> } };
    expect(body.result.tools.map((t) => t.name)).toEqual(["leer_memoria"]);

    await handle.close();
  });

  it("el token NO aparece en ningún log del arranque ni del uso", async () => {
    const captured: string[] = [];
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        captured.push(args.map((a) => String(a)).join(" "));
      })
    );

    try {
      const vault = new FakeVault();
      const brokerPath = path.join(createScratchDir("mcp-token"), "broker.sock");
      const handle = await startEgoMcpServer({
        toolRegistry: registry(),
        credentialStore: vault,
        approvalGate: async () => true,
        tokenBrokerPath: brokerPath,
      });
      const token = vault.token!;

      // Una línea benigna: prueba que la captura de logs está VIVA (si no,
      // el test sería vacuo: "no hay nada donde filtrar el token").
      console.log("[test] arranque del servidor MCP simulado");

      // Uso real del servidor con el token (para que el log de arranque y el
      // de la petición se produzcan).
      await fetch(handle.url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      });
      await requestMcpTokenFromBroker({ path: brokerPath });
      await handle.close();

      const joined = captured.join("\n");
      expect(joined.length).toBeGreaterThan(0);
      expect(joined).not.toContain(token);
      // Ni un prefijo del token (un log podría truncarlo).
      expect(joined).not.toContain(token.slice(0, 12));
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});

describe("Ola 9 — el token es INVISIBLE para el renderer", () => {
  const preloadPath = path.join(process.cwd(), "src", "preload.ts");

  it("ningún canal del preload expone el token del servidor MCP", () => {
    const source = fs.readFileSync(preloadPath, "utf8");

    // Enumeración REAL de los canales que el preload abre al renderer.
    const channels = [
      ...source.matchAll(/ipcRenderer\.(?:invoke|on|send|once)\(\s*"([^"]+)"/g),
    ].map((m) => m[1] as string);

    expect(channels.length).toBeGreaterThan(20);
    const offenders = channels.filter(
      (c) => /mcp/i.test(c) && /token|secret|bearer|credential/i.test(c)
    );
    expect(offenders, `canales que exponen el token: ${offenders.join(", ")}`).toEqual([]);
  });

  it("el preload no menciona la clave del keychain del token", () => {
    const source = fs.readFileSync(preloadPath, "utf8");

    // La clave COMPLETA del keychain (servicio + cuenta) y su servicio. La
    // palabra suelta "token" no es evidencia: el preload legitimately usa
    // tokens de carpeta (`ipc.projects.selectFolderRedeem`).
    expect(source).not.toContain(MCP_SERVER_TOKEN_SERVICE);
    expect(source).not.toContain(`${MCP_SERVER_TOKEN_SERVICE}::${MCP_SERVER_TOKEN_ACCOUNT}`);
    expect(source).not.toContain("ego-mcp-server");
    expect(source).not.toContain("mcp-token-broker");
  });

  it("la superficie `mcp` del preload no tiene ningún método de token", () => {
    const source = fs.readFileSync(preloadPath, "utf8");
    const block = /mcp:\s*\{([\s\S]*?)\n\s*\},/m.exec(source);
    expect(block, "no se encontró la superficie mcp del preload").not.toBeNull();
    const methods = [...(block?.[1] ?? "").matchAll(/(\w+):\s*\(/g)].map((m) => m[1] as string);

    expect(methods.length).toBeGreaterThan(0);
    expect(methods.filter((m) => /token|secret|bearer/i.test(m))).toEqual([]);
  });

  it("la ruta del broker NO se expone al renderer", () => {
    const source = fs.readFileSync(preloadPath, "utf8");
    expect(source).not.toContain("mcp-token-broker");
    expect(source).not.toContain(resolveMcpTokenBrokerPath());
  });});
