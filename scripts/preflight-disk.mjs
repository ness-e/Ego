#!/usr/bin/env node
// scripts/preflight-disk.mjs — PREFLIGHT DE DISCO para la suite de tests.
//
// POR QUÉ EXISTE (Ola 3, A7 — incidente real):
//   La suite completa falló con `IO error: Disk full` dentro de `@ego/memory`,
//   un test que NO tiene nada que ver con el disco: el motor VantaDB
//   pre-reserva **320 MB por store** al abrirlo (4 segmentos `vstore_L*.vanta`
//   de 64 MB + el journal `0.jnl` de 64 MB) — medido, ver abajo. Con 19
//   paquetes en paralelo y varios stores cada uno, el **peak** de la suite pide
//   ~19 GB simultáneos. Con el disco al 2,5 % libre, el error sale como
//   "Disk full" en un test ajeno, tres minutos dentro, y no dice nada de disco.
//
//   Este preflight convierte ese fallo opaco en un fallo TEMPRANO y ACCIONABLE:
//   mide el espacio libre, lo compara con el presupuesto MEDIDO y, si no
//   hay margen, falla ANTES de arrancar la suite con un mensaje que dice
//   cuánta falta y cómo liberarla.
//
// MEDICIÓN DE LA HUELLA (no es una estimación):
//   Con el binding real (`vantadb/native`), un store vacío ocupa:
//       4 × 67 108 864 B  (vstore_L0..L3.vanta)  = 256 MB
//       1 × 67 108 864 B  (0.jnl)                =  64 MB
//       ────────────────────────────────────────────────────
//                                    TOTAL       = 320 MB  (320,06 MB con el resto)
//
// USO:
//   node scripts/preflight-disk.mjs              → limpia + comprueba (exit 0/1)
//   node scripts/preflight-disk.mjs --json       → informe JSON
//   node scripts/preflight-disk.mjs --clean      → sólo limpia %TEMP%
//   node scripts/preflight-disk.mjs --clean-only → alias de --clean
//   node scripts/preflight-disk.mjs --no-clean   → no limpia (sólo comprueba)
//   node scripts/preflight-disk.mjs --budget-gb N → sobrescribe el presupuesto
//
// Códigos de salida: 0 = hay margen · 1 = falta disco · 2 = error de entorno.
import { readdirSync, statSync, rmSync, statfsSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const JSON_OUT = has("--json");
const CLEAN_ONLY = has("--clean") || has("--clean-only");
const DO_CLEAN = !has("--no-clean");

// ── presupuesto MEDIDO (ver el bloque de arriba) ────────────────────────────
/** Huella de un store de VantaDB vacío, en MB. */
const STORE_FOOTPRINT_MB = 320;
/**
 * Stores de VantaDB abiertos SIMULTÁNEAMENTE en el peak de la suite.
 * MEDIDO el 2026-10-21 (Ola 3) con un muestreador de disco corriendo en
 * paralelo a `pnpm test` (740 muestras cada 2 s durante 1 501 s):
 *   · pico de 10 stores simultáneos;
 *   · caída de espacio libre observada: 22,96 GB → 19,57 GB = **3,39 GB**.
 * (Antes de que A3/A4 arreglaran la fuga —T-X1— el pico era ~19 GB: cada
 *  paquete dejaba su store de 320 MB sin limpiar.)
 */
const MAX_CONCURRENT_STORES = 10;
/**
 * Factor de seguridad sobre el pico de stores: 3× para cubrir (a) máquinas con
 * más CPUs ⇒ más paquetes en paralelo, (b) una fuga que vuelva a aparecer,
 * (c) corridas solapadas.
 */
const SAFETY_FACTOR = 3;
/** Margen fijo para el resto del sistema (npm, Docker, el propio repo). */
const MARGIN_GB = 5;
/** Antigüedad mínima para considerar un resto de %TEMP% "abandonado". */
const STALE_MINUTES = 60;

/**
 * Patrones de restos de test en %TEMP%.
 *
 * Medidos en la Ola 8 (los tres primeros fallaban):
 *   · `.tmpXXXX`   → el temporal de un proceso, CON punto delante: `^tmp` no lo
 *                    cogía (hace falta `^\.?tmp`).
 *   · `vdb517-XXXX`→ un store de VantaDB de los tests: `^vdb-` no lo cogía
 *                    porque aquí no hay guion tras "vdb" (`^vdb`).
 *   · `rep-island-ud-XXXX` → el perfil de usuario de Electron (el floating
 *                    island): no estaba en la lista.
 *   · `pytest-of-XXXX` → restos de pytest (10,9 GB en una limpieza previa).
 */
const LEFTOVER_PATTERNS = [
  /^ego-/,
  /^ego-scratch/,
  /^ego-test-scratch/,
  /^\.?tmp/,
  /^vdb/,
  // Perfiles de usuario de Electron de las corridas del e2e: `rep-island-ud-*`
  // (isla flotante) y `rep<N>-ud-*` (resto de specs). Cada uno es un store de
  // VantaDB de ~320 MB (VDB-REQ-14): sin este patron, ~3,8 GB se acumulan por
  // corrida y el preflight aborta por falta de espacio.
  /^rep-/,
  /^rep\d+-ud-/,
  /^pytest-of-/,
  /^vanta-cog-ckpt/,
  /^a7-/,
];

const GB = 1024 ** 3;

function freeBytes() {
  const root = tmpdir().slice(0, 3);
  try {
    const s = statfsSync(root);
    return s.bavail * s.bsize;
  } catch {
    return 0;
  }
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}

/** Extrae un PID del nombre (run-<pid>-..., vanta-cog-ckpt-<pid>). */
function pidFromName(name) {
  const m = /(\d{3,7})/.exec(name);
  return m ? Number(m[1]) : null;
}

function dirSizeMB(p) {
  let total = 0;
  let entries;
  try {
    entries = readdirSync(p, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    const c = join(p, e.name);
    try {
      if (e.isDirectory()) total += dirSizeMB(c) * 1024 * 1024;
      else total += statSync(c).size;
    } catch {
      /* raced */
    }
  }
  return total / 1024 / 1024;
}

/**
 * Limpia los restos de test de %TEMP%.
 *
 * Criterio de abandono (las TRES condiciones):
 *   1. el nombre casa con un patrón de resto de test;
 *   2. su último write es de hace más de `STALE_MINUTES`;
 *   3. si el nombre lleva PID, ese proceso NO existe.
 *
 * (3) es la salvaguarda: nunca se toca el store de un proceso vivo, aunque
 * lleve más de 1 h sin escribir.
 */
function cleanLeftovers(verbose) {
  const removed = [];
  const kept = [];
  let entries;
  try {
    entries = readdirSync(tmpdir(), { withFileTypes: true });
  } catch {
    return { removed, kept };
  }
  const now = Date.now();
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (!LEFTOVER_PATTERNS.some((p) => p.test(e.name))) continue;
    const full = join(tmpdir(), e.name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    const ageMin = (now - st.mtimeMs) / 60000;
    const pid = pidFromName(e.name);
    if (ageMin < STALE_MINUTES) {
      kept.push({ name: e.name, ageMin: Math.round(ageMin), why: "reciente" });
      continue;
    }
    if (pid && isAlive(pid)) {
      kept.push({ name: e.name, ageMin: Math.round(ageMin), why: `PID ${pid} vivo` });
      continue;
    }
    const sizeMB = dirSizeMB(full);
    try {
      rmSync(full, { recursive: true, force: true, maxRetries: 3 });
      removed.push({ name: e.name, sizeMB: Math.round(sizeMB), ageMin: Math.round(ageMin) });
    } catch (err) {
      kept.push({ name: e.name, ageMin: Math.round(ageMin), why: `no borrable (${err.code})` });
    }
  }
  if (verbose) {
    for (const r of removed)
      console.log(`[preflight-disk]   liberado ${r.sizeMB} MB  ${r.name} (${r.ageMin} min)`);
  }
  return { removed, kept };
}

// ── ejecución ───────────────────────────────────────────────────────────────
// El presupuesto puede sobrescribirse por entorno (CI con runners pequeños o
// pruebas del propio preflight): `EGO_DISK_BUDGET_GB=40` → simula disco lleno.
const budgetGB =
  Number(opt("--budget-gb", "0")) || Number(process.env.EGO_DISK_BUDGET_GB) || null;
const storePeakGB = (MAX_CONCURRENT_STORES * STORE_FOOTPRINT_MB) / 1024;
const baseBudgetGB = budgetGB ?? storePeakGB * SAFETY_FACTOR + MARGIN_GB;

const before = freeBytes();
let cleanup = { removed: [], kept: [] };
if (DO_CLEAN && !JSON_OUT) {
  cleanup = cleanLeftovers(true);
} else if (DO_CLEAN && JSON_OUT) {
  cleanup = cleanLeftovers(false);
}
const after = freeBytes();

const freeGB = after / GB;
const requiredGB = baseBudgetGB;
const missingGB = Math.max(0, requiredGB - freeGB);
const ok = missingGB <= 0;

const report = {
  ok,
  freeGB: Number(freeGB.toFixed(2)),
  freeBeforeGB: Number((before / GB).toFixed(2)),
  freeAfterGB: Number((after / GB).toFixed(2)),
  reclaimedGB: Number(((after - before) / GB).toFixed(2)),
  requiredGB: Number(requiredGB.toFixed(2)),
  missingGB: Number(missingGB.toFixed(2)),
  storeFootprintMB: STORE_FOOTPRINT_MB,
  maxConcurrentStores: MAX_CONCURRENT_STORES,
  safetyFactor: SAFETY_FACTOR,
  marginGB: MARGIN_GB,
  storePeakGB: Number(storePeakGB.toFixed(2)),
  removed: cleanup.removed,
  kept: cleanup.kept,
  tempDir: tmpdir(),
};

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(
    `[preflight-disk] libre ${report.freeGB} GB (antes ${report.freeBeforeGB} GB` +
      (report.reclaimedGB > 0 ? `, recuperados ${report.reclaimedGB} GB` : "") +
      `) · presupuesto ${report.requiredGB} GB`,
  );
  console.log(
    `[preflight-disk] restos: ${cleanup.removed.length} eliminados, ${cleanup.kept.length} conservados` +
      ` (patrones: ${LEFTOVER_PATTERNS.length}, antigüedad > ${STALE_MINUTES} min)`,
  );
}

if (!ok) {
  if (!JSON_OUT) {
    console.error("");
    console.error("[preflight-disk] ══ DISCO INSUFICIENTE PARA LA SUITE DE TESTS ══");
    console.error(`   libre ahora:        ${report.freeGB} GB`);
    console.error(
      `   presupuesto medido: ${report.requiredGB} GB` +
        ` (peak medido: ${report.maxConcurrentStores} stores × ${report.storeFootprintMB} MB = ${report.storePeakGB} GB` +
        `, ×${report.safetyFactor} de seguridad + ${report.marginGB} GB de margen)`,
    );
    console.error(`   FALTAN:             ${report.missingGB} GB`);
    console.error("");
    console.error("   Por qué: cada store de VantaDB abierto reserva");
    console.error(
      `   ${STORE_FOOTPRINT_MB} MB (4 segmentos vstore_L*.vanta de 64 MB + el journal 0.jnl de 64 MB),`,
    );
    console.error("   aunque esté vacío. La suite abre varios a la vez.");
    console.error("");
    console.error("   Cómo liberarlo:");
    console.error(
      "     1) Cierra las corridas de test de otros agentes: cada proceso vivo retiene su store.",
    );
    console.error("     2) Los restos de más de 1 h se limpian solos en el próximo preflight:");
    console.error("          node scripts/preflight-disk.mjs --clean");
    console.error("     3) Libera espacio en la unidad del proyecto (C:\\).");
    console.error("");
    console.error(
      "   Para NO bloquear el gate (sólo diagnóstico): --budget-gb 0",
    );
  }
  process.exit(1);
}

process.exit(0);
