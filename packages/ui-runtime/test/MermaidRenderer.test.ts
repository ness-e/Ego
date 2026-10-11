import { describe, it, expect } from "vitest";
import { MermaidRenderer } from "../src/MermaidRenderer.js";

describe("MermaidRenderer Suite (OCLW-11)", () => {
  it("debe validar correctamente diagramas válidos soportados", () => {
    const flowchart = `
      flowchart TD
        A[Inicio] --> B(Proceso)
        B --> C{Decisión}
    `;
    const res = MermaidRenderer.validate(flowchart);
    expect(res.valid).toBe(true);
    expect(res.diagramType).toBe("flowchart");
  });

  it("debe rechazar código malicioso con tags de script", () => {
    const malicious = `
      graph TD
        A[Click] --> B["<script>alert('xss')</script>"]
    `;
    const res = MermaidRenderer.validate(malicious);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("patrones inseguros");
  });

  it("debe sanitizar directivas y generar tokens de tema para Ego", () => {
    const themeDirectives = MermaidRenderer.generateThemeDirectives({
      background: "#1e1e2e",
      foreground: "#cdd6f4",
      primary: "#89b4fa",
      border: "#313244",
      darkMode: true,
    });

    expect(themeDirectives).toContain("%%{init:");
    expect(themeDirectives).toContain("'theme': 'dark'");
    expect(themeDirectives).toContain("#89b4fa");
  });
});
