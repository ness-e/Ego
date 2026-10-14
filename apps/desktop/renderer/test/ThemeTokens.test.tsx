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

    it("resolvePresetKey mapea clave e id; desconocido no muta", async () => {
      expect(resolvePresetKey("midnight-cyan")).toBe("midnight-cyan");
      expect(resolvePresetKey("theme-midnight-cyan")).toBe("midnight-cyan");
      expect(resolvePresetKey("no-existe")).toBeUndefined();
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
