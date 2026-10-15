/**
 * Política SSRF en la frontera de seguridad (STAB-14, patrón openclaw net-policy).
 *
 * `NetPolicy` canónico vive en `@ego/tools` (`native/security/NetPolicy.ts`).
 * Este módulo expone la misma superficie de decisión en `@ego/security` SIN
 * crear dependencia `security → tools` (evita ciclo): lógica pura standalone
 * con los mismos vectores bloqueados (localhost / 127/8 / 0/8 / RFC1918
 * 10/8·172.16/12·192.168/16 / link-local 169.254/16 / CGNAT 100.64/10 /
 * multicast-reservado 224+/4 / IPv6 ::1·fe80·fc·fd / hosts metadata cloud).
 * Los tests pinean los vectores del contrato; divergencia futura = bug.
 */
export interface SSRFCheck {
  safe: boolean;
  reason?: string;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "metadata.google.internal",
  "instance-data",
  "169.254.169.254",
  "100.100.100.200",
]);

export function isBlockedSSRFIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts as [number, number, number, number];
  if (a === 127 || a === 0 || a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

export function isBlockedSSRFIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (
    lower.startsWith("fe8") ||
    lower.startsWith("fe9") ||
    lower.startsWith("fea") ||
    lower.startsWith("feb")
  ) {
    return true;
  }
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  return false;
}

export function validateSSRFUrl(raw: string, opts: { allowLocalhost?: boolean } = {}): SSRFCheck {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { safe: false, reason: "URL malformada o inválida." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { safe: false, reason: `Protocolo '${parsed.protocol}' no permitido.` };
  }
  // Credenciales embebidas user:pass nunca son seguras en fetch server-side.
  if (parsed.username || parsed.password) {
    return { safe: false, reason: "URL con credenciales embebidas bloqueada." };
  }
  const host = parsed.hostname.toLowerCase();
  if (opts.allowLocalhost && (host === "localhost" || host === "127.0.0.1")) return { safe: true };
  if (
    BLOCKED_HOSTNAMES.has(host) ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return { safe: false, reason: `Host interno/protegido bloqueado: '${host}'.` };
  }
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) && isBlockedSSRFIPv4(host)) {
    return { safe: false, reason: `IPv4 privada/especial bloqueada: '${host}'.` };
  }
  if (host.includes(":") && isBlockedSSRFIPv6(host)) {
    return { safe: false, reason: `IPv6 privada/especial bloqueada: '${host}'.` };
  }
  return { safe: true };
}
