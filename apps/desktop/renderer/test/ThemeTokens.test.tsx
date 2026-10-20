// T05 (UI-01+UI-02): Tokens reales + chat al design system.
// RED: estos tests FALLAN hasta que index.css/fonts.css/main.tsx,
// DesignSystemProvider y ego-chat.tsx implementen el contrato.
//
// Nota: el CSS se lee con node:fs (solo-test, nunca se empaqueta;
// evita que Vite resuelva imports estáticos de archivos aún inexistentes).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const SRC = join(process.cwd(), "src");
const readSrc = (name: string): string => {
  const p = join(SRC, name);
  return existsSync(p) ? readFileSync(p, "utf8") : "";
};

const indexCss = readSrc("index.css");
const fontsCss = readSrc("fonts.css");
const mainTsx = readSrc("main.tsx");

vi.mock("../components/character/CharacterBadge.js", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CharacterBadge: (props: any) => (
    <div data-testid="mock-avatar" data-subego={props.subEgoId} />
  ),
}));

import {
  DesignSystemProvider,
  PRESET_THEMES,
  resolvePresetKey,
  useDesignSystem,
} from "../components/canvas/DesignSystemProvider";
import { EgoChat } from "../components/ego-chat";

const PRESET_KEYS = ["default-dark", "midnight-cyan", "emerald-terminal", "amber-warm"];

function PresetCycler() {
  const { tokens, applyPreset } = useDesignSystem();
  return (
    <div>
      <span data-testid="theme-id">{tokens.id}</span>
      {PRESET_KEYS.map((k) => (
        <button key={k} data-testid={`btn-${k}`} onClick={() => applyPreset(k)}>
          {k}
        </button>
      ))}
    </div>
  );
}

describe("T05: tokens reales + chat al design system", () => {
  describe("index.css: tokens semánticos + puentes --ego-*", () => {
    it("define brand ámbar #f59e0b puenteado a --ego-color-brand", () => {
      expect(indexCss).toContain("--color-brand");
      expect(indexCss).toContain("#f59e0b");
      expect(indexCss).toContain("var(--ego-color-brand");
    });

    it("usa dim #8a8a92 (AA) y elimina #55555c", () => {
      expect(indexCss).toContain("#8a8a92");
      expect(indexCss).not.toContain("#55555c");
    });

    it("define app-region y radius-card real puenteada a --ego-radius", () => {
      expect(indexCss).toContain(".app-region-drag");
      expect(indexCss).toContain("-webkit-app-region");
      expect(indexCss).toContain("--radius-card");
      expect(indexCss).toContain("var(--ego-radius");
    });

    it("puentea superficies del provider (paper/panel/raised/ink/hairline/faint)", () => {
      for (const v of [
        "var(--ego-color-bg",
        "var(--ego-color-panel",
        "var(--ego-color-raised",
        "var(--ego-color-text",
        "var(--ego-color-border",
        "var(--ego-color-muted",
      ]) {
        expect(indexCss).toContain(v);
      }
    });
  });

  describe("Geist local vía @font-face (sin next/font)", () => {
    it("fonts.css declara Geist + Geist Mono desde woff2 locales", () => {
      expect(fontsCss).toContain("@font-face");
      expect(fontsCss).toContain("Geist");
      expect(fontsCss).toContain("woff2");
      expect(fontsCss).toContain("Geist-Variable.woff2");
      expect(fontsCss).toContain("GeistMono-Variable.woff2");
    });

    it("main.tsx importa los fonts y :root expone --font-geist-sans", () => {
      expect(mainTsx).toContain("./fonts.css");
      expect(indexCss).toContain("--font-geist-sans");
    });
  });

  describe("DesignSystemProvider: 4 presets oscuros funcionales", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
    });

    afterEach(async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    });

    it("expone los 4 presets y cada clave conmuta --ego-color-bg", async () => {
      expect(Object.keys(PRESET_THEMES).sort()).toEqual([...PRESET_KEYS].sort());
      await act(async () => {
        root.render(
          <DesignSystemProvider>
            <PresetCycler />
          </DesignSystemProvider>
        );
      });
      const rootElem = () =>
        container.querySelector("#ego-design-system-root") as HTMLElement;
      const seen = new Set<string>();
      for (const k of PRESET_KEYS) {
        const btn = container.querySelector(
          `[data-testid="btn-${k}"]`
        ) as HTMLButtonElement;
        await act(async () => {
          btn.click();
        });
        const bg = rootElem().style.getPropertyValue("--ego-color-bg");
        expect(bg).not.toBe("");
        seen.add(bg);
      }
      // Los 4 presets producen fondos distintos (oscuros funcionales).
      expect(seen.size).toBe(4);
    });

    it("escribe valores resueltos en :root al conmutar (fix real del tema)", async () => {
      await act(async () => {
        root.render(
          <DesignSystemProvider>
            <PresetCycler />
          </DesignSystemProvider>
        );
      });
      const docStyle = () => document.documentElement.style;
      const btn = (k: string) =>
        container.querySelector(`[data-testid="btn-${k}"]`) as HTMLButtonElement;
      await act(async () => {
        btn("emerald-terminal").click();
      });
      // 2026-10-15: antes del fix, `--color-panel` computaba el fallback
      // `#111113` porque el `var(--ego-*)` de `@theme` se resuelve en `:root`.
      //
      // EGO-FIND-71: el valor esperado se lee del PRESET (assert de
      // comportamiento: `:root` recibe el token del preset, no un hex fijado
      // ni el fallback). El panel de emerald-terminal se oscureció a #002b1b
      // para cumplir AA (>= 4.5:1) con los tokens fijos del sistema.
      expect(docStyle().getPropertyValue("--color-panel")).toBe(
        PRESET_THEMES["emerald-terminal"]!.colors.panel
      );
      expect(docStyle().getPropertyValue("--color-brand")).toBe("#10b981");
      await act(async () => {
        btn("amber-warm").click();
      });
      expect(docStyle().getPropertyValue("--color-panel")).toBe(
        PRESET_THEMES["amber-warm"]!.colors.panel
      );
      // Restaurar default para no contaminar otros tests del archivo.
      await act(async () => {
        btn("default-dark").click();
      });
      expect(docStyle().getPropertyValue("--color-panel")).toBe("#141416");
    });

    it("resolvePresetKey mapea clave e id; desconocido no muta", async () => {
      expect(resolvePresetKey("midnight-cyan")).toBe("midnight-cyan");
      expect(resolvePresetKey("theme-midnight-cyan")).toBe("midnight-cyan");
      expect(resolvePresetKey("no-existe")).toBeUndefined();
    });

    it("persiste la clave del preset (localStorage) y la restaura al montar", async () => {
      // happy-dom sin localstorage-file: stub de memoria solo para este test.
      const mem = new Map<string, string>();
      const memStorage = {
        getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
        setItem: (k: string, v: string) => {
          mem.set(k, String(v));
        },
        removeItem: (k: string) => {
          mem.delete(k);
        },
        clear: () => mem.clear(),
      };
      const prevLS = (globalThis as unknown as { localStorage?: unknown }).localStorage;
      (globalThis as unknown as { localStorage?: unknown }).localStorage = memStorage;
      try {
        await act(async () => {
          root.render(
            <DesignSystemProvider>
              <PresetCycler />
            </DesignSystemProvider>
          );
        });
        const btn = (k: string) =>
          container.querySelector(`[data-testid="btn-${k}"]`) as HTMLButtonElement;
        await act(async () => {
          btn("midnight-cyan").click();
        });
        expect(memStorage.getItem("ego:theme-preset")).toBe("midnight-cyan");
        // Montaje fresco (otra ventana): debe arrancar en el persistido.
        const container2 = document.createElement("div");
        document.body.appendChild(container2);
        const root2 = createRoot(container2);
        await act(async () => {
          root2.render(
            <DesignSystemProvider>
              <PresetCycler />
            </DesignSystemProvider>
          );
        });
        const themeId = container2.querySelector('[data-testid="theme-id"]');
        expect(themeId?.textContent).toBe("theme-midnight-cyan");
        expect(document.documentElement.style.getPropertyValue("--color-panel")).toBe("#0f172a");
        await act(async () => {
          root2.unmount();
        });
        container2.remove();
        memStorage.removeItem("ego:theme-preset");
        // Dejar :root como lo encontró (default) para otros tests.
        await act(async () => {
          btn("default-dark").click();
        });
      } finally {
        (globalThis as unknown as { localStorage?: unknown }).localStorage = prevLS;
      }
    });
  });

  describe("ego-chat.tsx: solo tokens + envío accesible", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
    });

    afterEach(async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    });

    it("el botón de envío tiene nombre accesible", async () => {
      await act(async () => {
        root.render(<EgoChat />);
      });
      const send = container.querySelector(
        '[aria-label="Enviar mensaje"]'
      ) as HTMLElement | null;
      expect(send).not.toBeNull();
      expect(send?.tagName.toLowerCase()).toBe("button");
    });

    it("ningún nodo del chat lleva estilos inline con hex", async () => {
      await act(async () => {
        root.render(<EgoChat />);
      });
      const withHex = Array.from(container.querySelectorAll("[style]")).filter(
        (el) => (el.getAttribute("style") || "").includes("#")
      );
      expect(withHex.map((el) => el.outerHTML.slice(0, 120))).toEqual([]);
    });
  });
});
