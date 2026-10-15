import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import type { DesignSystemTokens } from "@ego/ui-runtime";

export interface DesignSystemContextValue {
  tokens: DesignSystemTokens;
  setTokens: React.Dispatch<React.SetStateAction<DesignSystemTokens>>;
  applyPreset: (presetId: string) => void;
  availablePresets: Record<string, DesignSystemTokens>;
}

export const DEFAULT_DESIGN_TOKENS: DesignSystemTokens = {
  id: "theme-default-dark",
  name: "Slate Oscuro (Por Defecto)",
  version: 1,
  colors: {
    brand: "#38bdf8",
    background: "#09090b",
    panel: "#141416",
    raised: "#202024",
    text: "#fafafa",
    muted: "#a1a1aa",
    border: "#27272a",
    success: "#10b981",
    warning: "#f59e0b",
    error: "#f43f5e",
  },
  geometry: {
    radius: "md",
    density: "comfortable",
  },
  typography: {
    fontFamily: "sans",
    baseSizePx: 13,
  },
};

export const PRESET_THEMES: Record<string, DesignSystemTokens> = {
  "default-dark": DEFAULT_DESIGN_TOKENS,
  "midnight-cyan": {
    id: "theme-midnight-cyan",
    name: "Medianoche Cyan",
    version: 1,
    colors: {
      brand: "#06b6d4",
      background: "#030712",
      panel: "#0f172a",
      raised: "#1e293b",
      text: "#f8fafc",
      muted: "#94a3b8",
      border: "#334155",
      success: "#10b981",
      warning: "#f59e0b",
      error: "#ef4444",
    },
    geometry: {
      radius: "lg",
      density: "compact",
    },
    typography: {
      fontFamily: "mono",
      baseSizePx: 12,
    },
  },
  "emerald-terminal": {
    id: "theme-emerald-terminal",
    name: "Terminal Esmeralda",
    version: 1,
    colors: {
      brand: "#10b981",
      background: "#022c22",
      panel: "#064e3b",
      raised: "#065f46",
      text: "#ecfdf5",
      muted: "#6ee7b7",
      border: "#047857",
      success: "#34d399",
      warning: "#fbbf24",
      error: "#f87171",
    },
    geometry: {
      radius: "sm",
      density: "compact",
    },
    typography: {
      fontFamily: "mono",
      baseSizePx: 12,
    },
  },
  "amber-warm": {
    id: "theme-amber-warm",
    name: "Ámbar Cálido",
    version: 1,
    colors: {
      brand: "#f59e0b",
      background: "#1c1917",
      panel: "#292524",
      raised: "#44403c",
      text: "#fef3c7",
      muted: "#d6d3d1",
      border: "#57534e",
      success: "#10b981",
      warning: "#f59e0b",
      error: "#ef4444",
    },
    geometry: {
      radius: "md",
      density: "comfortable",
    },
    typography: {
      fontFamily: "sans",
      baseSizePx: 13,
    },
  },
};

const DesignSystemContext = createContext<DesignSystemContextValue | null>(null);

/**
 * T05: resuelve tanto la clave del preset ("midnight-cyan") como su id de
 * tokens ("theme-midnight-cyan"). El `select` de ThemeControl trabaja con
 * claves; aceptar ids mantiene compatibilidad con llamadores existentes.
 */
export function resolvePresetKey(idOrKey: string): string | undefined {
  if (PRESET_THEMES[idOrKey]) return idOrKey;
  const hit = Object.entries(PRESET_THEMES).find(([, p]) => p.id === idOrKey);
  return hit?.[0];
}

const THEME_STORAGE_KEY = "ego:theme-preset";

function loadPersistedPresetKey(): string | undefined {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved && resolvePresetKey(saved)) return resolvePresetKey(saved);
  } catch {
    // Sin storage (tests/SSR): default.
  }
  return undefined;
}

/** Clave canónica del preset actualmente aplicado (para persistencia). */
export function presetKeyOf(tokens: DesignSystemTokens): string {
  return (
    Object.entries(PRESET_THEMES).find(([, p]) => p.id === tokens.id)?.[0] ??
    "default-dark"
  );
}

const RADIUS_MAP: Record<string, string> = {
  none: "0px",
  sm: "4px",
  md: "8px",
  lg: "14px",
  full: "9999px",
};

const DENSITY_PAD_MAP: Record<string, string> = {
  compact: "0.25rem",
  comfortable: "0.5rem",
  spacious: "0.75rem",
};

const FONT_STACK_MAP: Record<string, string> = {
  sans: '"Geist", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  mono: '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  serif: 'ui-serif, Georgia, serif',
};

/**
 * T-contraste: tokens FIJOS del sistema (no derivan del preset).
 * - `FIXED_DIM` #8a8a92 ≈5.8:1 sobre paper (AA). El provider NUNCA lo pisa
 *   con `muted` del preset sin medir cada preset (riesgo emerald-terminal
 *   verdoso: rompería el AA silenciosamente).
 * - `FIXED_BORDER_STRONG` #52525b ≈2.4:1 sobre panel (medido 2026-10-14:
 *   NO alcanza 3:1 como color único → bordes siempre con 2º indicador).
 * - `FIXED_FOCUS_RING` #f59e0b ≈9.2:1 sobre paper (componente UI ≥3:1 ✅).
 * - `FIXED_TEXT_ON_BRAND` #0a0a0b sobre ámbar ≈9.2:1 ✅.
 */
const FIXED_BORDER_STRONG = "#52525b";
const FIXED_FOCUS_RING = "#f59e0b";
const FIXED_TEXT_ON_BRAND = "#0a0a0b";
const FIXED_DIM = "#8a8a92";
const FIXED_CHART_INDIGO = "#818cf8";
const FIXED_CHART_VIOLET = "#a78bfa";

function radiusOf(radius: string): string {
  return RADIUS_MAP[radius] || "8px";
}

function densityPadOf(density: string): string {
  return DENSITY_PAD_MAP[density] || "0.5rem";
}

function fontStackOf(family: string): string {
  return FONT_STACK_MAP[family] || FONT_STACK_MAP.sans;
}

export const useDesignSystem = (): DesignSystemContextValue => {
  const ctx = useContext(DesignSystemContext);
  if (!ctx) {
    throw new Error("useDesignSystem debe usarse dentro de un DesignSystemProvider");
  }
  return ctx;
};

interface DesignSystemProviderProps {
  initialTokens?: DesignSystemTokens;
  children: React.ReactNode;
}

export const DesignSystemProvider: React.FC<DesignSystemProviderProps> = ({
  initialTokens = DEFAULT_DESIGN_TOKENS,
  children,
}) => {
  const [tokens, setTokens] = useState<DesignSystemTokens>(() => {
    const persisted = loadPersistedPresetKey();
    return persisted ? PRESET_THEMES[persisted] : initialTokens;
  });

  const applyPreset = (presetId: string) => {
    const key = resolvePresetKey(presetId);
    if (key) {
      setTokens(PRESET_THEMES[key]);
    }
  };

  // 2026-10-15 (tema real): el puente `@theme → var(--ego-*)` de index.css
  // NO propaga presets. Las custom properties con `var()` se resuelven donde
  // se DEFINEN (`:root`), no donde se usan: el fallback ganaba siempre
  // (verificado en browser: `--color-panel` computaba `#111113` con preset
  // esmeralda activo). Por eso se escriben los valores RESUELTOS en
  // `documentElement`: llega a todo, incluidos portales Radix fuera del div.
  // Las `--ego-*` del div se conservan (tests + referencia directa).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement.style;
    const c = tokens.colors;
    root.setProperty("--color-brand", c.brand);
    root.setProperty("--color-ink", c.text);
    root.setProperty("--color-paper", c.background);
    root.setProperty("--color-panel", c.panel);
    root.setProperty("--color-raised", c.raised);
    root.setProperty("--color-hairline", c.border);
    root.setProperty("--color-faint", c.muted);
    root.setProperty("--radius-card", radiusOf(tokens.geometry.radius));
    // T-contraste: fijos del sistema (no del preset). `--color-dim` NO se
    // deriva de `c.muted`: queda anclado a #8a8a92 hasta medir cada preset.
    root.setProperty("--color-strong", FIXED_BORDER_STRONG);
    root.setProperty("--color-border-strong", FIXED_BORDER_STRONG);
    root.setProperty("--color-focus-ring", FIXED_FOCUS_RING);
    root.setProperty("--color-on-brand", FIXED_TEXT_ON_BRAND);
    root.setProperty("--color-text-on-brand", FIXED_TEXT_ON_BRAND);
    root.setProperty("--color-dim", FIXED_DIM);
    root.setProperty("--color-success", c.success);
    root.setProperty("--color-warning", c.warning);
    root.setProperty("--color-error", c.error);
    root.setProperty("--color-chart-indigo", FIXED_CHART_INDIGO);
    root.setProperty("--color-chart-violet", FIXED_CHART_VIOLET);
    root.setProperty("--ego-color-border-strong", FIXED_BORDER_STRONG);
    root.setProperty("--ego-color-focus-ring", FIXED_FOCUS_RING);
    root.setProperty("--ego-color-text-on-brand", FIXED_TEXT_ON_BRAND);
    root.setProperty("--ego-color-dim", FIXED_DIM);
    root.setProperty("--ego-color-success", c.success);
    root.setProperty("--ego-color-warning", c.warning);
    root.setProperty("--ego-color-error", c.error);
    root.setProperty("--ego-color-chart-indigo", FIXED_CHART_INDIGO);
    root.setProperty("--ego-color-chart-violet", FIXED_CHART_VIOLET);
    root.setProperty("--font-sans", fontStackOf(tokens.typography.fontFamily));
    try {
      localStorage.setItem(THEME_STORAGE_KEY, presetKeyOf(tokens));
    } catch {
      // Sin storage: el preset vive solo en memoria.
    }
  }, [tokens]);

  const cssVariables = useMemo(() => {
    const fontMap: Record<string, string> = {
      sans: "var(--font-geist-sans, ui-sans-serif, system-ui)",
      mono: "var(--font-geist-mono, ui-monospace, monospace)",
      serif: "ui-serif, Georgia, serif",
    };

    return {
      "--ego-color-brand": tokens.colors.brand,
      "--ego-color-bg": tokens.colors.background,
      "--ego-color-panel": tokens.colors.panel,
      "--ego-color-raised": tokens.colors.raised,
      "--ego-color-text": tokens.colors.text,
      "--ego-color-muted": tokens.colors.muted,
      "--ego-color-border": tokens.colors.border,
      "--ego-color-success": tokens.colors.success,
      "--ego-color-warning": tokens.colors.warning,
      "--ego-color-error": tokens.colors.error,
      // T-contraste: fijos del sistema; el preset no los gobierna.
      "--ego-color-border-strong": FIXED_BORDER_STRONG,
      "--ego-color-focus-ring": FIXED_FOCUS_RING,
      "--ego-color-text-on-brand": FIXED_TEXT_ON_BRAND,
      "--ego-color-dim": FIXED_DIM,
      "--ego-color-chart-indigo": FIXED_CHART_INDIGO,
      "--ego-color-chart-violet": FIXED_CHART_VIOLET,
      "--ego-radius": radiusOf(tokens.geometry.radius),
      "--ego-density-pad": densityPadOf(tokens.geometry.density),
      "--ego-font-family": fontMap[tokens.typography.fontFamily] || "sans-serif",
      "--ego-font-size": `${tokens.typography.baseSizePx}px`,
    } as React.CSSProperties;
  }, [tokens]);

  const value = useMemo(
    () => ({
      tokens,
      setTokens,
      applyPreset,
      availablePresets: PRESET_THEMES,
    }),
    [tokens]
  );

  return (
    <DesignSystemContext.Provider value={value}>
      <div
        id="ego-design-system-root"
        style={cssVariables}
        className="h-full w-full transition-colors duration-200"
      >
        {children}
      </div>
    </DesignSystemContext.Provider>
  );
};
