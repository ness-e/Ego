import { describe, it, expect } from "vitest";
import { join, resolve } from "node:path";
import {
  assertPathInScope,
  filterPathsInScope,
  isPathInAnyScope,
  isPathWithin,
  defaultWorkspaceRoot,
} from "../src/main/path-scope.js";

/**
 * T2 (EGO-FIND-26) — La lectura arbitraria de disco desde el renderer debe
 * quedar cerrada: 4 handlers IPC aceptaban rutas del renderer sin validar
 * contra el alcance del workspace.
 *
 * La política es **fail-closed**: ante cualquier duda se rechaza.
 */
describe("T2: assertPathInScope — el renderer no puede leer fuera del workspace", () => {
  const workspace = resolve(process.cwd());
  const scope = [workspace];

  it("acepta una ruta dentro del workspace", () => {
    const target = join(workspace, "docs", "roadmap.md");
    const verdict = assertPathInScope(target, scope, "filePath");
    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect(verdict.path).toContain("roadmap.md");
  });

  it("acepta el propio workspace", () => {
    expect(assertPathInScope(workspace, scope, "filePath").ok).toBe(true);
  });

  it("rechaza una ruta fuera del workspace", () => {
    const verdict = assertPathInScope(
      resolve(process.cwd(), "..", "..", "etc", "passwd"),
      scope,
      "filePath"
    );
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain("fuera del alcance");
  });

  it("rechaza una ruta absoluta del sistema", () => {
    for (const p of ["C:\\Windows\\win.ini", "/etc/passwd", "/etc/shadow"]) {
      expect(assertPathInScope(p, scope, "filePath").ok, p).toBe(false);
    }
  });

  it("rechaza el traversal con `..` que intenta salir del scope", () => {
    const traversal = join(workspace, "..", "..", "secrets.txt");
    expect(assertPathInScope(traversal, scope, "filePath").ok).toBe(false);
  });

  it("rechaza rutas vacías o no-string (fail-closed)", () => {
    for (const bad of ["", "   ", null, undefined, 42, {}]) {
      expect(assertPathInScope(bad, scope, "filePath").ok, String(bad)).toBe(false);
    }
  });

  it("rechaza cuando no hay ningún directorio de alcance configurado", () => {
    expect(assertPathInScope(join(workspace, "x.txt"), [], "filePath").ok).toBe(false);
  });

  it("no confunde un directorio hermano con prefijo compartido", () => {
    const evil = `${workspace}-evil/secret.txt`;
    expect(isPathWithin(evil, workspace)).toBe(false);
  });

  it("isPathInAnyScope: el scope vacío nunca autoriza", () => {
    expect(isPathInAnyScope(join(workspace, "a.txt"), [])).toBe(false);
  });

  it("filterPathsInScope descarta las rutas no autorizadas y conserva las válidas", () => {
    const inside = join(workspace, "inside.txt");
    const outside = resolve(process.cwd(), "..", "..", "outside.txt");
    const kept = filterPathsInScope([inside, outside], scope);
    expect(kept).toHaveLength(1);
    expect(kept[0]).toContain("inside.txt");
  });

  it("defaultWorkspaceRoot resuelve la variable de entorno cuando existe", () => {
    const root = defaultWorkspaceRoot({ EGO_WORKSPACE_PATH: "/tmp/ws-ego" });
    expect(root).toContain("ws-ego");
  });

  it("defaultWorkspaceRoot cae en process.cwd() sin variable de entorno", () => {
    const root = defaultWorkspaceRoot({});
    expect(root).toBe(resolve(process.cwd()));
  });
});
