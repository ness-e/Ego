import React, { useEffect, useState } from "react";
import { BrowserView } from "./BrowserView.js";
import { FilePreviewView } from "./FilePreviewView.js";
import { ThemeIO } from "./ThemeIO.js";
import { CronPanel } from "./CronPanel.js";
import { ShortcutsPanel } from "./ShortcutsPanel.js";
import { NotifyCenter } from "./NotifyCenter.js";
import { SHORTCUT_EVENT_NAME } from "./workbench-guards.js";

/**
 * CFG-13 — Workbench extendido (nueva vista del workspace, +1 sobre las 11
 * del registry — el registry NO se toca).
 * Agrega 6 paneles: navegador loopback, preview read-only, temas JSON,
 * cron sobre BackgroundEngine, atajos custom y avisos. Los atajos
 * `workbench-*` conmutan tabs escuchando `ego:shortcut`.
 */
export const WORKBENCH_TABS = [
  "browser",
  "preview",
  "themes",
  "cron",
  "shortcuts",
  "notify",
] as const;

export type WorkbenchTab = (typeof WORKBENCH_TABS)[number];

const TAB_LABELS: Record<WorkbenchTab, string> = {
  browser: "Navegador",
  preview: "Vista previa",
  themes: "Temas",
  cron: "Cron",
  shortcuts: "Atajos",
  notify: "Avisos",
};

export interface WorkbenchViewProps {
  initialTab?: WorkbenchTab;
  previewFilePath?: string;
  previewContent?: string;
}

export const WorkbenchView: React.FC<WorkbenchViewProps> = ({
  initialTab = "browser",
  previewFilePath,
  previewContent,
}) => {
  const [tab, setTab] = useState<WorkbenchTab>(initialTab);

  useEffect(() => {
    const onShortcut = (e: Event) => {
      const action = (e as CustomEvent<{ action?: unknown }>).detail?.action;
      if (action === "workbench-browser") setTab("browser");
      else if (action === "workbench-cron") setTab("cron");
      else if (action === "workbench-themes") setTab("themes");
    };
    window.addEventListener(SHORTCUT_EVENT_NAME, onShortcut);
    return () => window.removeEventListener(SHORTCUT_EVENT_NAME, onShortcut);
  }, []);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex shrink-0 items-center gap-1" role="tablist" aria-label="Workbench extendido">
        {WORKBENCH_TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded px-2.5 py-0.5 text-xs transition-colors cursor-pointer ${
              tab === t
                ? "bg-raised text-ink font-semibold border border-hairline"
                : "text-dim hover:text-ink"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1" role="tabpanel">
        {tab === "browser" && <BrowserView />}
        {tab === "preview" &&
          (previewFilePath !== undefined && previewContent !== undefined ? (
            <FilePreviewView filePath={previewFilePath} content={previewContent} />
          ) : (
            <p role="status" className="text-[11px] text-faint">
              Sin archivo seleccionado: el preview read-only aparece cuando un
              Sub-Ego o el inspector proveen `filePath` + contenido.
            </p>
          ))}
        {tab === "themes" && <ThemeIO />}
        {tab === "cron" && <CronPanel />}
        {tab === "shortcuts" && <ShortcutsPanel />}
        {tab === "notify" && <NotifyCenter />}
      </div>
    </div>
  );
};
