import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactElement, ReactNode } from "react";
import { cn } from "./cva.js";

export interface TooltipProps {
  /** Texto (o contenido) del tooltip. */
  content: ReactNode;
  /**
   * Elemento que dispara el tooltip. Debe ser un `<button>` (o un
   * componente que propague `ref` y los props de Radix, como el `Button`
   * del kit): Radix lo enhancea con `aria-describedby` y lo enlaza con el
   * contenido.
   */
  children: ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  /** Retardo antes de mostrar el tooltip (ms). */
  delayDuration?: number;
  /** Desactiva el tooltip (el trigger se renderiza tal cual). */
  disabled?: boolean;
  /** Clase extra del panel del tooltip. */
  contentClassName?: string;
}

/**
 * Tooltip del kit sobre `@radix-ui/react-tooltip`.
 *
 * ## `TooltipProvider` propio
 * Radix exige un `Tooltip.Provider` como ancestro. Este componente lo
 * monta él mismo con `delayDuration` de 300 ms: suficiente para no
 * molestar al puntero, pero rápido para el usuario que ya está mirando.
 * (Si la app necesita un provider global, se puede montar uno en la raíz y
 * este provider anidado no interfiere: el más cercano gana.)
 *
 * ## Accesibilidad
 * - El contenido se asocia al trigger por `aria-describedby` (lo aporta
 *   Radix) → un lector de pantalla lo anuncia.
 * - `Escape` cierra el tooltip.
 * - Con `prefers-reduced-motion: reduce` no hay transición: el panel
 *   aparece sin animación (`motion-reduce:transition-none` + la regla
 *   global de `index.css`).
 *
 * ## 9 estados P22
 * default / hover / active / focus (`focus-visible`) / disabled (prop
 * `disabled`) / loading (no aplica: el tooltip no carga) / error (no
 * aplica) / empty (sin `content` no se monta) / overflow (el panel limita
 * su ancho con `max-w-xs` y el texto se parte por palabras).
 */
export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  sideOffset = 6,
  delayDuration = 300,
  disabled = false,
  contentClassName,
}: TooltipProps) {
  // Sin contenido o desactivado: se devuelve el trigger tal cual para no
  // dejar un `aria-describedby` apuntando a nada.
  if (disabled || content === null || content === undefined || content === "") {
    return children;
  }

  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={100}>
      <TooltipPrimitive.Root delayDuration={delayDuration}>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            align={align}
            sideOffset={sideOffset}
            collisionPadding={8}
            className={cn(
              "z-50 max-w-xs rounded-[var(--radius-card)] border border-hairline bg-raised px-2 py-1 text-xs text-ink shadow-[var(--ego-elevation-l2)]",
              "transition-[opacity,transform] duration-150 ease-[var(--motion-ease-out)] motion-reduce:transition-none starting:opacity-0 starting:scale-95 data-[state=delayed-open]:opacity-100 data-[state=delayed-open]:scale-100 data-[state=closed]:opacity-0",
              contentClassName,
            )}
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-raised" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
