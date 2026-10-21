import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import type { DesignSystemTokens } from "@ego/ui-runtime";

export interface DesignSystemContextValue {
  tokens: DesignSystemTokens;
  setTokens: React.Dispatch<React.SetStateAction<DesignSystemTokens>>;
  applyPreset: (presetId: string) => void;
  availablePresets: Record<string, DesignSystemTokens>;
}

/**
 * T14 / EGO-FIND-72 + owner 2026-10-20 — **FUENTE ÚNICA DE LOS TOKENS**.
 *
 * Este bloque es la ÚNICA definición de las 4 paletas del producto. Los
 * valores están en **OKLCH** (no HEX) porque OKLCH separa L (luminancia),
 * C (cromancia) y H (matiz): la misma diferencia de `L` produce el mismo
 * salto perceptual en cualquier matiz, de modo que "subir un nivel de
 * superficie" conserva la identidad del color en las paletas frías, cálidas
 * y de alto contraste (mismo argumento que en `docs/design/DESIGN.md` §1).
 *
 * ## Por qué aquí y no en `theme-tokens.css`
 * Antes (2026-10-20) las paletas vivían duplicadas: en CSS bajo
 * `[data-palette="…"]` — que **ningún componente asignaba**, por lo que
 * nunca se activaban — y en HEX dentro de este provider, que sí era lo que
 * corría. Dos fuentes de verdad y una muerta. Ahora:
 *  - este provider define los valores (OKLCH) y los **aplica**;
 *  - `theme-tokens.css` conserva solo lo que no es paleta (elevación L0–L3,
 *    vidrio, scrollbar);
 *  - la puerta de contraste `test/ThemeTokensOklch.test.tsx` lee **este
 *    fichero** y verifica los 4 presets reales.
 *
 * ## Rampas de superficie (bg < panel < raised), verificadas 2026-10-20
 * Las 4 paletas comparten la misma estructura de rampa en `L`
 * (0.130 → 0.195 → 0.260): el salto entre niveles es idéntico en todas, que
 * es exactamente el efecto buscado con OKLCH. Los valores concretos se
 * resolvieron por búsqueda numérica contra las restricciones WCAG 2.2 con
 * los tokens FIJOS del sistema (`dim` #8a8a92, `border-strong` #71717a):
 * `dim` >= 4.5:1 y `border-strong` >= 3:1 sobre las TRES superficies.
 *
 * Antes, `emerald-terminal` y `amber-warm` tenían rampas casi planas (L
 * 0.255 / 0.256 / 0.255): la "elevación" era imperceptible. Corregido.
 */
export const DEFAULT_DESIGN_TOKENS: DesignSystemTokens = {
  id: "theme-default-dark",
  name: "Obsidian Graphite · Slate Oscuro",
  version: 1,
  colors: {
    // Accent ÁMBAR #f59e0b (decisión owner 2026-10-20): alinea el runtime con
    // la doc (D12 "accent ámbar") y elimina el conflicto con el focus-ring,
    // que ahora es SIEMPRE el brand del preset (un solo accent por app).
    brand: "oklch(0.769 0.165 70.1)",
    background: "oklch(0.13 0.004 285.8)",
    panel: "oklch(0.195 0.004 286)",
    raised: "oklch(0.26 0.008 285.8)",
    text: "oklch(0.985 0 89.9)",
    muted: "oklch(0.712 0.013 286.1)",
    border: "oklch(0.274 0.005 286)",
    success: "oklch(0.696 0.149 162.5)",
    warning: "oklch(0.837 0.164 84.4)",
    error: "oklch(0.645 0.215 16.4)",
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
      brand: "oklch(0.715 0.126 215.2)",
      background: "oklch(0.13 0.027 261.7)",
      panel: "oklch(0.195 0.04 265.8)",
      raised: "oklch(0.26 0.037 260)",
      text: "oklch(0.984 0.003 247.9)",
      muted: "oklch(0.711 0.035 256.8)",
      border: "oklch(0.372 0.039 257.3)",
      success: "oklch(0.696 0.149 162.5)",
      warning: "oklch(0.769 0.165 70.1)",
      error: "oklch(0.637 0.208 25.3)",
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
      brand: "oklch(0.696 0.149 162.5)",
      // Rampa rehecha 2026-10-20: la anterior (L 0.255 / 0.256 / 0.255) era
      // NO monótona y la elevación sobre el panel era imperceptible. La nueva
      // mantiene los mismos tonos (H 165–174) con 3 escalones reales.
      background: "oklch(0.13 0.047 173.8)",
      panel: "oklch(0.19 0.05 165)",
      raised: "oklch(0.25 0.048 169.6)",
      text: "oklch(0.979 0.021 166.1)",
      muted: "oklch(0.845 0.13 165)",
      border: "oklch(0.508 0.105 165.6)",
      success: "oklch(0.773 0.153 163.2)",
      warning: "oklch(0.837 0.164 84.4)",
      error: "oklch(0.711 0.166 22.2)",
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
      brand: "oklch(0.769 0.165 70.1)",
      // Rampa rehecha 2026-10-20 (misma razón que emerald-terminal): la
      // anterior era casi plana (L 0.261 / 0.262). Mismos tonos cálidos.
      background: "oklch(0.13 0.006 56)",
      panel: "oklch(0.195 0.006 34.3)",
      raised: "oklch(0.26 0.008 67.6)",
      text: "oklch(0.962 0.058 95.6)",
      muted: "oklch(0.869 0.004 56.4)",
      border: "oklch(0.444 0.01 73.6)",
      success: "oklch(0.696 0.149 162.5)",
      warning: "oklch(0.837 0.164 84.4)",
      error: "oklch(0.637 0.208 25.3)",
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
 * - `FIXED_BORDER_STRONG` #71717a >= 3.2:1 sobre panel (WCAG 2.2 AA en
 *   componentes interactivos).
 * - `FIXED_TEXT_ON_BRAND` #0a0a0b sobre ámbar ≈9.2:1 ✅. Medido también
 *   sobre los otros accents (cyan 8.15:1, emerald 7.80:1) → AA en los 4.
 * - EGO-FIND-71: los fijos NO se pisan; para que cumplan AA sobre las
 *   superficies de CADA preset se resolvieron las rampas de `PRESET_THEMES`
 *   por búsqueda numérica contra estas restricciones.
 *
 * ## Focus ring = brand (decisión owner 2026-10-20)
 * Antes coexistían DOS acentos vivos: el brand real en runtime era cyan
 * (#38bdf8) y el focus-ring era ámbar (#f59e0b) → un control podía tener
 * borde cyan y foco ámbar. Ahora el focus-ring **es el brand del preset**:
 * un único accent por app. Todos los brands pasan >= 3:1 (UI) sobre bg y
 * panel: ámbar 9.26:1, cyan 8.29:1, emerald 6.11:1, sepia 8.14:1.
 */
const FIXED_BORDER_STRONG = "#71717a";
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
    // `data-palette`: hook de CSS por preset (y atributo observable para
    // tests). Antes las paletas OKLCH de `theme-tokens.css` colgaban de
    // `[data-palette]` y NUNCA se asignaban → estaban muertas. Ahora el
    // atributo se escribe siempre con la clave del preset activo.
    document.documentElement.setAttribute(
      "data-palette",
      presetKeyOf(tokens),
    );
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
    // Focus ring = brand del preset (decisión owner 2026-10-20): un único
    // accent por app. Antes el focus-ring era ámbar fijo mientras el brand
    // real era cyan → dos acentos vivos a la vez.
    root.setProperty("--color-focus-ring", c.brand);
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
    root.setProperty("--ego-color-focus-ring", c.brand);
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
      // Focus ring = brand del preset (decisión owner 2026-10-20).
      "--ego-color-focus-ring": tokens.colors.brand,
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