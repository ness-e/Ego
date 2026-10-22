#!/usr/bin/env node
// scripts/test-inventory-tautological-tests.mjs — TDD del detector de tests
// tautológicos (EGO-FIND-108, Ola 11).
//
// El detector anterior sólo veía `const X = readFileSync(` **en la misma
// línea**. Estos casos fijan el contrato del detector que sí ve:
//
//   (a) lectura directa        → detectada
//   (b) lectura en un HELPER   → detectada (la lectura está dentro de una
//                                función local que devuelve el texto)
//   (c) lectura con `await`    → detectada
//   (d) `fs.readFileSync(...)` → detectada
//   (e) lectura DENTRO del expect → detectada
//   (f) lectura sin assert     → NO detectada
//   (g) valor de runtime (sin lectura) → NO detectada
//   (h) helper que devuelve un AST (la lectura NO se devuelve) → NO detectada
//   (i) lectura de un ARTEFACTO de la corrida → NO tautológica
//   (j) lectura de un fichero de CÓDIGO del repo → tautológica
//   (k) el repo real → el detector corre y sale 0
//
// Uso: node scripts/test-inventory-tautological-tests.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DETECTOR = join(HERE, "inventory-tautological-tests.mjs");

/**
 * Construye un árbol de fixture con:
 *   · `apps/desktop/src/mod.ts` → un fichero de CÓDIGO del repo (para (j)).
 *   · `tests/e2e/x.test.ts`    → el test con el contenido que se le pase.
 */
function fixture(testSource) {
  const root = mkdtempSync(join(tmpdir(), "a7-inv-"));
  mkdirSync(join(root, "apps", "desktop", "src"), { recursive: true });
  mkdirSync(join(root, "tests", "e2e"), { recursive: true });
  writeFileSync(
    join(root, "apps", "desktop", "src", "mod.ts"),
    "export function hola() {\n  return 'hola';\n}\n",
    "utf8",
  );
  writeFileSync(join(root, "tests", "e2e", "x.test.ts"), testSource, "utf8");
  return root;
}

function detectar(root) {
  const res = spawnSync(process.execPath, [DETECTOR, "--root", root, "--json"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const out = res.stdout ?? "";
  const i = out.indexOf("{");
  assert.ok(i >= 0, "el detector no devolvió JSON\n" + out + res.stderr);
  return { code: res.status, json: JSON.parse(out.slice(i)) };
}

/** El número de asserts TAUTOLÓGICOS (texto del código bajo prueba). */
function tautologicos(json) {
  let n = 0;
  for (const f of json.findings) {
    for (const d of f.detail) if (d.tipo === "codigo-repo") n++;
  }
  return n;
}

/** El número de asserts detectados (de cualquier tipo). */
function total(json) {
  return json.findings.reduce((n, f) => n + f.hits, 0);
}

test("(a) lectura directa en la misma línea → detectada", () => {
  const root = fixture(
    `import { readFileSync } from "node:fs";\n` +
      `const src = readFileSync("apps/desktop/src/mod.ts", "utf8");\n` +
      `it("x", () => { expect(src).toContain("hola"); });\n`,
  );
  try {
    const { json } = detectar(root);
    assert.ok(total(json) >= 1, "debe detectar el assert");
    assert.ok(tautologicos(json) >= 1, "debe clasificarlo como tautológico");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("(b) lectura dentro de un HELPER local → detectada", () => {
  const root = fixture(
    `import { readFileSync } from "node:fs";\n` +
      `const read = (p: string): string => readFileSync(p, "utf-8");\n` +
      `it("x", () => {\n` +
      `  const src = read("apps/desktop/src/mod.ts");\n` +
      `  expect(src).toMatch(/hola/);\n` +
      `});\n`,
  );
  try {
    const { json } = detectar(root);
    assert.ok(total(json) >= 1, "el detector NO debe ser ciego a la lectura en un helper");
    assert.ok(tautologicos(json) >= 1, "debe clasificarlo como tautológico");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("(c) lectura con `await` → detectada", () => {
  const root = fixture(
    `import { readFile } from "node:fs/promises";\n` +
      `it("x", async () => {\n` +
      `  const src = await readFile("apps/desktop/src/mod.ts", "utf-8");\n` +
      `  expect(src).toContain("hola");\n` +
      `});\n`,
  );
  try {
    const { json } = detectar(root);
    assert.ok(total(json) >= 1, "debe detectar la lectura con await");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("(d) `fs.readFileSync(...)` → detectada", () => {
  const root = fixture(
    `import fs from "node:fs";\n` +
      `it("x", () => {\n` +
      `  const src = fs.readFileSync("apps/desktop/src/mod.ts", "utf8");\n` +
      `  expect(src).toContain("hola");\n` +
      `});\n`,
  );
  try {
    const { json } = detectar(root);
    assert.ok(total(json) >= 1, "debe detectar `fs.readFileSync`");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("(e) lectura DENTRO del expect → detectada", () => {
  const root = fixture(
    `import { readFileSync } from "node:fs";\n` +
      `it("x", () => {\n` +
      `  expect(readFileSync("apps/desktop/src/mod.ts", "utf8")).toContain("hola");\n` +
      `});\n`,
  );
  try {
    const { json } = detectar(root);
    assert.ok(total(json) >= 1, "debe detectar la lectura dentro del expect");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("(f) lectura SIN assert → no detectada", () => {
  const root = fixture(
    `import { readFileSync } from "node:fs";\n` +
      `const src = readFileSync("apps/desktop/src/mod.ts", "utf8");\n` +
      `it("x", () => { expect(src.length).toBeGreaterThan(0); });\n`,
  );
  try {
    const { json } = detectar(root);
    assert.equal(total(json), 0, "sin assert sobre la variable no hay hallazgo");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("(g) valor de runtime (sin lectura) → no detectada", () => {
  const root = fixture(
    `it("x", () => { const v = [1, 2, 3]; expect(v).toContain(2); });\n`,
  );
  try {
    const { json } = detectar(root);
    assert.equal(total(json), 0, "sin lectura no hay hallazgo");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("(h) helper que devuelve un AST (no texto) → NO detectada", () => {
  // El patrón real de `packages/avatar/tests/public-surface.test.js`: la
  // lectura se pasa a un parser y lo que se devuelve es el AST ⇒ el aserto
  // afirma sobre el árbol parseado, no sobre el texto.
  const root = fixture(
    `import { readFileSync } from "node:fs";\n` +
      `function readParsed() {\n` +
      `  const text = readFileSync("apps/desktop/src/mod.ts", "utf8");\n` +
      `  return { text, parsed: true };\n` +
      `}\n` +
      `it("x", () => { const { parsed } = readParsed(); expect(parsed).toBe(true); });\n`,
  );
  try {
    const { json } = detectar(root);
    assert.equal(total(json), 0, "un helper que NO devuelve el texto no es una lectura de texto");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("(i) lectura de un ARTEFACTO de la corrida → no tautológica", () => {
  // El fichero está en un directorio temporal: no es el código bajo prueba.
  const root = fixture(
    `import { readFileSync } from "node:fs";\n` +
      `it("x", () => {\n` +
      `  const out = readFileSync(join(tmp, "salida", "notas.md"), "utf8");\n` +
      `  expect(out).toContain("hola");\n` +
      `});\n`,
  );
  try {
    const { json } = detectar(root);
    assert.ok(total(json) >= 1, "debe detectarlo como lectura de texto");
    assert.equal(tautologicos(json), 0, "un artefacto de la corrida NO es tautológico");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("(j) lectura de un fichero de CÓDIGO del repo → tautológica", () => {
  const root = fixture(
    `import { readFileSync } from "node:fs";\n` +
      `it("x", () => {\n` +
      `  const src = readFileSync("apps/desktop/src/mod.ts", "utf8");\n` +
      `  expect(src).toContain("hola");\n` +
      `});\n`,
  );
  try {
    const { json } = detectar(root);
    const tipos = json.findings.flatMap((f) => f.detail.map((d) => d.tipo));
    assert.ok(tipos.includes("codigo-repo"), `tipos vistos: ${JSON.stringify(tipos)}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("(k) el repo real → el detector corre y sale 0", () => {
  const res = spawnSync(process.execPath, [DETECTOR, "--json"], {
    cwd: join(HERE, ".."),
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(res.status, 0, "el detector es un inventario: siempre sale 0");
  const i = (res.stdout ?? "").indexOf("{");
  assert.ok(i >= 0, "debe imprimir un informe JSON");
  const json = JSON.parse((res.stdout ?? "").slice(i));
  assert.ok(json.tautologicos >= 0, "el informe debe llevar el recuento de tautológicos");
});
