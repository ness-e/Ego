import { describe, it, expect } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { McpClient } from "../src/mcp/McpClient.js";
import { buildSignaturePayload } from "../src/mcp/signature.js";
import type { McpServerConfig } from "../src/mcp/types.js";

function baseConfig(overrides: Partial<McpServerConfig> = {}): McpServerConfig {
  return {
    id: "mock-official",
    name: "Official firmado",
    transport: "stdio",
    command: "node",
    args: [],
    trustLevel: "official",
    ...overrides,
  };
}

/** Firma el payload canónico con la privada efímera; devuelve { publicKey, signature } en base64/PEM. */
function signConfig(config: McpServerConfig): { publicKey: string; signature: string } {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const payload = buildSignaturePayload(config);
  const signature = sign(null, payload, privateKey);
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  return { publicKey: publicKeyPem, signature: signature.toString("base64") };
}

describe("@ego/integrations — R10 verificación real de firma MCP (fail-closed)", () => {
  it("1. Firma válida (official + Ed25519 correcta) → firmado", () => {
    const unsigned = baseConfig();
    const { publicKey, signature } = signConfig(unsigned);
    const client = new McpClient({ ...unsigned, publicKey, signature });
    expect(client.isSignedServer()).toBe(true);
  });

  it("2. Firma inválida (bytes corruptos) → no firmado", () => {
    const unsigned = baseConfig();
    const { publicKey, signature } = signConfig(unsigned);
    const raw = Buffer.from(signature, "base64");
    raw[0] ^= 0xff;
    const client = new McpClient({ ...unsigned, publicKey, signature: raw.toString("base64") });
    expect(client.isSignedServer()).toBe(false);
  });

  it("3. Firma de otra identidad (id distinto) → no firmado", () => {
    const other = baseConfig({ id: "otro-servidor" });
    const { publicKey, signature } = signConfig(other);
    const client = new McpClient({ ...baseConfig(), publicKey, signature });
    expect(client.isSignedServer()).toBe(false);
  });

  it("4. Firma ausente (official sin signature/publicKey) → no firmado (fail-closed)", () => {
    expect(new McpClient(baseConfig()).isSignedServer()).toBe(false);
    expect(
      new McpClient(baseConfig({ signature: "c2lnLWZha2U=" })).isSignedServer(),
    ).toBe(false);
  });

  it("5. trustLevel no firmado (community) con firma válida → no firmado", () => {
    const community = baseConfig({ trustLevel: "community" });
    const { publicKey, signature } = signConfig(community);
    const client = new McpClient({ ...community, publicKey, signature });
    expect(client.isSignedServer()).toBe(false);
  });
});
