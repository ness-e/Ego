/**
 * T-X1 — El scratch de los tests del desktop: compartido, acotado y
 * resistant a la muerte del proceso.
 *
 * ## El defecto que este fichero vigila
 * `NativeVantaDB.connect()` pre-reserva **320 MB** por store (medido: un
 * store vacío ocupa 320,06 MB). Los tests creaban sus directorios SUELTOS
 * en `%TEMP%` (`os.tmpdir()` + `mkdtemp`), con 13 prefijos distintos, y los
 * borraban en `afterEach`/`afterAll`. Si el proceso muere (timeout, kill,
 * reinicio), el teardown no corre y el directorio **se queda para siempre**:
 * 320 MB por huérfano (273 huérfanos = 87 GB; el disco C: bajó al 2,5 %).
 *
 * ## Qué afirma
 * 1. La convención: todo el scratch cuelga de una raíz compartida.
 * 2. El teardown es idempotente y tolera bloqueos de Windows.
 * 3. El barrido borra los runs de procesos **muertos** (y no toca los vivos).
 * 4. **El fin de la fuga**: un proceso muerto deja su store, y la corrida
 *    siguiente lo limpia (esto es lo que hace la limpieza resistente a la
 *    muerte del proceso).
 * 5. **La convención se cumple**: ningún test del desktop crea scratch
 *    fuera de la raíz compartida (si alguien vuelve a `os.tmpdir()`, este
 *    test falla).
 */
import { describe, it, expect, afterAll } from "vitest";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  TEST_SCRATCH_ROOT,
  ALT_SCRATCH_ROOT,
  SCRATCH_MAX_AGE_MS,
  createScratchDir,
  removeScratchDir,
  scratchRunDir,
  sweepOrphanScratch,
  isProcessAlive,
} from "./helpers/test-scratch.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEST_DIR = HERE;

describe("T-X1 — el scratch de los tests es compartido y no se fuga", () => {
  const created: string[] = [];

  afterAll(() => {
    for (const d of created) removeScratchDir(d);
  });

  it("la raíz compartida vive bajo %TEMP% con un nombre estable", () => {
    expect(path.basename(TEST_SCRATCH_ROOT)).toBe("ego-test-scratch");
    expect(path.dirname(TEST_SCRATCH_ROOT)).toBe(
      fs.realpathSync.native ? path.dirname(TEST_SCRATCH_ROOT) : ""
    );
  });

  it("createScratchDir cuelga del run-dir de la corrida (nunca suelto en %TEMP%)", () => {
    const dir = createScratchDir("t-x1");
    created.push(dir);
    expect(fs.existsSync(dir)).toBe(true);
    expect(path.dirname(dir)).toBe(scratchRunDir());
    expect(dir.startsWith(TEST_SCRATCH_ROOT)).toBe(true);
    // Y el nombre del run-dir lleva el PID (la clave del barrido).
    expect(path.basename(scratchRunDir())).toMatch(
      /^run-\d+-\d+-[a-z0-9]+$/
    );
  });

  it("el teardown es IDEMPOTENTE (borra dos veces no lanza)", () => {
    const dir = createScratchDir("t-x1-teardown");
    expect(fs.existsSync(dir)).toBe(true);
    removeScratchDir(dir);
    expect(fs.existsSync(dir)).toBe(false);
    expect(() => removeScratchDir(dir)).not.toThrow();
    expect(() => removeScratchDir(path.join(dir, "no-existe"))).not.toThrow();
  });

  it("el barrido borra los runs de procesos MUERTOS", () => {
    const orphan = path.join(
      TEST_SCRATCH_ROOT,
      `run-${Date.now()}-999999-deadbe`
    );
    fs.mkdirSync(orphan, { recursive: true });
    fs.writeFileSync(path.join(orphan, "store.bin"), "x");
    expect(fs.existsSync(orphan)).toBe(true);

    const { removed } = sweepOrphanScratch();
    expect(removed.some((r) => r.endsWith(path.basename(orphan)))).toBe(true);
    expect(fs.existsSync(orphan)).toBe(false);
  });

  it("el barrido NO toca los runs de procesos VIVOS", () => {
    const alive = path.join(
      TEST_SCRATCH_ROOT,
      `run-${Date.now()}-${process.pid}-alive`
    );
    fs.mkdirSync(alive, { recursive: true });
    try {
      const { kept } = sweepOrphanScratch();
      expect(kept.some((r) => r.endsWith(path.basename(alive)))).toBe(true);
      expect(fs.existsSync(alive)).toBe(true);
    } finally {
      removeScratchDir(alive);
    }
  });

  it("el barrido borra los runs demasiado ANTIGUOS (PID reutilizado)", () => {
    const old = path.join(
      TEST_SCRATCH_ROOT,
      `run-${Date.now() - SCRATCH_MAX_AGE_MS - 60_000}-${process.pid}-old`
    );
    fs.mkdirSync(old, { recursive: true });
    try {
      const { removed } = sweepOrphanScratch();
      expect(removed.some((r) => r.endsWith(path.basename(old)))).toBe(true);
      expect(fs.existsSync(old)).toBe(false);
    } finally {
      removeScratchDir(old);
    }
  });

  it("isProcessAlive distingue vivo de muerto", () => {
    expect(isProcessAlive(process.pid)).toBe(true);
    expect(isProcessAlive(999999)).toBe(false);
    expect(isProcessAlive(0)).toBe(false);
  });

  it("un proceso MUERTO deja su store, y la corrida siguiente lo limpia", async () => {
    // El caso real: el worker de vitest muere (timeout / kill) y su
    // directorio se queda. El store se simula con un fichero (el store real
    // son 320 MB y no aporta al contrato).
    const child = spawn(
      process.execPath,
      [
        "-e",
        `const fs=require("node:fs");const path=require("node:path");
         const dir=path.join(${JSON.stringify(TEST_SCRATCH_ROOT)},
           "run-"+Date.now()+"-"+process.pid+"-child");
         fs.mkdirSync(dir,{recursive:true});
         fs.writeFileSync(path.join(dir,"0.jnl"),"x".repeat(1024));
         process.stdout.write(dir);
         setTimeout(()=>{},60000);`,
      ],
      { stdio: ["ignore", "pipe", "ignore"] }
    );
    const dir = await new Promise<string>((resolve, reject) => {
      let out = "";
      child.stdout.on("data", (d) => {
        out += String(d);
        if (out.includes("run-")) resolve(out.trim());
      });
      child.on("error", reject);
      setTimeout(() => reject(new Error("el hijo no respondió")), 15_000);
    });

    // Lo matamos como lo mata el orquestador: sin teardown.
    child.kill("SIGKILL");
    await new Promise((r) => setTimeout(r, 300));
    expect(fs.existsSync(dir), "el store del muerto debe estar ahí").toBe(true);

    // La corrida siguiente (el barrido) lo recoge.
    const { removed } = sweepOrphanScratch();
    expect(removed.some((r) => r.endsWith(path.basename(dir)))).toBe(true);
    expect(fs.existsSync(dir), "el store del muerto debe estar limpio").toBe(
      false
    );
  });

  it("el barrido también recoge la convención de A3 (`run-<pid>-<rand>` en `ego-scratch`)", () => {
    // A3 implementó la misma idea en `packages/tools/src/TempWorkspace.ts`
    // (código de producción) con otra raíz y otro nombre de run-dir. Para
    // que la limpieza funcione desde cualquier zona, este barrido cubre las
    // DOS convenciones.
    const dir = path.join(
      ALT_SCRATCH_ROOT,
      `run-${999999}-a3style`
    );
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "0.jnl"), "x");
    try {
      const { removed } = sweepOrphanScratch();
      expect(
        removed.some((r) => r.endsWith(path.basename(dir))),
        `el barrido no recogió la convención de A3: ${JSON.stringify(removed)}`
      ).toBe(true);
      expect(fs.existsSync(dir)).toBe(false);
    } finally {
      removeScratchDir(dir);
    }
  });

  it("CONVENCIÓN: ningún test del desktop crea scratch fuera de la raíz compartida", () => {
    // Si alguien vuelve a `os.tmpdir()` en un test, este test falla: el
    // store se quedaría suelto en %TEMP% y no lo barrería nadie.
    //
    // Se mira el CÓDIGO, no el texto: los comentarios se eliminan antes
    // (una mención en un docstring no crea nada).
    const offenders: string[] = [];
    for (const f of fs.readdirSync(TEST_DIR)) {
      if (!/\.tsx?$/.test(f)) continue;
      const raw = fs.readFileSync(path.join(TEST_DIR, f), "utf8");
      const code = raw
        .replace(/\/\*[\s\S]*?\*\//g, "") // comentarios de bloque
        .replace(/^\s*\/\/.*$/gm, ""); // comentarios de línea
      if (/tmpdir\(\)/.test(code)) {
        offenders.push(f);
      }
    }
    expect(
      offenders,
      `tests que crean scratch suelto en %TEMP% (usa createScratchDir): ${offenders.join(", ")}`
    ).toEqual([]);
  });
});
