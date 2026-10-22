import { useState, useMemo, memo, lazy, Suspense, Component, type ReactNode } from "react";
import { CaretRight, Brain, Copy, Check } from "@phosphor-icons/react";
import { AnsiText } from "./ansi-text.js";
import { ArtifactCard, type ArtifactKind } from "./artifact-card.js";
import { AskDirective } from "./ask-directive.js";
import { ThinkingBlock } from "../chat/ThinkingBlock.js";

// shiki en chunk separado: no entra al bundle inicial (lazy + Suspense).
// Paquete `@assistant-ui/react-shiki` no existe en npm (404); equivalente
// válido: `shiki` directo + `@assistant-ui/react-syntax-highlighter`.
const ShikiHighlightLazy = lazy(() =>
  import("./shiki-highlight.js").then((m) => ({ default: m.ShikiHighlight }))
);

class ShikiErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

interface MarkdownTextProps {
  text: string;
  streaming?: boolean;
  onOpenArtifact?: (content: string, meta: { title: string; kind: ArtifactKind; language: string }) => void;
}

interface ParsedBlock {
  type: "text" | "code" | "artifact" | "directive_ask" | "why";
  content: string;
  language?: string;
  meta?: Record<string, string>;
}

/**
 * Pre-procesador que elimina Raw CoT (<thinking>...</thinking>) según §9 de la arquitectura canónica.
 */
export function sanitizeRawCoT(input: string): string {
  if (!input) return "";
  // Suprime completamente etiquetas thinking internas
  return input.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim();
}

/**
 * Extrae bloques de pensamiento <thinking>...</thinking> y devuelve el texto limpio.
 */
export function extractThinkingAndClean(input: string): { thinkingBlocks: string[]; cleanText: string } {
  if (!input) return { thinkingBlocks: [], cleanText: "" };
  const thinkingBlocks: string[] = [];
  const re = /<thinking>([\s\S]*?)<\/thinking>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    if (m[1]?.trim()) {
      thinkingBlocks.push(m[1].trim());
    }
  }
  const cleanText = input.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim();
  return { thinkingBlocks, cleanText };
}

/**
 * Parsea el texto en bloques estructurados para renderizado enriquecido y seguro.
 */
function parseContentBlocks(rawText: string): ParsedBlock[] {
  const sanitized = sanitizeRawCoT(rawText);
  if (!sanitized) return [];

  const blocks: ParsedBlock[] = [];
  const lines = sanitized.split("\n");

  let inCode = false;
  let codeLang = "";
  let codeBuffer: string[] = [];
  let textBuffer: string[] = [];

  const flushText = () => {
    if (textBuffer.length > 0) {
      const fullText = textBuffer.join("\n");
      // Detectar directivas inline <ego:ask ... />
      const askMatch = fullText.match(/<ego:ask\s+question="([^"]+)"(?:\s+options="([^"]+)")?\s*\/>/i);
      const whyMatch = fullText.match(/<ego:why>([\s\S]*?)<\/ego:why>/i);

      if (askMatch) {
        const [whole, question, options] = askMatch;
        const wholeLen = whole?.length ?? 0;
        const pre = fullText.substring(0, askMatch.index || 0).trim();
        const post = fullText.substring((askMatch.index || 0) + wholeLen).trim();
        if (pre) blocks.push({ type: "text", content: pre });
        blocks.push({
          type: "directive_ask",
          content: question ?? "",
          meta: { question: question ?? "", options: options || "" },
        });
        if (post) blocks.push({ type: "text", content: post });
      } else if (whyMatch) {
        const [whole, whyContent] = whyMatch;
        const wholeLen = whole?.length ?? 0;
        const pre = fullText.substring(0, whyMatch.index || 0).trim();
        const post = fullText.substring((whyMatch.index || 0) + wholeLen).trim();
        if (pre) blocks.push({ type: "text", content: pre });
        blocks.push({ type: "why", content: (whyContent ?? "").trim() });
        if (post) blocks.push({ type: "text", content: post });
      } else {
        blocks.push({ type: "text", content: fullText });
      }
      textBuffer = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim().startsWith("```")) {
      if (inCode) {
        // Cierre de código
        const codeContent = codeBuffer.join("\n");
        const isArtifactCandidate =
          codeBuffer.length > 12 ||
          ["html", "svg", "tsx", "jsx", "python", "rust"].includes(codeLang.toLowerCase());

        if (isArtifactCandidate) {
          blocks.push({
            type: "artifact",
            content: codeContent,
            language: codeLang || "code",
          });
        } else {
          blocks.push({
            type: "code",
            content: codeContent,
            language: codeLang || "text",
          });
        }
        codeBuffer = [];
        inCode = false;
        codeLang = "";
      } else {
        // Apertura de código
        flushText();
        inCode = true;
        codeLang = line.trim().replace(/^```/, "").trim();
      }
    } else if (inCode) {
      codeBuffer.push(line);
    } else {
      textBuffer.push(line);
    }
  }

  if (inCode && codeBuffer.length > 0) {
    blocks.push({
      type: "code",
      content: codeBuffer.join("\n"),
      language: codeLang || "text",
    });
  } else {
    flushText();
  }

  return blocks;
}

/**
 * Bloque de Explicabilidad y Auditoría ("¿Por qué?").
 */
function ExplainabilityAccordion({ content }: { content: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="my-2 rounded-[var(--radius-card)] border border-hairline bg-raised text-xs">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-3 py-2 text-faint hover:text-ink cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-1.5 font-medium">
          <Brain size={14} className="text-brand" />
          <span>Explicabilidad & Evidencia ("¿Por qué?")</span>
        </div>
        <CaretRight
          size={12}
          className={`transition-transform duration-[var(--motion-duration-ui)] ${isOpen ? "rotate-90" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="border-t border-hairline px-3 py-2.5 text-xs text-faint font-mono whitespace-pre-wrap leading-relaxed">
          {content}
        </div>
      )}
    </div>
  );
}

/**
 * Bloque de código simple con botón de copia rápida y soporte para ANSI.
 * diff/ts/tsx → shiki lazy (Suspense, chunk separado); fallo → <pre> plano.
 * Terminal/ANSI intacto. Sin animación token; reduced-motion → estático.
 * Memoizado: durante el stream solo el último bloque de texto cambia;
 * los bloques de código ya cerrados no re-renderizan.
 */
export const SHIKI_SUPPORTED_LANGUAGES: readonly string[] = [
  "diff",
  "ts",
  "tsx",
  "typescript",
  "js",
  "jsx",
  "javascript",
  "json",
  "python",
  "py",
  "rust",
  "rs",
  "bash",
  "sh",
  "html",
  "css",
  "sql",
  "yaml",
  "md",
  "markdown",
];

const CodeBlock = memo(
  function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const lang = (language || "").toLowerCase();
  const isTerminal = ["bash", "sh", "shell", "console", "terminal", "zsh"].includes(lang);
  const useShiki = SHIKI_SUPPORTED_LANGUAGES.includes(lang);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2 rounded-[var(--radius-card)] border border-hairline bg-raised overflow-hidden text-xs">
      <div className="flex items-center justify-between border-b border-hairline px-3 py-1 bg-panel text-xs text-faint font-mono">
        <span>{language || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-faint hover:text-ink transition-colors"
        >
          {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
          <span>{copied ? "Copiado" : "Copiar"}</span>
        </button>
      </div>
      <div className="p-3 overflow-x-auto font-mono text-xs leading-relaxed">
        {isTerminal ? (
          <AnsiText text={code} />
        ) : useShiki ? (
          <ShikiErrorBoundary fallback={<pre className="m-0">{code}</pre>}>
            <Suspense fallback={<pre className="m-0">{code}</pre>}>
              <ShikiHighlightLazy code={code} language={lang} />
            </Suspense>
          </ShikiErrorBoundary>
        ) : (
          <pre className="m-0">{code}</pre>
        )}
      </div>
    </div>
  );
  },
  (prev, next) => prev.code === next.code && prev.language === next.language
);

/**
 * MarkdownText — Renderizador robusto y seguro de mensajes de chat.
 * Extraído y adaptado de Hermes Agent (HERM-02) para Ego SOC.
 * Memo con comparador custom: el padre (burbuja memoizada + Thread) se
 * re-renderiza por cada frame del stream; solo re-parsea cuando el texto,
 * el flag de streaming o el handler cambian. `useMemo(blocks)` evita
 * re-parsear dentro del mismo texto.
 */
function MarkdownTextInner({
  text,
  streaming = false,
  onOpenArtifact,
}: MarkdownTextProps) {
  const { thinkingBlocks, cleanText } = useMemo(() => extractThinkingAndClean(text), [text]);
  const blocks = useMemo(() => parseContentBlocks(cleanText), [cleanText]);

  if (!blocks.length && !thinkingBlocks.length) {
    return null;
  }

  return (
    <div className="space-y-1.5 leading-normal">
      {thinkingBlocks.length > 0 && (
        <ThinkingBlock thoughts={thinkingBlocks} />
      )}
      {blocks.map((block, index) => {
        switch (block.type) {
          case "directive_ask":
            return (
              <AskDirective
                key={`ask-${index}`}
                question={block.meta?.question || block.content}
                options={block.meta?.options || ""}
                streaming={streaming}
              />
            );

          case "why":
            return <ExplainabilityAccordion key={`why-${index}`} content={block.content} />;

          case "artifact": {
            const kind: ArtifactKind =
              block.language === "html"
                ? "html"
                : block.language === "svg"
                ? "svg"
                : block.language === "md" || block.language === "markdown"
                ? "markdown"
                : "code";

            return (
              <ArtifactCard
                key={`artifact-${index}`}
                content={block.content}
                language={block.language}
                kind={kind}
                streaming={streaming}
                onOpen={onOpenArtifact}
              />
            );
          }

          case "code":
            return (
              <CodeBlock
                key={`code-${index}`}
                code={block.content}
                language={block.language}
              />
            );

          case "text":
          default:
            return (
              <p
                key={`text-${index}`}
                className="m-0 whitespace-pre-wrap break-words text-sm leading-relaxed"
              >
                {block.content}
              </p>
            );
        }
      })}
    </div>
  );
}

export const MarkdownText = memo(
  MarkdownTextInner,
  (prev, next) =>
    prev.text === next.text &&
    (prev.streaming ?? false) === (next.streaming ?? false) &&
    prev.onOpenArtifact === next.onOpenArtifact
);
MarkdownText.displayName = "MarkdownText";

export const PlainMarkdown = MarkdownText;

