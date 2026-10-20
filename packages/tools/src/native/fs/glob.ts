/**
 * Glob matcher mínimo (sin dependencias externas) para las tools de
 * filesystem de Ego (`fs_glob`, `fs_grep`).
 *
 * Semántica:
 * - `*` no cruza `/` (un solo segmento).
 * - `**` cruza cualquier nivel (incluye cero segmentos intermedios).
 * - `?` casa un carácter (no `/`).
 * - `{a,b}` alternancia (se expande a `(a|b)`).
 *
 * Mismo criterio que el `globToRegExp` de `packages/tasks` (ProactivityEngine),
 * pero sin dependencia entre paquetes.
 */

const GLOBSTAR_TOKEN = "\u0000";
const GLOBSTAR_SLASH_TOKEN = "\u0001";

/**
 * Traduce un glob a una expresión regular anclada.
 */
export function globToRegExp(pattern: string): RegExp {
  const withTokens = pattern.split("**").join(GLOBSTAR_TOKEN);
  const escaped = withTokens.replace(/[.+^${}()|[\]\\]/g, "\\$&");

  // Alternancia `{a,b}` → `(a|b)` (antes de escapar los corchetes).
  const withAlternatives = escaped.replace(/\\\{([^{}]*)\\?\}/g, (_m, group: string) => {
    return `(${group.split(",").map((alt) => alt.trim()).join("|")})`;
  });

  const collapsed = withAlternatives
    .split(`${GLOBSTAR_TOKEN}/`)
    .join(GLOBSTAR_SLASH_TOKEN)
    .split(GLOBSTAR_TOKEN)
    .join(".*");

  const starred = collapsed
    .split("*")
    .join("[^/]*")
    .split(GLOBSTAR_SLASH_TOKEN)
    .join("(?:.*/)?");

  return new RegExp(`^${starred}$`);
}

/**
 * `true` si la ruta coincide con el patrón glob.
 */
export function matchesGlob(filePath: string, pattern: string): boolean {
  if (pattern === "*" || pattern === "**/*" || pattern === "**") return true;
  return globToRegExp(pattern).test(filePath);
}

/**
 * Casa un patrón glob contra un path RELATIVO (posix) o absoluto.
 * Si el patrón no es absoluto, se compara contra la ruta relativa.
 */
export function matchesGlobPath(relativePath: string, absolutePath: string, pattern: string): boolean {
  if (pattern.startsWith("/") || /^[A-Za-z]:[\\/]/.test(pattern)) {
    return matchesGlob(absolutePath.replace(/\\/g, "/"), pattern.replace(/\\/g, "/"));
  }
  return matchesGlob(relativePath.replace(/\\/g, "/"), pattern);
}
