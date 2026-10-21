import React, { useState } from "react";
import { Question, Database, ShieldCheck } from "@phosphor-icons/react";
import type { ComponentMetadata } from "@ego/ui-runtime";
import { Modal } from "../ui-kit/Modal.js";
import { Button } from "../ui-kit/Button.js";

export interface WhyButtonProps {
  why?: ComponentMetadata["why"];
  title?: string;
  className?: string;
}

/**
 * Botón de explicabilidad contextual («¿Por qué?»).
 *
 * FASE 1 (design system): el control pasa por el `Button` del kit (9 estados +
 * anillo de foco visible) y las tarjetas de nivel usan los tokens canónicos
 * (radio del sistema, escala tipográfica de 3 tamaños).
 */
export const WhyButton: React.FC<WhyButtonProps> = ({
  why,
  title = "Explicabilidad de la Decisión",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!why) return null;

  return (
    <>
      <Button
        size="md"
        variant="secondary"
        icon={<Question size={12} weight="bold" className="text-brand" />}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={className}
        title="¿Por qué este componente o decisión?"
      >
        ¿Por qué?
      </Button>

      <Modal
        open={isOpen}
        onOpenChange={setIsOpen}
        title={title}
        description="Tres niveles de explicabilidad de la decisión."
      >
        {/* Niveles de Explicabilidad (Decisión P11) */}
        <div className="space-y-3 text-xs">
          {/* Nivel 1: Causa Directa */}
          <div className="rounded-[var(--radius-card)] bg-raised p-3 border border-hairline">
            <div className="flex items-center gap-1.5 font-semibold text-ink mb-1">
              <span className="h-2 w-2 rounded-full bg-brand" />
              <span>Nivel 1: Causa Directa</span>
            </div>
            <p className="text-dim leading-relaxed">
              {why.directCause || "Decisión autónoma sugerida para resolver la intención activa."}
            </p>
          </div>

          {/* Nivel 2: Fuentes y Memoria VantaDB */}
          <div className="rounded-[var(--radius-card)] bg-raised p-3 border border-hairline">
            <div className="flex items-center gap-1.5 font-semibold text-ink mb-1">
              <Database size={13} className="text-success" />
              <span>Nivel 2: Fuentes y Memoria VantaDB</span>
            </div>
            {why.vantaSources && why.vantaSources.length > 0 ? (
              <ul className="list-disc list-inside space-y-0.5 text-dim font-mono text-xs pl-1">
                {why.vantaSources.map((source, idx) => (
                  <li key={idx} className="truncate">
                    {source}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-faint text-xs">Sin fuentes específicas vinculadas.</p>
            )}
          </div>

          {/* Nivel 3: Trazabilidad Técnica */}
          <div className="rounded-[var(--radius-card)] bg-raised p-3 border border-hairline">
            <div className="flex items-center gap-1.5 font-semibold text-ink mb-1">
              <ShieldCheck size={13} className="text-brand" />
              <span>Nivel 3: Auditoría & Telemetría</span>
            </div>
            <p className="text-dim font-mono text-xs break-all">
              {why.auditTrace || "audit:trace:verified:vanta-l0-l3:auto"}
            </p>
          </div>
        </div>

        {/* Pie */}
        <div className="flex justify-end pt-3 border-t border-hairline">
          <Button size="md" variant="secondary" onClick={() => setIsOpen(false)}>
            Cerrar
          </Button>
        </div>
      </Modal>
    </>
  );
};
