import { describe, it, expect } from "vitest";
import {
  ComponentRegistry,
  getComponentRenderer,
  CanvasPropsSchema,
  type ComponentRendererProps,
} from "../components/canvas/registry.js";

// T06 S2 (RED): registry tipado — `props: any` eliminado, inferido desde Zod.
describe("T06 UI-03: registry canvas tipado (Zod, sin any)", () => {
  it("expone CanvasPropsSchema que acepta records y rechaza no-records", () => {
    expect(CanvasPropsSchema.safeParse({ title: "hola", count: 3 }).success).toBe(true);
    expect(CanvasPropsSchema.safeParse("plano").success).toBe(false);
    expect(CanvasPropsSchema.safeParse(null).success).toBe(false);
    expect(CanvasPropsSchema.safeParse([1, 2]).success).toBe(false);
  });

  it("resuelve un renderer para cada tipo canónico del registry", () => {
    const types = Object.keys(ComponentRegistry) as Array<
      Parameters<typeof getComponentRenderer>[0]
    >;
    expect(types.length).toBeGreaterThan(0);
    for (const t of types) {
      expect(getComponentRenderer(t)).not.toBeNull();
    }
    expect(getComponentRenderer("table")).not.toBeNull();
  });

  it("ComponentRendererProps.props admite unknown estructurado (type-level, ver tsc)", () => {
    const probe: ComponentRendererProps = {
      props: { title: "x", rows: [] as unknown[] },
    };
    expect(probe.props).toBeDefined();
  });
});
