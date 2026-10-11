import { z } from "zod";

export const WORKBOARD_STATUSES = [
  "triage",
  "backlog",
  "todo",
  "in_progress",
  "review",
  "blocked",
  "done",
] as const;

export type WorkboardStatus = (typeof WORKBOARD_STATUSES)[number];

export const WORKBOARD_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type WorkboardPriority = (typeof WORKBOARD_PRIORITIES)[number];

export const WorkboardItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(WORKBOARD_STATUSES).default("todo"),
  priority: z.enum(WORKBOARD_PRIORITIES).default("normal"),
  assigneeSubEgoId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  createdAt: z.number(),
  updatedAt: z.number(),
  metadata: z.record(z.unknown()).optional(),
});

export type WorkboardItem = z.infer<typeof WorkboardItemSchema>;

export const WorkboardColumnSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(WORKBOARD_STATUSES),
  order: z.number().int().min(0),
});

export type WorkboardColumn = z.infer<typeof WorkboardColumnSchema>;

export const WorkboardBoardSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  columns: z.array(WorkboardColumnSchema),
  items: z.array(WorkboardItemSchema).default([]),
  createdAt: z.number(),
  updatedAt: z.number(),
  metadata: z.record(z.unknown()).optional(),
});

export type WorkboardBoard = z.infer<typeof WorkboardBoardSchema>;

/**
 * Contrato de tableros de tareas y gestión de proyectos (OCLW-15).
 * Extraído y adaptado de OpenClaw packages/workboard-contract.
 */
export class WorkboardContract {
  /**
   * Crea un tablero con columnas predeterminadas de Kanban para un proyecto.
   */
  public static createDefaultBoard(projectId: string, name: string): WorkboardBoard {
    const now = Date.now();
    const defaultColumns: WorkboardColumn[] = [
      { id: "col-backlog", title: "Backlog", status: "backlog", order: 0 },
      { id: "col-todo", title: "Por Hacer", status: "todo", order: 1 },
      { id: "col-in_progress", title: "En Progreso", status: "in_progress", order: 2 },
      { id: "col-review", title: "En Revisión", status: "review", order: 3 },
      { id: "col-done", title: "Completado", status: "done", order: 4 },
    ];

    return {
      id: `board_${projectId}_${now}`,
      projectId,
      name,
      columns: defaultColumns,
      items: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Valida estrictamente un ítem de tablero.
   */
  public static validateItem(candidate: unknown): WorkboardItem {
    return WorkboardItemSchema.parse(candidate);
  }

  /**
   * Valida estrictamente un tablero completo.
   */
  public static validateBoard(candidate: unknown): WorkboardBoard {
    return WorkboardBoardSchema.parse(candidate);
  }
}
