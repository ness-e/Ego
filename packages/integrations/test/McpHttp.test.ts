import { describe, it, expect, vi, afterEach } from "vitest";
import { McpClient } from "../src/mcp/McpClient.js";
import { assertSafeMcpHttpUrl } from "../src/mcp/types.js";

const baseConfig = {
  id: "remote-docs",
  name: "Remote Docs MCP",
  transport: "streamable-http" as const,
  command: "npx",
  url: "https://mcp.example.com/rpc",
};

function jsonResponse(body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("@ego/integrations — McpClient streamable-http (STAB-12)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("1. assertSafeMcpHttpUrl acepta https pública sin credenciales", () => {
    const url = assertSafeMcpHttpUrl({ ...baseConfig });
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("mcp.example.com");
  });

  it("2. SSRF fail-closed: bloquea localhost, 127.0.0.1, 169.254.169.254, http y credenciales", () => {
    const bad = [
      "http://mcp.example.com/rpc",
      "https://localhost:3000/rpc",
      "https://127.0.0.1/rpc",
      "https://169.254.169.254/latest/meta-data/",
      "https://10.0.0.5/rpc",
      "https://192.168.1.10/rpc",
      "https://user:pass@mcp.example.com/rpc",
      "not-a-url",
      "",
    ];
    for (const url of bad) {
      expect(() => assertSafeMcpHttpUrl({ ...baseConfig, url }), url).toThrow(/\[McpHttp\]/);
    }
  });

  it("3. bloquea header authorization en config (secreto → env/vault)", () => {
    expect(() =>
      assertSafeMcpHttpUrl({ ...baseConfig, headers: { Authorization: "Bearer x" } })
    ).toThrow(/authorization/i);
    expect(() =>
      assertSafeMcpHttpUrl({ ...baseConfig, headers: { "X-Api-Key": "publico" } })
    ).not.toThrow();
  });

  it("4. connect() http hace handshake initialize + tools/list sin spawn", async () => {
    const seen: Request[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string, init?: RequestInit) => {
        seen.push(new Request(input, init));
        const body = JSON.parse(String(init?.body)) as { method: string };
        if (body.method === "initialize") {
          return jsonResponse(
            {
              jsonrpc: "2.0",
              id: body.id,
              result: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                serverInfo: { name: "remote-docs", version: "2.0.0" },
              },
            },
            { "mcp-session-id": "sess_abc" }
          );
        }
        return jsonResponse({
          jsonrpc: "2.0",
          id: body.id,
          result: { tools: [{ name: "search", inputSchema: { type: "object" } }] },
        });
      })
    );
    const client = new McpClient({ ...baseConfig });
    try {
      await client.connect();
      expect(client.getStatus()).toBe("connected");
      expect(client.getServerInfo()?.name).toBe("remote-docs");
      expect(client.getCachedTools().map((t) => t.name)).toEqual(["search"]);
      // redirect:error anti-SSRF + session id propagada en la 2ª llamada
      expect(seen.length).toBeGreaterThanOrEqual(2);
      expect(seen[1].headers.get("mcp-session-id")).toBe("sess_abc");
    } finally {
      await client.disconnect();
    }
    const fetchMock = fetch as unknown as { mock: { calls: unknown[][] } };
    for (const call of fetchMock.mock.calls) {
      expect((call[1] as RequestInit).redirect).toBe("error");
    }
  });

  it("5. callTool http envía tools/call y retorna isError sin lanzar (lo lanza el registry)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { method: string; id: number };
        if (body.method === "initialize") {
          return jsonResponse({
            jsonrpc: "2.0",
            id: body.id,
            result: {
              protocolVersion: "2024-11-05",
              capabilities: {},
              serverInfo: { name: "remote-docs" },
            },
          });
        }
        if (body.method === "tools/list") {
          return jsonResponse({ jsonrpc: "2.0", id: body.id, result: { tools: [] } });
        }
        return jsonResponse({
          jsonrpc: "2.0",
          id: body.id,
          result: { content: [{ type: "text", text: "boom" }], isError: true },
        });
      })
    );
    const client = new McpClient({ ...baseConfig });
    try {
      await client.connect();
      const res = await client.callTool("search", { q: "x" });
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toBe("boom");
    } finally {
      await client.disconnect();
    }
  });

  it("6. connect() http con URL bloqueada falla fail-closed sin red", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = new McpClient({ ...baseConfig, url: "https://169.254.169.254/x" });
    try {
      await expect(client.connect()).rejects.toThrow(/SSRF/);
      expect(client.getStatus()).toBe("error");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      await client.disconnect();
    }
  });

  it("7. respuesta SSE se rechaza (deuda D1 documentada)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("data: {}", { headers: { "content-type": "text/event-stream" } }))
    );
    const client = new McpClient({ ...baseConfig });
    try {
      await expect(client.connect()).rejects.toThrow(/SSE no soportada/);
    } finally {
      await client.disconnect();
    }
  });
});
