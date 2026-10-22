#!/usr/bin/env node
// scripts/test-verify-ci-gates.mjs — TDD de la puerta de inventario de puertas.
//
// Comprueba que la puerta detecta lo que tiene que detectar:
//
//   1. Una puerta NUEVA sin cablear en CI           → falla (exit 1)
//   2. Esa misma puerta, cableada en un workflow    → pasa  (exit 0)
//   3. Esa misma puerta, exenta con motivo         → pasa  (exit 0)
//   4. Una puerta cableada por un DELEGADOR        → pasa  (exit 0)
//   5. Una puerta cableada por un script npm que CI ejecuta → pasa (exit 0)
//   6. El repo real                                 → pasa  (exit 0)
//
// Uso: node scripts/test-verify-ci-gates.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const GATE = join(HERE, "verify-ci-gates.mjs");

/** Construye un árbol de fixture. */
function buildFixture({ wired = false, exempt = false, viaDelegator = false, viaNpm = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), "a7-ci-gates-"));
  mkdirSync(join(root, "scripts"), { recursive: true });
  mkdirSync(join(root, ".github", "workflows"), { recursive: true });
  mkdirSync(join(root, "packages", "demo"), { recursive: true });

  // la puerta nueva, sin cablear
  writeFileSync(join(root, "scripts", "check-nueva-cosa.mjs"), "// puerta nueva\n", "utf8");

  const pasos = [];
  if (wired) {
    pasos.push("      - name: Puerta nueva");
    pasos.push("        run: node scripts/check-nueva-cosa.mjs");
  }
  if (viaDelegator) {
    writeFileSync(
      join(root, "scripts", "verify-nueva-cosa.mjs"),
      "const IMP = 'check-nueva-cosa.mjs';\n",
      "utf8",
    );
    pasos.push("      - name: Delegador");
    pasos.push("        run: node scripts/verify-nueva-cosa.mjs");
  }
  if (viaNpm) {
    writeFileSync(
      join(root, "packages", "demo", "package.json"),
      JSON.stringify({ name: "@ego/demo", scripts: { "nueva:check": "node ../../scripts/check-nueva-cosa.mjs" } }),
      "utf8",
    );
    pasos.push("      - name: Puerta del paquete");
    pasos.push("        run: pnpm --filter @ego/demo nueva:check");
  }

  writeFileSync(
    join(root, ".github", "workflows", "ci.yml"),
    ["name: CI", "on:", "  push:", "    branches: [main]", "jobs:", "  verify:", "    steps:", ...pasos, ""].join("\n"),
    "utf8",
  );

  // el paquete raíz (el gate lo lee)
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "fixture", private: true, scripts: {} }),
    "utf8",
  );

  // exención: se añade una entrada en la lista del gate del fixture
  if (exempt) {
    const gateSrc = readFileSync(GATE, "utf8");
    const patched = gateSrc.replace(
      'const CI_GATE_EXEMPT = new Map([',
      'const CI_GATE_EXEMPT = new Map([\n  ["scripts/check-nueva-cosa.mjs", "exenta en el fixture"],',
    );
    const patchedPath = join(root, "scripts", "verify-ci-gates.mjs");
    writeFileSync(patchedPath, patched, "utf8");
    return { root, gate: patchedPath };
  }
  return { root, gate: GATE };
}

function runGate(gate, root) {
  const res = spawnSync(process.execPath, [gate, "--root", root], {
    encoding: "utf8",
    windowsHide: true,
  });
  return { code: res.status, out: `${res.stdout ?? ""}${res.stderr ?? ""}` };
}

test("1. puerta nueva SIN cablear → falla", () => {
  const fx = buildFixture();
  try {
    const r = runGate(fx.gate, fx.root);
    assert.equal(r.code, 1, "debe fallar: la puerta no está cableada");
    assert.match(r.out, /check-nueva-cosa\.mjs/);
    assert.match(r.out, /SIN CABLEAR/);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test("2. puerta nueva cableada en un workflow → pasa", () => {
  const fx = buildFixture({ wired: true });
  try {
    const r = runGate(fx.gate, fx.root);
    assert.equal(r.code, 0, "debe pasar: la puerta está cableada\n" + r.out);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test("3. puerta nueva EXENTA con motivo → pasa", () => {
  const fx = buildFixture({ exempt: true });
  try {
    const r = runGate(fx.gate, fx.root);
    assert.equal(r.code, 0, "debe pasar: la puerta está exenta\n" + r.out);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test("4. puerta cableada por un DELEGADOR → pasa", () => {
  const fx = buildFixture({ viaDelegator: true });
  try {
    const r = runGate(fx.gate, fx.root);
    assert.equal(r.code, 0, "debe pasar: la puerta está cableada por delegador\n" + r.out);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test("5. puerta cableada por un script npm que CI ejecuta → pasa", () => {
  const fx = buildFixture({ viaNpm: true });
  try {
    const r = runGate(fx.gate, fx.root);
    assert.equal(r.code, 0, "debe pasar: la puerta está cableada vía npm\n" + r.out);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test("6. el repo real → pasa (toda puerta cableada o exenta)", () => {
  const r = spawnSync(process.execPath, [GATE], {
    cwd: join(HERE, ".."),
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(r.status, 0, "el repo real debe pasar\n" + `${r.stdout ?? ""}${r.stderr ?? ""}`);
});
