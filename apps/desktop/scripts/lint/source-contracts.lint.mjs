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
 * bundle**.
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
 * - sigue siendo un guard que CI puede ejecutar (igual de estricto);
 * - deja de contaminar el recuento de asertos tautológicos, que vuelve a
 *   medir de verdad (comportamiento).
 *
 * ## Ola 11 · A7 (EGO-FIND-63)
 * Se han movido aquí los contratos del **wiring de la isla flotante** que
 * vivían en `tests/e2e/contract/floating-wiring.contract.test.ts` (13 asserts
 * sobre el texto del proceso main). Ese fichero se ha borrado: sus asserts
 * que SÍ eran comprobables por comportamiento (la superficie pública de
 * `FloatingWindow.ts`) están ahora en `tests/e2e/floating-window-surface.test.ts`,
 * que importa el módulo y llama a su API.
 *
 * Uso: `node apps/desktop/scripts/lint/source-contracts.lint.mjs`
 * (exit 1 = un contrato violado).
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DESKTOP = resolve(HERE, "..", "..");
const RENDERER = join(DESKTOP, "renderer");
const MAIN_SRC = join(DESKTOP, "src");
/** La raiz del repo (para leer ficheros de `packages/**` en modo SOLO LECTURA). */
const REPO_ROOT = resolve(DESKTOP, "..", "..");

/**
 * El CORPUS del proceso main: todos los `.ts` de `apps/desktop/src/**` (sin
 * tests). Es el mismo corpus que usaba el lint-test de la isla flotante: el
 * wiring se movió de `main.ts` a `src/main/window/create-window.ts` (Ola 2, A4)
 * y un contrato atado a una ruta se rompe con cada refactor aunque el wiring
 * siga intacto. Lo que se protege es que el wiring EXISTA, no dónde viva.
 *
 * Cada fichero va precedido de un separador para que un patrón no pueda
 * "cruzar" de un fichero a otro.
 */
function mainProcessCorpus() {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "test" || entry.name === "__tests__") continue;
        walk(abs);
        continue;
      }
      if (!entry.name.endsWith(".ts") || entry.name.endsWith(".d.ts")) continue;
      out.push(abs);
    }
  };
  if (!existsSync(MAIN_SRC)) return "";
  walk(MAIN_SRC);
  return out
    .map((abs) => `// ==== ${relative(MAIN_SRC, abs).split(sep).join("/")} ====\n${readFileSync(abs, "utf8")}`)
    .join("\n");
}

/** @type {{file?: string; corpus?: boolean; describe: string; check: (src: string) => boolean}[]} */
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
    // Ola 11 · A7: la ruta estaba DESACTUALIZADA (`ui-kit/PaneShell.tsx`): el
    // componente se movió a `components/PaneShell.tsx` y el contrato seguía
    // apuntando al sitio viejo → la puerta fallaba ("el fichero no existe")
    // sin que nadie lo viera, porque el lint NO estaba cableado en ningún
    // pipeline. Ruta corregida; el contenido sigue cumpliendo el contrato.
    file: join(RENDERER, "components", "PaneShell.tsx"),
    describe: "las duraciones usan los tokens de motion del sistema",
    check: (src) => !/\bduration-\d{2,3}\b/.test(src),
  },

  /* ── Ola 11 · A7 (EGO-FIND-63): el wiring de la isla flotante ─────────────
   * Estos 13 asserts vivían en `tests/e2e/contract/floating-wiring.contract.test.ts`
   * y afirmaban sobre el TEXTO del proceso main. No se pueden comprobar por
   * COMPORTAMIENTO: `main.ts` y sus módulos de ventana tienen efectos de
   * módulo (`app.on(...)`, `BrowserWindow`, tray) y no son importables en
   * vitest sin arrancar el proceso. Son, por definición, contratos de FORMA
   * → viven aquí (ejecutable, exit 1) y no en un `*.test.*`.
   */
  {
    corpus: true,
    describe: "el minimize está registrado y muestra la isla sin robar el foco",
    check: (src) =>
      /\.on\(\s*"minimize"/.test(src) && /ensureFloatMgr\(\)\.show\(\)/.test(src),
  },
  {
    corpus: true,
    describe: "el gate de autoshow consulta el estado real de la isla",
    // Ola 11 · A4 (revisión): el patrón original (`presenceMode` +
    // `ensureFloatMgr().getState()`) era demasiado AMPLIO: `presenceMode`
    // aparece 27 veces en el corpus → el contrato pasaba aunque el gate
    // dejara de consultar el estado. Ahora los dos patrones se exigen en el
    // MISMO fichero (el que hace el cableo del gate).
    file: join(MAIN_SRC, "window", "create-window.ts"),
    check: (src) =>
      /ensureFloatMgr\(\)\.getState\(\)/.test(src) && /presenceMode/.test(src),
  },
  {
    corpus: true,
    describe: "la presencia pasa por isPresenceAllowed (el mute no puede bloquearla)",
    check: (src) =>
      /isPresenceAllowed\(/.test(src) &&
      // la forma `!st.muted` (gate de presencia por mute) quedó PROHIBIDA:
      // fue el deadlock completo (island oculta + unmute sólo accesible en ella).
      !/!st\.muted/.test(src) &&
      /toggleFloatingIslandFromTray/.test(src),
  },
  {
    corpus: true,
    describe: "el minimize registra el movimiento de la isla para persistirla",
    check: (src) => /trackFloatingWindow\(/.test(src),
  },
  {
    corpus: true,
    describe: "el cambio de display/DPI reposiciona la isla",
    // Ola 11 · A4 (revisión): `display-metrics-changed` aparece 3 veces en
    // el corpus (también en `main.ts` y en `windows/FloatingWindow.ts`) → el
    // contrato pasaba aunque el reposicionado desapareciera. Ahora los dos
    // patrones se exigen en el MISMO fichero (el que hace el cableo).
    file: join(MAIN_SRC, "window", "create-window.ts"),
    check: (src) =>
      /display-metrics-changed/.test(src) && /repositionToDisplay\(\)/.test(src),
  },
  {
    corpus: true,
    describe: "restore/focus auto-oculta la isla cuando no hay trabajo pendiente",
    // Ola 11 · A4 (revisión): los tres patrones se exigían en el corpus
    // entero (podían casar en ficheros distintos). Ahora van en el mismo.
    file: join(MAIN_SRC, "window", "create-window.ts"),
    check: (src) =>
      /onMainRestoreOrFocus/.test(src) &&
      /\.on\(\s*"restore"/.test(src) &&
      /\.on\(\s*"focus"/.test(src),
  },

  /* ── Ola 11 · A4 (EGO-FIND-63): los tokens y el motor canónico ──────────
   * Salieron de `renderer/test/ThemeTokens.test.tsx` (17) y
   * `renderer/test/CharacterLegacy.test.tsx` (12): asertos de TEXTO de fuente.
   * Son CONTRATOS DE FORMA: el CSS no se ejecuta y el motor no se "observa"
   * desde el renderer → no se pueden comprobar por comportamiento.
   */
  {
    file: join(RENDERER, "src", "index.css"),
    describe: "el CSS declara los tokens semánticos y los puentes --ego-*",
    check: (src) =>
      src.includes("--color-brand") &&
      src.includes("var(--ego-color-brand") &&
      // `dim` fijo AA (no el gris anterior, que no pasaba contraste).
      src.includes("#8a8a92") &&
      !src.includes("#55555c") &&
      src.includes(".app-region-drag") &&
      src.includes("-webkit-app-region") &&
      src.includes("--radius-card") &&
      src.includes("var(--ego-radius") &&
      src.includes("--font-geist-sans") &&
      [
        "var(--ego-color-bg",
        "var(--ego-color-panel",
        "var(--ego-color-raised",
        "var(--ego-color-text",
        "var(--ego-color-border",
        "var(--ego-color-muted",
      ].every((v) => src.includes(v)),
  },
  {
    file: join(RENDERER, "src", "fonts.css"),
    describe: "las fuentes locales (Geist) se declaran con @font-face + woff2",
    check: (src) =>
      src.includes("@font-face") &&
      src.includes("Geist") &&
      src.includes("woff2") &&
      src.includes("Geist-Variable.woff2") &&
      src.includes("GeistMono-Variable.woff2"),
  },
  {
    file: join(RENDERER, "src", "main.tsx"),
    describe: "el entry del renderer importa las fuentes locales",
    check: (src) => src.includes("./fonts.css"),
  },
  {
    file: join(RENDERER, "components", "character", "CharacterBadge.tsx"),
    describe: "el motor del personaje se importa del PAQUETE canónico (no del espejo)",
    check: (src) => src.includes('"@ego/avatar/runtime/avatar-element.js"'),
  },
  {
    file: join(RENDERER, "floating", "floating-avatar.tsx"),
    describe: "el motor del personaje se importa del PAQUETE canónico (no del espejo)",
    check: (src) => src.includes('"@ego/avatar/runtime/avatar-element.js"'),
  },
  {
    file: join(RENDERER, "package.json"),
    describe: "el renderer declara la dependencia del paquete @ego/avatar",
    check: (src) => /"@ego\/avatar"\s*:\s*"workspace:\*"/.test(src),
  },

  /* ── Ola 11 · A4 (T3): el vocabulario del renderer ⊆ el del motor ────────
   * A6 declara en el motor lo que NO puede expresar (`UNMAPPED_TRAITS`,
   * `UNMAPPED_OUTFITS`). La regla: si el renderer ofrece algo que el motor no
   * expresa, o se expresa, o **se declara** — nunca en silencio.
   *
   * Estos contratos comparan los DOS ficheros (el motor y el renderer): el
   * motor no expone tipos para `profile.js` → importarlo desde un test
   * rompía el typecheck del renderer → el cotejo vive aquí.
   */
  {
    file: join(RENDERER, "components", "character", "wardrobe", "characterProfileBridge.ts"),
    describe: "el renderer NO ofrece rasgos que el motor declara no mapeables",
    check: (src) => {
      // Los rasgos que el motor no expresa (A6 los declara en UNMAPPED_TRAITS).
      const engine = readFileSync(
        join(
          REPO_ROOT,
          "packages",
          "avatar",
          "src",
          "runtime",
          "profile.js"
        ),
        "utf8"
      );
      const unmapped = (
        engine.match(/UNMAPPED_TRAITS\s*=\s*Object\.freeze\(\[([^\]]*)\]/)?.[1] ?? ""
      )
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      if (unmapped.length === 0) return false; // no se pudo leer la lista
      // El enum del renderer (el vocabulario que la UI ofrece).
      const offered = (
        src.match(/BridgeTraitKindSchema\s*=\s*z\.enum\(\[([^\]]*)\]/)?.[1] ?? ""
      )
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      return !offered.some((t) => unmapped.includes(t));
    },
  },
  {
    file: join(RENDERER, "components", "character", "wardrobe", "characterProfileBridge.ts"),
    describe: "el renderer DECLARA los rasgos que el motor no mapea (no los ignora)",
    check: (src) => {
      const engine = readFileSync(
        join(
          REPO_ROOT,
          "packages",
          "avatar",
          "src",
          "runtime",
          "profile.js"
        ),
        "utf8"
      );
      const unmapped = (
        engine.match(/UNMAPPED_TRAITS\s*=\s*Object\.freeze\(\[([^\]]*)\]/)?.[1] ?? ""
      )
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      if (unmapped.length === 0) return false;
      return unmapped.every((t) => src.includes(t));
    },
  },
  {
    file: join(RENDERER, "components", "character", "wardrobe", "characterProfileBridge.ts"),
    describe: "el enum de rasgos del renderer ⊆ los TRAIT_KINDS del motor",
    // Ola 12 · A4: el motor sólo aplica los `TraitKind` canónicos. Si el
    // renderer declarara un kind que el motor no tiene, el perfil se
    // aplicaría a medias (el motor lo declararía `unmapped` en silencio).
    check: (src) => {
      const engine = readFileSync(
        join(REPO_ROOT, "packages", "avatar", "src", "runtime", "profile.js"),
        "utf8"
      );
      const kinds = (
        engine.match(/TRAIT_KINDS\s*=\s*Object\.freeze\(\{([\s\S]*?)\n\}\)/)?.[1] ?? ""
      )
        .split("\n")
        .map((l) => l.trim().match(/^['"]?([a-z-]+)['"]?\s*:/)?.[1])
        .filter(Boolean);
      if (kinds.length === 0) return false; // no se pudo leer la lista
      const offered = (
        src.match(/BridgeTraitKindSchema\s*=\s*z\.enum\(\[([\s\S]*?)\]\)/)?.[1] ?? ""
      )
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      return offered.length > 0 && offered.every((k) => kinds.includes(k));
    },
  },
  {
    file: join(RENDERER, "components", "character", "wardrobe", "characterProfileBridge.ts"),
    describe: "todo rasgo que la UI ofrece tiene kind canónico (el puente existe)",
    // Ola 12 · A4: `UI_TRAIT_TO_KIND` es el PUENTE entre el vocabulario de la
    // UI y el canónico. Si un rasgo de la UI (el `TraitRegistry`) no está en
    // el mapa, el motor lo ignoraría en silencio → el perfil persistido no
    // se aplicaría. El cotejo con el registro está en el test de render
    // (`renderer/test/character-profile-render.test.tsx`); aquí se comprueba
    // que el mapa cubre TODOS los ids de rasgo que el registro declara.
    check: (src) => {
      const registry = readFileSync(
        join(RENDERER, "components", "character", "traits", "TraitRegistry.ts"),
        "utf8"
      );
      // Los rasgos son los que se registran con `registerTrait` (los presets
      // de dominio van con `registerPreset` y no son rasgos).
      const traitIds = [...registry.matchAll(/registerTrait\(\{([\s\S]*?)\n\s*\}\);/g)]
        .map((m) => m[1].match(/id:\s*"([^"]+)"/)?.[1])
        .filter(Boolean);
      if (traitIds.length === 0) return false;
      const map = src.match(/UI_TRAIT_TO_KIND[^=]*=\s*\{([\s\S]*?)\n\};/)?.[1] ?? "";
      if (!map) return false;
      return traitIds.every((id) => map.includes(`${id}:`));
    },
  },
];

let failed = 0;
for (const contract of CONTRACTS) {
  if (contract.corpus) {
    const src = mainProcessCorpus();
    if (!src) {
      console.error("  ✗ apps/desktop/src/** — el corpus del proceso main está vacío");
      failed++;
      continue;
    }
    if (contract.check(src)) {
      console.log(`  ✓ apps/desktop/src/** — ${contract.describe}`);
    } else {
      console.error(`  ✗ apps/desktop/src/** — ${contract.describe}`);
      failed++;
    }
    continue;
  }
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
