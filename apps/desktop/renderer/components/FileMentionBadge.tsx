import React from "react";
import {
  FileText,
  Image as ImageIcon,
  Code as CodeIcon,
  File as GenericFileIcon,
  X,
  ArrowSquareOut,
} from "@phosphor-icons/react";
import { Badge } from "./ui-kit/Badge.js";
import { Tooltip } from "./ui-kit/Tooltip.js";

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
 *
 * ## Migración al design system (FASE 1)
 * - La insignia ya no reimplementa el primitive `Badge`: usa el del kit con su
 *   tono semántico (`warn` = imagen, `info` = código, `ok` = documento, `dim` =
 *   genérico). Antes cada tipo pintaba su propia paleta cruda
 *   (`text-amber-400` + `bg-amber-950/20`…), que no tematiza con los presets.
 * - El tooltip hand-rolled (`onMouseEnter`/`onMouseLeave` + un `<span>`
 *   posicionado a mano) se sustituye por el primitive `Tooltip` del kit
 *   (Radix): el panel se posiciona solo, respeta `prefers-reduced-motion` y
 *   asocia el contenido al trigger por `aria-describedby`.
 * - Los dos micro-controles (abrir / quitar) siguen siendo `<button>` nativos:
 *   la densidad mínima del `Button` del kit (28 px / 44 px) no cabe dentro de
 *   una insignia inline de 24 px sin romper el layout del composer. Se
 *   documenta como hueco de API (§f del informe): falta un botón-icono
 *   compacto en el kit.
 */
export const FileMentionBadge: React.FC<FileMentionBadgeProps> = ({
  path,
  compact = false,
  removable = false,
  onRemove,
  onOpen,
  className = "",
}) => {
  const basename = getBasename(path);
  const ext = getExtension(path);

  const isImage = IMAGE_EXTENSIONS.has(ext);
  const isCode = CODE_EXTENSIONS.has(ext);
  const isDoc = DOC_EXTENSIONS.has(ext);

  // Icono y tono semántico según la naturaleza del recurso. El color lo pone
  // el primitive `Badge`; el icono hereda el tono (sin clases de paleta cruda).
  let IconComponent = GenericFileIcon;
  let tone: "ok" | "warn" | "risk" | "info" | "dim" = "dim";

  if (isImage) {
    IconComponent = ImageIcon;
    tone = "warn";
  } else if (isCode) {
    IconComponent = CodeIcon;
    tone = "info";
  } else if (isDoc) {
    IconComponent = FileText;
    tone = "ok";
  }

  return (
    // El trigger del `Tooltip` debe ser un elemento nativo que acepte `ref`
    // (Radix lo necesita para anclar el panel): por eso el `span` envolvente.
    <Tooltip
      content={
        <span>
          <span className="text-dim">Ruta: </span>
          <span className="font-semibold text-ink">{path}</span>
        </span>
      }
    >
      <span className="inline-flex">
        <Badge tone={tone} className={`${compact ? "px-1.5 text-xs" : "text-xs"} ${className}`}>
          <span className="flex items-center gap-1">
            <IconComponent size={compact ? 12 : 14} className="shrink-0" weight="bold" />

            <span
              className={`truncate max-w-[160px] font-medium text-ink ${
                onOpen ? "cursor-pointer hover:underline" : ""
              }`}
              onClick={() => onOpen?.(path)}
            >
              {basename}
            </span>

            {onOpen && (
              <button
                type="button"
                onClick={() => onOpen(path)}
                className="rounded-md p-0.5 text-dim transition-colors hover:bg-raised hover:text-ink"
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
                className="rounded-md p-0.5 text-dim transition-colors hover:bg-raised hover:text-error"
                aria-label={`Quitar ${basename}`}
              >
                <X size={compact ? 10 : 12} />
              </button>
            )}
          </span>
        </Badge>
      </span>
    </Tooltip>
  );
};
