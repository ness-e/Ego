/**
 * T3 (Ola 5) — División de `register-ipc.ts` por DOMINIO DE CANAL.
 *
 * Genera, desde el fichero ORIGINAL (copia en `t-x1-ipc-register-ipc.pre-split.ts`):
 *   - `src/main/ipc/domains/<dominio>.ts` — un módulo por dominio de canal,
 *   - `src/main/ipc/domain-support.ts` — los locales compartidos,
 *   - `src/main/ipc/canonical-specialists.ts` — el catálogo de especialistas,
 *   - `src/main/ipc/register-ipc.ts` — raíz de composición.
 *
 * Es idempotente: parte SIEMPRE del original.
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const IPC_DIR = path.join(ROOT, "src", "main", "ipc");
const DOMAIN_DIR = path.join(IPC_DIR, "domains");
const PLAN = path.join(__dirname, "t-x1-ipc-plan.json");
const ORIG = path.join(__dirname, "t-x1-ipc-register-ipc.pre-split.ts");

const plan = JSON.parse(fs.readFileSync(PLAN, "utf8"));
const original = fs.readFileSync(ORIG, "utf8").split(/\r?\n/);
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

// ------------------------------------------------------------- 1) imports
const imports = [];
{
  let i = 0;
  while (i < plan.fnStart) {
    if (/^import\b/.test(original[i])) {
      let text = original[i];
      let j = i;
      while (!/from\s+["'][^"']+["'];?\s*$/.test(text) && j + 1 < plan.fnStart) {
        j++;
        text += "\n" + original[j];
      }
      const m = text.match(
        /^import\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+["']([^"']+)["'];?$/
      );
      if (!m) throw new Error(`import no parseado: ${text.slice(0, 60)}`);
      imports.push({
        names: m[1]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        source: m[2],
      });
      i = j + 1;
      continue;
    }
    i++;
  }
}

// ------------------------------------------------------------- 2) locals
const locals = [];
for (let i = plan.fnStart; i <= plan.fnEnd; i++) {
  const l = original[i] || "";
  const m = l.match(
    /^  (const|let|function|async function|type|interface)\s+([A-Za-z_][A-Za-z0-9_]*)/
  );
  if (!m) continue;
  const name = m[2];
  let end = i;
  if (m[1] === "type" || m[1] === "interface") {
    // Una declaración de UNA línea termina en la propia línea; si no, hay
    // que buscar el cierre `};` del bloque.
    if (/\;\s*$/.test(l)) {
      end = i;
    } else {
      while (end <= plan.fnEnd && !/^\s{2}\};?\s*$/.test(original[end] || "")) end++;
    }
  } else if (m[1] === "const" || m[1] === "let") {
    let depth = 0;
    while (end <= plan.fnEnd) {
      for (const ch of original[end] || "") {
        if (ch === "{" || ch === "(" || ch === "[") depth++;
        else if (ch === "}" || ch === ")" || ch === "]") depth--;
      }
      if (depth <= 0 && end > i && /[;,]\s*$/.test(original[end] || "")) break;
      if (depth <= 0 && end === i && /;\s*$/.test(original[end] || "")) break;
      end++;
    }
  } else {
    while (end <= plan.fnEnd && !/^  }$/.test(original[end] || "")) end++;
  }
  locals.push({ name, start: i, end });
}
const localByName = new Map(locals.map((l) => [l.name, l]));

// Uso de cada local por dominio (sin comentarios).
const localUse = new Map();
for (const h of plan.handlers) {
  const text = stripComments(original.slice(h.start, h.end + 1).join("\n"));
  for (const l of locals) {
    if (new RegExp(`\\b${l.name}\\b`).test(text)) {
      if (!localUse.has(l.name)) localUse.set(l.name, new Set());
      localUse.get(l.name).add(h.domain);
    }
  }
}
// ---------------------------------------------------------- 3) deps list
const depsNames = [];
{
  const start = original.findIndex(
    (l, i) =>
      l.startsWith("  const {") &&
      original.slice(i, i + 60).some((x) => /decisionAuditor/.test(x))
  );
  for (let i = start; i < original.length; i++) {
    if (/^\s{2}\} = deps;/.test(original[i])) break;
    const m = original[i].match(/^\s{2}(.*)$/);
    if (!m) continue;
    for (const part of m[1].split(",")) {
      const n = part.trim();
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)) depsNames.push(n);
    }
  }
}

const shared = [];
const owned = new Map();
{
  // Un local que depende de `deps` (p. ej. `new ProductDomain(adapter)`) NO
  // puede vivir en el soporte compartido (se crearía al importar el
  // módulo, no al registrar): se queda en su módulo.
  //
  // Los locales DECLARADOS JUNTOS forman un grupo: si uno depende de
  // `deps`, el grupo entero se queda en el módulo (partirlos dejaría medio
  // grupo en un sitio y medio en otro).
  const boundToDeps = new Set(
    locals
      .filter((l) => {
        const text = original.slice(l.start, l.end + 1).join("\n");
        return depsNames.some((d) => new RegExp(`\\b${d}\\b`).test(text));
      })
      .map((l) => l.name)
  );
  // Grupos: locales consecutivos (sin otro local entre medias).
  const groups = [];
  for (const l of locals) {
    const last = groups[groups.length - 1];
    if (last && last[last.length - 1].end >= l.start - 3) last.push(l);
    else groups.push([l]);
  }
  const groupOf = new Map();
  for (const g of groups) for (const l of g) groupOf.set(l.name, g);

  for (const [n, d] of localUse) {
    const g = groupOf.get(n) || [localByName.get(n)];
    const anyBound = g.some((l) => boundToDeps.has(l.name));
    if (anyBound) {
      if (d.size !== 1) throw new Error(`local ligado a deps usado por varios dominios: ${n}`);
      for (const l of g) owned.set(l.name, [...d][0]);
      continue;
    }
    shared.push(n);
  }
}

// -------------------------------------------------------- 4) los módulos
const domains = [...new Set(plan.handlers.map((h) => h.domain))].sort();
const pascal = (d) => d.charAt(0).toUpperCase() + d.slice(1);
fs.rmSync(DOMAIN_DIR, { recursive: true, force: true });
fs.mkdirSync(DOMAIN_DIR, { recursive: true });

const stats = [];
for (const domain of domains) {
  const handlers = plan.handlers.filter((h) => h.domain === domain);
  const handlerText = handlers
    .map((h) => original.slice(h.start, h.end + 1).join("\n"))
    .join("\n\n");
  const ownLocals = [...owned.entries()]
    .filter(([, d]) => d === domain)
    .map(([n]) => original.slice(localByName.get(n).start, localByName.get(n).end + 1).join("\n"));
  const bodyText = handlerText + "\n" + ownLocals.join("\n");
  const bodyNoComments = stripComments(bodyText);

  const used = depsNames.filter((n) => new RegExp(`\\b${n}\\b`).test(bodyNoComments));
  const sharedUsed = shared.filter((n) => new RegExp(`\\b${n}\\b`).test(bodyNoComments));

  // Imports: los que el módulo usa de verdad (sin comentarios).
  const importLines = [];
  for (const im of imports) {
    const keep = im.names.filter((n) => {
      const bare = n.replace(/^type\s+/, "").split(/\s+as\s+/).pop().trim();
      return new RegExp(`\\b${bare}\\b`).test(bodyNoComments);
    });
    if (!keep.length) continue;
    importLines.push(
      keep.length === 1
        ? `import { ${keep[0]} } from "${im.source}";`
        : `import {\n${keep.map((n) => `  ${n},`).join("\n")}\n} from "${im.source}";`
    );
  }

  const supportImport = sharedUsed.length
    ? `import {\n${sharedUsed.map((n) => `  ${n},`).join("\n")}\n} from "../domain-support.js";`
    : "";

  // El dominio `subegos` usa el catálogo de especialistas (moved a
  // `canonical-specialists.ts`): lo importa explícitamente.
  const specialistsImport = domain === "subegos"
    ? 'import {\n  CANONICAL_SPECIALIST_SUBEGOS,\n  buildCanonicalSpecialistManifests,\n  seedCanonicalSubEgos,\n} from "../canonical-specialists.js";'
    : "";

  const file = [
    "/**",
    ` * T3 (Ola 5) — Canal IPC \`ipc.${domain}.*\`.`,
    " *",
    " * Un módulo por DOMINIO DE CANAL (el criterio que vigila el gate",
    " * `apps/desktop/test/ipc-modules-gate.test.ts`): el nombre del canal ya",
    " * codifica el dominio, así que la división no es arbitraria.",
    " */",
    ...importLines,
    supportImport,
    specialistsImport,
    'import type { IpcDeps } from "../register-ipc.js";',
    "",
    `/** Registra los canales \`ipc.${domain}.*\`. */`,
    used.length
      ? `export function register${pascal(domain)}Ipc(deps: IpcDeps): void {\n  const {\n${used
          .map((n) => `    ${n},`)
          .join("\n")}\n  } = deps;`
      : `export function register${pascal(domain)}Ipc(_deps: IpcDeps): void {`,
    "",
    ...ownLocals,
    ownLocals.length ? "" : null,
    handlerText,
    "}",
    "",
  ]
    .filter((p) => p !== null)
    .join("\n");

  const target = path.join(DOMAIN_DIR, `${domain}.ts`);
  // Los módulos viven un nivel más abajo: las rutas relativas del original
  // (relativas a `src/main/ipc/`) necesitan un `../` más.
  const KEEP = new Set(["../domain-support.js", "../register-ipc.js", "../canonical-specialists.js"]);
  const fixed = file.replace(/from "(\.[^"]+)"/g, (full, source) =>
    KEEP.has(source) ? full : `from "../${source}"`
  );
  fs.writeFileSync(target, fixed, "utf8");
  stats.push({ domain, lines: fixed.split(/\r?\n/).length });
}
stats.sort((a, b) => b.lines - a.lines);
console.log("módulos:", stats.length, "· máximo:", stats[0].lines, "líneas", `(${stats[0].domain})`);

// ------------------------------------------------- 5) domain-support.ts
const supportBody = shared
  .map((n) => {
    const l = localByName.get(n);
    return original
      .slice(l.start, l.end + 1)
      .join("\n")
      .split(/\r?\n/)
      .map((line) => (line.startsWith("  ") ? line.slice(2) : line))
      .join("\n")
      .replace(/^(const|type|function|async function)\b/m, "export $1");
  })
  .join("\n\n");
fs.writeFileSync(
  path.join(IPC_DIR, "domain-support.ts"),
  [
    "/**",
    " * T3 (Ola 5) — Utilidades compartidas por los módulos de dominio IPC.",
    " *",
    " * Los helpers que usan MÁS DE UN dominio (p. ej. el enmascarado de las",
    " * keys de proveedor, que consumen `settings` y `snapshots`) viven aquí:",
    " * duplicarlos sería crear dos verdades; meterlos en un dominio los",
    " * ataría a ese dominio.",
    " */",
    'import { maskApiKey } from "../credentials/vault.js";',
    'import type { ModelConfig } from "../../ipc/schema.js";',
    "",
    supportBody,
    "",
  ].join("\n"),
  "utf8"
);

// ------------------------------------------- 6) canonical-specialists.ts
const specStart = (() => {
  const i = original.findIndex((l) => l.includes("export interface CanonicalSpecialistSpec"));
  let s = i;
  while (s > 0 && !original[s].startsWith("/**")) s--;
  return s;
})();
const specEnd = (() => {
  const i = original.findIndex((l) => l.includes("export function registerIpcHandlers"));
  let e = i - 1;
  while (e > 0 && original[e].trim() !== "}") e--;
  return e;
})();
fs.writeFileSync(
  path.join(IPC_DIR, "canonical-specialists.ts"),
  [
    "/**",
    " * T3 (Ola 5) — Catálogo de especialistas canónicos y su siembra.",
    " *",
    " * Extraído de `register-ipc.ts`: es DATO (el catálogo y la siembra), no un",
    " * handler. Su peso no debe decidir el tamaño del fichero de IPC, y su",
    " * dominio (Sub-Egos) no es el de ningún canal.",
    " */",
    'import { EgoMemoryAdapter } from "@ego/memory";',
    "import {",
    "  SubEgoRegistry,",
    "  createSubEgoId as createCanonicalSubEgoId,",
    "  parseSubEgoManifest,",
    "  type SubEgoManifest,",
    '} from "@ego/subegos";',
    "",
    original.slice(specStart, specEnd + 1).join("\n").replace(
      /^function buildCanonicalSpecialistManifests\(/m,
      "export function buildCanonicalSpecialistManifests("
    ),
    "",
  ].join("\n"),
  "utf8"
);

// ------------------------------------------- 7) raíz de composición
const compose = [
  "/**",
  " * T11 (EGO-FIND-54) — Registro de los handlers IPC del main process.",
  " *",
  " * T3 (Ola 5): este fichero ya no es el god-file de IPC. Es la RAÍZ DE",
  " * COMPOSICIÓN: cada dominio de canal tiene su módulo en `./domains/`.",
  " *",
  " * El criterio (un módulo por dominio de canal) y su gate están en",
  " * `apps/desktop/test/ipc-modules-gate.test.ts`: ningún fichero de IPC",
  " * supera el umbral, cada canal se registra en exactamente un módulo y los",
  " * 81 canales siguen siendo los mismos.",
  " *",
  " * El bloque se registra DESPUÉS de inicializar los subsistemas, así que las",
  " * dependencias (memoria, routers, engines) se inyectan ya construidas",
  " * mediante `createIpcDeps()` (main). El estado que muta durante la vida",
  " * de la app vive en `ipc-state.ts` con live bindings, para que main y los",
  " * handlers compartan la MISMA fuente de verdad.",
  " */",
  'import type { createIpcDeps } from "../../main.js";',
  "",
  ...domains.map((d) => `import { register${pascal(d)}Ipc } from "./domains/${d}.js";`),
  "",
  "/** Dependencias de los handlers (referencias estables, ya inicializadas). */",
  "export type IpcDeps = ReturnType<typeof createIpcDeps>;",
  "",
  "/**",
  " * Registra los 81 handlers IPC, delegando cada dominio en su módulo.",
  " *",
  " * @param deps Dependencias ya inicializadas del main process.",
  " */",
  "export function registerIpcHandlers(deps: IpcDeps): void {",
  ...domains.map((d) => `  register${pascal(d)}Ipc(deps);`),
  "}",
  "",
  "// Re-exports de compatibilidad: el catálogo de especialistas y su siembra",
  "// vivían aquí antes de la división por dominio.",
  "export {",
  "  CANONICAL_SPECIALIST_SUBEGOS,",
  "  buildCanonicalSpecialistManifests,",
  "  seedCanonicalSubEgos,",
  "  type CanonicalSpecialistSpec,",
  '} from "./canonical-specialists.js";',
  "",
].join("\n");
fs.writeFileSync(path.join(IPC_DIR, "register-ipc.ts"), compose, "utf8");
console.log(
  `register-ipc.ts: ${compose.split(/\r?\n/).length} líneas (raíz de composición, ${domains.length} dominios)`
);
