import { describe, it, expect } from "vitest";
import { fuzzyScore, fuzzyRank } from "../src/FuzzySearch.js";

/**
 * HERM-10 — FuzzySearch (ranking difuso sin dependencias).
 *
 * Ola 1b T5.3: el parser de slash de `@ego/ui-runtime` (HERM-12) se RETIRÓ
 * con veredicto de descarte (había dos parsers de slash en el repo y el
 * vivo es el del renderer: `apps/desktop/renderer/components/composer-slash.ts`).
 * Este fichero conserva la cobertura de `FuzzySearch`, que sobrevive como
 * utilidad pública del paquete.
 */
describe("HERM-10: FuzzySearch (puntuación y ranking difuso)", () => {
  it("encuentra subsecuencias y puntúa más alto prefijos y límites de palabra", () => {
    const match1 = fuzzyScore("claude-sonnet-4", "son4");
    expect(match1).not.toBeNull();

    const match2 = fuzzyScore("gpt-4o", "g4o");
    expect(match2).not.toBeNull();

    // Coincidencia exacta puntúa más alto que subsecuencia dispersa
    const exact = fuzzyScore("opus", "opus");
    const partial = fuzzyScore("claude-3-opus", "opus");
    expect(exact!.score).toBeGreaterThan(partial!.score);
  });

  it("retorna null si la subsecuencia no existe", () => {
    expect(fuzzyScore("gpt-4o", "claude")).toBeNull();
  });

  it("ordena colecciones con fuzzyRank", () => {
    const models = [
      { id: "gpt-4o-mini", name: "GPT-4o Mini" },
      { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet" },
      { id: "gemini-2-flash", name: "Gemini 2.0 Flash" },
    ];

    const ranked = fuzzyRank(models, "sonnet", (m) => `${m.id} ${m.name}`);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].item.id).toBe("claude-3-5-sonnet");
  });
});
