/**
 * T11 (EGO-FIND-54) — Runtime de servidores MCP: persistencia, secretos y
 * saneado de estado para el renderer.
 *
 * Extraído del god-file `main.ts` sin cambiar comportamiento:
 *  - `buildMcpPersistedRecord`: config SIN secretos + `envRef` con blobs
 *    `enc:` opacos. `JSON.stringify` del resultado NUNCA contiene un
 *    secreto en claro (contrato de `gov/mcp_servers`).
 *  - `extractPersistedMcpRecord`: sanea el payload leído de memoria.
 *  - Migración de secretos (`needsMcpEnvMigration`, `mcpEnvKeysForCleanup`).
 *  - Vault de secretos por servidor (`storeMcpEnvSecrets`,
 *    `deleteMcpEnvSecrets`).
 *  - `sanitizeMcpRuntimeStateForRenderer`: el renderer NUNCA ve secretos.
 */
import { CredentialManager } from "@ego/security";
import {
  collectStorableMcpSecrets,
  isMaskedMcpEnvValue,
  isMcpSecretEnvName,
  mcpEnvVaultService,
  splitMcpServerEnv,
  type McpEnvSecretsRef,
  type McpEnvSecretVault,
} from "./mcp-env.js";
import { mainProcessCryptoBackend, maskKey } from "./credentials/vault.js";
import type { McpServerConfig, McpServerRuntimeState } from "@ego/integrations";

/** Registro `gov/mcp_servers`: config saneada + referencia opaca a secretos. */
export interface PersistedMcpServerRecord {
  config: McpServerConfig;
  enabled: boolean;
  envRef?: McpEnvSecretsRef;
}

/**
 * Construye el payload persistible: config SIN secretos + `envRef` con blobs
 * `enc:` opacos. `encrypt` se inyecta (prod: `encryptCredential`).
 * Garantía: `JSON.stringify(resultado)` nunca contiene un secreto en claro.
 */
export function buildMcpPersistedRecord(
  config: McpServerConfig,
  enabled: boolean,
  encrypt: (plainText: string) => string
): PersistedMcpServerRecord {
  const { publicEnv } = splitMcpServerEnv(config.env);
  const secrets = collectStorableMcpSecrets(config.env);
  const names = Object.keys(secrets);
  const sanitized: McpServerConfig = { ...config };
  if (Object.keys(publicEnv).length > 0) {
    sanitized.env = publicEnv;
  } else {
    delete sanitized.env;
  }
  if (names.length === 0) {
    return { config: sanitized, enabled };
  }
  const encrypted: Record<string, string> = {};
  for (const name of names) {
    const value: unknown = secrets[name];
    if (typeof value === "string") {
      encrypted[name] = encrypt(value);
    }
  }
  return {
    config: sanitized,
    enabled,
    envRef: { service: mcpEnvVaultService(config.id), keys: names, encrypted },
  };
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== "object" || value === null) return false;
  return Object.values(value as Record<string, unknown>).every(
    (entry) => typeof entry === "string"
  );
}

/**
 * Tolera los shapes históricos de `gov/mcp_servers`: `{ config, enabled }`
 * legado con env en claro, envelope de adapter `{ payload }` y JSON en
 * string. Retorna `null` si no hay config válida. Sin `any`.
 */
export function extractPersistedMcpRecord(raw: unknown): PersistedMcpServerRecord | null {
  let node: unknown = raw;
  if (typeof node === "string") {
    try {
      node = JSON.parse(node) as unknown;
    } catch {
      return null;
    }
  }
  if (typeof node === "object" && node !== null && "payload" in node) {
    const envelope = node as { payload?: unknown };
    if (typeof envelope.payload === "object" && envelope.payload !== null) {
      node = envelope.payload;
    } else if (typeof envelope.payload === "string") {
      try {
        node = JSON.parse(envelope.payload) as unknown;
      } catch {
        return null;
      }
    }
  }
  if (typeof node !== "object" || node === null) return null;
  const record = node as Record<string, unknown>;
  const rawConfig = record.config;
  if (typeof rawConfig !== "object" || rawConfig === null) return null;
  const cfg = rawConfig as Record<string, unknown>;
  if (typeof cfg.id !== "string" || cfg.id.length === 0) return null;
  if (typeof cfg.name !== "string" || typeof cfg.command !== "string") return null;
  const config: McpServerConfig = {
    id: cfg.id,
    name: cfg.name,
    transport: cfg.transport === "sse" ? "sse" : "stdio",
    command: cfg.command,
  };
  if (
    Array.isArray(cfg.args) &&
    cfg.args.every((entry: unknown): entry is string => typeof entry === "string")
  ) {
    config.args = [...cfg.args];
  }
  if (isStringRecord(cfg.env)) {
    config.env = { ...cfg.env };
  }
  if (typeof cfg.cwd === "string") config.cwd = cfg.cwd;
  if (typeof cfg.toolPrefix === "string") config.toolPrefix = cfg.toolPrefix;
  if (typeof cfg.timeoutMs === "number" && Number.isInteger(cfg.timeoutMs) && cfg.timeoutMs > 0) {
    config.timeoutMs = cfg.timeoutMs;
  }
  const enabled = typeof record.enabled === "boolean" ? record.enabled : true;
  const rawRef = record.envRef;
  if (typeof rawRef === "object" && rawRef !== null) {
    const ref = rawRef as Record<string, unknown>;
    if (
      typeof ref.service === "string" &&
      Array.isArray(ref.keys) &&
      ref.keys.every((entry: unknown): entry is string => typeof entry === "string")
    ) {
      const encrypted: Record<string, string> = {};
      if (isStringRecord(ref.encrypted)) {
        Object.assign(encrypted, ref.encrypted);
      }
      return { config, enabled, envRef: { service: ref.service, keys: [...ref.keys], encrypted } };
    }
  }
  return { config, enabled };
}

/**
 * Un registro necesita migración si trae secretos en claro en `config.env`
 * sin `envRef` (deuda F1T2/F5T10). Patrón restore de models.
 */
export function needsMcpEnvMigration(persisted: PersistedMcpServerRecord): boolean {
  if (persisted.envRef) return false;
  const env = persisted.config.env;
  if (!env) return false;
  return Object.entries(env).some(
    ([name, value]) =>
      isMcpSecretEnvName(name) &&
      typeof value === "string" &&
      value.length > 0 &&
      !isMaskedMcpEnvValue(value)
  );
}

/**
 * Rehidrata el env runtime: público en claro + secretos (vault primero,
 * blob `enc:` como respaldo). Retorna `missingSecrets` para warn visible en
 * vez de arranque a ciegas. `vaultGet` se inyecta (prod: Credential Manager).
 */
export async function resolveMcpRuntimeEnv(
  persisted: PersistedMcpServerRecord,
  decrypt: (stored: string) => string,
  vaultGet?: (service: string, account: string) => Promise<string | null>
): Promise<{ env?: Record<string, string>; missingSecrets: string[] }> {
  const { publicEnv } = splitMcpServerEnv(persisted.config.env);
  const keys = persisted.envRef?.keys ?? [];
  const service = persisted.envRef?.service ?? mcpEnvVaultService(persisted.config.id);
  const encrypted = persisted.envRef?.encrypted ?? {};
  const merged: Record<string, string> = { ...publicEnv };
  const missingSecrets: string[] = [];
  for (const name of keys) {
    let value: string | null = null;
    if (vaultGet) {
      try {
        value = await vaultGet(service, name);
      } catch (err) {
        console.warn(`[Security] Vault inaccesible para MCP env '${name}':`, err);
      }
    }
    if ((value === null || value.length === 0) && typeof encrypted[name] === "string") {
      const blob: unknown = encrypted[name];
      if (typeof blob === "string") {
        try {
          const decrypted = decrypt(blob);
          if (decrypted.length > 0) value = decrypted;
        } catch (err) {
          console.warn(`[Security] No se pudo descifrar MCP env '${name}':`, err);
        }
      }
    }
    if (value !== null && value.length > 0) {
      merged[name] = value;
    } else {
      missingSecrets.push(name);
    }
  }
  return { env: Object.keys(merged).length > 0 ? merged : undefined, missingSecrets };
}

/**
 * Claves del vault a borrar al eliminar un servidor (referencia o legado).
 */
export function mcpEnvKeysForCleanup(persisted: PersistedMcpServerRecord): string[] {
  if (persisted.envRef) return [...persisted.envRef.keys];
  return splitMcpServerEnv(persisted.config.env).secretNames;
}

/**
 * Env para el renderer: secretos enmascarados, público intacto.
 */
export function maskMcpEnvForRenderer(
  env: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!env) return undefined;
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(env)) {
    out[name] = isMcpSecretEnvName(name) ? maskKey(value) : value;
  }
  return out;
}

/**
 * Estado runtime para el renderer sin secretos en claro (fuga IPC cerrada).
 */
export function sanitizeMcpRuntimeStateForRenderer(
  state: McpServerRuntimeState
): McpServerRuntimeState {
  const maskedEnv = maskMcpEnvForRenderer(state.config.env);
  // STAB-12: los valores de headers nunca viajan al renderer en claro
  // (pueden portar `X-Api-Key`); solo viajan los nombres.
  const headers = state.config.headers;
  const maskedHeaders = headers
    ? Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, maskKey(v)]))
    : undefined;
  if (maskedEnv === undefined && maskedHeaders === undefined) return state;
  return {
    ...state,
    config: {
      ...state.config,
      ...(maskedEnv === undefined ? {} : { env: maskedEnv }),
      ...(maskedHeaders === undefined ? {} : { headers: maskedHeaders }),
    },
  };
}

/**
 * Vault de sesión para env MCP sobre el llavero del SO (vía
 * `mainProcessCryptoBackend`). Reutiliza `CredentialManager` canónico de
 * `@ego/security`; no duplica cripto. `storeSecret` puede lanzar sin
 * safeStorage: los handlers lo tratan best-effort con warn (el cifrado
 * persiste igual).
 */
/**
 * E6 (Ola 2): el vault de secretos MCP es estado LOCAL del módulo (no
 * del proceso) → holder `const`, no `let` global mutable.
 */
const mcpVaultState: { manager: CredentialManager | null } = { manager: null };

export function getMcpCredentialManager(): CredentialManager {
  if (!mcpVaultState.manager) {
    mcpVaultState.manager = new CredentialManager(mainProcessCryptoBackend);
  }
  return mcpVaultState.manager;
}

/** Solo tests: inyecta un vault falso en el singleton de sesión. */
export function setMcpCredentialManagerForTests(manager: CredentialManager | null): void {
  mcpVaultState.manager = manager;
}

/** Guarda secretos de un servidor en el vault (servicio `mcp/<id>/env`). */
export async function storeMcpEnvSecrets(
  vault: McpEnvSecretVault,
  serverId: string,
  secrets: Record<string, string>
): Promise<void> {
  const service = mcpEnvVaultService(serverId);
  for (const [name, value] of Object.entries(secrets)) {
    await vault.storeSecret(service, name, value);
  }
}

/** Borra secretos de un servidor del vault (best-effort, propaga errores). */
export async function deleteMcpEnvSecrets(
  vault: McpEnvSecretVault,
  serverId: string,
  names: string[]
): Promise<void> {
  const service = mcpEnvVaultService(serverId);
  for (const name of names) {
    await vault.deleteSecret(service, name);
  }
}
