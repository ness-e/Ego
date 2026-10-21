/**
 * E13 (Ola 5 · T1) — Metatools de divulgación progresiva en el producto.
 *
 * ## Qué resuelve
 * `packages/tools` trae los 3 metatools (`lookup_skills`, `search_tools`,
 * `expand_tools`) verificados, y `packages/integrations` el `SkillScanner`.
 * Ninguno estaba **registrado** en el registro de tools de producción: el
 * modelo no podía verlos (`EGO-FIND-90`).
 *
 * ## La divulgación progresiva, de verdad
 * El catálogo que se inyecta en los metatools devuelve las skills con el
 * cuerpo como **getter perezoso**: el `SKILL.md` se lee del disco **sólo**
 * cuando el metatool pide `includeBody: true` (y la entrada ha salido en
 * los resultados). Con `includeBody` ausente, la llamada lee los
 * manifiestos (que el scanner ya lee para el frontmatter) y nada más.
 *
 * La primera escala (resumen) y la segunda (cuerpo) las decide el
 * metatool; este módulo sólo garantiza que la segunda **cuesta** lo que
 * cuesta.
 */
import { readFileSync } from "node:fs";
import {
  registerMetaTools,
  type SkillCatalogEntry,
  type SkillCatalogLike,
  type ToolDefinition,
  type ToolRegistry,
} from "@ego/tools";

/** Skill escaneada (los campos que el catálogo necesita). */
export interface ScannedSkillLike {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly tags?: readonly string[];
  readonly manifestPath: string;
  readonly valid?: boolean;
}

/** Scanner de skills (el de `@ego/integrations` cumple este contrato). */
export interface SkillScannerLike {
  scan(options?: { projectRoot?: string }): readonly ScannedSkillLike[];
}

/** Opciones del registro de los metatools. */
export interface RegisterMetaToolsOptions {
  /** Scanner que aporta las skills del disco. */
  readonly scanner: SkillScannerLike;
  /** Raíz del proyecto (dónde se buscan las skills). */
  readonly projectRoot?: string;
}

/**
 * Construye el catálogo de skills para los metatools.
 *
 * El **cuerpo** es un getter: se lee del disco la primera vez que alguien
 * lo pide (y el metatool sólo lo pide con `includeBody: true`).
 */
export function buildSkillCatalog(
  options: RegisterMetaToolsOptions
): SkillCatalogLike {
  return {
    list: () => {
      const scanned = options.scanner.scan(
        options.projectRoot !== undefined
          ? { projectRoot: options.projectRoot }
          : undefined
      );
      return scanned.map((skill) => {
        const entry: SkillCatalogEntry = {
          id: skill.id,
          name: skill.name,
          description: skill.description,
          tags: skill.tags ? [...skill.tags] : [],
          path: skill.manifestPath,
          // Getter perezoso: el cuerpo se lee al pedirlo, no al listar.
          get body(): string | undefined {
            try {
              return readFileSync(skill.manifestPath, "utf8");
            } catch {
              return undefined;
            }
          },
        };
        return entry;
      });
    },
  };
}

/**
 * Registra los 3 metatools de divulgación progresiva en un registro.
 *
 * @returns las tools efectivamente registradas (las ya presentes no se
 *   duplican: `registerMetaTools` es idempotente por nombre).
 */
export function registerProgressiveMetaTools(
  registry: ToolRegistry,
  options: RegisterMetaToolsOptions
): ToolDefinition[] {
  return registerMetaTools(registry, {
    skills: buildSkillCatalog(options),
  });
}
