/**
 * E5 (Ola 5 · T1) — Identidad declarativa de Sub-Egos en el producto.
 *
 * ## Qué resuelve
 * Un Sub-Ego puede declarar su identidad en un artefacto (`SOUL.md` /
 * `AGENT.md`) en vez de dentro del manifiesto. A3 implementó el cargador en
 * `packages/subegos` (`loadSubEgoIdentity`) y lo **verificó**, pero el
 * producto **nunca lo llamaba**: el turno seguía usando
 * `SubEgoSoul.fromManifest(manifest)` → la identidad declarativa era
 * inalcanzable (`EGO-FIND-88`).
 *
 * Este módulo es la **costura del producto**: una función pura y testeable
 * que `resolveTurnSoul` (en `main.ts`) consume.
 *
 * ## La semántica que se respeta (fail-closed en gobernanza)
 * - Sin declaración de identidad → el loader en código (manifiesto).
 * - Declaración **no obligatoria** y fichero ilegible → **fallback** al
 *   manifiesto + aviso (fail-open de IDENTIDAD).
 * - Declaración **obligatoria** (`required: true`) y fichero ilegible →
 *   **error tipado** (`SubEgoIdentityNotFoundError`). El turno NO puede
 *   continuar con otra identidad: sería sustituir la identidad declarada
 *   por el nucleus sin que nadie lo note.
 */
import {
  createNodeIdentityFileReader,
  loadSubEgoIdentity,
  type SubEgoIdentityFileReader,
  type SubEgoManifest,
  type SubEgoSoul,
} from "@ego/subegos";

/** Resultado de resolver la identidad de un Sub-Ego. */
export interface ResolvedSubEgoIdentity {
  /** Alma efectiva (del fichero o del manifiesto). */
  readonly soul: SubEgoSoul;
  /** De dónde salió. */
  readonly source: "file" | "manifest";
  /** Ruta absoluta del artefacto (sólo si vino de un fichero). */
  readonly file?: string;
  /** Avisos no fatales (p. ej. el fichero no se pudo leer). */
  readonly warnings: readonly string[];
}

/** Opciones de resolución. */
export interface ResolveSubEgoIdentityOptions {
  /** Raíz del workspace a la que se anclan las rutas relativas. */
  readonly workspacePath?: string;
  /** Lector de ficheros (inyectable en tests). */
  readonly reader?: SubEgoIdentityFileReader;
  /** Permite leer identidades fuera del workspace. */
  readonly allowOutsideWorkspace?: boolean;
}

/**
 * Resuelve el alma de un Sub-Ego honrando su artefacto de identidad.
 *
 * @throws `SubEgoIdentityNotFoundError` si la identidad es **obligatoria** y
 *   su fichero no se puede leer (fail-closed).
 * @throws `SubEgoIdentityUnsafePathError` si la ruta sale del confine.
 */
export async function resolveSubEgoIdentity(
  manifest: SubEgoManifest,
  options: ResolveSubEgoIdentityOptions = {}
): Promise<ResolvedSubEgoIdentity> {
  const resolution = await loadSubEgoIdentity(manifest, {
    reader: options.reader ?? createNodeIdentityFileReader(),
    ...(options.workspacePath !== undefined
      ? { workspacePath: options.workspacePath }
      : {}),
    ...(options.allowOutsideWorkspace !== undefined
      ? { allowOutsideWorkspace: options.allowOutsideWorkspace }
      : {}),
  });
  return {
    soul: resolution.soul,
    source: resolution.source,
    ...(resolution.file !== undefined ? { file: resolution.file } : {}),
    warnings: resolution.warnings,
  };
}

/**
 * ¿El error es el de identidad obligatoria ausente?
 *
 * Lo usa `resolveTurnSoul` para NO convertir un fail-closed en un
 * fallback silencioso: si la identidad es obligatoria y falta, el turno
 * debe fallar con su error tipado, no con el nucleus.
 */
export function isRequiredIdentityMissing(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === "SubEgoIdentityNotFoundError"
  );
}
