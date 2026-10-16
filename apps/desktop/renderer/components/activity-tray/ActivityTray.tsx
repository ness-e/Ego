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
import { ego, type BackgroundTaskInfo } from "../../lib/ego";

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

const TASK_STATUSES = [
  "submitted",
  "queued",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
] as const;

/**
 * T14: normaliza un `BackgroundTaskInfo` del puente `tasks.list` (T13) al
 * `TaskItem` de la bandeja. Sin `taskId`/`id` → null (se descarta, nunca se inventa).
 */
function toTaskItem(value: BackgroundTaskInfo): TaskItem | null {
  const raw = value as unknown as Record<string, unknown>;
  const id =
    typeof raw.taskId === "string"
      ? raw.taskId
      : typeof raw.id === "string"
        ? raw.id
        : null;
  if (!id) return null;
  const title = typeof raw.title === "string" && raw.title.length > 0 ? raw.title : id;
  const statusRaw = typeof raw.status === "string" ? raw.status : "running";
  const status: TaskItem["status"] = (
    TASK_STATUSES as readonly string[]
  ).includes(statusRaw)
    ? (statusRaw as TaskItem["status"])
    : "running";
  const progress =
    typeof raw.progress === "number" && Number.isFinite(raw.progress)
      ? Math.max(0, Math.min(100, Math.round(raw.progress)))
      : 0;
  const item: TaskItem = { id, title, status, progress };
  if (typeof raw.subEgoId === "string") item.subEgoId = raw.subEgoId;
  if (typeof raw.progressMessage === "string") item.progressMessage = raw.progressMessage;
  return item;
}

/**
 * T06: guarda de frontera para updates de tareas vía el bus de eventos.
 * El preload expone `window.ego` (nunca `window.electronAPI`): la rama
 * `electronAPI` anterior era código muerto y se eliminó.
 */
function isTaskUpdateEvent(
  event: unknown,
): event is { type: string; payload: TaskItem } {
  if (typeof event !== "object" || event === null) return false;
  const e = event as { type?: unknown; payload?: unknown };
  if (typeof e.type !== "string" || !e.type.startsWith("task.")) return false;
  const p = e.payload as Partial<TaskItem> | undefined;
  return (
    !!p &&
    typeof p.id === "string" &&
    typeof p.title === "string" &&
    typeof p.status === "string" &&
    typeof p.progress === "number"
  );
}

export const ActivityTray: React.FC<ActivityTrayProps> = ({
  tasks: propTasks,
  onPauseTask,
  onResumeTask,
  onCancelTask,
}) => {
  const [tasks, setTasks] = useState<TaskItem[]>(propTasks ?? []);
  const [isExpanded, setIsExpanded] = useState(false);
  const toggleRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  // WCAG 2.2 AA: Escape colapsa el panel y devuelve el foco al trigger.
  const handleTrayKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && isExpanded) {
      e.preventDefault();
      e.stopPropagation();
      setIsExpanded(false);
      toggleRef.current?.focus();
    }
  };

  useEffect(() => {
    if (propTasks) {
      setTasks(propTasks);
      return;
    }

    // T14: fetch inicial `tasks.list` (puente T13). Sin bridge o ante error:
    // la bandeja queda en reposo honesto (sin tareas inventadas).
    let cancelled = false;
    void ego()
      .tasks?.list?.()
      .then((res) => {
        if (cancelled || !res || typeof res !== "object") return;
        const list = (res as { tasks?: unknown }).tasks;
        if (!Array.isArray(list)) return;
        const items: TaskItem[] = [];
        for (const t of list) {
          const mapped = toTaskItem(t as BackgroundTaskInfo);
          if (mapped) items.push(mapped);
        }
        setTasks(items);
      })
      .catch(() => {});

    // T06: suscripción al bus de eventos vivo (`ego().onEvent`).
    const unsubscribe = ego().onEvent?.((event: unknown) => {
      if (!isTaskUpdateEvent(event)) return;
      const updatedTask = event.payload;
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
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [propTasks]);

  /**
   * T14: cancelar va al puente `tasks.cancel` (T13) salvo que el padre pase
   * su propio handler (tests / wiring externo). Pausar/reanudar no tienen
   * backend: los botones solo existen si el padre pasa callbacks.
   */
  const handleCancel = (taskId: string) => {
    if (onCancelTask) {
      onCancelTask(taskId);
      return;
    }
    void ego()
      .tasks?.cancel?.({ taskId })
      .then((res) => {
        if (res && typeof res === "object" && (res as { ok?: unknown }).ok) {
          setTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, status: "cancelled" as const } : t))
          );
        }
      })
      .catch(() => {});
  };

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
    <footer
      className="relative flex flex-col border-t border-hairline bg-raised text-ink text-xs transition-colors duration-[var(--motion-duration-ui)]"
      onKeyDown={handleTrayKeyDown}
    >
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
          ref={toggleRef}
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-controls="activity-tray-panel"
          aria-label={isExpanded ? "Ocultar cola de tareas" : "Ver cola de tareas"}
          className="flex min-h-[24px] min-w-[24px] items-center gap-1 rounded px-2 py-1 text-[11px] text-dim hover:text-ink hover:bg-panel transition-colors"
          title="Ver cola de tareas"
        >
          <span className="font-mono">Cola ({tasks.length})</span>
          {isExpanded ? <CaretDown size={11} /> : <CaretUp size={11} />}
        </button>
      </div>

      {/* Panel desplegable con la lista de tareas */}
      {isExpanded && (
        <div
          ref={panelRef}
          id="activity-tray-panel"
          role="region"
          aria-label="Cola de tareas en segundo plano"
          className="max-h-48 overflow-y-auto border-t border-hairline bg-panel p-2 space-y-1.5"
        >
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
                      aria-label={`Pausar tarea ${task.title}`}
                      className="rounded p-1.5 min-h-[28px] min-w-[28px] inline-flex items-center justify-center text-dim hover:text-ink hover:bg-raised"
                      title="Pausar"
                    >
                      <Pause size={12} />
                    </button>
                  )}
                  {task.status === "paused" && onResumeTask && (
                    <button
                      onClick={() => onResumeTask(task.id)}
                      aria-label={`Reanudar tarea ${task.title}`}
                      className="rounded p-1.5 min-h-[28px] min-w-[28px] inline-flex items-center justify-center text-dim hover:text-ink hover:bg-raised"
                      title="Reanudar"
                    >
                      <Play size={12} />
                    </button>
                  )}
                  {(task.status === "running" || task.status === "queued") && (
                    <button
                      onClick={() => handleCancel(task.id)}
                      aria-label={`Cancelar tarea ${task.title}`}
                      className="rounded p-1.5 min-h-[28px] min-w-[28px] inline-flex items-center justify-center text-rose-500/80 hover:text-rose-500 hover:bg-raised"
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
