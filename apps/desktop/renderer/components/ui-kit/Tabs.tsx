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
}: TabsProps) {
  if (tabs.length === 0) {
    return (
      <div className="flex h-24 flex-col items-center justify-center gap-1 rounded-[var(--radius-card)] border border-dashed border-hairline text-center text-xs">
        <p className="font-medium text-ink">{empty ?? "Sin pestañas"}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-[var(--radius-card)] border border-red-800/40 bg-red-950/40 px-3 py-1.5 text-[11px] text-red-300"
        >
          <WarningCircle size={14} className="shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}
      <RadixTabs.Root
        defaultValue={defaultValue ?? tabs[0]?.value}
        value={value}
        onValueChange={onValueChange}
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
            className="min-h-0 focus-visible:outline-2 focus-visible:outline-brand"
          >
            {t.content}
          </RadixTabs.Content>
        ))}
      </RadixTabs.Root>
    </div>
  );
}
