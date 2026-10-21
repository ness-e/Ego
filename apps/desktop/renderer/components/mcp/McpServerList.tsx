import { useState } from "react";
import {
  PlugsConnected,
  Plus,
  Trash,
  WarningCircle,
  Terminal,
  Clock,
} from "@phosphor-icons/react";
import type { McpServerInfo } from "../../lib/ego.js";
import { Button } from "../ui-kit/Button.js";
import { Switch } from "../ui-kit/Switch.js";
import { McpAddServerDialog } from "./McpAddServerDialog.js";

interface McpServerListProps {
  servers: McpServerInfo[];
  isLoading: boolean;
  onAddServer: (config: McpServerInfo["config"]) => Promise<void>;
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
          <h3 className="text-sm font-semibold text-ink">Servidores MCP Configurados</h3>
          <p className="text-xs text-faint">
            Subprocesos locales y conexiones stdio/SSE para el Tool Registry de Ego (Nivel B).
          </p>
        </div>
        <Button
          size="md"
          variant="primary"
          icon={<Plus size={14} weight="bold" />}
          onClick={() => setIsAddOpen(true)}
          className="shrink-0 whitespace-nowrap"
        >
          Añadir Servidor
        </Button>
      </div>

      {/* Lista de Servidores */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
        {isLoading && servers.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-xs text-dim">
            Cargando servidores MCP...
          </div>
        ) : servers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 border border-dashed border-hairline rounded-[var(--radius-card)] p-6 text-center space-y-2">
            <PlugsConnected size={28} className="text-dim" />
            <span className="text-xs font-medium text-ink">Sin servidores MCP activos</span>
            <p className="text-xs text-faint max-w-sm">
              Conecta servidores MCP locales para dotar a los Sub-Egos de herramientas externas
              (GitHub, bases de datos, APIs de terceros o scripts propios).
            </p>
            <Button
              size="md"
              variant="secondary"
              icon={<Plus size={14} weight="bold" />}
              onClick={() => setIsAddOpen(true)}
              className="mt-2 whitespace-nowrap"
            >
              Añadir Primer Servidor
            </Button>
          </div>
        ) : (
          servers.map((server) => {
            const isBusy = busyId === server.id;
            return (
              <div
                key={server.id}
                className={`flex flex-col rounded-[var(--radius-card)] border p-3.5 transition-colors ${
                  server.enabled
                    ? "border-hairline bg-raised hover:border-strong"
                    : "border-hairline bg-panel"
                }`}
              >
                <div className="flex items-start justify-between">
                  {/* Identidad y Estado */}
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${
                        server.status === "connected"
                          ? "bg-success animate-pulse"
                          : server.status === "connecting"
                          ? "bg-brand animate-spin"
                          : server.status === "error"
                          ? "bg-error"
                          : "bg-dim"
                      }`}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-ink">{server.name}</span>
                        <span className="font-mono text-xs text-dim bg-raised px-1.5 py-0.5 rounded-md">
                          {server.id}
                        </span>
                        {server.config.toolPrefix && (
                          <span className="font-mono text-xs text-success bg-success/10 px-1.5 py-0.5 rounded-md border border-success/40">
                            prefix: {server.config.toolPrefix}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-dim font-mono">
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

                  {/* Acciones y Toggles. El interruptor usa el `Switch` del
                      kit (Radix): aporta `role="switch"` + `aria-checked`,
                      navegación por teclado y —gracias a la prop `label`—
                      un área pulsable que envuelve al control (la pista de
                      36×20 px sola no llega al target táctil). Antes era un
                      `<button>` con los glifos ToggleLeft/ToggleRight, que
                      no exponían el estado a la tecnología asistiva. */}
                  <div className="flex items-center gap-2">
                    <Switch
                      size="sm"
                      checked={server.enabled}
                      onCheckedChange={() => handleToggle(server.id, server.enabled)}
                      disabled={isBusy}
                      label="Activo"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemove(server.id)}
                      disabled={isBusy}
                      title="Eliminar servidor"
                      aria-label={`Eliminar ${server.name}`}
                      className="text-dim hover:bg-error/10 hover:text-error"
                    >
                      <Trash size={15} />
                    </Button>
                  </div>
                </div>

                {/* Mensaje de Error si existe */}
                {server.lastError && (
                  <div className="mt-2.5 flex items-center gap-1.5 rounded-[var(--radius-card)] border border-error/30 bg-error/10 p-2 text-xs text-error">
                    <WarningCircle size={14} className="text-error shrink-0" />
                    <span className="truncate">{server.lastError}</span>
                  </div>
                )}

                {/* Footer de la Card: Contador de herramientas */}
                <div className="mt-2.5 pt-2 border-t border-hairline flex items-center justify-between text-xs text-dim">
                  <span>
                    Estado:{" "}
                    <span
                      className={`font-medium ${
                        server.status === "connected"
                          ? "text-success"
                          : server.status === "error"
                          ? "text-error"
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
