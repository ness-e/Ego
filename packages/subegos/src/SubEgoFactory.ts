import YAML from "yaml";
import { z } from "zod";
import type {
  SubEgoManifest,
  SubEgoCreateInput,
  SubEgoAutonomy
} from "./types.js";
import {
  SubEgoManifestSchema,
  createSubEgoManifest
} from "./SubEgoManifest.js";
import {
  DOMAIN_TEMPLATES,
  getDomainTemplate,
  listDomainTemplates,
  type DomainTemplate
} from "./templates/domainTemplates.js";

/**
 * Error base para fallos de la factoría de Sub-Egos.
 */
export class SubEgoFactoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubEgoFactoryError";
  }
}

/**
 * Error cuando se solicita una plantilla no registrada.
 */
export class UnknownSubEgoTemplateError extends SubEgoFactoryError {
  constructor(public readonly templateId: string) {
    super(
      `Plantilla de Sub-Ego desconocida: '${templateId}'. Plantillas disponibles: ${Object.keys(DOMAIN_TEMPLATES).join(", ")}`
    );
    this.name = "UnknownSubEgoTemplateError";
  }
}

/**
 * Error en el parsing sintáctico de declaraciones JSON o YAML.
 */
export class SubEgoDeclarationSyntaxError extends SubEgoFactoryError {
  constructor(public readonly format: "json" | "yaml", public readonly rawError: string) {
    super(`Error sintáctico al procesar declaración en formato ${format.toUpperCase()}: ${rawError}`);
    this.name = "SubEgoDeclarationSyntaxError";
  }
}

/**
 * Error de validación semántica contra el esquema formal `SubEgoManifestSchema`.
 */
export class SubEgoManifestValidationError extends SubEgoFactoryError {
  constructor(public readonly issues: z.ZodIssue[]) {
    const formatted = issues
      .map((i) => `  - [${i.path.join(".") || "root"}]: ${i.message}`)
      .join("\n");
    super(`El manifiesto del Sub-Ego no cumple con el esquema canónico:\n${formatted}`);
    this.name = "SubEgoManifestValidationError";
  }
}

/**
 * Pasos del diálogo interactivo en la modalidad conversacional.
 */
export type ConversationalStep =
  | "role"
  | "name"
  | "responsibilities"
  | "tools"
  | "autonomy"
  | "budget"
  | "ready";

/**
 * Estado resultante tras procesar una respuesta en la sesión conversacional.
 */
export interface ConversationalProgress {
  currentStep: ConversationalStep;
  nextQuestion: string;
  isComplete: boolean;
  collectedInput: Partial<SubEgoCreateInput>;
}

/**
 * Sesión interactiva de refinamiento para creación conversacional de Sub-Egos (Modalidad 1).
 * Implementa una máquina de estados pura, desacoplada de la interfaz de usuario.
 */
export class ConversationalSubEgoSession {
  private step: ConversationalStep = "role";
  private collected: Partial<SubEgoCreateInput> = {
    responsibilities: [],
    capabilities: [],
    tools: ["memory_recall"],
    permissions: ["memory:read", "memory:write"],
    autonomy: "supervised",
    creator: "user"
  };

  constructor(initialPrompt?: string) {
    if (initialPrompt && initialPrompt.trim().length > 0) {
      this.collected.role = initialPrompt.trim();
      this.collected.name = initialPrompt.trim();
      this.collected.instructions = `Actúa como especialista en ${initialPrompt.trim()}. Responde con rigor y precisión técnica.`;
      this.step = "responsibilities";
    }
  }

  /**
   * Obtiene el paso actual del flujo conversacional.
   */
  getStep(): ConversationalStep {
    return this.step;
  }

  /**
   * Obtiene los datos recopilados hasta el momento.
   */
  getCollectedInput(): Readonly<Partial<SubEgoCreateInput>> {
    return this.collected;
  }

  /**
   * Indica si la sesión ha completado todos los pasos requeridos.
   */
  isComplete(): boolean {
    return this.step === "ready";
  }

  /**
   * Obtiene la siguiente pregunta formulada por Ego para el usuario.
   */
  getNextQuestion(): string {
    switch (this.step) {
      case "role":
        return "¿Cuál es el rol o propósito principal del especialista que deseas crear? (ej. 'Auditor de Seguridad', 'Redactor SEO', 'Analista de Datos')";
      case "name":
        return `¿Qué nombre para mostrar deseas asignarle al especialista? (Presiona Enter para sugerir '${this.collected.role || "Especialista"}')`;
      case "responsibilities":
        return "¿Cuáles son las principales responsabilidades o tareas que ejecutará? (Puedes separarlas por comas o saltos de línea)";
      case "tools":
        return "¿Qué herramientas necesitará? (Opciones: memory_recall, web_search, code_analysis, markdown_formatter)";
      case "autonomy":
        return "¿Qué nivel de autonomía requieres? ('supervised' [default, requiere confirmación para acciones críticas], 'semi-autonomous', o 'autonomous')";
      case "budget":
        return "¿Deseas fijar un límite de costo diario en USD? (Presiona Enter para default de $2.00 USD)";
      case "ready":
        return "Toda la información requerida ha sido recopilada. El manifiesto está listo para ser generado.";
    }
  }

  /**
   * Procesa la respuesta del usuario y avanza la máquina de estados.
   */
  submitAnswer(answer: string): ConversationalProgress {
    const trimmed = answer.trim();

    switch (this.step) {
      case "role": {
        if (!trimmed) {
          throw new SubEgoFactoryError("El rol o propósito no puede estar vacío.");
        }
        this.collected.role = trimmed;
        this.collected.name = trimmed;
        this.collected.instructions = `Actúa como especialista en ${trimmed}. Responde con rigor y precisión analítica.`;
        this.step = "name";
        break;
      }

      case "name": {
        if (trimmed) {
          this.collected.name = trimmed;
        }
        this.step = "responsibilities";
        break;
      }

      case "responsibilities": {
        if (trimmed) {
          const items = trimmed
            .split(/[,;\n]/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          this.collected.responsibilities = items;
          this.collected.capabilities = items.map((i) =>
            i.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30)
          );
        }
        this.step = "tools";
        break;
      }

      case "tools": {
        if (trimmed) {
          const customTools = trimmed
            .split(/[,;\n]/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          this.collected.tools = Array.from(new Set(["memory_recall", ...customTools]));
        }
        this.step = "autonomy";
        break;
      }

      case "autonomy": {
        if (trimmed) {
          const norm = trimmed.toLowerCase();
          if (norm.includes("semi")) {
            this.collected.autonomy = "semi-autonomous";
          } else if (norm.includes("auto")) {
            this.collected.autonomy = "autonomous";
          } else {
            this.collected.autonomy = "supervised";
          }
        }
        this.step = "budget";
        break;
      }

      case "budget": {
        if (trimmed) {
          const parsed = parseFloat(trimmed.replace(/[^0-9.]/g, ""));
          if (!isNaN(parsed) && parsed > 0) {
            this.collected.budget = {
              maxTokensPerCall: 4000,
              maxDailyCostUsd: parsed,
              requiresApprovalAboveUsd: Math.min(0.5, parsed * 0.25)
            };
          }
        }
        this.step = "ready";
        break;
      }

      case "ready":
        // Ya está listo
        break;
    }

    return {
      currentStep: this.step,
      nextQuestion: this.getNextQuestion(),
      isComplete: this.isComplete(),
      collectedInput: this.collected
    };
  }

  /**
   * Construye y valida el manifiesto formal definitivo.
   */
  buildManifest(): SubEgoManifest {
    if (!this.collected.name || !this.collected.role) {
      throw new SubEgoFactoryError(
        "No se puede generar el manifiesto: la sesión no cuenta con nombre y rol mínimos."
      );
    }

    return createSubEgoManifest({
      name: this.collected.name,
      role: this.collected.role,
      description:
        this.collected.description ||
        `Sub-Ego especializado en ${this.collected.role} configurado interactivamente.`,
      instructions:
        this.collected.instructions ||
        `Actúa como especialista en ${this.collected.role}. Responde con rigor y precisión técnica.`,
      responsibilities: this.collected.responsibilities || [],
      capabilities: this.collected.capabilities || [],
      tools: this.collected.tools || ["memory_recall"],
      permissions: this.collected.permissions || ["memory:read", "memory:write"],
      autonomy: this.collected.autonomy || "supervised",
      budget: this.collected.budget,
      creator: "user"
    });
  }
}

/**
 * Fábrica Inteligente de Sub-Egos (SUB-02 / Q11 / HERM-12).
 * Provee 3 modalidades de creación:
 * 1. Conversacional interactiva (`startConversationalSession`)
 * 2. Plantillas preconfiguradas por dominio (`fromTemplate`)
 * 3. Importación declarativa JSON/YAML (`fromRawDeclaration`)
 */
export class SubEgoFactory {
  /**
   * Modalidad 1: Inicia una sesión de refinamiento conversacional interactivo.
   *
   * @param initialPrompt Petición inicial del usuario (ej. "Quiero un auditor de seguridad")
   */
  static startConversationalSession(initialPrompt?: string): ConversationalSubEgoSession {
    return new ConversationalSubEgoSession(initialPrompt);
  }

  /**
   * Modalidad 2: Crea un Sub-Ego a partir de una plantilla canónica de dominio (HERM-12).
   *
   * @param templateId Identificador de la plantilla (ej. 'researcher', 'code_reviewer')
   * @param overrides Parámetros opcionales para personalizar la plantilla
   */
  static fromTemplate(
    templateId: string,
    overrides?: Partial<SubEgoCreateInput>
  ): SubEgoManifest {
    const template = getDomainTemplate(templateId);
    if (!template) {
      throw new UnknownSubEgoTemplateError(templateId);
    }

    const mergedInput: SubEgoCreateInput = {
      name: overrides?.name?.trim() || template.name,
      role: overrides?.role?.trim() || template.role,
      description: overrides?.description?.trim() || template.description,
      instructions: overrides?.instructions?.trim() || template.instructions,
      responsibilities: overrides?.responsibilities || template.recommendedResponsibilities,
      capabilities: overrides?.capabilities || template.recommendedCapabilities,
      tools: overrides?.tools || template.recommendedTools,
      permissions: overrides?.permissions || template.recommendedPermissions,
      namespaces: overrides?.namespaces || template.recommendedNamespaces,
      behavior: {
        ...template.behavior,
        ...(overrides?.behavior || {})
      },
      autonomy: overrides?.autonomy || template.autonomy,
      budget: {
        ...template.defaultBudget,
        ...(overrides?.budget || {})
      },
      soul: overrides?.soul,
      creator: overrides?.creator || "template"
    };

    return createSubEgoManifest(mergedInput);
  }

  /**
   * Obtiene la lista de todas las plantillas de dominio disponibles.
   */
  static listTemplates(): DomainTemplate[] {
    return listDomainTemplates();
  }

  /**
   * Modalidad 3: Parsea, valida y genera un SubEgoManifest a partir de una declaración en crudo (JSON o YAML).
   *
   * @param content Contenido en texto (JSON/YAML) o bien un objeto ya parseado
   * @param format Formato forzado ("json" | "yaml") o auto-detectado
   */
  static fromRawDeclaration(
    content: string | Record<string, unknown>,
    format?: "json" | "yaml"
  ): SubEgoManifest {
    let parsedObject: unknown;

    if (typeof content === "string") {
      const trimmed = content.trim();
      const isJson = format === "json" || (trimmed.startsWith("{") && trimmed.endsWith("}"));

      if (isJson) {
        try {
          parsedObject = JSON.parse(trimmed);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new SubEgoDeclarationSyntaxError("json", msg);
        }
      } else {
        try {
          parsedObject = YAML.parse(trimmed);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new SubEgoDeclarationSyntaxError("yaml", msg);
        }
      }
    } else {
      parsedObject = content;
    }

    if (!parsedObject || typeof parsedObject !== "object") {
      throw new SubEgoFactoryError("La declaración proporcionada debe ser un objeto válido.");
    }

    const raw = parsedObject as Record<string, unknown>;

    // Caso A: El objeto ya contiene la estructura canónica completa de `SubEgoManifest`
    if (typeof raw.id === "string" && typeof raw.systemPrompt === "string") {
      const result = SubEgoManifestSchema.safeParse(raw);
      if (!result.success) {
        throw new SubEgoManifestValidationError(result.error.issues);
      }
      return result.data as SubEgoManifest;
    }

    // Caso B: El objeto es una especificación declarativa simplificada (`SubEgoCreateInput`)
    if (typeof raw.name === "string" && (typeof raw.role === "string" || typeof raw.instructions === "string")) {
      const input: SubEgoCreateInput = {
        name: String(raw.name),
        role: String(raw.role || raw.name),
        description: raw.description ? String(raw.description) : undefined,
        instructions: String(raw.instructions || raw.systemPrompt || `Actúa como ${raw.name}.`),
        responsibilities: Array.isArray(raw.responsibilities) ? (raw.responsibilities as string[]) : undefined,
        capabilities: Array.isArray(raw.capabilities) ? (raw.capabilities as string[]) : undefined,
        tools: Array.isArray(raw.tools) ? (raw.tools as string[]) : undefined,
        permissions: Array.isArray(raw.permissions) ? (raw.permissions as string[]) : undefined,
        namespaces: (raw.namespaces as SubEgoCreateInput["namespaces"]) || undefined,
        behavior: (raw.behavior as SubEgoCreateInput["behavior"]) || undefined,
        autonomy: (raw.autonomy as SubEgoAutonomy) || undefined,
        budget: (raw.budget as SubEgoCreateInput["budget"]) || undefined,
        creator: "user"
      };

      try {
        return createSubEgoManifest(input);
      } catch (err: unknown) {
        if (err instanceof z.ZodError) {
          throw new SubEgoManifestValidationError(err.issues);
        }
        throw err;
      }
    }

    // Si no coincide con ninguno de los dos patrones, validar contra SubEgoManifestSchema para devolver errores enriquecidos
    const validation = SubEgoManifestSchema.safeParse(raw);
    if (!validation.success) {
      throw new SubEgoManifestValidationError(validation.error.issues);
    }

    return validation.data as SubEgoManifest;
  }
}
