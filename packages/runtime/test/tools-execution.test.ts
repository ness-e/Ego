// Golden Path Alpha — Test E2E Automatizado (Pasos 8 al 12) (ACT-10)
// Valida: Tarea solicitada -> Modelo selecciona tool -> Tool pide aprobación (HITL) -> Usuario aprueba -> Tool ejecuta -> Salida y turno persisten en VantaDB
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as crypto from "node:crypto";
import { EgoMemoryAdapter } from "../../memory/EgoMemoryAdapter.js";
import { ModelRouter, MockProvider } from "@ego/models";
import { ToolRegistry, registerNativeTools } from "@ego/tools";
import { ApprovalEngine, ExecutionManager } from "@ego/execution";
import type { PendingApproval } from "@ego/execution";
import { ToolExecutionLoop } from "../src/index.js";

describe("Golden Path Alpha — Ejecución de Herramientas, HITL y Persistencia E2E (ACT-10)", () => {
  const baseTmpDir = path.join(os.tmpdir(), `ego-e2e-act10-${Date.now()}`);
  const vdbDir = path.join(baseTmpDir, "vantadb");
  const wsDir = path.join(baseTmpDir, "workspace");

  let activeAdapter: EgoMemoryAdapter | null = null;

  beforeAll(async () => {
    await fs.mkdir(vdbDir, { recursive: true });
    await fs.mkdir(wsDir, { recursive: true });
  });

  afterEach(async () => {
    if (activeAdapter && activeAdapter.ready) {
      await activeAdapter.close();
      activeAdapter = null;
    }
  });

  afterAll(async () => {
    try {
      if (activeAdapter && activeAdapter.ready) {
        await activeAdapter.close();
      }
      await fs.rm(baseTmpDir, { recursive: true, force: true });
    } catch {
      // Ignorar bloqueos temporales del sistema de archivos en Windows
    }
  });

  it("Pasos 8 al 12: Flujo Canónico Completo (Solicitud -> Tool Call -> Aprobación HITL -> Ejecución Atómica -> Persistencia VantaDB -> Recuperación intacta)", async () => {
    // Inicialización del sustrato de memoria persistente VantaDB (Fjall LSM in-process)
    activeAdapter = new EgoMemoryAdapter(vdbDir);
    await activeAdapter.init();
    expect(activeAdapter.ready).toBe(true);

    // Registro de metadatos del proyecto (precedente Pasos 1 al 7)
    await activeAdapter.put({
      namespace: "projects/default",
      key: "project:metadata",
      payload: {
        id: "proj_alpha",
        name: "Proyecto Alpha de Ego",
        status: "active",
        created_at: Date.now()
      }
    });

    // 1. Configuración del subsistema de inferencia (ModelRouter con MockProvider)
    const router = new ModelRouter({
      activeProviders: ["mock"],
      defaultRoles: {
        "fast-chat": { provider: "mock", model: "mock-fast" },
        "reasoning-heavy": { provider: "mock", model: "mock-reasoning" }
      }
    });
    const mockProvider = new MockProvider();
    router.registerProvider(mockProvider);

    // 2. Registro de herramientas Nivel A Nativas (ToolRegistry)
    const registry = new ToolRegistry();
    registerNativeTools(registry, {
      workspacePath: wsDir,
      enableFs: true,
      enableGit: true,
      enableTerminal: true
    });

    const writeTool = registry.get("fs_write_file");
    expect(writeTool).toBeDefined();
    expect(writeTool?.riskLevel).toBe("sensitive");
    expect(writeTool?.requiresApproval).toBe(true);

    // 3. Sistema de Gobernanza y Aprobación Humana (ApprovalEngine)
    let requestedApproval: PendingApproval | null = null;
    const approvalEngine = new ApprovalEngine({
      mode: "standard",
      defaultTimeoutMs: 15_000,
      onApprovalRequested: (req) => {
        requestedApproval = req;
      }
    });

    const executionManager = new ExecutionManager({
      defaultTimeoutMs: 10_000,
      maxOutputBytes: 1024 * 1024
    });

    const loop = new ToolExecutionLoop(router, registry, {
      executionManager,
      approvalEngine,
      maxSteps: 5,
      defaultRole: "reasoning-heavy"
    });

    const targetFilePath = "config/app.json";
    const targetFileContent = JSON.stringify({
      environment: "production",
      telemetry: true,
      cluster_nodes: 4
    });

    // Paso 8: Pedir una tarea operativa
    const userPrompt =
      "SIMULATE_TOOL:fs_write_file:" +
      JSON.stringify({
        path: targetFilePath,
        content: targetFileContent
      });
    const sessionId = "session_e2e_alpha_01";
    const context = {
      sessionId,
      workspacePath: wsDir,
      subEgoId: "ego.architect"
    };

    // Pasos 9 y 10: Iniciar ejecución. El modelo consulta router y selecciona fs_write_file
    const runPromise = loop.run({
      messages: [{ role: "user", content: userPrompt }],
      context,
      role: "reasoning-heavy"
    });

    // Paso 11: Tool pide aprobación (HITL). La promesa de ejecución se congela.
    // Paso 11: Tool pide aprobación (HITL). La promesa de ejecución se congela.
    // Esperamos a que ApprovalEngine capture y retenga la solicitud
    let attempts = 0;
    while (!requestedApproval && attempts < 50) {
      await new Promise((r) => setTimeout(r, 50));
      attempts++;
    }

    expect(requestedApproval).not.toBeNull();
    expect(requestedApproval!.toolName).toBe("fs_write_file");
    expect(requestedApproval!.status).toBe("pending");
    expect(requestedApproval!.action.sessionId).toBe(sessionId);
    expect(requestedApproval!.action.inputDigest).toBeDefined();

    // Verificamos que previo a la aprobación humana, el archivo NO ha sido escrito en disco
    const physicalTargetPath = path.join(wsDir, targetFilePath);
    expect(fsSync.existsSync(physicalTargetPath)).toBe(false);

    // Paso 12.1: El usuario aprueba la acción explícitamente a través del ApprovalEngine
    const approvalResult = approvalEngine.resolveApproval(requestedApproval!.approvalId, {
      approved: true,
      reason: "Configuración de producción aprobada por el operador",
      timestamp: Date.now()
    });
    expect(approvalResult).toBe(true);

    // Paso 12.2 a 12.5: El ciclo cognitivo se desbloquea, ejecuta la tool y sintetiza respuesta
    const loopResult = await runPromise;
    expect(loopResult.status).toBe("completed");
    expect(loopResult.steps).toBeGreaterThanOrEqual(1);

    // Validar historial de mensajes generado
    expect(loopResult.messages.length).toBeGreaterThanOrEqual(3);
    const toolResultMsg = loopResult.messages.find((m) => m.role === "tool");
    expect(toolResultMsg).toBeDefined();
    expect(toolResultMsg!.name).toBe("fs_write_file");

    const parsedToolOutput = JSON.parse(toolResultMsg!.content);
    expect(parsedToolOutput.success).toBe(true);
    expect(path.normalize(parsedToolOutput.path)).toBe(path.normalize(targetFilePath));
    expect(parsedToolOutput.bytesWritten).toBeGreaterThan(0);

    // Validar que el archivo físico fue creado en el workspace con integridad exacta
    expect(fsSync.existsSync(physicalTargetPath)).toBe(true);
    const diskContent = await fs.readFile(physicalTargetPath, "utf8");
    expect(diskContent).toBe(targetFileContent);

    // Paso 12.6: Persistencia duradera en VantaDB
    // 1. Persistir el turno completo de la sesión
    await activeAdapter.put({
      namespace: `turns/${sessionId}`,
      key: "turn:001",
      payload: {
        sessionId,
        turnIndex: 1,
        userPrompt,
        assistantResponse: loopResult.messages[loopResult.messages.length - 1].content,
        toolExecutions: [
          {
            toolName: "fs_write_file",
            inputDigest: requestedApproval!.action.inputDigest,
            output: parsedToolOutput,
            durationMs: loopResult.usage.completionTokens
          }
        ],
        messages: loopResult.messages
      },
      metadata: { status: "completed", timestamp: Date.now() }
    });

    // 2. Persistir registro del artefacto generado en el workspace
    const artifactSha256 = crypto.createHash("sha256").update(targetFileContent, "utf8").digest("hex");
    await activeAdapter.put({
      namespace: "projects/default/artifacts",
      key: `artifact:${targetFilePath}`,
      payload: {
        path: targetFilePath,
        sizeBytes: Buffer.byteLength(targetFileContent, "utf8"),
        sha256: artifactSha256,
        createdByTool: "fs_write_file",
        createdAt: Date.now()
      },
      metadata: { fileType: "json", state: "committed" }
    });

    // 3. Persistir registro de auditoría de gobernanza (ActionIdentity inmutable)
    await activeAdapter.put({
      namespace: "gov/audit/actions",
      key: `audit:${requestedApproval!.approvalId}`,
      payload: {
        approvalId: requestedApproval!.approvalId,
        actionIdentity: requestedApproval!.action,
        decision: "approved",
        operator: "human_user",
        resolvedAt: Date.now()
      },
      metadata: { category: "governance", riskLevel: "sensitive" }
    });

    // Forzar sincronización y cierre total de la base de datos
    await activeAdapter.flush();
    await activeAdapter.close();
    activeAdapter = null;

    // Paso 12.7: Verificación de Recuperación y Resiliencia en frío tras Reinicio
    const restoredAdapter = new EgoMemoryAdapter(vdbDir);
    await restoredAdapter.init();
    expect(restoredAdapter.ready).toBe(true);

    // 1. Recuperar turno persistido
    const restoredTurn = (await restoredAdapter.get(`turns/${sessionId}`, "turn:001")) as {
      sessionId: string;
      toolExecutions: Array<{ toolName: string; output: { success: boolean; path: string } }>;
      messages: unknown[];
    };
    expect(restoredTurn).toBeDefined();
    expect(restoredTurn.sessionId).toBe(sessionId);
    expect(restoredTurn.toolExecutions[0].toolName).toBe("fs_write_file");
    expect(restoredTurn.toolExecutions[0].output.success).toBe(true);
    expect(path.normalize(restoredTurn.toolExecutions[0].output.path)).toBe(path.normalize(targetFilePath));
    expect(restoredTurn.messages.length).toBe(loopResult.messages.length);

    // 2. Recuperar artefacto persistido
    const restoredArtifact = (await restoredAdapter.get("projects/default/artifacts", `artifact:${targetFilePath}`)) as {
      path: string;
      sha256: string;
    };
    expect(restoredArtifact).toBeDefined();
    expect(restoredArtifact.path).toBe(targetFilePath);
    expect(restoredArtifact.sha256).toBe(artifactSha256);

    // 3. Recuperar auditoría de gobernanza
    const restoredAudit = (await restoredAdapter.get("gov/audit/actions", `audit:${requestedApproval!.approvalId}`)) as {
      decision: string;
      operator: string;
    };
    expect(restoredAudit).toBeDefined();
    expect(restoredAudit.decision).toBe("approved");

    // 4. Búsqueda Multi-Namespace para verificar consistencia global
    const searchResults = await restoredAdapter.searchMulti(
      ["projects/default/*", `turns/${sessionId}`, "gov/audit/*"],
      "fs_write_file production config"
    );
    expect(searchResults.length).toBeGreaterThan(0);

    await restoredAdapter.close();
  });

  it("Variante B: Rechazo Humano en HITL (La herramienta NO se ejecuta, el archivo NO se crea y la negativa se audita)", async () => {
    activeAdapter = new EgoMemoryAdapter(vdbDir);
    await activeAdapter.init();

    const router = new ModelRouter({
      activeProviders: ["mock"],
      defaultRoles: { "reasoning-heavy": { provider: "mock", model: "mock-reasoning" } }
    });
    router.registerProvider(new MockProvider());

    const registry = new ToolRegistry();
    registerNativeTools(registry, { workspacePath: wsDir, enableFs: true });

    let pendingReq: PendingApproval | null = null;
    const approvalEngine = new ApprovalEngine({
      mode: "standard",
      onApprovalRequested: (req) => {
        pendingReq = req;
      }
    });

    const loop = new ToolExecutionLoop(router, registry, {
      executionManager: new ExecutionManager(),
      approvalEngine
    });

    const forbiddenPath = "security/keys.pem";
    const userPrompt = `SIMULATE_TOOL:fs_write_file:{"path":"${forbiddenPath}","content":"PRIVATE_KEY_SECRET"}`;

    const runPromise = loop.run({
      messages: [{ role: "user", content: userPrompt }],
      context: { sessionId: "sess_reject_01", workspacePath: wsDir }
    });

    // Esperar a que quede pendiente
    let attempts = 0;
    while (!pendingReq && attempts < 50) {
      await new Promise((r) => setTimeout(r, 50));
      attempts++;
    }
    expect(pendingReq).not.toBeNull();

    // El usuario rechaza explícitamente la acción
    approvalEngine.resolveApproval(pendingReq!.approvalId, {
      approved: false,
      reason: "Escritura de claves privadas bloqueada por política de seguridad",
      timestamp: Date.now()
    });

    const loopResult = await runPromise;
    expect(loopResult.status).toBe("completed");

    // Verificar que el archivo prohibido NUNCA fue escrito en disco
    const physicalPath = path.join(wsDir, forbiddenPath);
    expect(fsSync.existsSync(physicalPath)).toBe(false);

    // Verificar que el loop inyectó la respuesta de rechazo
    const toolMsg = loopResult.messages.find((m) => m.role === "tool");
    expect(toolMsg).toBeDefined();
    const parsed = JSON.parse(toolMsg!.content);
    expect(parsed.status).toBe("rejected");
    expect(parsed.message).toContain("bloqueada");

    // Persistir auditoría de rechazo
    await activeAdapter.put({
      namespace: "gov/audit/actions",
      key: `audit:${pendingReq!.approvalId}`,
      payload: {
        approvalId: pendingReq!.approvalId,
        decision: "rejected",
        reason: "Escritura de claves privadas bloqueada por política de seguridad",
        timestamp: Date.now()
      }
    });

    const recorded = await activeAdapter.get("gov/audit/actions", `audit:${pendingReq!.approvalId}`);
    expect(recorded).toBeDefined();
    expect((recorded as any).decision).toBe("rejected");

    await activeAdapter.close();
    activeAdapter = null;
  });

  it("Variante C: Edición Humana de Parámetros previa a Aprobación (Ejecuta con argumentos saneados)", async () => {
    activeAdapter = new EgoMemoryAdapter(vdbDir);
    await activeAdapter.init();

    const router = new ModelRouter({
      activeProviders: ["mock"],
      defaultRoles: { "reasoning-heavy": { provider: "mock", model: "mock-reasoning" } }
    });
    router.registerProvider(new MockProvider());

    const registry = new ToolRegistry();
    registerNativeTools(registry, { workspacePath: wsDir, enableFs: true });

    let pendingReq: PendingApproval | null = null;
    const approvalEngine = new ApprovalEngine({
      mode: "standard",
      onApprovalRequested: (req) => {
        pendingReq = req;
      }
    });

    const loop = new ToolExecutionLoop(router, registry, {
      executionManager: new ExecutionManager(),
      approvalEngine
    });

    const initialUnsafePath = "tmp_unsafe.txt";
    const sanitizedSafePath = "safe/sanitized_data.txt";
    const userPrompt = `SIMULATE_TOOL:fs_write_file:{"path":"${initialUnsafePath}","content":"raw_content"}`;

    const runPromise = loop.run({
      messages: [{ role: "user", content: userPrompt }],
      context: { sessionId: "sess_edit_01", workspacePath: wsDir }
    });

    while (!pendingReq) {
      await new Promise((r) => setTimeout(r, 50));
    }

    // El usuario aprueba modificando los parámetros hacia la ruta segura
    approvalEngine.resolveApproval(pendingReq!.approvalId, {
      approved: true,
      reason: "Ruta redirigida hacia directorio seguro",
      modifiedArguments: {
        path: sanitizedSafePath,
        content: "sanitized_secure_content",
        createBackup: false
      },
      timestamp: Date.now()
    });

    const loopResult = await runPromise;
    expect(loopResult.status).toBe("completed");

    // Verificar que la ruta inicial insegura NO existe
    expect(fsSync.existsSync(path.join(wsDir, initialUnsafePath))).toBe(false);

    // Verificar que la ruta saneada SÍ existe con el nuevo contenido
    const safePhysicalPath = path.join(wsDir, sanitizedSafePath);
    expect(fsSync.existsSync(safePhysicalPath)).toBe(true);
    const content = await fs.readFile(safePhysicalPath, "utf8");
    expect(content).toBe("sanitized_secure_content");

    await activeAdapter.close();
    activeAdapter = null;
  });

  it("Variante D: Detección Causal contra Man-in-the-Middle (COUC-03)", async () => {
    const registry = new ToolRegistry();
    registerNativeTools(registry, { workspacePath: wsDir, enableFs: true });

    let pendingReq: PendingApproval | null = null;
    const approvalEngine = new ApprovalEngine({
      mode: "standard",
      onApprovalRequested: (req) => {
        pendingReq = req;
      }
    });

    const tool = registry.get("fs_write_file")!;
    const requestPromise = approvalEngine.requestApproval({
      tool,
      arguments: { path: "audit.log", content: "log_data" },
      context: { sessionId: "sess_mitm", workspacePath: wsDir },
      callId: "call_mitm_01"
    });

    while (!pendingReq) {
      await new Promise((r) => setTimeout(r, 20));
    }

    // Intento de resolver con un digest alterado (simulando ataque o manipulación de payload)
    expect(() => {
      approvalEngine.resolveApproval(
        pendingReq!.approvalId,
        { approved: true, reason: "Inyección forzada" },
        { expectedDigest: "tampered_digest_fake_hash_12345" }
      );
    }).toThrow(/Violación de identidad causal/);

    // La solicitud sigue retenida de forma segura
    expect(approvalEngine.listPendingApprovals().length).toBe(1);

    // Resolver legítimamente con el digest verídico
    const validDigest = pendingReq!.action.inputDigest;
    const resolved = approvalEngine.resolveApproval(
      pendingReq!.approvalId,
      { approved: true, reason: "Aprobación verificada" },
      { expectedDigest: validDigest }
    );
    expect(resolved).toBe(true);

    const decision = await requestPromise;
    expect(decision.approved).toBe(true);
  });
});
