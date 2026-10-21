/**
 * E6/Ola 2 (A4) — GUARD DE CONTRATO: el vocabulario del chat contra el
 * vocabulario del MOTOR.
 *
 * ## Qué afirma (y por qué este guard existe)
 *
 * El motor canónico (`@ego/avatar`) define los estados que el `<ego-avatar>`
 * sabe representar. El chat define su propio vocabulario
 * (`CharacterState`) y `mapCharacterStateToAvatarState` traduce uno en otro.
 *
 * Esa traducción **se callaba los estados que no tenía caso**: un
 * `CharacterState` sin rama caía en `default: return "idle"` y el estado se
 * perdía en silencio. Pasó con `warning` (A6 lo añadió al motor, pero el
 * renderer no lo pedía) y volverá a pasar con el próximo estado que se
 * añada al motor.
 *
 * Este guard cierra el circuito: **todo** estado del tipo `CharacterState`
 * debe traducirse a un estado que **existe en el motor**, y la traducción no
 * puede ser el `idle` de reserva (eso significa "falta el caso").
 *
 * ## De dónde sale la lista de estados del motor
 * Del **fuente canónico** `packages/avatar/src/runtime/states.js` (el mismo
 * fichero que usa el motor en runtime), leído en tiempo de test. No se
 * importa el paquete (su `exports` no expone `states.js`, y atravesar la
 * frontera del paquete desde el renderer duplicaría el motor en el bundle).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CANONICAL_CHARACTER_STATES,
  type CharacterState,
} from "../components/character/state/character-state.js";
import { mapCharacterStateToAvatarState } from "../components/character/CharacterBadge.js";

/** Estados que el motor canónico sabe representar. */
function engineStateNames(): string[] {
  const src = readFileSync(
    join(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      "packages",
      "avatar",
      "src",
      "runtime",
      "states.js"
    ),
    "utf8"
  );
  const start = src.indexOf("export const STATES = Object.freeze({");
  expect(start, "no se encontró STATES en el motor canónico").toBeGreaterThan(-1);
  const end = src.indexOf("\n});", start);
  const block = src.slice(start, end);
  const names = [...block.matchAll(/^\s{2}([a-z_]+):\s*\{/gm)].map(
    (m) => m[1]!
  );
  expect(names.length, "no se pudo leer la lista de estados del motor").toBeGreaterThan(
    5
  );
  return names;
}

const ENGINE_STATES = engineStateNames();

describe("E6 — contrato chat ↔ motor: todo CharacterState existe en el motor", () => {
  it("el motor canónico declara el estado `warning` (A6, Ola 2)", () => {
    expect(ENGINE_STATES).toContain("warning");
  });

  it("todo CharacterState se traduce a un estado que EXISTE en el motor", () => {
    const offenders: string[] = [];
    for (const state of CANONICAL_CHARACTER_STATES) {
      const mapped = mapCharacterStateToAvatarState(state);
      if (!ENGINE_STATES.includes(mapped)) {
        offenders.push(`${state} → ${mapped} (no existe en el motor)`);
      }
    }
    expect(
      offenders,
      `estados del chat sin equivalente en el motor:\n  ${offenders.join("\n  ")}`
    ).toEqual([]);
  });

  it("ningún CharacterState cae en el `idle` de reserva (eso = falta el caso)", () => {
    // `idle` es el `default` del mapa: si un estado noIdle acaba en `idle`,
    // es que su `case` no existe y el estado se ha perdido en silencio.
    const offenders = CANONICAL_CHARACTER_STATES.filter(
      (state) => state !== "idle" && mapCharacterStateToAvatarState(state) === "idle"
    );
    expect(
      offenders,
      `estados que caen en el idle de reserva (falta el case): ${offenders.join(", ")}`
    ).toEqual([]);
  });

  it("`warning` se traduce a `warning` (no se pierde)", () => {
    expect(mapCharacterStateToAvatarState("warning")).toBe("warning");
  });

  it("el mapa es total: un estado desconocido cae en `idle` (fail-safe)", () => {
    expect(mapCharacterStateToAvatarState(undefined)).toBe("idle");
    expect(mapCharacterStateToAvatarState("estado-inventado")).toBe("idle");
  });

  it("cada estado del chat traduce a un estado CONOCIDO por el motor (el motor valida)", () => {
    // El motor lanza `[ego-avatar] estado desconocido` si el nombre no está
    // en su tabla. Es la comprobación de comportamiento del lado del motor.
    for (const state of CANONICAL_CHARACTER_STATES) {
      const mapped = mapCharacterStateToAvatarState(state);
      expect(
        ENGINE_STATES.includes(mapped),
        `el motor no conoce "${mapped}" (traducción de "${state}")`
      ).toBe(true);
    }
  });

  it("el conjunto del chat y el del motor comparten los estados de señal", () => {
    // Los estados que el chat puede pedir y que el motor representa con una
    // señal DISTINTA (no una imagen genérica).
    const signaled: CharacterState[] = [
      "warning",
      "error",
      "success",
      "question",
      "searching",
      "sleeping",
    ];
    for (const state of signaled) {
      const mapped = mapCharacterStateToAvatarState(state);
      expect(
        ENGINE_STATES.includes(mapped),
        `"${state}" → "${mapped}" no existe en el motor`
      ).toBe(true);
    }
  });
});
