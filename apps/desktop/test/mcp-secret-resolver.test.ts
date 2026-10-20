/**
 * T1 (VERDICT R2) — Decisión D2: proxy de secretos MCP.
 *
 * RED primero. Antes de este trabajo:
 *  - `McpManager` construía el cliente SIN opciones (`new McpClient(config)`),
 *    así que `secretResolver` nunca llegaba → los marcadores `{{SECRET:<k>}}`
 *    viajaban sin resolver y el subproceso MCP recibía un marcador literal
 *    en vez del token. **La decisión D2 era inerte en producción.**
 *
 * El test arranca un servidor MCP REAL (subproceso `node`, comando en la
 * allowlist) y comprueba las tres propiedades de D2:
 *  (a) el `env` del subproceso NO contiene el valor real del secreto,
 *  (b) el subproceso recibe el MARCADOR (`{{SECRET:<k>}}`),
 *  (c) el cliente resuelve el marcador en el PUNTO DE USO (la petición
 *      saliente) y el servidor recibe el valor correcto.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { McpClient, McpManager, type McpServerConfig } from "@ego/integrations";
import { createCredentialSecretResolver } from "../src/main/mcp/secret-resolver.js";

/** Servidor MCP de prueba: habla JSON-RPC por stdio y expone 2 tools. */
const SERVER_SCRIPT = `
// Servidor MCP mínimo para la prueba de D2.
const SECRET_ENV = process.env.EGO_SECRET_TEST_TOKEN ?? "";

function send(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\\n");
}
function notify(method, params) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\\n");
}

let buffer = "";
process.stdin.on("data", (chunk) => {
  buffer += chunk.toString();
  let idx;
  while ((idx = buffer.indexOf("\\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.method === "initialize") {
      send(msg.id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "d2-fixture", version: "1.0.0" },
      });
    } else if (msg.method === "tools/list") {
      send(msg.id, {
        tools: [
          {
            name: "read_secret_env",
            description: "Devuelve el valor de una variable de entorno del subproceso",
            inputSchema: { type: "object", properties: { name: { type: "string" } } },
          },
          {
            name: "echo",
            description: "Devuelve sus argumentos tal cual",
            inputSchema: { type: "object", properties: { value: { type: "string" } } },
          },
        ],
      });
    } else if (msg.method === "tools/call") {
      const name = msg.params?.name;
      const args = msg.params?.arguments ?? {};
      if (name === "read_secret_env") {
        send(msg.id, {
          content: [{ type: "text", text: String(process.env[args.name] ?? "") }],
        });
      } else if (name === "echo") {
        send(msg.id, {
          content: [{ type: "text", text: String(args.value ?? "") }],
        });
      } else {
        send(msg.id, { content: [{ type: "text", text: "unknown" }], isError: true });
      }
    } else if (msg.method === "notifications/initialized") {
      // no-op
    } else if (msg.id !== undefined) {
      send(msg.id, {});
    }
  }
});
process.stdout.write("");
void SECRET_ENV;
void notify;
`;

/** Extractor del texto de un resultado `tools/call` MCP. */
function textOf(result: unknown): string {
  const r = result as { content?: Array<{ type: string; text?: string }> };
  return r.content?.[0]?.text ?? "";
}

describe("T1 (R2): D2 — el secretResolver se inyecta y resuelve en el punto de uso", () => {
  let dir: string;
  let script: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ego-d2-"));
    script = join(dir, "mcp-fixture.mjs");
    writeFileSync(script, SERVER_SCRIPT, "utf8");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const config = (): McpServerConfig => ({
    id: "d2-fixture",
    name: "D2 fixture",
    transport: "stdio",
    command: "node",
    args: [script],
    // El secreto declarado: el cliente NUNCA debe poner el valor real aquí.
    // La env del subproceso recibirá `EGO_SECRET_TEST_TOKEN={{SECRET:d2svc:d2acct}}`.
    secrets: { TEST_TOKEN: "d2svc:d2acct" },
    env: { TEST_TOKEN: "VALOR_REAL_EN_CLAVE" },
  });

  it("(a)+(b) el subproceso recibe el MARCADOR y NUNCA el valor real", async () => {
    const resolver = createCredentialSecretResolver({
      getSecret: async (service: string, account: string) =>
        service === "d2svc" && account === "d2acct" ? "VALOR_REAL_EN_CLAVE" : null,
    } as never);

    const client = new McpClient(config(), { secretResolver: resolver });
    await client.connect();

    const read = await client.callTool("read_secret_env", { name: "TEST_TOKEN" });
    const seenBySubprocess = textOf(read);

    // (b) el marcador llega al subproceso (env con el prefijo D2)…
    expect(seenBySubprocess).toContain("{{SECRET:d2svc:d2acct}}");
    // (a) …y el valor real NO viaja en el env del subproceso.
    expect(seenBySubprocess).not.toContain("VALOR_REAL_EN_CLAVE");

    await client.disconnect();
  });

  it("(c) el cliente resuelve el marcador en la petición saliente", async () => {
    const resolver = createCredentialSecretResolver({
      getSecret: async (service: string, account: string) =>
        service === "d2svc" && account === "d2acct" ? "VALOR_REAL_EN_CLAVE" : null,
    } as never);

    const client = new McpClient(config(), { secretResolver: resolver });
    await client.connect();

    // El marcador va embebido en los ARGUMENTOS de la tool: es el punto de
    // uso, no el env. El cliente lo resuelve antes de enviarlo.
    const echoed = await client.callTool("echo", {
      value: "token={{SECRET:d2svc:d2acct}}",
    });

    expect(textOf(echoed)).toBe("token=VALOR_REAL_EN_CLAVE");
    expect(textOf(echoed)).not.toContain("{{SECRET:");

    await client.disconnect();
  });

  it("el McpManager propaga el secretResolver al cliente que crea", async () => {
    const resolver = createCredentialSecretResolver({
      getSecret: async (service: string, account: string) =>
        service === "d2svc" && account === "d2acct" ? "VALOR_REAL_EN_CLAVE" : null,
    } as never);

    const manager = new McpManager(undefined, { secretResolver: resolver });
    const state = await manager.registerServer(config(), true);
    expect(state.ok, `conexión fallida: ${state.lastError ?? ""}`).toBe(true);

    const client = manager.getClient("d2-fixture");
    expect(client).toBeDefined();

    const read = await client!.callTool("read_secret_env", { name: "TEST_TOKEN" });
    expect(textOf(read)).toContain("{{SECRET:d2svc:d2acct}}");

    const echoed = await client!.callTool("echo", { value: "{{SECRET:d2svc:d2acct}}" });
    expect(textOf(echoed)).toBe("VALOR_REAL_EN_CLAVE");

    await manager.dispose();
  });

  it("fail-closed: sin secreto conocido, el marcador viaja intacto", async () => {
    const resolver = createCredentialSecretResolver({
      getSecret: async () => null,
    } as never);

    const client = new McpClient(config(), { secretResolver: resolver });
    await client.connect();

    const echoed = await client.callTool("echo", { value: "{{SECRET:desconocido:noexiste}}" });
    // Fail-closed: nunca se envía un valor vacío o inventado.
    expect(textOf(echoed)).toBe("{{SECRET:desconocido:noexiste}}");

    await client.disconnect();
  });
});
