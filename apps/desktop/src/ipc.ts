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
] as const;

/** Superficie IPC total (invoke + push). Nombre histórico conservado. */
export const EgoIpc = [...EgoIpcInvokeChannels, ...EgoIpcPushChannels] as const;

export type EgoIpcChannel = (typeof EgoIpc)[number];
export type EgoIpcInvokeChannel = (typeof EgoIpcInvokeChannels)[number];
export type EgoIpcPushChannel = (typeof EgoIpcPushChannels)[number];
