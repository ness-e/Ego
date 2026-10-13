import { describe, it, expect, vi, afterEach } from "vitest";
import { EgoMemoryAdapter } from "../EgoMemoryAdapter.js";
import {
  isSensitiveNamespace,
  isEnforcementDeferred,
  normalizeNamespace,
} from "../SensitiveNamespaces.js";

// Solo canarios sintéticos sk-test-*. NUNCA secretos reales.
const CANARY = "sk-test-sec09-canary-001";

interface StubHarness {
  adapter: EgoMemoryAdapter;
  putBatchCalls: Array<{ namespace: string; key: string; payload: unknown; metadata: unknown }>;
  store: Map<string, { payload: unknown; metadata: unknown }>;
}

function stubHarness(): StubHarness {
  const putBatchCalls: StubHarness["putBatchCalls"] = [];
  const store = new Map<string, { payload: unknown; metadata: unknown }>();
  const db = {
    putBatch: async (recs: Array<{ namespace: string; key: string; payload: unknown; metadata: unknown }>) => {
      for (const r of recs) {
        putBatchCalls.push(r);
        store.set(`${r.namespace}:${r.key}`, { payload: r.payload, metadata: r.metadata });
      }
    },
    put: async (rec: { namespace: string; key: string; payload: unknown; metadata: unknown }) => {
      store.set(`${rec.namespace}:${rec.key}`, { payload: rec.payload, metadata: rec.metadata });
    },
    get: async ({ namespace, key }: { namespace: string; key: string }) => {
      const hit = store.get(`${namespace}:${key}`);
      return hit ? { key, payload: hit.payload, metadata: hit.metadata } : null;
    },
    list: async ({ namespace, limit }: { namespace: string; limit: number }) => ({
      records: [...store.entries()]
        .filter(([k]) => k.startsWith(`${namespace}:`))
        .slice(0, limit)
        .map(([k, v]) => ({ key: k.slice(namespace.length + 1), payload: v.payload, metadata: v.metadata })),
      next_cursor: undefined,
    }),
    listNamespaces: async () => [...new Set([...store.keys()].map((k) => k.split(":")[0]))],
    search: async () => [],
    delete: async ({ namespace, key }: { namespace: string; key: string }) =>
      store.delete(`${namespace}:${key}`),
    flush: async () => {},
  };
  const adapter = new EgoMemoryAdapter(`/tmp/ego-sec09-stub-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  (adapter as unknown as { db: unknown }).db = db;
  return { adapter, putBatchCalls, store };
}

function storedPayloadsContain(store: Map<string, unknown>, needle: string): boolean {
  return JSON.stringify([...store.entries()]).includes(needle);
}

describe("SEC-09 — Detector de namespaces sensibles", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("marca sensibles los prefijos de dominio con datos personales, financieros o de control", () => {
    for (const ns of [
      "gov/policies",
      "system/config",
      "finance/transactions",
      "crm/contacts",
      "journal/entries",
      "egos/abc-123/state",
      "ecom/orders",
      "support/tickets",
      "finance",
    ]) {
      expect(isSensitiveNamespace(ns).sensitive, ns).toBe(true);
    }
  });

  it("marca sensibles los namespaces con tokens de secreto en cualquier segmento", () => {
    for (const ns of ["kb/mysecrets", "notes/private-diary", "projects/client-passwords", "vault/keys"]) {
      expect(isSensitiveNamespace(ns).sensitive, ns).toBe(true);
    }
  });

  it("deja en live los namespaces operativos no sensibles", () => {
    for (const ns of [
      "kb/docs",
      "projects/default",
      "chat/general",
      "notes/ideas",
      "session/turns",
      "metrics/telemetry",
      "events/raw",
      "support/kb",
      "marketing/content",
      "projects/audit",
      "kb/authors",
    ]) {
      expect(isSensitiveNamespace(ns).sensitive, ns).toBe(false);
    }
  });

  it("adversarial: normaliza evasiones de mayúsculas, espacios, backslash, slash doble y %XX", () => {
    expect(normalizeNamespace(" GOV/Policies ")).toBe("gov/policies");
    expect(normalizeNamespace("gov\\\\policies")).toBe("gov/policies");
    expect(normalizeNamespace("gov//policies")).toBe("gov/policies");
    expect(normalizeNamespace("%67ov/policies")).toBe("gov/policies");
    for (const ns of [" GOV/Policies ", "gov\\\\policies", "gov//policies", "%67ov/policies", "Gov/Policies"]) {
      expect(isSensitiveNamespace(ns).sensitive, ns).toBe(true);
    }
  });

  it("exime el destino de cuarentena y los registros operativos estructurales", () => {
    for (const ns of ["quarantine/pending", "gov/audit", "gov/audit/actions", "gov/sub_egos"]) {
      const verdict = isSensitiveNamespace(ns);
      expect(verdict.sensitive, ns).toBe(false);
      expect(verdict.reason ?? "").toMatch(/exempt/);
    }
  });

  it("residual honesto documentado: namespaces con guion evaden el detector de prefijo", () => {
    // "crm-leads" no usa "/" → el prefijo crm/ no aplica. La regla de
    // contenido (SecretFilter, independiente del namespace) sigue activa.
    expect(isSensitiveNamespace("crm-leads").sensitive).toBe(false);
  });

  it("diferimiento residual: cero diferimientos (HIG-04 retiró system/snapshots; FIX-01 retiró crm/egos/checkpoints)", () => {
    // Retirados por lectores quarantine-aware (ver QUARANTINE_ENFORCEMENT_DEFERRALS):
    // crm/* (CrmDomain), egos/* (SubEgoMemoryGuard), system/checkpoints (EgoMemoryLifecycle),
    // system/snapshots + system/snapshots/daily (SessionCheckpointPolicy + DailyStatePersistence, HIG-04).
    for (const ns of ["crm/contacts", "egos/abc/state", "system/checkpoints", "system/snapshots", "system/snapshots/daily"]) {
      expect(isSensitiveNamespace(ns).sensitive, ns).toBe(true);
      expect(isEnforcementDeferred(ns), ns).toBe(false);
    }
    expect(isEnforcementDeferred("finance/transactions")).toBe(false);
    expect(isEnforcementDeferred("kb/docs")).toBe(false);
  });
});

describe("SEC-09 — Routing en el borde put/putMulti", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("contenido limpio en namespace sensible → quarantine/pending + aviso explícito", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { adapter, store } = stubHarness();

    const [report] = await adapter.putMulti([
      { namespace: "finance/transactions", key: "tx:1", payload: { amount: 100, note: "pago proveedor" } },
    ]);

    expect(report.routedTo).toBe("quarantine");
    expect(report.destinationNamespace).toBe("quarantine/pending");
    expect(report.destinationKey).toBe("finance/transactions:tx:1");
    // El original limpio se preserva íntegro en cuarentena (sin cifrado: el riesgo es at-rest, no el contenido).
    expect(await adapter.get("finance/transactions", "tx:1")).toBeNull();
    const quarantined = await adapter.get("quarantine/pending", "finance/transactions:tx:1");
    expect(quarantined).not.toBeNull();
    const meta = quarantined?.metadata as Record<string, unknown>;
    expect(meta["original_namespace"]).toBe("finance/transactions");
    expect(meta["unencrypted_at_rest"]).toBe(true);
    expect(String(meta["ui_notice"])).toMatch(/FIND-249/);
    expect(String(meta["ui_notice"])).toMatch(/quarantine\/pending/);
    // Aviso explícito por el canal de logs estructurados del main process.
    const warned = warnSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(warned).toMatch(/\[SEC-09\]/);
    expect(warned).toMatch(/FIND-249/);
    expect(store.size).toBeGreaterThan(0);
  });

  it("secreto en namespace NO sensible → bloqueado: 0 secretos en storage", async () => {
    const { adapter, store } = stubHarness();

    const [report] = await adapter.putMulti([
      { namespace: "kb/docs", key: "doc:leak", payload: `mi clave es ${CANARY} no la guardes` },
    ]);

    expect(report.routedTo).toBe("quarantine");
    expect(report.rules?.join(",")).toMatch(/canary/);
    // El original JAMÁS se persiste en ningún namespace.
    expect(await adapter.get("kb/docs", "doc:leak")).toBeNull();
    expect(storedPayloadsContain(store, CANARY)).toBe(false);
    // La copia en cuarentena está redactada.
    const quarantined = await adapter.get("quarantine/pending", "kb/docs:doc:leak");
    expect(quarantined).not.toBeNull();
    expect(JSON.stringify(quarantined)).not.toContain(CANARY);
    expect(JSON.stringify(quarantined?.metadata)).toMatch(/canary/);
  });

  it("secreto en namespace sensible → cuarentena redactada (doble causa)", async () => {
    const { adapter, store } = stubHarness();

    const [report] = await adapter.putMulti([
      { namespace: "finance/notes", key: "n:1", payload: `token ${CANARY}` },
    ]);

    expect(report.routedTo).toBe("quarantine");
    expect(storedPayloadsContain(store, CANARY)).toBe(false);
    expect(await adapter.get("finance/notes", "n:1")).toBeNull();
  });

  it("namespaces exentos (gov/audit, gov/sub_egos, quarantine/pending) escriben en live", async () => {
    const { adapter } = stubHarness();

    const reports = await adapter.putMulti([
      { namespace: "gov/audit", key: "a:1", payload: { action: "test" } },
      { namespace: "gov/sub_egos", key: "ego.x", payload: { id: "ego.x" } },
      { namespace: "quarantine/pending", key: "direct:1", payload: "nota operativa" },
    ]);

    expect(reports.every((r) => r.routedTo === "live")).toBe(true);
    expect((await adapter.get("gov/audit", "a:1"))?.payload).toEqual({ action: "test" });
  });

  it("system/snapshots ya NO difiere (HIG-04): va a cuarentena con lectura quarantine-aware; los secretos se bloquean igual", async () => {
    const { adapter, store } = stubHarness();

    const [routed] = await adapter.putMulti([
      { namespace: "system/snapshots", key: "checkpoint:sess:c1", payload: { turnCount: 5 } },
    ]);
    expect(routed.routedTo).toBe("quarantine");
    expect(routed.deferred).toBeUndefined();
    expect(await adapter.get("system/snapshots", "checkpoint:sess:c1")).toBeNull();
    // …pero la vía canónica lo resuelve con marca explícita.
    const hit = await adapter.getWithQuarantine("system/snapshots", "checkpoint:sess:c1");
    expect(hit).not.toBeNull();
    expect(hit?.quarantined).toBe(true);

    // crm/ ya NO difiere: tras FIX-01 va a cuarentena con lectura quarantine-aware.
    const [crmRouted] = await adapter.putMulti([
      { namespace: "crm/contacts", key: "c:fix01", payload: { name: "Ana" } },
    ]);
    expect(crmRouted.routedTo).toBe("quarantine");
    expect(crmRouted.deferred).toBeUndefined();
    expect(await adapter.get("crm/contacts", "c:fix01")).toBeNull();

    // La regla de secretos no admite diferimiento.
    const [blocked] = await adapter.putMulti([
      { namespace: "egos/x/scratchpad", key: "s:1", payload: `nota ${CANARY}` },
    ]);
    expect(blocked.routedTo).toBe("quarantine");
    expect(storedPayloadsContain(store, CANARY)).toBe(false);
  });

  it("put singular retorna el reporte de routing", async () => {
    const { adapter } = stubHarness();
    const live = await adapter.put({ namespace: "kb/docs", key: "k:1", payload: "hola" });
    expect(live.routedTo).toBe("live");
    const quarantined = await adapter.put({ namespace: "journal/entries", key: "j:1", payload: "diario" });
    expect(quarantined.routedTo).toBe("quarantine");
  });

  it("promote (supervisión explícita) libera a namespace sensible; con secretos lanza sin perder la fuente", async () => {
    const { adapter, store } = stubHarness();

    await adapter.quarantine(
      { namespace: "crm/leads", key: "lead:1", payload: { email: "a@corp.io" } },
      "third_party_webhook_untrusted"
    );
    await adapter.promote("crm/leads:lead:1", "crm/verified_leads", "lead:1");
    expect(((await adapter.get("crm/verified_leads", "lead:1"))?.payload as { email: string })).toEqual({
      email: "a@corp.io",
    });

    // Dato heredado con secreto en claro: la promoción se bloquea y la fuente se preserva.
    store.set("quarantine/pending:legacy:1", {
      payload: `clave ${CANARY}`,
      metadata: { original_namespace: "kb/docs", original_key: "legacy:1" },
    });
    await expect(adapter.promote("legacy:1", "kb/docs", "legacy:1")).rejects.toThrow(/ecret/);
    // Sin fuga a live…
    expect(await adapter.get("kb/docs", "legacy:1")).toBeNull();
    // …fuente legacy preservada intacta para saneamiento supervisado…
    expect(store.has("quarantine/pending:legacy:1")).toBe(true);
    // …y la copia de cuarentena generada por el bloqueo, redactada.
    const blockedCopy = store.get("quarantine/pending:kb/docs:legacy:1");
    expect(blockedCopy).toBeDefined();
    expect(JSON.stringify(blockedCopy)).not.toContain(CANARY);
  });

  it("FIX diferido SEC-04: el log de la ruta de error no filtra secretos (sanitizeForLog)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { adapter } = stubHarness();
    // Simula un motor que hace eco del contenido en el mensaje de error.
    (adapter as unknown as { db: { putBatch: unknown; put: unknown } }).db = {
      putBatch: async () => {
        throw new Error(`engine echo deliberado ${CANARY} fin`);
      },
      put: async () => {
        throw new Error(`engine echo deliberado ${CANARY} fin`);
      },
    };

    await expect(
      adapter.putMulti([{ namespace: "kb/docs", key: "k:err", payload: "limpio" }])
    ).rejects.toThrow();
    const logged = errSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logged.length).toBeGreaterThan(0);
    expect(logged).not.toContain(CANARY);
  });
});
