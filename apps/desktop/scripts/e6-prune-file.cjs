/**
 * E6-res — Poda los imports sin uso (TS6133/TS6192) de un fichero.
 *
 * Consciente de bloques multi-línea: si se podan TODOS los nombres de un
 * import, se elimina el bloque entero; si un nombre solo se usa como TIPO
 * (no como valor), el import se conserva como `import type`.
 *
 * Uso: node e6-prune-file.cjs <ruta-relativa-a-apps/desktop>
 */
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const target = process.argv[2];
if (!target) {
  console.log("uso: node e6-prune-file.cjs <ruta>");
  process.exit(1);
}
const p = path.join(__dirname, "..", target);

let out = "";
try {
  out = execSync("npx tsc -p tsconfig.json --noEmit 2>&1", {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    cwd: path.join(__dirname, ".."),
  });
} catch (err) {
  out = String(err.stdout || "");
}

const names = new Set();
const emptyBlocks = new Set();
for (const line of out.split(/\r?\n/)) {
  const m = line.match(
    /error TS(?:6133|6192): '([^']+)' is declared but (?:its value is|never)/
  );
  if (m && line.includes(target.replace(/\\/g, "/"))) names.add(m[1]);
  const m2 = line.match(
    /^(.+?)\((\d+),\d+\): error TS6192: All imports in import declaration are unused/
  );
  if (m2 && m2[1].includes(target.replace(/\\/g, "/"))) {
    emptyBlocks.add(Number(m2[2]));
  }
}
if (!names.size && !emptyBlocks.size) {
  console.log(`nada que podar en ${target}`);
  process.exit(0);
}
console.log(`podar en ${target}: ${names.size} simbolos`);

const L0 = fs.readFileSync(p, "utf8").split(/\r?\n/);

// --- Fase A: bloques con TODOS sus simbolos sin usar (TS6192) -------------
const deletedModules = new Set();
const typeOnlyModules = new Map();
for (const startLine of [...emptyBlocks].sort((a, b) => b - a)) {
  const lineNo = startLine - 1;
  if (lineNo < 0 || lineNo >= L0.length) continue;
  let idx = -1;
  let end = -1;
  for (let i = 0; i < L0.length; i++) {
    if (!L0[i].startsWith("import ")) continue;
    let e = i;
    if (!/from\s+["'][^"']+["'];\s*$/.test(L0[i])) {
      while (e < L0.length && !/from\s+["'][^"']+["'];\s*$/.test(L0[e])) e++;
    }
    if (lineNo >= i && lineNo <= e) {
      idx = i;
      end = e;
      break;
    }
  }
  if (idx < 0) continue;
  const text = L0.slice(idx, end + 1).join("\n");
  const m = text.match(/^import\s+(type\s+)?\{([\s\S]*?)\}\s+from\s+(".*");$/);
  if (!m) {
    L0.splice(idx, end - idx + 1);
    continue;
  }
  const bodyText = L0.filter(
    (l) => !l.startsWith("import ") && !/^\s+[A-Za-z_$][\w$]*,?\s*$/.test(l)
  )
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");
  const parts = m[2]
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const asType = parts.filter((s) => {
    const local = s.replace(/^type\s+/, "").split(/\s+as\s+/).pop().trim();
    return new RegExp(
      `(:\\s*${local}\\b)|(<${local}\\b)|(${local}\\[\\])|(\\bas\\s+${local}\\b)|(typeof\\s+${local}\\b)`
    ).test(bodyText);
  });
  if (asType.length === 0) {
    deletedModules.add(m[3]);
    L0.splice(idx, end - idx + 1);
  } else {
    typeOnlyModules.set(m[3], asType);
    L0.splice(
      idx,
      end - idx + 1,
      `import type { ${asType.join(", ")} } from ${m[3]};`
    );
  }
}

// --- Fase B: podar los simbolos sueltos (TS6133) ------------------------
const L = L0;
const outL = [];
let i = 0;
let removed = 0;
while (i < L.length) {
  const line = L[i];
  if (!line.startsWith("import ")) {
    outL.push(line);
    i++;
    continue;
  }
  const block = [line];
  let last = i;
  let j = i + 1;
  if (!/from\s+["'][^"']+["'];\s*$/.test(line)) {
    while (j < L.length) {
      block.push(L[j]);
      last = j;
      if (/from\s+["'][^"']+["'];\s*$/.test(L[j])) break;
      j++;
    }
  }
  i = last + 1;
  const text = block.join("\n");
  const m = text.match(/^import\s+(type\s+)?\{([\s\S]*?)\}\s+from\s+(".*");$/);
  if (!m) {
    outL.push(...block);
    continue;
  }
  if (deletedModules.has(m[3])) continue;
  const typeOnly = typeOnlyModules.get(m[3]);
  const bodyText = L.filter(
    (l) => !l.startsWith("import ") && !/^\s+[A-Za-z_$][\w$]*,?\s*$/.test(l)
  )
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");
  const parts = m[2]
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const keepValue = [];
  const keepType = [];
  let dropped = 0;
  for (const s of parts) {
    const local = s.replace(/^type\s+/, "").split(/\s+as\s+/).pop().trim();
    if (typeOnly) {
      if (typeOnly.includes(local)) keepType.push(local);
      else dropped++;
      continue;
    }
    if (!names.has(local)) {
      keepValue.push(s);
      continue;
    }
    if (
      new RegExp(
        `(:\\s*${local}\\b)|(<${local}\\b)|(${local}\\[\\])|(\\bas\\s+${local}\\b)|(typeof\\s+${local}\\b)`
      ).test(bodyText)
    ) {
      keepType.push(local);
      continue;
    }
    dropped++;
  }
  if (dropped === 0) {
    outL.push(...block);
    continue;
  }
  removed += dropped;
  if (keepValue.length > 0) {
    outL.push(`import { ${keepValue.join(", ")} } from ${m[3]};`);
  }
  if (keepType.length > 0) {
    outL.push(`import type { ${keepType.join(", ")} } from ${m[3]};`);
  }
}
fs.writeFileSync(p, outL.join("\n"), "utf8");
console.log(`${target}: ${outL.length} lineas (${removed} simbolos podados)`);
