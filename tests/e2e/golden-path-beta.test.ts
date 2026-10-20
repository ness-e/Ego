// tests/e2e/golden-path-beta.test.ts
// DIST-08: CIERRE DEL HITO P0-BETA — Golden Path Beta Multi-Día (roadmap §Golden Path P0-Beta)
// Proyecto real de varios días (simulados con timestamps): múltiples Sub-Egos,
// herramientas con aprobación HITL, Background Tasks, Daily State por día,
// memoria acumulada verificada tras cada reinicio en frío, 0 regresiones.
// Patrones extendidos (quarantine-aware SEC-09/HIG-04):
// - `golden-path-alpha-full.test.ts` (20 pasos, promote supervisado, Canvas, auditoría)
// - `mvp-software-loop.test.ts` (HITL vía ToolExecutionLoop SIMULATE_TOOL, cold reboot)
// - `subegos-delegation.test.ts` (DelegationRouter canónico, SharedMemory, budget, lessons)
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { EgoMemoryAdapter } from "../../packages/memory/dist/index.js";
import { EgoMemoryLifecycle } from "../../packages/memory/dist/index.js";
import { ModelRouter, MockProvider } from "../../packages/models/dist/index.js";
import { ToolRegistry, registerNativeTools } from "../../packages/tools/dist/index.js";
import { EventBus } from "../../packages/events/dist/index.js";
import { ApprovalEngine, ExecutionManager, PendingApproval } from "../../packages/execution/dist/index.js";
import { ToolExecutionLoop } from "../../packages/runtime/dist/index.js";
import {
  SubEgoRegistry,
  SubEgoRuntime,
  SharedMemory,
  DelegationRouter,
  DelegationCycleError,
  SubEgoBudgetTracker,
  SelfImprovementLoop,
  createSubEgoManifest,
  type SubEgoManifest,
} from "../../packages/subegos/dist/index.js";
import {
  DailyStatePersistence,
  type DailyStateSummary,
} from "../../packages/dailystate/dist/index.js";
import { BackgroundEngine } from "../../packages/tasks/dist/index.js";
import { DecisionRouter, DecisionAuditor, DecisionTelemetry } from "@ego/decision";
import {
  CanvasBridge,
  CanvasPersistenceManager,
  type CanvasComponentManifest,
  type CanvasChangeSet,
  type CanvasWorkspaceState,
} from "@ego/ui-runtime";

// Días simulados (fechas fijas consecutivas; los timestamps reales los pone Date.now()).
const DAY_1 = "2026-10-11";
const DAY_2 = "2026-10-12";
const DAY_3 = "2026-10-13";
const DAY_MS = 86_400_000;

function dailySummary(
  date: string,
  simulatedTs: number,
  overrides: Partial<DailyStateSummary> = {}
): DailyStateSummary {
  return {
    date,
    timestamp: simulatedTs,
    completedTasksCount: 0,
    pendingTasksCount: 0,
    pendingApprovalsCount: 0,
    decisionsCount: 0,
    quarantineAlertsCount: 0,
    totalTokensToday: 0,
    estimatedCostUsd: 0,
    p99LatencyMs: 0,
    recentDecisions: [],
    suggestedGoals: [],
    // Defaults del esquema (EGO-FIND-52, A3): `partial`/`sourcesUnavailable`
    // son obligatorios en el tipo de SALIDA de `DailyStateSummary` (Zod
    // `.default()`); sin fijarlos aquí el spread de `overrides` los deja en
    // `boolean | undefined` y el objeto no satisface el tipo.
    partial: false,
    sourcesUnavailable: [],
    ...overrides,
  };
}

describe("DIST-08 — Golden Path Beta Multi-Día (sello release P0-Beta)", () => {
  let baseTmpDir: string;
  let vdbDir: string;
  let workspaceDir: string;

  let adapter: EgoMemoryAdapter | null = null;

  beforeEach(async () => {
    baseTmpDir = path.join(
      os.tmpdir(),
      `ego-beta-e2e-${Date.now()}-${Math.random().toString(36).substring(7)}`
    );
    vdbDir = path.join(baseTmpDir, "vdb");
    workspaceDir = path.join(baseTmpDir, "repo_workspace");
    await fs.mkdir(vdbDir, { recursive: true });
    await fs.mkdir(workspaceDir, { recursive: true });
  });

  afterEach(async () => {
    if (adapter && adapter.ready) {
      await adapter.close();
      adapter = null;
    }
    try {
      await fs.rm(baseTmpDir, { recursive: true, force: true });
    } catch {
      // Ignorar bloqueos transitorios en Windows
    }
  });

  it("Días 1-3: proyecto real multi-Sub-Ego con HITL, background, daily state y memoria acumulada intacta", async () => {
    const t0 = Date.now();
    const projectId = "proj_beta_release";
    const sessionId = "sess_beta_release";

    // ════════════════════════════════════════════════════════════════
    // DÍA 1 — Arranque: proyecto + 3 Sub-Egos + decisión + HITL + background
    // ════════════════════════════════════════════════════════════════
    adapter = new EgoMemoryAdapter(vdbDir);
    await adapter.init();
    expect(adapter.ready).toBe(true);

    const eventBus = new EventBus({ maxHistorySize: 200 });
    const executionManager = new ExecutionManager({
      defaultTimeoutMs: 15_000,
      maxConcurrentExecutions: 5,
    });

    let pendingApproval: PendingApproval | null = null;
    const approvalEngine = new ApprovalEngine({
      mode: "standard",
      defaultTimeoutMs: 20_000,
      onApprovalRequested: (req) => {
        pendingApproval = req;
      },
    });

    const toolRegistry = new ToolRegistry();
    registerNativeTools(toolRegistry, {
      workspacePath: workspaceDir,
      enableFs: true,
      enableGit: true,
      enableTerminal: true,
    });

    const registry = new SubEgoRegistry(adapter);
    const runtime = new SubEgoRuntime({ idleTtlMs: 5_000 });
    const dailyState = new DailyStatePersistence(adapter, { eventBus });

    const modelRouter = new ModelRouter();
    modelRouter.registerProvider(new MockProvider());
    const resolvedModel = await modelRouter.resolveModel("coder");
    expect(resolvedModel.id).toBe("mock-core");

    // Proyecto beta en namespace gobernado (SEC-09: promote supervisado).
    const createdAtDay1 = t0;
    await adapter.put({
      namespace: "gov/projects",
      key: projectId,
      payload: {
        id: projectId,
        name: "Proyecto Beta Release",
        rootPath: workspaceDir,
        createdAtMs: createdAtDay1,
        updatedAtMs: createdAtDay1,
        status: "active" as const,
      },
      metadata: { project_id: projectId },
    });
    await adapter.promote(`gov/projects:${projectId}`, "gov/projects", projectId);

    // Tres Sub-Egos de dominios distintos (Engineering, Product/Knowledge, Analytics).
    const devManifest: SubEgoManifest = createSubEgoManifest({
      name: "Beta Dev Specialist",
      role: "Software Engineer",
      creator: "ego-nucleus",
      instructions: "Implementar código del proyecto beta con herramientas Nivel A.",
      capabilities: ["fs_read_file", "fs_write_file", "git_status", "terminal_exec"],
      tools: ["fs_read_file", "fs_write_file", "git_status", "terminal_exec"],
    });
    devManifest.id = "ego.beta-dev";

    const productManifest: SubEgoManifest = createSubEgoManifest({
      name: "Beta Product Specialist",
      role: "Product Manager",
      creator: "ego-nucleus",
      instructions: "Curar conocimiento del producto y coordinar entregas entre días.",
      capabilities: ["fs_read_file", "fs_write_file"],
      tools: ["fs_read_file", "fs_write_file"],
      permissions: ["delegate:*", "memory:shared:write", "memory:shared:read"],
    });
    productManifest.id = "ego.beta-product";

    const analystManifest: SubEgoManifest = createSubEgoManifest({
      name: "Beta Analyst Specialist",
      role: "Data Analyst",
      creator: "ego-nucleus",
      instructions: "Analizar métricas de uso y registrar lecciones operativas.",
      capabilities: ["fs_read_file", "fs_write_file"],
      tools: ["fs_read_file", "fs_write_file"],
    });
    analystManifest.id = "ego.beta-analyst";

    await registry.register(devManifest);
    await registry.register(productManifest);
    await registry.register(analystManifest);
    runtime.registerManifest(devManifest);
    runtime.registerManifest(productManifest);
    runtime.registerManifest(analystManifest);

    // Contexto del proyecto (día 1) + semilla de Knowledge para búsqueda multi-día.
    await adapter.put({
      namespace: `proj/${projectId}`,
      key: "beta_context",
      payload: {
        spec: "Construir el panel beta con API REST y documentación viva",
        techStack: ["Node.js", "TypeScript", "VantaDB", "Vitest"],
        simulatedDayTs: createdAtDay1,
      },
      metadata: { category: "context", importance: 1.0 },
    });
    await adapter.put({
      namespace: "kb/docs",
      key: "beta:release_notes_day1",
      payload: "Notas beta día 1: el Sistema Operativo Cognitivo persiste memoria multi-día en VantaDB.",
      metadata: { category: "release-notes", confidence: 1.0 },
    });

    // Decisión del router (engineering) + auditoría + telemetría.
    const decisionRouter = new DecisionRouter();
    const decisionAuditor = new DecisionAuditor(adapter);
    const decisionTelemetry = new DecisionTelemetry(eventBus);
    const verdictDay1 = await decisionRouter.decide({
      prompt: "Revisar y escribir el módulo api.ts en el workspace y ejecutar tests",
      projectId,
      workspacePath: workspaceDir,
      activeSubEgoId: "ego.beta-dev",
    });
    expect(verdictDay1.domain).toBe("engineering");
    expect(verdictDay1.toolsEnabled).toContain("fs_read_file");
    expect(verdictDay1.intentDigest).toHaveLength(64);
    const auditKeyDay1 = await decisionAuditor.recordVerdict(verdictDay1);
    expect(auditKeyDay1).toContain("verdict:");
    const telemDay1 = decisionTelemetry.record({
      runId: verdictDay1.admittedRunContext.runId,
      intentId: verdictDay1.intentId,
      classifyMs: 5,
      subEgoSelectMs: 1,
      preconditionsMs: 1,
      totalDecisionMs: 7,
      decidedBy: verdictDay1.decidedBy,
    });
    expect(telemDay1.withinBudget).toBe(true);

    // Ejecución con aprobación HITL (día 1, ego.beta-dev escribe src/api.ts).
    const lifecycle = new EgoMemoryLifecycle(adapter);
    await lifecycle.startSession(sessionId, projectId);
    const apiContent =
      "// Generated by ego.beta-dev (día 1)\nexport function getBetaHealth(): string {\n  return \"beta-ok-day1\";\n}\n";
    const toolLoop = new ToolExecutionLoop(modelRouter, toolRegistry, {
      executionManager,
      approvalEngine,
      eventBus,
      maxSteps: 5,
      defaultRole: "coder",
    });
    const runDay1 = toolLoop.run({
      messages: [
        {
          role: "user",
          content:
            "SIMULATE_TOOL:fs_write_file:" +
            JSON.stringify({ path: "src/api.ts", content: apiContent }),
        },
      ],
      context: {
        callId: "call_beta_day1_01",
        sessionId,
        workspacePath: workspaceDir,
        subEgoId: "ego.beta-dev",
        projectId,
      },
      role: "coder",
    });
    let attempts = 0;
    while (!pendingApproval && attempts < 50) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      attempts++;
    }
    expect(pendingApproval).not.toBeNull();
    const approvalDay1 = pendingApproval as unknown as PendingApproval;
    expect(approvalDay1.toolName).toBe("fs_write_file");
    expect(
      approvalEngine.resolveApproval(approvalDay1.approvalId, {
        approved: true,
        reason: "Módulo beta día 1 aprobado por el operador",
        timestamp: Date.now(),
      })
    ).toBe(true);
    const loopResultDay1 = await runDay1;
    expect(loopResultDay1.status).toBe("completed");
    pendingApproval = null;

    await adapter.put({
      namespace: "gov/audit",
      key: `hitl:beta-day1`,
      payload: {
        approvalId: approvalDay1.approvalId,
        toolName: "fs_write_file",
        targetPath: "src/api.ts",
        action: "approved",
        approvedBy: "user",
        simulatedDayTs: createdAtDay1,
      },
    });
    const apiOnDiskDay1 = await fs.readFile(path.join(workspaceDir, "src", "api.ts"), "utf-8");
    expect(apiOnDiskDay1).toBe(apiContent);
    await adapter.put({
      namespace: `projects/${projectId}/artifacts`,
      key: "api_module_day1",
      payload: {
        type: "code_file",
        path: "src/api.ts",
        summary: "Módulo beta día 1 con getBetaHealth",
        simulatedDayTs: createdAtDay1,
      },
    });
    await lifecycle.syncTurnToDisk({
      sessionId,
      turnIndex: 1,
      userMessage: "Crea el módulo beta día 1",
      assistantResponse: "Módulo creado en src/api.ts tras tu aprobación.",
    });

    // Background Task día 1: indexación nocturna simulada que escribe su reporte.
    const backgroundEngine = new BackgroundEngine({ maxConcurrent: 2 });
    backgroundEngine.submit({
      id: "beta-nightly-index-day1",
      title: "Indexación nocturna día 1",
      subEgoId: "ego.beta-analyst",
      execute: async () => {
        const report = `beta-index-day1 simulatedTs=${createdAtDay1}\nfiles=1\n`;
        await fs.mkdir(path.join(workspaceDir, "reports"), { recursive: true });
        await fs.writeFile(path.join(workspaceDir, "reports", "index-day1.txt"), report, "utf-8");
        return { reportPath: "reports/index-day1.txt", files: 1 };
      },
    });
    attempts = 0;
    let bgStatusDay1: string | undefined;
    while (attempts < 200) {
      bgStatusDay1 = backgroundEngine.getTask("beta-nightly-index-day1")?.status;
      if (bgStatusDay1 === "completed" || bgStatusDay1 === "failed") break;
      await new Promise((resolve) => setTimeout(resolve, 50));
      attempts++;
    }
    expect(bgStatusDay1).toBe("completed");
    const indexReportDay1 = await fs.readFile(
      path.join(workspaceDir, "reports", "index-day1.txt"),
      "utf-8"
    );
    expect(indexReportDay1).toContain("beta-index-day1");

    // Daily State día 1 (quarantine-aware HIG-04 en lectura).
    await dailyState.saveSnapshot(
      dailySummary(DAY_1, createdAtDay1, {
        completedTasksCount: 1,
        decisionsCount: 1,
        pendingApprovalsCount: 0,
        totalTokensToday: 750,
        estimatedCostUsd: 0.01,
        recentDecisions: [
          {
            id: "dec-beta-day1",
            title: "Módulo api.ts aprobado vía HITL",
            timestamp: createdAtDay1,
            subEgoId: "ego.beta-dev",
            impact: "src/api.ts creado",
          },
        ],
        suggestedGoals: [
          {
            id: "goal-beta-day2",
            title: "Delegar análisis a ego.beta-analyst",
            priority: "high",
            reason: "Acumular hallazgos multi-día",
          },
        ],
      })
    );
    const restoredDay1Hot = await dailyState.getSnapshot(DAY_1);
    expect(restoredDay1Hot?.summary.completedTasksCount).toBe(1);
    expect(await dailyState.isFirstLaunchOfDay(DAY_1)).toBe(false);

    await adapter.close();

    // ════════════════════════════════════════════════════════════════
    // DÍA 2 — Reapertura: delegación multi-Sub-Ego + Knowledge + Canvas
    // ════════════════════════════════════════════════════════════════
    adapter = new EgoMemoryAdapter(vdbDir);
    await adapter.init();
    expect(adapter.ready).toBe(true);

    const coldRegistryDay2 = new SubEgoRegistry(adapter);
    const coldRuntimeDay2 = new SubEgoRuntime({ idleTtlMs: 5_000 });
    const day2Shared = new SharedMemory(adapter);
    const day2Budget = new SubEgoBudgetTracker(adapter);
    const day2Learning = new SelfImprovementLoop(adapter);
    const day2Daily = new DailyStatePersistence(adapter);
    const day2Lifecycle = new EgoMemoryLifecycle(adapter);

    // La memoria del día 1 sobrevivió al reinicio en frío.
    const restoredProject = (await adapter.get("gov/projects", projectId))?.payload as {
      id: string;
      name: string;
    };
    expect(restoredProject.id).toBe(projectId);
    expect(restoredProject.name).toBe("Proyecto Beta Release");
    expect((await coldRegistryDay2.get("ego.beta-dev"))?.name).toBe("Beta Dev Specialist");
    expect((await coldRegistryDay2.get("ego.beta-product"))?.name).toBe("Beta Product Specialist");
    expect((await coldRegistryDay2.get("ego.beta-analyst"))?.name).toBe("Beta Analyst Specialist");
    expect((await day2Daily.getSnapshot(DAY_1))?.summary.completedTasksCount).toBe(1);
    expect(await fs.readFile(path.join(workspaceDir, "src", "api.ts"), "utf-8")).toBe(apiContent);

    const createdAtDay2 = t0 + DAY_MS;
    const day2Manifests = [
      (await coldRegistryDay2.get("ego.beta-dev")) as SubEgoManifest,
      (await coldRegistryDay2.get("ego.beta-product")) as SubEgoManifest,
      (await coldRegistryDay2.get("ego.beta-analyst")) as SubEgoManifest,
    ];
    for (const m of day2Manifests) coldRuntimeDay2.registerManifest(m);

    // Delegación nucleus → analyst con executor real (lee spec, consume
    // presupuesto, registra lección, publica hallazgo en memoria compartida).
    await day2Shared.publish(
      projectId,
      "beta_task_spec_day2",
      { goal: "Analizar actividad beta y proponer foco del día 3", status: "in_progress", simulatedDayTs: createdAtDay2 },
      { publishedBy: "ego.beta-product", ttlMs: 7 * DAY_MS }
    );
    const delegationRouterDay2 = new DelegationRouter({
      runtime: coldRuntimeDay2,
      registry: coldRegistryDay2,
      sharedMemory: day2Shared,
      maxDepth: 3,
      executor: async (_instance, req) => {
        const spec = await day2Shared.readValue<{ goal: string }>(projectId, "beta_task_spec_day2");
        if (!spec) throw new Error("spec día 2 ausente en SharedMemory");
        const targetManifest = await coldRegistryDay2.get(req.targetEgoId);
        if (!targetManifest) throw new Error(`Sub-Ego día 2 ausente: ${req.targetEgoId}`);
        await day2Budget.recordTurnUsage(
          req.targetEgoId,
          { inputTokens: 600, outputTokens: 300, model: "mock-core" },
          targetManifest.budget
        );
        const lesson = await day2Learning.recordLesson({
          subEgoId: req.targetEgoId,
          trigger: "milestone_completed",
          context: "Análisis beta día 2",
          insight: "La memoria acumulada acelera el arranque del día siguiente",
          actionableRule: "Rehidratar snapshots diarios antes de planificar.",
          tags: ["beta", "multi-day", "memory"],
        });
        await day2Shared.publish(
          projectId,
          "beta_findings_day2",
          {
            diagnosis: "Arranque día 2 sin fricción: proyecto, artefactos y snapshot día 1 intactos",
            lessonId: lesson.lesson.id,
            simulatedDayTs: createdAtDay2,
          },
          { publishedBy: req.targetEgoId, ttlMs: 7 * DAY_MS }
        );
        return { status: "completed", summary: "Análisis día 2 completado" };
      },
    });
    const delegationDay2 = await delegationRouterDay2.delegate<
      { task: string },
      { status: string; summary: string }
    >({
      callerEgoId: "ego.beta-product",
      targetEgoId: "ego.beta-analyst",
      projectId,
      task: "Analizar actividad beta día 2",
      input: { task: "Analizar actividad beta día 2" },
    });
    expect(delegationDay2.status).toBe("completed");
    expect(delegationDay2.output?.summary).toBe("Análisis día 2 completado");
    expect(
      (await day2Shared.readValue<{ diagnosis: string }>(projectId, "beta_findings_day2"))?.diagnosis
    ).toContain("Arranque día 2 sin fricción");

    // Segunda escritura HITL (día 2, ego.beta-product documenta el hallazgo).
    const eventBusDay2 = new EventBus({ maxHistorySize: 200 });
    const executionDay2 = new ExecutionManager({ defaultTimeoutMs: 15_000, maxConcurrentExecutions: 5 });
    let pendingDay2: PendingApproval | null = null;
    const approvalDay2Engine = new ApprovalEngine({
      mode: "standard",
      defaultTimeoutMs: 20_000,
      onApprovalRequested: (req) => {
        pendingDay2 = req;
      },
    });
    const toolsDay2 = new ToolRegistry();
    registerNativeTools(toolsDay2, {
      workspacePath: workspaceDir,
      enableFs: true,
      enableGit: true,
      enableTerminal: true,
    });
    const routerDay2 = new ModelRouter();
    routerDay2.registerProvider(new MockProvider());
    const loopDay2 = new ToolExecutionLoop(routerDay2, toolsDay2, {
      executionManager: executionDay2,
      approvalEngine: approvalDay2Engine,
      eventBus: eventBusDay2,
      maxSteps: 5,
      defaultRole: "coder",
    });
    const notesContent = `# Beta día 2\n\n${createdAtDay2}: hallazgo analyst registrado.\n`;
    const runDay2 = loopDay2.run({
      messages: [
        {
          role: "user",
          content: "SIMULATE_TOOL:fs_write_file:" + JSON.stringify({ path: "NOTES-beta.md", content: notesContent }),
        },
      ],
      context: {
        callId: "call_beta_day2_01",
        sessionId,
        workspacePath: workspaceDir,
        subEgoId: "ego.beta-product",
        projectId,
      },
      role: "coder",
    });
    attempts = 0;
    while (!pendingDay2 && attempts < 50) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      attempts++;
    }
    expect(pendingDay2).not.toBeNull();
    expect(
      approvalDay2Engine.resolveApproval((pendingDay2 as unknown as PendingApproval).approvalId, {
        approved: true,
        reason: "Notas beta día 2 aprobadas",
        timestamp: Date.now(),
      })
    ).toBe(true);
    expect((await runDay2).status).toBe("completed");
    await adapter.put({
      namespace: "gov/audit",
      key: "hitl:beta-day2",
      payload: {
        toolName: "fs_write_file",
        targetPath: "NOTES-beta.md",
        action: "approved",
        approvedBy: "user",
        simulatedDayTs: createdAtDay2,
      },
    });
    expect(await fs.readFile(path.join(workspaceDir, "NOTES-beta.md"), "utf-8")).toBe(notesContent);

    // Canvas día 2: contrato declarativo → ChangeSet del usuario → persistencia.
    const canvasBridge = new CanvasBridge();
    const betaTable: CanvasComponentManifest = {
      id: "table-beta-progress",
      type: "table",
      metadata: {
        timestamp: createdAtDay2,
        generatedBy: "ego.beta-product",
        why: {
          vantaSources: [`proj/${projectId}/beta_context`],
          directCause: "Tablero de progreso beta multi-día",
          auditTrace: auditKeyDay1,
        },
      },
      props: {
        id: "table-beta-progress",
        title: "Progreso Beta",
        columns: [
          { key: "day", label: "Día", type: "text", sortable: false },
          { key: "status", label: "Estado", type: "text", sortable: false },
        ],
        rows: [
          { day: DAY_1, status: "Completado" },
          { day: DAY_2, status: "En progreso" },
        ],
        actions: [],
      },
    };
    canvasBridge.injectComponent(betaTable);
    const changeSetDay2: CanvasChangeSet = {
      id: "cs-beta-day2-complete",
      componentId: "table-beta-progress",
      timestamp: createdAtDay2,
      op: "update",
      path: "rows",
      newValue: [
        { day: DAY_1, status: "Completado" },
        { day: DAY_2, status: "Completado" },
      ],
      origin: "user",
    };
    expect(canvasBridge.applyChangeSet(changeSetDay2)).toBe(true);
    const workspaceStateDay2: CanvasWorkspaceState = {
      id: `canvas-${projectId}`,
      projectId,
      activeView: "default",
      components: canvasBridge.getComponents(),
      selectedComponentId: "table-beta-progress",
      updatedAt: createdAtDay2,
    };
    await adapter.put({
      namespace: "workspace",
      key: CanvasPersistenceManager.getVantaKey(projectId),
      payload: CanvasPersistenceManager.serialize(workspaceStateDay2),
    });

    await day2Lifecycle.syncTurnToDisk({
      sessionId,
      turnIndex: 2,
      userMessage: "Consolida el día 2 beta",
      assistantResponse: "Delegación analyst completada, notas aprobadas y canvas actualizado.",
    });
    await day2Daily.saveSnapshot(
      dailySummary(DAY_2, createdAtDay2, {
        completedTasksCount: 2,
        decisionsCount: 1,
        totalTokensToday: 900,
        estimatedCostUsd: 0.02,
        recentDecisions: [
          {
            id: "dec-beta-day2",
            title: "Delegación a analyst + HITL de notas",
            timestamp: createdAtDay2,
            subEgoId: "ego.beta-product",
            impact: "NOTES-beta.md creado",
          },
        ],
        suggestedGoals: [
          {
            id: "goal-beta-day3",
            title: "Sello release: verificar memoria acumulada",
            priority: "high",
            reason: "Cierre P0-Beta",
          },
        ],
      })
    );
    await adapter.close();

    // ════════════════════════════════════════════════════════════════
    // DÍA 3 — Sello release: verificación acumulada multi-día
    // ════════════════════════════════════════════════════════════════
    adapter = new EgoMemoryAdapter(vdbDir);
    await adapter.init();
    expect(adapter.ready).toBe(true);

    const coldRegistryDay3 = new SubEgoRegistry(adapter);
    const day3Shared = new SharedMemory(adapter);
    const day3Learning = new SelfImprovementLoop(adapter);
    const day3Budget = new SubEgoBudgetTracker(adapter);
    const day3Daily = new DailyStatePersistence(adapter);
    const rehydratedAuditor = new DecisionAuditor(adapter);

    // Proyecto + 3 manifiestos intactos tras dos reinicios.
    expect(((await adapter.get("gov/projects", projectId))?.payload as { id: string }).id).toBe(
      projectId
    );
    expect((await coldRegistryDay3.get("ego.beta-dev"))?.name).toBe("Beta Dev Specialist");
    expect((await coldRegistryDay3.get("ego.beta-product"))?.name).toBe("Beta Product Specialist");
    expect((await coldRegistryDay3.get("ego.beta-analyst"))?.name).toBe("Beta Analyst Specialist");

    // Contexto acumulado de ambos días.
    expect(
      ((await adapter.get(`proj/${projectId}`, "beta_context"))?.payload as { spec: string }).spec
    ).toContain("panel beta");

    // Snapshots diarios ordenados (los 2 días previos; el día 3 aún no existe).
    expect(await day3Daily.isFirstLaunchOfDay(DAY_3)).toBe(true);
    const snapshotsPre = await day3Daily.listSnapshots();
    expect(snapshotsPre.map((s) => s.date)).toEqual([DAY_2, DAY_1]);
    expect(snapshotsPre.every((s) => s.checksum.length === 64)).toBe(true);

    // Auditoría: veredicto día 1 inmutable + trail HITL de 2 días.
    const finalVerdict = await rehydratedAuditor.getVerdict(auditKeyDay1);
    expect(finalVerdict).not.toBeNull();
    expect(finalVerdict?.domain).toBe("engineering");
    expect(
      ((await adapter.get("gov/audit", "hitl:beta-day1"))?.payload as { action: string }).action
    ).toBe("approved");
    expect(
      ((await adapter.get("gov/audit", "hitl:beta-day2"))?.payload as { action: string }).action
    ).toBe("approved");

    // Artefactos de ambos días + turnos de sesión 1 y 2.
    expect(
      ((await adapter.get(`projects/${projectId}/artifacts`, "api_module_day1"))?.payload as {
        path: string;
      }).path
    ).toBe("src/api.ts");
    const turn1 = await adapter.get("session/turns", `${sessionId}:turn:1`);
    expect(turn1).not.toBeNull();
    const turn2 = await adapter.get("session/turns", `${sessionId}:turn:2`);
    expect(turn2).not.toBeNull();

    // Memoria compartida + lección + presupuesto acumulados del día 2.
    expect(
      (await day3Shared.readValue<{ diagnosis: string }>(projectId, "beta_findings_day2"))
        ?.diagnosis
    ).toContain("Arranque día 2 sin fricción");
    const lessonsDay3 = await day3Learning.recallLessons("ego.beta-analyst");
    expect(lessonsDay3.length).toBe(1);
    expect(lessonsDay3[0]!.actionableRule).toContain("Rehidratar snapshots diarios");
    expect((await day3Budget.getMetrics("ego.beta-analyst")).lifetimeTotalTokens).toBe(900);

    // Canvas con la mutación del usuario intacta.
    const rawCanvas = (await adapter.get("workspace", CanvasPersistenceManager.getVantaKey(projectId)))
      ?.payload;
    expect(rawCanvas).not.toBeNull();
    const recoveredCanvas = CanvasPersistenceManager.deserialize(rawCanvas, projectId);
    expect(recoveredCanvas.components.length).toBe(1);
    expect(
      (
        recoveredCanvas.components[0]!.props as unknown as { rows: { status: string }[] }
      ).rows[1]!.status
    ).toBe("Completado");

    // Búsqueda federada encuentra el conocimiento acumulado multi-día.
    const kbHits = await adapter.searchMulti(["kb/docs", `proj/${projectId}`], "memoria multi-día VantaDB", {
      topK: 5,
    });
    expect(kbHits.length).toBeGreaterThan(0);

    // Archivos físicos byte-exactos tras dos reinicios.
    expect(await fs.readFile(path.join(workspaceDir, "src", "api.ts"), "utf-8")).toBe(apiContent);
    expect(await fs.readFile(path.join(workspaceDir, "NOTES-beta.md"), "utf-8")).toBe(notesContent);
    expect(await fs.readFile(path.join(workspaceDir, "reports", "index-day1.txt"), "utf-8")).toContain(
      "beta-index-day1"
    );

    // Daily State día 3 cierra el sello: ya no es primer arranque tras guardar.
    const createdAtDay3 = t0 + 2 * DAY_MS;
    await day3Daily.saveSnapshot(
      dailySummary(DAY_3, createdAtDay3, {
        completedTasksCount: 3,
        decisionsCount: 1,
        totalTokensToday: 300,
        estimatedCostUsd: 0.005,
        recentDecisions: [
          {
            id: "dec-beta-day3",
            title: "Sello release: memoria acumulada verificada",
            timestamp: createdAtDay3,
            subEgoId: "ego.beta-product",
            impact: "0 regresiones",
          },
        ],
        suggestedGoals: [],
      })
    );
    expect(await day3Daily.isFirstLaunchOfDay(DAY_3)).toBe(false);
    expect((await day3Daily.listSnapshots()).map((s) => s.date)).toEqual([DAY_3, DAY_2, DAY_1]);

    await adapter.close();
    adapter = null;
  }, 30000);

  it("Gobernanza beta: la delegación cíclica se bloquea y el estado no se corrompe", async () => {
    adapter = new EgoMemoryAdapter(vdbDir);
    await adapter.init();

    const localRegistry = new SubEgoRegistry(adapter);
    const localRuntime = new SubEgoRuntime({ idleTtlMs: 5_000 });
    const localShared = new SharedMemory(adapter);

    const nucleus: SubEgoManifest = createSubEgoManifest({
      name: "Beta Nucleus",
      role: "Orquestador General",
      creator: "ego-nucleus",
      instructions: "Coordinar el proyecto beta.",
      capabilities: ["fs_read_file"],
      tools: ["fs_read_file"],
    });
    nucleus.id = "ego.beta-nucleus";
    await localRegistry.register(nucleus);
    localRuntime.registerManifest(nucleus);

    const router = new DelegationRouter({
      runtime: localRuntime,
      registry: localRegistry,
      sharedMemory: localShared,
      maxDepth: 3,
    });

    await expect(
      router.delegate({
        projectId: "proj_beta_release",
        callerEgoId: "ego.beta-nucleus",
        targetEgoId: "ego.beta-nucleus",
        task: "Loop beta",
        input: "Loop beta",
      })
    ).rejects.toThrow(DelegationCycleError);

    // El intento bloqueado no dejó estado parcial en memoria compartida.
    expect(await localShared.readValue("proj_beta_release", "beta_task_spec_day2")).toBeNull();

    await adapter.close();
    adapter = null;
  });
});
