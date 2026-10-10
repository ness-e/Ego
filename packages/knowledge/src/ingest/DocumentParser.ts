import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { AdaptiveChunker } from "./AdaptiveChunker.js";
import { MarkdownExtractor } from "./MarkdownExtractor.js";
import { ParsedDocument, ParsedDocumentSchema } from "../schemas/knowledge.js";

/**
 * Parser unificado de documentos multiformato en Node.js.
 * Soporta Markdown (.md), texto plano (.txt), JSON (.json), CSV (.csv).
 */
export class DocumentParser {
  private readonly chunker: AdaptiveChunker;
  private readonly mdExtractor: MarkdownExtractor;

  constructor(chunker?: AdaptiveChunker) {
    this.chunker = chunker ?? new AdaptiveChunker();
    this.mdExtractor = new MarkdownExtractor(this.chunker);
  }

  /**
   * Resuelve el tipo MIME a partir de la extensión del archivo.
   */
  public detectMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case ".md":
      case ".markdown":
        return "text/markdown";
      case ".json":
        return "application/json";
      case ".csv":
        return "text/csv";
      case ".pdf":
        return "application/pdf";
      default:
        return "text/plain";
    }
  }

  /**
   * Procesa un archivo desde disco leyendo su contenido de forma asíncrona.
   */
  public async parseFile(filePath: string): Promise<ParsedDocument> {
    const content = await fs.readFile(filePath, "utf-8");
    const mimeType = this.detectMimeType(filePath);
    return this.parseContent(content, filePath, mimeType);
  }

  /**
   * Procesa contenido en memoria dado su texto, ruta y tipo MIME.
   */
  public parseContent(content: string, sourcePath: string, mimeType?: string): ParsedDocument {
    const resolvedMime = mimeType ?? this.detectMimeType(sourcePath);
    const fileName = path.basename(sourcePath);

    if (resolvedMime === "text/markdown") {
      return this.mdExtractor.extract(content, sourcePath);
    }

    if (resolvedMime === "application/json") {
      return this.parseJson(content, sourcePath);
    }

    if (resolvedMime === "text/csv") {
      return this.parseCsv(content, sourcePath);
    }

    // Fallback: texto plano (text/plain) u otros
    return this.parsePlainText(content, sourcePath, resolvedMime, fileName);
  }

  /**
   * Convierte JSON estructurado en fragmentos legibles con claves y valores formateados.
   */
  private parseJson(content: string, sourcePath: string): ParsedDocument {
    const documentHash = createHash("sha256").update(content, "utf8").digest("hex");
    let formattedText = "";

    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        formattedText = parsed
          .map((item, idx) => `[Registro ${idx + 1}]\n${JSON.stringify(item, null, 2)}`)
          .join("\n\n");
      } else if (typeof parsed === "object" && parsed !== null) {
        formattedText = Object.entries(parsed)
          .map(([k, v]) => `## ${k}\n${typeof v === "object" ? JSON.stringify(v, null, 2) : String(v)}`)
          .join("\n\n");
      } else {
        formattedText = String(parsed);
      }
    } catch {
      formattedText = content;
    }

    const chunks = this.chunker.chunkText(formattedText, sourcePath, "application/json");

    return ParsedDocumentSchema.parse({
      id: `doc_${documentHash.substring(0, 16)}`,
      sourcePath,
      title: path.basename(sourcePath),
      mimeType: "application/json",
      rawLength: content.length,
      chunks,
      documentHash,
    });
  }

  /**
   * Convierte CSV en bloques tabulares con encabezados para cada lote de filas.
   */
  private parseCsv(content: string, sourcePath: string): ParsedDocument {
    const documentHash = createHash("sha256").update(content, "utf8").digest("hex");
    const lines = content.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim().length > 0);

    let formattedText = "";
    if (lines.length > 0) {
      const headers = lines[0].split(",").map((h) => h.trim());
      const rows = lines.slice(1);

      formattedText = rows
        .map((row, idx) => {
          const cols = row.split(",").map((c) => c.trim());
          const entry = headers.map((h, i) => `${h}: ${cols[i] || ""}`).join(" | ");
          return `Fila ${idx + 1}: ${entry}`;
        })
        .join("\n");
    } else {
      formattedText = content;
    }

    const chunks = this.chunker.chunkText(formattedText, sourcePath, "text/csv");

    return ParsedDocumentSchema.parse({
      id: `doc_${documentHash.substring(0, 16)}`,
      sourcePath,
      title: path.basename(sourcePath),
      mimeType: "text/csv",
      rawLength: content.length,
      chunks,
      documentHash,
    });
  }

  /**
   * Parser general para texto plano sin formato especial.
   */
  private parsePlainText(
    content: string,
    sourcePath: string,
    mimeType: string,
    title: string
  ): ParsedDocument {
    const documentHash = createHash("sha256").update(content, "utf8").digest("hex");
    const chunks = this.chunker.chunkText(content, sourcePath, mimeType);

    return ParsedDocumentSchema.parse({
      id: `doc_${documentHash.substring(0, 16)}`,
      sourcePath,
      title,
      mimeType,
      rawLength: content.length,
      chunks,
      documentHash,
    });
  }
}
