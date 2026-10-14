import React from "react";
import { VList } from "virtua";

/**
 * T08 (UI-05): lista con windowing honesto. `virtua` necesita layout real
 * (inexistente en happy-dom/tests y en listas cortas): solo virtualiza con
 * N > umbral y `ResizeObserver` disponible; si no, render plano idéntico.
 */
export interface SmartListProps<T> {
  items: T[];
  threshold?: number;
  maxHeight?: number;
  estimatedItemHeight?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  keyOf: (item: T, index: number) => string | number;
  empty?: React.ReactNode;
  ariaLabel?: string;
}

export function SmartList<T>({
  items,
  threshold = 20,
  maxHeight = 300,
  estimatedItemHeight = 48,
  renderItem,
  keyOf,
  empty,
  ariaLabel,
}: SmartListProps<T>) {
  if (items.length === 0) {
    return <>{empty}</>;
  }
  const canVirtualize =
    items.length > threshold &&
    typeof window !== "undefined" &&
    typeof window.ResizeObserver !== "undefined";
  if (!canVirtualize) {
    return (
      <div aria-label={ariaLabel}>
        {items.map((item, i) => (
          <React.Fragment key={keyOf(item, i)}>{renderItem(item, i)}</React.Fragment>
        ))}
      </div>
    );
  }
  return (
    <div style={{ maxHeight }} className="overflow-y-auto" aria-label={ariaLabel}>
      <VList
        style={{ height: Math.min(maxHeight, items.length * estimatedItemHeight) }}
      >
        {items.map((item, i) => (
          <div key={keyOf(item, i)}>{renderItem(item, i)}</div>
        ))}
      </VList>
    </div>
  );
}
