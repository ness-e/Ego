import { describe, it, expect } from "vitest";
import { parseAnsi, hasAnsiCodes, stripAnsiCodes } from "../src/AnsiParser.js";

describe("HERM-05: AnsiParser", () => {
  it("detecta presencia de secuencias ANSI con hasAnsiCodes", () => {
    expect(hasAnsiCodes("texto plano sin ansi")).toBe(false);
    expect(hasAnsiCodes("\x1b[31mrojo\x1b[0m")).toBe(true);
    expect(hasAnsiCodes(null)).toBe(false);
  });

  it("elimina secuencias de escape con stripAnsiCodes", () => {
    const raw = "\x1b[1m\x1b[32mSuccess: 100%\x1b[0m";
    expect(stripAnsiCodes(raw)).toBe("Success: 100%");
  });

  it("parsea colores y negrita adecuadamente", () => {
    const raw = "\x1b[1;31mError fatal:\x1b[0m \x1b[33mAdvertencia\x1b[0m";
    const segments = parseAnsi(raw);

    expect(segments).toEqual([
      { text: "Error fatal:", bold: true, fg: "red" },
      { text: " ", bold: false, fg: null },
      { text: "Advertencia", bold: false, fg: "yellow" },
    ]);
  });

  it("consolida segmentos adyacentes con mismo estilo", () => {
    const raw = "\x1b[34mParte 1\x1b[34m y Parte 2\x1b[0m";
    const segments = parseAnsi(raw);

    expect(segments).toHaveLength(1);
    expect(segments[0]).toEqual({
      text: "Parte 1 y Parte 2",
      bold: false,
      fg: "blue",
    });
  });

  it("ignora secuencias de control no SGR (cursor, OSC, etc.)", () => {
    const raw = "\x1b[2J\x1b[H\x1b[32mTexto limpio\x1b[0m";
    const segments = parseAnsi(raw);

    expect(segments).toEqual([
      { text: "Texto limpio", bold: false, fg: "green" },
    ]);
  });
});
