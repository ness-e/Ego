// Contrato IPC canónico (renderer→main invoke + main→renderer push).
// F5T11/M25: fuente única de verdad de la superficie IPC. Los 61 canales
// `invoke` corresponden 1:1 a los `ipcMain.handle` de `main.ts` y a los
// `ipcRenderer.invoke` de `preload.ts`; los 7 canales `push` a los
// `webContents.send` de `main.ts` y `ipcRenderer.on` de `preload.ts`.
// El servidor MCP `ego.*` es otro plano y NO forma parte de este contrato.
// Guard mecánico: `test/ipc-contract.test.ts` audita ambas direcciones.
export const EgoIpcInvokeChannels = [
  // Memoria VantaDB (SEC-02, validación `MemoryOpSchema`)
  "ipc.memory",
  // Streaming conversacional + ToolExecutionLoop (INT-01)
  "ipc.llm.stream",
  // A1: cancelación del turno en curso (Map<turnId, AbortController> en main;
  // `turnId` opcional, sin él aborta todos; push `turn-cancelled` al renderer).
  "ipc.llm.cancel",
  // Gobernanza HITL (ACT-06, ACT-07)
  "ipc.gov.approve",
  "ipc.approval.resolve",
  // Snapshots / estado operativo
  "ipc.snapshots",
  // Sub-Egos (INT-04 / SUB-02)
  "ipc.subegos.list",
  "ipc.subegos.getTemplates",
  "ipc.subegos.create",
  "ipc.subegos.toggleState",
  "ipc.subegos.update",
  "ipc.subegos.remove",
  // MCP servers & marketplace (ACT-11)
  "ipc.mcp.listServers",
  "ipc.mcp.addServer",
  "ipc.mcp.removeServer",
  "ipc.mcp.toggleServer",
  "ipc.mcp.listTools",
  // Skills locales (HERM-19)
  "ipc.skills.listLocal",
  // Proyectos e isolamento de contexto (INT-03)
  "ipc.projects.list",
  "ipc.projects.create",
  "ipc.projects.select",
  "ipc.projects.getActive",
  "ipc.projects.selectFolder",
  // Configuración de modelos BYOK (INT-02; secretos solo en main vía safeStorage)
  "ipc.settings.getModelConfig",
  "ipc.settings.saveModelConfig",
  // Política de permisos + approvals (CFG-06/STAB-02; VantaDB gov/settings/permissions)
  "ipc.settings.getPermissions",
  "ipc.settings.savePermissions",
  // Decisión (F5T10/H25; validación Zod en main)
  "ipc.decision.evaluate",
  "ipc.decision.listAudits",
  "ipc.decision.telemetry",
  // Knowledge y memoria a largo plazo (Fase 06)
  "ipc.knowledge.ingest",
  "ipc.knowledge.hybridSearch",
  "ipc.knowledge.graphRag",
  "ipc.knowledge.quarantine",
  "ipc.knowledge.asOf",
  "ipc.knowledge.explainArtifact",
  "ipc.knowledge.export",
  "ipc.knowledge.import",
  // Daily State y ritual de bienvenida (Fase 08)
  "ipc.daily.getSummary",
  "ipc.daily.refineGoals",
  "ipc.daily.getDecisions",
  "ipc.daily.saveSnapshot",
  "ipc.daily.getSnapshot",
  "ipc.daily.listSnapshots",
  "ipc.daily.isFirstLaunch",
  "ipc.daily.journal",
  "ipc.daily.resolveApprovalsBatch",
  // Dominios funcionales (Fase 09 / DOM-08)
  "ipc.domains.list",
  "ipc.domains.get",
  "ipc.domains.switch",
  "ipc.domains.engineering.status",
  "ipc.domains.product.backlog",
  "ipc.domains.knowledge.search",
  "ipc.domains.analytics.series",
  "ipc.domains.crm.deals",
  // Tareas en background + terminal viva (T03; validación Zod en main).
  // Push reutiliza `ipc.event` existente (0 canales push nuevos).
  "ipc.tasks.list",
  "ipc.tasks.cancel",
  "ipc.terminal.spawn",
  "ipc.terminal.stdin",
  "ipc.terminal.kill",
  // Sesiones conversacionales (T13; fuente: `session/turns` vía adapter).
  "ipc.sessions.list",
  "ipc.sessions.get",
  "ipc.sessions.resume",
  // Fork de sesión + handoff formal (STAB-12; copia `session/turns` + checkpoint).
  "ipc.sessions.fork",
  // Hooks CFG-09 + STAB-12 (veredictos/estado; ejecución en main fail-closed).
  "ipc.hooks.getStatus",
  "ipc.hooks.evaluatePreToolUse",
  "ipc.hooks.recordPostToolUse",
  // Aprobaciones HITL pendientes (T13; `ApprovalEngine.listPendingApprovals`).
  "ipc.daily.listApprovals",
  // Storage operativo + políticas de gobierno (T13; solo lectura, sin secretos).
  "ipc.settings.getStorageInfo",
  "ipc.settings.getGovPolicies",
  // Catálogo live de modelos por proveedor (T15; keys solo en main, fallback curado).
  "ipc.models.listProviders",
  "ipc.models.listModels",
  // Hardening IPC: canje single-use del token opaco de selectFolder (TTL 60s).
  "ipc.projects.selectFolderRedeem",
  // Fetch-proxy mínimo en main (Authorization desde safeStorage, nunca al renderer).
  "ipc.net.fetch",
  // Isla flotante Task4 (D2): silenciado desde el renderer (deuda Task3 cerrada aquí).
  "ipc.floating.setMuted",
  "ipc.floating.restoreMain",
  "ipc.floating.toggle",
  // Voz STT/TTS opt-in con kill switch (VOICE-01).
  "ipc.voice.getStatus",
  "ipc.voice.setConfig",
  "ipc.voice.stt",
  "ipc.voice.tts",
] as const;

/** Eventos push main→renderer (el renderer solo escucha, nunca emite). */
export const EgoIpcPushChannels = [
  "ipc.projects.changed",
  "ipc.subegos.changed",
  "ipc.chat.delta",
  "ipc.chat.recall_status",
  "ipc.chat.error",
  "ipc.approval.request",
  "ipc.event",
  "ipc.floating.state_changed",
] as const;

/** Superficie IPC total (invoke + push). Nombre histórico conservado. */
export const EgoIpc = [...EgoIpcInvokeChannels, ...EgoIpcPushChannels] as const;

export type EgoIpcChannel = (typeof EgoIpc)[number];
export type EgoIpcInvokeChannel = (typeof EgoIpcInvokeChannels)[number];
export type EgoIpcPushChannel = (typeof EgoIpcPushChannels)[number];

import { z } from "zod";
import { IntentRequestSchema } from "@ego/decision";
import {
  MemoryOpSchema,
  CreateSubEgoSchema,
  ToggleSubEgoStateSchema,
  UpdateSubEgoSchema,
  RemoveSubEgoSchema,
  ApproveActionSchema,
  ResolveApprovalSchema,
  ChatStreamSchema,
  LlmCancelSchema,
  AddMcpServerSchema,
  RemoveMcpServerSchema,
  ToggleMcpServerSchema,
  ListToolsFilterSchema,
  ScanSkillsSchema,
  CreateProjectSchema,
  SelectProjectSchema,
  ModelConfigSchema,
  PermissionsSettingsSchema,
  DecisionListAuditsSchema,
  KnowledgeIngestSchema,
  KnowledgeHybridSearchSchema,
  KnowledgeGraphRagSchema,
  KnowledgeQuarantineActionSchema,
  KnowledgeAsOfSchema,
  KnowledgeExplainArtifactSchema,
  KnowledgeExportSchema,
  KnowledgeImportSchema,
  DailyStateGetSummarySchema,
  DailyStateRefineGoalsSchema,
  DailyStateGetDecisionsSchema,
  DailyStateResolveApprovalsBatchSchema,
  DailyStateJournalSchema,
  DailyStateFirstLaunchSchema,
  DailyGetSnapshotSchema,
  DailyListSnapshotsSchema,
  DailyListApprovalsSchema,
  DomainGetSchema,
  DomainSwitchSchema,
  DomainEngineeringStatusSchema,
  DomainProductBacklogSchema,
  DomainKnowledgeSearchSchema,
  DomainAnalyticsSeriesSchema,
  DomainCrmDealsSchema,
  TasksListSchema,
  TasksCancelSchema,
  TerminalSpawnSchema,
  TerminalStdinSchema,
  TerminalKillSchema,
  SessionsListSchema,
  SessionGetSchema,
  SessionResumeSchema,
  SessionForkSchema,
  HookEvaluateSchema,
  ModelsListSchema,
  SelectFolderRedeemSchema,
  EgoFetchSchema,
  FloatingSetMutedSchema,
  VoiceSttSchema,
  VoiceTtsSchema,
  VoiceSettingsSchema,
} from "./ipc/schema.js";

export const FloatingRestoreMainSchema = z.object({}).optional();
export const FloatingToggleSchema = z
  .object({
    state: z.enum(["compact", "expanded", "hidden"]).optional(),
  })
  .optional();

/**
 * Schema de un canal que **no** acepta payload del renderer.
 * `z.undefined().optional()` acepta `undefined` y `{}` (el preload invoca
 * sin argumentos en ambos casos) y rechaza cualquier otro valor.
 */
export const NoPayloadSchema = z.undefined().optional();

/**
 * T9 (EGO-FIND-59) — Mapa canónico canal → schema.
 *
 * Antes solo declaraban 2 entradas (`floating.restoreMain`, `floating.toggle`)
 * y los otros 77 schemas vivían sueltos en `src/ipc/schema.ts`, sin ningún
 * vínculo tipado con el canal que los usa. Ahora **cada** canal invoke tiene
 * su schema declarado aquí, y `EgoIpcSchemas` está tipado como
 * `Record<EgoIpcInvokeChannel, ...>`: añadir un canal nuevo a
 * `EgoIpcInvokeChannels` sin añadir su schema **rompe la compilación**.
 */
export const EgoIpcSchemas: Record<EgoIpcInvokeChannel, z.ZodTypeAny> = {
  // --- Memoria -----------------------------------------------------------
  "ipc.memory": MemoryOpSchema,
  // --- Turno conversacional ---------------------------------------------
  "ipc.llm.stream": ChatStreamSchema,
  "ipc.llm.cancel": LlmCancelSchema,
  // --- Gobernanza HITL ----------------------------------------------------
  "ipc.gov.approve": ApproveActionSchema,
  "ipc.approval.resolve": ResolveApprovalSchema,
  "ipc.snapshots": NoPayloadSchema,
  // --- Sub-Egos ----------------------------------------------------------
  "ipc.subegos.list": NoPayloadSchema,
  "ipc.subegos.getTemplates": NoPayloadSchema,
  "ipc.subegos.create": CreateSubEgoSchema,
  "ipc.subegos.toggleState": ToggleSubEgoStateSchema,
  "ipc.subegos.update": UpdateSubEgoSchema,
  "ipc.subegos.remove": RemoveSubEgoSchema,
  // --- MCP ---------------------------------------------------------------
  "ipc.mcp.listServers": NoPayloadSchema,
  "ipc.mcp.addServer": AddMcpServerSchema,
  "ipc.mcp.removeServer": RemoveMcpServerSchema,
  "ipc.mcp.toggleServer": ToggleMcpServerSchema,
  "ipc.mcp.listTools": ListToolsFilterSchema,
  // --- Skills ------------------------------------------------------------
  "ipc.skills.listLocal": ScanSkillsSchema,
  // --- Proyectos ---------------------------------------------------------
  "ipc.projects.list": NoPayloadSchema,
  "ipc.projects.create": CreateProjectSchema,
  "ipc.projects.select": SelectProjectSchema,
  "ipc.projects.getActive": NoPayloadSchema,
  "ipc.projects.selectFolder": NoPayloadSchema,
  "ipc.projects.selectFolderRedeem": SelectFolderRedeemSchema,
  // --- Ajustes -----------------------------------------------------------
  "ipc.settings.getModelConfig": NoPayloadSchema,
  "ipc.settings.saveModelConfig": ModelConfigSchema,
  "ipc.settings.getPermissions": NoPayloadSchema,
  "ipc.settings.savePermissions": PermissionsSettingsSchema,
  "ipc.settings.getStorageInfo": NoPayloadSchema,
  "ipc.settings.getGovPolicies": NoPayloadSchema,
  // --- Decisión ----------------------------------------------------------
  "ipc.decision.evaluate": IntentRequestSchema,
  "ipc.decision.listAudits": DecisionListAuditsSchema,
  "ipc.decision.telemetry": NoPayloadSchema,
  // --- Knowledge ---------------------------------------------------------
  "ipc.knowledge.ingest": KnowledgeIngestSchema,
  "ipc.knowledge.hybridSearch": KnowledgeHybridSearchSchema,
  "ipc.knowledge.graphRag": KnowledgeGraphRagSchema,
  "ipc.knowledge.quarantine": KnowledgeQuarantineActionSchema,
  "ipc.knowledge.asOf": KnowledgeAsOfSchema,
  "ipc.knowledge.explainArtifact": KnowledgeExplainArtifactSchema,
  "ipc.knowledge.export": KnowledgeExportSchema,
  "ipc.knowledge.import": KnowledgeImportSchema,
  // --- Daily State -------------------------------------------------------
  "ipc.daily.getSummary": DailyStateGetSummarySchema,
  "ipc.daily.refineGoals": DailyStateRefineGoalsSchema,
  "ipc.daily.getDecisions": DailyStateGetDecisionsSchema,
  "ipc.daily.saveSnapshot": NoPayloadSchema,
  "ipc.daily.getSnapshot": DailyGetSnapshotSchema,
  "ipc.daily.listSnapshots": DailyListSnapshotsSchema,
  "ipc.daily.isFirstLaunch": DailyStateFirstLaunchSchema,
  "ipc.daily.journal": DailyStateJournalSchema,
  "ipc.daily.resolveApprovalsBatch": DailyStateResolveApprovalsBatchSchema,
  "ipc.daily.listApprovals": DailyListApprovalsSchema,
  // --- Dominios ----------------------------------------------------------
  "ipc.domains.list": NoPayloadSchema,
  "ipc.domains.get": DomainGetSchema,
  "ipc.domains.switch": DomainSwitchSchema,
  "ipc.domains.engineering.status": DomainEngineeringStatusSchema,
  "ipc.domains.product.backlog": DomainProductBacklogSchema,
  "ipc.domains.knowledge.search": DomainKnowledgeSearchSchema,
  "ipc.domains.analytics.series": DomainAnalyticsSeriesSchema,
  "ipc.domains.crm.deals": DomainCrmDealsSchema,
  // --- Tareas en background + terminal ------------------------------------
  "ipc.tasks.list": TasksListSchema,
  "ipc.tasks.cancel": TasksCancelSchema,
  "ipc.terminal.spawn": TerminalSpawnSchema,
  "ipc.terminal.stdin": TerminalStdinSchema,
  "ipc.terminal.kill": TerminalKillSchema,
  // --- Sesiones ----------------------------------------------------------
  "ipc.sessions.list": SessionsListSchema,
  "ipc.sessions.get": SessionGetSchema,
  "ipc.sessions.resume": SessionResumeSchema,
  "ipc.sessions.fork": SessionForkSchema,
  // --- Hooks CFG-09 ------------------------------------------------------
  "ipc.hooks.getStatus": NoPayloadSchema,
  "ipc.hooks.evaluatePreToolUse": HookEvaluateSchema,
  "ipc.hooks.recordPostToolUse": HookEvaluateSchema,
  // --- Catálogo de modelos ------------------------------------------------
  "ipc.models.listProviders": NoPayloadSchema,
  "ipc.models.listModels": ModelsListSchema,
  // --- Red ---------------------------------------------------------------
  "ipc.net.fetch": EgoFetchSchema,
  // --- Isla flotante -----------------------------------------------------
  "ipc.floating.setMuted": FloatingSetMutedSchema,
  "ipc.floating.restoreMain": FloatingRestoreMainSchema,
  "ipc.floating.toggle": FloatingToggleSchema,
  // --- Voz ---------------------------------------------------------------
  "ipc.voice.getStatus": NoPayloadSchema,
  "ipc.voice.setConfig": VoiceSettingsSchema.partial(),
  "ipc.voice.stt": VoiceSttSchema,
  "ipc.voice.tts": VoiceTtsSchema,
};

export {
  VoiceSttSchema,
  VoiceTtsSchema,
  VoiceSettingsSchema,
  LlmCancelSchema,
  type VoiceSttRequest,
  type VoiceTtsRequest,
  type VoiceSettings,
  type LlmCancelRequest,
} from "./ipc/schema.js";
