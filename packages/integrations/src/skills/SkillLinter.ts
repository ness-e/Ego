/**
 * SkillLinter — Auditoría Sintáctica y de Seguridad de Skills (HERM-19).
 *
 * Inspecciona manifiestos y código de Skills locales antes de su registro
 * en el runtime cognitivo de Ego, previniendo inyecciones de código y
 * garantizando la soberanía y seguridad del sistema.
 */

export interface SkillManifestMetadata {
  name: string;
  description: string;
  version?: string;
  author?: string;
  declaredTools?: string[];
  requiredPermissions?: string[];
  tags?: string[];
}

export type SkillSecurityLevel = "safe" | "warning" | "dangerous";

export interface SkillLintResult {
  valid: boolean;
  securityLevel: SkillSecurityLevel;
  errors: string[];
  warnings: string[];
  metadata: SkillManifestMetadata;
}

export interface SkillCodeAuditResult {
  safe: boolean;
  securityLevel: SkillSecurityLevel;
  violations: string[];
  warnings: string[];
}

/**
 * Patrones de riesgo prohibidos en scripts de Skills locales sin aislamiento estricto.
 */
const DANGEROUS_PATTERNS: Array<{ regex: RegExp; description: string; level: SkillSecurityLevel }> = [
  {
    regex: /\beval\s*\(/,
    description: "Uso prohibido de 'eval()' para ejecución de código dinámico",
    level: "dangerous",
  },
  {
    regex: /\bnew\s+Function\s*\(/,
    description: "Construcción dinámica de funciones no permitida ('new Function')",
    level: "dangerous",
  },
  {
    regex: /\bprocess\.exit\s*\(/,
    description: "Intento de terminación abrupta del runtime ('process.exit')",
    level: "dangerous",
  },
  {
    regex: /\bprocess\.kill\s*\(/,
    description: "Terminación forzada de procesos del sistema ('process.kill')",
    level: "dangerous",
  },
  {
    regex: /__proto__|\bprototype\b/,
    description: "Posible manipulación de prototipos (Prototype Pollution)",
    level: "dangerous",
  },
  {
    regex: /\bchild_process\b/,
    description: "Acceso no declarado a 'child_process' para invocar binarios arbitrarios",
    level: "warning",
  },
  {
    regex: /\b(rmdirSync|rmSync|unlinkSync)\s*\(/,
    description: "Operaciones directas de borrado en disco sin supervisión de Ego",
    level: "warning",
  },
  {
    regex: /\b(fetch|axios|http\.request)\b/,
    description: "Llamadas de red arbitrarias no canalizadas a través de conectores de Ego (fetch/axios/http)",
    level: "warning",
  },
];

export class SkillLinter {
  /**
   * Parsea y audita el manifiesto de una Skill (Markdown con frontmatter YAML o JSON).
   */
  public lintManifest(content: string): SkillLintResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let securityLevel: SkillSecurityLevel = "safe";

    const metadata: SkillManifestMetadata = {
      name: "",
      description: "",
      declaredTools: [],
      requiredPermissions: [],
      tags: [],
    };

    const trimmed = content.trim();

    if (!trimmed) {
      errors.push("El archivo de la Skill está completamente vacío.");
      return {
        valid: false,
        securityLevel: "dangerous",
        errors,
        warnings,
        metadata,
      };
    }

    // 1. Detección de formato JSON vs YAML Frontmatter
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        if (typeof parsed.name === "string") metadata.name = parsed.name.trim();
        if (typeof parsed.description === "string") metadata.description = parsed.description.trim();
        if (typeof parsed.version === "string") metadata.version = parsed.version.trim();
        if (typeof parsed.author === "string") metadata.author = parsed.author.trim();
        if (Array.isArray(parsed.tools)) metadata.declaredTools = parsed.tools.map(String);
        if (Array.isArray(parsed.permissions)) metadata.requiredPermissions = parsed.permissions.map(String);
        if (Array.isArray(parsed.tags)) metadata.tags = parsed.tags.map(String);
      } catch (e) {
        errors.push(`Formato JSON inválido en el manifiesto: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      // Parseo ligero de frontmatter YAML: --- ... ---
      const frontmatterMatch = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
      if (frontmatterMatch) {
        const yamlBlock = frontmatterMatch[1];
        this.parseSimpleYaml(yamlBlock, metadata, errors);
      } else {
        // Intento de extracción por cabeceras Markdown (# Nombre, descripción en primer párrafo)
        const titleMatch = /^#\s+(.+)$/m.exec(content);
        if (titleMatch) {
          metadata.name = titleMatch[1].trim();
        }
        const descMatch = /^#\s+.+\r?\n\r?\n([^\r\n#]+)/m.exec(content);
        if (descMatch) {
          metadata.description = descMatch[1].trim();
        }
        warnings.push("La Skill carece de bloque formal de metadatos (frontmatter '---'); se infirió de Markdown.");
      }
    }

    // 2. Validación de campos esenciales
    if (!metadata.name) {
      errors.push("El manifiesto de la Skill no define el campo requerido 'name'.");
    } else if (!/^[a-zA-Z0-9_\-.:]{2,64}$/.test(metadata.name)) {
      errors.push(
        `El nombre '${metadata.name}' contiene caracteres no permitidos. Debe tener entre 2 y 64 caracteres alfanuméricos, guiones o puntos.`
      );
    }

    if (!metadata.description) {
      warnings.push("La Skill no incluye 'description'; el Model Router no podrá inferir su contexto de activación.");
    }

    // 3. Auditoría de código en el cuerpo (si hay bloques de código ejecutables dentro del Markdown)
    const codeBlocks = content.match(/```(?:javascript|typescript|js|ts)([\s\S]*?)```/g) || [];
    for (const block of codeBlocks) {
      const code = block.replace(/```(?:javascript|typescript|js|ts)/, "").replace(/```$/, "");
      const audit = this.auditCode(code);
      if (!audit.safe) {
        errors.push(...audit.violations);
        securityLevel = "dangerous";
      }
      if (audit.warnings.length > 0) {
        warnings.push(...audit.warnings);
        if (securityLevel !== "dangerous") {
          securityLevel = "warning";
        }
      }
    }

    const isValid = errors.length === 0;
    if (!isValid && securityLevel !== "dangerous") {
      securityLevel = "dangerous";
    }

    return {
      valid: isValid,
      securityLevel,
      errors,
      warnings,
      metadata,
    };
  }

  /**
   * Audita código ejecutable (TypeScript/JavaScript) contra la matriz de seguridad HERM-19.
   */
  public auditCode(code: string): SkillCodeAuditResult {
    const violations: string[] = [];
    const warnings: string[] = [];
    let hasDangerous = false;
    let hasWarning = false;

    for (const rule of DANGEROUS_PATTERNS) {
      if (rule.regex.test(code)) {
        if (rule.level === "dangerous") {
          violations.push(rule.description);
          hasDangerous = true;
        } else {
          warnings.push(rule.description);
          hasWarning = true;
        }
      }
    }

    const securityLevel: SkillSecurityLevel = hasDangerous ? "dangerous" : hasWarning ? "warning" : "safe";

    return {
      safe: !hasDangerous,
      securityLevel,
      violations,
      warnings,
    };
  }

  private parseSimpleYaml(yamlBlock: string, metadata: SkillManifestMetadata, errors: string[]): void {
    const lines = yamlBlock.split(/\r?\n/);
    let currentKey: string | null = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      if (line.startsWith("- ") && currentKey) {
        const val = line.slice(2).trim().replace(/^['"]|['"]$/g, "");
        if (currentKey === "tools" || currentKey === "declaredTools") {
          metadata.declaredTools?.push(val);
        } else if (currentKey === "permissions" || currentKey === "requiredPermissions") {
          metadata.requiredPermissions?.push(val);
        } else if (currentKey === "tags") {
          metadata.tags?.push(val);
        }
        continue;
      }

      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) {
        errors.push(`Línea inválida en frontmatter: '${line}'`);
        continue;
      }

      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim().replace(/^['"]|['"]$/g, "");
      currentKey = key;

      switch (key) {
        case "name":
          metadata.name = value;
          break;
        case "description":
          metadata.description = value;
          break;
        case "version":
          metadata.version = value;
          break;
        case "author":
          metadata.author = value;
          break;
        case "tools":
        case "declaredTools":
          if (value) {
            metadata.declaredTools = value.split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, ""));
          }
          break;
        case "permissions":
        case "requiredPermissions":
          if (value) {
            metadata.requiredPermissions = value.split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, ""));
          }
          break;
        case "tags":
          if (value) {
            metadata.tags = value.split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, ""));
          }
          break;
      }
    }
  }
}
