import { createHash } from "node:crypto";

/**
 * Identidad de aprobación HITL (STAB-14).
 *
 * **Implementación propia de Ego** (patrón asimilado de openclaw ·
 * `admitted-run-context`): correlaciona una decisión de aprobación con el
 * run/tarea/sub-ego/tool/input exactos que la originaron. Reimplementación TS
 * del patrón (nunca copiar código de referencia): la identidad se sella con
 * `inputDigest` SHA-256 sobre JSON canónico del input, de modo que una
 * decisión NO puede reutilizarse en otro contexto (decisión cruzada
 * rechazada). Sin atribución de código derivado.
 */
export interface ApprovalIdentity {
  readonly runId: string;
  readonly taskId: string;
  readonly subEgoId: string;
  readonly toolId: string;
  readonly inputDigest: string;
}

export interface ApprovalIdentityInput {
  runId: string;
  taskId: string;
  subEgoId: string;
  toolId: string;
  /** Input del tool call; `undefined` sella digest determinista de `"null"`. */
  input?: unknown;
}

export class ApprovalIdentityMismatchError extends Error {
  readonly field: string;
  constructor(field: string, detail: string) {
    super(`[ApprovalIdentity] Decisión cruzada rechazada en '${field}': ${detail}`);
    this.name = "ApprovalIdentityMismatchError";
    this.field = field;
  }
}

/** JSON canónico: claves ordenadas, sin espacios — digest estable. */
export function canonicalJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export function digestInput(input: unknown): string {
  return createHash("sha256").update(canonicalJson(input), "utf8").digest("hex");
}

export function buildApprovalIdentity(args: ApprovalIdentityInput): ApprovalIdentity {
  return {
    runId: args.runId,
    taskId: args.taskId,
    subEgoId: args.subEgoId,
    toolId: args.toolId,
    inputDigest: digestInput(args.input),
  };
}

/**
 * Verifica que una aprobación resuelta corresponda al contexto esperado.
 * Lanza `ApprovalIdentityMismatchError` ante la primera divergencia
 * (fail-closed: decisión cruzada rechazada).
 */
export function assertSameApproval(expected: ApprovalIdentity, actual: ApprovalIdentity): void {
  const fields: Array<keyof ApprovalIdentity> = ["runId", "taskId", "subEgoId", "toolId", "inputDigest"];
  for (const field of fields) {
    if (expected[field] !== actual[field]) {
      throw new ApprovalIdentityMismatchError(field, `esperado '${expected[field]}' vs recibido '${actual[field]}'`);
    }
  }
}

export function isSameApproval(expected: ApprovalIdentity, actual: ApprovalIdentity): boolean {
  try {
    assertSameApproval(expected, actual);
    return true;
  } catch {
    return false;
  }
}
