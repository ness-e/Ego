import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  CanvasComponentRegistry,
  getCanvasComponentRegistry,
  resetCanvasComponentRegistry,
} from "../src/index.js";

/**
 * EGO-FIND-47 (Ola 1 / A3 / T8) — Registro DINÁMICO de componentes.
 *
 * El renderer usaba un `Record` estático y cerrado de 11 tipos: no había
 * hot-swap ni registro de tipos nuevos en runtime.
 */
describe("T8 — CanvasComponentRegistry dinámico (EGO-FIND-47)", () => {
  it("registra y resuelve un componente nuevo en runtime (hot-swap)", () => {
    const registry = new CanvasComponentRegistry<string>();

    expect(registry.has("mi_widget")).toBe(false);
    registry.register("mi_widget", "RENDERER_MI_WIDGET");

    expect(registry.has("mi_widget")).toBe(true);
    expect(registry.resolve("mi_widget")).toBe("RENDERER_MI_WIDGET");
    expect(registry.list()).toContain("mi_widget");
  });

  it("permite sobrescribir un componente NO built-in", () => {
    const registry = new CanvasComponentRegistry<string>();
    registry.register("mi_widget", "V1");
    registry.register("mi_widget", "V2", { allowOverride: true });

    expect(registry.resolve("mi_widget")).toBe("V2");
  });

  it("protege los built-in: sobrescribir requiere permiso explícito", () => {
    const registry = new CanvasComponentRegistry<string>();
    registry.register("table", "BUILTIN_TABLE", { builtin: true });

    expect(() => registry.register("table", "OTRO")).toThrow(/built-in/i);
    expect(() => registry.register("table", "OTRO", { allowOverride: true })).not.toThrow();
  });

  it("un built-in no se puede eliminar", () => {
    const registry = new CanvasComponentRegistry<string>();
    registry.register("table", "BUILTIN_TABLE", { builtin: true });

    expect(() => registry.unregister("table")).toThrow(/built-in/i);
  });

  it("permite desregistrar un componente dinámico", () => {
    const registry = new CanvasComponentRegistry<string>();
    registry.register("mi_widget", "X");

    expect(registry.unregister("mi_widget")).toBe(true);
    expect(registry.has("mi_widget")).toBe(false);
    expect(registry.unregister("mi_widget")).toBe(false);
  });

  it("valida las props contra el esquema registrado", () => {
    const registry = new CanvasComponentRegistry<string>();
    registry.register("mi_widget", "X", {
      propsSchema: z.object({ title: z.string().min(1) }),
    });

    const ok = registry.validateProps("mi_widget", { title: "hola" });
    expect(ok.success).toBe(true);

    const ko = registry.validateProps("mi_widget", { title: "" });
    expect(ko.success).toBe(false);
  });

  it("un tipo sin esquema acepta cualquier props", () => {
    const registry = new CanvasComponentRegistry<string>();
    registry.register("mi_widget", "X");

    expect(registry.validateProps("mi_widget", { cualquier: true }).success).toBe(true);
  });

  it("rechaza tipos vacíos y renderers nulos", () => {
    const registry = new CanvasComponentRegistry<string>();

    expect(() => registry.register("", "X")).toThrow(/no puede estar vacío/i);
    expect(() => registry.register("x", null as unknown as string)).toThrow(/null\/undefined/i);
  });

  it("expone un singleton global reiniciable", () => {
    resetCanvasComponentRegistry();
    const registry = getCanvasComponentRegistry<string>();
    registry.register("global_widget", "G");

    expect(getCanvasComponentRegistry<string>().resolve("global_widget")).toBe("G");

    resetCanvasComponentRegistry();
    expect(getCanvasComponentRegistry<string>().has("global_widget")).toBe(false);
  });
});
