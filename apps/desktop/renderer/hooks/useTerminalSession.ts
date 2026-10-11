import { useState, useEffect, useCallback, useRef } from "react";
import {
  defaultTerminalSessionStore,
  TerminalSessionStore,
  type TerminalSessionSnapshot,
  type TerminalSessionStatus,
} from "@ego/ui-runtime";

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

  const writeStdin = useCallback(
    (data: string) => {
      if (!sessionIdRef.current) return false;
      return store.writeStdin(sessionIdRef.current, data);
    },
    [store]
  );

  const close = useCallback(() => {
    if (!sessionIdRef.current) return;
    store.closeSession(sessionIdRef.current);
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
