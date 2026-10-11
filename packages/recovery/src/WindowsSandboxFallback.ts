import * as fs from "node:fs";
import * as path from "node:path";

export const WINDOWS_SANDBOX_MARKER_FILENAME = "windows-sandbox-fallback.json";
export const WINDOWS_SANDBOX_BREAKPOINT_EXIT = -2147483645; // STATUS_BREAKPOINT 0x80000003
export const BOOT_ABORTS_BEFORE_FALLBACK = 2;

export type SandboxMarkerState = "booting" | "fallback" | "ok";
export type SandboxFallbackReason = "gpu-breakpoint" | "renderer-crash-loop" | "boot-loop";

export interface SandboxMarker {
  state: SandboxMarkerState;
  reason?: SandboxFallbackReason;
  version?: string;
  bootAborts?: number;
  reprobe?: boolean;
}

/**
 * Retorna la ruta completa al archivo marcador de sandbox en userData.
 */
export function sandboxMarkerPath(userDataDir: string): string {
  return path.join(String(userDataDir || ""), WINDOWS_SANDBOX_MARKER_FILENAME);
}

/**
 * Comprueba si un código de salida corresponde al crash STATUS_BREAKPOINT (0x80000003).
 */
export function isWindowsSandboxBreakpointExit(exitCode: unknown): boolean {
  const n = Number(exitCode);
  if (!Number.isFinite(n)) return false;
  return n === WINDOWS_SANDBOX_BREAKPOINT_EXIT || (n >>> 0) === 0x80000003;
}

/**
 * Determina si el entorno ya tiene deshabilitado el sandbox mediante argumentos o variable de entorno.
 */
export function alreadyHasNoSandbox(
  argv: readonly string[] = process.argv,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (Array.isArray(argv) && argv.includes("--no-sandbox")) {
    return true;
  }
  const disable = String(env.ELECTRON_DISABLE_SANDBOX || "").trim();
  return disable === "1" || disable.toLowerCase() === "true";
}

/**
 * Evalúa el marcador de sandbox al arrancar para decidir si debe activarse el fallback `--no-sandbox`.
 */
export function evaluateSandboxFallback(
  marker: SandboxMarker | null,
  currentAppVersion?: string
): { shouldDisableSandbox: boolean; nextMarker: SandboxMarker } {
  if (!marker) {
    return {
      shouldDisableSandbox: false,
      nextMarker: { state: "booting", bootAborts: 1, version: currentAppVersion },
    };
  }

  // Si la versión de la app cambió, damos una oportunidad de re-evaluación limpia (re-probe)
  if (marker.version && currentAppVersion && marker.version !== currentAppVersion) {
    return {
      shouldDisableSandbox: false,
      nextMarker: { state: "booting", bootAborts: 1, version: currentAppVersion, reprobe: true },
    };
  }

  if (marker.state === "fallback") {
    return {
      shouldDisableSandbox: true,
      nextMarker: marker,
    };
  }

  const aborts = (marker.bootAborts ?? 0) + 1;
  if (aborts >= BOOT_ABORTS_BEFORE_FALLBACK) {
    return {
      shouldDisableSandbox: true,
      nextMarker: {
        state: "fallback",
        reason: "boot-loop",
        bootAborts: aborts,
        version: currentAppVersion,
      },
    };
  }

  return {
    shouldDisableSandbox: false,
    nextMarker: {
      state: "booting",
      bootAborts: aborts,
      version: currentAppVersion,
    },
  };
}

/**
 * Lee el marcador desde disco de forma síncrona y segura.
 */
export function readSandboxMarker(userDataDir: string): SandboxMarker | null {
  try {
    const p = sandboxMarkerPath(userDataDir);
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw) as SandboxMarker;
  } catch {
    return null;
  }
}

/**
 * Escribe el marcador a disco de forma síncrona.
 */
export function writeSandboxMarker(userDataDir: string, marker: SandboxMarker): void {
  try {
    const p = sandboxMarkerPath(userDataDir);
    fs.writeFileSync(p, JSON.stringify(marker, null, 2), "utf8");
  } catch {
    // Si no se puede escribir, no se interrumpe el arranque
  }
}

/**
 * Marca el arranque como exitoso y sano, reseteando el contador de aborts.
 */
export function markSandboxBootSuccessful(userDataDir: string, version?: string): void {
  writeSandboxMarker(userDataDir, { state: "ok", bootAborts: 0, version });
}
