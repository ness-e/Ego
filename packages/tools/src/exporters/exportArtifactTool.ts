import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import { ToolDefinition, ToolExecutionContext } from "../types.js";
import { PathValidator } from "../native/fs/PathValidator.js";
import { buildDocx } from "./docx.js";
import { buildPdf } from "./pdf.js";
import { buildPptx } from "./pptx.js";
import { buildXlsx, type XlsxRow } from "./xlsx.js";
import { buildZip } from "./zip.js";

/**
 * exportArtifactTool — tool `export_artifact` (E4, Ola 3).
 *
 * Convierte contenido estructurado en un artefacto **real y válido**:
 * PDF, DOCX, XLSX, PPTX (y Markdown como formato de texto plano).
 *
 * Sin Python, sin LibreOffice, sin headless-chrome, sin binario externo y
 * **sin dependencias**: DOCX/XLSX/PPTX son ZIP+OOXML (escritor ZIP propio
 * sobre `node:zlib`) y el PDF se genera con un escritor propio.
 */

const EXPORT_FORMATS = ["pdf", "docx", "xlsx", "pptx", "markdown"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

const ExportArtifactInputSchema = z.object({
  /** Formato del artefacto de salida. */
  format: z.enum(EXPORT_FORMATS).describe("Formato del artefacto a generar."),
  /** Título del documento (encabezado y metadatos). */
  title: z.string().min(1).describe("Título del documento."),
  /** Ruta de salida (relativa al workspace). Si se omite, sólo se devuelve el buffer. */
  outputPath: z
    .string()
    .optional()
    .describe("Ruta del fichero a escribir (relativa al workspace)."),
  /** Párrafos / líneas del cuerpo. */
  paragraphs: z
    .array(z.string())
    .default([])
    .describe("Líneas o párrafos del cuerpo del documento."),
  /** Filas de la hoja (sólo XLSX). La primera fila es la cabecera. */
  rows: z
    .array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])))
    .default([])
    .describe("Filas de la hoja (XLSX)."),
  /** Diapositivas (sólo PPTX). Si se omite, se genera una con el título. */
  slides: z
    .array(
      z.object({
        title: z.string().min(1),
        bullets: z.array(z.string()).default([]),
      })
    )
    .default([])
    .describe("Diapositivas de la presentación (PPTX)."),
  /** Nombre de la hoja (XLSX). */
  sheetName: z.string().default("Hoja1").describe("Nombre de la hoja (XLSX)."),
});

export type ExportArtifactInput = z.infer<typeof ExportArtifactInputSchema>;

/** Resultado de la tool. */
export interface ExportArtifactResult {
  /** `true` si el artefacto se generó. */
  readonly ok: boolean;
  /** Formato generado. */
  readonly format: ExportFormat;
  /** Tamaño del artefacto en bytes. */
  readonly bytes: number;
  /** Ruta escrita (si se pidió). */
  readonly outputPath?: string;
  /** `true` si se escribió en disco. */
  readonly written: boolean;
  /** Número de páginas (PDF/PPTX) o filas (XLSX) o párrafos (DOCX). */
  readonly units: number;
  /** MIME del artefacto. */
  readonly mimeType: string;
}

const MIME_TYPES: Record<ExportFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  markdown: "text/markdown",
};

/** Extensión por defecto de cada formato. */
const EXTENSIONS: Record<ExportFormat, string> = {
  pdf: ".pdf",
  docx: ".docx",
  xlsx: ".xlsx",
  pptx: ".pptx",
  markdown: ".md",
};

/**
 * Construye el artefacto en memoria (sin escribir en disco).
 */
export function renderArtifact(input: ExportArtifactInput): {
  bytes: Uint8Array;
  units: number;
} {
  // Los campos con `.default()` sólo existen si la entrada pasó por Zod. La
  // tool debe ser robusta también cuando se invoca con una entrada cruda
  // (o con un schema distinto).
  const paragraphs = input.paragraphs ?? [];
  const rows = input.rows ?? [];
  const slides = input.slides ?? [];

  switch (input.format) {
    case "pdf": {
      const pages =
        slides.length > 0
          ? slides.map((slide) => ({
              title: slide.title,
              lines: slide.bullets ?? [],
            }))
          : [{ title: input.title, lines: paragraphs }];
      return { bytes: buildPdf({ title: input.title, pages }), units: pages.length };
    }
    case "docx": {
      const archive = buildDocx({
        title: input.title,
        paragraphs,
      });
      return { bytes: archive.bytes, units: paragraphs.length };
    }
    case "xlsx": {
      const sheetRows: XlsxRow[] = rows.length > 0 ? rows : [paragraphs];
      const archive = buildXlsx({
        sheetName: input.sheetName,
        rows: sheetRows,
      });
      return { bytes: archive.bytes, units: sheetRows.length };
    }
    case "pptx": {
      const deck =
        slides.length > 0
          ? slides
          : [{ title: input.title, bullets: paragraphs }];
      const archive = buildPptx({ title: input.title, slides: deck });
      return { bytes: archive.bytes, units: deck.length };
    }
    case "markdown": {
      const lines = [`# ${input.title}`, ""];
      for (const paragraph of paragraphs) {
        lines.push(paragraph, "");
      }
      if (rows.length > 0) {
        lines.push("| " + rows[0]!.join(" | ") + " |");
        lines.push("| " + rows[0]!.map(() => "---").join(" | ") + " |");
        for (const row of rows.slice(1)) {
          lines.push("| " + row.join(" | ") + " |");
        }
      }
      return {
        bytes: new TextEncoder().encode(lines.join("\n")),
        units: paragraphs.length,
      };
    }
    default: {
      const exhaustive: never = input.format;
      throw new Error(`Formato de exportación no soportado: ${String(exhaustive)}`);
    }
  }
}

/**
 * Crea la tool `export_artifact`.
 */
export function createExportArtifactTool(
  options: { defaultWorkspacePath?: string } = {}
): ToolDefinition {
  return {
    name: "export_artifact",
    description:
      "Genera un artefacto real (PDF, DOCX, XLSX, PPTX o Markdown) a partir de contenido estructurado y opcionalmente lo escribe en el workspace. Sin dependencias externas: todo se genera en TypeScript.",
    category: "system",
    riskLevel: "sensitive",
    origin: "native",
    requiresApproval: true,
    tags: ["export", "artifact", "pdf", "docx", "xlsx", "pptx"],
    inputSchema: ExportArtifactInputSchema,
    execute: async (
      input: ExportArtifactInput,
      context: ToolExecutionContext
    ): Promise<ExportArtifactResult> => {
      const { bytes, units } = renderArtifact(input);

      if (!input.outputPath) {
        return {
          ok: true,
          format: input.format,
          bytes: bytes.length,
          written: false,
          units,
          mimeType: MIME_TYPES[input.format],
        };
      }

      const workspace = context.workspacePath || options.defaultWorkspacePath;
      if (!workspace) {
        throw new Error("No se definió workspacePath para la exportación del artefacto");
      }

      // Si la ruta no trae extensión, se añade la del formato (un artefacto
      // sin extensión no lo abre nadie).
      const requested = input.outputPath;
      const withExtension =
        path.extname(requested).length > 0
          ? requested
          : `${requested}${EXTENSIONS[input.format]}`;

      const resolved = await PathValidator.validatePathAsync(withExtension, workspace);
      await fs.promises.mkdir(path.dirname(resolved), { recursive: true });
      await fs.promises.writeFile(resolved, bytes);

      return {
        ok: true,
        format: input.format,
        bytes: bytes.length,
        outputPath: path.relative(workspace, resolved),
        written: true,
        units,
        mimeType: MIME_TYPES[input.format],
      };
    },
  };
}

export { buildZip };
export type { ZipArchive } from "./zip.js";
