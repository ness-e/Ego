import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readMainSource } from "./helpers/main-source.js";
import {
  checkForUpdates,
  compareVersions,
  downloadUpdate,
  initAutoUpdater,
  parseUpdateFeed,
  resolveUpdateFeedUrl,
  type UpdateCheckDeps,
  type UpdateNotice,
} from "../src/updater.js";

const here = dirname(fileURLToPath(import.meta.url));

function depsWith(
  feed: unknown | Error,
  currentVersion = "0.1.0"
): { deps: UpdateCheckDeps; notified: UpdateNotice[] } {
  const notified: UpdateNotice[] = [];
  const deps: UpdateCheckDeps = {
    currentVersion,
    feedUrl: "https://updates.ego.local/latest.json",
    fetchFeed: async () => {
      if (feed instanceof Error) throw feed;
      return feed;
    },
    notify: (n) => {
      notified.push(n);
    },
  };
  return { deps, notified };
}

describe("@ego/desktop — updater DIST-05 (sin red real, feed mock local)", () => {
  it("compareVersions ordena mayor/menor/igual y tolera prefijo v", () => {
    expect(compareVersions("0.2.0", "0.1.0")).toBeGreaterThan(0);
    expect(compareVersions("0.1.0", "0.2.0")).toBeLessThan(0);
    expect(compareVersions("0.1.0", "0.1.0")).toBe(0);
    expect(compareVersions("v0.2.0", "0.1.9")).toBeGreaterThan(0);
    expect(compareVersions("1.0.0-beta", "1.0.0")).toBe(0);
  });

  it("parseUpdateFeed acepta forma mínima y rechaza feed sin version", () => {
    expect(parseUpdateFeed({ version: "0.2.0" })).toEqual({ version: "0.2.0" });
    expect(parseUpdateFeed({ version: "0.2.0", url: "u", notes: "n" })).toEqual({
      version: "0.2.0",
      url: "u",
      notes: "n",
    });
    expect(parseUpdateFeed({})).toBeNull();
    expect(parseUpdateFeed(null)).toBeNull();
    expect(parseUpdateFeed("0.2.0")).toBeNull();
  });

  it("detecta versión nueva y emite UN aviso discreto", async () => {
    const { deps, notified } = depsWith({ version: "0.2.0", notes: "mejoras" });
    const res = await checkForUpdates(deps);
    expect(res.status).toBe("available");
    expect(res.latestVersion).toBe("0.2.0");
    expect(notified).toHaveLength(1);
    expect(notified[0]?.code).toBe("EGO_UPDATE_AVAILABLE");
    expect(notified[0]?.currentVersion).toBe("0.1.0");
    expect(notified[0]?.latestVersion).toBe("0.2.0");
  });

  it("sin versión nueva no avisa", async () => {
    const { deps, notified } = depsWith({ version: "0.1.0" });
    const res = await checkForUpdates(deps);
    expect(res.status).toBe("up-to-date");
    expect(notified).toHaveLength(0);
  });

  it("fallo de red → error sin lanzar y sin aviso", async () => {
    const { deps, notified } = depsWith(new Error("ECONNREFUSED"));
    const res = await checkForUpdates(deps);
    expect(res.status).toBe("error");
    expect(res.error).toContain("ECONNREFUSED");
    expect(notified).toHaveLength(0);
  });

  it("feed inválido → error sin lanzar", async () => {
    const { deps, notified } = depsWith({ build: 42 });
    const res = await checkForUpdates(deps);
    expect(res.status).toBe("error");
    expect(notified).toHaveLength(0);
  });

  it("sin feedUrl → idle sin tocar red", async () => {
    const fetchFeed = vi.fn(async () => ({ version: "9.9.9" }));
    const res = await checkForUpdates({
      currentVersion: "0.1.0",
      feedUrl: undefined,
      fetchFeed,
      notify: () => {
        throw new Error("no debe avisar en idle");
      },
    });
    expect(res.status).toBe("idle");
    expect(fetchFeed).not.toHaveBeenCalled();
  });

  it("downloadUpdate queda deferred con motivo DIST-04 (sin instalación silenciosa)", () => {
    const res = downloadUpdate();
    expect(res.status).toBe("deferred");
    expect(res.reason).toContain("DIST-04");
  });

  it("resolveUpdateFeedUrl lee env o idle", () => {
    expect(
      resolveUpdateFeedUrl({ EGO_UPDATE_FEED_URL: "https://x/y.json" })
    ).toBe("https://x/y.json");
    expect(resolveUpdateFeedUrl({})).toBeUndefined();
    expect(resolveUpdateFeedUrl({ EGO_UPDATE_FEED_URL: "  " })).toBeUndefined();
  });

  it("initAutoUpdater es no-op si no es empaquetada (dev jamás chequea)", async () => {
    const fetchFeed = vi.fn(async () => ({ version: "9.9.9" }));
    const notify = vi.fn();
    const updater = initAutoUpdater({
      currentVersion: "0.1.0",
      isPackaged: false,
      feedUrl: "https://updates.ego.local/latest.json",
      fetchFeed,
      notify,
    });
    updater.checkSoon(0);
    const res = await updater.checkNow();
    expect(res.status).toBe("idle");
    expect(fetchFeed).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    updater.dispose();
  });

  it("initAutoUpdater chequea cuando es empaquetada con feed", async () => {
    const notified: UpdateNotice[] = [];
    const updater = initAutoUpdater({
      currentVersion: "0.1.0",
      isPackaged: true,
      feedUrl: "https://updates.ego.local/latest.json",
      fetchFeed: async () => ({ version: "0.3.0" }),
      notify: (n) => {
        notified.push(n);
      },
      scheduleFn: (fn) => {
        fn();
        return 0;
      },
    });
    const res = await updater.checkNow();
    expect(res.status).toBe("available");
    expect(notified).toHaveLength(1);
    expect(updater.lastResult?.status).toBe("available");
    updater.dispose();
  });

  it("main.ts cablea el updater (solo-packaged, diferido, system.alert)", () => {
    const mainSrc = readMainSource();
    // E6 (Ola 2): el updater se importa desde el módulo que arranca la
    // ventana (`src/main/window/create-window.ts`), así que la ruta es
    // relativa a ese módulo. El guard afirma el CONTRATO (se cablea el
    // updater real), no la ruta concreta.
    expect(mainSrc).toMatch(/from "(\.\.\/)+updater\.js"/);
    expect(mainSrc).toContain("initAutoUpdater");
    expect(mainSrc).toContain("app.isPackaged");
    expect(mainSrc).toContain('"system.alert"');
    expect(mainSrc).toContain("notice.code");
    expect(mainSrc).toContain("checkSoon(30_000)");
  });
});
