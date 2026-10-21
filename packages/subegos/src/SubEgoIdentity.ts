import * as path from "node:path";
import * as fsp from "node:fs/promises";
import { z } from "zod";
import { SubEgoSoul, type SubEgoSoulInput } from "./SubEgoSoul.js";
import { SoulDocumentError } from "./soulDocument.js";
import type { SubEgoIdentity, SubEgoManifest } from "./types.js";

/**
 * E5 (Ola 4b / A3 / T1) — Identidad declarativa de los Sub-Egos.
 *
 * ## Por qué
 *
 * La identidad de un Sub-Ego (nombre, rol, valores, reglas innegociables,
 * narrativa) vivía **en código**: `SubEgoSoul.ts` (628 líneas) con su esquema
 * Zod. Eso obligaba a tocar TypeScript para crear un especialista nuevo y
 * hacía imposible versionar la identidad junto al proyecto que la usa.
 *
 * E5 externaliza la identidad a un **artefacto declarativo** (`SOUL.md` o
 * `AGENT.md`: frontmatter YAML + cuerpo Markdown) que el **manifiesto**
 * declara y el runtime carga.
 *
 * ## Garantías
 *
 * 1. **La API pública no cambia**: si el manifiesto no declara artefacto, el
 *    loader en código (`SubEgoSoul.fromManifest`) sigue siendo el fallback.
 * 2. **Fail-closed**: `identity.required = true` + artefacto ausente ⇒ error
 *    tipado (no una identidad vacía en silencio).
 * 3. **Confine**: la ruta se ancla al workspace; salir de él es un error
 *    tipado (path traversal).
 * 4. **El manifiesto sigue siendo la autoridad de gobernanza**: el artefacto
 *    declara *identidad*, no tools, permisos, namespaces ni presupuesto.
 */

/**
 * Formatos de artefacto de identidad soportados.
 * - `soul-md`: frontmatter plano (SOUL.md canónico).
 * - `agent-md`: frontmatter plano o anidado bajo `soul:` (AGENT.md).
 * - `auto`: se deduce del nombre del fichero.
 */
export const SubEgoIdentityFormatSchema = z.enum(["auto", "soul-md", "agent-md"]);

/**
 * Declaración de identidad embebida en el manifiesto del Sub-Ego.
 *
 * El TIPO `SubEgoIdentityFormat` vive en `types.ts` (junto al resto de los
 * tipos del manifiesto) y se reexporta desde el índice del paquete. Aquí sólo
 * vive el esquema Zod, para no duplicar el símbolo en dos módulos.
 */
export const SubEgoIdentitySchema = z.object({
  /** Ruta del artefacto (relativa al workspace o absoluta). */
  file: z.string().min(1, "La ruta del artefacto de identidad no puede estar vacía.").max(512),
  /** Formato del artefacto. */
  format: SubEgoIdentityFormatSchema.default("auto"),
  /** Si es `true`, la ausencia del artefacto aborta la carga (fail-closed). */
  required: z.boolean().default(false)
});

/** Error base de la identidad declarativa. */
export class SubEgoIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubEgoIdentityError";
  }
}

/** El artefacto declarado es obligatorio pero no se pudo leer. */
export class SubEgoIdentityNotFoundError extends SubEgoIdentityError {
  constructor(
    public readonly subEgoId: string,
    public readonly file: string,
    public readonly cause?: unknown
  ) {
    super(
      `El Sub-Ego '${subEgoId}' declara su identidad en '${file}', pero el artefacto no existe o no se pudo leer ` +
        `(identity.required = true: la identidad es obligatoria y no se degrada a un valor por defecto).`
    );
    this.name = "SubEgoIdentityNotFoundError";
  }
}

/** La ruta del artefacto sale del confine permitido (workspace). */
export class SubEgoIdentityUnsafePathError extends SubEgoIdentityError {
  constructor(
    public readonly subEgoId: string,
    public readonly file: string,
    public readonly resolved: string
  ) {
    super(
      `El Sub-Ego '${subEgoId}' declara su identidad en '${file}', que resuelve fuera del confine permitido ` +
        `('${resolved}'). La identidad declarativa no puede leer fuera del workspace.`
    );
    this.name = "SubEgoIdentityUnsafePathError";
  }
}

/**
 * Lector de ficheros inyectado (DIP): el paquete no abre ficheros por su
 * cuenta; el main process (o un test) aporta el lector.
 */
export interface SubEgoIdentityFileReader {
  readFile(filePath: string): Promise<string>;
}

/**
 * Lector por defecto sobre `node:fs/promises`.
 */
export function createNodeIdentityFileReader(): SubEgoIdentityFileReader {
  return {
    readFile: async (filePath: string): Promise<string> => fsp.readFile(filePath, "utf8")
  };
}

/** Opciones de carga de la identidad. */
export interface SubEgoIdentityLoadOptions {
  /** Lector de ficheros (obligatorio). */
  reader: SubEgoIdentityFileReader;
  /** Workspace al que se anclan las rutas relativas. */
  workspacePath?: string;
  /** Permite leer fuera del workspace (identidades globales). */
  allowOutsideWorkspace?: boolean;
  /** Defaults del alma (típicamente derivados del manifiesto). */
  defaults?: Partial<SubEgoSoulInput>;
}

/** Resultado de la resolución de identidad. */
export interface SubEgoIdentityResolution {
  /** Alma efectiva. */
  readonly soul: SubEgoSoul;
  /** De dónde salió el alma. */
  readonly source: "file" | "manifest";
  /** Ruta absoluta del artefacto (sólo si `source === "file"`). */
  readonly file?: string;
  /** Avisos no fatales. */
  readonly warnings: string[];
}

/**
 * Deduce el formato efectivo del artefacto a partir de su nombre.
 */
export function detectIdentityFormat(file: string): "soul-md" | "agent-md" {
  const base = path.basename(file).toLowerCase();
  if (base === "agent.md" || base === "agents.md") return "agent-md";
  return "soul-md";
}

/**
 * Resuelve la ruta del artefacto de identidad y verifica el confine.
 *
 * - Ruta relativa ⇒ se ancla al `workspacePath` (o al CWD si no hay).
 * - Ruta absoluta ⇒ se acepta sólo si cae dentro del confine (salvo que se
 *   habilite `allowOutsideWorkspace`).
 *
 * @throws {SubEgoIdentityUnsafePathError} si la ruta sale del confine.
 */
export function resolveIdentityPath(
  identity: SubEgoIdentity,
  options: { workspacePath?: string; allowOutsideWorkspace?: boolean; subEgoId?: string } = {}
): string {
  const root = path.resolve(options.workspacePath ?? process.cwd());
  const candidate = path.isAbsolute(identity.file)
    ? path.resolve(identity.file)
    : path.resolve(root, identity.file);

  if (options.allowOutsideWorkspace) return candidate;

  const relative = path.relative(root, candidate);
  const escapes = relative.startsWith("..") || path.isAbsolute(relative);
  if (escapes) {
    throw new SubEgoIdentityUnsafePathError(
      options.subEgoId ?? "sub-ego",
      identity.file,
      candidate
    );
  }
  return candidate;
}

/**
 * Defaults del alma derivados del manifiesto (la gobernanza no se externaliza).
 */
function soulDefaultsFromManifest(manifest: SubEgoManifest): Partial<SubEgoSoulInput> {
  return {
    id: manifest.id,
    name: manifest.name,
    tone: manifest.behavior?.tone ?? "analytical",
    reasoningStyle: manifest.soul?.reasoningStyle ?? "analytical-deductive",
    values: manifest.soul?.coreValues ?? [],
    inviolableRules: manifest.soul?.toneGuidelines ?? [],
    customDirectives: manifest.responsibilities ?? []
  };
}

/**
 * Carga la identidad declarativa de un Sub-Ego.
 *
 * - Con artefacto declarado y legible ⇒ `source: "file"`.
 * - Sin artefacto declarado ⇒ `source: "manifest"` (FALLBACK: la API actual).
 * - Artefacto declarado pero ilegible y `required: false` ⇒ `source:
 *   "manifest"` + aviso.
 * - Artefacto declarado pero ilegible y `required: true` ⇒
 *   `SubEgoIdentityNotFoundError` (fail-closed).
 */
export async function loadSubEgoIdentity(
  manifest: SubEgoManifest,
  options: SubEgoIdentityLoadOptions
): Promise<SubEgoIdentityResolution> {
  const declaration = manifest.identity;

  if (!declaration || !declaration.file || declaration.file.trim().length === 0) {
    // FALLBACK: el loader en código sigue siendo la fuente de verdad.
    return {
      soul: SubEgoSoul.fromManifest(manifest, options.defaults),
      source: "manifest",
      warnings: []
    };
  }

  const resolved = resolveIdentityPath(declaration, {
    workspacePath: options.workspacePath,
    allowOutsideWorkspace: options.allowOutsideWorkspace,
    subEgoId: manifest.id
  });

  let content: string;
  try {
    content = await options.reader.readFile(resolved);
  } catch (err) {
    if (declaration.required) {
      throw new SubEgoIdentityNotFoundError(manifest.id, declaration.file, err);
    }
    return {
      soul: SubEgoSoul.fromManifest(manifest, options.defaults),
      source: "manifest",
      warnings: [
        `No se pudo leer el artefacto de identidad '${declaration.file}' del Sub-Ego '${manifest.id}': ` +
          `${err instanceof Error ? err.message : String(err)}. Se usa la identidad del manifiesto.`
      ]
    };
  }

  const format = declaration.format === "auto" ? detectIdentityFormat(resolved) : declaration.format;
  const defaults: Partial<SubEgoSoulInput> = {
    ...soulDefaultsFromManifest(manifest),
    ...(options.defaults ?? {})
  };

  let soul: SubEgoSoul;
  try {
    soul = SubEgoSoul.fromMarkdown(content, defaults, { format });
  } catch (err) {
    if (err instanceof SoulDocumentError) {
      // Frontmatter corrupto: identidad inválida ⇒ fail-closed si es obligatoria.
      if (declaration.required) {
        throw new SubEgoIdentityNotFoundError(manifest.id, declaration.file, err);
      }
      return {
        soul: SubEgoSoul.fromManifest(manifest, options.defaults),
        source: "manifest",
        warnings: [
          `El artefacto de identidad '${declaration.file}' del Sub-Ego '${manifest.id}' es inválido ` +
            `(${err.message}). Se usa la identidad del manifiesto.`
        ]
      };
    }
    throw err;
  }

  return {
    soul,
    source: "file",
    file: resolved,
    warnings: []
  };
}
