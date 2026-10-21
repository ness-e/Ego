import React, { useState } from "react";
import { Lightbulb, Check, X, ShieldWarning, Sparkle } from "@phosphor-icons/react";
import { Badge } from "../../ui-kit/Badge.js";
import { Button } from "../../ui-kit/Button.js";

export interface RecommendationCardProps {
  props: {
    id: string;
    title: string;
    description: string;
    confidenceScore: number; // 0 a 1
    impactLevel: "low" | "medium" | "high" | "critical";
    suggestedAction: string;
    tradeoffs?: string[];
    whyExplanation?: string;
  };
  onAction?: (actionId: string, payload?: Record<string, unknown>) => void;
}

/** Tono del `Badge` del kit según el nivel de impacto. */
const IMPACT_TONE = {
  low: "dim",
  medium: "info",
  high: "warn",
  critical: "risk",
} as const;

export const RecommendationCard: React.FC<RecommendationCardProps> = ({ props, onAction }) => {
  const [decision, setDecision] = useState<"accepted" | "dismissed" | null>(null);

  const handleAccept = () => {
    setDecision("accepted");
    onAction?.("recommendation.accept", { recommendationId: props.id });
  };

  const handleDismiss = () => {
    setDecision("dismissed");
    onAction?.("recommendation.dismiss", { recommendationId: props.id });
  };

  return (
    <div className="space-y-3 rounded-[var(--radius-card)] border border-hairline bg-panel p-4 shadow-[var(--ego-elevation-l1)] select-text">
      {/* Cabecera */}
      <div className="flex items-center justify-between border-b border-hairline pb-2">
        <div className="flex items-center gap-2">
          <Lightbulb size={16} className="text-warning" weight="bold" />
          <h3 className="text-sm font-semibold text-ink">{props.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {/* Confianza */}
          <span className="font-mono text-xs text-dim">
            Confianza: {Math.round(props.confidenceScore * 100)}%
          </span>
          {/* Impacto */}
          <Badge tone={IMPACT_TONE[props.impactLevel]}>{props.impactLevel}</Badge>
        </div>
      </div>

      {/* Descripción y propuesta */}
      <p className="text-xs leading-relaxed text-ink">{props.description}</p>

      {/* Justificación causal "Why" (P11) */}
      {props.whyExplanation && (
        <div className="rounded-[var(--radius-card)] border border-hairline bg-raised p-2.5 text-xs text-faint">
          <div className="mb-0.5 flex items-center gap-1.5 font-semibold text-dim">
            <Sparkle size={12} className="text-warning" />
            <span>Fundamento del Sub-Ego:</span>
          </div>
          <p>{props.whyExplanation}</p>
        </div>
      )}

      {/* Trade-offs si existen */}
      {props.tradeoffs && props.tradeoffs.length > 0 && (
        <div className="space-y-1 text-xs text-dim">
          <span className="flex items-center gap-1 font-medium text-ink">
            <ShieldWarning size={12} className="text-faint" />
            <span>Trade-offs & Consideraciones:</span>
          </span>
          <ul className="list-inside list-disc space-y-0.5 pl-1 font-mono text-xs">
            {props.tradeoffs.map((t, idx) => (
              <li key={idx}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Botones de decisión interactiva */}
      <div className="flex items-center justify-between border-t border-hairline pt-2 text-xs">
        {decision ? (
          <span className="font-mono text-xs text-dim">
            {decision === "accepted" ? "✓ Recomendación adoptada" : "✗ Recomendación descartada"}
          </span>
        ) : (
          <>
            <Button type="button" variant="ghost" size="sm" onClick={handleDismiss}>
              <X size={12} />
              <span>Descartar</span>
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={handleAccept}>
              <Check size={13} weight="bold" />
              <span>{props.suggestedAction || "Adoptar"}</span>
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
