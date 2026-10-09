import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {
  SharedMemory,
  SharedMemoryAccessDeniedError,
  SharedMemoryLeaseConflictError,
  SharedMemoryLeaseExpiredError,
  SharedMemoryLeaseInvalidError,
  type SharedMemoryStorage,
  type SharedMemoryEventBus
} from "../src/SharedMemory.js";
import { EgoMemoryAdapter, type EgoPut } from "@ego/memory";

describe("SharedMemory — Protocolo de Intercambio de Contexto e Integración (SUB-05)", () => {
  let mockStorage: SharedMemoryStorage;
  let storedData: Map<string, any>;
  let mockEventBus: SharedMemoryEventBus;
  let emittedEvents: Array<{ type: string; payload: unknown }>;

  beforeEach(() => {
    storedData = new Map();
    emittedEvents = [];

    mockStorage = {
      put: vi.fn(async (item: EgoPut) => {
        const id = `${item.namespace}:::${item.key}`;
        storedData.set(id, item.payload);
      }),
      get: vi.fn(async (namespace: string, key: string) => {
        const id = `${namespace}:::${key}`;
        return storedData.get(id) ?? null;
      }),
      delete: vi.fn(async (namespace: string, key: string) => {
        const id = `${namespace}:::${key}`;
        return storedData.delete(id);
      }),
    };

    mockEventBus = {
      emit: vi.fn((type, payload) => {
        emittedEvents.push({ type, payload });
      }),
    };
  });

  describe("1. Confinamiento y Aislamiento por Proyecto", () => {
    it("debe generar el namespace canónico projects/<projectId>/shared", () => {
      const sm = new SharedMemory(mockStorage);
      expect(sm.getCanonicalNamespace("alpha-proj")).toBe("projects/alpha-proj/shared");
    });

    it("debe rechazar projectIds vacíos o con intentos de path traversal", () => {
      const sm = new SharedMemory(mockStorage);
      expect(() => sm.getCanonicalNamespace("")).toThrow(SharedMemoryAccessDeniedError);
      expect(() => sm.getCanonicalNamespace("../escaped")).toThrow(SharedMemoryAccessDeniedError);
      expect(() => sm.getCanonicalNamespace("proj/sub")).toThrow(SharedMemoryAccessDeniedError);
      expect(() => sm.getCanonicalNamespace("proj\\sub")).toThrow(SharedMemoryAccessDeniedError);
    });

    it("debe rechazar keys con intentos de escape de directorio", async () => {
      const sm = new SharedMemory(mockStorage);
      await expect(sm.publish("p1", "../key", "val")).rejects.toThrow(SharedMemoryAccessDeniedError);
      await expect(sm.publish("p1", "/root_key", "val")).rejects.toThrow(SharedMemoryAccessDeniedError);
    });
  });

  describe("2. Adquisición, Renovación y Expiración de Leases (TTL)", () => {
    it("debe adquirir un lease temporal atómico con TTL", async () => {
      const sm = new SharedMemory(mockStorage, { eventBus: mockEventBus });
      const lease = await sm.acquireLease("p1", "docs/specs", "ego.dev", 5000);

      expect(lease.leaseId).toBeDefined();
      expect(lease.projectId).toBe("p1");
      expect(lease.key).toBe("docs/specs");
      expect(lease.holderId).toBe("ego.dev");
      expect(lease.expiresAtMs).toBeGreaterThan(Date.now());
      expect(sm.isLeaseActive("p1", "docs/specs")).toBe(true);
      expect(mockEventBus.emit).toHaveBeenCalledWith("memory.updated", expect.anything(), expect.anything());
    });

    it("debe arrojar SharedMemoryLeaseConflictError si otro Sub-Ego intenta adquirir un lease activo", async () => {
      const sm = new SharedMemory(mockStorage);
      await sm.acquireLease("p1", "docs/specs", "ego.dev", 10000);

      await expect(
        sm.acquireLease("p1", "docs/specs", "ego.auditor", 5000)
      ).rejects.toThrow(SharedMemoryLeaseConflictError);
    });

    it("debe permitir adquirir un lease si el anterior ya expiró por TTL", async () => {
      const sm = new SharedMemory(mockStorage);
      // TTL de 1ms
      const l1 = await sm.acquireLease("p1", "docs/specs", "ego.dev", 1);
      // Esperar 15ms a que expire
      await new Promise((r) => setTimeout(r, 15));

      const l2 = await sm.acquireLease("p1", "docs/specs", "ego.auditor", 5000);
      expect(l2.holderId).toBe("ego.auditor");
      expect(l2.leaseId).not.toBe(l1.leaseId);
    });

    it("debe renovar un lease válido extendiendo su expiración", async () => {
      const sm = new SharedMemory(mockStorage);
      const l1 = await sm.acquireLease("p1", "docs/specs", "ego.dev", 1000);
      const renewed = await sm.renewLease("p1", "docs/specs", l1.leaseId, 8000);

      expect(renewed.leaseId).toBe(l1.leaseId);
      expect(renewed.expiresAtMs).toBeGreaterThan(l1.expiresAtMs);
    });

    it("debe rechazar renovación con leaseId incorrecto o expirado", async () => {
      const sm = new SharedMemory(mockStorage);
      const l1 = await sm.acquireLease("p1", "docs/specs", "ego.dev", 1000);

      await expect(
        sm.renewLease("p1", "docs/specs", "id-falso", 5000)
      ).rejects.toThrow(SharedMemoryLeaseInvalidError);

      // Expirado
      const lExpired = await sm.acquireLease("p1", "clave-expirada", "ego.dev", 1);
      await new Promise((r) => setTimeout(r, 15));
      await expect(
        sm.renewLease("p1", "clave-expirada", lExpired.leaseId, 5000)
      ).rejects.toThrow(SharedMemoryLeaseExpiredError);
    });

    it("debe liberar voluntariamente un lease", async () => {
      const sm = new SharedMemory(mockStorage);
      const l1 = await sm.acquireLease("p1", "docs/specs", "ego.dev", 5000);
      const ok = await sm.releaseLease("p1", "docs/specs", l1.leaseId);

      expect(ok).toBe(true);
      expect(sm.isLeaseActive("p1", "docs/specs")).toBe(false);

      // Otro agente puede adquirirlo de inmediato
      const l2 = await sm.acquireLease("p1", "docs/specs", "ego.auditor", 5000);
      expect(l2.holderId).toBe("ego.auditor");
    });
  });

  describe("3. Publicación, Versiones Monótonas y Lectura", () => {
    it("debe publicar valores y asignar version incremental", async () => {
      const sm = new SharedMemory(mockStorage);
      const r1 = await sm.publish("p1", "plan.json", { step: 1 }, { publishedBy: "ego.dev" });
      expect(r1.version).toBe(1);
      expect(r1.publishedBy).toBe("ego.dev");

      const r2 = await sm.publish("p1", "plan.json", { step: 2 }, { publishedBy: "ego.dev" });
      expect(r2.version).toBe(2);

      const fetched = await sm.read("p1", "plan.json");
      expect(fetched?.value).toEqual({ step: 2 });
      expect(fetched?.version).toBe(2);
    });

    it("debe bloquear publicación si la clave está retenida por otro Sub-Ego sin leaseId", async () => {
      const sm = new SharedMemory(mockStorage);
      await sm.acquireLease("p1", "plan.json", "ego.dev", 10000);

      await expect(
        sm.publish("p1", "plan.json", { hack: true }, { publishedBy: "ego.otro" })
      ).rejects.toThrow(SharedMemoryLeaseConflictError);
    });

    it("debe permitir publicar si se provee el leaseId correspondiente", async () => {
      const sm = new SharedMemory(mockStorage);
      const lease = await sm.acquireLease("p1", "plan.json", "ego.dev", 10000);

      const pub = await sm.publish("p1", "plan.json", { step: 1 }, {
        publishedBy: "ego.dev",
        leaseId: lease.leaseId
      });
      expect(pub.version).toBe(1);
    });

    it("readValue debe retornar directamente el valor desempaquetado", async () => {
      const sm = new SharedMemory(mockStorage);
      await sm.publish("p1", "metric", 42);

      const val = await sm.readValue("p1", "metric");
      expect(val).toBe(42);

      const nonExistent = await sm.readValue("p1", "no-existe");
      expect(nonExistent).toBeNull();
    });
  });

  describe("4. Consultas (query) y Filtros", () => {
    it("debe filtrar memorias por prefijo y por unleasedOnly", async () => {
      const sm = new SharedMemory(mockStorage);
      await sm.publish("p1", "docs/intro", "hola");
      await sm.publish("p1", "docs/specs", "contrato");
      await sm.publish("p1", "tasks/1", "todo");

      await sm.acquireLease("p1", "docs/specs", "ego.dev", 5000);

      const docs = await sm.query("p1", { prefix: "docs/" });
      expect(docs.length).toBe(2);

      const unleasedDocs = await sm.query("p1", { prefix: "docs/", unleasedOnly: true });
      expect(unleasedDocs.length).toBe(1);
      expect(unleasedDocs[0].key).toBe("docs/intro");
    });
  });

  describe("5. Suscripción Reactiva Pub/Sub", () => {
    it("debe invocar callbacks al publicar en claves coincidentes con el patrón", async () => {
      const sm = new SharedMemory(mockStorage);
      const received: any[] = [];

      const sub = sm.subscribe("docs/*", (rec, op) => {
        received.push({ key: rec.key, op });
      });

      await sm.publish("p1", "docs/readme", "contenido");
      await sm.publish("p1", "other/file", "ignorado");

      // Esperar microtask de notificación
      await new Promise((r) => setTimeout(r, 20));

      expect(received.length).toBe(1);
      expect(received[0].key).toBe("docs/readme");
      expect(received[0].op).toBe("publish");

      sub.unsubscribe();
    });
  });

  describe("6. Integración Real con NativeVantaDB sobre EgoMemoryAdapter", () => {
    it("debe persistir registros en disco y recuperarlos íntegros tras reinicio", async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ego-shared-memory-test-"));
      try {
        const adapter1 = new EgoMemoryAdapter(tmpDir);
        await adapter1.init();

        const sm1 = new SharedMemory(adapter1);
        await sm1.publish("proyecto-persistencia", "estado-global", {
          fase: "Fase 03",
          activo: true
        }, { publishedBy: "ego.nucleus" });

        await adapter1.flush();
        await adapter1.close();

        // Segunda instancia simulando reinicio de la aplicación
        const adapter2 = new EgoMemoryAdapter(tmpDir);
        await adapter2.init();

        const sm2 = new SharedMemory(adapter2);
        const record = await sm2.read("proyecto-persistencia", "estado-global");

        expect(record).toBeDefined();
        expect(record?.value).toEqual({ fase: "Fase 03", activo: true });
        expect(record?.publishedBy).toBe("ego.nucleus");
        expect(record?.namespace).toBe("projects/proyecto-persistencia/shared");

        await adapter2.close();
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    });
  });
});
