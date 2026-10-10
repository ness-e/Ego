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
    <div className="rounded-xl border border-hairline bg-panel p-5 shadow-xs select-text space-y-4">
      {/* Cabecera */}
      <div className="flex items-center justify-between pb-3 border-b border-hairline">
        <div className="flex items-center gap-2.5">
          <FileText size={18} className="text-cyan-400" />
          <div>
            <h3 className="font-semibold text-sm text-ink">{props.title}</h3>
            {props.authorSubEgo && (
              <span className="font-mono text-[10px] text-faint">
                Generado por: {props.authorSubEgo}
              </span>
            )}
          </div>
        </div>
        {props.timestamp && (
          <span className="text-[10px] text-faint font-mono">
            {new Date(props.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* Resumen Ejecutivo */}
      <p className="text-xs text-ink/90 leading-relaxed bg-paper/60 p-3 rounded-lg border border-hairline">
        {props.summary}
      </p>

      {/* Métricas KPI si existen */}
      {props.metrics && props.metrics.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
          {props.metrics.map((m, idx) => (
            <div key={idx} className="bg-raised p-2.5 rounded-lg border border-hairline">
              <span className="text-[10px] text-dim block font-medium truncate">{m.label}</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-semibold text-sm text-ink">{m.value}</span>
                {m.change && (
                  <span
                    className={`text-[10px] font-mono ${
                      m.status === "positive"
                        ? "text-emerald-400"
                        : m.status === "negative"
                        ? "text-rose-400"
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
          <div key={idx} className="rounded-lg bg-raised/30 p-3 border border-hairline">
            <h4 className="font-semibold text-xs text-ink mb-1 flex items-center gap-1.5">
              {sec.alertVariant === "warning" ? (
                <WarningCircle size={14} className="text-amber-400" />
              ) : sec.alertVariant === "success" ? (
                <CheckCircle size={14} className="text-emerald-400" />
              ) : (
                <Info size={14} className="text-cyan-400" />
              )}
              <span>{sec.title}</span>
            </h4>
            <p className="text-xs text-dim leading-relaxed whitespace-pre-wrap">{sec.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
