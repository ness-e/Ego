import { describe, it, expect } from "vitest";
import {
  VoiceSttSchema,
  VoiceTtsSchema,
  VoiceSettingsSchema,
} from "../src/ipc/schema.js";

/**
 * VOICE-01 — Schema de voz (Zod fail-closed, sin secretos).
 * El renderer nunca ve keys: estos schemas no tienen campos `*Key`; la auth
 * (groq/edge) la inyecta el main desde safeStorage/env.
 */
describe("VOICE-01: voice schema", () => {
  it("STT válido parsea con default webm", () => {
    // Arrange: payload mínimo válido
    const raw = { audioB64: "Z2k=" };
    // Act
    const parsed = VoiceSttSchema.parse(raw);
    // Assert
    expect(parsed.format).toBe("webm");
    expect(parsed.audioB64).toBe("Z2k=");
  });

  it("STT rechaza audio vacío", () => {
    expect(() => VoiceSttSchema.parse({ audioB64: "" })).toThrow();
  });

  it("STT rechaza audio oversize (>7M chars)", () => {
    const big = "A".repeat(7_000_001);
    expect(() => VoiceSttSchema.parse({ audioB64: big })).toThrow();
  });

  it("TTS válido parsea; vacío y >5000 rechazan", () => {
    expect(VoiceTtsSchema.parse({ text: "hola" }).text).toBe("hola");
    expect(() => VoiceTtsSchema.parse({ text: "" })).toThrow();
    expect(() => VoiceTtsSchema.parse({ text: "x".repeat(5001) })).toThrow();
  });

  it("Settings: defaults seguros + kill switch parsea", () => {
    // Arrange/Act
    const defaults = VoiceSettingsSchema.parse({});
    // Assert: voz habilitada pero 100% local y sin privacy ack
    expect(defaults.disableVoice).toBe(false);
    expect(defaults.sttProvider).toBe("webspeech");
    expect(defaults.ttsProvider).toBe("speechSynthesis");
    expect(defaults.privacyAcknowledged).toBe(false);
    // Kill switch deny-gana parsea explícito
    expect(VoiceSettingsSchema.parse({ disableVoice: true }).disableVoice).toBe(true);
  });

  it("schemas de voz exponen cero campos de secreto", () => {
    const sttKeys = Object.keys(VoiceSttSchema.parse({ audioB64: "eA==" }));
    const ttsKeys = Object.keys(VoiceTtsSchema.parse({ text: "hola" }));
    const settingsKeys = Object.keys(VoiceSettingsSchema.parse({}));
    for (const k of [...sttKeys, ...ttsKeys, ...settingsKeys]) {
      expect(k.toLowerCase()).not.toContain("key");
      expect(k.toLowerCase()).not.toContain("secret");
      expect(k.toLowerCase()).not.toContain("token");
    }
  });
});
