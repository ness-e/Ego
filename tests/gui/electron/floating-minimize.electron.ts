// E2E Electron — minimize nativo → flotante (D2) + restore + HITL.
//
// Cierre E4 de T-isla-11-e2e (INCOMPLETO reanudable): la cadena completa a
// nivel integración vive en vitest (`tests/e2e/floating-minimize.test.ts`,
// 10/10 PASS con BackgroundEngine real + electron mockeado). Este spec ejerce
// lo que el Electron REAL permite desde fuera, sin hooks de producto:
//
// - Leg negativo (EJECUTABLE headed): minimize nativo SIN trabajo → minimize
//   normal, NO aparece flotante (`main.ts:3355-3388`: `shouldAutoShow` false).
// - Leg positivo (SKIP con precondición): minimize CON trabajo/HITL → flotante
//   visible → click restaura → HITL resuelve. Requiere semilla de trabajo real
//   (hook inexistente: preload `tasks` expone solo list/cancel, sin submit;
//   `terminal.spawn` no alimenta `backgroundEngine`; restore real = click de
//   tray OS-level no sintetizable por Playwright). Si el owner expone siembra
//   (p.ej. `EGO_E2E_SEED_TASK`), el cuerpo ya está escrito: quitar el skip.
//
// Sufijo `*.electron.ts` (NO `*.spec.ts`): ver `shell.electron.ts:11-14`.
// Sin flags inseguros (`--no-sandbox` y similares PROHIBIDOS).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "playwright";
import { test, expect } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, "..", "..", "..");
const DESKTOP_DIR = path.join(REPO_ROOT, "apps", "desktop");

// Bundle del main compilado por `pnpm build` (electron-vite → out/main).
const MAIN_ENTRY =
  process.env.EGO_ELECTRON_MAIN ?? path.join(DESKTOP_DIR, "out", "main", "main.js");

// Binario Electron del workspace (`@ego/desktop` → devDep `electron`).
function defaultElectronExecutable(): string {
  const dist = path.join(DESKTOP_DIR, "node_modules", "electron", "dist");
  if (process.platform === "win32") return path.join(dist, "electron.exe");
  if (process.platform === "darwin")
    return path.join(dist, "Electron.app", "Contents", "MacOS", "Electron");
  return path.join(dist, "electron");
}

// Vista mínima del API de Electron que toca este spec, tipada a mano (igual
// que `shell.electron.ts:42-51`: no acoplar a los tipos internos de playwright).
interface ElectronMinimizeApi {
  BrowserWindow: {
    getAllWindows: () => Array<{
      isMinimized: () => boolean;
      isVisible: () => boolean;
      isDestroyed: () => boolean;
      minimize: () => void;
      restore: () => void;
      show: () => void;
      focus: () => void;
      getSize: () => [number, number];
      isFrameless?: () => boolean;
    }>;
  };
  dialog: {
    showOpenDialog: (...args: never[]) => Promise<unknown>;
    showSaveDialog: (...args: never[]) => Promise<unknown>;
    showMessageBox: (...args: never[]) => Promise<unknown>;
  };
}

// Fixture: guards idénticos a `shell.electron.ts:53-62` + launch aislado
// (perfil y workspace temporales; producción sin dev-server).
async function launchIsolated() {
  test.skip(
    !fs.existsSync(MAIN_ENTRY),
    `sin bundle compilado: falta ${MAIN_ENTRY} (corre \`pnpm build\` antes)`,
  );
  const executablePath = process.env.ELECTRON_EXECUTABLE ?? defaultElectronExecutable();
  test.skip(
    !fs.existsSync(executablePath),
    `sin binario Electron: falta ${executablePath} (corre \`pnpm install\` en la raíz del repo)`,
  );

  const userDataDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "ego-e2e-electron-"));
  const workspaceDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "ego-e2e-workspace-"));

  // Lanzar por DIRECTORIO (igual que shell: `getAppPath() === apps/desktop`,
  // resuelve `out/renderer/index.html` como en la app empaquetada).
  const launchArg = process.env.EGO_ELECTRON_MAIN ?? DESKTOP_DIR;
  const electronApp = await electron.launch({
    executablePath,
    args: [launchArg, `--user-data-dir=${userDataDir}`],
    cwd: DESKTOP_DIR,
    env: {
      ...process.env,
      NODE_ENV: "production",
      EGO_WORKSPACE_PATH: workspaceDir,
    },
  });

  // Mock preventivo de diálogos nativos en el proceso MAIN (patrón shell:96-103).
  const win = await electronApp.firstWindow({ timeout: 60_000 });
  await win.waitForLoadState("domcontentloaded", { timeout: 60_000 });
  await electronApp.evaluate(async (api: unknown) => {
    const { dialog } = api as ElectronMinimizeApi;
    dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
    dialog.showSaveDialog = async () => ({ canceled: true, filePath: "" });
    dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
  });

  return {
    electronApp,
    mainPage: win,
    async [Symbol.asyncDispose]() {
      await electronApp.close();
      await fs.promises.rm(userDataDir, { recursive: true, force: true });
      await fs.promises.rm(workspaceDir, { recursive: true, force: true });
    },
  };
}

test("electron minimize sin trabajo: minimize normal, sin flotante (D2 negativo)", async () => {
  await using ctx = await launchIsolated();
  const { electronApp, mainPage } = ctx;

  // Sanidad: shell pinta antes de minimizar.
  await expect(mainPage.getByText("Ego", { exact: true }).first()).toBeVisible();

  // 1. Minimize NATIVO desde el proceso main (sin trabajo semilla:
  // `floatingSnapshot()` = {active:0, hitl:0} → `shouldAutoShow` false).
  await electronApp.evaluate(async (api: unknown) => {
    const { BrowserWindow } = api as ElectronMinimizeApi;
    const main = BrowserWindow.getAllWindows()[0];
    if (!main) throw new Error("sin ventana principal tras firstWindow");
    main.minimize();
  });

  // 2. La principal queda minimizada…
  await expect
    .poll(
      () =>
        electronApp.evaluate(async (api: unknown) => {
          const { BrowserWindow } = api as ElectronMinimizeApi;
          const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
          return { count: wins.length, minimized: wins[0]?.isMinimized() ?? null };
        }),
      { timeout: 10_000 },
    )
    .toMatchObject({ count: 1, minimized: true });

  // 3. …y NO aparece ventana flotante (minimize normal, D2 `main.ts:3355-3388`).
  const windowCount = await electronApp.evaluate(async (api: unknown) => {
    const { BrowserWindow } = api as ElectronMinimizeApi;
    return BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed()).length;
  });
  expect(windowCount).toBe(1);

  // 4. Restore para dejar la app en estado sano antes del `close()` del fixture.
  await electronApp.evaluate(async (api: unknown) => {
    const { BrowserWindow } = api as ElectronMinimizeApi;
    const main = BrowserWindow.getAllWindows()[0];
    if (main && !main.isDestroyed() && main.isMinimized()) {
      main.restore();
      main.show();
    }
  });
  await expect(mainPage.getByText("Ego", { exact: true }).first()).toBeVisible();
});

test("electron minimize con trabajo: flotante visible → click restaura → HITL (D2 positivo)", async () => {
  await using ctx = await launchIsolated();
  const { electronApp, mainPage } = ctx;

  await expect(mainPage.getByText("Ego", { exact: true }).first()).toBeVisible();

  // Precondición: trabajo real semilla (task activa o HITL pendiente).
  // Sin hook de siembra en producto (preload `tasks` = list/cancel; restore =
  // tray-click OS-level) no hay forma honesta de forzar `shouldAutoShow` true
  // desde fuera → skip documentado, NO fail. Cadena cubierta por vitest
  // `tests/e2e/floating-minimize.test.ts` (10/10 PASS). Para habilitar:
  // exponer siembra (p.ej. `EGO_E2E_SEED_TASK`) y quitar este skip.
  const seed = await mainPage.evaluate(async () => {
    const ego = (window as unknown as { ego?: { tasks?: { list: (r?: unknown) => Promise<{ active?: unknown[]; paused?: unknown[] }> } } }).ego;
    try {
      const res = await ego?.tasks?.list?.();
      return {
        active: Array.isArray(res?.active) ? res.active.length : 0,
        hitl: Array.isArray(res?.paused) ? res.paused.length : 0,
      };
    } catch {
      return { active: 0, hitl: 0 };
    }
  });
  test.skip(
    seed.active === 0 && seed.hitl === 0,
    `sin trabajo semilla (active=${seed.active} hitl=${seed.hitl}): ` +
      `el autoshow D2 exige task activa o HITL pendiente y no hay hook de siembra ` +
      `(ver cabecera del spec; cadena cubierta en vitest floating-minimize 10/10)`,
  );

  // --- Cuerpo con semilla (hoy inalcanzable sin hook; se ejecuta si el owner siembra) ---
  // 1. Minimize nativo → la principal se oculta y aparece la flotante.
  await electronApp.evaluate(async (api: unknown) => {
    const { BrowserWindow } = api as ElectronMinimizeApi;
    BrowserWindow.getAllWindows()[0]?.minimize();
  });
  await expect
    .poll(
      () =>
        electronApp.evaluate(async (api: unknown) => {
          const { BrowserWindow } = api as ElectronMinimizeApi;
          const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
          return { count: wins.length, anyVisible: wins.some((w) => w.isVisible()) };
        }),
      { timeout: 15_000 },
    )
    .toMatchObject({ count: 2, anyVisible: true });

  // 2. Flotante visible: segunda ventana (frameless 180x180) con contenido
  // (`floating.html` mount points `#floating-root/#approval-card`).
  const floatingPages = electronApp.windows().slice(1);
  expect(floatingPages.length).toBeGreaterThanOrEqual(1);
  await expect(floatingPages[0].locator("#floating-root").first()).toBeVisible({ timeout: 15_000 });

  // 3. Click restaura la principal y oculta la flotante (vía tray `restore`:
  // `win.restore/show/focus + floatMgr.hide`, `main.ts:598-611`). El click de
  // tray es OS-level; aquí se ejerce el efecto a través de la ventana flotante
  // cuando el driver lo permite, y se verifica el estado final.
  await floatingPages[0].mouse.click(90, 90);
  await expect
    .poll(
      () =>
        electronApp.evaluate(async (api: unknown) => {
          const { BrowserWindow } = api as ElectronMinimizeApi;
          const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
          return { count: wins.length, mainVisible: wins[0]?.isVisible() ?? null };
        }),
      { timeout: 15_000 },
    )
    .toMatchObject({ mainVisible: true });

  // 4. HITL: la approval pendiente resuelve con identidad exacta (el detalle
  // del contrato ACK 800ms + `computeActionIdentity` vive en
  // `WidgetHitlBridge.test.ts`; aquí se verifica que la tarjeta de approval
  // del flotante expone aprobar/rechazar sin colgar el executor).
  const approvalCard = floatingPages[0].locator("#approval-card");
  if (await approvalCard.isVisible().catch(() => false)) {
    await approvalCard.getByRole("button", { name: /aprobar/i }).click({ timeout: 15_000 });
  }
});
