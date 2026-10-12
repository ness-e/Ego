// tests/e2e/canvas-interaction.test.ts
// Golden Path Alpha — Pasos 15 al 20: Ciclo cerrado del Dynamic Workspace & Canvas (CANV-10)
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { EgoMemoryAdapter } from "../../packages/memory/EgoMemoryAdapter.js";
import {
  CanvasBridge,
  CanvasPersistenceManager,
  CanvasComponentManifestSchema,
  type CanvasComponentManifest,
  type CanvasWorkspaceState,
  type CanvasChangeSet,
} from "../../packages/ui-runtime/src/index.js";

describe("CANV-10: Golden Path Alpha (Pasos 15 al 20) — Dynamic Workspace & Canvas E2E", () => {
  const testDir = path.join(os.tmpdir(), `ego-canvas-e2e-${Date.now()}`);
  let adapter: EgoMemoryAdapter | null = null;

  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    if (adapter && adapter.ready) {
      await adapter.close();
      adapter = null;
    }
  });

  afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignorar bloqueos transitorios de descriptores en Windows
    }
  });

  it("Pasos 15 al 20: Contrato declarativo -> Bridge reactivo -> ChangeSet atómico -> Persistencia VantaDB -> Recuperación intacta", async () => {
    // ── Paso 15: Inicio de sesión y proyecto en VantaDB ──
    adapter = new EgoMemoryAdapter(testDir);
    await adapter.init();
    expect(adapter.ready).toBe(true);

    const projectId = "alpha-workspace";
    await adapter.put({
      namespace: `projects/${projectId}`,
      key: "metadata",
      payload: {
        id: projectId,
        name: "Proyecto Alpha Workspace",
        createdAt: Date.now(),
      },
    });

    // ── Paso 16: Sub-Ego emite contratos declarativos validados por Zod ──
    const rawTableManifest = {
      id: "comp-table-sprint",
      type: "table",
      metadata: {
        timestamp: Date.now(),
        generatedBy: "ego.developer",
        why: {
          vantaSources: [`projects/${projectId}/tasks`],
          directCause: "Generación de backlog interactivo de tareas",
          auditTrace: "audit:trace:step16:verified",
        },
      },
      props: {
        id: "tbl-tasks",
        title: "Backlog de Tareas Activas",
        columns: [
          { key: "task", label: "Tarea", sortable: true },
          { key: "status", label: "Estado", type: "badge" },
        ],
        rows: [
          { task: "Implementar Canvas", status: "completado" },
          { task: "Persistir en VantaDB", status: "en progreso" },
        ],
      },
    };

    const rawDiffManifest = {
      id: "comp-diff-code",
      type: "diff",
      metadata: {
        timestamp: Date.now(),
        generatedBy: "ego.developer",
        why: {
          vantaSources: ["apps/desktop/renderer/src/App.tsx"],
          directCause: "Revisión de integración de Canvas",
        },
      },
      props: {
        id: "diff-code",
        title: "Revisión de Código Canvas",
        filePath: "apps/desktop/renderer/src/App.tsx",
        originalContent: "// Versión estática",
        modifiedContent: "// Versión viva con CanvasRuntime",
        viewMode: "split",
        additionsCount: 12,
        deletionsCount: 4,
      },
    };

    // Validación estricta Zod en el runtime
    const validTable = CanvasComponentManifestSchema.parse(rawTableManifest);
    const validDiff = CanvasComponentManifestSchema.parse(rawDiffManifest);
    expect(validTable.type).toBe("table");
    expect(validDiff.type).toBe("diff");

    // ── Paso 17: Montaje en CanvasBridge y despacho reactivo ──
    const bridge = new CanvasBridge([validTable, validDiff]);
    expect(bridge.getComponents().length).toBe(2);

    // ── Paso 18: Usuario enfoca contexto y despacha acción interactiva ──
    let receivedAction: any = null;
    let receivedFocus: any = null;

    bridge.on("canvas.action", (ev) => {
      receivedAction = ev;
    });
    bridge.on("canvas.focus", (ev) => {
      receivedFocus = ev;
    });

    bridge.focusComponent("comp-table-sprint", "Fila seleccionada: Persistir en VantaDB");
    expect(receivedFocus).not.toBeNull();
    expect(receivedFocus.contextExcerpt).toContain("Persistir en VantaDB");

    bridge.dispatchAction("comp-table-sprint", "task.complete", { rowIndex: 1 });
    expect(receivedAction).not.toBeNull();
    expect(receivedAction.actionId).toBe("task.complete");

    // ── Paso 19: Actualización atómica con ChangeSet (COUC-07) ──
    let receivedMutation: any = null;
    bridge.on("canvas.mutation", (ev) => {
      receivedMutation = ev;
    });

    const changeSet: CanvasChangeSet = {
      id: "cs-golden-19",
      componentId: "comp-table-sprint",
      timestamp: Date.now(),
      op: "update",
      path: "rows",
      newValue: [
        { task: "Implementar Canvas", status: "completado" },
        { task: "Persistir en VantaDB", status: "completado" },
      ],
      origin: "subego",
    };

    const updateOk = bridge.applyChangeSet(changeSet);
    expect(updateOk).toBe(true);
    expect(receivedMutation).not.toBeNull();

    const updatedTable = bridge.getComponent("comp-table-sprint");
    expect((updatedTable?.props as any).rows[1].status).toBe("completado");

    // ── Paso 20: Persistencia de estado en VantaDB y recuperación post-reinicio ──
    const workspaceState: CanvasWorkspaceState = {
      id: `canvas-${projectId}`,
      projectId,
      activeView: "all",
      components: bridge.getComponents(),
      selectedComponentId: "comp-table-sprint",
      updatedAt: Date.now(),
    };

    // Serializar a JSON canónico
    const serializedState = CanvasPersistenceManager.serialize(workspaceState);
    const vantaKey = CanvasPersistenceManager.getVantaKey(projectId);

    // Guardar en namespace de VantaDB
    await adapter.put({
      namespace: `projects/${projectId}`,
      key: vantaKey,
      payload: {
        data: serializedState,
      },
      metadata: {
        type: "canvas_state",
        version: 1,
      },
    });

    // Simular cierre y reinicio completo del sistema
    await adapter.close();
    adapter = null;

    // Reapertura limpia del motor VantaDB
    adapter = new EgoMemoryAdapter(testDir);
    await adapter.init();
    expect(adapter.ready).toBe(true);

    // Recuperar el registro de Canvas
    const stored = ((await adapter.get(`projects/${projectId}`, vantaKey))?.payload as any);
    expect(stored).not.toBeNull();
    expect(stored?.data).toBeDefined();

    // Deserializar y validar contra el esquema Zod
    const restoredState = CanvasPersistenceManager.deserialize(stored.data, projectId);
    expect(restoredState.projectId).toBe(projectId);
    expect(restoredState.components.length).toBe(2);

    // Verificar que la mutación atómica del Paso 19 sobrevivió intacta
    const restoredTable = restoredState.components.find((c) => c.id === "comp-table-sprint");
    expect(restoredTable).toBeDefined();
    expect((restoredTable?.props as any).rows[1].status).toBe("completado");
    expect((restoredTable?.props as any).rows[1].task).toBe("Persistir en VantaDB");
  });
});
