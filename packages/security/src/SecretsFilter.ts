/**
 * SecretsFilter — Barrera Zero Secrets in Storage (SEC-04 / Fase 11).
 *
 * Interceptor puro y sin dependencias que detecta API keys, tokens y
 * secretos en texto libre, payloads y metadatos ANTES de que lleguen a
 * VantaDB, a los logs o a los prompts. Vive en `@ego/security` (main
 * process) y está diseñado para el borde de escritura `put/putMulti`
 * de `EgoMemoryAdapter` sin importar nada de `@ego/memory` (tipado
 * estructural: cero aristas nuevas entre paquetes, el wiring real lo
 * hace SEC-09).
 *
 * Garantías:
 * - Fail-closed: `assertNoSecrets` lanza ante cualquier hallazgo.
 * - Cero eco: findings y errores nombran REGLAS y campos, nunca valores.
 * - Redacción global e idempotente: `redact(redact(x)) === redact(x)`.
 *
 * Limitaciones honestas (ver taskfile SEC-04):
 * - Detección por patrones + re-escaneo base64 a un nivel; un secreto
 *   partido en fragmentos que por separado no matchean ninguna regla y
 *   cuya serialización JSON tampoco lo recompone de forma contigua
 *   puede evadir el escaneo (mitigado: el CredentialManager de SEC-03
 *   sigue siendo la única vía legítima para secretos).
 * - No sustituye al vault: solo impide la FUGA hacia storage/logs/prompts.
 */

export interface SecretFinding {
  /** Nombre de la regla que disparó (p. ej. `canary`, `jwt`). Nunca un valor. */
  rule: string;
  /** Dónde se halló: `"text"`, ruta `payload.…` / `metadata.…`, o `(whole)`. */
  field: string;
  /** Ocurrencias redactadas para esta regla en este campo. */
  occurrences: number;
}

export interface ScanOptions {
  /** Tope de caracteres escaneados por string (DoS guard). Defecto 1_000_000. */
  maxInputChars?: number;
}

export interface TextScanResult {
  hasSecrets: boolean;
  findings: SecretFinding[];
  redactedText: string;
  truncated: boolean;
}

export interface EgoPutLike {
  namespace: string;
  key: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

export interface PutScanResult {
  hasSecrets: boolean;
  findings: SecretFinding[];
  redactedPayload: unknown;
  redactedMetadata?: Record<string, unknown>;
}

const DEFAULT_MAX_INPUT_CHARS = 1_000_000;
const MAX_BASE64_CANDIDATE_CHARS = 4096;
const MAX_BASE64_DECODE_ATTEMPTS = 20;

interface SecretRule {
  name: string;
  /**
   * Patrón global. Puede capturar `(contexto)(valor)` para conservar el
   * contexto en la redacción; si `valueGroup` es 2 solo se redacta el valor.
   */
  pattern: RegExp;
  valueGroup?: number;
}

function redactMarker(ruleName: string): string {
  return `[REDACTED:${ruleName}]`;
}

/**
 * Reglas ordenadas de específica → genérica. Los marcadores `[REDACTED:…]`
 * están diseñados para no matchear ninguna regla (idempotencia).
 */
const SECRET_RULES: SecretRule[] = [
  // Canarios de test: el prefijo solo ya dispara (captura fragmentos
  // partidos entre campos). Riesgo de FP en prosa: despreciable.
  { name: "canary", pattern: /sk-test-[A-Za-z0-9_-]*/gi },
  { name: "anthropic_key", pattern: /sk-ant-[A-Za-z0-9_-]{8,}/g },
  { name: "openai_key", pattern: /sk-(?:proj-)?[A-Za-z0-9_-]{16,}/g },
  { name: "stripe_live_key", pattern: /[rs]k-live-[A-Za-z0-9]{16,}/g },
  { name: "github_token", pattern: /(?:gh[pous]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{16,})/g },
  { name: "slack_token", pattern: /xox[abpras]-[A-Za-z0-9-]{10,}/g },
  { name: "google_api_key", pattern: /AIza[A-Za-z0-9_-]{35}/g },
  { name: "aws_access_key", pattern: /AKIA[0-9A-Z]{16}/g },
  {
    name: "jwt",
    pattern: /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  },
  {
    name: "private_key_block",
    pattern: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g,
  },
  {
    name: "bearer_token",
    pattern: /(bearer\s+)([A-Za-z0-9\-._~+/=]{20,})/gi,
    valueGroup: 2,
  },
  {
    name: "assigned_secret",
    pattern: /((?:api[_-]?key|api[_-]?secret|secret[_-]?key|secret[_-]?access[_-]?key|aws[_-]?secret|access[_-]?token|auth[_-]?token|client[_-]?secret|passwd|password|pwd)\s*[:=]\s*['"]?)([A-Za-z0-9_\-+/=]{12,})/gi,
    valueGroup: 2,
  },
];

function resolveMaxChars(options?: ScanOptions): number {
  const raw = options?.maxInputChars;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }
  return DEFAULT_MAX_INPUT_CHARS;
}

function clonePattern(source: RegExp): RegExp {
  return new RegExp(source.source, source.flags.includes("g") ? source.flags : `${source.flags}g`);
}

function applyDirectRules(
  input: string,
  field: string,
  findings: SecretFinding[],
): string {
  let working = input;
  for (const rule of SECRET_RULES) {
    const pattern = clonePattern(rule.pattern);
    pattern.lastIndex = 0;
    if (rule.valueGroup === 2) {
      working = working.replace(pattern, (_match, context: string) => {
        findings.push({ rule: rule.name, field, occurrences: 1 });
        return `${context}${redactMarker(rule.name)}`;
      });
    } else {
      working = working.replace(pattern, () => {
        findings.push({ rule: rule.name, field, occurrences: 1 });
        return redactMarker(rule.name);
      });
    }
  }
  return working;
}

function tryBase64Decode(candidate: string): string | null {
  const normalized = candidate.replace(/=+$/, "");
  if (normalized.length < 32) return null;
  try {
    const decoded = Buffer.from(candidate, "base64");
    if (decoded.length < 8 || decoded.length > 65536) return null;
    const roundTrip = decoded.toString("base64").replace(/=+$/, "");
    if (roundTrip !== normalized) return null;
    const text = decoded.toString("utf-8");
    if (!/^[\x09\x0a\x0d\x20-\x7e]*$/.test(text)) return null;
    return text;
  } catch {
    return null;
  }
}

/**
 * Re-escaneo de blobs base64 a UN nivel (sin recursión): detecta secretos
 * envueltos (`token=<canario>` codificado). Acotado por candidato y por
 * intentos (DoS guard). Corre ANTES de las reglas directas para que el
 * blob se redacte íntegro antes de cualquier coincidencia parcial.
 */
function applyBase64Pass(input: string, field: string, findings: SecretFinding[]): string {
  const candidatePattern = /[A-Za-z0-9+/]{32,}={0,2}/g;
  let attempts = 0;
  return input.replace(candidatePattern, (candidate: string) => {
    if (candidate.length > MAX_BASE64_CANDIDATE_CHARS) return candidate;
    if (attempts >= MAX_BASE64_DECODE_ATTEMPTS) return candidate;
    attempts += 1;
    const decoded = tryBase64Decode(candidate);
    if (decoded === null) return candidate;
    const inner: SecretFinding[] = [];
    applyDirectRules(decoded, field, inner);
    if (inner.length === 0) return candidate;
    findings.push({ rule: "base64_wrapped_secret", field, occurrences: 1 });
    return redactMarker("base64_wrapped_secret");
  });
}

function scanSingleString(input: string, field: string, options?: ScanOptions): TextScanResult {
  const maxChars = resolveMaxChars(options);
  const truncated = input.length > maxChars;
  const head = truncated ? input.slice(0, maxChars) : input;
  const findings: SecretFinding[] = [];
  const afterBase64 = applyBase64Pass(head, field, findings);
  const redactedText = applyDirectRules(afterBase64, field, findings);
  return { hasSecrets: findings.length > 0, findings, redactedText, truncated };
}

/** Escanea texto libre (payload string, línea de log, fragmento de prompt). */
export function scanText(input: string, options?: ScanOptions): TextScanResult {
  if (typeof input !== "string") return { hasSecrets: false, findings: [], redactedText: "", truncated: false };
  return scanSingleString(input, "text", options);
}

/** ¿Contiene secretos? (atajo booleano sobre `scanText`). */
export function containsSecret(input: string, options?: ScanOptions): boolean {
  return scanText(input, options).hasSecrets;
}

/** Redacta todos los secretos de un texto (global + idempotente). */
export function redactText(input: string, options?: ScanOptions): string {
  return scanText(input, options).redactedText;
}

/** Alias semántico para líneas de log: misma redacción, intención explícita. */
export function sanitizeForLog(line: string, options?: ScanOptions): string {
  return redactText(line, options);
}

/**
 * Fail-closed: lanza `Error` ante cualquier hallazgo. El mensaje incluye
 * reglas y contexto, NUNCA valores en claro.
 */
export function assertNoSecrets(input: string, context = "unknown", options?: ScanOptions): void {
  const result = scanText(input, options);
  if (!result.hasSecrets) return;
  const rules = [...new Set(result.findings.map((f) => f.rule))].sort().join(",");
  throw new Error(
    `[SecretsFilter] Secreto bloqueado en ${context} (reglas: ${rules}, ` +
      `ocurrencias: ${result.findings.length}). Valor omitido por seguridad.`,
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function collectLeaves(
  value: unknown,
  basePath: string,
  out: Array<{ path: string; text: string }>,
  seen: Set<object>,
): void {
  if (typeof value === "string") {
    out.push({ path: basePath, text: value });
    return;
  }
  if (typeof value !== "object" || value === null) return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectLeaves(entry, `${basePath}[${index}]`, out, seen));
    return;
  }
  if (isPlainRecord(value)) {
    for (const [k, v] of Object.entries(value)) {
      collectLeaves(v, `${basePath}.${k}`, out, seen);
    }
  }
}

function deepRedact(value: unknown, options?: ScanOptions): unknown {
  if (typeof value === "string") return scanSingleString(value, "structured", options).redactedText;
  if (Array.isArray(value)) return value.map((entry) => deepRedact(entry, options));
  if (isPlainRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = deepRedact(v, options);
    return out;
  }
  return value;
}

/**
 * Escanea un put con forma `{namespace, key, payload, metadata?}` — la
 * forma estructural de `EgoPut` sin importar `@ego/memory`.
 * Estrategia doble: hojas string con ruta de campo + pasada sobre la
 * serialización JSON conjunta (defensa ante secretos a caballo entre
 * campos). Devuelve copias redactadas, nunca muta la entrada.
 */
export function scanEgoPut(input: EgoPutLike, options?: ScanOptions): PutScanResult {
  const findings: SecretFinding[] = [];
  const leaves: Array<{ path: string; text: string }> = [];
  const seen = new Set<object>();
  collectLeaves(input.payload, "payload", leaves, seen);
  if (input.metadata !== undefined) collectLeaves(input.metadata, "metadata", leaves, seen);

  for (const leaf of leaves) {
    const single = scanSingleString(leaf.text, leaf.path, options);
    for (const f of single.findings) findings.push(f);
  }

  try {
    const whole = JSON.stringify({ payload: input.payload, metadata: input.metadata ?? null });
    const wholeScan = scanSingleString(whole, "(whole)", options);
    const leafKeys = new Set(findings.map((f) => `${f.rule}@${f.field}`));
    for (const f of wholeScan.findings) {
      if (!leafKeys.has(`${f.rule}@${f.field}`)) findings.push(f);
    }
  } catch {
    // Serialización imposible (p. ej. BigInt): las hojas ya cubren el escaneo.
  }

  return {
    hasSecrets: findings.length > 0,
    findings,
    redactedPayload: deepRedact(input.payload, options),
    redactedMetadata:
      input.metadata === undefined
        ? undefined
        : (deepRedact(input.metadata, options) as Record<string, unknown>),
  };
}
