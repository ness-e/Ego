import { defineConfig, devices } from "@playwright/test";

// T22 — Suite GUI de los 13 ítems del checklist T10-Step-3.
// Base URL fija: el renderer Vite en dev (127.0.0.1:5173, ver
// apps/desktop/renderer/vite.config.ts:43-47 — host + strictPort).
// NO hay webServer auto-start: el owner levanta `pnpm dev` a mano
// (la suite nunca levanta Electron por sí misma).
export default defineConfig({
  testDir: "./specs",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
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
