import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

// T11 (S6) — Loop unificado bajo electron-vite (migración desde
// tsc + concurrently + wait-on + scripts/dev-electron.cjs).
// Layout de salida: out/main + out/preload + out/renderer (defaults
// explícitos). Rollback: revertir el commit de migración vuelve a tsc+concurrently.
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/main",
      rollupOptions: {
        // Entradas reales del repo (no el default src/main/index.ts).
        input: "src/main.ts",
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/preload",
      rollupOptions: {
        input: "src/preload.ts",
      },
    },
  },
  renderer: {
    root: resolve(process.cwd(), "renderer"),
    base: "./",
    plugins: [react(), tailwindcss()],
    // T7 (EGO-FIND-58): el worker de Shiki usa módulos ES (`type: "module"`).
    // El default de Vite para workers es `iife`, que NO admite code-splitting:
    // el bundle de Shiki con subconjunto de langs necesita splitting → el
    // build fallaba con `Invalid value "iife" for option "output.format"`.
    // `renderer/vite.config.ts` ya declaraba `worker.format: "es"`.
    worker: {
      format: "es",
    },
    build: {
      outDir: resolve(process.cwd(), "out/renderer"),
      emptyOutDir: true,
      // DIST-03: mismo code-splitting que renderer/vite.config.ts
      // (budget de chunks auditado por scripts/verify-dist.cjs).
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        // WIDG-02 (Task3): MPA — `index.html` (app) + `floating/floating.html`
        // (isla; la carga FloatingWindowView.loadContent en dev y prod).
        input: {
          index: resolve(process.cwd(), "renderer/index.html"),
          floating: resolve(process.cwd(), "renderer/floating/floating.html"),
        },
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("@assistant-ui")) return "vendor-assistant";
            if (id.includes("node_modules/recharts")) return "vendor-charts";
            if (id.includes("node_modules/@phosphor-icons")) return "vendor-icons";
            if (id.includes("node_modules/@tanstack")) return "vendor-table";
            if (id.includes("node_modules/motion") || id.includes("node_modules/framer-motion")) return "vendor-motion";
            if (id.includes("node_modules/zod")) return "vendor-zod";
            // T6 (EGO-FIND-57): CodeMirror 6 (~1.05 MB con sus gramáticas) se
            // colaba en el chunk `CanvasRuntime` porque `registry.ts` importa
            // estáticamente `EditorView`. Sin chunk propio, ese bundle
            // superaba el budget de 1 MB de `scripts/verify-dist.cjs`.
            //
            // El corte es POR FAMILIA (no por submódulo) para no generar un
            // chunk circular: `@codemirror/*` → `vendor-codemirror` y
            // `@lezer/*` (los parsers) → `vendor-lezer`. La dependencia es
            // unidireccional (`@codemirror` → `@lezer`), así que no hay ciclo.
            if (id.includes("@lezer")) return "vendor-lezer";
            if (id.includes("@codemirror") || id.includes("style-mod")) {
              return "vendor-codemirror";
            }
            if (id.includes("floating/vendor/avatar") || id.includes("components/character")) return "vendor-avatar";
            if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
              return "vendor-react";
            }
            return undefined;
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": resolve(process.cwd(), "./renderer/src"),
        // T5 / A6 (VERDICT): motor de personaje desde el PAQUETE
        // `@ego/avatar` (fuente canónica, ADR-0018). Alias al código fuente
        // hasta que A7 cierre el lockfile con el enlace de workspace
        // (`workspace:*` ya declarado en `renderer/package.json`). El
        // espejo vendorizado sigue siendo el fallback.
        "@ego/avatar/runtime/avatar-element.js": resolve(
          process.cwd(),
          "../../packages/avatar/src/runtime/avatar-element.js"
        ),
        "@ego/avatar": resolve(process.cwd(), "../../packages/avatar/src"),
      },
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: false,
    },
  },
});
