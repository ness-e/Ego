import { describe, it, expect, afterEach } from "vitest";
import { EgoMemoryAdapter } from "@ego/memory";
import { CrmDomain } from "../src/crm/CrmDomain.js";

/**
 * SEC-09 FIX-01 — CrmDomain quarantine-aware.
 * Tras el retiro de `crm/` del diferimiento, las escrituras limpias van a
 * `quarantine/pending` y `hydrate()/getContact()` las resuelven con marca
 * explícita (`isQuarantined()` + contador `quarantined` del reporte).
 */
function stubAdapter(): {
  adapter: EgoMemoryAdapter;
  store: Map<string, { payload: unknown; metadata: unknown }>;
} {
  const store = new Map<string, { payload: unknown; metadata: unknown }>();
  const db = {
    putBatch: async (recs: Array<{ namespace: string; key: string; payload: unknown; metadata: unknown }>) => {
      for (const r of recs) {
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
  const adapter = new EgoMemoryAdapter(`/tmp/ego-crm-fix-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  (adapter as unknown as { db: unknown }).db = db;
  return { adapter, store };
}

describe("CrmDomain quarantine-aware (SEC-09 FIX-01)", () => {
  afterEach(() => {
    // Sin estado global que limpiar: cada test usa su propio stub.
  });

  it("lo escrito en crm/* vive en cuarentena y se lee con marca explícita", async () => {
    const { adapter } = stubAdapter();
    const writer = new CrmDomain(adapter);
    const contact = await writer.createContact({ name: "Ana Cuarentena", email: "ana@corp.io" });

    // Tras FIX-01 crm/ ya no difiere: el live queda vacío…
    expect(await adapter.get("crm/contacts", contact.id)).toBeNull();
    // …pero el dominio marca lo enrutado en la propia sesión.
    expect(writer.isQuarantined(contact.id)).toBe(true);

    // Rehidratación fría (instancia nueva) resuelve vía cuarentena.
    const reader = await CrmDomain.open(adapter);
    const contacts = await reader.listContacts();
    expect(contacts).toHaveLength(1);
    expect(contacts[0].email).toBe("ana@corp.io");
    expect(reader.isQuarantined(contact.id)).toBe(true);
    expect(reader.listQuarantinedIds()).toContain(contact.id);
  });

  it("hydrate fusiona live heredado + cuarentena y cuenta ambos", async () => {
    const { adapter, store } = stubAdapter();
    // Registro heredado en live (previo al retiro del diferimiento).
    store.set("crm/contacts:cnt_legacy", {
      payload: JSON.stringify({
        id: "cnt_legacy",
        name: "Legado",
        email: "legado@corp.io",
        tags: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      metadata: {},
    });

    const writer = new CrmDomain(adapter);
    const fresh = await writer.createContact({ name: "Nueva", email: "nueva@corp.io" });

    const reader = new CrmDomain(adapter);
    const report = await reader.hydrate();
    expect(report.contacts).toBe(2);
    expect(report.quarantined).toBe(1);
    expect(reader.isQuarantined("cnt_legacy")).toBe(false);
    expect(reader.isQuarantined(fresh.id)).toBe(true);
  });

  it("getContact resuelve por clave vía cuarentena cuando el snapshot no lo tiene", async () => {
    const { adapter } = stubAdapter();
    const writer = new CrmDomain(adapter);
    const contact = await writer.createContact({ name: "Clave Directa", email: "clave@corp.io" });

    const cold = new CrmDomain(adapter);
    const found = await cold.getContact(contact.id);
    expect(found?.email).toBe("clave@corp.io");
    expect(cold.isQuarantined(contact.id)).toBe(true);
    expect(await cold.getContact("cnt_inexistente")).toBeUndefined();
  });

  it("deals e interacciones en cuarentena rehidratan con marca", async () => {
    const { adapter } = stubAdapter();
    const writer = new CrmDomain(adapter);
    const contact = await writer.createContact({ name: "Deal Q", email: "deal@corp.io" });
    const deal = await writer.createDeal({ title: "Deal cuarentena", valueUsd: 7000, contactId: contact.id });
    const interaction = await writer.recordInteraction({
      contactId: contact.id,
      kind: "note",
      summary: "Nota en cuarentena",
    });

    const reader = await CrmDomain.open(adapter);
    expect((await reader.listDeals())).toHaveLength(1);
    expect((await reader.getTimelineForContact(contact.id))).toHaveLength(1);
    expect(reader.isQuarantined(deal.id)).toBe(true);
    expect(reader.isQuarantined(interaction.id)).toBe(true);
  });
});
