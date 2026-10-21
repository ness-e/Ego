// mvp-software-loop.test.ts — Validación E2E del Bucle Completo de MVP (Software Engineering) (INT-06)
// Valida los 6 pasos canónicos de docs/product/guia-mvp.md:
// Paso 1: Configurar & Conectar (BYOK / ModelRouter)
// Paso 2: Importar Repositorio / Proyecto (ProjectManifest & Aislamiento VantaDB)
// Paso 3: Asignar Tarea & Especialista (SubEgoRegistry & SubEgoFactory)
// Paso 4: Ejecución con Aprobación HITL (ApprovalEngine & Tool Nivel A)
// Paso 5: Materialización en Canvas / Workspace (Archivos & Artefactos)
// Paso 6: Persistencia Multi-Día y Reanudación (Cold Reboot de EgoMemoryAdapter)

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { EgoMemoryAdapter, EgoMemoryLifecycle } from "@ego/memory";
import { ModelRouter, MockProvider } from "@ego/models";
import { ToolRegistry, registerNativeTools } from "@ego/tools";
import { EventBus } from "@ego/events";
import { ApprovalEngine, ExecutionManager, PendingApproval } from "@ego/execution";
import { ToolExecutionLoop } from "@ego/runtime";
import { SubEgoRegistry, SubEgoRuntime, createSubEgoManifest } from "@ego/subegos";
import { ProjectManifestSchema, type ProjectManifest } from "../src/ipc/schema.js";
import { createScratchDir, removeScratchDir } from "./helpers/test-scratch.js";

describe("INT-06 — Validación E2E del Bucle Completo del MVP (Software Engineering Anchor)", () => {
  let baseTmpDir: string;
  let vdbDir: string;
  let workspaceDir: string;

  let adapter: EgoMemoryAdapter;
  let lifecycle: EgoMemoryLifecycle;
  let modelRouter: ModelRouter;
  let toolRegistry: ToolRegistry;
  let approvalEngine: ApprovalEngine;
  let executionManager: ExecutionManager;
  let eventBus: EventBus;
  let subEgoRegistry: SubEgoRegistry;
  let subEgoRuntime: SubEgoRuntime;

  let pendingApprovalCaptured: PendingApproval | null = null;

  beforeEach(async () => {
    baseTmpDir = createScratchDir("ego-mvp-e2e");
    vdbDir = path.join(baseTmpDir, "vdb");
    workspaceDir = path.join(baseTmpDir, "repo_workspace");

    await fs.mkdir(vdbDir, { recursive: true });
    await fs.mkdir(workspaceDir, { recursive: true });

    // Inicializar adaptador de persistencia real Fjall LSM
    adapter = new EgoMemoryAdapter(vdbDir);
    await adapter.init();

    lifecycle = new EgoMemoryLifecycle(adapter);

    // Sistema de eventos y ejecución
    eventBus = new EventBus({ maxHistorySize: 100 });
    executionManager = new ExecutionManager({ defaultTimeoutMs: 15_000, maxConcurrentExecutions: 5 });

    // Motor de gobernanza con captura interactiva HITL
    pendingApprovalCaptured = null;
    approvalEngine = new ApprovalEngine({
      mode: "standard",
      defaultTimeoutMs: 20_000,
      onApprovalRequested: (req) => {
        pendingApprovalCaptured = req;
      },
    });

    // Herramientas Nivel A restringidas al workspace
    toolRegistry = new ToolRegistry();
    registerNativeTools(toolRegistry, {
      workspacePath: workspaceDir,
      enableFs: true,
      enableGit: true,
      enableTerminal: true,
    });

    // Catálogo y runtime de Sub-Egos
    subEgoRegistry = new SubEgoRegistry(adapter);
    subEgoRuntime = new SubEgoRuntime({ idleTtlMs: 5_000 });

    // Router de modelos
    modelRouter = new ModelRouter({
      activeProviders: ["mock"],
      defaultRoles: {
        "general-chat": { provider: "mock", model: "mock-core" },
        "code-review": { provider: "mock", model: "mock-core" },
      },
    });
    const mockProvider = new MockProvider();
    modelRouter.registerProvider(mockProvider);
  });

  afterEach(async () => {
    if (adapter && adapter.ready) {
      await adapter.close();
    }
    try {
      removeScratchDir(baseTmpDir);
    } catch {
      // Ignorar bloqueos temporales en Windows
    }
  });

  it(
    "Ejecuta el Golden Path completo de 6 pasos de guia-mvp.md sin errores y verifica durabilidad post-reinicio",
    // E6 (Ola 2) — Presupuesto explícito, medido.
    //
    // Este test es un E2E real: 6 pasos canónicos + materialización en disco
    // + **reapertura en frío** del `EgoMemoryAdapter` (I/O de VantaDB en
    // disco). Su coste intrínseco es de ~1,9 s en reposo (medido en la Ola
    // 1c) y ~2,3 s aislado en esta máquina; con el presupuesto por defecto
    // de vitest (5 s) solo tenía un margen de 2,2×, insuficiente cuando el
    // repo corre sus 19 paquetes en paralelo (la suite global + otros
    // agentes saturan la CPU y el disco).
    //
    // MEDIDO: con 64 procesos `node` concurrentes en la máquina, el test
    // tardó 6,6 s → `Test timed out in 5000ms` (fallo por presupuesto, no
    // por aserción). El A/B con el `main.ts` pre-E6 en su sitio dio el
    // MISMO timeout en el import del módulo `main` (5 244 ms), lo que
    // descarta que el refactor sea la causa.
    //
    // El presupuesto nuevo (20 s) es proporcional al coste real de un E2E
    // de disco y NO esconde ningún fallo: si el golden path se rompe, el
    // test sigue fallando por aserción.
    { timeout: 20_000 },
    async () => {
    // ─────────────────────────────────────────────────────────────
    // PASO 1: Configurar & Conectar (BYOK / ModelRouter)
    // ─────────────────────────────────────────────────────────────
    const resolvedModel = await modelRouter.resolveModel("code-review");
    expect(resolvedModel).toBeDefined();
    expect(resolvedModel.id).toBe("mock-core");

    // ─────────────────────────────────────────────────────────────
    // PASO 2: Importar Repositorio / Proyecto
    // ─────────────────────────────────────────────────────────────
    // Crear un archivo base en el workspace del proyecto
    const initialPkgJson = JSON.stringify(
      {
        name: "test-software-project",
        version: "1.0.0",
        scripts: { build: "tsc" },
      },
      null,
      2
    );
    await fs.writeFile(path.join(workspaceDir, "package.json"), initialPkgJson, "utf-8");

    const projectPayload: ProjectManifest = {
      id: "proj_anchor_01",
      name: "Proyecto Software Ancla",
      rootPath: workspaceDir,
      description: "Proyecto de ingeniería de software local-first para validar el MVP",
      activeSubEgoId: "ego.nucleus",
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    };

    const validatedProject = ProjectManifestSchema.parse(projectPayload);
    await adapter.put({
      namespace: "gov/projects",
      key: validatedProject.id,
      payload: validatedProject,
      metadata: { name: validatedProject.name, rootPath: validatedProject.rootPath },
    });

    // SEC-09 (promote supervisado): `gov/projects` vive en cuarentena por
    // defecto; el consumidor real promueve antes de leer en live.
    await adapter.promote(`gov/projects:${validatedProject.id}`, "gov/projects", validatedProject.id);

    const storedProject = ((await adapter.get("gov/projects", validatedProject.id))?.payload as ProjectManifest);
    expect(storedProject).toBeDefined();
    expect(storedProject.id).toBe("proj_anchor_01");

    // ─────────────────────────────────────────────────────────────
    // PASO 3: Planificación & Invocación de Especialista
    // ─────────────────────────────────────────────────────────────
    const specialistManifest = createSubEgoManifest({
      name: "Code Reviewer Specialist",
      role: "Especialista de Ingeniería y Auditoría",
      instructions: "Auditar repositorios, modificar código de forma segura y refactorizar componentes.",
      permissions: ["filesystem:write", "filesystem:read", "delegate:*"],
      creator: "user",
      budget: {
        maxTokensPerCall: 4000,
        maxDailyCostUsd: 5.0,
        requiresApprovalAboveUsd: 0.2,
      },
    });
    specialistManifest.id = "ego.code-reviewer";

    await subEgoRegistry.register(specialistManifest);
    subEgoRuntime.registerManifest(specialistManifest);

    // Actualizar el Sub-Ego activo en el proyecto
    const updatedProject: ProjectManifest = {
      ...storedProject,
      activeSubEgoId: "ego.code-reviewer",
      updatedAtMs: Date.now(),
    };
    await adapter.put({
      namespace: "gov/projects",
      key: updatedProject.id,
      payload: updatedProject,
    });

    // SEC-09 (promote supervisado): la actualización también cae en cuarentena;
    // se promueve para que el cold reboot la restaure desde live.
    await adapter.promote(`gov/projects:${updatedProject.id}`, "gov/projects", updatedProject.id);

    // Iniciar sesión y turno en memoria
    await lifecycle.startSession("sess_mvp_anchor", updatedProject.id);

    // ─────────────────────────────────────────────────────────────
    // PASO 4: Ejecución con Aprobación HITL (ActionApprovalCard)
    // ─────────────────────────────────────────────────────────────
    const fileToWrite = "src/service.ts";
    const serviceContent = `// Generated by Ego Code Reviewer\nexport function healthCheck(): string {\n  return "ok";\n}\n`;

    const toolLoop = new ToolExecutionLoop(modelRouter, toolRegistry, {
      executionManager,
      approvalEngine,
      eventBus,
      maxSteps: 5,
      defaultRole: "code-review",
    });

    const userPrompt =
      "SIMULATE_TOOL:fs_write_file:" +
      JSON.stringify({
        path: fileToWrite,
        content: serviceContent,
      });

    const runPromise = toolLoop.run({
      messages: [{ role: "user", content: userPrompt }],
      context: {
        sessionId: "sess_mvp_anchor",
        workspacePath: workspaceDir,
        subEgoId: "ego.code-reviewer",
        projectId: updatedProject.id,
      },
      role: "code-review",
    });

    // Esperar a que el motor intercepte y emita el requerimiento de aprobación
    let attempts = 0;
    while (!pendingApprovalCaptured && attempts < 50) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      attempts++;
    }

    expect(pendingApprovalCaptured).not.toBeNull();
    expect(pendingApprovalCaptured?.toolName).toBe("fs_write_file");
    expect(pendingApprovalCaptured?.status).toBe("pending");

    // Usuario examina la tarjeta HITL y aprueba la operación
    const approvalId = pendingApprovalCaptured!.approvalId;
    const resolved = approvalEngine.resolveApproval(approvalId, {
      approved: true,
      reason: "Módulo aprobado por el operador de software",
      timestamp: Date.now(),
    });
    expect(resolved).toBe(true);

    const loopResult = await runPromise;
    expect(loopResult.status).toBe("completed");

    // Registrar evento de auditoría en gov/audit
    await adapter.put({
      namespace: "gov/audit",
      key: `hitl:${approvalId}`,
      payload: {
        approvalId,
        toolName: "fs_write_file",
        targetPath: fileToWrite,
        action: "approved",
        approvedBy: "user",
        timestampMs: Date.now(),
      },
    });

    // ─────────────────────────────────────────────────────────────
    // PASO 5: Materialización en Canvas / Workspace
    // ─────────────────────────────────────────────────────────────
    // 1. El archivo se escribió efectivamente en el sistema de archivos real
    const writtenFilePath = path.join(workspaceDir, fileToWrite);
    const diskContent = await fs.readFile(writtenFilePath, "utf-8");
    expect(diskContent).toBe(serviceContent);

    // 2. Registrar el artefacto generado para el Canvas
    await adapter.put({
      namespace: `projects/${updatedProject.id}/artifacts`,
      key: "service_module",
      payload: {
        type: "code_file",
        path: fileToWrite,
        summary: "Módulo de servicio generado con healthCheck",
        lines: diskContent.split("\n").length,
        createdAtMs: Date.now(),
      },
    });

    // 3. Registrar el turno completado en el historial de sesión
    await lifecycle.syncTurnToDisk({
      sessionId: "sess_mvp_anchor",
      turnIndex: 1,
      userMessage: "Crea el módulo de servicio con la función healthCheck",
      assistantResponse: "Módulo creado exitosamente en src/service.ts tras recibir tu aprobación.",
      toolCalls: [
        {
          name: "fs_write_file",
          params: { path: fileToWrite },
          result: { success: true },
        },
      ],
    });

    // Cierre forzado del adaptador de memoria (simulando shutdown de la aplicación)
    await adapter.close();

    // ─────────────────────────────────────────────────────────────
    // PASO 6: Persistencia Multi-Día y Reanudación (Cold Reboot)
    // ─────────────────────────────────────────────────────────────
    const coldAdapter = new EgoMemoryAdapter(vdbDir);
    await coldAdapter.init();
    expect(coldAdapter.ready).toBe(true);

    const coldRegistry = new SubEgoRegistry(coldAdapter);

    // 1. El proyecto y sus metadatos se restauran idénticos
    const restoredProject = ((await coldAdapter.get("gov/projects", "proj_anchor_01"))?.payload as ProjectManifest);
    expect(restoredProject).not.toBeNull();
    expect(restoredProject.name).toBe("Proyecto Software Ancla");
    expect(restoredProject.activeSubEgoId).toBe("ego.code-reviewer");

    // 2. El Sub-Ego especialista se restaura intacto desde gov/sub_egos
    const restoredSpecialist = await coldRegistry.get("ego.code-reviewer");
    expect(restoredSpecialist).not.toBeNull();
    expect(restoredSpecialist?.name).toBe("Code Reviewer Specialist");
    expect(restoredSpecialist?.role).toBe("Especialista de Ingeniería y Auditoría");

    // 3. El archivo en disco permanece intacto
    const persistedFileContent = await fs.readFile(writtenFilePath, "utf-8");
    expect(persistedFileContent).toBe(serviceContent);

    // 4. El artefacto del Canvas persiste en el namespace del proyecto
    const restoredArtifact = ((await coldAdapter.get(
      `projects/${updatedProject.id}/artifacts`,
      "service_module"
    ))?.payload as { summary: string; path: string });
    expect(restoredArtifact).not.toBeNull();
    expect(restoredArtifact.path).toBe(fileToWrite);
    expect(restoredArtifact.summary).toContain("Módulo de servicio");

    // 5. El registro de auditoría HITL persiste en gov/audit
    const restoredAudit = ((await coldAdapter.get("gov/audit", `hitl:${approvalId}`))?.payload as {
      action: string;
      toolName: string;
    });
    expect(restoredAudit).not.toBeNull();
    expect(restoredAudit.action).toBe("approved");
    expect(restoredAudit.toolName).toBe("fs_write_file");

    await coldAdapter.close();
  });
});
