/**
 * T11 (EGO-FIND-54) — extrae el bloque de handlers IPC de `main.ts` a
 * `src/main/ipc/register-ipc.ts` como `registerIpcHandlers(deps)`.
 *
 * Idempotente. El cuerpo de los handlers se mueve VERBATIM: solo se
 * reescriben las 4 asignaciones a variables mutables (que pasan a un
 * módulo de estado compartido con live bindings).
 */
const fs = require("node:fs");
const path = require("node:path");

const MAIN = path.join(__dirname, "..", "src", "main.ts");
const TARGET = path.join(__dirname, "..", "src", "main", "ipc", "register-ipc.ts");

const src = fs.readFileSync(MAIN, "utf8");
if (fs.existsSync(TARGET)) {
  console.log("T11: register-ipc.ts ya existe — nada que hacer.");
  process.exit(0);
}
const L = src.split(/\r?\n/);

// ─── 1. Localizar el bloque ───────────────────────────────────────────────
const start = L.findIndex((l) => l.includes('ipcMain.handle("ipc.memory"'));
let blockStart = start;
while (blockStart > 0 && L[blockStart - 1].trim().startsWith("//")) blockStart--;
let end = L.findIndex((l) => l.includes('ipcMain.handle("ipc.models.listModels"'));
let depth = 0;
let seen = false;
for (let i = end; i < L.length; i++) {
  for (const ch of L[i]) {
    if (ch === "{") {
      depth++;
      seen = true;
    } else if (ch === "}") depth--;
  }
  if (seen && depth === 0) {
    end = i;
    break;
  }
}
console.log(`bloque IPC: ${blockStart + 1} → ${end + 1} (${end - blockStart + 1} líneas)`);
let body = L.slice(blockStart, end + 1).join("\n");

// ─── 2. Estado mutable compartido ────────────────────────────────────────
const MUTABLE = [
  "activeProjectId",
  "cachedPermissionsSettings",
  "floatingAutoShownOnMinimize",
  "floatingPinnedManually",
];
for (const n of MUTABLE) {
  const setter = `set${n[0].toUpperCase()}${n.slice(1)}`;
  body = body.replace(
    new RegExp(`^(\\s*)${n}\\s*=\\s*(.+);\\s*$`, "gm"),
    (_all, indent, expr) => `${indent}${setter}(${expr});`
  );
}
if (MUTABLE.some((n) => new RegExp(`^\\s*${n}\\s*=`, "m").test(body))) {
  throw new Error("quedan asignaciones sin reescribir a setters");
}

// ─── 3. Imports necesarios en el módulo nuevo ────────────────────────────
const head = L.slice(0, blockStart).join("\n");
const importRe =
  /^import\s+(?:type\s+)?(?:[\w$]+\s*,\s*)?(?:\{[^}]*\}|\*\s*as\s+[\w$]+|[\w$]+)?\s*from\s*["'][^"']+["'];?/gm;
const importStmts = [];
let m;
while ((m = importRe.exec(head)) !== null) {
  const names = [];
  for (const part of m[0].matchAll(/\{([^}]*)\}/g)) {
    for (const n of part[1].split(",")) {
      const t = n.trim().replace(/^type\s+/, "");
      if (t) names.push(t.split(/\s+as\s+/).pop().trim());
    }
  }
  const def = m[0].match(/^import\s+(?:type\s+)?([A-Za-z_$][\w$]*)\s*(?:,|from)/);
  if (def) names.push(def[1]);
  if (names.length) importStmts.push({ stmt: m[0], names });
}

// Los identificadores que el bloque necesita y NO son deps.
const importedNames = new Set();
for (const s of importStmts) for (const n of s.names) importedNames.add(n);

const moduleDecls = new Set();
for (const mm of head.matchAll(
  /^(?:export\s+)?(?:const|let|var|function|class|async function|type|interface)\s+([A-Za-z_$][\w$]*)/gm
)) {
  moduleDecls.add(mm[1]);
}
for (const n of importedNames) moduleDecls.delete(n);

const deps = [...moduleDecls]
  .filter((n) => !MUTABLE.includes(n))
  .filter((n) => new RegExp(`\\b${n.replace(/\$/g, "\\$")}\\b`).test(body))
  .sort();
console.log(`deps: ${deps.length}`);

// Los imports que el módulo necesita = los que aporta un nombre usado en
// el bloque Y cuyo nombre no es un dep.
const needed = new Set();
for (const s of importStmts) {
  for (const n of s.names) {
    if (deps.includes(n)) continue;
    if (new RegExp(`\\b${n.replace(/\$/g, "\\$")}\\b`).test(body)) needed.add(s.stmt);
  }
}
const importLines = [...needed].map((stmt) =>
  stmt.replace(/from\s+["'](\.[^"']*)["']/g, (_all, p) => {
    const up = p.startsWith("../") ? "../.." : "..";
    const rest = p.replace(/^\.\.\//, "").replace(/^\.\//, "");
    return `from "${up}/${rest}"`;
  })
);

// ─── 4. Escribir el módulo ───────────────────────────────────────────────
const destructured = deps.map((n) => `  ${n},`).join("\n");
const moduleSrc = `/**
 * T11 (EGO-FIND-54) — Registro de los handlers IPC del main process.
 *
 * Extraído del god-file \`main.ts\` (dentro de \`createWindow\`) sin cambiar
 * el comportamiento observable: los 81 canales, su validación Zod y sus
 * respuestas son los mismos.
 *
 * El bloque se registra DESPUÉS de inicializar los subsistemas, así que las
 * dependencias (memoria, routers, engines) se inyectan ya construidas
 * mediante \`createIpcDeps()\` (main). El estado que muta durante la vida
 * de la app vive en \`ipc-state.ts\` con live bindings, para que main y los
 * handlers compartan la MISMA fuente de verdad.
 */
${importLines.join("\n")}
import {
  activeProjectId,
  cachedPermissionsSettings,
  floatingAutoShownOnMinimize,
  floatingPinnedManually,
  setActiveProjectId,
  setCachedPermissionsSettings,
  setFloatingAutoShownOnMinimize,
  setFloatingPinnedManually,
} from "./ipc-state.js";
import type { createIpcDeps } from "../../main.js";

/** Dependencias de los handlers (referencias estables, ya inicializadas). */
export type IpcDeps = ReturnType<typeof createIpcDeps>;

/**
 * Registra los 81 handlers IPC.
 *
 * @param deps Dependencias ya inicializadas del main process.
 */
export function registerIpcHandlers(deps: IpcDeps): void {
  const {
${destructured}
  } = deps;

${body}
}
`;
fs.mkdirSync(path.dirname(TARGET), { recursive: true });
fs.writeFileSync(TARGET, moduleSrc, "utf8");
console.log(`  escrito register-ipc.ts (${moduleSrc.split("\n").length} líneas)`);

// ─── 5. Reescribir main.ts ───────────────────────────────────────────────
let newMain = L.slice(0, blockStart);
newMain.push(
  "  // T11 (EGO-FIND-54): los 81 handlers IPC viven en su propio módulo.",
  "  registerIpcHandlers(createIpcDeps());"
);
newMain = newMain.concat(L.slice(end + 1));
fs.writeFileSync(MAIN, newMain.join("\n"), "utf8");
console.log("T11: bloque IPC extraído.");
