import React, { useState, useEffect } from "react";
import {
  Gear,
  CircleNotch,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  CaretUp,
  CaretDown,
} from "@phosphor-icons/react";

export interface TaskItem {
  id: string;
  title: string;
  subEgoId?: string;
  status: "submitted" | "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";
  progress: number;
  progressMessage?: string;
}

export interface ActivityTrayProps {
  tasks?: TaskItem[];
  onPauseTask?: (taskId: string) => void;
  onResumeTask?: (taskId: string) => void;
  onCancelTask?: (taskId: string) => void;
}

export const ActivityTray: React.FC<ActivityTrayProps> = ({
  tasks: propTasks,
  onPauseTask,
  onResumeTask,
  onCancelTask,
}) => {
  const [tasks, setTasks] = useState<TaskItem[]>(propTasks ?? []);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (propTasks) {
      setTasks(propTasks);
      return;
    }

    // Suscripción al bridge IPC de Electron si está disponible
    const api = (window as unknown as { electronAPI?: { onTaskUpdate?: (cb: (task: TaskItem) => void) => () => void } }).electronAPI;
    if (api?.onTaskUpdate) {
      const unsubscribe = api.onTaskUpdate((updatedTask: TaskItem) => {
        setTasks((prev) => {
          const index = prev.findIndex((t) => t.id === updatedTask.id);
          if (index >= 0) {
            const next = [...prev];
            next[index] = updatedTask;
            return next;
          }
          return [...prev, updatedTask];
        });
      });
      return unsubscribe;
    }
  }, [propTasks]);

  const activeTasks = tasks.filter((t) => t.status === "running" || t.status === "queued");
  const pausedTasks = tasks.filter((t) => t.status === "paused");
  const latestRunning = activeTasks[0];

  if (activeTasks.length === 0 && pausedTasks.length === 0 && !isExpanded) {
    return (
      <footer className="flex h-6 shrink-0 items-center justify-between border-t border-hairline bg-raised px-3 text-[11px] text-faint">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
          <span className="font-mono text-[10px]">Sistema en Reposo · 0 tareas en segundo plano</span>
        </div>
        <span className="font-mono text-[10px] text-dim">Ego Background Engine</span>
      </footer>
    );
  }

  return (
    <footer className="relative flex flex-col border-t border-hairline bg-raised text-ink text-xs transition-all duration-200">
      {/* Barra compacta siempre visible en el footer */}
      <div className="flex h-7 shrink-0 items-center justify-between px-3 select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          {latestRunning ? (
            <>
              <CircleNotch size={13} className="animate-spin text-ink shrink-0" />
              <span className="font-medium truncate max-w-[240px]">
                {latestRunning.title}
              </span>
              <span className="font-mono text-[10px] text-faint shrink-0">
                [{latestRunning.progress}%]
              </span>
              {latestRunning.progressMessage && (
                <span className="text-[10px] text-dim truncate max-w-[280px]">
                  · {latestRunning.progressMessage}
                </span>
              )}
            </>
          ) : (
            <>
              <Pause size={13} className="text-amber-500 shrink-0" />
              <span className="text-faint">{pausedTasks.length} tarea(s) pausada(s)</span>
            </>
          )}

          {activeTasks.length > 1 && (
            <span className="rounded-full bg-panel px-1.5 py-0.2 font-mono text-[10px] text-dim border border-hairline">
              +{activeTasks.length - 1} más
            </span>
          )}
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-dim hover:text-ink hover:bg-panel transition-colors"
          title="Ver cola de tareas"
        >
          <span className="font-mono">Cola ({tasks.length})</span>
          {isExpanded ? <CaretDown size={11} /> : <CaretUp size={11} />}
        </button>
      </div>

      {/* Panel desplegable con la lista de tareas */}
      {isExpanded && (
        <div className="max-h-48 overflow-y-auto border-t border-hairline bg-panel p-2 space-y-1.5">
          {tasks.length === 0 ? (
            <p className="text-[11px] text-faint p-2">No hay tareas registradas.</p>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between rounded bg-raised p-2 text-xs border border-hairline"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {task.status === "running" && (
                    <CircleNotch size={12} className="animate-spin text-ink shrink-0" />
                  )}
                  {task.status === "paused" && (
                    <Pause size={12} className="text-amber-500 shrink-0" />
                  )}
                  {task.status === "completed" && (
                    <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                  )}
                  {task.status === "cancelled" && (
                    <XCircle size={12} className="text-rose-500 shrink-0" />
                  )}
                  {task.status === "queued" && (
                    <Gear size={12} className="text-dim shrink-0" />
                  )}
                  <span className="font-medium truncate max-w-[280px]">
                    {task.title}
                  </span>
                  <span className="font-mono text-[10px] text-dim shrink-0">
                    ({task.status})
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-mono text-[10px] text-faint mr-2">
                    {task.progress}%
                  </span>
                  {task.status === "running" && onPauseTask && (
                    <button
                      onClick={() => onPauseTask(task.id)}
                      className="rounded p-1 text-dim hover:text-ink hover:bg-raised"
                      title="Pausar"
                    >
                      <Pause size={12} />
                    </button>
                  )}
                  {task.status === "paused" && onResumeTask && (
                    <button
                      onClick={() => onResumeTask(task.id)}
                      className="rounded p-1 text-dim hover:text-ink hover:bg-raised"
                      title="Reanudar"
                    >
                      <Play size={12} />
                    </button>
                  )}
                  {(task.status === "running" || task.status === "queued") && onCancelTask && (
                    <button
                      onClick={() => onCancelTask(task.id)}
                      className="rounded p-1 text-rose-500/80 hover:text-rose-500 hover:bg-raised"
                      title="Cancelar"
                    >
                      <XCircle size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </footer>
  );
};
