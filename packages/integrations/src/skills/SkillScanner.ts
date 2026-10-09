import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { SkillLinter, type SkillSecurityLevel } from "./SkillLinter.js";

export interface ScannedSkill {
  id: string;
  name: string;
  description: string;
  version?: string;
  author?: string;
  directoryPath: string;
  manifestPath: string;
  valid: boolean;
  securityLevel: SkillSecurityLevel;
  errors: string[];
  warnings: string[];
  tools: string[];
  permissions: string[];
  tags: string[];
}

export interface SkillScannerOptions {
  searchPaths?: string[];
  projectRoot?: string;
}

export class SkillScanner {
  private linter: SkillLinter;

  constructor(linter?: SkillLinter) {
    this.linter = linter ?? new SkillLinter();
  }

  /**
   * Resuelve las rutas estándar de búsqueda de Skills de Ego.
   */
  public getDefaultSearchPaths(projectRoot?: string): string[] {
    const paths: string[] = [];
    const root = projectRoot ? resolve(projectRoot) : process.cwd();

    // 1. Skills a nivel de proyecto local (.ego/skills)
    paths.push(join(root, ".ego", "skills"));

    // 2. Skills globales del usuario (~/.ego/skills)
    try {
      paths.push(join(homedir(), ".ego", "skills"));
    } catch {
      // Entornos donde homedir falle o no esté disponible
    }

    return paths;
  }

  /**
   * Escanea las rutas especificadas buscando Skills locales válidas o con advertencias.
   */
  public scan(options?: SkillScannerOptions): ScannedSkill[] {
    const searchDirs = options?.searchPaths && options.searchPaths.length > 0
      ? options.searchPaths
      : this.getDefaultSearchPaths(options?.projectRoot);

    const results: ScannedSkill[] = [];
    const seenIds = new Set<string>();

    for (const rawDir of searchDirs) {
      const dir = resolve(rawDir);
      if (!existsSync(dir)) continue;

      try {
        const stat = statSync(dir);
        if (!stat.isDirectory()) continue;

        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;

          const skillDir = join(dir, entry.name);
          const scanned = this.inspectSkillDirectory(skillDir, entry.name);
          if (scanned && !seenIds.has(scanned.id)) {
            seenIds.add(scanned.id);
            results.push(scanned);
          }
        }
      } catch (err) {
        console.warn(`[SkillScanner] Error al leer directorio de skills '${dir}':`, err);
      }
    }

    return results;
  }

  /**
   * Inspecciona una carpeta específica para extraer y validar el manifiesto de la Skill.
   */
  public inspectSkillDirectory(skillDir: string, fallbackId: string): ScannedSkill | null {
    const candidates = [
      join(skillDir, "SKILL.md"),
      join(skillDir, "skill.md"),
      join(skillDir, "skill.json"),
      join(skillDir, "manifest.json"),
    ];

    let manifestPath: string | null = null;
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        manifestPath = candidate;
        break;
      }
    }

    if (!manifestPath) {
      return null;
    }

    try {
      const content = readFileSync(manifestPath, "utf-8");
      const lint = this.linter.lintManifest(content);

      const skillId = lint.metadata.name || fallbackId || basename(skillDir);

      return {
        id: skillId,
        name: lint.metadata.name || skillId,
        description: lint.metadata.description || "Sin descripción proporcionada",
        version: lint.metadata.version,
        author: lint.metadata.author,
        directoryPath: skillDir,
        manifestPath,
        valid: lint.valid,
        securityLevel: lint.securityLevel,
        errors: lint.errors,
        warnings: lint.warnings,
        tools: lint.metadata.declaredTools || [],
        permissions: lint.metadata.requiredPermissions || [],
        tags: lint.metadata.tags || [],
      };
    } catch (err) {
      return {
        id: fallbackId,
        name: fallbackId,
        description: "Error al leer manifiesto",
        directoryPath: skillDir,
        manifestPath,
        valid: false,
        securityLevel: "dangerous",
        errors: [`No se pudo leer el archivo '${manifestPath}': ${err instanceof Error ? err.message : String(err)}`],
        warnings: [],
        tools: [],
        permissions: [],
        tags: [],
      };
    }
  }
}
