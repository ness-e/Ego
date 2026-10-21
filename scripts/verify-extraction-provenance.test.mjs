#!/usr/bin/env node
/**
 * verify-extraction-provenance.test.mjs — TDD de la puerta de procedencia
 * (EGO-FIND-82).
 *
 * Ejecuta la puerta `verify-extraction-provenance.mjs` sobre árboles de
 * fixtures temporales (`--root`) y comprueba que:
 *
 *   1. una ficha CONFORME           → 0 discrepancias (exit 0)
 *   2. un upstream SIN CLON         → 1 discrepancia (upstream-inexistente)
 *   3. una licencia que NO coincide con el `LICENSE` real → 1 (licencia-distinta)
 *   4. un commit desfasado          → 1 (commit-desfasado)
 *   5. una fila de catálogo que AFIRMA derivación sin cabecera canónica
 *                                    → 1 (derivacion-sin-cabecera)
 *   6. una fila que afirma derivación de `khoj` (AGPL-3.0) → 1
 *                                    (credito-retirado, EGO-FIND-83)
 *
 * Los clones de fixture son repositorios git REALES (con remote y un commit),
 * para que la puerta los resuelva igual que los clones de `repos-referencia/`.
 *
 * Uso:
 *   node scripts/verify-extraction-provenance.test.mjs
 *   node --test scripts/verify-extraction-provenance.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const GATE = join(HERE, "verify-extraction-provenance.mjs");

const MIT_LICENSE = `MIT License

Copyright (c) 2026 Fixture

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction.
`;


/**
 * Ejecuta la puerta contra un árbol y devuelve { code, problems, json }.
 * @param {string} root
 * @param {string[]} [extraArgs]  p.ej. ["--sin-clones"]
 */
function runGate(root, extraArgs = []) {
  const res = spawnSync(process.execPath, [GATE, "--root", root, "--json", ...extraArgs], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (res.status === null) throw new Error(`la puerta no se pudo ejecutar: ${res.stderr}`);
  let json = {};
  try {
    json = JSON.parse(res.stdout);
  } catch {
    throw new Error(`salida no parseable:\n${res.stdout}\n${res.stderr}`);
  }
  return { code: res.status, problems: json.problems ?? [], json };
}

/**
 * Construye un árbol de fixtures.
 * @param {object} o
 * @param {string} [o.fichaUpstream]  upstream escrito en la ficha
 * @param {string} [o.fichaLicense]   licencia escrita en la ficha
 * @param {string} [o.fichaCommit]    commit escrito en la ficha (por defecto, el HEAD real)
 * @param {string} [o.cloneLicense]   licencia REAL del clon (por defecto, MIT)
 * @param {string} [o.originFile]     fichero real del clon
 * @param {string} [o.catalogExtra]   fila extra del catálogo (afirmación de derivación)
 * @param {string} [o.derivedHeader]  cabecera del fichero de Ego citado ("" = sin cabecera)
 */
function buildFixture(o = {}) {
  const upstream = o.fichaUpstream ?? "acme/demo";
  const fichaLicense = o.fichaLicense ?? "MIT";
  const cloneLicense = o.cloneLicense ?? MIT_LICENSE;
  const originFile = o.originFile ?? "src/app.ts";
  const remote = o.remote ?? "https://github.com/acme/demo.git";

  const root = mkdtempSync(join(tmpdir(), "a5-provenance-"));
  const clone = join(root, "repos-referencia", "demo");
  mkdirSync(join(clone, "src"), { recursive: true });
  mkdirSync(join(root, "docs", "extractions"), { recursive: true });
  mkdirSync(join(root, "docs", "review"), { recursive: true });
  mkdirSync(join(root, "packages", "demo"), { recursive: true });

  writeFileSync(join(clone, "LICENSE"), cloneLicense, "utf8");
  writeFileSync(join(clone, originFile), "export const demo = 1;\n", "utf8");

  // clon como repositorio git real (remote + un commit) => la puerta lo resuelve igual
  // que un clon de repos-referencia/
  const git = (...args) =>
    spawnSync("git", ["-C", clone, ...args], { encoding: "utf8", windowsHide: true });
  git("init", "-q");
  git("config", "user.email", "fixture@example.com");
  git("config", "user.name", "Fixture");
  // el entorno puede tener commit.gpgsign global: el fixture no firma
  git("config", "commit.gpgsign", "false");
  git("config", "tag.gpgsign", "false");
  git("add", "-A");
  git("commit", "-q", "-m", "fixture");
  git("remote", "add", "origin", remote);
  const sha = git("rev-parse", "--short=7", "HEAD").stdout.trim();

  // fichero de Ego citado por la fila de catálogo
  const derivedHeader = o.derivedHeader ?? "";
  writeFileSync(
    join(root, "packages", "demo", "derived.ts"),
    derivedHeader
      ? `${derivedHeader}\nexport const derived = 1;\n`
      : "export const derived = 1;\n",
    "utf8",
  );

  const commit = o.fichaCommit ?? sha;
  const row =
    o.catalogExtra ??
    "| DEMO-01 | Patrón de prueba | ✅ Completada | `src/app.ts` | asimilado |";
  const originCell = "`repos-referencia/demo/` (upstream `acme/demo`, commit `${sha}`, origen `${originFile}`)";

  const ficha = `# Extracción Técnica: Demo (repos-referencia/demo)

| Campo | Valor |
| --- | --- |
| Estado | Activo |
| Repositorio Origen | ${originCell} |
| Licencia del origen | ${fichaLicense} — ${upstream} |
| Commit verificado | ${commit} |
| Ruta de origen | \`${originFile}\` |

## 3. Estado real verificado

| ID | Patrón | Estado | Archivo | Evidencia |
| --- | --- | --- | --- | --- |
${row}
`;

  const backlog = `# Backlog demo

## 2. Catálogo Detallado

| ID | Patrón | Estado | Archivo | Evidencia |
| --- | --- | --- | --- | --- |
${row}
`;

  writeFileSync(join(root, "docs", "extractions", "demo.md"), ficha, "utf8");
  writeFileSync(join(root, "docs", "review", "backlog-demo.md"), backlog, "utf8");

  return { root, sha, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

// ── casos ────────────────────────────────────────────────────────────────────

test("1. ficha conforme → 0 discrepancias", () => {
  const fx = buildFixture();
  try {
    const { code, problems } = runGate(fx.root);
    assert.deepEqual(problems, [], `no debería haber discrepancias: ${problems.join(" | ")}`);
    assert.equal(code, 0);
  } finally {
    fx.cleanup();
  }
});

test("2. upstream sin clon → 1 discrepancia (upstream-inexistente)", () => {
  const fx = buildFixture({ fichaUpstream: "ghost/nonexistent" });
  try {
    const { code, problems } = runGate(fx.root);
    assert.equal(problems.length, 1, `esperaba 1 discrepancia, hubo ${problems.length}: ${problems.join(" | ")}`);
    assert.match(problems[0], /upstream-inexistente/);
    assert.equal(code, 1);
  } finally {
    fx.cleanup();
  }
});

test("3. licencia distinta del LICENSE real → 1 discrepancia (licencia-distinta)", () => {
  const fx = buildFixture({ fichaLicense: "Apache-2.0", cloneLicense: MIT_LICENSE });
  try {
    const { code, problems } = runGate(fx.root);
    assert.equal(problems.length, 1, `esperaba 1 discrepancia, hubo ${problems.length}: ${problems.join(" | ")}`);
    assert.match(problems[0], /licencia-distinta/);
    assert.equal(code, 1);
  } finally {
    fx.cleanup();
  }
});

test("4. commit desfasado → 1 discrepancia (commit-desfasado)", () => {
  const fx = buildFixture({ fichaCommit: "deadbee" });
  try {
    const { code, problems } = runGate(fx.root);
    assert.equal(problems.length, 1, `esperaba 1 discrepancia, hubo ${problems.length}: ${problems.join(" | ")}`);
    assert.match(problems[0], /commit-desfasado/);
    assert.equal(code, 1);
  } finally {
    fx.cleanup();
  }
});

test("5. fila que afirma derivación sin cabecera canónica → 1 (derivacion-sin-cabecera)", () => {
  const fx = buildFixture({
    catalogExtra:
      "| DEMO-01 | Patrón de prueba | ✅ Completada | `packages/demo/derived.ts` | `Adapted from acme/demo (MIT), src/app.ts` |",
    derivedHeader: "",
  });
  try {
    const { code, problems } = runGate(fx.root);
    assert.equal(problems.length, 1, `esperaba 1 discrepancia, hubo ${problems.length}: ${problems.join(" | ")}`);
    assert.match(problems[0], /derivacion-sin-cabecera/);
    assert.equal(code, 1);
  } finally {
    fx.cleanup();
  }
});

test("6. fila que afirma derivación de khoj (AGPL) → 1 (credito-retirado, EGO-FIND-83)", () => {
  const fx = buildFixture({
    catalogExtra:
      "| DEMO-01 | Patrón de prueba | ✅ Completada | `packages/demo/derived.ts` | `Adapted from khoj-ai/khoj (AGPL-3.0), khoj/khoj.py` |",
    derivedHeader: "",
  });
  try {
    const { code, problems } = runGate(fx.root);
    assert.equal(problems.length, 1, `esperaba 1 discrepancia, hubo ${problems.length}: ${problems.join(" | ")}`);
    assert.match(problems[0], /credito-retirado/);
    assert.equal(code, 1);
  } finally {
    fx.cleanup();
  }
});

test("7. la misma fila con cabecera canónica en el fichero → 0 discrepancias", () => {
  const fx = buildFixture({
    catalogExtra:
      "| DEMO-01 | Patrón de prueba | ✅ Completada | `packages/demo/derived.ts` | `Adapted from acme/demo (MIT), src/app.ts` |",
    derivedHeader: "// Adapted from acme/demo (MIT), src/app.ts",
  });
  try {
    const { code, problems } = runGate(fx.root);
    assert.deepEqual(problems, [], `no debería haber discrepancias: ${problems.join(" | ")}`);
    assert.equal(code, 0);
  } finally {
    fx.cleanup();
  }
});

test("8. cabecera canonica forma 2 (ADAPTADO de ... ver LICENSE.md) → 0 discrepancias", () => {
  const fx = buildFixture({
    catalogExtra:
      "| DEMO-01 | Patrón de prueba | ✅ Completada | `packages/demo/derived.ts` | `Adapted from acme/demo (MIT), src/app.ts` |",
    derivedHeader: "// ADAPTADO de vendor/acme/app.ts (MIT, © Acme) — ver LICENSE.md",
  });
  try {
    const { code, problems } = runGate(fx.root);
    assert.deepEqual(problems, [], `no debería haber discrepancias: ${problems.join(" | ")}`);
    assert.equal(code, 0);
  } finally {
    fx.cleanup();
  }
});

// ── MODO DEGRADADO (--sin-clones) — el modo en el que corre CI ──────────────
// En CI no hay clones de repos-referencia/: la puerta debe seguir detectando
// las regresiones ESTRUCTURALES (forma de la procedencia, fichero no
// clasificado, crédito a AGPL) y NO debe quejarse de lo que no puede comprobar.

test("9. modo degradado: cabecera de procedencia MAL FORMADA → falla", () => {
  const fx = buildFixture({ fichaUpstream: "sin-slash" });
  try {
    const { code, problems } = runGate(fx.root, ["--sin-clones"]);
    assert.ok(
      problems.some((p) => /procedencia-malformada/.test(p)),
      "esperaba una procedencia mal formada, hubo: " + problems.join(" | "),
    );
    assert.equal(code, 1, "el modo degradado debe FALLAR con la cabecera mal formada");
  } finally {
    fx.cleanup();
  }
});

test("10. modo degradado: fichero NO CLASIFICADO (derivación sin cabecera canónica) → falla", () => {
  const fx = buildFixture({
    catalogExtra:
      "| DEMO-01 | Patrón de prueba | ✅ Completada | `packages/demo/derived.ts` | `Adapted from acme/demo (MIT), src/app.ts` |",
    derivedHeader: "",
  });
  try {
    const { code, problems } = runGate(fx.root, ["--sin-clones"]);
    assert.ok(
      problems.some((p) => /derivacion-sin-cabecera/.test(p)),
      "esperaba derivacion-sin-cabecera, hubo: " + problems.join(" | "),
    );
    assert.equal(code, 1, "el modo degradado debe FALLAR con el fichero sin cabecera");
  } finally {
    fx.cleanup();
  }
});

test("11. modo degradado: CRÉDITO A KHOJ (AGPL-3.0) → falla", () => {
  const fx = buildFixture({
    catalogExtra:
      "| DEMO-01 | Patrón de prueba | ✅ Completada | `packages/demo/derived.ts` | `Adapted from khoj-ai/khoj (AGPL-3.0), khoj/khoj.py` |",
    derivedHeader: "",
  });
  try {
    const { code, problems } = runGate(fx.root, ["--sin-clones"]);
    assert.ok(
      problems.some((p) => /credito-retirado/.test(p)),
      "esperaba credito-retirado, hubo: " + problems.join(" | "),
    );
    assert.equal(code, 1, "el modo degradado debe FALLAR con el crédito a khoj");
  } finally {
    fx.cleanup();
  }
});

test("12. modo degradado: todo conforme → pasa", () => {
  const fx = buildFixture({
    catalogExtra:
      "| DEMO-01 | Patrón de prueba | ✅ Completada | `packages/demo/derived.ts` | `Adapted from acme/demo (MIT), src/app.ts` |",
    derivedHeader: "// Adapted from acme/demo (MIT), src/app.ts",
  });
  try {
    const { code, problems, json } = runGate(fx.root, ["--sin-clones"]);
    assert.deepEqual(problems, [], "no debería haber discrepancias: " + problems.join(" | "));
    assert.equal(code, 0);
    assert.equal(json.sinClones, true, "la salida debe declarar el modo degradado");
  } finally {
    fx.cleanup();
  }
});

test("13. modo degradado: lo que SÓLO se puede comprobar con clones NO se queja", () => {
  // El clon EXISTE (upstream válido) pero su licencia real y su HEAD no cuadran
  // con lo que declara la ficha: en modo completo son 2 discrepancias
  // (licencia-distinta + commit-desfasado); en modo degradado NO deben aparecer,
  // porque sin el clon no hay nada contra lo que contrastar.
  const fx = buildFixture({
    fichaLicense: "Apache-2.0",
    cloneLicense: MIT_LICENSE,
    fichaCommit: "deadbee",
  });
  try {
    const completo = runGate(fx.root);
    assert.ok(
      completo.problems.length >= 2,
      "el modo completo debería ver ≥2 discrepancias, vio " + completo.problems.length,
    );
    assert.ok(
      completo.problems.some((x) => /licencia-distinta/.test(x)),
      "esperaba licencia-distinta: " + completo.problems.join(" | "),
    );
    assert.ok(
      completo.problems.some((x) => /commit-desfasado/.test(x)),
      "esperaba commit-desfasado: " + completo.problems.join(" | "),
    );
    const degradado = runGate(fx.root, ["--sin-clones"]);
    assert.deepEqual(
      degradado.problems,
      [],
      "el modo degradado no debe quejarse de lo que no puede comprobar: " +
        degradado.problems.join(" | "),
    );
    assert.equal(degradado.code, 0);
  } finally {
    fx.cleanup();
  }
});

test("14. clon con licencia Apache-2.0 real y ficha que lo declara → 0 discrepancias", () => {
  const APACHE_LICENSE = `                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   Licensed under the Apache License, Version 2.0 (the "License");
`;
  const fx = buildFixture({ cloneLicense: APACHE_LICENSE, fichaLicense: "Apache-2.0" });
  try {
    const { code, problems } = runGate(fx.root);
    assert.deepEqual(problems, [], "no debería haber discrepancias: " + problems.join(" | "));
    assert.equal(code, 0);
  } finally {
    fx.cleanup();
  }
});
