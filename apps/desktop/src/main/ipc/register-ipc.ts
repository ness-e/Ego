/**
 * T11 (EGO-FIND-54) — Registro de los handlers IPC del main process.
 *
 * Extraído del god-file `main.ts` (dentro de `createWindow`) sin cambiar
 * el comportamiento observable: los 81 canales, su validación Zod y sus
 * respuestas son los mismos.
 *
 * El bloque se registra DESPUÉS de inicializar los subsistemas, así que las
 * dependencias (memoria, routers, engines) se inyectan ya construidas
 * mediante `createIpcDeps()` (main). El estado que muta durante la vida
 * de la app vive en `ipc-state.ts` con live bindings, para que main y los
 * handlers compartan la MISMA fuente de verdad.
 */
import { ipcMain, dialog } from "electron";
import { stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { EgoMemoryAdapter, createSubEgoId, forkSession } from "@ego/memory";
import { ModelCatalog, CATALOG_CACHE_TTL_MS, type CatalogProviderId } from "@ego/models";
import { PathValidator } from "@ego/tools";
import { type McpServerConfig } from "@ego/integrations";
import { SubEgoRegistry, SubEgoFactory, fromMemoryManifest, type SubEgoCreateInput, type SubEgoManifest } from "@ego/subegos";
import { IntentRequestSchema } from "@ego/decision";
import { MemoryOpSchema, CreateSubEgoSchema, ToggleSubEgoStateSchema, UpdateSubEgoSchema, RemoveSubEgoSchema, ApproveActionSchema, ResolveApprovalSchema, LlmCancelSchema, AddMcpServerSchema, RemoveMcpServerSchema, ToggleMcpServerSchema, ListToolsFilterSchema, ScanSkillsSchema, ProjectManifestSchema, CreateProjectSchema, SelectProjectSchema, type ProjectManifest, ModelConfigSchema, type ModelConfig, PermissionsSettingsSchema, KnowledgeIngestSchema, KnowledgeHybridSearchSchema, KnowledgeGraphRagSchema, KnowledgeQuarantineActionSchema, KnowledgeAsOfSchema, KnowledgeExplainArtifactSchema, DailyStateGetSummarySchema, DailyStateRefineGoalsSchema, DailyStateGetDecisionsSchema, DailyStateResolveApprovalsBatchSchema, DailyStateJournalSchema, DailyStateFirstLaunchSchema, DomainGetSchema, DomainSwitchSchema, DomainEngineeringStatusSchema, DomainProductBacklogSchema, DomainKnowledgeSearchSchema, DomainAnalyticsSeriesSchema, DomainCrmDealsSchema, DecisionListAuditsSchema, KnowledgeExportSchema, KnowledgeImportSchema, DailyGetSnapshotSchema, DailyListSnapshotsSchema, TasksListSchema, TasksCancelSchema, TerminalSpawnSchema, TerminalStdinSchema, TerminalKillSchema, SessionsListSchema, SessionGetSchema, SessionResumeSchema, SessionForkSchema, SessionHandoffSchema, HookEvaluateSchema, DailyListApprovalsSchema, ModelsListSchema, SelectFolderRedeemSchema, EgoFetchSchema, FloatingSetMutedSchema, VoiceSttSchema, VoiceTtsSchema, VoiceSettingsSchema, type VoiceSettings } from "../../ipc/schema.js";
import { FloatingToggleSchema } from "../../ipc.js";
import { egoFetchProxied, issueFolderToken, logInvokeOrigin, redeemFolderToken, type InvokeEventLike } from "../security/electron-security.js";
import {
  assertPathInScope,
  defaultWorkspaceRoot,
  filterPathsInScope,
} from "../path-scope.js";
import {
  DomainRegistry,
  EngineeringDomain,
  ProductDomain,
  KnowledgeDomain,
  AnalyticsDomain,
  CrmDomain,
  BacklogItemStatusSchema,
  DealStageSchema,
  type CreateBacklogItemInput,
  type CreateDealInput,
} from "@ego/domains";
import { DailyStateEngine } from "@ego/dailystate";
import { evaluateToolCall, isDenied } from "@ego/security";
import {
  MAX_TERMINAL_SESSIONS,
  TERMINAL_DEFAULT_TIMEOUT_MS,
  TERMINAL_FORBIDDEN_PATTERNS,
  TERMINAL_SAFE_COMMANDS,
  isTerminalCommandAllowed,
} from "../terminal-policy.js";
import { splitMcpServerEnv, mcpEnvVaultService, collectStorableMcpSecrets } from "../mcp-env.js";
import { decryptCredential, encryptCredential, maskApiKey } from "../credentials/vault.js";
import { applyModelConfig, currentModelConfig, getConfiguredProviders, isNonEmptyKey, mergeModelKeys, probeModelKey, resolveCatalogCredentials, resolveEnvModelKeys, resolveMemoryModelKeys, setCurrentModelConfig, setupModelProviders, type ModelKeyProbeResult } from "../models/model-config.js";
import { activeProjectId, cachedPermissionsSettings, floatingPinnedManually, setActiveProjectId, setCachedPermissionsSettings, setFloatingAutoShownOnMinimize, setFloatingPinnedManually } from "./ipc-state.js";
import type { createIpcDeps, PersistedMcpServerRecord } from "../../main.js";

/** Dependencias de los handlers (referencias estables, ya inicializadas). */
export type IpcDeps = ReturnType<typeof createIpcDeps>;

/**
 * Registra los 81 handlers IPC.
 *
 * @param deps Dependencias ya inicializadas del main process.
 */
export function registerIpcHandlers(deps: IpcDeps): void {
  const {
  adapter,
  approvalEngine,
  backgroundEngine,
  bitemporalQueries,
  buildMcpPersistedRecord,
  currentScopeDirs,
  dailyStateEngine,
  dailyStatePersistence,
  dbPath,
  decisionAuditor,  decisionRouter,
  decisionTelemetry,
  decisionsFeed,
  deleteMcpEnvSecrets,
  documentParser,
  endTerminalSession,
  ensureFloatMgr,
  eventBus,
  extractPersistedMcpRecord,
  factLifecycle,
  floatingSnapshot,
  getCachedPermissionsSettings,
  getMcpCredentialManager,
  getOrCreateDefaultProject,
  goalPrioritizer,
  graphRagEngine,
  handleLlmStream,
  hybridSearch,
  killTerminalSession,
  knowledgeExport,
  knowledgeIndexer,
  lifecycle,
  llmAbortControllers,
  mcpEnvKeysForCleanup,
  mcpManager,
  modelRouter,
  needsMcpEnvMigration,
  parsePermissionsSettings,
  projectMemoryGraph,
  pushTerminalOutput,
  pushTurnCancelled,
  quarantineManager,
  refreshTrayStatus,
  resolveCwdRoot,
  sanitizeMcpRuntimeStateForRenderer,
  skillScanner,
  storeMcpEnvSecrets,
  subEgoRegistry,
  syncModelCredentialPool,
  terminalSessions,
  userDataDir,
  win,
  windowStateManager,
  } = deps;

  // 1. Canal de Operaciones de Memoria VantaDB (Validación estricta Zod — SEC-02)
  ipcMain.handle("ipc.memory", async (_e, rawPayload: unknown) => {
    const parseResult = MemoryOpSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Payload de memoria inválido: ${parseResult.error.message}`);
    }

    const { op, args } = parseResult.data;
    switch (op) {
      case "put": {
        const item = args[0];
        return adapter.put({
          namespace: item.namespace,
          key: item.key,
          payload: item.payload,
          metadata: item.metadata,
          ttl_ms: item.ttl_ms,
        });
      }
      case "get":
        return adapter.get(args[0], args[1]);
      case "delete":
        return adapter.delete(args[0], args[1]);
      case "searchMulti":
        return adapter.searchMulti(args[0], args[1], args[2]);
      case "listNamespaces":
        return adapter.listNamespaces();
      case "recall":
        return adapter.recall(args[0]);
      case "recordAudit":
        return adapter.recordAudit(args[0], args[1], args[2], args[3]);
      default: {
        const _exhaustive: never = op;
        throw new Error(`Operación no implementada: ${_exhaustive}`);
      }
    }
  });

const CANONICAL_SPECIALIST_SUBEGOS = [
  {
    id: "researcher",
    name: "Investigador Cognitivo",
    domain: "knowledge",
    role: "Investigación profunda, síntesis documental y GraphRAG en VantaDB",
    description: "Investigación profunda, síntesis documental y GraphRAG en VantaDB",
    capabilities: ["memory_search", "web_search", "knowledge_ingest"],
    status: "idle",
    state: "active" as const,
    systemPrompt: "Eres el Investigador Cognitivo de Ego. Especialista en GraphRAG, síntesis documental y exploración de conocimiento.",
    responsibilities: ["Investigación profunda", "Síntesis documental", "Búsqueda GraphRAG"],
    tools: ["memory_search", "web_search", "knowledge_ingest"],
    permissions: ["memory:read", "web:search"],
  },
  {
    id: "code_reviewer",
    name: "Arquitecto & Revisor",
    domain: "engineering",
    role: "Ingeniería de sistemas, revisión de diffs, tests y seguridad",
    description: "Ingeniería de sistemas, revisión de diffs, tests y seguridad",
    capabilities: ["fs_read_file", "fs_write_file", "git_status", "git_diff", "terminal_exec"],
    status: "idle",
    state: "active" as const,
    systemPrompt: "Eres el Arquitecto & Revisor de Ego. Especialista en ingeniería de software, arquitectura de sistemas, diffs y seguridad.",
    responsibilities: ["Revisión de diffs", "Ejecución de tests", "Auditoría de arquitectura"],
    tools: ["fs_read_file", "fs_write_file", "git_status", "git_diff", "terminal_exec"],
    permissions: ["fs:read", "fs:write", "terminal:exec"],
  },
  {
    id: "copywriter",
    name: "Estratega de Producto",
    domain: "product",
    role: "PRDs, historias de usuario, roadmaps y comunicación ejecutiva",
    description: "PRDs, historias de usuario, roadmaps y comunicación ejecutiva",
    capabilities: ["canvas_render", "memory_search"],
    status: "idle",
    state: "active" as const,
    systemPrompt: "Eres el Estratega de Producto de Ego. Diseñas PRDs, historias de usuario, roadmaps y artefactos Canvas.",
    responsibilities: ["Definición de PRDs", "Roadmaps", "Canvas UI"],
    tools: ["canvas_render", "memory_search"],
    permissions: ["canvas:write", "memory:read"],
  },
  {
    id: "analyst",
    name: "Analista de Telemetría",
    domain: "analytics",
    role: "Métricas de inferencia, costos, latencias P99 y proyecciones en Canvas",
    description: "Métricas de inferencia, costos, latencias P99 y proyecciones en Canvas",
    capabilities: ["canvas_render", "memory_search"],
    status: "idle",
    state: "active" as const,
    systemPrompt: "Eres el Analista de Telemetría de Ego. Monitoreas latencias P99, tokens, consumo de APIs y proyecciones.",
    responsibilities: ["Monitoreo de telemetría", "Métricas P99", "Análisis de costos"],
    tools: ["canvas_render", "memory_search"],
    permissions: ["canvas:write", "memory:read"],
  },
  {
    id: "planner",
    name: "Orquestador de Tareas",
    domain: "planning",
    role: "Descomposición de objetivos complejos, cron jobs y delegación multi-agente",
    description: "Descomposición de objetivos complejos, cron jobs y delegación multi-agente",
    capabilities: ["delegate_task", "canvas_render"],
    status: "idle",
    state: "active" as const,
    systemPrompt: "Eres el Orquestador de Tareas de Ego. Descompones objetivos complejos, planificas tareas y orquestas sub-egos.",
    responsibilities: ["Descomposición de metas", "Planificación de tareas", "Delegación"],
    tools: ["delegate_task", "canvas_render"],
    permissions: ["tasks:manage", "canvas:write"],
  },
];

async function seedCanonicalSubEgos(adapterInstance: EgoMemoryAdapter, registryInstance?: SubEgoRegistry): Promise<void> {
  for (const se of CANONICAL_SPECIALIST_SUBEGOS) {
    try {
      const existing = await adapterInstance.get(`egos/${se.id}/profile`, "profile").catch(() => null);
      if (!existing) {
        await adapterInstance.put({
          namespace: `egos/${se.id}/profile`,
          key: "profile",
          payload: se,
          metadata: { seeded: true, id: se.id, domain: se.domain },
        }).catch((err) => console.warn(`[Ego Main] Error sembrando perfil ego ${se.id}:`, err));
      }
      if (registryInstance) {
        const manifest = fromMemoryManifest({
          id: se.id,
          name: se.name,
          role: se.role,
          description: se.description,
          systemPrompt: se.systemPrompt,
          creator: "ego-nucleus",
          createdAtMs: Date.now(),
          namespaces: {
            read: ["kb/docs", `egos/${se.id}/*`],
            write: [`egos/${se.id}/*`, "quarantine/pending"],
          },
          tools: se.tools,
          budget: {
            maxTokensPerCall: 4000,
            maxDailyCostUsd: 2.0,
            requiresApprovalAboveUsd: 0.5,
          },
          trigger: "manual",
          state: "active",
        });
        await registryInstance.register(manifest).catch(() => {});
        await adapterInstance.registerSubEgo(manifest).catch(() => {});
      }
    } catch (err) {
      console.warn(`[Ego Main] Error sembrando subego ${se.id}:`, err);
    }
  }
}

  // 2. Canales de Sub-Egos con validación Zod y Fábrica Inteligente (INT-04 / SUB-02)
  ipcMain.handle("ipc.subegos.list", async () => {
    try {
      let list = await subEgoRegistry.list();
      if (!list || list.length === 0) {
        const fromAdapter = await adapter.listSubEgos();
        list = fromAdapter.map((m) => fromMemoryManifest(m));
      }
      if (!list || list.length === 0) {
        await seedCanonicalSubEgos(adapter, subEgoRegistry);
        list = await subEgoRegistry.list();
        if (!list || list.length === 0) {
          const fromAdapter = await adapter.listSubEgos();
          list = fromAdapter.map((m) => fromMemoryManifest(m));
        }
        if (!list || list.length === 0) {
          return CANONICAL_SPECIALIST_SUBEGOS;
        }
      }
      return list;
    } catch (err) {
      console.warn("[Ego Main] Error al listar Sub-Egos:", err);
      try {
        const fallbackList = await adapter.listSubEgos();
        if (fallbackList && fallbackList.length > 0) return fallbackList;
      } catch {}
      return CANONICAL_SPECIALIST_SUBEGOS;
    }
  });

  ipcMain.handle("ipc.subegos.getTemplates", async () => {
    return SubEgoFactory.listTemplates();
  });

  ipcMain.handle("ipc.subegos.create", async (_e, rawReq: unknown) => {
    const parseResult = CreateSubEgoSchema.safeParse(rawReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Solicitud de creación de Sub-Ego inválida: ${parseResult.error.message}`);
    }

    const req = parseResult.data;
    let manifest: SubEgoManifest;

    if ("mode" in req && req.mode === "template") {
      manifest = SubEgoFactory.fromTemplate(req.templateId, {
        name: req.name,
        ...(req.overrides as Partial<SubEgoCreateInput>),
      });
    } else if ("mode" in req && req.mode === "declaration") {
      manifest = SubEgoFactory.fromRawDeclaration(req.rawText, req.format);
    } else {
      const subEgoId = createSubEgoId(req.name);
      // Rama custom: construye la forma mínima de persistencia y la promueve
      // al tipo canónico vía `fromMemoryManifest` (HIG-03-F2, sin casts).
      manifest = fromMemoryManifest({
        id: subEgoId,
        name: req.name,
        role: req.role,
        description: req.instructions,
        systemPrompt: req.instructions,
        creator: "user",
        createdAtMs: Date.now(),
        namespaces: {
          read: ["kb/docs", `egos/${subEgoId}/*`],
          write: [`egos/${subEgoId}/*`, "quarantine/pending"],
        },
        tools: req.tools || ["memory_recall", "propose_draft"],
        budget: {
          maxTokensPerCall: req.budget?.maxTokensPerCall ?? 4000,
          maxDailyCostUsd: req.budget?.maxDailyCostUsd ?? 2.0,
          requiresApprovalAboveUsd: req.budget?.requiresApprovalAboveUsd ?? 0.5,
        },
        trigger: "manual",
        state: "active",
      });
    }

    // El registry valida en runtime (`validateSubEgoManifest`); el manifiesto
    // ya es del tipo canónico `@ego/subegos` (HIG-03-F2).
    await subEgoRegistry.register(manifest);
    try {
      await adapter.registerSubEgo(manifest);
    } catch {
      // noop
    }

    eventBus?.emit("subego.registered", {
      subEgoId: manifest.id,
      name: manifest.name,
      role: manifest.role,
      createdAt: Date.now(),
    }, {
      source: "desktop.ipc.subegos.create",
      severity: "info",
    });

    if (win && !win.isDestroyed()) {
      win.webContents.send("ipc.subegos.changed", { subEgoId: manifest.id, action: "created" });
    }

    return manifest;
  });

  ipcMain.handle("ipc.subegos.toggleState", async (_e, rawReq: unknown) => {
    const parseResult = ToggleSubEgoStateSchema.safeParse(rawReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Solicitud de alternancia de estado inválida: ${parseResult.error.message}`);
    }

    const { subEgoId, state } = parseResult.data;
    if (subEgoId === "ego.nucleus") {
      throw new Error("No se puede pausar ni desactivar el núcleo del sistema ('ego.nucleus').");
    }

    let updated: SubEgoManifest;
    if (state === "active") {
      updated = await subEgoRegistry.enable(subEgoId);
    } else {
      updated = await subEgoRegistry.disable(subEgoId);
    }

    eventBus?.emit("subego.state_changed", {
      subEgoId,
      state,
      timestamp: Date.now(),
    }, {
      source: "desktop.ipc.subegos.toggleState",
      severity: "info",
    });

    if (win && !win.isDestroyed()) {
      win.webContents.send("ipc.subegos.changed", { subEgoId, action: "state_changed", state });
    }

    return updated;
  });

  // A3 / EGO-FIND-53: el renderer ya NO escribe directo en memoria para
  // editar/borrar Sub-Egos (saltaba la validación de manifiesto). Estas dos
  // rutas usan `SubEgoRegistry` (validación Zod) como única vía de escritura.
  ipcMain.handle("ipc.subegos.update", async (_e, rawReq: unknown) => {
    const parsed = UpdateSubEgoSchema.safeParse(rawReq);
    if (!parsed.success) {
      throw new Error(
        `[IPC Security] Solicitud de actualización de Sub-Ego inválida: ${parsed.error.message}`
      );
    }
    const { subEgoId, manifest } = parsed.data;
    const existing = await subEgoRegistry.get(subEgoId);
    if (!existing) throw new Error(`Sub-Ego '${subEgoId}' no encontrado.`);

    // `fromMemoryManifest` normaliza el payload plano a manifiesto canónico
    // (validado por `SubEgoRegistry.register`).
    const merged = fromMemoryManifest({
      ...(existing as unknown as Record<string, unknown>),
      ...(manifest as Record<string, unknown>),
      id: subEgoId,
    } as never);
    const registered = await subEgoRegistry.register(merged);
    await adapter.registerSubEgo(registered);

    eventBus?.emit("subego.state_changed", {
      subEgoId,
      state: registered.state,
      timestamp: Date.now(),
    }, { source: "desktop.ipc.subegos.update", severity: "info" });

    if (win && !win.isDestroyed()) {
      win.webContents.send("ipc.subegos.changed", { subEgoId, action: "updated" });
    }
    return registered;
  });

  ipcMain.handle("ipc.subegos.remove", async (_e, rawReq: unknown) => {
    const parsed = RemoveSubEgoSchema.safeParse(rawReq);
    if (!parsed.success) {
      throw new Error(
        `[IPC Security] Solicitud de baja de Sub-Ego inválida: ${parsed.error.message}`
      );
    }
    const { subEgoId } = parsed.data;
    if (subEgoId === "ego.nucleus") {
      throw new Error("No se puede eliminar el núcleo del sistema ('ego.nucleus').");
    }
    // `unregister` respeta los Sub-Egos protegidos y deja auditoría.
    const removed = await subEgoRegistry.unregister(subEgoId);
    if (!removed) {
      throw new Error(`Sub-Ego '${subEgoId}' no encontrado o protegido.`);
    }

    eventBus?.emit("subego.state_changed", {
      subEgoId,
      state: "removed",
      timestamp: Date.now(),
    }, { source: "desktop.ipc.subegos.remove", severity: "info" });

    if (win && !win.isDestroyed()) {
      win.webContents.send("ipc.subegos.changed", { subEgoId, action: "removed" });
    }
    return true;
  });

  // 3. Gobernanza HITL con validación Zod (ACT-06, ACT-07)
  ipcMain.handle("ipc.approval.resolve", async (_e, rawReq: unknown) => {
    const parseResult = ResolveApprovalSchema.safeParse(rawReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Solicitud de resolución de aprobación inválida: ${parseResult.error.message}`);
    }

    const { approvalId, approved, reason, modifiedArguments, expectedDigest } = parseResult.data;
    const ok = approvalEngine.resolveApproval(approvalId, {
      approved,
      reason,
      modifiedArguments,
      resolvedBy: "user",
    }, expectedDigest ? { expectedDigest } : undefined);

    return { ok, approvalId, approved, timestamp: Date.now() };
  });

  ipcMain.handle("ipc.gov.approve", async (_e, rawReq: unknown) => {
    const parseResult = ApproveActionSchema.safeParse(rawReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Solicitud de aprobación inválida: ${parseResult.error.message}`);
    }

    const { actionId, confirmed } = parseResult.data;
    if (confirmed) {
      await adapter.promote(actionId);
    }
    return { ok: true, actionId, confirmed, timestamp: Date.now() };
  });

  // 4. Ciclo de Streaming Conversacional + Memoria Unificada con Tool Calling (INT-01 / CORE-03)
  ipcMain.handle("ipc.llm.stream", async (_e, rawReq: unknown) => {
    return handleLlmStream(rawReq);
  });

  // A1 real: aborta el turno en curso vía el AbortController registrado por
  // `handleLlmStream`. Síncrono por diseño: aborta y retorna de inmediato sin
  // esperar al loop (nunca cuelga). Sin `turnId` aborta todos los activos.
  ipcMain.handle("ipc.llm.cancel", async (_e, rawReq: unknown) => {
    // T4 (EGO-FIND-31) — fail-CLOSED: un payload inválido se RECHAZA.
    // Antes (fail-open) un Zod fallido dejaba `turnId === undefined`, lo que
    // abortaba TODOS los turnos activos del proceso en vez de rechazar la
    // petición. Ahora solo se abortan todos cuando el payload es `{}`/
    // `undefined` EXPLÍCITAMENTE (cancelación global deliberada).
    const parsed = LlmCancelSchema.safeParse(rawReq ?? {});
    if (!parsed.success) {
      return {
        ok: false,
        error: `Solicitud de cancelación inválida: ${parsed.error.message}`,
      };
    }
    const turnId = parsed.data?.turnId;
    const targets = turnId ? [turnId] : [...llmAbortControllers.keys()];
    const cancelled: string[] = [];
    for (const id of targets) {
      const ctrl = llmAbortControllers.get(id);
      if (!ctrl) continue;
      try {
        ctrl.abort();
      } catch {
        // noop: abort best-effort
      }
      cancelled.push(id);
      pushTurnCancelled(id);
    }
    return {
      ok: true,
      cancelled,
      ...(cancelled.length === 0 ? { note: "sin turnos activos" } : {}),
    };
  });

  // 4. Canales IPC de MCP Servers & Marketplace (ACT-11)
  // F1T2/F5T10: ningún canal devuelve secretos en claro al renderer (env
  // enmascarado) ni persiste `config.env` íntegro en VantaDB.
  ipcMain.handle("ipc.mcp.listServers", async () => {
    return mcpManager.listServers().map(sanitizeMcpRuntimeStateForRenderer);
  });

  ipcMain.handle("ipc.mcp.addServer", async (_e, rawReq: unknown) => {
    const parseResult = AddMcpServerSchema.safeParse(rawReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Configuración de servidor MCP inválida: ${parseResult.error.message}`);
    }

    const { config, enabled } = parseResult.data;
    const vault = getMcpCredentialManager();
    const service = mcpEnvVaultService(config.id);
    // Secretos entrantes en claro (no máscaras) + conservación de lo guardado
    // cuando el renderer reenvía una máscara (patrón settings Task 10).
    const incomingSecrets = collectStorableMcpSecrets(config.env);
    const { publicEnv } = splitMcpServerEnv(config.env);
    const { secretNames } = splitMcpServerEnv(config.env);
    const resolvedSecrets: Record<string, string> = { ...incomingSecrets };
    const unresolvable: string[] = [];
    for (const name of secretNames) {
      if (resolvedSecrets[name] !== undefined) continue;
      let kept: string | null = null;
      try {
        kept = await vault.getSecret(service, name);
      } catch (err) {
        console.warn(`[Ego Main] Vault inaccesible para MCP '${config.id}' var '${name}':`, err);
      }
      if (kept !== null && kept.length > 0) {
        resolvedSecrets[name] = kept;
        continue;
      }
      try {
        const existing = await adapter.get("gov/mcp_servers", config.id);
        const prev = extractPersistedMcpRecord(existing?.payload);
        const blob: unknown = prev?.envRef?.encrypted[name];
        if (typeof blob === "string") {
          const decrypted = decryptCredential(blob);
          if (decrypted.length > 0) {
            resolvedSecrets[name] = decrypted;
            continue;
          }
        }
      } catch {
        // noop: sin previo descifrable la var queda ausente (warn visible abajo)
      }
      unresolvable.push(name);
    }
    if (unresolvable.length > 0) {
      console.warn(
        `[Ego Main] MCP '${config.id}' sin valor para: ${unresolvable.join(", ")} (máscara sin secreto guardado)`
      );
    }
    const fullEnv: Record<string, string> = { ...publicEnv, ...resolvedSecrets };
    const runtimeConfig: McpServerConfig = {
      ...config,
      ...(Object.keys(fullEnv).length > 0 ? { env: fullEnv } : {}),
    };
    const runtimeState = await mcpManager.registerServer(runtimeConfig, enabled);

    try {
      await storeMcpEnvSecrets(vault, config.id, resolvedSecrets);
    } catch (vaultErr) {
      console.warn(
        `[Ego Main] Vault no disponible para MCP '${config.id}' (persiste cifrado):`,
        vaultErr
      );
    }
    try {
      const persisted = buildMcpPersistedRecord(runtimeConfig, enabled, encryptCredential);
      await adapter.put({
        namespace: "gov/mcp_servers",
        key: config.id,
        payload: persisted,
        metadata: { updatedAtMs: Date.now() },
      });
    } catch (persistErr) {
      console.warn(`[Ego Main] Error al persistir servidor MCP '${config.id}' en VantaDB:`, persistErr);
    }

    return sanitizeMcpRuntimeStateForRenderer(runtimeState);
  });

  ipcMain.handle("ipc.mcp.removeServer", async (_e, rawReq: unknown) => {
    const parseResult = RemoveMcpServerSchema.safeParse(rawReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Solicitud de eliminación MCP inválida: ${parseResult.error.message}`);
    }

    const { id } = parseResult.data;
    const removed = await mcpManager.removeServer(id);

    try {
      const existing = await adapter.get("gov/mcp_servers", id);
      const prev = extractPersistedMcpRecord(existing?.payload);
      if (prev) {
        try {
          await deleteMcpEnvSecrets(getMcpCredentialManager(), id, mcpEnvKeysForCleanup(prev));
        } catch (vaultErr) {
          console.warn(`[Ego Main] Error al borrar secretos del vault para MCP '${id}':`, vaultErr);
        }
      }
      await adapter.delete("gov/mcp_servers", id);
    } catch (delErr) {
      console.warn(`[Ego Main] Error al borrar servidor MCP '${id}' en VantaDB:`, delErr);
    }

    return { success: removed, id };
  });

  ipcMain.handle("ipc.mcp.toggleServer", async (_e, rawReq: unknown) => {
    const parseResult = ToggleMcpServerSchema.safeParse(rawReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Solicitud de alternar MCP inválida: ${parseResult.error.message}`);
    }

    const { id, enabled } = parseResult.data;
    const state = await mcpManager.toggleServer(id, enabled);

    try {
      const existing = await adapter.get("gov/mcp_servers", id);
      const prev = extractPersistedMcpRecord(existing?.payload);
      if (prev) {
        if (needsMcpEnvMigration(prev)) {
          const legacySecrets = collectStorableMcpSecrets(prev.config.env);
          try {
            await storeMcpEnvSecrets(getMcpCredentialManager(), id, legacySecrets);
          } catch (vaultErr) {
            console.warn(`[Ego Main] Vault no disponible al migrar MCP '${id}':`, vaultErr);
          }
          const migrated = buildMcpPersistedRecord(prev.config, enabled, encryptCredential);
          await adapter.put({
            namespace: "gov/mcp_servers",
            key: id,
            payload: migrated,
            metadata: { updatedAtMs: Date.now(), migrated: true },
          });
        } else {
          const next: PersistedMcpServerRecord = { ...prev, enabled };
          await adapter.put({
            namespace: "gov/mcp_servers",
            key: id,
            payload: next,
            metadata: { updatedAtMs: Date.now() },
          });
        }
      }
    } catch (updateErr) {
      console.warn(`[Ego Main] Error al actualizar estado de servidor MCP '${id}' en VantaDB:`, updateErr);
    }

    return sanitizeMcpRuntimeStateForRenderer(state);
  });

  ipcMain.handle("ipc.mcp.listTools", async (_e, rawReq: unknown) => {
    const parseResult = ListToolsFilterSchema.safeParse(rawReq || {});
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Filtro de herramientas inválido: ${parseResult.error.message}`);
    }

    const filter = parseResult.data;
    const tools = mcpManager.listTools(filter);

    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      category: t.category,
      riskLevel: t.riskLevel,
      origin: t.origin,
      mcpServerId: t.mcpServerId,
      requiresApproval: t.requiresApproval ?? (t.riskLevel === "destructive" || t.riskLevel === "sensitive"),
    }));
  });

  // 5. Canales IPC de Skills Locales (HERM-19 / ACT-11)
  ipcMain.handle("ipc.skills.listLocal", async (_e, rawReq: unknown) => {
    const parseResult = ScanSkillsSchema.safeParse(rawReq || {});
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Parámetros de escaneo de skills inválidos: ${parseResult.error.message}`);
    }

    // T2 (EGO-FIND-26): `searchPaths` / `projectRoot` vienen del renderer
    // (untrusted). `SkillScanner.scan` hace `readdirSync`/`readFileSync`
    // recursivo → sin validación de scope, el renderer podía enumerar y
    // leer directorios arbitrarios del SO. Se filtra al alcance del workspace.
    const scopeDirs = currentScopeDirs();
    const requested = parseResult.data.searchPaths ?? [];
    const allowedPaths = filterPathsInScope(requested, scopeDirs);
    if (requested.length > 0 && allowedPaths.length === 0) {
      return {
        ok: false,
        error:
          "searchPaths fuera del alcance del workspace (fail-closed): no se escanea ninguna ruta.",
      };
    }
    const projectRoot = parseResult.data.projectRoot
      ? assertPathInScope(parseResult.data.projectRoot, scopeDirs, "projectRoot")
      : null;
    if (projectRoot && !projectRoot.ok) {
      return { ok: false, error: projectRoot.reason };
    }

    return skillScanner.scan({
      ...(allowedPaths.length > 0 ? { searchPaths: allowedPaths } : {}),
      ...(projectRoot && projectRoot.ok ? { projectRoot: projectRoot.path } : {}),
    });
  });

  // 6. Canales IPC de Entidad Project y Aislamiento de Contexto (INT-03)
  ipcMain.handle("ipc.projects.list", async () => {
    try {
      const defaultProj = await getOrCreateDefaultProject(adapter);
      const records = await adapter.list("gov/projects", 100);
      const projectsMap = new Map<string, ProjectManifest>();
      projectsMap.set("default", defaultProj);

      for (const rec of records) {
        let payload: unknown = rec.payload;
        if (typeof payload === "string") {
          try {
            payload = JSON.parse(payload);
          } catch {
            // noop
          }
        }
        const parseRes = ProjectManifestSchema.safeParse(payload);
        if (parseRes.success) {
          projectsMap.set(parseRes.data.id, parseRes.data);
        }
      }

      return Array.from(projectsMap.values());
    } catch (err) {
      console.warn("[Ego Main] Error al listar proyectos:", err);
      return [
        {
          id: "default",
          name: "Ego Core",
          rootPath: process.env.EGO_WORKSPACE_PATH || process.cwd(),
          activeSubEgoId: "ego.nucleus",
          createdAtMs: Date.now(),
          updatedAtMs: Date.now(),
        }
      ];
    }
  });

  ipcMain.handle("ipc.projects.create", async (_e, rawReq: unknown) => {
    const parseResult = CreateProjectSchema.safeParse(rawReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Solicitud de creación de proyecto inválida: ${parseResult.error.message}`);
    }

    const { name, rootPath, description, activeSubEgoId } = parseResult.data;

    // Validar existencia de la carpeta en disco
    try {
      const stats = await stat(rootPath);
      if (!stats.isDirectory()) {
        throw new Error(`La ruta '${rootPath}' no es un directorio válido.`);
      }
    } catch (fsErr) {
      const detail = fsErr instanceof Error ? fsErr.message : String(fsErr);
      throw new Error(`Ruta de directorio inaccesible o inexistente: ${detail}`);
    }

    const slug = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project";

    const id = `proj_${slug}_${Date.now().toString(36)}`;
    const now = Date.now();

    const manifest: ProjectManifest = {
      id,
      name,
      rootPath,
      description: description || `Proyecto ${name} gestionado por Ego`,
      activeSubEgoId: activeSubEgoId || "ego.nucleus",
      createdAtMs: now,
      updatedAtMs: now,
    };

    const validated = ProjectManifestSchema.parse(manifest);

    // Persistencia dual: catálogo gov/projects y raíz projects/<id>/manifest
    await adapter.put({
      namespace: "gov/projects",
      key: validated.id,
      payload: validated,
      metadata: { name: validated.name, rootPath: validated.rootPath, createdAtMs: now }
    });

    await adapter.put({
      namespace: `projects/${validated.id}`,
      key: "manifest",
      payload: validated,
      metadata: { name: validated.name, rootPath: validated.rootPath, createdAtMs: now }
    });

    return validated;
  });

  ipcMain.handle("ipc.projects.select", async (_e, rawReq: unknown) => {
    const parseResult = SelectProjectSchema.safeParse(rawReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Solicitud de selección de proyecto inválida: ${parseResult.error.message}`);
    }

    const { id } = parseResult.data;
    setActiveProjectId(id);
    if (win && !win.isDestroyed()) {
      win.webContents.send("ipc.projects.changed", { activeProjectId: id });
    }

    eventBus?.emit("project.switched", {
      projectId: id,
      timestamp: Date.now()
    }, {
      source: "desktop.ipc.projects.select",
      severity: "info"
    });

    return { ok: true, activeProjectId: id };
  });

  ipcMain.handle("ipc.projects.getActive", async () => {
    const defaultProj = await getOrCreateDefaultProject(adapter);
    if (activeProjectId === "default") return defaultProj;

    const record = await adapter.get("gov/projects", activeProjectId);
    if (record) {
      let payload: unknown = record;
      if (typeof record === "object" && record !== null && "payload" in record) {
        payload = (record as { payload: unknown }).payload;
      }
      try {
        return ProjectManifestSchema.parse(payload);
      } catch {
        // noop
      }
    }
    return defaultProj;
  });

  ipcMain.handle("ipc.projects.selectFolder", async (event) => {
    logInvokeOrigin("ipc.projects.selectFolder", event as unknown as InvokeEventLike);
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      title: "Seleccionar Carpeta del Proyecto",
      properties: ["openDirectory", "createDirectory"]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const folderPath = result.filePaths[0] as string;
    const token = issueFolderToken(folderPath);
    return { token };
  });

  ipcMain.handle("ipc.projects.selectFolderRedeem", async (event, rawReq: unknown) => {
    logInvokeOrigin("ipc.projects.selectFolderRedeem", event as unknown as InvokeEventLike);
    const parsed = SelectFolderRedeemSchema.safeParse(rawReq);
    if (!parsed.success) {
      throw new Error(`[IPC Security] Token de carpeta inválido: ${parsed.error.message}`);
    }
    return redeemFolderToken(parsed.data.token);
  });

  ipcMain.handle("ipc.net.fetch", async (event, rawReq: unknown) => {
    logInvokeOrigin("ipc.net.fetch", event as unknown as InvokeEventLike);
    const parsed = EgoFetchSchema.safeParse(rawReq);
    if (!parsed.success) {
      throw new Error(`[IPC Security] Solicitud egoFetch inválida: ${parsed.error.message}`);
    }
    return egoFetchProxied(parsed.data);
  });

  ipcMain.handle("ipc.snapshots", async () => ({
    ok: true,
    dbPath,
    operational: adapter.ready,
  }));

  // 5. Configuración de Modelos y BYOK (INT-02 / Cifrado Seguro con safeStorage + Task 10 multi-proveedor)
  // Contrato Task 10 (M25/M26 para estos canales): el payload se valida con
  // `ModelConfigSchema` (zod, sin schema → rechazado); el getter NUNCA retorna
  // un secreto en claro (solo `maskKey`); el saver cifra cada key por
  // proveedor con `encryptCredential` y persiste `<p>KeyEncrypted`.
  // Helpers locales del bloque settings (no duplican Task 9: reutilizan
  // `decryptCredential`/`encryptCredential`/`maskKey`/`applyModelConfig`).
  const isMaskedValue = (v: unknown): v is string =>
    typeof v === "string" && (v.includes("...") || v.includes("••••"));
  const PROVIDER_KEY_FIELDS = ["openaiKey", "anthropicKey", "googleKey", "deepseekKey"] as const;
  type ProviderKeyField = (typeof PROVIDER_KEY_FIELDS)[number];
  const toMaskedModelConfigResponse = (cfg: ModelConfig) => ({
    activeProvider: cfg.activeProvider,
    apiKey: maskApiKey(cfg.apiKey || ""),
    openaiKey: maskApiKey(cfg.openaiKey || ""),
    anthropicKey: maskApiKey(cfg.anthropicKey || ""),
    googleKey: maskApiKey(cfg.googleKey || ""),
    deepseekKey: maskApiKey(cfg.deepseekKey || ""),
    baseUrl: cfg.baseUrl,
    openaiBaseURL: cfg.openaiBaseURL,
    deepseekBaseURL: cfg.deepseekBaseURL,
    ollamaBaseURL: cfg.ollamaBaseURL,
    modelName: cfg.modelName,
    // STAB-06: tuning en claro (no son secretos; el renderer los muestra).
    reasoningEffort: cfg.reasoningEffort,
    temperature: cfg.temperature,
  });
  const unwrapSettingsPayload = (saved: unknown): Record<string, unknown> | null => {
    let payload: unknown = saved;
    if (typeof saved === "object" && saved !== null && "payload" in saved) {
      payload = (saved as { payload: unknown }).payload;
    }
    if (payload && typeof payload === "object") return payload as Record<string, unknown>;
    return null;
  };

  ipcMain.handle("ipc.settings.getModelConfig", async () => {
    try {
      const savedConfig = await adapter.get("gov/settings", "model_config");
      const payload = unwrapSettingsPayload(savedConfig);
      if (payload) {
        // Migración plano→cifrado de campos por proveedor (el saver Task 10 ya
        // escribe el shape nuevo; esto solo tolera restos legados en plano).
        // Se conserva el resto del payload (spread): nunca se dropean campos.
        const nextPayload: Record<string, unknown> = { ...payload };
        let needsPersist = false;
        for (const field of [...PROVIDER_KEY_FIELDS, "apiKey"] as const) {
          const plainValue = nextPayload[field];
          if (typeof plainValue === "string" && plainValue.length > 0 && !isMaskedValue(plainValue)) {
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
        }
        const stored = needsPersist ? nextPayload : payload;

        // Resolver cada key descifrada SOLO en main (nunca sale en claro).
        // `activeProvider` se acepta solo si pertenece al enum canónico.
        const ACTIVE_PROVIDERS = ["openai", "anthropic", "google", "deepseek", "ollama", "mock"] as const;
        const storedProvider = typeof stored.activeProvider === "string" ? stored.activeProvider : "";
        const resolved: ModelConfig = {
          activeProvider: (ACTIVE_PROVIDERS as readonly string[]).includes(storedProvider)
            ? (storedProvider as ModelConfig["activeProvider"])
            : currentModelConfig.activeProvider,
          baseUrl:
            typeof stored.baseUrl === "string" ? stored.baseUrl : currentModelConfig.baseUrl,
          modelName:
            typeof stored.modelName === "string" ? stored.modelName : currentModelConfig.modelName,
          openaiBaseURL:
            typeof stored.openaiBaseURL === "string" ? stored.openaiBaseURL : currentModelConfig.openaiBaseURL,
          deepseekBaseURL:
            typeof stored.deepseekBaseURL === "string" ? stored.deepseekBaseURL : currentModelConfig.deepseekBaseURL,
          ollamaBaseURL:
            typeof stored.ollamaBaseURL === "string" ? stored.ollamaBaseURL : currentModelConfig.ollamaBaseURL,
          // STAB-06: tuning persistido (validado; inválido → memoria).
          reasoningEffort:
            stored.reasoningEffort === "low" ||
            stored.reasoningEffort === "medium" ||
            stored.reasoningEffort === "high"
              ? stored.reasoningEffort
              : currentModelConfig.reasoningEffort,
          temperature:
            typeof stored.temperature === "number" &&
            stored.temperature >= 0 &&
            stored.temperature <= 2
              ? stored.temperature
              : currentModelConfig.temperature,
        };
        for (const field of [...PROVIDER_KEY_FIELDS, "apiKey"] as const) {
          const enc = stored[`${field}Encrypted`];
          if (typeof enc === "string" && enc.length > 0) {
            const decrypted = decryptCredential(enc);
            if (isNonEmptyKey(decrypted)) {
              (resolved as Record<string, unknown>)[field] = decrypted;
            }
          }
        }
        // Sin `...Encrypted` persistido, conservar el valor en memoria.
        for (const field of [...PROVIDER_KEY_FIELDS, "apiKey"] as const) {
          if (!(resolved as Record<string, unknown>)[field] && isNonEmptyKey(currentModelConfig[field])) {
            (resolved as Record<string, unknown>)[field] = currentModelConfig[field];
          }
        }
        setCurrentModelConfig({ ...currentModelConfig, ...resolved });
        return toMaskedModelConfigResponse(currentModelConfig);
      }
    } catch {
      // noop
    }
    return toMaskedModelConfigResponse(currentModelConfig);
  });

  ipcMain.handle("ipc.settings.saveModelConfig", async (_e, rawReq: unknown) => {
    // BUGFIX 2026-10-14 (save rechazado con "" ): el getter enmascarado emite
    // `""` para keys ausentes y varios senders reenvían `cfg` con spread
    // (`App.tsx:74`). `""` presente falla `min(1)` y tumba TODO el guardado
    // (incluida la key válida). `""`/blanco = ausente: se normaliza ANTES del
    // safeParse; el schema sigue rechazando tipos inválidos.
    let sanitizedReq = rawReq;
    if (sanitizedReq && typeof sanitizedReq === "object" && !Array.isArray(sanitizedReq)) {
      const copy = { ...(sanitizedReq as Record<string, unknown>) };
      for (const f of [
        "apiKey", "openaiKey", "anthropicKey", "googleKey", "deepseekKey",
        "baseUrl", "openaiBaseURL", "deepseekBaseURL", "ollamaBaseURL", "modelName",
      ] as const) {
        const v = copy[f];
        if (typeof v === "string" && v.trim().length === 0) delete copy[f];
      }
      sanitizedReq = copy;
    }
    const parseResult = ModelConfigSchema.safeParse(sanitizedReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Configuración de modelo inválida: ${parseResult.error.message}`);
    }
    const incoming = parseResult.data;

    // Fallback persistido descifrado (solo main): un campo por proveedor no
    // provisto (undefined) o enmascarado NUNCA borra el secreto guardado.
    let persisted: Record<string, unknown> = {};
    try {
      const saved = await adapter.get("gov/settings", "model_config");
      persisted = unwrapSettingsPayload(saved) ?? {};
    } catch {
      // noop: sin persistido, el fallback es la memoria
    }
    const persistedDecrypted = (field: string): string | undefined => {
      const enc = persisted[`${field}Encrypted`];
      if (typeof enc === "string" && enc.length > 0) {
        const decrypted = decryptCredential(enc);
        if (isNonEmptyKey(decrypted)) return decrypted;
      }
      const plain = persisted[field];
      if (typeof plain === "string" && isNonEmptyKey(plain) && !isMaskedValue(plain)) return plain;
      return undefined;
    };
    const keepOrIncoming = (field: ProviderKeyField | "apiKey"): string | undefined => {
      const v = incoming[field];
      if (isNonEmptyKey(v) && !isMaskedValue(v)) return v;
      // Máscara o ausente: conservar el secreto guardado (memoria o disco).
      // NUNCA se persiste ni retorna la máscara como si fuera el secreto.
      if (isNonEmptyKey(currentModelConfig[field])) return currentModelConfig[field];
      return persistedDecrypted(field);
    };

    const effectiveProviderKeys: Record<ProviderKeyField, string | undefined> = {
      openaiKey: keepOrIncoming("openaiKey"),
      anthropicKey: keepOrIncoming("anthropicKey"),
      googleKey: keepOrIncoming("googleKey"),
      deepseekKey: keepOrIncoming("deepseekKey"),
    };
    // `""` explícito en el legado = limpiar (compat con el fallback mock);
    // máscara o ausente = conservar. Una máscara con proveedor distinto NUNCA
    // se almacena (evita persistir `sk-t...7890` como si fuera el secreto).
    let effectiveApiKey: string | undefined;
    const rawLegacy = incoming.apiKey;
    if (isNonEmptyKey(rawLegacy) && !isMaskedValue(rawLegacy)) {
      effectiveApiKey = rawLegacy;
    } else if (rawLegacy === "") {
      effectiveApiKey = undefined;
    } else {
      effectiveApiKey =
        incoming.activeProvider === currentModelConfig.activeProvider && isNonEmptyKey(currentModelConfig.apiKey)
          ? currentModelConfig.apiKey
          : persistedDecrypted("apiKey");
    }

    const effectiveConfig: ModelConfig = {
      ...incoming,
      ...effectiveProviderKeys,
      apiKey: effectiveApiKey,
    };

    // T13 probe-before-save (hermes P3): validar la key efectiva del
    // proveedor activo contra su API ANTES de persistir. Key inválida
    // (401/403/404) → throw accionable, NO se persiste nada. Red ausente
    // → se advierte pero se permite guardar con flag `probe` visible.
    const providerForProbe = effectiveConfig.activeProvider;
    const keyForProbe =
      providerForProbe === "openai"
        ? (effectiveProviderKeys.openaiKey ?? effectiveApiKey)
        : providerForProbe === "anthropic"
          ? (effectiveProviderKeys.anthropicKey ?? effectiveApiKey)
          : providerForProbe === "google"
            ? (effectiveProviderKeys.googleKey ?? effectiveApiKey)
            : providerForProbe === "deepseek"
              ? (effectiveProviderKeys.deepseekKey ?? effectiveApiKey)
              : undefined;
    let probe: ModelKeyProbeResult = { verified: true };
    if (providerForProbe !== "mock") {
      probe = await probeModelKey({
        provider: providerForProbe,
        ...(keyForProbe ? { key: keyForProbe } : {}),
        ...(isNonEmptyKey(effectiveConfig.openaiBaseURL) ? { openaiBaseURL: effectiveConfig.openaiBaseURL } : {}),
        ...(isNonEmptyKey(effectiveConfig.deepseekBaseURL) ? { deepseekBaseURL: effectiveConfig.deepseekBaseURL } : {}),
        ...(isNonEmptyKey(effectiveConfig.ollamaBaseURL) ? { ollamaBaseURL: effectiveConfig.ollamaBaseURL } : {}),
      });
    }

    applyModelConfig(modelRouter, effectiveConfig);
    // Registrar también las keys no activas para multi-proveedor (reúso Task 9).
    setupModelProviders(modelRouter, {
      ...(isNonEmptyKey(effectiveProviderKeys.openaiKey) ? { openai: effectiveProviderKeys.openaiKey } : {}),
      ...(isNonEmptyKey(effectiveProviderKeys.anthropicKey) ? { anthropic: effectiveProviderKeys.anthropicKey } : {}),
      ...(isNonEmptyKey(effectiveProviderKeys.googleKey) ? { google: effectiveProviderKeys.googleKey } : {}),
      ...(isNonEmptyKey(effectiveProviderKeys.deepseekKey) ? { deepseek: effectiveProviderKeys.deepseekKey } : {}),
      ...(isNonEmptyKey(effectiveConfig.openaiBaseURL) ? { openaiBaseURL: effectiveConfig.openaiBaseURL } : {}),
      ...(isNonEmptyKey(effectiveConfig.deepseekBaseURL) ? { deepseekBaseURL: effectiveConfig.deepseekBaseURL } : {}),
      ...(isNonEmptyKey(effectiveConfig.ollamaBaseURL) ? { ollamaBaseURL: effectiveConfig.ollamaBaseURL } : {}),
    });
    // T21: rehidratar el pool con las keys efectivas recién guardadas.
    await syncModelCredentialPool(modelRouter, {
      ...(isNonEmptyKey(effectiveProviderKeys.openaiKey) ? { openai: effectiveProviderKeys.openaiKey } : {}),
      ...(isNonEmptyKey(effectiveProviderKeys.anthropicKey) ? { anthropic: effectiveProviderKeys.anthropicKey } : {}),
      ...(isNonEmptyKey(effectiveProviderKeys.googleKey) ? { google: effectiveProviderKeys.googleKey } : {}),
      ...(isNonEmptyKey(effectiveProviderKeys.deepseekKey) ? { deepseek: effectiveProviderKeys.deepseekKey } : {}),
    });

    // Cifrar cada key por proveedor antes de persistir. NUNCA texto plano ni máscaras.
    const payloadToStore: Record<string, unknown> = {
      activeProvider: effectiveConfig.activeProvider,
      ...(isNonEmptyKey(effectiveApiKey) ? { apiKeyEncrypted: encryptCredential(effectiveApiKey) } : {}),
      ...(isNonEmptyKey(effectiveProviderKeys.openaiKey)
        ? { openaiKeyEncrypted: encryptCredential(effectiveProviderKeys.openaiKey) }
        : {}),
      ...(isNonEmptyKey(effectiveProviderKeys.anthropicKey)
        ? { anthropicKeyEncrypted: encryptCredential(effectiveProviderKeys.anthropicKey) }
        : {}),
      ...(isNonEmptyKey(effectiveProviderKeys.googleKey)
        ? { googleKeyEncrypted: encryptCredential(effectiveProviderKeys.googleKey) }
        : {}),
      ...(isNonEmptyKey(effectiveProviderKeys.deepseekKey)
        ? { deepseekKeyEncrypted: encryptCredential(effectiveProviderKeys.deepseekKey) }
        : {}),
      ...(isNonEmptyKey(effectiveConfig.baseUrl) ? { baseUrl: effectiveConfig.baseUrl } : {}),
      ...(isNonEmptyKey(effectiveConfig.openaiBaseURL) ? { openaiBaseURL: effectiveConfig.openaiBaseURL } : {}),
      ...(isNonEmptyKey(effectiveConfig.deepseekBaseURL) ? { deepseekBaseURL: effectiveConfig.deepseekBaseURL } : {}),
      ...(isNonEmptyKey(effectiveConfig.ollamaBaseURL) ? { ollamaBaseURL: effectiveConfig.ollamaBaseURL } : {}),
      ...(isNonEmptyKey(effectiveConfig.modelName) ? { modelName: effectiveConfig.modelName } : {}),
      // STAB-06: tuning en claro junto al resto no-secreto (nunca cifrado).
      ...(effectiveConfig.reasoningEffort !== undefined ? { reasoningEffort: effectiveConfig.reasoningEffort } : {}),
      ...(effectiveConfig.temperature !== undefined ? { temperature: effectiveConfig.temperature } : {}),
    };

    await adapter.put({
      namespace: "gov/settings",
      key: "model_config",
      payload: payloadToStore,
      metadata: { updatedAtMs: Date.now() },
    });

    eventBus?.emit("settings.model_updated", {
      activeProvider: effectiveConfig.activeProvider,
      timestamp: Date.now(),
    }, {
      source: "desktop.ipc.settings.saveModelConfig",
      severity: "info",
    });

    // Respuesta enmascarada hacia el Renderer (ningún secreto en claro).
    // `probe` expone el resultado de la validación previa (verified/warn).
    return {
      ok: true,
      config: toMaskedModelConfigResponse({ ...effectiveConfig, apiKey: effectiveApiKey }),
      probe,
    };
  });

  // CFG-06/STAB-02: política de permisos + approvals persistida en VantaDB
  // `gov/settings/permissions` (Zod fail-closed, sin archivos `~/.codex`).
  // Sin secretos en este namespace: solo modos, reglas y directorios.
  ipcMain.handle("ipc.settings.getPermissions", async () => {
    try {
      const saved = await adapter.get("gov/settings", "permissions");
      const payload = unwrapSettingsPayload(saved);
      if (payload) {
        setCachedPermissionsSettings(parsePermissionsSettings(payload));
        return { ok: true, settings: cachedPermissionsSettings };
      }
    } catch {
      // noop: sin persistido, responde el cache/defaults
    }
    return { ok: true, settings: getCachedPermissionsSettings() };
  });

  ipcMain.handle("ipc.settings.savePermissions", async (_e, rawReq: unknown) => {
    const parseResult = PermissionsSettingsSchema.safeParse(rawReq ?? {});
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    await adapter.put({
      namespace: "gov/settings",
      key: "permissions",
      payload: parseResult.data,
      metadata: { updatedAtMs: Date.now() },
    });
    setCachedPermissionsSettings(parseResult.data);
    try {
      await adapter.recordAudit(
        "gov/settings",
        "permissions",
        { action: "save", defaultMode: parseResult.data.permissions.defaultMode },
        "user"
      );
    } catch {
      // noop: auditoría best-effort, el guardado ya se aplicó
    }
    return { ok: true, settings: parseResult.data };
  });

  // 6. Decision Intelligence Layer IPC (DEC-01..DEC-08)
  ipcMain.handle("ipc.decision.evaluate", async (_e, rawReq: unknown) => {
    const parseResult = IntentRequestSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const t0 = performance.now();
    const verdict = await decisionRouter.decide(parseResult.data);
    const totalMs = Math.round(performance.now() - t0);

    const auditKey = await decisionAuditor.recordVerdict(verdict);

    decisionTelemetry.record({
      runId: verdict.admittedRunContext.runId,
      intentId: verdict.intentId,
      classifyMs: Math.round(totalMs * 0.7),
      subEgoSelectMs: Math.round(totalMs * 0.15),
      preconditionsMs: Math.round(totalMs * 0.15),
      totalDecisionMs: totalMs,
      decidedBy: verdict.decidedBy
    });

    return { ok: true, verdict, auditKey };
  });

  ipcMain.handle("ipc.decision.listAudits", async (_e, rawReq: unknown) => {
    const parseResult = DecisionListAuditsSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const lim = parseResult.data ?? 50;
    const audits = await decisionAuditor.listRecentVerdicts(lim);
    return { ok: true, audits };
  });

  ipcMain.handle("ipc.decision.telemetry", async () => {
    const summary = decisionTelemetry.getSummary();
    return { ok: true, summary };
  });

  // 7. Knowledge & Long-Term Memory IPC (Fase 06 / KB-01..11)
  ipcMain.handle("ipc.knowledge.ingest", async (_e, rawReq: unknown) => {
    const parseResult = KnowledgeIngestSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const req = parseResult.data;

    // T2 (EGO-FIND-26): `filePath` viene del renderer (untrusted) y
    // `documentParser.parseFile` hace `fs.readFile` de esa ruta → sin
    // validación de scope, el renderer leía CUALQUIER archivo del SO y lo
    // indexaba en la base de conocimiento. Fail-closed.
    let sourceFilePath: string | undefined;
    if (req.filePath) {
      const scopeVerdict = assertPathInScope(req.filePath, currentScopeDirs(), "filePath");
      if (!scopeVerdict.ok) {
        return { ok: false, error: scopeVerdict.reason };
      }
      sourceFilePath = scopeVerdict.path;
    }

    const parsed = sourceFilePath
      ? await documentParser.parseFile(sourceFilePath)
      : documentParser.parseContent(req.content || "", req.title || "inline", req.mimeType);

    const indexResult = await knowledgeIndexer.indexDocument(parsed, {
      projectId: req.projectId,
    });
    return { ok: true, ...indexResult };
  });

  ipcMain.handle("ipc.knowledge.hybridSearch", async (_e, rawReq: unknown) => {
    const parseResult = KnowledgeHybridSearchSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const req = parseResult.data;
    const hits = await hybridSearch.search(req.query, {
      topK: req.topK,
      minConfidence: req.minConfidence,
      namespaces: req.namespaces,
    });
    return { ok: true, hits };
  });

  ipcMain.handle("ipc.knowledge.graphRag", async (_e, rawReq: unknown) => {
    const parseResult = KnowledgeGraphRagSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const req = parseResult.data;
    const context = await graphRagEngine.search(req.query, {
      maxDepth: req.maxDepth,
      maxDegreePerNode: req.maxDegreePerNode,
      maxTotalNodes: req.maxTotalNodes,
      minSimilarity: req.minSimilarity,
    });
    return { ok: true, context };
  });

  ipcMain.handle("ipc.knowledge.quarantine", async (_e, rawReq: unknown) => {
    const parseResult = KnowledgeQuarantineActionSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const req = parseResult.data;
    if (req.action === "list") {
      const pending = await quarantineManager.listPending();
      return { ok: true, pending };
    }
    if (req.action === "promote" && req.factId) {
      try {
        const promoted = await factLifecycle.promoteFromQuarantine(req.factId, {
          promotedBy: req.promotedBy,
        });
        return { ok: true, promoted };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: message || "Error al promover fact" };
      }
    }
    if (req.action === "reject" && req.factId) {
      const deleted = await quarantineManager.reject(req.factId);
      return { ok: true, deleted };
    }
    if (req.action === "purge") {
      const purged = await quarantineManager.purgeExpired();
      return { ok: true, purged };
    }
    return { ok: false, error: "Acción de cuarentena no soportada" };
  });

  ipcMain.handle("ipc.knowledge.asOf", async (_e, rawReq: unknown) => {
    const parseResult = KnowledgeAsOfSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const req = parseResult.data;
    const facts = await bitemporalQueries.asOf(req.targetTime, {
      namespace: req.namespace,
      subject: req.subject,
      limit: req.limit,
    });
    return { ok: true, facts };
  });

  ipcMain.handle("ipc.knowledge.explainArtifact", async (_e, rawReq: unknown) => {
    const parseResult = KnowledgeExplainArtifactSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const req = parseResult.data;
    // T2 (EGO-FIND-26): `filePath` viene del renderer. La traza se busca en
    // el grafo de memoria, pero la ruta se usa como clave hex y la búsqueda
    // recorre `proj/file_traces` — sin validación de scope, el renderer
    // podía interrogar trazas de rutas arbitrarias. Fail-closed.
    const scopeVerdict = assertPathInScope(req.filePath, currentScopeDirs(), "filePath");
    if (!scopeVerdict.ok) {
      return { ok: false, error: scopeVerdict.reason };
    }
    const explanation = await projectMemoryGraph.explainArtifact(scopeVerdict.path);
    return { ok: true, explanation };
  });

  ipcMain.handle("ipc.knowledge.export", async (_e, rawReq: unknown) => {
    const parseResult = KnowledgeExportSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const pId = parseResult.data ?? activeProjectId;
    const pkg = await knowledgeExport.exportPackage(pId);
    return { ok: true, pkg };
  });

  ipcMain.handle("ipc.knowledge.import", async (_e, rawReq: unknown) => {
    // SEC-02: solo se acepta paquete inline. Un `string` llegaría a
    // `fs.readFile` dentro de `importPackage` (lectura arbitraria de
    // archivos desde el renderer, que es untrusted).
    const parseResult = KnowledgeImportSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const pkg = parseResult.data;
    const result = await knowledgeExport.importPackage({
      version: pkg.version,
      projectId: pkg.projectId,
      exportedAt: pkg.exportedAt ?? Date.now(),
      checksum: pkg.checksum,
      totalRecords: pkg.totalRecords ?? pkg.records.length,
      records: pkg.records.map((rec) => ({
        namespace: rec.namespace,
        key: rec.key,
        payload: rec.payload as unknown,
        metadata: rec.metadata,
      })),
    });
    return { ok: true, result };
  });

  // 8. Daily State & Ritual de Bienvenida IPC (Fase 08 / DS-01..DS-08)
  ipcMain.handle("ipc.daily.getSummary", async (_e, rawReq: unknown) => {
    const parseResult = DailyStateGetSummarySchema.safeParse(rawReq || {});
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const summary = await dailyStateEngine.synthesize({ date: parseResult.data.date });
    return { ok: true, summary };
  });

  ipcMain.handle("ipc.daily.refineGoals", async (_e, rawReq: unknown) => {
    const parseResult = DailyStateRefineGoalsSchema.safeParse(rawReq || {});
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const summary = await dailyStateEngine.synthesize({ date: parseResult.data.date });
    const goals = await goalPrioritizer.refineWithAI(summary, modelRouter);
    return { ok: true, goals };
  });

  ipcMain.handle("ipc.daily.getDecisions", async (_e, rawReq: unknown) => {
    const parseResult = DailyStateGetDecisionsSchema.safeParse(rawReq || {});
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const decisions = await decisionsFeed.getDecisions(parseResult.data);
    return { ok: true, decisions };
  });

  ipcMain.handle("ipc.daily.saveSnapshot", async () => {
    const summary = await dailyStateEngine.synthesize();
    const snapshot = await dailyStatePersistence.saveSnapshot(summary);
    return { ok: true, snapshot };
  });

  ipcMain.handle("ipc.daily.getSnapshot", async (_e, rawReq: unknown) => {
    const parseResult = DailyGetSnapshotSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const dateStr = parseResult.data ?? DailyStateEngine.getTodayDateString();
    const snapshot = await dailyStatePersistence.getSnapshot(dateStr);
    return { ok: true, snapshot };
  });

  ipcMain.handle("ipc.daily.listSnapshots", async (_e, rawReq: unknown) => {
    const parseResult = DailyListSnapshotsSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const lim = parseResult.data ?? 30;
    const snapshots = await dailyStatePersistence.listSnapshots(lim);
    return { ok: true, snapshots };
  });

  ipcMain.handle("ipc.daily.isFirstLaunch", async (_e, rawReq: unknown) => {
    const parseResult = DailyStateFirstLaunchSchema.safeParse(rawReq || {});
    const date = parseResult.success ? parseResult.data.date : undefined;
    const isFirstLaunch = await dailyStatePersistence.isFirstLaunchOfDay(date);
    return { ok: true, isFirstLaunch };
  });

  ipcMain.handle("ipc.daily.journal", async (_e, rawReq: unknown) => {
    const parseResult = DailyStateJournalSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const req = parseResult.data;
    if (req.action === "get") {
      const record = (await adapter.get("journal", req.date))?.payload;
      let content = "";
      if (record && typeof record === "object" && "content" in record) {
        content = String((record as { content: unknown }).content || "");
      } else if (typeof record === "string") {
        content = record;
      }
      return { ok: true, date: req.date, content };
    } else {
      await adapter.put({
        namespace: "journal",
        key: req.date,
        payload: { date: req.date, content: req.content || "", updatedAt: Date.now() },
        metadata: { date: req.date, agent_id: "user", ts: Date.now() },
      });
      return { ok: true, date: req.date, content: req.content };
    }
  });

  ipcMain.handle("ipc.daily.resolveApprovalsBatch", async (_e, rawReq: unknown) => {
    const parseResult = DailyStateResolveApprovalsBatchSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const results = [];
    for (const item of parseResult.data.approvals) {
      const ok = approvalEngine.resolveApproval(item.approvalId, {
        approved: item.approved,
        reason: item.reason,
        resolvedBy: "user",
      });
      results.push({ approvalId: item.approvalId, ok });
    }
    return { ok: true, resolved: results };
  });

  // ==========================================
  // IPC Handlers: Dominios Funcionales (DOM-08)
  // ==========================================
  const domainRegistry = new DomainRegistry();
  const engineeringDomain = new EngineeringDomain();
  const productDomain = new ProductDomain(adapter);
  const knowledgeDomain = new KnowledgeDomain({
    memory: adapter,
    graphRag: graphRagEngine,
    hybridSearch,
  });
  const analyticsDomain = new AnalyticsDomain(adapter);
  const crmDomain = new CrmDomain(adapter);

  ipcMain.handle("ipc.domains.list", async () => {
    return { ok: true, domains: domainRegistry.listDomains() };
  });

  ipcMain.handle("ipc.domains.get", async (_e, rawReq: unknown) => {
    const parseResult = DomainGetSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const domain = domainRegistry.getDomain(parseResult.data.domainId);
    if (!domain) {
      return { ok: false, error: `Dominio '${parseResult.data.domainId}' no encontrado.` };
    }
    return { ok: true, domain };
  });

  ipcMain.handle("ipc.domains.switch", async (_e, rawReq: unknown) => {
    const parseResult = DomainSwitchSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const { domainId, viewId } = parseResult.data;
    const domain = domainRegistry.getDomain(domainId);
    if (!domain) {
      return { ok: false, error: `Dominio '${domainId}' no encontrado.` };
    }
    const activeView = viewId
      ? domain.views.find((v) => v.id === viewId) || domainRegistry.getDefaultView(domainId)
      : domainRegistry.getDefaultView(domainId);

    return {
      ok: true,
      domainId,
      activeViewId: activeView?.id || "default",
      defaultSubEgoId: domain.defaultSubEgoId,
    };
  });

  ipcMain.handle("ipc.domains.engineering.status", async (_e, rawReq: unknown) => {
    const parseResult = DomainEngineeringStatusSchema.safeParse(rawReq || {});
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    // T2 (EGO-FIND-26): `workspaceRoot` venía del renderer (untrusted) y se
    // escaneaba con `scanWorkspace` + `git status` + `listWorktrees` sobre
    // esa ruta → enumeración de cualquier directorio del SO. Fail-closed:
    // si el renderer pide una raíz, tiene que estar en el alcance.
    const requestedRoot = parseResult.data.workspaceRoot;
    let targetRoot = defaultWorkspaceRoot();
    if (requestedRoot) {
      const scopeVerdict = assertPathInScope(requestedRoot, currentScopeDirs(), "workspaceRoot");
      if (!scopeVerdict.ok) {
        return { ok: false, error: scopeVerdict.reason };
      }
      targetRoot = scopeVerdict.path;
    }
    const inspection = await engineeringDomain.scanWorkspace(targetRoot);
    const gitStatus = await engineeringDomain.getGitStatus(targetRoot);
    const worktrees = await engineeringDomain.getWorktreeManager().listWorktrees(targetRoot);

    return {
      ok: true,
      workspaceRoot: targetRoot,
      inspection,
      gitStatus,
      worktrees,
    };
  });

  ipcMain.handle("ipc.domains.product.backlog", async (_e, rawReq: unknown) => {
    const parseResult = DomainProductBacklogSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const { action, payload } = parseResult.data;

    if (action === "create" && payload && typeof payload === "object" && !Array.isArray(payload)) {
      const item = await productDomain.createBacklogItem(payload as CreateBacklogItemInput);
      return { ok: true, item };
    } else if (action === "updateStatus" && payload && typeof payload === "object" && !Array.isArray(payload)) {
      const p = payload as { id: string; status: unknown };
      const parsedStatus = BacklogItemStatusSchema.safeParse(p.status);
      if (!parsedStatus.success) {
        throw new Error(`[IPC Security] Estado de backlog inválido: ${parsedStatus.error.message}`);
      }
      const item = await productDomain.updateBacklogItemStatus(p.id, parsedStatus.data);
      return { ok: true, item };
    } else {
      const items = await productDomain.listBacklogItems();
      const epics = await productDomain.listEpics();
      return { ok: true, items, epics };
    }
  });

  ipcMain.handle("ipc.domains.knowledge.search", async (_e, rawReq: unknown) => {
    const parseResult = DomainKnowledgeSearchSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const results = await knowledgeDomain.searchKnowledge(parseResult.data.query, {
      limit: parseResult.data.limit,
    });
    return { ok: true, results };
  });

  ipcMain.handle("ipc.domains.analytics.series", async (_e, rawReq: unknown) => {
    const parseResult = DomainAnalyticsSeriesSchema.safeParse(rawReq || {});
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const days = parseResult.data.days || 7;
    const series = await analyticsDomain.getTokensUsageSeries(days);
    const modelDistribution = await analyticsDomain.getModelDistribution();
    const namespaceStats = await analyticsDomain.getNamespaceStats();

    return {
      ok: true,
      series,
      modelDistribution,
      namespaceStats,
    };
  });

  ipcMain.handle("ipc.domains.crm.deals", async (_e, rawReq: unknown) => {
    const parseResult = DomainCrmDealsSchema.safeParse(rawReq || { action: "list" });
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const { action, payload } = parseResult.data;

    if (action === "create" && payload && typeof payload === "object" && !Array.isArray(payload)) {
      const deal = await crmDomain.createDeal(payload as CreateDealInput);
      return { ok: true, deal };
    } else if (action === "updateStage" && payload && typeof payload === "object" && !Array.isArray(payload)) {
      const p = payload as { id: string; stage: unknown };
      const parsedStage = DealStageSchema.safeParse(p.stage);
      if (!parsedStage.success) {
        throw new Error(`[IPC Security] Etapa de deal inválida: ${parsedStage.error.message}`);
      }
      const deal = await crmDomain.updateDealStage(p.id, parsedStage.data);
      return { ok: true, deal };
    } else if (action === "summary") {
      const summary = await crmDomain.getPipelineSummary();
      return { ok: true, summary };
    } else {
      const deals = await crmDomain.listDeals();
      const contacts = await crmDomain.listContacts();
      const summary = await crmDomain.getPipelineSummary();
      return { ok: true, deals, contacts, summary };
    }
  });

  // 9. Tareas en background + terminal viva (T03). Los pushes de progreso y
  // salida viajan por `ipc.event` (canal push existente, 0 canales nuevos).
  ipcMain.handle("ipc.tasks.list", async (_e, rawReq: unknown) => {
    const parseResult = TasksListSchema.safeParse(rawReq ?? undefined);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    return { ok: true, tasks: backgroundEngine.listTasks(parseResult.data ?? {}) };
  });

  ipcMain.handle("ipc.tasks.cancel", async (_e, rawReq: unknown) => {
    const parseResult = TasksCancelSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const { taskId, reason } = parseResult.data;
    const cancelled = backgroundEngine.cancel(taskId, reason ?? "Cancelled by user");
    if (!cancelled) {
      return { ok: false, error: `Tarea '${taskId}' no encontrada o ya finalizada.` };
    }
    try {
      await adapter.recordAudit("tasks", taskId, { action: "cancel", reason: reason ?? null }, "user");
    } catch {
      // noop: auditoría best-effort, el cancel ya se aplicó
    }
    refreshTrayStatus();
    return { ok: true, taskId };
  });

  // Task4 (D2): cierra la deuda Task3 (preload `egoFloating.setMuted`).
  // Zod fail-closed; actualiza el manager aunque la ventana aún no exista.
  // Task10 (WIDG-05): persiste el mute para que sobreviva reinicio+crash.
  ipcMain.handle("ipc.floating.setMuted", async (_e, rawReq: unknown) => {
    const parseResult = FloatingSetMutedSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    ensureFloatMgr().setMuted(parseResult.data.muted);
    try {
      const current = await windowStateManager.restoreFloatingState();
      await windowStateManager.persistFloatingState({
        ...current,
        muted: parseResult.data.muted,
      });
    } catch {
      // noop: el mute en memoria ya se aplicó
    }
    return { ok: true, muted: parseResult.data.muted };
  });

  ipcMain.handle("ipc.floating.restoreMain", async () => {
    try {
      if (win && !win.isDestroyed()) {
        if (win.isMinimized()) {
          win.restore();
        }
        win.show();
        win.focus();
      }
      const snap = floatingSnapshot();
      if (!floatingPinnedManually && snap.active === 0 && snap.hitl === 0) {
        ensureFloatMgr().updateState({ attentionState: "hidden" });
        ensureFloatMgr().hide();
        setFloatingAutoShownOnMinimize(false);
      }
      return { ok: true };
    } catch (err) {
      console.warn("[Ego Main] Error en ipc.floating.restoreMain:", err);
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle("ipc.floating.toggle", async (_e, rawReq: unknown) => {
    // T4 (EGO-FIND-30) — fail-CLOSED con Zod.
    // Antes: `rawReq as { state?: ... }` (type assertion sin validación) que
    // aceptaba CUALQUIER string fuera de la unión y lo propagaba a
    // `updateState({ attentionState })`. Ahora el payload se valida contra
    // `FloatingToggleSchema` y se rechaza si no cumple.
    const parsedToggle = FloatingToggleSchema.safeParse(rawReq);
    if (!parsedToggle.success) {
      return {
        ok: false,
        error: `Estado de la isla flotante inválido: ${parsedToggle.error.message}`,
      };
    }
    try {
      const mgr = ensureFloatMgr();
      const current = mgr.getState();
      const req = parsedToggle.data;

      if (req?.state) {
        if (req.state === "hidden") {
          setFloatingPinnedManually(false);
          setFloatingAutoShownOnMinimize(false);
          mgr.updateState({ attentionState: "hidden" });
          mgr.hide();
        } else {
          setFloatingPinnedManually(true);
          mgr.show();
          mgr.updateState({ attentionState: req.state });
        }
      } else {
        if (current.visible && current.attentionState !== "hidden") {
          setFloatingPinnedManually(false);
          setFloatingAutoShownOnMinimize(false);
          mgr.updateState({ attentionState: "hidden" });
          mgr.hide();
        } else {
          setFloatingPinnedManually(true);
          mgr.show();
          mgr.updateState({ attentionState: "compact" });
        }
      }
      return { ok: true, state: mgr.getState() };
    } catch (err) {
      console.warn("[Ego Main] Error en ipc.floating.toggle:", err);
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle("ipc.terminal.spawn", async (_e, rawReq: unknown) => {
    const parseResult = TerminalSpawnSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const { command, cwd, timeoutMs } = parseResult.data;
    const workspace = process.env.EGO_WORKSPACE_PATH || process.cwd();
    const permissionSettings = getCachedPermissionsSettings();
    // STAB-02: veto deny-gana de la matriz `@ego/security` (superset de 16
    // patrones + confinamiento con additionalDirectories). Solo `deny` veta:
    // `requireApproval` no bloquea (el safe-set R5 gobierna el allow directo;
    // la vía de escape HITL sigue siendo terminal_exec con aprobación).
    const permVerdict = evaluateToolCall(
      {
        toolName: "terminal.spawn",
        category: "terminal",
        command,
        path: cwd,
        workspacePath: workspace,
      },
      {
        workspacePath: workspace,
        defaultMode: "deny",
        additionalDirectories: permissionSettings.permissions.additionalDirectories,
      }
    );
    if (isDenied(permVerdict)) {
      return {
        ok: false,
        denied: true,
        error: `Comando o cwd vetado por la política de permisos (STAB-02 deny-gana: regla '${permVerdict.rule}'). Vía de escape: HITL vía terminal_exec con aprobación.`,
      };
    }
    for (const pattern of TERMINAL_FORBIDDEN_PATTERNS) {
      if (pattern.test(command)) {
        return {
          ok: false,
          denied: true,
          error: `Comando bloqueado por guardrail (R5 deny-by-default, patrón '${pattern}'). Vía de escape: HITL vía terminal_exec con aprobación.`,
        };
      }
    }
    if (!isTerminalCommandAllowed(command)) {
      return {
        ok: false,
        denied: true,
        error: `Comando fuera del conjunto seguro documentado (R5 deny-by-default: ${[...TERMINAL_SAFE_COMMANDS].join(", ")} + git de solo lectura). Vía de escape: HITL vía terminal_exec con aprobación.`,
      };
    }
    if (terminalSessions.size >= MAX_TERMINAL_SESSIONS) {
      return { ok: false, error: `Límite de sesiones de terminal alcanzado (${MAX_TERMINAL_SESSIONS}).` };
    }
    let executionCwd: string;
    try {
      const effectiveRoot = resolveCwdRoot(
        cwd,
        workspace,
        permissionSettings.permissions.additionalDirectories
      );
      // A3-T11 / diff 6b: `validatePathAsync` cierra la ventana TOCTOU
      // (el path se re-resuelve justo antes del spawn, no antes).
      executionCwd = cwd
        ? await PathValidator.validatePathAsync(cwd, effectiveRoot)
        : workspace;
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    const sessionId = `term_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const isWindows = process.platform === "win32";
    const shell = isWindows ? "powershell.exe" : "/bin/bash";
    const shellArgs = isWindows ? ["-NoProfile", "-Command", command] : ["-c", command];
    try {
      const proc = spawn(shell, shellArgs, { cwd: executionCwd, windowsHide: true });
      const timeout = setTimeout(
        () => {
          killTerminalSession(sessionId, "timeout");
        },
        timeoutMs ?? TERMINAL_DEFAULT_TIMEOUT_MS
      );
      terminalSessions.set(sessionId, {
        id: sessionId,
        command,
        cwd: executionCwd,
        proc,
        startedAt: Date.now(),
        timeoutTimer: timeout,
      });
      proc.stdout?.on("data", (chunk) => {
        pushTerminalOutput(sessionId, String(chunk));
      });
      proc.stderr?.on("data", (chunk) => {
        pushTerminalOutput(sessionId, String(chunk));
      });
      proc.on("error", (err) => {
        pushTerminalOutput(sessionId, `[ERROR: ${err.message}]`);
        endTerminalSession(sessionId, 1);
      });
      proc.on("close", (exitCode) => {
        endTerminalSession(sessionId, exitCode ?? 0);
      });
      return { ok: true, sessionId, cwd: executionCwd };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle("ipc.terminal.stdin", async (_e, rawReq: unknown) => {
    const parseResult = TerminalStdinSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const session = terminalSessions.get(parseResult.data.sessionId);
    if (!session) {
      return { ok: false, error: `Sesión '${parseResult.data.sessionId}' no encontrada o ya finalizada.` };
    }
    try {
      if (!session.proc.stdin || !session.proc.stdin.writable) {
        return { ok: false, error: "stdin no disponible en esta sesión." };
      }
      session.proc.stdin.write(parseResult.data.data);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle("ipc.terminal.kill", async (_e, rawReq: unknown) => {
    const parseResult = TerminalKillSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const killed = killTerminalSession(parseResult.data.sessionId, "user");
    if (!killed) {
      return { ok: false, error: `Sesión '${parseResult.data.sessionId}' no encontrada o ya finalizada.` };
    }
    try {
      await adapter.recordAudit(
        "terminal",
        parseResult.data.sessionId,
        { action: "kill", by: "user" },
        "user"
      );
    } catch {
      // noop: auditoría best-effort
    }
    return { ok: true, sessionId: parseResult.data.sessionId };
  });

  // ==========================================
  // IPC Handlers: Sesiones conversacionales (T13)
  // ==========================================
  // Fuente: NO hay store dedicado de sesiones (EgoMemoryLifecycle solo
  // guarda el activeSessionId en memoria). Los turnos viven en el
  // namespace `session/turns` con key `${sessionId}:${turnId}` y metadata
  // `{sessionId, projectScope, timestamp}`. Estos handlers agregan desde
  // ahí (lifecycle/store) y lo documentan en vez de inventar fuente.
  ipcMain.handle("ipc.sessions.list", async (_e, rawReq: unknown) => {
    const parseResult = SessionsListSchema.safeParse(rawReq ?? undefined);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const limit = parseResult.data?.limit ?? 100;
    const projectScope = parseResult.data?.projectScope;
    const turns = await adapter.list("session/turns", Math.min(limit * 10, 1000));
    const bySession = new Map<string, { turnCount: number; lastTimestamp: number; projectScope?: string }>();
    for (const t of turns) {
      const meta = (t.metadata ?? {}) as Record<string, unknown>;
      const payload = t.payload as Record<string, unknown> | null;
      const sid =
        (typeof meta["sessionId"] === "string" && meta["sessionId"]) ||
        (payload && typeof payload["sessionId"] === "string" ? (payload["sessionId"] as string) : "") ||
        t.key.split(":")[0] ||
        "unknown";
      if (projectScope && meta["projectScope"] !== projectScope) continue;
      const ts =
        (typeof meta["timestamp"] === "number" && meta["timestamp"]) ||
        (payload && typeof payload["timestamp"] === "number" ? (payload["timestamp"] as number) : 0);
      const prev = bySession.get(sid) ?? { turnCount: 0, lastTimestamp: 0 };
      bySession.set(sid, {
        turnCount: prev.turnCount + 1,
        lastTimestamp: Math.max(prev.lastTimestamp, ts),
        ...(typeof meta["projectScope"] === "string" ? { projectScope: meta["projectScope"] as string } : {}),
      });
    }
    const sessions = [...bySession.entries()]
      .map(([sessionId, info]) => ({ sessionId, ...info }))
      .sort((a, b) => b.lastTimestamp - a.lastTimestamp)
      .slice(0, limit);
    return { ok: true, sessions };
  });

  ipcMain.handle("ipc.sessions.get", async (_e, rawReq: unknown) => {
    const parseResult = SessionGetSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const { sessionId } = parseResult.data;
    const turns = await adapter.list("session/turns", 1000);
    const mine = turns
      .filter((t) => {
        const meta = (t.metadata ?? {}) as Record<string, unknown>;
        if (meta["sessionId"] === sessionId) return true;
        const payload = t.payload as Record<string, unknown> | null;
        if (payload && payload["sessionId"] === sessionId) return true;
        return t.key === sessionId || t.key.startsWith(`${sessionId}:`);
      })
      .map((t) => ({ key: t.key, payload: t.payload, metadata: t.metadata }));
    if (mine.length === 0) {
      return { ok: false, error: `Sesión '${sessionId}' no encontrada o sin turnos.` };
    }
    return { ok: true, sessionId, turns: mine };
  });

  ipcMain.handle("ipc.sessions.resume", async (_e, rawReq: unknown) => {
    const parseResult = SessionResumeSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const { sessionId } = parseResult.data;
    const turns = await adapter.list("session/turns", 1000);
    const mine = turns.filter((t) => {
      const meta = (t.metadata ?? {}) as Record<string, unknown>;
      if (meta["sessionId"] === sessionId) return true;
      const payload = t.payload as Record<string, unknown> | null;
      if (payload && payload["sessionId"] === sessionId) return true;
      return t.key === sessionId || t.key.startsWith(`${sessionId}:`);
    });
    if (mine.length === 0) {
      return { ok: false, error: `Sesión '${sessionId}' no encontrada o sin turnos.` };
    }
    const projectScope =
      (mine[0]?.metadata as Record<string, unknown> | undefined)?.["projectScope"];
    await lifecycle.startSession(
      sessionId,
      typeof projectScope === "string" && projectScope ? projectScope : "default"
    );
    return { ok: true, sessionId, turnCount: mine.length, resumed: true };
  });

  // STAB-12: fork de sesión + handoff formal (Spec D6/D7).  // Zod fail-closed en el borde; gate SessionStart sobre la sesión destino;
  // `forkSession` copia `session/turns` + sella checkpoint; el handoff se
  // re-valida con `SessionHandoffSchema` antes de responder (validado).
  ipcMain.handle("ipc.sessions.fork", async (_e, rawReq: unknown) => {
    const parseResult = SessionForkSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const { fromSessionId, toSessionId, summary, findings, files, issues } = parseResult.data;
    const gate = eventBus.evaluateSessionStart(toSessionId);
    if (!gate.allow) {
      return { ok: false, denied: true, error: `Fork bloqueado por hook (motivo '${gate.reason}').` };
    }
    try {
      const handoff = await forkSession(
        { fromSessionId, toSessionId, summary, findings, files, issues },
        { adapter, createCheckpoint: (taskId, snapshot) => lifecycle.createMicroCheckpoint(taskId, snapshot) }
      );
      const validated = SessionHandoffSchema.safeParse(handoff);
      if (!validated.success) {
        return { ok: false, error: `Handoff inválido: ${validated.error.message}` };
      }
      eventBus.recordSessionEnd(fromSessionId);
      try {
        await adapter.recordAudit("session_fork", "ego.governance", {
          from: handoff.from,
          to: handoff.to,
          copiedTurns: handoff.copiedTurns,
          checkpointId: handoff.checkpointId,
        }, handoff.to);
      } catch {
        // noop: auditoría best-effort, el fork ya se aplicó
      }
      return { ok: true, handoff: validated.data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // STAB-12: superficie IPC de hooks CFG-09 (preload `ego.hooks` los invoca;
  // cierra el gap 1:1 del contrato). Solo veredictos/estado; la ejecución de
  // comandos vive en main/ExecutionManager (fail-closed).
  ipcMain.handle("ipc.hooks.getStatus", async () => {
    return { ok: true, status: eventBus.getHooksStatus() };
  });

  ipcMain.handle("ipc.hooks.evaluatePreToolUse", async (_e, rawReq: unknown) => {
    const parseResult = HookEvaluateSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const decision = eventBus.evaluatePreToolUse(
      parseResult.data.toolName,
      parseResult.data.sessionId
    );
    return { ok: true, decision };
  });

  ipcMain.handle("ipc.hooks.recordPostToolUse", async (_e, rawReq: unknown) => {
    const parseResult = HookEvaluateSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const decision = eventBus.recordPostToolUse(
      parseResult.data.toolName,
      parseResult.data.sessionId
    );
    return { ok: true, decision };
  });

  // VOICE-01: voz STT/TTS opt-in con kill switch (apéndice voice; no toca
  // guards/CSP/fetch/folders/permissions-CFG-06/queue-CFG-11). Keys (groq)
  // solo en main vía `GROQ_API_KEY` de entorno (ModelConfig sin slot groq por
  // regla no-touch de esta wave); el renderer nunca las ve — este borde solo
  // acepta audio/texto y retorna texto/estado. Kill switch deny-gana.
  async function getVoiceSettingsStore(): Promise<VoiceSettings> {
    try {
      const record = await adapter.get("gov/settings", "voice");
      const payload = record?.payload as { config?: unknown } | null;
      const parsed = VoiceSettingsSchema.safeParse(
        payload && typeof payload === "object" && "config" in payload ? payload.config : (payload ?? {})
      );
      if (parsed.success) return parsed.data;
    } catch {
      // noop: best-effort, caen los defaults seguros (voz local, sin kill)
    }
    return VoiceSettingsSchema.parse({});
  }

  ipcMain.handle("ipc.voice.getStatus", async () => {
    const settings = await getVoiceSettingsStore();
    return { ok: true, ...settings };
  });

  ipcMain.handle("ipc.voice.setConfig", async (_e, rawReq: unknown) => {
    const parseResult = VoiceSettingsSchema.partial().safeParse(rawReq ?? {});
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const current = await getVoiceSettingsStore();
    const merged = VoiceSettingsSchema.parse({ ...current, ...parseResult.data });
    await adapter.put({
      namespace: "gov/settings",
      key: "voice",
      payload: { config: merged },
      metadata: { updatedAtMs: Date.now() },
    });
    return { ok: true, ...merged };
  });

  ipcMain.handle("ipc.voice.stt", async (_e, rawReq: unknown) => {
    const settings = await getVoiceSettingsStore();
    if (settings.disableVoice) {
      return { ok: false, denied: true, error: "Voz deshabilitada por kill switch." };
    }
    const parseResult = VoiceSttSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    if (settings.sttProvider !== "groq") {
      return {
        ok: false,
        error: "STT nube no configurado: el dictado local WebSpeech no usa este canal.",
      };
    }
    const groqKey = (process.env["GROQ_API_KEY"] ?? "").trim();
    if (!groqKey) {
      return {
        ok: false,
        error: "STT groq sin key: configurá GROQ_API_KEY en el entorno del main (la key nunca viaja al renderer).",
      };
    }
    try {
      const audioBytes = Buffer.from(parseResult.data.audioB64, "base64");
      const form = new FormData();
      form.append("model", "whisper-large-v3-turbo");
      form.append("file", new Blob([audioBytes], { type: `audio/${parseResult.data.format}` }), `dictado.${parseResult.data.format}`);
      if (parseResult.data.language) form.append("language", parseResult.data.language);
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 30_000);
      try {
        const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${groqKey}` },
          body: form,
          signal: ctrl.signal,
        });
        if (!res.ok) {
          return { ok: false, error: `STT groq rechazado (HTTP ${res.status}).` };
        }
        const body = (await res.json()) as { text?: unknown };
        if (typeof body.text !== "string" || body.text.trim().length === 0) {
          return { ok: false, error: "STT groq sin texto." };
        }
        return { ok: true, text: body.text.trim() };
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle("ipc.voice.tts", async (_e, rawReq: unknown) => {
    const settings = await getVoiceSettingsStore();
    if (settings.disableVoice) {
      return { ok: false, denied: true, error: "Voz deshabilitada por kill switch." };
    }
    const parseResult = VoiceTtsSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    try {
      await adapter.recordAudit(
        "voice",
        "tts",
        { chars: parseResult.data.text.length, provider: settings.ttsProvider },
        "user"
      );
    } catch {
      // noop: auditoría best-effort, la validación ya pasó
    }
    if (settings.ttsProvider !== "speechSynthesis") {
      return {
        ok: false,
        error: "TTS edge pendiente de cableado de red: usá speechSynthesis local (default).",
      };
    }
    // La síntesis local la hace el renderer (`speechSynthesis`, por gesto);
    // el main solo valida, audita y autoriza.
    return { ok: true, mode: "local" as const };
  });

  // T13: aprobaciones HITL pendientes (lectura directa del motor en
  // memoria; el histórico vive en DecisionsFeed, aquí solo pendientes).
  ipcMain.handle("ipc.daily.listApprovals", async (_e, rawReq: unknown) => {
    const parseResult = DailyListApprovalsSchema.safeParse(rawReq ?? undefined);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const limit = parseResult.data?.limit ?? 100;
    const approvals = approvalEngine.listPendingApprovals().slice(0, limit);
    return { ok: true, approvals };
  });

  // T13: info operativa de storage (solo lectura, sin secretos) y
  // políticas de gobierno (`gov/policies`; ausente → [] documentado).
  ipcMain.handle("ipc.settings.getStorageInfo", async () => {
    let namespaces: string[] = [];
    try {
      namespaces = await adapter.listNamespaces();
    } catch {
      // noop: best-effort, el resto de la info sigue disponible
    }
    return {
      ok: true,
      userDataDir,
      dbPath,
      operational: adapter.ready,
      platform: process.platform,
      namespaces,
    };
  });

  ipcMain.handle("ipc.settings.getGovPolicies", async () => {
    const records = await adapter.list("gov/policies", 100);
    const policies = records.map((r) => ({
      key: r.key,
      payload: r.payload,
      metadata: r.metadata,
    }));
    return { ok: true, policies };
  });

  // T15: catálogo live de modelos por proveedor. Keys descifradas solo en
  // memoria (merge env + `currentModelConfig`); el renderer recibe IDs y
  // `configured`, NUNCA secretos. Cache persistente en `gov/catalog` con
  // key=fingerprint opaco y TTL 1h (VantaDB expira + el catálogo revalida).
  const modelCatalog = new ModelCatalog({
    cache: {
      load: async (key) => {
        try {
          const record = await adapter.get("gov/catalog", key);
          const payload = record?.payload as { models?: unknown; savedAtMs?: unknown } | undefined;
          if (!payload || !Array.isArray(payload.models) || typeof payload.savedAtMs !== "number") return null;
          const models = payload.models.filter((m): m is string => typeof m === "string");
          return { models, savedAtMs: payload.savedAtMs };
        } catch {
          return null;
        }
      },
      save: async (key, value) => {
        try {
          await adapter.put({
            namespace: "gov/catalog",
            key,
            payload: { models: value.models, savedAtMs: value.savedAtMs },
            metadata: { updatedAtMs: Date.now() },
            ttl_ms: CATALOG_CACHE_TTL_MS,
          });
        } catch {
          // Best-effort: el live igual se retorna al renderer.
        }
      },
    },
  });

  ipcMain.handle("ipc.models.listProviders", async () => {
    const keys = mergeModelKeys(resolveEnvModelKeys(), resolveMemoryModelKeys(currentModelConfig));
    return { ok: true, providers: getConfiguredProviders(keys) };
  });

  ipcMain.handle("ipc.models.listModels", async (_e, rawReq: unknown) => {
    const parsed = ModelsListSchema.safeParse(rawReq);
    if (!parsed.success) {
      throw new Error(`[IPC Security] Solicitud de catálogo inválida: ${parsed.error.message}`);
    }
    const provider: CatalogProviderId = parsed.data.provider;
    const keys = mergeModelKeys(resolveEnvModelKeys(), resolveMemoryModelKeys(currentModelConfig));
    const creds = resolveCatalogCredentials(provider, keys);
    return {
      ok: true,
      provider,
      ...(await modelCatalog.listModels({
        provider,
        refresh: parsed.data.refresh,
        credentialFingerprint: creds.credentialFingerprint,
        ...(creds.apiKey !== undefined ? { apiKey: creds.apiKey } : {}),
        ...(creds.baseURL !== undefined ? { baseURL: creds.baseURL } : {}),
      })),
    };
  });
}
