import { useState, useEffect } from "react";
import {
  X,
  PlugsConnected,
  Wrench,
  Sparkle,
} from "@phosphor-icons/react";
import {
  ego,
  type McpServerInfo,
  type ToolSummaryInfo,
  type ScannedSkillInfo,
} from "../../lib/ego";
import { McpServerList } from "./McpServerList";
import { ToolCatalogView } from "./ToolCatalogView";
import { SkillsCatalogView } from "./SkillsCatalogView";

interface McpManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "servers" | "tools" | "skills";
}

export function McpManagerModal({
  isOpen,
  onClose,
  initialTab = "servers",
}: McpManagerModalProps) {
  const [activeTab, setActiveTab] = useState<"servers" | "tools" | "skills">(initialTab);
  const [servers, setServers] = useState<McpServerInfo[]>([]);
  const [tools, setTools] = useState<ToolSummaryInfo[]>([]);
  const [skills, setSkills] = useState<ScannedSkillInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      void loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [srvList, toolList, skillList] = await Promise.all([
        ego().mcp.listServers(),
        ego().mcp.listTools(),
        ego().skills.listLocal(),
      ]);
      setServers(srvList);
      setTools(toolList);
      setSkills(skillList);
    } catch (err) {
      console.error("[McpManagerModal] Error al cargar datos:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddServer = async (config: any) => {
    await ego().mcp.addServer({ config, enabled: true });
    await loadData();
  };

  const handleToggleServer = async (id: string, enabled: boolean) => {
    await ego().mcp.toggleServer({ id, enabled });
    await loadData();
  };

  const handleRemoveServer = async (id: string) => {
    await ego().mcp.removeServer({ id });
    await loadData();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none">
      <div className="flex h-[620px] w-full max-w-4xl flex-col rounded-lg border border-hairline bg-panel text-ink shadow-2xl overflow-hidden">
        {/* Cabecera Principal */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-hairline px-4 bg-paper">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-ink text-paper flex items-center justify-center text-xs font-bold font-mono">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-ink">Gestor de Ecosistema & Extensiones</span>
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-900/40">
                  Nivel B MCP + Skills
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-faint hover:text-ink transition-colors p-1 rounded hover:bg-raised"
          >
            <X size={16} />
          </button>
        </div>

        {/* Barra de Pestañas */}
        <div className="flex h-10 shrink-0 border-b border-hairline bg-paper/60 px-4 items-center gap-1">
          <button
            onClick={() => setActiveTab("servers")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-colors ${
              activeTab === "servers"
                ? "bg-raised text-ink font-medium"
                : "text-faint hover:text-ink hover:bg-raised/40"
            }`}
          >
            <PlugsConnected size={15} />
            <span>Servidores MCP</span>
            <span className="font-mono text-[10px] bg-paper px-1.5 py-0.2 rounded text-dim border border-hairline">
              {servers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("tools")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-colors ${
              activeTab === "tools"
                ? "bg-raised text-ink font-medium"
                : "text-faint hover:text-ink hover:bg-raised/40"
            }`}
          >
            <Wrench size={15} />
            <span>Marketplace & Herramientas</span>
            <span className="font-mono text-[10px] bg-paper px-1.5 py-0.2 rounded text-dim border border-hairline">
              {tools.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("skills")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-colors ${
              activeTab === "skills"
                ? "bg-raised text-ink font-medium"
                : "text-faint hover:text-ink hover:bg-raised/40"
            }`}
          >
            <Sparkle size={15} />
            <span>Skills Locales (HERM-19)</span>
            <span className="font-mono text-[10px] bg-paper px-1.5 py-0.2 rounded text-dim border border-hairline">
              {skills.length}
            </span>
          </button>
        </div>

        {/* Contenido de la Pestaña Activa */}
        <div className="flex-1 min-h-0 p-4 overflow-hidden bg-panel">
          {activeTab === "servers" && (
            <McpServerList
              servers={servers}
              isLoading={isLoading}
              onAddServer={handleAddServer}
              onToggleServer={handleToggleServer}
              onRemoveServer={handleRemoveServer}
            />
          )}

          {activeTab === "tools" && (
            <ToolCatalogView tools={tools} isLoading={isLoading} />
          )}

          {activeTab === "skills" && (
            <SkillsCatalogView
              skills={skills}
              isLoading={isLoading}
              onRefresh={loadData}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex h-11 shrink-0 items-center justify-between border-t border-hairline px-4 bg-paper text-xs text-dim">
          <div className="flex items-center gap-2 font-mono text-[10px]">
            <span>Local Sovereign Runtime</span>
            <span>·</span>
            <span>SafeConfigMutation (COUC-10)</span>
          </div>
          <button
            onClick={onClose}
            className="rounded bg-ink px-3 py-1 text-xs font-semibold text-paper hover:opacity-90 transition-opacity"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
