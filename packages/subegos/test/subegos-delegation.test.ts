// subegos-delegation.test.ts — Golden Path Alpha (Pasos 10 al 14) (SUB-10)
// Validación E2E Multi-Sub-Ego: Orquestación -> SharedMemory -> Delegación Especialista -> Closed Loop Learning -> Persistencia y Reapertura en frío
import { createTempWorkspace } from "@ego/tools";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import { EgoMemoryAdapter } from "@ego/memory";
import {
  createSubEgoManifest,
  SubEgoRuntime,
  SubEgoRegistry,
  SharedMemory,
  DelegationRouter,
  SubEgoBudgetTracker,
  SelfImprovementLoop,
  DelegationCycleError,
  DelegationMaxDepthError,
  type SubEgoManifest,
} from "../src/index.js";

describe("Golden Path Alpha — Delegación Multi-Sub-Ego y Cooperación E2E (SUB-10)", () => {
  let tmpDir: string;
  let adapter: EgoMemoryAdapter;
  let runtime: SubEgoRuntime;
  let registry: SubEgoRegistry;
  let sharedMemory: SharedMemory;
  let budgetTracker: SubEgoBudgetTracker;
  let learningLoop: SelfImprovementLoop;

  let orchestratorManifest: SubEgoManifest;
  let researcherManifest: SubEgoManifest;

  beforeEach(async () => {
    tmpDir = createTempWorkspace({ prefix: "ego-e2e-subegos" }).path;
    await fs.mkdir(tmpDir, { recursive: true });

    adapter = new EgoMemoryAdapter(tmpDir);
    await adapter.init();

    runtime = new SubEgoRuntime({ idleTtlMs: 5000 });
    registry = new SubEgoRegistry(adapter);
    sharedMemory = new SharedMemory(adapter);
    budgetTracker = new SubEgoBudgetTracker(adapter);
    learningLoop = new SelfImprovementLoop(adapter);

    // 1. Manifiesto Orquestador general (ego.nucleus)
    orchestratorManifest = createSubEgoManifest({
      name: "Ego Nucleus",
      role: "Orquestador General",
      creator: "ego-nucleus",
      instructions: "Recibir intenciones del usuario, coordinar y delegar tareas técnicas.",
      permissions: ["delegate:*", "memory:shared:write", "memory:shared:read"],
      budget: {
        maxTokensPerCall: 8000,
        maxDailyCostUsd: 10.0,
        requiresApprovalAboveUsd: 1.0,
      },
    });
    orchestratorManifest.id = "ego.nucleus";

    // 2. Manifiesto Especialista Investigador
    researcherManifest = createSubEgoManifest({
      name: "Senior Researcher",
      role: "Especialista en Investigación y Diagnóstico",
      instructions: "Analizar cuellos de botella y registrar lecciones operativas.",
      permissions: ["memory:shared:write", "memory:shared:read"],
      budget: {
        maxTokensPerCall: 4000,
        maxDailyCostUsd: 5.0,
        requiresApprovalAboveUsd: 0.5,
      },
    });
    researcherManifest.id = "ego.researcher";

    await registry.register(orchestratorManifest);
    await registry.register(researcherManifest);

    runtime.registerManifest(orchestratorManifest);
    runtime.registerManifest(researcherManifest);
  });

  afterEach(async () => {
    if (adapter && adapter.ready) {
      await adapter.close();
    }
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignorar bloqueos temporales en Windows
    }
  });

  it("Pasos 10 al 14: Ciclo Completo de Delegación, Memoria Compartida, Presupuesto y Persistencia tras Reinicio en Frío", async () => {
    const projectId = "proj_alpha";

    // Paso 10: Orquestador recibe solicitud del usuario
    const userIntent = "Analizar el rendimiento de la persistencia de datos y optimizar índices";

    // Paso 11: Orquestador consulta contexto y escribe estado inicial en SharedMemory
    await sharedMemory.publish(
      projectId,
      "task_spec",
      {
        goal: userIntent,
        status: "in_progress",
        delegatedTo: "ego.researcher",
        createdAt: Date.now(),
      },
      { publishedBy: "ego.nucleus", ttlMs: 60_000 }
    );

    const initialSpec = await sharedMemory.readValue<{ goal: string; status: string }>(
      projectId,
      "task_spec"
    );
    expect(initialSpec).toBeDefined();
    expect(initialSpec?.goal).toBe(userIntent);

    // Paso 12: Configurar DelegationRouter con ejecutor especializado
    const delegationRouter = new DelegationRouter({
      runtime,
      registry,
      sharedMemory,
      maxDepth: 3,
      executor: async (_instance, req) => {
        // Simular ejecución del especialista:
        // 1. Lee la especificación de SharedMemory
        const spec = await sharedMemory.readValue<{ goal: string }>(projectId, "task_spec");
        expect(spec?.goal).toBe(userIntent);

        // 2. Consume presupuesto del especialista
        await budgetTracker.recordTurnUsage(
          req.targetEgoId,
          { inputTokens: 500, outputTokens: 250, model: "mock-core" },
          researcherManifest.budget
        );

        // 3. Aplica Closed Learning Loop (SUB-12): extrae lección operativa
        const lessonResult = await learningLoop.recordLesson({
          subEgoId: req.targetEgoId,
          trigger: "milestone_completed",
          context: "Optimización de consultas en LSM",
          insight: "Los índices de prefijo reducen el tiempo de búsqueda en rangos",
          actionableRule: "Utilizar siempre claves con prefijo canónico para evitar escaneos globales.",
          tags: ["storage", "lsm", "indexing"],
        });

        // 4. Escribe resultado de análisis en SharedMemory
        await sharedMemory.publish(
          projectId,
          "research_findings",
          {
            diagnosis: "Cuello de botella detectado en escaneos sin prefijo",
            recommendation: "Crear índices secundarios por namespace",
            lessonId: lessonResult.lesson.id,
            completedAt: Date.now(),
          },
          { publishedBy: req.targetEgoId }
        );

        return {
          status: "completed",
          summary: "Diagnóstico completado con éxito",
          lessonId: lessonResult.lesson.id,
        };
      },
    });

    // Paso 13: Orquestador delega formalmente la tarea al especialista
    const delegationResult = await delegationRouter.delegate<{ task: string }, { status: string; summary: string }>({
      callerEgoId: "ego.nucleus",
      targetEgoId: "ego.researcher",
      projectId,
      task: { task: "Diagnosticar índices LSM" },
      contextPayload: { projectId },
    });

    expect(delegationResult.status).toBe("completed");
    expect(delegationResult.output?.summary).toBe("Diagnóstico completado con éxito");

    // Paso 14: Orquestador integra resultado de SharedMemory y persiste el turno en VantaDB
    const findings = await sharedMemory.readValue<{ diagnosis: string }>(
      projectId,
      "research_findings"
    );
    expect(findings).toBeDefined();
    expect(findings?.diagnosis).toContain("Cuello de botella");

    // Guardar turno integrado en VantaDB
    await adapter.put({
      namespace: `projects/${projectId}/turns`,
      key: "turn:001",
      payload: {
        userIntent,
        orchestrator: "ego.nucleus",
        delegatedWorker: "ego.researcher",
        resultSummary: delegationResult.output?.summary,
        timestamp: Date.now(),
      },
    });

    // Validar métricas de presupuesto antes del reinicio
    const metricsBefore = await budgetTracker.getMetrics("ego.researcher");
    expect(metricsBefore.dailyTotalTokens).toBe(750);

    // Cierre seguro del adaptador para asegurar que WAL y LSM se vacíen a disco
    await adapter.close();

    // ─────────────────────────────────────────────────────────────
    // REINICIO EN FRÍO (Cold Reload)
    // ─────────────────────────────────────────────────────────────
    const coldAdapter = new EgoMemoryAdapter(tmpDir);
    await coldAdapter.init();
    expect(coldAdapter.ready).toBe(true);

    const coldRegistry = new SubEgoRegistry(coldAdapter);
    const coldSharedMemory = new SharedMemory(coldAdapter);
    const coldLearningLoop = new SelfImprovementLoop(coldAdapter);
    const coldBudgetTracker = new SubEgoBudgetTracker(coldAdapter);

    // 1. Manifiestos de ambos Sub-Egos persisten en VantaDB
    const restoredOrchestrator = await coldRegistry.get("ego.nucleus");
    const restoredResearcher = await coldRegistry.get("ego.researcher");
    expect(restoredOrchestrator).not.toBeNull();
    expect(restoredOrchestrator?.name).toBe("Ego Nucleus");
    expect(restoredResearcher).not.toBeNull();
    expect(restoredResearcher?.name).toBe("Senior Researcher");

    // 2. Memoria compartida persiste en disco
    const restoredFindings = await coldSharedMemory.readValue<{ diagnosis: string }>(
      projectId,
      "research_findings"
    );
    expect(restoredFindings).not.toBeNull();
    expect(restoredFindings?.diagnosis).toContain("Cuello de botella detectado");

    // 3. Lección aprendida persiste y es recuperable
    const recalledLessons = await coldLearningLoop.recallLessons("ego.researcher");
    expect(recalledLessons.length).toBe(1);
    expect(recalledLessons[0].actionableRule).toContain("Utilizar siempre claves con prefijo canónico");

    // 4. Turno integrado del proyecto persiste intacto
    const restoredTurn = ((await coldAdapter.get(`projects/${projectId}/turns`, "turn:001"))?.payload as {
      resultSummary: string;
      delegatedWorker: string;
    });
    expect(restoredTurn).not.toBeNull();
    expect(restoredTurn.delegatedWorker).toBe("ego.researcher");
    expect(restoredTurn.resultSummary).toBe("Diagnóstico completado con éxito");

    // 5. Métricas de presupuesto acumuladas persisten en VantaDB
    const restoredMetrics = await coldBudgetTracker.getMetrics("ego.researcher");
    expect(restoredMetrics.lifetimeTotalTokens).toBe(750);

    await coldAdapter.close();
  });

  it("Detecta y bloquea inmediatamente ciclos de delegación recursiva", async () => {
    const delegationRouter = new DelegationRouter({
      runtime,
      registry,
      sharedMemory,
      maxDepth: 3,
    });

    // Intento de auto-delegación directa (A -> A)
    await expect(
      delegationRouter.delegate({
        callerEgoId: "ego.nucleus",
        targetEgoId: "ego.nucleus",
        task: "Loop",
      })
    ).rejects.toThrow(DelegationCycleError);

    // Intento de ciclo indirecto con contexto (A -> B -> A)
    await expect(
      delegationRouter.delegate(
        {
          callerEgoId: "ego.researcher",
          targetEgoId: "ego.nucleus",
          task: "Cycle loop",
        },
        {
          depth: 1,
          callChain: ["ego.nucleus", "ego.researcher"],
        }
      )
    ).rejects.toThrow(DelegationCycleError);
  });

  it("Bloquea la delegación si se supera la profundidad máxima permitida", async () => {
    const delegationRouter = new DelegationRouter({
      runtime,
      registry,
      sharedMemory,
      maxDepth: 2,
    });

    await expect(
      delegationRouter.delegate(
        {
          callerEgoId: "ego.nucleus",
          targetEgoId: "ego.researcher",
          task: "Deep task",
        },
        {
          depth: 2, // Siguiente paso sería depth = 3 > maxDepth(2)
          callChain: ["root", "mid"],
        }
      )
    ).rejects.toThrow(DelegationMaxDepthError);
  });
});
