/**
 * T11 (Ola 1c) — extrae el bloque de "caché de settings" de `main.ts`.
 *
 * Las funciones de caché de permisos/compresión son cohesivas (leen y
 * escriben el mismo par de variables de módulo) y no dependen de Electron.
 */
const fs = require("node:fs");
const path = require("node:path");

const MAIN = path.join(__dirname, "..", "src", "main.ts");
const TARGET = path.join(__dirname, "..", "src", "main", "settings-cache.ts");

if (fs.existsSync(TARGET)) {
  console.log("ya existe settings-cache.ts");
  process.exit(0);
}

const L = fs.readFileSync(MAIN, "utf8").split(/\r?\n/);

// Bloque contiguo: desde el comentario de la caché de permisos hasta el
// final de `loadCompressionSettingsIntoCache`.
const start = L.findIndex((l) =>
  l.includes("Cache en memoria de `gov/settings/permissions`")
);
let end = -1;
for (let i = start; i < L.length; i++) {
  if (L[i].includes("export async function loadCompressionSettingsIntoCache")) {
    let d = 0;
    let seen = false;
    for (let k = i; k < L.length; k++) {
      for (const ch of L[k]) {
        if (ch === "{") {
          d++;
          seen = true;
        } else if (ch === "}") d--;
      }
      if (seen && d === 0) {
        end = k;
        break;
      }
    }
    break;
  }
}
if (end < 0) throw new Error("no se encontró el bloque de caché de settings");
console.log("bloque:", start + 1, "->", end + 1, `(${end - start + 1} lineas)`);

const body = L.slice(start, end + 1).join("\n");
fs.mkdirSync(path.dirname(TARGET), { recursive: true });
fs.writeFileSync(
  TARGET,
  `/**
 * T11 (Ola 1c) — Caché de settings del main process (permisos y compresión).
 *
 * Extraído del god-file \`main.ts\`: el bloque es cohesivo (lee y escribe
 * las mismas dos variables de módulo) y no depende de Electron, así que
 * puede vivir en su propio módulo con sus propios tests.
 */
import { parseCompressionSettings, type CompressionSettings } from "@ego/memory";
import {
  PermissionsSettingsSchema,
  type PermissionsSettings,
} from "../../ipc/schema.js";

${body}
`,
  "utf8"
);

// Recoloa main.ts: sustituye el bloque por el import + re-export.
const rel = "./main/settings-cache.js";
const names = [
  "getCachedPermissionsSettings",
  "setCachedPermissionsSettingsForTests",
  "getCachedCompressionSettings",
  "setCachedCompressionSettingsForTests",
  "loadPermissionsSettingsIntoCache",
  "loadCompressionSettingsIntoCache",
];
const L2 = fs.readFileSync(MAIN, "utf8").split(/\r?\n/);
const s2 = L2.findIndex((l) =>
  l.includes("Cache en memoria de `gov/settings/permissions`")
);
const repl = [
  `import {`,
  ...names.map((n) => `  ${n},`),
  `} from "${rel}";`,
  "",
  ...names.map((n) => `export { ${n} } from "${rel}";`),
];
const out = [...L2.slice(0, s2), ...repl, ...L2.slice(end + 1)];
fs.writeFileSync(MAIN, out.join("\n"));
console.log("main.ts:", out.length, "lineas");
