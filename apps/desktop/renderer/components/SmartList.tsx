import React, { useEffect, useRef, useState } from "react";
import { VList } from "virtua";

/**
 * T08 (UI-05) + perf-streaming: lista con windowing honesto.
 * `virtua` necesita layout real (inexistente en happy-dom/tests y en listas
 * cortas): solo virtualiza con N > umbral y `ResizeObserver` disponible;
 * si no, render plano idéntico con `content-visibility:auto` por ítem
 * (virtualización barata del navegador sin cambiar UX/a11y).
 *
 * Claves: `keyOf` DEBE ser un id estable del ítem (nunca el índice) para
 * que insertar/append no re-monte filas ni rompa el ancla de scroll.
 * Follow-on-append: si el usuario está al fondo (stick <64px), el contenedor
 * sigue al último ítem vía rAF; si subió, se preserva su posición y no salta.
 *
 * ## Estilos inline (R2) — excepción acotada y justificada
 * Los 4 `style={{...}}` de este fichero son de virtualización: `maxHeight` es
 * un valor DINÁMICO (prop del componente) y `content-visibility` /
 * `contain-intrinsic-size` no son expresables en Tailwind (son la
 * virtualización barata del navegador). Cada uno lleva su escape hatch
 * `// design-lint: allow` en la línea inmediatamente anterior, que es lo que
 * la puerta de calidad exige (`docs/design/design-system.md` §1).
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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);
  const [, forceStick] = useState(0);

  // Ancla end: rastrea si el usuario está al fondo para follow-on-append.
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const nearEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 64;
    if (nearEnd !== stickRef.current) {
      stickRef.current = nearEnd;
      forceStick((n) => n + 1);
    }
  };

  // Follow-on-append throttled a rAF; preserva ancla si el usuario subió.
  useEffect(() => {
    if (!stickRef.current) return undefined;
    const el = scrollRef.current;
    if (!el) return undefined;
    if (typeof requestAnimationFrame !== "undefined") {
      const raf = requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
      return () => {
        try {
          cancelAnimationFrame(raf);
        } catch {
          /* noop */
        }
      };
    }
    el.scrollTop = el.scrollHeight;
    return undefined;
  }, [items.length]);

  if (items.length === 0) {
    return <>{empty}</>;
  }
  const canVirtualize =
    items.length > threshold &&
    typeof window !== "undefined" &&
    typeof window.ResizeObserver !== "undefined";
  if (!canVirtualize) {
    return (
      // design-lint: allow — `maxHeight` es dinámico (prop): ver cabecera.
      <div style={{ maxHeight }} ref={scrollRef} onScroll={handleScroll} aria-label={ariaLabel} className="overflow-y-auto overflow-anchor-auto">
        {items.map((item, i) => (
          // design-lint: allow — virtualización barata del navegador.
          <div key={keyOf(item, i)} style={{ contentVisibility: "auto", containIntrinsicSize: `auto ${estimatedItemHeight}px` }}>
            {renderItem(item, i)}
          </div>
        ))}
      </div>
    );
  }
  // Un único contenedor de scroll (VList). Sin wrapper con overflow anidado:
  // el doble scroll rompía el ancla y duplicaba mediciones de layout.
  return (
    // design-lint: allow — `maxHeight` es dinámico (prop): ver cabecera.
    <VList style={{ maxHeight }} itemSize={estimatedItemHeight} aria-label={ariaLabel}>
      {items.map((item, i) => (
        // design-lint: allow — virtualización barata del navegador.
        <div key={keyOf(item, i)} style={{ contentVisibility: "auto", containIntrinsicSize: `auto ${estimatedItemHeight}px` }}>
          {renderItem(item, i)}
        </div>
      ))}
    </VList>
  );
}
