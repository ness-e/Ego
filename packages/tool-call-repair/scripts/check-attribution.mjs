#!/usr/bin/env node
// scripts/check-attribution.mjs — PUERTA DE ATRIBUCIÓN DEL PLANO 1 (CÓDIGO).
//
// Modelo (docs/extractions/README.md §4.3, dos planos):
//
//   · Plano 1 · CÓDIGO (`packages/**`): un fichero REALMENTE DERIVADO (un port
//     literal de un repo de referencia) lleva cabecera de fichero
//     `Adapted from <upstream> (<LICENCIA>), <ruta de origen>` y aviso de
//     licencia en el `LICENSE.md` de su paquete.
//   · Plano 2 · FICHA (`docs/extractions/*.md`): documento de análisis escrito
//     por Ego. Lleva fila de procedencia. NUNCA la forma del plano 1.
//
// Y el otro plano de la regla, que no se puede violar: un fichero NATIVO
// (código propio de Ego, o asimilación de patrón) NO lleva esa cabecera.
// Inventarla sería una atribución falsa — el precedente EGO-FIND-83 (el owner
// retiró el crédito a khoj porque el código atribuido era propio).
//
// EL DENOMINADOR ES `provenance.manifest.json` (en el propio paquete): declara
// qué ficheros son derivados, de qué upstream, con qué licencia y de qué ruta
// de origen, y qué ficheros son nativos (con el texto veraz del plano 2). La
// puerta NO depende de una edición manual: si el manifiesto no clasifica un
// fichero, la puerta falla.
//
// ## Por qué vive AQUÍ y no en `scripts/`
//
// `packages/avatar` tiene su propia puerta (`packages/avatar/scripts/
// check-attribution.mjs`, de A6) y `scripts/verify-attribution.mjs` (de A7)
// delega en ella. Este fichero es la implementación GENÉRICA para el resto de
// `packages/**`: una sola implementación, delegable, sin copias que se puedan
// desincronizar. Se aloja en `@ego/tool-call-repair` porque es el único
// paquete con código derivado que en esta ola no está en la zona de otro
// agente.
//
// ## Qué comprueba
//
//   1. Que el manifiesto existe, parsea y es coherente.
//   2. Cobertura: todo fichero de código de las raíces declaradas está
//      clasificado (derivado o nativo) en el manifiesto.
//   3. Que cada fichero DERIVADO lleva la cabecera canónica, con upstream,
//      licencia y ruta EXACTAMENTE los del manifiesto.
//   4. Que ningún fichero NATIVO lleva cabecera canónica (atribución falsa).
//   5. Que el `LICENSE.md` recoge el aviso de cada upstream usado y cita cada
//      fichero derivado.
//   6. Que el `NOTICE` existe y nombra cada upstream usado.
//
// ## Modos
//
//   node scripts/check-attribution.mjs [--root <dir>] [--json] [--check]
//
//   --root <dir>  raíz del paquete a comprobar (por defecto, el propio). Es lo
//                 que permite ejercitar la puerta con fixtures.
//   --json        informe machine por stdout.
//   --check       NO muta NADA: informa del PLAN de cabeceras pendientes. Si
//                 el plan no está vacío ⇒ exit 1 (el árbol no es canónico).
//                 Si está vacío ⇒ exit 0 ("0 cambios"). Reproducible: la misma
//                 entrada produce siempre el mismo plan.
//
// La puerta NUNCA escribe en el repositorio: una puerta que puede
// aprobarse a sí misma no es una puerta (EGO-FIND-109).
//
// Salida: 0 = conforme; 1 = hay problemas; 2 = error de uso.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** La forma canónica se busca en las primeras líneas del fichero. */
const HEADER_WINDOW = 15;

/** Extensiones que cuentan como "código" para la cobertura del manifiesto. */
const CODE_EXT = /\.(ts|tsx|js|mjs|cjs)$/;

/** Directorios que nunca se barren (artefactos de build, dependencias). */
const SKIP_DIRS = new Set(["node_modules", "dist", "out", "build", "coverage", ".turbo"]);

/** Cabecera canónica: `// Adapted from <upstream> (<LICENCIA>), <ruta de origen>`. */
const CANONICAL_RE =
  /^\s*(?:\/\/|\/\*\*?)\s*Adapted from\s+([A-Za-z0-9_.-]+)\s+\(([^)]*)\),\s*(\S.*?)\s*$/;

/** Cualquier forma de cabecera (incluso la vieja) en un nativo = atribución falsa. */
const ANY_CANONICAL_RE = /^\s*(?:\/\/|\/\*\*?)\s*Adapted from\b/;

/**
 * Una afirmación de derivación (el regex canónico del repo). Es el mismo
 * detector que usan las puertas por paquete de la Ola 8.
 */
const CLAIMS_DERIVATION =
  /Extra[ií]d[oa] y adaptad[oa]|Adaptad[oa] de|C[oó]digo \*\*derivad|C[oó]digo derivad|Puerto literal|port literal/i;

/** Una NEGACIÓN ("sin atribución de código derivado") no es una afirmación. */
const NEGATION =
  /No hay atribución|sin atribución de c[oó]digo derivado|no hay traducci[oó]n|implementaci[oó]n propia|el c[oó]digo es propio|no es un port/i;

/**
 * ¿El fichero AFIRMA una derivación o menciona un upstream declarado?
 *
 * Se mira la cabecera del fichero (las primeras 60 líneas): ahí es donde vive
 * la atribución. La negación se evalúa en una ventana alrededor de la
 * afirmación (una negación puede estar partida entre dos líneas).
 */
export function isAttributable(text, upstreams) {
  const lines = text.split(/\r?\n/).slice(0, 60);
  const claims = lines
    .map((line, i) => ({ line, i }))
    .filter(({ line }) => CLAIMS_DERIVATION.test(line))
    .filter(({ i }) => {
      const window = lines
        .slice(Math.max(0, i - 2), i + 3)
        .map((l) => l.replace(/^\s*\*\s?/, "").replace(/^\s*\/\*\*?\s*/, ""))
        .join(" ");
      return !NEGATION.test(window);
    });
  if (claims.length > 0) return true;
  const head = lines.join("\n");
  for (const [slug, meta] of Object.entries(upstreams ?? {})) {
    const rx = new RegExp(`\\b${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (rx.test(head)) return true;
    if (meta && typeof meta.human === "string" && head.includes(meta.human)) return true;
  }
  return false;
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function toPosix(p) {
  return p.split(sep).join("/");
}

/** Devuelve { line, index, upstream, license, origin } de la cabecera canónica. */
export function findCanonical(text) {
  const lines = text.split(/\r?\n/);
  const limit = Math.min(HEADER_WINDOW, lines.length);
  for (let i = 0; i < limit; i++) {
    const m = CANONICAL_RE.exec(lines[i]);
    if (m) {
      return {
        line: lines[i],
        index: i,
        upstream: m[1],
        license: m[2],
        origin: m[3],
      };
    }
  }
  return null;
}

/** Construye la línea canónica de un derivado. */
export function canonicalLine(upstream, license, origin) {
  return `// Adapted from ${upstream} (${license}), ${origin}`;
}

/**
 * Índice de inserción: al final del primer párrafo de comentario, de modo que
 * la cabecera canónica no parta una frase a la mitad.
 */
export function insertionIndex(lines) {
  let last = 0;
  if (!lines[0] || !lines[0].trim().startsWith("//")) return 0;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === "//") break;
    if (t.startsWith("//")) last = i;
    else break;
  }
  const idx = last + 1;
  return idx > HEADER_WINDOW ? 1 : idx;
}

/**
 * Ejecuta la puerta contra un paquete.
 * @param {{root: string, check?: boolean}} opts
 * @returns {{ok: boolean, problems: string[], changes: Array<object>, report: object}}
 */
export function runGate({ root, check = false }) {
  const problems = [];
  const changes = [];
  const notes = [];

  const manifestPath = join(root, "provenance.manifest.json");
  let manifest = null;
  if (!existsSync(manifestPath)) {
    problems.push("no existe provenance.manifest.json (el denominador de la puerta)");
    return { ok: false, problems, changes, notes, report: { ok: false, root, problems, changes, notes } };
  }
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (e) {
    problems.push(`provenance.manifest.json no parsea: ${e.message}`);
    return { ok: false, problems, changes, notes, report: { ok: false, root, problems, changes, notes } };
  }

  const upstreams = manifest.upstreams ?? {};
  const derivedList = manifest.derived ?? [];
  const nativeList = manifest.native ?? [];
  const sourceRoots = manifest.sourceRoots ?? ["src"];
  const exclude = new Set(manifest.exclude ?? []);

  // 1) Todo fichero DERIVADO existe y lleva su cabecera canónica exacta.
  const declared = new Map();
  for (const d of derivedList) {
    if (declared.has(d.path)) {
      problems.push(`el manifiesto declara dos veces ${d.path}`);
    }
    declared.set(d.path, "derived");
    const abs = join(root, d.path);
    if (!existsSync(abs)) {
      problems.push(`el manifiesto declara ${d.path}, pero ese fichero no existe`);
      continue;
    }
    const up = upstreams[d.upstream];
    if (!up) {
      problems.push(`${d.path}: upstream desconocido "${d.upstream}" (no está en el manifiesto)`);
      continue;
    }
    const text = readFileSync(abs, "utf8");
    const found = findCanonical(text);
    const expected = canonicalLine(d.upstream, up.license, d.origin);
    if (!found) {
      problems.push(`derivado SIN cabecera canónica: ${d.path} (se espera: ${expected})`);
      changes.push({ path: d.path, action: "insert", line: expected, index: insertionIndex(text.split(/\r?\n/)) });
      continue;
    }
    if (found.upstream !== d.upstream) {
      problems.push(
        `cabecera de ${d.path}: upstream "${found.upstream}" no cuadra con el manifiesto ("${d.upstream}")`,
      );
    }
    if (found.license !== up.license) {
      problems.push(
        `cabecera de ${d.path}: licencia "${found.license}" no cuadra con el manifiesto ("${up.license}")`,
      );
    }
    if (found.origin !== d.origin) {
      problems.push(
        `cabecera de ${d.path}: ruta de origen "${found.origin}" no cuadra con el manifiesto ("${d.origin}")`,
      );
    }
    if (found.line.trim() !== expected.trim()) {
      changes.push({ path: d.path, action: "replace", line: expected, index: found.index });
    }
  }

  // 2) Todo fichero NATIVO existe y NO lleva cabecera canónica.
  for (const n of nativeList) {
    if (declared.has(n.path)) {
      problems.push(`${n.path} está declarado a la vez como derivado y como nativo`);
    }
    declared.set(n.path, "native");
    const abs = join(root, n.path);
    if (!existsSync(abs)) {
      problems.push(`el manifiesto declara ${n.path}, pero ese fichero no existe`);
      continue;
    }
    const text = readFileSync(abs, "utf8");
    if (findCanonical(text)) {
      problems.push(`nativo CON cabecera canónica (atribución falsa): ${n.path}`);
      continue;
    }
    const lines = text.split(/\r?\n/);
    const limit = Math.min(HEADER_WINDOW, lines.length);
    for (let i = 0; i < limit; i++) {
      if (ANY_CANONICAL_RE.test(lines[i])) {
        problems.push(`nativo CON una cabecera "Adapted from" (atribución falsa): ${n.path}:${i + 1}`);
        break;
      }
    }
  }

  // 3) Cobertura. Modo `attributable` (por defecto): todo fichero que AFIRMA
  //    una derivación o que menciona un upstream declarado tiene que estar
  //    clasificado en el manifiesto. Modo `all`: además, todo fichero de
  //    código de las raíces declaradas tiene que estar clasificado.
  //    En ambos modos, un fichero con cabecera canónica que no esté declarado
  //    como derivado es un fallo (atribución sin contrato).
  const coverage = manifest.coverage ?? "attributable";
  const onDisk = [];
  for (const rootName of sourceRoots) {
    const dir = join(root, rootName);
    if (!existsSync(dir)) continue;
    for (const file of walk(dir)) {
      const rel = toPosix(relative(root, file));
      if (!CODE_EXT.test(rel)) continue;
      if (exclude.has(rel)) continue;
      onDisk.push(rel);
    }
  }
  for (const rel of onDisk) {
    if (declared.has(rel)) continue;
    const abs = join(root, rel);
    const text = readFileSync(abs, "utf8");
    const found = findCanonical(text);
    if (found) {
      problems.push(
        `derivado SIN declarar en el manifiesto: ${rel} (cabecera: ${found.upstream} / ${found.license} / ${found.origin})`,
      );
      continue;
    }
    if (coverage === "all") {
      problems.push(`fichero en disco SIN clasificar en el manifiesto: ${rel}`);
      continue;
    }
    if (isAttributable(text, upstreams)) {
      problems.push(`fichero que AFIRMA una derivación SIN clasificar en el manifiesto: ${rel}`);
    }
  }

  // 4) LICENSE.md: aviso de cada upstream usado + cada fichero derivado.
  const usedUpstreams = new Set(derivedList.map((d) => d.upstream));
  const licensePath = join(root, "LICENSE.md");
  if (!existsSync(licensePath)) {
    problems.push("no existe LICENSE.md (un paquete con código derivado lo necesita)");
  } else {
    const text = readFileSync(licensePath, "utf8");
    const lower = text.toLowerCase();
    for (const up of usedUpstreams) {
      const meta = upstreams[up];
      if (!meta) continue;
      if (!lower.includes(String(up).toLowerCase())) {
        problems.push(`LICENSE.md no recoge el aviso del upstream "${up}" (usado por código derivado)`);
      } else if (meta.license && !text.includes(meta.license)) {
        problems.push(`LICENSE.md no menciona la licencia "${meta.license}" del upstream "${up}"`);
      }
    }
    for (const d of derivedList) {
      if (!text.includes(d.path)) {
        problems.push(`LICENSE.md no cita el fichero derivado ${d.path}`);
      }
    }
  }

  // 5) NOTICE: existe y nombra cada upstream usado.
  const noticePath = join(root, "NOTICE");
  if (!existsSync(noticePath)) {
    problems.push("no existe NOTICE (un paquete con código derivado lo necesita)");
  } else {
    const lower = readFileSync(noticePath, "utf8").toLowerCase();
    for (const up of usedUpstreams) {
      if (!lower.includes(String(up).toLowerCase())) {
        problems.push(`NOTICE no nombra el upstream "${up}"`);
      }
    }
  }

  // 6) El origen declarado debe resolver: dentro del clon del upstream (la
  //    forma normal: `paquetes/...` relativo al clon) o dentro del repo.
  const repoRoot = resolve(root, "..", "..");
  for (const d of derivedList) {
    const origin = String(d.origin ?? "");
    if (!origin) {
      problems.push(`${d.path}: el manifiesto no declara la ruta de origen`);
      continue;
    }
    if (origin.startsWith("repos-referencia/")) {
      if (!existsSync(join(repoRoot, origin))) {
        const clone = join(repoRoot, "repos-referencia", d.upstream ?? "");
        if (existsSync(clone)) {
          const inClone = join(clone, origin.replace(/^repos-referencia\/[^/]+\/?/, ""));
          if (!existsSync(inClone)) {
            problems.push(`origen NO resoluble en el clon de referencia: ${origin} (citado por ${d.path})`);
          }
        } else {
          notes.push(`origen en la ruta de referencia no comprobable (clon ausente): ${origin}`);
        }
      }
      continue;
    }
    if (!origin.includes("/")) {
      problems.push(`origen con forma desconocida: ${origin} (citado por ${d.path})`);
      continue;
    }
    // Forma normal: la ruta es relativa al CLON del upstream.
    const clone = join(repoRoot, "repos-referencia", d.upstream ?? "");
    if (!existsSync(clone)) {
      notes.push(`origen no comprobable (clon ausente: ${d.upstream}): ${origin}`);
      continue;
    }
    if (!existsSync(join(clone, origin))) {
      problems.push(`origen NO resoluble dentro del clon "${d.upstream}": ${origin} (citado por ${d.path})`);
    }
  }

  const report = {
    ok: problems.length === 0,
    root,
    manifest: {
      derived: derivedList.length,
      native: nativeList.length,
      upstreams: Object.keys(upstreams).length,
      sourceRoots,
    },
    derived: derivedList.map((d) => d.path),
    native: nativeList.map((n) => n.path),
    upstreams: Object.keys(upstreams),
    problems,
    changes,
    notes,
  };
  return { ok: report.ok, problems, changes, notes, report };
}

/** CLI: ejecuta la puerta e imprime el informe. */
export function runGateCli(argv, { defaultRoot }) {
  const asJson = argv.includes("--json");
  const check = argv.includes("--check");
  const rootIdx = argv.indexOf("--root");
  if (rootIdx >= 0 && !argv[rootIdx + 1]) {
    console.error("--root necesita un directorio");
    process.exit(2);
  }
  const root = rootIdx >= 0 ? resolve(argv[rootIdx + 1]) : resolve(defaultRoot);
  const { ok, problems, changes, notes, report } = runGate({ root, check });

  if (asJson) {
    console.info(JSON.stringify(report, null, 2));
    process.exit(ok ? 0 : 1);
  }
  console.info(
    `atribucion: ${report.manifest.derived} derivados + ${report.manifest.native} nativos, ` +
      `${report.manifest.upstreams} upstream(s), ${changes.length} cambio(s) pendiente(s)`,
  );
  for (const n of notes) console.info(`  nota: ${n}`);
  if (ok) {
    console.info("  CLASIFICACION CONFORME: cada derivado lleva su cabecera canónica y ningún nativo la lleva.");
    process.exit(0);
  }
  console.error(`  ${problems.length} PROBLEMA(S):`);
  for (const p of problems) console.error(`    ${p}`);
  if (check && changes.length) {
    console.error(`  PLAN DE CABECERAS (${changes.length}; no se escribe nada):`);
    for (const c of changes) console.error(`    ${c.action} ${c.path}: ${c.line}`);
  }
  process.exit(1);
}

// Si se ejecuta directamente (no importado), actúa como CLI.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  runGateCli(process.argv.slice(2), { defaultRoot: join(HERE, "..") });
}
