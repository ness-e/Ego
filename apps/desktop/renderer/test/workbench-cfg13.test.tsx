import { describe, it, expect, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DesignSystemTokensSchema } from "@ego/ui-runtime";
import {
  ComponentRegistry,
  getComponentRenderer,
} from "../components/canvas/registry.js";
import {
  BROWSER_STATUSES,
  BrowserView,
} from "../components/canvas/BrowserView.js";
import { FilePreviewView } from "../components/canvas/FilePreviewView.js";
import { WorkbenchView } from "../components/canvas/WorkbenchView.js";
import { CronPanel } from "../components/canvas/CronPanel.js";
import {
  classifyBrowserUrl,
  normalizeHostname,
  isPreviewableFile,
  truncatePreview,
  MAX_PREVIEW_CHARS,
  CustomShortcutSchema,
  loadCustomShortcuts,
} from "../components/canvas/workbench-guards.js";
import { DEFAULT_DESIGN_TOKENS } from "../components/canvas/DesignSystemProvider.js";

/**
 * CFG-13 — Workbench extendido + personalización.
 * Contrato: registry intacto (11 vistas) + 1 vista nueva (BrowserView) con
 * 9 estados; guards loopback REV-02; preview read-only; temas Zod; cron
 * sobre `tasks.list`; atajos custom validados.
 */

let container: HTMLDivElement | null = null;
let root: Root | null = null;

async function mount(node: React.ReactNode): Promise<HTMLElement> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(node);
  });
  return container;
}

afterEach(async () => {
  if (root) {
    await act(async () => {
      root!.unmount();
    });
    root = null;
  }
  container?.remove();
  container = null;
});

function statusOf(el: HTMLElement): string | null {
  return el.querySelector("[data-browser-status]")?.getAttribute("data-browser-status") ?? null;
}

function submitBrowserForm(el: HTMLElement): void {
  const form = el.querySelector("form");
  if (!form) throw new Error("sin form en BrowserView");
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

describe("CFG-13: registry intacto 11 vistas + 1 nueva", () => {
  it("conserva exactamente las 11 vistas canónicas (sin tocar registry.ts)", () => {
    const keys = Object.keys(ComponentRegistry);
    expect(keys).toHaveLength(11);
    for (const k of keys) {
      expect(
        getComponentRenderer(k as Parameters<typeof getComponentRenderer>[0])
      ).not.toBeNull();
    }
  });

  it("la vista nueva expone exactamente 9 estados", () => {
    expect(BROWSER_STATUSES).toHaveLength(9);
    expect([...BROWSER_STATUSES]).toEqual([
      "empty",
      "editing",
      "invalid",
      "blocked-protocol",
      "blocked-external",
      "blocked-credentials",
      "loading",
      "ready",
      "error",
    ]);
  });
});

describe("CFG-13: guards loopback REV-02 (puros)", () => {
  it("permite http(s) loopback", () => {
    for (const u of [
      "http://localhost:5173",
      "http://127.0.0.1:3000/",
      "https://localhost:8443/app",
    ]) {
      expect(classifyBrowserUrl(u).allowed).toBe(true);
    }
  });

  it("bloquea host externo, protocolo, credenciales e inválidas", () => {
    expect(classifyBrowserUrl("https://example.com")).toEqual(
      expect.objectContaining({ allowed: false, reason: "external" })
    );
    expect(classifyBrowserUrl("file:///etc/passwd")).toEqual(
      expect.objectContaining({ allowed: false, reason: "protocol" })
    );
    expect(classifyBrowserUrl("data:text/html,hola")).toEqual(
      expect.objectContaining({ allowed: false, reason: "protocol" })
    );
    expect(classifyBrowserUrl("http://user:pw@localhost:3000/")).toEqual(
      expect.objectContaining({ allowed: false, reason: "credentials" })
    );
    expect(classifyBrowserUrl("no-es-url")).toEqual(
      expect.objectContaining({ allowed: false, reason: "invalid" })
    );
    expect(classifyBrowserUrl("")).toEqual(
      expect.objectContaining({ allowed: false, reason: "invalid" })
    );
  });

  it("normaliza IPv6 con corchetes", () => {
    expect(normalizeHostname("[::1]")).toBe("::1");
    expect(classifyBrowserUrl("http://[::1]:3000/").allowed).toBe(true);
  });
});

describe("CFG-13: BrowserView — 9 estados renderizados", () => {
  it("empty: sin URL inicial", async () => {
    const el = await mount(<BrowserView />);
    expect(statusOf(el)).toBe("empty");
    expect(el.textContent).toContain("Sin URL");
  });

  it("editing: draft loopback válido habilita Cargar", async () => {
    const el = await mount(<BrowserView initialUrl="http://localhost:5173" />);
    expect(statusOf(el)).toBe("editing");
    const submit = el.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
  });

  it("invalid: texto no-URL", async () => {
    const el = await mount(<BrowserView initialUrl="no-es-url" />);
    expect(statusOf(el)).toBe("invalid");
  });

  it("blocked-protocol: file: denegado", async () => {
    const el = await mount(<BrowserView initialUrl="file:///etc/passwd" />);
    expect(statusOf(el)).toBe("blocked-protocol");
    expect(el.textContent).toContain("Bloqueado");
  });

  it("blocked-external: host público denegado", async () => {
    const el = await mount(<BrowserView initialUrl="https://example.com" />);
    expect(statusOf(el)).toBe("blocked-external");
  });

  it("blocked-credentials: userinfo denegado", async () => {
    const el = await mount(
      <BrowserView initialUrl="http://user:pw@localhost:3000/" />
    );
    expect(statusOf(el)).toBe("blocked-credentials");
  });

  it("loading: submit loopback monta iframe sandboxed", async () => {
    const el = await mount(<BrowserView initialUrl="http://localhost:5173" />);
    await act(async () => {
      submitBrowserForm(el);
    });
    expect(statusOf(el)).toBe("loading");
    const frame = el.querySelector("iframe");
    expect(frame).not.toBeNull();
    expect(frame?.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame?.getAttribute("src")).toContain("localhost:5173");
  });

  it("ready: el iframe dispara onLoad", async () => {
    const el = await mount(<BrowserView initialUrl="http://localhost:5173" />);
    await act(async () => {
      submitBrowserForm(el);
    });
    const frame = el.querySelector("iframe");
    if (!frame) throw new Error("sin iframe tras submit");
    await act(async () => {
      frame.dispatchEvent(new Event("load"));
    });
    expect(statusOf(el)).toBe("ready");
  });

  it("error: el iframe dispara onError", async () => {
    const el = await mount(<BrowserView initialUrl="http://localhost:5173" />);
    await act(async () => {
      submitBrowserForm(el);
    });
    const frame = el.querySelector("iframe");
    if (!frame) throw new Error("sin iframe tras submit");
    await act(async () => {
      frame.dispatchEvent(new Event("error"));
    });
    expect(statusOf(el)).toBe("error");
    expect(el.querySelector("iframe")).toBeNull();
  });
});

describe("CFG-13: preview read-only + temas + atajos", () => {
  it("preview: .md renderiza sin contentEditable; .exe se deniega", async () => {
    expect(isPreviewableFile("docs/guia.md")).toBe(true);
    expect(isPreviewableFile("bin/app.exe")).toBe(false);
    const el = await mount(
      <FilePreviewView filePath="notas.md" content={"# hola\nmundo"} />
    );
    const pre = el.querySelector('[data-testid="file-preview-content"]');
    expect(pre?.textContent).toContain("hola");
    expect(pre?.getAttribute("contenteditable")).toBeNull();
    const denied = await mount(
      <FilePreviewView filePath="bin/app.exe" content={"MZ"} />
    );
    expect(denied.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("preview: trunca con aviso sobre el tope", () => {
    const big = "a".repeat(MAX_PREVIEW_CHARS + 1);
    const out = truncatePreview(big);
    expect(out.truncated).toBe(true);
    expect(out.text).toHaveLength(MAX_PREVIEW_CHARS);
    expect(truncatePreview("corto").truncated).toBe(false);
  });

  it("temas: el preset activo valida y {} se rechaza", () => {
    expect(DesignSystemTokensSchema.safeParse(DEFAULT_DESIGN_TOKENS).success).toBe(true);
    expect(DesignSystemTokensSchema.safeParse({}).success).toBe(false);
    // `colors: {}` SÍ valida (los defaults Zod rellenan) — lo inválido es un
    // enum fuera de contrato:
    expect(
      DesignSystemTokensSchema.safeParse({
        ...DEFAULT_DESIGN_TOKENS,
        geometry: { radius: "gigante", density: "comfortable" },
      }).success
    ).toBe(false);
  });

  it("atajos: schema rechaza reservadas y loader tolera corrupción", () => {
    expect(
      CustomShortcutSchema.safeParse({
        id: "x",
        label: "X",
        keys: "ctrl+k",
        action: "workbench-browser",
      }).success
    ).toBe(false);
    expect(
      CustomShortcutSchema.safeParse({
        id: "abrir-nav",
        label: "Abrir navegador",
        keys: "ctrl+shift+b",
        action: "workbench-browser",
      }).success
    ).toBe(true);
    expect(loadCustomShortcuts([{ id: "roto" }])).toEqual([]);
    expect(loadCustomShortcuts("basura")).toEqual([]);
  });
});

describe("CFG-13: cron + workbench agregador (IPC existente)", () => {
  it("CronPanel lista vacío honesto desde tasks.list mockeado", async () => {
    const el = await mount(<CronPanel />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(el.textContent).toContain("Sin tareas en segundo plano");
  });

  it("WorkbenchView expone 6 tabs y preview vacío honesto", async () => {
    const el = await mount(<WorkbenchView initialTab="preview" />);
    expect(el.querySelectorAll('[role="tab"]')).toHaveLength(6);
    expect(el.textContent).toContain("Sin archivo seleccionado");
  });
});
