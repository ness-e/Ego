/**
 * Partes estructuradas extraídas de un valor de error desconocido.
 * F6T13/L10 — alternativa tipada a `catch (err: any)` + `err.message`.
 */
export interface ErrorParts {
  message: string;
  name?: string;
  code?: string;
  stack?: string;
}

/**
 * Extrae `message`/`code`/`stack`/`name` de un `unknown` sin lanzar nunca.
 * Nunca accede a `.message` sin narrowing previo: los valores no-Error
 * (null, string, objetos planos) se degradan a `String(err)` o JSON.
 */
export function getErrorParts(err: unknown): ErrorParts {
  if (err instanceof Error) {
    const code =
      typeof (err as { code?: unknown }).code === "string"
        ? (err as { code?: string }).code
        : undefined;
    return {
      message: err.message,
      name: err.name || undefined,
      code,
      stack: typeof err.stack === "string" ? err.stack : undefined
    };
  }

  if (typeof err === "string") {
    return { message: err };
  }

  if (err === null) {
    return { message: "null" };
  }

  if (err === undefined) {
    return { message: "undefined" };
  }

  if (typeof err === "object") {
    const record = err as Record<string, unknown>;
    const message =
      typeof record.message === "string" ? record.message : safeStringify(err);
    const code = typeof record.code === "string" ? record.code : undefined;
    const stack = typeof record.stack === "string" ? record.stack : undefined;
    return { message, code, stack };
  }

  return { message: String(err) };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
