import type { ReactNode } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import { cva, cn } from "./cva.js";

/**
 * T06 UI-03 — Badge del kit.
 * 9 estados P22: default / hover / active / focus (tabIndex opcional) /
 * disabled (tone dim + opacity) / loading (aria-busy + pulse) /
 * error (tone risk) / empty (placeholder "—") / overflow (truncate + title).
 */
const badgeVariants = cva({
  base: "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold transition-colors hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-brand",
  variants: {
    tone: {
      ok: "border-emerald-800/40 bg-emerald-950/60 text-emerald-400",
      warn: "border-amber-800/40 bg-amber-950/60 text-amber-400",
      risk: "border-red-800/40 bg-red-950/60 text-red-300",
      info: "border-hairline bg-raised text-dim",
      dim: "border-hairline/60 bg-panel text-faint opacity-70",
    },
  },
  defaultVariants: { tone: "info" },
});

export interface BadgeProps {
  tone?: "ok" | "warn" | "risk" | "info" | "dim";
  children?: ReactNode;
  loading?: boolean;
  overflow?: string;
  focusable?: boolean;
  className?: string;
}

export function Badge({
  tone = "info",
  children,
  loading = false,
  overflow,
  focusable = false,
  className,
}: BadgeProps) {
  return (
    <span
      tabIndex={focusable ? 0 : undefined}
      title={overflow}
      aria-busy={loading || undefined}
      className={cn(
        badgeVariants({ tone }),
        loading && "animate-pulse",
        overflow && "max-w-[160px]",
        className,
      )}
    >
      {loading && <CircleNotch size={11} className="animate-spin shrink-0" aria-hidden />}
      <span className={cn("min-w-0", overflow && "truncate")}>
        {children ?? <span aria-label="vacío">—</span>}
      </span>
    </span>
  );
}
