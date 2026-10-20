import { describe, it, expect } from "vitest";
import {
  CanvasComponentRegistry,
  MERMAID_COMPONENT_KIND,
  MermaidComponentPropsSchema,
  prepareMermaidComponent,
  createMermaidComponentDescriptor,
  PayloadRegistry,
} from "../src/index.js";

/**
 * T5.3 (Ola 1b) — Cableado de módulos asimilados sin caller (OCLW-11, COUC-08).
 *
 * - `MermaidRenderer` (OCLW-11) era código asimilado sin cablear → ahora es el
 *   tipo de componente `mermaid` del Canvas, con preparador de props
 *   (validación + saneado anti-XSS + directivas de tema).
 * - `PayloadRef`/`PayloadRegistry` (COUC-08) era un duplicado browser-safe sin
 *   caller → ahora es el proveedor de recursos del servidor MCP de Ego
 *   (`resources/list` + `resources/read`).
 */
describe("T5.3 — Mermaid como componente del Canvas (OCLW-11)", () => {
  it("el tipo `mermaid` queda registrado con su esquema y preparador", () => {
    const registry = new CanvasComponentRegistry<string>();
    const descriptor = createMermaidComponentDescriptor();

    registry.register(MERMAID_COMPONENT_KIND, descriptor.kind, {
      propsSchema: MermaidComponentPropsSchema,
      prepare: descriptor.prepare,
      builtin: true,
    });

    expect(registry.has(MERMAID_COMPONENT_KIND)).toBe(true);
    expect(registry.hasPrepare(MERMAID_COMPONENT_KIND)).toBe(true);
  });

  it("un diagrama válido se sanea y se preparan las directivas de tema", () => {
    const prepared = prepareMermaidComponent({
      source: "flowchart TD\n  A[Uno] --> B[Dos]",
      theme: {
        background: "#111",
        foreground: "#eee",
        primary: "#0af",
        border: "#333",
        darkMode: true,
      },
    });

    expect(prepared.valid).toBe(true);
    expect(prepared.source).toContain("flowchart TD");
    expect(prepared.diagramType).toBe("flowchart");
    expect(prepared.themeDirectives).toContain("theme");
  });

  it("un diagrama con `<script>` se RECHAZA (fail-closed, sin source)", () => {
    const prepared = prepareMermaidComponent({
      source: "flowchart TD\n  A[<script>alert(1)</script>]",
    });

    expect(prepared.valid).toBe(false);
    expect(prepared.source).toBeUndefined();
    expect(prepared.error).toBeTruthy();
  });

  it("un diagrama de tipo desconocido se rechaza", () => {
    const prepared = prepareMermaidComponent({ source: "inventado TD\n A-->B" });
    expect(prepared.valid).toBe(false);
    expect(prepared.error).toMatch(/no reconocido/i);
  });

  it("unas props inválidas se rechazan con el motivo", () => {
    const prepared = prepareMermaidComponent({ source: "" });
    expect(prepared.valid).toBe(false);
    expect(prepared.error).toMatch(/inválidas/i);
  });
});

describe("T5.3 — PayloadRegistry como proveedor de recursos (COUC-08)", () => {
  it("lista los payloads registrados como recursos con URI", () => {
    const registry = new PayloadRegistry();
    registry.register({ hello: "world" }, "artifact", { summary: "Un artefacto" });

    const resources = registry.list();
    expect(resources.length).toBe(1);
    expect(resources[0]!.uri.startsWith("payload://")).toBe(true);
    expect(resources[0]!.name).toBe("Un artefacto");
  });

  it("lee un payload por URI", () => {
    const registry = new PayloadRegistry();
    registry.register("texto plano", "tool_output");

    const resources = registry.list();
    const uri = resources[0]!.uri;

    const read = registry.read(uri);
    expect(read).toBeDefined();
    expect(read!.text).toBe("texto plano");
  });

  it("leer una URI inexistente devuelve undefined (no lanza)", () => {
    const registry = new PayloadRegistry();
    expect(registry.read("payload://no_existe")).toBeUndefined();
  });

  it("un payload objeto se serializa como JSON", () => {
    const registry = new PayloadRegistry();
    registry.register({ a: 1 }, "decision");

    const uri = registry.list()[0]!.uri;
    const read = registry.read(uri);
    expect(read!.text).toContain('"a": 1');
  });
});
