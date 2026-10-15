// scripts/generate-checksums.cjs
// Genera SHASUMS.txt (sha256) de los artefactos de distribución.
//
// Uso:
//   node scripts/generate-checksums.cjs [directorio]
//
// - Directorio por defecto: `dist/` (tarea DIST: "sha256 de dist/*").
//   Si `dist/` no existe pero sí `release/` (output real de
//   apps/desktop/electron-builder.config.cjs → directories.output),
//   usa `release/` automáticamente. También se puede pasar explícito.
// - Salida: `<dir>/SHASUMS.txt` con líneas `<sha256>  <nombre-fichero>`,
//   ordenadas por nombre, una por artefacto.
// - Node puro: solo `node:crypto`, `node:fs`, `node:path`. Sin deps.
//
// Sin firma (DIST-04 BLOQUEO owner): los checksums NO sustituyen la firma;
// solo permiten verificar integridad post-descarga (detección de
// corrupción / truncation), no autenticidad. Ver
// docs/deployment/distribution.md § "Checksums sin firma".
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SHASUMS_NAME = 'SHASUMS.txt';

function resolveTargetDir(cliArg) {
  if (cliArg) return path.resolve(cliArg);
  const cwdDist = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(cwdDist)) return cwdDist;
  const cwdRelease = path.resolve(process.cwd(), 'release');
  if (fs.existsSync(cwdRelease)) return cwdRelease;
  // Por defecto, dist/ aunque no exista (el error lo explica).
  return cwdDist;
}

function listArtifacts(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => name !== SHASUMS_NAME)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function sha256File(absPath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(absPath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function main() {
  const arg = process.argv[2];
  if (arg === '--help' || arg === '-h') {
    console.log(
      'Uso: node scripts/generate-checksums.cjs [directorio]\n' +
        '  Genera <directorio>/SHASUMS.txt (sha256, formato `<hash>  <fichero>`).\n' +
        '  Sin argumento: usa dist/ o release/ (el primero que exista).'
    );
    return;
  }
  const dir = resolveTargetDir(arg);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    console.error(
      `[generate-checksums] FAIL: directorio inexistente: ${dir}\n` +
        `  Pasos: 1) ejecutar el empaquetado (pnpm --filter @ego/desktop dist) 2) reintentar. ` +
        `También se acepta un directorio explícito: node scripts/generate-checksums.cjs <dir>`
    );
    process.exitCode = 1;
    return;
  }
  const artifacts = listArtifacts(dir);
  if (artifacts.length === 0) {
    console.error(`[generate-checksums] FAIL: sin artefactos en ${dir} (nada que firmar con hash).`);
    process.exitCode = 1;
    return;
  }
  const lines = [];
  for (const name of artifacts) {
    const digest = await sha256File(path.join(dir, name));
    lines.push(`${digest}  ${name}`);
    console.log(`[generate-checksums] ${name}: ${digest}`);
  }
  const out = `${lines.join('\n')}\n`;
  fs.writeFileSync(path.join(dir, SHASUMS_NAME), out, 'utf8');
  console.log(`[generate-checksums] ok: ${artifacts.length} artefacto(s) → ${path.join(dir, SHASUMS_NAME)}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`[generate-checksums] FAIL: ${err && err.message ? err.message : err}`);
    process.exitCode = 1;
  });
}

module.exports = { SHASUMS_NAME, resolveTargetDir, listArtifacts, sha256File };
