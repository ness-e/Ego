import { describe, it, expect } from "vitest";
import { TraitRegistry } from "../renderer/components/character/traits/TraitRegistry.js";
import {
  CANONICAL_CHARACTER_STATES,
  type CharacterState,
} from "../renderer/components/character/state/character-state.js";
import { mapCharacterStateToAvatarState } from "../renderer/components/character/CharacterBadge.js";

/**
 * T5 / R15 (VERDICT): la FSM de 14 estados se RETIRA (nunca se instanciaba;
 * ver `components/character/state/character-state.ts` para la justificación).
 * Este test pasa a cubrir lo que **sí** sobrevive: el vocabulario de
 * estados y su traducción al motor canónico (`@ego/avatar`).
 */
describe("CharacterBadge & SubEgoSelector Integration (CHAR-08)", () => {
  it("1. TraitRegistry se inicializa correctamente para CharacterBadge", () => {
    TraitRegistry.initialize();
    const researcherPreset = TraitRegistry.getPreset("researcher");
    expect(researcherPreset).toBeDefined();
    expect(researcherPreset.traits).toContain("sensor_antenna_scanner");
    expect(researcherPreset.traits).toContain("visor_analytical");
  });

  it("2. Resuelve correctamente los presets de cada Sub-Ego para avatares del chat", () => {
    const codePreset = TraitRegistry.getPreset("code_reviewer");
    expect(codePreset.id).toBe("code_reviewer");
    expect(codePreset.bodyColors[0]).toBe("#EDE9FE");
    expect(codePreset.eyeShape).toBe("wide");

    const nucleusPreset = TraitRegistry.getPreset("ego.nucleus");
    expect(nucleusPreset.id).toBe("ego.nucleus");
    expect(nucleusPreset.eyeShape).toBe("pill");
    expect(nucleusPreset.traits.length).toBe(0);
  });

  it("3. El vocabulario de 14 estados canónicos sobrevive (contrato chat ↔ badge)", () => {
    expect(CANONICAL_CHARACTER_STATES).toHaveLength(14);
    for (const s of CANONICAL_CHARACTER_STATES) {
      expect(mapCharacterStateToAvatarState(s)).toBeTruthy();
    }
  });

  it("4. El mapeo al vocabulario de <ego-avatar> es determinista y total", () => {
    expect(mapCharacterStateToAvatarState("idle")).toBe(
      mapCharacterStateToAvatarState("idle")
    );
    // Un estado desconocido NO rompe: degrada a un estado por defecto.
    const desconocido = mapCharacterStateToAvatarState("estado-inexistente");
    expect(typeof desconocido).toBe("string");
    expect(desconocido.length).toBeGreaterThan(0);
    const estado: CharacterState = "approval_required";
    expect(mapCharacterStateToAvatarState(estado)).toBeTruthy();
  });
});
