/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
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
          if (id.includes('@assistant-ui')) return 'vendor-assistant';
          if (id.includes('node_modules/recharts')) return 'vendor-charts';
          if (id.includes('node_modules/@phosphor-icons')) return 'vendor-icons';
          if (id.includes('node_modules/@tanstack')) return 'vendor-table';
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
  },
});
