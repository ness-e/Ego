import React from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
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
 *
 * Densidad (owner 2026-10-20): `sm` = 28 px · `md` = 32 px, en línea con el
 * `Button` para que un campo y su botón ocupen la misma altura.
 */
/**
 * `size` se re-declara como densidad del kit ("sm" | "md") y por eso se
 * EXCLUYE del `size?: number` nativo del `<input>` (anchura en caracteres),
 * que ningún consumidor del renderer usa.
 */
export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  error?: string;
  hint?: string;
  loading?: boolean;
  truncate?: boolean;
  size?: "sm" | "md";
  /**
   * Clases del ENVOLTORIO (el `<div>` que contiene el campo), no del
   * `<input>`. Existe porque `className` va al control interior: sin esto,
   * dar ancho al campo (p. ej. `w-full sm:w-64`) obligaba a envolver el
   * `Input` en un `<div>` extra en cada consumidor.
   */
  wrapperClassName?: string;
  /**
   * Icono a la izquierda DENTRO del campo (p. ej. la lupa del buscador de
   * `QueryView`).
   *
   * ## Por qué vive dentro y no fuera
   * El icono se renderiza como hermano del `<input>` dentro de la caja del
   * campo, así que hereda el borde, el foco (`focus-within`) y el padding
   * `px-2.5` del contenedor: no hace falta que cada consumidor reconstruya
   * la "caja" con un `<div>` propio. El separador entre icono y texto es el
   * `gap-2` del contenedor.
   *
   * El icono es **decorativo** (`aria-hidden`): el nombre accesible del
   * campo lo aporta el `aria-label`/`label` del consumidor.
   */
  leadingIcon?: ReactNode;
}

export function Input({
  error,
  hint,
  loading = false,
  truncate = false,
  size = "md",
  disabled,
  maxLength,
  value,
  className,
  wrapperClassName,
  leadingIcon,
  ...rest
}: InputProps) {
  // `loading` SIEMPRE deshabilita (aunque el consumidor pase
  // `disabled={false}`): un control en carga no debe ser editable.
  const isDisabled = Boolean(disabled) || loading;
  const textValue = typeof value === "string" ? value : undefined;
  // Contador de overflow: se muestra SIEMPRE que haya `maxLength` y valor,
  // con o sin `hint` (antes sólo aparecía dentro del bloque de `hint`, lo
  // que lo hacía invisible en el uso real).
  const showCount = typeof maxLength === "number" && textValue !== undefined;
  // T-contraste: id estable para el mensaje de error. Sin `id` ni `name`
  // el `useId` evita el clásico `undefined-error` (a11y: aria-errormessage
  // debe apuntar a un id real).
  const reactErrId = React.useId().replace(/:/g, "");
  const errBase = rest.id ?? rest.name ?? `ego-input-${reactErrId}`;
  const errMsgId = `${errBase}-error`;
  return (
    <div className={cn("flex w-full flex-col gap-1", wrapperClassName)}>
      <div
        className={cn(
          "flex items-center gap-2 rounded-[var(--radius-card)] border bg-panel px-2.5 transition-colors",
          size === "sm" ? "h-7" : "h-8",
          "hover:border-dim",
          // Ola 10 · EGO-FIND-101: el foco es **UN** anillo (el outline del
          // sistema, `focus-visible:outline-brand` → `--ego-color-focus-ring`).
          // Antes el borde ALSO se volvía `brand` → dos anillos ámbar
          // superpuestos (denso y confuso). Ahora el borde conserva su
          // token (`border-strong` / `border-error`) y sólo el outline
          // marca el foco.
          "focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-brand",
          "active:border-dim",
          error ? "border-error/50" : "border-strong",
          isDisabled && "cursor-not-allowed opacity-50",
        )}
      >
        {loading && (
          <CircleNotch size={13} className="animate-spin shrink-0 text-dim" aria-hidden />
        )}
        {leadingIcon && (
          <span className="shrink-0 text-faint" aria-hidden>
            {leadingIcon}
          </span>
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
