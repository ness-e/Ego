import type { ReactNode } from "react";
import * as RadixTabs from "@radix-ui/react-tabs";
import { CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { cn } from "./cva.js";

/**
 * T06 UI-03 — Tabs base sobre Radix Tabs (roles `tablist`/`tab`/`tabpanel`,
 * teclado flechas y Escape nativos; T07 a11y hereda esto).
 * 9 estados P22: default / hover / active (data-state) / focus
 * (focus-visible) / disabled (por tab) / loading / error / empty / overflow
 * (lista con scroll horizontal).
 */
export interface KitTab {
  value: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: KitTab[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  error?: string;
  empty?: string;
  loading?: boolean;
  ariaLabel?: string;
  /**
   * Clases extra de la RAÍZ del componente (el `<div>` que envuelve la
   * lista de pestañas y sus paneles).
   *
   * ## Por qué existe
   * Antes el kit no ofrecía ningún punto de anclaje y quien necesitaba
   * repartir el alto disponible tenía que acoplarse al DOM interno de Radix
   * con selectores arbitrarios del tipo
   * `[&>div>div>div[role=tabpanel]]:flex-1`. Con esta prop (y
   * `contentClassName`) la cadena de layout se resuelve desde la API:
   *
   * ```tsx
   * <Tabs className="min-h-0 flex-1" contentClassName="min-h-0 flex-1" … />
   * ```
   *
   * La raíz del kit es una columna flex y la raíz de Radix que envuelve
   * `tablist` + `tabpanel` también (ver `RadixTabs.Root` más abajo), así
   * que el alto disponible se reparte sin selectores frágiles.
   */
  className?: string;
  /**
   * Clases extra del PANEL de la pestaña activa (el `div[role=tabpanel]`).
   * Es el sitio donde el contenido crece (`flex-1 min-h-0`).
   */
  contentClassName?: string;
}

export function Tabs({
  tabs,
  defaultValue,
  value,
  onValueChange,
  error,
  empty,
  loading = false,
  ariaLabel = "Pestañas",
  className,
  contentClassName,
}: TabsProps) {
  if (tabs.length === 0) {
    return (
      <div className="flex h-24 flex-col items-center justify-center gap-1 rounded-[var(--radius-card)] border border-dashed border-hairline text-center text-xs">
        <p className="font-medium text-ink">{empty ?? "Sin pestañas"}</p>
      </div>
    );
  }
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-[var(--radius-card)] border border-error/40 bg-error/10 px-3 py-1.5 text-xs text-error"
        >
          <WarningCircle size={14} className="shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}
      <RadixTabs.Root
        defaultValue={defaultValue ?? tabs[0]?.value}
        value={value}
        onValueChange={onValueChange}
        // La raíz de Radix es una COLUMNA FLEX: es lo que permite que el
        // `tabpanel` crezca con `contentClassName="flex-1"` cuando el
        // contenedor tiene alto definido. Sin esto, el panel no hereda el
        // alto del workspace y el consumidor tenía que forzar el layout
        // con selectores arbitrarios sobre el DOM interno de Radix.
        // `grow` (y no `flex-1`) evita colapsar la raíz cuando el
        // contenedor NO tiene alto definido: `flex-1` implica
        // `flex-basis: 0`, que en una columna de alto automático dejaría
        // la raíz (y su contenido) sin altura.
        className="flex grow min-h-0 flex-col"
      >
        <RadixTabs.List
          aria-label={ariaLabel}
          aria-busy={loading || undefined}
          className="flex max-w-full gap-1 overflow-x-auto border-b border-hairline text-xs"
        >
          {tabs.map((t) => (
            <RadixTabs.Trigger
              key={t.value}
              value={t.value}
              disabled={t.disabled ?? loading}
              className={cn(
                "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 font-medium whitespace-nowrap transition-colors cursor-pointer",
                "hover:text-ink focus-visible:outline-2 focus-visible:outline-brand active:scale-[0.99]",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "data-[state=active]:border-ink data-[state=active]:font-semibold data-[state=active]:text-ink",
                "data-[state=inactive]:border-transparent data-[state=inactive]:text-faint",
              )}
            >
              {loading && <CircleNotch size={12} className="animate-spin" aria-hidden />}
              <span className="max-w-[160px] truncate">{t.label}</span>
            </RadixTabs.Trigger>
          ))}
        </RadixTabs.List>
        {tabs.map((t) => (
          <RadixTabs.Content
            key={t.value}
            value={t.value}
            className={cn(
              "min-h-0 focus-visible:outline-2 focus-visible:outline-brand",
              contentClassName,
            )}
          >
            {t.content}
          </RadixTabs.Content>
        ))}
      </RadixTabs.Root>
    </div>
  );
}
