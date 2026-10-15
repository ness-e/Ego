import { useState, useMemo, memo } from "react";
import { Code, FileText, Globe, Image as ImageIcon, Copy, Check, ArrowSquareOut } from "@phosphor-icons/react";

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
 * ofrece integración directa con el Dynamic Workspace (Canvas).
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

  const trimmed = (content || "").trim();
  const lineCount = useMemo(() => trimmed.split("\n").length, [trimmed]);
  const displayTitle = title || `${language || "artifact"}.${kind === "html" ? "html" : kind === "svg" ? "svg" : kind === "markdown" ? "md" : "txt"}`;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!trimmed) return;
    navigator.clipboard.writeText(trimmed);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpen = () => {
    if (streaming || !trimmed) return;
    if (onOpen) {
      onOpen(trimmed, { title: displayTitle, kind, language });
    } else {
      // Disparo por defecto al Canvas Bridge si existe
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
        egoGlobal.canvas.openArtifact({
          title: displayTitle,
          content: trimmed,
          kind,
          language,
        });
      }
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
      className={`my-2 flex w-full max-w-lg items-center justify-between rounded-lg border border-hairline bg-panel p-2.5 text-xs transition-colors ${
        streaming ? "opacity-75 animate-pulse" : "hover:border-dim hover:bg-raised cursor-pointer"
      }`}
    >
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

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={handleCopy}
          title="Copiar contenido"
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
          className="rounded p-1 text-faint hover:text-ink hover:bg-raised transition-colors"
        >
          <ArrowSquareOut size={14} />
        </button>
      </div>
    </div>
  );
});
