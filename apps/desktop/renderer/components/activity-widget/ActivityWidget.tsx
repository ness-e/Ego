import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Sparkle, Warning, Check, X } from "@phosphor-icons/react";
import { useActivityState } from "./useActivityState.js";
import { Modal } from "../ui-kit/Modal.js";
import { Button } from "../ui-kit/Button.js";
import { Badge } from "../ui-kit/Badge.js";
import { MOTION } from "../canvas/DesignSystemProvider.js";
import { CharacterBadge } from "../character/CharacterBadge.js";

/**
 * Activity Widget — telemetría + HITL en la cabecera de la app.
 *
 * FASE 1 (design system): los botones pasan por el kit `ui-kit` y toda la
 * superficie usa los tokens canónicos (radio del sistema, escala tipográfica
 * de 3 tamaños, sin colores de paleta crudos: el CTA ámbar es `bg-brand` +
 * `text-on-brand`).
 */
export function ActivityWidget() {
  const { status, activeSubEgo, currentAction, pendingApprovals, vantaDbOk, resolveApproval } =
    useActivityState();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  const currentApproval = pendingApprovals[0];
  // STAB-10: duración alineada al motion token ui (--motion-duration-ui).
  const transition = reduceMotion ? { duration: 0 } : { duration: MOTION.ui };
  const noAnimStyle = reduceMotion ? { animation: "none" } : undefined;

  // Atajos de teclado en el modal de aprobación rápida (Enter: aprobar).
  // WCAG 2.2 AA: Escape lo gestiona Radix Dialog (trap nativo); no se duplica
  // aquí para evitar doble cierre / foco robado.
  useEffect(() => {
    if (!isModalOpen || !currentApproval) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        resolveApproval(currentApproval.approvalId, true);
        if (pendingApprovals.length <= 1) setIsModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, currentApproval, pendingApprovals.length, resolveApproval]);

  return (
    <div className="flex items-center gap-2 app-region-no-drag relative">
      <AnimatePresence initial={false}>
        {/* 1. Estado Idle — badge con salud real (T12: error si snapshots() falla) y Avatar en vivo */}
        {status === "idle" &&
          (vantaDbOk ? (
            <motion.div
              key="idle-ok"
              layout
              initial={reduceMotion ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: 4 }}
              transition={transition}
              style={noAnimStyle}
              data-testid="activity-idle"
              className="flex items-center gap-1.5 rounded-full border border-hairline bg-raised px-2.5 py-0.5 text-xs text-faint"
            >
              <CharacterBadge
                subEgoId="ego.nucleus"
                size={22}
                state="idle"
                animated={!reduceMotion}
              />
              <span
                className="h-1.5 w-1.5 rounded-full bg-success animate-pulse"
                style={noAnimStyle}
              />
              <span>VantaDB Core OK</span>
            </motion.div>
          ) : (
            <motion.div
              key="idle-err"
              layout
              initial={reduceMotion ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: 4 }}
              transition={transition}
              style={noAnimStyle}
              data-testid="activity-error"
              role="alert"
              className="flex items-center gap-1.5 rounded-full border border-error/40 bg-error/10 px-2.5 py-0.5 text-xs text-error"
            >
              <CharacterBadge
                subEgoId="ego.nucleus"
                size={22}
                state="error"
                animated={!reduceMotion}
              />
              <span className="h-1.5 w-1.5 rounded-full bg-error" style={noAnimStyle} />
              <span>VantaDB error — sin verificación de snapshots</span>
            </motion.div>
          ))}

        {/* 2. Estado Working */}
        {status === "working" && (
          <motion.div
            key="working"
            layout
            initial={reduceMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 4 }}
            transition={transition}
            style={noAnimStyle}
            data-testid="activity-working"
            className="flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-0.5 text-xs text-brand"
          >
            <CharacterBadge
              subEgoId={activeSubEgo || "ego.nucleus"}
              size={22}
              state="working"
              animated={!reduceMotion}
            />
            <Sparkle className="text-brand" style={noAnimStyle} size={13} />
            <span className="truncate max-w-[200px]">
              {activeSubEgo ? `${activeSubEgo}: ` : ""}
              {currentAction || "Ejecutando..."}
            </span>
          </motion.div>
        )}

        {/* 3. Estado Approval (HITL) */}
        {status === "approval" && (
          <motion.div
            key="approval"
            layout
            initial={reduceMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 4 }}
            transition={transition}
            style={noAnimStyle}
            data-testid="activity-approval"
            className="flex items-center gap-2 rounded-full border border-warning/40 bg-warning/10 px-3 py-0.5 text-xs text-warning"
          >
            <CharacterBadge
              subEgoId={currentApproval?.action?.subEgoId || activeSubEgo || "ego.nucleus"}
              size={22}
              state="approval"
              animated={!reduceMotion}
            />
            <Warning size={14} className="text-warning" />
            <span>
              HITL Requerido{pendingApprovals.length > 1 ? ` (${pendingApprovals.length})` : ""}
            </span>
            {/* El CTA de revisión conserva el `<button>` nativo: la puerta
                STAB-13 (`test/Stab13UxMotion.test.tsx`) verifica el target
                de 44 px sobre el nodo que lleva el TEXTO visible, y el
                `Button` del kit envuelve los hijos en un `<span>`. Sus
                clases replican las canónicas del kit. */}
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-card)] bg-brand px-3 text-xs font-semibold text-on-brand transition-colors hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Revisar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Aprobación Rápida HITL. T07: Radix Modal (trap de foco +
          Escape + aria-modal nativos; el cierre hereda aria-label). */}
      {isModalOpen && currentApproval && (
        <Modal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          title="Autorización Rápida de Operación"
          description="Revisa los parámetros y resuelve la operación sensible pendiente."
        >
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-3 rounded-[var(--radius-card)] bg-raised border border-hairline p-2">
              <CharacterBadge
                subEgoId={currentApproval.action.subEgoId}
                size={32}
                state="approval"
                animated={!reduceMotion}
              />
              <div className="flex flex-col">
                <span className="font-semibold text-ink">{currentApproval.action.subEgoId}</span>
                <span className="text-xs font-mono text-brand">HITL en espera</span>
              </div>
            </div>

            <div>
              <span className="text-faint">Herramienta: </span>
              <span className="font-mono font-bold text-brand">{currentApproval.toolName}</span>
            </div>
            <div>
              <span className="text-faint">Sub-Ego: </span>
              <span className="font-medium text-ink">{currentApproval.action.subEgoId}</span>
            </div>
            <div>
              <span className="text-faint">Nivel de Riesgo: </span>
              <Badge tone={currentApproval.riskLevel === "destructive" ? "risk" : "warn"}>
                {currentApproval.riskLevel}
              </Badge>
            </div>

            <div>
              <span className="text-faint">Parámetros:</span>
              <pre className="mt-1 max-h-36 overflow-auto rounded-[var(--radius-card)] bg-paper p-2 font-mono text-xs text-ink border border-hairline">
                {JSON.stringify(currentApproval.arguments, null, 2)}
              </pre>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-hairline pt-3">
            <span className="text-xs text-dim">
              Atajos: <kbd className="px-1 py-0.5 bg-raised rounded-md font-mono">Enter</kbd> Aprobar,{" "}
              <kbd className="px-1 py-0.5 bg-raised rounded-md font-mono">Esc</kbd> Cancelar
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="lg"
                variant="danger"
                icon={<X size={14} />}
                onClick={() => {
                  resolveApproval(currentApproval.approvalId, false, "Rechazado desde widget");
                  if (pendingApprovals.length <= 1) setIsModalOpen(false);
                }}
              >
                Rechazar
              </Button>
              <Button
                size="lg"
                variant="accent"
                icon={<Check size={14} weight="bold" />}
                onClick={() => {
                  resolveApproval(currentApproval.approvalId, true);
                  if (pendingApprovals.length <= 1) setIsModalOpen(false);
                }}
              >
                Aprobar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
