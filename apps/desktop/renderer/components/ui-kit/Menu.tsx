import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, CircleNotch } from "@phosphor-icons/react";
import { useRef, useState, type ReactNode } from "react";
import { cn } from "./cva.js";
import { usePortalHost } from "./portalHost.js";

export interface MenuItem {
  /** Texto de la acción. */
  label: string;
  /** Se invoca al seleccionar la acción (clic, Enter o Espacio). */
  onSelect?: () => void;
  /** Acción no disponible (se pinta atenuada y no se puede seleccionar). */
  disabled?: boolean;
  /** Acción destructiva: se pinta en rojo y con highlight rojo. */
  danger?: boolean;
  /** Icono opcional a la izquierda de la etiqueta. */
  icon?: ReactNode;
  /** Atajo de teclado shown a la derecha (informativo, no ejecuta nada). */
  shortcut?: string;
  /**
   * Estado seleccionado ("uno de" / radio).
   *
   * - **Presente** (sea `true` o `false`) → el ítem se renderiza como
   *   `RadioItem` de Radix (`role="menuitemradio"` + `aria-checked`) y el
   *   menú se convierte en un grupo de opciones excluyentes.
   * - **Ausente** (`undefined`) → el ítem se renderiza como acción normal
   *   (`role="menuitem"`), igual que hasta ahora.
   *
   * ## Quién manda: el consumidor
   * Si algún ítem llega con `checked={true}`, ese `checked` es la fuente de
   * verdad: la marca se queda donde el consumidor la puso y se mueve cuando
   * el consumidor re-renderiza con otro `checked` (típicamente desde el
   * `onSelect` del ítem). Si **ningún** ítem llega marcado, el kit mueve la
   * marca por su cuenta al seleccionar (modo no controlado).
   */
  checked?: boolean;
}

export interface MenuProps {
  /**
   * Elemento que abre el menú. Debe ser un `<button>` (o un componente que
   * propague `ref` y `disabled`, como el `Button` del kit): Radix lo
   * enhancea con `aria-haspopup`, `aria-expanded` y `data-state`.
   */
  trigger: ReactNode;
  items: MenuItem[];
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  /**
   * Nombre accesible del menú (`role="menu"`).
   *
   * ⚠️ **En la práctica NO es lo que nombra al menú.** Radix fija
   * `aria-labelledby` al *trigger* del menú, y en el cálculo del nombre
   * accesible `aria-labelledby` tiene prioridad sobre `aria-label`: el
   * nombre real del menú es, por tanto, el del botón que lo abre. La prop
   * se conserva (retro-compatible y como red de seguridad cuando el trigger
   * no tiene texto visible, caso en el que sí es el único nombre), pero no
   * se promete aquí ningún nombre accesible que la librería no va a dar.
   */
  ariaLabel?: string;
  /** Clase extra del disparador. */
  className?: string;
  /** Clase extra del panel del menú. */
  contentClassName?: string;
  /**
   * Estado de apertura **controlado** (opcional). Si se omite, el menú
   * gestiona su propio estado (como el `Popover` del kit).
   */
  open?: boolean;
  /** Callback del estado de apertura controlado. */
  onOpenChange?: (open: boolean) => void;
  /** Estado `loading`: muestra spinner y bloquea las acciones. */
  loading?: boolean;
  /** Estado `error`: mensaje `role="alert"` en la cabecera del menú. */
  error?: string;
}

/**
 * Menú contextual del kit sobre `@radix-ui/react-dropdown-menu`.
 *
 * ## Por qué Radix (no un dropdown propio)
 * El teclado (flechas, Inicio/Fin, Escape, type-ahead), el retorno del foco
 * al trigger, los roles `menu`/`menuitem` y la navegación con lector de
 * pantalla son comportamiento no trivial: reimplementarlo violaría el
 * principio D3 (primitives de librería siempre) y es exactamente lo que
 * este componente sustituye (`components/SubEgoSelector.tsx`, que hacía
 * cierre por `mousedown` fuera y no tenía navegación por teclado).
 *
 * ## `modal={false}` ( deliberado)
 * El `DropdownMenu` de Radix es modal por defecto: su contenido atrapa el
 * foco dentro de un `FocusScope`. Dentro de un `Modal` del kit (Dialog de
 * Radix) dos `FocusScope` atrapados compiten por el foco → ping-pong
 * `focusin` → `RangeError: Maximum call stack size exceeded` (el mismo
 * problema documentado en `Select.tsx`). Con `modal={false}` el menú no
 * atrapa el foco y convive con el diálogo sin conflictos.
 *
 * ## Portal al contenedor del diálogo
 * `usePortalHost` portalea el panel dentro del `Dialog.Content` anfitrión
 * (`data-ego-dialog-content`) cuando existe: así el clic dentro del menú no
 * lo interpreta el diálogo como "clic exterior" y no lo cierra.
 *
 * ## 9 estados P22
 * default / hover (`data-[highlighted]`) / active (selección por teclado) /
 * focus (`focus-visible`) / disabled (por ítem o `loading`) / loading
 * (spinner) / error (fila `role="alert"`) / empty ("Sin acciones") /
 * overflow (panel con scroll).
 *
 * ## Estado "uno de" (radio)
 * Radix deriva el `checked` de un `RadioItem` del `value` de su
 * `RadioGroup` (no de una prop `checked` del ítem). El kit traduce el
 * `checked` por ítem a ese `value`:
 * - Si algún ítem llega con `checked === true`, ese valor manda (modo
 *   controlado): la marca se mueve cuando el consumidor re-renderiza.
 * - Si ningún ítem llega marcado, el kit recuerda internamente la última
 *   opción seleccionada y mueve la marca por su cuenta (modo no controlado).
 */
export function Menu({
  trigger,
  items,
  align = "start",
  side = "bottom",
  sideOffset = 6,
  ariaLabel = "Menú",
  className,
  contentClassName,
  open,
  onOpenChange,
  loading = false,
  error,
}: MenuProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const portalHost = usePortalHost(triggerRef);
  const isEmpty = items.length === 0;

  // --- Estado "uno de" (radio) -------------------------------------------
  // `hasRadio`: hay al menos un ítem con la prop `checked` PRESENTE (sean
  // `true` o `false`): esos ítems son opciones excluyentes y el menú se
  // monta dentro de un `RadioGroup` (Radix EXIGE ese contexto para un
  // `RadioItem`).
  const hasRadio = items.some((item) => item.checked !== undefined);
  // Valor del grupo marcado por el CONSUMIDOR (fuente de verdad).
  const checkedIndex = items.findIndex((item) => item.checked === true);
  const controlledRadioValue = checkedIndex >= 0 ? radioValueOf(checkedIndex) : undefined;
  // Valor elegido por el usuario (modo no controlado: sólo se usa si el
  // consumidor no marca ningún ítem).
  const [uncontrolledRadioValue, setUncontrolledRadioValue] = useState<string | undefined>(undefined);
  const radioValue = controlledRadioValue ?? uncontrolledRadioValue;

  const itemNodes = items.map((item, index) => {
    const isRadio = item.checked !== undefined;
    const itemClassName = cn(
      "flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-ink outline-none transition-colors",
      "data-[highlighted]:bg-panel data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
      item.danger && "text-error data-[highlighted]:bg-error/10",
    );
    const content = (
      <>
        {/* Columna de la marca: hueco de ancho FIJO para que la fila no
            "salte" horizontalmente al aparecer o desaparecer el check. */}
        {isRadio && (
          <span className="flex w-3 shrink-0 items-center justify-center" aria-hidden>
            <MenuPrimitive.ItemIndicator className="flex items-center">
              <Check size={12} className="text-brand" />
            </MenuPrimitive.ItemIndicator>
          </span>
        )}
        {item.icon && (
          <span className="shrink-0 text-faint" aria-hidden>
            {item.icon}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {item.shortcut && (
          <span className="shrink-0 font-mono text-xs text-dim">
            {item.shortcut}
          </span>
        )}
      </>
    );
    return isRadio ? (
      <MenuPrimitive.RadioItem
        key={`${item.label}-${index}`}
        value={radioValueOf(index)}
        disabled={item.disabled || loading}
        onSelect={item.onSelect}
        className={itemClassName}
      >
        {content}
      </MenuPrimitive.RadioItem>
    ) : (
      <MenuPrimitive.Item
        key={`${item.label}-${index}`}
        disabled={item.disabled || loading}
        onSelect={item.onSelect}
        className={itemClassName}
      >
        {content}
      </MenuPrimitive.Item>
    );
  });

  return (
    <MenuPrimitive.Root modal={false} open={open} onOpenChange={onOpenChange}>
      <MenuPrimitive.Trigger
        ref={triggerRef}
        asChild
        disabled={isEmpty || loading}
        className={className}
      >
        {trigger}
      </MenuPrimitive.Trigger>
      <MenuPrimitive.Portal container={portalHost ?? undefined}>
        <MenuPrimitive.Content
          align={align}
          side={side}
          sideOffset={sideOffset}
          collisionPadding={8}
          aria-label={ariaLabel}
          className={cn(
            "z-50 max-h-60 min-w-[10rem] overflow-y-auto rounded-[var(--radius-card)] border border-hairline bg-raised p-1 text-xs text-ink shadow-[var(--ego-elevation-l2)]",
            "transition-[opacity,transform] duration-150 ease-[var(--motion-ease-out)] starting:opacity-0 starting:scale-95 data-[state=open]:opacity-100 data-[state=open]:scale-100",
            contentClassName,
          )}
        >
          {error && (
            <div
              role="alert"
              className="mb-1 rounded-lg border border-error/40 bg-error/10 px-2 py-1 text-xs text-error"
            >
              {error}
            </div>
          )}
          {loading && (
            <div
              aria-live="polite"
              className="flex items-center gap-2 px-2 py-1.5 text-xs text-dim"
            >
              <CircleNotch size={12} className="animate-spin" aria-hidden />
              <span>Cargando…</span>
            </div>
          )}
          {isEmpty ? (
            <div className="px-2.5 py-2 text-center text-faint">Sin acciones</div>
          ) : hasRadio ? (
            <MenuPrimitive.RadioGroup
              value={radioValue}
              onValueChange={(value) => setUncontrolledRadioValue(value)}
            >
              {itemNodes}
            </MenuPrimitive.RadioGroup>
          ) : (
            itemNodes
          )}
        </MenuPrimitive.Content>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}

/**
 * Valor interno de un ítem dentro del grupo "uno de".
 *
 * Radix exige un `value` único por `RadioItem` y lo usa como clave del
 * grupo. El kit no expone ese valor al consumidor (la API pública es
 * `checked: boolean`), así que se deriva del ÍNDICE del ítem: es estable
 * mientras el orden de la lista no cambie, que es exactamente la vida útil
 * del estado del menú.
 */
function radioValueOf(index: number): string {
  return `ego-menu-item-${index}`;
}
