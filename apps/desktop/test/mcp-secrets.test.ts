import { describe, it, expect } from "vitest";
import type { McpServerConfig } from "@ego/integrations";
import {
  isMcpSecretEnvName,
  splitMcpServerEnv,
  mcpEnvVaultService,
  isMaskedMcpEnvValue,
  buildMcpPersistedRecord,
  resolveMcpRuntimeEnv,
  needsMcpEnvMigration,
  extractPersistedMcpRecord,
  maskMcpEnvForRenderer,
  sanitizeMcpRuntimeStateForRenderer,
  mcpEnvKeysForCleanup,
  encryptCredential,
  type PersistedMcpServerRecord,
} from "../src/main.js";

// Fixtures canarias: solo `sk-test-*`, nunca secretos reales.
const CANARY_PAT = "sk-test-canary-pat-9f8e7d6c5b4a";
const CANARY_KEY = "sk-test-canary-key-1a2b3c4d5e6f";

function fakeEncrypt(plainText: string): string {
  return `enc:${Buffer.from(plainText, "utf-8").toString("base64")}`;
}

function fakeDecrypt(stored: string): string {
  if (!stored.startsWith("enc:")) throw new Error("formato inesperado");
  return Buffer.from(stored.slice(4), "base64").toString("utf-8");
}

function baseConfig(env?: Record<string, string>): McpServerConfig {
  return {
    id: "github-mcp",
    name: "GitHub Official Server",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    ...(env ? { env } : {}),
  };
}

describe("@ego/desktop — MCP env secrets a Credential Manager (F1T2/F5T10)", () => {
  it("clasifica como secretos KEY/TOKEN/SECRET/PAT y deja en claro NODE_ENV/PORT", () => {
    expect(isMcpSecretEnvName("GITHUB_PERSONAL_ACCESS_TOKEN")).toBe(true);
    expect(isMcpSecretEnvName("GITHUB_TOKEN")).toBe(true);
    expect(isMcpSecretEnvName("ANTHROPIC_API_KEY")).toBe(true);
    expect(isMcpSecretEnvName("MY_SECRET")).toBe(true);
    expect(isMcpSecretEnvName("GH_PAT")).toBe(true);
    expect(isMcpSecretEnvName("NODE_ENV")).toBe(false);
    expect(isMcpSecretEnvName("PORT")).toBe(false);
    expect(isMcpSecretEnvName("LOG_LEVEL")).toBe(false);
    expect(isMcpSecretEnvName("DEBUG")).toBe(false);
  });

  it("splitMcpServerEnv separa secretos de valores públicos no-secretos", () => {
    const { publicEnv, secretNames } = splitMcpServerEnv({
      GITHUB_TOKEN: CANARY_PAT,
      NODE_ENV: "production",
    });
    expect(publicEnv).toEqual({ NODE_ENV: "production" });
    expect(secretNames).toContain("GITHUB_TOKEN");
    expect(secretNames).not.toContain("NODE_ENV");
  });

  it("mcpEnvVaultService direcciona al vault como mcp/<server-id>/env", () => {
    expect(mcpEnvVaultService("github-mcp")).toBe("mcp/github-mcp/env");
  });

  it("un PAT canario NUNCA aparece en el payload persistido (ni en claro ni por referencia)", () => {
    const persisted = buildMcpPersistedRecord(
      baseConfig({ GITHUB_PERSONAL_ACCESS_TOKEN: CANARY_PAT, NODE_ENV: "production" }),
      true,
      fakeEncrypt
    );
    const serialized = JSON.stringify(persisted);
    expect(serialized).not.toContain(CANARY_PAT);
    // El valor no-secreto sí persiste en claro para arranque sin Manager.
    expect(persisted.config.env).toEqual({ NODE_ENV: "production" });
    // Solo referencias: servicio + claves, nunca el secreto.
    expect(persisted.envRef?.service).toBe("mcp/github-mcp/env");
    expect(persisted.envRef?.keys).toContain("GITHUB_PERSONAL_ACCESS_TOKEN");
    for (const blob of Object.values(persisted.envRef?.encrypted ?? {})) {
      expect(blob).not.toContain(CANARY_PAT);
    }
  });

  it("con encryptCredential real (safeStorage u ofuscación legada) el PAT tampoco llega a VantaDB", () => {
    const persisted = buildMcpPersistedRecord(
      baseConfig({ GITHUB_TOKEN: CANARY_KEY }),
      true,
      encryptCredential
    );
    expect(JSON.stringify(persisted)).not.toContain(CANARY_KEY);
    expect(persisted.config.env ?? {}).not.toHaveProperty("GITHUB_TOKEN");
  });

  it("round-trip: el restore rehidrata el env completo sin persistir máscaras", async () => {
    const persisted = buildMcpPersistedRecord(
      baseConfig({ GITHUB_TOKEN: CANARY_PAT, NODE_ENV: "production" }),
      true,
      fakeEncrypt
    );
    const { env, missingSecrets } = await resolveMcpRuntimeEnv(persisted, fakeDecrypt);
    expect(missingSecrets).toEqual([]);
    expect(env).toEqual({ NODE_ENV: "production", GITHUB_TOKEN: CANARY_PAT });
  });

  it("los valores enmascarados del renderer nunca se almacenan como secretos", () => {
    expect(isMaskedMcpEnvValue("ghp-...abcd")).toBe(true);
    expect(isMaskedMcpEnvValue("••••••••")).toBe(true);
    const persisted = buildMcpPersistedRecord(
      baseConfig({ GITHUB_TOKEN: "ghp-...abcd" }),
      true,
      fakeEncrypt
    );
    // Máscara ≠ secreto: no hay claves que vaultizar ni cifrar.
    expect(persisted.envRef).toBeUndefined();
    expect(persisted.config.env).toBeUndefined();
  });

  it("migración: un registro legado con env en claro se detecta y se re-persiste sin PAT", () => {
    const legacy = extractPersistedMcpRecord({
      config: baseConfig({ GITHUB_TOKEN: CANARY_PAT }),
      enabled: true,
    });
    expect(legacy).not.toBeNull();
    expect(needsMcpEnvMigration(legacy as PersistedMcpServerRecord)).toBe(true);
    const migrated = buildMcpPersistedRecord(
      (legacy as PersistedMcpServerRecord).config,
      true,
      fakeEncrypt
    );
    expect(JSON.stringify(migrated)).not.toContain(CANARY_PAT);
    expect(needsMcpEnvMigration(migrated)).toBe(false);
  });

  it("el vault (service/account) rehidrata cuando el cifrado no alcanza", async () => {
    const vault = new Map<string, string>();
    const service = mcpEnvVaultService("github-mcp");
    vault.set(`${service}::github_token`, CANARY_PAT);
    const persisted: PersistedMcpServerRecord = {
      config: baseConfig({ NODE_ENV: "production" }),
      enabled: true,
      envRef: { service, keys: ["GITHUB_TOKEN"], encrypted: {} },
    };
    const { env } = await resolveMcpRuntimeEnv(persisted, fakeDecrypt, async (s, a) => {
      return vault.get(`${s}::${a.toLowerCase()}`) ?? null;
    });
    expect(env).toEqual({ NODE_ENV: "production", GITHUB_TOKEN: CANARY_PAT });
  });

  it("las respuestas al renderer enmascaran secretos y conservan lo público", () => {
    const masked = maskMcpEnvForRenderer({ GITHUB_TOKEN: CANARY_PAT, NODE_ENV: "production" });
    expect(masked?.NODE_ENV).toBe("production");
    expect(masked?.GITHUB_TOKEN).not.toContain(CANARY_PAT);
    expect(masked?.GITHUB_TOKEN).toContain("...");

    const sanitized = sanitizeMcpRuntimeStateForRenderer({
      id: "github-mcp",
      name: "GitHub",
      config: baseConfig({ GITHUB_TOKEN: CANARY_PAT }),
      status: "connected",
      enabled: true,
      toolsCount: 0,
      ok: true,
      tools: [],
    });
    expect(JSON.stringify(sanitized)).not.toContain(CANARY_PAT);
    expect(sanitized.id).toBe("github-mcp");
  });

  it("mcpEnvKeysForCleanup enumera las claves del vault a borrar", () => {
    const persisted = buildMcpPersistedRecord(
      baseConfig({ GITHUB_TOKEN: CANARY_PAT }),
      true,
      fakeEncrypt
    );
    expect(mcpEnvKeysForCleanup(persisted)).toContain("GITHUB_TOKEN");
    expect(
      mcpEnvKeysForCleanup({ config: baseConfig({ NODE_ENV: "production" }), enabled: true })
    ).toEqual([]);
  });
});
