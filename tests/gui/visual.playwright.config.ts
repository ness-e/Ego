import { defineConfig, devices } from "@playwright/test";

// STAB-11 — Baselines visuales del shell (chromium).
//
// Config SEPARADA de `playwright.config.ts` (suite GUI contra dev-server
// manual del owner — contrato T22: "NO hay webServer auto-start") y de
// `electron.playwright.config.ts` (smoke Electron real): esta levanta su
// propio `webServer` (vite dev del renderer) para ser autocontenida en CI,
// y solo recolecta `14-visual.spec.ts`.
//
// Contrato: 3 `toHaveScreenshot` en chromium con `maxDiffRatio 0.02` →
// campo canónico Playwright `maxDiffPixelRatio: 0.02` (ratio 0..1).
// `snapshotPathTemplate` con `{platform}`: baselines por-OS
// (`...-win32.png`, `...-linux.png`, `...-darwin.png`) porque el
// rasterizado de fuentes difiere entre DirectWrite/CoreText/FreeType.
// `animations: "disabled"` + `caret: "hide"` para determinismo.
export default defineConfig({
  testDir: "./specs",
  testMatch: ["**/14-visual.spec.ts"],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 120_000,
  reporter: [["list"], ["html", { open: "never" }]],
  snapshotPathTemplate:
    "{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}-{projectName}-{platform}{ext}",
  expect: {
    timeout: 30_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
      caret: "hide",
      scale: "css",
    },
  },
  webServer: {
    command: "pnpm --filter @ego/renderer dev",
    url: "http://127.0.0.1:5173",
    cwd: "../..",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
