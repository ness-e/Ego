import { useState, useEffect, useRef } from "react";
import { BookBookmark, FloppyDisk, Sparkle } from "@phosphor-icons/react";

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
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

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
    <div className="flex flex-col gap-2 rounded-lg border border-hairline bg-raised/30 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookBookmark size={16} className="text-dim" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink">
            Journal Personal & Notas ({date})
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {onInsertDailyDecisions && (
            <button
              onClick={handleInsertDecisions}
              className="flex items-center gap-1 rounded bg-raised px-2 py-0.5 text-[10px] font-medium text-ink border border-hairline hover:bg-panel hover:text-ink transition-colors"
              title="Insertar decisiones acordadas en el texto"
            >
              <Sparkle size={11} className="text-amber-400" />
              Anexar Decisiones
            </button>
          )}

          <button
            onClick={handleManualSave}
            disabled={saveStatus === "saving"}
            className="flex items-center gap-1 rounded bg-raised px-2 py-0.5 text-[10px] font-mono text-dim hover:text-ink transition-colors"
          >
            <FloppyDisk size={11} />
            {saveStatus === "saving" ? "Guardando..." : saveStatus === "unsaved" ? "Modificado" : "Guardado"}
          </button>
        </div>
      </div>

      <textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Escribe tus notas, prioridades o reflexiones de la jornada en Markdown..."
        className="w-full h-36 resize-y rounded border border-hairline bg-panel p-2.5 font-mono text-xs text-ink placeholder:text-faint focus:outline-none focus:border-dim"
      />
    </div>
  );
}
