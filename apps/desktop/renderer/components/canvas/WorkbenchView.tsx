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

const QUICK_WORKSPACE_FILES = [
  { label: "README", path: "README.md" },
  { label: "Backlog", path: "docs/roadmap/Backlog.md" },
  { label: "Stack Técnico", path: "docs/engineering/stack-tecnico.md" },
  { label: "Arquitectura", path: "docs/architecture/vision-general.md" },
  { label: "Main Desktop", path: "apps/desktop/src/main.ts" },
  { label: "Package", path: "package.json" },
];

export const WorkbenchView: React.FC<WorkbenchViewProps> = ({
  initialTab = "browser",
  previewFilePath,
  previewContent,
}) => {
  const [tab, setTab] = useState<WorkbenchTab>(initialTab);
  const [activeFile, setActiveFile] = useState<{ path: string; content: string } | null>(
    previewFilePath !== undefined && previewContent !== undefined
      ? { path: previewFilePath, content: previewContent }
      : null
  );
  const [customPath, setCustomPath] = useState("");

  useEffect(() => {
    if (previewFilePath !== undefined && previewContent !== undefined) {
      setActiveFile({ path: previewFilePath, content: previewContent });
    }
  }, [previewFilePath, previewContent]);

  useEffect(() => {
    const onShortcut = (e: Event) => {
      const action = (e as CustomEvent<{ action?: unknown }>).detail?.action;
      if (action === "workbench-browser") setTab("browser");
      else if (action === "workbench-cron") setTab("cron");
      else if (action === "workbench-themes") setTab("themes");
    };
    window.addEventListener(SHORTCUT_EVENT_NAME, onShortcut);

    const onOpenArtifact = (e: Event) => {
      const detail = (e as CustomEvent<{ title?: string; language?: string; code?: string }>).detail;
      if (detail && (detail.title || detail.code)) {
        setActiveFile({
          path: detail.title || "artifact.txt",
          content: detail.code || "",
        });
        setTab("preview");
      }
    };
    window.addEventListener("ego:open-artifact", onOpenArtifact);

    return () => {
      window.removeEventListener(SHORTCUT_EVENT_NAME, onShortcut);
      window.removeEventListener("ego:open-artifact", onOpenArtifact);
    };
  }, []);

  const handleLoadFile = (targetPath: string) => {
    const cleanPath = targetPath.trim();
    if (!cleanPath) return;
    setActiveFile({
      path: cleanPath,
      content: `# ${cleanPath}\n\n// Archivo del workspace cargado para inspección en Workbench\n// Fecha: ${new Date().toISOString()}`,
    });
  };

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
        {tab === "preview" && (
          <div className="flex h-full flex-col gap-3">
            {activeFile ? (
              <div className="flex flex-col h-full gap-2">
                <div className="flex items-center justify-between border-b border-hairline pb-1.5 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-medium text-ink">{activeFile.path}</span>
                    <span className="text-[10px] text-faint">· Vista previa activa</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveFile(null)}
                    className="text-[10px] text-dim hover:text-ink border border-hairline rounded px-1.5 py-0.5 cursor-pointer"
                  >
                    Cerrar visor
                  </button>
                </div>
                <div className="flex-1 min-h-0">
                  <FilePreviewView filePath={activeFile.path} content={activeFile.content} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p role="status" className="text-[11px] text-faint">
                  Sin archivo seleccionado: el preview read-only aparece cuando un
                  Sub-Ego o el inspector proveen `filePath` + contenido.
                </p>
                <div className="flex flex-col gap-2 rounded-lg border border-hairline bg-panel p-3">
                  <span className="text-xs font-semibold text-ink">Archivos Rápidos del Proyecto</span>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_WORKSPACE_FILES.map((f) => (
                      <button
                        key={f.path}
                        type="button"
                        onClick={() => handleLoadFile(f.path)}
                        className="rounded border border-hairline bg-raised px-2 py-1 text-[11px] text-dim hover:text-ink transition-colors cursor-pointer"
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      placeholder="Ruta relativa (ej. docs/PLAN-EGO.md)..."
                      value={customPath}
                      onChange={(e) => setCustomPath(e.target.value)}
                      className="flex-1 rounded border border-hairline bg-raised px-2.5 py-1 text-xs text-ink placeholder:text-faint focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        handleLoadFile(customPath);
                        setCustomPath("");
                      }}
                      className="rounded border border-hairline bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500 transition-colors cursor-pointer"
                    >
                      Cargar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {tab === "themes" && <ThemeIO />}
        {tab === "cron" && <CronPanel />}
        {tab === "shortcuts" && <ShortcutsPanel />}
        {tab === "notify" && <NotifyCenter />}
      </div>
    </div>
  );
};
