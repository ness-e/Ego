import { describe, it, expect, vi } from "vitest";
import {
  CredentialManager,
  CredentialPool,
  InMemoryCryptoBackend,
} from "../src/CredentialManager.js";

function makePool(opts?: { cooldownMs?: number; now?: number }) {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const manager = new CredentialManager(new InMemoryCryptoBackend());
  let now = opts?.now ?? 1_000_000;
  const pool = new CredentialPool(manager, {
    ...(opts?.cooldownMs !== undefined ? { cooldownMs: opts.cooldownMs } : {}),
    nowMs: () => now,
  });
  return {
    manager,
    pool,
    advance: (ms: number) => {
      now += ms;
    },
    restore: () => warn.mockRestore(),
  };
}

describe("CredentialPool — rotación multi-key por proveedor (T21)", () => {
  it("rota a la siguiente key del mismo proveedor ante 429", async () => {
    const { pool, restore } = makePool();
    try {
      await pool.setProviderKeys("openai", ["sk-test-key-A-001", "sk-test-key-B-002"]);
      expect(pool.getPoolSize("openai")).toBe(2);
      await expect(pool.getActiveKey("openai")).resolves.toBe("sk-test-key-A-001");

      await pool.reportRateLimited("openai");
      await expect(pool.getActiveKey("openai")).resolves.toBe("sk-test-key-B-002");
    } finally {
      restore();
    }
  });

  it("respeta cooldown: la key en 429 no vuelve hasta que expira", async () => {
    const { pool, advance, restore } = makePool({ cooldownMs: 60_000 });
    try {
      await pool.setProviderKeys("anthropic", ["sk-test-key-A-001", "sk-test-key-B-002"]);
      await pool.reportRateLimited("anthropic");
      await expect(pool.getActiveKey("anthropic")).resolves.toBe("sk-test-key-B-002");

      await pool.reportRateLimited("anthropic");
      await expect(pool.getActiveKey("anthropic")).resolves.toBeNull();

      advance(59_999);
      await expect(pool.getActiveKey("anthropic")).resolves.toBeNull();

      advance(1);
      await expect(pool.getActiveKey("anthropic")).resolves.toBe("sk-test-key-A-001");
    } finally {
      restore();
    }
  });

  it("agotamiento fail-closed: sin keys utilizables retorna null, nunca inventa", async () => {
    const { pool, restore } = makePool();
    try {
      await expect(pool.getActiveKey("openai")).resolves.toBeNull();
      expect(pool.getActiveFingerprint("openai")).toBeNull();

      await pool.setProviderKeys("openai", ["sk-test-only-key-001"]);
      await pool.reportRateLimited("openai");
      await expect(pool.getActiveKey("openai")).resolves.toBeNull();
      expect(pool.getActiveFingerprint("openai")).toBeNull();

      await expect(pool.reportRateLimited("openai")).resolves.toBeUndefined();
    } finally {
      restore();
    }
  });

  it("nunca expone secretos en claro fuera del vault: fingerprints opacos y vault cifrado", async () => {
    const { manager, pool, restore } = makePool();
    const secret = "sk-test-ultra-secret-999";
    try {
      await pool.setProviderKeys("deepseek", [secret]);
      const fp = pool.getActiveFingerprint("deepseek");
      expect(fp).not.toBeNull();
      expect(fp as string).not.toContain(secret.slice(0, 8));
      expect((fp as string).length).toBeGreaterThanOrEqual(12);

      for (const cred of manager.exportVault()) {
        expect(cred.encryptedPayload).not.toContain(secret);
        expect(JSON.stringify(cred)).not.toContain(secret);
      }
    } finally {
      restore();
    }
  });

  it("setProviderKeys reemplaza el pool y limpia slots viejos del vault", async () => {
    const { pool, restore } = makePool();
    try {
      const fpA = await pool.addProviderKey("google", "sk-test-key-A-001");
      expect(pool.getPoolSize("google")).toBe(1);

      await pool.setProviderKeys("google", ["sk-test-key-B-002"]);
      expect(pool.getPoolSize("google")).toBe(1);
      expect(pool.listFingerprints("google")).not.toContain(fpA);
      await expect(pool.getActiveKey("google")).resolves.toBe("sk-test-key-B-002");
    } finally {
      restore();
    }
  });

  it("valida inputs fail-closed: proveedor vacío y secreto en blanco lanzan", async () => {
    const { pool, restore } = makePool();
    try {
      await expect(pool.setProviderKeys("", ["sk-test-x"])).rejects.toThrow(/proveedor/i);
      await expect(pool.setProviderKeys("openai", ["   "])).rejects.toThrow(/vac[ií]o/i);
      await expect(pool.addProviderKey("  ", "sk-test-x")).rejects.toThrow(/proveedor/i);
      await expect(pool.getActiveKey("no-existe")).resolves.toBeNull();
    } finally {
      restore();
    }
  });

  it("deduplica la misma key: el fingerprint es estable y no duplica slots", async () => {
    const { pool, restore } = makePool();
    try {
      const fp1 = await pool.addProviderKey("openai", "sk-test-same-001");
      const fp2 = await pool.addProviderKey("openai", "sk-test-same-001");
      expect(fp1).toBe(fp2);
      expect(pool.getPoolSize("openai")).toBe(1);
    } finally {
      restore();
    }
  });
});
