export interface NetPolicyOptions {
  allowLocalhost?: boolean;
  allowedProtocols?: string[];
  blockedHostnames?: string[];
}

/**
 * Validador de política de seguridad de red anti-SSRF (OCLW-09).
 * Extraído y adaptado de OpenClaw packages/net-policy.
 *
 * Previene ataques de Server-Side Request Forgery en tools de navegación web,
 * fetching de URLs o webhooks, bloqueando acceso a redes privadas,
 * loopback y endpoints de metadatos de proveedores cloud (AWS/GCP/Azure).
 */
export class NetPolicy {
  private static readonly BLOCKED_HOSTNAMES = new Set([
    "localhost",
    "127.0.0.1",
    "::1",
    "0.0.0.0",
    "metadata.google.internal",
    "instance-data",
  ]);

  private static readonly CLOUD_METADATA_IPS = new Set([
    "169.254.169.254", // AWS, GCP, Azure, OpenStack
    "100.100.100.200", // Alibaba Cloud
    "fd00:ec2::254",   // AWS IPv6 metadata
  ]);

  /**
   * Comprueba si una dirección IPv4 pertenece a rangos privados, loopback o link-local.
   */
  public static isBlockedIpv4(ip: string): boolean {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return false;
    }

    const a = parts[0]!;
    const b = parts[1]!;

    // 127.0.0.0/8 (Loopback)
    if (a === 127) return true;

    // 0.0.0.0/8 (Dirección actual)
    if (a === 0) return true;

    // 10.0.0.0/8 (Privada RFC 1918)
    if (a === 10) return true;

    // 172.16.0.0/12 (Privada RFC 1918: 172.16.x.x - 172.31.x.x)
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.168.0.0/16 (Privada RFC 1918)
    if (a === 192 && b === 168) return true;

    // 169.254.0.0/16 (Link-local y Cloud Metadata)
    if (a === 169 && b === 254) return true;

    // 100.64.0.0/10 (Carrier-Grade NAT: 100.64.x.x - 100.127.x.x)
    if (a === 100 && b >= 64 && b <= 127) return true;

    // 224.0.0.0/4 (Multicast) y 240.0.0.0/4 (Reservado)
    if (a >= 224) return true;

    return false;
  }

  /**
   * Comprueba si una dirección IPv6 es loopback, link-local o privada.
   */
  public static isBlockedIpv6(ip: string): boolean {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;

    // fe80::/10 (Link-local)
    if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) {
      return true;
    }

    // fc00::/7 (Unique local: fc00:: o fd00::)
    if (lower.startsWith("fc") || lower.startsWith("fd")) {
      return true;
    }

    return false;
  }

  /**
   * Valida la seguridad de una URL antes de realizar una petición HTTP/fetch.
   */
  public static validateUrl(
    candidateUrl: string,
    options: NetPolicyOptions = {}
  ): { safe: boolean; reason?: string } {
    let parsed: URL;
    try {
      parsed = new URL(candidateUrl);
    } catch {
      return { safe: false, reason: "URL malformada o inválida." };
    }

    const allowedProtocols = options.allowedProtocols ?? ["http:", "https:"];
    if (!allowedProtocols.includes(parsed.protocol)) {
      return {
        safe: false,
        reason: `Protocolo '${parsed.protocol}' no permitido por la política de red.`,
      };
    }

    const hostname = parsed.hostname.toLowerCase();

    if (options.allowLocalhost && (hostname === "localhost" || hostname === "127.0.0.1")) {
      return { safe: true };
    }

    if (this.BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
      return {
        safe: false,
        reason: `Acceso denegado al host protegido o interno: '${hostname}'.`,
      };
    }

    if (this.CLOUD_METADATA_IPS.has(hostname)) {
      return {
        safe: false,
        reason: `Intento de acceso a endpoint de metadatos cloud bloqueado por SSRF policy: '${hostname}'.`,
      };
    }

    // Comprobar si es IPv4 directa
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      if (this.isBlockedIpv4(hostname)) {
        return {
          safe: false,
          reason: `Dirección IPv4 privada o especial bloqueada por SSRF policy: '${hostname}'.`,
        };
      }
    }

    // Comprobar si es IPv6 directa
    if (hostname.includes(":")) {
      if (this.isBlockedIpv6(hostname)) {
        return {
          safe: false,
          reason: `Dirección IPv6 privada o especial bloqueada por SSRF policy: '${hostname}'.`,
        };
      }
    }

    return { safe: true };
  }

  /**
   * Redacta datos de autenticación sensibles presentes en URLs (user:password).
   */
  public static redactUrl(url: string): string {
    try {
      const parsed = new URL(url);
      if (parsed.username || parsed.password) {
        parsed.username = "***";
        parsed.password = "***";
      }
      return parsed.toString();
    } catch {
      return url;
    }
  }
}
