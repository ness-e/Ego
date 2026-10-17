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
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [taskName, setTaskName] = useState("");
  const [taskSchedule, setTaskSchedule] = useState("manual");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleCreateTask = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!taskName.trim()) return;
      setIsSubmitting(true);
      try {
        await ego().memory?.("put", [
          {
            namespace: "system/tasks/queue",
            key: `task_${Date.now()}`,
            payload: {
              title: taskName.trim(),
              schedule: taskSchedule,
              createdAt: Date.now(),
              status: "queued",
            },
          },
        ]);
        setTaskName("");
        setShowCreateForm(false);
        await refresh();
      } catch {
        // Best-effort
      } finally {
        setIsSubmitting(false);
      }
    },
    [taskName, taskSchedule, refresh]
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
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="rounded border border-hairline bg-raised px-2.5 py-1 text-[11px] text-ink transition-colors hover:bg-panel cursor-pointer"
          >
            {showCreateForm ? "Cerrar" : "+ Nueva Tarea"}
          </button>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded border border-hairline bg-raised px-2.5 py-1 text-[11px] text-dim transition-colors hover:text-ink cursor-pointer"
          >
            Actualizar
          </button>
        </div>
      </div>

      {showCreateForm && (
        <form
          onSubmit={handleCreateTask}
          className="flex flex-col gap-2 rounded-lg border border-hairline bg-paper p-3 text-xs"
        >
          <span className="font-semibold text-ink">Nueva Tarea en Segundo Plano</span>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-faint">Nombre / Objetivo:</label>
            <input
              type="text"
              placeholder="ej. Sincronización nocturna de memoria"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              className="rounded border border-hairline bg-raised px-2 py-1 text-xs text-ink placeholder:text-faint focus:outline-hidden"
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-[10px] text-faint">Programación / Cadencia:</label>
              <select
                value={taskSchedule}
                onChange={(e) => setTaskSchedule(e.target.value)}
                className="rounded border border-hairline bg-raised px-2 py-1 text-xs text-ink focus:outline-hidden"
              >
                <option value="manual">Manual (One-off)</option>
                <option value="every_5m">Cada 5 minutos</option>
                <option value="every_1h">Cada hora</option>
                <option value="daily">Diario (00:00 UTC)</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !taskName.trim()}
              className="mt-4 rounded border border-hairline bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? "Encolando..." : "Encolar"}
            </button>
          </div>
        </form>
      )}

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
                className="shrink-0 rounded border border-hairline bg-raised px-2 py-0.5 text-[11px] text-dim transition-colors hover:text-ink cursor-pointer"
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
