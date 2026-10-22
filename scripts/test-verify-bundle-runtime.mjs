#!/usr/bin/env node
// scripts/test-verify-bundle-runtime.mjs — TDD del smoke test del bundle
// (EGO-FIND-122, Ola 11).
//
// Fija el CONTRATO del script:
//
//   1. SIN bundle            → todo OMITIDO con motivo · exit 0 (fail-soft)
//   2. bundle que invoca un toolchain del sistema → FALLA · exit 1
//   3. bundle limpio                         → esa comprobación OK
//   4. config sin los 3 patrones de asarUnpack → FALLA · exit 1
//   5. config con los 3 patrones              → OK
//   6. el repo real (con bundle)              → exit 0
//
// Uso: node scripts/test-verify-bundle-runtime.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "verify-bundle-runtime.mjs");

const CONFIG_OK = `'use strict';
module.exports = {
  asar: true,
  asarUnpack: ['**/*.node', '**/node_modules/vantadb/**', '**/node_modules/vantadb-node/**'],
};
`;

const CONFIG_MALO = `'use strict';
module.exports = { asar: true, asarUnpack: ['**/*.node'] };
`;

function fixture({ bundle, config }) {
  const root = mkdtempSync(join(tmpdir(), "a7-bundle-"));
  if (bundle !== null) {
    mkdirSync(join(root, "out"), { recursive: true });
    writeFileSync(join(root, "out", "main.js"), bundle, "utf8");
  }
  if (config !== null) {
    writeFileSync(join(root, "electron-builder.config.cjs"), config, "utf8");
  }
  return root;
}

function correr(args) {
  const res = spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: "utf8",
    windowsHide: true,
  });
  return { code: res.status, out: `${res.stdout ?? ""}${res.stderr ?? ""}` };
}

/** El estado de una comprobación por su id (del informe JSON). */
function estado(json, id) {
  const c = json.checks.find((x) => x.id === id);
  return c ? c.estado : null;
}

function correrJson(args) {
  const res = spawnSync(process.execPath, [SCRIPT, "--json", ...args], {
    encoding: "utf8",
    windowsHide: true,
  });
  const i = (res.stdout ?? "").indexOf("{");
  return { code: res.status, json: i >= 0 ? JSON.parse((res.stdout ?? "").slice(i)) : null };
}

test("1. SIN bundle → todo OMITIDO con motivo · exit 0 (fail-soft)", () => {
  const root = fixture({ bundle: null, config: CONFIG_OK });
  try {
    const r = correr(["--bundle", join(root, "out", "main.js"), "--config", join(root, "electron-builder.config.cjs")]);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /omitida\(s\) con motivo/);
    assert.match(r.out, /no hay bundle/);
    assert.match(r.out, /NO son un visto bueno/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("2. bundle que invoca un toolchain del sistema → FALLA · exit 1", () => {
  const root = fixture({
    bundle: 'const { execSync } = require("child_process");\nexecSync("python3 build.py");\n',
    config: CONFIG_OK,
  });
  try {
    const r = correr([
      "--bundle",
      join(root, "out", "main.js"),
      "--config",
      join(root, "electron-builder.config.cjs"),
    ]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /sin-toolchain/);
    assert.match(r.out, /python/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("3. bundle limpio → la comprobación de toolchain OK", () => {
  const root = fixture({
    bundle: 'const { execFile } = require("child_process");\nexecFile("ego-helper", []);\n',
    config: CONFIG_OK,
  });
  try {
    const r = correrJson([
      "--bundle",
      join(root, "out", "main.js"),
      "--config",
      join(root, "electron-builder.config.cjs"),
    ]);
    assert.equal(r.code, 0, JSON.stringify(r.json));
    assert.equal(estado(r.json, "sin-toolchain"), "OK");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("4. config SIN los 3 patrones de asarUnpack → FALLA · exit 1", () => {
  const root = fixture({
    bundle: 'const a = 1;\n',
    config: CONFIG_MALO,
  });
  try {
    const r = correr([
      "--bundle",
      join(root, "out", "main.js"),
      "--config",
      join(root, "electron-builder.config.cjs"),
    ]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /asar-unpack-config/);
    assert.match(r.out, /vantadb/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("5. config con los 3 patrones → OK", () => {
  const root = fixture({ bundle: 'const a = 1;\n', config: CONFIG_OK });
  try {
    const r = correrJson([
      "--bundle",
      join(root, "out", "main.js"),
      "--config",
      join(root, "electron-builder.config.cjs"),
    ]);
    assert.equal(r.code, 0, JSON.stringify(r.json));
    assert.equal(estado(r.json, "asar-unpack-config"), "OK");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("6. el repo real → exit 0", () => {
  const r = correr([]);
  assert.equal(r.code, 0, r.out);
});
