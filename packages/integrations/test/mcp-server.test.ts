import { describe, it, expect, beforeEach } from "vitest";
import { ToolRegistry, registerNativeTools } from "@ego/tools";
import { EgoMcpServer } from "../src/index.js";

/**
 * EGO-FIND-46 (Ola 1 / A3 / T4) — MCP Server de Ego.
 *
 * AGENTS.md §7: "Ego = MCP Client + MCP Server". Hoy solo existía el cliente:
 * 0 handlers `tools/list`, `resources/list`, `prompts/list` propios.
 */

function makeRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registerNativeTools(registry, { workspacePath: process.cwd(), enableCanvas: true });
  return registry;
}

describe("T4 — MCP Server de Ego (EGO-FIND-46)", () => {
  let server: EgoMcpServer;
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = makeRegistry();
    server = new EgoMcpServer({ toolRegistry: registry });
  });

  it("`initialize` declara capacidades de tools, resources y prompts", async () => {
    const res = await server.handleRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "1" } },
    });

    expect(res.error).toBeUndefined();
    const result = res.result as { serverInfo: { name: string }; capabilities: Record<string, unknown> };
    expect(result.serverInfo.name).toBe("ego");
    expect(result.capabilities.tools).toBeDefined();
    expect(result.capabilities.resources).toBeDefined();
    expect(result.capabilities.prompts).toBeDefined();
  });

  it("`tools/list` expone el catálogo real de tools con JSON Schema", async () => {
    const res = await server.handleRequest({ jsonrpc: "2.0", id: 2, method: "tools/list" });

    const result = res.result as {
      tools: Array<{ name: string; description: string; inputSchema: { type: string } }>;
    };
    const names = result.tools.map((t) => t.name);

    // Las 6 tools reales registradas por registerNativeTools.
    expect(names).toContain("fs_read_file");
    expect(names).toContain("fs_write_file");
    expect(names).toContain("git_status");
    expect(names).toContain("git_diff");
    expect(names).toContain("terminal_exec");
    expect(names).toContain("canvas_render");

    const readTool = result.tools.find((t) => t.name === "fs_read_file");
    expect(readTool?.inputSchema.type).toBe("object");
  });

  it("`tools/call` ejecuta la tool y devuelve el contenido", async () => {
    const res = await server.handleRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "fs_read_file", arguments: { path: "package.json" } },
    });

    expect(res.error).toBeUndefined();
    const result = res.result as { content: Array<{ type: string; text: string }>; isError?: boolean };
    expect(result.isError).toBeFalsy();
    expect(result.content[0]?.type).toBe("text");
    expect(result.content[0]?.text).toContain("name");
  });

  it("`tools/call` sobre una tool inexistente devuelve error JSON-RPC", async () => {
    const res = await server.handleRequest({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "no_existe", arguments: {} },
    });

    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe(-32602);
  });

  it("`tools/call` RECHAZA tools que requieren aprobación si no hay gate configurado", async () => {
    const res = await server.handleRequest({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "terminal_exec", arguments: { command: "git status" } },
    });

    // Sin `approvalGate`, el servidor MCP (ingress externo) no puede ejecutar
    // tools sensibles: fail-closed.
    expect(res.error).toBeDefined();
    expect(res.error!.message).toMatch(/aprobaci/i);
  });

  it("`tools/call` ejecuta la tool sensible si el gate aprueba", async () => {
    const gated = new EgoMcpServer({
      toolRegistry: registry,
      approvalGate: async () => true,
    });

    const res = await gated.handleRequest({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "git_status", arguments: {} },
    });

    expect(res.error).toBeUndefined();
  });

  it("`resources/list` lista recursos del PayloadRegistry y namespaces de memoria", async () => {
    const withResources = new EgoMcpServer({
      toolRegistry: registry,
      payloadRegistry: {
        list: () => [
          { uri: "payload://pref_abc", name: "payload pref_abc", description: "diff", mimeType: "text/plain" },
        ],
        read: (uri: string) => (uri === "payload://pref_abc" ? { text: "contenido", mimeType: "text/plain" } : undefined),
      },
      memoryAdapter: {
        listNamespaces: async () => ["kb/facts", "gov/audit"],
        readNamespace: async () => [],
      },
    });

    const res = await withResources.handleRequest({ jsonrpc: "2.0", id: 7, method: "resources/list" });
    const result = res.result as { resources: Array<{ uri: string }> };
    const uris = result.resources.map((r) => r.uri);

    expect(uris).toContain("payload://pref_abc");
    expect(uris).toContain("memory://kb/facts");
    expect(uris).toContain("memory://gov/audit");
  });

  it("`resources/read` devuelve el contenido de un recurso", async () => {
    const withResources = new EgoMcpServer({
      toolRegistry: registry,
      payloadRegistry: {
        list: () => [],
        read: (uri: string) => (uri === "payload://x" ? { text: "hola", mimeType: "text/plain" } : undefined),
      },
    });

    const res = await withResources.handleRequest({
      jsonrpc: "2.0",
      id: 8,
      method: "resources/read",
      params: { uri: "payload://x" },
    });

    const result = res.result as { contents: Array<{ uri: string; text: string }> };
    expect(result.contents[0]?.text).toBe("hola");
  });

  it("`prompts/list` expone los manifiestos de Sub-Ego como prompts", async () => {
    const withPrompts = new EgoMcpServer({
      toolRegistry: registry,
      subEgoRegistry: {
        list: async () => [
          {
            id: "ego.dev",
            name: "Desarrollador",
            description: "Especialista en código",
            instructions: "Escribe código testeado.",
          },
        ],
      },
    });

    const res = await withPrompts.handleRequest({ jsonrpc: "2.0", id: 9, method: "prompts/list" });
    const result = res.result as { prompts: Array<{ name: string; description: string }> };

    expect(result.prompts.map((p) => p.name)).toContain("ego.dev");
    expect(result.prompts[0]?.description).toBe("Especialista en código");
  });

  it("`prompts/get` devuelve los mensajes del prompt", async () => {
    const withPrompts = new EgoMcpServer({
      toolRegistry: registry,
      subEgoRegistry: {
        list: async () => [
          { id: "ego.dev", name: "Desarrollador", description: "d", instructions: "Escribe código testeado." },
        ],
      },
    });

    const res = await withPrompts.handleRequest({
      jsonrpc: "2.0",
      id: 10,
      method: "prompts/get",
      params: { name: "ego.dev" },
    });

    const result = res.result as {
      description: string;
      messages: Array<{ role: string; content: { type: string; text: string } }>;
    };
    expect(result.messages[0]?.content.text).toContain("Escribe código testeado.");
  });

  it("un método desconocido devuelve error JSON-RPC -32601", async () => {
    const res = await server.handleRequest({ jsonrpc: "2.0", id: 11, method: "no/existe" });
    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe(-32601);
  });
});
