import React from "react";
import type { InputHTMLAttributes } from "react";
import { CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { cn } from "./cva.js";

/**
 * T06 UI-03 — Input del kit.
 * 9 estados P22: default / hover / active / focus (anillo brand) /
 * disabled / loading (spinner + aria-busy) / error (aria-invalid + mensaje) /
 * empty (hint opcional) / overflow (truncate + contador maxLength).
 *
 * T-contraste:
 * - Borde base `border-strong` (nunca hairline como único indicador).
 * - Placeholder `placeholder:text-faint` SÓLIDO (sin `opacity-*` ni `/60`).
 * - `errMsgId` vía `React.useId` (nunca `undefined-error`).
 */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  hint?: string;
  loading?: boolean;
  truncate?: boolean;
}

export function Input({
  error,
  hint,
  loading = false,
  truncate = false,
  disabled,
  maxLength,
  value,
  className,
  ...rest
}: InputProps) {
  const isDisabled = disabled ?? loading;
  const showCount =
    typeof maxLength === "number" && typeof value === "string";
  // T-contraste: id estable para el mensaje de error. Sin `id` ni `name`
  // el `useId` evita el clásico `undefined-error` (a11y: aria-errormessage
  // debe apuntar a un id real).
  const reactErrId = React.useId().replace(/:/g, "");
  const errBase = rest.id ?? rest.name ?? `ego-input-${reactErrId}`;
  const errMsgId = `${errBase}-error`;
  return (
    <div className="flex w-full flex-col gap-1">
      <div
        className={cn(
          "flex items-center gap-2 rounded-[var(--radius-card)] border bg-panel px-2.5 py-1.5 transition-colors",
          "hover:border-dim",
          "focus-within:border-brand focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-brand",
          "active:border-dim",
          error
            ? "border-red-800/60"
            : "border-strong",
          isDisabled && "cursor-not-allowed opacity-50",
        )}
      >
        {loading && (
          <CircleNotch size={13} className="animate-spin shrink-0 text-dim" aria-hidden />
        )}
        <input
          {...rest}
          value={value}
          maxLength={maxLength}
          disabled={isDisabled}
          aria-busy={loading || undefined}
          aria-invalid={error ? true : undefined}
          aria-errormessage={error ? errMsgId : undefined}
          className={cn(
            "w-full min-w-0 flex-1 bg-transparent text-xs text-ink placeholder:text-faint focus:outline-none disabled:cursor-not-allowed",
            truncate && "truncate",
            className,
          )}
        />
        {error && <WarningCircle size={14} className="shrink-0 text-red-400" aria-hidden />}
      </div>
      {error ? (
        <p
          id={errMsgId}
          role="alert"
          className="text-[11px] text-red-300"
        >
          {error}
        </p>
      ) : hint ? (
        <div className="flex items-center justify-between text-[10px] text-faint">
          <span className={cn(!value && "italic")}>{hint}</span>
          {showCount && (
            <span className="font-mono text-dim">
              {(value as string).length}/{maxLength}
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
