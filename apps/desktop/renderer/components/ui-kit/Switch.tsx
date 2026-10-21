import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "./cva.js";

/**
 * Switch del kit — interruptor booleano.
 *
 * ## Por qué Radix (principio D3)
 * Antes no existía: cada superficie reconstruía el interruptor a mano
 * (botón transparente 44×44 + pista + knob), lo que producía variantes
 * distintas con el mismo aspecto y sin estado `checked` real. Radix aporta
 * el patrón ARIA canónico (`role="switch"` + `aria-checked`), la
 * navegación por teclado y el estado compartido entre label y control.
 *
 * ## Estados (contrato P22)
 * default / hover / active / focus (anillo brand) / disabled / checked /
 * unchecked. `loading` deshabilita; `error` marca el borde del track.
 *
 * ## Densidad
 * `sm` = pista de 28×16 px · `md` = 36×20 px. El objetivo táctil lo
 * aporta el área de click del `label` que envuelve al control, no la pista
 * (que es decorativa): por eso el componente acepta `label`.
 */
export interface SwitchProps {
  /** Estado controlado. */
  checked?: boolean;
  /** Estado inicial (no controlado). */
  defaultChecked?: boolean;
  /** Se dispara al cambiar el estado. */
  onCheckedChange?: (checked: boolean) => void;
  /** Texto accesible del interruptor. */
  "aria-label"?: string;
  /** Etiqueta visible: envuelve al control y amplía el área pulsable. */
  label?: string;
  disabled?: boolean;
  loading?: boolean;
  /** Mensaje de error asociado (marca el borde del track). */
  error?: string;
  size?: "sm" | "md";
  className?: string;
}

export function Switch({
  checked,
  defaultChecked,
  onCheckedChange,
  "aria-label": ariaLabel,
  label,
  disabled = false,
  loading = false,
  error,
  size = "md",
  className,
}: SwitchProps) {
  const isDisabled = disabled || loading;
  const control = (
    <SwitchPrimitive.Root
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={onCheckedChange}
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      aria-invalid={error ? true : undefined}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center rounded-full border border-hairline transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-4 w-7" : "h-5 w-9",
        error ? "border-error/50" : "bg-panel",
        className,
      )}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block rounded-full bg-ink transition-transform duration-[var(--motion-duration-ui)] ease-[var(--motion-ease-out)]",
          size === "sm" ? "h-3 w-3" : "h-4 w-4",
          "data-[state=checked]:translate-x-[calc(var(--switch-travel,1.25rem))]",
          "data-[state=unchecked]:translate-x-0",
        )}
      />
    </SwitchPrimitive.Root>
  );

  if (!label) return control;

  // El `label` envuelve al control: amplía el área pulsable del interruptor
  // (la pista por sí sola es demasiado pequeña para un target táctil) y
  // asocia el texto visible con el control (WCAG 3.3.2 / 4.1.2).
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-ink">
      {control}
      <span className="min-w-0">{label}</span>
    </label>
  );
}
