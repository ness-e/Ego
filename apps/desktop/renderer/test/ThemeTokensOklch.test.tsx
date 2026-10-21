// T14 (EGO-FIND-60/72) + owner 2026-10-20: las paletas canónicas en OKLCH.
//
// POR QUÉ este test lee el PROVIDER y no el CSS:
// Antes (2026-10-20) las 4 paletas vivían en `theme-tokens.css` bajo
// `[data-palette="…"]`, pero NINGÚN componente asignaba ese atributo: eran
// código muerto. La paleta que realmente corría la aplicaba el
// `DesignSystemProvider` con valores HEX distintos — dos fuentes de verdad,
// una muerta, y el test validaba un fichero que no afectaba al producto.
//
// Ahora el provider es la fuente ÚNICA y este test lee ESE fichero: lo que
// verifica es exactamente lo que la app pinta. El contraste se calcula
// CONVERTIENDO el OKLCH de vuelta a sRGB y aplicando la fórmula de
// luminancia relativa de WCAG 2.2: es un contrato real, no una heurística.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const PROVIDER = join(
  process.cwd(),
  "components",
  "canvas",
  "DesignSystemProvider.tsx",
);
const providerSrc = existsSync(PROVIDER) ? readFileSync(PROVIDER, "utf8") : "";

const PRESET_KEYS = [
  "default-dark",
  "midnight-cyan",
  "emerald-terminal",
  "amber-warm",
];

/** Tokens FIJOS del sistema (no derivan del preset) — ver DesignSystemProvider. */
const FIXED_DIM = "#8a8a92"; // ≈5.8:1 sobre paper (AA texto)
const FIXED_BORDER_STRONG = "#71717a"; // >= 3.2:1 sobre panel (UI)
const FIXED_TEXT_ON_BRAND = "#0a0a0b"; // 9.2:1 sobre ámbar (AA texto)

/** Extrae el bloque `colors: { … }` que sigue a un ancla en el fuente. */
function colorsBlockAt(src: string, from: number): Record<string, string> {
  const start = src.indexOf("colors:", from);
  if (start === -1) return {};
  const open = src.indexOf("{", start);
  const close = src.indexOf("}", open);
  if (open === -1 || close === -1) return {};
  const body = src.slice(open + 1, close);
  const out: Record<string, string> = {};
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^\s*([a-zA-Z]+)\s*:\s*"([^"]+)"\s*,?\s*$/);
    if (m && m[1] !== undefined && m[2] !== undefined) out[m[1]] = m[2];
  }
  return out;
}

/** Los 4 presets reales, leídos del provider (fuente única). */
function readPresets(): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  // `default-dark` es `DEFAULT_DESIGN_TOKENS` (constante propia).
  const defIdx = providerSrc.indexOf("export const DEFAULT_DESIGN_TOKENS");
  if (defIdx !== -1) out["default-dark"] = colorsBlockAt(providerSrc, defIdx);
  // El resto: bloques `  "<clave>": { id: …, colors: { … } }`.
  const re =
    /"([a-z0-9-]+)":\s*\{\s*\n\s*id:[\s\S]*?colors:\s*\{([\s\S]*?)\n\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(providerSrc)) !== null) {
    const key = m[1];
    const body = m[2];
    if (key === undefined || body === undefined) continue;
    const vars: Record<string, string> = {};
    for (const line of body.split(/\r?\n/)) {
      const kv = line.match(/^\s*([a-zA-Z]+)\s*:\s*"([^"]+)"\s*,?\s*$/);
      if (kv && kv[1] !== undefined && kv[2] !== undefined) vars[kv[1]] = kv[2];
    }
    if (Object.keys(vars).length > 0) out[key] = vars;
  }
  return out;
}

const PRESETS = readPresets();

/** Parsea `oklch(L C H)`. */
function parseOklch(value: string): { L: number; C: number; H: number } {
  const m = value.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (!m) throw new Error(`valor no OKLCH: ${value}`);
  return { L: Number(m[1]), C: Number(m[2]), H: Number(m[3]) };
}

/** OKLCH → sRGB lineal (0..1, sin clampear). */
function oklchToLinearRgb(value: string): [number, number, number] {
  const { L, C, H } = parseOklch(value);
  const rad = (H * Math.PI) / 180;
  const a = C * Math.cos(rad);
  const b = C * Math.sin(rad);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** HEX sRGB → sRGB lineal. */
function hexToLinearRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const toLin = (c: number): number => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return [
    toLin(parseInt(h.slice(0, 2), 16)),
    toLin(parseInt(h.slice(2, 4), 16)),
    toLin(parseInt(h.slice(4, 6), 16)),
  ];
}

/** Luminancia relativa WCAG 2.2 (acepta OKLCH o HEX). */
function relativeLuminance(value: string): number {
  const rgb = value.startsWith("#")
    ? hexToLinearRgb(value)
    : oklchToLinearRgb(value);
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

/** Ratio de contraste WCAG 2.2 entre dos tokens (OKLCH o HEX). */
function contrast(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** L de un token OKLCH (monotonía de la rampa). */
function lightness(token: string): number {
  return parseOklch(token).L;
}

describe("T14: los 4 presets reales se declaran en OKLCH (percepción uniforme)", () => {
  it("el provider expone los 4 presets y el test los encuentra", () => {
    expect(Object.keys(PRESETS).sort()).toEqual([...PRESET_KEYS].sort());
  });

  it("ningún color de preset usa HEX sRGB", () => {
    for (const [preset, vars] of Object.entries(PRESETS)) {
      for (const [name, value] of Object.entries(vars)) {
        expect(
          value,
          `${preset} → ${name} debe estar en oklch(), no en hex`,
        ).toMatch(/^oklch\(/);
        expect(value, `${preset} → ${name} no debe usar hex`).not.toMatch(
          /^#[0-9a-f]{3,8}$/i,
        );
      }
    }
  });

  it("cada preset mantiene su rampa de superficie con L monótona", () => {
    for (const [preset, vars] of Object.entries(PRESETS)) {
      const bg = lightness(vars["background"]!);
      const panel = lightness(vars["panel"]!);
      const raised = lightness(vars["raised"]!);
      const text = lightness(vars["text"]!);
      expect(panel, `${preset}: panel debe ser más claro que bg`).toBeGreaterThan(bg);
      expect(
        raised,
        `${preset}: raised debe ser más claro que panel`,
      ).toBeGreaterThan(panel);
      expect(text, `${preset}: text debe ser más claro que raised`).toBeGreaterThan(
        raised,
      );
    }
  });

  it("el texto conserva contraste AA (>= 4.5:1) contra las 3 superficies", () => {
    for (const [preset, vars] of Object.entries(PRESETS)) {
      for (const surface of ["background", "panel", "raised"] as const) {
        const ratio = contrast(vars["text"]!, vars[surface]!);
        expect(
          ratio,
          `${preset}: texto vs ${surface} = ${ratio.toFixed(2)}:1 (AA requiere >= 4.5:1)`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("el muted conserva >= 4.5:1 contra la superficie elevada", () => {
    for (const [preset, vars] of Object.entries(PRESETS)) {
      const ratio = contrast(vars["muted"]!, vars["raised"]!);
      expect(
        ratio,
        `${preset}: muted vs raised = ${ratio.toFixed(2)}:1 (AA requiere >= 4.5:1)`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("EGO-FIND-71: el dim fijo alcanza 4.5:1 sobre las 3 superficies", () => {
    // El dim del design system es FIJO (#8a8a92): las superficies de los
    // presets se resolvieron para que llegue a 4.5:1 (búsqueda numérica).
    for (const [preset, vars] of Object.entries(PRESETS)) {
      for (const surface of ["background", "panel", "raised"] as const) {
        const ratio = contrast(FIXED_DIM, vars[surface]!);
        expect(
          ratio,
          `${preset}: dim fijo vs ${surface} = ${ratio.toFixed(2)}:1 (texto requiere >= 4.5:1)`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("el borde fuerte fijo mantiene >= 3:1 sobre las 3 superficies (WCAG 1.4.11)", () => {
    for (const [preset, vars] of Object.entries(PRESETS)) {
      for (const surface of ["background", "panel", "raised"] as const) {
        const ratio = contrast(FIXED_BORDER_STRONG, vars[surface]!);
        expect(
          ratio,
          `${preset}: borde fuerte vs ${surface} = ${ratio.toFixed(2)}:1 (UI requiere >= 3:1)`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("el brand es usable como accent: >= 3:1 (UI) sobre fondo y panel", () => {
    // Decisión owner 2026-10-20: el accent único de la app es el brand del
    // preset, y el focus-ring ES el brand → un control nunca mezcla dos
    // acentos (el bug anterior: borde cyan + foco ámbar).
    for (const [preset, vars] of Object.entries(PRESETS)) {
      for (const surface of ["background", "panel"] as const) {
        const ratio = contrast(vars["brand"]!, vars[surface]!);
        expect(
          ratio,
          `${preset}: brand vs ${surface} = ${ratio.toFixed(2)}:1 (UI requiere >= 3:1)`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("el texto sobre brand alcanza AA (>= 4.5:1) en los 4 presets", () => {
    for (const [preset, vars] of Object.entries(PRESETS)) {
      const ratio = contrast(FIXED_TEXT_ON_BRAND, vars["brand"]!);
      expect(
        ratio,
        `${preset}: text-on-brand vs brand = ${ratio.toFixed(2)}:1 (AA requiere >= 4.5:1)`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
