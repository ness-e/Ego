#!/usr/bin/env node
/**
 * Reconstruye los bloques del catálogo de extracción en los tres índices
 * canónicos a partir de una ÚNICA fuente de verdad (la tabla `CATALOG` de este
 * fichero), sustituyendo los bloques COMPLETOS por marcadores — nunca por
 * cirugía línea a línea, que es lo que corrompió los índices en un intento
 * anterior.
 *
 * Bloques reconstruidos:
 *   docs/extractions/README.md  §3 (tabla de repos) y §4.1 (tabla maestra)
 *   docs/review/README.md       lista de backlogs + total
 *   docs/roadmap/Backlog.md     lista de backlogs + recuento agregado
 *
 * Los recuentos deben coincidir con `node scripts/audit-extraction-gates.mjs`.
 *
 * Uso: node scripts/sync-extraction-indexes.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const EXTRACT = join(ROOT, "docs", "extractions", "README.md");
const REVIEW = join(ROOT, "docs", "review", "README.md");
const BACKLOG = join(ROOT, "docs", "roadmap", "Backlog.md");

/**
 * slug | prefijo | stack | foco | tareas | ✅ | 🚫 | 🆕 | ⏳ | nota
 * `backlog` es el nombre del fichero de backlog cuando difiere del slug.
 */
const CATALOG = [
  ["hermes-agent", "HERM", "Electron 40 + React 19 + assistant-ui + Python backend", "gemelo de stack: UI Chat/Composer, artifacts, layout de ventanas, hardening Windows, packaging", 30, 14, 3, 6, 7, "7.5", "hermes"],
  ["openclaw", "OCLW", "Node.js + WebSocket + SQLite Kysely", "admisión inmutable de runs, auto-reparación de tools, locks de sesión, workers", 24, 7, 5, 11, 1, "6.0"],
  ["coucou", "COUC", "Swift/macOS + Tauri 2/Rust/TS", "normalización en el borde, atención, HITL con ACK, ChangeSet, SafeConfigMutation", 29, 10, 6, 12, 1, "6.5"],
  ["khoj", "KHOJ", "Python FastAPI + Next.js + SQLite/pgvector", "chunking de 256 tokens con solapamiento y hash, filtrado de umbral, extracción de hechos", 13, 3, 1, 2, 7, "7.0"],
  ["helmor", "HELM", "Tauri 2 (Rust) + React 19 + PTY", "terminal output scheduler (coalescencia 16 KB/tick, ring-buffer 2 MB), puente de UI", 10, 4, 0, 6, 0, "7.5"],
  ["career-ops", "CARP", "Node.js ESM (`.mjs`) + Filesystem", "DATA_CONTRACT.md (User vs System), locks atómicos de filesystem, cuarentena", 8, 2, 3, 2, 1, "6.0"],
  ["deepseek-harness", "DSEK", "Monorepo TypeScript (pnpm) + Electron/Node", "sesiones versionadas, IDs opacos, patrón supersede sin borrado, migraciones aditivas", 12, 0, 0, 8, 4, "6.5"],
  ["opencode", "OCDE", "TypeScript (monorepo turbo/bun)", "motor de sesión/agente: permisos persistidos, compactación negociada, code mode, inbox de prompts", 9, 0, 1, 7, 1, "—"],
  ["codex", "CDX", "Rust (CLI)", "política de tool de tres estados, caché de aprobación por clave, perfil de permisos con degradación, parcheo con anclaje contextual", 9, 0, 1, 8, 0, "—"],
  ["goose", "GOOS", "Rust (extensible)", "cadena componible de inspectores de tool-call, inspector de egreso de red, lease del catálogo de tools", 9, 0, 1, 7, 1, "—"],
  ["cline", "CLNE", "TypeScript (SDK + extensión VS Code)", "snapshots de working tree restaurables, guardas de bucle, caché de resultados de tool, tool MCP determinista", 9, 0, 2, 6, 1, "—"],
  ["gemini-cli", "GCLI", "TypeScript (CLI, React Ink)", "motor de reglas priorizadas con identidad MCP/subagente, confianza de workspace, protección de `.env*`", 9, 2, 1, 5, 1, "—"],
  ["qwen-code", "QWEN", "TypeScript (CLI multi-agente)", "subagentes multi-agente, riesgo de tool MCP no derivado del nombre, piso de superficie de tools por rol", 9, 0, 2, 6, 1, "—"],
  ["openhands", "OHND", "Electron + React 19 + Vite (agent-canvas)", "gemelo de stack desktop: bridge IPC tipado, log de arranque en splash, router declarativo, sello de perfil", 12, 0, 2, 9, 1, "—"],
  ["vibe-kanban", "VIBE", "Rust (workspace de 30 crates)", "worktree idempotente con lock, merge/rebase con guardas, ciclo de vida del proceso de agente", 8, 0, 1, 6, 1, "—"],
  ["mini-swe-agent", "MSWE", "Python (~100 líneas)", "taxonomía de salida terminal, observación con `elided_chars`, gate de verificación por `git diff`", 9, 0, 1, 7, 1, "—"],
  ["swe-agent", "SWAG", "Python (ACI)", "diseño ACI, contrato observación→prompt, presupuestos de coste independientes", 9, 0, 2, 7, 0, "—"],
  ["crush", "CRSH", "Go (TUI + LSP)", "LSP como fuente de contexto, diagnósticos embebidos, pre-aprobación con `halt`", 9, 0, 1, 8, 0, "—"],
  ["continue", "CONT", "TypeScript (IDE)", "registro de context providers, capacidades declaradas en config, roles y rectificación de selección", 9, 0, 2, 7, 0, "—"],
  ["claude-squad", "CSQD", "Go (AGPL-3.0)", "rehidratación degradada a reanudable, diff a dos niveles de coste, digest de salida de terminal", 9, 1, 3, 4, 1, "—"],
  ["ag-ui", "AGUI", "TypeScript (protocolo)", "validación semántica A2UI, deltas RFC 6902, verificador de invariantes de stream", 8, 0, 4, 3, 1, "—"],
  ["graphiti", "GRPH", "Python (KG temporal)", "bitemporalidad de dos ejes, detección de contradicciones, cascada de resolución de entidades", 9, 0, 4, 4, 1, "—"],
  ["graphrag", "GRAG", "Python (Microsoft)", "priorización in/out-network con presupuesto de grafo, pipeline declarativo, caché de respuestas LLM", 9, 0, 1, 7, 1, "—"],
  ["mem0", "MEM0", "Python + TS SDK", "extracción de memoria desde el turno de chat, anti-alucinación de ids, arbitraje ADD/UPDATE/DELETE", 9, 2, 2, 5, 0, "—"],
  ["mcp-servers", "MCPS", "TypeScript + Python (oficial)", "roots declarado y no implementado, anotaciones de riesgo MCP, descubrimiento documentado y ausente", 9, 2, 2, 4, 1, "—"],
];

const MAX = 120;
const T = CATALOG.reduce(
  (a, r) => ({ n: a.n + r[4], ok: a.ok + r[5], dis: a.dis + r[6], pen: a.pen + r[7], fut: a.fut + r[8] }),
  { n: 0, ok: 0, dis: 0, pen: 0, fut: 0 },
);
const backlogName = (r) => r[10] ?? r[0];
const range = (r) => `${r[1]}-01..${r[1]}-${String(r[4]).padStart(2, "0")}`;

/** Trocea en palabras respetando spans de código y enlaces (sin espacios sobrantes). */
function words(line) {
  const out = [];
  let buf = "";
  let inCode = false;
  let depth = 0;
  for (const ch of line) {
    if (ch === "`") inCode = !inCode;
    if (!inCode && ch === "[") depth++;
    if (!inCode && ch === "]") depth = Math.max(0, depth - 1);
    if (ch === " " && !inCode && depth === 0) {
      if (buf) out.push(buf);
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf) out.push(buf);
  return out;
}

/** Envuelve un texto en líneas de ≤ MAX caracteres con el prefijo indicado. */
function wrap(text, prefix, firstPrefix) {
  const ws = words(text);
  const lines = [];
  let cur = firstPrefix ?? prefix;
  let first = true;
  for (const w of ws) {
    const cand = first ? cur + w : cur + " " + w;
    if (cand.length > MAX && !first) {
      lines.push(cur);
      cur = prefix + w;
    } else {
      cur = cand;
    }
    first = false;
  }
  lines.push(cur);
  return lines;
}

/** Sustituye un bloque delimitado por dos expresiones regulares. */
function replaceBlock(text, startRe, endRe, build) {
  const s = text.search(startRe);
  if (s < 0) throw new Error(`no se encontró el inicio del bloque: ${startRe}`);
  const rest = text.slice(s);
  const e = rest.slice(1).search(endRe);
  if (e < 0) throw new Error(`no se encontró el fin del bloque: ${endRe}`);
  return text.slice(0, s) + build() + text.slice(s + e + 1);
}

// ── docs/extractions/README.md ────────────────────────────────────────────────
{
  let t = readFileSync(EXTRACT, "utf8");

  // §3 + §3.1: tabla de repos (heredados) y tabla de la Ola 2.
  // Se reconstruye TODO el tramo desde la cabecera §3 hasta el H2 §4 para que
  // el resultado no dependa de cuántas líneas en blanco haya entre bloques.
  t = replaceBlock(
    t,
    /^\| Repositorio \| Naturaleza \/ Stack \|/m,
    /^## 4\. /m,
    () => {
      const row = (r) =>
        `| **${r[0]}** | ${r[2]} | [\`${r[0]}.md\`](${r[0]}.md) / [\`backlog-${backlogName(r)}.md\`](../review/backlog-${backlogName(r)}.md) | \`${range(r)}\` | ${r[4]} | ${r[3]} |`;
      const legacy = CATALOG.slice(0, 7);
      const ola2 = CATALOG.slice(7);
      return [
        "| Repositorio | Naturaleza / Stack | Archivo de Extracción / Backlog | Rango de IDs | Tareas | Foco Principal en Ego |",
        "|---|---|---|---|:---:|---|",
        ...legacy.map(row),
        "",
        "### 3.1 Ola 2 — Catálogo de agentes de código y de conocimiento (2026-10-20) ###",
        "",
        "Repositorios clonados el 2026-10-20 en profundidad 1 (`--depth 1 --single-branch`).",
        "**Todos son repositorios nuevos: ninguno tiene hallazgos en estado `✅ Completada`",
        "por asilación propia** (el `0 ✅` de cada repo nuevo es correcto y está",
        "documentado en su §0 de backlog). La verificación de caller se hizo por grep",
        "sobre `packages/` + `apps/desktop/` excluyendo `test/`, `dist/` y `node_modules/`.",
        "",
        "| Repositorio | Naturaleza / Stack | Archivo de Extracción / Backlog | Rango de IDs | Tareas | Foco Principal en Ego |",
        "|---|---|---|---|:---:|---|",
        ...ola2.map(row),
        "",
        "---",
        "",
        "",
      ].join("\n");
    },
  );
  // §4.1: tabla maestra
  t = replaceBlock(
    t,
    /^\| Repo \| Declarados \|/m,
    /^$/m,
    () => {
      const rows = CATALOG.map(
        (r) => `| ${r[0]} | ${r[4]} | ${r[5]} | ${r[6]} | ${r[7]} | ${r[8]} | ${r[9]} |`,
      );
      return [
        "| Repo | Declarados | ✅ Asimilado + integrado | 🚫 Descartado | 🆕 Pendiente | ⏳ Futura | Nota |",
        "|---|:---:|:---:|:---:|:---:|:---:|:---:|",
        ...rows,
        `| **TOTAL** | **${T.n}** | **${T.ok}** | **${T.dis}** | **${T.pen}** | **${T.fut}** | — |`,
        "",
      ].join("\n");
    },
  );

  // distribución de descartes
  const dis = CATALOG.filter((r) => r[6] > 0).map((r) => `\`${r[0]}\` ${r[6]}`).join(" · ");
  t = t.replace(/Los \d+ descartes con justificación se distribuyen así:[\s\S]*?\.\n/, `Los ${T.dis} descartes con justificación se distribuyen así:\n${dis}.\n`);

  writeFileSync(EXTRACT, t, "utf8");
}

// ── docs/review/README.md ─────────────────────────────────────────────────────
{
  let t = readFileSync(REVIEW, "utf8");
  t = replaceBlock(
    t,
    /^\* \[\`backlog-/m,
    /^\*\*Total:/m,
    () => {
      const items = [];
      for (const r of CATALOG) {
        const b = backlogName(r);
        const head = `* [\`backlog-${b}.md\`](backlog-${b}.md): ${r[4]} tareas (\`${range(r)}\`).`;
        const tail = ` ${r[5]} ✅ · ${r[6]} 🚫 · ${r[7]} 🆕 · ${r[8]} ⏳. ${r[3]}.`;
        items.push(head, ...wrap(tail, "  "));
      }
      return items.join("\n") + "\n";
    },
  );
  t = t.replace(
    /\*\*Total: \d+ tareas · \d+ ✅ Completada · \d+ 🚫 Descartada · \d+ 🆕 Pendiente · \d+ ⏳ Futura · 0 en el limbo\.\*\*/,
    `**Total: ${T.n} tareas · ${T.ok} ✅ Completada · ${T.dis} 🚫 Descartada · ${T.pen} 🆕 Pendiente · ${T.fut} ⏳ Futura · 0 en el limbo.**`,
  );
  writeFileSync(REVIEW, t, "utf8");
}

// ── docs/roadmap/Backlog.md ──────────────────────────────────────────────────
{
  let t = readFileSync(BACKLOG, "utf8");
  t = replaceBlock(
    t,
    /^> - \[\`docs\/review\/backlog-/m,
    /^> \*\*Recuento agregado:/m,
    () => {
      const items = [];
      for (const r of CATALOG) {
        const b = backlogName(r);
        const head = `> - [\`docs/review/backlog-${b}.md\`](../review/backlog-${b}.md): ${r[4]} tareas (\`${range(r)}\`).`;
        const tail = `${r[3]}. Ficha: [\`${r[0]}.md\`](../extractions/${r[0]}.md).`;
        items.push(head, ...wrap(tail, ">   "));
      }
      return items.join("\n") + "\n";
    },
  );
  t = t.replace(
    /\*\*Recuento agregado:\*\* \d+ tareas · \d+ ✅ Completada · \d+ 🚫 Descartada · \d+ 🆕 Pendiente · \d+ ⏳ Futura/,
    `**Recuento agregado:** ${T.n} tareas · ${T.ok} ✅ Completada · ${T.dis} 🚫 Descartada · ${T.pen} 🆕 Pendiente · ${T.fut} ⏳ Futura`,
  );
  writeFileSync(BACKLOG, t, "utf8");
}

console.log(`índices reconstruidos: ${CATALOG.length} repos · ${T.n} tareas · ✅${T.ok} 🚫${T.dis} 🆕${T.pen} ⏳${T.fut}`);

