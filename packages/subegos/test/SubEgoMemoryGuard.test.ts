import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EgoMemoryAdapter, EgoPut } from "@ego/memory";
import type { SearchHit } from "vantadb/types";
import {
  SubEgoMemoryGuard,
  SubEgoMemoryAccessDeniedError,
  SubEgoFactory
} from "../src/index.js";

describe("SubEgoMemoryGuard — Aislamiento de Estado Privado egos/<id>/* (SUB-04)", () => {
  let mockStorage: EgoMemoryAdapter;
  let putMultiCalls: EgoPut[][];
  let getCalls: Array<{ namespace: string; key: string }>;
  let deleteCalls: Array<{ namespace: string; key: string }>;

  beforeEach(() => {
    putMultiCalls = [];
    getCalls = [];
    deleteCalls = [];

    mockStorage = {
      putMulti: vi.fn(async (items: EgoPut[]) => {
        putMultiCalls.push(items);
      }),
      put: vi.fn(async (item: EgoPut) => {
        putMultiCalls.push([item]);
      }),
      get: vi.fn(async (namespace: string, key: string) => {
        getCalls.push({ namespace, key });
        return { key, payload: "mock-data" };
      }),
      delete: vi.fn(async (namespace: string, key: string) => {
        deleteCalls.push({ namespace, key });
        return true;
      }),
      searchMulti: vi.fn(async (namespaces: string[], query: string) => {
        return namespaces.map(
          (ns) =>
            ({
              id: "hit-1",
              namespace: ns,
              score: 0.95,
              text: query
            }) as unknown as SearchHit
        );
      }),
      recall: vi.fn(async (keyOrQuery: string, namespace?: string) => {
        return { key: keyOrQuery, namespace, payload: "recalled" };
      })
    } as unknown as EgoMemoryAdapter;
  });

  describe("1. Confinamiento Perimetral de Estado Privado", () => {
    it("debe permitir a un Sub-Ego leer y escribir en su propio namespace privado egos/<id>/*", async () => {
      const callerId = "ego.auditor-seguridad";
      const guard = new SubEgoMemoryGuard(mockStorage, { callerSubEgoId: callerId });

      // Escritura en su propio espacio
      await guard.putMulti([
        {
          namespace: "egos/ego.auditor-seguridad/scratchpad",
          key: "nota-1",
          payload: { text: "hallazgo" }
        }
      ]);

      expect(putMultiCalls.length).toBe(1);
      expect(putMultiCalls[0][0].key).toBe("nota-1");

      // Lectura de su propio espacio
      const record = await guard.get("egos/ego.auditor-seguridad/logs", "sesion-1");
      expect(record).toBeDefined();
      expect(getCalls.length).toBe(1);

      // Eliminación en su propio espacio
      const deleted = await guard.delete("egos/ego.auditor-seguridad/scratchpad", "nota-1");
      expect(deleted).toBe(true);
      expect(deleteCalls.length).toBe(1);
    });

    it("debe denegar terminantemente lecturas y escrituras en el estado privado de otro Sub-Ego", async () => {
      const callerId = "ego.auditor-seguridad";
      const targetOther = "egos/ego.otro-especialista/scratchpad";
      const guard = new SubEgoMemoryGuard(mockStorage, { callerSubEgoId: callerId });

      // Intento de escritura en espacio ajeno
      await expect(
        guard.putMulti([
          {
            namespace: targetOther,
            key: "inyeccion",
            payload: { exploit: true }
          }
        ])
      ).rejects.toThrow(SubEgoMemoryAccessDeniedError);

      expect(putMultiCalls.length).toBe(0); // Cero llamadas al storage

      // Intento de lectura en espacio ajeno
      await expect(guard.get(targetOther, "secreto")).rejects.toThrow(
        SubEgoMemoryAccessDeniedError
      );

      expect(getCalls.length).toBe(0);

      // Intento de eliminación en espacio ajeno
      await expect(guard.delete(targetOther, "secreto")).rejects.toThrow(
        SubEgoMemoryAccessDeniedError
      );

      expect(deleteCalls.length).toBe(0);
    });

    it("debe arrojar información detallada en SubEgoMemoryAccessDeniedError", () => {
      const guard = new SubEgoMemoryGuard(mockStorage, { callerSubEgoId: "ego.especialista-a" });

      try {
        guard.assertAccess("egos/ego.especialista-b/privado", "write");
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(SubEgoMemoryAccessDeniedError);
        const deniedErr = err as SubEgoMemoryAccessDeniedError;
        expect(deniedErr.callerId).toBe("ego.especialista-a");
        expect(deniedErr.requestedNamespace).toBe("egos/ego.especialista-b/privado");
        expect(deniedErr.operation).toBe("write");
      }
    });
  });

  describe("2. Validación Atómica en Operaciones por Lote (putMulti)", () => {
    it("debe abortar la totalidad del lote si un solo elemento viola la perimetría (sin escrituras parciales)", async () => {
      const callerId = "ego.auditor-seguridad";
      const guard = new SubEgoMemoryGuard(mockStorage, { callerSubEgoId: callerId });

      const batch: EgoPut[] = [
        {
          namespace: "egos/ego.auditor-seguridad/scratchpad",
          key: "item-valido-1",
          payload: "ok"
        },
        {
          namespace: "egos/ego.auditor-seguridad/scratchpad",
          key: "item-valido-2",
          payload: "ok"
        },
        {
          // Elemento malicioso en el lote
          namespace: "egos/ego.otro-agente/confidencial",
          key: "item-invalido",
          payload: "fuga"
        }
      ];

      await expect(guard.putMulti(batch)).rejects.toThrow(SubEgoMemoryAccessDeniedError);

      // Verificación de atomicidad: el storage no debe haber recibido NINGUNA llamada
      expect(putMultiCalls.length).toBe(0);
      expect(mockStorage.putMulti).not.toHaveBeenCalled();
    });
  });

  describe("3. Privilegio Nuclear (ego.nucleus)", () => {
    it("debe permitir al núcleo de Ego operar sin restricciones en todos los namespaces", async () => {
      const nucleusGuard = new SubEgoMemoryGuard(mockStorage, {
        callerSubEgoId: "ego.nucleus"
      });

      expect(nucleusGuard.isNucleus).toBe(true);

      // Escritura en cualquier namespace
      await nucleusGuard.putMulti([
        {
          namespace: "egos/cualquier-subego/estado",
          key: "inspeccion",
          payload: "gobernanza"
        },
        {
          namespace: "gov/sub_egos",
          key: "catalogo",
          payload: "metadatos"
        }
      ]);

      expect(putMultiCalls.length).toBe(1);

      // Lectura en cualquier namespace
      await nucleusGuard.get("egos/cualquier-subego/privado", "secreto");
      expect(getCalls.length).toBe(1);

      // Eliminación en cualquier namespace
      await nucleusGuard.delete("egos/cualquier-subego/privado", "registro");
      expect(deleteCalls.length).toBe(1);
    });
  });

  describe("4. Control de Acceso a Namespaces Compartidos según Manifiesto", () => {
    it("debe enforzar los namespaces declarados en el manifiesto del Sub-Ego", async () => {
      const manifest = SubEgoFactory.fromTemplate("code_reviewer", {
        name: "Revisor Alpha",
        namespaces: {
          read: ["kb/codebase", "kb/standards/*"],
          write: ["reviews/reports", "quarantine/pending"]
        }
      });

      const guard = new SubEgoMemoryGuard(mockStorage, {
        callerSubEgoId: manifest.id,
        manifest
      });

      // 1. Lectura a namespace permitido
      await guard.get("kb/codebase", "archivo.ts");
      await guard.get("kb/standards/estilo", "regla-1");
      expect(getCalls.length).toBe(2);

      // 2. Lectura a namespace no permitido -> Rechazado
      await expect(guard.get("crm/clientes", "cliente-1")).rejects.toThrow(
        SubEgoMemoryAccessDeniedError
      );

      // 3. Escritura a namespace permitido
      await guard.putMulti([
        {
          namespace: "reviews/reports",
          key: "reporte-1",
          payload: "aprobado"
        }
      ]);
      expect(putMultiCalls.length).toBe(1);

      // 4. Escritura a namespace sólo de lectura -> Rechazado
      await expect(
        guard.putMulti([
          {
            namespace: "kb/codebase",
            key: "modificacion",
            payload: "cambio"
          }
        ])
      ).rejects.toThrow(SubEgoMemoryAccessDeniedError);
    });
  });

  describe("5. Búsqueda y Recall Acotados por Perimetría", () => {
    it("debe permitir searchMulti en namespaces autorizados y rechazar en namespaces ajenos", async () => {
      const callerId = "ego.redactor";
      const guard = new SubEgoMemoryGuard(mockStorage, { callerSubEgoId: callerId });

      // Búsqueda en su propio namespace
      const results = await guard.searchMulti(["egos/ego.redactor"], "artículos");
      expect(results.length).toBe(1);

      // Búsqueda que incluye un namespace ajeno prohibido
      await expect(
        guard.searchMulti(["egos/ego.redactor", "egos/ego.otro-agente"], "datos")
      ).rejects.toThrow(SubEgoMemoryAccessDeniedError);
    });

    it("recall debe utilizar por defecto el namespace propio del Sub-Ego", async () => {
      const callerId = "ego.redactor";
      const guard = new SubEgoMemoryGuard(mockStorage, { callerSubEgoId: callerId });

      const res = await guard.recall("clave-1");
      expect(res).toBeDefined();
      expect(mockStorage.recall).toHaveBeenCalledWith("clave-1", "egos/ego.redactor");
    });
  });
});
