import { describe, it, expect, vi, beforeEach } from "vitest";
import { contextBridge, ipcRenderer } from "electron";

vi.mock("electron", () => {
  return {
    contextBridge: {
      exposeInMainWorld: vi.fn(),
    },
    ipcRenderer: {
      invoke: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    },
    screen: {
      getPrimaryDisplay: vi.fn(() => ({
        workAreaSize: { width: 1920, height: 1080 },
        workArea: { x: 0, y: 0, width: 1920, height: 1080 },
      })),
      getDisplayNearestPoint: vi.fn(() => ({
        workArea: { x: 0, y: 0, width: 1920, height: 1080 },
      })),
      getCursorScreenPoint: vi.fn(() => ({ x: 500, y: 500 })),
    },
  };
});

function getExposedEgo(): Record<string, Record<string, (arg?: unknown) => Promise<unknown>>> {
  const calls = vi.mocked(contextBridge.exposeInMainWorld).mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  expect(calls[0][0]).toBe("ego");
  return calls[0][1] as unknown as Record<string, Record<string, (arg?: unknown) => Promise<unknown>>>;
}

describe("@ego/desktop — puente preload knowledge/decision (F5T10/H25)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    await import("../src/preload.js");
  });

  it("expone sección knowledge con los 8 canales ipc.knowledge.*", async () => {
    const ego = getExposedEgo();
    expect(ego.knowledge).toBeDefined();

    const cases: Array<[string, string]> = [
      ["ingest", "ipc.knowledge.ingest"],
      ["hybridSearch", "ipc.knowledge.hybridSearch"],
      ["graphRag", "ipc.knowledge.graphRag"],
      ["quarantine", "ipc.knowledge.quarantine"],
      ["asOf", "ipc.knowledge.asOf"],
      ["explainArtifact", "ipc.knowledge.explainArtifact"],
      ["exportPackage", "ipc.knowledge.export"],
      ["importPackage", "ipc.knowledge.import"],
    ];
    for (const [fn, channel] of cases) {
      expect(typeof ego.knowledge[fn]).toBe("function");
      await ego.knowledge[fn]({ probe: true });
      expect(vi.mocked(ipcRenderer.invoke)).toHaveBeenCalledWith(channel, { probe: true });
    }
  });

  it("expone sección decision con los 3 canales ipc.decision.*", async () => {
    const ego = getExposedEgo();
    expect(ego.decision).toBeDefined();

    await ego.decision.evaluate({ probe: true });
    expect(vi.mocked(ipcRenderer.invoke)).toHaveBeenCalledWith("ipc.decision.evaluate", { probe: true });
    await ego.decision.listAudits(10);
    expect(vi.mocked(ipcRenderer.invoke)).toHaveBeenCalledWith("ipc.decision.listAudits", 10);
    await ego.decision.telemetry();
    expect(vi.mocked(ipcRenderer.invoke)).toHaveBeenCalledWith("ipc.decision.telemetry");
  });
});
