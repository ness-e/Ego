import { describe, it, expect, beforeEach } from "vitest";
import { PayloadRegistry } from "../src/PayloadRef.js";

describe("COUC-08: PayloadRef & PayloadRegistry", () => {
  let registry: PayloadRegistry;

  beforeEach(() => {
    registry = new PayloadRegistry(5); // límite pequeño para probar LRU
  });

  it("registra un payload pesado generando un identificador inmutable y metadata ligera", () => {
    const diffData = { file: "test.ts", lines: 500, patch: "@@ -1,5 +1,6 @@" };
    const meta = registry.register(diffData, "diff", { summary: "Cambios en test.ts" });

    expect(meta.id).toMatch(/^pref_[0-9a-f]{16}$/);
    expect(meta.kind).toBe("diff");
    expect(meta.summary).toBe("Cambios en test.ts");
    expect(meta.sizeBytes).toBeGreaterThan(0);
    expect(meta.sha256).toBeDefined();

    // Resolver bajo demanda
    const resolved = registry.resolve<typeof diffData>(meta.id);
    expect(resolved).toEqual(diffData);
  });

  it("retorna la misma referencia si el payload idéntico ya está registrado", () => {
    const text = "Contenido idéntico";
    const meta1 = registry.register(text, "tool_output");
    const meta2 = registry.register(text, "tool_output");

    expect(meta1.id).toBe(meta2.id);
    expect(registry.size()).toBe(1);
  });

  it("desaloja las referencias más antiguas cuando se supera maxEntries (LRU)", () => {
    const refs = [];
    for (let i = 0; i < 6; i++) {
      refs.push(registry.register(`Data ${i}`, "log"));
    }

    expect(registry.size()).toBe(5);
    // La primera entrada (Data 0) debe haber sido desalojada
    expect(registry.has(refs[0].id)).toBe(false);
    expect(registry.resolve(refs[0].id)).toBeUndefined();
    // La última (Data 5) debe estar presente
    expect(registry.has(refs[5].id)).toBe(true);
    expect(registry.resolve(refs[5].id)).toBe("Data 5");
  });

  it("soporta eliminación y limpieza completa", () => {
    const meta = registry.register("Eliminar", "evidence");
    expect(registry.has(meta.id)).toBe(true);
    registry.delete(meta.id);
    expect(registry.has(meta.id)).toBe(false);

    registry.register("A", "artifact");
    registry.register("B", "artifact");
    expect(registry.size()).toBe(2);
    registry.clear();
    expect(registry.size()).toBe(0);
  });
});
