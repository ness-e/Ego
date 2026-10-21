import { useState, useMemo, useEffect, memo } from "react";
import { MagnifyingGlass, Check, Sparkle, X, Cpu } from "@phosphor-icons/react";
import { fuzzyRank } from "@ego/ui-runtime";
import { Modal } from "./ui-kit/Modal.js";
import { Input } from "./ui-kit/Input.js";
import { Button } from "./ui-kit/Button.js";
import { Badge } from "./ui-kit/Badge.js";
import { ego, type CatalogProviderId } from "../lib/ego.js";

export type ModelOptionProvider = "anthropic" | "openai" | "google" | "deepseek" | "local" | "mock" | "vantadb";

export interface ModelOption {
  id: string;
  name: string;
  provider: ModelOptionProvider;
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
 * T15: al abrir carga el catálogo live (`ipc.models.*`, `refresh:true`) y
 * fusiona los IDs live no curados; cualquier fallo → CANONICAL_MODELS.
 */
export const ModelPicker = memo(function ModelPicker({
  isOpen,
  activeModelId = "claude-3-7-sonnet",
  onClose,
  onSelectModel,
}: ModelPickerProps) {
  const [search, setSearch] = useState("");
  const [liveModels, setLiveModels] = useState<ModelOption[] | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const bridge = ego();
        const provRes = await bridge.models.listProviders();
        const configured = (provRes.providers ?? []).filter((p) => p.configured && p.id !== "mock");
        const settled = await Promise.all(
          configured.map(async (p) => {
            try {
              const r = await bridge.models.listModels({
                provider: p.id as CatalogProviderId,
                refresh: true,
              });
              return { provider: p.id, models: r.models ?? [] };
            } catch {
              return { provider: p.id, models: [] as string[] };
            }
          })
        );
        if (cancelled) return;
        const seen = new Set(CANONICAL_MODELS.map((m) => m.id));
        const extra: ModelOption[] = [];
        for (const { provider, models } of settled) {
          for (const id of models) {
            if (seen.has(id)) continue;
            seen.add(id);
            extra.push({
              id,
              name: id,
              provider: provider === "ollama" ? "local" : (provider as ModelOptionProvider),
              contextWindow: "live",
              capabilities: ["tools"],
              description: `Modelo live de ${provider} (catálogo de la API).`,
            });
          }
        }
        if (extra.length > 0) setLiveModels(extra);
      } catch {
        // Fallback curado intacto: el picker nunca queda vacío.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const allModels = useMemo(
    () => (liveModels ? [...liveModels, ...CANONICAL_MODELS] : CANONICAL_MODELS),
    [liveModels]
  );

  const rankedModels = useMemo(() => {
    return fuzzyRank(allModels, search, (m) => `${m.id} ${m.name} ${m.provider} ${m.description}`);
  }, [search, allModels]);

  return (
    <Modal
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Selector de Modelos"
      description="Model Router · Multi-Provider · Esc para salir"
    >
      {/* Buscador: `Input` del kit (borde `border-strong` + anillo de marca).
          Antes era un subrayado `border-b border-hairline`: el input más débil
          de la app (≈1.1:1 de contraste, sin segundo indicador). */}
      <div className="flex items-center gap-2">
        <MagnifyingGlass size={15} className="shrink-0 text-faint" aria-hidden />
        <Input
          type="text"
          aria-label="Buscar modelo por nombre, proveedor o capacidad"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar modelo o proveedor (ej: sonnet, 4o, local, 1M)…"
        />
        {search && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Limpiar búsqueda de modelos"
            onClick={() => setSearch("")}
          >
            <X size={14} />
          </Button>
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
              // Opción de listbox: el kit no tiene primitive listbox/option y
              // el `<button role="option">` es lo que exige el patrón ARIA.
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onSelectModel(item);
                  onClose();
                }}
                className={`flex w-full cursor-pointer items-start justify-between p-3 text-left transition-colors ${
                  isSelected ? "bg-raised" : "hover:bg-raised"
                }`}
              >
                <div className="flex min-w-0 items-start gap-2.5 pr-2">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-hairline bg-panel text-faint">
                    {item.provider === "local" ? <Cpu size={13} /> : <Sparkle size={13} />}
                  </div>

                  <div className="flex min-w-0 flex-col">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-ink">{item.name}</span>
                      <Badge tone="dim" className="uppercase">
                        {item.provider}
                      </Badge>
                      <span className="font-mono text-xs text-faint">
                        {item.contextWindow}
                      </span>
                    </div>

                    <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-faint">
                      {item.description}
                    </p>

                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {item.capabilities.map((cap) => (
                        <Badge key={cap} tone="dim">
                          {cap}
                        </Badge>
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
