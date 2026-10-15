import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { cn } from "./cva.js";
import { MOTION } from "../canvas/DesignSystemProvider.js";

/**
 * T06 UI-03 — Modal base sobre Radix Dialog (trap de foco + Escape +
 * `role="dialog"` + `aria-modal` nativos; T07 a11y hereda esto).
 * 9 estados P22: default / hover+active (cierre) / focus (auto-focus Radix +
 * anillo) / disabled (onOpenChange bloqueado) / loading (aria-busy) /
 * error (slot role="alert") / empty (slot) / overflow (contenido con scroll).
 */
export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  error?: string;
  empty?: string;
  loading?: boolean;
  disabled?: boolean;
  wide?: boolean;
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  error,
  empty,
  loading = false,
  disabled = false,
  wide = false,
}: ModalProps) {
  // STAB-13: entrada/salida fade 150ms (MOTION.micro) + scale .96→1 en
  // Content; reduced-motion → duration 0. `forceMount` + AnimatePresence:
  // el exit se reproduce antes de desmontar (sin esto Radix corta en seco).
  // El foco lo gobierna Radix (auto-focus al primer tabbable + trap + Escape);
  // prohibidos los `autoFocus` nativos en consumidores (omnibar/pickers).
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? { duration: 0 } : { duration: MOTION.micro };
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (disabled) return;
        onOpenChange(next);
      }}
    >
      <Dialog.Portal forceMount>
        <AnimatePresence>
          {open && (
            <Dialog.Overlay key="stab13-overlay" forceMount asChild>
              <motion.div
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={transition}
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs"
              />
            </Dialog.Overlay>
          )}
          {open && (
            <motion.div
              key="stab13-center"
              initial={false}
              exit={{ opacity: 0 }}
              transition={transition}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <Dialog.Content
                forceMount
                asChild
                aria-modal="true"
                aria-busy={loading || undefined}
              >
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={transition}
                  className={cn(
                    "flex max-h-[85vh] w-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-panel text-ink shadow-2xl",
                    "focus:outline-2 focus:outline-offset-2 focus:outline-brand",
                    wide ? "max-w-4xl" : "max-w-lg",
                  )}
                >
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-hairline bg-paper px-4">
              <div className="flex min-w-0 items-center gap-2">
                <Dialog.Title className="truncate text-xs font-semibold">
                  {title}
                </Dialog.Title>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Cerrar diálogo"
                  className="rounded p-1.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-faint transition-colors hover:bg-raised hover:text-ink active:scale-95 focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <X size={15} />
                </button>
              </Dialog.Close>
            </div>
            {description && (
              <Dialog.Description className="shrink-0 border-b border-hairline bg-paper/60 px-4 py-2 text-[11px] text-faint">
                {description}
              </Dialog.Description>
            )}
            {loading && (
              <div
                className="flex shrink-0 items-center gap-2 border-b border-hairline px-4 py-2 text-[11px] text-dim"
                aria-live="polite"
              >
                <CircleNotch size={13} className="animate-spin" aria-hidden />
                <span>Cargando…</span>
              </div>
            )}
            {error && (
              <div
                role="alert"
                className="flex shrink-0 items-center gap-2 border-b border-red-800/40 bg-red-950/40 px-4 py-2 text-[11px] text-red-300"
              >
                <WarningCircle size={14} className="shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto p-4 text-xs">
              {empty && !loading ? (
                <div className="flex h-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-hairline text-center">
                  <p className="font-medium text-ink">{empty}</p>
                </div>
              ) : (
                children
              )}
            </div>
                </motion.div>
              </Dialog.Content>
            </motion.div>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
