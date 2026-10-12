import { describe, it, expect } from "vitest";
import {
  createAdmittedRunContext,
  toDecisionRunContext,
  fromDecisionRunContext,
  ADMISSION_SOURCE_TO_ORIGIN,
  ORIGIN_TO_ADMISSION_SOURCE,
  type DecisionRunContext,
} from "../src/AdmittedRunContext.js";

describe("AdmittedRunContext ↔ DecisionRunContext adapter (F3T6/H01)", () => {
  it("mapea cada AdmissionSource a un DecisionRunOrigin canónico", () => {
    expect(ADMISSION_SOURCE_TO_ORIGIN["user-chat"]).toBe("user_prompt");
    expect(ADMISSION_SOURCE_TO_ORIGIN["sub-ego"]).toBe("subego_delegation");
    expect(ADMISSION_SOURCE_TO_ORIGIN["background-task"]).toBe("background_task");
    expect(ORIGIN_TO_ADMISSION_SOURCE["user_prompt"]).toBe("user-chat");
    expect(ORIGIN_TO_ADMISSION_SOURCE["subego_delegation"]).toBe("sub-ego");
    expect(ORIGIN_TO_ADMISSION_SOURCE["background_task"]).toBe("background-task");
    expect(ORIGIN_TO_ADMISSION_SOURCE["system"]).toBe("system-hook");
  });

  it("proyecta un contexto de ejecución al wire de decisión sin casts", () => {
    const exec = createAdmittedRunContext({
      runId: "550e8400-e29b-41d4-a716-446655440000",
      admissionSource: "sub-ego",
      parentRunId: "660e8400-e29b-41d4-a716-446655440001",
    });

    const dec: DecisionRunContext = toDecisionRunContext(exec);

    expect(dec.runId).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(dec.parentRunId).toBe("660e8400-e29b-41d4-a716-446655440001");
    expect(dec.origin).toBe("subego_delegation");
    expect(dec.timestamp).toBe(exec.createdAt);
    expect(dec.depth).toBe(0);
  });

  it("re-admite un contexto de decisión preservando runId, origen y profundidad", () => {
    const dec: DecisionRunContext = {
      runId: "770e8400-e29b-41d4-a716-446655440002",
      timestamp: 1728570000000,
      depth: 2,
      parentRunId: "880e8400-e29b-41d4-a716-446655440003",
      origin: "background_task",
    };

    const exec = fromDecisionRunContext(dec, { traceId: "trc_fixed1234abcd", priority: 3 });
    const back: DecisionRunContext = toDecisionRunContext(exec);

    expect(exec.operationalRunInstance.runId).toBe(dec.runId);
    expect(exec.admissionSource).toBe("background-task");
    expect(exec.parentRunId).toBe(dec.parentRunId);
    expect(exec.traceId).toBe("trc_fixed1234abcd");
    expect(exec.priority).toBe(3);
    expect(back.depth).toBe(2);
    expect(back.origin).toBe("background_task");
    expect(back.runId).toBe(dec.runId);
  });
});
