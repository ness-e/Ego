import { describe, it, expect } from "vitest";
import { DocumentParser } from "../src/ingest/DocumentParser.js";

describe("DocumentParser (Multiformat Ingestion)", () => {
  const parser = new DocumentParser();

  it("parsea documentos Markdown con frontmatter y encabezados", () => {
    const md = `---
title: Configuración de Ego
author: ness-e
---

# Configuración Inicial

Ego es un sistema operativo cognitivo local-first.

## Parámetros

El modelo default es configurable.
    `.trim();

    const doc = parser.parseContent(md, "config.md", "text/markdown");

    expect(doc.title).toBe("Configuración de Ego");
    expect(doc.mimeType).toBe("text/markdown");
    expect(doc.chunks.length).toBeGreaterThan(0);
    expect(doc.documentHash).toHaveLength(64);
  });

  it("parsea archivos JSON estructurados convirtiéndolos en chunks semánticos", () => {
    const jsonStr = JSON.stringify({
      projectName: "Ego Cognitive OS",
      version: "0.1.0",
      components: ["Runtime", "Memory", "Canvas", "Decision"],
      rules: {
        offlineFirst: true,
        maxRecursionDepth: 4,
      },
    });

    const doc = parser.parseContent(jsonStr, "settings.json", "application/json");

    expect(doc.mimeType).toBe("application/json");
    expect(doc.chunks.length).toBeGreaterThan(0);
    expect(doc.chunks[0].content).toContain("projectName");
    expect(doc.chunks[0].content).toContain("Ego Cognitive OS");
  });

  it("parsea archivos CSV mapeando encabezados a cada fila", () => {
    const csvStr = `id,name,role,status
1,ego.nucleus,Core,active
2,ego.dev,Engineer,active
3,ego.research,Researcher,idle`;

    const doc = parser.parseContent(csvStr, "agents.csv", "text/csv");

    expect(doc.mimeType).toBe("text/csv");
    expect(doc.chunks.length).toBeGreaterThan(0);
    expect(doc.chunks[0].content).toContain("name: ego.nucleus");
    expect(doc.chunks[0].content).toContain("role: Engineer");
  });

  it("parsea texto plano genérico con fallback predecible", () => {
    const text = "Línea 1 de texto plano.\nLínea 2 de texto plano con información relevante.";
    const doc = parser.parseContent(text, "notes.txt", "text/plain");

    expect(doc.mimeType).toBe("text/plain");
    expect(doc.chunks.length).toBe(1);
    expect(doc.chunks[0].content).toContain("Línea 1");
  });
});
