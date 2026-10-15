import React, { useCallback, useEffect, useState } from "react";
import { ego } from "../../lib/ego.js";
import type { BackgroundTaskInfo } from "../../lib/ego.js";

/**
 * CFG-13 — Cron UI sobre el `BackgroundEngine` existente.
 * Solo consume IPC ya existente (`tasks.list` / `tasks.cancel`); cero
 * canales nuevos. Los jobs programados (curator, snapshots, sync) los crea
 * el main — acá solo se listan y cancelan. Sin polling: carga al montar +
 * botón actualizar (evita renders/llamadas en background).
 */
type CronState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; tasks: BackgroundTaskInfo[] };

export const CronPanel: React.FC = () => {
  const [state, setState] = useState<CronState>({ kind: "loading" });

  const refresh = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await ego().tasks.list();
      if (!res.ok) {
        setState({ kind: "error", message: res.error ?? "Error desconocido" });
        return;
      }
      setState({ kind: "ready", tasks: res.tasks });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Fallo la carga de tareas",
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCancel = useCallback(
    async (taskId: string) => {
      try {
        await ego().tasks.cancel({ taskId });
      } catch {
        // Best-effort: el refresh posterior refleja el estado real.
      }
      await refresh();
    },
    [refresh]
  );

  if (state.kind === "loading") {
    return (
      <p role="status" aria-busy="true" className="text-[11px] text-faint">
        Cargando tareas en segundo plano…
      </p>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="flex flex-col gap-2">
        <p role="alert" className="text-[11px] text-error">
          No se pudieron listar las tareas: {state.message}
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="w-fit rounded border border-hairline bg-raised px-2.5 py-1 text-[11px] text-ink"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-faint">
          {state.tasks.length === 0
            ? "Sin tareas en segundo plano."
            : `${state.tasks.length} tarea(s) en segundo plano.`}
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded border border-hairline bg-raised px-2.5 py-1 text-[11px] text-dim transition-colors hover:text-ink"
        >
          Actualizar
        </button>
      </div>
      {state.tasks.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {state.tasks.map((t) => (
            <li
              key={t.taskId}
              className="flex items-center justify-between gap-2 rounded border border-hairline bg-paper px-2 py-1.5"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-[11px] text-ink">{t.taskId}</p>
                <p className="font-mono text-[10px] text-faint">{t.status}</p>
              </div>
              <button
                type="button"
                onClick={() => void handleCancel(t.taskId)}
                aria-label={`Cancelar tarea ${t.taskId}`}
                className="shrink-0 rounded border border-hairline bg-raised px-2 py-0.5 text-[11px] text-dim transition-colors hover:text-ink"
              >
                Cancelar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
