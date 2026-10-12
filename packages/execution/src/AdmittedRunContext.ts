import { randomUUID, createHash } from "node:crypto";

/**
 * Referencia inmutable a la instancia operativa de ejecución (OCLW-01).
 * Correlaciona el ciclo de vida del agente o tarea sin exponer credenciales.
 */
export interface OperationalRunInstanceRef {
  readonly instanceId: string;
  readonly runId: string;
}

/**
 * Fuente u origen que autorizó la admisión de la corrida.
 */
export type AdmissionSource =
  | "operator-schedule"
  | "requester-schedule"
  | "user-chat"
  | "sub-ego"
  | "background-task"
  | "system-hook";

/**
 * Contexto inmutable de admisión llevado por cada turno del Cognitive Runtime (OCLW-01).
 * Garantiza que cada llamada a herramienta o Sub-Ego posea identidad causal y trazabilidad auditable.
 */
export interface AdmittedRunContext {
  readonly operationalRunInstance: OperationalRunInstanceRef;
  readonly admissionSource: AdmissionSource;
  readonly executionIdentityToken: string;
  readonly createdAt: number;
  readonly traceId: string;
  readonly parentRunId?: string;
  readonly priority: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * Origen de decisión canónico: proyección wire mínima de `AdmissionSource`
 * que viaja en los veredictos de la Decision Intelligence Layer (F3T6/H01).
 *
 * Fuente única del vocabulario: las tablas `ADMISSION_SOURCE_TO_ORIGIN` y
 * `ORIGIN_TO_ADMISSION_SOURCE` de este módulo. `packages/decision` valida
 * esta forma con Zod (`AdmittedRunContextSchema`) pero NO re-declara el tipo:
 * lo re-exporta desde aquí.
 */
export type DecisionRunOrigin =
  | "user_prompt"
  | "subego_delegation"
  | "background_task"
  | "system";

/**
 * Proyección wire mínima del contexto admitido que viaja en veredictos.
 * Tipo canónico compartido por `@ego/execution` y `@ego/decision`.
 */
export interface DecisionRunContext {
  readonly runId: string;
  readonly timestamp: number;
  readonly depth: number;
  readonly parentRunId?: string;
  readonly origin: DecisionRunOrigin;
}

/**
 * Mapeo canónico AdmissionSource → DecisionRunOrigin (inyectivo salvo
 * orígenes de sistema, que colapsan a `system`).
 */
export const ADMISSION_SOURCE_TO_ORIGIN: Record<AdmissionSource, DecisionRunOrigin> = {
  "user-chat": "user_prompt",
  "sub-ego": "subego_delegation",
  "background-task": "background_task",
  "system-hook": "system",
  "operator-schedule": "system",
  "requester-schedule": "system",
};

/**
 * Mapeo canónico inverso DecisionRunOrigin → AdmissionSource.
 */
export const ORIGIN_TO_ADMISSION_SOURCE: Record<DecisionRunOrigin, AdmissionSource> = {
  user_prompt: "user-chat",
  subego_delegation: "sub-ego",
  background_task: "background-task",
  system: "system-hook",
};

/**
 * Claves de metadata que preservan la proyección de decisión al re-admitir
 * un `DecisionRunContext` como `AdmittedRunContext` operativo.
 */
export const DECISION_DEPTH_METADATA_KEY = "decisionDepth";
export const DECISION_ORIGIN_METADATA_KEY = "decisionOrigin";
export const DECISION_TIMESTAMP_METADATA_KEY = "decisionTimestamp";

/**
 * Proyecta un contexto de ejecución admitido al wire de decisión.
 * No lanza: la profundidad ausente o inválida degrada a 0.
 */
export function toDecisionRunContext(ctx: AdmittedRunContext): DecisionRunContext {
  const rawDepth: unknown = ctx.metadata[DECISION_DEPTH_METADATA_KEY];
  const depth =
    typeof rawDepth === "number" && Number.isInteger(rawDepth) && rawDepth >= 0
      ? rawDepth
      : 0;
  return {
    runId: ctx.operationalRunInstance.runId,
    timestamp: ctx.createdAt,
    depth,
    parentRunId: ctx.parentRunId,
    origin: ADMISSION_SOURCE_TO_ORIGIN[ctx.admissionSource],
  };
}

export interface FromDecisionRunContextOverrides {
  readonly instanceId?: string;
  readonly traceId?: string;
  readonly priority?: number;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Re-admite un contexto de decisión como contexto operativo de ejecución.
 * Acto de admisión nuevo (nuevo token e `instanceId` salvo override):
 * preserva `runId`, `parentRunId` y origen, y porta `depth`/`origin`/
 * `timestamp` en metadata para que `toDecisionRunContext` los recupere.
 */
export function fromDecisionRunContext(
  dec: DecisionRunContext,
  overrides: FromDecisionRunContextOverrides = {}
): AdmittedRunContext {
  return createAdmittedRunContext({
    instanceId: overrides.instanceId,
    runId: dec.runId,
    admissionSource: ORIGIN_TO_ADMISSION_SOURCE[dec.origin],
    traceId: overrides.traceId,
    parentRunId: dec.parentRunId,
    priority: overrides.priority ?? 0,
    metadata: {
      ...(overrides.metadata ?? {}),
      [DECISION_DEPTH_METADATA_KEY]: dec.depth,
      [DECISION_ORIGIN_METADATA_KEY]: dec.origin,
      [DECISION_TIMESTAMP_METADATA_KEY]: dec.timestamp,
    },
  });
}

export interface CreateAdmittedRunContextOptions {
  instanceId?: string;
  runId?: string;
  admissionSource?: AdmissionSource;
  traceId?: string;
  parentRunId?: string;
  priority?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Genera un token criptográfico inmutable de identidad de admisión a partir de los datos del run.
 */
function generateExecutionIdentityToken(
  instanceId: string,
  runId: string,
  createdAt: number,
  source: string
): string {
  const hash = createHash("sha256");
  hash.update(`${instanceId}:${runId}:${createdAt}:${source}:${randomUUID()}`);
  return `eit_${hash.digest("hex").slice(0, 32)}`;
}

/**
 * Crea un objeto inmutable AdmittedRunContext sellado y validado.
 */
export function createAdmittedRunContext(
  options: CreateAdmittedRunContextOptions = {}
): AdmittedRunContext {
  const instanceId = options.instanceId ?? randomUUID();
  const runId = options.runId ?? randomUUID();
  const createdAt = Date.now();
  const admissionSource: AdmissionSource = options.admissionSource ?? "user-chat";
  const traceId = options.traceId ?? `trc_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const token = generateExecutionIdentityToken(instanceId, runId, createdAt, admissionSource);

  const context: AdmittedRunContext = {
    operationalRunInstance: Object.freeze({
      instanceId,
      runId,
    }),
    admissionSource,
    executionIdentityToken: token,
    createdAt,
    traceId,
    parentRunId: options.parentRunId,
    priority: options.priority ?? 0,
    metadata: Object.freeze({ ...(options.metadata ?? {}) }),
  };

  return Object.freeze(context);
}

/**
 * Validador estricto que comprueba si un objeto es un AdmittedRunContext válido.
 */
export function validateAdmittedRunContext(
  candidate: unknown
): candidate is AdmittedRunContext {
  if (!candidate || typeof candidate !== "object") {
    return false;
  }
  const c = candidate as Record<string, unknown>;
  if (!c.operationalRunInstance || typeof c.operationalRunInstance !== "object") {
    return false;
  }
  const ref = c.operationalRunInstance as Record<string, unknown>;
  return (
    typeof ref.instanceId === "string" &&
    typeof ref.runId === "string" &&
    typeof c.admissionSource === "string" &&
    typeof c.executionIdentityToken === "string" &&
    typeof c.createdAt === "number" &&
    typeof c.traceId === "string"
  );
}
