import { defineConfig } from "@playwright/test";

// E2E Electron mínimo — shell smoke (docs/engineering/testing-e2e.md).
//
// Lanza el Electron real contra el bundle compilado
// `apps/desktop/out/main/main.js` (NO levanta dev-server ni firma ni
// empaqueta; no requiere VantaDB real — vale el stub de CI).
// Config separada de `playwright.config.ts` (suite GUI contra dev-server):
// esta usa testDir `./electron` + testMatch `*.electron.ts` para que ni
// vitest (`pnpm test:e2e`, que solo entiende `*.test.ts`/`*.spec.ts`) ni la
// suite GUI recolecten estos archivos.
export default defineConfig({
  testDir: "./electron",
  testMatch: ["**/*.electron.ts"],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  // El arranque de Electron + carga del bundle es lento: margen amplio.
  timeout: 180_000,
  reporter: [["list"]],
  expect: {
    timeout: 30_000,
  },
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
