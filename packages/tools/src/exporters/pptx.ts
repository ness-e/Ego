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
 * pptx.ts — generador de PPTX (PresentationML) sin dependencias.
 *
 * E4 (Ola 3). Un `.pptx` es un ZIP con un mínimo de partes:
 * - `[Content_Types].xml`
 * - `_rels/.rels` → `ppt/presentation.xml`
 * - `ppt/presentation.xml` — la presentación y su lista de slides.
 * - `ppt/_rels/presentation.xml.rels` — relación con la slide y el layout.
 * - `ppt/slides/slide1.xml` — el contenido de la diapositiva.
 * - `ppt/slides/_rels/slide1.xml.rels` — relación con el layout.
 * - `ppt/slideLayouts/slideLayout1.xml` + sus relaciones — el layout.
 * - `ppt/theme/theme1.xml` — el tema (lo exige el esquema de PresentationML).
 *
 * Se emite **una diapositiva por sección**: el formato no es un documento
 * largo, es un mazo de diapositivas.
 */

/** Diapositiva de la presentación. */
export interface PptxSlide {
  /** Título de la diapositiva. */
  readonly title: string;
  /** Puntos de la diapositiva (uno por línea). */
  readonly bullets?: readonly string[];
}

/** Contenido de una presentación. */
export interface PptxContent {
  /** Título de la presentación. */
  readonly title: string;
  /** Diapositivas. Si está vacío, se genera una con el título. */
  readonly slides: readonly PptxSlide[];
}

/** Dimensiones de la diapositiva en EMU (16:9 → 12192000 × 6858000). */
const SLIDE_WIDTH_EMU = 12192000;
const SLIDE_HEIGHT_EMU = 6858000;

/** Genera el `ppt/slides/slideN.xml` de una diapositiva. */
export function buildPptxSlideXml(slide: PptxSlide): string {
  const bullets = (slide.bullets ?? [])
    .map(
      (bullet) =>
        `      <a:p><a:r><a:rPr lang="es-ES" dirty="0"/><a:t>${escapeXmlText(bullet)}</a:t></a:r></a:p>`
    )
    .join("\n");

  const body = bullets.length > 0 ? bullets : `      <a:p><a:endParaRPr lang="es-ES"/></a:p>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="838200" y="365125"/><a:ext cx="${SLIDE_WIDTH_EMU - 1676400}" cy="1143000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/>
          <a:p><a:r><a:rPr lang="es-ES" sz="2800" dirty="0"/><a:t>${escapeXmlText(slide.title)}</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="838200" y="1825625"/><a:ext cx="${SLIDE_WIDTH_EMU - 1676400}" cy="4000500"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/>
${body}
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>
`;
}

/** Genera el `ppt/slideLayouts/slideLayout1.xml` (layout en blanco). */
function buildPptxSlideLayoutXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
  <p:cSld name="En blanco">
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>
`;
}

/** Genera el `ppt/theme/theme1.xml` mínimo que exige PresentationML. */
function buildPptxThemeXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Ego">
  <a:themeElements>
    <a:clrScheme name="Ego">
      <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
      <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="1F2933"/></a:dk2>
      <a:lt2><a:srgbClr val="F5F7FA"/></a:lt2>
      <a:accent1><a:srgbClr val="2563EB"/></a:accent1>
      <a:accent2><a:srgbClr val="0EA5E9"/></a:accent2>
      <a:accent3><a:srgbClr val="10B981"/></a:accent3>
      <a:accent4><a:srgbClr val="F59E0B"/></a:accent4>
      <a:accent5><a:srgbClr val="EF4444"/></a:accent5>
      <a:accent6><a:srgbClr val="8B5CF6"/></a:accent6>
      <a:hlink><a:srgbClr val="2563EB"/></a:hlink>
      <a:folHlink><a:srgbClr val="8B5CF6"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Ego">
      <a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
      <a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Ego">
      <a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
      <a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>
      <a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
      <a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:solidFill></a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>
`;
}

/**
 * Construye un archivo PPTX completo (ZIP OOXML válido).
 */
export function buildPptx(content: PptxContent): ZipArchive {
  const slides =
    content.slides.length > 0
      ? content.slides
      : [{ title: content.title, bullets: [] as string[] }];

  const entries: ZipEntry[] = [
    {
      name: "[Content_Types].xml",
      data: buildContentTypes(
        [
          { extension: "rels", contentType: CONTENT_TYPES.relationships },
          { extension: "xml", contentType: "application/xml" },
        ],
        [
          { partName: "/ppt/presentation.xml", contentType: CONTENT_TYPES.pptxMain },
          { partName: "/ppt/slideLayouts/slideLayout1.xml", contentType: CONTENT_TYPES.pptxSlideLayout },
          { partName: "/ppt/theme/theme1.xml", contentType: CONTENT_TYPES.pptxTheme },
          ...slides.map((_, index) => ({
            partName: `/ppt/slides/slide${index + 1}.xml`,
            contentType: CONTENT_TYPES.pptxSlide,
          })),
          { partName: "/docProps/core.xml", contentType: CONTENT_TYPES.coreProperties },
          { partName: "/docProps/app.xml", contentType: CONTENT_TYPES.extendedProperties },
        ]
      ),
    },
    {
      name: "_rels/.rels",
      data: buildRelationships([
        { id: "rId1", type: REL_TYPES.officeDocument, target: "ppt/presentation.xml" },
        { id: "rId2", type: REL_TYPES.coreProperties, target: "docProps/core.xml" },
        { id: "rId3", type: REL_TYPES.extendedProperties, target: "docProps/app.xml" },
      ]),
    },
    {
      name: "ppt/presentation.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" saveSubsetFonts="1">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>
${slides.map((_, index) => `    <p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join("\n")}
  </p:sldIdLst>
  <p:sldSz cx="${SLIDE_WIDTH_EMU}" cy="${SLIDE_HEIGHT_EMU}"/>
  <p:notesSz cx="${SLIDE_HEIGHT_EMU}" cy="${SLIDE_WIDTH_EMU}"/>
</p:presentation>
`,
    },
    {
      name: "ppt/_rels/presentation.xml.rels",
      data: buildRelationships([
        {
          id: "rId1",
          type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster",
          target: "slideMasters/slideMaster1.xml",
        },
        ...slides.map((_, index) => ({
          id: `rId${index + 2}`,
          type: REL_TYPES.slide,
          target: `slides/slide${index + 1}.xml`,
        })),
        {
          id: `rId${slides.length + 2}`,
          type: REL_TYPES.slideLayout,
          target: "slideLayouts/slideLayout1.xml",
        },
        {
          id: `rId${slides.length + 3}`,
          type: REL_TYPES.theme,
          target: "theme/theme1.xml",
        },
      ]),
    },
    {
      name: "ppt/slideMasters/slideMaster1.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>
`,
    },
    {
      name: "ppt/slideMasters/_rels/slideMaster1.xml.rels",
      data: buildRelationships([
        {
          id: "rId1",
          type: REL_TYPES.slideLayout,
          target: "../slideLayouts/slideLayout1.xml",
        },
        {
          id: "rId2",
          type: REL_TYPES.theme,
          target: "../theme/theme1.xml",
        },
      ]),
    },
    {
      name: "ppt/slideLayouts/slideLayout1.xml",
      data: buildPptxSlideLayoutXml(),
    },
    {
      name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
      data: buildRelationships([
        {
          id: "rId1",
          type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster",
          target: "../slideMasters/slideMaster1.xml",
        },
      ]),
    },
    {
      name: "ppt/theme/theme1.xml",
      data: buildPptxThemeXml(),
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

  slides.forEach((slide, index) => {
    entries.push({
      name: `ppt/slides/slide${index + 1}.xml`,
      data: buildPptxSlideXml(slide),
    });
    entries.push({
      name: `ppt/slides/_rels/slide${index + 1}.xml.rels`,
      data: buildRelationships([
        {
          id: "rId1",
          type: REL_TYPES.slideLayout,
          target: "../slideLayouts/slideLayout1.xml",
        },
      ]),
    });
  });

  return buildZip(entries);
}
