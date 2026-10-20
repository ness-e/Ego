/**
 * Superficie de compatibilidad de la política SSRF en `@ego/security`.
 *
 * **Delegación pura**: la implementación vive en `./ssrfPolicy.js` (política
 * canónica de Ego, con resolución DNS). Este módulo conserva los nombres
 * históricos (`isBlockedSSRFIPv4`, `isBlockedSSRFIPv6`, `validateSSRFUrl`)
 * para no romper llamantes, pero **no contiene lógica duplicada**: si
 * divergen, es un bug (R4 / EGO-FIND-66).
 */
import { NetPolicy } from "./ssrfPolicy.js";

export interface SSRFCheck {
  safe: boolean;
  reason?: string;
}

/** IPv4 privada/especial bloqueada (delegado en la política canónica). */
export function isBlockedSSRFIPv4(ip: string): boolean {
  return NetPolicy.isBlockedIpv4(ip);
}

/** IPv6 privada/especial bloqueada (delegado en la política canónica). */
export function isBlockedSSRFIPv6(ip: string): boolean {
  return NetPolicy.isBlockedIpv6(ip);
}

/**
 * Valida una URL contra la política canónica (chequeo léxico; para DNS usar
 * `NetPolicy.validateUrlWithDns`).
 */
export function validateSSRFUrl(
  raw: string,
  opts: { allowLocalhost?: boolean } = {}
): SSRFCheck {
  const verdict = NetPolicy.validateUrl(raw, { allowLocalhost: opts.allowLocalhost });
  return verdict.safe ? { safe: true } : { safe: false, reason: verdict.reason };
}
