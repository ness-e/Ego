import { createTempWorkspace } from "@ego/tools";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import type { EgoMemoryAdapter, EgoPut } from "@ego/memory";
import {
  SubEgoRegistry,
  SubEgoRegistryNotFoundError,
  SubEgoSystemImmutableError,
  SubEgoRegistryValidationError
} from "../src/SubEgoRegistry.js";
import { createSubEgoManifest } from "../src/SubEgoManifest.js";
import type { SubEgoManifest } from "../src/types.js";

describe("SubEgoRegistry — Registro y catálogo en gov/sub_egos (SUB-07)", () => {
  let mockStorage: EgoMemoryAdapter;
  let storedRecords: Map<string, unknown>;
  let registry: SubEgoRegistry;

  const validUserManifest: SubEgoManifest = createSubEgoManifest({
    name: "Auditor de Código",
    role: "Especialista en QA y Arquitectura",
    instructions: "Analiza el código base en busca de vulnerabilidades y code smells.",
    capabilities: ["code_review", "ast_analysis"],
    tools: ["memory_recall", "git_status"],
    creator: "user"
  });

  const validNucleusManifest: SubEgoManifest = {
    id: "ego.nucleus",
    name: "Ego Nucleus",
    role: "Orquestador Central del Sistema Operativo Cognitivo",
    description: "Núcleo de gobernanza, orquestación y arbitraje HITL de Ego.",
    systemPrompt: "Eres Ego Nucleus, el coordinador central del sistema cognitivo.",
    responsibilities: ["Gobernanza", "Orquestación"],
    capabilities: ["system_coordination", "meta_cognition"],
    tools: ["memory_recall", "system_status"],
    permissions: ["*"],
    namespaces: { read: ["*"], write: ["*"] },
    behavior: { tone: "analytical", proactivity: "moderate", verbosity: "balanced" },
    autonomy: "autonomous",
    budget: { maxTokensPerCall: 8000, maxDailyCostUsd: 10.0, requiresApprovalAboveUsd: 1.0 },
    trigger: "manual",
    state: "active",
    creator: "ego-nucleus",
    createdAtMs: Date.now(),
    updatedAtMs: Date.now()
  };

  beforeEach(() => {
    storedRecords = new Map();

    mockStorage = {
      ready: true,
      init: vi.fn(async () => {}),
      put: vi.fn(async (item: EgoPut) => {
        storedRecords.set(`${item.namespace}:${item.key}`, item.payload);
      }),
      putMulti: vi.fn(async (items: EgoPut[]) => {
        for (const item of items) {
          storedRecords.set(`${item.namespace}:${item.key}`, item.payload);
        }
      }),
      get: vi.fn(async (namespace: string, key: string) => {
        return storedRecords.get(`${namespace}:${key}`) ?? null;
      }),
      delete: vi.fn(async (namespace: string, key: string) => {
        return storedRecords.delete(`${namespace}:${key}`);
      }),
      listSubEgos: vi.fn(async () => {
        const results: SubEgoManifest[] = [];
        for (const [k, v] of storedRecords.entries()) {
          if (k.startsWith("gov/sub_egos:")) {
            results.push(v as SubEgoManifest);
          }
        }
        return results;
      }),
      recordAudit: vi.fn(async () => {})
    } as unknown as EgoMemoryAdapter;

    registry = new SubEgoRegistry(mockStorage);
  });

  describe("1. Registro y Validación de Manifiestos (Step 1)", () => {
    it("debe registrar un Sub-Ego válido y persistirlo en gov/sub_egos/<id>", async () => {
      const registered = await registry.register(validUserManifest);

      expect(registered.id).toBe(validUserManifest.id);
      expect(mockStorage.put).toHaveBeenCalledWith(
        expect.objectContaining({
          namespace: "gov/sub_egos",
          key: validUserManifest.id,
          payload: validUserManifest
        })
      );

      const inStorage = await registry.get(validUserManifest.id);
      expect(inStorage).toEqual(validUserManifest);
    });

    it("debe rechazar manifiestos que no cumplan el esquema Zod arrojando SubEgoRegistryValidationError", async () => {
      const invalid = {
        ...validUserManifest,
        id: "INVALID_PREFIX_ID", // viola regex ^(ego\.[a-z0-9_-]+|sub_[a-z0-9_-]+)$
        systemPrompt: "corto" // viola min(10)
      } as unknown as SubEgoManifest;

      await expect(registry.register(invalid)).rejects.toThrow(SubEgoRegistryValidationError);
    });

    it("debe permitir actualizar un Sub-Ego de usuario existente", async () => {
      await registry.register(validUserManifest);

      const updated = {
        ...validUserManifest,
        description: "Nueva descripción actualizada con más detalles.",
        updatedAtMs: Date.now() + 1000
      };

      const result = await registry.register(updated);
      expect(result.description).toBe("Nueva descripción actualizada con más detalles.");

      const retrieved = await registry.get(validUserManifest.id);
      expect(retrieved?.description).toBe("Nueva descripción actualizada con más detalles.");
    });
  });

  describe("2. Inmutabilidad y Protección de Identidades del Sistema (Step 2)", () => {
    it("debe registrar ego.nucleus durante el bootstrap si el creator es 'ego-nucleus'", async () => {
      const result = await registry.register(validNucleusManifest);
      expect(result.id).toBe("ego.nucleus");
      expect(result.creator).toBe("ego-nucleus");
    });

    it("debe impedir registrar ego.nucleus si el creator no es 'ego-nucleus'", async () => {
      const forged = {
        ...validNucleusManifest,
        creator: "user" as const
      };

      await expect(registry.register(forged)).rejects.toThrow(SubEgoSystemImmutableError);
    });

    it("debe prohibir estrictamente modificar ego.nucleus una vez registrado", async () => {
      await registry.register(validNucleusManifest);

      const modified = {
        ...validNucleusManifest,
        name: "Nucleus Modificado Ilícitamente"
      };

      await expect(registry.register(modified)).rejects.toThrow(SubEgoSystemImmutableError);
    });

    it("debe prohibir eliminar (unregister) ego.nucleus u otras entidades protegidas", async () => {
      await registry.register(validNucleusManifest);

      await expect(registry.unregister("ego.nucleus")).rejects.toThrow(SubEgoSystemImmutableError);
    });

    it("debe prohibir deshabilitar (disable) ego.nucleus", async () => {
      await registry.register(validNucleusManifest);

      await expect(registry.disable("ego.nucleus")).rejects.toThrow(SubEgoSystemImmutableError);
    });

    it("debe proteger entidades configuradas en options.systemProtectedIds", async () => {
      const customProtectedId = "ego.core-auditor";
      const customManifest: SubEgoManifest = {
        ...createSubEgoManifest({
          name: "Core Auditor",
          role: "Auditor Core",
          instructions: "Auditor protegido por configuración del sistema."
        }),
        id: customProtectedId,
        creator: "ego-nucleus"
      };

      const strictRegistry = new SubEgoRegistry(mockStorage, {
        systemProtectedIds: [customProtectedId]
      });

      // Se registra inicialmente por el núcleo
      await strictRegistry.register(customManifest);

      // Ahora que existe, cualquier intento de eliminarlo o deshabilitarlo falla
      await expect(strictRegistry.unregister(customProtectedId)).rejects.toThrow(SubEgoSystemImmutableError);
      await expect(strictRegistry.disable(customProtectedId)).rejects.toThrow(SubEgoSystemImmutableError);
      await expect(strictRegistry.register(customManifest)).rejects.toThrow(SubEgoSystemImmutableError);
    });
  });

  describe("3. Métodos get, unregister, enable y disable (Step 2)", () => {
    it("get() debe devolver null si el Sub-Ego no existe", async () => {
      const result = await registry.get("ego.inexistente");
      expect(result).toBeNull();
    });

    it("get() debe devolver null y advertir si el registro almacenado está corrupto", async () => {
      storedRecords.set("gov/sub_egos:ego.corrupto", {
        id: "ego.corrupto",
        name: "Incompleto" // falta role, systemPrompt, etc.
      });

      const result = await registry.get("ego.corrupto");
      expect(result).toBeNull();
    });

    it("unregister() debe eliminar el registro en storage para Sub-Egos de usuario", async () => {
      await registry.register(validUserManifest);
      expect(await registry.has(validUserManifest.id)).toBe(true);

      const deleted = await registry.unregister(validUserManifest.id);
      expect(deleted).toBe(true);
      expect(await registry.has(validUserManifest.id)).toBe(false);
    });

    it("unregister() devuelve false si el ID no existe (o arroja error si throwIfNotFound es true)", async () => {
      const deleted = await registry.unregister("ego.fantasma");
      expect(deleted).toBe(false);

      await expect(
        registry.unregister("ego.fantasma", { throwIfNotFound: true })
      ).rejects.toThrow(SubEgoRegistryNotFoundError);
    });

    it("disable() debe aplicar soft-delete pasando el estado a 'paused' (o 'archived')", async () => {
      await registry.register(validUserManifest);

      const paused = await registry.disable(validUserManifest.id);
      expect(paused.state).toBe("paused");

      const inStorage = await registry.get(validUserManifest.id);
      expect(inStorage?.state).toBe("paused");

      const archived = await registry.disable(validUserManifest.id, { archive: true });
      expect(archived.state).toBe("archived");
    });

    it("enable() debe reactivar un Sub-Ego pausado o archivado pasando su estado a 'active'", async () => {
      await registry.register(validUserManifest);
      await registry.disable(validUserManifest.id);

      const activated = await registry.enable(validUserManifest.id);
      expect(activated.state).toBe("active");

      const inStorage = await registry.get(validUserManifest.id);
      expect(inStorage?.state).toBe("active");
    });

    it("enable() y disable() deben arrojar SubEgoRegistryNotFoundError si el Sub-Ego no existe", async () => {
      await expect(registry.enable("ego.no-existe")).rejects.toThrow(SubEgoRegistryNotFoundError);
      await expect(registry.disable("ego.no-existe")).rejects.toThrow(SubEgoRegistryNotFoundError);
    });
  });

  describe("4. Listado y Filtrado por Dominio, Tags, Tools y Estado (Step 3)", () => {
    let devEgo: SubEgoManifest;
    let researchEgo: SubEgoManifest;
    let marketingEgo: SubEgoManifest;

    beforeEach(async () => {
      devEgo = createSubEgoManifest({
        name: "Dev Lead",
        role: "Ingeniero Principal de Software",
        instructions: "Especialista en arquitectura y depuración profunda de código.",
        tools: ["memory_recall", "terminal_exec", "git_status"],
        capabilities: ["code_generation", "refactoring"],
        creator: "user"
      });
      devEgo.metadata = {
        domain: "engineering",
        tags: ["typescript", "backend", "performance"]
      };

      researchEgo = createSubEgoManifest({
        name: "Research Lead",
        role: "Investigador Científico",
        instructions: "Especialista en recopilación y contraste de papers técnicos.",
        tools: ["memory_recall", "web_search", "document_reader"],
        capabilities: ["literature_search", "synthesis"],
        creator: "user"
      });
      researchEgo.metadata = {
        domain: "research",
        tags: ["papers", "science", "synthesis"]
      };

      marketingEgo = createSubEgoManifest({
        name: "Copywriter Pro",
        role: "Redactor Publicitario B2B",
        instructions: "Genera copys atractivos y campañas de marketing directas.",
        tools: ["memory_recall"],
        capabilities: ["content_creation"],
        creator: "template"
      });
      marketingEgo.metadata = {
        domain: "marketing",
        tags: ["b2b", "content", "sales"]
      };

      await registry.register(devEgo);
      await registry.register(researchEgo);
      await registry.register(marketingEgo);
      await registry.register(validNucleusManifest);
    });

    it("list() sin filtros debe listar todos los Sub-Egos válidos", async () => {
      const all = await registry.list();
      expect(all.length).toBe(4);
      expect(await registry.count()).toBe(4);
    });

    it("debe filtrar por dominio", async () => {
      const eng = await registry.list({ domain: "engineering" });
      expect(eng.length).toBe(1);
      expect(eng[0].id).toBe(devEgo.id);

      const res = await registry.list({ domain: "research" });
      expect(res.length).toBe(1);
      expect(res[0].id).toBe(researchEgo.id);

      const missing = await registry.list({ domain: "finance" });
      expect(missing.length).toBe(0);
    });

    it("debe filtrar por tags", async () => {
      const tsMatches = await registry.list({ tags: ["typescript"] });
      expect(tsMatches.length).toBe(1);
      expect(tsMatches[0].id).toBe(devEgo.id);

      const multiMatches = await registry.list({ tags: ["science", "synthesis"] });
      expect(multiMatches.length).toBe(1);
      expect(multiMatches[0].id).toBe(researchEgo.id);

      const noMatches = await registry.list({ tags: ["non_existent_tag"] });
      expect(noMatches.length).toBe(0);
    });

    it("debe filtrar por herramientas requeridas (tools)", async () => {
      const withGit = await registry.list({ tools: ["git_status"] });
      expect(withGit.length).toBe(1);
      expect(withGit[0].id).toBe(devEgo.id);

      const withRecall = await registry.list({ tools: ["memory_recall"] });
      expect(withRecall.length).toBe(4); // Todos tienen memory_recall

      const withWeb = await registry.list({ tools: ["web_search"] });
      expect(withWeb.length).toBe(1);
      expect(withWeb[0].id).toBe(researchEgo.id);
    });

    it("debe filtrar por capacidades requeridas (capabilities)", async () => {
      const refactoringList = await registry.list({ capabilities: ["refactoring"] });
      expect(refactoringList.length).toBe(1);
      expect(refactoringList[0].id).toBe(devEgo.id);

      const nucleusCoord = await registry.list({ capabilities: ["system_coordination"] });
      expect(nucleusCoord.length).toBe(1);
      expect(nucleusCoord[0].id).toBe("ego.nucleus");
    });

    it("debe filtrar por estado 'enabled' y 'disabled' y estado exacto", async () => {
      await registry.disable(marketingEgo.id); // 'paused'

      const enabled = await registry.list({ state: "enabled" });
      expect(enabled.length).toBe(3);
      expect(enabled.some((e) => e.id === marketingEgo.id)).toBe(false);

      const disabled = await registry.list({ state: "disabled" });
      expect(disabled.length).toBe(1);
      expect(disabled[0].id).toBe(marketingEgo.id);

      const pausedExact = await registry.list({ state: "paused" });
      expect(pausedExact.length).toBe(1);

      const archivedExact = await registry.list({ state: "archived" });
      expect(archivedExact.length).toBe(0);
    });

    it("debe filtrar por creador (creator)", async () => {
      const userCreated = await registry.list({ creator: "user" });
      expect(userCreated.length).toBe(2);

      const nucleusCreated = await registry.list({ creator: "ego-nucleus" });
      expect(nucleusCreated.length).toBe(1);
      expect(nucleusCreated[0].id).toBe("ego.nucleus");

      const templateCreated = await registry.list({ creator: "template" });
      expect(templateCreated.length).toBe(1);
      expect(templateCreated[0].id).toBe(marketingEgo.id);
    });

    it("debe omitir registros corruptos en el catálogo sin fallar ni quebrar el arranque", async () => {
      storedRecords.set("gov/sub_egos:ego.corrupto_1", { id: "ego.corrupto_1", garbage: true });
      storedRecords.set("gov/sub_egos:ego.corrupto_2", "payload no estructurado");

      const validList = await registry.list();
      expect(validList.length).toBe(4); // Solo los 4 válidos
    });
  });

  describe("5. Integración y Persistencia Tras Reinicio sobre EgoMemoryAdapter (Step 4)", () => {
    let testStorageDir: string;
    let realAdapter1: EgoMemoryAdapter | null = null;
    let realAdapter2: EgoMemoryAdapter | null = null;

    beforeEach(async () => {
    testStorageDir = createTempWorkspace({ prefix: "ego-registry-persist" }).path;
      await fs.mkdir(testStorageDir, { recursive: true });
    });

    afterEach(async () => {
      if (realAdapter1 && realAdapter1.ready) {
        await realAdapter1.close();
      }
      if (realAdapter2 && realAdapter2.ready) {
        await realAdapter2.close();
      }
      try {
        await fs.rm(testStorageDir, { recursive: true, force: true });
      } catch {
        // Ignorar posibles locks en Windows
      }
    });

    it("debe persistir Sub-Egos en disco y recuperarlos íntegros tras reinicio en una nueva instancia", async () => {
      const { EgoMemoryAdapter } = await import("@ego/memory");

      // Sesión 1: Registro y persistencia
      realAdapter1 = new EgoMemoryAdapter(testStorageDir);
      await realAdapter1.init();

      const registry1 = new SubEgoRegistry(realAdapter1);

      const persistentSubEgo = createSubEgoManifest({
        name: "Especialista Persistente",
        role: "Auditor de Persistencia",
        instructions: "Verifica que los datos persisten a través de reinicios completos del sistema.",
        tools: ["memory_recall", "disk_sync"],
        creator: "user"
      });
      persistentSubEgo.metadata = { domain: "engineering", tags: ["storage", "persistence"] };

      await registry1.register(persistentSubEgo);
      await registry1.register(validNucleusManifest);

      // Deshabilitar el especialista de prueba para comprobar que su estado también persiste
      await registry1.disable(persistentSubEgo.id);

      await realAdapter1.flush();
      await realAdapter1.close();
      realAdapter1 = null;

      // Sesión 2: Simulación de reinicio de la aplicación Ego
      realAdapter2 = new EgoMemoryAdapter(testStorageDir);
      await realAdapter2.init();

      const registry2 = new SubEgoRegistry(realAdapter2);

      // 1. Verificación de get por ID recuperado de disco
      const retrieved = await registry2.get(persistentSubEgo.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(persistentSubEgo.id);
      expect(retrieved?.name).toBe("Especialista Persistente");
      expect(retrieved?.state).toBe("paused"); // Persistió el soft-delete

      // 2. Verificación de ego.nucleus y protección persistida
      const retrievedNucleus = await registry2.get("ego.nucleus");
      expect(retrievedNucleus).not.toBeNull();
      expect(retrievedNucleus?.id).toBe("ego.nucleus");

      // La protección contra eliminación y edición debe seguir activa tras reinicio
      await expect(registry2.unregister("ego.nucleus")).rejects.toThrow(SubEgoSystemImmutableError);
      await expect(registry2.disable("ego.nucleus")).rejects.toThrow(SubEgoSystemImmutableError);
      await expect(registry2.register(retrievedNucleus!)).rejects.toThrow(SubEgoSystemImmutableError);

      // 3. Verificación de list() y filtros desde disco
      const diskList = await registry2.list();
      expect(diskList.length).toBe(2);

      const filteredByTag = await registry2.list({ tags: ["persistence"] });
      expect(filteredByTag.length).toBe(1);
      expect(filteredByTag[0].id).toBe(persistentSubEgo.id);

      const filteredDisabled = await registry2.list({ state: "disabled" });
      expect(filteredDisabled.length).toBe(1);
      expect(filteredDisabled[0].id).toBe(persistentSubEgo.id);
    }, 30000);
  });
});
