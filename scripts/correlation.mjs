#!/usr/bin/env node
// scripts/correlation.mjs — T10 (EGO-FIND-74): helper de `correlationId`.
//
// HOY: `grep correlationId` → 0 en todo el repo. El `EventBus` emite
// `event.id` / `sessionId` / `traceId`, pero no hay un hilo que correlacione
// un turno de chat con sus tool calls, sus eventos de telemetría y sus
// entradas de log. Ante un incidente, no se puede reconstruir la traza.
//
// ESTE MÓDULO es el patrón que A2 debe inyectar en `packages/events`
// (EventBus / StructuredLogger) y en `packages/decision` (DecisionTelemetry).
// No depende de nada del repo (solo `node:crypto`): se puede mover a
// `packages/events` cuando A2 lo integre.
//
// CONTRATO:
//   · `newCorrelationId()`      → id nuevo (UUID v4) para una operación raíz.
//   · `childCorrelationId(p, s)` → id DERIVADO y DETERMINISTA de un padre
//                                 (`p`) y un span (`s`): el mismo par produce
//                                 siempre el mismo id (reproducible).
//   · `CORRELATION_HEADER`      → nombre del header HTTP/IPC.
//   · `withCorrelation(obj, id)` → añade `correlationId` a un payload.
//
// REGLAS:
//   1. El id NUNCA contiene PII ni datos del prompt: es un identificador
//      opaco (UUID). Los logs siguen aplicando el saneado de secretos de
//      `StructuredLogger.maskSecrets`.
//   2. La derivación es determinista (SHA-256 truncado) → el mismo
//      (padre, span) da el mismo id en cualquier proceso y en cualquier SO.
import { randomUUID, createHash } from "node:crypto";

/** Header HTTP/IPC para propagar la correlación. */
export const CORRELATION_HEADER = "x-ego-correlation-id";

/** Longitud del identificador de correlación (hex). */
export const CORRELATION_ID_LENGTH = 32;

/**
 * Id nuevo para una operación raíz.
 * @returns {string} hex de 32 chars (128 bits de entropía)
 */
export function newCorrelationId() {
  return randomUUID().replace(/-/g, "").slice(0, CORRELATION_ID_LENGTH);
}

/**
 * Id DERIVADO y determinista de (padre, span).
 * @param {string} parentId id del padre
 * @param {string} span nombre del span hijo (p.ej. "tool:fs_read_file")
 * @returns {string}
 */
export function childCorrelationId(parentId, span) {
  const digest = createHash("sha256")
    .update(`${parentId}::${span}`, "utf8")
    .digest("hex");
  return digest.slice(0, CORRELATION_ID_LENGTH);
}

/**
 * Añade `correlationId` a un payload sin mutarlo.
 * @template T
 * @param {T} payload
 * @param {string} correlationId
 * @returns {T & {correlationId: string}}
 */
export function withCorrelation(payload, correlationId) {
  if (!correlationId) return payload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return { ...payload, correlationId };
  }
  return payload;
}

/**
 * Extrae el `correlationId` de un payload de evento (si lo lleva).
 * @param {unknown} payload
 * @returns {string | null}
 */
export function readCorrelationId(payload) {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const id = /** @type {Record<string, unknown>} */ (payload).correlationId;
    return typeof id === "string" && id.length > 0 ? id : null;
  }
  return null;
}

/** ¿Es un correlationId con la forma que produce este módulo? */
export function isCorrelationId(value) {
  return typeof value === "string" && /^[0-9a-f]{32}$/.test(value);
}
