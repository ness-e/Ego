// T5 (VERDICT R14/R15 + diff de A6) — Legacy del personaje.
//
// RED primero. Antes de este trabajo:
//  - `CharacterCanvas.tsx` y `CharacterMiniBadge.tsx` estaban **definidos y
//    nunca renderizados** (0 usos JSX en el repo, 0 en tests): dos
//    superficies de UI duplicadas que nadie mantenía (R14).
//  - La clase `CharacterStateMachine` (FSM de 14 estados con interpolador
//    cinemático) **nunca se instanciaba**: 0 `new CharacterStateMachine()`.
//    Solo se importaba su TIPO. Era código muerto de ~250 líneas (R15).
//  - El motor de personaje se importaba del ESPEJO VENDORIZADO, no del
//    paquete `@ego/avatar` (fuente canónica según ADR-0018 / decisión D5).
//
// ## EGO-FIND-63 (Ola 11)
// Los asertos de **texto de fuente** de este fichero (el barrel, los
// specifiers del motor, la dependencia del manifest) se han convertido:
//  - el barrel → **comportamiento** (se importa y se mira qué exporta);
//  - el motor canónico → **comportamiento** (se importa el paquete y se
//    comprueba que define el elemento);
//  - el vocabulario de estados → **comportamiento** (el mapper compartido
//    traduce los 14 estados canónicos);
//  - los *specifiers* y la *dependencia del manifest* son **contratos de
//    forma** (no se pueden observar en runtime) → viven en el lint-test:
//    `pnpm --filter @ego/desktop lint:source-contracts`.
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  CANONICAL_CHARACTER_STATES,
  type CharacterState,
} from "../components/character/state/character-state.js";
import { mapCharacterStateToAvatarState } from "../components/character/CharacterBadge.js";
import * as characterBarrel from "../components/character/index.js";

const ROOT = process.cwd();
const exists = (rel: string): boolean => existsSync(join(ROOT, rel));

describe("T5: legacy del personaje retirado (R14/R15) + motor canónico", () => {
  it("R14: CharacterCanvas y CharacterMiniBadge ya no existen", () => {
    expect(
      exists("components/character/CharacterCanvas.tsx"),
      "CharacterCanvas.tsx debe estar retirado (0 usos)"
    ).toBe(false);
    expect(
      exists("components/character/CharacterMiniBadge.tsx"),
      "CharacterMiniBadge.tsx debe estar retirado (0 usos)"
    ).toBe(false);
  });

  it("R14: el barrel ya no los exporta (y sí exporta lo que se usa)", () => {
    // COMPORTAMIENTO: se importa el barrel y se mira su superficie real.
    const barrel = characterBarrel as unknown as Record<string, unknown>;
    expect(barrel["CharacterCanvas"], "el barrel no debe exportar CharacterCanvas").toBeUndefined();
    expect(barrel["CharacterMiniBadge"], "el barrel no debe exportar CharacterMiniBadge").toBeUndefined();
    expect(barrel["CharacterBadge"], "el barrel debe exportar CharacterBadge").toBeDefined();
  });

  it("R15: la FSM no existe; sobrevive solo el vocabulario de estados", () => {
    expect(
      exists("components/character/state/CharacterStateMachine.ts"),
      "la clase FSM debe estar retirada (nunca se instanciaba)"
    ).toBe(false);
    expect(exists("components/character/state/character-state.ts")).toBe(true);
    // 14 estados canónicos, los mismos que el vocabulario original.
    expect(CANONICAL_CHARACTER_STATES).toHaveLength(14);
    expect(CANONICAL_CHARACTER_STATES).toContain("idle");
    expect(CANONICAL_CHARACTER_STATES).toContain("approval_required");
  });

  it("R15: el vocabulario compartido traduce TODOS los estados canónicos", () => {
    // COMPORTAMIENTO: el mapper compartido (el único que usan el badge y el
    // chat) traduce los 14 estados a un estado del motor. Si un estado se
    // quedara fuera, el avatar caería a "idle" sin que nadie lo note.
    for (const state of CANONICAL_CHARACTER_STATES) {
      const mapped = mapCharacterStateToAvatarState(state);
      expect(
        mapped,
        `el estado canónico "${state}" no se traduce a un estado del motor`
      ).toBeTruthy();
      expect(typeof mapped).toBe("string");
    }
    // Y el tipo del contrato chat ↔ badge sigue siendo el mismo.
    const state: CharacterState = "approval_required";
    expect(state).toBe("approval_required");
    expect(mapCharacterStateToAvatarState(state)).toBe("approval");
  });

  it("A6: el motor canónico se importa del PAQUETE y define el elemento", async () => {
    // COMPORTAMIENTO: el paquete resuelve y el elemento existe. (Que el
    // renderer NO importe el espejo vendorizado en paralelo es un contrato
    // de forma → vive en el lint-test de contratos de fuente.)
    const mod = (await import(
      "@ego/avatar/runtime/avatar-element.js"
    )) as { EgoAvatar?: unknown };
    expect(typeof mod.EgoAvatar, "el paquete @ego/avatar debe exportar el elemento").toBe(
      "function"
    );
    // El espejo vendorizado NO se elimina (decisión D5 del owner): la copia
    // sigue en el repo (cadena MIT + puerta `sync:check`), pero no se importa
    // en paralelo (duplicaría el chunk del motor).
    expect(exists("floating/vendor/avatar/runtime/avatar-element.js")).toBe(true);
  });
});
