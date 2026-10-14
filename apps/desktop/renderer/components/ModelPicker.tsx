import { useState, useMemo, memo } from "react";
import { MagnifyingGlass, Check, Sparkle, X, Cpu } from "@phosphor-icons/react";
import { fuzzyRank } from "@ego/ui-runtime";
import { Modal } from "./ui-kit/Modal.js";

export interface ModelOption {
  id: string;
  name: string;
  provider: "anthropic" | "openai" | "google" | "local" | "vantadb";
  contextWindow: string;
  capabilities: Array<"tools" | "reasoning" | "vision" | "fast">;
  description: string;
}

export const CANONICAL_MODELS: ModelOption[] = [
  {
    id: "claude-3-7-sonnet",
    name: "Claude 3.7 Sonnet",
    provider: "anthropic",
    contextWindow: "200k",
    capabilities: ["tools", "reasoning", "vision"],
    description: "Modelo híbrido de razonamiento y código de alta fidelidad.",
  },
  {
    id: "claude-3-5-haiku",
    name: "Claude 3.5 Haiku",
    provider: "anthropic",
    contextWindow: "200k",
    capabilities: ["tools", "fast"],
    description: "Inferencia ultrarrápida para tareas ligeras y streaming continuo.",
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    contextWindow: "128k",
    capabilities: ["tools", "vision", "fast"],
    description: "Modelo multimodal estándar de OpenAI con soporte robusto de tools.",
  },
  {
    id: "o3-mini",
    name: "o3-mini",
    provider: "openai",
    contextWindow: "200k",
    capabilities: ["tools", "reasoning"],
    description: "Razonamiento matemático y algorítmico profundo.",
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    provider: "google",
    contextWindow: "1M",
    capabilities: ["tools", "reasoning", "vision"],
    description: "Modelo Flash estable vigente (2.x retirado por Google).",
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    provider: "google",
    contextWindow: "1M",
    capabilities: ["tools", "fast"],
    description: "Inferencia ágil para router y clasificación de intenciones.",
  },
  {
    id: "qwen-2.5-coder-32b",
    name: "Qwen 2.5 Coder 32B (Local)",
    provider: "local",
    contextWindow: "32k",
    capabilities: ["tools", "reasoning"],
    description: "Ejecución local privada sin telemetría vía vLLM u Ollama.",
  },
  {
    id: "vantadb-hybrid-reranker",
    name: "VantaDB BM25 + ONNX Hybrid",
    provider: "vantadb",
    contextWindow: "64k",
    capabilities: ["fast"],
    description: "Motor in-process de reranking léxico y denso soberano.",
  },
];

export interface ModelPickerProps {
  isOpen: boolean;
  activeModelId?: string;
  onClose: () => void;
  onSelectModel: (model: ModelOption) => void;
}

/**
 * T07 (UI-04): sobre ui-kit `Modal` (Radix Dialog — trap de foco + Escape +
 * `role="dialog"` + `aria-modal` nativos). Opciones como `<button>`
 * `role="option"` (activables por teclado) y buscador con `aria-label`.
 */
export const ModelPicker = memo(function ModelPicker({
  isOpen,
  activeModelId = "claude-3-7-sonnet",
  onClose,
  onSelectModel,
}: ModelPickerProps) {
  const [search, setSearch] = useState("");

  const rankedModels = useMemo(() => {
    return fuzzyRank(CANONICAL_MODELS, search, (m) => `${m.id} ${m.name} ${m.provider} ${m.description}`);
  }, [search]);

  return (
    <Modal
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Selector de Modelos"
      description="Model Router · Multi-Provider · Esc para salir"
    >
      {/* Buscador */}
      <div className="flex items-center gap-2 border-b border-hairline px-1 pb-2.5">
        <MagnifyingGlass size={15} className="text-faint shrink-0" aria-hidden />
        <input
          type="text"
          autoFocus
          aria-label="Buscar modelo por nombre, proveedor o capacidad"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar modelo o proveedor (ej: sonnet, 4o, local, 1M)…"
          className="flex-1 bg-transparent text-xs text-ink placeholder:text-faint focus:outline-none"
        />
        {search && (
          <button
            type="button"
            aria-label="Limpiar búsqueda de modelos"
            onClick={() => setSearch("")}
            className="rounded p-1 text-faint hover:text-ink hover:bg-raised transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Lista de modelos */}
      <div role="listbox" aria-label="Modelos disponibles" className="divide-y divide-hairline">
        {rankedModels.length === 0 ? (
          <div className="p-8 text-center text-faint">
            No se encontraron modelos para &quot;{search}&quot;
          </div>
        ) : (
          rankedModels.map(({ item }) => {
            const isSelected = item.id === activeModelId;
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onSelectModel(item);
                  onClose();
                }}
                className={`flex w-full items-start justify-between p-3 cursor-pointer transition-colors text-left ${
                  isSelected ? "bg-raised/80" : "hover:bg-raised/40"
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0 pr-2">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-hairline bg-panel text-faint">
                    {item.provider === "local" ? <Cpu size={13} /> : <Sparkle size={13} />}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink truncate">{item.name}</span>
                      <span className="rounded bg-panel px-1 py-0.2 text-[9px] font-mono text-faint border border-hairline uppercase">
                        {item.provider}
                      </span>
                      <span className="text-[10px] text-faint font-mono">
                        {item.contextWindow}
                      </span>
                    </div>

                    <p className="mt-0.5 text-[11px] text-faint leading-snug line-clamp-2">
                      {item.description}
                    </p>

                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {item.capabilities.map((cap) => (
                        <span
                          key={cap}
                          className="rounded bg-raised/70 px-1.5 py-0.2 text-[9px] font-mono text-dim border border-hairline/60"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-1 shrink-0 text-brand">
                    <Check size={16} weight="bold" />
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </Modal>
  );
});
