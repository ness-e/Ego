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
 * docx.ts — generador de DOCX (WordprocessingML) sin dependencias.
 *
 * E4 (Ola 3). Un `.docx` es un ZIP con un mínimo de partes:
 * - `[Content_Types].xml` — manifiesto de tipos MIME.
 * - `_rels/.rels` — relación raíz con el documento principal.
 * - `word/document.xml` — el contenido (párrafos).
 * - `word/_rels/document.xml.rels` — relaciones del documento.
 *
 * El texto se escribe con saltos de línea explícitos (`w:br`) para que el
 * resultado sea legible en Word/LibreOffice sin depender del auto-ajuste.
 */

/** Contenido de un documento. */
export interface DocxContent {
  /** Título del documento (heading). */
  readonly title: string;
  /** Párrafos del cuerpo (uno por entrada). */
  readonly paragraphs: readonly string[];
}

/** Genera el `word/document.xml` de un DOCX. */
export function buildDocxDocumentXml(content: DocxContent): string {
  const titleParagraph = `  <w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t xml:space="preserve">${escapeXmlText(content.title)}</w:t></w:r></w:p>`;

  const bodyParagraphs = content.paragraphs
    .map((paragraph) => {
      const lines = paragraph.split("\n");
      const runs = lines
        .map(
          (line, index) =>
            `<w:r><w:t xml:space="preserve">${escapeXmlText(line)}</w:t>${
              index < lines.length - 1 ? "<w:br/>" : ""
            }</w:r>`
        )
        .join("");
      return `  <w:p>${runs}</w:p>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${titleParagraph}
${bodyParagraphs}
  <w:sectPr>
    <w:pgSz w:w="11906" w:h="16838"/>
    <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="709" w:footer="709" w:gutter="0"/>
  </w:sectPr>
</w:body>
</w:document>
`;
}

/**
 * Construye un archivo DOCX completo (ZIP OOXML válido).
 */
export function buildDocx(content: DocxContent): ZipArchive {
  const entries: ZipEntry[] = [
    {
      name: "[Content_Types].xml",
      data: buildContentTypes(
        [
          {
            extension: "rels",
            contentType: CONTENT_TYPES.relationships,
          },
          {
            extension: "xml",
            contentType: "application/xml",
          },
        ],
        [
          { partName: "/word/document.xml", contentType: CONTENT_TYPES.docxMain },
          { partName: "/docProps/core.xml", contentType: CONTENT_TYPES.coreProperties },
          {
            partName: "/docProps/app.xml",
            contentType: CONTENT_TYPES.extendedProperties,
          },
        ]
      ),
    },
    {
      name: "_rels/.rels",
      data: buildRelationships([
        {
          id: "rId1",
          type: REL_TYPES.officeDocument,
          target: "word/document.xml",
        },
        {
          id: "rId2",
          type: REL_TYPES.coreProperties,
          target: "docProps/core.xml",
        },
        {
          id: "rId3",
          type: REL_TYPES.extendedProperties,
          target: "docProps/app.xml",
        },
      ]),
    },
    {
      name: "word/document.xml",
      data: buildDocxDocumentXml(content),
    },
    {
      name: "word/_rels/document.xml.rels",
      data: buildRelationships([]),
    },
    {
      name: "docProps/core.xml",
      data: buildCoreProperties(content.title),
    },
    {
      name: "docProps/app.xml",
      data: buildAppProperties(content.title),
    },
  ];

  return buildZip(entries);
}
