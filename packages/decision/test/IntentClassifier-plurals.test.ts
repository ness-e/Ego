import { describe, it, expect } from "vitest";
import { IntentClassifier, countWordHits } from "../src/IntentClassifier.js";

const classifier = new IntentClassifier();

function classify(prompt: string) {
  return classifier.classify({
    prompt,
    projectId: "p1",
    workspacePath: "C:/app",
  });
}

describe("countWordHits — plurales (T1 / regresión A7 §2.2)", () => {
  it("(1) 'ejecutar tests' matchea la clave 'test' (antes: 0)", () => {
    expect(countWordHits("ejecutar tests", ["test"])).toBe(1);
    expect(countWordHits("ejecutar test", ["test"])).toBe(1);
  });

  it("(2) plurales-regulares en inglés: commits, files, branches", () => {
    expect(countWordHits("los commits", ["commit"])).toBe(1);
    expect(countWordHits("los files", ["file"])).toBe(1);
    expect(countWordHits("las branches", ["branch"])).toBe(1);
  });

  it("(3) plurales en español: códigos, métricas, documentos, definiciones", () => {
    expect(countWordHits("los códigos", ["código"])).toBe(1);
    expect(countWordHits("las métricas", ["métrica"])).toBe(1);
    expect(countWordHits("los documentos", ["documento"])).toBe(1);
    expect(countWordHits("las definiciones", ["definición"])).toBe(1);
  });

  it("(4) NO arrastra falsos positivos: ni sufijos verbales ni subcadenas", () => {
    // "testing"/"latest" no son el sustantivo "test".
    expect(countWordHits("testing the latest code", ["test"])).toBe(0);
    // "reforma" contiene "forma" pero no es la palabra "forma".
    expect(countWordHits("una reforma del código", ["forma"])).toBe(0);
    // "documentación" no es el plural de "documento".
    expect(countWordHits("la documentación", ["documento"])).toBe(0);
  });

  it("(5) cuenta claves DISTINTAS, no ocurrencias", () => {
    expect(countWordHits("test test test", ["test"])).toBe(1);
  });

  it("(6) la confianza es equivalente en plural y singular, y ≥ 0.9 (DEC-09)", () => {
    const plural = classify(
      "Revisar y escribir el módulo api.ts en el workspace y ejecutar tests"
    );
    const singular = classify(
      "Revisar y escribir el módulo api.ts en el workspace y ejecutar test"
    );

    expect(plural.confidence).toBeGreaterThanOrEqual(0.9);
    expect(singular.confidence).toBeGreaterThanOrEqual(0.9);
    expect(Math.abs(plural.confidence - singular.confidence)).toBeLessThanOrEqual(0.01);
  });
});
