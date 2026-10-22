#!/usr/bin/env node
// scripts/inventory-tautological-tests.mjs — T8 (EGO-FIND-63) + EGO-FIND-108
// (Ola 11): inventario de tests que afirman sobre TEXTO DE FUENTE.
//
// PATRÓN TAUTOLÓGICO (el que rompe sin cambio de comportamiento):
//   1. se lee un fichero con una lectura (directa o envuelta en un helper),
//   2. el resultado se asigna a una variable,
//   3. y esa variable se usa en `expect(...).toX(...)`.
//
// NO es tautológico (y no se reporta):
//   · `expect(valorDeRuntime).toContain(...)` — comprueba COMPORTAMIENTO.
//   · `expect(cadenaLiteral).not.toContain(CANARIO)` — comprueba REDACCIÓN.
//   · `expect(artefactoDeBuild).toContain(...)` — comprueba el ARTEFACTO
//     (p.ej. el HTML que se empaqueta), que es un contrato de entrega.
//
// ## EGO-FIND-108: el detector era CIEGO
//
// La versión anterior sólo veía `const X = readFileSync(` en la MISMA línea.
// En el repo hay (y había) tres formas más que NO veía:
//
//   (a) `const x = await fs.readFile(p, "utf-8")`   → el `await` rompe el regex
//   (b) `const x = fs.readFileSync(p, "utf-8")`     → el `fs.` rompe el regex
//   (c) `const x = readSrc(p)`                     → la lectura está dentro de
//       un helper local (`const read = (p) => readFileSync(p, "utf-8")`)
//   (d) `const x = files.map((f) => readFileSync(f))` → la lectura está anidada
//       en una expresión (y a veces dentro de un template literal)
//   (e) `expect(readFileSync(p, "utf-8")).toContain(...)` → la lectura está
//       dentro del propio `expect`
//
// Consecuencia: el inventario "medía" 1 fichero cuando el repo tenía más. Un
// detector que no ve no puede sostener una afirmación.
//
// ## Cómo se detectan ahora
//
//  1. LECTURAS: llamadas a `readFileSync` / `readFile` (con o sin `fs.`,
//     `fsp.`, `nodeFs.`), con o sin `await`.
//  2. HELPERS: una función local (declaración `function` o arrow `const f =
//     (…) =>`) cuyo cuerpo **devuelve** el resultado de una lectura. Si la
//     lectura se pasa a otra función (p.ej. a un parser) y lo que se devuelve
//     es un AST, NO es una lectura de texto → no se cuenta (evita falsos
//     positivos: `readDeclaration()` de `packages/avatar/tests/public-surface.test.js`
//     devuelve un AST, no texto).
//  3. VARIABLES DE FUENTE: una declaración `const|let|var X = <expr>` cuya
//     expresión contiene una lectura (directa o vía helper). La expresión se
//     recorre con un escáner que respeta cadenas, plantillas y anidamiento de
//     paréntesis, de modo que también se ve una lectura dentro de un
//     `${…}` de un template literal.
//  4. ASSERTS: `expect(<arg>)` cuyo argumento contiene una variable de fuente
//     (o una lectura directa) y cuyo matcher es de VALOR.
//
// ## TIPO DE LECTURA
//
// Cada hallazgo dice si la lectura apunta a CÓDIGO (`.ts/.tsx/.js/.mjs/.cjs`)
// o a otro tipo de fichero. El objetivo del inventario es medir el código que
// lee ficheros de código; el resto se informa aparte, no se esconde.
//
// USO: node scripts/inventory-tautological-tests.mjs [--json]
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_ARG = (() => {
  const i = process.argv.indexOf("--root");
  // `resolve` (no `join`): el argumento puede ser una ruta ABSOLUTA.
  if (i >= 0 && process.argv[i + 1]) return resolve(process.cwd(), process.argv[i + 1]);
  return join(dirname(fileURLToPath(import.meta.url)), "..");
})();
const ROOT = ROOT_ARG;
const SCAN_DIRS = ["packages", "apps", "tests"];
const SKIP = new Set(["node_modules", "dist", "out", "release", "coverage", "vendor", ".git"]);

/** Matchers que afirman sobre un VALOR (no sobre la forma de un objeto). */
const MATCHERS = new Set([
  "toContain",
  "toMatch",
  "toBe",
  "toEqual",
  "toStrictEqual",
  "toBeTruthy",
  "toBeFalsy",
  "toBeDefined",
  "toBeUndefined",
  "toBeNull",
  "toHaveLength",
  "toBeInstanceOf",
  "toHaveProperty",
  "toThrow",
]);

/**
 * Una LECTURA. Cubre:
 *   · `readFileSync(` / `readFile(`
 *   · `fs.readFileSync(` / `fsp.readFile(` / `nodeFs.readFileSync(` …
 *   · con o sin `await` delante (el `await` se acepta por el `\b` previo).
 */
const READ_RE = /\b(?:[A-Za-z0-9_$]+\.)?(?:readFileSync|readFile)\s*\(/;

/** Extensión de un fichero de CÓDIGO (lo que el inventario quiere medir). */
const CODE_PATH_RE = /\.(?:ts|tsx|js|mjs|cjs)\b/;

/** Encodings que aparecen como literales y NO son parte de una ruta. */
const ENCODINGS = new Set(["utf-8", "utf8", "utf-16le", "utf16le", "ascii", "binary", "latin1"]);

/**
 * Clasifica la LECTURA: ¿el texto leído es el CÓDIGO BAJO PRUEBA (un fichero
 * del repo) o un ARTEFACTO que el propio test produjo (un fichero temporal)?
 *
 * Se resuelve estáticamente: se extraen los literales de ruta de la expresión
 * y se comprueba si forman un fichero que EXISTE en el repo.
 *
 *   · "repo"     → el fichero existe en el repo ⇒ se afirma sobre el código
 *                  bajo prueba ⇒ TAUTOLÓGICO.
 *   · "artefacto"→ la ruta no resuelve a un fichero del repo (típicamente un
 *                  temporal que el test acaba de escribir) ⇒ aserto sobre un
 *                  artefacto ⇒ NO tautológico (comprueba el ARTEFACTO).
 *   · "dato"     → la ruta resuelve a un fichero del repo que no es código
 *                  (un informe, un LICENSE.md, un JSON de datos).
 */
/**
 * Clasifica la LECTURA: ¿el texto leído es el CÓDIGO BAJO PRUEBA (un fichero
 * del repo) o un ARTEFACTO que el propio test produjo (un fichero temporal)?
 *
 * Se resuelve estáticamente en dos pasos:
 *   1. los literales de la expresión → si forman una ruta que EXISTE en el
 *      repo, esa es la lectura;
 *   2. si no, se busca una VARIABLE DE RUTA del propio test (p.ej.
 *      `const mainRoot = join(repoRoot, "apps", "desktop", "src")`) que esté
 *      referenciada en la expresión: la lectura apunta a ficheros de ese
 *      directorio del repo.
 *
 * Devuelve:
 *   · "codigo-repo" → el texto es de un fichero de CÓDIGO del repo ⇒
 *                     TAUTOLÓGICO (se afirma sobre el código bajo prueba).
 *   · "dato-repo"   → el texto es de un fichero del repo que no es código
 *                     (informe, LICENSE.md, JSON de datos) ⇒ contrato de
 *                     entrega, no tautología.
 *   · "dinamica"    → la ruta se calcula en tiempo de ejecución: no se puede
 *                     decidir si es código del repo o un artefacto de la
 *                     corrida ⇒ se informa, no se cuenta como tautología.
 */
/**
 * Resuelve estáticamente una ruta a partir de los literales de una expresión.
 * Devuelve la ruta ABSOLUTA si existe en el repo (fichero o directorio), o
 * null si no se puede resolver.
 */
function resolverRuta(literales, testFileAbs) {
  if (literales.length === 0) return null;
  const joined = literales.join("/").replace(/\\/g, "/");
  const candidatos = [];
  if (joined.startsWith("/")) candidatos.push(joined.replace(/^\/+/, ""));
  else {
    candidatos.push(joined);
    candidatos.push(join(dirname(testFileAbs), joined));
  }
  for (const c of candidatos) {
    const abs = c.startsWith("/") ? c : join(ROOT, c);
    if (existsSync(abs)) return abs;
  }
  return null;
}

function clasificarLectura(expr, testFileAbs, pathVars) {
  const literales = [];
  const litRe = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
  let m;
  while ((m = litRe.exec(expr)) !== null) {
    const v = m[2];
    if (ENCODINGS.has(v.toLowerCase())) continue;
    literales.push(v);
  }

  // 1) literales → ruta
  const abs = resolverRuta(literales, testFileAbs);
  if (abs && !statSync(abs).isDirectory()) {
    return {
      tipo: CODE_PATH_RE.test(abs) ? "codigo-repo" : "dato-repo",
      ruta: relative(ROOT, abs).replace(/\\/g, "/"),
    };
  }

  // 2) variables de ruta del propio test
  for (const [name, info] of pathVars ?? []) {
    if (!new RegExp(`\\b${name}\\b`).test(expr)) continue;
    if (!info.isDir) continue;
    return { tipo: "codigo-repo", ruta: `${info.ruta}/**` };
  }

  return { tipo: "dinamica", ruta: null };
}

/**
 * VARIABLES DE RUTA del fichero: las que apuntan a una ruta que EXISTE en el
 * repo (fichero o directorio). Sirven para clasificar las lecturas cuya ruta
 * se calcula en tiempo de ejecución (`join(mainRoot, abs)`).
 */
function pathVars(src) {
  const out = new Map();
  const declRe = /\b(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=/g;
  let m;
  while ((m = declRe.exec(src)) !== null) {
    const name = m[1];
    const expr = src.slice(m.index + m[0].length, statementEnd(src, m.index + m[0].length));
    if (!/join\(|resolve\(/.test(expr)) continue;
    const literales = [];
    const litRe = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
    let lm;
    while ((lm = litRe.exec(expr)) !== null) {
      const v = lm[2];
      if (ENCODINGS.has(v.toLowerCase())) continue;
      literales.push(v);
    }
    const abs = resolverRuta(literales, ROOT);
    if (!abs) continue;
    const rel = relative(ROOT, abs).replace(/\\/g, "/");
    out.set(name, { ruta: rel, isDir: statSync(abs).isDirectory() });
  }
  return out;
}


/** Zona de propiedad (para el handoff). */
function zoneOf(rel) {
  if (rel.startsWith("tests/")) return "A7";
  if (rel.startsWith("apps/desktop/renderer/floating/vendor/")) return "A6";
  if (rel.startsWith("apps/")) return "A4";
  if (
    rel.startsWith("packages/memory/") ||
    rel.startsWith("packages/knowledge/") ||
    rel.startsWith("packages/runtime/") ||
    rel.startsWith("packages/models/") ||
    rel.startsWith("packages/decision/") ||
    rel.startsWith("packages/execution/") ||
    rel.startsWith("packages/events/") ||
    rel.startsWith("packages/security/") ||
    rel.startsWith("packages/tool-call-repair/") ||
    // A2-bis escribió las puertas de atribución de estos dos paquetes.
    rel.startsWith("packages/tools/") ||
    rel.startsWith("packages/ui-runtime/")
  ) {
    return "A2";
  }
  return "A3";
}

function walk(dir, out) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP.has(e.name)) continue;
      walk(join(dir, e.name), out);
    } else if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(e.name)) {
      out.push(join(dir, e.name));
    }
  }
  return out;
}

/* ───────────────────────── escáner de código ───────────────────────── */

/** Índice del `)` que cierra el paréntesis abierto en `from`. -1 si no hay. */
function matchParen(src, from) {
  let depth = 0;
  let i = from;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const end = src.indexOf(ch, i + 1);
      if (end < 0) return -1;
      i = end + 1;
      continue;
    }
    if (ch === "`") {
      i = scanTemplate(src, i);
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") {
      depth++;
      i++;
      continue;
    }
    if (ch === ")" || ch === "]" || ch === "}") {
      if (depth === 0) return ch === ")" ? i : -1;
      depth--;
      i++;
      continue;
    }
    i++;
  }
  return -1;
}

/**
 * Avanza más allá de una plantilla literal. Dentro de `${…}` el contenido se
 * escanea como código normal (una lectura puede vivir dentro de un template).
 */
function scanTemplate(src, i) {
  i++; // la `
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === "`") return i + 1;
    if (ch === "$" && src[i + 1] === "{") {
      const end = matchBrace(src, i + 2);
      if (end < 0) return src.length;
      i = end + 1;
      continue;
    }
    i++;
  }
  return src.length;
}

/** Índice del `}` que cierra la llave abierta en `from`. */
function matchBrace(src, from) {
  let depth = 0;
  let i = from;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const end = src.indexOf(ch, i + 1);
      if (end < 0) return -1;
      i = end + 1;
      continue;
    }
    if (ch === "`") {
      i = scanTemplate(src, i);
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") {
      depth++;
      i++;
      continue;
    }
    if (ch === ")" || ch === "]" || ch === "}") {
      if (depth === 0) return ch === "}" ? i : -1;
      depth--;
      i++;
      continue;
    }
    i++;
  }
  return -1;
}

/**
 * Fin de la expresión que empieza en `from` (hasta `;` o salto de línea).
 *
 * Un salto de línea NO cierra la expresión si la línea siguiente CONTINÚA la
 * anterior (`.map(`, `,`, `+`, `??`, `&&`…): el caso real es
 *     const mainSrc = mainProcessFiles(mainRoot)
 *       .map((abs) => `…${readFileSync(abs, "utf-8")}`)
 *       .join("\n");
 * donde la lectura vive en una línea posterior a la declaración.
 */
function statementEnd(src, from) {
  let depth = 0;
  let i = from;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const end = src.indexOf(ch, i + 1);
      if (end < 0) return src.length;
      i = end + 1;
      continue;
    }
    if (ch === "`") {
      i = scanTemplate(src, i);
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") {
      depth++;
      i++;
      continue;
    }
    if (ch === ")" || ch === "]" || ch === "}") {
      if (depth === 0) return i;
      depth--;
      i++;
      continue;
    }
    if (ch === ";" && depth === 0) return i;
    if (ch === "\n" && depth === 0) {
      // ¿la siguiente línea continúa la expresión?
      let j = i + 1;
      while (j < src.length && (src[j] === " " || src[j] === "\t" || src[j] === "\r")) j++;
      const next = src[j];
      const continua =
        next === "." ||
        next === "," ||
        next === "?" ||
        next === ":" ||
        next === "(" ||
        next === "[" ||
        next === "+" ||
        next === "=" ||
        next === "&" ||
        next === "|" ||
        next === "!" ||
        next === "?" ||
        next === ">" ||
        next === "<";
      if (!continua) return i;
      i = j;
      continue;
    }
    i++;
  }
  return src.length;
}

/* ─────────────────────── helpers que devuelven texto ─────────────────────── */

/**
 * Nombres de las funciones locales que DEVUELVEN el resultado de una lectura.
 * (Si la lectura se pasa a un parser y lo que se devuelve es un AST, la
 * función NO es una lectura de texto → no se cuenta.)
 */
function helperReaders(src) {
  const readers = new Set();

  const returnsARead = (body) => {
    const re = /\breturn\b/g;
    let m;
    while ((m = re.exec(body)) !== null) {
      const expr = body.slice(m.index + 6, statementEnd(body, m.index + 6));
      if (READ_RE.test(expr)) return true;
    }
    return false;
  };

  // `function NAME(...) { ... }`
  const fnRe = /\bfunction\s+([A-Za-z0-9_$]+)\s*\(/g;
  let m;
  while ((m = fnRe.exec(src)) !== null) {
    const paren = src.indexOf("(", m.index);
    const close = matchParen(src, paren + 1);
    if (close < 0) continue;
    const brace = src.indexOf("{", close);
    if (brace < 0) continue;
    const end = matchBrace(src, brace + 1);
    if (end < 0) continue;
    if (returnsARead(src.slice(brace + 1, end))) readers.add(m[1]);
  }

  // `const NAME = (...) => EXPR;`  |  `const NAME = (...) => { ... }`
  const arrowRe = /\b(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(/g;
  while ((m = arrowRe.exec(src)) !== null) {
    // `m[0]` termina en `(`: el índice DESPUÉS del paréntesis es donde empieza
    // el contenido que hay que emparejar.
    const close = matchParen(src, m.index + m[0].length);
    if (close < 0) continue;
    let i = close + 1;
    // se salta el tipo de retorno (`: string`)
    while (
      i < src.length &&
      src.slice(i, i + 2) !== "=>" &&
      src[i] !== ";" &&
      src[i] !== "\n"
    ) {
      i++;
    }
    if (src.slice(i, i + 2) !== "=>") continue;
    i += 2;
    // cuerpo de bloque
    const braceAt = src.indexOf("{", i);
    const end = statementEnd(src, i);
    const brace = braceAt >= 0 && braceAt < end ? braceAt : -1;
    if (brace >= 0) {
      const closeBrace = matchBrace(src, brace + 1);
      if (closeBrace < 0) continue;
      if (returnsARead(src.slice(brace + 1, closeBrace))) readers.add(m[1]);
    } else {
      const expr = src.slice(i, end);
      if (READ_RE.test(expr)) readers.add(m[1]);
    }
  }

  return readers;
}

/* ─────────────────────── variables de fuente ─────────────────────── */

/**
 * Variables cuya expresión asignada contiene una lectura (directa o vía
 * helper). Devuelve un Map<nombre, { line, stmt, helper, lectura }>.
 */
function sourceVars(src, testFileAbs, pathVars) {
  const readers = helperReaders(src);
  const out = new Map();
  const declRe = /\b(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=/g;
  let m;
  while ((m = declRe.exec(src)) !== null) {
    const name = m[1];
    const exprStart = m.index + m[0].length;
    const end = statementEnd(src, exprStart);
    const expr = src.slice(exprStart, end);
    const helper = [...readers].find((r) => new RegExp(`\\b${r}\\s*\\(`).test(expr));
    const direct = READ_RE.test(expr);
    if (!direct && !helper) continue;
    out.set(name, {
      line: src.slice(0, m.index).split(/\r?\n/).length,
      stmt: expr.replace(/\s+/g, " ").trim().slice(0, 200),
      helper: helper ?? null,
      lectura: clasificarLectura(expr, testFileAbs, pathVars),
    });
  }
  return out;
}

/* ───────────────────────────── asserts ───────────────────────────── */

/** `expect(<arg>).<matcher>(` → lista de { arg, matcher, negated, index }. */
function findAsserts(src) {
  const out = [];
  let idx = 0;
  while ((idx = src.indexOf("expect(", idx)) >= 0) {
    const argStart = idx + "expect(".length;
    const argEnd = matchParen(src, argStart);
    if (argEnd < 0) {
      idx = argStart;
      continue;
    }
    const arg = src.slice(argStart, argEnd);
    const rest = src.slice(argEnd + 1);
    const m = /^\s*\.\s*(not\s*\.\s*)?([A-Za-z]+)\s*\(/.exec(rest);
    if (m && MATCHERS.has(m[2])) {
      out.push({
        arg: arg.replace(/\s+/g, " ").trim().slice(0, 160),
        matcher: m[2],
        negated: Boolean(m[1]),
        index: argStart,
      });
    }
    idx = argEnd + 1;
  }
  return out;
}

/* ───────────────────────────── barrido ───────────────────────────── */

const files = [];
for (const d of SCAN_DIRS) walk(join(ROOT, d), files);
files.sort();

const findings = [];
for (const abs of files) {
  const rel = relative(ROOT, abs).replace(/\\/g, "/");
  const src = readFileSync(abs, "utf8");

  const pvars = pathVars(src);
  const vars = sourceVars(src, abs, pvars);

  const asserts = findAsserts(src);
  if (asserts.length === 0) continue;

  const detail = [];
  for (const a of asserts) {
    // ¿el argumento del assert depende de una variable de fuente?
    let viaVar = null;
    for (const [name, info] of vars) {
      if (new RegExp(`\\b${name}\\b`).test(a.arg)) {
        viaVar = name;
        break;
      }
    }
    const viaRead = READ_RE.test(a.arg);
    if (!viaVar && !viaRead) continue;
    const linea = src.slice(0, a.index).split(/\r?\n/).length;
    const info = viaVar ? vars.get(viaVar) : null;
    const lectura = viaRead
      ? clasificarLectura(a.arg, abs, pvars)
      : (info?.lectura ?? { tipo: "dinamica", ruta: null });
    detail.push({
      line: linea,
      text: a.arg.slice(0, 120),
      matcher: a.matcher,
      negated: a.negated,
      via: viaVar ?? "lectura directa",
      helper: info?.helper ?? null,
      tipo: lectura.tipo,
      ruta: lectura.ruta,
    });
  }

  if (detail.length > 0) {
    findings.push({
      file: rel,
      zone: zoneOf(rel),
      hits: detail.length,
      tautologicos: detail.filter((d) => d.tipo === "codigo-repo").length,
      detail,
    });
  }
}

findings.sort((a, b) => b.hits - a.hits);
const byZone = {};
const byTipo = { "codigo-repo": 0, "dato-repo": 0, dinamica: 0 };
for (const f of findings) {
  byZone[f.zone] = (byZone[f.zone] ?? 0) + f.hits;
  for (const d of f.detail) byTipo[d.tipo] = (byTipo[d.tipo] ?? 0) + 1;
}

if (process.argv.includes("--json")) {
  console.log(
    JSON.stringify(
      {
        total: findings.length,
        asserts: findings.reduce((n, f) => n + f.hits, 0),
        tautologicos: byTipo["codigo-repo"],
        byZone,
        byTipo,
        findings,
      },
      null,
      2,
    ),
  );
} else {
  const total = findings.reduce((n, f) => n + f.hits, 0);
  console.log(
    `[inventory-tautological] ${findings.length} fichero(s) con asserts sobre texto de fuente ` +
      `(${total} assert(s) en total)`,
  );
  console.log(`[inventory-tautological] asserts por zona: ${JSON.stringify(byZone)}`);
  console.log(
    `[inventory-tautological] TAUTOLÓGICOS (texto del CÓDIGO BAJO PRUEBA, fichero del repo): ${byTipo["codigo-repo"]}` +
      ` · dato del repo: ${byTipo["dato-repo"]} · ruta dinámica (no decidible): ${byTipo.dinamica}`,
  );
  for (const f of findings) {
    console.log(
      `\n${f.file}  [${f.zone}]  (${f.hits}${f.tautologicos ? ` · ${f.tautologicos} tautológicos` : ""})`,
    );
    for (const d of f.detail) {
      console.log(
        `   ${d.line}: ${d.text}  ← ${d.via}${d.helper ? ` (helper ${d.helper})` : ""}` +
          ` [${d.tipo}${d.ruta ? `: ${d.ruta}` : ""}]`,
      );
    }
  }
}
