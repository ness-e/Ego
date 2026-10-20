import { describe, it, expect, vi } from "vitest";
import { ProjectMemoryGraph } from "../src/ProjectMemoryGraph.js";
import type { EgoMemoryAdapter } from "@ego/memory";

describe("VDB-REQ-12 — el sustrato de grafo se puebla con aristas reales", () => {
  it("(1) la traza de ingeniería enlaza sus referencias por fichero como aristas", async () => {
    const linkGraphNodes = vi.fn(async () => true);
    const adapter = {
      putMulti: vi.fn(async () => []),
      flush: vi.fn(async () => undefined),
      linkGraphNodes,
    } as unknown as EgoMemoryAdapter;

    const graph = new ProjectMemoryGraph(adapter);
    await graph.recordEngineeringTrace({
      id: "trace-1",
      decisionId: "dec-1",
      affectedFiles: ["packages/runtime/src/index.ts"],
      testFiles: ["packages/runtime/test/x.test.ts"],
      outcome: "ok",
      timestamp: Date.now(),
    });

    // Una arista por fichero afectado: traza → referencia.
    expect(linkGraphNodes).toHaveBeenCalledTimes(1);
    const [srcNs, srcKey, tgtNs, tgtKey, label] = linkGraphNodes.mock.calls[0] as unknown as string[];
    expect(srcNs).toBe("proj/traces");
    expect(srcKey).toBe("trace-1");
    expect(tgtNs).toBe("proj/file_traces");
    expect(tgtKey).toContain("trace-1");
    expect(label).toBe("derived_from");
  });

  it("(2) sin soporte de grafo el flujo KV NO se rompe", async () => {
    const adapter = {
      putMulti: vi.fn(async () => []),
      flush: vi.fn(async () => undefined),
    } as unknown as EgoMemoryAdapter;

    const graph = new ProjectMemoryGraph(adapter);
    await expect(
      graph.recordEngineeringTrace({
        id: "trace-2",
        decisionId: "dec-2",
        affectedFiles: ["a.ts"],
        testFiles: [],
        outcome: "ok",
        timestamp: Date.now(),
      })
    ).resolves.toBeUndefined();
    expect(adapter.putMulti).toHaveBeenCalled();
  });
});
