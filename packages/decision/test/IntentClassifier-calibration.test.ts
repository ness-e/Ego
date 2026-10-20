import { describe, it, expect } from "vitest";
import { IntentClassifier } from "../src/IntentClassifier.js";
import { FS_READ_FILE_TOOL, FS_WRITE_FILE_TOOL, TERMINAL_EXEC_TOOL } from "../src/canonicalTools.js";

const classifier = new IntentClassifier();

function classify(prompt: string) {
  return classifier.classify({
    prompt,
    projectId: "p1",
    workspacePath: "C:/tmp",
  });
}

describe("IntentClassifier — confianza calibrada y aprobación por riesgo (T9 / A2-20)", () => {
  it("(1) una petición de solo lectura NO sugiere herramientas de escritura", () => {
    const result = classify("lee el archivo packages/runtime/src/index.ts");
    expect(result.suggestedTools).toContain(FS_READ_FILE_TOOL);
    expect(result.suggestedTools).not.toContain(FS_WRITE_FILE_TOOL);
    expect(result.requiresApproval).toBe(false);
  });

  it("(2) una petición de escritura sugiere escritura y requiere aprobación", () => {
    const result = classify("escribe el archivo config.json con el nuevo valor");
    expect(result.suggestedTools).toContain(FS_WRITE_FILE_TOOL);
    expect(result.requiresApproval).toBe(true);
  });

  it("(3) terminal_exec implica aprobación por riesgo de la herramienta", () => {
    const result = classify("ejecuta npm install en el proyecto");
    expect(result.suggestedTools).toContain(TERMINAL_EXEC_TOOL);
    expect(result.requiresApproval).toBe(true);
  });

  it("(4) la confianza crece con señales corroborantes", () => {
    const weak = classify("hola");
    const strong = classify(
      "haz commit y push en el repo git, revisa el diff de packages/runtime/src/index.ts y ejecuta los tests"
    );
    expect(strong.confidence).toBeGreaterThan(weak.confidence);
    expect(strong.confidence).toBeLessThanOrEqual(1);
    expect(weak.confidence).toBeGreaterThan(0);
  });

  it("(5) una petición ambigua baja la confianza por debajo de una explícita", () => {
    const explicit = classify("busca en la memoria del proyecto qué es el runtime cognitivo");
    const vague = classify("cosas");
    expect(explicit.confidence).toBeGreaterThan(vague.confidence);
  });
});
