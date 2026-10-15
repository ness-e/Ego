import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SharedMemory,
  SharedMemoryLeaseConflictError,
  SharedMemoryVersionConflictError,
  type SharedMemoryStorage,
  type SharedMemoryEventBus,
} from "../src/SharedMemory.js";
import type { EgoPut } from "@ego/memory";

/**
 * STAB-06 — CAS opt-in (`expectedVersion`) + projector (vista + retrieve
 * sin broadcast + `contextText`). TDD RED: estos símbolos aún no existen.
 */
describe("SharedMemory CAS + projector (STAB-06)", () => {
  let mockStorage: SharedMemoryStorage;
  let storedData: Map<string, unknown>;
  let mockEventBus: SharedMemoryEventBus;
  let emittedEvents: Array<{ type: string; payload: unknown }>;

  beforeEach(() => {
    storedData = new Map();
    emittedEvents = [];
    mockStorage = {
      put: vi.fn(async (item: EgoPut) => {
        storedData.set(`${item.namespace}:::${item.key}`, item.payload);
      }),
      get: vi.fn(async (namespace: string, key: string) => {
        return storedData.get(`${namespace}:::${key}`) ?? null;
      }),
      delete: vi.fn(async (namespace: string, key: string) => {
        return storedData.delete(`${namespace}:::${key}`);
      }),
    };
    mockEventBus = {
      emit: vi.fn((type, payload) => {
        emittedEvents.push({ type, payload });
      }),
    };
  });

  describe("CAS — expectedVersion opcional", () => {
    it("publica con expectedVersion coincidente e incrementa versión", async () => {
      const sm = new SharedMemory(mockStorage);
      const r1 = await sm.publish("p1", "plan.json", { step: 1 });
      expect(r1.version).toBe(1);
      const r2 = await sm.publish("p1", "plan.json", { step: 2 }, { expectedVersion: 1 });
      expect(r2.version).toBe(2);
    });

    it("arroja VersionConflict ante expectedVersion obsoleta", async () => {
      const sm = new SharedMemory(mockStorage);
      await sm.publish("p1", "plan.json", { step: 1 });
      await sm.publish("p1", "plan.json", { step: 2 });
      const err = await sm
        .publish("p1", "plan.json", { step: 3 }, { expectedVersion: 1 })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SharedMemoryVersionConflictError);
      const conflict = err as SharedMemoryVersionConflictError;
      expect(conflict.expectedVersion).toBe(1);
      expect(conflict.actualVersion).toBe(2);
      expect(conflict.projectId).toBe("p1");
      expect(conflict.key).toBe("plan.json");
    });

    it("permite primera escritura con expectedVersion 0 y rechaza con 5", async () => {
      const sm = new SharedMemory(mockStorage);
      const r = await sm.publish("p1", "nueva", "v", { expectedVersion: 0 });
      expect(r.version).toBe(1);
      await expect(
        sm.publish("p1", "otra", "v", { expectedVersion: 5 })
      ).rejects.toThrow(SharedMemoryVersionConflictError);
    });

    it("sin expectedVersion conserva conducta legacy exacta", async () => {
      const sm = new SharedMemory(mockStorage);
      const r1 = await sm.publish("p1", "k", "a");
      const r2 = await sm.publish("p1", "k", "b");
      expect(r1.version).toBe(1);
      expect(r2.version).toBe(2);
    });

    it("VersionConflict no pisa el registro almacenado", async () => {
      const sm = new SharedMemory(mockStorage);
      await sm.publish("p1", "k", "a");
      await expect(
        sm.publish("p1", "k", "b", { expectedVersion: 99 })
      ).rejects.toThrow(SharedMemoryVersionConflictError);
      expect(await sm.readValue("p1", "k")).toBe("a");
    });

    it("lease-first: lease ajeno + expectedVersion correcta → LeaseConflict", async () => {
      const sm = new SharedMemory(mockStorage);
      await sm.publish("p1", "k", "a");
      await sm.acquireLease("p1", "k", "ego.dev", 10000);
      await expect(
        sm.publish("p1", "k", "b", { publishedBy: "ego.otro", expectedVersion: 1 })
      ).rejects.toThrow(SharedMemoryLeaseConflictError);
    });

    it("titular del lease + expectedVersion correcta → publica", async () => {
      const sm = new SharedMemory(mockStorage);
      await sm.publish("p1", "k", "a");
      const lease = await sm.acquireLease("p1", "k", "ego.dev", 10000);
      const r = await sm.publish(
        "p1",
        "k",
        "b",
        { publishedBy: "ego.dev", leaseId: lease.leaseId, expectedVersion: 1 }
      );
      expect(r.version).toBe(2);
    });

    it("titular del lease + expectedVersion obsoleta → VersionConflict", async () => {
      const sm = new SharedMemory(mockStorage);
      await sm.publish("p1", "k", "a");
      const lease = await sm.acquireLease("p1", "k", "ego.dev", 10000);
      await sm.releaseLease("p1", "k", lease.leaseId);
      await sm.publish("p1", "k", "b"); // v2 sin lease
      const lease2 = await sm.acquireLease("p1", "k", "ego.dev", 10000);
      await expect(
        sm.publish("p1", "k", "c", { leaseId: lease2.leaseId, expectedVersion: 1 })
      ).rejects.toThrow(SharedMemoryVersionConflictError);
    });
  });

  describe("projector — vista {key,version,leaseHolder}", () => {
    it("retorna vista con holder tras acquireLease", async () => {
      const sm = new SharedMemory(mockStorage);
      await sm.publish("p1", "plan.json", { step: 1 });
      await sm.acquireLease("p1", "plan.json", "ego.dev", 5000);
      const view = await sm.getProjectedView("p1", "plan.json");
      expect(view).toEqual({ key: "plan.json", version: 1, leaseHolder: "ego.dev" });
    });

    it("leaseHolder null sin lease y null ante clave ausente", async () => {
      const sm = new SharedMemory(mockStorage);
      await sm.publish("p1", "k", "v");
      expect(await sm.getProjectedView("p1", "k")).toEqual({
        key: "k",
        version: 1,
        leaseHolder: null,
      });
      expect(await sm.getProjectedView("p1", "ausente")).toBeNull();
    });
  });

  describe("projector — retrieve sin broadcast", () => {
    it("retrieve no notifica suscriptores ni emite al eventBus", async () => {
      const sm = new SharedMemory(mockStorage, { eventBus: mockEventBus });
      await sm.publish("p1", "k", "v");
      emittedEvents.length = 0;
      const received: unknown[] = [];
      const sub = sm.subscribe("*", (rec) => {
        received.push(rec);
      });
      const rec = await sm.retrieve("p1", "k");
      expect(rec?.value).toBe("v");
      await new Promise((r) => setTimeout(r, 20));
      expect(received.length).toBe(0);
      expect(emittedEvents.length).toBe(0);
      sub.unsubscribe();
    });
  });

  describe("projector — projectRecords materializa contextText", () => {
    it("materializa claves/versiones/valores con tokenEstimate", () => {
      const sm = new SharedMemory(mockStorage);
      const out = sm.projectRecords([
        {
          projectId: "p1",
          key: "a",
          value: "hola",
          namespace: "projects/p1/shared",
          version: 2,
          createdAtMs: 1,
          updatedAtMs: 2,
        },
        {
          projectId: "p1",
          key: "b",
          value: { n: 1 },
          namespace: "projects/p1/shared",
          version: 1,
          createdAtMs: 1,
          updatedAtMs: 2,
        },
      ]);
      expect(out.contextText).toContain("a@v2");
      expect(out.contextText).toContain("hola");
      expect(out.tokenEstimate).toBeGreaterThan(0);
      expect(out.truncated).toBe(false);
      expect(out.recordCount).toBe(2);
    });

    it("trunca valores largos y respeta maxRecords", () => {
      const sm = new SharedMemory(mockStorage);
      const out = sm.projectRecords(
        [1, 2, 3].map((i) => ({
          projectId: "p1",
          key: `k${i}`,
          value: "x".repeat(5000),
          namespace: "projects/p1/shared",
          version: 1,
          createdAtMs: 1,
          updatedAtMs: 2,
        })),
        { maxCharsPerValue: 100, maxRecords: 2 }
      );
      expect(out.truncated).toBe(true);
      expect(out.recordCount).toBe(2);
      expect(out.contextText.length).toBeLessThan(2000);
    });

    it("snapshot vacío → contextText vacío con estimate 0", () => {
      const sm = new SharedMemory(mockStorage);
      const out = sm.projectRecords([]);
      expect(out.contextText).toBe("");
      expect(out.tokenEstimate).toBe(0);
    });
  });

  describe("projector — projectSnapshot integra lectura + proyección", () => {
    it("proyecta claves leídas del storage sin broadcast", async () => {
      const sm = new SharedMemory(mockStorage, { eventBus: mockEventBus });
      await sm.publish("p1", "docs/a", "alpha");
      await sm.publish("p1", "docs/b", "beta");
      emittedEvents.length = 0;
      const out = await sm.projectSnapshot("p1", ["docs/a", "docs/b"]);
      expect(out.recordCount).toBe(2);
      expect(out.contextText).toContain("alpha");
      expect(out.contextText).toContain("beta");
      expect(emittedEvents.length).toBe(0);
    });
  });
});
