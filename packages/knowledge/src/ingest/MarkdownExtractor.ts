import { createHash } from "node:crypto";
import { AdaptiveChunker } from "./AdaptiveChunker.js";
import { ParsedDocument, ParsedDocumentSchema } from "../schemas/knowledge.js";

export interface MarkdownMetadata {
  title?: string;
  frontmatter?: Record<string, string>;
  rawText: string;
}

/**
 * Extractor especializado para archivos Markdown y documentación estructurada.
 * Extrae metadatos frontmatter, limpia ruido sintáctico y genera el ParsedDocument.
 */
export class MarkdownExtractor {
  private readonly chunker: AdaptiveChunker;

  constructor(chunker?: AdaptiveChunker) {
    this.chunker = chunker ?? new AdaptiveChunker();
  }

  /**
   * Extrae frontmatter YAML básico si está presente al inicio del archivo.
   */
  public parseFrontmatter(content: string): MarkdownMetadata {
    const normalized = content.replace(/\r\n/g, "\n");
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
    const match = normalized.match(frontmatterRegex);

    if (!match) {
      return {
        title: this.inferTitle(normalized),
        rawText: normalized,
      };
    }

    const frontmatterBlock = match[1];
    const rawText = normalized.substring(match[0].length);
    const frontmatter: Record<string, string> = {};

    const lines = frontmatterBlock.split("\n");
    for (const line of lines) {
      const colonIndex = line.indexOf(":");
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim().replace(/^['"](.*)['"]$/, "$1");
        frontmatter[key] = value;
      }
    }

    const title = frontmatter["title"] || this.inferTitle(rawText);

    return {
      title,
      frontmatter,
      rawText,
    };
  }

  /**
   * Deduce el título del documento a partir del primer encabezado H1 (# ...) o nombre.
   */
  public inferTitle(text: string): string {
    const lines = text.split("\n");
    for (const line of lines) {
      const h1Match = line.match(/^#\s+(.*)$/);
      if (h1Match) {
        return h1Match[1].trim();
      }
    }
    return "Untitled Document";
  }

  /**
   * Procesa un archivo Markdown produciendo un ParsedDocument con sus DocumentChunks.
   */
  public extract(content: string, sourcePath: string): ParsedDocument {
    const { title, frontmatter, rawText } = this.parseFrontmatter(content);
    const documentHash = createHash("sha256").update(content, "utf8").digest("hex");
    const chunks = this.chunker.chunkText(rawText, sourcePath, "text/markdown");

    const parsed: ParsedDocument = {
      id: `doc_${documentHash.substring(0, 16)}`,
      sourcePath,
      title: title || "Untitled Document",
      mimeType: "text/markdown",
      rawLength: content.length,
      chunks,
      documentHash,
      metadata: frontmatter,
    };

    return ParsedDocumentSchema.parse(parsed);
  }
}
