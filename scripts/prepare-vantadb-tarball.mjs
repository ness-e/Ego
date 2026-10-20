#!/usr/bin/env node
// scripts/prepare-vantadb-tarball.mjs — T7 (EGO-FIND-64): prepara el tarball
// VENDORIZADO de `vantadb-node` para eliminar la dependencia `file:` que
// apunta FUERA del repo.
//
// PROBLEMA:
//   `apps/desktop/package.json:35` y `packages/memory/package.json:27` declaran
//     "vantadb-node": "file:../../../VantaDB/vantadb-node"
//   → la instalación depende de un checkout HERMANO que no está en el repo.
//   → `pnpm install --frozen-lockfile` NO es reproducible para quien clonea.
//   → CI compila un STUB no-op (`put(){}`/`get(){return null}`) → el pipeline
//     "verde" nunca ejercita el binding real.
//
// QUÉ HACE ESTE SCRIPT:
//   1. Empaqueta el `vantadb-node` de un checkout local en un `.tgz` con la
//      layout que npm/pnpm espera (`package/` en la raíz del tarball).
//   2. Calcula el `integrity` sha512 que pnpm escribirá en el lockfile.
//   3. Imprime el DIFF exacto a aplicar en los `package.json` de A2 y A4 y el
//      parche del lockfile.
//
// USO:
//   node scripts/prepare-vantadb-tarball.mjs \
//     --source "C:/Users/Eros/VantaDB Proyect/VantaDB/vantadb-node" \
//     --out "C:/Users/Eros/VantaDB Proyect/VantaDB/vantadb-node-0.8.0.tgz"
//
// La escritura del `.tgz` DENTRO del repo (`vendor/`) requiere una zona que
// A7 no tiene → el handoff deja el destino y el hash; el orquestador (o el
// owner) lo commitea.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, mkdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const SOURCE = opt(
  "--source",
  join(dirname(ROOT), "VantaDB", "vantadb-node"),
);
const OUT = opt(
  "--out",
  join(dirname(ROOT), "VantaDB", "vantadb-node-0.8.0.tgz"),
);
const REPO_DEST = opt("--repo-dest", "vendor/vantadb-node");

if (!existsSync(SOURCE)) {
  console.error(`[prepare-vantadb-tarball] no existe el checkout: ${SOURCE}`);
  console.error(
    "[prepare-vantadb-tarball] espera un checkout hermano con `vantadb-node/package.json`",
  );
  process.exit(2);
}

const pkg = JSON.parse(readFileSync(join(SOURCE, "package.json"), "utf8"));
const version = pkg.version ?? "0.0.0";
console.log(`[prepare-vantadb-tarball] fuente: ${SOURCE} (${pkg.name}@${version})`);

// ── 1. Empaquetado ─────────────────────────────────────────────────────────
// `npm pack` produce el layout que npm/pnpm espera ("package/" en la raíz).
// `--ignore-scripts` evita ejecutar el build de napi durante el empaquetado.
// Se empaqueta en el DIRECTORIO FUENTE (npm escribe ahí) y luego se mueve:
// pasar `--pack-destination` con rutas con espacios se rompe en Windows.
mkdirSync(dirname(OUT), { recursive: true });
try {
  execFileSync("npm", ["pack", "--ignore-scripts"], {
    cwd: SOURCE,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
} catch (err) {
  console.error(`[prepare-vantadb-tarball] npm pack falló: ${err.message}`);
  console.error(String(err.stderr ?? "").slice(0, 2000));
  process.exit(1);
}

const packedName = `${pkg.name.replace(/^@/, "").replace("/", "-")}-${version}.tgz`;
const produced = join(SOURCE, packedName);
const tarball = existsSync(produced) ? produced : OUT;
if (!existsSync(tarball)) {
  console.error(`[prepare-vantadb-tarball] no se encontró el tarball en ${SOURCE}`);
  process.exit(1);
}
if (tarball !== OUT) {
  try {
    execFileSync("cmd", ["/c", "move", "/y", `"${tarball}"`, `"${OUT}"`], {
      encoding: "utf8",
      stdio: "ignore",
    });
  } catch {
    // Si el move falla (permisos), se usa el tarball donde está.
  }
}
const finalTarball = existsSync(OUT) ? OUT : tarball;

// ── 2. Integrity sha512 (formato de pnpm en el lockfile) ──────────────────
const bytes = readFileSync(finalTarball);
const sha512 = createHash("sha512").update(bytes).digest("base64");
const integrity = `sha512-${sha512}`;

console.log(`[prepare-vantadb-tarball] tarball: ${finalTarball}`);
console.log(`[prepare-vantadb-tarball] tamaño: ${statSync(finalTarball).size} bytes`);
console.log(`[prepare-vantadb-tarball] integrity: ${integrity}`);

// ── 3. Diff a aplicar ──────────────────────────────────────────────────────
const relDest = `${REPO_DEST}/${basename(tarball)}`;
console.log(`
[prepare-vantadb-tarball] ── DIFF A APLICAR ──────────────────────────────────

  a) Commitear el tarball dentro del repo (zona raíz — NO es de A7):
       cp "${finalTarball}" "${join(ROOT, relDest)}"

  b) packages/memory/package.json  (A2)   — reemplazar:
       "vantadb-node": "file:../../../VantaDB/vantadb-node"
     por:
       "vantadb-node": "file:../../${relDest}"

  c) apps/desktop/package.json     (A4)   — reemplazar:
       "vantadb-node": "file:../../../VantaDB/vantadb-node"
     por:
       "vantadb-node": "file:../../${relDest}"

  d) pnpm-lock.yaml (A7, lo aplica el orquestador con \`pnpm install\`):
       los importers de \`packages/memory\` y \`apps/desktop\` pasan de
         vantadb-node:
           specifier: file:../../../VantaDB/vantadb-node
           version: file:../VantaDB/vantadb-node
       a
         vantadb-node:
           specifier: file:../../${relDest}
           version: ${integrity}

  e) Con el tarball vendorizado, los 3 workflows que hacen checkout de
     ness-e/Vantadb (integration-real-db, nightly, smoke-native) dejan de
     necesitar el checkout hermano para INSTALAR; sólo lo necesitan para
     COMPILAR el binding por plataforma (linux/macos). Ver handoff A7 §2.3.

[prepare-vantadb-tarball] ───────────────────────────────────────────────────`);
