// Adapted from hermes-agent (MIT), apps/desktop/src/lib/ansi.ts
/**
 * AnsiParser.ts — Parser minimalista de secuencias ANSI SGR para terminales y tool cards.
 *
 * Código **derivado** de Hermes Agent (MIT, Copyright (c) 2025 Nous Research):
 * el tipo `AnsiSegment`, la paleta `AnsiColor` y el mapa `FG_BY_CODE` son un port
 * del parser de origen. El aviso de licencia está en el `LICENSE.md` de este
 * paquete.
 *
 * Procesa códigos SGR de formato y color de texto (30-37, 90-97, 1, 22, 0, 39).
 * Ignora y descarta de manera segura otras secuencias de control o de cursor.
 */

export type AnsiColor =
  | "black"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "bright-black"
  | "bright-red"
  | "bright-green"
  | "bright-yellow"
  | "bright-blue"
  | "bright-magenta"
  | "bright-cyan"
  | "bright-white";

export interface AnsiSegment {
  text: string;
  bold: boolean;
  fg: AnsiColor | null;
}

const FG_MAP: Record<number, AnsiColor> = {
  30: "black",
  31: "red",
  32: "green",
  33: "yellow",
  34: "blue",
  35: "magenta",
  36: "cyan",
  37: "white",
  90: "bright-black",
  91: "bright-red",
  92: "bright-green",
  93: "bright-yellow",
  94: "bright-blue",
  95: "bright-magenta",
  96: "bright-cyan",
  97: "bright-white",
};

// CSI = ESC '[' params 'final'. Solo nos interesa SGR ('m').
const CSI_REGEX = /\x1b\[([\d;]*)([\x40-\x7e])/g;
// Secuencias de escape de control externas (OSC, SS3, etc.)
const NON_CSI_REGEX = /\x1b[@-Z\\-_]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;

/**
 * Chequeo rápido para saber si un string contiene secuencias de escape ANSI sin parsear.
 */
export function hasAnsiCodes(input: string | null | undefined): boolean {
  if (!input) return false;
  return /\x1b/.test(input);
}

/**
 * Elimina completamente cualquier secuencia de escape ANSI dejando el texto plano.
 */
export function stripAnsiCodes(input: string | null | undefined): string {
  if (!input) return "";
  return input.replace(NON_CSI_REGEX, "").replace(CSI_REGEX, "");
}

/**
 * Parsea un string que contiene códigos ANSI SGR y retorna una lista de segmentos estructurados.
 */
export function parseAnsi(input: string | null | undefined): AnsiSegment[] {
  if (!input) return [];

  // Elimina primero secuencias de escape que no son CSI
  const cleaned = input.replace(NON_CSI_REGEX, "");
  const segments: AnsiSegment[] = [];

  let cursor = 0;
  let bold = false;
  let fg: AnsiColor | null = null;

  const pushText = (text: string) => {
    if (!text) return;
    const last = segments[segments.length - 1];
    if (last && last.bold === bold && last.fg === fg) {
      last.text += text;
      return;
    }
    segments.push({ text, bold, fg });
  };

  CSI_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = CSI_REGEX.exec(cleaned)) !== null) {
    const start = match.index;
    if (start > cursor) {
      pushText(cleaned.slice(cursor, start));
    }

    const [fullMatch, paramString, command] = match;
    cursor = start + fullMatch.length;

    // Solo procesamos secuencias SGR (final === 'm')
    if (command === "m") {
      const rawCodes = paramString ? paramString.split(";") : ["0"];
      for (const rawCode of rawCodes) {
        const code = parseInt(rawCode, 10);
        if (isNaN(code) || code === 0) {
          bold = false;
          fg = null;
        } else if (code === 1) {
          bold = true;
        } else if (code === 22) {
          bold = false;
        } else if (code === 39) {
          fg = null;
        } else if (FG_MAP[code]) {
          fg = FG_MAP[code];
        }
      }
    }
  }

  if (cursor < cleaned.length) {
    pushText(cleaned.slice(cursor));
  }

  return segments;
}
