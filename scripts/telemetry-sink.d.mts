// scripts/telemetry-sink.d.mts — tipos públicos del sink rotado de telemetría.
//
// Declaración explícita (no inferida): el mismo contrato es el que A2 debe
// inyectar en `packages/events` y `packages/decision` (handoff A7 §2.4).

export interface RotatingFileSink {
  /** Escribe una línea (JSON o texto). JSON → JSONL compacto; texto → evento con `ts`. */
  write(line: string): void;
  /** Directorio donde se escriben los ficheros. */
  dir: string;
  /** Ruta del fichero activo (`<baseName>-YYYYMMDD.jsonl`). */
  file(): string;
  /** Fuerza la rotación inmediata. */
  rotate(): void;
}

export interface RotatingFileSinkOptions {
  /** Por defecto `"logs/telemetry"`. */
  dir?: string;
  /** Por defecto `"telemetry"`. */
  baseName?: string;
  /** Por defecto 5 MiB. */
  maxBytes?: number;
  /** Por defecto 5 ficheros conservados tras la rotación. */
  maxFiles?: number;
  /** Reloj inyectable (tests). */
  now?: () => Date;
}

export declare function createRotatingFileSink(
  options?: RotatingFileSinkOptions,
): RotatingFileSink;

/** Ficheros de telemetría de un directorio, del más nuevo al más viejo. */
export declare function listTelemetryFiles(dir: string): string[];

/** Nombre del fichero activo para una fecha (UTC). */
export declare function activeFileName(baseName: string, date?: Date): string;

export declare const DEFAULTS: Required<
  Pick<RotatingFileSinkOptions, "dir" | "baseName" | "maxBytes" | "maxFiles">
>;
