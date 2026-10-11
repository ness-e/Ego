import { describe, it, expect } from "vitest";
import { ChangeSetService } from "../src/native/git/ChangeSetService.js";

describe("COUC-07: ChangeSetService (DiffEngine)", () => {
  it("calcula diffs con adiciones correctamente", () => {
    const diff = ChangeSetService.fromEdit("", "hello\nworld\n", "/path/to/file.ts");
    expect(diff.added).toBe(2);
    expect(diff.removed).toBe(0);
    expect(diff.tooLarge).toBe(false);
    expect(diff.hunks.length).toBe(1);
    expect(diff.name).toBe("file.ts");
  });

  it("calcula diffs con eliminaciones correctamente", () => {
    const diff = ChangeSetService.fromEdit("hello\nworld\n", "", "/path/to/file.py");
    expect(diff.added).toBe(0);
    expect(diff.removed).toBe(2);
    expect(diff.hunks.length).toBe(1);
  });

  it("calcula diffs con reemplazo y preserva líneas de contexto", () => {
    const diff = ChangeSetService.fromEdit("foo\nbar\nbaz\n", "foo\nqux\nbaz\n", "/src/app.ts");
    expect(diff.added).toBe(1);
    expect(diff.removed).toBe(1);
    expect(diff.hunks[0].lines.some((l) => l.kind === "context")).toBe(true);
  });

  it("genera diff para un archivo nuevo via fromNew", () => {
    const diff = ChangeSetService.fromNew("line1\nline2\nline3\n", "/new_file.rs");
    expect(diff.isNewFile).toBe(true);
    expect(diff.added).toBe(3);
    expect(diff.removed).toBe(0);
    expect(diff.hunks.flatMap((h) => h.lines).every((l) => l.kind === "added")).toBe(true);
  });

  it("aplica fallback countFallback cuando excede MAX_BYTES", () => {
    const bigOld = "x".repeat(150 * 1024);
    const bigNew = "y".repeat(60 * 1024);
    const diff = ChangeSetService.fromEdit(bigOld, bigNew, "/big.bin");
    expect(diff.tooLarge).toBe(true);
    expect(diff.hunks.length).toBe(0);
  });

  it("normaliza CRLF a LF limpiamente", () => {
    const diff = ChangeSetService.fromEdit("a\r\nb\r\n", "a\r\nc\r\n", "/win.txt");
    expect(diff.added).toBe(1);
    expect(diff.removed).toBe(1);
  });

  it("convierte párrafos markdown a una sola línea con toOneLine", () => {
    const md = `
Este es el **primer párrafo** con texto importante.
Continúa en la segunda línea.

## Sección Siguiente
No debe llegar aquí.
`;
    const oneLine = ChangeSetService.toOneLine(md, 100);
    expect(oneLine).toContain("Este es el primer párrafo con texto importante. Continúa en la segunda línea.");
    expect(oneLine).not.toContain("Sección Siguiente");
    expect(oneLine).not.toContain("**");
    expect(oneLine).not.toContain("##");
  });

  it("crea un ChangeSet agrupando múltiples archivos", () => {
    const d1 = ChangeSetService.fromEdit("a\n", "b\n", "file1.ts");
    const d2 = ChangeSetService.fromNew("new content\n", "file2.ts");
    const cs = ChangeSetService.createChangeSet([d1, d2]);

    expect(cs.files.length).toBe(2);
    expect(cs.totalAdded).toBe(2);
    expect(cs.totalRemoved).toBe(1);
    expect(cs.tooLarge).toBe(false);
  });
});
