import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * EGO-FIND-33 / Decisión D2 (Ola 1 / A3 / T3) — proxy de secretos MCP.
 *
 * El subproceso MCP recibía el **token real** en su `env` (`{...process.env, ...env}`).
 * D2: el subproceso recibe un MARCADOR `EGO_SECRET_<NOMBRE>={{SECRET:<clave>}}`
 * y el cliente MCP (en main, con keychain) resuelve el marcador. El servidor
 * MCP nunca ve el token.
 */

const spawnCalls: Array<{ command: string; args: string[]; env: Record<string, string> }> = [];

vi.mock("node:child_process", () => ({
  spawn: (command: string, args: string[], options: { env?: Record<string, string> }) => {
    spawnCalls.push({ command, args, env: options.env ?? {} });
    return {
      stdout: { on: () => undefined },
      stderr: { on: () => undefined },
      stdin: { write: () => true },
      on: () => undefined,
      kill: () => true,
    };
  },
}));

import {
  McpClient,
  buildMcpChildEnv,
  buildSecretMarker,
  parseSecretMarker,
  resolveSecretMarkers,
  SECRET_ENV_PREFIX,
} from "../src/index.js";

const REAL_TOKEN = "ghp_realtoken_do_not_leak_0123456789";

describe("T3/D2 — Proxy de secretos MCP (EGO-FIND-33)", () => {
  beforeEach(() => {
    spawnCalls.length = 0;
  });

  it("construye el marcador canónico `EGO_SECRET_<NOMBRE>={{SECRET:<clave>}}`", () => {
    const marker = buildSecretMarker("GITHUB_TOKEN", "github:pat");
    expect(marker).toBe("EGO_SECRET_GITHUB_TOKEN={{SECRET:github:pat}}");
    expect(marker.startsWith(SECRET_ENV_PREFIX)).toBe(true);
  });

  it("parsea el marcador de vuelta a nombre y clave", () => {
    const parsed = parseSecretMarker("EGO_SECRET_GITHUB_TOKEN={{SECRET:github:pat}}");
    expect(parsed).not.toBeNull();
    expect(parsed!.name).toBe("GITHUB_TOKEN");
    expect(parsed!.key).toBe("github:pat");
    expect(parseSecretMarker("sin-marcador")).toBeNull();
  });

  it("el env del subproceso MCP NO contiene el token en claro (sustituye por marcador)", () => {
    const env = buildMcpChildEnv(
      {
        id: "github",
        name: "GitHub",
        transport: "stdio",
        command: "node",
        env: { GITHUB_TOKEN: REAL_TOKEN, OTHER: "publico" },
        secrets: { GITHUB_TOKEN: "github:pat" },
      },
      { baseEnv: { PATH: "/usr/bin", GITHUB_TOKEN: REAL_TOKEN } }
    );

    expect(env.GITHUB_TOKEN).toBe("EGO_SECRET_GITHUB_TOKEN={{SECRET:github:pat}}");
    expect(env.OTHER).toBe("publico");
    expect(JSON.stringify(env)).not.toContain(REAL_TOKEN);
  });

  it("`secretDelivery: 'env'` conserva el valor real (excepción registrada)", () => {
    const env = buildMcpChildEnv(
      {
        id: "github",
        name: "GitHub",
        transport: "stdio",
        command: "node",
        env: { GITHUB_TOKEN: REAL_TOKEN },
        secrets: { GITHUB_TOKEN: "github:pat" },
        secretDelivery: "env",
      },
      { baseEnv: {} }
    );

    expect(env.GITHUB_TOKEN).toBe(REAL_TOKEN);
  });

  it("el env del subproceso no hereda el entorno completo (allowlist)", () => {
    const env = buildMcpChildEnv(
      {
        id: "x",
        name: "X",
        transport: "stdio",
        command: "node",
        env: { TOKEN: REAL_TOKEN },
        secrets: { TOKEN: "svc:key" },
      },
      { baseEnv: { PATH: "/usr/bin", AWS_SECRET_ACCESS_KEY: "aws-leak" } }
    );

    expect(env.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    expect(env.PATH).toBe("/usr/bin");
  });

  it("resuelve marcadores en strings, arrays y objetos anidados", async () => {
    const resolved = await resolveSecretMarkers(
      {
        header: "Bearer {{SECRET:github:pat}}",
        list: ["{{SECRET:github:pat}}", "sin-marcador"],
        nested: { deep: { value: "pre-{{SECRET:github:pat}}-post" } },
        plain: 42,
      },
      async (key) => (key === "github:pat" ? REAL_TOKEN : undefined)
    );

    expect(resolved.header).toBe(`Bearer ${REAL_TOKEN}`);
    expect(resolved.list[0]).toBe(REAL_TOKEN);
    expect(resolved.list[1]).toBe("sin-marcador");
    expect(resolved.nested.deep.value).toBe(`pre-${REAL_TOKEN}-post`);
    expect(resolved.plain).toBe(42);
  });

  it("deja el marcador intacto si el resolver no conoce la clave (fail-closed)", async () => {
    const resolved = await resolveSecretMarkers(
      { v: "{{SECRET:desconocida}}" },
      async () => undefined
    );
    expect(resolved.v).toBe("{{SECRET:desconocida}}");
  });

  it("el subproceso real recibe el marcador, no el token", async () => {
    const client = new McpClient(
      {
        id: "github",
        name: "GitHub",
        transport: "stdio",
        command: "node",
        env: { GITHUB_TOKEN: REAL_TOKEN },
        secrets: { GITHUB_TOKEN: "github:pat" },
        timeoutMs: 300,
      },
      { secretResolver: async (key) => (key === "github:pat" ? REAL_TOKEN : undefined) }
    );

    await client.connect().catch(() => undefined);

    expect(spawnCalls.length).toBeGreaterThan(0);
    const childEnv = spawnCalls[0]!.env;
    expect(childEnv.GITHUB_TOKEN).toBe("EGO_SECRET_GITHUB_TOKEN={{SECRET:github:pat}}");
    expect(JSON.stringify(childEnv)).not.toContain(REAL_TOKEN);
  });

  it("el cliente resuelve el marcador en la petición saliente", async () => {
    const client = new McpClient(
      {
        id: "github",
        name: "GitHub",
        transport: "stdio",
        command: "node",
        env: {},
        secrets: {},
        timeoutMs: 300,
      },
      { secretResolver: async (key) => (key === "github:pat" ? REAL_TOKEN : undefined) }
    );

    const sent: string[] = [];
    // Inyecta un writer en el stdin del subproceso simulado.
    (client as unknown as { process: { stdin: { write: (s: string) => boolean } } }).process = {
      stdin: {
        write: (s: string) => {
          sent.push(s);
          return true;
        },
      },
    } as never;
    (client as unknown as { status: string }).status = "connected";

    await client
      .callTool("gh_tool", { auth: "{{SECRET:github:pat}}" })
      .catch(() => undefined);

    expect(sent.length).toBeGreaterThan(0);
    expect(sent[0]).toContain(REAL_TOKEN);
    expect(sent[0]).not.toContain("{{SECRET:");
  });
});
