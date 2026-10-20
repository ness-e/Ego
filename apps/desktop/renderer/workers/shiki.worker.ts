/**
 * T7 (EGO-FIND-58) — Shiki Web Worker.
 *
 * Ejecuta el parseo y coloreado de sintaxis Shiki fuera del hilo principal
 * (off-main-thread) para mantener la fluidez durante el streaming del chat.
 *
 * ## Por qué `shiki/core` y no `shiki`
 * El bundle completo de `shiki` (≈10 MB con TODOS los lenguajes y temas)
 * se importaba **estáticamente** en el chunk `index`, de modo que el
 * offload al worker no reducía el bundle inicial. Con `shiki/core` +
 * `createHighlighter` se declara **explícitamente** el subconjunto de
 * lenguajes que Ego usa (diff / typescript / tsx) y el tema.
 *
 * La lógica compartida vive en `shiki-core.ts` para que el fallback
 * in-thread del renderer use EXACTAMENTE el mismo subconjunto.
 */
import { highlightCode, type ShikiLang, type ShikiTheme } from "./shiki-core.js";

export interface ShikiWorkerRequest {
  id: string;
  code: string;
  lang: ShikiLang;
  theme?: ShikiTheme;
}

export interface ShikiWorkerResponse {
  id: string;
  html?: string;
  error?: string;
}

self.onmessage = async (e: MessageEvent<ShikiWorkerRequest>) => {
  const { id, code, lang, theme = "github-dark" } = e.data;
  try {
    const html = await highlightCode(code, lang, theme);
    const res: ShikiWorkerResponse = { id, html };
    self.postMessage(res);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const res: ShikiWorkerResponse = { id, error: errorMsg };
    self.postMessage(res);
  }
};
