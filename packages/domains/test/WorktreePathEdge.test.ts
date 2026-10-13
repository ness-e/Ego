import { describe, it, expect } from "vitest";
import path from "node:path";
import { assertInsideRoot } from "../src/engineering/WorktreeManager.js";

/**
 * HIG-05 (residual M16) — edges de `assertInsideRoot` en Windows.
 *
 * - El escape con `..` debe rechazarse aunque la caja difiera
 *   (`C:\Repo` vs `c:\repo\..`): `path.win32.relative` ya es
 *   case-insensitive y el rel resultante (`..`) cae en el rechazo.
 * - Un hijo cuyo nombre EMPIEZA por `..` (`..foo`) vive DENTRO del root
 *   (rel `..foo`, sin separador tras los puntos) y debe aceptarse: el
 *   `startsWith("..")` plano lo sobrerrechaza (falso positivo fail-closed).
 */
describe("HIG-05 — assertInsideRoot edges Windows", () => {
  // Nota: estos tests usan el `path` nativo del runner (win32 en CI Windows).
  // Los casos con drive-letter solo aplican en win32; se saltean fuera.
  const isWin = path.sep === "\\";
  const root = path.resolve("C:/repo-hig05");

  it("acepta interior con distinta caja (case-insensitive en win32)", () => {
    if (!isWin) return;
    const inside = path.resolve("c:/REPO-HIG05/sub/dir");
    expect(assertInsideRoot(root, inside)).toBe(path.resolve(inside));
  });

  it("rechaza escape con .. aunque la caja difiera (C:\\Repo vs c:\\repo\\..)", () => {
    if (!isWin) return;
    const escape = path.resolve("c:/repo-hig05/../outside");
    expect(() => assertInsideRoot(root, escape)).toThrow(/fuera del repositorio/i);
  });

  it("acepta hijo llamado `..foo` (no es parent-ref, no lleva sep tras `..`)", () => {
    const child = path.join(root, "..foo");
    expect(assertInsideRoot(root, child)).toBe(path.resolve(child));
  });

  it("acepta nieto bajo `..foo/bar`", () => {
    const grandchild = path.join(root, "..foo", "bar");
    expect(assertInsideRoot(root, grandchild)).toBe(path.resolve(grandchild));
  });

  it("sigue rechazando escape real con .. + sep", () => {
    const escape = path.join(root, "..", "outside");
    expect(() => assertInsideRoot(root, escape)).toThrow(/fuera del repositorio/i);
  });

  it("sigue rechazando el root mismo (rel vacía: worktree sobre el principal)", () => {
    expect(() => assertInsideRoot(root, root)).toThrow(/fuera del repositorio/i);
  });

  it("sigue rechazando absoluto externo y primo `rootX`", () => {
    const outside = path.resolve(path.parse(root).root, "otro-lado");
    expect(() => assertInsideRoot(root, outside)).toThrow(/fuera del repositorio/i);
    expect(() => assertInsideRoot(root, root + "X-evil")).toThrow(/fuera del repositorio/i);
  });
});
