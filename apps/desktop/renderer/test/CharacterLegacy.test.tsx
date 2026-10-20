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
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  CANONICAL_CHARACTER_STATES,
  type CharacterState,
} from "../components/character/state/character-state.js";

const ROOT = process.cwd();
const read = (rel: string): string => {
  const p = join(ROOT, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : "";
};
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

  it("R14: el barrel ya no los exporta", () => {
    const barrel = read("components/character/index.ts");
    expect(barrel).not.toContain("CharacterCanvas");
    expect(barrel).not.toContain("CharacterMiniBadge");
    // El barrel sigue exportando lo que SÍ se usa.
    expect(barrel).toContain("CharacterBadge");
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

  it("R15: nadie instancia la FSM en el renderer", () => {
    const badge = read("components/character/CharacterBadge.tsx");
    const chat = read("components/ego-chat.tsx");
    expect(badge).not.toContain("new CharacterStateMachine");
    expect(chat).not.toContain("new CharacterStateMachine");
    // Y el import del vocabulario apunta al módulo nuevo.
    expect(badge).toContain("state/character-state.js");
    expect(chat).toContain("state/character-state.js");
  });

  it("A6: el motor se importa desde el PAQUETE canónico", () => {
    const badge = read("components/character/CharacterBadge.tsx");
    expect(badge).toContain('"@ego/avatar/runtime/avatar-element.js"');
    // El espejo vendorizado NO se elimina (decisión D5 del owner): la copia
    // sigue en el repo (cadena MIT + puerta `sync:check`), pero no se
    // importa en paralelo (duplicaría el chunk del motor).
    expect(exists("floating/vendor/avatar/runtime/avatar-element.js")).toBe(
      true
    );
    const floating = read("floating/floating-avatar.tsx");
    expect(floating).toContain('"@ego/avatar/runtime/avatar-element.js"');
  });

  it("A6: el renderer declara la dependencia del paquete", () => {
    const pkg = JSON.parse(
      read("package.json").length > 0 ? read("package.json") : "{}"
    ) as { dependencies?: Record<string, string> };
    expect(pkg.dependencies?.["@ego/avatar"]).toBe("workspace:*");
  });

  it("el tipo CharacterState sigue siendo el contrato chat ↔ badge", () => {
    const state: CharacterState = "approval_required";
    expect(state).toBe("approval_required");
    const badge = read("components/character/CharacterBadge.tsx");
    expect(badge).toContain("mapCharacterStateToAvatarState");
  });
});
