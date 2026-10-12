import { describe, it, expect, vi } from "vitest";
import {
  InMemoryCryptoBackend,
  SafeStorageBackend,
  StoredCredentialSchema,
  CredentialManager,
} from "../src/CredentialManager.js";

describe("InMemoryCryptoBackend (test-only obfuscation)", () => {
  it("round-trip obf:decrypt", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const b = new InMemoryCryptoBackend("session_test");
      const enc = b.encrypt("sk-test-123");
      expect(enc.startsWith("obf:")).toBe(true);
      expect(b.decrypt(enc)).toBe("sk-test-123");
    } finally {
      warn.mockRestore();
    }
  });

  it("decrypt deja pasar texto no-ofuscado", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const b = new InMemoryCryptoBackend();
      expect(b.decrypt("plain")).toBe("plain");
    } finally {
      warn.mockRestore();
    }
  });

  it("advierte test-only en el constructor y reporta sin protección hardware", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const b = new InMemoryCryptoBackend();
      expect(warn).toHaveBeenCalledOnce();
      expect(b.isHardwareProtected()).toBe(false);
    } finally {
      warn.mockRestore();
    }
  });
});

describe("SafeStorageBackend", () => {
  const makeFakeSafeStorage = (overrides?: {
    available?: boolean;
    encryptString?: (plain: string) => Buffer;
    decryptString?: (enc: Buffer) => string;
  }) => {
    const available = overrides?.available ?? true;
    return {
      isEncryptionAvailable: () => available,
      encryptString: overrides?.encryptString ?? ((plain: string) => Buffer.from(`enc-bytes:${plain}`, "utf-8")),
      decryptString: overrides?.decryptString ?? ((enc: Buffer) => enc.toString("utf-8").replace(/^enc-bytes:/, "")),
    };
  };

  it("round-trip real vía safeStorage inyectado con prefijo enc:", async () => {
    const backend = new SafeStorageBackend(makeFakeSafeStorage());
    expect(backend.isAvailable()).toBe(true);
    const enc = await backend.encrypt("sk-test-roundtrip");
    expect(enc.startsWith("enc:")).toBe(true);
    expect(enc).not.toContain("sk-test-roundtrip");
    await expect(backend.decrypt(enc)).resolves.toBe("sk-test-roundtrip");
  });

  it("no disponible sin safeStorage (fuera de main): flags falsos y errores explícitos", async () => {
    const backend = new SafeStorageBackend();
    expect(backend.isAvailable()).toBe(false);
    expect(backend.isHardwareProtected()).toBe(false);
    await expect(backend.encrypt("sk-test-absent")).rejects.toThrow(/safeStorage/i);
    await expect(backend.decrypt("enc:eA==")).rejects.toThrow(/safeStorage/i);
  });

  it("flag hardware delega a isEncryptionAvailable()", () => {
    const on = new SafeStorageBackend(makeFakeSafeStorage({ available: true }));
    expect(on.isAvailable()).toBe(true);
    expect(on.isHardwareProtected()).toBe(true);
    const off = new SafeStorageBackend(makeFakeSafeStorage({ available: false }));
    expect(off.isAvailable()).toBe(false);
    expect(off.isHardwareProtected()).toBe(false);
  });

  it("descifra payloads legacy obf: (migración) pero solo emite enc:", async () => {
    const backend = new SafeStorageBackend(makeFakeSafeStorage());
    const legacy = `obf:${Buffer.from("sk-test-legacy", "utf-8").toString("base64")}`;
    await expect(backend.decrypt(legacy)).resolves.toBe("sk-test-legacy");
    const fresh = await backend.encrypt("sk-test-fresh");
    expect(fresh.startsWith("enc:")).toBe(true);
  });
});

describe("CredentialManager flags honestos", () => {
  const makeFakeSafeStorage = () => ({
    isEncryptionAvailable: () => true,
    encryptString: (plain: string) => Buffer.from(`enc-bytes:${plain}`, "utf-8"),
    decryptString: (enc: Buffer) => enc.toString("utf-8").replace(/^enc-bytes:/, ""),
  });

  it("marca isHardwareProtected=true con SafeStorageBackend disponible", async () => {
    const mgr = new CredentialManager(new SafeStorageBackend(makeFakeSafeStorage()));
    await mgr.storeSecret("svc-test", "acct-test", "sk-test-value");
    expect(mgr.isHardwareProtected()).toBe(true);
    const [stored] = mgr.exportVault();
    expect(stored.isHardwareProtected).toBe(true);
    await expect(mgr.getSecret("svc-test", "acct-test")).resolves.toBe("sk-test-value");
  });

  it("marca isHardwareProtected=false con InMemoryCryptoBackend (honesto)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const mgr = new CredentialManager(new InMemoryCryptoBackend());
      await mgr.storeSecret("svc-test", "acct-test", "sk-test-value");
      expect(mgr.isHardwareProtected()).toBe(false);
      const [stored] = mgr.exportVault();
      expect(stored.isHardwareProtected).toBe(false);
    } finally {
      warn.mockRestore();
    }
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
