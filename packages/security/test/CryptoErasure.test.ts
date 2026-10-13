import { describe, it, expect } from "vitest";
import {
  CryptoErasure,
  ScopeKeyRegistry,
  ErasureVerificationError,
  type ErasureStore,
  type ErasureStoreRecord,
} from "../src/CryptoErasure.js";
import {
  CryptoErasure as CryptoErasureFromIndex,
  ScopeKeyRegistry as RegistryFromIndex,
  ErasureVerificationError as VerificationErrorFromIndex,
} from "../src/index.js";

// Sonda forense a nivel API: el atacante solo dispone de get/list tras el
// borrado. NUNCA datos reales: solo fixtures sintéticas `pii-synthetic-*`.
const SECRET_PAYLOAD = { ssn: "pii-synthetic-000-00-0000", note: "erase me" };

/** Fake store en memoria con mapas get/list separables (simula índice residual). */
function makeFakeStore(opts: { ghostInList?: boolean; noDelete?: boolean } = {}): ErasureStore & {
  puts: Array<{ namespace: string; key: string; payload: unknown }>;
  deletes: string[];
} {
  const data = new Map<string, ErasureStoreRecord>();
  const listGhosts = new Map<string, ErasureStoreRecord>();
  const store = {
    puts: [] as Array<{ namespace: string; key: string; payload: unknown }>,
    deletes: [] as string[],
    async get(namespace: string, key: string) {
      return data.get(`${namespace}:${key}`) ?? null;
    },
    async put(item: { namespace: string; key: string; payload: unknown }) {
      store.puts.push({ namespace: item.namespace, key: item.key, payload: item.payload });
      if (opts.noDelete) {
        data.set(`${item.namespace}:${item.key}`, { key: item.key, payload: item.payload });
        return;
      }
      data.set(`${item.namespace}:${item.key}`, { key: item.key, payload: item.payload });
    },
    async delete(namespace: string, key: string) {
      store.deletes.push(`${namespace}:${key}`);
      if (opts.noDelete) return;
      data.delete(`${namespace}:${key}`);
      // ghostInList: el registro desaparece de get pero persiste en list
      // (simula segmento LSM / índice secundario no compactado).
      if (!opts.ghostInList) listGhosts.delete(`${namespace}:${key}`);
    },
    async list(namespace: string) {
      const out: ErasureStoreRecord[] = [];
      for (const [k, v] of data) if (k.startsWith(`${namespace}:`)) out.push(v);
      if (opts.ghostInList) {
        for (const [k, v] of listGhosts) if (k.startsWith(`${namespace}:`)) out.push(v);
      }
      return out;
    },
    seed(namespace: string, key: string, payload: unknown) {
      data.set(`${namespace}:${key}`, { key, payload });
      listGhosts.set(`${namespace}:${key}`, { key, payload });
    },
  };
  return store;
}

describe("CryptoErasure — purga criptográfica verificable (SEC-07)", () => {
  it("irrecuperabilidad a nivel API: get tras erase retorna null", async () => {
    const store = makeFakeStore();
    store.seed("kb/docs", "k1", SECRET_PAYLOAD);
    const erasure = new CryptoErasure(store);

    const receipt = await erasure.eraseOne("kb/docs", "k1");

    expect(receipt.status).toBe("erased");
    expect(receipt.verified).toBe(true);
    expect(await store.get("kb/docs", "k1")).toBeNull();
    expect(await store.list("kb/docs")).toHaveLength(0);
  });

  it("claves derivadas rotadas: lo sellado antes del erase ya no abre", async () => {
    const store = makeFakeStore();
    store.seed("kb/docs", "k2", SECRET_PAYLOAD);
    const registry = new ScopeKeyRegistry();
    const sealed = registry.seal("kb/docs:k2", JSON.stringify(SECRET_PAYLOAD));
    const oldKeyId = sealed.keyId;
    expect(registry.open(sealed)).toBe(JSON.stringify(SECRET_PAYLOAD));

    const erasure = new CryptoErasure(store, { registry });
    const receipt = await erasure.eraseOne("kb/docs", "k2");

    expect(receipt.keyRotated).toBe(true);
    expect(receipt.keyId).not.toBe(oldKeyId);
    expect(registry.deriveKey("kb/docs:k2").keyId).not.toBe(oldKeyId);
    expect(() => registry.open(sealed)).toThrow();
    expect(await store.get("kb/docs", "k2")).toBeNull();
  });

  it("sobrescribe N pasadas con tombstones ANTES del delete", async () => {
    const store = makeFakeStore();
    store.seed("kb/docs", "k3", SECRET_PAYLOAD);
    const erasure = new CryptoErasure(store, { overwritePasses: 3 });

    const receipt = await erasure.eraseOne("kb/docs", "k3");

    expect(receipt.overwritePasses).toBe(3);
    const overwritePuts = store.puts.filter((p) => p.key === "k3");
    expect(overwritePuts).toHaveLength(3);
    for (const p of overwritePuts) {
      expect(JSON.stringify(p.payload)).not.toContain("pii-synthetic");
    }
    expect(store.deletes).toHaveLength(1);
  });

  it("fail-closed: si el registro sobrevive al delete, lanza ErasureVerificationError", async () => {
    const store = makeFakeStore({ noDelete: true });
    store.seed("kb/docs", "k4", SECRET_PAYLOAD);
    const erasure = new CryptoErasure(store);

    await expect(erasure.eraseOne("kb/docs", "k4")).rejects.toBeInstanceOf(
      ErasureVerificationError
    );
  });

  it("detecta entrada fantasma en list aunque get ya retorne null", async () => {
    const store = makeFakeStore({ ghostInList: true });
    store.seed("kb/docs", "k5", SECRET_PAYLOAD);
    const erasure = new CryptoErasure(store);

    await expect(erasure.eraseOne("kb/docs", "k5")).rejects.toBeInstanceOf(
      ErasureVerificationError
    );
  });

  it("doble erase es idempotente: segundo retorno not-found verificado", async () => {
    const store = makeFakeStore();
    store.seed("kb/docs", "k6", SECRET_PAYLOAD);
    const erasure = new CryptoErasure(store);

    await erasure.eraseOne("kb/docs", "k6");
    const second = await erasure.eraseOne("kb/docs", "k6");

    expect(second.status).toBe("not-found");
    expect(second.verified).toBe(true);
  });

  it("rechaza namespace/key vacíos sin tocar el store", async () => {
    const store = makeFakeStore();
    const erasure = new CryptoErasure(store);

    await expect(erasure.eraseOne("", "k")).rejects.toBeInstanceOf(TypeError);
    await expect(erasure.eraseOne("kb/docs", "")).rejects.toBeInstanceOf(TypeError);
    expect(store.puts).toHaveLength(0);
    expect(store.deletes).toHaveLength(0);
  });

  it("eraseNamespace purga todo el namespace con receipts verificados", async () => {
    const store = makeFakeStore();
    store.seed("kb/docs", "a", SECRET_PAYLOAD);
    store.seed("kb/docs", "b", SECRET_PAYLOAD);
    store.seed("kb/other", "c", SECRET_PAYLOAD);
    const erasure = new CryptoErasure(store);

    const receipts = await erasure.eraseNamespace("kb/docs");

    expect(receipts).toHaveLength(2);
    expect(receipts.every((r) => r.verified)).toBe(true);
    expect(await store.list("kb/docs")).toHaveLength(0);
    expect(await store.get("kb/other", "c")).not.toBeNull();
  });

  it("el receipt declara el límite LSM honestamente (solo nivel API)", async () => {
    const store = makeFakeStore();
    store.seed("kb/docs", "k7", SECRET_PAYLOAD);
    const erasure = new CryptoErasure(store);

    const receipt = await erasure.eraseOne("kb/docs", "k7");

    expect(receipt.physicalErasure).toBe("api-level-only");
  });

  it("barrel @ego/security re-exporta la purga (sin importar @ego/memory)", async () => {
    expect(CryptoErasureFromIndex).toBe(CryptoErasure);
    expect(RegistryFromIndex).toBe(ScopeKeyRegistry);
    expect(VerificationErrorFromIndex).toBe(ErasureVerificationError);
  });
});
