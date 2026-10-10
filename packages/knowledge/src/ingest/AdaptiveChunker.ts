import { createHash } from "node:crypto";
import { DocumentChunk, DocumentChunkSchema } from "../schemas/knowledge.js";

export interface ChunkerOptions {
  maxTokens?: number;
  overlapTokens?: number;
  preserveCodeBlocks?: boolean;
}

/**
 * Fragmentador adaptativo jerárquico basado en los patrones de Khoj (KHOJ-01, KHOJ-02).
 * - Segmentación en bloques de 256 tokens con solapamiento de 32-64 tokens.
 * - Extracción y propagación del árbol de encabezados (heading_path).
 * - Deduplicación criptográfica mediante SHA-256 (contentHash).
 */
export class AdaptiveChunker {
  private readonly maxTokens: number;
  private readonly overlapTokens: number;
  private readonly preserveCodeBlocks: boolean;

  constructor(options: ChunkerOptions = {}) {
    this.maxTokens = options.maxTokens ?? 256;
    this.overlapTokens = options.overlapTokens ?? 32;
    this.preserveCodeBlocks = options.preserveCodeBlocks ?? true;
  }

  /**
   * Estima el número de tokens utilizando una heurística determinista basada en palabras y puntuación.
   * Promedio calibrado para texto bilingüe y código (~1 palabra = 1.3 tokens, o ~4 chars/token).
   */
  public estimateTokens(text: string): number {
    if (!text || text.trim().length === 0) return 0;
    // Conteo híbrido: split por espacios y signos de puntuación
    const words = text.trim().split(/\s+/).length;
    const charEstimate = Math.ceil(text.length / 4);
    return Math.max(Math.ceil(words * 1.3), charEstimate);
  }

  /**
   * Calcula el digest SHA-256 canónico del contenido para deduplicación (KHOJ-01).
   */
  public calculateHash(content: string): string {
    const normalized = content.trim().replace(/\r\n/g, "\n");
    return createHash("sha256").update(normalized, "utf8").digest("hex");
  }

  /**
   * Fragmenta un texto Markdown o plano en una lista de DocumentChunk enriquecidos.
   */
  public chunkText(
    text: string,
    sourcePath: string,
    mimeType: string = "text/markdown"
  ): DocumentChunk[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const normalized = text.replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");

    const chunks: DocumentChunk[] = [];
    let currentHeadingPath: string[] = [];
    let currentLines: string[] = [];
    let currentTokenCount = 0;
    let chunkIndex = 0;
    let inCodeBlock = false;

    const commitCurrentChunk = () => {
      if (currentLines.length === 0) return;
      const content = currentLines.join("\n").trim();
      if (content.length === 0) return;

      const contentHash = this.calculateHash(content);
      const tokenCount = this.estimateTokens(content);
      const id = `${sourcePath}:${chunkIndex}:${contentHash.substring(0, 8)}`;

      const chunk: DocumentChunk = {
        id,
        content,
        tokenCount,
        headingPath: [...currentHeadingPath],
        contentHash,
        sourcePath,
        mimeType,
        index: chunkIndex,
      };

      DocumentChunkSchema.parse(chunk);
      chunks.push(chunk);
      chunkIndex++;

      // Aplicar solapamiento (overlap): retener las últimas líneas que sumen hasta overlapTokens
      if (this.overlapTokens > 0) {
        const retainedLines: string[] = [];
        let retainedTokens = 0;
        for (let i = currentLines.length - 1; i >= 0; i--) {
          const lineTokens = this.estimateTokens(currentLines[i]);
          if (retainedTokens + lineTokens <= this.overlapTokens) {
            retainedLines.unshift(currentLines[i]);
            retainedTokens += lineTokens;
          } else {
            break;
          }
        }
        currentLines = retainedLines;
        currentTokenCount = retainedTokens;
      } else {
        currentLines = [];
        currentTokenCount = 0;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detección de bloques de código (```)
      if (line.trim().startsWith("```")) {
        inCodeBlock = !inCodeBlock;
      }

      // Detección de encabezados Markdown fuera de bloques de código (KHOJ-02)
      if (!inCodeBlock) {
        const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
          const level = headingMatch[1].length; // 1 to 6
          const title = headingMatch[2].trim();

          // Si ya teníamos contenido acumulado y superamos un umbral razonable, consolidamos el chunk
          if (currentTokenCount >= Math.floor(this.maxTokens * 0.4)) {
            commitCurrentChunk();
          }

          // Actualizar el headingPath jerárquico según el nivel de profundidad
          if (level <= currentHeadingPath.length) {
            currentHeadingPath = currentHeadingPath.slice(0, level - 1);
          }
          currentHeadingPath.push(title);
        }
      }

      const lineTokens = this.estimateTokens(line);

      // Si agregar esta línea supera maxTokens y no estamos forzando permanencia en code block, hacer commit
      if (currentTokenCount + lineTokens > this.maxTokens && currentLines.length > 0) {
        if (!inCodeBlock || !this.preserveCodeBlocks || currentTokenCount > this.maxTokens * 1.5) {
          commitCurrentChunk();
        }
      }

      currentLines.push(line);
      currentTokenCount += lineTokens;
    }

    // Consolidar el último remanente
    commitCurrentChunk();

    // Deduplicación idempotente: filtrar fragmentos con contentHash repetido en el mismo documento
    const seenHashes = new Set<string>();
    const deduplicatedChunks: DocumentChunk[] = [];
    for (const chunk of chunks) {
      if (!seenHashes.has(chunk.contentHash)) {
        seenHashes.add(chunk.contentHash);
        deduplicatedChunks.push(chunk);
      }
    }

    return deduplicatedChunks;
  }
}
