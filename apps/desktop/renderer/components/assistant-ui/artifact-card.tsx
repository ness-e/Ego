import { useState, useMemo, memo } from "react";
import { Code, FileText, Globe, Image as ImageIcon, Copy, Check, ArrowSquareOut, Eye } from "@phosphor-icons/react";
import { getSharedCanvasBridge } from "../../lib/canvasBridgeSingleton.js";

export type ArtifactKind = "code" | "markdown" | "html" | "svg" | "diagram";

export interface ArtifactCardProps {
  title?: string;
  kind?: ArtifactKind;
  language?: string;
  content: string;
  streaming?: boolean;
  version?: number;
  onOpen?: (content: string, meta: { title: string; kind: ArtifactKind; language: string }) => void;
}

function getArtifactKindIcon(kind: ArtifactKind, _language?: string) {
  switch (kind) {
    case "html":
      return <Globe size={15} className="text-amber-500 shrink-0" />;
    case "svg":
      return <ImageIcon size={15} className="text-violet-500 shrink-0" />;
    case "markdown":
      return <FileText size={15} className="text-sky-500 shrink-0" />;
    case "code":
    default:
      return <Code size={15} className="text-emerald-500 shrink-0" />;
  }
}

/**
 * ArtifactCard — Tarjeta compacta para bloques de código o documentos en el chat.
 * Extraído y adaptado de Hermes Agent (HERM-01) para Ego SOC.
 *
 * Evita la saturación visual del hilo de conversación con bloques enormes y
 * ofrece integración directa con el Dynamic Workspace (Canvas) y vista previa en vivo.
 */
export const ArtifactCard = memo(function ArtifactCard({
  title,
  kind = "code",
  language = "typescript",
  content,
  streaming = false,
  version = 1,
  onOpen,
}: ArtifactCardProps) {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"code" | "preview">("code");

  const trimmed = (content || "").trim();
  const lineCount = useMemo(() => trimmed.split("\n").length, [trimmed]);
  const displayTitle = title || `${language || "artifact"}.${kind === "html" ? "html" : kind === "svg" ? "svg" : kind === "markdown" ? "md" : "txt"}`;

  const langLower = (language || "").toLowerCase();
  const canPreview =
    ["html", "svg", "mermaid"].includes(langLower) ||
    kind === "html" ||
    kind === "svg" ||
    kind === "diagram";

  const isHtmlOrSvg = langLower === "html" || langLower === "svg" || kind === "html" || kind === "svg";
  const isMermaid = langLower === "mermaid" || kind === "diagram";

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!trimmed) return;
    navigator.clipboard.writeText(trimmed);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpen = () => {
    if (streaming || !trimmed) return;
    const finalLang = language || "typescript";

    if (onOpen) {
      onOpen(trimmed, { title: displayTitle, kind, language: finalLang });
    }

    // 1. window.ego?.canvas?.openArtifact
    const egoGlobal = (
      window as unknown as {
        ego?: {
          canvas?: {
            openArtifact?: (req: {
              title: string;
              content: string;
              kind: ArtifactKind;
              language: string;
            }) => void;
          };
        };
      }
    ).ego;
    if (typeof egoGlobal?.canvas?.openArtifact === "function") {
      try {
        egoGlobal.canvas.openArtifact({
          title: displayTitle,
          content: trimmed,
          kind,
          language: finalLang,
        });
      } catch {
        /* noop */
      }
    }

    // 2. CustomEvent ego:open-artifact
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("ego:open-artifact", {
          detail: {
            title: displayTitle,
            language: finalLang,
            code: trimmed,
          },
        })
      );
    }

    // 3. Inyectar componente editor en SharedCanvasBridge
    try {
      const bridge = getSharedCanvasBridge();
      bridge.injectComponent({
        id: `artifact-editor-${Date.now()}`,
        type: "editor",
        metadata: {
          timestamp: Date.now(),
          generatedBy: "artifact.card",
          why: {
            vantaSources: [],
            directCause: `Apertura de artefacto: ${displayTitle}`,
          },
        },
        props: {
          id: `editor-${Date.now()}`,
          title: displayTitle,
          language: finalLang,
          code: trimmed,
          readOnly: false,
          lineNumbers: true,
        },
      });
    } catch {
      /* noop si no está montado el bridge */
    }
  };

  return (
    <div
      onClick={handleOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleOpen();
        }
      }}
      className={`my-2 flex flex-col w-full max-w-lg rounded-xl border border-hairline bg-panel p-2.5 text-xs transition-colors ${
        streaming ? "opacity-75 animate-pulse" : "hover:border-dim hover:bg-raised cursor-pointer"
      }`}
    >
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-raised border border-hairline">
            {getArtifactKindIcon(kind, language)}
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-medium text-ink">{displayTitle}</span>
              {version > 1 && (
                <span className="rounded bg-raised px-1 py-0.2 text-[9px] font-mono text-faint">
                  v{version}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-faint font-mono">
              <span>{language}</span>
              <span>·</span>
              <span>{lineCount} {lineCount === 1 ? "línea" : "líneas"}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {canPreview && (
            <div className="flex items-center rounded-lg border border-hairline bg-panel/90 p-0.5 mr-1" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setViewMode("code")}
                title="Ver código fuente"
                aria-pressed={viewMode === "code"}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                  viewMode === "code" ? "bg-raised text-ink font-semibold" : "text-faint hover:text-ink"
                }`}
              >
                <Code size={11} />
                <span>Código</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("preview")}
                title="Ver vista previa en vivo"
                aria-pressed={viewMode === "preview"}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                  viewMode === "preview" ? "bg-raised text-ink font-semibold" : "text-faint hover:text-ink"
                }`}
              >
                <Eye size={11} />
                <span>Vista Previa</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleCopy}
            title="Copiar contenido"
            aria-label="Copiar contenido"
            className="rounded p-1 text-faint hover:text-ink hover:bg-raised transition-colors"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpen();
            }}
            title="Abrir en Workspace"
            aria-label="Abrir en Workspace"
            className="rounded p-1 text-faint hover:text-ink hover:bg-raised transition-colors"
          >
            <ArrowSquareOut size={14} />
          </button>
        </div>
      </div>

      {canPreview && viewMode === "preview" && (
        <div
          className="mt-2.5 pt-2 border-t border-hairline w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {isHtmlOrSvg && (
            <div className="rounded-lg overflow-hidden border border-hairline bg-white shadow-inner">
              <iframe
                sandbox=""
                srcDoc={trimmed}
                title={displayTitle}
                className="w-full h-44 border-0 block"
              />
            </div>
          )}
          {isMermaid && (
            <div className="rounded-lg border border-hairline bg-raised/40 p-3 font-mono text-[11px] text-ink overflow-x-auto">
              <div className="text-[10px] text-faint mb-1.5 flex items-center gap-1">
                <span>Diagrama Mermaid</span>
              </div>
              <pre className="whitespace-pre m-0 text-faint leading-relaxed">{trimmed}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
