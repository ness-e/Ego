import { useEffect, useState } from "react";

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

/**
 * ShikiHighlight — resaltado shiki en chunk separado (React.lazy + Suspense
 * desde el llamador). Solo diff/ts/tsx/typescript; resto cae a <pre>.
 * Streaming o fallo → <pre> plano. Reduced-motion → sin animación token
 * (render estático, animation: none).
 *
 * Nota dep: se pidió `@assistant-ui/react-shiki` pero ese paquete no existe
 * en npm (404). Equivalente válido instalado: `shiki` directo +
 * `@assistant-ui/react-syntax-highlighter`. Este componente usa `shiki`
 * directo para no acoplar el bundle inicial.
 */
export function ShikiHighlight({ code, language, streaming = false }: ShikiHighlightProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const lang = normalizeLang(language);
  const supported = lang === "diff" || lang === "typescript" || lang === "tsx";

  useEffect(() => {
    if (streaming || !supported) return;
    let cancelled = false;
    setHtml(null);
    setFailed(false);
    void (async () => {
      try {
        const { codeToHtml } = await import("shiki");
        const out = await codeToHtml(code, {
          lang: lang as "diff" | "typescript" | "tsx",
          theme: "github-dark",
        });
        if (!cancelled) setHtml(out);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
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
