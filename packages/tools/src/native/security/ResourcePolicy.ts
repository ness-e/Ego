/**
 * Política de Filtrado Seguro de URLs y Recursos (Patrón Coucou COUC-13 / SafeWebURL).
 *
 * Protege al Desktop Main y Renderer de abrir arbitrariamente esquemas inseguros
 * (file://, smb://, javascript:, esquemas de aplicaciones locales como vscode://)
 * generados por modelos de lenguaje o payloads externos no confiables.
 */

export class ResourcePolicy {
  private static readonly ALLOWED_SCHEMES = new Set(["http:", "https:"]);

  /**
   * Valida y retorna una instancia URL si y sólo si es una dirección web legítima
   * con esquema http o https y host válido no vacío.
   */
  public static safeWebUrl(rawUrl: string | null | undefined): URL | null {
    if (!rawUrl) return null;

    const trimmed = rawUrl.trim();
    if (!trimmed) return null;

    // Rechazar protocol-relative URLs (//example.com) o esquemas sin doble barra (https:example.com)
    const lower = trimmed.toLowerCase();
    if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
      return null;
    }

    try {
      const parsed = new URL(trimmed);
      const scheme = parsed.protocol.toLowerCase();

      if (!this.ALLOWED_SCHEMES.has(scheme)) {
        return null;
      }

      if (!parsed.host || parsed.host.trim() === "") {
        return null;
      }

      // Validar que el hostname no esté vacío
      if (!parsed.hostname || parsed.hostname.trim() === "") {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Determina si la URL proporcionada cumple con la política web segura.
   */
  public static isSafeWebUrl(rawUrl: string | null | undefined): boolean {
    return this.safeWebUrl(rawUrl) !== null;
  }

  /**
   * Valida la URL y lanza un error explicativo si viola la política de seguridad.
   */
  public static assertSafeWebUrl(rawUrl: string | null | undefined, context: string = "URL"): URL {
    const validated = this.safeWebUrl(rawUrl);
    if (!validated) {
      throw new Error(
        `[ResourcePolicy] Violación de seguridad en ${context}: Sólo se permiten enlaces web 'http:' y 'https:' con host válido. Rechazado: "${rawUrl}"`
      );
    }
    return validated;
  }
}
