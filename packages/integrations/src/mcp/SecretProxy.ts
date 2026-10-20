/**
 * SecretProxy — proxy de secretos para servidores MCP (Decisión D2, Ola 1 / A3 / T3).
 *
 * PROBLEMA (EGO-FIND-33)
 * ---------------------
 * `McpClient.spawnProcess` construía el `env` del subproceso como
 * `{ ...process.env, ...config.env }`. Dos filtraciones:
 *
 * 1. **El entorno completo** (tokens de proveedor, `NODE_OPTIONS`, rutas de
 *    credenciales del SO) viajaba al subproceso.
 * 2. **El token real** del servidor MCP viajaba en claro en su `env`: el
 *    proceso externo (potencialmente de terceros) leía la credencial.
 *
 * DECISIÓN DEL OWNER (D2)
 * -----------------------
 * El subproceso MCP recibe `EGO_SECRET_<NOMBRE>={{SECRET:<clave>}}` en lugar
 * del valor real. El **cliente MCP** (en el proceso main, que sí tiene acceso
 * al keychain vía `CredentialManager`) resuelve el marcador al construir la
 * petición saliente. El servidor MCP nunca ve el token.
 *
 * EXCEPCIÓN REGISTRADA
 * --------------------
 * Los servidores que exigen el token en la `env` **al arrancar** (health-check
 * contra su propia API) no pueden usar el marcador: el marcador no es un token
 * válido. Esos servidores se declaran con `secretDelivery: "env"` y conservan
 * la env real. Ver la lista explícita en el handoff A3.
 */

import { sanitizeProcessEnv } from "@ego/tools";

/** Prefijo de las variables de entorno que llevan un marcador de secreto. */
export const SECRET_ENV_PREFIX = "EGO_SECRET_";

/** Patrón del marcador embebido en valores de texto. */
export const SECRET_MARKER_PATTERN = /\{\{SECRET:([A-Za-z0-9_.:@/-]+)\}\}/g;

/**
 * Resuelve una clave de secreto a su valor real.
 * En producción lo implementa `CredentialManager` de `@ego/security`
 * (keychain del SO). Se mantiene como interfaz estructural para no crear
 * dependencia entre paquetes.
 */
export type SecretResolver = (key: string) => Promise<string | undefined> | string | undefined;

/** Marcador de secreto parseado. */
export interface ParsedSecretMarker {
  /** Nombre de la variable de entorno original (p. ej. `GITHUB_TOKEN`). */
  readonly name: string;
  /** Clave del secreto en el almacén (p. ej. `github:pat`). */
  readonly key: string;
}

/**
 * Construye el marcador canónico de un secreto.
 *
 * `buildSecretMarker("GITHUB_TOKEN", "github:pat")`
 *   → `EGO_SECRET_GITHUB_TOKEN={{SECRET:github:pat}}`
 */
export function buildSecretMarker(name: string, key: string): string {
  const normalized = name
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .replace(/^_+/, "");
  return `${SECRET_ENV_PREFIX}${normalized}={{SECRET:${key}}}`;
}

/**
 * Parsea un valor de env que sea un marcador completo (`EGO_SECRET_X={{SECRET:k}}`).
 * Devuelve `null` si no lo es.
 */
export function parseSecretMarker(value: string): ParsedSecretMarker | null {
  const match = /^([A-Za-z0-9_]+)=\{\{SECRET:([A-Za-z0-9_.:@/-]+)\}\}$/.exec(value.trim());
  if (!match) return null;
  const name = match[1] ?? "";
  const key = match[2] ?? "";
  if (!name.startsWith(SECRET_ENV_PREFIX) || key.length === 0) return null;
  return { name: name.slice(SECRET_ENV_PREFIX.length), key };
}

/**
 * Sustituye todos los marcadores embebidos en un payload JSON por el valor
 * real del secreto.
 *
 * Fail-closed: si el resolver no conoce la clave, el marcador se deja
 * intacto (preferible a enviar un valor vacío o inventado).
 */
export async function resolveSecretMarkers<T>(payload: T, resolver: SecretResolver): Promise<T> {
  if (typeof payload === "string") {
    return (await resolveString(payload, resolver)) as unknown as T;
  }
  if (Array.isArray(payload)) {
    const out: unknown[] = [];
    for (const item of payload) {
      out.push(await resolveSecretMarkers(item, resolver));
    }
    return out as unknown as T;
  }
  if (payload && typeof payload === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      out[key] = await resolveSecretMarkers(value, resolver);
    }
    return out as unknown as T;
  }
  return payload;
}

/**
 * Resuelve los marcadores dentro de un único string.
 */
async function resolveString(value: string, resolver: SecretResolver): Promise<string> {
  if (!value.includes("{{SECRET:")) return value;

  const matches = [...value.matchAll(SECRET_MARKER_PATTERN)];
  if (matches.length === 0) return value;

  let out = value;
  for (const match of matches) {
    const key = match[1];
    if (!key) continue;
    const resolved = await resolver(key);
    if (resolved === undefined || resolved === null) continue; // fail-closed
    out = out.split(match[0]).join(resolved);
  }
  return out;
}

/** Opciones de construcción del `env` del subproceso MCP. */
export interface BuildMcpChildEnvOptions {
  /** Entorno base del proceso (por defecto `process.env`). */
  readonly baseEnv?: NodeJS.ProcessEnv;
  /** Variables extra permitidas además de la allowlist estándar. */
  readonly extraAllowedEnv?: ReadonlySet<string>;
}

/**
 * Construye el `env` del subproceso MCP:
 * - allowlist explícita (no `{...process.env}`),
 * - los secretos declarados en `config.secrets` se sustituyen por su MARCADOR,
 * - salvo que el servidor declare `secretDelivery: "env"` (excepción registrada).
 */
export function buildMcpChildEnv(
  config: {
    env?: Record<string, string>;
    secrets?: Record<string, string>;
    secretDelivery?: "marker" | "env";
  },
  options: BuildMcpChildEnvOptions = {}
): Record<string, string> {
  const base = options.baseEnv ?? process.env;
  const env = sanitizeProcessEnv(base, options.extraAllowedEnv);

  const declaredSecrets = config.secrets ?? {};
  const delivery = config.secretDelivery ?? "marker";

  for (const [name, value] of Object.entries(config.env ?? {})) {
    const secretKey = declaredSecrets[name];
    if (secretKey && delivery === "marker") {
      // El subproceso NUNCA ve el valor real: solo el marcador.
      env[name] = buildSecretMarker(name, secretKey);
      continue;
    }
    env[name] = value;
  }

  return env;
}
