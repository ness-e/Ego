import { describe, it, expect } from "vitest";
import { AdaptiveChunker } from "../src/ingest/AdaptiveChunker.js";

describe("AdaptiveChunker (fragmentación jerárquica propia de Ego)", () => {
  it("fragmenta texto extenso en bloques respetando el límite de tokens", () => {
    const chunker = new AdaptiveChunker({ maxTokens: 50, overlapTokens: 10 });
    const text = `
Este es un párrafo de prueba bastante largo para verificar cómo el AdaptiveChunker fragmenta el contenido de forma consistente y limpia.
Continuamos agregando más texto con oraciones estructuradas para asegurarnos de que la división de bloques respete las reglas del estimador de tokens y no produzca fragmentos sobredimensionados.
    `.trim();

    const chunks = chunker.chunkText(text, "test.md");

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeGreaterThan(0);
      expect(chunk.contentHash).toHaveLength(64);
      expect(chunk.sourcePath).toBe("test.md");
      expect(chunk.index).toBeGreaterThanOrEqual(0);
    }
  });

  it("preserva la jerarquía de títulos Markdown en headingPath", () => {
    const chunker = new AdaptiveChunker({ maxTokens: 40, overlapTokens: 5 });
    const markdown = `
# Guía Principal

Contenido introductorio de la guía.

## Capítulo 1: Arquitectura

Detalle técnico de la arquitectura de Ego y su Cognitive Runtime.

### Subsección 1.1: Memoria

Explicación sobre VantaDB y Fjall LSM.
    `.trim();

    const chunks = chunker.chunkText(markdown, "docs/guia.md");

    expect(chunks.length).toBeGreaterThan(0);
    // Verificar que los últimos chunks capturan la jerarquía anidada
    const lastChunk = chunks[chunks.length - 1];
    expect(lastChunk.headingPath).toContain("Guía Principal");
    expect(lastChunk.headingPath).toContain("Capítulo 1: Arquitectura");
    expect(lastChunk.headingPath).toContain("Subsección 1.1: Memoria");
  });

  it("calcula hash SHA-256 idempotente y deduplica fragmentos repetidos", () => {
    const chunker = new AdaptiveChunker({ maxTokens: 100, overlapTokens: 0 });
    const hash1 = chunker.calculateHash("Texto idéntico para verificación de hash.");
    const hash2 = chunker.calculateHash("Texto idéntico para verificación de hash.");
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);

    const duplicateText = `
Párrafo único inicial.

Bloque repetido idéntico.

Bloque repetido idéntico.
    `.trim();

    const chunks = chunker.chunkText(duplicateText, "dedup.md");
    const hashes = chunks.map((c) => c.contentHash);
    const uniqueHashes = new Set(hashes);
    // Debe haber deduplicado fragmentos exactamente iguales
    expect(hashes.length).toBe(uniqueHashes.size);
  });

  it("maneja texto vacío o en blanco retornando array vacío", () => {
    const chunker = new AdaptiveChunker();
    expect(chunker.chunkText("", "empty.md")).toEqual([]);
    expect(chunker.chunkText("   \n\n  ", "blank.md")).toEqual([]);
  });
});
