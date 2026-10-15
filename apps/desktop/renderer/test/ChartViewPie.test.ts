import { describe, it, expect } from "vitest";
import { computePieSlices } from "../components/canvas/ChartView.js";

describe("ChartView pie", () => {
  it("reparte 100 en dos slices 50/50", () => {
    const slices = computePieSlices(
      [
        { k: "a", v: 50 },
        { k: "b", v: 50 },
      ],
      "k",
      ["v"]
    );
    expect(slices).toHaveLength(2);
    expect(slices[0]?.fraction).toBeCloseTo(0.5);
    expect(slices[1]?.fraction).toBeCloseTo(0.5);
  });

  it("datos vacíos o ceros no crashean", () => {
    expect(computePieSlices([], "k", ["v"])).toEqual([]);
    expect(computePieSlices([{ k: "a", v: 0 }], "k", ["v"])).toEqual([]);
  });
});
