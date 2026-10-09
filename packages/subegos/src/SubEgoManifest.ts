import { z } from "zod";
import type {
  SubEgoManifest,
  SubEgoCreateInput,
  SubEgoBudget,
  SubEgoNamespaces,
  SubEgoBehavior
} from "./types.js";

/**
 * Esquema Zod para el estado del Sub-Ego.
 */
export const SubEgoStateSchema = z.enum(["active", "paused", "archived"]);

/**
 * Esquema Zod para el tono de comunicación.
 */
export const SubEgoToneSchema = z.enum(["formal", "neutral", "casual", "analytical"]);

/**
 * Esquema Zod para el nivel de proactividad.
 */
export const SubEgoProactivitySchema = z.enum(["reactive", "moderate", "high"]);

/**
 * Esquema Zod para la verbosidad de salida.
 */
export const SubEgoVerbositySchema = z.enum(["concise", "balanced", "exhaustive"]);

/**
 * Esquema Zod para el nivel de autonomía y supervisión HITL.
 */
export const SubEgoAutonomySchema = z.enum(["supervised", "semi-autonomous", "autonomous"]);

/**
 * Esquema Zod para el creador del Sub-Ego.
 */
export const SubEgoCreatorSchema = z.enum(["user", "ego-nucleus", "template"]);

/**
 * Esquema Zod para el disparador de ejecución.
 */
export const SubEgoTriggerSchema = z.enum(["manual", "cron", "event"]);

/**
 * Esquema Zod para las cuotas de presupuesto del Sub-Ego.
 */
export const SubEgoBudgetSchema = z.object({
  maxTokensPerCall: z.number().int().positive().default(4000),
  maxDailyCostUsd: z.number().nonnegative().default(2.0),
  requiresApprovalAboveUsd: z.number().nonnegative().default(0.5)
});

/**
 * Esquema Zod para los namespaces autorizados en VantaDB.
 */
export const SubEgoNamespacesSchema = z.object({
  read: z.array(z.string()).default([]),
  write: z.array(z.string()).default([])
});

/**
 * Esquema Zod para los parámetros de comportamiento cognitivo.
 */
export const SubEgoBehaviorSchema = z.object({
  tone: SubEgoToneSchema.default("analytical"),
  proactivity: SubEgoProactivitySchema.default("moderate"),
  verbosity: SubEgoVerbositySchema.default("balanced")
});

/**
 * Esquema Zod para el alma y valores de personalidad (SUB-11).
 */
export const SubEgoSoulConfigSchema = z.object({
  identitySummary: z.string().optional(),
  coreValues: z.array(z.string()).optional(),
  toneGuidelines: z.array(z.string()).optional(),
  reasoningStyle: z.string().optional()
});

/**
 * Esquema Zod canónico para el manifiesto completo del Sub-Ego (SUB-01).
 * Implementa identificadores opacos con prefijo (DSEK-03).
 */
export const SubEgoManifestSchema = z.object({
  id: z
    .string()
    .min(3, "El ID debe contener al menos 3 caracteres.")
    .regex(
      /^(ego\.[a-z0-9_-]+|sub_[a-z0-9_-]+)$/,
      "El ID debe comenzar con 'ego.' o 'sub_' y contener solo letras minúsculas, números, guiones y guiones bajos (DSEK-03)."
    ),
  name: z.string().min(2, "El nombre debe contener al menos 2 caracteres.").max(80),
  role: z.string().min(2, "El rol debe contener al menos 2 caracteres.").max(100),
  description: z.string().min(5, "La descripción debe contener al menos 5 caracteres."),
  systemPrompt: z.string().min(10, "El systemPrompt debe contener al menos 10 caracteres."),
  responsibilities: z.array(z.string()).default([]),
  capabilities: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  permissions: z.array(z.string()).default([]),
  namespaces: SubEgoNamespacesSchema,
  behavior: SubEgoBehaviorSchema.default({
    tone: "analytical",
    proactivity: "moderate",
    verbosity: "balanced"
  }),
  autonomy: SubEgoAutonomySchema.default("supervised"),
  budget: SubEgoBudgetSchema.default({
    maxTokensPerCall: 4000,
    maxDailyCostUsd: 2.0,
    requiresApprovalAboveUsd: 0.5
  }),
  trigger: SubEgoTriggerSchema.default("manual"),
  soul: SubEgoSoulConfigSchema.optional(),
  state: SubEgoStateSchema.default("active"),
  creator: SubEgoCreatorSchema.default("user"),
  createdAtMs: z.number().int().positive().default(() => Date.now()),
  updatedAtMs: z.number().int().positive().default(() => Date.now()),
  metadata: z.record(z.unknown()).optional()
});

/**
 * Genera un identificador opaco y determinista para un Sub-Ego a partir de su nombre (DSEK-03).
 *
 * @param name Nombre display del Sub-Ego (ej. "Auditor Técnico")
 * @returns ID formateado con prefijo "ego." (ej. "ego.auditor-tecnico")
 */
export function createSubEgoId(name: string): string {
  const sanitized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const slug = sanitized || "specialist";
  return `ego.${slug}`;
}

/**
 * Valida de forma segura si un objeto coincide con el esquema canónico de `SubEgoManifest`.
 */
export function validateSubEgoManifest(data: unknown): z.SafeParseReturnType<unknown, SubEgoManifest> {
  return SubEgoManifestSchema.safeParse(data);
}

/**
 * Parsea y valida estrictamente un manifiesto, arrojando error si es inválido.
 */
export function parseSubEgoManifest(data: unknown): SubEgoManifest {
  return SubEgoManifestSchema.parse(data) as SubEgoManifest;
}

/**
 * Verifica si un Sub-Ego tiene permiso para operar sobre un namespace determinado en VantaDB.
 * Soporta coincidencias exactas y comodines perimetrales (`/*`).
 */
export function validateNamespaceAccess(
  manifest: SubEgoManifest,
  namespace: string,
  operation: "read" | "write"
): boolean {
  const allowedList = operation === "read" ? manifest.namespaces.read : manifest.namespaces.write;

  return allowedList.some((pattern) => {
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -2);
      return namespace === prefix || namespace.startsWith(`${prefix}/`);
    }
    return namespace === pattern;
  });
}

/**
 * Factoría que genera un `SubEgoManifest` completo, validado y con defaults sensatos.
 */
export function createSubEgoManifest(input: SubEgoCreateInput): SubEgoManifest {
  const subEgoId = createSubEgoId(input.name);
  const now = Date.now();

  const defaultNamespaces: SubEgoNamespaces = {
    read: ["kb/docs", `egos/${subEgoId}/*`, ...(input.namespaces?.read || [])],
    write: [`egos/${subEgoId}/*`, "quarantine/pending", ...(input.namespaces?.write || [])]
  };

  const defaultBudget: SubEgoBudget = {
    maxTokensPerCall: input.budget?.maxTokensPerCall ?? 4000,
    maxDailyCostUsd: input.budget?.maxDailyCostUsd ?? 2.0,
    requiresApprovalAboveUsd: input.budget?.requiresApprovalAboveUsd ?? 0.5
  };

  const defaultBehavior: SubEgoBehavior = {
    tone: input.behavior?.tone ?? "analytical",
    proactivity: input.behavior?.proactivity ?? "moderate",
    verbosity: input.behavior?.verbosity ?? "balanced"
  };

  const candidate: SubEgoManifest = {
    id: subEgoId,
    name: input.name.trim(),
    role: input.role.trim(),
    description: input.description?.trim() || `Sub-Ego especializado en ${input.role.trim()}`,
    systemPrompt: input.instructions.trim(),
    responsibilities: input.responsibilities || [],
    capabilities: input.capabilities || [],
    tools: input.tools || ["memory_recall"],
    permissions: input.permissions || ["memory:read", "memory:write"],
    namespaces: defaultNamespaces,
    behavior: defaultBehavior,
    autonomy: input.autonomy ?? "supervised",
    budget: defaultBudget,
    trigger: input.trigger ?? "manual",
    soul: input.soul,
    state: "active",
    creator: input.creator ?? "user",
    createdAtMs: now,
    updatedAtMs: now
  };

  return parseSubEgoManifest(candidate);
}
