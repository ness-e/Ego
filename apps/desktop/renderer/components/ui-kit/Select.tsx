import * as SelectPrimitive from "@radix-ui/react-select";
import { CaretDown, Check, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { useId, useRef } from "react";
import { cn } from "./cva.js";
import { usePortalHost } from "./portalHost.js";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  options: SelectOption[];
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  /** Clase extra del contenedor (envoltorio del trigger). */
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  title?: string;
  id?: string;
  name?: string;
  /** Estado `loading`: spinner + `aria-busy` + deshabilita el selector. */
  loading?: boolean;
  /** Estado `error`: borde de error + mensaje `role="alert"`. */
  error?: string;
}

/**
 * T5 / D3 — Select sobre `@radix-ui/react-select`.
 *
 * Antes: implementación **propia** de combobox/listbox/option con ARIA
 * escrita a mano (~300 líneas) que el commit `87fc3ad` presentó como
 * "Radix Select" pero nunca usó Radix (0 imports). Eso dejaba en manos del
 * proyecto la corrección de teclado, foco, `aria-activedescendant` y
 * navegación por tipo — y el listbox se renderizaba **inline**, sin
 * `Portal`, por lo que un `overflow: hidden` ancestors lo recortaba.
 *
 * Ahora: Radix aporta el patrón ARIA canónico (`role=combobox` +
 * `aria-expanded` + `role=listbox` + `role=option`), la navegación por
 * teclado (flechas, Home/End, type-ahead, Escape) y la gestión de foco
 * (incluido el retorno al trigger al cerrar). El listbox se renderiza en
 * `SelectPrimitive.Portal` para que ningún ancestro lo recorte.
 *
 * ## `position`: `item-aligned` (default de Radix), NO `popper`
 * Con `position="popper"`, el `SelectContent` se monta dentro de un
 * `FocusScope` **trapped** propio. Cuando el Select vive dentro de un
 * `Dialog` de Radix (que también atrapa el foco), ambos scopes compiten por
 * el foco y se produce un ping-pong `focusin` → `RangeError: Maximum call
 * stack size exceeded` al abrir el desplegable. Con el alineamiento
 * `item-aligned` (el default de la librería) el conflicto se agrava, porque
 * el listbox **sigue portaleado al `document.body`**, es decir FUERA del
 * subárbol del Dialog.
 *
 * ## `container` del Portal: el contenedor del diálogo anfitrión
 * La corrección estructural es **portaleal el listbox dentro del mismo
 * contenedor que el `Dialog` anfitrión** (y no al `document.body`). Así el
 * `FocusScope` del Dialog sigue viendo el foco dentro de su subárbol → no
 * hay ping-pong → no hay `RangeError`. El contenedor se localiza por el
 * atributo `data-ego-dialog-content` que `ui-kit/Modal.tsx` pone en su
 * `Dialog.Content`, subiendo desde el trigger del Select (`usePortalHost`).
 * Si no hay diálogo anfitrión (Select en la cabecera, en la barra lateral…),
 * el `Portal` va al `document.body`, que es el comportamiento normal.
 *
 * ## Densidad y color
 * - Trigger de 32 px (`h-8`): tiene etiqueta visible, luego la regla de
 *   densidad del owner (2026-10-20) le permite medir 32 px. `min-w-11`
 *   mantiene un ancho mínimo razonable.
 * - Todos los colores salen de tokens (`bg-raised`, `text-ink`, `text-faint`,
 *   `border-hairline`); sin hex ni clases zinc/white.
 *
 * API pública **idéntica** a la anterior (`SelectProps`), más `loading` y
 * `error` (estados `loading`/`error` del contrato de 9 estados), de modo que
 * los consumidores (`App.tsx`, `Sidebar.tsx`, `SettingsModal.tsx`) no cambian.
 */
export function Select({
  value: controlledValue,
  defaultValue,
  onValueChange,
  open: controlledOpen,
  onOpenChange,
  options = [],
  ariaLabel,
  placeholder = "Seleccionar...",
  disabled = false,
  className,
  triggerClassName,
  contentClassName,
  title,
  id: customId,
  name,
  loading = false,
  error,
}: SelectProps) {
  const selectedOption = options.find((opt) => opt.value === controlledValue);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const portalHost = usePortalHost(triggerRef);
  const isDisabled = disabled || loading;
  // Id estable para `aria-errormessage` (nunca `undefined-error`).
  const reactId = useId().replace(/:/g, "");
  const errMsgId = `${customId ?? name ?? `ego-select-${reactId}`}-error`;

  return (
    <>
      <SelectPrimitive.Root
        value={controlledValue}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        open={controlledOpen}
        onOpenChange={onOpenChange}
        disabled={isDisabled}
        name={name}
      >
        <SelectPrimitive.Trigger
          ref={triggerRef}
          id={customId}
          aria-label={ariaLabel}
          aria-busy={loading || undefined}
          aria-invalid={error ? true : undefined}
          aria-errormessage={error ? errMsgId : undefined}
          title={title}
          className={cn(
            "inline-flex h-8 min-w-11 w-full items-center justify-between gap-2 rounded-[var(--radius-card)] border border-hairline bg-raised px-2.5",
            "text-xs text-ink transition-colors cursor-pointer select-none",
            "hover:border-strong hover:bg-panel",
            "focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-error/50",
            className,
            triggerClassName,
          )}
        >
          {loading && (
            <CircleNotch size={13} className="animate-spin shrink-0 text-dim" aria-hidden />
          )}
          {/*
            Radix 2.3.x **descarta** el `className` de `Select.Value` (lo
            desestructura y no lo reinyecta en el <span> que renderiza):
            el DOM real queda como `<span style="pointer-events:none">` sin
            ninguna clase, así que un `truncate` aplicado aquí NUNCA tenía
            efecto y toda etiqueta larga se envolvía en varias líneas
            desbordando el trigger (defecto D2 de la auditoría de diseño).
            Por eso el recorte va en un <span> ENVOLTORIO: el texto de
            Radix queda dentro y lo recorta el padre.
          */}
          <span className="min-w-0 truncate text-left">
            <SelectPrimitive.Value placeholder={placeholder}>
              {selectedOption?.label ?? null}
            </SelectPrimitive.Value>
          </span>
          <SelectPrimitive.Icon asChild>
            <CaretDown
              size={14}
              className="shrink-0 text-faint transition-transform duration-[var(--motion-duration-micro)]"
              aria-hidden
            />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal container={portalHost ?? undefined}>
          <SelectPrimitive.Content
            sideOffset={4}
            className={cn(
              "z-50 max-h-60 min-w-[8rem] overflow-y-auto rounded-[var(--radius-card)] border border-hairline bg-raised p-1 text-xs text-ink shadow-[var(--ego-elevation-l2)]",
              // Entrada sutil con la variante `starting:` de Tailwind v4
              // (`@starting-style`): sin plugin de animación externo y
              // respetando `prefers-reduced-motion` (index.css desactiva las
              // transiciones globales).
              "transition-[opacity,transform] duration-[var(--motion-duration-micro)] ease-[var(--motion-ease-out)] starting:opacity-0 starting:scale-95 data-[state=open]:opacity-100 data-[state=open]:scale-100",
              contentClassName,
            )}
          >
            <SelectPrimitive.Viewport>
              {options.length === 0 ? (
                <div className="px-2.5 py-2 text-center text-faint">Sin opciones</div>
              ) : (
                options.map((option) => (
                  <SelectPrimitive.Item
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center justify-between rounded-lg px-2.5 py-2 text-xs text-ink outline-none transition-colors",
                      "data-[highlighted]:bg-panel",
                      "data-[state=checked]:bg-raised",
                      "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
                    )}
                  >
                    <SelectPrimitive.ItemText className="min-w-0 truncate">
                      {option.label}
                    </SelectPrimitive.ItemText>
                    <SelectPrimitive.ItemIndicator>
                      <Check size={14} className="ml-2 shrink-0 text-brand" aria-hidden />
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                ))
              )}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      {error && (
        <p
          id={errMsgId}
          role="alert"
          className="mt-1 flex items-center gap-1 text-xs text-error"
        >
          <WarningCircle size={12} className="shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </>
  );
}
