import { describe, it, expect } from "vitest";
import { FactExtractor } from "../src/extractors/FactExtractor.js";

const extractor = new FactExtractor();

describe("FactExtractor — precisión de la extracción (T9 / A2-19)", () => {
  it("(1) NO extrae hechos de una URL", () => {
    const facts = extractor.extractFromText(
      "https://example.com/path/to/resource",
      "doc.md"
    );
    expect(facts).toHaveLength(0);
  });

  it("(2) NO extrae hechos de un timestamp", () => {
    const facts = extractor.extractFromText("2024-01-15 10:30:00 — evento registrado", "log.md");
    expect(facts).toHaveLength(0);
  });

  it("(3) NO extrae hechos de una línea con prefijo tipo 'Nota:' genérica", () => {
    const facts = extractor.extractFromText("Nota: revisar más tarde", "doc.md");
    expect(facts).toHaveLength(0);
  });

  it("(4) SÍ extrae hechos de pares clave-valor con etiqueta real", () => {
    const facts = extractor.extractFromText(
      ["- Runtime: Node.js 22", "- Base de datos: VantaDB 0.8.0"].join("\n"),
      "setup.md"
    );
    expect(facts).toHaveLength(2);
    expect(facts[0]?.subject).toBe("Runtime");
    expect(facts[0]?.object).toBe("Node.js 22");
  });

  it("(5) reconoce verbos en pasado y futuro (español)", () => {
    const facts = extractor.extractFromText(
      ["Ego usó TypeScript en 2024.", "Ego usará Vite para el build."].join("\n"),
      "historia.md"
    );
    expect(facts.length).toBeGreaterThanOrEqual(2);
    expect(facts.some((f) => f.predicate === "usó")).toBe(true);
    expect(facts.some((f) => f.predicate === "usará")).toBe(true);
  });

  it("(6) reconoce verbos en inglés", () => {
    const facts = extractor.extractFromText(
      "Ego implements a Cognitive Runtime.",
      "readme.md"
    );
    expect(facts).toHaveLength(1);
    expect(facts[0]?.predicate).toBe("implements");
  });

  it("(7) el valor no puede ser un esquema de URI", () => {
    const facts = extractor.extractFromText("Repositorio: https://github.com/ego", "doc.md");
    expect(facts).toHaveLength(0);
  });
});
