import * as PopoverPrimitive from "@radix-ui/react-popover";
import { CircleNotch } from "@phosphor-icons/react";
import { useRef, type ReactNode } from "react";
import { cn } from "./cva.js";
import { usePortalHost } from "./portalHost.js";

export interface PopoverProps {
  /**
   * Elemento que abre el popover. Debe ser un `<button>` (o un componente
   * que propague `ref`, como el `Button` del kit): Radix lo enhancea con
   * `aria-haspopup="dialog"`, `aria-expanded` y `data-state`.
   */
  trigger: ReactNode;
  /** Contenido del popover. */
  content: ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  /** Estado controlado (opcional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Nombre accesible del popover. */
  ariaLabel?: string;
  /** Clase extra del disparador. */
  className?: string;
  /** Clase extra del panel. */
  contentClassName?: string;
  /** Estado `loading`: spinner dentro del panel. */
  loading?: boolean;
  /** Estado `error`: mensaje `role="alert"` dentro del panel. */
  error?: string;
}

/**
 * Popover del kit sobre `@radix-ui/react-popover`.
 *
 * ## Por qué Radix (no un popover propio)
 * El posicionamiento con colisiones, el `DismissableLayer` (cerrar al pulsar
 * fuera o con Escape), el retorno del foco al trigger y el rol `dialog` son
 * comportamiento no trivial de Radix: recrearlos violaría el principio D3
 * (`docs/design/design-system.md` §8.1) y sustituiría las implementaciones
 * ad-hoc de `components/ego-chat.tsx` y `components/sidebar/Sidebar.tsx`.
 *
 * ## `modal={false}` (por defecto de Radix) y portal al diálogo
 * El popover no atrapa el foco (a diferencia del `Menu`), por lo que no
 * produce el ping-pong de `FocusScope` dentro de un `Modal` del kit. Aun
 * así, `usePortalHost` lo portalea dentro del `Dialog.Content` anfitrión
 * (`data-ego-dialog-content`) para que un clic dentro del popover NO sea
 * interpretado por el diálogo como "clic exterior" (lo cerraría).
 *
 * ## 9 estados P22
 * default / hover / active / focus (`focus-visible`) / disabled (el
 * consumidor lo aplica en el trigger) / loading (spinner) / error
 * (`role="alert"`) / empty (lo decide el contenido) / overflow (el panel
 * puede hacer scroll con `max-h-*`).
 */
export function Popover({
  trigger,
  content,
  align = "center",
  side = "bottom",
  sideOffset = 6,
  open,
  onOpenChange,
  ariaLabel = "Panel",
  className,
  contentClassName,
  loading = false,
  error,
}: PopoverProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const portalHost = usePortalHost(triggerRef);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger ref={triggerRef} asChild className={className}>
        {trigger}
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal container={portalHost ?? undefined}>
        <PopoverPrimitive.Content
          align={align}
          side={side}
          sideOffset={sideOffset}
          collisionPadding={8}
          aria-label={ariaLabel}
          className={cn(
            "z-50 w-72 max-w-[calc(100vw-2rem)] rounded-[var(--radius-card)] border border-hairline bg-raised p-3 text-xs text-ink shadow-[var(--ego-elevation-l2)]",
            "transition-[opacity,transform] duration-[var(--motion-duration-micro)] ease-[var(--motion-ease-out)] starting:opacity-0 starting:scale-95 data-[state=open]:opacity-100 data-[state=open]:scale-100",
            contentClassName,
          )}
        >
          {error && (
            <div
              role="alert"
              className="mb-2 rounded-lg border border-error/40 bg-error/10 px-2 py-1 text-xs text-error"
            >
              {error}
            </div>
          )}
          {loading ? (
            <div
              aria-live="polite"
              className="flex items-center gap-2 py-1 text-xs text-dim"
            >
              <CircleNotch size={12} className="animate-spin" aria-hidden />
              <span>Cargando…</span>
            </div>
          ) : (
            content
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
