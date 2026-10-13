import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ActivityTray, type TaskItem } from "../components/activity-tray/ActivityTray.js";

describe("TASK-05: ActivityTray — Bandeja de actividad en footer", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renderiza modo reposo cuando no hay tareas activas", async () => {
    await act(async () => {
      root.render(<ActivityTray tasks={[]} />);
    });

    expect(container.textContent).toContain("Sistema en Reposo · 0 tareas en segundo plano");
  });

  it("muestra la tarea en ejecución con su progreso y mensaje", async () => {
    const tasks: TaskItem[] = [
      {
        id: "task-1",
        title: "Compilando modelos ONNX",
        status: "running",
        progress: 65,
        progressMessage: "Optimizando tensores",
      },
    ];

    await act(async () => {
      root.render(<ActivityTray tasks={tasks} />);
    });

    expect(container.textContent).toContain("Compilando modelos ONNX");
    expect(container.textContent).toContain("[65%]");
    expect(container.textContent).toContain("Optimizando tensores");
  });

  it("muestra badge de tareas adicionales y permite desplegar la cola", async () => {
    const tasks: TaskItem[] = [
      { id: "task-1", title: "Indexando código", status: "running", progress: 40 },
      { id: "task-2", title: "Auditoría de seguridad", status: "running", progress: 10 },
      { id: "task-3", title: "Backup de memoria", status: "queued", progress: 0 },
    ];

    await act(async () => {
      root.render(<ActivityTray tasks={tasks} />);
    });

    expect(container.textContent).toContain("+2 más");
    expect(container.textContent).toContain("Cola (3)");

    // Desplegar la cola al hacer clic en el botón
    const button = container.querySelector("button");
    expect(button).not.toBeNull();

    await act(async () => {
      button?.click();
    });

    expect(container.textContent).toContain("Auditoría de seguridad");
    expect(container.textContent).toContain("Backup de memoria");
  });

  it("invoca callbacks de pausar y cancelar", async () => {
    const pauseSpy = vi.fn();
    const cancelSpy = vi.fn();
    const tasks: TaskItem[] = [
      { id: "task-1", title: "Tarea activa", status: "running", progress: 20 },
    ];

    await act(async () => {
      root.render(
        <ActivityTray
          tasks={tasks}
          onPauseTask={pauseSpy}
          onCancelTask={cancelSpy}
        />
      );
    });

    // Desplegar cola
    const button = container.querySelector("button");
    await act(async () => {
      button?.click();
    });

    const buttons = container.querySelectorAll("button[title]");
    const pauseBtn = Array.from(buttons).find((b) => b.getAttribute("title") === "Pausar");
    const cancelBtn = Array.from(buttons).find((b) => b.getAttribute("title") === "Cancelar");

    await act(async () => {
      pauseBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(pauseSpy).toHaveBeenCalledWith("task-1");

    await act(async () => {
      cancelBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(cancelSpy).toHaveBeenCalledWith("task-1");
  });
});
