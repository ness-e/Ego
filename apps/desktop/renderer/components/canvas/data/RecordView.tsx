import React, { useMemo, useState } from "react";
import type { RecordViewProps } from "@ego/ui-runtime";
import { Database, ClockCounterClockwise, ChatCircleDots } from "@phosphor-icons/react";
import { useSelectionContext } from "../../../hooks/useSelectionContext.js";
import { Badge } from "../../ui-kit/Badge.js";
import { Button } from "../../ui-kit/Button.js";
import { Tabs, type KitTab } from "../../ui-kit/Tabs.js";

interface RecordViewComponentProps {
  props: RecordViewProps;
  onAction?: (actionId: string, payload?: Record<string, unknown>) => void;
}

type RecordTab = "content" | "chunks" | "metadata" | "lineage";

/** Tono del `Badge` del kit según el estado del registro. */
const STATE_TONE = {
  active: "ok",
  quarantined: "warn",
  superseded: "dim",
} as const;

const STATE_LABEL = {
  active: "Activo",
  quarantined: "En Cuarentena",
  superseded: "Sustituido (Histórico)",
} as const;

export const RecordView: React.FC<RecordViewComponentProps> = ({ props }) => {
  const [activeTab, setActiveTab] = useState<RecordTab>("content");
  const { sendSelectionToChat } = useSelectionContext();

  const state = props.state || "active";

  const handleAskSubEgo = () => {
    const summary = `Sobre el registro [${props.recordKey}] (${props.namespace}):\n${props.payload}`;
    sendSelectionToChat(summary);
  };

  const tabs: KitTab[] = useMemo(() => {
    const list: KitTab[] = [
      {
        value: "content",
        label: "Contenido Principal",
        content: (
          <div className="whitespace-pre-wrap rounded-[var(--radius-card)] border border-hairline bg-raised p-3 font-sans text-xs font-normal leading-relaxed text-ink">
            {props.payload}
          </div>
        ),
      },
    ];

    if (props.chunks && props.chunks.length > 0) {
      list.push({
        value: "chunks",
        label: `Fragmentos (${props.chunks.length})`,
        content: (
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {props.chunks.map((chunk) => (
              <div
                key={chunk.id}
                className="rounded-[var(--radius-card)] border border-hairline bg-raised p-2.5 text-xs"
              >
                <div className="mb-1 flex items-center justify-between font-mono text-xs text-dim">
                  <span>
                    Chunk #{chunk.index} {chunk.tokenCount ? `(${chunk.tokenCount} tokens)` : ""}
                  </span>
                  {chunk.headingPath && chunk.headingPath.length > 0 && (
                    <span className="max-w-[200px] truncate text-brand">
                      {chunk.headingPath.join(" > ")}
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap font-sans text-ink">{chunk.content}</p>
              </div>
            ))}
          </div>
        ),
      });
    }

    if (props.metadata && Object.keys(props.metadata).length > 0) {
      list.push({
        value: "metadata",
        label: "Metadatos",
        content: (
          <div className="grid grid-cols-2 gap-2 rounded-[var(--radius-card)] border border-hairline bg-raised p-3 font-mono text-xs">
            {Object.entries(props.metadata || {}).map(([key, value]) => (
              <div key={key} className="flex flex-col truncate">
                <span className="text-xs uppercase text-dim">{key}</span>
                <span className="truncate font-medium text-ink">
                  {typeof value === "object" ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        ),
      });
    }

    if (props.lineage && props.lineage.length > 0) {
      list.push({
        value: "lineage",
        label: "Linaje Causal",
        content: (
          <div className="max-h-60 space-y-1.5 overflow-y-auto">
            {props.lineage.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-[var(--radius-card)] border border-hairline bg-raised px-3 py-1.5 font-mono text-xs"
              >
                <div className="flex items-center gap-2">
                  <ClockCounterClockwise size={13} className="text-brand" />
                  <span className="text-xs uppercase text-dim">{item.relation}</span>
                  <span className="font-semibold text-ink">{item.targetKey}</span>
                </div>
                {item.timestamp && (
                  <span className="text-xs text-faint">
                    {new Date(item.timestamp).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        ),
      });
    }

    return list;
  }, [props]);

  // Si la pestaña activa deja de estar disponible (props cambiadas), se
  // vuelve a "content" en vez de dejar el panel vacío.
  const activeValue: RecordTab = tabs.some((t) => t.value === activeTab) ? activeTab : "content";

  return (
    <div className="rounded-[var(--radius-card)] border border-hairline bg-panel p-4 shadow-[var(--ego-elevation-l1)] select-text">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3 border-b border-hairline pb-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-[var(--radius-card)] border border-hairline bg-raised p-2 text-brand">
            <Database size={18} weight="duotone" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-ink">{props.title}</h3>
              <Badge tone={STATE_TONE[state]}>{STATE_LABEL[state]}</Badge>
              {typeof props.confidence === "number" && (
                <Badge tone="info">{(props.confidence * 100).toFixed(0)}% confianza</Badge>
              )}
            </div>
            <p className="mt-0.5 font-mono text-xs text-faint">
              {props.namespace} / <span className="text-ink">{props.recordKey}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button type="button" variant="secondary" size="sm" onClick={handleAskSubEgo}>
            <ChatCircleDots size={14} weight="bold" className="text-brand" />
            <span>Consultar</span>
          </Button>
        </div>
      </div>

      {/* Navegación por pestañas (kit Radix: roles tablist/tab/tabpanel) */}
      <Tabs
        tabs={tabs}
        value={activeValue}
        onValueChange={(v) => setActiveTab(v as RecordTab)}
        ariaLabel="Detalle del registro"
      />
    </div>
  );
};
