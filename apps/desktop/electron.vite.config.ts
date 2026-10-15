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
      },
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
    },
  },
});
