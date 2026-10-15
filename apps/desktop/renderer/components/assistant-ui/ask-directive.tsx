import { useState, useCallback, memo } from "react";

const settledDirectives = new Set<string>();

export interface AskDirectiveProps {
  question: string;
  options: string[] | string;
  directiveId?: string;
  streaming?: boolean;
  onSelect?: (value: string) => void;
}

/**
 * AskDirective — Componente de Human-in-the-Loop interactivo incrustado en el chat.
 * Extraído y adaptado de Hermes Agent (HERM-03) para Ego SOC.
 *
 * Muestra chips de opciones para preguntas de clarificación o confirmaciones rápidas.
 * Al seleccionar una opción, se marca como resuelta para evitar respuestas duplicadas.
 */
export const AskDirective = memo(function AskDirective({
  question,
  options: rawOptions,
  directiveId = "",
  streaming = false,
  onSelect,
}: AskDirectiveProps) {
  const options = Array.isArray(rawOptions)
    ? rawOptions
    : String(rawOptions || "")
        .split("|")
        .map((opt) => opt.trim())
        .filter(Boolean);

  const identityKey = directiveId || question.trim();
  const [picked, setPicked] = useState<string | null>(() =>
    identityKey && settledDirectives.has(identityKey) ? "" : null
  );

  const isClosed = picked !== null;

  const handleSelect = useCallback(
    (option: string) => {
      if (isClosed || streaming) return;

      if (identityKey) {
        settledDirectives.add(identityKey);
      }
      setPicked(option);

      if (onSelect) {
        onSelect(option);
      } else {
        // Fallback: Si no hay handler explícito, enviar al bus de Ego si está disponible
        const egoGlobal = (
          window as unknown as { ego?: { sendChatMessage?: (msg: string) => void } }
        ).ego;
        if (typeof egoGlobal?.sendChatMessage === "function") {
          egoGlobal.sendChatMessage(option);
        }
      }
    },
    [isClosed, streaming, identityKey, onSelect]
  );

  if (!question || options.length === 0) {
    return null;
  }

  return (
    <div
      className="my-3 flex flex-col gap-2 rounded-lg border border-hairline bg-panel p-3 text-xs"
      data-ego-directive="ask"
    >
      <div className="font-medium text-ink flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-brand" />
        <span>{question}</span>
      </div>

      <div className="flex flex-wrap gap-1.5 pt-1">
        {options.map((option) => {
          const isSelected = picked === option;
          return (
            <button
              key={option}
              type="button"
              disabled={isClosed || streaming}
              onClick={() => handleSelect(option)}
              className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                isSelected
                  ? "border-brand bg-brand text-paper font-semibold shadow-xs"
                  : isClosed
                  ? "border-hairline text-faint opacity-50 cursor-not-allowed"
                  : "border-hairline bg-raised text-ink hover:border-dim hover:bg-panel cursor-pointer"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
});
