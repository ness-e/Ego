import { describe, it, expect } from "vitest";
import {
  InMemoryCryptoBackend,
  StoredCredentialSchema,
} from "../src/CredentialManager.js";

describe("InMemoryCryptoBackend (test-only obfuscation)", () => {
  it("round-trip obf:decrypt", () => {
    const b = new InMemoryCryptoBackend("session_test");
    const enc = b.encrypt("sk-secret-123");
    expect(enc.startsWith("obf:")).toBe(true);
    expect(b.decrypt(enc)).toBe("sk-secret-123");
  });

  it("decrypt deja pasar texto no-ofuscado", () => {
    const b = new InMemoryCryptoBackend();
    expect(b.decrypt("plain")).toBe("plain");
  });
});

describe("StoredCredentialSchema", () => {
  it("acepta credencial válida y rechaza servicio vacío", () => {
    const base = {
      service: "openai",
      account: "default",
      encryptedPayload: "obf:eA==",
      createdAtMs: 1,
      updatedAtMs: 2,
      isHardwareProtected: false,
    };
    expect(StoredCredentialSchema.safeParse(base).success).toBe(true);
    expect(
      StoredCredentialSchema.safeParse({ ...base, service: "" }).success
    ).toBe(false);
  });
});
