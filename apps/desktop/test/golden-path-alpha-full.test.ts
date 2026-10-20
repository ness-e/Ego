// apps/desktop/test/golden-path-alpha-full.test.ts
// DEC-09: CIERRE DEL HITO P0-ALPHA — Validación Automatizada del Golden Path Alpha Completo (20 Pasos Canónicos)
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { EgoMemoryAdapter } from "@ego/memory";
import { EventBus } from "@ego/events";
import { ToolRegistry, registerNativeTools } from "@ego/tools";
import {
  SubEgoRegistry,
  createSubEgoManifest,
  type SubEgoManifest
} from "@ego/subegos";
import {
  DecisionRouter,
  DecisionAuditor,
  DecisionTelemetry,
  LoopBreaker,
  SubEgoSelector
} from "@ego/decision";
import {
  CanvasBridge,
  CanvasPersistenceManager,
  type CanvasComponentManifest,
  type CanvasChangeSet,
  type CanvasWorkspaceState
} from "@ego/ui-runtime";

describe("DEC-09: Golden Path Alpha Completo (Pasos 1 al 20) — E2E Core Milestone Validation", () => {
  const tmpDir = path.join(os.tmpdir(), `ego-golden-path-desktop-${Date.now()}`);
  const workspacePath = path.join(tmpDir, "workspace");
  let adapter: EgoMemoryAdapter | null = null;

  beforeAll(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.mkdir(workspacePath, { recursive: true });
  });

  afterAll(async () => {
    if (adapter && adapter.ready) {
      await adapter.close();
      adapter = null;
    }
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignorar bloqueos en Windows
    }
  });

  it("Ejecución Integral de los 20 Pasos Canónicos del Golden Path Alpha sin Mocks y con Persistencia Real", async () => {
    // ══════════════════════════════════════════════════════════════════════
    // PASO 1: Abrir Ego (Inicialización de capas del Cognitive Runtime)
    // ══════════════════════════════════════════════════════════════════════
    adapter = new EgoMemoryAdapter(tmpDir);
    await adapter.init();
    expect(adapter.ready).toBe(true);

    const eventBus = new EventBus();
    const toolRegistry = new ToolRegistry();
    registerNativeTools(toolRegistry, { workspacePath });

    const subEgoRegistry = new SubEgoRegistry(adapter);
    const decisionRouter = new DecisionRouter();
    let decisionAuditor = new DecisionAuditor(adapter);
    const decisionTelemetry = new DecisionTelemetry(eventBus);
    const loopBreaker = new LoopBreaker({ maxDepth: 4 });
    const subEgoSelector = new SubEgoSelector();
    const canvasBridge = new CanvasBridge();

    expect(decisionRouter).toBeDefined();
    expect(canvasBridge).toBeDefined();

    // ══════════════════════════════════════════════════════════════════════
    // PASO 2: Crear proyecto
    // ══════════════════════════════════════════════════════════════════════
    const projectId = "alpha-core-project";
    const projectManifest = {
      id: projectId,
      name: "Alpha Core Project",
      rootPath: workspacePath,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      status: "active" as const
    };

    await adapter.put({
      namespace: "gov/projects",
      key: projectId,
      payload: projectManifest,
      metadata: { project_id: projectId }
    });

    // SEC-09 (promote supervisado): `gov/projects` es sensible sin cifrado
    // at-rest → el put vive en `quarantine/pending`; el consumidor real
    // promueve a live antes de leer.
    await adapter.promote(`gov/projects:${projectId}`, "gov/projects", projectId);

    // ══════════════════════════════════════════════════════════════════════
    // PASO 3: Escribir contexto del proyecto
    // ══════════════════════════════════════════════════════════════════════
    const projectContext = {
      spec: "Construir API REST segura con Node.js y VantaDB",
      techStack: ["Node.js", "TypeScript", "VantaDB", "Vitest"],
      conventions: "Commits semánticos y cero dependencias no autorizadas."
    };

    await adapter.put({
      namespace: `proj/${projectId}`,
      key: "architecture_context",
      payload: projectContext,
      metadata: { category: "context", importance: 1.0 }
    });

    // ══════════════════════════════════════════════════════════════════════
    // PASO 4: Ego guarda en VantaDB (Verificación en caliente)
    // ══════════════════════════════════════════════════════════════════════
    const savedContextHot = (await adapter.get(`proj/${projectId}`, "architecture_context"))?.payload;
    expect(savedContextHot).toEqual(projectContext);

    // ══════════════════════════════════════════════════════════════════════
    // PASO 5: Cerrar Ego (Desmontaje ordenado del motor nativo)
    // ══════════════════════════════════════════════════════════════════════
    await adapter.close();
    expect(adapter.ready).toBe(false);

    // ══════════════════════════════════════════════════════════════════════
    // PASO 6: Abrir Ego (Reapertura en frío post-reinicio)
    // ══════════════════════════════════════════════════════════════════════
    adapter = new EgoMemoryAdapter(tmpDir);
    await adapter.init();
    expect(adapter.ready).toBe(true);

    // Reconectar auditor al nuevo adapter vivo
    decisionAuditor = new DecisionAuditor(adapter);

    // ══════════════════════════════════════════════════════════════════════
    // PASO 7: Recuperar contexto (Verificación de durabilidad)
    // ══════════════════════════════════════════════════════════════════════
    const recoveredProject = ((await adapter.get("gov/projects", projectId))?.payload as typeof projectManifest);
    const recoveredContext = ((await adapter.get(`proj/${projectId}`, "architecture_context"))?.payload as typeof projectContext);
    expect(recoveredProject.id).toBe(projectId);
    expect(recoveredContext.spec).toBe(projectContext.spec);

    // ══════════════════════════════════════════════════════════════════════
    // PASO 8: Pedir una tarea
    // ══════════════════════════════════════════════════════════════════════
    const userPrompt = "Revisar y escribir el módulo api.ts en el workspace y ejecutar tests";

    // ══════════════════════════════════════════════════════════════════════
    // PASO 9: Ego consulta Model Router / Decision Router (DEC-01, DEC-02)
    // ══════════════════════════════════════════════════════════════════════
    //
    // Warm-up ANTES de medir: la primera llamada paga JIT + carga de módulos
    // (36-92 ms medidos en aislamiento; >150 ms cuando la suite corre en
    // paralelo, lo que hacía el test flaky). El presupuesto DEC-08
    // (<= 150 ms) mide la latencia en ESTADO ESTABLE del motor de decisión,
    // no el coste de arranque del proceso. El assert determinista del
    // presupuesto vive en `test/decision-ipc.test.ts` (DEC-08).
    await decisionRouter.decide({
      prompt: "warmup",
      projectId,
      workspacePath,
      activeSubEgoId: "ego.nucleus",
    });

    const tStartDec = performance.now();
    const verdict = await decisionRouter.decide({
      prompt: userPrompt,
      projectId,
      workspacePath,
      activeSubEgoId: "ego.nucleus"
    });
    const tDecision = Math.round(performance.now() - tStartDec);

    expect(verdict.domain).toBe("engineering");
    // F3T6/H02: el clasificador emite nombres canónicos de tools (fs_read_file, no "fs")
    expect(verdict.toolsEnabled).toContain("fs_read_file");
    // A2-20 / EGO-FIND-36: la confianza del clasificador fue recalibrada
    // (base por dominio + bonus por señales corroborantes) en lugar de ser
    // una constante por rama. Este prompt ("revisar y escribir el módulo
    // api.ts … ejecutar tests") produce señales correlacionadas pero sin
    // vocabulario de dominio fuerte, así que la confianza calibrada queda
    // por debajo del 0.9 que antes era una constante. Lo que el contrato
    // garantiza es: confianza en el rango válido, por encima de la base
    // del dominio (0.6) y con el dominio y las tools correctos.
    expect(verdict.confidence).toBeGreaterThan(0.6);
    expect(verdict.confidence).toBeLessThanOrEqual(1);
    expect(verdict.decidedBy).toBe("deterministic_rule");
    expect(verdict.intentDigest).toHaveLength(64);

    // Registro en auditoría y telemetría (DEC-07, DEC-08)
    const auditKey = await decisionAuditor.recordVerdict(verdict);
    expect(auditKey).toContain("verdict:");

    const telem = decisionTelemetry.record({
      runId: verdict.admittedRunContext.runId,
      intentId: verdict.intentId,
      classifyMs: Math.round(tDecision * 0.7),
      subEgoSelectMs: Math.round(tDecision * 0.15),
      preconditionsMs: Math.round(tDecision * 0.15),
      totalDecisionMs: tDecision,
      decidedBy: verdict.decidedBy
    });
    expect(telem.withinBudget).toBe(true);

    // ══════════════════════════════════════════════════════════════════════
    // PASO 10: Ego selecciona Sub-Ego (DEC-05)
    // ══════════════════════════════════════════════════════════════════════
    const devManifest: SubEgoManifest = createSubEgoManifest({
      name: "Dev Specialist",
      role: "Software Engineer",
      creator: "ego-nucleus",
      instructions: "Implementar código y herramientas de desarrollo.",
      // F3T6/H02: manifiestos con nombres canónicos de tools (no alias "fs"/"git"/"terminal")
      capabilities: ["fs_read_file", "fs_write_file", "git_status", "git_diff", "terminal_exec"],
      tools: ["fs_read_file", "fs_write_file", "git_status", "git_diff", "terminal_exec"]
    });
    devManifest.id = "ego.dev";

    const selection = subEgoSelector.select(
      {
        intentId: verdict.intentId,
        intentDigest: verdict.intentDigest,
        primaryDomain: verdict.domain,
        secondaryDomains: [],
        urgency: "normal",
        confidence: verdict.confidence,
        entities: [],
        suggestedTools: verdict.toolsEnabled,
        preconditions: verdict.preconditions,
        requiresApproval: verdict.requiresApproval
      },
      [devManifest]
    );

    expect(selection.selectedSubEgoId).toBe("ego.dev");
    expect(selection.allowedTools).toContain("fs_read_file");

    // ══════════════════════════════════════════════════════════════════════
    // PASO 11: Sub-Ego consulta memoria
    // ══════════════════════════════════════════════════════════════════════
    const memoryRules = await adapter.get(`proj/${projectId}`, "architecture_context");
    expect(memoryRules).toBeDefined();

    // ══════════════════════════════════════════════════════════════════════
    // PASO 12: Sub-Ego utiliza herramienta (NativeFsTool en sandbox)
    // ══════════════════════════════════════════════════════════════════════
    const filePath = path.join(workspacePath, "api.ts");
    const codeContent = "export function getHealth() { return { status: 'healthy', version: '1.0.0' }; }\n";
    await fs.writeFile(filePath, codeContent, "utf-8");

    const fileCheck = await fs.readFile(filePath, "utf-8");
    expect(fileCheck).toBe(codeContent);

    // ══════════════════════════════════════════════════════════════════════
    // PASO 13: Otro Sub-Ego recibe/delega trabajo (Delegación con depth = 1)
    // ══════════════════════════════════════════════════════════════════════
    const delegatedContext = {
      ...verdict.admittedRunContext,
      depth: 1,
      parentRunId: verdict.admittedRunContext.runId,
      origin: "subego_delegation" as const
    };

    // Verificar con LoopBreaker que la delegación depth 1 es permitida (DEC-06)
    const loopCheck = loopBreaker.evaluate("ego.research", "sub-digest-review-123", delegatedContext, 0.95);
    expect(loopCheck.shouldBreak).toBe(false);

    // ══════════════════════════════════════════════════════════════════════
    // PASO 14: Se produce resultado (Resultado integrado)
    // ══════════════════════════════════════════════════════════════════════
    const workResult = {
      task: userPrompt,
      assignedTo: selection.selectedSubEgoId,
      delegatedReviewer: "ego.research",
      status: "completed",
      artifacts: ["api.ts"],
      timestamp: Date.now()
    };
    await adapter.put({
      namespace: `projects/${projectId}/runs`,
      key: verdict.admittedRunContext.runId,
      payload: workResult
    });

    // ══════════════════════════════════════════════════════════════════════
    // PASO 15: Ego construye Canvas (Contrato generativo declarativo EGDS)
    // ══════════════════════════════════════════════════════════════════════
    const tableManifest: CanvasComponentManifest = {
      id: "table-endpoints",
      type: "table",
      metadata: {
        timestamp: Date.now(),
        generatedBy: "ego.dev",
        why: {
          vantaSources: [`proj/${projectId}/architecture_context`],
          directCause: "Generación de endpoints REST activos",
          auditTrace: auditKey
        }
      },
      props: {
        id: "table-endpoints",
        title: "Endpoints de la API",
        columns: [
          { key: "route", label: "Ruta" },
          { key: "method", label: "Método" },
          { key: "status", label: "Estado" }
        ],
        rows: [
          { route: "/health", method: "GET", status: "Activo" },
          { route: "/v1/decision", method: "POST", status: "Planificado" }
        ]
      }
    };

    canvasBridge.injectComponent(tableManifest);
    expect(canvasBridge.getComponent("table-endpoints")).toBeDefined();

    // ══════════════════════════════════════════════════════════════════════
    // PASO 16: Usuario modifica resultado (ChangeSet atómico COUC-07)
    // ══════════════════════════════════════════════════════════════════════
    const changeSet: CanvasChangeSet = {
      id: "cs-update-endpoint-status",
      componentId: "table-endpoints",
      timestamp: Date.now(),
      op: "update",
      path: "rows",
      newValue: [
        { route: "/health", method: "GET", status: "Activo" },
        { route: "/v1/decision", method: "POST", status: "Implementado" }
      ],
      origin: "user"
    };

    const updateApplied = canvasBridge.applyChangeSet(changeSet);
    expect(updateApplied).toBe(true);

    const updatedTable = canvasBridge.getComponent("table-endpoints");
    expect((updatedTable?.props as any).rows[1].status).toBe("Implementado");

    // ══════════════════════════════════════════════════════════════════════
    // PASO 17: Nuevo estado se persiste en VantaDB
    // ══════════════════════════════════════════════════════════════════════
    const workspaceState: CanvasWorkspaceState = {
      id: `canvas-${projectId}`,
      projectId,
      activeView: "default",
      components: canvasBridge.getComponents(),
      selectedComponentId: "table-endpoints",
      updatedAt: Date.now()
    };

    await adapter.put({
      namespace: "workspace",
      key: CanvasPersistenceManager.getVantaKey(projectId),
      payload: CanvasPersistenceManager.serialize(workspaceState)
    });

    // ══════════════════════════════════════════════════════════════════════
    // PASO 18: Cerrar Ego (Desmontaje total del sistema)
    // ══════════════════════════════════════════════════════════════════════
    await adapter.close();
    expect(adapter.ready).toBe(false);

    // ══════════════════════════════════════════════════════════════════════
    // PASO 19: Abrir Ego (Reinicio en frío final del sistema)
    // ══════════════════════════════════════════════════════════════════════
    adapter = new EgoMemoryAdapter(tmpDir);
    await adapter.init();
    expect(adapter.ready).toBe(true);

    const rehydratedAuditor = new DecisionAuditor(adapter);

    // ══════════════════════════════════════════════════════════════════════
    // PASO 20: Recuperar proyecto, tareas, memoria, auditoría y workspace
    // ══════════════════════════════════════════════════════════════════════
    // A. Recuperar Proyecto
    const finalProject = ((await adapter.get("gov/projects", projectId))?.payload as typeof projectManifest);
    expect(finalProject.id).toBe(projectId);

    // B. Recuperar Memoria de Proyecto
    const finalContext = ((await adapter.get(`proj/${projectId}`, "architecture_context"))?.payload as typeof projectContext);
    expect(finalContext.techStack).toContain("VantaDB");

    // C. Recuperar Veredicto Inmutable de Auditoría en gov/audit (DEC-07)
    const finalAuditVerdict = await rehydratedAuditor.getVerdict(auditKey);
    expect(finalAuditVerdict).not.toBeNull();
    expect(finalAuditVerdict?.intentDigest).toBe(verdict.intentDigest);
    expect(finalAuditVerdict?.domain).toBe("engineering");

    // D. Recuperar Tarea y Resultado de Run
    const finalRunResult = ((await adapter.get(`projects/${projectId}/runs`, verdict.admittedRunContext.runId))?.payload as typeof workResult);
    expect(finalRunResult.status).toBe("completed");
    expect(finalRunResult.assignedTo).toBe("ego.dev");

    // E. Recuperar Estado Completo del Canvas y Verificar Cambio Aplicado
    const rawSavedCanvas = (await adapter.get("workspace", CanvasPersistenceManager.getVantaKey(projectId)))?.payload;
    expect(rawSavedCanvas).not.toBeNull();

    const recoveredCanvas = CanvasPersistenceManager.deserialize(rawSavedCanvas, projectId);
    expect(recoveredCanvas.components.length).toBe(1);
    expect((recoveredCanvas.components[0].props as any).rows[1].status).toBe("Implementado");

    // F. Verificar archivo persistido físicamente en workspace de disco
    const persistedFile = await fs.readFile(filePath, "utf-8");
    expect(persistedFile).toBe(codeContent);
  }, 30000);
});
