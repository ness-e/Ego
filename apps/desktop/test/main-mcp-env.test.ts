import { describe, it, expect } from "vitest";
import {
  MCP_SECRET_ENV_SEGMENTS,
  isMcpSecretEnvName,
  splitMcpServerEnv,
  mcpEnvVaultService,
  isMaskedMcpEnvValue,
  collectStorableMcpSecrets,
} from "../src/main/mcp-env.js";

const CANARY = "sk-test-canary-9f8e7d6c5b4a";

describe("STAB-09: mcp-env (paridad con main.ts)", () => {
  it("heurística por segmento: secretos sí, AUTHOR no", () => {
    expect(isMcpSecretEnvName("GITHUB_TOKEN")).toBe(true);
    expect(isMcpSecretEnvName("ANTHROPIC_API_KEY")).toBe(true);
    expect(isMcpSecretEnvName("MY_PAT")).toBe(true);
    expect(isMcpSecretEnvName("AUTHOR")).toBe(false);
    expect(isMcpSecretEnvName("NODE_ENV")).toBe(false);
    expect(isMcpSecretEnvName("PORT")).toBe(false);
    expect(isMcpSecretEnvName("")).toBe(false);
    expect(isMcpSecretEnvName(undefined)).toBe(false);
  });

  it("split separa público de secretos sin exponer valores", () => {
    const { publicEnv, secretNames } = splitMcpServerEnv({
      NODE_ENV: "production",
      GITHUB_TOKEN: CANARY,
    });
    expect(publicEnv).toEqual({ NODE_ENV: "production" });
    expect(secretNames).toEqual(["GITHUB_TOKEN"]);
  });

  it("split con env indefinido devuelve vacío", () => {
    expect(splitMcpServerEnv(undefined)).toEqual({ publicEnv: {}, secretNames: [] });
  });

  it("vault service con formato mcp/<id>/env", () => {
    expect(mcpEnvVaultService("github")).toBe("mcp/github/env");
  });

  it("máscaras del renderer nunca son almacenables", () => {
    expect(isMaskedMcpEnvValue("sk-t...7890")).toBe(true);
    expect(isMaskedMcpEnvValue("••••••••")).toBe(true);
    expect(isMaskedMcpEnvValue(CANARY)).toBe(false);
    const out = collectStorableMcpSecrets({
      GITHUB_TOKEN: CANARY,
      STALE: "sk-t...7890",
      EMPTY: "",
      NODE_ENV: "production",
    });
    // STALE no es secreto por nombre; solo GITHUB_TOKEN califica.
    expect(out).toEqual({ GITHUB_TOKEN: CANARY });
  });

  it("segmentos canónicos presentes", () => {
    for (const seg of ["KEY", "TOKEN", "SECRET", "PAT", "PASSWORD", "AUTH"]) {
      expect(MCP_SECRET_ENV_SEGMENTS.has(seg)).toBe(true);
    }
  });
});
