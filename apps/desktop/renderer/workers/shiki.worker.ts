/**
 * Shiki Web Worker
 * Ejecuta el parseo y coloreado de sintaxis Shiki fuera del hilo principal (off-main-thread)
 * para garantizar 60-120 FPS fluidos durante el streaming del chat de Ego.
 */
import { codeToHtml } from "shiki";

export interface ShikiWorkerRequest {
  id: string;
  code: string;
  lang: "diff" | "typescript" | "tsx";
  theme?: string;
}

export interface ShikiWorkerResponse {
  id: string;
  html?: string;
  error?: string;
}

self.onmessage = async (e: MessageEvent<ShikiWorkerRequest>) => {
  const { id, code, lang, theme = "github-dark" } = e.data;
  try {
    const html = await codeToHtml(code, {
      lang,
      theme,
    });
    const res: ShikiWorkerResponse = { id, html };
    self.postMessage(res);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const res: ShikiWorkerResponse = { id, error: errorMsg };
    self.postMessage(res);
  }
};
