import { defineConfig } from "vitest/config";

// STAB-07: alcance e2e espeja tests/tsconfig.json (e2e/security/chaos).
// tests/gui/specs/*.spec.ts son Playwright (@playwright/test, paquete
// standalone fuera del workspace) y NUNCA deben colectarse aquí:
// sin este exclude, `pnpm test:e2e` falla al resolver @playwright/test.
// Ver docs/engineering/testing-e2e.md § "Alcance de colecta".
export default defineConfig({
  test: {
    include: [
      "e2e/**/*.test.ts",
      "security/**/*.test.ts",
      "chaos/**/*.test.ts",
    ],
    exclude: ["gui/**", "node_modules/**", "dist/**"],
  },
});
