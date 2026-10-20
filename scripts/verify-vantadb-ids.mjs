#!/usr/bin/env node
// scripts/verify-vantadb-ids.mjs — T1 (Ola 1c): gate MECÁNICO de trazabilidad
// de los IDs del registro canónico de VantaDB.
//
// POR QUÉ ESTE GATE (AGENTS.md §4, "Prohibición de Workarounds Silenciosos"):
//   "Si una tarea interactúa con memoria o adaptadores de VantaDB e identifica
//   una fricción o añade un workaround, la tarea NO puede marcarse como
//   COMPLETED ni pasar el Quality Gate sin haber actualizado
//   `docs/VANTADB-FEEDBACK-Y-MEJORAS.md`".
//
//   Ese guardrail estaba escrito pero NADA lo verificaba. Consecuencia real
//   medida: el código citaba `VDB-REQ-08` (= "cifrado en reposo") para hablar
//   de RRF/canal denso, `VDB-REQ-09` (= "publicar el binding") para hablar de
//   IQL, y `VDB-REQ-10` (= no existe) para hablar de la siembra de grafos.
//   El próximo agente que leyera ese comentario creería que el tema es de
//   cifrado. Peor que no referenciarlo.
//
// QUÉ VERIFICA:
//
//   ERRORES (bloquean el gate):
//     E1  Referencia a un ID NO REGISTRADO en el código.
//     E2  `Workaround (upstream): VDB-XXX-NN` con ID no registrado
//         → violación literal de "Prohibición de Workarounds Silenciosos".
//     E3  Registro inconsistente: un ID con fila de índice pero sin sección de
//         detalle, o al revés.
//     E4  Registro: el MISMO ID con descripciones INCOMPATIBLES (índice vs
//         detalle) → el ID se está reutilizando para dos temas.
//     E5  Entrada del registro sin las secciones mínimas.
//
//   AVISOS (visibles, NO bloquean):
//     W1  Referencia en el código sin anclaje temático: el comentario no
//         comparte ningún término significativo con la entrada del registro
//         → posible desalineación semántica.
//     W2  ID registrado de severidad Alta/Crítica que NUNCA se cita en el
//         código → puede ser una petición puramente upstream.
//
//   INFORMATIVO:
//     - IDs de la taxonomía del propio upstream (p.ej. `VDB-FIND-249`): no son
//       IDs de este registro y no se tratan como referencias.
//
// USO:
//   node scripts/verify-vantadb-ids.mjs            → legible, exit 0/1
//   node scripts/verify-vantadb-ids.mjs --json     → JSON por stdout
//   node scripts/verify-vantadb-ids.mjs --strict    → los avisos también bloquean
//
//   node scripts/verify-vantadb-ids.mjs --root <dir>  → audita otro árbol
//                                                    (registro + código). Útil
//                                                    para probar el gate contra
//                                                    un fixture (rojo→verde).
//
// EXIT: 0 = sin errores · 1 = hay errores · 2 = error de uso/IO.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const JSON_OUT = argv.includes("--json");
const STRICT = argv.includes("--strict");
const rootIdx = argv.indexOf("--root");
const ROOT = rootIdx >= 0 && argv[rootIdx + 1] ? argv[rootIdx + 1] : join(SCRIPT_DIR, "..");
const REGISTRY_PATH = join(ROOT, "docs", "VANTADB-FEEDBACK-Y-MEJORAS.md");
const SCAN_DIRS = ["packages", "apps"];
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "out",
  "release",
  "coverage",
  "playwright-report",
  "test-results",
  ".git",
  // Copia vendorizada del motor de avatar: es duplicado byte-idéntico de
  // `packages/avatar` (decisión D5) → contarla duplicaría los hallazgos.
  "vendor",
]);
const CODE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const ID_RE = /VDB-(?:BUG|INC|REQ)-\d+/g;
const ANY_VDB_RE = /VDB-[A-Z]+-\d+/g;
const WORKAROUND_RE = /workaround\s+(?:upstream\s+)?:?\s*`?(VDB-(?:BUG|INC|REQ)-\d+)/i;
const FILE_LINE_RE = /[\w./-]+\.[A-Za-z]+:\d+/;


// ── utilidades de normalización ────────────────────────────────────────────
const STOPWORDS = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al", "en",
  "con", "por", "para", "que", "se", "su", "sus", "sin", "y", "o", "a", "the",
  "of", "to", "in", "is", "are", "vdb", "req", "bug", "inc", "vanta", "vantadb",
  "ego", "workaround", "upstream", "canonico", "migrar", "cuando", "falta",
  "nulo", "null", "este", "esta", "todo", "toda", "todos", "cada", "asi", "como",
  "mas", "este", "puede", "pueden", "hace", "hacer", "usar", "usamos", "llama",
  "llamar", "dentro", "fuera", "solo", "aun", "tras", "sobre", "entre", "hasta",
  "desde", "donde", "nota", "notas", "ver", "docs", "doc", "archivo", "linea",
  "case", "caso", "casos", "nunca", "siempre", "tampoco", "mismo", "misma",
  "mismas", "mismos", "ademas", "aqui", "ahi", "asi", "sino", "tras",
]);

/** Normaliza texto a un conjunto de términos significativos. */
function significantWords(text) {
  return new Set(
    String(text ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w)),
  );
}

// ── 1. Parseo del registro ────────────────────────────────────────────────
if (!existsSync(REGISTRY_PATH)) {
  console.error(`[verify-vantadb-ids] no existe el registro: ${relative(ROOT, REGISTRY_PATH)}`);
  process.exit(2);
}
const registryText = readFileSync(REGISTRY_PATH, "utf8");
const registryLines = registryText.split(/\r?\n/);

/** @type {Map<string, {id:string,index:object|null,detail:object|null,line:number}>} */
const entries = new Map();
function entryFor(id) {
  if (!entries.has(id)) {
    entries.set(id, { id, index: null, detail: null, line: 0 });
  }
  return entries.get(id);
}

// Índice: | `VDB-XXX-NN` | Tipo | Severidad | Componente | Descripción |
registryLines.forEach((line, i) => {
  const m = /^\|\s*`(VDB-(?:BUG|INC|REQ)-\d+)`\s*\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|/.exec(line);
  if (!m) return;
  const e = entryFor(m[1]);
  e.index = {
    tipo: m[2].trim(),
    severidad: m[3].trim(),
    componente: m[4].trim(),
    descripcion: m[5].trim(),
  };
  e.line = i + 1;
});

// Detalle: ### `VDB-XXX-NN`: Título  +  bullets * **Campo:** valor
const detailRe = /^###\s*`(VDB-(?:BUG|INC|REQ)-\d+)`:\s*(.*)$/;
// El formato real es `* **Componente:** valor` → el dos-puntos va DENTRO del
// negrita (`**Componente:**`), no fuera.
const bulletRe = /^\*\s+\*\*([^*]+?)\*\*\s*:?\s*(.*)$/;
for (let i = 0; i < registryLines.length; i += 1) {
  const m = detailRe.exec(registryLines[i]);
  if (!m) continue;
  const e = entryFor(m[1]);
  e.detail = { titulo: m[2].trim(), campos: {}, line: i + 1 };
  for (let j = i + 1; j < registryLines.length; j += 1) {
    if (detailRe.test(registryLines[j]) || /^##\s/.test(registryLines[j])) break;
    const b = bulletRe.exec(registryLines[j]);
    if (b) e.detail.campos[b[1].trim().replace(/:$/, "")] = b[2].trim();
  }
}

// ── 2. Recorrido del código ───────────────────────────────────────────────
function walk(dir, out) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(join(dir, entry.name), out);
    } else if (entry.isFile() && CODE_EXT.has(extname(entry.name))) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

const codeFiles = [];
for (const d of SCAN_DIRS) walk(join(ROOT, d), codeFiles);
codeFiles.sort();

/** Referencia a un ID encontrada en el código. */
const references = [];
const upstreamIds = new Map();
for (const abs of codeFiles) {
  const rel = relative(ROOT, abs).replace(/\\/g, "/");
  const lines = readFileSync(abs, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    const ids = line.match(ID_RE);
    if (!ids) return;
    // Contexto: hasta 10 líneas anteriores (bloque de comentario) + la línea.
    const ctx = [];
    for (let j = Math.max(0, i - 10); j <= i; j += 1) ctx.push(lines[j]);
    const ctxText = ctx.join("\n");
    for (const id of new Set(ids)) {
      references.push({
        id,
        file: rel,
        line: i + 1,
        text: line.trim(),
        context: ctxText,
        isWorkaround: WORKAROUND_RE.test(line) || /workaround\s+(?:upstream\s+)?/i.test(ctxText),
      });
    }
    // IDs de la taxonomía del upstream (no son IDs de este registro).
    for (const m of line.matchAll(ANY_VDB_RE)) {
      if (!ID_RE.test(m[0])) {
        if (!upstreamIds.has(m[0])) upstreamIds.set(m[0], []);
        upstreamIds.get(m[0]).push(`${rel}:${i + 1}`);
      }
    }
  });
}

// ── 3. Chequeos ───────────────────────────────────────────────────────────
const errors = [];
const warnings = [];
const info = [];
const citedIds = new Set();

for (const ref of references) {
  const e = entries.get(ref.id);
  if (!e || !e.index) {
    errors.push({
      code: ref.isWorkaround ? "E2" : "E1",
      file: ref.file,
      line: ref.line,
      id: ref.id,
      message: ref.isWorkaround
        ? `Workaround sin ID registrado: "${ref.id}" no existe en el registro canónico ` +
          `(AGENTS.md §4: prohibición de workarounds silenciosos)`
        : `Referencia a un ID no registrado: "${ref.id}" no existe en el registro canónico`,
      text: ref.text,
    });
    continue;
  }
  citedIds.add(ref.id);

  // W1: anclaje temático.
  const signature = new Set([
    ...significantWords(`${e.index.descripcion} ${e.index.componente}`),
    ...significantWords(e.detail ? e.detail.titulo : ""),
  ]);
  const ctxWords = significantWords(ref.context);
  const overlap = [...signature].filter((w) => ctxWords.has(w));
  if (signature.size > 0 && overlap.length === 0) {
    warnings.push({
      code: "W1",
      file: ref.file,
      line: ref.line,
      id: ref.id,
      message:
        `Posible desalineación semántica: el comentario no comparte ningún término ` +
        `significativo con la entrada del registro ("${e.index.descripcion.slice(0, 80)}")`,
      text: ref.text,
    });
  }
}

// E3: coherencia índice ↔ detalle.
for (const e of entries.values()) {
  if (e.index && !e.detail) {
    errors.push({
      code: "E3",
      file: relative(ROOT, REGISTRY_PATH).replace(/\\/g, "/"),
      line: e.line,
      id: e.id,
      message: "El registro tiene fila de índice pero NO tiene sección de detalle",
    });
  } else if (!e.index && e.detail) {
    errors.push({
      code: "E3",
      file: relative(ROOT, REGISTRY_PATH).replace(/\\/g, "/"),
      line: e.detail.line,
      id: e.id,
      message: "El registro tiene sección de detalle pero NO tiene fila en el índice",
    });
  }
}

// E4: el mismo ID con descripciones incompatibles.
for (const e of entries.values()) {
  if (!e.index || !e.detail) continue;
  const a = significantWords(e.index.descripcion);
  const b = significantWords(e.detail.titulo);
  const shared = [...a].filter((w) => b.has(w));
  // Un título de detalle que no comparte NADA con la descripción del índice
  // (y ambos tienen contenido) → el ID se está usando para dos temas.
  if (a.size > 0 && b.size > 0 && shared.length === 0) {
    errors.push({
      code: "E4",
      file: relative(ROOT, REGISTRY_PATH).replace(/\\/g, "/"),
      line: e.detail.line,
      id: e.id,
      message:
        `Descripciones incompatibles para el mismo ID: índice="${e.index.descripcion.slice(0, 70)}" ` +
        `· detalle="${e.detail.titulo.slice(0, 70)}"`,
    });
  }
}

// E5: secciones mínimas por entrada.
//
// NOTA DE CALIBRACIÓN (Ola 1c): la forma histórica del registro NO tiene
// "Impacto en Ego" en las entradas BUG (tienen "Workaround en Ego") ni
// "Estado" en ninguna. Por eso E5 es un AVISO (W5), no un error: el bloqueo
// del gate se concentra en el problema real — la trazabilidad de las
// REFERENCIAS (E1/E2) y la integridad del registro (E3/E4). A1 puede
// promover W5 a error cuando normalice la forma de las 19 entradas.
const REQUIRED_FIELDS = [
  { keys: ["Componente"], label: "Componente" },
  { keys: ["Síntoma", "Petición", "Situación Actual"], label: "Síntoma/Petición/Situación Actual" },
  { keys: ["Impacto en Ego"], label: "Impacto en Ego" },
  { keys: ["Solución recomendada en VantaDB"], label: "Solución recomendada en VantaDB" },
];
const missingEstado = [];
for (const e of entries.values()) {
  if (!e.detail) continue;
  for (const req of REQUIRED_FIELDS) {
    const present = req.keys.some((k) => e.detail.campos[k] !== undefined);
    if (!present) {
      warnings.push({
        code: "W5",
        file: relative(ROOT, REGISTRY_PATH).replace(/\\/g, "/"),
        line: e.detail.line,
        id: e.id,
        message: `La entrada del registro no tiene la sección mínima "${req.label}"`,
      });
    }
  }
  // Evidencia con `archivo:línea` en el componente.
  const comp = `${e.detail.campos["Componente"] ?? e.index?.componente ?? ""}`;
  if (!FILE_LINE_RE.test(comp)) {
    warnings.push({
      code: "W3",
      file: relative(ROOT, REGISTRY_PATH).replace(/\\/g, "/"),
      line: e.detail.line,
      id: e.id,
      message: `La evidencia ("${comp.slice(0, 70)}") no incluye archivo:línea`,
    });
  }
  if (e.detail.campos["Estado"] === undefined) missingEstado.push(e.id);
}
if (missingEstado.length > 0) {
  warnings.push({
    code: "W4",
    file: relative(ROOT, REGISTRY_PATH).replace(/\\/g, "/"),
    line: 0,
    id: "-",
    message:
      `${missingEstado.length} entrada(s) del registro no declaran un estado explícito ` +
      `(campo **Estado:**): ${missingEstado.join(", ")}`,
  });
}

// W2: IDs Alta/Crítica nunca citados en el código.
const HIGH_SEVERITY = /alta|alta|cr[ií]tica|critical|bloqueante/i;
for (const e of entries.values()) {
  if (!e.index) continue;
  if (citedIds.has(e.id)) continue;
  if (!HIGH_SEVERITY.test(e.index.severidad)) continue;
  warnings.push({
    code: "W2",
    file: relative(ROOT, REGISTRY_PATH).replace(/\\/g, "/"),
    line: e.line,
    id: e.id,
    message:
      `ID de severidad "${e.index.severidad.trim()}" nunca citado en el código: ` +
      `puede ser una petición puramente upstream (no bloquea)`,
  });
}

for (const [id, refs] of upstreamIds) {
  info.push({
    code: "I1",
    id,
    message: `ID de la taxonomía del upstream (no es un ID de este registro): ${refs.length} cita(s)`,
    refs: refs.slice(0, 5),
  });
}

// ── 4. Informe ────────────────────────────────────────────────────────────
const byCode = (list) => {
  const out = {};
  for (const item of list) out[item.code] = (out[item.code] ?? 0) + 1;
  return out;
};

const report = {
  generatedAt: new Date().toISOString(),
  registry: relative(ROOT, REGISTRY_PATH).replace(/\\/g, "/"),
  filesScanned: codeFiles.length,
  references: references.length,
  registeredIds: entries.size,
  errors: byCode(errors),
  warnings: byCode(warnings),
  details: { errors, warnings, info },
};

if (JSON_OUT) {
  // CON `--json` la salida de stdout es **EXCLUSIVAMENTE** el JSON: cualquier
  // línea extra (resumen, anotaciones) rompe el parseo con `jq` /
  // `ConvertFrom-Json` / `JSON.parse`. El resumen legible y las anotaciones de
  // CI van a **stderr**.
  console.log(JSON.stringify(report, null, 2));
  const detail = (line) => console.error(line);
  detail(
    `[verify-vantadb-ids] ${errors.length} error(es) · ${warnings.length} aviso(s) · ${info.length} informativo(s)`,
  );
  for (const item of errors) {
    detail(`  ERROR   ${item.code} ${item.file}:${item.line} ${item.id} — ${item.message}`);
  }
  for (const item of warnings) {
    detail(`  AVISO   ${item.code} ${item.file}:${item.line} ${item.id} — ${item.message}`);
  }
  if (errors.length > 0) {
    detail(
      "[verify-vantadb-ids] gate FALLIDO: hay referencias a IDs de VantaDB que no cuadran " +
        "con el registro canónico (AGENTS.md §4).",
    );
  } else {
    detail("[verify-vantadb-ids] gate OK: todas las referencias a IDs de VantaDB cuadran.");
  }
  if (errors.length > 0) process.exit(1);
  if (STRICT && warnings.length > 0) process.exit(1);
  process.exit(0);
}

// ── 4. Informe legible (sin `--json`) ──────────────────────────────────────
{
  console.log(
    `[verify-vantadb-ids] registro: ${report.registry} · ${report.registeredIds} IDs registrados`,
  );
  console.log(
    `[verify-vantadb-ids] código: ${report.filesScanned} ficheros · ${report.references} referencias a IDs`,
  );
  // En CI, además del informe legible, se emiten anotaciones de GitHub
  // (::warning::) para que cada problema aparezca en la pestaña "Annotations"
  // del run, con su fichero:línea.
  const inCi = process.env.GITHUB_ACTIONS === "true";
  for (const item of errors) {
    console.error(`  ERROR   ${item.code} ${item.file}:${item.line} ${item.id} — ${item.message}`);
    if (item.text) console.error(`         └─ ${item.text.slice(0, 140)}`);
    if (inCi) {
      console.log(
        `::warning file=${item.file},line=${item.line},title=[${item.code}] ${item.id} no registrado::${item.message}`,
      );
    }
  }
  for (const item of warnings) {
    console.warn(`  AVISO   ${item.code} ${item.file}:${item.line} ${item.id} — ${item.message}`);
    if (item.text) console.warn(`         └─ ${item.text.slice(0, 140)}`);
    if (inCi) {
      console.log(
        `::warning file=${item.file},line=${item.line},title=[${item.code}] ${item.id}::${item.message}`,
      );
    }
  }
  for (const item of info) {
    console.log(`  INFO    ${item.code} ${item.id} — ${item.message}`);
    for (const ref of item.refs ?? []) console.log(`         └─ ${ref}`);
  }
  console.log(
    `[verify-vantadb-ids] ${errors.length} error(es) · ${warnings.length} aviso(s) · ${info.length} informativo(s)`,
  );
}

if (errors.length > 0) {
  console.error(
    "[verify-vantadb-ids] gate FALLIDO: hay referencias a IDs de VantaDB que no cuadran " +
      "con el registro canónico (AGENTS.md §4).",
  );
  process.exit(1);
}
if (STRICT && warnings.length > 0) {
  console.error("[verify-vantadb-ids] gate FALLIDO (--strict): hay avisos sin resolver.");
  process.exit(1);
}
console.log("[verify-vantadb-ids] gate OK: todas las referencias a IDs de VantaDB cuadran.");
process.exit(0);
