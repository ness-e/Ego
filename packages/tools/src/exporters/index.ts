/**
 * index.ts — exportadores de artefactos y REPL de expresiones (E4, Ola 3).
 *
 * Todos los generadores son de **TypeScript puro, sin dependencias**:
 * - DOCX / XLSX / PPTX: contenedores ZIP+OOXML (escritor ZIP propio sobre
 *   `node:zlib`).
 * - PDF: escritor PDF 1.7 propio (texto seleccionable, fuente base-14).
 * - Markdown: texto plano.
 */
export * from "./zip.js";
export * from "./ooxml.js";
export * from "./docx.js";
export * from "./xlsx.js";
export * from "./pptx.js";
export * from "./pdf.js";
export * from "./exportArtifactTool.js";
