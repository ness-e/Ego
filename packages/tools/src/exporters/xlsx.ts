import { buildZip, type ZipArchive, type ZipEntry } from "./zip.js";
import {
  buildAppProperties,
  buildContentTypes,
  buildCoreProperties,
  buildRelationships,
  CONTENT_TYPES,
  escapeXmlText,
  REL_TYPES,
} from "./ooxml.js";

/**
 * xlsx.ts — generador de XLSX (SpreadsheetML) sin dependencias.
 *
 * E4 (Ola 3). Un `.xlsx` es un ZIP con un mínimo de partes:
 * - `[Content_Types].xml`
 * - `_rels/.rels`
 * - `xl/workbook.xml` — el libro y sus hojas.
 * - `xl/_rels/workbook.xml.rels` — relación con la hoja.
 * - `xl/worksheets/sheet1.xml` — la celda de la hoja.
 *
 * La celda usa `inlineStr` (cadenas en línea) para no necesitar la tabla de
 * strings compartidas (`sharedStrings.xml`), que es la parte opcional que más
 * errores genera en las implementaciones mínimas.
 */

/** Fila de una hoja: celdas ya serializadas como texto. */
export type XlsxRow = ReadonlyArray<string | number | boolean | null | undefined>;

/** Contenido de un libro. */
export interface XlsxContent {
  /** Nombre de la hoja. */
  readonly sheetName: string;
  /** Filas de la hoja (la primera suele ser la cabecera). */
  readonly rows: readonly XlsxRow[];
}

/** Convierte un índice de columna (0-based) a su letra (A, B, …, AA). */
export function columnLetter(index: number): string {
  let n = index;
  let letter = "";
  do {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letter;
}

/** Genera el `xl/worksheets/sheet1.xml` de un XLSX. */
export function buildXlsxWorksheetXml(content: XlsxContent): string {
  const rows = content.rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, colIndex) => {
          if (value === null || value === undefined) return "";
          const ref = `${columnLetter(colIndex)}${rowIndex + 1}`;
          if (typeof value === "number" && Number.isFinite(value)) {
            return `    <c r="${ref}"><v>${value}</v></c>`;
          }
          if (typeof value === "boolean") {
            return `    <c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
          }
          return `    <c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXmlText(
            String(value)
          )}</t></is></c>`;
        })
        .join("\n");
      return `  <row r="${rowIndex + 1}">\n${cells}\n  </row>`;
    })
    .join("\n");

  const maxCols = content.rows.reduce((max, row) => Math.max(max, row.length), 0);
  const maxRows = content.rows.length;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${columnLetter(Math.max(0, maxCols - 1))}${Math.max(1, maxRows)}"/>
  <sheetData>
${rows}
  </sheetData>
</worksheet>
`;
}

/** Genera el `xl/workbook.xml` de un XLSX. */
export function buildXlsxWorkbookXml(content: XlsxContent): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXmlText(content.sheetName || "Hoja1")}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>
`;
}

/**
 * Construye un archivo XLSX completo (ZIP OOXML válido).
 */
export function buildXlsx(content: XlsxContent): ZipArchive {
  const entries: ZipEntry[] = [
    {
      name: "[Content_Types].xml",
      data: buildContentTypes(
        [
          { extension: "rels", contentType: CONTENT_TYPES.relationships },
          { extension: "xml", contentType: "application/xml" },
        ],
        [
          { partName: "/xl/workbook.xml", contentType: CONTENT_TYPES.xlsxMain },
          { partName: "/xl/worksheets/sheet1.xml", contentType: CONTENT_TYPES.xlsxWorksheet },
          { partName: "/docProps/core.xml", contentType: CONTENT_TYPES.coreProperties },
          { partName: "/docProps/app.xml", contentType: CONTENT_TYPES.extendedProperties },
        ]
      ),
    },
    {
      name: "_rels/.rels",
      data: buildRelationships([
        { id: "rId1", type: REL_TYPES.officeDocument, target: "xl/workbook.xml" },
        { id: "rId2", type: REL_TYPES.coreProperties, target: "docProps/core.xml" },
        { id: "rId3", type: REL_TYPES.extendedProperties, target: "docProps/app.xml" },
      ]),
    },
    {
      name: "xl/workbook.xml",
      data: buildXlsxWorkbookXml(content),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: buildRelationships([
        { id: "rId1", type: REL_TYPES.worksheet, target: "worksheets/sheet1.xml" },
      ]),
    },
    {
      name: "xl/worksheets/sheet1.xml",
      data: buildXlsxWorksheetXml(content),
    },
    {
      name: "docProps/core.xml",
      data: buildCoreProperties(content.sheetName || "Hoja1"),
    },
    {
      name: "docProps/app.xml",
      data: buildAppProperties(content.sheetName || "Hoja1"),
    },
  ];

  return buildZip(entries);
}
