import React, { useState } from "react";
import {
  FileText,
  Image as ImageIcon,
  Code as CodeIcon,
  File as GenericFileIcon,
  X,
  ArrowSquareOut,
} from "@phosphor-icons/react";

export interface FileMentionBadgeProps {
  path: string;
  compact?: boolean;
  removable?: boolean;
  onRemove?: () => void;
  onOpen?: (path: string) => void;
  className?: string;
}

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg", "ico", "bmp"]);
const CODE_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "rs", "py", "go", "json", "yaml", "yml", "toml", "html", "css", "sql", "sh", "ps1"
]);
const DOC_EXTENSIONS = new Set(["md", "markdown", "txt", "pdf", "doc", "docx", "rtf"]);

function getBasename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const segments = normalized.split("/");
  return segments[segments.length - 1] || filePath;
}

function getExtension(filePath: string): string {
  const parts = filePath.split(".");
  return parts.length > 1 ? (parts[parts.length - 1]?.toLowerCase() ?? "") : "";
}

/**
 * Insignia interactiva para menciones de contexto '@archivo' en Composer y Chat (HELM-05).
 * Detecta tipos de archivo, provee vista previa contextual y permite apertura directa en Canvas.
 */
export const FileMentionBadge: React.FC<FileMentionBadgeProps> = ({
  path,
  compact = false,
  removable = false,
  onRemove,
  onOpen,
  className = "",
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const basename = getBasename(path);
  const ext = getExtension(path);

  const isImage = IMAGE_EXTENSIONS.has(ext);
  const isCode = CODE_EXTENSIONS.has(ext);
  const isDoc = DOC_EXTENSIONS.has(ext);

  // Icono y color semántico según la naturaleza del recurso
  let IconComponent = GenericFileIcon;
  let iconColor = "text-faint";
  let badgeBorder = "border-hairline";
  let badgeBg = "bg-raised/70";

  if (isImage) {
    IconComponent = ImageIcon;
    iconColor = "text-amber-400";
    badgeBorder = "border-amber-500/20";
    badgeBg = "bg-amber-950/20";
  } else if (isCode) {
    IconComponent = CodeIcon;
    iconColor = "text-cyan-400";
    badgeBorder = "border-cyan-500/20";
    badgeBg = "bg-cyan-950/20";
  } else if (isDoc) {
    IconComponent = FileText;
    iconColor = "text-emerald-400";
    badgeBorder = "border-emerald-500/20";
    badgeBg = "bg-emerald-950/20";
  }

  return (
    <span
      className={`relative inline-flex items-center gap-1.5 rounded-md border font-mono transition-colors select-none ${badgeBg} ${badgeBorder} ${
        compact ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs"
      } ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <IconComponent size={compact ? 12 : 14} className={`${iconColor} shrink-0`} weight="bold" />

      <span
        className={`truncate max-w-[160px] text-ink font-medium ${
          onOpen ? "cursor-pointer hover:underline" : ""
        }`}
        onClick={() => onOpen?.(path)}
        title={path}
      >
        {basename}
      </span>

      {onOpen && (
        <button
          type="button"
          onClick={() => onOpen(path)}
          className="text-dim hover:text-ink transition-colors p-0.5 rounded hover:bg-raised"
          aria-label={`Abrir ${basename}`}
        >
          <ArrowSquareOut size={compact ? 10 : 12} />
        </button>
      )}

      {removable && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="text-dim hover:text-rose-400 transition-colors p-0.5 rounded hover:bg-raised"
          aria-label={`Quitar ${basename}`}
        >
          <X size={compact ? 10 : 12} />
        </button>
      )}

      {/* Tooltip con ruta completa */}
      {showTooltip && (
        <span className="absolute bottom-full left-0 mb-1 z-50 whitespace-nowrap rounded bg-raised border border-hairline px-2 py-1 text-[10px] text-ink shadow-lg pointer-events-none">
          <span className="text-dim">Ruta: </span>
          <span className="text-ink font-semibold">{path}</span>
        </span>
      )}
    </span>
  );
};
