import { useState } from "react";
import { Warning } from "@phosphor-icons/react";
import { Modal } from "../ui-kit/Modal.js";

interface McpAddServerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (config: {
    id: string;
    name: string;
    transport: "stdio" | "sse";
    command: string;
    args?: string[];
    env?: Record<string, string>;
    toolPrefix?: string;
    timeoutMs?: number;
  }) => Promise<void>;
}

interface McpPreset {
  label: string;
  id: string;
  name: string;
  command: string;
  args: string;
  toolPrefix: string;
  env?: string;
}

const MCP_PRESETS: McpPreset[] = [
  {
    label: "GitHub",
    id: "github-mcp",
    name: "GitHub Oficial",
    command: "npx",
    args: "-y @modelcontextprotocol/server-github",
    toolPrefix: "gh",
    env: "GITHUB_PERSONAL_ACCESS_TOKEN=",
  },
  {
    label: "Filesystem",
    id: "filesystem-mcp",
    name: "Filesystem Local",
    command: "npx",
    args: "-y @modelcontextprotocol/server-filesystem .",
    toolPrefix: "fs",
  },
  {
    label: "Postgres",
    id: "postgres-mcp",
    name: "PostgreSQL Database",
    command: "npx",
    args: "-y @modelcontextprotocol/server-postgres postgresql://localhost/mydb",
    toolPrefix: "pg",
  },
  {
    label: "Brave Search",
    id: "brave-search-mcp",
    name: "Brave Search API",
    command: "npx",
    args: "-y @modelcontextprotocol/server-brave-search",
    toolPrefix: "brave",
    env: "BRAVE_API_KEY=",
  },
  {
    label: "SQLite",
    id: "sqlite-mcp",
    name: "SQLite Local",
    command: "npx",
    args: "-y @modelcontextprotocol/server-sqlite --db-path ./data.db",
    toolPrefix: "sqlite",
  },
];

/**
 * T07 (UI-04): sobre ui-kit `Modal` (Radix Dialog — trap de foco + Escape +
 * `role="dialog"` + `aria-modal` nativos). Cada campo lleva `htmlFor` + `id`
 * (las `<label>` hermanas solas no asocian según axe `label`) y el error usa
 * `role="alert"`.
 */
export function McpAddServerDialog({ isOpen, onClose, onSubmit }: McpAddServerDialogProps) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [argsRaw, setArgsRaw] = useState("");
  const [envRaw, setEnvRaw] = useState("");
  const [toolPrefix, setToolPrefix] = useState("");
  const [timeoutMs, setTimeoutMs] = useState("30000");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const applyPreset = (preset: McpPreset) => {
    setId(preset.id);
    setName(preset.name);
    setCommand(preset.command);
    setArgsRaw(preset.args);
    setToolPrefix(preset.toolPrefix);
    if (preset.env) setEnvRaw(preset.env);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanId = id.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanCommand = command.trim();

    if (!cleanId || !cleanName || !cleanCommand) {
      setError("Los campos ID, Nombre y Comando son obligatorios.");
      return;
    }

    if (!/^[a-zA-Z0-9_\-.:]{1,64}$/.test(cleanId)) {
      setError("El ID debe contener solo letras, números, guiones y puntos (1-64 caracteres).");
      return;
    }

    const args = argsRaw.trim() ? argsRaw.trim().split(/\s+/) : [];
    const env: Record<string, string> = {};
    if (envRaw.trim()) {
      const lines = envRaw.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const k = trimmed.slice(0, eqIdx).trim();
          const v = trimmed.slice(eqIdx + 1).trim();
          if (k) env[k] = v;
        }
      }
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        id: cleanId,
        name: cleanName,
        transport: "stdio",
        command: cleanCommand,
        args: args.length > 0 ? args : undefined,
        env: Object.keys(env).length > 0 ? env : undefined,
        toolPrefix: toolPrefix.trim() || undefined,
        timeoutMs: parseInt(timeoutMs, 10) || 30000,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Añadir Servidor MCP (stdio)"
      description="Subproceso local para el Tool Registry de Ego (Nivel B). Esc para salir."
    >
      {/* Plantillas Rápidas (1-Clic) */}
      <div className="mb-3 space-y-1.5 rounded-lg border border-hairline bg-paper/60 p-2.5">
        <span className="block text-[10px] font-semibold tracking-wider uppercase text-dim/80">
          Plantillas Rápidas (1-Clic)
        </span>
        <div className="flex flex-wrap gap-1.5">
          {MCP_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p)}
              className="rounded-full border border-hairline bg-raised hover:bg-raised/80 hover:border-strong px-2.5 py-0.5 text-[11px] font-mono text-ink transition-colors cursor-pointer shadow-2xs"
              title={`Autocompletar configuración para ${p.name}`}
            >
              + {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded border border-rose-500/40 bg-rose-950/30 p-2.5 text-rose-300"
          >
            <Warning size={14} className="shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="mcp-srv-id" className="block text-[11px] font-medium text-dim mb-1">
              ID Único (slug)
            </label>
            <input
              id="mcp-srv-id"
              type="text"
              placeholder="ej. github-mcp"
              value={id}
              onChange={(e) => setId(e.target.value)}
              className="w-full rounded border border-hairline bg-paper px-2.5 py-1.5 text-xs text-ink placeholder:text-dim/60 focus:border-ink/50 focus:outline-hidden"
            />
          </div>
          <div>
            <label htmlFor="mcp-srv-name" className="block text-[11px] font-medium text-dim mb-1">
              Nombre Descriptivo
            </label>
            <input
              id="mcp-srv-name"
              type="text"
              placeholder="ej. GitHub Oficial"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-hairline bg-paper px-2.5 py-1.5 text-xs text-ink placeholder:text-dim/60 focus:border-ink/50 focus:outline-hidden"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label htmlFor="mcp-srv-command" className="block text-[11px] font-medium text-dim mb-1">
              Comando Ejecutable
            </label>
            <input
              id="mcp-srv-command"
              type="text"
              placeholder="ej. npx, python, node, uvx"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="w-full rounded border border-hairline bg-paper px-2.5 py-1.5 text-xs text-ink placeholder:text-dim/60 font-mono focus:border-ink/50 focus:outline-hidden"
            />
          </div>
          <div>
            <label htmlFor="mcp-srv-prefix" className="block text-[11px] font-medium text-dim mb-1">
              Prefijo de Herramientas
            </label>
            <input
              id="mcp-srv-prefix"
              type="text"
              placeholder="ej. gh"
              value={toolPrefix}
              onChange={(e) => setToolPrefix(e.target.value)}
              className="w-full rounded border border-hairline bg-paper px-2.5 py-1.5 text-xs text-ink placeholder:text-dim/60 font-mono focus:border-ink/50 focus:outline-hidden"
            />
          </div>
        </div>

        <div>
          <label htmlFor="mcp-srv-args" className="block text-[11px] font-medium text-dim mb-1">
            Argumentos del Subproceso (separados por espacio)
          </label>
          <input
            id="mcp-srv-args"
            type="text"
            placeholder="-y @modelcontextprotocol/server-github"
            value={argsRaw}
            onChange={(e) => setArgsRaw(e.target.value)}
            className="w-full rounded border border-hairline bg-paper px-2.5 py-1.5 text-xs text-ink placeholder:text-dim/60 font-mono focus:border-ink/50 focus:outline-hidden"
          />
        </div>

        <div>
          <label htmlFor="mcp-srv-env" className="block text-[11px] font-medium text-dim mb-1">
            Variables de Entorno (formato CLAVE=VALOR, una por línea)
          </label>
          <textarea
            id="mcp-srv-env"
            rows={3}
            placeholder="GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxx"
            value={envRaw}
            onChange={(e) => setEnvRaw(e.target.value)}
            className="w-full rounded border border-hairline bg-paper p-2 text-xs text-ink placeholder:text-dim/60 font-mono focus:border-ink/50 focus:outline-hidden resize-none"
          />
        </div>

        <div>
          <label htmlFor="mcp-srv-timeout" className="block text-[11px] font-medium text-dim mb-1">
            Timeout de Invocación (ms)
          </label>
          <input
            id="mcp-srv-timeout"
            type="number"
            value={timeoutMs}
            onChange={(e) => setTimeoutMs(e.target.value)}
            className="w-32 rounded border border-hairline bg-paper px-2.5 py-1.5 text-xs text-ink placeholder:text-dim/60 font-mono focus:border-ink/50 focus:outline-hidden"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-hairline">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded px-3 py-1.5 text-xs text-faint hover:bg-raised hover:text-ink transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded bg-ink px-4 py-1.5 text-xs font-semibold text-paper hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isSubmitting ? "Conectando..." : "Guardar y Conectar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
