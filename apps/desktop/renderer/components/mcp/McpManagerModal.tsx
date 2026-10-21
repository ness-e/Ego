import { useState, useEffect, type ReactNode } from "react";
import {
  PlugsConnected,
  Wrench,
  Sparkle,
} from "@phosphor-icons/react";
import {
  ego,
  type McpServerInfo,
  type ToolSummaryInfo,
  type ScannedSkillInfo,
} from "../../lib/ego.js";
import { Modal } from "../ui-kit/Modal.js";
import { Button } from "../ui-kit/Button.js";
import { McpServerList } from "./McpServerList.js";
import { ToolCatalogView } from "./ToolCatalogView.js";
import { SkillsCatalogView } from "./SkillsCatalogView.js";

interface McpManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "servers" | "tools" | "skills";
}

/**
 * T07 (UI-04): sobre ui-kit `Modal` (Radix Dialog — trap de foco + Escape +
 * `role="dialog"` + `aria-modal` nativos). Las pestañas de vista usan
 * `aria-pressed` (son conmutadores con texto visible, no tabs con panel) y
 * se construyen con el `Button` del kit, que aporta los 9 estados y el
 * anillo de foco visible.
 */
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

  const handleAddServer = async (config: McpServerInfo["config"]) => {
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

  const tabBtn = (
    id: "servers" | "tools" | "skills",
    icon: ReactNode,
    label: string,
    count: number
  ) => (
    <Button
      key={id}
      size="md"
      variant={activeTab === id ? "secondary" : "ghost"}
      onClick={() => setActiveTab(id)}
      aria-pressed={activeTab === id}
    >
      {icon}
      <span>{label}</span>
      <span className="font-mono text-xs bg-raised px-1.5 py-0.5 rounded-md text-dim border border-hairline">
        {count}
      </span>
    </Button>
  );

  return (
    <Modal
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Gestor de Ecosistema & Extensiones"
      description="Nivel B MCP + Skills · Local Sovereign Runtime · SafeConfigMutation (COUC-10)"
      wide
    >
      {/* Barra de Pestañas */}
      <div className="flex shrink-0 items-center gap-1 border-b border-hairline pb-2">
        {tabBtn("servers", <PlugsConnected size={15} />, "Servidores MCP", servers.length)}
        {tabBtn("tools", <Wrench size={15} />, "Marketplace & Herramientas", tools.length)}
        {tabBtn("skills", <Sparkle size={15} />, "Skills Locales (HERM-19)", skills.length)}
      </div>

      {/* Contenido de la Pestaña Activa */}
      <div className="min-h-0 pt-2">
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
      <div className="flex shrink-0 items-center justify-between border-t border-hairline pt-2 text-xs text-dim">
        <div className="flex items-center gap-2 font-mono text-xs">
          <span>Local Sovereign Runtime</span>
          <span>·</span>
          <span>SafeConfigMutation (COUC-10)</span>
        </div>
        <Button size="md" variant="primary" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </Modal>
  );
}
