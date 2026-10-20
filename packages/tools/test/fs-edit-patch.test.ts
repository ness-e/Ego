import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createFsEditPatchTool } from "../src/index.js";

/**
 * T5.2 (Ola 1b) — `fs_edit_patch` con dry-run.
 *
 * En la Ola 1 lo declaré "pendiente" (no implementado) para no inventar un
 * formato de parche sin decisión de producto. La Ola 1b pide cerrar esa deuda:
 * o se implementa, o se retira con veredicto de descarte. Aquí se IMPLEMENTA
 * con un contrato explícito y fail-closed.
 *
 * FORMATO DEL PARCHE (determinista y sin ambigüedad)
 * -------------------------------------------------
 * Una lista de *hunks* de reemplazo exacto:
 *
 * ```ts
 * { find: "<texto exacto a buscar>", replace: "<texto de reemplazo>" }
 * ```
 *
 * Reglas (fail-closed):
 * - `find` debe aparecer **EXACTAMENTE UNA VEZ**. Si aparece 0 veces o más de
 *   una, la operación se rechaza con un mensaje explícito (un parche ambiguo
 *   podría pisar el código equivocado).
 * - El `replace` es literal (sin regex, sin backreferences).
 * - La escritura es **atómica** (tmp + fsync + rename), igual que
 *   `fs_write_file`, y con backup opcional.
 * - `dryRun: true` calcula el resultado y devuelve el diff **sin tocar disco**.
 */

describe("T5.2 — fs_edit_patch con dry-run", () => {
  let ws: string;

  beforeEach(() => {
    ws = fs.mkdtempSync(path.join(os.tmpdir(), "ego-edit-patch-"));
    fs.writeFileSync(
      path.join(ws, "code.ts"),
      "export const a = 1;\nexport const b = 2;\n",
      "utf8"
    );
  });

  afterEach(() => {
    try {
      fs.rmSync(ws, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  const ctx = () => ({ callId: "c1", sessionId: "s1", workspacePath: ws });

  it("aplica el parche y escribe el resultado", async () => {
    const tool = createFsEditPatchTool();

    const res = await tool.execute(
      {
        path: "code.ts",
        hunks: [{ find: "export const a = 1;", replace: "export const a = 42;" }],
      },
      ctx()
    );

    expect(res.applied).toBe(true);
    expect(res.dryRun).toBe(false);
    expect(fs.readFileSync(path.join(ws, "code.ts"), "utf8")).toContain("a = 42");
  });

  it("`dryRun: true` NO toca el disco y devuelve el diff", async () => {
    const tool = createFsEditPatchTool();
    const before = fs.readFileSync(path.join(ws, "code.ts"), "utf8");

    const res = await tool.execute(
      {
        path: "code.ts",
        hunks: [{ find: "export const a = 1;", replace: "export const a = 42;" }],
        dryRun: true,
      },
      ctx()
    );

    expect(res.dryRun).toBe(true);
    expect(res.applied).toBe(false);
    expect(res.preview).toContain("a = 42");
    // El fichero en disco es INTACTO.
    expect(fs.readFileSync(path.join(ws, "code.ts"), "utf8")).toBe(before);
  });

  it("rechaza un `find` que no aparece (fail-closed)", async () => {
    const tool = createFsEditPatchTool();

    await expect(
      tool.execute(
        { path: "code.ts", hunks: [{ find: "NO_EXISTE_EN_EL_FICHERO", replace: "x" }] },
        ctx()
      )
    ).rejects.toThrow(/no se encontró|0 coincidencias/i);
  });

  it("rechaza un `find` AMBIGUO (aparece más de una vez)", async () => {
    const tool = createFsEditPatchTool();
    fs.writeFileSync(path.join(ws, "dup.ts"), "x\nx\n", "utf8");

    await expect(
      tool.execute(
        { path: "dup.ts", hunks: [{ find: "x", replace: "y" }] },
        ctx()
      )
    ).rejects.toThrow(/ambigu|coincidencias/i);
  });

  it("no puede escapar del workspace", async () => {
    const tool = createFsEditPatchTool();

    await expect(
      tool.execute(
        { path: "../fuera.txt", hunks: [{ find: "a", replace: "b" }] },
        ctx()
      )
    ).rejects.toThrow(/Violación de Sandbox/i);
  });

  it("crea backup del fichero original cuando se aplica", async () => {
    const tool = createFsEditPatchTool();

    const res = await tool.execute(
      {
        path: "code.ts",
        hunks: [{ find: "export const a = 1;", replace: "export const a = 42;" }],
        createBackup: true,
      },
      ctx()
    );

    expect(res.backupPath).toBeTruthy();
    expect(fs.existsSync(path.join(ws, res.backupPath as string))).toBe(true);
  });

  it("rechaza un fichero inexistente", async () => {
    const tool = createFsEditPatchTool();

    await expect(
      tool.execute(
        { path: "no-existe.ts", hunks: [{ find: "a", replace: "b" }] },
        ctx()
      )
    ).rejects.toThrow(/no existe/i);
  });

  it("aplica varios hunks en orden", async () => {
    const tool = createFsEditPatchTool();

    await tool.execute(
      {
        path: "code.ts",
        hunks: [
          { find: "export const a = 1;", replace: "export const a = 42;" },
          { find: "export const b = 2;", replace: "export const b = 43;" },
        ],
      },
      ctx()
    );

    const content = fs.readFileSync(path.join(ws, "code.ts"), "utf8");
    expect(content).toContain("a = 42");
    expect(content).toContain("b = 43");
  });
});
