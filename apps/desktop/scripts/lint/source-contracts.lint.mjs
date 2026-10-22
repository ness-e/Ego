#!/usr/bin/env node
/**
 * EGO-FIND-63 (Ola 10 · A4) — Contratos de **fuente** (lint-test).
 *
 * ## Qué es esto
 * Hay contratos que NO se pueden comprobar con comportamiento: son
 * **acuerdos sobre la FORMA del código**, no sobre lo que el código hace.
 * Ejemplo: "el worker de Shiki no puede importar el bundle completo de
 * `shiki`" (10 MB de grammars) — el comportamiento observable (resaltar
 * código) es idéntico con las dos formas; lo que cambia es el **tamaño del
 * bundle".
 *
 * Esos contratos estaban escritos como `expect(fuente).toContain(...)`
 * dentro de un `*.test.tsx` → el **inventario de asertos tautológicos**
 * (`scripts/inventory-tautological-tests.mjs`) los contaba como tests que
 * no prueban nada: un aserto de texto de fuente no falla cuando el
 * producto se rompe, sólo cuando alguien reescribe el fichero.
 *
 * ## La regla que aplico
 * Un contrato de fuente va **aquí** (un ejecutable que falla con exit 1), no
 * en un `*.test.*`:
 * - sigue Being un guard que CI puede ejecutar (igual de estricto);
 * - deja de contaminar el recuento de asertos tautológicos, que vuelve a
 *   medir de verdad (comportamiento).
 *
 * Uso: `node apps/desktop/scripts/lint/source-contracts.lint.mjs`
 * (exit 1 = un contrato violado).
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DESKTOP = resolve(HERE, "..", "..");
const RENDERER = join(DESKTOP, "renderer");

/** @type {{file: string; describe: string; check: (src: string) => boolean}[]} */
const CONTRACTS = [
  {
    // 1) `DomainCanvasView` resuelve por `componentKind` contra el registry
    //    dinámico: NO puede tener ramas `domainId === "…"`.
    file: join(RENDERER, "components", "domains", "DomainCanvasView.tsx"),
    describe: "DomainCanvasView no tiene ramas hardcodeadas por domainId",
    check: (src) => !/domainId\s*===\s*["']/.test(src),
  },
  {
    // 2) El worker de Shiki usa `shiki/core` (subconjunto), nunca el
    //    bundle completo (`shiki` = todos los lenguajes y temas, ~10 MB).
    file: join(RENDERER, "workers", "shiki.worker.ts"),
    describe: "el worker de Shiki usa shiki/core (no el bundle completo)",
    check: (src) =>
      src.includes("shiki/core") && !/from\s+["']shiki["']/.test(src),
  },
  {
    // 3) El entry del worker ES un módulo ES (`self.onmessage`) y el host lo
    //    instancia como módulo (`type: "module"`): con `format: "iife"` (el
    //    default de Vite) el build falla al code-splitear el worker.
    file: join(RENDERER, "workers", "shiki.worker.ts"),
    describe: "el entry del worker de Shiki es un módulo ES",
    check: (src) => /self\.(onmessage|postMessage)/.test(src),
  },
  {
    file: join(RENDERER, "components", "assistant-ui", "shiki-highlight.tsx"),
    describe: "el host del worker de Shiki lo instancia como módulo",
    check: (src) => /type:\s*["']module["']/.test(src),
  },
  {
    // 4) El resumidor real se crea sobre el ModelRouter (en el arranque).
    file: join(DESKTOP, "src", "main", "window", "create-window.ts"),
    describe: "el resumidor se crea sobre el ModelRouter",
    check: (src) => src.includes("createRouterSummarizer"),
  },
  {
    // 5) El job de compactación lo recibe en sus opciones.
    file: join(DESKTOP, "src", "main", "llm", "handle-llm-stream.ts"),
    describe: "el job de compactación recibe el resumidor",
    check: (src) => /summarizer:\s*ctx\.compactionSummarizer/.test(src),
  },
  {
    // 6) Y se crea DESPUÉS del router (necesita los proveedores registrados).
    file: join(DESKTOP, "src", "main", "window", "create-window.ts"),
    describe: "el resumidor se crea después del router",
    check: (src) => {
      const iRouter = src.indexOf("setModelRouter(new ModelRouter())");
      const iSummarizer = src.indexOf("createRouterSummarizer(modelRouter");
      return iRouter > -1 && iSummarizer > iRouter;
    },
  },
  {
    // 7) El contexto expone el resumidor en vivo (getter, no copia).
    file: join(DESKTOP, "src", "main.ts"),
    describe: "el contexto expone el resumidor en vivo (getter)",
    check: (src) => /get compactionSummarizer\(\)/.test(src),
  },
  {
    // 8) EGO-FIND-103 (Ola 10): la escala de motion es la del sistema
    //    (`--motion-duration-*` / `--motion-ease-*`), no los defaults
    //    sueltos de Tailwind (`duration-150`, `ease-in`…). Es un contrato
    //    de FORMA: el comportamiento es idéntico con cualquiera de las dos
    //    formas; lo que cambia es que TODO el producto se mueva igual.
    file: join(RENDERER, "components", "ui-kit", "Menu.tsx"),
    describe: "las duraciones usan los tokens de motion del sistema",
    check: (src) => !/\bduration-\d{2,3}\b/.test(src),
  },
  {
    file: join(RENDERER, "components", "ui-kit", "Popover.tsx"),
    describe: "las duraciones usan los tokens de motion del sistema",
    check: (src) => !/\bduration-\d{2,3}\b/.test(src),
  },
  {
    file: join(RENDERER, "components", "ui-kit", "Tooltip.tsx"),
    describe: "las duraciones usan los tokens de motion del sistema",
    check: (src) => !/\bduration-\d{2,3}\b/.test(src),
  },
  {
    file: join(RENDERER, "components", "ui-kit", "Select.tsx"),
    describe: "las duraciones usan los tokens de motion del sistema",
    check: (src) => !/\bduration-\d{2,3}\b/.test(src),
  },
  {
    file: join(RENDERER, "components", "ui-kit", "Switch.tsx"),
    describe: "las duraciones usan los tokens de motion del sistema",
    check: (src) => !/\bduration-\d{2,3}\b/.test(src),
  },
  {
    file: join(RENDERER, "components", "PaneShell.tsx"),
    describe: "las duraciones usan los tokens de motion del sistema",
    check: (src) => !/\bduration-\d{2,3}\b/.test(src),
  },
];

let failed = 0;
for (const contract of CONTRACTS) {
  const rel = contract.file.replace(DESKTOP + "\\", "").replace(/\\/g, "/");
  if (!existsSync(contract.file)) {
    console.error(`  ✗ ${rel}: el fichero no existe (el contrato no se puede comprobar)`);
    failed++;
    continue;
  }
  const src = readFileSync(contract.file, "utf8");
  if (contract.check(src)) {
    console.log(`  ✓ ${rel} — ${contract.describe}`);
  } else {
    console.error(`  ✗ ${rel} — ${contract.describe}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(
    `\n[source-contracts] ${failed} contrato(s) de fuente violado(s).`
  );
  process.exit(1);
}
console.log(`\n[source-contracts] ${CONTRACTS.length} contratos de fuente: todos OK.`);
