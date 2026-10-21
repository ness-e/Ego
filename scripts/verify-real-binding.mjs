#!/usr/bin/env node
// scripts/verify-real-binding.mjs — PRUEBA que el binding de VantaDB es el
// REAL, no el stub no-op.
//
// POR QUÉ (EGO-FIND-64, Ola 3): hasta ahora el job `verify` de CI instalaba un
// stub en `../VantaDB/vantadb-node` con `put(){}` / `get(){return null}`: el
// pipeline estaba VERDE sin haber tocado VantaDB ni una vez. Un gate verde que
// no ejercita el producto es peor que no tener gate.
//
// QUÉ COMPRUEBA:
//   1. `vantadb-node` resuelve al PAQUETE PUBLICADO (no a un `file:` local ni
//      a un stub): el paquete resuelto debe traer un binario `.node` real.
//   2. El binario pesa lo que tiene que pesar (> 1 MB): un stub pesa KB.
//   3. La API que usa `vantadb/native` (`VantaDb.connect`) está presente.
//   4. (por defecto) ROUND-TRIP REAL sobre disco: connect → put → get → close.
//      Esto reserva 320 MB de disco (ver scripts/README.md).
//
// USO:
//   node scripts/verify-real-binding.mjs            → round-trip real
//   node scripts/verify-real-binding.mjs --shallow  → sólo forma (sin disco)
//   node scripts/verify-real-binding.mjs --json     → informe JSON
//
// Códigos de salida: 0 = binding real verificado · 1 = no es el real / falla.
import { createRequire } from "node:module";
import {
  existsSync,
  statSync,
  mkdtempSync,
  rmSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const argv = process.argv.slice(2);
const SHALLOW = argv.includes("--shallow");
const JSON_OUT = argv.includes("--json");
const report = { ok: false, shallow: SHALLOW, checks: {} };

function fail(msg) {
  report.error = msg;
  if (JSON_OUT) console.log(JSON.stringify(report, null, 2));
  else console.error(`[verify-real-binding] FALLO: ${msg}`);
  process.exit(1);
}

// ── 1. ¿resuelve? ──────────────────────────────────────────────────────────
// `vantadb-node` es dependencia de `packages/memory` y `apps/desktop`, NO de la
// raíz: se resuelve desde el primer ancla que lo tenga.
const ANCHORS = ["packages/memory/package.json", "apps/desktop/package.json"];
let resolved = null;
let req = null;
const tried = [];
for (const anchor of ANCHORS) {
  const abs = join(process.cwd(), anchor);
  if (!existsSync(abs)) continue;
  const r = createRequire(abs);
  try {
    resolved = r.resolve("vantadb-node");
    req = r;
    break;
  } catch (e) {
    tried.push(`${anchor}: ${e.code ?? e.message}`);
  }
}
report.checks.anchorsTried = tried;
if (!resolved) {
  fail(
    `no se puede resolver 'vantadb-node' desde ningún ancla (${ANCHORS.join(", ")}): ` +
      tried.join(" | "),
  );
}
report.checks.resolved = resolved;
if (!JSON_OUT) console.log(`[verify-real-binding] resuelta: ${resolved}`);

// ── 2. ¿es el paquete publicado (con binario nativo)? ───────────────────────
const pkgDir = join(resolved, "..");
const pkgJson = join(pkgDir, "package.json");
if (!existsSync(pkgJson)) {
  fail(`'vantadb-node' resuelve a ${resolved} pero no hay package.json en ${pkgDir}`);
}
const pkg = JSON.parse(readFileSync(pkgJson, "utf8"));
report.checks.version = pkg.version;
if (!JSON_OUT) console.log(`[verify-real-binding] versión: ${pkg.version}`);

const nodeFiles = readdirSync(pkgDir).filter((f) => f.endsWith(".node"));
report.checks.nativeBinaries = nodeFiles;
if (nodeFiles.length === 0) {
  fail(
    `el paquete resuelto NO tiene binario nativo (0 ficheros .node en ${pkgDir}). ` +
      `Es un stub: el pipeline no está ejercitando VantaDB.`,
  );
}
const biggest = nodeFiles
  .map((f) => ({ f, size: statSync(join(pkgDir, f)).size }))
  .sort((a, b) => b.size - a.size)[0];
report.checks.biggestBinary = biggest;
if (!JSON_OUT) {
  console.log(
    `[verify-real-binding] binario nativo: ${biggest.f} (${(biggest.size / 1024 / 1024).toFixed(2)} MB)`,
  );
}
if (biggest.size < 1024 * 1024) {
  fail(
    `el binario ${biggest.f} pesa ${biggest.size} B (< 1 MB): es un stub, no el binding real`,
  );
}

// ── 3. ¿está la API que usa vantadb/native? ────────────────────────────────
let native;
try {
  native = req("vantadb-node");
} catch (e) {
  fail(`'vantadb-node' no se puede cargar: ${e.message}`);
}
// `VantaDb` es una CLASE (constructor) → typeof "function"; algunos builds
// la exponen como objeto. Se aceptan las dos formas.
const hasVantaDb =
  typeof native.VantaDb === "function" || typeof native.VantaDb === "object";
const hasConnect = typeof native.VantaDb?.connect === "function";
report.checks.hasVantaDb = hasVantaDb;
report.checks.hasConnect = hasConnect;
if (!JSON_OUT) {
  console.log(
    `[verify-real-binding] API: VantaDb=${hasVantaDb} · VantaDb.connect=${hasConnect}`,
  );
}
if (!hasVantaDb || !hasConnect) {
  fail(
    "el paquete no exporta 'VantaDb.connect' (la API que usa vantadb/native): " +
      "el binding real no está disponible",
  );
}

// ── 4. round-trip real (opcional) ───────────────────────────────────────────
if (!SHALLOW) {
  const dir = mkdtempSync(join(tmpdir(), "a7-real-binding-"));
  // OJO: `fail()` hace `process.exit()`, que TERMINA el proceso sin ejecutar
  // el `finally` → el store de 320 MB se quedaría en %TEMP%. Por eso el error
  // se captura, se limpia y sólo después se sale.
  let error = null;
  try {
    const db = await native.VantaDb.connect(dir);
    // API del binding (v0.9.0): put() toma un RECORD (objeto), no 3 args
    // posicionales — igual que hacen los wrappers `vantadb@0.8.0` y `0.9.0`.
    await db.put({
      namespace: "a7/verify",
      key: "k1",
      payload: JSON.stringify({ ok: true }),
    });
    const got = await db.get("a7/verify", "k1");
    const raw = got?.payload ?? got;
    const payload = typeof raw === "string" ? JSON.parse(raw) : raw;
    report.checks.roundtrip = payload;
    if (!payload || payload.ok !== true) {
      error = `el round-trip real devolvió algo inesperado: ${JSON.stringify(got)}`;
    } else {
      await db.close();
      if (!JSON_OUT) {
        console.log(
          "[verify-real-binding] round-trip real OK (connect → put → get → close)",
        );
      }
    }
  } catch (e) {
    error = `el round-trip real falló: ${e.message}`;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  if (error) fail(error);
}

report.ok = true;
if (JSON_OUT) console.log(JSON.stringify(report, null, 2));
else console.log("[verify-real-binding] TODOS LOS CHEQUEOS EN VERDE");
process.exit(0);
