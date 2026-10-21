/**
 * T1.2/T14 (Ola 4) — Harness de color del renderer: OKLCH ⇄ sRGB, contraste
 * WCAG 2.2 y **composición de tintes con alfa**.
 *
 * Extraído de `ThemeTokensOklch.test.tsx` para que el contraste de los
 * tintes compuestos (el `Badge`: `bg-success/10` + `text-success`) use el
 * MISMO cálculo que el contraste de superficie: una sola fuente de verdad.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/** Tokens FIJOS del sistema (no derivan del preset) — ver DesignSystemProvider. */
export const FIXED_DIM = "#8a8a92";
export const FIXED_BORDER_STRONG = "#71717a";
export const FIXED_TEXT_ON_BRAND = "#0a0a0b";

export const PROVIDER_PATH = join(
  process.cwd(),
  "components",
  "canvas",
  "DesignSystemProvider.tsx",
);
const providerSrc = existsSync(PROVIDER_PATH)
  ? readFileSync(PROVIDER_PATH, "utf8")
  : "";

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
export function readPresets(): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  const defIdx = providerSrc.indexOf("export const DEFAULT_DESIGN_TOKENS");
  if (defIdx !== -1) out["default-dark"] = colorsBlockAt(providerSrc, defIdx);
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

/** Parsea `oklch(L C H)`. */
export function parseOklch(value: string): {
  L: number;
  C: number;
  H: number;
} {
  const m = value.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (!m) throw new Error(`valor no OKLCH: ${value}`);
  return { L: Number(m[1]), C: Number(m[2]), H: Number(m[3]) };
}

/** OKLCH → sRGB lineal (0..1, sin clampear). */
export function oklchToLinearRgb(value: string): [number, number, number] {
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

/** sRGB lineal → sRGB codificado en gamma (0..1). */
function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** sRGB codificado en gamma → sRGB lineal. */
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** OKLCH → sRGB codificado en gamma, clampeado a 0..1 (lo que ve el ojo). */
export function oklchToSrgb(value: string): [number, number, number] {
  const lin = oklchToLinearRgb(value);
  return [linearToSrgb(lin[0]), linearToSrgb(lin[1]), linearToSrgb(lin[2])];
}

/** HEX sRGB → sRGB codificado en gamma (0..1). */
export function hexToSrgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

/** HEX sRGB → sRGB lineal. */
export function hexToLinearRgb(hex: string): [number, number, number] {
  const s = hexToSrgb(hex);
  return [srgbToLinear(s[0]), srgbToLinear(s[1]), srgbToLinear(s[2])];
}

/** Luminancia relativa WCAG 2.2 (acepta OKLCH o HEX). */
export function relativeLuminance(value: string): number {
  const rgb = value.startsWith("#")
    ? hexToLinearRgb(value)
    : oklchToLinearRgb(value);
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

/** Ratio de contraste WCAG 2.2 entre dos tokens (OKLCH o HEX). */
export function contrast(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Compone un tinte con alfa sobre una superficie, **en sRGB** (es lo que
 * hace el navegador con `background-color: rgb(x / 10%)`: mezcla en espacio
 * codificado, no lineal).
 *
 * Devuelve el color compuesto en sRGB codificado (0..1) como HEX.
 */
export function compositeOver(
  surface: string,
  tint: string,
  alpha: number
): string {
  const s = surface.startsWith("#")
    ? hexToSrgb(surface)
    : oklchToSrgb(surface);
  const t = tint.startsWith("#") ? hexToSrgb(tint) : oklchToSrgb(tint);
  const mix = s.map((c, i) => c * (1 - alpha) + (t[i] ?? 0) * alpha);
  const toHex = (v: number): string =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(mix[0] ?? 0)}${toHex(mix[1] ?? 0)}${toHex(mix[2] ?? 0)}`;
}

/** L de un token OKLCH (monotonía de la rampa). */
export function lightness(token: string): number {
  return parseOklch(token).L;
}
