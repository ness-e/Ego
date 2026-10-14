import React, { useState } from "react";
import { Lightbulb, Check, X, ShieldWarning, Sparkle } from "@phosphor-icons/react";

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

  const impactColors = {
    low: "text-faint bg-raised/50 border-hairline",
    medium: "text-cyan-300 bg-cyan-950/40 border-cyan-800/40",
    high: "text-amber-300 bg-amber-950/40 border-amber-800/40",
    critical: "text-rose-300 bg-rose-950/40 border-rose-800/40",
  };

  return (
    <div className="rounded-xl border border-hairline bg-panel p-4 shadow-xs select-text space-y-3">
      {/* Cabecera */}
      <div className="flex items-center justify-between pb-2 border-b border-hairline">
        <div className="flex items-center gap-2">
          <Lightbulb size={16} className="text-amber-400" weight="bold" />
          <h3 className="font-semibold text-sm text-ink">{props.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {/* Confianza */}
          <span className="text-[11px] font-mono text-dim">
            Confianza: {Math.round(props.confidenceScore * 100)}%
          </span>
          {/* Impacto */}
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${
              impactColors[props.impactLevel]
            }`}
          >
            {props.impactLevel}
          </span>
        </div>
      </div>

      {/* Descripción y propuesta */}
      <p className="text-xs text-ink/90 leading-relaxed">{props.description}</p>

      {/* Justificación causal "Why" (P11) */}
      {props.whyExplanation && (
        <div className="rounded-lg bg-raised p-2.5 border border-hairline text-[11px] text-faint">
          <div className="flex items-center gap-1.5 font-semibold text-dim mb-0.5">
            <Sparkle size={12} className="text-amber-400" />
            <span>Fundamento del Sub-Ego:</span>
          </div>
          <p>{props.whyExplanation}</p>
        </div>
      )}

      {/* Trade-offs si existen */}
      {props.tradeoffs && props.tradeoffs.length > 0 && (
        <div className="text-[11px] text-dim space-y-1">
          <span className="font-medium text-ink flex items-center gap-1">
            <ShieldWarning size={12} className="text-faint" />
            <span>Trade-offs & Consideraciones:</span>
          </span>
          <ul className="list-disc list-inside space-y-0.5 pl-1 font-mono text-[10px]">
            {props.tradeoffs.map((t, idx) => (
              <li key={idx}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Botones de decisión interactiva */}
      <div className="flex items-center justify-between pt-2 border-t border-hairline text-xs">
        {decision ? (
          <span className="font-mono text-[11px] text-dim">
            {decision === "accepted" ? "✓ Recomendación adoptada" : "✗ Recomendación descartada"}
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={handleDismiss}
              className="px-2.5 py-1 rounded border border-hairline text-dim hover:text-ink hover:bg-raised transition-colors flex items-center gap-1"
            >
              <X size={12} />
              <span>Descartar</span>
            </button>
            <button
              type="button"
              onClick={handleAccept}
              className="px-3 py-1 rounded bg-ink text-paper font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5"
            >
              <Check size={13} weight="bold" />
              <span>{props.suggestedAction || "Adoptar"}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
