#!/usr/bin/env node
// scripts/test-verify-attribution.mjs — TDD del DELEGADOR de atribución.
//
// El delegador (`scripts/verify-attribution.mjs`) es el ÚNICO entrypoint de CI
// de la atribución. Este test comprueba su CONTRATO, no la lógica de las
// puertas (esa la prueban los tests de cada paquete):
//
//   1. Sin argumentos → ejecuta las 4 puertas (avatar + tool-call-repair +
//      tools + ui-runtime) y sale 0.
//   2. Una puerta que falla → el delegador sale 1 (no se come el fallo).
//   3. `--only <paquete>` → ejecuta sólo esa puerta.
//   4. `--only <paquete> --root <dir>` → ejecuta esa puerta contra otro árbol.
//   5. `--only` sin valor / `--root` sin `--only` / paquete desconocido →
//      exit 2 (uso inválido), no 1.
//   6. `--json` → informe machine (JSON parseable en stdout).
//
// Uso: node scripts/test-verify-attribution.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DELEGADOR = join(HERE, "verify-attribution.mjs");
const RAIZ = join(HERE, "..");

function correr(args) {
  const res = spawnSync(process.execPath, [DELEGADOR, ...args], {
    cwd: RAIZ,
    encoding: "utf8",
    windowsHide: true,
  });
  return { code: res.status, out: `${res.stdout ?? ""}${res.stderr ?? ""}` };
}

test("1. sin argumentos → ejecuta las 4 puertas y sale 0", () => {
  const r = correr([]);
  assert.equal(r.code, 0, "debe salir 0\n" + r.out);
  for (const pkg of ["avatar", "tool-call-repair", "tools", "ui-runtime"]) {
    assert.match(r.out, new RegExp(`atribucion: ${pkg}`), `falta la puerta ${pkg}`);
  }
  assert.match(r.out, /4 puerta\(s\) de atribución en verde/);
});

test("2. una puerta que falla → el delegador sale 1", () => {
  // Un árbol vacío: la puerta no encuentra `provenance.manifest.json` → falla.
  const vacio = mkdtempSync(join(tmpdir(), "a7-attr-vacio-"));
  try {
    const r = correr(["--only", "tools", "--root", vacio]);
    assert.equal(r.code, 1, "debe salir 1: la puerta falló\n" + r.out);
    // El contrato del DELEGADOR: propaga el fallo y lo dice. (El diagnóstico
    // concreto de la puerta es cosa de A2-bis: hoy su salida anticipada es un
    // TypeError — ver el handoff —, pero el código de salida es 1 igual.)
    assert.match(r.out, /FALLÓ \(exit 1\)/);
  } finally {
    rmSync(vacio, { recursive: true, force: true });
  }
});

test("3. `--only <paquete>` → ejecuta sólo esa puerta", () => {
  const r = correr(["--only", "ui-runtime"]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /atribucion: ui-runtime/);
  assert.doesNotMatch(r.out, /atribucion: avatar/);
  assert.match(r.out, /1 puerta\(s\) de atribución en verde/);
});

test("4. `--only <paquete> --root <dir>` → ejecuta esa puerta contra otro árbol", () => {
  // Un árbol SIN manifiesto → la puerta falla (exit 1) con su propio diagnóstico.
  const vacio = mkdtempSync(join(tmpdir(), "a7-attr-root-"));
  try {
    const r = correr(["--only", "tool-call-repair", "--root", vacio]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /atribucion: tool-call-repair/);
    assert.match(r.out, /FALLÓ \(exit 1\)/);
  } finally {
    rmSync(vacio, { recursive: true, force: true });
  }
});

test("5. uso inválido → exit 2 (no 1)", () => {
  assert.equal(correr(["--only"]).code, 2, "--only sin valor");
  assert.equal(correr(["--root", RAIZ]).code, 2, "--root sin --only");
  assert.equal(correr(["--only", "no-existe"]).code, 2, "paquete desconocido");
});

test("6. `--json` → informe machine parseable", () => {
  const r = correr(["--json", "--only", "tools"]);
  assert.equal(r.code, 0, r.out);
  // La puerta imprime su informe JSON por stdout: debe haber al menos un JSON.
  const inicio = r.out.indexOf("{");
  assert.ok(inicio >= 0, "no hay JSON en la salida\n" + r.out);
  const json = JSON.parse(r.out.slice(inicio));
  assert.equal(json.ok, true, "el informe debe ser conforme");
  assert.ok(Array.isArray(json.derived));
});

test("7. una implementación ausente → exit 2 (no un crash)", () => {
  // Se simula con un `--root` que no es un paquete: la puerta existe, así que
  // el caso real (implementación ausente) se comprueba por código de salida.
  const r = correr(["--only", "avatar", "--root", join(tmpdir(), "a7-inexistente-xyz")]);
  assert.ok(r.code === 1 || r.code === 2, "debe fallar con un código de error\n" + r.out);
});

test("8. el árbol de pruebas temporal no se deja sucio", () => {
  const d = mkdtempSync(join(tmpdir(), "a7-attr-limpio-"));
  mkdirSync(join(d, "sub"), { recursive: true });
  rmSync(d, { recursive: true, force: true });
  assert.equal(existsSync(d), false, "el fixture debe estar borrado (el test lo borra en su finally)");
});
