import { describe, it, expect } from "vitest";
import { fuzzyScore, fuzzyRank } from "../src/FuzzySearch.js";
import {
  parseSlashCommand,
  looksLikeSlashCommand,
  getSlashCompletions,
} from "../src/SlashCommandParser.js";

describe("HERM-10 & HERM-12: FuzzySearch and SlashCommandParser", () => {
  describe("FuzzySearch", () => {
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

  describe("SlashCommandParser", () => {
    it("identifica comandos slash al inicio", () => {
      expect(looksLikeSlashCommand("/model gpt-4o")).toBe(true);
      expect(looksLikeSlashCommand("/help")).toBe(true);
      expect(looksLikeSlashCommand("mira la ruta /usr/bin")).toBe(false);
      expect(looksLikeSlashCommand("texto plano")).toBe(false);
    });

    it("separa nombre y argumentos preservando multilínea", () => {
      const parsed = parseSlashCommand("/model claude-3-7-sonnet");
      expect(parsed).toEqual({
        name: "model",
        arg: "claude-3-7-sonnet",
      });

      const multiLine = parseSlashCommand("/task Línea 1\nLínea 2 con indentación");
      expect(multiLine.name).toBe("task");
      expect(multiLine.arg).toBe("Línea 1\nLínea 2 con indentación");
    });

    it("autocompleta comandos según el query", () => {
      const completions = getSlashCompletions("sub");
      expect(completions.some((c) => c.name === "subego")).toBe(true);
    });
  });
});
