/**
 * Estados del ciclo de vida de un Sub-Ego especializado.
 */
export type SubEgoState = "active" | "paused" | "archived";

/**
 * Registros de tono expresivo y comunicacional.
 */
export type SubEgoTone = "formal" | "neutral" | "casual" | "analytical";

/**
 * Niveles de proactividad en el espacio de trabajo.
 */
export type SubEgoProactivity = "reactive" | "moderate" | "high";

/**
 * Longitud y densidad de las respuestas generadas.
 */
export type SubEgoVerbosity = "concise" | "balanced" | "exhaustive";

/**
 * Nivel de autonomía operativa y gobernanza HITL.
 */
export type SubEgoAutonomy = "supervised" | "semi-autonomous" | "autonomous";

/**
 * Origen de instanciación del Sub-Ego.
 */
export type SubEgoCreator = "user" | "ego-nucleus" | "template";

/**
 * Disparador de activación del Sub-Ego.
 */
export type SubEgoTrigger = "manual" | "cron" | "event";

/**
 * Límites de presupuesto y cuotas de consumo por Sub-Ego.
 */
export interface SubEgoBudget {
  /** Límite de tokens por turno individual */
  maxTokensPerCall: number;
  /** Límite de gasto diario acumulado en USD */
  maxDailyCostUsd: number;
  /** Umbral de costo por acción que exige confirmación humana (HITL) */
  requiresApprovalAboveUsd: number;
}

/**
 * Ámbito de memoria y namespaces autorizados en VantaDB.
 */
export interface SubEgoNamespaces {
  /** Namespaces habilitados para lectura (ej. ["kb/docs", "egos/sub_123/*"]) */
  read: string[];
  /** Namespaces habilitados para escritura (ej. ["egos/sub_123/*", "quarantine/pending"]) */
  write: string[];
}

/**
 * Parámetros de comportamiento y estilo de trabajo.
 */
export interface SubEgoBehavior {
  tone: SubEgoTone;
  proactivity: SubEgoProactivity;
  verbosity: SubEgoVerbosity;
}

/**
 * Configuración de alma (Soul), identidad y valores fundamentales (SUB-11).
 */
export interface SubEgoSoulConfig {
  identitySummary?: string;
  coreValues?: string[];
  toneGuidelines?: string[];
  reasoningStyle?: string;
}

/**
 * Manifiesto formal canónico de un Sub-Ego (SUB-01 / AGENTS.md §4).
 * Representa la identidad inmutable, límites de seguridad y capacidades del especialista.
 */
export interface SubEgoManifest {
  /** Identificador canónico e inmutable con prefijo tipado (ej. "ego.code-reviewer") */
  id: string;
  /** Nombre amigable para presentación y UI */
  name: string;
  /** Rol o título del especialista (ej. "Auditor Técnico", "Redactor B2B") */
  role: string;
  /** Descripción del propósito y casos de uso */
  description: string;
  /** Instrucciones de sistema primarias inyectadas al Cognitive Runtime */
  systemPrompt: string;
  /** Responsabilidades funcionales explícitas asignadas al Sub-Ego */
  responsibilities: string[];
  /** Capacidades cognitivas declaradas */
  capabilities: string[];
  /** Catálogo de nombres de herramientas asignadas (Nivel A o MCP) */
  tools: string[];
  /** Permisos explícitos concedidos (ej. "filesystem:read", "terminal:exec") */
  permissions: string[];
  /** Alcance de namespaces autorizados en VantaDB */
  namespaces: SubEgoNamespaces;
  /** Parámetros de comportamiento cognitivo */
  behavior: SubEgoBehavior;
  /** Régimen de autonomía y supervisión HITL */
  autonomy: SubEgoAutonomy;
  /** Cuotas de consumo y presupuesto */
  budget: SubEgoBudget;
  /** Disparador primario de ejecución */
  trigger: SubEgoTrigger;
  /** Definición opcional de Alma / Personalidad profunda */
  soul?: SubEgoSoulConfig;
  /** Estado operativo actual */
  state: SubEgoState;
  /** Entidad creadora del Sub-Ego */
  creator: SubEgoCreator;
  /** Timestamp Unix de creación */
  createdAtMs: number;
  /** Timestamp Unix de última actualización */
  updatedAtMs: number;
  /** Metadatos adicionales de extensión */
  metadata?: Record<string, unknown>;
}

/**
 * Parámetros para la creación simplificada de un Sub-Ego.
 */
export interface SubEgoCreateInput {
  name: string;
  role: string;
  description?: string;
  instructions: string;
  responsibilities?: string[];
  capabilities?: string[];
  tools?: string[];
  permissions?: string[];
  namespaces?: Partial<SubEgoNamespaces>;
  behavior?: Partial<SubEgoBehavior>;
  autonomy?: SubEgoAutonomy;
  budget?: Partial<SubEgoBudget>;
  soul?: SubEgoSoulConfig;
  trigger?: SubEgoTrigger;
  creator?: SubEgoCreator;
}

/**
 * Estados del ciclo de vida en memoria de una instancia de Sub-Ego (SUB-03).
 */
export type SubEgoLifecycleState =
  | "unloaded"
  | "activating"
  | "idle"
  | "executing"
  | "suspended";

/**
 * Instancia activa en memoria de un Sub-Ego gestionada por SubEgoRuntime.
 */
export interface SubEgoInstance {
  manifest: SubEgoManifest;
  state: SubEgoLifecycleState;
  activatedAtMs: number;
  lastActiveMs: number;
  totalTurnsExecuted: number;
  totalTokensUsed: number;
  totalCostUsd: number;
  scratchpad: Map<string, unknown>;
}

/**
 * Opciones de configuración para SubEgoRuntime.
 */
export interface SubEgoRuntimeOptions {
  /** Tiempo de inactividad antes de suspender o descargar una instancia (default: 60_000 ms) */
  idleTtlMs?: number;
  /** Límite de instancias activas concurrentes en RAM (default: 10) */
  maxConcurrentActive?: number;
  /** Callback opcional ejecutado ante cada transición de ciclo de vida */
  onStateTransition?: (
    instance: SubEgoInstance,
    fromState: SubEgoLifecycleState,
    toState: SubEgoLifecycleState
  ) => void;
}

/**
 * Resultado estructurado de la ejecución de un turno en un Sub-Ego.
 */
export interface SubEgoTurnResult<T = unknown> {
  subEgoId: string;
  output: T;
  tokensUsed: number;
  costUsd: number;
  durationMs: number;
}

