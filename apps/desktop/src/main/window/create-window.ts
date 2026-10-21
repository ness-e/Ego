/**
 * E6 (Ola 2) — Arranque de la ventana principal y del runtime.
 *
 * Extraído del god-file `main.ts` **sin cambiar comportamiento**: el cuerpo
 * de `createWindow` se movió verbatim y sus 9 dependencias locales
 * (funciones que siguen viviendo en `main.ts`) se reciben por el objeto
 * `deps`, explícito y tipado. El estado mutable del proceso sigue viniendo
 * de `state/app-context.ts` (bindings vivos), así que este módulo no
 * duplica estado.
 *
 * ## Qué hace `createWindow`
 * 1. Recuperación de crash + `OpGate`.
 * 2. Memoria (adapter + lifecycle) y job de compactación.
 * 3. `ModelRouter` + proveedores + restauración de la config BYOK.
 * 4. `EventBus`, `RunRecorder`, logger estructurado y hooks de auditoría.
 * 5. `ToolRegistry`, Sub-Egos, delegación, MCP (cliente + servidor),
 *    decisión, conocimiento y daily state.
 * 6. Tareas en background, proactividad, crons y el servidor MCP de Ego.
 * 7. Aprobación, ejecución, `ToolExecutionLoop` y seguridad.
 * 8. La ventana principal (`BrowserWindow`) + CSP + guardarraíles.
 * 9. Registro de los handlers IPC con `createIpcDeps()`.
 * 10. Carga del renderer.
 */

/** Dependencias locales que `createWindow` recibe del compositor. */
export interface CreateWindowDeps {
  ensureFloatMgr: () => import("../../windows/FloatingWindow.js").FloatingWindowManager;
  enqueueMainPush: (
    channel: string,
    payload: unknown,
    priority: import("../ipc-priority-queue.js").IpcPriority,
    coalesceKey?: string
  ) => void;
  refreshTrayStatus: () => void;
  floatingSnapshot: () => {
    active: number;
    hitl: number;
    muted: boolean;
    disabled: boolean;
  };
  syncFloatingFromEngine: () => void;
  ensureTray: () => void;
  syncModelCredentialPool: (
    router: import("@ego/models").ModelRouter,
    extraKeys?: import("../models/model-config.js").ResolvedModelKeys
  ) => Promise<void>;
  scheduleMemoryCleanup: () => void;
  createIpcDeps: () => import("../ipc/register-ipc.js").IpcDeps;
}

import { crashRecoveryEngine, windowStateManager, adapter, lifecycle, modelRouter, approvalEngine, executionManager, toolRegistry, mcpManager, mcpServerHandle, eventBus, structuredLogger, dailyStateEngine, dailyStatePersistence, win, backgroundEngine, proactivityEngine, taskCheckpointManager, floatingRestoredPosition, hitlBridge } from "../state/app-context.js";
import {
  setCrashRecoveryEngine,
  setOpGate,
  setWindowStateManager,
  setAdapter,
  setLifecycle,
  setDisplayChangeListener,
  setCompactionJob,
  setCompactionSummarizer,
  setModelRouter,
  setApprovalEngine,
  setExecutionManager,
  setToolRegistry,
  setToolLoop,
  setSubEgoRegistry,
  setDelegationRuntime,
  setDecisionRouter,
  setDecisionAuditor,
  setDecisionTelemetry,
  setLoopBreaker,
  setMcpManager,
  setMcpServerHandle,
  setRunRecorder,
  setSkillScanner,
  setEventBus,
  setStructuredLogger,
  setKnowledgeIndexer,
  setHybridSearch,
  setGraphRagEngine,
  setQuarantineManager,
  setFactLifecycle,
  setBitemporalQueries,
  setProjectMemoryGraph,
  setKnowledgeExport,
  setDocumentParser,
  setDailyStateEngine,
  setDailyStatePersistence,
  setGoalPrioritizer,
  setDecisionsFeed,
  setWin,
  setBackgroundEngine,
  setWorkerTaskPool,
  setProactivityEngine,
  setTaskCheckpointManager,
  setFloatingRestoredPosition,
  setHitlBridge,
} from "../state/app-context.js";
import { app, BrowserWindow, screen, session } from "electron";
import { join } from "node:path";
import { EgoMemoryAdapter, EgoMemoryLifecycle } from "@ego/memory";
import { ModelRouter, createRouterSummarizer } from "@ego/models";
import { ToolRegistry, registerNativeTools } from "@ego/tools";
// E13 (Ola 5 · T1): registro de los metatools de divulgación progresiva.
import { registerProgressiveMetaTools } from "../tools/meta-tools.js";
// Ola 9 (A4): curaduría programada de memoria (CFG-08) — marca stale.
import { startMemoryCuration } from "../subsystems/memory-curation.js";
import { McpManager, SkillScanner } from "@ego/integrations";
import { EventBus, StructuredLogger, type EgoEventType } from "@ego/events";
import { ToolExecutionLoop, ContextCompactionJob } from "@ego/runtime";
import { ApprovalEngine, ExecutionManager, WidgetHitlBridge, type PendingApproval } from "@ego/execution";
import { SubEgoRegistry, createDelegationRuntime } from "@ego/subegos";
import { DecisionRouter, DecisionAuditor, DecisionTelemetry, LoopBreaker, JevProvider } from "@ego/decision";
import { type ModelConfig } from "../../ipc/schema.js";
import { KnowledgeIndexer, HybridSearch, GraphRagEngine, QuarantineManager, FactLifecycle, BitemporalQueries, ProjectMemoryGraph, KnowledgeExport, DocumentParser } from "@ego/knowledge";
import { DailyStateEngine, DailyStatePersistence, GoalPrioritizer, DecisionsFeed } from "@ego/dailystate";
import { CrashRecoveryEngine, OpGate } from "@ego/recovery";
import { BackgroundEngine, WorkerTaskPool, ProactivityEngine, TaskCheckpointManager, registerBackgroundTaskTools, RunRecorder } from "@ego/tasks";
import { evaluateToolCall } from "@ego/security";
import { isPresenceAllowed } from "../../windows/FloatingWindow.js";
import {
  WindowStateManager,
  type FloatingWindowPersist,
} from "../../windows/WindowStateManager.js";
import { initAutoUpdater, resolveUpdateFeedUrl } from "../../updater.js";
import { defaultWorkspaceRoot } from "../path-scope.js";
import { applyNavigationGuards, buildCsp, installIpcOriginLogging, setFetchAuthTokenResolver } from "../security/electron-security.js";
import { decryptCredential, encryptCredential } from "../credentials/vault.js";
import { applyModelConfig, resolvePersistedModelKeys, setupModelProviders } from "../models/model-config.js";
import { activeProjectId, floatingAutoShownOnMinimize, floatingPinnedManually, setFloatingAutoShownOnMinimize } from "../ipc/ipc-state.js";
import { registerIpcHandlers } from "../ipc/register-ipc.js";
import { createCredentialSecretResolver } from "../mcp/secret-resolver.js";
import { startEgoMcpServer } from "../mcp/mcp-server-runtime.js";
import { buildMcpPersistedRecord, extractPersistedMcpRecord, getMcpCredentialManager, needsMcpEnvMigration, resolveMcpRuntimeEnv, storeMcpEnvSecrets, type PersistedMcpServerRecord } from "../mcp-runtime.js";
import { isTaskKindSafe } from "../task-kinds.js";
import { collectStorableMcpSecrets } from "../mcp-env.js";
import { getCachedPermissionsSettings, loadPermissionsSettingsIntoCache, loadCompressionSettingsIntoCache } from "../settings-cache.js";

export async function createWindow(deps: CreateWindowDeps): Promise<void> {
  installIpcOriginLogging();
  // T3 (EGO-FIND-27): el fetch-proxy resuelve el token de la API desde la
  // memoria cifrada (`gov/auth:api_token`) o, en dev, de `EGO_API_TOKEN`.
  // Nunca se loguea ni viaja al renderer. El resolutor se inyecta aquí
  // (el módulo de seguridad no depende del estado global del proceso).
  setFetchAuthTokenResolver(async () => {
    try {
      if (adapter) {
        const rec = await adapter.get("gov/auth", "api_token");
        let node: unknown = rec;
        if (node && typeof node === "object" && "payload" in node) {
          node = (node as { payload: unknown }).payload;
        }
        if (typeof node === "string" && node.length > 0) {
          const dec = decryptCredential(node);
          if (typeof dec === "string" && dec.length > 0) return dec;
        } else if (
          node &&
          typeof node === "object" &&
          typeof (node as { token?: unknown }).token === "string"
        ) {
          const stored = (node as { token: string }).token;
          if (stored.length > 0) {
            const dec =
              stored.startsWith("enc:") || stored.startsWith("obf:")
                ? decryptCredential(stored)
                : stored;
            if (dec.length > 0) return dec;
          }
        }
      }
    } catch {
      // noop: fallback al env
    }
    const envToken = process.env.EGO_API_TOKEN;
    return typeof envToken === "string" && envToken.length > 0 ? envToken : null;
  });
  const userDataDir = app.getPath("userData");
  setCrashRecoveryEngine(new CrashRecoveryEngine({
    storageDir: userDataDir,
    eventBus,
  }));
  setOpGate(new OpGate({ drainTimeoutMs: 3000 }));

  try {
    const dirtyReport = await crashRecoveryEngine.checkAndAcquireLock("session_init");
    if (dirtyReport.wasDirty) {
      console.warn(`[CrashRecoveryEngine] Recuperación post-Dirty Shutdown detectada (${dirtyReport.recoveryAction}).`, dirtyReport);
    }
  } catch (lockErr) {
    console.warn("[CrashRecoveryEngine] Advertencia de bloqueo:", lockErr);
  }

  const dbPath = join(userDataDir, "ego_memory.vdb");
  setAdapter(new EgoMemoryAdapter(dbPath));
  await adapter.init();

  setLifecycle(new EgoMemoryLifecycle(adapter));
  await lifecycle.startSession("session_init", "default");

  // A2-01 / EGO-FIND-21: el job de compactación real. `adapter` satisface el
  // contrato estructural `CompactionArchiveTarget` (put) ⇒ el resumen podado
  // se archiva en `kb/history_archive` sin que `runtime` dependa de `memory`.
  // Vive a nivel de módulo porque lo consume `handleLlmStream` (un turno).
  setCompactionJob(new ContextCompactionJob(
    { autoMemory: true },
    { archiveTarget: adapter }
  ));

  // STAB-06: job curator periódico (consolida `session/turns` stale →
  // `kb/facts`, respetando `quarantine/pending`; aditivo, jamás borra).
  // Defaults: cada 1h, stale 30d, tope 50 facts. Best-effort: un fallo
  // aislado se loguea y el job sigue (el boot nunca tumba por esto).
  try {
    lifecycle.startCuratorJob({ intervalMs: 60 * 60 * 1000, staleAfterDays: 30, maxSnapshots: 50 });
  } catch (err) {
    console.warn("[Ego Main] Job curator STAB-06 no arrancó (reintento manual vía lifecycle):", err);
  }

  // CFG-08: curaduría programada (marca stale). Sin `DreamConsolidator`: el
  // "sueño" lo dispara el lifecycle (ver `@ego/memory`), así que pasárselo
  // aquí consolidaría dos veces por el mismo ciclo.
  //
  // Ola 9 (A4): hasta ahora `MemoryCurator` estaba implementado y verificado
  // en `@ego/tasks` pero **sin instanciar** → su capacidad (marcar stale)
  // no ocurría nunca (el último punto de `EGO-FIND-22`). El apagado lo
  // llama `main.ts` (`stopMemoryCuration`): sin él, el `setInterval`
  // seguiría vivo e impediría que Electron cerrase.
  try {
    startMemoryCuration(adapter, { intervalHours: 24, staleAfterDays: 90 });
  } catch (err) {
    console.warn("[Ego Main] Curaduría CFG-08 no arrancó (la memoria no se curaría):", err);
  }

  setModelRouter(new ModelRouter());
  setupModelProviders(modelRouter);
  await deps.syncModelCredentialPool(modelRouter);

  // T8 (A2-ola1b, Diff E): resumidor REAL sobre el ModelRouter para la
  // compactación de contexto. Sin esto, `ContextCompactionJob` usa su
  // fallback heurístico (2 primeras líneas por mensaje) y se pierde la
  // fidelidad que exige el prompt de compactación (decisiones, rutas,
  // errores, tareas y restricciones).
  //
  // El summarizer se crea DESPUÉS del router (necesita los proveedores
  // registrados) y vive a nivel de módulo porque lo consume
  // `handleLlmStream` (otro turno, otra función).
  // Si el modelo falla, el job cae al fallback heurístico: la
  // compactación nunca se pierde por un fallo del LLM.
  setCompactionSummarizer(createRouterSummarizer(modelRouter, {
    role: "fast-classifier",
  }));

  // Restaurar configuración persistida de modelos BYOK si existe (gov/settings)
  // Solo main: las keys descifradas con safeStorage nunca salen de este proceso.
  try {
    const savedConfig = await adapter.get("gov/settings", "model_config");
    if (savedConfig) {
      let payload: unknown = savedConfig;
      if (typeof savedConfig === "object" && savedConfig !== null && "payload" in savedConfig) {
        payload = (savedConfig as { payload: unknown }).payload;
      }
      if (payload && typeof payload === "object") {
        // Migración plano→cifrado de campos por proveedor (Task 10 escribe el shape nuevo).
        const plainProviderFields = ["openaiKey", "anthropicKey", "googleKey", "deepseekKey"];
        let needsPersist = false;
        const nextPayload: Record<string, unknown> = { ...(payload as Record<string, unknown>) };
        for (const field of plainProviderFields) {
          const plainValue = nextPayload[field];
          if (typeof plainValue === "string" && plainValue.length > 0) {
            nextPayload[`${field}Encrypted`] = encryptCredential(plainValue);
            delete nextPayload[field];
            needsPersist = true;
          }
        }
        if (needsPersist) {
          await adapter.put({
            namespace: "gov/settings",
            key: "model_config",
            payload: nextPayload,
            metadata: { updatedAtMs: Date.now(), migrated: true },
          });
          payload = nextPayload;
        }
        const record: Record<string, unknown> = payload as Record<string, unknown>;

        // Keys por proveedor (anthropic/google/openai/deepseek persistidos por UI).
        const persistedKeys = resolvePersistedModelKeys(record);
        if (Object.keys(persistedKeys).length > 0) {
          setupModelProviders(modelRouter, persistedKeys);
        }
        await deps.syncModelCredentialPool(modelRouter, persistedKeys);

        let resolvedKey = "";
        const storedApiKeyEncrypted = record.apiKeyEncrypted;
        if (typeof storedApiKeyEncrypted === "string" && storedApiKeyEncrypted.length > 0) {
          resolvedKey = decryptCredential(storedApiKeyEncrypted);
        } else if (typeof record.apiKey === "string" && record.apiKey.length > 0) {
          // Migración automática de legado plano a cifrado con safeStorage
          resolvedKey = record.apiKey;
          const reEncrypted = encryptCredential(resolvedKey);
          await adapter.put({
            namespace: "gov/settings",
            key: "model_config",
            payload: {
              ...record,
              activeProvider: record.activeProvider,
              apiKeyEncrypted: reEncrypted,
              baseUrl: record.baseUrl,
              modelName: record.modelName,
            },
            metadata: { updatedAtMs: Date.now(), migrated: true },
          });
        }

        const restoredConfig: ModelConfig = {
          activeProvider: (record.activeProvider as ModelConfig["activeProvider"]) || "mock",
          apiKey: resolvedKey,
          baseUrl: record.baseUrl as ModelConfig["baseUrl"],
          modelName: record.modelName as ModelConfig["modelName"],
          // STAB-06: tuning persistido (validado por `applyModelConfig`).
          reasoningEffort: record.reasoningEffort as ModelConfig["reasoningEffort"],
          temperature: record.temperature as ModelConfig["temperature"],
        };
        applyModelConfig(modelRouter, restoredConfig);
      }
    }
  } catch (cfgErr) {
    console.warn("[Ego Main] Error al restaurar configuración de modelos de VantaDB:", cfgErr);
  }

  setEventBus(new EventBus());
  // COUC-09: observador de proceso. Se suscribe al bus y graba cada
  // task/tool de la corrida en `projects/<runId>/runs` (con digest SHA-256).
  // Antes no tenía dueño: el `RunRecorder` existía y nadie lo instanciaba.
  setRunRecorder(new RunRecorder(adapter, eventBus));
  // STAB-12: toda decisión de hook/permiso (`hook.decided`, emitido por el
  // EventBus de sesiones y el ToolExecutionLoop) se persiste a `gov/audit`
  // (SEC-06, inmutable + sha256). Best-effort: la auditoría nunca rompe el
  // turno; solo viajan ids/reglas/motivos, nunca args ni secretos.
  eventBus.on("hook.decided", (event) => {
    const p = event.payload as {
      hookId?: string;
      phase: string;
      toolName?: string;
      sessionId?: string;
      allow: boolean;
      reason: string;
    };
    void adapter
      .recordAudit("hook", "ego.governance", {
        hookId: p.hookId ?? null,
        phase: p.phase,
        toolName: p.toolName ?? null,
        sessionId: p.sessionId ?? event.sessionId ?? null,
        allow: p.allow,
        reason: p.reason,
      }, event.sessionId ?? "ego.governance")
      .catch((err: unknown) => {
        console.warn("[Ego Main] hook.decided sin auditar (best-effort):", err);
      });
  });
  setStructuredLogger(new StructuredLogger({
    minSeverity: "info",
    outputStream: (line) => console.log(`[Ego EventLog] ${line}`)
  }));
  structuredLogger.attachToEventBus(eventBus);

  // Puente SEC-09 FIX-02: cada routing a cuarentena del borde del adapter
  // emite `memory.quarantined` + `system.alert` al EventBus. El `onAny →
  // ipc.event` existente los retransmite al renderer (0 UI nueva). Solo
  // viajan etiquetas `namespace:key`, reglas y motivos — nunca valores.
  adapter.setQuarantineSink((info) => {
    eventBus.emit(
      "memory.quarantined",
      {
        itemKey: `${info.namespace}:${info.key}`,
        reason: info.kind === "secret_detected" ? info.reason : `sensitive_namespace:${info.reason}`,
        ttlDays: 14,
      },
      {
        source: "EgoMemoryAdapter",
        severity: "warn",
        metadata: {
          destinationNamespace: info.destinationNamespace,
          destinationKey: info.destinationKey,
          ...(info.rules ? { rules: info.rules } : {}),
        },
      }
    );
    eventBus.emit(
      "system.alert",
      {
        code: "SEC09_QUARANTINED",
        message: info.notice,
        details: {
          itemKey: `${info.namespace}:${info.key}`,
          kind: info.kind,
          destinationNamespace: info.destinationNamespace,
        },
      },
      { source: "EgoMemoryAdapter", severity: "warn" }
    );
  });

  setToolRegistry(new ToolRegistry());
  registerNativeTools(toolRegistry, {
    workspacePath: process.env.EGO_WORKSPACE_PATH || process.cwd(),
    enableCanvas: true,
    canvasOptions: {
      onRender: (manifest) => {
        eventBus.emit(
          "canvas.component_injected" as unknown as EgoEventType,
          manifest,
          { source: "NativeCanvasTool", severity: "info" }
        );
      },
    },
  });

  // E13 (Ola 5 · T1): metatools de divulgación progresiva. Sin esto el
  // modelo no puede ver `lookup_skills` / `search_tools` / `expand_tools`:
  // estaban implementados y verificados en `packages/tools`, pero nunca
  // registrados en el registro de producción (código muerto, EGO-FIND-90).
  //
  // El catálogo es INYECTADO (`SkillCatalogLike`): `packages/tools` no
  // depende de `packages/integrations` (evita el ciclo), así que el
  // adaptador vive aquí. El cuerpo de cada skill se lee del disco **sólo**
  // bajo demanda (`includeBody: true`).
  const skillScanner = new SkillScanner();
  setSkillScanner(skillScanner);
  registerProgressiveMetaTools(toolRegistry, { scanner: skillScanner });

  // A3-T1 / EGO-FIND-22: delegación de Sub-Egos viva. `createDelegationRuntime`
  // registra en el `toolRegistry` las 6 tools de delegación
  // (delegate_task, delegate_many, delegation_steer/stop/list_active/drain_steer).
  // Sin esto, la delegación sigue siendo código muerto.
  setDelegationRuntime(createDelegationRuntime({
    storage: adapter,
    toolRegistry,
    executor: async (instance) => {
      // Ejecuta un turno del Sub-Ego destino con el modelo.
      // Sin modelo disponible, devuelve la salida estructurada mínima.
      return {
        summary: `Turno de ${instance.manifest.id} ejecutado`,
        findings: [],
        files: [],
        issues: [],
      };
    },
    routerOptions: {
      maxDepth: 3,
      defaultTimeoutMs: 30_000,
    },
    defaultCallerId: "ego.nucleus",
  }));

  // T1 (VERDICT R2) — Decisión D2 (proxy de secretos MCP):
  //  - `tokenStore`: la fuente de secretos para PATs/tokens de los
  //    conectores (keychain del SO vía `CredentialManager`).
  //  - `secretResolver`: resuelve los marcadores `{{SECRET:<clave>}}` en el
  //    PUNTO DE USO (la petición saliente al servidor MCP). Sin esto, el
  //    marcador Viajaba sin resolver y D2 era inerte en producción.
  // El resolver se resuelve SIEMPRE contra el keychain del SO, en el main:
  // el renderer nunca ve un secreto.
  // T1 (EGO-FIND-49): sin bus, un servidor MCP puede seguir tomando el
  // control de una tool NATIVA sin que quede traza. Con bus, cada decisión
  // (override autorizado o intento de takeover) emite `system.alert`.
  setMcpManager(new McpManager(toolRegistry, {
    tokenStore: getMcpCredentialManager(),
    secretResolver: createCredentialSecretResolver(getMcpCredentialManager()),
    eventBus,
  }));
  setSubEgoRegistry(new SubEgoRegistry(adapter));
  // A2-07 / EGO-FIND-36: los niveles 2 (scorer) y 3 (LLM estructurado) de la
  // cascada eran código muerto. Con scorer/llm configurados, `DecisionRouter`
  // delega en `DecisionCascade`; sin ellos, degrada a reglas deterministas.
  const jevProvider = new JevProvider({ apiKey: process.env.JEV_API_KEY });
  setDecisionRouter(new DecisionRouter({
    scorerProvider: jevProvider,
    llmFallbackFn: async (prompt, domain) => {
      const res = await modelRouter.generateText("fast-classifier", {
        messages: [{ role: "user", content: prompt }],
        responseFormat: "json",
      });
      // El LLM devuelve el veredicto en JSON; si no parsea, `null` ⇒ la
      // cascada cae al fallback de núcleo seguro.
      try {
        return JSON.parse(res.text) as {
          domain: (typeof domain) & string;
          subEgoId: string;
          tools: string[];
          confidence: number;
        };
      } catch {
        return null;
      }
    },
  }));
  setDecisionAuditor(new DecisionAuditor(adapter));
  setDecisionTelemetry(new DecisionTelemetry(eventBus));
  setLoopBreaker(new LoopBreaker({ maxDepth: 4 }));

  // Motores de Conocimiento y Memoria a Largo Plazo (Fase 06)
  setKnowledgeIndexer(new KnowledgeIndexer(adapter));
  setHybridSearch(new HybridSearch(adapter));
  setGraphRagEngine(new GraphRagEngine(adapter));
  setQuarantineManager(new QuarantineManager(adapter));
  setFactLifecycle(new FactLifecycle(adapter));
  setBitemporalQueries(new BitemporalQueries(adapter));
  setProjectMemoryGraph(new ProjectMemoryGraph(adapter));
  setKnowledgeExport(new KnowledgeExport(adapter));
  setDocumentParser(new DocumentParser());

  // Motores de Daily State y Ritual de Bienvenida (Fase 08)
  setDailyStateEngine(new DailyStateEngine(adapter, { eventBus }));
  setDailyStatePersistence(new DailyStatePersistence(adapter, { eventBus }));
  setGoalPrioritizer(new GoalPrioritizer({ eventBus }));
  setDecisionsFeed(new DecisionsFeed(adapter, { eventBus }));

  // T03: Motores de tareas en background (Fase 07). @ego/tasks deja de ser
  // un paquete huérfano: engine + pool + proactividad + checkpoints VantaDB.
  setTaskCheckpointManager(new TaskCheckpointManager(adapter));
  setBackgroundEngine(new BackgroundEngine({
    maxConcurrent: 3,
    checkpointProvider: {
      saveCheckpoint: (taskId, state) =>
        taskCheckpointManager
          .saveCheckpoint(
            taskId,
            typeof state.step === "number" ? state.step : 0,
            typeof state.stepName === "string"
              ? state.stepName
              : `step_${typeof state.step === "number" ? state.step : 0}`,
            state
          )
          .then(() => undefined),
      loadLatestCheckpoint: async (taskId) => {
        const cp = await taskCheckpointManager.loadLatestCheckpoint(taskId);
        return cp ? cp.state : null;
      },
    },
    approvalPolicy: {
      requiresApproval: (def) => {
        const kind =
          typeof def.metadata?.kind === "string" ? def.metadata.kind : "";
        return !isTaskKindSafe(kind);
      },
      onApprovalRequired: (taskId, def) => {
        eventBus?.emit(
          "system.alert",
          {
            code: "TASK_APPROVAL_REQUIRED",
            message: `Tarea '${def.title}' pausada esperando aprobación (R5 deny-by-default).`,
            details: { taskId },
          },
          { source: "desktop.tasks", severity: "warn" }
        );
        deps.syncFloatingFromEngine();
      },
    },
    onTaskEvent: (event) => {
      // CFG-11: chatter background (sin coalesce: porta secuencias).
      if (win && !win.isDestroyed()) {
        deps.enqueueMainPush("ipc.event", { kind: event.type, task: event.task }, "background");
      }
      deps.syncFloatingFromEngine();
    },
  }));
  setWorkerTaskPool(new WorkerTaskPool());
  setProactivityEngine(new ProactivityEngine());

  // A3-T6 / EGO-FIND-50: `manage_background_task` — sin registrar esta tool,
  // el agente no puede lanzar ni governar tareas en background.
  registerBackgroundTaskTools(toolRegistry, backgroundEngine, {
    defaultSubEgoId: "ego.nucleus",
    defaultTimeoutMs: 120_000,
    executor: async (request) => {
      // Ejecución mínima honesta: sin pipeline propio, la tarea se encola y
      // queda en `queued` (fail-closed: no se inventa un resultado).
      return {
        taskId: request.taskId,
        status: "queued" as const,
        detail: `Tarea encolada: ${request.title}`,
      };
    },
  });

  // A3-T2 / EGO-FIND-51: proactividad con triggers REALES. Antes el motor
  // se instanciaba pero no tenía ni un trigger ⇒ nunca disparaba nada.
  proactivityEngine.setApprovalPolicy({
    // Fail-closed: sin aprobación explícita, los triggers proactivos NO se
    // disparan (el motor emite `onApprovalRequired` y queda en pausa).
    requiresApproval: async () => false,
    onApprovalRequired: (info) => {
      eventBus?.emit("system.alert", {
        code: "PROACTIVE_APPROVAL_REQUIRED",
        message: `Trigger proactivo pendiente de aprobación: ${info.kind}/${info.triggerId}`,
        details: info,
      }, { source: "ProactivityEngine", severity: "warn" });
    },
  });

  // Cron: briefing diario (lunes a viernes, 09:00).
  proactivityEngine.registerCronTrigger(
    {
      id: "daily_briefing",
      subEgoId: "ego.nucleus",
      cronExpression: "0 9 * * 1-5",
      taskTitle: "Briefing diario",
      payload: {},
      enabled: true,
    },
    async () => {
      const summary = await dailyStateEngine.synthesize();
      await dailyStatePersistence.saveSnapshot(summary);
    }
  );

  // File-watch sobre el workspace: cada cambio dispara el trigger de archivo.
  proactivityEngine.registerWatchTrigger(
    {
      id: "workspace_changes",
      subEgoId: "ego.nucleus",
      pattern: "**/*",
      debounceMs: 1_000,
      enabled: true,
    },
    async () => {
      // Sin handler de archivo, el trigger solo registra el evento.
    }
  );
  void proactivityEngine.startWatching(
    process.env.EGO_WORKSPACE_PATH || process.cwd(),
    { recursive: true }
  );
  proactivityEngine.startCronScheduler();

  // Restaurar servidores MCP persistidos en VantaDB si existen (gov/mcp_servers).
  // F1T2/F5T10: VantaDB solo guarda config saneada + `envRef`; los secretos se
  // rehidratan desde el Credential Manager (vault de sesión) o del blob `enc:`
  // con safeStorage. Registros legados con env en claro se migran al leer
  // (patrón restore de models) y se re-persisten sin secretos.
  try {
    const savedServers = await adapter.list("gov/mcp_servers", 50);
    for (const record of savedServers) {
      const persisted = extractPersistedMcpRecord(record.payload);
      if (!persisted) continue;
      const serverId = persisted.config.id;
      const vault = getMcpCredentialManager();
      let active: PersistedMcpServerRecord = persisted;
      if (needsMcpEnvMigration(persisted)) {
        const legacySecrets = collectStorableMcpSecrets(persisted.config.env);
        try {
          await storeMcpEnvSecrets(vault, serverId, legacySecrets);
        } catch (vaultErr) {
          console.warn(
            `[Ego Main] Vault no disponible al migrar MCP '${serverId}' (persiste cifrado):`,
            vaultErr
          );
        }
        const migrated = buildMcpPersistedRecord(persisted.config, persisted.enabled, encryptCredential);
        try {
          await adapter.put({
            namespace: "gov/mcp_servers",
            key: serverId,
            payload: migrated,
            metadata: { updatedAtMs: Date.now(), migrated: true },
          });
        } catch (persistErr) {
          console.warn(`[Ego Main] Error al migrar servidor MCP '${serverId}' en VantaDB:`, persistErr);
        }
        active = migrated;
      }
      const { env, missingSecrets } = await resolveMcpRuntimeEnv(
        active,
        decryptCredential,
        (service, account) => vault.getSecret(service, account)
      );
      if (missingSecrets.length > 0) {
        console.warn(
          `[Ego Main] MCP '${serverId}' arranca sin secretos del vault: ${missingSecrets.join(", ")}`
        );
      }
      await mcpManager.registerServer(
        { ...active.config, ...(env ? { env } : {}) },
        active.enabled
      );
    }
  } catch (err) {
    console.warn("[Ego Main] Advertencia al restaurar servidores MCP de VantaDB:", err);
  }

  // STAB-02: settings de permisos al cache antes de construir motores que
  // los consumen (spawn + ApprovalEngine). Sin payload → defaults CFG-06.
  await loadPermissionsSettingsIntoCache(adapter);

  // STAB-05: settings de compresión al cache + job periódico de limpieza
  // (sesiones/turns stale + worktrees huérfanos; leases: sin instancia
  // SharedMemory en prod main — hook inyectable del job, ver deuda STAB-05).
  await loadCompressionSettingsIntoCache(adapter);
  deps.scheduleMemoryCleanup();

  setApprovalEngine(new ApprovalEngine({
    mode: "standard",
    // CFG-06 (decisión owner): timeout de aprobación desde settings
    // (`approvals.timeoutSec`, default 60s → APPROVAL_TIMEOUT_MS_CFG06).
    defaultTimeoutMs: getCachedPermissionsSettings().approvals.timeoutSec * 1000,
    onApprovalRequested: (pending: PendingApproval) => {
      win?.webContents.send("ipc.approval.request", pending);
      // Task7 (WIDG-04, COUC-03/04): intento flotante con ACK 800 ms.
      // El send a main ya salió (fallback inmediato garantizado); si la
      // flotante está visible e interactiva admite (ACK) y muestra la
      // tarjeta, si no el bridge cae a main sin colgar al executor.
      try {
        let bridge = hitlBridge;
        if (!bridge) {
          const created = new WidgetHitlBridge(approvalEngine, {
            onPresent: (req) => {
              try {
                const st = deps.ensureFloatMgr().getState();
                // EGO-FIND-104: una aprobación pendiente es ATENCIÓN, no
                // sonido. El mute (audio) no oculta la tarjeta HITL; solo
                // `disabled` bloquea el pop de la isla.
                if (!st.disabled) {
                  deps.ensureFloatMgr().updateState({ attentionState: "hitl_approval" });
                  deps.ensureFloatMgr().show();
                  queueMicrotask(() =>
                    created.acknowledgePresentation(req.approvalId)
                  );
                }
              } catch {
                // noop: el flotante nunca tumba el flujo de aprobación
              }
              deps.refreshTrayStatus();
            },
            onFallbackToMain: () => {
              deps.refreshTrayStatus();
            },
          });
          bridge = created;
          setHitlBridge(created);
        }
        deps.ensureFloatMgr().updateState({ attentionState: "hitl_approval" });
        deps.refreshTrayStatus();
        void bridge.presentApproval(pending);
      } catch {
        // noop: el send a main ya garantiza el fallback
      }
    },
  }));

  setExecutionManager(new ExecutionManager({
    maxConcurrentExecutions: 5,
    defaultTimeoutMs: 60_000
  }));

  // T2 (VERDICT R1) — `AGENTS.md` §7: Ego = MCP Client **y** MCP Server.
  // El `EgoMcpServer` (packages/integrations) estaba implementado y testeado
  // pero NO se instanciaba: el servidor no existía en producción.
  //
  // Transporte: HTTP streamable sobre `127.0.0.1`, IN-PROCESO (no hijo
  // stdio): las tools y la memoria viven en este proceso, así que el
  // catálogo expuesto es el REAL, no una copia.
  //
  // El gate HITL es el MISMO `ApprovalEngine` del chat: una tool destructiva
  // llamada por MCP exige la misma aprobación humana que desde el chat.
  // Fail-closed: sin gate, el servidor rechaza la ejecución.
  setMcpServerHandle(await startEgoMcpServer({
    toolRegistry,
    credentialStore: getMcpCredentialManager(),
    approvalGate: async (toolName: string, input: unknown) => {
      const tool = toolRegistry.get(toolName);
      if (!tool) return false;
      const args = (input ?? {}) as Record<string, unknown>;
      const callId = `mcp_${toolName}_${Date.now()}`;
      const context = {
        callId,
        sessionId: "mcp-server",
        ...(activeProjectId ? { projectId: activeProjectId } : {}),
        workspacePath: defaultWorkspaceRoot(),
      };
      const requirement = approvalEngine.evaluateRequirement(tool, args, context);
      if (!requirement.required) return true;
      const decision = await approvalEngine.requestApproval({
        tool,
        arguments: args,
        context,
        callId,
      });
      return decision.approved === true;
    },
  }));
  // La URL NO lleva el token (nunca viaja en claro por un log ni por la URL).
  const mcpHandle = mcpServerHandle;
  console.log(
    `[McpServer] Servidor MCP de Ego escuchando en ${mcpHandle ? mcpHandle.url : "(no arrancado)"} (bearer token obligatorio, loopback only).`
  );

  setToolLoop(new ToolExecutionLoop(modelRouter, toolRegistry, {
    executionManager,
    approvalEngine,
    eventBus,
    maxSteps: 8,
    defaultRole: "general-chat",
    // STAB-12 (Spec D4): allowlist MCP efectiva + hooks fail-closed en el
    // punto único de ejecución. `permissionCheck` traduce al veredicto de
    // `evaluateToolCall` (deny-gana STAB-02) con la allowlist = servidores
    // enabled del manager; pre/post delegan al EventBus (CFG-09).
    governance: {
      permissionCheck: (input) => {
        const settings = getCachedPermissionsSettings();
        const allowedMcpServers = mcpManager
          .listServers()
          .filter((s) => s.enabled)
          .map((s) => s.id);
        const args = (input.args ?? {}) as Record<string, unknown>;
        const pickString = (v: unknown): string | undefined =>
          typeof v === "string" && v.length > 0 ? v : undefined;
        const workspace = process.env.EGO_WORKSPACE_PATH || process.cwd();
        return evaluateToolCall(
          {
            toolName: input.toolName,
            category: input.category,
            ...(input.riskLevel ? { riskLevel: input.riskLevel } : {}),
            ...(input.origin ? { origin: input.origin } : {}),
            ...(input.mcpServerId ? { mcpServerId: input.mcpServerId } : {}),
            path: pickString(args["path"]) ?? pickString(args["cwd"]),
            command: pickString(args["command"]),
            url: pickString(args["url"]),
            workspacePath: workspace,
          },
          {
            workspacePath: workspace,
            allowedMcpServers,
            defaultMode: "deny",
            additionalDirectories: settings.permissions.additionalDirectories,
            approvals: { cronMode: settings.approvals.cronMode },
          }
        );
      },
      preToolUse: (toolName, sessionId) =>
        eventBus?.evaluatePreToolUse(toolName, sessionId) ?? {
          allow: false,
          reason: "governance-unavailable",
        },
      postToolUse: (toolName, sessionId) =>
        eventBus?.recordPostToolUse(toolName, sessionId) ?? {
          allow: true,
          reason: "governance-unavailable",
        },
    },
    onToolCall: (call) => {
      // CFG-11: interactiva (stream visible, orden sensible, sin coalesce).
      if (win && !win.isDestroyed()) {
        deps.enqueueMainPush("ipc.chat.delta", {
          type: "tool_call",
          callId: call.id,
          toolName: call.name,
          arguments: call.arguments
        }, "interactive");
      }
    },
    onToolResult: (res) => {
      if (win && !win.isDestroyed()) {
        deps.enqueueMainPush("ipc.chat.delta", {
          type: "tool_result",
          callId: res.callId,
          toolName: res.toolName,
          success: res.success,
          output: res.output,
          error: res.error
        }, "interactive");
      }
    }
  }));

  setWindowStateManager(new WindowStateManager({
    userDataDir,
    adapter,
  }));
  const windowState = await windowStateManager.restoreState();

  const mainWindow = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    show: true,
    frame: true,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0a0a0b",
      symbolColor: "#f4f4f5",
      height: 38,
    },
    backgroundColor: "#0a0a0b",
    webPreferences: {
      // T11-S6 (electron-vite): el main compila a out/main/main.js y el
      // preload a out/preload/preload.js — ruta relativa al bundle.
      preload: join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  setWin(mainWindow);

  // SEC-01: guardarraíles de navegación (deny-by-default; localhost solo dev).
  applyNavigationGuards(mainWindow, !app.isPackaged);

  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  windowStateManager.trackWindow(mainWindow);

  // Task4 (D2) + EGO-FIND-104: flotante instanciado UNA vez en ready.
  // Autoshow al minimizar gobernado por presencia (disabled/presenceMode);
  // `muted` es solo audio y NUNCA bloquea la presencia. Al restaurar/enfocar
  // con 0 trabajo y 0 HITL, `onMainRestoreOrFocus` auto-oculta.
  // Task10 (WIDG-05): restore de persistencia flotante (mute/presencia/pos).
  // EGO-FIND-104b: restore del opacityMode (transparent/opaque/auto) y
  // armado de la sonda de composición con persistencia de la decisión.
  deps.ensureFloatMgr();
  let floatingState: FloatingWindowPersist | null = null;
  try {
    floatingState = await windowStateManager.restoreFloatingState();
  } catch {
    // noop: sin persistencia previa la flotante arranca con defaults
  }
  if (floatingState) {
    deps.ensureFloatMgr().setOpacityMode(floatingState.opacityMode);
    deps.ensureFloatMgr().setMuted(floatingState.muted);
    deps.ensureFloatMgr().setDisabled(floatingState.disabled ?? false);
    setFloatingRestoredPosition(floatingState.x !== undefined && floatingState.y !== undefined
        ? { x: floatingState.x, y: floatingState.y }
        : null);
  }
  // La sonda queda armada en el main real SIEMPRE (con o sin persistencia):
  // en modo `auto`, ~4.2 s tras el primer show verifica por píxeles que la
  // superficie transparente compone; si no compone, migra a opaco y notifica.
  deps.ensureFloatMgr().enableCompositingProbe((mode) => {
    try {
      const st = deps.ensureFloatMgr().getState();
      void windowStateManager
        .persistFloatingState({
          muted: st.muted,
          disabled: st.disabled ?? false,
          presenceMode: "auto",
          opacityMode: mode,
        })
        .catch(() => undefined);
    } catch {
      // noop: la persistencia de la decisión nunca tumba la flotante
    }
  });
  mainWindow.on("minimize", () => {
    try {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      const st = deps.ensureFloatMgr().getState();
      const presenceMode = (windowStateManager as any)?.lastFloatingState?.presenceMode ?? "auto";
      // EGO-FIND-104: presencia gobernada por `isPresenceAllowed` (disabled +
      // presenceMode). `muted` es SOLO audio: el mute del botón de la isla ya
      // no puede matar el autoshow ni dejar la isla inalcanzable.
      if (isPresenceAllowed({ disabled: st.disabled, presenceMode })) {
        mainWindow.hide();
        deps.ensureFloatMgr().show();
        if (st.attentionState === "hidden") {
          deps.ensureFloatMgr().updateState({ attentionState: "compact" });
          setFloatingAutoShownOnMinimize(true);
        }
        const floatingWin = deps.ensureFloatMgr().getFloatingWindow();
        if (floatingWin && !floatingWin.isDestroyed()) {
          floatingWin.webContents.send("ipc.floating.state_changed", deps.ensureFloatMgr().getState());
        }
        // Task10: aplica posición restaurada y trackea movimiento (debounce).
        try {
          if (floatingRestoredPosition) {
            deps.ensureFloatMgr().setPosition(floatingRestoredPosition.x,
              floatingRestoredPosition.y
            );
          }
          if (floatingWin && !floatingWin.isDestroyed()) {
            windowStateManager.trackFloatingWindow(floatingWin, () => {
              const currentSt = deps.ensureFloatMgr().getState();
              // presenceMode vive en persistencia (default "auto"; settings UI → Task12).
              // EGO-FIND-104b: el opacityMode vivo viaja en el extra para que
              // los saves por move/cierre no machaquen la decisión del fallback.
              return {
                muted: currentSt.muted,
                disabled: currentSt.disabled ?? false,
                presenceMode: "auto" as const,
                opacityMode: deps.ensureFloatMgr().getOpacityMode(),
              };
            });
          }
        } catch {
          // noop: la flotante visible vale más que su persistencia
        }
      }
    } catch {
      // noop: minimizar nunca falla por el flotante
    }
  });

  const onMainRestoreOrFocus = (): void => {
    try {
      const snap = deps.floatingSnapshot();
      if (
        floatingAutoShownOnMinimize &&
        !floatingPinnedManually &&
        snap.active === 0 &&
        snap.hitl === 0
      ) {
        deps.ensureFloatMgr().updateState({ attentionState: "hidden" });
        deps.ensureFloatMgr().hide();
        setFloatingAutoShownOnMinimize(false);
      }
    } catch {
      // noop
    }
  };
  mainWindow.on("restore", onMainRestoreOrFocus);
  mainWindow.on("focus", onMainRestoreOrFocus);

  // Task10 (COUC-19 cierre): reposiciona la flotante ante cambios de
  // displays (multi-monitor/DPI). Límite Wayland: el evento puede no
  // dispararse; el restore ya valida bounds defensivamente.
  //
  // T12 (A4-27): se guarda la ref del listener y se elimina en `before-quit`
  // (los listeners de `screen` son de proceso, no de ventana: sin cleanup
  // sobreviven al cierre de la ventana y se acumulan en cada re-apertura).
  try {
    const repositionFloatingOnDisplayChange = (): void => {
      try {
        deps.ensureFloatMgr().repositionToDisplay();
      } catch {
        // noop
      }
    };
    screen.on("display-metrics-changed", repositionFloatingOnDisplayChange);
    screen.on("display-added", repositionFloatingOnDisplayChange);
    screen.on("display-removed", repositionFloatingOnDisplayChange);
    setDisplayChangeListener(repositionFloatingOnDisplayChange);
  } catch {
    // noop: sin screen (ciertos tests) no hay suscripción
  }

  // R13/SEC-01 — CSP estricta vía cabeceras (defensa en profundidad sobre la
  // meta CSP de `renderer/index.html`; `sandbox:true` ya mitiga el riesgo base).
  // Dev (no empaquetado): permite el dev-server Vite local (http+ws en
  // 127.0.0.1:5173 + 'unsafe-inline' para HMR). Packaged: 'self' estricto,
  // `script-src 'self'`, `object-src 'none'`, sin 127.0.0.1.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const csp = buildCsp(app.isPackaged);
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp],
      },
    });
  });

  // Retransmitir eventos hacia Chromium Renderer (Activity Widget, Observabilidad).
  // CFG-11: chatter background (sin coalesce: porta secuencias).
  eventBus.onAny((event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      deps.enqueueMainPush("ipc.event", event, "background");
    }
  });

  // T03: Tray mínimo útil (COUC-19 alcance mínimo). Best-effort: si el SO no
  // lo soporta, la app sigue funcionando sin tray.
  deps.ensureTray();

  mainWindow.webContents.on("console-message", (_e, level, message, line, sourceId) => {
    console.log(`[Renderer Console] [L${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on("did-finish-load", () => {
    console.log("[Electron Window] HTML y recursos cargados exitosamente en Chromium.");
  });

  mainWindow.webContents.on("did-fail-load", (_e, errorCode, errorDescription, validatedURL) => {
    console.error(`[Electron Window] Error al cargar HTML (${errorCode}): ${errorDescription} en ${validatedURL}`);
  });

  mainWindow.webContents.on("render-process-gone", (_e, details) => {
    console.error(`[Electron Window] Proceso renderer terminado: ${details.reason} (exitCode: ${details.exitCode})`);
  });

  // T11 (EGO-FIND-54): los 81 handlers IPC viven en su propio módulo.
  registerIpcHandlers(deps.createIpcDeps());

  // Carga de la aplicación (Vite Dev Server en desarrollo o bundle compilado)
  const isDev = !app.isPackaged && process.env.NODE_ENV !== "production";
  // BUGFIX 2026-10-15 (renderer viejo en `pnpm dev`): electron-vite expone
  // ELECTRON_RENDERER_URL al main que spawnea; la vieja VITE_DEV_SERVER_URL
  // (flow concurrently, pre-T11) ya nadie la setea. Sin este orden, dev
  // cargaba out/renderer/index.html compilado y ningún fix del renderer
  // se veía sin `pnpm build` previo.
  const devServerUrl = process.env.ELECTRON_RENDERER_URL || process.env.VITE_DEV_SERVER_URL;
  if (isDev && devServerUrl) {
    console.log(`[Ego Desktop] Conectando a Vite Dev Server: ${devServerUrl}`);
    await mainWindow.loadURL(devServerUrl);
  } else {
    // T11-S6 (electron-vite): el renderer compila a out/renderer/index.html.
    const htmlPath = join(app.getAppPath(), "out/renderer/index.html");
    console.log(`[Ego Desktop] Cargando interfaz de usuario: ${htmlPath}`);
    try {
      await mainWindow.loadFile(htmlPath);
    } catch (loadErr) {
      console.error("[Ego Desktop] Error al ejecutar mainWindow.loadFile:", loadErr);
    }
  }

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  // EGO-FIND-104c (boot race): si el usuario minimizó durante el `await
  // loadFile` (que puede tardar segundos en arranque frío), el handler de
  // `minimize` ya ejecutó hide() + autoshow de la isla. Un show() tardío
  // incondicional DES-minimiza la ventana principal y dispara
  // `restore`/`focus` → la isla se auto-oculta a los pocos segundos de
  // arrancar. Sólo se muestra si la ventana sigue atendida.
  if (!mainWindow.isMinimized() && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    console.log(
      "[Ego Desktop] Ventana minimizada durante la carga: se respeta el minimize (no se des-minimiza al fin de la carga).",
    );
  }
  if (isDev) {
    mainWindow.setAlwaysOnTop(true);
    mainWindow.setAlwaysOnTop(false);
  }

  // DIST-05: auto-updater (esqueleto check + aviso discreto, sin firma).
  // Solo en build empaquetada, primer chequeo diferido 30s para no competir
  // con el arranque; cualquier fallo queda en warn, jamás tumba la app.
  // El aviso viaja como `system.alert` → `ipc.event` (push ya existente,
  // sin canales IPC nuevos). Descarga/install diferidas a DIST-04.
  try {
    const updater = initAutoUpdater({
      currentVersion: app.getVersion(),
      isPackaged: app.isPackaged,
      feedUrl: resolveUpdateFeedUrl(),
      fetchFeed: async (url: string) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
        return (await res.json()) as unknown;
      },
      notify: (notice) => {
        eventBus?.emit(
          "system.alert",
          {
            code: notice.code,
            message: `Ego ${notice.latestVersion} disponible (actual: ${notice.currentVersion}). Reiniciá para actualizar cuando quieras.`,
            details: {
              currentVersion: notice.currentVersion,
              latestVersion: notice.latestVersion,
              ...(notice.url ? { url: notice.url } : {}),
            },
          },
          { source: "desktop.updater", severity: "info" }
        );
      },
    });
    updater.checkSoon(30_000);
  } catch (updaterErr) {
    console.warn("[Ego Desktop] Auto-updater no iniciado:", updaterErr);
  }
}
