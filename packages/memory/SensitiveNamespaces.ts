/**
 * SensitiveNamespaces — Detector de namespaces sensibles (SEC-09 / Fase 11).
 *
 * Módulo puro y sin dependencias: clasifica un namespace de VantaDB como
 * sensible (PII, financiero, credenciales, plano de control, estado privado)
 * para la cuarentena por defecto ante la ausencia de cifrado at-rest en el
 * motor (origen VantaDB FIND-249: la feature `encryption` no está cableada de
 * extremo a extremo y el almacenamiento real puede contener plaintext).
 *
 * El detector es la mitad del wiring SEC-09; la otra mitad es el veredicto de
 * contenido de `@ego/security` (`SecretsFilter.scanEgoPut`, SEC-04), que es
 * independiente del namespace. Defensa en profundidad:
 * - Un secreto REAL siempre lo captura la regla de contenido, aunque el
 *   namespace evada este detector (p. ej. `crm-leads` con guion).
 * - Este detector cubre datos sensibles POR CONTEXTO que ningún patrón
 *   detecta (cifras salariales, diario personal, contactos) en namespaces
 *   sensibles por nombre.
 *
 * Residuales honestos (fail-closed donde importa):
 * - `kb/secretary-notes` → sensible por subcadena (falso positivo aceptado:
 *   cuarentena, nunca fuga).
 * - `crm-leads` (guion en lugar de `/`) → NO detectado por prefijo; cubierto
 *   solo por la regla de contenido.
 * - `%ZZ` malformado → se conserva el texto crudo tras un intento de
 *   decodificación acotado (nunca lanza).
 */

export interface SensitiveVerdict {
  sensitive: boolean;
  /** Código de motivo (nunca contiene valores sensibles: solo prefijos/tokens). */
  reason: string;
}

/**
 * Prefijos de dominio (sobre el namespace normalizado + `/`) cuyo contenido
 * es sensible por construcción. `support/` se restringe a `support/tickets`
 * (`support/kb` es documentación pública del dominio).
 */
export const SENSITIVE_NAMESPACE_PREFIXES = [
  "gov/",
  "system/",
  "finance/",
  "crm/",
  "journal/",
  "egos/",
  "ecom/",
  "support/tickets",
] as const;

/**
 * Tokens sensibles: si algún segmento del namespace coincide (exacto) o
 * contiene (subcadena, solo tokens de longitud >= 6 para acotar FPs) uno de
 * estos tokens, el namespace es sensible. `audit` NO es token a propósito:
 * `projects/audit` y `gov/audit` son namespaces operativos, no secretos.
 */
export const SENSITIVE_NAMESPACE_TOKENS = [
  "secret",
  "secrets",
  "credential",
  "credentials",
  "passwd",
  "password",
  "passwords",
  "apikey",
  "api_key",
  "api-key",
  "token",
  "tokens",
  "private",
  "confidential",
  "vault",
  "wallet",
  "mnemonic",
  "mnemonics",
  "passport",
  "passports",
  "ssn",
  "salary",
  "salaries",
  "payroll",
  "payment",
  "payments",
  "bank",
  "banking",
  "invoice",
  "invoices",
  "health",
  "medical",
  "biometric",
  "biometrics",
] as const;

const MIN_SUBSTRING_TOKEN_LENGTH = 6;

/**
 * Normalización anti-evasión: recorte, intento de decodificación %XX,
 * minúsculas, `\` → `/`, colapso de barras y sin barras extremas.
 */
export function normalizeNamespace(raw: string): string {
  let ns = (raw ?? "").trim();
  try {
    if (ns.includes("%")) {
      ns = decodeURIComponent(ns);
    }
  } catch {
    // %ZZ malformado: se conserva el texto crudo, nunca se lanza.
  }
  return ns
    .toLowerCase()
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

/**
 * Exenciones estructurales (solo registros operativos del propio sistema, sin
 * payload de usuario por construcción; la regla de contenido SEC-04 SIGUE
 * aplicándoles):
 * - `quarantine/*`: destino del routing (evita recursión).
 * - `gov/audit*`: trazabilidad inmutable SEC-06 (incluye `gov/audit/actions`).
 * - `gov/sub_egos*`: registro de manifiestos (punteros estructurales).
 */
export function quarantineExemption(ns: string): string | null {
  const clean = normalizeNamespace(ns);
  if (clean === "quarantine" || clean.startsWith("quarantine/")) return "exempt:quarantine-target";
  if (clean === "gov/audit" || clean.startsWith("gov/audit/")) return "exempt:gov-audit";
  if (clean === "gov/sub_egos" || clean.startsWith("gov/sub_egos/")) return "exempt:gov-sub-egos";
  return null;
}

/**
 * Diferimientos de enforcement (SEC-09, stopgap FIND-249).
 *
 * Estos prefijos SON sensibles (el detector los marca), pero su enforcement
 * (cuarentena por defecto) se DIFIERE porque tienen lectores operativos
 * vivos sin flujos quarantine-aware, y cuarentenarlos hoy no sería un
 * control sino una desactivación de la capacidad.
 *
 * Historial de retiro (follow-up SEC-09 FIX-01, aprobado por el owner):
 * - `crm/` → RETIRADO: `CrmDomain.hydrate/getContact` son quarantine-aware
 *   (live + `quarantine/pending` con marca explícita).
 * - `egos/` → RETIRADO: `SubEgoMemoryGuard.get/recall/searchMulti` resuelven
 *   vía cuarentena con marca explícita.
 * - `system/checkpoints` → RETIRADO: `EgoMemoryLifecycle.loadMicroCheckpoint`
 *   lee vía cuarentena (sin lectores live previos que romper).
 * - `system/snapshots` → DIFERIDO RESTANTE: `SessionCheckpointPolicy` ya
 *   expone lectura quarantine-aware (`loadCheckpoint`), pero
 *   `DailyStatePersistence` (`system/snapshots/daily`, fuera del alcance de
 *   este follow-up) sigue leyendo solo live — retirar el prefijo hoy
 *   invisibilizaría los snapshots diarios hasta su migración. Evidencia en
 *   SEC-09 §FIX-01-seguimiento.
 * Mientras tanto rigen: (1) la regla de secretos SEC-04 es UNIVERSAL
 * (también aquí: 0 secretos en storage/logs); (2) cada escritura diferida
 * emite un aviso explícito con este motivo. Vía de cierre: lectores
 * quarantine-aware por dominio (FIX_PROPUESTO-SEC-09-01) o, mejor, el
 * cifrado at-rest real al cerrar VantaDB FIND-249 (disuelve el dilema).
 */
export const QUARANTINE_ENFORCEMENT_DEFERRALS = [
  "system/snapshots",
] as const;

/** ¿El namespace difiere su enforcement (vive + aviso, sin cuarentenar)? */
export function isEnforcementDeferred(raw: string): boolean {
  const clean = normalizeNamespace(raw);
  for (const d of QUARANTINE_ENFORCEMENT_DEFERRALS as readonly string[]) {
    if (d.endsWith("/")) {
      const bare = d.slice(0, -1);
      if (clean === bare || clean.startsWith(d)) return true;
    } else if (clean === d || clean.startsWith(`${d}/`)) {
      return true;
    }
  }
  return false;
}

/** Clasifica un namespace como sensible o no, con motivo explícito. */
export function isSensitiveNamespace(raw: string): SensitiveVerdict {
  const clean = normalizeNamespace(raw);
  if (clean.length === 0) return { sensitive: false, reason: "empty" };

  const exempt = quarantineExemption(raw);
  if (exempt) return { sensitive: false, reason: exempt };

  for (const prefix of SENSITIVE_NAMESPACE_PREFIXES) {
    const bare = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
    if (clean === bare || clean.startsWith(prefix)) {
      return { sensitive: true, reason: `sensitive_prefix:${prefix}` };
    }
  }

  const segments = clean.split("/");
  for (const segment of segments) {
    for (const token of SENSITIVE_NAMESPACE_TOKENS) {
      if (segment === token || (token.length >= MIN_SUBSTRING_TOKEN_LENGTH && segment.includes(token))) {
        return { sensitive: true, reason: `sensitive_token:${token}` };
      }
    }
  }

  return { sensitive: false, reason: "live" };
}
