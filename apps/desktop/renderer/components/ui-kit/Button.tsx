import type { ButtonHTMLAttributes } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import { cva, cn } from "./cva.js";

/**
 * T06 UI-03 — Button del kit.
 * 9 estados P22: default / hover / active / focus (focus-visible) /
 * disabled / loading (aria-busy + spinner) / error (variant danger) /
 * empty (sin children → mantiene altura mínima) / overflow (truncate).
 * `--radius-card` en uso (cierra deuda del token muerto).
 */
const buttonVariants = cva({
  base: "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-card)] px-3 py-1.5 text-xs font-medium transition-colors transition-transform duration-[var(--motion-duration-micro)] ease-[var(--motion-ease-out)] cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 overflow-hidden",
  variants: {
    variant: {
      primary: "bg-ink text-paper hover:opacity-90",
      secondary: "border border-hairline bg-raised text-ink hover:bg-panel",
      ghost: "text-faint hover:text-ink hover:bg-raised",
      danger: "bg-red-950/60 text-red-300 border border-red-800/40 hover:bg-red-950",
    },
    size: {
      sm: "px-2 py-1 text-[11px]",
      md: "px-3 py-1.5 text-xs",
    },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
  truncate?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  truncate = false,
  disabled,
  children,
  className,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled ?? loading;
  return (
    <button
      {...rest}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-live={loading ? "polite" : undefined}
      className={cn(
        buttonVariants({ variant, size }),
        truncate && "max-w-full truncate",
        !children && "min-h-[28px] min-w-[28px]",
        className,
      )}
    >
      {loading && <CircleNotch size={13} className="animate-spin shrink-0" aria-hidden />}
      <span className={cn(truncate && "truncate")}>{children}</span>
    </button>
  );
}
