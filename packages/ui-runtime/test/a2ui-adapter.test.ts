import { describe, it, expect } from "vitest";
import {
  translateSurfaceUpdate,
  translateDataModelUpdate,
  translateBeginRendering,
} from "../src/A2UIAdapter.js";

describe("A2UIAdapter", () => {
  it("surfaceUpdate chart válido → inject", () => {
    const ops = translateSurfaceUpdate({
      surfaceId: "daily-report",
      components: [
        {
          id: "c1",
          type: "chart",
          props: {
            id: "c1",
            title: "T",
            chartType: "bar",
            data: [{ x: "a", y: 1 }],
            xKey: "x",
            yKeys: ["y"],
          },
        },
      ],
    });
    expect(ops[0].kind).toBe("inject");
  });

  it("componente desconocido → fallback graceful, no throw", () => {
    const ops = translateSurfaceUpdate({
      surfaceId: "s",
      components: [{ id: "x", type: "unknown-widget", props: {} }],
    });
    expect(ops[0].kind).toBe("fallback");
  });

  it("dataModelUpdate → ChangeSet update subego", () => {
    const cs = translateDataModelUpdate({ componentId: "c1", path: "title", value: "Nuevo" });
    expect(cs?.op).toBe("update");
    expect(cs?.origin).toBe("subego");
  });

  it("beginRendering retorna surfaceId", () => {
    expect(translateBeginRendering({ surfaceId: "daily-report" })).toBe("daily-report");
  });
});
