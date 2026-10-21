import React, { useMemo } from "react";
import {
  isPreviewableFile,
  previewExtensionOf,
  truncatePreview,
} from "./workbench-guards.js";
import { Badge } from "../ui-kit/Badge.js";

/**
 * CFG-13 — Preview de archivos read-only.
 * Presentacional puro: el contenido lo provee el padre (sin FS en renderer,
 * sin IPC nuevo). Nunca edita: `<pre>` sin `contentEditable`, sin handlers
 * de escritura. Los binarios/extensiones fuera de allowlist se deniegan con
 * mensaje honesto en vez de renderizar basura.
 */
export interface FilePreviewViewProps {
  filePath: string;
  content: string;
}

export const FilePreviewView: React.FC<FilePreviewViewProps> = ({
  filePath,
  content,
}) => {
  const preview = useMemo(() => truncatePreview(content), [content]);
  const lineCount = useMemo(
    () => preview.text.split("\n").length,
    [preview.text]
  );

  if (!isPreviewableFile(filePath)) {
    const ext = previewExtensionOf(filePath);
    return (
      <div
        role="alert"
        className="rounded-[var(--radius-card)] border border-hairline bg-panel p-4 shadow-[var(--ego-elevation-l1)]"
      >
        <p className="text-sm font-semibold text-ink">Vista previa no disponible</p>
        <p className="mt-1 font-mono text-xs text-dim">{filePath}</p>
        <p className="mt-1 text-xs text-faint">
          {ext === null
            ? "Sin extensión reconocible: solo se previsualizan archivos de texto con extensión conocida."
            : `Extensión .${ext} fuera de la allowlist de texto plano (solo lectura).`}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-1.5 rounded-[var(--radius-card)] border border-hairline bg-panel p-4 shadow-[var(--ego-elevation-l1)]">
      <div className="flex shrink-0 items-center gap-2 text-xs">
        <span className="truncate font-mono text-xs text-dim">{filePath}</span>
        <Badge tone="dim">solo lectura</Badge>
        <span className="shrink-0 font-mono text-xs text-faint">
          {lineCount} líneas
        </span>
      </div>
      <pre
        aria-label={`Vista previa de solo lectura: ${filePath}`}
        data-testid="file-preview-content"
        className="min-h-[240px] flex-1 overflow-auto rounded-[var(--radius-card)] border border-hairline bg-paper p-3 font-mono text-xs leading-relaxed text-ink select-text"
      >
        {preview.text}
      </pre>
      {preview.truncated && (
        <p role="status" className="shrink-0 text-xs text-warning">
          Truncado a vista parcial: se muestran los primeros {preview.text.length} de{" "}
          {preview.totalChars} caracteres.
        </p>
      )}
    </div>
  );
};
