/**
 * pdf.ts — escritor de PDF 1.7 mínimo, sin dependencias.
 *
 * E4 (Ola 3). Produce un PDF **real y válido**: cabecera `%PDF-1.7`, objetos
 * numerados, tabla `xref` con los desplazamientos exactos, `trailer` con
 * `/Root` y `%%EOF`.
 *
 * FONDO: usa una fuente base-14 (Helvetica), que **no requiere incrustar**
 * ningún fichero de fuente: el visor la sustituye. Por eso el PDF lleva
 * texto **seleccionable** y funciona en cualquier lector sin recursos
 * externos.
 *
 * Sin `eval`, sin binario externo, sin dependencia: sólo `node:zlib` para el
 * stream comprimido (FlateDecode).
 */

import { deflateSync } from "node:zlib";

/** Página del documento. */
export interface PdfPage {
  /** Título de la página. */
  readonly title: string;
  /** Líneas del cuerpo. */
  readonly lines: readonly string[];
}

/** Contenido del documento PDF. */
export interface PdfContent {
  /** Título del documento (aparece en la primera página y en el `/Info`). */
  readonly title: string;
  /** Páginas del documento. */
  readonly pages: readonly PdfPage[];
}

/** Tamaño de página A4 en puntos PDF (595.28 × 841.89). */
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
/** Márgenes (puntos). */
const MARGIN_LEFT = 56;
const MARGIN_TOP = 780;
/** Separación entre líneas (puntos). */
const LINE_HEIGHT = 16;

/**
 * Escapa una cadena para un literal PDF `( ... )`.
 * `\`, `(`, `)` se escapan; los bytes no imprimibles van en octal.
 */
function escapePdfText(value: string): string {
  let out = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (char === "\\" || char === "(" || char === ")") {
      out += `\\${char}`;
    } else if (code < 32 || code > 126) {
      // Latin-1: se emite en octal de 3 dígitos.
      out += `\\${code.toString(8).padStart(3, "0")}`;
    } else {
      out += char;
    }
  }
  return out;
}

/**
 * Genera el content stream de una página (operadores PDF en texto).
 */
function buildPageContentStream(page: PdfPage): string {
  const ops: string[] = [];
  ops.push("BT");
  ops.push("/F1 20 Tf");
  ops.push(`${MARGIN_LEFT} ${MARGIN_TOP + 12} Td`);
  ops.push(`(${escapePdfText(page.title)}) Tj`);
  ops.push("/F1 11 Tf");
  ops.push(`0 -${LINE_HEIGHT + 6} Td`);

  let y = 0;
  for (const line of page.lines) {
    for (const part of line.split("\n")) {
      ops.push(`0 -${LINE_HEIGHT} Td`);
      ops.push(`(${escapePdfText(part)}) Tj`);
      y += LINE_HEIGHT;
      if (y > PAGE_HEIGHT - 120) break;
    }
  }
  ops.push("ET");
  return `${ops.join("\n")}\n`;
}

/**
 * Construye un PDF 1.7 válido.
 */
export function buildPdf(content: PdfContent): Uint8Array {
  const pages = content.pages.length > 0 ? content.pages : [{ title: content.title, lines: [] }];

  // Objetos del PDF (1-indexados en el archivo; el 0 es el catálogo libre).
  // 1 = Catalog, 2 = Pages, 3 = Font, 4 = Info, y luego por página:
  //   (page, content stream).
  const objects: string[] = [];
  const push = (body: string): number => {
    objects.push(body);
    return objects.length; // 1-indexado
  };

  const catalogId = 1;
  const pagesId = 2;
  const fontId = 3;
  const infoId = 4;

  // Reserva los cuatro primeros objetos (se rellenan al final, con los ids
  // ya conocidos).
  objects.push("", "", "", "");

  const pageIds: number[] = [];
  for (const page of pages) {
    const stream = buildPageContentStream(page);
    const compressed = deflateSync(Buffer.from(stream, "latin1"));
    const contentId = push(
      `<< /Length ${compressed.length} /Filter /FlateDecode >>\nstream\n${compressed.toString("latin1")}\nendstream`
    );
    const pageId = push(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  }

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] =
    `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds
      .map((id) => `${id} 0 R`)
      .join(" ")}] >>`;
  objects[fontId - 1] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[infoId - 1] =
    `<< /Title (${escapePdfText(content.title)}) /Producer (Ego) /Creator (Ego) >>`;

  // Serialización con los desplazamientos de la tabla xref.
  const chunks: Buffer[] = [];
  let offset = 0;
  const pushChunk = (text: string | Buffer): void => {
    const buffer = typeof text === "string" ? Buffer.from(text, "latin1") : text;
    chunks.push(buffer);
    offset += buffer.length;
  };

  pushChunk("%PDF-1.7\n");
  // Marca de que el fichero contiene bytes binarios (comment).
  pushChunk(Buffer.from([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const xrefOffsets: number[] = [];
  for (let i = 0; i < objects.length; i++) {
    xrefOffsets.push(offset);
    const id = i + 1;
    pushChunk(`${id} 0 obj\n${objects[i]}\nendobj\n`);
  }

  const xrefStart = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const entryOffset of xrefOffsets) {
    xref += `${String(entryOffset).padStart(10, "0")} 00000 n \n`;
  }
  pushChunk(xref);
  pushChunk(
    `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\n` +
      `startxref\n${xrefStart}\n%%EOF\n`
  );

  return new Uint8Array(Buffer.concat(chunks));
}
