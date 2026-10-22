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
import { EmptyState } from "./EmptyState.js";
import { CronPanel } from "./CronPanel.js";
import { ShortcutsPanel } from "./ShortcutsPanel.js";
import { NotifyCenter } from "./NotifyCenter.js";
import { SHORTCUT_EVENT_NAME } from "./workbench-guards.js";
import { Tabs, type KitTab } from "../ui-kit/Tabs.js";
import { Button } from "../ui-kit/Button.js";
import { Input } from "../ui-kit/Input.js";

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
          { name: "NativeFsTool.ts", path: "packages/tools/src/native/NativeFsTool.ts", type: "file" },
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
          className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-1 py-1 text-left text-dim transition-colors hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          // La sangría depende de la profundidad del árbol (valor calculado en
          // runtime): Tailwind no puede expresarlo.
          // design-lint: allow
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          {isExpanded ? (
            <CaretDown size={12} className="shrink-0 text-faint" />
          ) : (
            <CaretRight size={12} className="shrink-0 text-faint" />
          )}
          {isExpanded ? (
            <FolderOpen size={13} className="shrink-0 text-warning" />
          ) : (
            <Folder size={13} className="shrink-0 text-warning" />
          )}
          <span className="truncate font-sans text-xs font-medium">{node.name}</span>
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
      className={`flex w-full cursor-pointer items-center gap-1.5 rounded-md px-1 py-1 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
        isSelected
          ? "bg-brand/10 font-semibold text-brand"
          : "text-dim hover:bg-raised hover:text-ink"
      }`}
      // La sangría depende de la profundidad del árbol (valor calculado en
      // runtime): Tailwind no puede expresarlo.
      // design-lint: allow
      style={{ paddingLeft: `${depth * 12 + 16}px` }}
    >
      <FileText size={13} className={`shrink-0 ${isSelected ? "text-brand" : "text-faint"}`} />
      <span className="truncate font-mono text-xs">{node.name}</span>
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

  const renderPreviewTab = () => (
    <div className="flex h-full gap-3">
      {/* Columna Izquierda: Explorador de Árbol (superficie propia) */}
      <div className="flex w-60 shrink-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-panel">
        <div className="border-b border-hairline p-2">
          <div
            className="flex items-center gap-1.5 rounded-[var(--radius-card)] border border-strong bg-raised px-2 py-1 text-xs focus-within:border-brand focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-brand"
            // Fila densa de toolbar: el botón de limpieza es sólo-icono y
            // mide 32 px para no reventar la altura del campo de filtrado.
            data-allow-small-targets="true"
          >
            <MagnifyingGlass size={13} className="shrink-0 text-dim" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar archivos..."
              className="w-full bg-transparent text-xs text-ink placeholder:text-faint focus:outline-none"
            />
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSearchQuery("")}
                aria-label="Limpiar filtro de archivos"
                className="-my-2 -mr-1 h-8 w-8 min-h-8 min-w-8"
              >
                ×
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-0.5 overflow-y-auto p-1.5">
          {searchQuery.trim().length > 0 ? (
            filteredFiles.length === 0 ? (
              <div className="p-2 text-center font-sans text-xs italic text-faint">
                Sin coincidencias
              </div>
            ) : (
              filteredFiles.map((file) => (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => handleLoadFile(file.path)}
                  className={`flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                    activeFile?.path === file.path
                      ? "bg-brand/10 font-semibold text-brand"
                      : "text-dim hover:bg-raised hover:text-ink"
                  }`}
                >
                  <FileText size={13} className="shrink-0 text-faint" />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-mono text-xs">{file.name}</span>
                    <span className="truncate font-mono text-xs text-faint">{file.path}</span>
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
      <div className="flex h-full min-w-0 flex-1 flex-col gap-2">
        {activeFile ? (
          <>
            <div className="flex shrink-0 items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-medium text-ink">{activeFile.path}</span>
                <span className="text-xs text-faint">· Vista previa activa</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setActiveFile(null)}
              >
                Cerrar visor
              </Button>
            </div>
            <div className="min-h-0 flex-1">
              <FilePreviewView filePath={activeFile.path} content={activeFile.content} />
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            {/* EGO-FIND-98 (Ola 10): el estado vacío dice QUÉ es, PARA QUÉ
                sirve y QUÉ hacer ahora — en vez de dejar la superficie
                abandonada con un texto suelto. */}
            <EmptyState
              icon={<FileText size={18} />}
              title="Vista previa de archivos"
              description="Esta columna muestra el contenido de un archivo del workspace en modo lectura. Elige un archivo del árbol de la izquierda, usa los accesos rápidos, o escribe una ruta para abrirlo directamente."
              action={
                <>
                  {QUICK_WORKSPACE_FILES.map((f) => (
                    <Button
                      key={f.path}
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleLoadFile(f.path)}
                    >
                      {f.label}
                    </Button>
                  ))}
                </>
              }
              hint="También puedes abrir un archivo desde el chat: los Sub-Egos lo proveen."
            />
            <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-hairline bg-panel p-3">
              <span className="text-xs font-semibold text-ink">Abrir por ruta</span>
              <div className="mt-2 flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Input
                    type="text"
                    placeholder="Ruta relativa (ej. docs/PLAN-EGO.md)..."
                    value={customPath}
                    onChange={(e) => setCustomPath(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => {
                    handleLoadFile(customPath);
                    setCustomPath("");
                  }}
                >
                  Cargar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Pestañas del kit (Radix): roles `tablist`/`tab`/`tabpanel` nativos y
  // navegación por teclado. El contenido de cada tab vive en `content`.
  const tabs: KitTab[] = WORKBENCH_TABS.map((t) => ({
    value: t,
    label: TAB_LABELS[t],
    content:
      t === "browser" ? (
        <BrowserView />
      ) : t === "preview" ? (
        renderPreviewTab()
      ) : t === "themes" ? (
        <ThemeIO />
      ) : t === "cron" ? (
        <CronPanel />
      ) : t === "shortcuts" ? (
        <ShortcutsPanel />
      ) : (
        <NotifyCenter />
      ),
  }));

  return (
    <div className="flex h-full flex-col gap-3">
      {/*
        El alto disponible se reparte por la API del kit, no por selectores
        arbitrarios sobre el DOM interno de Radix. `className` ancla la raíz
        del `Tabs` (columna flex que crece) y `contentClassName` ancla el
        `div[role=tabpanel]`: sin esto el iframe del navegador se colapsaría
        porque el panel no hereda el alto del workspace.
      */}
      <Tabs
        tabs={tabs}
        value={tab}
        onValueChange={(v) => setTab(v as WorkbenchTab)}
        ariaLabel="Workbench extendido"
        className="min-h-0 flex-1"
        contentClassName="min-h-0 flex-1"
      />
    </div>
  );
};
