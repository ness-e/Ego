/**
 * Secretos de entorno MCP → Credential Manager (Deuda F1T2/F5T10).
 *
 * Extraído de `../main.ts` (STAB-09). Decisión de diseño (evidencia +
 * trade-offs explícitos, ver bloque original en `main.ts`):
 * - `AddMcpServerSchema.env` es `z.record(z.string())` libre: el schema NO
 *   distingue secreto de valor operativo. La heurística es por segmentos del
 *   NOMBRE (`KEY`/`TOKEN`/`SECRET`/`PAT`/…). Comparación por segmento (no
 *   subcadena) para no clasificar `AUTHOR` como secreto. Trade-off conocido:
 *   un secreto en una var con nombre exótico NO se vaultiza.
 * - Los valores NO secretos persisten en claro para arranque degradado.
 * - VantaDB (`gov/mcp_servers`) solo guarda referencias opacas (`enc:` de
 *   safeStorage u `obf:` legado): un secret-scan NUNCA ve el PAT en claro.
 * - Las respuestas IPC al renderer NUNCA llevan secretos en claro.
 */

/** Segmentos de nombre de var de entorno que denotan secreto. */
export const MCP_SECRET_ENV_SEGMENTS: ReadonlySet<string> = new Set([
  "KEY",
  "KEYS",
  "TOKEN",
  "TOKENS",
  "SECRET",
  "SECRETS",
  "PAT",
  "PATS",
  "PASSWORD",
  "PASSWD",
  "PWD",
  "AUTH",
  "CREDENTIAL",
  "CREDENTIALS",
  "PRIVATE",
  "SIGNATURE",
]);

/**
 * Heurística de secreto por nombre de variable de entorno (comparación por
 * segmento en mayúsculas).
 */
export function isMcpSecretEnvName(name: unknown): boolean {
  if (typeof name !== "string" || name.length === 0) return false;
  const segments = name.toUpperCase().split(/[^A-Z0-9]+/);
  return segments.some((segment) => MCP_SECRET_ENV_SEGMENTS.has(segment));
}

/**
 * Divide un `env` MCP en valores públicos (persisten en claro) y nombres de
 * secretos (van al vault + `envRef`). Nunca registra ni retorna valores.
 */
export function splitMcpServerEnv(env: Record<string, string> | undefined): {
  publicEnv: Record<string, string>;
  secretNames: string[];
} {
  const publicEnv: Record<string, string> = {};
  const secretNames: string[] = [];
  if (!env) return { publicEnv, secretNames };
  for (const [name, value] of Object.entries(env)) {
    if (isMcpSecretEnvName(name)) {
      secretNames.push(name);
    } else if (typeof value === "string") {
      publicEnv[name] = value;
    }
  }
  return { publicEnv, secretNames };
}

/** Servicio del vault para un servidor: `mcp/<server-id>/env` (cuenta = var). */
export function mcpEnvVaultService(serverId: string): string {
  return `mcp/${serverId}/env`;
}

/**
 * Detecta valores enmascarados para el renderer (`sk-t...7890`, `••••`).
 * Una máscara NUNCA se almacena como secreto (patrón settings Task 10).
 */
export function isMaskedMcpEnvValue(value: unknown): boolean {
  return (
    typeof value === "string" && (value.includes("...") || value.includes("••••"))
  );
}

/** Referencia persistida a los secretos de un servidor (sin texto plano). */
export interface McpEnvSecretsRef {
  service: string;
  keys: string[];
  encrypted: Record<string, string>;
}

/**
 * Superficie mínima del vault que los handlers MCP necesitan. `CredentialManager`
 * la satisface estructuralmente (también `McpTokenStore.getSecret`).
 */
export interface McpEnvSecretVault {
  storeSecret(service: string, account: string, secret: string): Promise<void>;
  getSecret(service: string, account: string): Promise<string | null>;
  deleteSecret(service: string, account: string): boolean | Promise<boolean>;
}

/**
 * Secretos almacenables del env entrante: no vacíos y no enmascarados. Las
 * máscaras del renderer se resuelven contra lo guardado, jamás se persisten.
 */
export function collectStorableMcpSecrets(
  env: Record<string, string> | undefined
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!env) return out;
  const { secretNames } = splitMcpServerEnv(env);
  for (const name of secretNames) {
    const value: unknown = env[name];
    if (typeof value === "string" && value.length > 0 && !isMaskedMcpEnvValue(value)) {
      out[name] = value;
    }
  }
  return out;
}
