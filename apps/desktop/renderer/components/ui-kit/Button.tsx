import {
  forwardRef,
  isValidElement,
  type ComponentPropsWithRef,
  type ReactNode,
} from "react";
import { CircleNotch } from "@phosphor-icons/react";
import { cva, cn } from "./cva.js";

/**
 * T06 UI-03 — Button del kit (densidad revisada por el owner 2026-10-20).
 *
 * ## 9 estados P22
 * default / hover / active (scale) / focus (focus-visible) / disabled /
 * loading (aria-busy + spinner) / error (variant `danger`) / empty (sin
 * children → mantiene el objetivo táctil) / overflow (truncate).
 *
 * ## Densidad (decisión del owner 2026-10-20)
 * - `sm` = 28 px · `md` = 32 px · `lg` = 44 px (CTA táctil) · `icon` = 44×44.
 * - Un botón **con etiqueta visible** puede medir 32 px: la regla antigua de
 *   "44 px universal" queda sustituida por el criterio real de WCAG 2.2
 *   (target size), que distingue entre control con etiqueta y control
 *   sólo-icono.
 * - Un botón **sólo-icono** (sin texto visible) es SIEMPRE 44×44
 *   (`min-h-11 min-w-11`), en cualquier tamaño, porque sin etiqueta el
 *   área pulsable es la única pista de affordance.
 *
 * ## Colores
 * `primary` conserva `bg-ink text-paper` (botón claro con texto oscuro). Su
 * hover usa `hover:bg-ink/90` —alpha SÓLO en el fondo— en vez de
 * `hover:opacity-90`, que atenuaría también el TEXTO y rompería el
 * contraste AA. Ningún hex: sólo tokens del sistema.
 */
const buttonVariants = cva({
  base: "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-card)] font-medium select-none cursor-pointer overflow-hidden transition-colors duration-[var(--motion-duration-micro)] ease-[var(--motion-ease-out)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
  variants: {
    variant: {
      primary: "bg-ink text-paper hover:bg-ink/90",
      secondary:
        "border border-hairline bg-raised text-ink hover:border-strong hover:bg-panel",
      ghost: "text-faint hover:bg-raised hover:text-ink",
      danger: "border border-error/40 bg-error/10 text-error hover:bg-error/20",
      // CTA de accent: ámbar del sistema + texto de alto contraste (`text-on-brand`).
      accent: "bg-brand text-on-brand hover:bg-brand/90",
    },
    size: {
      sm: "h-7 px-2 text-xs",
      md: "h-8 px-3 text-xs",
      lg: "h-11 px-4 text-sm",
      icon: "h-11 w-11 px-0",
    },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

/**
 * ¿El botón tiene TEXTO VISIBLE?
 * Distingue `<Button>Guardar</Button>` (32 px según `size`) de
 * `<Button><Icon/></Button>` (44×44 obligatorio). Se recorre el árbol de
 * `children` porque un icono envuelto en un `<span>` sigue siendo un botón
 * sólo-icono.
 */
function hasVisibleText(children: ReactNode): boolean {
  if (children === null || children === undefined || typeof children === "boolean") {
    return false;
  }
  if (typeof children === "string") return children.trim().length > 0;
  if (typeof children === "number") return true;
  if (Array.isArray(children)) return children.some(hasVisibleText);
  if (isValidElement(children)) {
    const elementProps = children.props as { children?: ReactNode };
    return hasVisibleText(elementProps.children);
  }
  return false;
}

export interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "accent";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  truncate?: boolean;
  /**
   * Icono a la izquierda de la etiqueta.
   *
   * ## Por qué existe (sustituye al hack `[&>span]:flex`)
   * El `<span>` interno del botón envuelve los `children`, así que un icono
   * pasado como hijo quedaba **dentro** de ese span y el `gap-1.5` del base
   * (que vive en el `<button>`) no lo separaba de la etiqueta. Cada
   * consumidor lo resolvía con el selector arbitrario
   * `[&>span]:flex [&>span]:items-center [&>span]:gap-1.5`, acoplándose al
   * DOM interno del kit.
   *
   * Con `icon` el icono se renderiza como hermano **anterior** al `<span>`
   * de contenido, de modo que el `gap-1.5` del base separa icono y etiqueta
   * sin tocar el DOM interno ni delinear selectores arbitrarios.
   *
   * ## Contrato
   * - El icono es **decorativo**: se marca `aria-hidden` (el nombre accesible
   *   lo aporta la etiqueta o el `aria-label` del botón).
   * - El icono **no cuenta como texto visible**: `<Button icon={<X/>} />`
   *   sigue siendo un botón sólo-icono y por tanto mantiene el objetivo
   *   táctil de 44×44 (`min-h-11 min-w-11`).
   */
  icon?: ReactNode;
}

/**
 * Button del kit.
 *
 * ## `forwardRef` explícito (no implícito por `...rest`)
 * Antes el componente declaraba `ComponentPropsWithRef<"button">` y dejaba
 * que el `ref` viajara dentro de `...rest` hasta el `<button>`. En React 19
 * eso funciona, pero el contrato era **implícito**: el tipo del `ref` no
 * estaba ligado al nodo real y `React.ElementRef<"button">` no se cumplía.
 * Radix lo exige de verdad: `Menu` y `Popover` montan el `Button` del kit
 * como trigger con `asChild`, y el `Slot` de Radix inyecta un `ref` en el
 * hijo. Con `forwardRef` el `ref` llega **tipado** al `<button>`.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    truncate = false,
    disabled,
    icon,
    children,
    className,
    // `type="button"` por defecto: un botón dentro de un `<form>` no debe
    // enviar el formulario por sorpresa. El consumidor puede sobrescribirlo.
    type = "button",
    ...rest
  },
  ref,
) {
  // `loading` SIEMPRE deshabilita (aunque el consumidor pase
  // `disabled={false}`): un control en carga no debe ser pulsable.
  const isDisabled = Boolean(disabled) || loading;
  // Estado `empty`/sólo-icono: objetivo táctil de 44×44 en cualquier tamaño.
  // El `icon` NO cuenta como texto visible (ver `ButtonProps.icon`).
  const iconOnly = !hasVisibleText(children);
  return (
    <button
      ref={ref}
      {...rest}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-live={loading ? "polite" : undefined}
      className={cn(
        buttonVariants({ variant, size }),
        iconOnly && "min-h-11 min-w-11",
        // El `truncate` va en el botón (para que el test de overflow lo vea)
        // y en el span (para que el texto largo se corte de verdad).
        truncate && "max-w-full truncate",
        className,
      )}
    >
      {loading && (
        <CircleNotch size={13} className="animate-spin shrink-0" aria-hidden />
      )}
      {/* El icono va como hermano del `<span>` de contenido: así el
          `gap-1.5` del base (que vive en el `<button>`) lo separa de la
          etiqueta sin que el consumidor necesite `[&>span]:flex`. Al estar
          FUERA del span que trunca, un texto largo no deforma el icono. */}
      {icon && (
        <span className="shrink-0" aria-hidden>
          {icon}
        </span>
      )}
      {/* El contenido va en una fila flex: así un `<Button><Icon/> Texto</Button>`
          alinea icono y etiqueta sin que cada consumidor tenga que forzar el
          layout con `[&>span]:flex`. `min-w-0` permite que el texto se
          recorte (`truncate`) sin desbordar el botón. */}
      <span className={cn("inline-flex min-w-0 items-center gap-1.5", truncate && "truncate")}>
        {children}
      </span>
    </button>
  );
});

Button.displayName = "Button";
