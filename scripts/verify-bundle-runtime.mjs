#!/usr/bin/env node
// scripts/verify-bundle-runtime.mjs — EGO-FIND-122 (Ola 11 · A7): SMOKE TEST
// del bundle REAL de la aplicación de escritorio.
//
// ## Qué problema resuelve
//
// CI ya empaqueta el bundle (`pnpm build` → `apps/desktop/out/**`) y ejecuta el
// e2e de Electron (fail-soft si no hay bundle). Pero **nadie comprobaba** tres
// cosas del bundle que sólo se rompen al empaquetar:
//
//   1. que el bundle NO resuelva Node/Rust/Python (es un bundle de Electron:
//      no puede depender de un toolchain del sistema — si lo necesita, la app
//      funciona en la máquina del developer y se rompe en la del usuario);
//   2. que los `.node` de VantaDB (napi-rs) se carguen desde `asarUnpack`
//      (dentro del `.asar` el linker no puede cargarlos);
//   3. que no haya DLLs ausentes en el paquete.
//
// ## Modo FAIL-SOFT
//
//   · sin bundle (`apps/desktop/out/main/main.js`) → todo se marca "OMITIDO"
//     con el motivo. En CI el job `e2e-electron` construye el bundle antes,
//     así que ahí sí corre de verdad.
//   · sin app empaquetada (`apps/desktop/release/**`) → la comprobación (3)
//     no se puede hacer (necesita el directorio desempaquetado): se OMITE
//     con el motivo, y se dice exactamente qué comando la haría.
//
// ⚠️ ESTA PUERTA **NO SUSTITUYE** a la prueba en la VM limpia del owner
// (`DIST-06`): comprueba el bundle, no la instalación real en Windows.
//
// USO:
//   node scripts/verify-bundle-runtime.mjs            → puerta
//   node scripts/verify-bundle-runtime.mjs --json     → informe machine
//   node scripts/verify-bundle-runtime.mjs --app <dir> → app desempaquetada
//
// Códigos de salida: 0 = todo ok (o omitido con motivo) · 1 = una comprobación
// FALLA de verdad · 2 = uso inválido.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

// La config de electron-builder es CommonJS: en un módulo ESM hace falta
// `createRequire` para poder cargarla.
const requireCjs = createRequire(import.meta.url);

const ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), ".."));
const argv = process.argv.slice(2);
const AS_JSON = argv.includes("--json");

/** El bundle real del proceso main (`--bundle <fichero>` lo sobreescribe). */
const BUNDLE_ARG = argv.indexOf("--bundle");
const BUNDLE =
  BUNDLE_ARG >= 0 && argv[BUNDLE_ARG + 1]
    ? resolve(process.cwd(), argv[BUNDLE_ARG + 1])
    : join(ROOT, "apps", "desktop", "out", "main", "main.js");
/** La config de empaquetado (CommonJS: se puede `require`). */
const CONFIG_ARG = argv.indexOf("--config");
const BUILDER_CONFIG =
  CONFIG_ARG >= 0 && argv[CONFIG_ARG + 1]
    ? resolve(process.cwd(), argv[CONFIG_ARG + 1])
    : join(ROOT, "apps", "desktop", "electron-builder.config.cjs");
/** Raíz donde electron-builder deja la app desempaquetada. */
const RELEASE_DIR = join(ROOT, "apps", "desktop", "release");

/** Toolchains del sistema que un bundle de Electron NO debe invocar. */
const TOOLCHAINS = [
  "node",
  "nodejs",
  "python",
  "python3",
  "pythonw",
  "cargo",
  "rustc",
  "rustup",
  "gcc",
  "g++",
  "cc",
  "cl",
  "npm",
  "npx",
  "pnpm",
  "yarn",
  "bun",
  "deno",
  "pip",
  "pip3",
  "uv",
  "poetry",
  "dotnet",
  "java",
  "javac",
  "make",
  "cmake",
  "ninja",
  "msbuild",
  "wsl",
];

/** Los 3 patrones de `asarUnpack` que el repo declara (EGO-FIND-122). */
const ASAR_UNPACK_ESPERADOS = [
  "**/*.node",
  "**/node_modules/vantadb/**",
  "**/node_modules/vantadb-node/**",
];

/** DLLs de runtime que el paquete debe llevar (por plataforma). */
const DLLS_POR_PLATAFORMA = {
  win32: ["vcruntime140.dll", "vcruntime140_1.dll", "msvcp140.dll"],
  linux: ["libstdc++.so.6", "libgcc_s.so.1"],
  darwin: ["libc++.1.dylib"],
};

/** Ficheros del bundle que se comprueban (main y preload). */
function bundleFiles() {
  const out = [];
  const main = dirname(BUNDLE);
  const preload = join(ROOT, "apps", "desktop", "out", "preload");
  for (const dir of [main, preload]) {
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".js")) out.push(join(dir, entry.name));
    }
  }
  return out;
}

/** ¿Existe la app desempaquetada? (devuelve su directorio o null) */
function findUnpackedApp() {
  const idx = argv.indexOf("--app");
  if (idx >= 0 && argv[idx + 1]) {
    const dir = resolve(process.cwd(), argv[idx + 1]);
    return existsSync(dir) ? dir : null;
  }
  if (!existsSync(RELEASE_DIR)) return null;
  for (const entry of readdirSync(RELEASE_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    // electron-builder: win-unpacked, mac/Ego.app, linux-unpacked
    const dir = join(RELEASE_DIR, entry.name);
    if (entry.name.endsWith(".app")) {
      const inner = join(dir, "Contents", "Resources");
      if (existsSync(inner)) return inner;
      continue;
    }
    const res = join(dir, "resources");
    if (existsSync(res)) return res;
    if (existsSync(join(dir, "lib"))) return dir;
  }
  return null;
}

/** Recorre un árbol y devuelve los ficheros que encajan con `re`. */
function walkFiles(dir, re, out = [], depth = 0) {
  if (depth > 8) return out;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const abs = join(dir, e.name);
    if (e.isDirectory()) walkFiles(abs, re, out, depth + 1);
    else if (re.test(e.name)) out.push(abs);
  }
  return out;
}

const checks = [];
const addCheck = (id, estado, detalle, extra = {}) =>
  checks.push({ id, estado, detalle, ...extra });

/* ─────────────────────────── 0. ¿hay bundle? ─────────────────────────── */

if (!existsSync(BUNDLE)) {
  addCheck(
    "bundle",
    "OMITIDO",
    `no hay bundle (${relative(ROOT, BUNDLE).split(sep).join("/")}): se omite la comprobación entera`,
  );
} else {
  const files = bundleFiles();
  const mainSrc = existsSync(BUNDLE) ? readFileSync(BUNDLE, "utf8") : "";
  const bundleBytes = statSync(BUNDLE).size;

  addCheck(
    "bundle",
    "OK",
    `bundle real encontrado: ${relative(ROOT, BUNDLE).split(sep).join("/")} ` +
      `(${Math.round(bundleBytes / 1024)} KB, ${files.length} fichero(s) JS en out/{main,preload})`,
  );

  /* ─────────── 1. el bundle no resuelve Node/Rust/Python ─────────── */

  // Los nombres se escapan: `g++` y `c++` son metacaráctores de regex.
  const toolchains = TOOLCHAINS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const toolchainRe = new RegExp(
    String.raw`\b(?:spawnSync|spawn|execFileSync|execFile|execSync|exec)\s*\(\s*["'\`](?:${toolchains})\b`,
    "gi",
  );
  const toolchainHits = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    const re = new RegExp(toolchainRe.source, "gi");
    let m;
    while ((m = re.exec(src)) !== null) {
      toolchainHits.push({
        fichero: relative(ROOT, f).split(sep).join("/"),
        match: m[0].slice(0, 60),
      });
      if (toolchainHits.length > 20) break;
    }
  }
  addCheck(
    "sin-toolchain",
    toolchainHits.length === 0 ? "OK" : "FALLA",
    toolchainHits.length === 0
      ? `el bundle NO invoca ningún toolchain del sistema (${TOOLCHAINS.length} nombres vigilados: node, python, cargo, rustc, npm…)`
      : `el bundle invoca ${toolchainHits.length} toolchain(s) del sistema: ` +
        toolchainHits.map((h) => `${h.fichero} → ${h.match}`).join("; "),
    { hits: toolchainHits },
  );

  /* ─────────── 2. los .node de VantaDB se cargan desde asarUnpack ─────────── */

  const usaVantadb = /vantadb[-_/]|vantadb_native/i.test(mainSrc);
  let patrones = [];
  let errorConfig = null;
  if (existsSync(BUILDER_CONFIG)) {
    try {
      const cfg = requireCjs(BUILDER_CONFIG);
      patrones = Array.isArray(cfg.asarUnpack) ? cfg.asarUnpack : [];
    } catch (e) {
      errorConfig = `no se puede leer la config de empaquetado: ${e.message}`;
    }
  } else {
    errorConfig = `no existe ${relative(ROOT, BUILDER_CONFIG)}`;
  }
  const faltan = ASAR_UNPACK_ESPERADOS.filter((p) => !patrones.includes(p));
  addCheck(
    "asar-unpack-config",
    errorConfig || faltan.length === 0 ? (errorConfig ? "FALLA" : "OK") : "FALLA",
    errorConfig
      ? errorConfig
      : faltan.length === 0
        ? `asarUnpack declara los ${ASAR_UNPACK_ESPERADOS.length} patrones: ${patrones.join(" | ")}`
        : `asarUnpack NO declara: ${faltan.join(" | ")} (declarados: ${patrones.join(" | ")})`,
  );

  const appDir = findUnpackedApp();
  if (!appDir) {
    addCheck(
      "asar-unpack-bundle",
      "OMITIDO",
      "no hay app desempaquetada (apps/desktop/release/**): la comprobación fuerte de " +
        "asarUnpack necesita el paquete. Se hace con: pnpm --filter @ego/desktop dist",
      { requiere: "pnpm --filter @ego/desktop dist" },
    );
  } else {
    const unpacked = join(appDir, "app.asar.unpacked");
    const nativos = existsSync(unpacked)
      ? walkFiles(unpacked, /\.node$/)
      : [];
    const deVantadb = nativos.filter((f) => /vantadb/i.test(f));
    const dentroDelAsar = walkFiles(appDir, /\.node$/).filter((f) => !f.includes("app.asar.unpacked"));
    addCheck(
      "asar-unpack-bundle",
      deVantadb.length > 0 && dentroDelAsar.length === 0 ? "OK" : "FALLA",
      deVantadb.length === 0
        ? `no hay ningún binario .node de VantaDB en app.asar.unpacked (${nativos.length} .node en total)`
        : dentroDelAsar.length > 0
          ? `hay ${dentroDelAsar.length} .node DENTRO del asar (no se pueden cargar): ` +
            dentroDelAsar.slice(0, 5).map((f) => relative(appDir, f)).join(", ")
          : `${deVantadb.length} binario(s) .node de VantaDB fuera del asar: ` +
            deVantadb.map((f) => relative(appDir, f)).join(", "),
    );
  }

  /* ─────────── 3. no hay DLLs ausentes en el paquete ─────────── */

  const plataforma = process.platform;
  const dlls = DLLS_POR_PLATAFORMA[plataforma] ?? [];
  if (!appDir) {
    addCheck(
      "dlls",
      "OMITIDO",
      `no hay app desempaquetada: no se pueden comprobar las DLL de runtime (${plataforma}: ` +
        `${dlls.join(", ") || "n/d"}). Se hace con: pnpm --filter @ego/desktop dist`,
      { requiere: "pnpm --filter @ego/desktop dist" },
    );
  } else {
    const presentes = [];
    const ausentes = [];
    for (const dll of dlls) {
      // La DLL puede estar en la raíz de la app o en app.asar.unpacked.
      const hay = walkFiles(appDir, new RegExp(`^${dll.replace(/\./g, "\\.")}$`, "i")).length > 0;
      (hay ? presentes : ausentes).push(dll);
    }
    addCheck(
      "dlls",
      ausentes.length === 0 ? "OK" : "FALLA",
      ausentes.length === 0
        ? `las DLL de runtime de ${plataforma} están en el paquete (${presentes.join(", ")})`
        : `FALTAN DLL de runtime de ${plataforma} en el paquete: ${ausentes.join(", ")}`,
    );
  }
}

/* ───────────────────────────── informe ───────────────────────────── */

const fallos = checks.filter((c) => c.estado === "FALLA");
const omitidos = checks.filter((c) => c.estado === "OMITIDO");

if (AS_JSON) {
  console.log(
    JSON.stringify(
      {
        ok: fallos.length === 0,
        bundle: existsSync(BUNDLE) ? relative(ROOT, BUNDLE).split(sep).join("/") : null,
        checks,
        fallos: fallos.length,
        omitidos: omitidos.length,
      },
      null,
      2,
    ),
  );
} else {
  console.log("[verify-bundle-runtime] smoke test del bundle real de la app de escritorio");
  for (const c of checks) {
    const marca = c.estado === "OK" ? "✓" : c.estado === "FALLA" ? "✗" : "–";
    console.log(`  ${marca} ${c.id}: ${c.detalle}`);
  }
  console.log("");
  if (fallos.length === 0) {
    console.log(
      `[verify-bundle-runtime] ${checks.length} comprobación(es): ` +
        `${checks.length - omitidos.length} ok · ${omitidos.length} omitida(s) con motivo · 0 fallos.`,
    );
    if (omitidos.length > 0) {
      console.log(
        "[verify-bundle-runtime] NOTA: las comprobaciones omitidas NO son un visto bueno: " +
          "necesitan la app empaquetada (pnpm --filter @ego/desktop dist) y/o la VM limpia del owner (DIST-06).",
      );
    }
  } else {
    console.error(`[verify-bundle-runtime] ${fallos.length} comprobación(es) FALLAN:`);
    for (const c of fallos) console.error(`  - ${c.id}: ${c.detalle}`);
  }
}

process.exit(fallos.length ? 1 : 0);
