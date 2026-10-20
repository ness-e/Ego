import { isAbsolute, relative, resolve, sep } from "node:path";

/**
 * T2 (EGO-FIND-26) — Confuración de rutas para handlers IPC que leen disco.
 *
 * El renderer es **untrusted** (AGENTS.md §4). Cuatro handlers aceptaban rutas
 * absolutas del renderer sin validar contra el alcance del workspace:
 *
 * | Canal | Campo | Lectura |
 * |---|---|---|
 * | `ipc.knowledge.ingest` | `filePath` | `fs.readFile` (DocumentParser.parseFile) |
 * | `ipc.knowledge.explainArtifact` | `filePath` | lectura indirecta del grafo de trazas |
 * | `ipc.skills.listLocal` | `searchPaths` / `projectRoot` | `readdirSync` recursivo |
 * | `ipc.domains.engineering.status` | `workspaceRoot` | escaneo + `git` + worktrees |
 *
 * Este módulo centraliza la comprobación para que ningún handler pueda leer
 * fuera del alcance configurado.
 *
 * Implementación **fail-closed**: ante cualquier duda (ruta vacía, no
 * absoluta, error de resolución) se rechaza.
 */

/** Raíz del workspace en runtime (variable de entorno con fallback). */
export function defaultWorkspaceRoot(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = env["EGO_WORKSPACE_PATH"];
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) return resolve(fromEnv.trim());
  return resolve(process.cwd());
}

/** Normaliza separadores a `/` para comparar de forma portable. */
function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

/**
 * `true` si `target` está dentro de `root` (o es `root`).
 *
 * Resuelve ambas rutas a absolutas antes de comparar, de modo que `..` y
 * rutas relativas no puedan escapar del scope. La comparación es por
 *Components de path (no por prefijo de string), con lo que `C:\ws-evil`
 * NO cuenta como dentro de `C:\ws`.
 */
export function isPathWithin(target: string, root: string): boolean {
  if (typeof target !== "string" || typeof root !== "string") return false;
  const t = target.trim();
  const r = root.trim();
  if (t.length === 0 || r.length === 0) return false;

  const absTarget = isAbsolute(t) ? resolve(t) : resolve(root, t);
  const absRoot = resolve(r);

  const rel = relative(absRoot, absTarget);
  if (rel === "") return true; // target === root
  if (rel.startsWith("..")) return false; // fuera del scope
  if (isAbsolute(rel)) return false; // otro volumen (Windows) → fuera
  return true;
}

/**
 * `true` si `target` está dentro de **alguno** de los directorios de alcance.
 * Un scope vacío nunca autoriza (fail-closed).
 */
export function isPathInAnyScope(
  target: string,
  scopeDirs: readonly string[]
): boolean {
  if (!Array.isArray(scopeDirs) || scopeDirs.length === 0) return false;
  return scopeDirs.some((dir) => {
    if (typeof dir !== "string" || dir.trim().length === 0) return false;
    return isPathWithin(target, dir);
  });
}

/**
 * Resultado de la validación de una ruta de disco solicitada por el renderer.
 * `ok: false` incluye siempre un motivo legible para el renderer.
 */
export type PathScopeVerdict =
  | { ok: true; path: string }
  | { ok: false; reason: string };

/**
 * Valida una ruta solicitada por el renderer contra el alcance del workspace.
 *
 * @param rawPath    Ruta tal cual llega del renderer.
 * @param scopeDirs  Directorios autorizados (workspace + `additionalDirectories`).
 * @param label      Nombre del campo, para el mensaje de error.
 */
export function assertPathInScope(
  rawPath: unknown,
  scopeDirs: readonly string[],
  label: string
): PathScopeVerdict {
  if (typeof rawPath !== "string" || rawPath.trim().length === 0) {
    return { ok: false, reason: `${label}: la ruta no puede estar vacía.` };
  }
  const trimmed = rawPath.trim();
  const scope = scopeDirs.filter(
    (d): d is string => typeof d === "string" && d.trim().length > 0
  );
  if (scope.length === 0) {
    return {
      ok: false,
      reason: `${label}: no hay alcance configurado para leer del disco (fail-closed).`,
    };
  }
  if (!isPathInAnyScope(trimmed, scope)) {
    return {
      ok: false,
      reason: `${label}: la ruta está fuera del alcance del workspace (fail-closed).`,
    };
  }
  const resolvedPath = scope.reduce((acc, dir) => {
    const abs = resolve(dir.trim());
    const candidate = isAbsolute(trimmed) ? resolve(trimmed) : resolve(acc, trimmed);
    return isPathWithin(candidate, abs) ? candidate : acc;
  }, resolve(scope[0] as string));
  return { ok: true, path: resolvedPath };
}

/**
 * Normaliza una lista de rutas (para `searchPaths`): filtra las que están
 * fuera de alcance. Devuelve solo las autorizadas (fail-closed por omisión:
 * una ruta no autorizada se descarta, no se "aproxima").
 */
export function filterPathsInScope(
  rawPaths: unknown,
  scopeDirs: readonly string[]
): string[] {
  if (!Array.isArray(rawPaths)) return [];
  const out: string[] = [];
  for (const p of rawPaths) {
    const verdict = assertPathInScope(p, scopeDirs, "searchPath");
    if (verdict.ok) out.push(verdict.path);
  }
  return out;
}

/** Exposición del separador del SO (para mensajes de error legibles). */
export const PATH_SEPARATOR = sep;

/** Exposición del helper de normalización (tests). */
export const __posixPath = toPosix;
