import * as SelectPrimitive from "@radix-ui/react-select";
import { CaretDown, Check } from "@phosphor-icons/react";
import { useLayoutEffect, useRef, useState } from "react";

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
 * `Dialog.Content`, subiendo desde el trigger del Select. Si no hay diálogo
 * anfitrión (Select en la cabecera, en la barra lateral…), el `Portal` va al
 * `document.body`, que es el comportamiento normal.
 *
 * API pública **idéntica** a la anterior (`SelectProps`), de modo que los
 * consumidores (`App.tsx`, `Sidebar.tsx`, `SettingsModal.tsx`) no cambian.
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
}: SelectProps) {
  const selectedOption = options.find((opt) => opt.value === controlledValue);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  // Localiza el `Dialog.Content` anfitrión (si lo hay) para portaleal el
  // listbox dentro de su subárbol: evita el ping-pong de `FocusScope` entre
  // el Dialog y el Select (ver la nota del módulo).
  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const dialogContent = trigger.closest("[data-ego-dialog-content]");
    setPortalContainer(dialogContent instanceof HTMLElement ? dialogContent : null);
  }, []);

  return (
    <SelectPrimitive.Root
      value={controlledValue}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      open={controlledOpen}
      onOpenChange={onOpenChange}
      disabled={disabled}
      name={name}
    >
      <SelectPrimitive.Trigger
        ref={triggerRef}
        id={customId}
        aria-label={ariaLabel}
        title={title}
        className={
          "inline-flex min-h-11 min-w-11 w-full items-center justify-between gap-2 rounded-xl " +
          "border border-white/10 bg-[#1e1e22] px-3 py-2 text-xs text-zinc-200 " +
          "transition-colors cursor-pointer select-none " +
          "hover:border-white/20 hover:text-white " +
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand " +
          "focus-visible:ring-offset-1 focus-visible:ring-offset-black " +
          "disabled:cursor-not-allowed disabled:opacity-50" +
          (className ? ` ${className}` : "") +
          (triggerClassName ? ` ${triggerClassName}` : "")
        }
      >
        <SelectPrimitive.Value placeholder={placeholder}>
          {selectedOption?.label ?? null}
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon asChild>
          <CaretDown
            size={14}
            className="shrink-0 text-zinc-400 transition-transform duration-150"
            aria-hidden
          />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal container={portalContainer ?? undefined}>
        <SelectPrimitive.Content
          sideOffset={4}
          className={
            "z-50 max-h-60 min-w-[8rem] overflow-y-auto rounded-xl border border-white/10 " +
            "bg-[#1e1e22] p-1 text-xs text-zinc-200 shadow-2xl backdrop-blur-xl " +
            "data-[state=open]:animate-in data-[state=closed]:animate-out " +
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 " +
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 " +
            (contentClassName ? ` ${contentClassName}` : "")
          }
        >
          <SelectPrimitive.Viewport>
            {options.length === 0 ? (
              <div className="px-2.5 py-2 text-zinc-500 text-center">Sin opciones</div>
            ) : (
              options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className={
                    "relative flex cursor-pointer select-none items-center justify-between " +
                    "rounded-lg px-2.5 py-2 text-xs outline-none transition-colors " +
                    "data-[highlighted]:bg-white/10 data-[highlighted]:text-white " +
                    "data-[state=checked]:bg-white/15 data-[state=checked]:text-white " +
                    "data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
                  }
                >
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
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
  );
}
