import { describe, it, expect } from "vitest";
import {
  FloatingToggleSchema,
  FloatingRestoreMainSchema,
  LlmCancelSchema,
  EgoIpcInvokeChannels,
  EgoIpcSchemas,
} from "../src/ipc.js";

/**
 * T4 (EGO-FIND-30, EGO-FIND-31) — Fail-closed en los 2 handlers permisivos.
 *
 * - `ipc.floating.toggle` usaba una type assertion (`rawReq as {state?}`)
 *   sin Zod: aceptaba CUALQUIER string fuera de la unión y el schema
 *   `FloatingToggleSchema` (ya declarado en `src/ipc.ts`) estaba muerto.
 * - `ipc.llm.cancel` era fail-OPEN: si Zod fallaba, `turnId` quedaba
 *   `undefined` → abortaba TODOS los turnos activos en vez de rechazar el
 *   payload inválido.
 *
 * T9 (EGO-FIND-59) — El contrato IPC debe mapear canal → schema para los 79
 * canales invoke, de modo que un canal nuevo sin schema no compile.
 */
describe("T4: fail-closed en ipc.floating.toggle e ipc.llm.cancel", () => {
  it("FloatingToggleSchema acepta solo la unión documentada", () => {
    for (const ok of ["compact", "expanded", "hidden"]) {
      expect(FloatingToggleSchema.safeParse({ state: ok }).success, ok).toBe(true);
    }
    // Sin payload: el toggle cicla (semántica original).
    expect(FloatingToggleSchema.safeParse(undefined).success).toBe(true);
    expect(FloatingToggleSchema.safeParse({}).success).toBe(true);
  });

  it("FloatingToggleSchema rechaza estados fuera de la unión", () => {
    for (const bad of ["minimized", "CUALQUIER_COSA", 42, true, { state: "hidden2" }]) {
      expect(FloatingToggleSchema.safeParse(bad).success, String(bad)).toBe(false);
    }
  });

  it("FloatingRestoreMainSchema acepta el payload vacío", () => {
    expect(FloatingRestoreMainSchema.safeParse(undefined).success).toBe(true);
    expect(FloatingRestoreMainSchema.safeParse({}).success).toBe(true);
  });

  it("LlmCancelSchema distingue 'payload explícito vacío' de 'payload inválido'", () => {
    // Vacío explícito → aborta todos (comportamiento documentado).
    expect(LlmCancelSchema.safeParse({}).success).toBe(true);
    expect(LlmCancelSchema.safeParse(undefined).success).toBe(true);
    // Inválido → debe rechazarse (fail-closed), no degradar a "abortar todos".
    for (const bad of [{ turnId: "" }, { turnId: 42 }, { turnId: "x".repeat(200) }, "abc", 7]) {
      expect(LlmCancelSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("T9: el contrato IPC declara schema para cada canal invoke", () => {
  it("EgoIpcSchemas cubre TODOS los canales invoke", () => {
    const missing = EgoIpcInvokeChannels.filter(
      (ch) => !(ch in EgoIpcSchemas)
    );
    expect(
      missing,
      `canales invoke sin schema en el contrato: ${missing.join(", ")}`
    ).toEqual([]);
  });

  it("EgoIpcSchemas no declara canales inexistentes", () => {
    const known = new Set<string>(EgoIpcInvokeChannels);
    const orphan = Object.keys(EgoIpcSchemas).filter((ch) => !known.has(ch));
    expect(orphan, `schemas sin canal: ${orphan.join(", ")}`).toEqual([]);
  });
});
