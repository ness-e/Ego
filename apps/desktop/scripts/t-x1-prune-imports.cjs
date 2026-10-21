/**
 * T-X1 — Quita los imports que oxlint marca como sin usar en los ficheros
 * adaptados al scratch compartido.
 *
 * Cubre las tres formas: `import * as X from`, `import { X } from` (una sola
 * especificación) y `import { a, X, b } from`.
 */
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const FILES = [
  "test/canvas-interaction.test.ts",
  "test/ensure-fresh-dist.test.ts",
  "test/floating-persist.test.ts",
  "test/golden-path-alpha-full.test.ts",
  "test/ipc-tool-loop.test.ts",
  "test/ipc.integration.test.ts",
  "test/mcp-secret-resolver.test.ts",
  "test/mvp-software-loop.test.ts",
  "test/op-gate-main.test.ts",
  "test/projects-ipc.test.ts",
  "test/sessions-resume.test.ts",
  "test/subegos-ipc.test.ts",
  "test/subegos-seed.test.ts",
  "test/window-state.test.ts",
];

const ROOT = path.join(__dirname, "..");
let out = "";
try {
  out = execSync(
    "npx oxlint --ignore-path .gitignore " +
      FILES.map((f) => `"${f}"`).join(" "),
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, cwd: ROOT }
  );
} catch (err) {
  out = String(err.stdout || "");
}

const unused = new Map();
for (const line of out.split(/\r?\n/)) {
  const m = line.match(
    /^(.+?):\d+:\d+: warning eslint\(no-unused-vars\): Identifier '([^']+)' is imported but never used/
  );
  if (!m) continue;
  const file = m[1].replace(/\\/g, "/");
  if (!unused.has(file)) unused.set(file, new Set());
  unused.get(file).add(m[2]);
}

/** Quita un specifier de un bloque de import de una sola línea. */
function removeSpecifiers(src, names) {
  let s = src;
  for (const n of names) {
    // 1) Bloque de una sola especificación → la línea entera.
    s = s.replace(
      new RegExp(`^import \\{ ${n} \\} from "[^"]+";\\n`, "gm"),
      ""
    );
    s = s.replace(
      new RegExp(`^import \\{ type ${n} \\} from "[^"]+";\\n`, "gm"),
      ""
    );
    // 2) `import * as n from` → la línea entera.
    s = s.replace(
      new RegExp(`^import \\* as ${n} from "[^"]+";\\n`, "gm"),
      ""
    );
    // 3) Bloque multilínea: la línea del specificador (con su coma).
    s = s.replace(
      new RegExp(`^\\s*(?:type )?${n},\\n`, "gm"),
      ""
    );
    // 4) Bloque de una línea con más specifiers.
    s = s.replace(
      new RegExp(`^import \\{([^}]*)\\} from ("[^"]+");$`, "gm"),
      (full, inner, mod) => {
        const kept = inner
          .split(",")
          .map((x) => x.trim())
          .filter((x) => x.length > 0 && x !== n && x !== `type ${n}`);
        return kept.length === 0
          ? ""
          : `import { ${kept.join(", ")} } from ${mod};`;
      }
    );
  }
  return s;
}

let total = 0;
for (const [file, names] of unused) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) continue;
  const before = fs.readFileSync(p, "utf8");
  const after = removeSpecifiers(before, names);
  if (before !== after) {
    fs.writeFileSync(p, after, "utf8");
    total += names.size;
    console.log(`${file}: ${[...names].join(", ")}`);
  }
}
console.log(`ficheros con imports podados: ${total} specifiers`);
