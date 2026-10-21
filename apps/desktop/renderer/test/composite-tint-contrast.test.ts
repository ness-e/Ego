/**
 * T1.2 (Ola 4) — Contraste de los **tintes compuestos** del `Badge`.
 *
 * ## El hueco que cierra
 * La puerta de contraste (`ThemeTokensOklch.test.tsx`) medía **texto vs
 * superficie** del preset. Pero la superficie más pintada de la app es el
 * `Badge`, y sus 5 tonos no son texto sobre una superficie: son **texto
 * sobre un tinte compuesto** (`bg-success/10` sobre el panel, `text-success`
 * encima). Ese par no lo medía nadie.
 *
 * ## El cálculo
 * `bg-success/10` es un color con **alfa 10 %** compuesto sobre la
 * superficie. El navegador mezcla en espacio **sRGB codificado** (no lineal),
 * así que:
 *
 * ```
 * compuesto = superficie × (1 − α) + tinte × α        (en sRGB)
 * ratio     = contrasteWCAG(texto, compuesto)
 * ```
 *
 * El texto se lee del **propio `Badge.tsx`** (lo que la app pinta de verdad)
 * y los colores, del `DesignSystemProvider` (fuente única de la paleta).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  readPresets,
  contrast,
  compositeOver,
  FIXED_DIM,
} from "./helpers/color-tokens.js";

const PRESETS = readPresets();

const BADGE_PATH = join(process.cwd(), "components", "ui-kit", "Badge.tsx");
const badgeSrc = existsSync(BADGE_PATH)
  ? readFileSync(BADGE_PATH, "utf8")
  : "";

/** Un tono del Badge: su fondo (posiblemente con alfa) y su texto. */
interface Tone {
  name: string;
  /** `bg-…` o `bg-…/N` (superficie, sólida o con alfa). */
  bg?: string;
  bgAlpha?: number;
  /** `text-…` */
  text?: string;
}

/** Lee los 5 tonos del `Badge` de su fuente (lo que la app pinta). */
function readTones(): Tone[] {
  const start = badgeSrc.indexOf("tone: {");
  if (start === -1) return [];
  const end = badgeSrc.indexOf("}", start);
  const block = badgeSrc.slice(start, end);
  const tones: Tone[] = [];
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^\s*([a-z]+):\s*"([^"]+)"\s*,?\s*$/);
    if (!m || m[1] === undefined || m[2] === undefined) continue;
    const tone: Tone = { name: m[1] };
    const bg = m[2].match(/\bbg-([a-z-]+?)(?:\/(\d{1,3}))?\b/);
    if (bg && bg[1] !== undefined) {
      tone.bg = bg[1];
      tone.bgAlpha = bg[2] ? Number(bg[2]) / 100 : 1;
    }
    const text = m[2].match(/\btext-([a-z-]+)\b/);
    if (text && text[1] !== undefined) tone.text = text[1];
    tones.push(tone);
  }
  return tones;
}

const TONES = readTones();

/** Resuelve un token del kit (`success`, `warning`, `error`, `muted`…) al preset. */
function tokenFor(preset: Record<string, string>, name: string): string | null {
  switch (name) {
    case "dim":
      return FIXED_DIM;
    case "success":
      return preset["success"] ?? null;
    case "warning":
      return preset["warning"] ?? null;
    case "error":
      return preset["error"] ?? null;
    case "muted":
    case "faint":
      return preset["muted"] ?? null;
    case "paper":
    case "background":
      return preset["background"] ?? null;
    case "panel":
      return preset["panel"] ?? null;
    case "raised":
      return preset["raised"] ?? null;
    case "hairline":
      return preset["border"] ?? null;
    case "brand":
      return preset["brand"] ?? null;
    case "text":
    case "ink":
      return preset["text"] ?? null;
    default:
      return null;
  }
}

describe("T1.2 — el contraste de los TINTES COMPUESTOS del Badge (AA)", () => {
  it("el Badge declara 5 tonos con fondo y texto", () => {
    expect(TONES.length).toBe(5);
    for (const tone of TONES) {
      expect(tone.bg, `el tono ${tone.name} no declara fondo`).toBeTruthy();
      expect(tone.text, `el tono ${tone.name} no declara texto`).toBeTruthy();
    }
  });

  it("el texto de cada tono alcanza AA (>= 4.5:1) sobre su tinte compuesto", () => {
    // El `Badge` vive sobre el panel (la superficie de la app).
    const failures: string[] = [];
    for (const [preset, vars] of Object.entries(PRESETS)) {
      const surface = tokenFor(vars, "panel");
      if (!surface) {
        failures.push(`${preset}: sin token de panel`);
        continue;
      }
      for (const tone of TONES) {
        const tintName = tone.bg!;
        const tint = tokenFor(vars, tintName);
        if (!tint) {
          failures.push(`${preset}/${tone.name}: token de fondo "${tintName}" no resuelto`);
          continue;
        }
        // El fondo compuesto: alfa del propio tono sobre la superficie.
        const background = compositeOver(surface, tint, tone.bgAlpha ?? 1);
        const textToken = tokenFor(vars, tone.text!);
        if (!textToken) {
          failures.push(`${preset}/${tone.name}: token de texto "${tone.text}" no resuelto`);
          continue;
        }
        const ratio = contrast(textToken, background);
        if (ratio < 4.5) {
          failures.push(
            `${preset}/${tone.name}: ${tone.text} sobre ${background} (${tintName}@${Math.round(
              (tone.bgAlpha ?? 1) * 100
            )}% sobre ${surface}) = ${ratio.toFixed(2)}:1 (< 4.5:1)`
          );
        }
      }
    }
    expect(failures, `contraste insuficiente:\n  ${failures.join("\n  ")}`).toEqual([]);
  });

  it("el estado del Badge lo transmite el TEXTO, no el borde (el borde es decorativo)", () => {
    // El tono `risk`/`ok`/`warn` duplica su color en el borde (`border-*/40`)
    // como refuerzo visual. La WCAG 1.4.11 (3:1) aplica al **elemento que
    // identifica el estado**, y aquí ese elemento es el TEXTO (que ya exige
    // AA). Exigir 3:1 al borde decorativo sería un requisito inexistente
    // (y el `border-hairline` de los tonos `info`/`dim` es un separador: 1:1
    // es lo esperado).
    const failures: string[] = [];
    for (const [preset, vars] of Object.entries(PRESETS)) {
      const surface = tokenFor(vars, "panel");
      if (!surface) continue;
      for (const tone of TONES) {
        const textToken = tokenFor(vars, tone.text!);
        if (!textToken) continue;
        const tint = tokenFor(vars, tone.bg!);
        if (!tint) continue;
        const background = compositeOver(surface, tint, tone.bgAlpha ?? 1);
        const ratio = contrast(textToken, background);
        if (ratio < 4.5) {
          failures.push(`${preset}/${tone.name}: ${ratio.toFixed(2)}:1`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
