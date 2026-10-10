import { describe, it, expect } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import { PythonSidecarBridge } from "../src/ingest/PythonSidecarBridge.js";

describe("PythonSidecarBridge (KB-02)", () => {
  const bridge = new PythonSidecarBridge();

  it("verifica disponibilidad de Python en el host o se comporta con fallback seguro", async () => {
    const isAvail = await bridge.isAvailable();
    expect(typeof isAvail).toBe("boolean");
  });

  it("si Python está disponible, ejecuta bulk_import y emite chunks tipados vía stdio JSONL", async () => {
    const isAvail = await bridge.isAvailable();
    if (!isAvail) {
      // Si el entorno no tiene python en PATH, saltar la ejecución real
      return;
    }

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ego-bulk-test-"));
    const testFile = path.join(tmpDir, "test.md");
    await fs.writeFile(
      testFile,
      "# Documento de Prueba\n\nEste es un archivo procesado por el sidecar Python.\n\n## Sección 2\n\nContenido secundario.",
      "utf-8"
    );

    const progressReports: number[] = [];
    const result = await bridge.runBulkImport(tmpDir, (p) => {
      progressReports.push(p.current);
    });

    expect(result.totalFiles).toBeGreaterThanOrEqual(1);
    expect(result.chunks.length).toBeGreaterThanOrEqual(1);
    expect(result.chunks[0].contentHash).toHaveLength(64);
    expect(result.chunks[0].headingPath).toContain("Documento de Prueba");

    // Limpieza
    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});
