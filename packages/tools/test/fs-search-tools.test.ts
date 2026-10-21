import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  createTempWorkspace,
  ToolRegistry,
  registerNativeTools,
  createFsReadFileTool,
  createFsGlobTool,
  createFsGrepTool,
  matchesGlob,
} from "../src/index.js";

/**
 * T7 (Ola 1 / A3) — Herramientas FS avanzadas + lectura acotada.
 *
 * EGO-FIND-32/A3-12: el agente no podía ENCONTRAR ficheros (`fs_glob`) ni
 * BUSCAR contenido (`fs_grep`), y `fs_read_file` leía el fichero entero sin
 * tope (el truncado a 5 MB era posterior, en el ExecutionManager, con el
 * contenido ya en memoria).
 */
describe("T7 — Tools FS avanzadas (A3-12)", () => {
  let ws: string;

  beforeEach(() => {
    ws = createTempWorkspace({ prefix: "ego-fs-tools-" }).path;
    fs.mkdirSync(path.join(ws, "src"), { recursive: true });
    fs.writeFileSync(path.join(ws, "src", "a.ts"), "export const a = 1;\nconst token = 'x';\n", "utf8");
    fs.writeFileSync(path.join(ws, "src", "b.tsx"), "export const b = 2;\n", "utf8");
    fs.writeFileSync(path.join(ws, "readme.md"), "# titulo\nconst SECRET_KEY = 'valor';\n", "utf8");
    fs.mkdirSync(path.join(ws, "node_modules"), { recursive: true });
    fs.writeFileSync(path.join(ws, "node_modules", "ignored.ts"), "nada\n", "utf8");
  });

  afterEach(() => {
    try {
      fs.rmSync(ws, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  const ctx = () => ({ callId: "c1", sessionId: "s1", workspacePath: ws });

  it("`fs_read_file` respeta el tope de bytes y marca `truncated`", async () => {
    const tool = createFsReadFileTool();
    const big = "x".repeat(5000);
    fs.writeFileSync(path.join(ws, "big.txt"), big, "utf8");

    const res = await tool.execute({ path: "big.txt", maxBytes: 100 }, ctx());

    expect(res.truncated).toBe(true);
    expect(res.bytesRead).toBe(100);
    expect((res.content as string).length).toBe(100);
    expect(res.sizeBytes).toBe(5000);
  });

  it("`fs_read_file` con offset lee por trozos", async () => {
    const tool = createFsReadFileTool();
    fs.writeFileSync(path.join(ws, "datos.txt"), "0123456789", "utf8");

    const res = await tool.execute({ path: "datos.txt", offset: 3, maxBytes: 4 }, ctx());

    expect(res.content).toBe("3456");
    expect(res.offset).toBe(3);
    expect(res.truncated).toBe(true);
  });

  it("`fs_read_file` de un fichero pequeño no trunca", async () => {
    const tool = createFsReadFileTool();
    const res = await tool.execute({ path: "readme.md" }, ctx());

    expect(res.truncated).toBe(false);
    expect(res.content).toContain("titulo");
  });

  it("`fs_glob` encuentra ficheros por patrón y ignora node_modules", async () => {
    const tool = createFsGlobTool();

    const res = await tool.execute({ pattern: "**/*.ts" }, ctx());

    expect(res.files).toContain("src/a.ts");
    expect(res.files).not.toContain("node_modules/ignored.ts");
    expect(res.count).toBeGreaterThan(0);
  });

  it("`fs_glob` con `*.tsx` solo devuelve los tsx", async () => {
    const tool = createFsGlobTool();

    const res = await tool.execute({ pattern: "**/*.tsx" }, ctx());

    expect(res.files).toEqual(["src/b.tsx"]);
  });

  it("`fs_glob` no puede escapar del workspace", async () => {
    const tool = createFsGlobTool();

    await expect(tool.execute({ pattern: "**/*.ts", cwd: "../.." }, ctx())).rejects.toThrow(
      /Violación de Sandbox/i
    );
  });

  it("`fs_grep` devuelve las coincidencias con línea y fichero", async () => {
    const tool = createFsGrepTool();

    const res = await tool.execute({ pattern: "const\\s+\\w+ =", glob: "**/*.ts" }, ctx());

    expect(res.count).toBeGreaterThan(0);
    expect(res.matches[0]?.path).toBe("src/a.ts");
    expect(res.matches[0]?.line).toBe(1);
  });

  it("`fs_grep` con `ignoreCase` encuentra coincidencias", async () => {
    const tool = createFsGrepTool();

    const res = await tool.execute({ pattern: "secret_key", ignoreCase: true }, ctx());

    expect(res.count).toBeGreaterThan(0);
  });

  it("`fs_grep` con una regex inválida falla con mensaje claro", async () => {
    const tool = createFsGrepTool();

    await expect(tool.execute({ pattern: "([unclosed" }, ctx())).rejects.toThrow(
      /Expresión regular inválida/i
    );
  });

  it("las 3 tools FS quedan registradas por `registerNativeTools`", () => {
    const registry = new ToolRegistry();
    registerNativeTools(registry, { workspacePath: ws });

    expect(registry.has("fs_read_file")).toBe(true);
    expect(registry.has("fs_write_file")).toBe(true);
    expect(registry.has("fs_glob")).toBe(true);
    expect(registry.has("fs_grep")).toBe(true);
  });

  it("el matcher de glob casa `*` dentro de un segmento y `**` entre segmentos", () => {
    expect(matchesGlob("src/a.ts", "src/*.ts")).toBe(true);
    expect(matchesGlob("src/deep/a.ts", "src/*.ts")).toBe(false);
    expect(matchesGlob("src/deep/a.ts", "src/**/*.ts")).toBe(true);
    expect(matchesGlob("a.ts", "**/*.ts")).toBe(true);
  });
});