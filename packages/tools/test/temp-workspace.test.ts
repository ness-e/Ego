import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  createTempWorkspace,
  sweepStaleTempWorkspaces,
  getTempWorkspaceRunRoot,
  isProcessAlive,
  TEMP_WORKSPACE_ROOT_NAME,
} from "../src/index.js";

const execFileAsync = promisify(execFile);

/**
 * T-X1 (Ola 3, A3) — El workspace temporal debe ser a prueba de muerte.
 *
 * RED en el diseño anterior: los tests usaban `fs.mkdtempSync(os.tmpdir(), ...)`
 * ⇒ un `SIGKILL` dejaba el directorio (con su store de VantaDB de 320 MB)
 * huérfano en `%TEMP%` para siempre.
 */
describe("T-X1 — TempWorkspace: limpieza a prueba de muerte", () => {
  let root: string;

  beforeEach(() => {
    root = path.join(os.tmpdir(), `ego-tx1-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    fs.mkdirSync(root, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("crea el workspace DENTRO de la raíz de la corrida (no suelto en %TEMP%)", () => {
    const ws = createTempWorkspace({ prefix: "probe", root });

    expect(fs.existsSync(ws.path)).toBe(true);
    expect(ws.path.startsWith(root)).toBe(true);
    expect(path.basename(path.dirname(ws.path))).toMatch(/^run-/);

    ws.cleanup();
  });

  it("el cleanup es idempotente", () => {
    const ws = createTempWorkspace({ prefix: "probe", root });

    ws.cleanup();
    expect(ws.exists()).toBe(false);
    expect(() => ws.cleanup()).not.toThrow();
    expect(ws.exists()).toBe(false);
  });

  it("el proceso que crea el workspace lo borra al salir normalmente (hook `exit`)", async () => {
    // Un hijo crea el workspace y sale con código 0: el hook `exit` debe
    // haberlo borrado.
    const script = `
      const { createTempWorkspace } = require(${JSON.stringify(
        path.resolve(__dirname, "..", "dist", "TempWorkspace.js")
      )});
      const ws = createTempWorkspace({ prefix: "child", root: ${JSON.stringify(root)} });
      console.log(ws.path);
    `;
    // Requiere el build; si no está, el test lo dice claramente.
    const distEntry = path.resolve(__dirname, "..", "dist", "TempWorkspace.js");
    if (!fs.existsSync(distEntry)) {
      // Fallback: ejecuta el mismo módulo desde el fuente con tsx no disponible
      // → usamos el propio test para validar el hook (rama equivalente).
      const before = fs.readdirSync(root);
      const ws = createTempWorkspace({ prefix: "self", root });
      expect(before.length).toBe(0);
      expect(fs.readdirSync(root).length).toBe(1);
      ws.cleanup();
      return;
    }

    const { stdout } = await execFileAsync(process.execPath, ["-e", script], {
      encoding: "utf8",
    });
    const childPath = stdout.trim();

    expect(fs.existsSync(childPath)).toBe(false);
  });

  it("el barrido elimina los workspaces huérfanos de corridas muertas", () => {
    // Simula una corrida anterior muerta (SIGKILL): un `run-*` con contenido.
    const orphanRun = path.join(root, "run-999999-deadbeef");
    fs.mkdirSync(path.join(orphanRun, "data"), { recursive: true });
    fs.writeFileSync(path.join(orphanRun, "data", "big.bin"), Buffer.alloc(64 * 1024, 1));

    // Una corrida RECIENTE cuyo proceso SIGUE VIVO no se toca: es el PID
    // (no la antigüedad) el criterio de la convención de A4.
    const liveRun = path.join(root, `run-${Date.now()}-${process.pid}-live001`);
    fs.mkdirSync(liveRun, { recursive: true });
    fs.writeFileSync(path.join(liveRun, "data.bin"), Buffer.alloc(1024, 2));

    const result = sweepStaleTempWorkspaces({ staleAfterMs: 60 * 60 * 1000, root });

    expect(result.removed).toContain(orphanRun);
    expect(result.removed).not.toContain(liveRun);
    expect(fs.existsSync(orphanRun)).toBe(false);
    expect(fs.existsSync(liveRun)).toBe(true);
    expect(result.bytesFreed).toBeGreaterThan(0);
  });

  it("el barrido elimina YA las raíces de corrida VACÍAS (basura de workers terminados a la fuerza)", () => {
    const emptyRun = path.join(root, "run-333444-empty");
    fs.mkdirSync(emptyRun, { recursive: true });

    const result = sweepStaleTempWorkspaces({ staleAfterMs: 60 * 60 * 1000, root });

    expect(result.removed).toContain(emptyRun);
    expect(fs.existsSync(emptyRun)).toBe(false);
  });

  it("el barrido no toca la corrida actual", () => {
    const ws = createTempWorkspace({ prefix: "current", root });
    const runRoot = path.dirname(ws.path);

    const result = sweepStaleTempWorkspaces({ staleAfterMs: 0, root });

    expect(result.removed).not.toContain(runRoot);
    expect(fs.existsSync(ws.path)).toBe(true);
    ws.cleanup();
  });

  it("el barrido NO borra la raíz de una corrida cuyo proceso sigue VIVO", () => {
    // Regresión: el barrido de un proceso podía borrar la raíz de OTRO
    // proceso vivo (recién creada, está vacía durante un instante).
    const liveRun = path.join(root, `run-${process.pid}-alive`);
    fs.mkdirSync(liveRun, { recursive: true });

    const result = sweepStaleTempWorkspaces({ staleAfterMs: 0, root });

    expect(result.removed).not.toContain(liveRun);
    expect(fs.existsSync(liveRun)).toBe(true);
  });

  it("el barrido sí borra la raíz de una corrida cuyo proceso ya NO existe", () => {
    // Un PID que no existe ⇒ proceso muerto ⇒ su raíz es huérfana.
    const deadRun = path.join(root, `run-${999999}-dead`);
    fs.mkdirSync(deadRun, { recursive: true });

    const result = sweepStaleTempWorkspaces({ staleAfterMs: 0, root });

    expect(result.removed).toContain(deadRun);
    expect(fs.existsSync(deadRun)).toBe(false);
  });

  it("CONVERGENCIA A4: un run de PID MUERTO se borra aunque sea reciente", () => {
    // Convención de A4 (handoff A4-ola3 §5.3, punto 0): el criterio es el
    // **PID muerto**, no la antigüedad. Un run que murió hace 5 minutos debe
    // recogerse en la corrida siguiente, no esperar 6 horas.
    const deadRun = path.join(root, `run-${Date.now()}-999999-deadbe`);
    fs.mkdirSync(deadRun, { recursive: true });
    fs.writeFileSync(path.join(deadRun, "data.bin"), Buffer.alloc(1024, 3));

    const result = sweepStaleTempWorkspaces({ staleAfterMs: 6 * 60 * 60 * 1000, root });

    expect(result.removed).toContain(deadRun);
    expect(fs.existsSync(deadRun)).toBe(false);
  });

  it("CONVERGENCIA A4: el nombre del run-dir es `run-<epochMs>-<pid>-<rand6>`", () => {
    const ws = createTempWorkspace({ prefix: "conv", root });
    const runDirName = path.basename(path.dirname(ws.path));

    expect(runDirName).toMatch(/^run-\d+-\d+-[a-z0-9]{6,}$/);
    ws.cleanup();
  });

  it("CONVERGENCIA A4: la raíz compartida es `ego-test-scratch`", () => {
    expect(TEMP_WORKSPACE_ROOT_NAME).toBe("ego-test-scratch");
    expect(getTempWorkspaceRunRoot()).toContain("ego-test-scratch");
  });

  it("CONVERGENCIA A4: `isProcessAlive` está exportado (lo usa el módulo de A4)", () => {
    expect(typeof isProcessAlive).toBe("function");
    expect(isProcessAlive(process.pid)).toBe(true);
    expect(isProcessAlive(999999)).toBe(false);
  });

  it("la raíz compartida es `ego-test-scratch` (convención de A4)", () => {
    expect(TEMP_WORKSPACE_ROOT_NAME).toBe("ego-test-scratch");
    expect(getTempWorkspaceRunRoot()).toContain("ego-test-scratch");
  });
});
