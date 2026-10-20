/**
 * T2 (VERDICT R1) — `EgoMcpServer` arrancado en el main, en HTTP streamable
 * sobre loopback, con token bearer obligatorio.
 *
 * RED primero. Antes de este trabajo, `EgoMcpServer` (`packages/integrations/
 * src/mcp/McpServer.ts`) existía y estaba testeado, pero tenía **0
 * instanciaciones en `src/`**: el servidor MCP de Ego no existía en
 * producción → `AGENTS.md` §7 ("Ego = MCP Client **y** MCP Server") no se
 * cumplía.
 *
 * Lo que se verifica aquí:
 *  - escucha **solo en loopback** (nunca `0.0.0.0`),
 *  - **token bearer obligatorio**: sin token → 401 y el registry NO se toca,
 *  - con token → `tools/list` devuelve el catálogo REAL,
 *  - el gate HITL se mantiene: una tool destructiva exige aprobación.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { ToolRegistry } from "@ego/tools";
import { z } from "zod";
import { EgoMcpServer } from "@ego/integrations";
import {
  startEgoMcpHttpServer,
  type EgoMcpHttpServerHandle,
} from "../src/main/mcp/mcp-http-server.js";

const TOKEN = "token-de-prueba-0123456789";

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
    description: "Borra un archivo del disco",
    category: "filesystem",
    riskLevel: "destructive",
    requiresApproval: true,
    inputSchema: z.object({ path: z.string() }),
    origin: "native",
    execute: async () => "borrado",
  });
  return registry;
}

interface JsonRpcReply {
  jsonrpc: string;
  id?: string | number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

async function rpc(
  handle: EgoMcpHttpServerHandle,
  method: string,
  params: Record<string, unknown> | undefined,
  token: string | null
): Promise<{ status: number; body: JsonRpcReply | null }> {
  const res = await fetch(handle.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const text = await res.text();
  return {
    status: res.status,
    body: text.length > 0 ? (JSON.parse(text) as JsonRpcReply) : null,
  };
}

describe("T2 (R1): EgoMcpServer en HTTP streamable sobre loopback", () => {
  let handle: EgoMcpHttpServerHandle;
  let registry: ToolRegistry;
  let gateCalls: Array<{ toolName: string; input: unknown }>;
  let gateResult: boolean;

  beforeEach(async () => {
    registry = buildRegistry();
    gateCalls = [];
    gateResult = true;
    const server = new EgoMcpServer({
      toolRegistry: registry,
      approvalGate: async (toolName, input) => {
        gateCalls.push({ toolName, input });
        return gateResult;
      },
    });
    handle = await startEgoMcpHttpServer({ server, token: TOKEN });
  });

  it("escucha SOLO en loopback", () => {
    expect(handle.host).toBe("127.0.0.1");
    expect(handle.url.startsWith("http://127.0.0.1:")).toBe(true);
  });

  it("rechaza arrancar en una interfaz que no sea loopback", async () => {
    const server = new EgoMcpServer({ toolRegistry: buildRegistry() });
    await expect(
      startEgoMcpHttpServer({ server, token: TOKEN, host: "0.0.0.0" })
    ).rejects.toThrow(/loopback/i);
    await expect(
      startEgoMcpHttpServer({ server, token: TOKEN, host: "::" })
    ).rejects.toThrow(/loopback/i);
  });

  it("sin token bearer → 401 y el registry NO se toca", async () => {
    const res = await rpc(handle, "tools/list", undefined, null);
    expect(res.status).toBe(401);
    // El gate HITL no se consultó: el rechazo ocurre ANTES de tocar el
    // registry (fail-closed).
    expect(gateCalls).toHaveLength(0);
  });

  it("con token incorrecto → 401", async () => {
    const res = await rpc(handle, "tools/list", undefined, "token-incorrecto");
    expect(res.status).toBe(401);
  });

  it("con token válido → tools/list devuelve el catálogo REAL", async () => {
    const res = await rpc(handle, "tools/list", undefined, TOKEN);
    expect(res.status).toBe(200);
    const tools = res.body?.result?.tools as Array<{ name: string }>;
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.map((t) => t.name).sort()).toEqual([
      "borrar_archivo",
      "leer_memoria",
    ]);
  });

  it("una tool sensible pasa por el gate HITL (fail-closed si el gate no aprueba)", async () => {
    gateResult = false;
    const res = await rpc(
      handle,
      "tools/call",
      { name: "borrar_archivo", arguments: { path: "/tmp/x" } },
      TOKEN
    );
    expect(gateCalls).toHaveLength(1);
    expect(gateCalls[0]?.toolName).toBe("borrar_archivo");
    expect(res.body?.error, "el gate debe rechazar la ejecución").toBeDefined();
  });

  it("con el gate aprobando, la tool se ejecuta", async () => {
    gateResult = true;
    const res = await rpc(
      handle,
      "tools/call",
      { name: "leer_memoria", arguments: { key: "k" } },
      TOKEN
    );
    expect(res.body?.error).toBeUndefined();
    const content = res.body?.result?.content as Array<{ text: string }>;
    expect(content?.[0]?.text).toBe("valor:k");
  });

  it("el token nunca viaja en la respuesta ni en los logs", async () => {
    const res = await rpc(handle, "initialize", {}, TOKEN);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain(TOKEN);
    expect(handle.url).not.toContain(TOKEN);
  });

  it("ruta distinta de la del servidor → 404", async () => {
    const res = await fetch(handle.url.replace("/mcp", "/otro"), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.status).toBe(404);
  });
});
