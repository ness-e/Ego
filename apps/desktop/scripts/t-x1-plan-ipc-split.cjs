/**
 * T3 (Ola 5) — Plan de la división de `register-ipc.ts` por DOMINIO DE CANAL.
 *
 * Calcula, desde el ORIGINAL (la copia `t-x1-ipc-register-ipc.pre-split.ts`):
 *   - los 81 handlers (`ipcMain.handle`) con su rango de líneas,
 *   - las declaraciones locales (`const`/`let`/`function`/`type`/`interface`)
 *     que hay entre ellos,
 *   - los imports del fichero.
 *
 * El cierre de un handler es la PRIMERA línea que empieza por `  })`
 * (cubre `  });`, `  }));` y `  }),`).
 */
const fs = require("node:fs");
const path = require("node:path");

const P = path.join(__dirname, "t-x1-ipc-register-ipc.pre-split.ts");
const L = fs.readFileSync(P, "utf8").split(/\r?\n/);

const fnIdx = L.findIndex((l) => l.startsWith("export function registerIpcHandlers"));
if (fnIdx < 0) throw new Error("no se encontró registerIpcHandlers");
let fnEnd = L.length - 1;
while (fnEnd > fnIdx && L[fnEnd].trim() !== "}") fnEnd--;

// --- handlers -------------------------------------------------------------
const handlers = [];
for (let i = fnIdx; i <= fnEnd; i++) {
  const m = L[i].match(/^  ipcMain\.handle\(\s*["'`](ipc\.[a-zA-Z0-9.-]+)["'`]/);
  if (!m) continue;
  let end = i;
  while (end <= fnEnd && !/^\s{2}\}\)/.test(L[end])) end++;
  if (end > fnEnd) throw new Error(`sin cierre el handler de la línea ${i + 1}`);
  handlers.push({ channel: m[1], domain: m[1].split(".")[1], start: i, end });
}

// --- locales --------------------------------------------------------------
const locals = [];
for (let i = fnIdx; i <= fnEnd; i++) {
  const m = L[i].match(
    /^  (const|let|function|async function|type|interface)\s+([A-Za-z_][A-Za-z0-9_]*)/
  );
  if (!m) continue;
  const kind = m[1];
  const name = m[2];
  let end = i;
  if (kind === "type" || kind === "interface") {
    if (/\;\s*$/.test(L[i])) end = i;
    else while (end <= fnEnd && !/^\s{2}\};?\s*$/.test(L[end] || "")) end++;
  } else if (kind === "const" || kind === "let") {
    let depth = 0;
    while (end <= fnEnd) {
      for (const ch of L[end] || "") {
        if (ch === "{" || ch === "(" || ch === "[") depth++;
        else if (ch === "}" || ch === ")" || ch === "]") depth--;
      }
      if (depth <= 0 && end > i && /[;,]\s*$/.test(L[end] || "")) break;
      if (depth <= 0 && end === i && /;\s*$/.test(L[end] || "")) break;
      end++;
    }
  } else {
    while (end <= fnEnd && !/^  \}$/.test(L[end] || "")) end++;
  }
  locals.push({ name, start: i, end });
}

// --- imports --------------------------------------------------------------
const imports = [];
{
  let i = 0;
  while (i < fnIdx) {
    if (/^import\b/.test(L[i])) {
      let text = L[i];
      let j = i;
      while (!/from\s+["'][^"']+["'];?\s*$/.test(text) && j + 1 < fnIdx) {
        j++;
        text += "\n" + L[j];
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

// --- deps -----------------------------------------------------------------
const depsNames = [];
{
  const start = L.findIndex(
    (l, i) =>
      l.startsWith("  const {") &&
      L.slice(i, i + 60).some((x) => /decisionAuditor/.test(x))
  );
  for (let i = start; i < L.length; i++) {
    if (/^\s{2}\} = deps;/.test(L[i])) break;
    const m = L[i].match(/^\s{2}(.*)$/);
    if (!m) continue;
    for (const part of m[1].split(",")) {
      const n = part.trim();
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)) depsNames.push(n);
    }
  }
}

fs.writeFileSync(
  path.join(__dirname, "t-x1-ipc-plan.json"),
  JSON.stringify(
    {
      handlers,
      locals,
      imports,
      depsNames,
      fnStart: fnIdx,
      fnEnd,
    },
    null,
    2
  ),
  "utf8"
);
console.log(
  `plan: ${handlers.length} handlers · ${locals.length} locales · ${imports.length} imports · ${depsNames.length} deps`
);
