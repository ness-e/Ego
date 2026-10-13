import { describe, it, expect } from "vitest";
import {
  CredentialManager,
  InMemoryCryptoBackend,
  SafeStorageBackend,
  StoredCredentialSchema,
  VaultExportSchema,
  VAULT_FORMAT_VERSION,
  scanText,
  sanitizeForLog,
  scanEgoPut,
  evaluateToolCall,
} from "../src/index.js";

describe("@ego/security — package index (F1T2/C04)", () => {
  it("exporta CredentialManager + backends + schemas", () => {
    expect(typeof CredentialManager).toBe("function");
    expect(typeof InMemoryCryptoBackend).toBe("function");
    expect(typeof SafeStorageBackend).toBe("function");
    expect(typeof StoredCredentialSchema.parse).toBe("function");
    expect(typeof VaultExportSchema.parse).toBe("function");
    expect(VAULT_FORMAT_VERSION).toBe(1);
  });

  it("exporta SecretsFilter (SEC-04: barrera Zero Secrets)", () => {
    expect(typeof scanText).toBe("function");
    expect(typeof sanitizeForLog).toBe("function");
    expect(typeof scanEgoPut).toBe("function");
    expect(scanText("texto limpio").hasSecrets).toBe(false);
  });

  it("exporta ToolPermissions (SEC-05: matriz de permisos)", () => {
    expect(typeof evaluateToolCall).toBe("function");
    expect(
      evaluateToolCall({ toolName: "", category: "system" }, {}).decision
    ).toBe("deny");
  });
});
