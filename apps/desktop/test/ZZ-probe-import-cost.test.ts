// Sonda: mide el coste de `import("../src/main.js")` (evaluación del grafo
// de módulos) frente al resto del test.
import { describe, it, expect } from "vitest";

describe("sonda: coste del import de main.js", () => {
  it("mide el import dentro del cuerpo del test (como hace el test actual)", async () => {
    const t0 = performance.now();
    await import("../src/main.js");
    const t1 = performance.now();
    // eslint-disable-next-line no-console
    console.log(`IMPORT_MS=${(t1 - t0).toFixed(0)}`);
    expect(t1 - t0).toBeGreaterThanOrEqual(0);
  });
});
