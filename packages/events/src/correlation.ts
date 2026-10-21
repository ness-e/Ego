import { createHash, randomUUID } from "node:crypto";

/**
 * Correlación de operaciones (EGO-FIND-74 / T10).
 *
 * PROBLEMA (medido por el gate de A7): el `EventBus` emitía `event.id`,
 * `sessionId` y `traceId`, pero NO existía un hilo que correlacionase un
 * turno de chat con sus tool calls, sus eventos de telemetría y sus entradas
 * de log. Ante un incidente no se podía reconstruir la traza.
 *
 * ESTE MÓDULO es la implementación canónica (migrada de
 * `scripts/correlation.mjs`, que es un `.mjs` de nivel raíz y por tanto no
 * importable desde un paquete de workspace).
 *
 * REGLAS:
 *  1. El id NUNCA contiene PII ni datos del prompt: es un identificador opaco
 *     (UUID/hex). Los logs siguen aplicando el saneado de secretos de
 *     `StructuredLogger.maskSecrets`.
 *  2. La derivación es determinista (SHA-256 truncado) ⇒ el mismo par
 *     (padre, span) da el mismo id en cualquier proceso y en cualquier SO.
 */

/** Header HTTP/IPC para propagar la correlación. */
export const CORRELATION_HEADER = "x-ego-correlation-id";

/** Longitud del identificador de correlación (hex). */
export const CORRELATION_ID_LENGTH = 32;

/**
 * Id nuevo para una operación raíz.
 * @returns hex de 32 chars (128 bits de entropía)
 */
export function newCorrelationId(): string {
  return randomUUID().replace(/-/g, "").slice(0, CORRELATION_ID_LENGTH);
}

/**
 * Id DERIVADO y determinista de (padre, span).
 * @param parentId id del padre
 * @param span nombre del span hijo (p.ej. "tool:fs_read_file")
 */
export function childCorrelationId(parentId: string, span: string): string {
  const digest = createHash("sha256")
    .update(`${parentId}::${span}`, "utf8")
    .digest("hex");
  return digest.slice(0, CORRELATION_ID_LENGTH);
}

/**
 * Añade `correlationId` a un payload sin mutarlo.
 */
export function withCorrelation<T>(payload: T, correlationId: string): T & { correlationId: string } {
  if (!correlationId) return payload as T & { correlationId: string };
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return {
      ...(payload as Record<string, unknown>),
      correlationId,
    } as T & { correlationId: string };
  }
  return payload as T & { correlationId: string };
}

/**
 * Extrae el `correlationId` de un payload de evento (si lo lleva).
 */
export function readCorrelationId(payload: unknown): string | null {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const id = (payload as Record<string, unknown>).correlationId;
    return typeof id === "string" && id.length > 0 ? id : null;
  }
  return null;
}

/** ¿Es un correlationId con la forma que produce este módulo? */
export function isCorrelationId(value: unknown): boolean {
  return typeof value === "string" && /^[0-9a-f]{32}$/.test(value);
}
