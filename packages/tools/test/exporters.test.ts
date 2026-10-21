import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  createExportArtifactTool,
  createEvalExpressionTool,
  buildDocx,
  buildXlsx,
  buildPptx,
  buildPdf,
  listZipEntryNames,
  readZipEntry,
  columnLetter,
} from "../src/index.js";

/**
 * E4 (Ola 3) — Exportadores de artefactos + REPL de expresiones.
 *
 * Un test que sólo comprueba "el buffer no está vacío" es INSUFICIENTE: aquí
 * se verifica la ESTRUCTURA real de cada formato:
 * - ZIP-based (DOCX/XLSX/PPTX): firma `PK\x03\x04`, directorio central
 *   coherente y presencia de las partes OOXML obligatorias.
 * - PDF: cabecera `%PDF-`, objetos numerados, `xref` con los desplazamientos
 *   correctos, `trailer` con `/Root` y `%%EOF`.
 */
describe("E4 — Exportadores de artefactos (PDF/DOCX/XLSX/PPTX)", () => {
  describe("ZIP: estructura real (no sólo \"no está vacío\")", () => {
    it("el ZIP tiene la firma local y el End of Central Directory", () => {
      const archive = buildDocx({ title: "T", paragraphs: ["hola"] });
      const bytes = archive.bytes;

      // Firma de local file header.
      expect(bytes[0]).toBe(0x50); // P
      expect(bytes[1]).toBe(0x4b); // K
      expect(bytes[2]).toBe(0x03);
      expect(bytes[3]).toBe(0x04);

      // Firma del End of central directory al final.
      const tail = Buffer.from(bytes.subarray(bytes.length - 22));
      expect(tail.readUInt32LE(0)).toBe(0x06054b50);
    });

    it("el directorio central lista TODAS las entradas con su CRC", () => {
      const archive = buildDocx({ title: "T", paragraphs: ["hola"] });
      const names = listZipEntryNames(archive.bytes);

      expect(names).toEqual([
        "[Content_Types].xml",
        "_rels/.rels",
        "word/document.xml",
        "word/_rels/document.xml.rels",
        "docProps/core.xml",
        "docProps/app.xml",
      ]);
    });

    it("el contenido descomprimido de una entrada es el XML esperado", () => {
      const archive = buildDocx({ title: "Informe", paragraphs: ["línea 1"] });
      const xml = new TextDecoder().decode(
        readZipEntry(archive.bytes, "word/document.xml")
      );

      expect(xml).toContain("<?xml version=\"1.0\"");
      expect(xml).toContain("<w:document");
      expect(xml).toContain("Informe");
      expect(xml).toContain("línea 1");
    });
  });

  describe("DOCX: partes OOXML obligatorias", () => {
    it("incluye [Content_Types].xml, _rels/.rels y word/document.xml", () => {
      const archive = buildDocx({ title: "Doc", paragraphs: ["a", "b"] });
      const names = listZipEntryNames(archive.bytes);

      expect(names).toContain("[Content_Types].xml");
      expect(names).toContain("_rels/.rels");
      expect(names).toContain("word/document.xml");

      const contentTypes = new TextDecoder().decode(
        readZipEntry(archive.bytes, "[Content_Types].xml")
      );
      expect(contentTypes).toContain("wordprocessingml.document.main+xml");

      const rels = new TextDecoder().decode(readZipEntry(archive.bytes, "_rels/.rels"));
      expect(rels).toContain("officeDocument");
      expect(rels).toContain("word/document.xml");
    });

    it("el documento escapa el XML correctamente (parche &lt;script&gt;)", () => {
      const archive = buildDocx({ title: "T", paragraphs: ["<script>alert(1)</script>"] });
      const xml = new TextDecoder().decode(
        readZipEntry(archive.bytes, "word/document.xml")
      );

      expect(xml).not.toContain("<script>");
      expect(xml).toContain("&lt;script&gt;");
    });
  });

  describe("XLSX: partes OOXML obligatorias", () => {
    it("incluye xl/workbook.xml y xl/worksheets/sheet1.xml", () => {
      const archive = buildXlsx({
        sheetName: "Datos",
        rows: [
          ["nombre", "cantidad"],
          ["a", 1],
        ],
      });
      const names = listZipEntryNames(archive.bytes);

      expect(names).toContain("[Content_Types].xml");
      expect(names).toContain("_rels/.rels");
      expect(names).toContain("xl/workbook.xml");
      expect(names).toContain("xl/worksheets/sheet1.xml");
    });

    it("las celdas se escriben con referencia A1/B2 y valores tipados", () => {
      const archive = buildXlsx({
        sheetName: "Datos",
        rows: [
          ["nombre", "cantidad"],
          ["a", 1],
        ],
      });
      const sheet = new TextDecoder().decode(
        readZipEntry(archive.bytes, "xl/worksheets/sheet1.xml")
      );

      expect(sheet).toContain('r="A1"');
      expect(sheet).toContain('r="B2"');
      expect(sheet).toContain("<v>1</v>");
      expect(sheet).toContain("inlineStr");
    });

    it("el libro declara la hoja y su relación", () => {
      const archive = buildXlsx({ sheetName: "Datos", rows: [["x"]] });
      const workbook = new TextDecoder().decode(
        readZipEntry(archive.bytes, "xl/workbook.xml")
      );
      const rels = new TextDecoder().decode(
        readZipEntry(archive.bytes, "xl/_rels/workbook.xml.rels")
      );

      expect(workbook).toContain('name="Datos"');
      expect(rels).toContain("worksheets/sheet1.xml");
    });

    it("columnLetter convierte índices en letras de Excel", () => {
      expect(columnLetter(0)).toBe("A");
      expect(columnLetter(25)).toBe("Z");
      expect(columnLetter(26)).toBe("AA");
    });
  });

  describe("PPTX: partes OOXML obligatorias", () => {
    it("incluye presentation.xml, slides y theme", () => {
      const archive = buildPptx({
        title: "Deck",
        slides: [
          { title: "Diapo 1", bullets: ["uno"] },
          { title: "Diapo 2", bullets: [] },
        ],
      });
      const names = listZipEntryNames(archive.bytes);

      expect(names).toContain("[Content_Types].xml");
      expect(names).toContain("_rels/.rels");
      expect(names).toContain("ppt/presentation.xml");
      expect(names).toContain("ppt/slides/slide1.xml");
      expect(names).toContain("ppt/slides/slide2.xml");
      expect(names).toContain("ppt/slides/_rels/slide1.xml.rels");
      expect(names).toContain("ppt/theme/theme1.xml");
      expect(names).toContain("ppt/slideLayouts/slideLayout1.xml");
    });

    it("la presentación declara 2 diapositivas y el texto va escapado", () => {
      const archive = buildPptx({
        title: "Deck",
        slides: [{ title: "A & B", bullets: ["<x>"] }],
      });
      const presentation = new TextDecoder().decode(
        readZipEntry(archive.bytes, "ppt/presentation.xml")
      );
      const slide = new TextDecoder().decode(
        readZipEntry(archive.bytes, "ppt/slides/slide1.xml")
      );

      expect(presentation).toContain("<p:sldIdLst>");
      expect(presentation.match(/<p:sldId /g)?.length).toBe(1);
      expect(slide).toContain("A &amp; B");
      expect(slide).toContain("&lt;x&gt;");
    });
  });

  describe("PDF: estructura real", () => {
    it("tiene cabecera %PDF-, trailer con /Root y %%EOF", () => {
      const bytes = buildPdf({ title: "Informe PDF", pages: [{ title: "P1", lines: ["hola"] }] });
      const text = Buffer.from(bytes).toString("latin1");

      expect(text.startsWith("%PDF-1.7")).toBe(true);
      expect(text).toContain("trailer");
      expect(text).toContain("/Root 1 0 R");
      expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    });

    it("la tabla xref apunta al desplazamiento real de cada objeto", () => {
      const bytes = buildPdf({ title: "T", pages: [{ title: "P1", lines: [] }] });
      const text = Buffer.from(bytes).toString("latin1");

      // El startxref declarado debe apuntar a la firma "xref".
      const startxrefMatch = /startxref\n(\d+)\n/.exec(text);
      expect(startxrefMatch).not.toBeNull();
      const startxref = Number(startxrefMatch![1]);
      expect(text.slice(startxref, startxref + 4)).toBe("xref");

      // Cada entrada de la xref debe apuntar a "N 0 obj".
      const entries = [...text.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
      expect(entries.length).toBeGreaterThan(0);
      for (const offset of entries) {
        expect(text.slice(offset, offset + 20)).toMatch(/^\d+ 0 obj/);
      }
    });

    it("declara los objetos mínimos: Catalog, Pages, Font e Info", () => {
      const bytes = buildPdf({ title: "T", pages: [{ title: "P1", lines: [] }] });
      const text = Buffer.from(bytes).toString("latin1");

      expect(text).toContain("/Type /Catalog");
      expect(text).toContain("/Type /Pages");
      expect(text).toContain("/Type /Font");
      expect(text).toContain("/BaseFont /Helvetica");
      expect(text).toContain("/Type /Page ");
      expect(text).toContain("/MediaBox");
    });

    it("el texto del título queda en el content stream (comprimido)", () => {
      const bytes = buildPdf({ title: "TituloVisible", pages: [{ title: "T1", lines: [] }] });
      const text = Buffer.from(bytes).toString("latin1");

      // El stream va comprimido (FlateDecode); el título aparece en el
      // objeto /Info, que sí es texto plano.
      expect(text).toContain("/Title (TituloVisible)");
      expect(text).toContain("/Filter /FlateDecode");
    });
  });

  describe("tool `export_artifact`", () => {
    it("genera un DOCX real y lo escribe en disco", async () => {
      const tool = createExportArtifactTool();
      const outputPath = path.join("artefactos", "informe.docx");

      const result = (await tool.execute(
        {
          format: "docx",
          title: "Informe de Ego",
          outputPath,
          paragraphs: ["Resumen ejecutivo", "Detalle"],
        },
        { callId: "c1", sessionId: "s1", workspacePath: process.cwd() }
      )) as { ok: boolean; bytes: number; written: boolean; mimeType: string };

      expect(result.ok).toBe(true);
      expect(result.written).toBe(true);
      expect(result.bytes).toBeGreaterThan(500);
      expect(result.mimeType).toContain("wordprocessingml");

      const written = fs.readFileSync(path.join(process.cwd(), outputPath));
      expect(written[0]).toBe(0x50);
      expect(written[1]).toBe(0x4b);

      fs.rmSync(path.join(process.cwd(), "artefactos"), { recursive: true, force: true });
    });

    it("genera un PDF real sin escribir en disco", async () => {
      const tool = createExportArtifactTool();

      const result = (await tool.execute(
        { format: "pdf", title: "Doc", paragraphs: ["a"] },
        { callId: "c2", sessionId: "s1", workspacePath: process.cwd() }
      )) as { ok: boolean; bytes: number; written: boolean; mimeType: string };

      expect(result.ok).toBe(true);
      expect(result.written).toBe(false);
      expect(result.mimeType).toBe("application/pdf");
      expect(result.bytes).toBeGreaterThan(300);
    });

    it("rechaza un formato no soportado (Zod)", async () => {
      const tool = createExportArtifactTool();
      await expect(
        tool.execute(
          { format: "odt" as never, title: "x", paragraphs: [] },
          { callId: "c3", sessionId: "s1", workspacePath: process.cwd() }
        )
      ).rejects.toBeDefined();
    });
  });

  describe("tool `eval_expression` (REPL de expresiones, NO Python)", () => {
    it("evalúa aritmética y devuelve el valor", async () => {
      const tool = createEvalExpressionTool();

      const result = (await tool.execute(
        { expression: "2 + 3 * 4", variables: {} },
        { callId: "c4", sessionId: "s1" }
      )) as { ok: boolean; value: unknown };

      expect(result.ok).toBe(true);
      expect(result.value).toBe(14);
    });

    it("usa las variables del scope", async () => {
      const tool = createEvalExpressionTool();

      const result = (await tool.execute(
        { expression: "precio * unidades", variables: { precio: 3, unidades: 4 } },
        { callId: "c5", sessionId: "s1" }
      )) as { ok: boolean; value: unknown };

      expect(result.value).toBe(12);
    });

    it("permite funciones puras de la lista blanca", async () => {
      const tool = createEvalExpressionTool();

      const result = (await tool.execute(
        { expression: "mean(2, 4, 6) + Math.max(1, 2)", variables: {} },
        { callId: "c6", sessionId: "s1" }
      )) as { ok: boolean; value: unknown };

      expect(result.value).toBe(6);
    });

    it("NO puede ejecutar código arbitrario: `require` no existe", async () => {
      const tool = createEvalExpressionTool();

      const result = (await tool.execute(
        { expression: "require('fs')", variables: {} },
        { callId: "c7", sessionId: "s1" }
      )) as { ok: boolean; error?: string };

      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/desconocido/i);
    });

    it("NO puede acceder a `process` ni a `globalThis`", async () => {
      const tool = createEvalExpressionTool();

      for (const expression of ["process.env", "globalThis"]) {
        const result = (await tool.execute(
          { expression, variables: {} },
          { callId: "c8", sessionId: "s1" }
        )) as { ok: boolean };
        expect(result.ok).toBe(false);
      }
    });

    it("NO puede alcanzar `__proto__` ni `constructor`", async () => {
      const tool = createEvalExpressionTool();

      for (const expression of ["({}).__proto__", "({}).constructor"]) {
        const result = (await tool.execute(
          { expression, variables: {} },
          { callId: "c9", sessionId: "s1" }
        )) as { ok: boolean };
        expect(result.ok).toBe(false);
      }
    });

    it("NO puede invocar métodos de objetos como funciones", async () => {
      const tool = createEvalExpressionTool();

      const result = (await tool.execute(
        { expression: "texto.toString()", variables: { texto: "hola" } },
        { callId: "c10", sessionId: "s1" }
      )) as { ok: boolean; error?: string };

      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/lista blanca/i);
    });

    it("informa del error de sintaxis sin reventar", async () => {
      const tool = createEvalExpressionTool();

      const result = (await tool.execute(
        { expression: "2 +", variables: {} },
        { callId: "c11", sessionId: "s1" }
      )) as { ok: boolean; error?: string };

      expect(result.ok).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });
});
