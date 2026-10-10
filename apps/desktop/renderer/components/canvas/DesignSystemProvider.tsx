import React, { createContext, useContext, useState, useMemo } from "react";
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
  const [tokens, setTokens] = useState<DesignSystemTokens>(initialTokens);

  const applyPreset = (presetId: string) => {
    if (PRESET_THEMES[presetId]) {
      setTokens(PRESET_THEMES[presetId]);
    }
  };

  const cssVariables = useMemo(() => {
    const radiusMap: Record<string, string> = {
      none: "0px",
      sm: "4px",
      md: "8px",
      lg: "14px",
      full: "9999px",
    };

    const densityPadMap: Record<string, string> = {
      compact: "0.25rem",
      comfortable: "0.5rem",
      spacious: "0.75rem",
    };

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
      "--ego-radius": radiusMap[tokens.geometry.radius] || "8px",
      "--ego-density-pad": densityPadMap[tokens.geometry.density] || "0.5rem",
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
