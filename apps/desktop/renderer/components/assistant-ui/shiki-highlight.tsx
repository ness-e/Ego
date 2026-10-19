import { useEffect, useState, useRef } from "react";
import type { ShikiWorkerRequest, ShikiWorkerResponse } from "../../workers/shiki.worker.js";

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
  }
>();

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
          pendingRequests.delete(id);
          if (error) {
            pending.reject(new Error(error));
          } else if (html !== undefined) {
            pending.resolve(html);
          }
        }
      };
      sharedWorker.onerror = (err) => {
        console.warn("[ShikiHighlight] Error no capturado en Shiki Web Worker:", err);
      };
    } catch (e) {
      console.warn("[ShikiHighlight] Web Worker no disponible, fallback in-thread:", e);
      sharedWorker = null;
    }
  }
  return sharedWorker;
}

/**
 * Resalta código mediante Web Worker dedicado fuera del hilo principal (off-main-thread).
 * Si Web Workers no está disponible (ej. entorno de test o CSP restrictivo), cae
 * transparentemente al import dinámico in-thread sin bloquear la UI ni fallar.
 */
async function highlightOffMainThread(
  code: string,
  lang: "diff" | "typescript" | "tsx"
): Promise<string> {
  const worker = getShikiWorker();
  if (worker) {
    return new Promise<string>((resolve, reject) => {
      const id = `shiki_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      pendingRequests.set(id, { resolve, reject });
      const req: ShikiWorkerRequest = {
        id,
        code,
        lang,
        theme: "github-dark",
      };
      worker.postMessage(req);
    });
  }

  // Fallback in-thread (entornos sin Worker / Happy-DOM)
  const { codeToHtml } = await import("shiki");
  return codeToHtml(code, {
    lang,
    theme: "github-dark",
  });
}

/**
 * ShikiHighlight — resaltado shiki ejecutado off-main-thread con Web Worker.
 * Solo diff/ts/tsx/typescript; resto cae a <pre>.
 * Streaming o fallo → <pre> plano. Reduced-motion → sin animación token.
 */
export function ShikiHighlight({ code, language, streaming = false }: ShikiHighlightProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const reqIdRef = useRef(0);

  const lang = normalizeLang(language);
  const supported = lang === "diff" || lang === "typescript" || lang === "tsx";

  useEffect(() => {
    if (streaming || !supported) return;
    const currentReq = ++reqIdRef.current;
    setHtml(null);
    setFailed(false);

    highlightOffMainThread(code, lang as "diff" | "typescript" | "tsx")
      .then((out) => {
        if (reqIdRef.current === currentReq) {
          setHtml(out);
        }
      })
      .catch((err) => {
        if (reqIdRef.current === currentReq) {
          console.warn("[ShikiHighlight] Error resaltando código:", err);
          setFailed(true);
        }
      });

    return () => {
      reqIdRef.current++;
    };
  }, [code, lang, streaming, supported]);

  if (streaming || !supported || failed || !html) {
    return <pre className="m-0">{code}</pre>;
  }

  return (
    <div
      className="shiki-static"
      style={reducedMotion ? { animation: "none" } : undefined}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
