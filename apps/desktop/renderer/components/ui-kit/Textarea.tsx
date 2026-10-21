import React from "react";
import type { TextareaHTMLAttributes } from "react";
import { CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { cn } from "./cva.js";

/**
 * T06 UI-03 — Textarea del kit: el gemelo de `Input` para `<textarea>`.
 * 9 estados P22: default / hover / active / focus (anillo brand) /
 * disabled / loading (spinner + aria-busy) / error (aria-invalid + mensaje) /
 * empty (hint opcional) / overflow (truncate + contador maxLength).
 *
 * Comparte con `Input` los MISMOS tokens y las MISMAS reglas de contraste:
 * - Borde base `border-strong` (nunca hairline como único indicador).
 * - Placeholder `placeholder:text-faint` SÓLIDO (sin `opacity-*`).
 * - `errMsgId` vía `React.useId` (nunca `undefined-error`).
 * - Contador de overflow siempre visible cuando hay `maxLength` y valor.
 *
 * Densidad (owner 2026-10-20): `sm` = 28 px de alto mínimo · `md` = 32 px,
 * en línea con el `Input` y el `Button`.
 */
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  hint?: string;
  loading?: boolean;
  size?: "sm" | "md";
}

export function Textarea({
  error,
  hint,
  loading = false,
  size = "md",
  disabled,
  maxLength,
  value,
  rows = 3,
  className,
  ...rest
}: TextareaProps) {
  // `loading` SIEMPRE deshabilita (aunque el consumidor pase
  // `disabled={false}`): un control en carga no debe ser editable.
  const isDisabled = Boolean(disabled) || loading;
  const textValue = typeof value === "string" ? value : undefined;
  const showCount = typeof maxLength === "number" && textValue !== undefined;
  const reactErrId = React.useId().replace(/:/g, "");
  const errBase = rest.id ?? rest.name ?? `ego-textarea-${reactErrId}`;
  const errMsgId = `${errBase}-error`;
  return (
    <div className="flex w-full flex-col gap-1">
      <div
        className={cn(
          "flex items-start gap-2 rounded-[var(--radius-card)] border bg-panel p-2 transition-colors",
          size === "sm" ? "min-h-16" : "min-h-20",
          "hover:border-dim",
          "focus-within:border-brand focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-brand",
          "active:border-dim",
          error ? "border-error/50" : "border-strong",
          isDisabled && "cursor-not-allowed opacity-50",
        )}
      >
        {loading && (
          <CircleNotch size={13} className="animate-spin shrink-0 text-dim" aria-hidden />
        )}
        <textarea
          {...rest}
          rows={rows}
          value={value}
          maxLength={maxLength}
          disabled={isDisabled}
          aria-busy={loading || undefined}
          aria-invalid={error ? true : undefined}
          aria-errormessage={error ? errMsgId : undefined}
          className={cn(
            "w-full min-w-0 flex-1 resize-y bg-transparent text-xs text-ink placeholder:text-faint focus:outline-none disabled:cursor-not-allowed",
            className,
          )}
        />
        {error && <WarningCircle size={14} className="shrink-0 text-error" aria-hidden />}
      </div>
      {error ? (
        <p id={errMsgId} role="alert" className="text-xs text-error">
          {error}
        </p>
      ) : hint || showCount ? (
        <div
          className={cn(
            "flex items-center gap-2 text-xs text-faint",
            hint ? "justify-between" : "justify-end",
          )}
        >
          {hint && (
            <span className={cn("min-w-0 truncate", !textValue && "italic")}>
              {hint}
            </span>
          )}
          {showCount && (
            <span className="shrink-0 font-mono text-dim">
              {textValue.length}/{maxLength}
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
