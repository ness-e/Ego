import React from "react";
import type { CardProps } from "@ego/ui-runtime";
import { Badge } from "../ui-kit/Badge.js";
import { Button } from "../ui-kit/Button.js";

interface CardViewProps {
  props: CardProps;
  onAction?: (actionId: string, payload?: Record<string, unknown>) => void;
}

/**
 * Traduce el `variant` declarativo del contrato (`@ego/ui-runtime`) al
 * `variant` del `Button` del kit. El kit es la única fuente de estilos de
 * botón (D3: primitives de librería/proyecto siempre, nunca reimplementar).
 */
function actionVariant(
  variant: "default" | "primary" | "danger" | "outline"
): "primary" | "secondary" | "danger" {
  if (variant === "primary") return "primary";
  if (variant === "danger") return "danger";
  return "secondary";
}

export const CardView: React.FC<CardViewProps> = ({ props, onAction }) => {
  return (
    <div className="rounded-[var(--radius-card)] border border-hairline bg-panel p-4 shadow-[var(--ego-elevation-l1)] select-text">
      {/* Header */}
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-ink">{props.title}</h3>
            {props.badge && <Badge tone="info">{props.badge}</Badge>}
            {props.status && <Badge tone="ok">{props.status}</Badge>}
          </div>
          {props.subtitle && <p className="mt-0.5 text-xs text-faint">{props.subtitle}</p>}
        </div>
      </div>

      {/* Description */}
      {props.description && (
        <p className="mb-3 text-xs leading-relaxed text-faint">{props.description}</p>
      )}

      {/* Content: Fields */}
      {props.content?.fields && (
        <div className="my-3 grid grid-cols-2 gap-2 rounded-[var(--radius-card)] border border-hairline bg-raised p-2.5 font-mono text-xs">
          {Object.entries(props.content.fields).map(([key, value]) => (
            <div key={key} className="flex flex-col">
              <span className="text-xs uppercase tracking-wider text-dim">{key}</span>
              <span className="truncate font-semibold text-ink">
                {value !== null && value !== undefined ? String(value) : "—"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Content: Markdown text */}
      {props.content?.markdown && (
        <div className="my-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-ink">
          {props.content.markdown}
        </div>
      )}

      {/* Actions */}
      {props.actions && props.actions.length > 0 && (
        <div className="mt-3 flex items-center justify-end gap-2 border-t border-hairline pt-3">
          {props.actions.map((act) => (
            <Button
              key={act.actionId}
              variant={actionVariant(act.variant)}
              size="sm"
              onClick={() => onAction?.(act.actionId, act.payload || { cardId: props.id })}
            >
              {act.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};
