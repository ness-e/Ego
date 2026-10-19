/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  worker: {
    format: "es",
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // DIST-03: code-splitting por vendor. Baseline: chunk único
    // index-*.js de 1 483 537 bytes. La app es monolítica (sin lazy
    // routes), así que se parte por librería pesada para aislar
    // invalidación de caché y dejar el chunk de app por debajo del budget.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Forma función (no objeto): asignación determinista por
        // segmento de paquete. Orden: específicos primero — '@assistant-ui'
        // contiene el substring '/react/' y debe matchear antes que react.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // Específicos primero ('@assistant-ui' contiene '/react/').
          if (id.includes('@assistant-ui/react-syntax-highlighter')) return 'vendor-highlight';
          if (id.includes('@assistant-ui')) return 'vendor-assistant';
          if (id.includes('node_modules/recharts')) return 'vendor-charts';
          if (id.includes('node_modules/@phosphor-icons')) return 'vendor-icons';
          if (id.includes('node_modules/@tanstack')) return 'vendor-table';
          if (id.includes('shiki') || id.includes('@shikijs')) return 'vendor-shiki';
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) return 'vendor-motion';
          if (id.includes('prosemirror')) return 'vendor-prosemirror';
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
            return 'vendor-react';
          }
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./test/setup.ts"],
    // Coverage opt-in (`vitest run --coverage`): NO se ejecuta en CI
    // `verify` (sin flag --coverage), así que no puede romper el build
    // actual. Objetivo 70% para archivos NUEVOS; un threshold global
    // exigible rompería la línea base existente (ver
    // docs/engineering/testing-e2e.md § Coverage).
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
