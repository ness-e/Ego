import { describe, it, expect } from "vitest";
import {
  CredentialManager,
  InMemoryCryptoBackend,
  SafeStorageBackend,
  StoredCredentialSchema,
  VaultExportSchema,
  VAULT_FORMAT_VERSION,
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
});
