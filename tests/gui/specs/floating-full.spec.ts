// tests/gui/specs/floating-full.spec.ts
// E2E-GUI-FULL (extensión T-isla-11-e2e S3; T10 cadena exigida por
// scripts/check-gui-coverage.cjs:44).
//
// Validación exhaustiva de `/floating/floating.html` contra dev-server
// (baseURL 127.0.0.1:5173): avatar <ego-avatar>, estados vía stub de
// `window.egoFloating` (FloatingApp subscribe `onState` en mount —
// floating.tsx:38-44; sin bridge usa INITIAL_STATE hidden), mute toggle,
// Escape local (floating.tsx:60-76), reduced-motion, foco visible, alcance
// ViewHost/ticker/upload (NO montados en FloatingApp actual —
// floating.tsx:86-87), y cero console.error/pageerror no-ignorables por
// test. Más smoke de `/` (Chat + Sidebar, solo carga + a11y básica).
// Minimize nativo requiere Electron main: fuera de scope browser.
import { test, expect, type Page } from "@playwright/test";
import { IGNORABLE_CONSOLE } from "../fixtures/base.js";

/** Colector de errores por test (listener antes de goto, assert después). */
function watchErrors(page: Page): { errors: string[] } {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${String(e?.stack ?? e)}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !IGNORABLE_CONSOLE.some((p) => m.text().includes(p))) {
      errors.push(`console.error: ${m.text().slice(0, 500)}`);
    }
  });
  // Causa raíz de 404s: el mensaje de consola no trae URL; capturarla aquí.
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`http ${r.status()} ${r.url()}`);
  });
  return { errors };
}

function expectNoErrors(sink: { errors: string[] }): void {
  expect(sink.errors, `errores de consola/página: ${JSON.stringify(sink.errors)}`).toEqual([]);
}

/**
 * FIND-12-01 (deuda producto, 0 fix aquí): el vendor `ego-avatar`
 * (`floating-avatar.tsx:31`) se pide como
 * `/repos-referencia/avatar/src/index.js?import` — fuera del root del
 * dev-server (`apps/desktop/renderer`; el path existe solo en la raíz del
 * repo) → el import falla (404 en pipeline de módulos / HTML-fallback
 * inimportable) → el try/catch (`floating-avatar.tsx:55-60`) lo traga y el
 * tag queda inerte (`customElements.get` null, box 0x0 — AVATAR-DIAG 6/6).
 * El mensaje de consola no trae URL; el ancla es in-page y determinista:
 * la URL vendor figura en `performance` resource-timing en cada carga.
 * Solo se tolera ESE 404; cualquier otro error/página falla el test.
 */
const KNOWN_404 = /repos-referencia\/avatar\/src\/index\.js/;
const GENERIC_404 = /Failed to load resource.*404/;
const VENDOR_RES = /repos-referencia\/avatar\/src\/index\.js/;
async function expectOnlyKnownErrors(page: Page, sink: { errors: string[] }): Promise<void> {
  const attributed = sink.errors.filter((e) => KNOWN_404.test(e));
  const generic = sink.errors.filter((e) => !KNOWN_404.test(e) && GENERIC_404.test(e));
  const unknown = sink.errors.filter((e) => !KNOWN_404.test(e) && !GENERIC_404.test(e));
  expect(unknown, `errores NUEVOS de consola/página: ${JSON.stringify(unknown)}`).toEqual([]);
  const known: string[] = [...attributed];
  if (generic.length > 0) {
    const requested = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .map((r) => r.name)
        .filter((u) => /repos-referencia\/avatar\/src\/index\.js/.test(u)),
    );
    test.info().annotations.push({
      type: "404-anchor",
      description: JSON.stringify({ vendorRequested: requested }),
    });
    console.log(`404-ANCHOR vendorRequested=${JSON.stringify(requested)}`);
    expect(requested.length, "ancla FIND-12-01: la pagina debe pedir el vendor avatar").toBeGreaterThan(0);
    known.push(...generic.map((g) => `${g} [atribuido FIND-12-01]`));
  }
  if (known.length > 0) {
    test.info().annotations.push({ type: "known-404", description: JSON.stringify(known) });
    console.log(`KNOWN-404 (FIND-12-01) ${JSON.stringify(known)}`);
  }
}

/** Stub de window.egoFloating instalado antes de los scripts (addInitScript). */
async function stubBridge(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    (window as unknown as Record<string, unknown>).__bridgeCalls = calls;
    (window as unknown as Record<string, unknown>).egoFloating = {
      onState: (cb: (s: unknown) => void) => {
        (window as unknown as Record<string, unknown>).__pushState = cb;
        return () => {};
      },
      approve: async (...a: unknown[]) => {
        calls.push({ method: "approve", args: a });
        return null;
      },
      deny: async (...a: unknown[]) => {
        calls.push({ method: "deny", args: a });
        return null;
      },
      setMuted: async (m: unknown) => {
        calls.push({ method: "setMuted", args: [m] });
        return null;
      },
    };
  });
}

async function pushState(page: Page, attentionState: string): Promise<void> {
  await page.evaluate((s) => {
    const w = window as unknown as Record<string, (x: unknown) => void>;
    w.__pushState({ visible: true, muted: false, attentionState: s });
  }, attentionState);
}

async function bridgeCalls(page: Page): Promise<Array<{ method: string; args: unknown[] }>> {
  return page.evaluate(() => {
    const w = window as unknown as Record<string, Array<{ method: string; args: unknown[] }>>;
    return w.__bridgeCalls;
  });
}

test.describe("flotante exhaustivo (stub egoFloating)", () => {
  test("avatar: tag + attrs deterministas + diagnóstico registro/tamaño", async ({ page }) => {
    const sink = watchErrors(page);
    await page.goto("/floating/floating.html");
    const avatar = page.locator("ego-avatar");
    await expect(avatar).toBeAttached();
    await expect(avatar).toHaveAttribute("seed", "subego:ego");
    await expect(avatar).toHaveAttribute("state", "idle");
    await expect(avatar).toHaveAttribute("size", "120");
    await expect(avatar).toHaveAttribute("presence", "hidden");
    await expect(avatar).toHaveAttribute("motion", "auto");
    await expect(avatar).toHaveAttribute("data-attention", "hidden");
    const diag = await page.evaluate(() => {
      const registered = !!customElements.get("ego-avatar");
      const node = document.querySelector("ego-avatar");
      const r = node?.getBoundingClientRect();
      return { registered, box: r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null };
    });
    test.info().annotations.push({ type: "avatar-diag", description: JSON.stringify(diag) });
    console.log(`AVATAR-DIAG ${JSON.stringify(diag)}`);
    const resUrls = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .map((r) => r.name)
        .filter((u) => /favicon|repos-referencia|avatar/i.test(u)),
    );
    console.log(`RESOURCES-404-CANDIDATES ${JSON.stringify(resUrls)}`);
    await expectOnlyKnownErrors(page, sink);
  });

  test("estados vía onState: pill + data-attention + avatar state/presence", async ({ page }) => {
    const sink = watchErrors(page);
    await stubBridge(page);
    await page.goto("/floating/floating.html");
    const pill = page.locator("#status-pill");
    const main = page.locator("main[data-attention]");
    const avatar = page.locator("ego-avatar");
    await expect(pill).toHaveText("Ego");

    await pushState(page, "expanded");
    await expect(pill).toHaveText("Trabajando");
    await expect(main).toHaveAttribute("data-attention", "expanded");
    await expect(avatar).toHaveAttribute("state", "working");
    await expect(avatar).toHaveAttribute("presence", "home");
    await expect(avatar).toHaveAttribute("data-attention", "expanded");

    await pushState(page, "compact");
    await expect(pill).toHaveText("Pensando");
    await expect(avatar).toHaveAttribute("state", "thinking");
    await expect(avatar).toHaveAttribute("presence", "compact");

    await pushState(page, "hitl_approval");
    await expect(pill).toHaveText("Aprobación");
    await expect(main).toHaveAttribute("data-attention", "hitl_approval");
    await expect(avatar).toHaveAttribute("state", "approval");
    await expect(avatar).toHaveAttribute("presence", "home");

    await pushState(page, "alert");
    await expect(pill).toHaveText("Alerta");

    await pushState(page, "hidden");
    await expect(pill).toHaveText("Ego");
    await expectOnlyKnownErrors(page, sink);
  });

  test("mute toggle: aria-pressed + label + setMuted capturado", async ({ page }) => {
    const sink = watchErrors(page);
    await stubBridge(page);
    await page.goto("/floating/floating.html");
    const soundBtn = page.getByRole("button", { name: /Sonido|Silenciado/ });
    await expect(soundBtn).toHaveAttribute("aria-pressed", "false");
    await soundBtn.click();
    await expect(soundBtn).toHaveAttribute("aria-pressed", "true");
    await expect(soundBtn).toHaveText("Silenciado");
    await soundBtn.click();
    await expect(soundBtn).toHaveAttribute("aria-pressed", "false");
    await expect(soundBtn).toHaveText("Sonido");
    const calls = await bridgeCalls(page);
    expect(calls.filter((c) => c.method === "setMuted").map((c) => c.args[0])).toEqual([true, false]);
    await expectOnlyKnownErrors(page, sink);
  });

  test("Escape colapsa vista local expanded→compact→hidden + foco a mute; hidden no-op", async ({
    page,
  }) => {
    const sink = watchErrors(page);
    await stubBridge(page);
    await page.goto("/floating/floating.html");
    const pill = page.locator("#status-pill");
    const soundBtn = page.getByRole("button", { name: /Sonido|Silenciado/ });

    // hidden = no-op (listener ni siquiera attachado).
    await page.keyboard.press("Escape");
    await expect(pill).toHaveText("Ego");

    await pushState(page, "expanded");
    await expect(pill).toHaveText("Trabajando");
    await page.keyboard.press("Escape");
    await expect(pill).toHaveText("Pensando");
    await expect(soundBtn).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(pill).toHaveText("Ego");
    await expectOnlyKnownErrors(page, sink);
  });

  test("alcance: ViewHost/ticker/upload montados en FloatingApp", async ({ page }) => {
    const sink = watchErrors(page);
    await page.goto("/floating/floating.html");
    await expect(page.locator("#ticker")).toBeAttached();
    await expect(page.locator("#approval-card")).toBeAttached();
    await expect(page.locator("#countdown")).toBeAttached();
    await expect(page.locator("[data-dropzone]")).toBeAttached();
    await expectOnlyKnownErrors(page, sink);
  });
});

test.describe("flotante reduced-motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("avatar motion=reduce con prefers-reduced-motion", async ({ page }) => {
    const sink = watchErrors(page);
    await page.goto("/floating/floating.html");
    await expect(page.locator("ego-avatar")).toHaveAttribute("motion", "reduce");
    await expect(page.getByRole("button", { name: /Sonido|Silenciado/ })).toBeVisible();
    await expectOnlyKnownErrors(page, sink);
  });
});

test.describe("smoke app principal", () => {
  // FIND-12-03: boot de `/` sin bridge es flaky (1/3: página en blanco 60s
  // sin section[aria-label=Chat], screenshot 1280x720 blanco). Retry solo
  // aquí (el SUT, no el spec); el flotante no reintenta.
  test.describe.configure({ retries: 2 });
  test("`/` carga Chat + Sidebar sin errores (solo carga, canvas lazy)", async ({ page }, testInfo) => {
    test.slow();
    const sink = watchErrors(page);
    await page.goto("/");
    const chat = page.locator('section[aria-label="Chat"]');
    try {
      await expect(chat).toBeVisible({ timeout: 60_000 });
    } catch (e) {
      const state = await page.evaluate(() => ({
        title: document.title,
        rootChildren: document.getElementById("root")?.children.length ?? -1,
        bodyText: document.body.innerText.slice(0, 200),
      }));
      testInfo.annotations.push({ type: "smoke-blank", description: JSON.stringify(state) });
      console.log(`SMOKE-BLANK (FIND-12-03) ${JSON.stringify(state)} errors=${JSON.stringify(sink.errors)}`);
      throw e;
    }
    test.info().annotations.push({
      type: "smoke-diag",
      description: JSON.stringify(
        await page.evaluate(() => ({
          title: document.title,
          buttons: document.querySelectorAll("button").length,
          headings: document.querySelectorAll("h1,h2,h3").length,
        })),
      ),
    });
    expectNoErrors(sink);
  });
});
