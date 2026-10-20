import dns from "node:dns/promises";

/**
 * Política de red anti-SSRF **canónica** de Ego.
 *
 * UNIFICACIÓN (R4 / EGO-FIND-66 / A3-09 + A2)
 * ---------------------------------------------
 * Antes de la Ola 1b existían **tres** políticas de red divergentes:
 *
 * 1. `packages/tools/src/native/security/NetPolicy.ts` (A3) — la única con
 *    resolución DNS, pero en el paquete de conectores nativos.
 * 2. `packages/security/src/netPolicy.ts` — superficie standalone sin DNS.
 * 3. `packages/security/src/ToolPermissions.ts` — "réplica léxica" (comparaba
 *    sólo la cadena del host, sin resolver DNS).
 *
 * La réplica léxica es insuficiente: `http://attacker.example` que resuelve a
 * `127.0.0.1` (DNS rebinding) la atraviesa. Y dos políticas de red siempre
 * producen un bypass: la que se usa puede no ver lo que la otra bloquea.
 *
 * **Este módulo es la única implementación.** Vive en `@ego/security` porque:
 * - `@ego/security` es una **hoja** (0 dependencias `@ego/*`): nunca puede
 *   entrar en ciclo, y la dirección segura es `tools → security` (las
 *   herramientas pueden depender de las primitivas de seguridad; al revés no).
 * - La política es una primitiva de **seguridad**, no de conectores: su
 *   consumidor natural (`ToolPermissions`) vive en este mismo paquete.
 *
 * Nota de nomenclatura: el fichero se llama `ssrfPolicy.ts` (y no
 * `NetPolicy.ts`) porque en sistemas de ficheros sin mayúsculas
 * (`netPolicy.ts` legacy) un nombre que sólo difiere en mayúsculas provoke
 * TS1149 y colisiones de resolución.
 *
 * Handoff a A3: `packages/tools/src/native/security/NetPolicy.ts` debe
 * reexportar de aquí (`export { NetPolicy } from "@ego/security"`), lo que
 * requiere `packages/tools/package.json` += `"@ego/security": "workspace:*"`
 * y un `pnpm install` (A7). Hasta que eso ocurra, ambas copias coexisten
 * **con la misma semántica** (mismos vectores, mismo orden de decisiones).
 */

export interface NetPolicyOptions {
  allowLocalhost?: boolean;
  allowedProtocols?: string[];
  blockedHostnames?: string[];
}

/**
 * Opciones de la validación con resolución DNS.
 */
export interface NetPolicyDnsOptions extends NetPolicyOptions {
  /**
   * Resolver de DNS inyectable (tests). Por defecto `dns.promises.lookup`.
   * Devuelve todas las direcciones del host.
   */
  resolver?: (hostname: string) => Promise<string[]>;
  /**
   * `true` para resolver el host. Por defecto `true`.
   */
  resolveDns?: boolean;
}

/**
 * Validador de política de seguridad de red anti-SSRF (OCLW-09).
 *
 * Previene ataques de Server-Side Request Forgery en tools de navegación web,
 * fetching de URLs o webhooks, bloqueando acceso a redes privadas,
 * loopback y endpoints de metadatos de proveedores cloud (AWS/GCP/Azure).
 */
export class NetPolicy {
  private static readonly DEFAULT_BLOCKED_HOSTNAMES = new Set([
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
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
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
    if (
      lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb")
    ) {
      return true;
    }

    // fc00::/7 (Unique local: fc00:: o fd00::)
    if (lower.startsWith("fc") || lower.startsWith("fd")) {
      return true;
    }

    return false;
  }

  /**
   * Comprueba si una IP (v4 o v6) está bloqueada por la política.
   */
  public static isBlockedIp(ip: string): boolean {
    if (this.isBlockedIpv4(ip)) return true;
    if (ip.includes(":")) return this.isBlockedIpv6(ip);
    return false;
  }

  /**
   * Valida la seguridad de una URL antes de realizar una petición HTTP/fetch.
   *
   * Comprobación **léxica** (sin DNS). Útil para validaciones síncronas
   * rápidas; para peticiones reales usa `validateUrlWithDns`.
   */
  public static validateUrl(
    candidateUrl: string,
    options: NetPolicyOptions = {}
  ): { safe: boolean; reason?: string } {
    let parsed: URL;
    try {
      parsed = new URL(candidateUrl.trim());
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

    // Credenciales embebidas user:pass nunca son seguras en fetch server-side.
    if (parsed.username || parsed.password) {
      return { safe: false, reason: "URL con credenciales embebidas bloqueada." };
    }

    const hostname = parsed.hostname.toLowerCase();

    if (
      options.allowLocalhost &&
      (hostname === "localhost" || hostname === "127.0.0.1")
    ) {
      return { safe: true };
    }

    const blockedHostnames = options.blockedHostnames
      ? new Set([...this.DEFAULT_BLOCKED_HOSTNAMES, ...options.blockedHostnames])
      : this.DEFAULT_BLOCKED_HOSTNAMES;

    if (
      blockedHostnames.has(hostname) ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    ) {
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
   * Resuelve el host a todas sus direcciones IPv4/IPv6.
   */
  private static async resolveHost(hostname: string): Promise<string[]> {
    try {
      const records = await dns.lookup(hostname, { all: true, verbatim: true });
      return records.map((r) => r.address);
    } catch {
      // Si el DNS falla, se devuelve la lista vacía: el llamante decide.
      return [];
    }
  }

  /**
   * Valida una URL **resolviendo DNS** (fail-closed ante DNS rebinding).
   *
   * Un host cuyo nombre resuelve a una IP privada/loopback/link-local se
   * bloquea, aunque la cadena del host sea inocente. Si **alguna** de las
   * direcciones resueltas es especial, se bloquea (fail-closed).
   *
   * Si la resolución DNS falla, la política NO bloquea por sí sola (el error
   * de red se manifiesta en la petición), pero sí cuando el host es
   * literalmente una IP bloqueada (caso cubierto por `validateUrl`).
   */
  public static async validateUrlWithDns(
    candidateUrl: string,
    options: NetPolicyDnsOptions = {}
  ): Promise<{ safe: boolean; reason?: string; resolvedAddresses?: string[] }> {
    const lexical = this.validateUrl(candidateUrl, options);
    if (!lexical.safe) {
      return { safe: false, reason: lexical.reason };
    }

    let parsed: URL;
    try {
      parsed = new URL(candidateUrl.trim());
    } catch {
      return { safe: false, reason: "URL malformada o inválida." };
    }

    const hostname = parsed.hostname.toLowerCase();
    // Una IP literal ya la validó la comprobación léxica.
    const isIpLiteral =
      /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) || hostname.includes(":");
    if (isIpLiteral) {
      return { safe: true, resolvedAddresses: [hostname] };
    }

    const shouldResolve = options.resolveDns ?? true;
    if (!shouldResolve) {
      return { safe: true };
    }

    const resolver = options.resolver ?? NetPolicy.resolveHost.bind(NetPolicy);
    let addresses: string[];
    try {
      addresses = await resolver(hostname);
    } catch (err: unknown) {
      return {
        safe: false,
        reason: `No se pudo resolver el host '${hostname}' para validar la política de red: ${
          err instanceof Error ? err.message : String(err)
        }`,
      };
    }

    if (addresses.length === 0) {
      // Resolución vacía: no hay dirección que reprobar. La petición fallará
      // por red, no por política.
      return { safe: true, resolvedAddresses: [] };
    }

    for (const address of addresses) {
      if (this.isBlockedIp(address) || this.CLOUD_METADATA_IPS.has(address)) {
        return {
          safe: false,
          reason: `El host '${hostname}' resuelve a la dirección privada/especial '${address}', bloqueada por SSRF policy (DNS rebinding).`,
          resolvedAddresses: addresses,
        };
      }
    }

    return { safe: true, resolvedAddresses: addresses };
  }

  /**
   * Variante que lanza (`fail-closed`) de `validateUrlWithDns`.
   */
  public static async assertSafeUrl(
    candidateUrl: string,
    options: NetPolicyDnsOptions = {}
  ): Promise<void> {
    const verdict = await this.validateUrlWithDns(candidateUrl, options);
    if (!verdict.safe) {
      throw new Error(
        `[NetPolicy] URL bloqueada por SSRF policy: ${verdict.reason ?? "host no permitido"}.`
      );
    }
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
