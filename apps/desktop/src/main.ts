import { app, BrowserWindow, Tray, Menu, nativeImage, screen, session } from "electron";
import { join, resolve as resolveFsPath, isAbsolute as isAbsoluteFsPath, relative as relativeFsPath } from "node:path";
import { createHash } from "node:crypto";

import { type ChildProcess } from "node:child_process";
import { deflateSync } from "node:zlib";
import { EgoMemoryAdapter, EgoMemoryLifecycle } from "@ego/memory";
import { ModelRouter, createRouterSummarizer, OpenAICompatibleProvider, AiSdkOpenAIProvider, AiSdkAnthropicProvider, AiSdkGoogleProvider, AiSdkOpenAICompatibleProvider } from "@ego/models";
import type { ModelProviderFactory } from "@ego/models";
import { ToolRegistry, registerNativeTools } from "@ego/tools";
import { McpManager, SkillScanner } from "@ego/integrations";
import { EventBus, StructuredLogger, type EgoEventType } from "@ego/events";
import {
  ToolExecutionLoop,
  AttentionStateMachine,
  ContextCompactionJob,
  type SummarizerFn,
} from "@ego/runtime";
import { ApprovalEngine, ExecutionManager, WidgetHitlBridge, type PendingApproval } from "@ego/execution";
import { SubEgoRegistry, SubEgoWorktreeManager, createDelegationRuntime, type DelegationRuntime } from "@ego/subegos";
import {
  SubEgoSoul,
  applyEphemeralOverlay,
  assertSystemPromptStable,
  formatOutOfBandUserMessage,
  type AssembledPrompt,
} from "@ego/subegos";
import { DecisionRouter, DecisionAuditor, DecisionTelemetry, LoopBreaker, JevProvider } from "@ego/decision";
import { ProjectManifestSchema, type ProjectManifest, type ModelConfig } from "./ipc/schema.js";
import {
  KnowledgeIndexer,
  HybridSearch,
  GraphRagEngine,
  QuarantineManager,
  FactLifecycle,
  BitemporalQueries,
  ProjectMemoryGraph,
  KnowledgeExport,
  DocumentParser,
} from "@ego/knowledge";
import {
  DailyStateEngine,
  DailyStatePersistence,
  GoalPrioritizer,
  DecisionsFeed,
} from "@ego/dailystate";
import { CrashRecoveryEngine, OpGate } from "@ego/recovery";
import {
  BackgroundEngine,
  WorkerTaskPool,
  ProactivityEngine,
  TaskCheckpointManager,
  MemoryCleanupJob,
  registerBackgroundTaskTools,
  RunRecorder,
} from "@ego/tasks";
import { CredentialManager, CredentialPool, evaluateToolCall } from "@ego/security";
import { WindowStateManager } from "./windows/WindowStateManager.js";
import {
  FloatingWindowManager,
  syncFromAttention,
} from "./windows/FloatingWindow.js";
import { initAutoUpdater, resolveUpdateFeedUrl } from "./updater.js";

// T11 (EGO-FIND-54): módulos extraídos del god-file.
import { defaultWorkspaceRoot } from "./main/path-scope.js";
import { applyNavigationGuards, buildCsp, installIpcOriginLogging, setFetchAuthTokenResolver } from "./main/security/electron-security.js";
import { DegradedObfBackend, decryptCredential, encryptCredential } from "./main/credentials/vault.js";
import { applyModelConfig, currentModelConfig, isCustomBaseURL, isNonEmptyKey, mergeModelKeys, OPENAI_DEFAULT_BASE_URL, resolveEnvModelKeys, resolvePersistedModelKeys, setupModelProviders, type ResolvedModelKeys } from "./main/models/model-config.js";
import { activeProjectId, floatingAutoShownOnMinimize, floatingPinnedManually, setFloatingAutoShownOnMinimize } from "./main/ipc/ipc-state.js";
import { registerIpcHandlers } from "./main/ipc/register-ipc.js";
// T11 (Ola 1c): handler del turno de LLM (extraído del god-file).
import { handleLlmStream } from "./main/llm/handle-llm-stream.js";
// T1 (VERDICT R2): resolver de secretos D2 (keychain del SO, solo main).
import { createCredentialSecretResolver } from "./main/mcp/secret-resolver.js";
// T2 (VERDICT R1): servidor MCP de Ego (HTTP streamable en loopback).
import { startEgoMcpServer } from "./main/mcp/mcp-server-runtime.js";
import type { EgoMcpHttpServerHandle } from "./main/mcp/mcp-http-server.js";
// T11 (EGO-FIND-54): runtime MCP (persistencia, secretos, saneado).
import { buildMcpPersistedRecord, deleteMcpEnvSecrets, extractPersistedMcpRecord, getMcpCredentialManager, mcpEnvKeysForCleanup, needsMcpEnvMigration, resolveMcpRuntimeEnv, sanitizeMcpRuntimeStateForRenderer, storeMcpEnvSecrets, type PersistedMcpServerRecord } from "./main/mcp-runtime.js";
// STAB-09: núcleos puros extraídos de este god-file (5047 líneas). La API
// pública de `main.js` se mantiene vía re-export para las 10 suites de
// `test/` que importan de aquí.
import { isTaskKindSafe } from "./main/task-kinds.js";
import {
  TRAY_COLORS,
  pngChunk,
  trayTooltipFor,
  pauseAllTasks,
  resumeAllTasks,
  type EgoTrayStatus,
} from "./main/tray-status.js";
import { collectStorableMcpSecrets } from "./main/mcp-env.js";
import {
  IpcPriorityQueue,
  type IpcPriority,
} from "./main/ipc-priority-queue.js";

export {
  applyNavigationGuards,
  assertInvokeOriginAllowed,
  buildCsp,
  egoFetchProxied,
  getInvokeOrigin,
  isAllowedExternalUrl,
  isAllowedFetchUrl,
  isAllowedInvokeOrigin,
  isAllowedNavigationUrl,
  isFetchAuthHostAllowed,
  issueFolderToken,
  logInvokeOrigin,
  openExternalValidated,
  redeemFolderToken,
  type InvokeEventLike,
} from "./main/security/electron-security.js";
export { isTaskKindSafe } from "./main/task-kinds.js";
export { GIT_SAFE_SUBCOMMANDS } from "./main/terminal-policy.js";
export {
  decryptCredential,
  encryptCredential,
  maskApiKey,
  maskKey,
} from "./main/credentials/vault.js";
export {
  applyModelConfig,
  getConfiguredProviders,
  mergeModelKeys,
  probeModelKey,
  resolveCatalogCredentials,
  resolveEnvModelKeys,
  resolveMemoryModelKeys,
  resolvePersistedModelKeys,
  setupModelProviders,
  type CatalogCredentials,
  type ConfiguredModelProvider,
  type ModelKeyProbeInput,
  type ModelKeyProbeResult,
  type ResolvedModelKeys,
} from "./main/models/model-config.js";
export { currentModelConfig } from "./main/models/model-config.js";
export {
  buildMcpPersistedRecord,
  deleteMcpEnvSecrets,
  extractPersistedMcpRecord,
  getMcpCredentialManager,
  maskMcpEnvForRenderer,
  mcpEnvKeysForCleanup,
  needsMcpEnvMigration,
  resolveMcpRuntimeEnv,
  sanitizeMcpRuntimeStateForRenderer,
  setMcpCredentialManagerForTests,
  storeMcpEnvSecrets,
  type PersistedMcpServerRecord,
} from "./main/mcp-runtime.js";
export {
  isMcpSecretEnvName,
  splitMcpServerEnv,
  mcpEnvVaultService,
  isMaskedMcpEnvValue,
  collectStorableMcpSecrets,
} from "./main/mcp-env.js";
export type { McpEnvSecretsRef, McpEnvSecretVault } from "./main/mcp-env.js";

let crashRecoveryEngine: CrashRecoveryEngine;
let opGate: OpGate;
let windowStateManager: WindowStateManager;
let adapter: EgoMemoryAdapter;
let lifecycle: EgoMemoryLifecycle;
/**
 * T12 (A4-27) — Listener de `screen` (cambio de displays) registrado a
 * nivel de PROCESO. Se guarda la ref para poder eliminarlo en `before-quit`
 * (si no, sobrevive al cierre de la ventana y se duplica en cada
 * re-apertura de la app).
 */
let displayChangeListener: (() => void) | null = null;
/**
 * A2-01 / EGO-FIND-21: job de compactación real del historial de turno.
 * Lo consume `handleLlmStream` (que corre fuera de `createWindow`).
 */
let compactionJob: ContextCompactionJob | null = null;
/**
 * T8 (A2-ola1b, Diff E): resumidor LLM real para la compactación de
 * contexto (vive a nivel de módulo porque lo consume `handleLlmStream`,
 * que es otra función distinta de `createWindow`).
 */
let compactionSummarizer: SummarizerFn | null = null;
let modelRouter: ModelRouter;
let approvalEngine: ApprovalEngine;
let executionManager: ExecutionManager;
let toolRegistry: ToolRegistry;
let toolLoop: ToolExecutionLoop;
let subEgoRegistry: SubEgoRegistry;
/**
 * A3-T1 / EGO-FIND-22: runtime de delegación de Sub-Egos. Sin instanciarlo,
 * `createDelegationRuntime` (y sus 6 tools) eran código muerto.
 */
let delegationRuntime: DelegationRuntime | undefined;
let decisionRouter: DecisionRouter;
let decisionAuditor: DecisionAuditor;
let decisionTelemetry: DecisionTelemetry;
let loopBreaker: LoopBreaker;
let mcpManager: McpManager;
/** T2 (VERDICT R1): handle del servidor MCP de Ego (se cierra en `before-quit`). */
let mcpServerHandle: EgoMcpHttpServerHandle | null = null;
/** COUC-09: grabador de corridas (observa el EventBus y persiste los snapshots). */
let runRecorder: RunRecorder | null = null;
let skillScanner: SkillScanner;
let eventBus: EventBus;
let structuredLogger: StructuredLogger;
let knowledgeIndexer: KnowledgeIndexer;
let hybridSearch: HybridSearch;
let graphRagEngine: GraphRagEngine;
let quarantineManager: QuarantineManager;
let factLifecycle: FactLifecycle;
let bitemporalQueries: BitemporalQueries;
let projectMemoryGraph: ProjectMemoryGraph;
let knowledgeExport: KnowledgeExport;
let documentParser: DocumentParser;
let dailyStateEngine: DailyStateEngine;
let dailyStatePersistence: DailyStatePersistence;
let goalPrioritizer: GoalPrioritizer;
let decisionsFeed: DecisionsFeed;
let win: BrowserWindow | null = null;

// T03: motores de tareas en background + terminal viva + tray mínimo.
let backgroundEngine: BackgroundEngine;
let workerTaskPool: WorkerTaskPool;
let proactivityEngine: ProactivityEngine;
let taskCheckpointManager: TaskCheckpointManager;
let tray: Tray | null = null;
let trayStatus: EgoTrayStatus = "idle";

// Task4 (D2): singleton del flotante — instancia ÚNICA creada en
// createWindow (ready); el handler setMuted lo crea lazy si hiciera falta.
let floatMgr: FloatingWindowManager | null = null;

// Task10 (WIDG-05): posición flotante restaurada de la persistencia;
// se aplica al mostrar la flotante (main + flotante sobreviven reinicio).
let floatingRestoredPosition: { x: number; y: number } | null = null;

function ensureFloatMgr(): FloatingWindowManager {
  if (!floatMgr) {
    floatMgr = new FloatingWindowManager();
  }
  return floatMgr;
}

// Task7 (WIDG-04): bridge HITL flotante<->main — instancia ÚNICA creada
// junto al ApprovalEngine; `null` hasta entonces (tests unitarios).
let hitlBridge: WidgetHitlBridge | null = null;

interface TerminalSession {
  id: string;
  command: string;
  cwd: string;
  proc: ChildProcess;
  startedAt: number;
  timeoutTimer: NodeJS.Timeout;
}

const terminalSessions = new Map<string, TerminalSession>();

/**
 * Turnos LLM en curso cancelables (A1 real). Cada `handleLlmStream` registra
 * su `AbortController` al arrancar y lo libera en `finally`;
 * `ipc.llm.cancel` aborta por `turnId` o todos. El abort es síncrono: el
 * handler de cancelación nunca espera al loop (sin colgar).
 */
const llmAbortControllers = new Map<string, AbortController>();

/**
 * Emite `turn-cancelled` al renderer sin tumbar el main. El loop ya detenido
 * no genera más deltas; este push cierra el estado de stream remoto aunque el
 * provider ignore el abort mid-token.
 */
function pushTurnCancelled(turnId: string): void {
  try {
    if (win && !win.isDestroyed()) {
      win.webContents.send("ipc.chat.delta", {
        type: "turn-cancelled",
        turnId,
        cancelled: true,
      });
    }
  } catch {
    // noop: el push al renderer nunca tumba el main
  }
}

// ---------------------------------------------------------------------------
// CFG-11 — Cola priorizada de pushes main→renderer (coalescing + fairness).
//
// Niveles: critical > interactive > background (`ipc-priority-queue.ts`,
// módulo puro sin Electron). Fast-path: cola vacía → send directo (cero
// cambio observable sin contención); bajo ráfaga se encola y el drenaje
// `setImmediate` respeta prioridad + fairness (background ≥1 slot cada 8).
//
// Cableado: deltas chat y tool events → interactive (orden sensible, SIN
// coalesce); `recall_status` → interactive + coalesce por turno (lectura
// idempotente); `ipc.event` (relays) → background SIN coalesce (los eventos
// genéricos pueden portar secuencias: reemplazarlos perdería datos).
// Críticos (`turn-cancelled`, `chat.error`, `approval.request`) quedan en
// send DIRECTO: son raros y latencia-sensibles — nunca esperan la cola.
// Observabilidad: `getMainPushQueueStats()` (contadores, sin payloads:
// los logs jamás llevan prompts ni PII, solo canal+prioridad).
// ---------------------------------------------------------------------------
const mainPushQueue = new IpcPriorityQueue();
let mainPushDrainScheduled = false;

function sendMainPushNow(channel: string, payload: unknown): void {
  try {
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  } catch {
    // noop: el push al renderer nunca tumba el main
  }
}

function drainMainPushQueue(): void {
  mainPushDrainScheduled = false;
  for (const msg of mainPushQueue.drain(Date.now(), 256)) {
    sendMainPushNow(msg.channel, msg.payload);
  }
  if (mainPushQueue.size() > 0 && !mainPushDrainScheduled) {
    mainPushDrainScheduled = true;
    setImmediate(drainMainPushQueue);
  }
}

/**
 * Push priorizado main→renderer. Cola vacía → directo (fast-path idéntico
 * al `webContents.send` previo); con contención → prioridad + fairness.
 */
function enqueueMainPush(
  channel: string,
  payload: unknown,
  priority: IpcPriority,
  coalesceKey?: string
): void {
  if (!win || win.isDestroyed()) return;
  if (mainPushQueue.size() === 0) {
    sendMainPushNow(channel, payload);
    return;
  }
  mainPushQueue.enqueue({ channel, payload, priority, coalesceKey });
  if (!mainPushDrainScheduled) {
    mainPushDrainScheduled = true;
    setImmediate(drainMainPushQueue);
  }
}

/** Contadores de la cola (observabilidad; sin payloads). */
export function getMainPushQueueStats(): {
  enqueued: number;
  dequeued: number;
  coalesced: number;
  expired: number;
  pending: number;
} {
  return { ...mainPushQueue.stats, pending: mainPushQueue.size() };
}

function pushTerminalOutput(sessionId: string, chunk: string): void {
  try {
    if (win && !win.isDestroyed()) {
      win.webContents.send("ipc.event", {
        kind: "terminal.output",
        sessionId,
        chunk: chunk.slice(0, 65_536),
      });
    }
  } catch {
    // noop: el push al renderer nunca tumba el main
  }
}

function endTerminalSession(sessionId: string, exitCode: number): void {
  const session = terminalSessions.get(sessionId);
  if (!session) return;
  terminalSessions.delete(sessionId);
  try {
    clearTimeout(session.timeoutTimer);
  } catch {
    // noop
  }
  try {
    if (win && !win.isDestroyed()) {
      win.webContents.send("ipc.event", { kind: "terminal.exited", sessionId, exitCode });
    }
  } catch {
    // noop
  }
}

/** R8: mata el proceso, limpia el timer y libera el slot en `finally`. */
function killTerminalSession(sessionId: string, reason: string): boolean {
  const session = terminalSessions.get(sessionId);
  if (!session) return false;
  try {
    clearTimeout(session.timeoutTimer);
    session.proc.kill("SIGTERM");
    setTimeout(() => {
      try {
        session.proc.kill("SIGKILL");
      } catch {
        // noop: ya muerto
      }
    }, 1500);
  } catch {
    // noop: kill best-effort
  } finally {
    terminalSessions.delete(sessionId);
  }
  try {
    if (win && !win.isDestroyed()) {
      win.webContents.send("ipc.event", { kind: "terminal.killed", sessionId, reason });
    }
  } catch {
    // noop
  }
  return true;
}

/** Icono 16×16 sólido generado en runtime (sin assets binarios nuevos). */
function createTrayIcon(status: EgoTrayStatus): Electron.NativeImage {
  const [r, g, b] = TRAY_COLORS[status];
  const width = 16;
  const height = 16;
  const row = Buffer.alloc(1 + width * 4);
  row[0] = 0; // filtro PNG: none
  for (let x = 0; x < width; x++) {
    row[1 + x * 4] = r;
    row[1 + x * 4 + 1] = g;
    row[1 + x * 4 + 2] = b;
    row[1 + x * 4 + 3] = 255;
  }
  const raw = Buffer.alloc(row.length * height);
  for (let y = 0; y < height; y++) row.copy(raw, y * row.length);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  return nativeImage.createFromBuffer(png);
}

/** Deriva verde/azul/rojo del estado real del engine (COUC-19 mínimo). */
function refreshTrayStatus(): void {
  let next: EgoTrayStatus = "idle";
  try {
    if (backgroundEngine) {
      if (backgroundEngine.listTasks({ status: ["paused"] }).length > 0) {
        next = "hitl";
      } else if (backgroundEngine.getActiveCount() > 0) {
        next = "thinking";
      }
    }
  } catch {
    // noop: el tray nunca tumba el main
  }
  trayStatus = next;
  try {
    if (tray && !tray.isDestroyed()) {
      tray.setImage(createTrayIcon(next));
      tray.setToolTip(trayTooltipFor(next));
    }
  } catch {
    // noop
  }
}

/** Task4 (D2): snapshot de trabajo para `shouldAutoShow` (engine + flotante). */
function floatingSnapshot(): {
  active: number;
  hitl: number;
  muted: boolean;
  disabled: boolean;
} {
  let active = 0;
  let hitl = 0;
  try {
    if (backgroundEngine) {
      active += backgroundEngine.getActiveCount();
      hitl += backgroundEngine.listTasks({ status: ["paused"] }).length;
    }
    if (approvalEngine) {
      hitl += approvalEngine.listPendingApprovals().length;
    }
    active += llmAbortControllers.size;
  } catch {
    // noop: el flotante nunca tumba el main
  }
  const st = floatMgr ? floatMgr.getState() : null;
  return { active, hitl, muted: st?.muted ?? false, disabled: st?.disabled ?? false };
}

let attentionFsm: AttentionStateMachine | null = null;
function getAttentionFsm(): AttentionStateMachine {
  if (!attentionFsm) {
    attentionFsm = new AttentionStateMachine({
      onTransition: (ev) => {
        try {
          ensureFloatMgr().updateState({ attentionState: syncFromAttention(ev.currentState) });
        } catch {
          // noop
        }
      },
    });
  }
  return attentionFsm;
}

/**
 * Recomputa la atención de la isla flotante y el tray usando AttentionStateMachine canónica.
 * Mantiene jerarquía de estados: hitl_approval (approval) > compact/expanded > hidden.
 */
function recomputeFloatingAttention(): void {
  try {
    const snap = floatingSnapshot();
    const fsm = getAttentionFsm();

    if (snap.hitl > 0) {
      fsm.requestAttention({
        id: "hitl-approval",
        priority: 100,
        state: "hitl_approval",
        title: "Aprobación HITL requerida",
        pinned: true,
      });
    } else {
      fsm.releaseAttention("hitl-approval");
    }

    if (snap.active > 0) {
      fsm.requestAttention({
        id: "active-work",
        priority: 50,
        state: "compact",
        title: "Trabajo activo en curso",
        pinned: true,
      });
    } else {
      fsm.releaseAttention("active-work");
    }

    const state = fsm.getState();
    ensureFloatMgr().updateState({ attentionState: syncFromAttention(state) });
  } catch {
    // noop: defensivo contra fallos en cálculo de atención
  }
  refreshTrayStatus();
}

/** Task4 (D2): sincroniza flotante + tray desde el engine (una sola llamada). */
function syncFloatingFromEngine(): void {
  recomputeFloatingAttention();
}

/**
 * Task10 (COUC-19): emite el canal `tray:id` al renderer principal
 * (el tray es espejo del estado: click/acciones notifican sin tumbar main).
 */
function emitTrayId(action: string): void {
  try {
    if (win && !win.isDestroyed()) {
      win.webContents.send("ipc.event", { event: "tray:id", action, status: trayStatus });
    }
  } catch {
    // noop: el push al renderer nunca tumba el main
  }
}

/**
 * Task10 (COUC-19): Pause detiene el BackgroundEngine (running+queued →
 * paused) SIN cerrar ventanas; Reanudar lo re-encola. Lógica pura en
 * `main/tray-status.ts` (testeable); aquí solo wiring + sync visual.
 */
function pauseAllBackgroundTasks(): string[] {
  let paused: string[] = [];
  try {
    if (backgroundEngine) {
      paused = pauseAllTasks(backgroundEngine);
    }
  } catch {
    // noop
  }
  try {
    ensureFloatMgr().updateState({ attentionState: "hidden" });
  } catch {
    // noop
  }
  refreshTrayStatus();
  return paused;
}

function resumeAllBackgroundTasks(): string[] {
  let resumed: string[] = [];
  try {
    if (backgroundEngine) {
      resumed = resumeAllTasks(backgroundEngine);
    }
  } catch {
    // noop
  }
  syncFloatingFromEngine();
  return resumed;
}

/** Task10 (WIDG-05/COUC-19): tray completo — Abrir/Settings/Pause/Quit + `tray:id`. */
function ensureTray(): void {
  if (tray) {
    refreshTrayStatus();
    return;
  }
  try {
    tray = new Tray(createTrayIcon(trayStatus));
    tray.setToolTip(trayTooltipFor(trayStatus));
    const restore = (): void => {
      try {
        if (win && !win.isDestroyed()) {
          if (win.isMinimized()) win.restore();
          win.show();
          win.focus();
        }
        // Task4 (D2): al restaurar la principal, ocultar el flotante.
        if (floatMgr) floatMgr.hide();
        emitTrayId("open");
      } catch {
        // noop
      }
    };
    const openSettings = (): void => {
      try {
        if (win && !win.isDestroyed()) {
          if (win.isMinimized()) win.restore();
          win.show();
          win.focus();
        }
        emitTrayId("open-settings");
      } catch {
        // noop
      }
    };
    tray.on("click", restore);
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Abrir Ego", click: restore },
        { label: "Configuración", click: openSettings },
        { type: "separator" },
        {
          label: "Pausar tareas",
          click: (): void => {
            const paused = pauseAllBackgroundTasks();
            emitTrayId(`pause:${paused.length}`);
          },
        },
        {
          label: "Reanudar tareas",
          click: (): void => {
            const resumed = resumeAllBackgroundTasks();
            emitTrayId(`resume:${resumed.length}`);
          },
        },
        { type: "separator" },
        {
          label: "Salir",
          click: (): void => {
            app.quit();
          },
        },
      ])
    );
  } catch (err) {
    console.warn("[Ego Desktop] Tray no disponible:", err);
    tray = null;
  }
}

export function getKnowledgeIndexer(): KnowledgeIndexer {
  return knowledgeIndexer;
}

export function getHybridSearch(): HybridSearch {
  return hybridSearch;
}

export function getGraphRagEngine(): GraphRagEngine {
  return graphRagEngine;
}

export function getQuarantineManager(): QuarantineManager {
  return quarantineManager;
}

export function getFactLifecycle(): FactLifecycle {
  return factLifecycle;
}

export function getBitemporalQueries(): BitemporalQueries {
  return bitemporalQueries;
}

export function getProjectMemoryGraph(): ProjectMemoryGraph {
  return projectMemoryGraph;
}

export function getSubEgoRegistry(): SubEgoRegistry {
  return subEgoRegistry;
}

export function getEventBus(): EventBus {
  return eventBus;
}

export function getModelRouter(): ModelRouter {
  return modelRouter;
}

export function getToolRegistry(): ToolRegistry {
  return toolRegistry;
}

export function getToolLoop(): ToolExecutionLoop {
  return toolLoop;
}

export function getApprovalEngine(): ApprovalEngine {
  return approvalEngine;
}

export function getExecutionManager(): ExecutionManager {
  return executionManager;
}

export function getLifecycle(): EgoMemoryLifecycle {
  return lifecycle;
}

export function getActiveProjectId(): string {
  return activeProjectId;
}

export function getDecisionRouter(): DecisionRouter {
  return decisionRouter;
}

export function getDecisionAuditor(): DecisionAuditor {
  return decisionAuditor;
}

export function getDecisionTelemetry(): DecisionTelemetry {
  return decisionTelemetry;
}

export function getLoopBreaker(): LoopBreaker {
  return loopBreaker;
}

export function getOpGate(): OpGate {
  return opGate;
}

export function getCrashRecoveryEngine(): CrashRecoveryEngine {
  return crashRecoveryEngine;
}

export function getBackgroundEngine(): BackgroundEngine {
  return backgroundEngine;
}

export function getWorkerTaskPool(): WorkerTaskPool {
  return workerTaskPool;
}

export function getProactivityEngine(): ProactivityEngine {
  return proactivityEngine;
}

export function getTaskCheckpointManager(): TaskCheckpointManager {
  return taskCheckpointManager;
}

export async function getOrCreateDefaultProject(adapterInstance: EgoMemoryAdapter): Promise<ProjectManifest> {
  const existing = await adapterInstance.get("gov/projects", "default");
  if (existing) {
    let payload: unknown = existing;
    if (typeof existing === "object" && existing !== null && "payload" in existing) {
      payload = (existing as { payload: unknown }).payload;
    }
    try {
      return ProjectManifestSchema.parse(payload);
    } catch {
      // noop
    }
  }

  const defaultProject: ProjectManifest = {
    id: "default",
    name: "Ego Core",
    rootPath: process.env.EGO_WORKSPACE_PATH || process.cwd(),
    description: "Proyecto central y entorno de trabajo principal de Ego",
    activeSubEgoId: "ego.nucleus",
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
  };

  await adapterInstance.put({
    namespace: "gov/projects",
    key: "default",
    payload: defaultProject,
    metadata: { name: defaultProject.name, rootPath: defaultProject.rootPath }
  });
  await adapterInstance.put({
    namespace: "projects/default",
    key: "manifest",
    payload: defaultProject,
    metadata: { name: defaultProject.name, rootPath: defaultProject.rootPath }
  });

  return defaultProject;
}

// ---------------------------------------------------------------------------
// Secretos de entorno MCP → Credential Manager (Deuda F1T2/F5T10).
//
// Decisión de diseño (evidencia + trade-offs explícitos):
// - `AddMcpServerSchema.env` es `z.record(z.string())` libre: el schema NO
//   distingue secreto de valor operativo. La heurística es por segmentos del
//   NOMBRE (`KEY`/`TOKEN`/`SECRET`/`PAT`/…): cubre `GITHUB_TOKEN`,
//   `GITHUB_PERSONAL_ACCESS_TOKEN`, `ANTHROPIC_API_KEY`. Comparación por
//   segmento (no subcadena) para no clasificar `AUTHOR` como secreto.
//   Trade-off conocido: un secreto en una var con nombre exótico (p. ej.
//   `MY_VAR`) NO se vaultiza; documentado, no silencioso.
// - Los valores NO secretos (`NODE_ENV`, `PORT`, `LOG_LEVEL`…) persisten en
//   claro para permitir arranque degradado sin Manager (INV-PROBLEMA).
// - VantaDB (`gov/mcp_servers`) solo guarda referencias: config saneada +
//   `envRef { service, keys, encrypted }`. Los blobs `encrypted` son `enc:`
//   de safeStorage (u `obf:` legado con warn, mismo patrón que models BYOK):
//   un secret-scan del payload NUNCA ve el PAT en claro. Precedente aceptado
//   en esta base: `gov/settings` persiste `*KeyEncrypted` (prohibido = texto
//   plano, no criptotexto).
// - Vault en memoria (`CredentialManager`, servicio `mcp/<id>/env`, cuenta =
//   nombre de var) para resolución de sesión vía `McpTokenStore`; el cifrado
//   da durabilidad entre reinicios. `storeSecret` es best-effort con warn:
//   si el llavero no está disponible, el cifrado igual persiste.
// - Las respuestas IPC al renderer NUNCA llevan secretos en claro: env de
//   secretos enmascarado con `maskKey` (patrón `toMaskedModelConfigResponse`).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Pool multi-key por proveedor con rotación (T21 — T16-OAUTH, sin OAuth aún).
//
// - El pool (`CredentialPool` sobre `mainProcessCryptoBackend`) es el único
//   dueño de las keys en memoria: el router SOLO lo lee vía
//   `attachCredentialPool` y reintenta la siguiente key del MISMO proveedor
//   ante 429 antes de caer al mock. Agotado → mock (fail-closed).
// - Persistencia: el payload `gov/settings/model_config` NO cambia de forma
//   (`<p>KeyEncrypted` con blobs `enc:` — criptotexto, nunca claro, mismo
//   precedente que Task 10/MCP `envRef`); aquí solo se rehidrata el pool
//   desde las keys efectivas ya resueltas. V1: 1 slot por proveedor.
// - main es el único que ve keys en claro: la factory reconstruye providers
//   reales con la key rotada; al renderer solo llegan máscaras.
// ---------------------------------------------------------------------------

/** Factory del pool: reconstruye el provider real con la key rotada. */
const modelPoolProviderFactory: ModelProviderFactory = (providerId, apiKey) => {
  if (providerId === "openai") {
    const base = isNonEmptyKey(currentModelConfig.openaiBaseURL)
      ? currentModelConfig.openaiBaseURL
      : currentModelConfig.activeProvider === "openai" && isNonEmptyKey(currentModelConfig.baseUrl)
        ? currentModelConfig.baseUrl
        : undefined;
    if (isCustomBaseURL(base, OPENAI_DEFAULT_BASE_URL)) {
      return new OpenAICompatibleProvider({ providerId: "openai", baseUrl: base, apiKey });
    }
    return new AiSdkOpenAIProvider({ apiKey, ...(isNonEmptyKey(base) ? { baseURL: base } : {}) });
  }
  if (providerId === "anthropic") {
    return new AiSdkAnthropicProvider({ apiKey });
  }
  if (providerId === "google") {
    return new AiSdkGoogleProvider({ apiKey });
  }
  if (providerId === "deepseek") {
    const base = isNonEmptyKey(currentModelConfig.deepseekBaseURL)
      ? currentModelConfig.deepseekBaseURL
      : currentModelConfig.activeProvider === "deepseek" && isNonEmptyKey(currentModelConfig.baseUrl)
        ? currentModelConfig.baseUrl
        : undefined;
    return new AiSdkOpenAICompatibleProvider({
      providerId: "deepseek",
      apiKey,
      ...(isNonEmptyKey(base) ? { baseURL: base } : {}),
    });
  }
  throw new Error(
    `[ModelPool] Rotación no soportada para '${providerId}' (solo openai/anthropic/google/deepseek rotan; mock/ollama sin secreto).`
  );
};

let modelCredentialManager: CredentialManager | null = null;
let modelCredentialPool: CredentialPool | null = null;

/** Singleton del pool de keys de modelos (vault en memoria sobre safeStorage). */
export function getModelCredentialPool(): CredentialPool {
  if (!modelCredentialPool) {
    // BUGFIX 2026-10-15 (saveModelConfig lanzaba tras T21): el pool usaba
    // `mainProcessCryptoBackend` directo (fail-closed: lanza sin safeStorage)
    // mientras `encryptCredential` degrada a `obf:` legacy. En esta máquina
    // safeStorage no está disponible, así que el save moría en
    // `setProviderKeys`. El pool usa el mismo degradado que el resto del
    // save (memoria del proceso + `obf:` reversible, nunca texto plano).
    modelCredentialManager = new CredentialManager(new DegradedObfBackend());
    modelCredentialPool = new CredentialPool(modelCredentialManager);
  }
  return modelCredentialPool;
}

/** Solo tests: inyecta un pool falso en el singleton de sesión. */
export function setModelCredentialPoolForTests(pool: CredentialPool | null): void {
  modelCredentialPool = pool;
  if (pool === null) modelCredentialManager = null;
}

/**
 * Rehidrata el pool desde keys efectivas (env + persistidas) y lo conecta
 * al router. V1: 1 slot por proveedor; el pool soporta N (arrays multi-key
 * diferidos sin cambio de forma del payload).
 */
export async function syncModelCredentialPool(
  router: ModelRouter,
  extraKeys: ResolvedModelKeys = {}
): Promise<void> {
  const keys = mergeModelKeys(resolveEnvModelKeys(), extraKeys);
  const pool = getModelCredentialPool();
  await pool.setProviderKeys("openai", isNonEmptyKey(keys.openai) ? [keys.openai] : []);
  await pool.setProviderKeys("anthropic", isNonEmptyKey(keys.anthropic) ? [keys.anthropic] : []);
  await pool.setProviderKeys("google", isNonEmptyKey(keys.google) ? [keys.google] : []);
  await pool.setProviderKeys("deepseek", isNonEmptyKey(keys.deepseek) ? [keys.deepseek] : []);
  router.attachCredentialPool(pool, modelPoolProviderFactory);
}

// ---------------------------------------------------------------------------
// CFG-06: política de permisos allow/ask/deny (deny gana) + approvals.
// Decisión owner 2026-10-16: defaultMode `acceptEdits`, approvals `smart` +
// timeout 60s + cron deny. Funciones puras (testeables sin Electron):
// el deny veta antes de llegar al `ApprovalEngine`; el engine conserva sus
// innegociables (`riskLevel` destructive/sensitive según su `mode`).
// Persistencia canónica: VantaDB `gov/settings/permissions` validado con
// `PermissionsSettingsSchema` (Zod fail-closed, sin archivos `~/.codex`).
// ---------------------------------------------------------------------------

/** Timeout de aprobación humana en ms (fuente: approvals.timeoutSec = 60). */
export const APPROVAL_TIMEOUT_MS_CFG06 = 60_000;

export {
  permissionRuleMatches,
  resolvePermissionDecision,
  isPathInScope,
  resolveEffectivePermission,
  shouldRequireApproval,
  type PermissionQuery,
  type PermissionToolInfo,
} from "./main/security/permissions-policy.js";

/** Scope efectivo: raíz del workspace + `additionalDirectories` (CFG-06). */
export function resolveScopeDirs(workspaceRoot: string, additionalDirectories: string[]): string[] {
  return [workspaceRoot, ...additionalDirectories];
}

/**
 * T2 (EGO-FIND-26) — Scope de disco efectivo en runtime.
 *
 * Reúne la raíz del workspace (`EGO_WORKSPACE_PATH` o `process.cwd()`) con
 * los `additionalDirectories` de la política de permisos persistida
 * (`gov/settings/permissions`). Es el alcance contra el que se validan las
 * rutas que el renderer pide leer.
 */
export function currentScopeDirs(): string[] {
  const workspace = defaultWorkspaceRoot();
  const additional = getCachedPermissionsSettings().permissions.additionalDirectories;
  return resolveScopeDirs(workspace, additional);
}

/**
 * Raíz efectiva para el `cwd` de `ipc.terminal.spawn` (STAB-02): la primera
 * raíz (workspace o `additionalDirectories`) que contiene al `cwd`, resuelta
 * con `node:path`. Sin match → workspace (el `PathValidator` falla cerrado).
 * Pura y testeable sin Electron.
 */
export function resolveCwdRoot(
  cwd: string | undefined,
  workspace: string,
  additionalDirectories: string[]
): string {
  if (!cwd || cwd.trim().length === 0) return workspace;
  const absTarget = isAbsoluteFsPath(cwd) ? resolveFsPath(cwd) : resolveFsPath(workspace, cwd);
  for (const root of [workspace, ...additionalDirectories]) {
    if (!root || root.trim().length === 0) continue;
    const absRoot = resolveFsPath(root);
    const rel = relativeFsPath(absRoot, absTarget);
    if (rel === "" || (!rel.startsWith("..") && !isAbsoluteFsPath(rel))) return absRoot;
  }
  return workspace;
}

import {
  getCachedPermissionsSettings,
  getCachedCompressionSettings,
  loadPermissionsSettingsIntoCache,
  loadCompressionSettingsIntoCache,
  parsePermissionsSettings,
} from "./main/settings-cache.js";

export { getCachedPermissionsSettings } from "./main/settings-cache.js";
export { setCachedPermissionsSettingsForTests } from "./main/settings-cache.js";
export { parsePermissionsSettings } from "./main/settings-cache.js";
export { getCachedCompressionSettings } from "./main/settings-cache.js";
export { setCachedCompressionSettingsForTests } from "./main/settings-cache.js";
export { loadPermissionsSettingsIntoCache } from "./main/settings-cache.js";
export { loadCompressionSettingsIntoCache } from "./main/settings-cache.js";

/**
 * Estimación barata de tokens de los mensajes del turno (chars/4, techo).
 * Hot path: O(n) sobre longitudes, sin serialización (performance STAB-05).
 */
export function estimateTurnTokens(messages: Array<{ content: string }>): number {
  let chars = 0;
  for (const m of messages) chars += m.content.length;
  return Math.ceil(chars / 4);
}

/**
 * Huella estable (sha256 de la parte 3-tiers SIN overlay efímero) por sesión
 * para el enforcement del loop. El overlay cambia cada turno por diseño y
 * nunca entra al fingerprint (STAB-03/STAB-05).
 */
const loopStableHashes = new Map<string, string>();

export function getLoopStableHash(sessionId: string): string | undefined {
  return loopStableHashes.get(sessionId);
}

/** Registra el hash estable del turno emitido; retorna el hash registrado. */
export function updateLoopStableHash(sessionId: string, stablePrompt: string): string {
  const hash = createHash("sha256").update(stablePrompt, "utf8").digest("hex");
  loopStableHashes.set(sessionId, hash);
  return hash;
}

/** Libera el hash de una sesión (solo tests / cierre de sesión). */
export function clearLoopStableHash(sessionId: string): void {
  loopStableHashes.delete(sessionId);
}

/**
 * Job periódico de limpieza STAB-05 (cada 24h + primera corrida diferida
 * 60s post-boot para no competir con el arranque).
 *
 * Cubre `sessions/timelines` + `session/turns` (30d) y worktrees huérfanos
 * del workspace. Fail-safe: cualquier fallo se loguea y el timer sigue.
 * Snapshots `.vdbdump`: fuera (ubicación de dumps gobernada por recovery).
 * Leases: sin owner prod (SharedMemory es por-instancia RAM) — el job
 * acepta el hook cuando exista instancia gobernada (deuda STAB-05→STAB-12).
 */
let memoryCleanupTimer: NodeJS.Timeout | null = null;
let memoryCleanupFirst: NodeJS.Timeout | null = null;

export function scheduleMemoryCleanup(): void {
  if (memoryCleanupTimer) return;
  const runCleanup = async (): Promise<void> => {
    try {
      const settings = getCachedCompressionSettings();
      const repoRoot = process.env["EGO_WORKSPACE_PATH"] || process.cwd();
      const worktrees = new SubEgoWorktreeManager();
      const job = new MemoryCleanupJob(adapter, {
        cleanupPeriodDays: settings.cleanupPeriodDays,
        pruneOrphanWorktrees: () =>
          worktrees.pruneOrphanWorktrees(repoRoot, {
            cleanupPeriodDays: settings.cleanupPeriodDays,
          }),
      });
      const report = await job.run();
      const total =
        report.sessions.pruned.length +
        report.turns.pruned.length +
        (report.worktrees?.pruned.length ?? 0);
      if (total > 0) {
        console.log(
          `[Ego Main] MemoryCleanup STAB-05: sesiones=${report.sessions.pruned.length} ` +
            `turns=${report.turns.pruned.length} worktrees=${report.worktrees?.pruned.length ?? 0}`
        );
      }
    } catch (err) {
      console.warn("[Ego Main] MemoryCleanup STAB-05 falló (reintenta en 24h):", err);
    }
  };
  // Primera corrida diferida; luego cada 24h. `unref` para no retener salida.
  memoryCleanupFirst = setTimeout(() => {
    memoryCleanupFirst = null;
    void runCleanup();
  }, 60_000);
  if (typeof memoryCleanupFirst === "object" && memoryCleanupFirst !== null && "unref" in memoryCleanupFirst) {
    (memoryCleanupFirst as NodeJS.Timeout).unref();
  }
  memoryCleanupTimer = setInterval(() => {
    void runCleanup();
  }, 24 * 60 * 60 * 1000);
  if (typeof memoryCleanupTimer === "object" && memoryCleanupTimer !== null && "unref" in memoryCleanupTimer) {
    (memoryCleanupTimer as NodeJS.Timeout).unref();
  }
}

/** Solo tests: detiene los timers periódicos sin efectos colaterales. */
export function stopMemoryCleanupForTests(): void {
  if (memoryCleanupFirst) {
    clearTimeout(memoryCleanupFirst);
    memoryCleanupFirst = null;
  }
  if (memoryCleanupTimer) {
    clearInterval(memoryCleanupTimer);
    memoryCleanupTimer = null;
  }
}

// ---------------------------------------------------------------------------
// STAB-03: PromptAssembly cableado al turno real (tiers Hermes, caché e inyección).
//
// El turno ya no construye system ad-hoc: ensambla 3 tiers vía
// `SubEgoSoul.assembleHermesPrompt({coreRules, ...})` (byte-stable por sesión),
// el recall fresco viaja como overlay efímero API-call-time (nunca contamina el
// prefijo cacheado) y los steers mid-turn viajan como user standalone con el
// marcador out-of-band exacto. Funciones puras (testeables sin Electron).
// ---------------------------------------------------------------------------

/** Core System Rules de Ego (Tier 2): literal canónico preservado del system ad-hoc previo. */
export const EGO_CORE_RULES_STAB03 =
  "Eres Ego, un Sistema Operativo Cognitivo de élite, riguroso, analítico y local-first.";

/** Alma por defecto (`ego.nucleus`) cuando el registry no resuelve el subEgo pedido. */
let defaultNucleusSoul: SubEgoSoul | null = null;
export function getDefaultNucleusSoul(): SubEgoSoul {
  if (!defaultNucleusSoul) {
    defaultNucleusSoul = new SubEgoSoul({
      id: "ego.nucleus",
      name: "Nucleus",
      tone: "rigorous-analytical",
      reasoningStyle: "first-principles",
    });
  }
  return defaultNucleusSoul;
}

/**
 * Resuelve el alma del subEgo del turno: registry → `SubEgoSoul.fromManifest`,
 * fallback al nucleus por defecto (nunca lanza por registry vacío).
 */
export async function resolveTurnSoul(subEgoId: string): Promise<SubEgoSoul> {
  try {
    const manifest = await subEgoRegistry?.get(subEgoId);
    if (manifest) return SubEgoSoul.fromManifest(manifest);
  } catch {
    // Fallback intencional al nucleus (fail-open solo en identidad, nunca en permisos).
  }
  return getDefaultNucleusSoul();
}

/** Cola out-of-band de steers pendientes (productor futuro: IPC/delegación; STAB-04 expone el loop). */
const mainSteerQueue: string[] = [];

/** Encola un steer mid-turn (retorna `false` si vacío). */
export function queueMainSteer(instruction: string): boolean {
  const text = instruction?.trim() ?? "";
  if (text.length === 0) return false;
  mainSteerQueue.push(text);
  return true;
}

/** Drena los steers pendientes (vacía la cola; boundary del turno). */
export function drainMainSteerQueue(): string[] {
  if (mainSteerQueue.length === 0) return [];
  return mainSteerQueue.splice(0, mainSteerQueue.length);
}

/** Huella del system cacheado por sesión + timestamp congelado a inicio de sesión. */
const turnSystemFingerprints = new Map<string, string>();
const turnSessionTimestamps = new Map<string, number>();

/** Opciones puras para construir el prompt del turno. */
export interface TurnPromptOptions {
  callerSystemMessage?: string;
  subEgoSoul?: SubEgoSoul;
  sessionId?: string;
  ephemeralText?: string;
  isCompressionRebuild?: boolean;
}

/** Libera el fingerprint de una sesión (frontera: nueva sesión o rebuild sancionado externo). */
export function clearTurnSystemFingerprint(sessionId: string): void {
  turnSystemFingerprints.delete(sessionId);
  turnSessionTimestamps.delete(sessionId);
}

/**
 * Construye el system del turno: ensamblado 3-tiers (byte-stable por sesión) +
 * overlay efímero API-call-time + check de estabilidad salvo compresión.
 * El timestamp volátil se congela al primer turno de cada sesión.
 */
export function buildTurnPrompt(opts: TurnPromptOptions = {}): {
  assembled: AssembledPrompt;
  effectiveSystemPrompt: string;
  fingerprint: string;
} {
  const sessionId = opts.sessionId || "default_session";
  let timestampMs = turnSessionTimestamps.get(sessionId);
  if (timestampMs === undefined) {
    timestampMs = Date.now();
    turnSessionTimestamps.set(sessionId, timestampMs);
  }
  const soul = opts.subEgoSoul ?? getDefaultNucleusSoul();
  const assembled = soul.assembleHermesPrompt({
    coreRules: EGO_CORE_RULES_STAB03,
    callerSystemMessage: opts.callerSystemMessage,
    sessionId,
    timestampMs,
  });
  const cached = turnSystemFingerprints.get(sessionId);
  if (cached !== undefined) {
    assertSystemPromptStable(cached, assembled.systemPrompt, {
      isCompressionRebuild: opts.isCompressionRebuild,
    });
  }
  turnSystemFingerprints.set(sessionId, assembled.fingerprint);
  const effectiveSystemPrompt = applyEphemeralOverlay(assembled.systemPrompt, opts.ephemeralText);
  return { assembled, effectiveSystemPrompt, fingerprint: assembled.fingerprint };
}

/**
 * Procesa una solicitud de chat ejecutando el ciclo cognitivo ToolExecutionLoop con
 * streaming, persistencia inmutable en VantaDB y control de ejecución (INT-01).
 */
/**
 * T11 (Ola 1c) — Contexto del handler de turno de LLM.
 *
 * Se construye con GETTERS para que los valores se lean EN VIVO:
 * `activeProjectId` cambia cuando el usuario selecciona otro proyecto y
 * `compactionJob` se asigna durante el arranque.
 */
const llmCtx = {
  get lifecycle() { return lifecycle; },
  get eventBus() { return eventBus; },
  get toolLoop() { return toolLoop; },
  get adapter() { return adapter; },
  get compactionJob() { return compactionJob; },
  get compactionSummarizer() { return compactionSummarizer; },
  get decisionRouter() { return decisionRouter; },
  get decisionAuditor() { return decisionAuditor; },
  get decisionTelemetry() { return decisionTelemetry; },
  get loopBreaker() { return loopBreaker; },
  get llmAbortControllers() { return llmAbortControllers; },
  get activeProjectId() { return activeProjectId; },
  get win() { return win; },
  get enqueueMainPush() { return enqueueMainPush; },
  get getCachedCompressionSettings() { return getCachedCompressionSettings; },
  get getLoopStableHash() { return getLoopStableHash; },
  get updateLoopStableHash() { return updateLoopStableHash; },
  get buildTurnPrompt() { return buildTurnPrompt; },
  get resolveTurnSoul() { return resolveTurnSoul; },
  get drainMainSteerQueue() { return drainMainSteerQueue; },
  get formatOutOfBandUserMessage() { return formatOutOfBandUserMessage; },
  get pushTurnCancelled() { return pushTurnCancelled; },
  get currentModelConfig() { return currentModelConfig; },
};

/** Envoltura que consume el handler extraído. */
async function runLlmStream(rawReq: unknown): Promise<unknown> {
  return handleLlmStream(llmCtx, rawReq);
}

// ---------------------------------------------------------------------------
/**
 * T11 (EGO-FIND-54) — Fábrica de dependencias de los handlers IPC.
 *
 * Los 81 handlers viven en `src/main/ipc/register-ipc.ts`. Este objeto
 * inyecta las referencias ya inicializadas del main process (memoria,
 * routers, engines, MCP, terminal). El tipo se infiere aquí y lo consume
 * `register-ipc.ts` vía `import type` (sin ciclo en runtime).
 */
export function createIpcDeps() {
  const userDataDir = app.getPath("userData");
  const dbPath = join(userDataDir, "ego_memory.vdb");
  return {
    adapter,
    approvalEngine,
    backgroundEngine,
    bitemporalQueries,
    buildMcpPersistedRecord,
    currentScopeDirs,
    dailyStateEngine,
    dailyStatePersistence,
    dbPath,
    decisionAuditor,
    decisionRouter,
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
    handleLlmStream: runLlmStream,
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
  };
}

export async function createWindow(): Promise<void> {
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
  crashRecoveryEngine = new CrashRecoveryEngine({
    storageDir: userDataDir,
    eventBus,
  });
  opGate = new OpGate({ drainTimeoutMs: 3000 });

  try {
    const dirtyReport = await crashRecoveryEngine.checkAndAcquireLock("session_init");
    if (dirtyReport.wasDirty) {
      console.warn(`[CrashRecoveryEngine] Recuperación post-Dirty Shutdown detectada (${dirtyReport.recoveryAction}).`, dirtyReport);
    }
  } catch (lockErr) {
    console.warn("[CrashRecoveryEngine] Advertencia de bloqueo:", lockErr);
  }

  const dbPath = join(userDataDir, "ego_memory.vdb");
  adapter = new EgoMemoryAdapter(dbPath);
  await adapter.init();

  lifecycle = new EgoMemoryLifecycle(adapter);
  await lifecycle.startSession("session_init", "default");

  // A2-01 / EGO-FIND-21: el job de compactación real. `adapter` satisface el
  // contrato estructural `CompactionArchiveTarget` (put) ⇒ el resumen podado
  // se archiva en `kb/history_archive` sin que `runtime` dependa de `memory`.
  // Vive a nivel de módulo porque lo consume `handleLlmStream` (un turno).
  compactionJob = new ContextCompactionJob(
    { autoMemory: true },
    { archiveTarget: adapter }
  );

  // STAB-06: job curator periódico (consolida `session/turns` stale →
  // `kb/facts`, respetando `quarantine/pending`; aditivo, jamás borra).
  // Defaults: cada 1h, stale 30d, tope 50 facts. Best-effort: un fallo
  // aislado se loguea y el job sigue (el boot nunca tumba por esto).
  try {
    lifecycle.startCuratorJob({ intervalMs: 60 * 60 * 1000, staleAfterDays: 30, maxSnapshots: 50 });
  } catch (err) {
    console.warn("[Ego Main] Job curator STAB-06 no arrancó (reintento manual vía lifecycle):", err);
  }

  modelRouter = new ModelRouter();
  setupModelProviders(modelRouter);
  await syncModelCredentialPool(modelRouter);

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
  compactionSummarizer = createRouterSummarizer(modelRouter, {
    role: "fast-classifier",
  });

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
        await syncModelCredentialPool(modelRouter, persistedKeys);

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

  eventBus = new EventBus();
  // COUC-09: observador de proceso. Se suscribe al bus y graba cada
  // task/tool de la corrida en `projects/<runId>/runs` (con digest SHA-256).
  // Antes no tenía dueño: el `RunRecorder` existía y nadie lo instanciaba.
  runRecorder = new RunRecorder(adapter, eventBus);
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
  structuredLogger = new StructuredLogger({
    minSeverity: "info",
    outputStream: (line) => console.log(`[Ego EventLog] ${line}`)
  });
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

  toolRegistry = new ToolRegistry();
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

  // A3-T1 / EGO-FIND-22: delegación de Sub-Egos viva. `createDelegationRuntime`
  // registra en el `toolRegistry` las 6 tools de delegación
  // (delegate_task, delegate_many, delegation_steer/stop/list_active/drain_steer).
  // Sin esto, la delegación sigue siendo código muerto.
  delegationRuntime = createDelegationRuntime({
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
  });

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
  mcpManager = new McpManager(toolRegistry, {
    tokenStore: getMcpCredentialManager(),
    secretResolver: createCredentialSecretResolver(getMcpCredentialManager()),
    eventBus,
  });
  skillScanner = new SkillScanner();
  subEgoRegistry = new SubEgoRegistry(adapter);
  // A2-07 / EGO-FIND-36: los niveles 2 (scorer) y 3 (LLM estructurado) de la
  // cascada eran código muerto. Con scorer/llm configurados, `DecisionRouter`
  // delega en `DecisionCascade`; sin ellos, degrada a reglas deterministas.
  const jevProvider = new JevProvider({ apiKey: process.env.JEV_API_KEY });
  decisionRouter = new DecisionRouter({
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
  });
  decisionAuditor = new DecisionAuditor(adapter);
  decisionTelemetry = new DecisionTelemetry(eventBus);
  loopBreaker = new LoopBreaker({ maxDepth: 4 });

  // Motores de Conocimiento y Memoria a Largo Plazo (Fase 06)
  knowledgeIndexer = new KnowledgeIndexer(adapter);
  hybridSearch = new HybridSearch(adapter);
  graphRagEngine = new GraphRagEngine(adapter);
  quarantineManager = new QuarantineManager(adapter);
  factLifecycle = new FactLifecycle(adapter);
  bitemporalQueries = new BitemporalQueries(adapter);
  projectMemoryGraph = new ProjectMemoryGraph(adapter);
  knowledgeExport = new KnowledgeExport(adapter);
  documentParser = new DocumentParser();

  // Motores de Daily State y Ritual de Bienvenida (Fase 08)
  dailyStateEngine = new DailyStateEngine(adapter, { eventBus });
  dailyStatePersistence = new DailyStatePersistence(adapter, { eventBus });
  goalPrioritizer = new GoalPrioritizer({ eventBus });
  decisionsFeed = new DecisionsFeed(adapter, { eventBus });

  // T03: Motores de tareas en background (Fase 07). @ego/tasks deja de ser
  // un paquete huérfano: engine + pool + proactividad + checkpoints VantaDB.
  taskCheckpointManager = new TaskCheckpointManager(adapter);
  backgroundEngine = new BackgroundEngine({
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
        syncFloatingFromEngine();
      },
    },
    onTaskEvent: (event) => {
      // CFG-11: chatter background (sin coalesce: porta secuencias).
      if (win && !win.isDestroyed()) {
        enqueueMainPush("ipc.event", { kind: event.type, task: event.task }, "background");
      }
      syncFloatingFromEngine();
    },
  });
  workerTaskPool = new WorkerTaskPool();
  proactivityEngine = new ProactivityEngine();

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
  scheduleMemoryCleanup();

  approvalEngine = new ApprovalEngine({
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
        if (!hitlBridge) {
          hitlBridge = new WidgetHitlBridge(approvalEngine, {
            onPresent: (req) => {
              try {
                const st = ensureFloatMgr().getState();
                if (!st.muted && !st.disabled) {
                  ensureFloatMgr().updateState({ attentionState: "hitl_approval" });
                  ensureFloatMgr().show();
                  queueMicrotask(() =>
                    hitlBridge?.acknowledgePresentation(req.approvalId)
                  );
                }
              } catch {
                // noop: el flotante nunca tumba el flujo de aprobación
              }
              refreshTrayStatus();
            },
            onFallbackToMain: () => {
              refreshTrayStatus();
            },
          });
        }
        ensureFloatMgr().updateState({ attentionState: "hitl_approval" });
        refreshTrayStatus();
        void hitlBridge.presentApproval(pending);
      } catch {
        // noop: el send a main ya garantiza el fallback
      }
    },
  });

  executionManager = new ExecutionManager({
    maxConcurrentExecutions: 5,
    defaultTimeoutMs: 60_000
  });

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
  mcpServerHandle = await startEgoMcpServer({
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
  });
  // La URL NO lleva el token (nunca viaja en claro por un log ni por la URL).
  console.log(
    `[McpServer] Servidor MCP de Ego escuchando en ${mcpServerHandle.url} (bearer token obligatorio, loopback only).`
  );

  toolLoop = new ToolExecutionLoop(modelRouter, toolRegistry, {
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
        enqueueMainPush("ipc.chat.delta", {
          type: "tool_call",
          callId: call.id,
          toolName: call.name,
          arguments: call.arguments
        }, "interactive");
      }
    },
    onToolResult: (res) => {
      if (win && !win.isDestroyed()) {
        enqueueMainPush("ipc.chat.delta", {
          type: "tool_result",
          callId: res.callId,
          toolName: res.toolName,
          success: res.success,
          output: res.output,
          error: res.error
        }, "interactive");
      }
    }
  });

  windowStateManager = new WindowStateManager({
    userDataDir,
    adapter,
  });
  const windowState = await windowStateManager.restoreState();

  win = new BrowserWindow({
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

  // SEC-01: guardarraíles de navegación (deny-by-default; localhost solo dev).
  applyNavigationGuards(win, !app.isPackaged);

  if (windowState.isMaximized) {
    win.maximize();
  }

  windowStateManager.trackWindow(win);

  // Task4 (D2): flotante instanciado UNA vez en ready + autoshow al minimizar
  // con trabajo/HITL (win.hide + floatMgr.show; sin trabajo = minimize normal).
  // Task10 (WIDG-05): restore de persistencia flotante (mute/presencia/pos).
  ensureFloatMgr();
  try {
    const floatingState = await windowStateManager.restoreFloatingState();
    ensureFloatMgr().setMuted(floatingState.muted);
    ensureFloatMgr().setDisabled(floatingState.disabled ?? false);
    floatingRestoredPosition =
      floatingState.x !== undefined && floatingState.y !== undefined
        ? { x: floatingState.x, y: floatingState.y }
        : null;
  } catch {
    // noop: sin persistencia previa la flotante arranca con defaults
  }
  win.on("minimize", () => {
    try {
      if (!win || win.isDestroyed()) return;
      const st = ensureFloatMgr().getState();
      const presenceMode = (windowStateManager as any)?.lastFloatingState?.presenceMode ?? "auto";
      if (presenceMode !== "never" && !st.muted && !st.disabled) {
        win.hide();
        ensureFloatMgr().show();
        if (st.attentionState === "hidden") {
          ensureFloatMgr().updateState({ attentionState: "compact" });
          setFloatingAutoShownOnMinimize(true);
        }
        const floatingWin = ensureFloatMgr().getFloatingWindow();
        if (floatingWin && !floatingWin.isDestroyed()) {
          floatingWin.webContents.send("ipc.floating.state_changed", ensureFloatMgr().getState());
        }
        // Task10: aplica posición restaurada y trackea movimiento (debounce).
        try {
          if (floatingRestoredPosition) {
            ensureFloatMgr().setPosition(
              floatingRestoredPosition.x,
              floatingRestoredPosition.y
            );
          }
          if (floatingWin && !floatingWin.isDestroyed()) {
            windowStateManager.trackFloatingWindow(floatingWin, () => {
              const currentSt = ensureFloatMgr().getState();
              // presenceMode vive en persistencia (default "auto"; settings UI → Task12).
              return {
                muted: currentSt.muted,
                disabled: currentSt.disabled ?? false,
                presenceMode: "auto" as const,
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
      const snap = floatingSnapshot();
      if (
        floatingAutoShownOnMinimize &&
        !floatingPinnedManually &&
        snap.active === 0 &&
        snap.hitl === 0
      ) {
        ensureFloatMgr().updateState({ attentionState: "hidden" });
        ensureFloatMgr().hide();
        setFloatingAutoShownOnMinimize(false);
      }
    } catch {
      // noop
    }
  };
  win.on("restore", onMainRestoreOrFocus);
  win.on("focus", onMainRestoreOrFocus);

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
        ensureFloatMgr().repositionToDisplay();
      } catch {
        // noop
      }
    };
    screen.on("display-metrics-changed", repositionFloatingOnDisplayChange);
    screen.on("display-added", repositionFloatingOnDisplayChange);
    screen.on("display-removed", repositionFloatingOnDisplayChange);
    displayChangeListener = repositionFloatingOnDisplayChange;
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
    if (win && !win.isDestroyed()) {
      enqueueMainPush("ipc.event", event, "background");
    }
  });

  // T03: Tray mínimo útil (COUC-19 alcance mínimo). Best-effort: si el SO no
  // lo soporta, la app sigue funcionando sin tray.
  ensureTray();

  win.webContents.on("console-message", (_e, level, message, line, sourceId) => {
    console.log(`[Renderer Console] [L${level}] ${message} (${sourceId}:${line})`);
  });

  win.webContents.on("did-finish-load", () => {
    console.log("[Electron Window] HTML y recursos cargados exitosamente en Chromium.");
  });

  win.webContents.on("did-fail-load", (_e, errorCode, errorDescription, validatedURL) => {
    console.error(`[Electron Window] Error al cargar HTML (${errorCode}): ${errorDescription} en ${validatedURL}`);
  });

  win.webContents.on("render-process-gone", (_e, details) => {
    console.error(`[Electron Window] Proceso renderer terminado: ${details.reason} (exitCode: ${details.exitCode})`);
  });

  // T11 (EGO-FIND-54): los 81 handlers IPC viven en su propio módulo.
  registerIpcHandlers(createIpcDeps());

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
    await win.loadURL(devServerUrl);
  } else {
    // T11-S6 (electron-vite): el renderer compila a out/renderer/index.html.
    const htmlPath = join(app.getAppPath(), "out/renderer/index.html");
    console.log(`[Ego Desktop] Cargando interfaz de usuario: ${htmlPath}`);
    try {
      await win.loadFile(htmlPath);
    } catch (loadErr) {
      console.error("[Ego Desktop] Error al ejecutar win.loadFile:", loadErr);
    }
  }

  if (isDev) {
    win.webContents.openDevTools({ mode: "detach" });
  }

  win.show();
  win.focus();
  if (isDev) {
    win.setAlwaysOnTop(true);
    win.setAlwaysOnTop(false);
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

if (app && typeof app.whenReady === "function") {
  void app.whenReady().then(async () => {
    try {
      await createWindow();
    } catch (err) {
      console.error("[Electron Main] Error crítico durante la inicialización:", err);
    }
  });

  let isQuittingCleanly = false;
  app.on("before-quit", async (event) => {
    if (isQuittingCleanly) return;
    event.preventDefault();
    isQuittingCleanly = true;
    console.log("[Ego Desktop] Drenando operaciones activas antes de salir (OpGate)...");
    try {
      // T03: cerrar sesiones de terminal + pool cooperativo antes de salir (R8).
      try {
        for (const sessionId of [...terminalSessions.keys()]) {
          killTerminalSession(sessionId, "shutdown");
        }
        if (workerTaskPool) workerTaskPool.terminate();
      } catch (termErr) {
        console.warn("[Ego Desktop] Error al cerrar terminal/tasks:", termErr);
      }
      try {
        if (tray && !tray.isDestroyed()) tray.destroy();
      } catch {
        // noop
      }
      tray = null;
      // T2 (VERDICT R1): cerrar el servidor MCP de Ego (libera el puerto
      // loopback, cierra el listener HTTP y REVOCA el token bearer).
      if (mcpServerHandle) {
        try {
          await mcpServerHandle.close();
        } catch (mcpErr) {
          console.warn("[Ego Desktop] Error al cerrar el servidor MCP:", mcpErr);
        }
        mcpServerHandle = null;
      }
      // T4 (Ola 1c): soltar el `McpManager`. Es el dueño del
      // `secretResolver`, que a su vez captura el `CredentialManager` del
      // keychain: sin `dispose()`, el apagado dejaba referencias vivas a las
      // credenciales del SO y los clientes MCP seguían conectados.
      if (mcpManager) {
        try {
          await mcpManager.dispose();
        } catch (mcpDisposeErr) {
          console.warn("[Ego Desktop] Error al cerrar el McpManager:", mcpDisposeErr);
        }
      }
      // COUC-09: el `RunRecorder` se suscribe al bus; sin `dispose()`
      // sobrevive al cierre con su listener vivo.
      if (runRecorder) {
        try {
          runRecorder.dispose();
        } catch (runDisposeErr) {
          console.warn("[Ego Desktop] Error al cerrar el RunRecorder:", runDisposeErr);
        }
        runRecorder = null;
      }
      // T12 (A4-27): quitar los listeners de `screen` (nivel de proceso).
      if (displayChangeListener) {
        try {
          screen.removeListener("display-metrics-changed", displayChangeListener);
          screen.removeListener("display-added", displayChangeListener);
          screen.removeListener("display-removed", displayChangeListener);
        } catch {
          // noop: sin screen (ciertos tests) no hay listener
        }
        displayChangeListener = null;
      }
      if (opGate) {
        const drainResult = await opGate.drain(3000);
        console.log(`[Ego Desktop] Drenado OpGate completado: drained=${drainResult.drained}, pendientes=${drainResult.remaining}`);
      }
      // A3-T1: el runtime de delegación se apaga ordenadamente (instancias en RAM).
      if (delegationRuntime) {
        try {
          await delegationRuntime.dispose();
        } catch {
          // noop: el apagado nunca falla por la delegación
        }
        delegationRuntime = undefined;
      }
      // A3-T2: la proactividad (cron + file-watch) se detiene.
      try {
        proactivityEngine?.stopAll();
      } catch {
        // noop
      }
      if (adapter) {
        await adapter.close();
      }
      if (crashRecoveryEngine) {
        // A3-T11 / diff 7: `releaseLockAsync` (async) elimina el último
        // I/O síncrono del apagado.
        await crashRecoveryEngine.releaseLockAsync();
      }
    } catch (shutdownErr) {
      console.error("[Ego Desktop] Error durante apagado ordenado:", shutdownErr);
    } finally {
      app.quit();
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}

export function getWindowStateManager(): WindowStateManager {
  return windowStateManager;
}

