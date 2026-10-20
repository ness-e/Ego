// scripts/correlation.d.mts — tipos públicos del helper de `correlationId`.
//
// Mismo contrato que A2 debe inyectar en `packages/events` (EventBus /
// StructuredLogger) y `packages/decision` (Telemetry) — handoff A7 §2.4.

/** Header HTTP/IPC para propagar la correlación. */
export declare const CORRELATION_HEADER: string;

/** Longitud del identificador de correlación (hex). */
export declare const CORRELATION_ID_LENGTH: number;

/** Id nuevo para una operación raíz (UUID v4 truncado, opaco). */
export declare function newCorrelationId(): string;

/** Id DERIVADO y determinista de (padre, span). */
export declare function childCorrelationId(parentId: string, span: string): string;

/** Añade `correlationId` a un payload sin mutarlo. */
export declare function withCorrelation<T>(
  payload: T,
  correlationId: string,
): T & { correlationId: string };

/** Extrae el `correlationId` de un payload de evento (si lo lleva). */
export declare function readCorrelationId(payload: unknown): string | null;

/** ¿Es un `correlationId` con la forma que produce este módulo? */
export declare function isCorrelationId(value: unknown): boolean;
