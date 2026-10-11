import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { EgoMemoryAdapter } from "@ego/memory";
import {
  CharacterProfileSchema,
  createDefaultCharacterProfile,
  saveCharacterProfile,
  loadCharacterProfile,
  validateNoHumanClothing,
  BANNED_HUMAN_CLOTHING,
  type CharacterProfile
} from "../src/CharacterProfile.js";
import { SubEgoManifestSchema } from "../src/SubEgoManifest.js";

describe("CharacterProfile — Contrato de Identidad Visual y Rasgos Anatómicos (CHAR-04)", () => {
  let tmpDir: string;
  let adapter: EgoMemoryAdapter;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `ego-char-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    await fs.mkdir(tmpDir, { recursive: true });
    adapter = new EgoMemoryAdapter(tmpDir);
    await adapter.init();
  });

  afterEach(async () => {
    try {
      if (adapter && adapter.ready) {
        await adapter.close();
      }
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignorar errores de cleanup en Windows
    }
  });

  describe("1. Validación de Esquema Zod y Formas Base", () => {
    it("debe validar correctamente un perfil con todas las formas canónicas no humanoides", () => {
      const validForms = ["quantum-monolith", "energy-core", "fractal-polyhedron", "delta-core", "coucou-mochi"] as const;

      for (const form of validForms) {
        const profile = CharacterProfileSchema.parse({
          id: `char_test_${form.replace("-", "_")}`,
          name: `Avatar ${form}`,
          baseForm: form,
          palette: {
            primary: "#00E5FF",
            secondary: "#0077B6",
            accent: "#00B4D8",
            aura: "rgba(0, 229, 255, 0.4)"
          }
        });

        expect(profile.baseForm).toBe(form);
        expect(profile.palette.primary).toBe("#00E5FF");
      }
    });

    it("debe rechazar formas anatómicas humanoides no reconocidas", () => {
      expect(() => {
        CharacterProfileSchema.parse({
          id: "char_humanoid",
          name: "Humano",
          baseForm: "human-avatar" as any,
          palette: {
            primary: "#FFFFFF",
            secondary: "#000000",
            accent: "#FF0000",
            aura: "#00FF00"
          }
        });
      }).toThrow();
    });

    it("debe validar colores en formato hexadecimal y rgb/rgba y rechazar valores inválidos", () => {
      expect(() => {
        CharacterProfileSchema.parse({
          id: "char_bad_color",
          name: "Bad Color",
          palette: {
            primary: "azul-cielo", // Inválido
            secondary: "#000",
            accent: "#FFF",
            aura: "rgba(0,0,0,0.5)"
          }
        });
      }).toThrow(/Formato de color inválido/);
    });
  });

  describe("2. Rasgos Anatómicos y Prohibición de Vestimenta Humana", () => {
    it("debe permitir traits abstractos y energéticos permitidos", () => {
      const profile = CharacterProfileSchema.parse({
        id: "char_traits_ok",
        name: "Entidad con Halo",
        palette: {
          primary: "#A855F7",
          secondary: "#6B21A8",
          accent: "#C084FC",
          aura: "rgba(168, 85, 247, 0.35)"
        },
        traits: [
          { kind: "halo", intensity: 0.9, color: "#FFD700", enabled: true },
          { kind: "energy-cores", intensity: 1, enabled: true },
          { kind: "orbital-rings", intensity: 0.5, enabled: false }
        ]
      });

      expect(profile.traits).toHaveLength(3);
      expect(profile.traits[0].kind).toBe("halo");
    });

    it("debe rechazar y lanzar error explícito si se detecta vestimenta humana obsoleta", () => {
      for (const banned of BANNED_HUMAN_CLOTHING) {
        expect(() => {
          validateNoHumanClothing({
            id: "char_banned",
            outfit: banned
          });
        }).toThrow(/vestimenta humana obsoleta/);
      }
    });
  });

  describe("3. createDefaultCharacterProfile (Generador de Identidades Armónicas)", () => {
    it("debe generar paleta cyan/azul para dominio engineering o code", () => {
      const profile = createDefaultCharacterProfile("ego.dev-coder", "engineering");
      expect(profile.id).toBe("char_dev-coder");
      expect(profile.palette.primary).toBe("#00E5FF");
      expect(profile.baseForm).toBe("delta-core");
      expect(profile.traits[0].kind).toBe("aura-field");
    });

    it("debe generar paleta púrpura para dominio knowledge o research", () => {
      const profile = createDefaultCharacterProfile("ego.researcher", "knowledge");
      expect(profile.palette.primary).toBe("#A855F7");
    });

    it("debe generar paleta ámbar para dominio product", () => {
      const profile = createDefaultCharacterProfile("ego.pm", "product");
      expect(profile.palette.primary).toBe("#F59E0B");
    });
  });

  describe("4. Integración y Vínculo con SubEgoManifest", () => {
    it("debe permitir que un SubEgoManifest contenga un CharacterProfile válido", () => {
      const charProfile = createDefaultCharacterProfile("ego.nucleus", "nucleus");

      const manifest = SubEgoManifestSchema.parse({
        id: "ego.nucleus",
        name: "Ego Nucleus",
        role: "Orquestador Central",
        description: "Coordinador cognitivo del sistema Ego",
        systemPrompt: "Eres Ego Nucleus, el sistema operativo cognitivo central.",
        namespaces: { read: ["*"], write: ["*"] },
        character: charProfile
      });

      expect(manifest.character).toBeDefined();
      expect(manifest.character?.id).toBe("char_nucleus");
      expect(manifest.character?.palette.primary).toBe("#10B981");
    });
  });

  describe("5. Persistencia en VantaDB (egos/<id>/character)", () => {
    it("debe guardar y recuperar intacto el CharacterProfile tras reinicio", async () => {
      const original = createDefaultCharacterProfile("ego.auditor", "engineering");
      await saveCharacterProfile(adapter, "ego.auditor", original);

      const loaded = await loadCharacterProfile(adapter, "ego.auditor");
      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(original.id);
      expect(loaded?.palette.primary).toBe(original.palette.primary);

      // Simular reinicio
      await adapter.close();
      const secondAdapter = new EgoMemoryAdapter(tmpDir);
      await secondAdapter.init();

      const reloaded = await loadCharacterProfile(secondAdapter, "ego.auditor");
      expect(reloaded).not.toBeNull();
      expect(reloaded?.name).toBe(original.name);
      expect(reloaded?.palette.accent).toBe(original.palette.accent);

      await secondAdapter.close();
    });

    it("debe retornar null sin quebrar si el perfil no existe", async () => {
      const loaded = await loadCharacterProfile(adapter, "ego.inexistente");
      expect(loaded).toBeNull();
    });
  });
});
