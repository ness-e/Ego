import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // T5 / A6 (Ola 1b): el motor de personaje se importa desde el
      // PAQUETE `@ego/avatar` (fuente canónica, ADR-0018). El alias apunta
      // al código fuente del paquete hasta que A7 cierre el lockfile con el
      // enlace de workspace (`workspace:*` ya declarado en
      // `apps/desktop/package.json` y en `renderer/package.json`).
      "@ego/avatar/runtime/avatar-element.js": resolve(
        __dirname,
        "../../packages/avatar/src/runtime/avatar-element.js"
      ),
      "@ego/avatar/runtime/sound.js": resolve(
        __dirname,
        "../../packages/avatar/src/runtime/sound.js"
      ),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["renderer/**", "node_modules/**", "dist/**"],
  },
});
