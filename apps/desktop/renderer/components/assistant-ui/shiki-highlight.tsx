import { useEffect, useState, useRef } from "react";
import type { ShikiWorkerRequest, ShikiWorkerResponse } from "../../workers/shiki.worker.js";
import { sanitizeShikiHtml } from "../../lib/sanitize-html.js";

interface ShikiHighlightProps {
  code: string;
  language?: string;
  streaming?: boolean;
}

function normalizeLang(raw?: string): string {
  const l = (raw || "").toLowerCase();
  if (l === "ts") return "typescript";
  if (l === "tsx") return "tsx";
  if (l === "typescript") return "typescript";
  if (l === "diff") return "diff";
  return l || "text";
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

// Pool / Singleton de Worker para evitar sobrecoste de instanciación
let sharedWorker: Worker | null = null;
const pendingRequests = new Map<
  string,
  {
    resolve: (html: string) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();

/** T7: timeout de una petición al worker (evita el colgado eterno). */
const SHIKI_REQUEST_TIMEOUT_MS = 5000;

function getShikiWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return null;
  }
  if (!sharedWorker) {
    try {
      sharedWorker = new Worker(
        new URL("../../workers/shiki.worker.ts", import.meta.url),
        { type: "module" }
      );
      sharedWorker.onmessage = (e: MessageEvent<ShikiWorkerResponse>) => {
        const { id, html, error } = e.data;
        const pending = pendingRequests.get(id);
        if (pending) {
          // T7: limpiar SIEMPRE la entrada (evita la fuga del Map).
          pendingRequests.delete(id);
          clearTimeout(pending.timer);
          if (error) {
            pending.reject(new Error(error));
          } else if (html !== undefined) {
            pending.resolve(html);
          }
        }
      };
      sharedWorker.onerror = (err) => {
        console.warn("[ShikiHighlight] Error no capturado en Shiki Web Worker:", err);
        // T7: un error del worker no puede dejar peticiones colgadas.
        for (const [, pending] of pendingRequests) {
          clearTimeout(pending.timer);
          pending.reject(new Error("Shiki Web Worker error"));
        }
        pendingRequests.clear();
      };
    } catch (e) {
      console.warn("[ShikiHighlight] Web Worker no disponible, fallback in-thread:", e);
      sharedWorker = null;
    }
  }
  return sharedWorker;
}

/**
 * T7 (EGO-FIND-58) — Resalta código mediante Web Worker dedicado.
 *
 * - El worker es la vía principal (off-main-thread).
 * - Si el worker no está disponible (entorno de test o CSP restrictiva), cae
 *   al import dinámico in-thread **declarando el fallback** (`fallbackReason`),
 *   para que la UI pueda avisar al usuario en vez de degradar en silencio.
 * - Toda petición tiene TIMEOUT y su entrada del `pendingRequests` se
 *   elimina al resolverse, rechazarse o expirar (sin fugas).
 */
async function highlightOffMainThread(
  code: string,
  lang: "diff" | "typescript" | "tsx"
): Promise<{ html: string; fallbackReason: string | null }> {
  const worker = getShikiWorker();
  if (worker) {
    try {
      const html = await new Promise<string>((resolve, reject) => {
        const id = `shiki_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const timer = setTimeout(() => {
          pendingRequests.delete(id);
          reject(new Error("Shiki Web Worker timeout"));
        }, SHIKI_REQUEST_TIMEOUT_MS);
        pendingRequests.set(id, { resolve, reject, timer });
        const req: ShikiWorkerRequest = {
          id,
          code,
          lang,
          theme: "github-dark",
        };
        worker.postMessage(req);
      });
      return { html, fallbackReason: null };
    } catch (err) {
      // El worker falló → fallback in-thread, pero VISIBLE.
      const reason = err instanceof Error ? err.message : String(err);
      console.warn("[ShikiHighlight] Worker fallido, fallback in-thread:", err);
      const { highlightCode } = await import("../../workers/shiki-core.js");
      const html = await highlightCode(code, lang);
      return { html, fallbackReason: reason };
    }
  }

  // Fallback in-thread (entornos sin Worker / Happy-DOM).
  const { highlightCode } = await import("../../workers/shiki-core.js");
  const html = await highlightCode(code, lang);
  return { html, fallbackReason: "worker-no-disponible" };
}

/**
 * ShikiHighlight — resaltado shiki ejecutado off-main-thread con Web Worker.
 * Solo diff/ts/tsx/typescript; resto cae a <pre>. Streaming o fallo → <pre> plano.
 * Reduced-motion → sin animación token.
 */
export function ShikiHighlight({ code, language, streaming = false }: ShikiHighlightProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const reqIdRef = useRef(0);

  const lang = normalizeLang(language);
  const supported = lang === "diff" || lang === "typescript" || lang === "tsx";

  useEffect(() => {
    if (streaming || !supported) return;
    const currentReq = ++reqIdRef.current;
    setHtml(null);
    setFailed(false);
    setFallbackReason(null);

    highlightOffMainThread(code, lang as "diff" | "typescript" | "tsx")
      .then(({ html: out, fallbackReason: reason }) => {
        if (reqIdRef.current !== currentReq) return; // respuesta obsoleta
        setHtml(out);
        // T7: el fallback es VISIBLE (no un console.warn silencioso).
        setFallbackReason(reason);
      })
      .catch((err) => {
        if (reqIdRef.current !== currentReq) return;
        console.warn("[ShikiHighlight] Error resaltando código:", err);
        setFailed(true);
      });

    return () => {
      // Invalida la respuesta en curso (el pendiente se limpia solo por
      // timeout/resolución; el id obsoleto ya no se aplica).
      reqIdRef.current++;
    };
  }, [code, lang, streaming, supported]);

  if (streaming || !supported || failed || !html) {
    return <pre className="m-0">{code}</pre>;
  }

  return (
    <div
      className="shiki-static"
      data-shiki-fallback={fallbackReason ? "true" : undefined}
      data-shiki-fallback-reason={fallbackReason ?? undefined}
      style={reducedMotion ? { animation: "none" } : undefined}
      // T3 (EGO-FIND-61): el HTML del worker pasa por la política defensiva
      // (sin `<script>`, sin handlers inline, sin cargas remotas) antes de
      // inyectarse en el DOM.
      dangerouslySetInnerHTML={{ __html: sanitizeShikiHtml(html) }}
    />
  );
}
