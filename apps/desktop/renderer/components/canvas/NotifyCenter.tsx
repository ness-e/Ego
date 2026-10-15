import React, { useEffect, useState } from "react";
import { ego } from "../../lib/ego.js";

/**
 * CFG-13 — Notificaciones vía IPC existente (cero canales nuevos).
 * Fuente: pushes `system.alert` y de tareas que el main ya emite por
 * `ipc.event` (`onEvent`). Se listan in-app y, si el usuario lo habilita,
 * se elevan a notificación OS con la API Web `Notification` del renderer
 * (Chromium la entrega al centro de notificaciones del SO).
 */
export interface WorkbenchNotice {
  id: string;
  title: string;
  body: string;
  at: number;
}

function coerceNotice(event: unknown, index: number): WorkbenchNotice | null {
  if (typeof event !== "object" || event === null) return null;
  const e = event as Record<string, unknown>;
  const code = typeof e["code"] === "string" ? (e["code"] as string) : null;
  const type = typeof e["type"] === "string" ? (e["type"] as string) : null;
  const message = typeof e["message"] === "string" ? (e["message"] as string) : null;
  // Solo alertas del sistema y progreso de tareas (ruido filtrado).
  const relevant =
    code === "system.alert" ||
    type === "system.alert" ||
    type === "task.progress" ||
    type === "task.completed";
  if (!relevant || !message) return null;
  return {
    id: `notice-${Date.now()}-${index}`,
    title: code ?? type ?? "Ego",
    body: message,
    at: Date.now(),
  };
}

const MAX_NOTICES = 20;

export const NotifyCenter: React.FC = () => {
  const [notices, setNotices] = useState<WorkbenchNotice[]>([]);
  const [osEnabled, setOsEnabled] = useState(false);
  const [permission, setPermission] = useState<string>(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );

  useEffect(() => {
    const bridge = ego();
    if (typeof bridge.onEvent !== "function") return;
    const off = bridge.onEvent((event: unknown) => {
      const notice = coerceNotice(event, Math.floor(Math.random() * 1_000_000));
      if (!notice) return;
      setNotices((prev) => [notice, ...prev].slice(0, MAX_NOTICES));
    });
    return () => {
      if (typeof off === "function") off();
    };
  }, []);

  useEffect(() => {
    if (!osEnabled) return;
    if (permission !== "granted") return;
    const latest = notices[0];
    if (!latest) return;
    try {
      new Notification(latest.title, { body: latest.body });
    } catch {
      // Headless o bloqueado: el listado in-app sigue siendo la fuente.
    }
  }, [notices, osEnabled, permission]);

  const handleToggleOs = async () => {
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
      return;
    }
    if (!osEnabled && Notification.permission === "default") {
      try {
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result !== "granted") return;
      } catch {
        setPermission("denied");
        return;
      }
    }
    setPermission(Notification.permission);
    setOsEnabled((prev) => !prev);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-faint">
          {notices.length === 0
            ? "Sin avisos. Las alertas del sistema y de tareas aparecen aquí."
            : `${notices.length} aviso(s) recientes.`}
        </p>
        <button
          type="button"
          onClick={() => void handleToggleOs()}
          aria-pressed={osEnabled}
          title={
            permission === "unsupported"
              ? "Notificaciones OS no disponibles en este entorno"
              : `Permiso OS: ${permission}`
          }
          className="shrink-0 rounded border border-hairline bg-raised px-2.5 py-1 text-[11px] text-dim transition-colors hover:text-ink"
        >
          {osEnabled ? "Avisos OS: sí" : "Avisos OS: no"}
        </button>
      </div>
      {notices.length > 0 && (
        <ul className="flex flex-col gap-1.5" role="status" aria-live="polite">
          {notices.map((n) => (
            <li
              key={n.id}
              className="rounded border border-hairline bg-paper px-2 py-1.5"
            >
              <p className="font-mono text-[10px] text-faint">{n.title}</p>
              <p className="mt-0.5 text-[11px] text-ink">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
