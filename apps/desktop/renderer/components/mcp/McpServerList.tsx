import { useState } from "react";
import {
  PlugsConnected,
  Plus,
  Trash,
  ToggleLeft,
  ToggleRight,
  WarningCircle,
  Terminal,
  Clock,
} from "@phosphor-icons/react";
import type { McpServerInfo } from "../../lib/ego";
import { McpAddServerDialog } from "./McpAddServerDialog";

interface McpServerListProps {
  servers: McpServerInfo[];
  isLoading: boolean;
  onAddServer: (config: any) => Promise<void>;
  onToggleServer: (id: string, enabled: boolean) => Promise<void>;
  onRemoveServer: (id: string) => Promise<void>;
}

export function McpServerList({
  servers,
  isLoading,
  onAddServer,
  onToggleServer,
  onRemoveServer,
}: McpServerListProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleToggle = async (id: string, currentEnabled: boolean) => {
    setBusyId(id);
    try {
      await onToggleServer(id, !currentEnabled);
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm(`¿Eliminar servidor MCP '${id}'? Sus herramientas se retirarán del catálogo.`)) {
      return;
    }
    setBusyId(id);
    try {
      await onRemoveServer(id);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Barra de Acciones Superior */}
      <div className="flex items-center justify-between pb-2 border-b border-hairline">
        <div>
          <h2 className="text-sm font-semibold text-ink">Servidores MCP Configurados</h2>
          <p className="text-[11px] text-faint">
            Subprocesos locales y conexiones stdio/SSE para el Tool Registry de Ego (Nivel B).
          </p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-1.5 rounded bg-ink px-3 py-1.5 text-xs font-medium text-paper hover:opacity-90 transition-opacity shadow-sm"
        >
          <Plus size={14} weight="bold" />
          <span>Añadir Servidor</span>
        </button>
      </div>

      {/* Lista de Servidores */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
        {isLoading && servers.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-xs text-dim">
            Cargando servidores MCP...
          </div>
        ) : servers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 border border-dashed border-hairline rounded-lg p-6 text-center space-y-2">
            <PlugsConnected size={28} className="text-dim" />
            <span className="text-xs font-medium text-ink">Sin servidores MCP activos</span>
            <p className="text-[11px] text-faint max-w-sm">
              Conecta servidores MCP locales para dotar a los Sub-Egos de herramientas externas
              (GitHub, bases de datos, APIs de terceros o scripts propios).
            </p>
            <button
              onClick={() => setIsAddOpen(true)}
              className="mt-2 rounded bg-raised px-3 py-1 text-xs text-ink hover:bg-hairline transition-colors"
            >
              + Añadir Primer Servidor
            </button>
          </div>
        ) : (
          servers.map((server) => {
            const isBusy = busyId === server.id;
            return (
              <div
                key={server.id}
                className={`flex flex-col rounded-lg border p-3.5 transition-all ${
                  server.enabled
                    ? "border-hairline bg-paper/60 hover:border-ink/20"
                    : "border-hairline/60 bg-paper/20 opacity-70"
                }`}
              >
                <div className="flex items-start justify-between">
                  {/* Identidad y Estado */}
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${
                        server.status === "connected"
                          ? "bg-emerald-500 shadow-xs shadow-emerald-500/50 animate-pulse"
                          : server.status === "connecting"
                          ? "bg-cyan-500 animate-spin"
                          : server.status === "error"
                          ? "bg-rose-500"
                          : "bg-dim"
                      }`}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-ink">{server.name}</span>
                        <span className="font-mono text-[10px] text-dim bg-raised px-1.5 py-0.2 rounded">
                          {server.id}
                        </span>
                        {server.config.toolPrefix && (
                          <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-900/50">
                            prefix: {server.config.toolPrefix}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-dim font-mono">
                        <div className="flex items-center gap-1">
                          <Terminal size={12} />
                          <span>
                            {server.config.command} {(server.config.args || []).join(" ")}
                          </span>
                        </div>
                        {server.config.timeoutMs && (
                          <div className="flex items-center gap-1">
                            <Clock size={12} />
                            <span>{server.config.timeoutMs}ms</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Acciones y Toggles */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(server.id, server.enabled)}
                      disabled={isBusy}
                      title={server.enabled ? "Desconectar en caliente" : "Conectar servidor"}
                      className="text-faint hover:text-ink transition-colors disabled:opacity-50"
                    >
                      {server.enabled ? (
                        <ToggleRight size={24} weight="fill" className="text-emerald-400" />
                      ) : (
                        <ToggleLeft size={24} className="text-dim" />
                      )}
                    </button>
                    <button
                      onClick={() => handleRemove(server.id)}
                      disabled={isBusy}
                      title="Eliminar servidor"
                      className="p-1 rounded text-dim hover:text-rose-400 hover:bg-rose-950/20 transition-colors disabled:opacity-50"
                    >
                      <Trash size={15} />
                    </button>
                  </div>
                </div>

                {/* Mensaje de Error si existe */}
                {server.lastError && (
                  <div className="mt-2.5 flex items-center gap-1.5 rounded border border-rose-500/30 bg-rose-950/20 p-2 text-[11px] text-rose-300">
                    <WarningCircle size={14} className="text-rose-400 shrink-0" />
                    <span className="truncate">{server.lastError}</span>
                  </div>
                )}

                {/* Footer de la Card: Contador de herramientas */}
                <div className="mt-2.5 pt-2 border-t border-hairline/60 flex items-center justify-between text-[11px] text-dim">
                  <span>
                    Estado:{" "}
                    <span
                      className={`font-medium ${
                        server.status === "connected"
                          ? "text-emerald-400"
                          : server.status === "error"
                          ? "text-rose-400"
                          : "text-dim"
                      }`}
                    >
                      {server.status === "connected"
                        ? "Conectado"
                        : server.status === "connecting"
                        ? "Conectando..."
                        : server.status === "error"
                        ? "Error de conexión"
                        : "Desconectado"}
                    </span>
                  </span>
                  <span>
                    Herramientas activas:{" "}
                    <span className="font-mono text-ink font-semibold">{server.toolsCount}</span>
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <McpAddServerDialog
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSubmit={onAddServer}
      />
    </div>
  );
}
