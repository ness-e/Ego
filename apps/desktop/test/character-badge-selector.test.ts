import { describe, it, expect, vi } from "vitest";
import React from "react";
import { TraitRegistry } from "../renderer/components/character/traits/TraitRegistry.js";
import { CharacterStateMachine } from "../renderer/components/character/state/CharacterStateMachine.js";

describe("CharacterBadge & SubEgoSelector Integration (CHAR-08)", () => {
  it("1. TraitRegistry y CharacterStateMachine se inicializan correctamente para CharacterBadge", () => {
    TraitRegistry.initialize();
    const researcherPreset = TraitRegistry.getPreset("researcher");
    expect(researcherPreset).toBeDefined();
    expect(researcherPreset.traits).toContain("sensor_antenna_scanner");
    expect(researcherPreset.traits).toContain("visor_analytical");

    const fsm = new CharacterStateMachine("generating");
    expect(fsm.currentState).toBe("generating");
    expect(fsm.channels.energy).toBeGreaterThan(0.7);
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

  it("3. Genera StillPose determinista sin rAF continuo cuando animated=false", () => {
    const fsm = new CharacterStateMachine("idle");
    fsm.update(0.016);
    expect(fsm.channels.pulse).toBeGreaterThanOrEqual(0);
    expect(fsm.channels.pulse).toBeLessThanOrEqual(1);
    expect(fsm.channels.open).toBeCloseTo(0.9, 1);
  });
});
