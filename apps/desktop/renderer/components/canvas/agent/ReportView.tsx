import React from "react";
import { FileText, CheckCircle, WarningCircle, Info } from "@phosphor-icons/react";

export interface ReportMetric {
  label: string;
  value: string | number;
  change?: string;
  status?: "positive" | "negative" | "neutral";
}

export interface ReportSection {
  title: string;
  content: string;
  type?: "text" | "bullet" | "alert";
  alertVariant?: "info" | "warning" | "success";
}

export interface ReportViewProps {
  props: {
    id: string;
    title: string;
    summary: string;
    authorSubEgo?: string;
    metrics?: ReportMetric[];
    sections: ReportSection[];
    timestamp?: number;
  };
  onAction?: (actionId: string, payload?: Record<string, unknown>) => void;
}

export const ReportView: React.FC<ReportViewProps> = ({ props, onAction: _onAction }) => {
  return (
    <div className="space-y-4 rounded-[var(--radius-card)] border border-hairline bg-panel p-4 shadow-[var(--ego-elevation-l1)] select-text">
      {/* Cabecera */}
      <div className="flex items-center justify-between border-b border-hairline pb-3">
        <div className="flex items-center gap-2.5">
          <FileText size={18} className="text-brand" />
          <div>
            <h3 className="text-sm font-semibold text-ink">{props.title}</h3>
            {props.authorSubEgo && (
              <span className="font-mono text-xs text-faint">
                Generado por: {props.authorSubEgo}
              </span>
            )}
          </div>
        </div>
        {props.timestamp && (
          <span className="font-mono text-xs text-faint">
            {new Date(props.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* Resumen Ejecutivo */}
      <p className="rounded-[var(--radius-card)] border border-hairline bg-paper p-3 text-xs leading-relaxed text-ink">
        {props.summary}
      </p>

      {/* Métricas KPI si existen */}
      {props.metrics && props.metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-2 pt-1 md:grid-cols-4">
          {props.metrics.map((m, idx) => (
            <div key={idx} className="rounded-[var(--radius-card)] border border-hairline bg-raised p-2.5">
              <span className="block truncate text-xs font-medium text-dim">{m.label}</span>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-sm font-semibold text-ink">{m.value}</span>
                {m.change && (
                  <span
                    className={`font-mono text-xs ${
                      m.status === "positive"
                        ? "text-success"
                        : m.status === "negative"
                        ? "text-error"
                        : "text-dim"
                    }`}
                  >
                    {m.change}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Secciones del Informe */}
      <div className="space-y-3 pt-2">
        {props.sections.map((sec, idx) => (
          <div
            key={idx}
            className="rounded-[var(--radius-card)] border border-hairline bg-raised p-3"
          >
            <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ink">
              {sec.alertVariant === "warning" ? (
                <WarningCircle size={14} className="text-warning" />
              ) : sec.alertVariant === "success" ? (
                <CheckCircle size={14} className="text-success" />
              ) : (
                <Info size={14} className="text-brand" />
              )}
              <span>{sec.title}</span>
            </h4>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-dim">{sec.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
