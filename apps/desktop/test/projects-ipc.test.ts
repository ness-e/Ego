import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ProjectManifestSchema, CreateProjectSchema, SelectProjectSchema } from "../src/ipc/schema.js";
import { EgoMemoryAdapter } from "@ego/memory";
import { getOrCreateDefaultProject } from "../src/main.js";
import { createScratchDir, removeScratchDir } from "./helpers/test-scratch.js";

describe("@ego/desktop — Project Entity & Dynamic Isolation (INT-03)", () => {
  let tmpDir: string;
  let adapter: EgoMemoryAdapter;

  beforeEach(async () => {
    tmpDir = createScratchDir("ego-proj-test");
    adapter = new EgoMemoryAdapter(tmpDir);
    await adapter.init();
  });

  afterEach(async () => {
    try {
      await adapter.close();
      removeScratchDir(tmpDir);
    } catch {
      // ignore
    }
  });

  describe("1. Validación de Esquemas Zod (ProjectManifest)", () => {
    it("Valida un ProjectManifest completo y canónico", () => {
      const valid = ProjectManifestSchema.safeParse({
        id: "proj_ego_core",
        name: "Ego Core System",
        rootPath: "c:/projects/ego",
        description: "Entorno principal de desarrollo",
        activeSubEgoId: "ego.nucleus",
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.id).toBe("proj_ego_core");
        expect(valid.data.name).toBe("Ego Core System");
      }
    });

    it("Rechaza ProjectManifest con campos requeridos ausentes o inválidos", () => {
      const invalid = ProjectManifestSchema.safeParse({
        name: "Sin ID",
        rootPath: "/ruta",
      });
      expect(invalid.success).toBe(false);
    });

    it("Valida CreateProjectSchema con ruta y nombre válidos", () => {
      const valid = CreateProjectSchema.safeParse({
        name: "Nuevo Proyecto",
        rootPath: "c:/Users/Dev/App",
        description: "Descripción opcional",
      });
      expect(valid.success).toBe(true);
    });

    it("Rechaza CreateProjectSchema con nombre vacío", () => {
      const invalid = CreateProjectSchema.safeParse({
        name: "",
        rootPath: "c:/Users/Dev/App",
      });
      expect(invalid.success).toBe(false);
    });

    it("Valida SelectProjectSchema con ID válido", () => {
      const valid = SelectProjectSchema.safeParse({
        id: "proj_abc123",
      });
      expect(valid.success).toBe(true);
    });
  });

  describe("2. getOrCreateDefaultProject y Persistencia en VantaDB", () => {
    it("Crea e inicializa el proyecto default si no existe en gov/projects", async () => {
      const defaultProj = await getOrCreateDefaultProject(adapter);
      expect(defaultProj.id).toBe("default");
      expect(defaultProj.name).toBe("Ego Core");
      expect(defaultProj.activeSubEgoId).toBe("ego.nucleus");

      // SEC-09 (promote supervisado): `gov/projects` se escribe en cuarentena
      // por defecto; el consumidor real promueve antes de leer en live.
      await adapter.promote("gov/projects:default", "gov/projects", "default");

      // Verificar persistencia en VantaDB
      const stored = await adapter.get("gov/projects", "default");
      expect(stored).toBeDefined();
    });

    it("Recupera el proyecto existente sin sobreescribirlo si ya fue creado", async () => {
      // Creamos proyecto previo personalizado
      const customProject = {
        id: "default",
        name: "Ego Custom Default",
        rootPath: tmpDir,
        description: "Personalizado",
        activeSubEgoId: "ego.dev",
        createdAtMs: 1234567,
        updatedAtMs: 1234567,
      };

      await adapter.put({
        namespace: "gov/projects",
        key: "default",
        payload: customProject,
      });

      // SEC-09 (promote supervisado): sin esto, `getOrCreateDefaultProject`
      // (lectura live) no vería el custom e inicializaría el default.
      await adapter.promote("gov/projects:default", "gov/projects", "default");

      const retrieved = await getOrCreateDefaultProject(adapter);
      expect(retrieved.id).toBe("default");
      expect(retrieved.name).toBe("Ego Custom Default");
      expect(retrieved.activeSubEgoId).toBe("ego.dev");
    });
  });
});
