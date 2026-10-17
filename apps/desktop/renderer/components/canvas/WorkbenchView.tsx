import React, { useEffect, useState, useMemo } from "react";
import {
  Folder,
  FolderOpen,
  FileText,
  CaretRight,
  CaretDown,
  MagnifyingGlass,
} from "@phosphor-icons/react";
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

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileTreeNode[];
}

const DEFAULT_WORKSPACE_TREE: FileTreeNode[] = [
  {
    name: "apps",
    path: "apps",
    type: "folder",
    children: [
      {
        name: "desktop",
        path: "apps/desktop",
        type: "folder",
        children: [
          { name: "main.ts", path: "apps/desktop/src/main.ts", type: "file" },
          { name: "preload.ts", path: "apps/desktop/src/preload.ts", type: "file" },
          { name: "package.json", path: "apps/desktop/package.json", type: "file" },
        ],
      },
    ],
  },
  {
    name: "packages",
    path: "packages",
    type: "folder",
    children: [
      {
        name: "memory",
        path: "packages/memory",
        type: "folder",
        children: [
          { name: "index.ts", path: "packages/memory/src/index.ts", type: "file" },
          { name: "EgoMemoryAdapter.ts", path: "packages/memory/src/EgoMemoryAdapter.ts", type: "file" },
          { name: "SessionLifecycleLocks.ts", path: "packages/memory/src/SessionLifecycleLocks.ts", type: "file" },
        ],
      },
      {
        name: "runtime",
        path: "packages/runtime",
        type: "folder",
        children: [
          { name: "index.ts", path: "packages/runtime/src/index.ts", type: "file" },
          { name: "CognitiveRuntime.ts", path: "packages/runtime/src/CognitiveRuntime.ts", type: "file" },
          { name: "ToolExecutionLoop.ts", path: "packages/runtime/src/ToolExecutionLoop.ts", type: "file" },
        ],
      },
      {
        name: "tools",
        path: "packages/tools",
        type: "folder",
        children: [
          { name: "index.ts", path: "packages/tools/src/index.ts", type: "file" },
          { name: "ToolRegistry.ts", path: "packages/tools/src/ToolRegistry.ts", type: "file" },
          { name: "NativeFsTool.ts", path: "packages/tools/src/native/fs/NativeFsTool.ts", type: "file" },
        ],
      },
      {
        name: "subegos",
        path: "packages/subegos",
        type: "folder",
        children: [
          { name: "index.ts", path: "packages/subegos/src/index.ts", type: "file" },
          { name: "SubEgoManager.ts", path: "packages/subegos/src/SubEgoManager.ts", type: "file" },
          { name: "CharacterProfile.ts", path: "packages/subegos/src/CharacterProfile.ts", type: "file" },
        ],
      },
    ],
  },
  {
    name: "docs",
    path: "docs",
    type: "folder",
    children: [
      {
        name: "roadmap",
        path: "docs/roadmap",
        type: "folder",
        children: [
          { name: "Backlog.md", path: "docs/roadmap/Backlog.md", type: "file" },
          { name: "roadmap.md", path: "docs/roadmap/roadmap.md", type: "file" },
          { name: "PLAN-EGO.md", path: "docs/roadmap/PLAN-EGO.md", type: "file" },
        ],
      },
      {
        name: "architecture",
        path: "docs/architecture",
        type: "folder",
        children: [
          { name: "vision-general.md", path: "docs/architecture/vision-general.md", type: "file" },
        ],
      },
    ],
  },
  { name: "README.md", path: "README.md", type: "file" },
  { name: "package.json", path: "package.json", type: "file" },
  { name: "pnpm-workspace.yaml", path: "pnpm-workspace.yaml", type: "file" },
];

function getAllFiles(nodes: FileTreeNode[]): Array<{ name: string; path: string }> {
  const files: Array<{ name: string; path: string }> = [];
  function traverse(list: FileTreeNode[]) {
    for (const node of list) {
      if (node.type === "file") {
        files.push({ name: node.name, path: node.path });
      } else if (node.children) {
        traverse(node.children);
      }
    }
  }
  traverse(nodes);
  return files;
}

interface FileTreeItemProps {
  node: FileTreeNode;
  depth?: number;
  activePath?: string;
  expandedFolders: Record<string, boolean>;
  onToggleFolder: (path: string) => void;
  onSelectFile: (path: string) => void;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({
  node,
  depth = 0,
  activePath,
  expandedFolders,
  onToggleFolder,
  onSelectFile,
}) => {
  if (node.type === "folder") {
    const isExpanded = expandedFolders[node.path] ?? false;
    return (
      <div className="flex flex-col">
        <button
          type="button"
          onClick={() => onToggleFolder(node.path)}
          className="flex items-center gap-1.5 py-1 px-1 rounded hover:bg-white/[0.04] text-dim hover:text-ink text-left w-full transition-colors cursor-pointer"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          {isExpanded ? (
            <CaretDown size={12} className="shrink-0 text-faint" />
          ) : (
            <CaretRight size={12} className="shrink-0 text-faint" />
          )}
          {isExpanded ? (
            <FolderOpen size={13} className="shrink-0 text-amber-400" />
          ) : (
            <Folder size={13} className="shrink-0 text-amber-400/80" />
          )}
          <span className="truncate text-[11px] font-sans font-medium">{node.name}</span>
        </button>
        {isExpanded && node.children && (
          <div className="flex flex-col">
            {node.children.map((child) => (
              <FileTreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                activePath={activePath}
                expandedFolders={expandedFolders}
                onToggleFolder={onToggleFolder}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isSelected = activePath === node.path;
  return (
    <button
      type="button"
      onClick={() => onSelectFile(node.path)}
      className={`flex items-center gap-1.5 py-1 px-1 rounded text-left w-full transition-colors cursor-pointer ${
        isSelected
          ? "bg-blue-500/15 text-blue-300 font-semibold"
          : "hover:bg-white/[0.04] text-dim hover:text-ink"
      }`}
      style={{ paddingLeft: `${depth * 12 + 16}px` }}
    >
      <FileText size={13} className={`shrink-0 ${isSelected ? "text-blue-400" : "text-faint"}`} />
      <span className="truncate text-[11px] font-mono">{node.name}</span>
    </button>
  );
};

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
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    apps: true,
    "apps/desktop": true,
    packages: true,
    "packages/memory": true,
    "packages/runtime": false,
    "packages/tools": false,
    "packages/subegos": false,
    docs: true,
    "docs/roadmap": true,
  });

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderPath]: !prev[folderPath],
    }));
  };

  const allFiles = useMemo(() => getAllFiles(DEFAULT_WORKSPACE_TREE), []);
  const filteredFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allFiles.filter(
      (f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)
    );
  }, [allFiles, searchQuery]);

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
          <div className="flex h-full border border-hairline rounded-xl bg-panel overflow-hidden">
            {/* Columna Izquierda (w-60 border-r border-white/5): Explorador de Árbol */}
            <div className="w-60 border-r border-white/5 bg-raised/20 flex flex-col shrink-0">
              <div className="p-2 border-b border-white/5">
                <div className="flex items-center gap-1.5 px-2 py-1 bg-panel rounded border border-white/5 text-xs">
                  <MagnifyingGlass size={13} className="text-dim shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrar archivos..."
                    className="w-full bg-transparent text-[11px] text-ink placeholder:text-faint focus:outline-hidden"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="text-dim hover:text-ink text-[10px] cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                {searchQuery.trim().length > 0 ? (
                  filteredFiles.length === 0 ? (
                    <div className="text-[10px] text-faint p-2 text-center italic font-sans">
                      Sin coincidencias
                    </div>
                  ) : (
                    filteredFiles.map((file) => (
                      <button
                        key={file.path}
                        type="button"
                        onClick={() => handleLoadFile(file.path)}
                        className={`flex items-center gap-1.5 py-1 px-2 rounded text-left w-full transition-colors cursor-pointer ${
                          activeFile?.path === file.path
                            ? "bg-blue-500/15 text-blue-300 font-semibold"
                            : "hover:bg-white/[0.04] text-dim hover:text-ink"
                        }`}
                      >
                        <FileText size={13} className="shrink-0 text-faint" />
                        <div className="flex flex-col min-w-0">
                          <span className="truncate text-[11px] font-mono">{file.name}</span>
                          <span className="truncate text-[9px] text-faint font-mono">{file.path}</span>
                        </div>
                      </button>
                    ))
                  )
                ) : (
                  DEFAULT_WORKSPACE_TREE.map((node) => (
                    <FileTreeItem
                      key={node.path}
                      node={node}
                      activePath={activeFile?.path}
                      expandedFolders={expandedFolders}
                      onToggleFolder={toggleFolder}
                      onSelectFile={handleLoadFile}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Columna Derecha: Visor de Archivo */}
            <div className="flex-1 min-w-0 p-3 flex flex-col h-full overflow-hidden">
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
                    Sub-Ego o el inspector proveen `filePath` + contenido o seleccionas un archivo del árbol.
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
