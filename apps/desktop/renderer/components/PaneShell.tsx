import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";

export interface SplitPaneProps {
  id: string;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  isCollapsed?: boolean;
  onWidthChange?: (width: number) => void;
  children: ReactNode;
  side: "left" | "right";
  className?: string;
}

function getStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * SplitPane — Panel lateral ajustable con persistencia en localStorage y límites elásticos.
 * Extraído y adaptado de Hermes Agent (HERM-09) para Ego SOC.
 */
export function SplitPane({
  id,
  defaultWidth = 320,
  minWidth = 240,
  maxWidth = 600,
  isCollapsed = false,
  onWidthChange,
  children,
  side,
  className = "",
}: SplitPaneProps) {
  const storageKey = `ego:pane-width:${id}`;

  const [width, setWidth] = useState<number>(() => {
    const storage = getStorage();
    if (storage) {
      try {
        const saved = storage.getItem(storageKey);
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
            return parsed;
          }
        }
      } catch {
        // ignore
      }
    }
    return defaultWidth;
  });

  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(width);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      startX.current = e.clientX;
      startWidth.current = width;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDragging.current) return;
        const delta =
          side === "left"
            ? moveEvent.clientX - startX.current
            : startX.current - moveEvent.clientX;

        const nextWidth = Math.min(
          maxWidth,
          Math.max(minWidth, startWidth.current + delta)
        );

        setWidth(nextWidth);
        onWidthChange?.(nextWidth);
      };

      const handleMouseUp = () => {
        isDragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        try {
          getStorage()?.setItem(storageKey, String(width));
        } catch {
          // ignore
        }
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [width, side, minWidth, maxWidth, onWidthChange, storageKey]
  );

  const handleDoubleClick = () => {
    setWidth(defaultWidth);
    onWidthChange?.(defaultWidth);
    try {
      getStorage()?.setItem(storageKey, String(defaultWidth));
    } catch {
      // ignore
    }
  };

  // WCAG 2.2 AA (2.1.1 + 4.1.2): divisor operable por teclado como separator.
  // Flechas ±8px, Esc restablece al ancho por defecto.
  const clampWidth = useCallback(
    (next: number) => Math.min(maxWidth, Math.max(minWidth, next)),
    [minWidth, maxWidth],
  );

  const handleSeparatorKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = 8;
      const delta =
        e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0;
      if (delta !== 0) {
        e.preventDefault();
        const oriented = side === "left" ? delta : -delta;
        const next = clampWidth(width + oriented);
        setWidth(next);
        onWidthChange?.(next);
        return;
      }
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const oriented = e.key === "ArrowUp" ? step : -step;
        const next = clampWidth(width + (side === "left" ? oriented : -oriented));
        setWidth(next);
        onWidthChange?.(next);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setWidth(defaultWidth);
        onWidthChange?.(defaultWidth);
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        setWidth(minWidth);
        onWidthChange?.(minWidth);
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        setWidth(maxWidth);
        onWidthChange?.(maxWidth);
      }
    },
    [width, side, defaultWidth, minWidth, maxWidth, onWidthChange, clampWidth],
  );

  useEffect(() => {
    try {
      getStorage()?.setItem(storageKey, String(width));
    } catch {
      // ignore
    }
  }, [width, storageKey]);

  if (isCollapsed) {
    return null;
  }

  return (
    <div
      style={{ width }}
      className={`relative flex h-full shrink-0 flex-col overflow-hidden bg-panel transition-[width] duration-75 ${className}`}
      data-pane-id={id}
    >
      <div className="flex-1 overflow-hidden min-h-0 min-w-0">{children}</div>

      {/* Divisor interactivo (WCAG 2.2 AA: separator con valor + teclado) */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(width)}
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        aria-label={`Redimensionar panel ${id}. Flechas ajustan 8 píxeles, Escape restablece.`}
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleSeparatorKeyDown}
        title="Arrastra para cambiar ancho · Doble clic para restablecer"
        className={`absolute inset-y-0 ${
          side === "left" ? "right-0" : "left-0"
        } w-1 cursor-col-resize hover:bg-brand/40 active:bg-brand transition-colors z-20 focus-visible:bg-brand/60 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1`}
      />
    </div>
  );
}
