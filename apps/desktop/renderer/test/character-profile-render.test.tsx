/**
 * Ola 12 · A4 (EGO-FIND-116) — El perfil del personaje llega al motor en la
 * **forma canónica** y **se aplica** (no "se acepta el atributo").
 *
 * ## El problema que este test fija
 * El motor (`packages/avatar/src/runtime/profile.js`, zona de A6) entiende el
 * vocabulario **canónico** (`TraitKind`: `antennae`, `geometric-crest`,
 * `energy-cores`, `aura-field`, `halo`, `orbital-rings`, `quantum-crown`).
 * El renderer guarda el perfil con el vocabulario **de la UI**
 * (`sensor_antenna_scanner`, `visor_analytical`, …).
 *
 * Si el `CharacterBadge` manda los ids de la UI tal cual, el motor los
 * declara `unmapped` y **no aplica nada**: el perfil persiste, hace
 * round-trip… y el avatar sigue igual. Este test mide ese hueco y lo
 * cierra.
 *
 * ## Qué se comprueba (por COMPORTAMIENTO, no por el texto del atributo)
 * 1. La forma canónica (`{kind, intensity}`) **cambia el render**: se dibuja
 *    el apéndice y la marca, y el genoma lleva las palancas del motor.
 * 2. La **intensidad** se expresa **sólo** donde el motor tiene palanca
 *    (el aura): el resto se aplica, pero su magnitud no se puede expresar
 *    → el motor lo declara (`unmappedIntensity`). No se inventan magnitudes.
 * 3. Los ids de la UI **no** alcanzan el motor (por eso hay que traducirlos).
 * 4. El bridge traduce **todos** los rasgos que la UI ofrece y **declara**
 *    los que no tienen kind canónico.
 * 5. El `CharacterBadge` manda la forma canónica (no los ids de la UI).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
// Registra el custom element `<ego-avatar>` (el motor canónico).
import "@ego/avatar/runtime/avatar-element.js";
// El vocabulario canónico del motor (tipado por A6): permite cotejarlo.
import {
  AURA_RANGE,
  TRAIT_KINDS,
  UNMAPPED_INTENSITIES,
  UNMAPPED_TRAITS,
  resolveProfile,
} from "@ego/avatar/runtime/profile.js";
import { CharacterBadge } from "../components/character/CharacterBadge.js";
import { TraitRegistry } from "../components/character/traits/TraitRegistry.js";
import {
  BridgeTraitKindSchema,
  UNMAPPED_TRAITS_IN_RENDERER,
  toCanonicalTraits,
} from "../components/character/wardrobe/characterProfileBridge.js";

/** El genoma del motor (los genes que el perfil puede mover). */
interface AvatarGenome {
  shape: { roundness: number; ratio: number };
  appendage?: string;
  marking?: string;
  aura?: number;
}

/** El custom element con su superficie pública (declarada en el `.d.ts` del paquete). */
interface AvatarElement extends HTMLElement {
  toSVGString(): string;
  getGenome(): AvatarGenome;
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

/** Monta un `<ego-avatar>` con los atributos dados (conectado y con perfil). */
function mountAvatar(attrs: Record<string, string>): AvatarElement {
  const el = document.createElement("ego-avatar") as AvatarElement;
  document.body.appendChild(el);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  return el;
}

describe("Ola 12 · T1 — el perfil se aplica al render (forma canónica)", () => {
  it("un perfil con rasgos canónicos CAMBIA el render (el SVG, no el atributo)", () => {
    const plain = mountAvatar({ "base-form": "quantum-monolith" });
    const profiled = mountAvatar({
      "base-form": "quantum-monolith",
      traits: JSON.stringify([
        { kind: "antennae", intensity: 1, enabled: true },
        { kind: "energy-cores", intensity: 1, enabled: true },
      ]),
    });

    // El apéndice se DIBUJA (no sólo se acepta el atributo).
    expect(
      plain.shadowRoot?.querySelector(".appendage-part"),
      "sin perfil no debe haber apéndice"
    ).toBeNull();
    expect(
      profiled.shadowRoot?.querySelector(".appendage-part"),
      "con el rasgo `antennae` el apéndice debe dibujarse"
    ).not.toBeNull();

    // Y el genoma lleva las palancas del motor.
    expect(profiled.getGenome().appendage).toBe("antenna");
    expect(profiled.getGenome().marking).toBe("dots");

    // El SVG exportado es distinto (la silueta/marca cambian).
    expect(profiled.toSVGString()).not.toBe(plain.toSVGString());
  });

  it("la baseForm también mueve la silueta (no sólo el apéndice)", () => {
    const round = mountAvatar({ "base-form": "quantum-monolith" });
    const angular = mountAvatar({ "base-form": "fractal-polyhedron" });
    expect(round.getGenome().shape.roundness).toBeGreaterThan(
      angular.getGenome().shape.roundness
    );
    expect(round.toSVGString()).not.toBe(angular.toSVGString());
  });

  it("la INTENSIDAD se expresa donde el motor tiene palanca: el aura", () => {
    // El aura es la ÚNICA palanca de magnitud del motor (AURA_RANGE).
    const bajo = mountAvatar({
      traits: JSON.stringify([{ kind: "aura-field", intensity: 0, enabled: true }]),
    });
    const alto = mountAvatar({
      traits: JSON.stringify([{ kind: "aura-field", intensity: 1, enabled: true }]),
    });
    expect(bajo.getGenome().aura).toBeDefined();
    expect(alto.getGenome().aura).toBeDefined();
    expect(bajo.getGenome().aura!).toBeLessThan(alto.getGenome().aura!);
  });

  it("un rasgo desactivado NO se aplica (eso sí se puede expresar)", () => {
    const off = mountAvatar({
      traits: JSON.stringify([{ kind: "antennae", intensity: 1, enabled: false }]),
    });
    expect(off.getGenome().appendage).not.toBe("antenna");
    expect(off.shadowRoot?.querySelector(".appendage-part")).toBeNull();
  });

  it("los ids de la UI NO alcanzan el motor (por eso hay que traducirlos)", () => {
    // Caracterización del hueco: el motor sólo conoce el vocabulario canónico.
    const el = mountAvatar({
      traits: JSON.stringify(["sensor_antenna_scanner"]),
    });
    expect(el.getGenome().appendage).not.toBe("antenna");
    expect(el.shadowRoot?.querySelector(".appendage-part")).toBeNull();
  });
});

describe("Ola 12 · T2 — el bridge traduce al vocabulario canónico", () => {
  it("traduce los ids de la UI a kinds canónicos con su intensidad", () => {
    const canonical = toCanonicalTraits({
      traits: ["sensor_antenna_scanner", "aura_harmonic_halo"],
      traitIntensities: { sensor_antenna_scanner: 0.4 },
    });
    expect(canonical.entries).toEqual([
      { kind: "antennae", intensity: 0.4, enabled: true },
      { kind: "halo", intensity: 1, enabled: true },
    ]);
    expect(canonical.unmapped).toEqual([]);
  });

  it("un id de la UI SIN kind canónico se DECLARA (no se inventa)", () => {
    const canonical = toCanonicalTraits({
      traits: ["sensor_antenna_scanner", "rasgo_que_no_existe"],
    });
    expect(canonical.entries.map((e) => e.kind)).toEqual(["antennae"]);
    expect(canonical.unmapped).toEqual(["rasgo_que_no_existe"]);
  });

  it("TODOS los rasgos que ofrece la UI tienen kind canónico", () => {
    TraitRegistry.initialize();
    const offered = TraitRegistry.listTraits().map((t) => t.id);
    expect(offered.length, "la UI debe ofrecer rasgos").toBeGreaterThan(0);
    for (const id of offered) {
      const canonical = toCanonicalTraits({ traits: [id] });
      expect(
        canonical.unmapped,
        `el rasgo de la UI "${id}" no tiene kind canónico: el motor lo ignoraría`
      ).toEqual([]);
    }
  });
});

describe("Ola 12 · T2b — el vocabulario del renderer y el del motor COINCIDEN", () => {
  it("el enum de rasgos del renderer es EXACTAMENTE el del motor", () => {
    expect([...BridgeTraitKindSchema.options].sort()).toEqual(
      Object.keys(TRAIT_KINDS).sort()
    );
  });

  it("la lista de no-mapeables del renderer es la del motor (nunca en silencio)", () => {
    expect([...UNMAPPED_TRAITS_IN_RENDERER].sort()).toEqual([...UNMAPPED_TRAITS].sort());
  });

  it("el motor DECLARA los rasgos cuya intensidad no tiene palanca (sólo el aura)", () => {
    // El aura es la ÚNICA palanca de magnitud del motor (AURA_RANGE).
    const conAura = resolveProfile({
      traits: [{ kind: "aura-field", intensity: 0.4, enabled: true }],
    });
    expect(conAura.aura).toBeDefined();
    expect(conAura.unmappedIntensity).not.toContain("aura-field");

    // Los demás SE APLICAN, pero su magnitud no se puede expresar → el motor
    // lo declara (no finge una magnitud inventada).
    for (const kind of [
      "antennae",
      "geometric-crest",
      "energy-cores",
      "halo",
      "orbital-rings",
      "quantum-crown",
    ]) {
      const resolved = resolveProfile({
        traits: [{ kind, intensity: 0.4, enabled: true }],
      });
      expect(
        resolved.unmappedIntensity,
        `el motor debe declarar que "${kind}" no tiene palanca de magnitud`
      ).toContain(kind);
      expect(UNMAPPED_INTENSITIES).toContain(kind);
      // Y el rasgo SÍ se aplica (no es un no-mapeable).
      expect(resolved.unmapped).not.toContain(kind);
    }
  });

  it("la intensidad del aura se mapea al rango del motor", () => {
    const [lo, hi] = AURA_RANGE;
    expect(
      resolveProfile({ traits: [{ kind: "aura-field", intensity: 0, enabled: true }] })
        .aura
    ).toBeCloseTo(lo);
    expect(
      resolveProfile({ traits: [{ kind: "aura-field", intensity: 1, enabled: true }] })
        .aura
    ).toBeCloseTo(hi);
  });

  it("un kind canónico que el motor no tiene se DECLARA (unmapped)", () => {
    const resolved = resolveProfile({
      traits: [{ kind: "kind_que_no_existe", intensity: 1, enabled: true }],
    });
    expect(resolved.unmapped).toContain("kind_que_no_existe");
  });

  it("las CINCO palancas del motor se mueven con el perfil canónico", () => {
    // Las cinco palancas que el motor puede expresar con el perfil:
    // silueta · apéndice · marca · aura · accesorio.
    const resolved = resolveProfile({
      baseForm: "fractal-polyhedron",
      traits: [
        { kind: "antennae", intensity: 1, enabled: true },
        { kind: "energy-cores", intensity: 1, enabled: true },
        { kind: "aura-field", intensity: 0.6, enabled: true },
        { kind: "quantum-crown", intensity: 1, enabled: true },
      ],
    });
    // 1) la silueta (la baseForm)
    expect(resolved.shape.roundness).toBe(26); // fractal-polyhedron
    // 2) el apéndice
    expect(resolved.appendage).toBe("antenna");
    // 3) la marca
    expect(resolved.marking).toBe("dots");
    // 4) el aura (la única magnitud)
    expect(resolved.aura).toBeCloseTo(AURA_RANGE[0] + (AURA_RANGE[1] - AURA_RANGE[0]) * 0.6);
    // 5) el accesorio
    expect(resolved.accessory).toBe("crown");
    // Y nada queda sin mapear (todo lo pedido se aplica).
    expect(resolved.unmapped).toEqual([]);
  });
});

describe("Ola 12 · T3 — el badge manda la forma canónica al motor", () => {
  it("el `traits` del <ego-avatar> lleva kinds canónicos (no los ids de la UI)", async () => {
    const profile = {
      id: "char_test",
      name: "Test",
      baseForm: "quantum-monolith",
      palette: { primary: "#06b6d4", secondary: "#083344", accent: "#06b6d4" },
      defaultEye: "pill",
      defaultMouth: "flat",
      traits: [{ kind: "antennae", intensity: 0.4, enabled: true }],
      scale: 1,
      pulseRate: 1,
      createdAtMs: 1,
      updatedAtMs: 2,
      metadata: {
        uiConfig: {
          subEgoId: "ego.nucleus",
          name: "Test",
          bodyColors: ["#06b6d4", "#083344"],
          eyeShape: "pill",
          baseForm: "quantum-monolith",
          traits: ["sensor_antenna_scanner"],
          traitIntensities: { sensor_antenna_scanner: 0.4 },
        },
      },
    };
    const memory = (
      window as unknown as { ego: { memory: ReturnType<typeof vi.fn> } }
    ).ego.memory;
    memory.mockReset();
    memory.mockResolvedValue({ ok: true, payload: profile });

    const { container } = render(<CharacterBadge subEgoId="ego.nucleus" mode="svg" />);

    const el = await waitFor(() => {
      const node = container.querySelector("ego-avatar");
      expect(node, "el badge debe montar el motor").not.toBeNull();
      return node as AvatarElement;
    });
    // El perfil se carga asíncronamente: se espera a que el atributo llegue.
    await waitFor(() => {
      expect(el.getAttribute("traits")).toBeTruthy();
    });

    const entries = JSON.parse(el.getAttribute("traits") ?? "[]") as Array<{
      kind: string;
      intensity: number;
      enabled: boolean;
    }>;
    // Kinds CANÓNICOS (el motor los entiende)…
    expect(entries.map((e) => e.kind)).toEqual(["antennae"]);
    // …y con la intensidad del perfil.
    const [first] = entries;
    expect(first?.intensity).toBe(0.4);
    expect(first?.enabled).toBe(true);

    // Y el resultado es que el render cambia (el apéndice se dibuja).
    await waitFor(() => {
      expect(el.shadowRoot?.querySelector(".appendage-part")).not.toBeNull();
    });
  });
});
