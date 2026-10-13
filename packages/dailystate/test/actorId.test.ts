import { describe, it, expect } from "vitest";
import { parseActorId } from "../src/actorId.js";

describe("parseActorId (F4T9/M24 — helper común)", () => {
  it("resuelve string directo en payload.subEgoId", () => {
    expect(parseActorId({ subEgoId: "ego.architect" }, {})).toBe("ego.architect");
  });

  it("resuelve objeto { id } en payload", () => {
    expect(parseActorId({ subEgoId: { id: "subego.alpha" } }, {})).toBe("subego.alpha");
  });

  it("resuelve objeto etiquetado VDB { String } en payload (rama .String)", () => {
    expect(parseActorId({ subEgoId: { String: "subego.legacy" } }, {})).toBe("subego.legacy");
  });

  it("prefiere { id } sobre { String } en payload (precedencia histórica)", () => {
    expect(parseActorId({ subEgoId: { id: "a", String: "b" } }, {})).toBe("a");
  });

  it("cae a payload.actor cuando no hay subEgoId", () => {
    expect(parseActorId({ actor: "ego.runner" }, {})).toBe("ego.runner");
  });

  it("cae a metadata.agent_id string", () => {
    expect(parseActorId({}, { agent_id: "subego.meta" })).toBe("subego.meta");
  });

  it("resuelve metadata.agent_id etiquetado { String }", () => {
    expect(parseActorId({}, { agent_id: { String: "subego.tagged" } })).toBe("subego.tagged");
  });

  it("prefiere { String } sobre { id } en metadata (precedencia histórica)", () => {
    expect(parseActorId({}, { agent_id: { id: "a", String: "b" } })).toBe("b");
  });

  it("ignora strings vacíos y usa el fallback", () => {
    expect(parseActorId({ subEgoId: "  " }, { agent_id: "" })).toBe("ego.nucleus");
  });

  it("retorna el fallback personalizado cuando no hay actor", () => {
    expect(parseActorId({}, {}, "custom.fallback")).toBe("custom.fallback");
  });

  it("prefiere payload sobre metadata", () => {
    expect(parseActorId({ subEgoId: "ego.a" }, { agent_id: "ego.b" })).toBe("ego.a");
  });
});
