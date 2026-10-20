/**
 * T7 (EGO-FIND-58) — Núcleo de resaltado Shiki con subconjunto de langs.
 *
 * ## Por qué NO `import { codeToHtml } from "shiki"`
 * El bundle completo de `shiki` (≈10 MB con TODOS los lenguajes y temas)
 * se importaba **estáticamente** en el chunk `index` del renderer, de modo
 * que el offload al Web Worker no reducía el bundle inicial: el usuario
 * descargaba 10 MB en el arranque para, quizá, nunca resaltar una línea.
 *
 * ## Qué se usa en su lugar
 * `shiki/bundle/web` expone `createHighlighter` con los lenguajes y temas
 * como **importaciones dinámicas** (`import("@shikijs/langs/typescript")`),
 * de modo que:
 *  - el chunk del worker solo contiene el motor + el subconjunto pedido,
 *  - el resto de gramáticas se descargan bajo demanda y solo si se usan,
 *  - el hilo principal NO carga nada de shiki hasta que hace falta el
 *    fallback in-thread (import dinámico).
 */
import {
  createHighlighter,
  bundledLanguages,
  bundledThemes,
  type Highlighter,
} from "shiki";

export type ShikiLang = "diff" | "typescript" | "tsx";
export type ShikiTheme = "github-dark";

/** Lenguajes soportados (subconjunto explícito de Ego). */
const LANG_IDS: ShikiLang[] = ["diff", "typescript", "tsx"];

/** Temas soportados (subconjunto explícito de Ego). */
const THEME_IDS: ShikiTheme[] = ["github-dark"];

let highlighterPromise: Promise<Highlighter> | null = null;

/** El highlighter se crea UNA vez y se reutiliza (lazy). */
export function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    // `bundledLanguages` / `bundledThemes` son importaciones DINÁMICAS por
    // lenguaje/tema (`import("@shikijs/langs/typescript")`), de modo que el
    // bundle solo carga los que Ego pide y el resto queda bajo demanda.
    const langs = LANG_IDS.map((id) => bundledLanguages[id]).filter(
      (l): l is (typeof bundledLanguages)[keyof typeof bundledLanguages] =>
        Boolean(l)
    );
    const themes = THEME_IDS.map((id) => bundledThemes[id]).filter(
      (t): t is (typeof bundledThemes)[keyof typeof bundledThemes] => Boolean(t)
    );
    highlighterPromise = createHighlighter({
      langs,
      themes,
    }) as Promise<Highlighter>;
  }
  return highlighterPromise;
}

/** Resalta `code` y devuelve el HTML. */
export async function highlightCode(
  code: string,
  lang: ShikiLang,
  theme: ShikiTheme = "github-dark"
): Promise<string> {
  const highlighter = await getHighlighter();
  return highlighter.codeToHtml(code, { lang, theme });
}
