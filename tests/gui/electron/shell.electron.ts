// E2E Electron mínimo — shell smoke (docs/engineering/testing-e2e.md).
//
// `_electron.launch` abre el bundle compilado `apps/desktop/out/main/main.js`
// (o `process.env.EGO_ELECTRON_MAIN`) en modo producción (carga el renderer
// desde `out/renderer/index.html`, sin dev-server) y verifica que el shell
// pinta: header Ego + panel Chat + pestaña Canvas (monta `CanvasRuntime`).
// Los diálogos nativos se mockean en el proceso main vía
// `electronApp.evaluate` (retornan "cancelado") para que ningún popup bloquee
// el run en CI. Sin firmas ni VantaDB real (vale el stub de CI).
//
// Sufijo `*.electron.ts` (NO `*.spec.ts`): vitest (`pnpm test:e2e`) recolecta
// por defecto `*.test.ts`/`*.spec.ts` y este archivo importa `playwright`
// (deps standalone de `tests/gui`, instaladas por el owner) — con sufijo
// propio la suite vitest ni lo ve y el CI actual no cambia.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "playwright";
import { test, expect } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, "..", "..");
const DESKTOP_DIR = path.join(REPO_ROOT, "apps", "desktop");

// Bundle del main compilado por `pnpm build` (electron-vite → out/main).
const MAIN_ENTRY =
  process.env.EGO_ELECTRON_MAIN ?? path.join(DESKTOP_DIR, "out", "main", "main.js");

// Binario Electron del workspace (`@ego/desktop` → devDep `electron`).
// Override manual (tarball custom, ruta del runner): ELECTRON_EXECUTABLE.
function defaultElectronExecutable(): string {
  const dist = path.join(DESKTOP_DIR, "node_modules", "electron", "dist");
  if (process.platform === "win32") return path.join(dist, "electron.exe");
  if (process.platform === "darwin")
    return path.join(dist, "Electron.app", "Contents", "MacOS", "Electron");
  return path.join(dist, "electron");
}

// Vista mínima del API de Electron que toca este smoke, tipada a mano para
// no acoplar el test a los tipos internos de playwright.
interface ElectronSmokeApi {
  dialog: {
    showOpenDialog: (...args: never[]) => Promise<unknown>;
    showSaveDialog: (...args: never[]) => Promise<unknown>;
    showMessageBox: (...args: never[]) => Promise<unknown>;
  };
  BrowserWindow: {
    getAllWindows: () => unknown[];
  };
}

test("electron shell: header Ego + Chat + Canvas, sin diálogos nativos", async () => {
  test.skip(
    !fs.existsSync(MAIN_ENTRY),
    `sin bundle compilado: falta ${MAIN_ENTRY} (corre \`pnpm build\` antes)`,
  );
  const executablePath = process.env.ELECTRON_EXECUTABLE ?? defaultElectronExecutable();
  test.skip(
    !fs.existsSync(executablePath),
    `sin binario Electron: falta ${executablePath} (corre \`pnpm install\` en la raíz del repo)`,
  );

  // Aislamiento: perfil Chromium temporal + workspace temporal (no toca el
  // perfil real del owner ni el cwd del repo).
  const userDataDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "ego-e2e-electron-"));
  const workspaceDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "ego-e2e-workspace-"));

  const electronApp = await electron.launch({
    executablePath,
    args: [MAIN_ENTRY, `--user-data-dir=${userDataDir}`],
    // app.getAppPath() === apps/desktop → resuelve out/renderer/index.html.
    cwd: DESKTOP_DIR,
    env: {
      ...process.env,
      // Producción: carga el bundle en disco (sin dev-server) y no abre DevTools.
      NODE_ENV: "production",
      EGO_WORKSPACE_PATH: workspaceDir,
    },
  });
  try {
    // 1. Mock preventivo de diálogos nativos en el proceso MAIN (antes de
    // cualquier interacción que pudiera abrirlos).
    await electronApp.evaluate(async (api: unknown) => {
      const { dialog } = api as ElectronSmokeApi;
      dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
      dialog.showSaveDialog = async () => ({ canceled: true, filePath: "" });
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
    });

    // 2. Señal desde el main (vía evaluate, NO desde el renderer): hay ventana.
    const windowCount = await electronApp.evaluate(async (api: unknown) => {
      const { BrowserWindow } = api as ElectronSmokeApi;
      return BrowserWindow.getAllWindows().length;
    });
    expect(windowCount).toBeGreaterThanOrEqual(1);

    // 3. Shell pinta: header Ego…
    const window = await electronApp.firstWindow({ timeout: 60_000 });
    await window.waitForLoadState("domcontentloaded", { timeout: 60_000 });
    await expect(window.getByText("Ego", { exact: true }).first()).toBeVisible();
    await expect(window.getByText("Cognitive OS").first()).toBeVisible();

    // …panel Chat…
    const chat = window.locator('section[aria-label="Chat"]');
    await expect(chat).toBeVisible();
    await expect(chat.getByText("Chat", { exact: true }).first()).toBeVisible();

    // …y Canvas (la pestaña monta `CanvasRuntime` bajo demanda: el marcador
    // estable es su barra "Superficie Generativa").
    const workspace = window.locator('section[aria-label="Área de trabajo dinámica"]');
    await expect(workspace).toBeVisible();
    await expect(workspace.getByText("Dynamic Workspace").first()).toBeVisible();
    await workspace.getByRole("button", { name: "Canvas" }).click();
    await expect(workspace.getByText("Superficie Generativa").first()).toBeVisible();
  } finally {
    await electronApp.close();
    await fs.promises.rm(userDataDir, { recursive: true, force: true });
    await fs.promises.rm(workspaceDir, { recursive: true, force: true });
  }
});
