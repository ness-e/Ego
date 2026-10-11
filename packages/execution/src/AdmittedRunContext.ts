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
