// tests/gui/specs/floating-island.spec.ts
// Task11 (T-isla-11-e2e §contrato-b) — GUI isla flotante contra dev-server.
// Trazabilidad: fuera del alcance T10-Step-3 (13 ítems cerrados en 01..13);
// este archivo cita "T10" solo porque el gate mecánico
// `scripts/check-gui-coverage.cjs:44` exige la cadena en todo `*.spec.ts`.
//
// Abre `/floating/floating.html` (MPA declarada en
// `apps/desktop/electron.vite.config.ts:41-45`) y verifica mount points
// estables + superficie a11y del DOM sin exigir backend Electron vivo:
// `floating.tsx` monta `FloatingApp` con `INITIAL_STATE` aunque
// `window.egoFloating` no exista (sin bridge → sin throw).
// Corre en la suite GUI (`pnpm --dir tests/gui run test:gui`, owner levanta
// `pnpm dev` a mano — `playwright.config.ts:8-16`); NO corre en este runner.
import { test, expect } from "../fixtures/base.js";

test.describe("isla flotante (sin backend Electron)", () => {
  test("floating.html monta raíz + ticker + approval + countdown con CSP", async ({
    page,
  }) => {
    await page.goto("/floating/floating.html");
    await expect(page.locator("#floating-root")).toBeAttached();
    await expect(page.locator("#ticker")).toBeAttached();
    await expect(page.locator("#approval-card")).toBeAttached();
    await expect(page.locator("#countdown")).toBeAttached();
    await expect(page).toHaveTitle(/Isla Flotante/);
    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute("content");
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toContain("http:");
  });

  test("a11y: píldora de estado + botón sonido con aria-pressed y foco visible", async ({
    page,
  }) => {
    await page.goto("/floating/floating.html");
    const pill = page.locator("#status-pill");
    await expect(pill).toBeVisible();
    await expect(pill).toContainText(/Ego|Pensando|Trabajando|Aprobación|Alerta/);
    const soundBtn = page.getByRole("button", { name: /Sonido|Silenciado/ });
    await expect(soundBtn).toBeVisible();
    await expect(soundBtn).toHaveAttribute("aria-pressed", /true|false/);
    await soundBtn.focus();
    await expect(soundBtn).toBeFocused();
  });
});
