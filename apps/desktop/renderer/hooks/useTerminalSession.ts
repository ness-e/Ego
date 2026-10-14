import { useState, useEffect, useCallback, useRef } from "react";
import {
  defaultTerminalSessionStore,
  TerminalSessionStore,
  type TerminalSessionSnapshot,
  type TerminalSessionStatus,
} from "@ego/ui-runtime";
import { ego } from "../lib/ego";

export interface UseTerminalSessionOptions {
  store?: TerminalSessionStore;
}

export interface UseTerminalSessionResult {
  snapshot: TerminalSessionSnapshot | null;
  output: string;
  status: TerminalSessionStatus | "idle";
  exitCode: number | null;
  isRunning: boolean;
  isTruncated: boolean;
  writeStdin: (data: string) => boolean;
  close: () => void;
  clear: () => void;
}

/**
 * Hook reactivo para conectar componentes de interfaz con una sesión de terminal (HELM-03).
 * Desacopla la ingesta de salida PTY del ciclo global de renderizado para evitar bloqueos a 60 FPS.
 */
export function useTerminalSession(
  sessionId: string | null | undefined,
  options: UseTerminalSessionOptions = {}
): UseTerminalSessionResult {
  const store = options.store ?? defaultTerminalSessionStore;
  const [snapshot, setSnapshot] = useState<TerminalSessionSnapshot | null>(() => {
    return sessionId ? store.getSession(sessionId) ?? null : null;
  });
  const [output, setOutput] = useState<string>("");
  const [status, setStatus] = useState<TerminalSessionStatus | "idle">(
    snapshot?.status ?? "idle"
  );
  const [exitCode, setExitCode] = useState<number | null>(snapshot?.exitCode ?? null);
  const [isTruncated, setIsTruncated] = useState<boolean>(snapshot?.truncated ?? false);

  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  useEffect(() => {
    if (!sessionId) {
      setSnapshot(null);
      setOutput("");
      setStatus("idle");
      setExitCode(null);
      setIsTruncated(false);
      return;
    }

    const currentSnap = store.getSession(sessionId);
    setSnapshot(currentSnap ?? null);
    setStatus(currentSnap?.status ?? "running");
    setExitCode(currentSnap?.exitCode ?? null);
    setIsTruncated(currentSnap?.truncated ?? false);

    const attachResult = store.attach(
      sessionId,
      (chunk: string) => {
        setOutput((prev) => prev + chunk);
      },
      (newStatus, newCode) => {
        setStatus(newStatus);
        setExitCode(newCode);
        const updated = store.getSession(sessionId);
        if (updated) {
          setSnapshot(updated);
          setIsTruncated(updated.truncated);
        }
      }
    );

    if (attachResult) {
      setOutput(attachResult.replayChunks.join(""));
    }

    return () => {
      attachResult?.detach();
    };
  }, [sessionId, store]);

  // T14: eventos PTY del backend (`ipc.event` con kind `terminal.*`, main.ts)
  // para sesiones vivas vía `ipc.terminal.*`. Sin bridge: no-op honesto.
  useEffect(() => {
    if (!sessionId) return;
    const sid = sessionId;
    const unsubscribe = ego().onEvent?.((event: unknown) => {
      if (typeof event !== "object" || event === null) return;
      const e = event as Record<string, unknown>;
      if (typeof e.kind !== "string" || !e.kind.startsWith("terminal.")) return;
      if (e.sessionId !== sid) return;
      if (e.kind === "terminal.output" && typeof e.chunk === "string") {
        setOutput((prev) => prev + (e.chunk as string));
      } else if (e.kind === "terminal.exited") {
        const code = typeof e.exitCode === "number" ? e.exitCode : 0;
        setStatus("exited");
        setExitCode(code);
      } else if (e.kind === "terminal.killed") {
        setStatus("exited");
        setExitCode(null);
      }
    });
    return () => {
      unsubscribe?.();
    };
  }, [sessionId]);

  const writeStdin = useCallback(
    (data: string) => {
      if (!sessionIdRef.current) return false;
      const sid = sessionIdRef.current;
      // T14: además del store local, reenviar al PTY real vía `terminal.stdin`.
      void ego()
        .terminal?.stdin?.({ sessionId: sid, data })
        .catch(() => {});
      return store.writeStdin(sid, data);
    },
    [store]
  );

  const close = useCallback(() => {
    if (!sessionIdRef.current) return;
    const sid = sessionIdRef.current;
    // T14: matar el PTY real además de cerrar la vista local.
    void ego()
      .terminal?.kill?.({ sessionId: sid })
      .catch(() => {});
    store.closeSession(sid);
  }, [store]);

  const clear = useCallback(() => {
    setOutput("");
  }, []);

  return {
    snapshot,
    output,
    status,
    exitCode,
    isRunning: status === "running",
    isTruncated,
    writeStdin,
    close,
    clear,
  };
}

/**
 * Hook para observar la lista reactiva de sesiones de terminal en un workspace (HELM-03).
 */
export function useWorkspaceTerminalSessions(
  workspaceId: string,
  options: UseTerminalSessionOptions = {}
): TerminalSessionSnapshot[] {
  const store = options.store ?? defaultTerminalSessionStore;
  const [sessions, setSessions] = useState<TerminalSessionSnapshot[]>(() =>
    store.getWorkspaceSessions(workspaceId)
  );

  useEffect(() => {
    const unsubscribe = store.subscribeWorkspace(workspaceId, (newSessions) => {
      setSessions(newSessions);
    });

    return () => {
      unsubscribe();
    };
  }, [workspaceId, store]);

  return sessions;
}
