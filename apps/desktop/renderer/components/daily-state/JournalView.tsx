import { useState, useEffect, useRef } from "react";
import { BookBookmark, FloppyDisk, Sparkle, Eye, PencilSimple } from "@phosphor-icons/react";
import { Button } from "../ui-kit/Button.js";
import { Textarea } from "../ui-kit/Textarea.js";

export interface JournalViewProps {
  date: string;
  initialContent?: string;
  onSave: (date: string, content: string) => Promise<void>;
  onInsertDailyDecisions?: () => Promise<string>;
}

export function JournalView({
  date,
  initialContent = "",
  onSave,
  onInsertDailyDecisions,
}: JournalViewProps) {
  const [content, setContent] = useState(initialContent);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [previewMode, setPreviewMode] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  // T12: cleanup del debounce al desmontar (nunca setState post-unmount).
  useEffect(
    () => () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    },
    []
  );

  const handleChange = (newVal: string) => {
    setContent(newVal);
    setSaveStatus("unsaved");

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await onSave(date, newVal);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("unsaved");
      }
    }, 600);
  };

  const handleManualSave = async () => {
    // T12: el guardado manual cancela el debounce pendiente (evita doble save).
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setSaveStatus("saving");
    try {
      await onSave(date, content);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("unsaved");
    }
  };

  const handleInsertDecisions = async () => {
    if (!onInsertDailyDecisions) return;
    try {
      const markdown = await onInsertDailyDecisions();
      const updated = content ? `${content}\n\n### Decisiones del día\n${markdown}` : `### Decisiones del día\n${markdown}`;
      handleChange(updated);
    } catch (err) {
      console.warn("[JournalView] Error al insertar decisiones:", err);
    }
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-[var(--radius-card)] border border-hairline bg-panel p-4 shadow-[var(--ego-elevation-l1)]">
      <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <BookBookmark size={16} className="text-dim shrink-0" />
          <h3 className="text-sm font-semibold text-ink truncate">
            Journal Personal & Notas ({date})
          </h3>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Toggle de Modo Edición / Vista Previa Markdown */}
          <div className="flex items-center gap-0.5 rounded-[var(--radius-card)] border border-hairline bg-panel p-0.5">
            <Button
              size="md"
              variant={!previewMode ? "secondary" : "ghost"}
              onClick={() => setPreviewMode(false)}
              title="Modo Edición"
              aria-pressed={!previewMode}
            >
              <PencilSimple size={12} />
              <span>Editar</span>
            </Button>
            <Button
              size="md"
              variant={previewMode ? "secondary" : "ghost"}
              onClick={() => setPreviewMode(true)}
              title="Vista Previa Markdown"
              aria-pressed={previewMode}
            >
              <Eye size={12} />
              <span>Preview</span>
            </Button>
          </div>

          {onInsertDailyDecisions && (
            <Button
              size="md"
              variant="secondary"
              onClick={handleInsertDecisions}
              title="Insertar decisiones acordadas en el texto"
            >
              <Sparkle size={12} className="text-brand" />
              <span>Decisiones</span>
            </Button>
          )}

          <Button
            size="md"
            variant="ghost"
            onClick={handleManualSave}
            disabled={saveStatus === "saving"}
          >
            <FloppyDisk size={12} />
            <span>{saveStatus === "saving" ? "Guardando..." : saveStatus === "unsaved" ? "Modificado" : "Guardado"}</span>
          </Button>
        </div>
      </div>

      {previewMode ? (
        <div className="w-full h-36 overflow-y-auto rounded-[var(--radius-card)] border border-hairline bg-panel p-3 font-mono text-xs text-ink leading-relaxed select-text space-y-1">
          {content.trim() ? (
            content.split("\n").map((line, i) => {
              if (line.startsWith("### ")) return <h4 key={i} className="font-bold text-ink text-xs mt-1.5">{line.slice(4)}</h4>;
              if (line.startsWith("## ")) return <h3 key={i} className="font-bold text-ink text-sm mt-1.5">{line.slice(3)}</h3>;
              if (line.startsWith("# ")) return <h2 key={i} className="font-bold text-ink text-base mt-2">{line.slice(2)}</h2>;
              if (line.startsWith("- ") || line.startsWith("* ")) return <li key={i} className="ml-4 list-disc text-dim">{line.slice(2)}</li>;
              if (!line.trim()) return <div key={i} className="h-1" />;
              return <p key={i} className="text-dim">{line}</p>;
            })
          ) : (
            <span className="italic text-faint">Sin notas registradas para la jornada. Cambia a 'Editar' para escribir.</span>
          )}
        </div>
      ) : (
        <Textarea
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Escribe tus notas, prioridades o reflexiones de la jornada en Markdown..."
          rows={8}
          className="h-36 resize-y font-mono"
        />
      )}
    </div>
  );
}
