import React, { useState } from "react";
import { Question, Database, ShieldCheck } from "@phosphor-icons/react";
import type { ComponentMetadata } from "@ego/ui-runtime";
import { Modal } from "../ui-kit/Modal.js";

export interface WhyButtonProps {
  why?: ComponentMetadata["why"];
  title?: string;
  className?: string;
}

export const WhyButton: React.FC<WhyButtonProps> = ({
  why,
  title = "Explicabilidad de la Decisión",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!why) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-dim hover:text-ink bg-raised hover:bg-hairline border border-hairline transition-colors ${className}`}
        title="¿Por qué este componente o decisión?"
      >
        <Question size={11} weight="bold" className="text-amber-400" />
        <span>¿Por qué?</span>
      </button>

      <Modal
        open={isOpen}
        onOpenChange={setIsOpen}
        title={title}
        description="Tres niveles de explicabilidad de la decisión."
      >
        {/* Niveles de Explicabilidad (Decisión P11) */}
        <div className="space-y-3 text-xs">
          {/* Nivel 1: Causa Directa */}
          <div className="rounded-lg bg-raised p-3 border border-hairline">
            <div className="flex items-center gap-1.5 font-semibold text-ink mb-1">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              <span>Nivel 1: Causa Directa</span>
            </div>
            <p className="text-dim leading-relaxed">
              {why.directCause || "Decisión autónoma sugerida para resolver la intención activa."}
            </p>
          </div>

          {/* Nivel 2: Fuentes y Memoria VantaDB */}
          <div className="rounded-lg bg-raised p-3 border border-hairline">
            <div className="flex items-center gap-1.5 font-semibold text-ink mb-1">
              <Database size={13} className="text-emerald-400" />
              <span>Nivel 2: Fuentes y Memoria VantaDB</span>
            </div>
            {why.vantaSources && why.vantaSources.length > 0 ? (
              <ul className="list-disc list-inside space-y-0.5 text-dim font-mono text-[11px] pl-1">
                {why.vantaSources.map((source, idx) => (
                  <li key={idx} className="truncate">
                    {source}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-faint text-[11px]">Sin fuentes específicas vinculadas.</p>
            )}
          </div>

          {/* Nivel 3: Trazabilidad Técnica */}
          <div className="rounded-lg bg-raised p-3 border border-hairline">
            <div className="flex items-center gap-1.5 font-semibold text-ink mb-1">
              <ShieldCheck size={13} className="text-amber-400" />
              <span>Nivel 3: Auditoría & Telemetría</span>
            </div>
            <p className="text-dim font-mono text-[10px] break-all">
              {why.auditTrace || "audit:trace:verified:vanta-l0-l3:auto"}
            </p>
          </div>
        </div>

        {/* Pie */}
        <div className="flex justify-end pt-3 border-t border-hairline">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-3 py-1 rounded bg-raised text-xs text-ink hover:bg-hairline transition-colors"
          >
            Cerrar
          </button>
        </div>
      </Modal>
    </>
  );
};
