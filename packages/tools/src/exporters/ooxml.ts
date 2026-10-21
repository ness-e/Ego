/**
 * ooxml.ts — utilidades compartidas por los exportadores OOXML.
 *
 * DOCX, XLSX y PPTX comparten la misma estructura de contenedor:
 * un ZIP con `[Content_Types].xml` (el manifiesto de tipos MIME), una carpeta
 * `_rels/.rels` (las relaciones de la raíz) y las partes específicas de cada
 * formato, cada una con sus propias relaciones.
 *
 * Este módulo centraliza el escapado XML y la construcción de esas partes
 * comunes para que los tres exportadores no dupliquen el andamiaje.
 */

/** Escapa un texto para insertarlo en un atributo XML. */
export function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Escapa un texto para el contenido de un elemento XML. */
export function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Genera `[Content_Types].xml` a partir de los overrides de cada parte.
 *
 * @param defaults  Extensiones por defecto (ext → Content-Type).
 * @param overrides Partes concretas (nombre de parte → Content-Type).
 */
export function buildContentTypes(
  defaults: ReadonlyArray<{ extension: string; contentType: string }>,
  overrides: ReadonlyArray<{ partName: string; contentType: string }>
): string {
  const defaultXml = defaults
    .map(
      (d) =>
        `  <Default Extension="${escapeXmlAttr(d.extension)}" ContentType="${escapeXmlAttr(d.contentType)}"/>`
    )
    .join("\n");
  const overrideXml = overrides
    .map(
      (o) =>
        `  <Override PartName="${escapeXmlAttr(o.partName)}" ContentType="${escapeXmlAttr(o.contentType)}"/>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
${defaultXml}
${overrideXml}
</Types>
`;
}

/**
 * Genera un fichero de relaciones (`.rels`).
 *
 * @param relationships Lista de relaciones (id → type + target).
 */
export function buildRelationships(
  relationships: ReadonlyArray<{ id: string; type: string; target: string }>
): string {
  const items = relationships
    .map(
      (r) =>
        `  <Relationship Id="${escapeXmlAttr(r.id)}" Type="${escapeXmlAttr(r.type)}" Target="${escapeXmlAttr(r.target)}"/>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${items}
</Relationships>
`;
}

/** Tipos de relación OOXML más usados. */
export const REL_TYPES = {
  officeDocument:
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument",
  coreProperties:
    "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties",
  extendedProperties:
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties",
  worksheet:
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet",
  slide: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide",
  slideLayout:
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout",
  theme: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme",
} as const;

/** Tipos MIME de las partes OOXML. */
export const CONTENT_TYPES = {
  relationships:
    "application/vnd.openxmlformats-package.relationships+xml",
  docxMain:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
  xlsxMain:
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
  xlsxWorksheet:
    "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml",
  pptxMain:
    "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
  pptxSlide:
    "application/vnd.openxmlformats-officedocument.presentationml.slide+xml",
  pptxSlideLayout:
    "application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml",
  pptxTheme:
    "application/vnd.openxmlformats-officedocument.theme+xml",
  coreProperties:
    "application/vnd.openxmlformats-package.core-properties+xml",
  extendedProperties:
    "application/vnd.openxmlformats-officedocument.extended-properties+xml",
} as const;

/**
 * Genera `docProps/core.xml` (metadatos del paquete).
 */
export function buildCoreProperties(
  title: string,
  creator = "Ego",
  createdAtIso = new Date().toISOString()
): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXmlText(title)}</dc:title>
  <dc:creator>${escapeXmlText(creator)}</dc:creator>
  <cp:lastModifiedBy>${escapeXmlText(creator)}</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${createdAtIso}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${createdAtIso}</dcterms:modified>
</cp:coreProperties>
`;
}

/**
 * Genera `docProps/app.xml` (propiedades extendidas del paquete).
 */
export function buildAppProperties(title: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Ego</Application>
  <Company>Ego</Company>
  <Titles><vt:vector size="1" baseType="lpstr"><vt:lpstr>${escapeXmlText(title)}</vt:lpstr></vt:vector></Titles>
</Properties>
`;
}
