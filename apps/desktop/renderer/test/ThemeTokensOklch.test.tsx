// T14 (EGO-FIND-60): las paletas canónicas se declaran en OKLCH.
//
// RED: antes de la migración, `theme-tokens.css` declara las 4 paletas en
// HEX sRGB. OKLCH da percepción uniforme: la misma diferencia de `L`
// produce el mismo salto de luminosidad en cualquier matiz, y la
// cromancia es independiente de la luminosidad (mismo `C` = mismo color a
// cualquier `L`). Sin esto, "elevar un nivel de superficie" cambia el
// matiz perceived en las paletas frías y calurosas.
//
// El contraste se calcula CONVERTIENDO el OKLCH de vuelta a sRGB y
// aplicando la fórmula de luminancia relativa de WCAG 2.2: es un contrato
// real (4.5:1 texto, 3:1 borde), no una heurística.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const TOKENS = join(process.cwd(), "src", "styles", "theme-tokens.css");
const css = existsSync(TOKENS) ? readFileSync(TOKENS, "utf8") : "";

const PALETTES = [
  "dark-graphite",
  "midnight-cyan",
  "warm-sepia",
  "high-contrast",
];

/** Extrae el valor de una variable CSS dentro de un bloque de paleta. */
function paletteVars(palette: string): Record<string, string> {
  const re = new RegExp(
    `\\[data-palette="${palette}"\\][^{]*\\{([\\s\\S]*?)\\n\\}`,
    "m"
  );
  const m = css.match(re);
  const out: Record<string, string> = {};
  if (!m || m[1] === undefined) return out;
  for (const line of m[1].split(/\r?\n/)) {
    const v = line.match(/^\s*(--[a-z0-9-]+)\s*:\s*(.+?);\s*$/i);
    if (v && v[1] !== undefined && v[2] !== undefined) out[v[1]] = v[2].trim();
  }
  return out;
}

/** Parsea `oklch(L C H)`. */
function parseOklch(value: string): { L: number; C: number; H: number } {
  const m = value.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (!m) throw new Error(`valor no OKLCH: ${value}`);
  return { L: Number(m[1]), C: Number(m[2]), H: Number(m[3]) };
}

/** OKLCH → sRGB lineal (0..1, sin clampear). */
function oklchToLinearRgb(v: string): [number, number, number] {
  const { L, C, H } = parseOklch(v);
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

/** Luminancia relativa WCAG 2.2 a partir del sRGB lineal. */
function relativeLuminance(value: string): number {
  const [r, g, b] = oklchToLinearRgb(value);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Ratio de contraste WCAG 2.2 entre dos tokens OKLCH. */
function contrast(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** L de un token (para la monotonía de la rampa). */
function lightness(token: string): number {
  return parseOklch(token).L;
}

describe("T14: tokens de color en OKLCH (percepción uniforme)", () => {
  it("las 4 paletas canónicas están declaradas", () => {
    for (const p of PALETTES) {
      expect(css).toContain(`[data-palette="${p}"]`);
    }
  });

  it("ninguna paleta canónica usa HEX sRGB", () => {
    for (const p of PALETTES) {
      const vars = paletteVars(p);
      expect(Object.keys(vars).length).toBeGreaterThan(0);
      for (const [name, value] of Object.entries(vars)) {
        expect(
          value,
          `${p} → ${name} debe estar en oklch(), no en hex`
        ).toMatch(/^oklch\(/);
        expect(value, `${p} → ${name} no debe usar hex`).not.toMatch(
          /^#[0-9a-f]{3,8}$/i
        );
      }
    }
  });

  it("cada paleta mantiene su rampa de superficie en OKLCH con L monótona", () => {
    for (const p of PALETTES) {
      const v = paletteVars(p);
      const bg = lightness(v["--ego-color-bg"]!);
      const panel = lightness(v["--ego-color-panel"]!);
      const raised = lightness(v["--ego-color-raised"]!);
      const text = lightness(v["--ego-color-text"]!);
      // Rampa de superficie: bg < panel < raised < text (monótona en L).
      expect(panel, `${p}: panel debe ser más claro que bg`).toBeGreaterThan(bg);
      expect(raised, `${p}: raised debe ser más claro que panel`).toBeGreaterThan(panel);
      expect(text, `${p}: text debe ser más claro que raised`).toBeGreaterThan(raised);
    }
  });

  it("el texto conserva contraste AA (>= 4.5:1) contra la superficie", () => {
    for (const p of PALETTES) {
      const v = paletteVars(p);
      const ratio = contrast(v["--ego-color-text"]!, v["--ego-color-bg"]!);
      expect(
        ratio,
        `${p}: texto vs fondo = ${ratio.toFixed(2)}:1 (AA requiere >= 4.5:1)`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("el borde fuerte mantiene >= 3:1 de contraste no textual (WCAG 1.4.11)", () => {
    for (const p of PALETTES) {
      const v = paletteVars(p);
      const ratio = contrast(
        v["--ego-color-border-strong"]!,
        v["--ego-color-bg"]!
      );
      expect(
        ratio,
        `${p}: borde fuerte vs fondo = ${ratio.toFixed(2)}:1 (UI requiere >= 3:1)`
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("EGO-FIND-71: el borde fuerte también alcanza 3:1 sobre la superficie elevada", () => {
    // Este era el hueco de la paleta estática: `warm-sepia.raised` daba
    // 2.14:1 con su propio `--ego-color-border-strong` (#78716c). Es el
    // mismo contrato que exigen los presets del DesignSystemProvider.
    for (const p of PALETTES) {
      const v = paletteVars(p);
      const ratio = contrast(
        v["--ego-color-border-strong"]!,
        v["--ego-color-raised"]!
      );
      expect(
        ratio,
        `${p}: borde fuerte vs raised = ${ratio.toFixed(2)}:1 (UI requiere >= 3:1)`
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("EGO-FIND-71: el dim fijo alcanza 4.5:1 sobre la superficie elevada", () => {
    // El dim del design system es FIJO (#8a8a92): las superficies de los
    // presets se oscurecieron para que llegue a 4.5:1. La paleta estática
    // debe cumplir el mismo contrato.
    const DIM_FIJO = "oklch(0.657 0.014 286.1)"; // #8a8a92
    for (const p of PALETTES) {
      const v = paletteVars(p);
      const ratio = contrast(DIM_FIJO, v["--ego-color-raised"]!);
      expect(
        ratio,
        `${p}: dim fijo vs raised = ${ratio.toFixed(2)}:1 (texto requiere >= 4.5:1)`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("el texto muted conserva >= 4.5:1 contra la superficie elevada", () => {
    for (const p of PALETTES) {
      const v = paletteVars(p);
      const ratio = contrast(v["--ego-color-muted"]!, v["--ego-color-raised"]!);
      expect(
        ratio,
        `${p}: muted vs raised = ${ratio.toFixed(2)}:1 (AA requiere >= 4.5:1)`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
