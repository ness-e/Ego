import { describe, it, expect } from "vitest";
import {
  WorkboardContract,
  type WorkboardItem,
} from "../src/WorkboardContract.js";

describe("WorkboardContract Suite (OCLW-15)", () => {
  it("debe generar un tablero Kanban predeterminado para un proyecto", () => {
    const board = WorkboardContract.createDefaultBoard("proj_alpha", "Tablero de Ingeniería");

    expect(board.projectId).toBe("proj_alpha");
    expect(board.name).toBe("Tablero de Ingeniería");
    expect(board.columns).toHaveLength(5);
    expect(board.columns[0].status).toBe("backlog");
    expect(board.columns[1].status).toBe("todo");
    expect(board.items).toEqual([]);

    const validated = WorkboardContract.validateBoard(board);
    expect(validated.id).toBe(board.id);
  });

  it("debe validar y normalizar un ítem de tarea", () => {
    const rawItem: WorkboardItem = {
      id: "task-001",
      title: "Implementar endpoint de métricas",
      description: "Exponer métricas de Prometheus en /metrics",
      status: "in_progress",
      priority: "high",
      tags: ["api", "observability"],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const validated = WorkboardContract.validateItem(rawItem);
    expect(validated.id).toBe("task-001");
    expect(validated.priority).toBe("high");
    expect(validated.tags).toEqual(["api", "observability"]);
  });

  it("debe rechazar estados o prioridades fuera del contrato canónico", () => {
    expect(() => {
      WorkboardContract.validateItem({
        id: "task-bad",
        title: "Tarea con estado inválido",
        status: "estado_inventado",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }).toThrow();
  });
});
