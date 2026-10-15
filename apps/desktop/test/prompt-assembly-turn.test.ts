import { describe, it, expect } from "vitest";
import {
  EGO_CORE_RULES_STAB03,
  getDefaultNucleusSoul,
  resolveTurnSoul,
  queueMainSteer,
  drainMainSteerQueue,
  buildTurnPrompt,
  clearTurnSystemFingerprint,
} from "../src/main.js";
import {
  EPHEMERAL_BOUNDARY,
  OUT_OF_BAND_OPEN,
  OUT_OF_BAND_CLOSE,
  PromptStabilityViolationError,
  formatOutOfBandUserMessage,
} from "@ego/subegos";

describe("@ego/desktop — STAB-03 turno con PromptAssembly", () => {
  describe("1. Helpers de steer (drain → out-of-band)", () => {
    it("queueMainSteer rechaza vacío y drain vacía la cola", () => {
      drainMainSteerQueue();
      expect(queueMainSteer("   ")).toBe(false);
      expect(queueMainSteer("gira a la izquierda")).toBe(true);
      expect(queueMainSteer("segundo")).toBe(true);
      expect(drainMainSteerQueue()).toEqual(["gira a la izquierda", "segundo"]);
      expect(drainMainSteerQueue()).toEqual([]);
    });

    it("el steer drenado se envuelve con el marcador exacto (rol user standalone)", () => {
      drainMainSteerQueue();
      queueMainSteer("pausa y pide aclaración");
      const [steer] = drainMainSteerQueue();
      const wrapped = formatOutOfBandUserMessage(steer!);
      expect(wrapped).toContain(OUT_OF_BAND_OPEN);
      expect(wrapped).toContain(OUT_OF_BAND_CLOSE);
    });
  });

  describe("2. Alma del turno (resolveTurnSoul nunca lanza por registry vacío)", () => {
    it("expone el nucleus por defecto con id canónico", () => {
      expect(getDefaultNucleusSoul().id).toBe("ego.nucleus");
    });

    it("resuelve al nucleus cuando el registry no tiene el subEgo (sin Electron)", async () => {
      const soul = await resolveTurnSoul("ego.inexistente-xyz");
      expect(soul.id).toBe("ego.nucleus");
    });
  });

  describe("3. buildTurnPrompt: tiers + ephemeral + estabilidad", () => {
    it("usa coreRules canónico y caller como Tier 2 (no ad-hoc)", () => {
      clearTurnSystemFingerprint("sess_stab03_a");
      const { assembled } = buildTurnPrompt({
        sessionId: "sess_stab03_a",
        callerSystemMessage: "caller-abc",
      });
      expect(assembled.systemPrompt).toContain(EGO_CORE_RULES_STAB03);
      expect(assembled.systemPrompt).toContain("caller-abc");
      expect(assembled.systemPrompt).toContain("TIER 1 / STABLE");
      expect(assembled.systemPrompt).toContain("TIER 2 / CONTEXT");
    });

    it("el recall fresco viaja tras la frontera EPHEMERAL sin mutar el cacheado", () => {
      clearTurnSystemFingerprint("sess_stab03_b");
      const first = buildTurnPrompt({ sessionId: "sess_stab03_b", ephemeralText: "recall-1" });
      expect(first.effectiveSystemPrompt).toContain(EPHEMERAL_BOUNDARY);
      expect(first.effectiveSystemPrompt).toContain("recall-1");
      // El prefijo cacheado no contiene marcas efímeras.
      expect(first.assembled.systemPrompt).not.toContain(EPHEMERAL_BOUNDARY);
      // Segundo turno con recall distinto: mismo system cacheado, overlay distinto.
      const second = buildTurnPrompt({ sessionId: "sess_stab03_b", ephemeralText: "recall-2" });
      expect(second.assembled.systemPrompt).toBe(first.assembled.systemPrompt);
      expect(second.fingerprint).toBe(first.fingerprint);
      expect(second.effectiveSystemPrompt).toContain("recall-2");
    });

    it("sin ephemeral el efectivo es el cacheado byte-idéntico", () => {
      clearTurnSystemFingerprint("sess_stab03_c");
      const { assembled, effectiveSystemPrompt } = buildTurnPrompt({ sessionId: "sess_stab03_c" });
      expect(effectiveSystemPrompt).toBe(assembled.systemPrompt);
    });

    it("mutación del caller mid-sesión lanza (fail-closed, salvo compresión)", () => {
      clearTurnSystemFingerprint("sess_stab03_d");
      buildTurnPrompt({ sessionId: "sess_stab03_d", callerSystemMessage: "v1" });
      expect(() =>
        buildTurnPrompt({ sessionId: "sess_stab03_d", callerSystemMessage: "v2-mutado" })
      ).toThrow(PromptStabilityViolationError);
      // Rebuild por compresión: único cache-break sancionado, no lanza.
      expect(() =>
        buildTurnPrompt({
          sessionId: "sess_stab03_d",
          callerSystemMessage: "v2-comprimido",
          isCompressionRebuild: true,
        })
      ).not.toThrow();
    });

    it("sesiones distintas tienen huellas independientes", () => {
      clearTurnSystemFingerprint("sess_stab03_e1");
      clearTurnSystemFingerprint("sess_stab03_e2");
      const a = buildTurnPrompt({ sessionId: "sess_stab03_e1", callerSystemMessage: "x" });
      const b = buildTurnPrompt({ sessionId: "sess_stab03_e2", callerSystemMessage: "x" });
      // Mismo contenido salvo línea de sesión (sessionId distinto) → fingerprints difieren.
      expect(a.fingerprint).not.toBe(b.fingerprint);
    });
  });
});
