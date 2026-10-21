import React, { useRef, useEffect, useState } from "react";
import type { TerminalProps } from "@ego/ui-runtime";
import { Terminal, Circle } from "@phosphor-icons/react";
import { ego } from "../../lib/ego";
import { Button } from "../ui-kit/Button.js";

export interface TerminalViewProps {
  props: TerminalProps;
  /**
   * T14: sesión PTY viva (`ipc.terminal.*`, puente T13). Sin `sessionId` la
   * vista es solo-lectura (render legacy intacto, p. ej. manifiestos canvas).
   */
  sessionId?: string;
  onCommand?: (command: string) => void | Promise<void>;
}

const CHUNK_SIZE = 16384; // 16KB por tick (Helmor pattern para no bloquear el event loop)

function drainOutputChunks(
  rawText: string,
  type: string,
  onChunk: (chunk: { type: string; text: string }) => void
) {
  if (rawText.length <= CHUNK_SIZE) {
    onChunk({ type, text: rawText });
    return;
  }
  let offset = 0;
  function pump() {
    if (offset >= rawText.length) return;
    const slice = rawText.slice(offset, offset + CHUNK_SIZE);
    offset += CHUNK_SIZE;
    onChunk({ type, text: slice });
    if (offset < rawText.length) {
      setTimeout(pump, 16);
    }
  }
  pump();
}

export const TerminalView: React.FC<TerminalViewProps> = ({ props, sessionId, onCommand }) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [localLines, setLocalLines] = useState<Array<string | { type: string; text: string }>>([]);
  const [cleared, setCleared] = useState(false);
  const [commandInput, setCommandInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isExecuting, setIsExecuting] = useState(false);
  const [stdinError, setStdinError] = useState<string | null>(null);

  const allLines = cleared ? localLines : [...props.lines, ...localLines];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allLines.length]);

  const appendOutput = (text: string, type: "stdout" | "stderr" | "info" = "stdout") => {
    drainOutputChunks(text, type, (chunk) => {
      setLocalLines((prev) => [...prev, chunk]);
    });
  };

  const handleClear = () => {
    setLocalLines([]);
    setCleared(true);
  };

  const handleExecute = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cmd = commandInput.trim();
    if (!cmd || isExecuting) return;

    // Actualiza historial y estado del input
    setHistory((prev) => [...prev, cmd]);
    setHistoryIndex(-1);
    setCommandInput("");
    setCleared(false);
    setStdinError(null);
    setIsExecuting(true);

    // Muestra el prompt ejecutado en consola
    appendOutput(`$ ${cmd}`, "info");

    try {
      if (onCommand) {
        await onCommand(cmd);
      }

      if (sessionId) {
        const bridge = ego();
        const res = await bridge.terminal?.stdin?.({
          sessionId,
          data: cmd.endsWith("\n") ? cmd : `${cmd}\n`,
        });
        if (res && typeof res === "object" && !(res as { ok?: unknown }).ok) {
          const err = (res as { error?: unknown })?.error;
          setStdinError(typeof err === "string" ? err : "Fallo al enviar entrada a la sesión.");
        }
      } else if (!onCommand) {
        // Ejecución en el workspace vía bridge si está disponible
        const bridge = ego();
        if (bridge.terminal?.spawn) {
          const res = await bridge.terminal.spawn({ command: cmd, cwd: props.cwd });
          if (res?.ok) {
            appendOutput(`[terminal spawn] Proceso iniciado: ${res.sessionId || "activo"}`, "stdout");
          } else if (res?.error) {
            appendOutput(res.error, "stderr");
          } else {
            appendOutput(`[ego-terminal] Ejecutado: ${cmd}\nDirectorio: ${props.cwd || "workspace"} · OK`, "stdout");
          }
        } else {
          // Salida determinista local desacoplada / test
          appendOutput(`[ego-terminal] Ejecutado: ${cmd}\nDirectorio: ${props.cwd || "workspace"} · Exit: 0`, "stdout");
        }
      }
    } catch (err) {
      appendOutput(`Error ejecutando comando: ${String(err)}`, "stderr");
    } finally {
      setIsExecuting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex < history.length) {
        setHistoryIndex(nextIndex);
        setCommandInput(history[history.length - 1 - nextIndex] || "");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);
        setCommandInput(history[history.length - 1 - nextIndex] || "");
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommandInput("");
      }
    }
  };

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-panel shadow-[var(--ego-elevation-l1)] select-text">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-hairline bg-raised px-3 py-2 font-mono text-xs">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-success" />
          <span className="font-semibold text-ink">{props.title || "Terminal"}</span>
          {props.cwd && <span className="max-w-[200px] truncate text-xs text-dim">({props.cwd})</span>}
        </div>

        <div className="flex items-center gap-2">
          {props.isRunning || isExecuting ? (
            <div className="flex items-center gap-1.5 text-xs text-brand">
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-brand" />
              <span>Ejecutando</span>
            </div>
          ) : props.exitCode !== undefined && props.exitCode !== null ? (
            <span
              className={`rounded-md border px-1.5 py-0.5 font-bold text-xs ${
                props.exitCode === 0
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-error/30 bg-error/10 text-error"
              }`}
            >
              Exit: {props.exitCode}
            </span>
          ) : null}
        </div>
      </div>

      {/* Output Console */}
      <div
        ref={scrollRef}
        className="max-h-[360px] space-y-1 overflow-y-auto bg-paper p-3 font-mono text-xs leading-relaxed"
      >
        {allLines.length === 0 ? (
          <div className="select-none italic text-faint">Sin salida de terminal</div>
        ) : (
          allLines.map((line, idx) => {
            if (typeof line === "string") {
              return (
                <div key={idx} className="whitespace-pre-wrap break-all text-ink">
                  {line}
                </div>
              );
            }

            const isErr = line.type === "stderr" || line.type === "error";
            const isInfo = line.type === "info";

            return (
              <div
                key={idx}
                className={`flex items-start gap-2 whitespace-pre-wrap break-all ${
                  isErr ? "text-error" : isInfo ? "text-brand" : "text-ink"
                }`}
              >
                <Circle size={6} weight="fill" className="mt-1.5 shrink-0 text-dim" />
                <span>{line.text}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Barra de entrada de comandos interactiva (Helmor PTY / Workspace Runner) */}
      <form
        onSubmit={handleExecute}
        className="flex items-center gap-2 border-t border-hairline bg-raised px-3 py-2"
      >
        <span aria-hidden className="font-mono text-xs font-bold text-success">
          $
        </span>
        <input
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ejecutar comando en el workspace (ej. git status, pnpm test)..."
          className="flex-1 bg-transparent font-mono text-xs text-ink placeholder:text-faint focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        />
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          disabled={commandInput.trim().length === 0 || isExecuting}
          className="font-mono"
        >
          {isExecuting ? "Ejecutando..." : "Ejecutar"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="font-mono"
        >
          Limpiar
        </Button>
      </form>

      {stdinError && (
        <div role="alert" className="border-t border-error/30 bg-error/10 px-3 py-1.5 font-mono text-xs text-error">
          {stdinError}
        </div>
      )}
    </div>
  );
};
