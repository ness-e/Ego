import React, { useCallback, useEffect, useState } from "react";
import { ego } from "../../lib/ego.js";
import type { BackgroundTaskInfo } from "../../lib/ego.js";
import { Select } from "../ui-kit/Select.js";
import { Button } from "../ui-kit/Button.js";
import { Input } from "../ui-kit/Input.js";

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
      <div className="rounded-[var(--radius-card)] border border-hairline bg-panel p-4 shadow-[var(--ego-elevation-l1)]">
        <h3 className="mb-3 border-b border-hairline pb-3 text-sm font-semibold text-ink">
          Tareas en Segundo Plano
        </h3>
        <p role="status" aria-busy="true" className="text-xs text-faint">
          Cargando tareas en segundo plano…
        </p>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="rounded-[var(--radius-card)] border border-hairline bg-panel p-4 shadow-[var(--ego-elevation-l1)]">
        <h3 className="mb-3 border-b border-hairline pb-3 text-sm font-semibold text-ink">
          Tareas en Segundo Plano
        </h3>
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-xs text-error">
            No se pudieron listar las tareas: {state.message}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void refresh()}
            className="w-fit"
          >
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-hairline bg-panel p-4 shadow-[var(--ego-elevation-l1)]">
      <h3 className="mb-3 border-b border-hairline pb-3 text-sm font-semibold text-ink">
        Tareas en Segundo Plano
      </h3>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-faint">
            {state.tasks.length === 0
              ? "Sin tareas en segundo plano."
              : `${state.tasks.length} tarea(s) en segundo plano.`}
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              {showCreateForm ? "Cerrar" : "+ Nueva Tarea"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void refresh()}
            >
              Actualizar
            </Button>
          </div>
        </div>

        {showCreateForm && (
          <form
            onSubmit={handleCreateTask}
            className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-hairline bg-raised p-3 text-xs"
          >
            <span className="font-semibold text-ink">Nueva Tarea en Segundo Plano</span>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-faint" htmlFor="cfg13-cron-name">
                Nombre / Objetivo:
              </label>
              <Input
                id="cfg13-cron-name"
                type="text"
                placeholder="ej. Sincronización nocturna de memoria"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                required
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1">
                <label className="text-xs text-faint" htmlFor="cfg13-cron-schedule">
                  Programación / Cadencia:
                </label>
                <Select
                  id="cfg13-cron-schedule"
                  ariaLabel="Programación / Cadencia"
                  value={taskSchedule}
                  onValueChange={setTaskSchedule}
                  options={[
                    { value: "manual", label: "Manual (One-off)" },
                    { value: "every_5m", label: "Cada 5 minutos" },
                    { value: "every_1h", label: "Cada hora" },
                    { value: "daily", label: "Diario (00:00 UTC)" },
                  ]}
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={isSubmitting}
                disabled={!taskName.trim()}
              >
                {isSubmitting ? "Encolando..." : "Encolar"}
              </Button>
            </div>
          </form>
        )}

        {state.tasks.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {state.tasks.map((t) => (
              <li
                key={t.taskId}
                className="flex items-center justify-between gap-2 rounded-[var(--radius-card)] border border-hairline bg-raised px-2 py-1.5"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-ink">{t.taskId}</p>
                  <p className="font-mono text-xs text-faint">{t.status}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleCancel(t.taskId)}
                  aria-label={`Cancelar tarea ${t.taskId}`}
                  className="shrink-0"
                >
                  Cancelar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
