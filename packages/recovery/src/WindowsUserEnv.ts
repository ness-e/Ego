import { execFileSync } from "node:child_process";

export interface ExecFileSyncLike {
  (file: string, args: readonly string[], options: { encoding: BufferEncoding; windowsHide?: boolean; timeout?: number }): string | Buffer;
}

export interface ReadEnvOptions {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  exec?: ExecFileSyncLike;
}

/**
 * Parsea la salida de `reg query HKCU\Environment /v <name>`.
 */
export function parseRegQueryValue(stdout: string | null | undefined, name: string): string | null {
  if (!stdout || !name) return null;

  const typePattern = /^(\S+)\s+(?:REG_SZ|REG_EXPAND_SZ|REG_MULTI_SZ|REG_DWORD|REG_QWORD|REG_BINARY|REG_NONE)\s+(.*)$/;

  for (const rawLine of String(stdout).split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = line.match(typePattern);

    if (match && match[1] && match[2] !== undefined && match[1].toLowerCase() === name.toLowerCase()) {
      return match[2];
    }
  }

  return null;
}

/**
 * Expande referencias `%VAR%` contra un mapa de variables de entorno.
 */
export function expandWindowsEnvRefs(
  value: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env
): string {
  if (!value) return "";

  return value.replace(/%([^%]+)%/g, (whole, name) => {
    const key = Object.keys(env).find((k) => k.toUpperCase() === String(name).toUpperCase());
    return key != null && env[key] != null ? env[key]! : whole;
  });
}

/**
 * Lee una variable de entorno de alcance de usuario directamente del registro de Windows (HKCU\Environment).
 * Extraído y adaptado de Hermes Agent HERM-06.
 */
export function readWindowsUserEnvVar(name: string, options: ReadEnvOptions = {}): string | null {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const exec = options.exec ?? execFileSync;

  if (platform !== "win32" || !name) {
    return null;
  }

  let stdout: string;
  try {
    const rawOut = exec("reg", ["query", "HKCU\\Environment", "/v", name], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 5000,
    });
    stdout = typeof rawOut === "string" ? rawOut : String(rawOut);
  } catch {
    // Si reg no existe o la variable no está en el registro, retorna null
    return null;
  }

  const raw = parseRegQueryValue(stdout, name);
  if (raw == null) return null;

  const expanded = expandWindowsEnvRefs(raw, env).trim();
  return expanded || null;
}

/**
 * Repara el PATH del proceso en Windows agregando las rutas de herramientas de usuario registradas en HKCU\Environment\PATH
 * que no hayan sido capturadas al arrancar desde el Explorer/acceso directo.
 */
export function repairWindowsUserPath(options: ReadEnvOptions = {}): boolean {
  const platform = options.platform ?? process.platform;
  if (platform !== "win32") return false;

  const env = options.env ?? process.env;
  const regPath = readWindowsUserEnvVar("PATH", options);
  if (!regPath) return false;

  const currentPath = env.PATH || "";
  const currentSegments = new Set(
    currentPath
      .split(";")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );

  const regSegments = regPath
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  const missingSegments: string[] = [];
  for (const seg of regSegments) {
    if (!currentSegments.has(seg.toLowerCase())) {
      missingSegments.push(seg);
    }
  }

  if (missingSegments.length > 0) {
    env.PATH = `${currentPath};${missingSegments.join(";")}`;
    return true;
  }

  return false;
}
