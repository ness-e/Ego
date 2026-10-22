/**
 * Ola 11 · A4 (T3) — Los dos avisos de A6 sobre el vocabulario del perfil.
 *
 * ## Aviso 1 — el vocabulario
 * A6 declara en `packages/avatar/src/runtime/profile.js` los rasgos y outfits
 * que el motor **no puede expresar** (`UNMAPPED_TRAITS`, `UNMAPPED_OUTFITS`).
 * La regla: si el renderer ofrece algo que el motor no expresa, o se
 * expresa, o **se declara** — nunca en silencio.
 *
 * ## Aviso 2 — la intensidad
 * La intensidad de los rasgos se perdía en el round-trip (el bridge ponía un
 * `1` fijo y el `outfitId` a `null`): un perfil guardado con
 * `intensity: 0.4` volvía como `1` al recargar y guardar.
 *
 * Estos tests son **de comportamiento** (el round-trip real) y de
 * **contrato de vocabulario** (el renderer no ofrece lo que el motor no
 * expresa).
 */
import { describe, it, expect } from "vitest";

// Ola 11 · A4: el vocabulario del MOTOR se compara en el lint-test de
// contratos (el motor no expone tipos para `profile.js` -> importarlo aqui
// rompia el typecheck del renderer). Ahi se comprueba que el renderer no
// ofrezca rasgos que el motor declara no mapeables.
import {
  loadCharacterConfig,
  toCharacterPayload,
  type CharacterMemoryGateway,
} from "../components/character/wardrobe/characterProfileBridge.js";
import { type CustomCharacterConfig } from "../components/character/wardrobe/WardrobeSelector.js";

describe("Ola 11 · T3 — el vocabulario del perfil (avisos de A6)", () => {
  it("aviso 2: la INTENSIDAD de los rasgos sobrevive al round-trip", async () => {
    const payload = {
      id: "char_test",
      name: "Test",
      baseForm: "quantum-monolith",
      palette: { primary: "#ff0000", secondary: "#00ff00", accent: "#ff0000" },
      defaultEye: "pill",
      defaultMouth: "flat",
      traits: [{ kind: "halo", intensity: 0.4, enabled: true }],
      scale: 1,
      pulseRate: 1,
      createdAtMs: 1,
      updatedAtMs: 2,
      // El perfil guardado lleva el `uiConfig` (los ajustes de la UI) en los
      // metadatos: sin él el round-trip perderia el eyeShape, el mouth, el
      // outfitId y las intensidades.
      metadata: {
        uiConfig: {
          subEgoId: "ego.test",
          name: "Test",
          bodyColors: ["#ff0000", "#00ff00"],
          eyeShape: "pill",
          baseForm: "quantum-monolith",
          // El config del renderer usa los ids de la UI ("aura_harmonic_halo"),
          // no los kinds del motor ("halo").
          traits: ["aura_harmonic_halo"],
          traitIntensities: { aura_harmonic_halo: 0.4 },
        },
      },
    };
    const gateway: CharacterMemoryGateway = {
      get: async () => payload,
      put: async () => undefined,
    };

    const config = await loadCharacterConfig("ego.test", gateway);
    expect(config, "el perfil debe recargarse").toBeTruthy();
    expect(
      config?.traitIntensities?.["aura_harmonic_halo"],
      "la intensidad debe llegar al config del renderer"
    ).toBe(0.4);

    // Y al volver a guardar, la intensidad sigue siendo la misma.
    const again = toCharacterPayload(config as CustomCharacterConfig);
    const halo = again.traits.find((t) => t.kind === "halo");
    expect(halo?.intensity, "la intensidad no puede perderse al guardar").toBe(0.4);
  });

  it("aviso 2: el outfitId también sobrevive al round-trip", async () => {
    const payload = {
      id: "char_test2",
      name: "Test",
      baseForm: "quantum-monolith",
      palette: { primary: "#ff0000", secondary: "#00ff00", accent: "#ff0000" },
      defaultEye: "pill",
      defaultMouth: "flat",
      traits: [],
      scale: 1,
      pulseRate: 1,
      createdAtMs: 1,
      updatedAtMs: 2,
      metadata: {
        uiConfig: {
          subEgoId: "ego.test2",
          name: "Test",
          bodyColors: ["#ff0000", "#00ff00"],
          eyeShape: "pill",
          baseForm: "quantum-monolith",
          outfitId: "cx-antenna",
          traits: [],
        },
      },
    };
    const gateway: CharacterMemoryGateway = {
      get: async () => payload,
      put: async () => undefined,
    };
    const config = await loadCharacterConfig("ego.test2", gateway);
    expect(config?.outfitId, "el outfit no puede perderse al recargar").toBe("cx-antenna");
  });
});
