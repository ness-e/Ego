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
  name: "Obsidian Graphite · Slate Oscuro",
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
    name: "Midnight Cyan · Medianoche Cyan",
    version: 1,
    colors: {
      brand: "#06b6d4",
      background: "#030712",
      panel: "#0f172a",
      // EGO-FIND-71 FIND-A11Y-04: dim fijo #8a8a92 sobre raised #1e293b = 4.27:1
      // (< 4.5:1). Superficie oscurecida a #1a2536 → 4.50:1
      // (OKLCH: L 0.279 → 0.262, C 0.037 y H 260 conservados).
      raised: "#1a2536",
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
    name: "Emerald Studio",
    version: 1,
    colors: {
      brand: "#10b981",
      // EGO-FIND-71 (FIND-A11Y-05/02): el dim fijo #8a8a92 exige una
      // superficie con Ls <= 0.0181; el fondo (#022c22, Ls 0.0193) quedaba
      // por encima → se oscurece a #022a21 (4.52:1) para que la rampa siga
      // siendo monótona (fondo < panel < raised).
      background: "#022a21",
      // EGO-FIND-71 FIND-A11Y-05 + FIND-A11Y-02: dim fijo #8a8a92 sobre panel
      // #064e3b = 2.84:1 (< 4.5:1) y borde fuerte fijo #71717a = 2.01:1 (< 3:1).
      // Superficie oscurecida a #002b1b → 4.50:1 / 3.19:1
      // (OKLCH: L 0.378 → 0.256, C y H conservados dentro del gamut sRGB).
      panel: "#002b1b",
      // EGO-FIND-71 (residuo, hallazgo 7): el dim GLOBAL #8a8a92 (no
      // puenteado al muted del preset) daba 2.24:1 sobre #065f46. La
      // superficie elevada se oscurece a #032a1f (dim 4.53:1, borde fuerte
      // 3.21:1). Coste de diseño: en este preset la "elevación" sobre el
      // panel es casi imperceptible — es la consecuencia matemática de
      // que un gris neutro sobre verde no puede llegar a 4.5:1 sin
      // oscurecer la superficie casi al nivel del panel.
      raised: "#032a1f",
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
    name: "Warm Sepia (Paper Ink)",
    version: 1,
    colors: {
      brand: "#f59e0b",
      background: "#1c1917",
      // EGO-FIND-71 FIND-A11Y-06: dim fijo #8a8a92 sobre panel #292524 = 4.43:1
      // (< 4.5:1). Superficie oscurecida a #272323 → 4.54:1
      // (OKLCH: L 0.268 → 0.261, C 0.006 y H 34 conservados).
      panel: "#272323",
      // EGO-FIND-71 FIND-A11Y-03: borde fuerte fijo #71717a sobre raised #44403c
      // = 2.13:1 (< 3:1). Superficie oscurecida a #2c2825 → 3.02:1
      // (OKLCH: L 0.374 → 0.280, C 0.009 y H 68 conservados). El mismo valor
      // cierra FIND-A11Y-01, que exige #78716c >= 3:1 → 3.05:1.
      // EGO-FIND-71 (residuo): el dim fijo #8a8a92 sobre esta superficie daba
      // 4.27:1 (< 4.5:1) → se oscurece a #272421 (4.51:1). El borde fuerte
      // sigue en 3.03:1.
      raised: "#272421",
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
 * - `FIXED_BORDER_STRONG` #71717a >= 3.2:1 sobre panel (WCAG 2.2 AA en componentes interactivos).
 * - `FIXED_FOCUS_RING` #f59e0b ≈9.2:1 sobre paper (componente UI ≥3:1 ✅).
 * - `FIXED_TEXT_ON_BRAND` #0a0a0b sobre ámbar ≈9.2:1 ✅.
 * - EGO-FIND-71: los fijos NO se pisan; para que cumplan AA sobre las
 *   superficies de CADA preset se oscurecieron `panel`/`raised` de los
 *   presets afectados (comentarios EGO-FIND-71 en PRESET_THEMES).
 */
const FIXED_BORDER_STRONG = "#71717a";
const FIXED_FOCUS_RING = "#f59e0b";
const FIXED_TEXT_ON_BRAND = "#0a0a0b";
const FIXED_DIM = "#8a8a92";
const FIXED_CHART_INDIGO = "#818cf8";
const FIXED_CHART_VIOLET = "#a78bfa";

/**
 * STAB-10: motion tokens FIJOS del sistema (no derivan del preset, igual
 * que FIXED_DIM & co.). micro 150ms / ui 200ms / surface 350ms; out =
 * entradas, in = salidas. Se escriben como `--motion-*` en documentElement
 * (mismo puente que los `--color-*`) y se exponen en segundos para
 * framer-motion vía `MOTION` (la lib no acepta CSS vars en `duration`).
 */
const FIXED_MOTION_DURATION_MICRO = "150ms";
const FIXED_MOTION_DURATION_UI = "200ms";
const FIXED_MOTION_DURATION_SURFACE = "350ms";
const FIXED_MOTION_EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const FIXED_MOTION_EASE_IN = "cubic-bezier(0.3, 0, 0.7, 1)";

export const MOTION = {
  micro: 0.15,
  ui: 0.2,
  surface: 0.35,
} as const;

function radiusOf(radius: string): string {
  return RADIUS_MAP[radius] || "8px";
}

function densityPadOf(density: string): string {
  return DENSITY_PAD_MAP[density] || "0.5rem";
}

function fontStackOf(family: string): string {
  return FONT_STACK_MAP[family] || FONT_STACK_MAP.sans || "sans-serif";
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
    // STAB-10 (noUncheckedIndexedAccess): clave validada por resolvePresetKey,
    // fallback a initialTokens por invariante defensivo.
    return (persisted ? PRESET_THEMES[persisted] : undefined) ?? initialTokens;
  });

  const applyPreset = (presetId: string) => {
    const key = resolvePresetKey(presetId);
    const preset = key ? PRESET_THEMES[key] : undefined;
    if (preset) {
      setTokens(preset);
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
    // STAB-10: motion tokens (fijos del sistema; ver bloque FIXED_MOTION_*).
    root.setProperty("--motion-duration-micro", FIXED_MOTION_DURATION_MICRO);
    root.setProperty("--motion-duration-ui", FIXED_MOTION_DURATION_UI);
    root.setProperty("--motion-duration-surface", FIXED_MOTION_DURATION_SURFACE);
    root.setProperty("--motion-ease-out", FIXED_MOTION_EASE_OUT);
    root.setProperty("--motion-ease-in", FIXED_MOTION_EASE_IN);
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
      // STAB-10: motion tokens en el div del provider (referencia directa;
      // documentElement lleva los valores resueltos globales).
      "--motion-duration-micro": FIXED_MOTION_DURATION_MICRO,
      "--motion-duration-ui": FIXED_MOTION_DURATION_UI,
      "--motion-duration-surface": FIXED_MOTION_DURATION_SURFACE,
      "--motion-ease-out": FIXED_MOTION_EASE_OUT,
      "--motion-ease-in": FIXED_MOTION_EASE_IN,
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
