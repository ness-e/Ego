/**
 * E6 (Ola 2) — Estado mutable del proceso main.
 *
 * ## Por qué existe
 * Antes de E6, `main.ts` declaraba **55 variables `let` mutables a nivel
 * de módulo** (el `adapter`, el `modelRouter`, el `toolLoop`, el
 * `eventBus`, el `tray`, el `mcpServerHandle`…). Eran el estado global
 * *de facto* del proceso: se inicializaban dentro de `createWindow()` y se
 * leían desde el handler de turno, el registro de IPC, el tray y el apagado.
 *
 * Esto los convierte en el **único sitio** donde vive el estado mutable del
 * proceso main, con dos reglas:
 *
 * 1. **Bindings vivos**: cada estado es un `export let` + un `set<Nombre>()`.
 *    El binding ESM importado es VIVO (el importador ve el valor actual),
 *    así que los consumidores no cambian: siguen recibiendo el estado por
 *    `createIpcDeps()` (main → `register-ipc.ts`) o por el `ctx` de
 *    `handle-llm-stream.ts`.
 * 2. **Un solo punto de escritura**: la mutación pasa por el setter, nunca
 *    por una asignación directa. Un estado mal inicializado se ve en el
 *    setter, no disperso por el arranque.
 *
 * ## Orden de inicialización
 * El estado se puebla durante el arranque (`createWindow`), en el mismo
 * orden que antes del refactor: memoria → modelos → aprobación → tools →
 * Sub-Egos → MCP → decisión → conocimiento → daily state → tareas → ventana.
 * Un estado leído antes de inicializarse es `undefined` exactamente igual
 * que antes (misma semántica, misma superficie de fallo).
 */

import type { CrashRecoveryEngine, OpGate } from "@ego/recovery";
import type { EgoMemoryAdapter, EgoMemoryLifecycle } from "@ego/memory";
import type { AttentionStateMachine, ContextCompactionJob, SummarizerFn, ToolExecutionLoop } from "@ego/runtime";
import type { ModelRouter } from "@ego/models";
import type { ApprovalEngine, ExecutionManager, WidgetHitlBridge } from "@ego/execution";
import type { ToolRegistry } from "@ego/tools";
// Ola 9 (A4): la curaduría programada de memoria (CFG-08) — su instancia
// viva es estado del proceso (E6: un único sitio).
import type { MemoryCurator } from "@ego/tasks";
import type { DelegationRuntime, SubEgoRegistry, SubEgoSoul } from "@ego/subegos";
import type { DecisionAuditor, DecisionRouter, DecisionTelemetry, LoopBreaker } from "@ego/decision";
import type { McpManager, SkillScanner } from "@ego/integrations";
import type { BackgroundEngine, ProactivityEngine, RunRecorder, TaskCheckpointManager, WorkerTaskPool } from "@ego/tasks";
import type { EventBus, StructuredLogger } from "@ego/events";
import type { BitemporalQueries, DocumentParser, FactLifecycle, GraphRagEngine, HybridSearch, KnowledgeExport, KnowledgeIndexer, ProjectMemoryGraph, QuarantineManager } from "@ego/knowledge";
import type { DailyStateEngine, DailyStatePersistence, DecisionsFeed, GoalPrioritizer } from "@ego/dailystate";
import type { CredentialManager, CredentialPool } from "@ego/security";
import type { BrowserWindow, Tray } from "electron";
import type { WindowStateManager } from "../../windows/WindowStateManager.js";
import type { FloatingWindowManager } from "../../windows/FloatingWindow.js";
import type { EgoMcpHttpServerHandle } from "../mcp/mcp-http-server.js";
import type { CompressionSettings } from "@ego/memory";
import type { ModelConfig, PermissionsSettings } from "../../ipc/schema.js";
import type { EgoTrayStatus } from "../tray-status.js";

export let crashRecoveryEngine: CrashRecoveryEngine;

/** Asigna `crashRecoveryEngine` (único punto de escritura del estado). */
export function setCrashRecoveryEngine(value: CrashRecoveryEngine): void {
  crashRecoveryEngine = value;
}

export let opGate: OpGate;

/** Asigna `opGate` (único punto de escritura del estado). */
export function setOpGate(value: OpGate): void {
  opGate = value;
}

export let windowStateManager: WindowStateManager;

/** Asigna `windowStateManager` (único punto de escritura del estado). */
export function setWindowStateManager(value: WindowStateManager): void {
  windowStateManager = value;
}

export let adapter: EgoMemoryAdapter;

/** Asigna `adapter` (único punto de escritura del estado). */
export function setAdapter(value: EgoMemoryAdapter): void {
  adapter = value;
}

export let lifecycle: EgoMemoryLifecycle;

/** Asigna `lifecycle` (único punto de escritura del estado). */
export function setLifecycle(value: EgoMemoryLifecycle): void {
  lifecycle = value;
}

/**
* T12 (A4-27) — Listener de `screen` (cambio de displays) registrado a
* nivel de PROCESO. Se guarda la ref para poder eliminarlo en `before-quit`
* (si no, sobrevive al cierre de la ventana y se duplica en cada
* re-apertura de la app).
*/
export let displayChangeListener: (() => void) | null = null;

/** Asigna `displayChangeListener` (único punto de escritura del estado). */
export function setDisplayChangeListener(value: (() => void) | null): void {
  displayChangeListener = value;
}

/**
* A2-01 / EGO-FIND-21: job de compactación real del historial de turno.
* Lo consume `handleLlmStream` (que corre fuera de `createWindow`).
*/
export let compactionJob: ContextCompactionJob | null = null;

/** Asigna `compactionJob` (único punto de escritura del estado). */
export function setCompactionJob(value: ContextCompactionJob | null): void {
  compactionJob = value;
}

/**
* T8 (A2-ola1b, Diff E): resumidor LLM real para la compactación de
* contexto (vive a nivel de módulo porque lo consume `handleLlmStream`,
* que es otra función distinta de `createWindow`).
*/
export let compactionSummarizer: SummarizerFn | null = null;

/** Asigna `compactionSummarizer` (único punto de escritura del estado). */
export function setCompactionSummarizer(value: SummarizerFn | null): void {
  compactionSummarizer = value;
}

export let modelRouter: ModelRouter;

/** Asigna `modelRouter` (único punto de escritura del estado). */
export function setModelRouter(value: ModelRouter): void {
  modelRouter = value;
}

export let approvalEngine: ApprovalEngine;

/** Asigna `approvalEngine` (único punto de escritura del estado). */
export function setApprovalEngine(value: ApprovalEngine): void {
  approvalEngine = value;
}

export let executionManager: ExecutionManager;

/** Asigna `executionManager` (único punto de escritura del estado). */
export function setExecutionManager(value: ExecutionManager): void {
  executionManager = value;
}

export let toolRegistry: ToolRegistry;

/** Asigna `toolRegistry` (único punto de escritura del estado). */
export function setToolRegistry(value: ToolRegistry): void {
  toolRegistry = value;
}

export let toolLoop: ToolExecutionLoop;

/** Asigna `toolLoop` (único punto de escritura del estado). */
export function setToolLoop(value: ToolExecutionLoop): void {
  toolLoop = value;
}

export let subEgoRegistry: SubEgoRegistry;

/** Asigna `subEgoRegistry` (único punto de escritura del estado). */
export function setSubEgoRegistry(value: SubEgoRegistry): void {
  subEgoRegistry = value;
}

/**
* A3-T1 / EGO-FIND-22: runtime de delegación de Sub-Egos. Sin instanciarlo,
* `createDelegationRuntime` (y sus 6 tools) eran código muerto.
*/
export let delegationRuntime: DelegationRuntime | undefined;

/** Asigna `delegationRuntime` (único punto de escritura del estado). */
export function setDelegationRuntime(value: DelegationRuntime | undefined): void {
  delegationRuntime = value;
}

export let decisionRouter: DecisionRouter;

/** Asigna `decisionRouter` (único punto de escritura del estado). */
export function setDecisionRouter(value: DecisionRouter): void {
  decisionRouter = value;
}

export let decisionAuditor: DecisionAuditor;

/** Asigna `decisionAuditor` (único punto de escritura del estado). */
export function setDecisionAuditor(value: DecisionAuditor): void {
  decisionAuditor = value;
}

export let decisionTelemetry: DecisionTelemetry;

/** Asigna `decisionTelemetry` (único punto de escritura del estado). */
export function setDecisionTelemetry(value: DecisionTelemetry): void {
  decisionTelemetry = value;
}

export let loopBreaker: LoopBreaker;

/** Asigna `loopBreaker` (único punto de escritura del estado). */
export function setLoopBreaker(value: LoopBreaker): void {
  loopBreaker = value;
}

export let mcpManager: McpManager;

/** Asigna `mcpManager` (único punto de escritura del estado). */
export function setMcpManager(value: McpManager): void {
  mcpManager = value;
}

/** T2 (VERDICT R1): handle del servidor MCP de Ego (se cierra en `before-quit`). */
export let mcpServerHandle: EgoMcpHttpServerHandle | null = null;

/** Asigna `mcpServerHandle` (único punto de escritura del estado). */
export function setMcpServerHandle(value: EgoMcpHttpServerHandle | null): void {
  mcpServerHandle = value;
}

/** COUC-09: grabador de corridas (observa el EventBus y persiste los snapshots). */
export let runRecorder: RunRecorder | null = null;

/** Asigna `runRecorder` (único punto de escritura del estado). */
export function setRunRecorder(value: RunRecorder | null): void {
  runRecorder = value;
}

export let skillScanner: SkillScanner;

/** Asigna `skillScanner` (único punto de escritura del estado). */
export function setSkillScanner(value: SkillScanner): void {
  skillScanner = value;
}

export let eventBus: EventBus;

/** Asigna `eventBus` (único punto de escritura del estado). */
export function setEventBus(value: EventBus): void {
  eventBus = value;
}

export let structuredLogger: StructuredLogger;

/** Asigna `structuredLogger` (único punto de escritura del estado). */
export function setStructuredLogger(value: StructuredLogger): void {
  structuredLogger = value;
}

export let knowledgeIndexer: KnowledgeIndexer;

/** Asigna `knowledgeIndexer` (único punto de escritura del estado). */
export function setKnowledgeIndexer(value: KnowledgeIndexer): void {
  knowledgeIndexer = value;
}

export let hybridSearch: HybridSearch;

/** Asigna `hybridSearch` (único punto de escritura del estado). */
export function setHybridSearch(value: HybridSearch): void {
  hybridSearch = value;
}

export let graphRagEngine: GraphRagEngine;

/** Asigna `graphRagEngine` (único punto de escritura del estado). */
export function setGraphRagEngine(value: GraphRagEngine): void {
  graphRagEngine = value;
}

export let quarantineManager: QuarantineManager;

/** Asigna `quarantineManager` (único punto de escritura del estado). */
export function setQuarantineManager(value: QuarantineManager): void {
  quarantineManager = value;
}

export let factLifecycle: FactLifecycle;

/** Asigna `factLifecycle` (único punto de escritura del estado). */
export function setFactLifecycle(value: FactLifecycle): void {
  factLifecycle = value;
}

export let bitemporalQueries: BitemporalQueries;

/** Asigna `bitemporalQueries` (único punto de escritura del estado). */
export function setBitemporalQueries(value: BitemporalQueries): void {
  bitemporalQueries = value;
}

export let projectMemoryGraph: ProjectMemoryGraph;

/** Asigna `projectMemoryGraph` (único punto de escritura del estado). */
export function setProjectMemoryGraph(value: ProjectMemoryGraph): void {
  projectMemoryGraph = value;
}

export let knowledgeExport: KnowledgeExport;

/** Asigna `knowledgeExport` (único punto de escritura del estado). */
export function setKnowledgeExport(value: KnowledgeExport): void {
  knowledgeExport = value;
}

export let documentParser: DocumentParser;

/** Asigna `documentParser` (único punto de escritura del estado). */
export function setDocumentParser(value: DocumentParser): void {
  documentParser = value;
}

export let dailyStateEngine: DailyStateEngine;

/** Asigna `dailyStateEngine` (único punto de escritura del estado). */
export function setDailyStateEngine(value: DailyStateEngine): void {
  dailyStateEngine = value;
}

export let dailyStatePersistence: DailyStatePersistence;

/** Asigna `dailyStatePersistence` (único punto de escritura del estado). */
export function setDailyStatePersistence(value: DailyStatePersistence): void {
  dailyStatePersistence = value;
}

export let goalPrioritizer: GoalPrioritizer;

/** Asigna `goalPrioritizer` (único punto de escritura del estado). */
export function setGoalPrioritizer(value: GoalPrioritizer): void {
  goalPrioritizer = value;
}

export let decisionsFeed: DecisionsFeed;

/** Asigna `decisionsFeed` (único punto de escritura del estado). */
export function setDecisionsFeed(value: DecisionsFeed): void {
  decisionsFeed = value;
}

export let win: BrowserWindow | null = null;

/**
 * Ola 11 · A4 (EGO-FIND-119) — Publica el estado de atención REAL al
 * renderer de la ventana principal.
 *
 * ## Por qué este canal y no otro
 * - **Reutiliza el relay que ya existe** (`ipc.event`, el mismo que los
 *   pushes de la isla y del terminal) → **cero canales IPC nuevos** ✓.
 * - El estado es el de la `AttentionStateMachine` canónica (la que ya usan
 *   la isla y el tray) → el canvas y la isla **no pueden divergir** ✓
 *   (derivar el estado en el renderer sería inventar un segundo verdad ✗).
 *
 * El renderer lo recibe en `useUiStore.attentionState` y lo pasa al
 * `CharacterPresence`.
 */
export function publishAttentionState(state: string): void {
  if (!win || win.isDestroyed()) return;
  try {
    win.webContents.send("ipc.event", { kind: "attention.state", state });
  } catch {
    // noop: el push al renderer nunca tumba el main
  }
}

/** Asigna `win` (único punto de escritura del estado). */
export function setWin(value: BrowserWindow | null): void {
  win = value;
}

export let backgroundEngine: BackgroundEngine;

/** Asigna `backgroundEngine` (único punto de escritura del estado). */
export function setBackgroundEngine(value: BackgroundEngine): void {
  backgroundEngine = value;
}

export let workerTaskPool: WorkerTaskPool;

/** Asigna `workerTaskPool` (único punto de escritura del estado). */
export function setWorkerTaskPool(value: WorkerTaskPool): void {
  workerTaskPool = value;
}

export let proactivityEngine: ProactivityEngine;

/** Asigna `proactivityEngine` (único punto de escritura del estado). */
export function setProactivityEngine(value: ProactivityEngine): void {
  proactivityEngine = value;
}

export let taskCheckpointManager: TaskCheckpointManager;

/** Asigna `taskCheckpointManager` (único punto de escritura del estado). */
export function setTaskCheckpointManager(value: TaskCheckpointManager): void {
  taskCheckpointManager = value;
}

export let tray: Tray | null = null;

/** Asigna `tray` (único punto de escritura del estado). */
export function setTray(value: Tray | null): void {
  tray = value;
}

export let trayStatus: EgoTrayStatus = "idle";

/** Asigna `trayStatus` (único punto de escritura del estado). */
export function setTrayStatus(value: EgoTrayStatus): void {
  trayStatus = value;
}

export let floatMgr: FloatingWindowManager | null = null;

/** Asigna `floatMgr` (único punto de escritura del estado). */
export function setFloatMgr(value: FloatingWindowManager | null): void {
  floatMgr = value;
}

export let floatingRestoredPosition: { x: number; y: number } | null = null;

/** Asigna `floatingRestoredPosition` (único punto de escritura del estado). */
export function setFloatingRestoredPosition(value: { x: number; y: number } | null): void {
  floatingRestoredPosition = value;
}

export let hitlBridge: WidgetHitlBridge | null = null;

/** Asigna `hitlBridge` (único punto de escritura del estado). */
export function setHitlBridge(value: WidgetHitlBridge | null): void {
  hitlBridge = value;
}

export let mainPushDrainScheduled: boolean = false;

/** Asigna `mainPushDrainScheduled` (único punto de escritura del estado). */
export function setMainPushDrainScheduled(value: boolean): void {
  mainPushDrainScheduled = value;
}

export let attentionFsm: AttentionStateMachine | null = null;

/** Asigna `attentionFsm` (único punto de escritura del estado). */
export function setAttentionFsm(value: AttentionStateMachine | null): void {
  attentionFsm = value;
}

export let modelCredentialManager: CredentialManager | null = null;

/** Asigna `modelCredentialManager` (único punto de escritura del estado). */
export function setModelCredentialManager(value: CredentialManager | null): void {
  modelCredentialManager = value;
}

export let modelCredentialPool: CredentialPool | null = null;

/** Asigna `modelCredentialPool` (único punto de escritura del estado). */
export function setModelCredentialPool(value: CredentialPool | null): void {
  modelCredentialPool = value;
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
export let memoryCleanupTimer: NodeJS.Timeout | null = null;

/**
 * Ola 9 (A4) — La curaduría programada de memoria (CFG-08) viva.
 *
 * El estado mutable del proceso vive AQUÍ (E6: un único sitio), no en el
 * módulo que la usa: `subsystems/memory-curation.ts` guarda aquí su
 * instancia viva para poder pararla en el apagado.
 */
export let memoryCurator: MemoryCurator | null = null;

/** Asigna `memoryCurator` (único punto de escritura del estado). */
export function setMemoryCurator(value: MemoryCurator | null): void {
  memoryCurator = value;
}

/** Asigna `memoryCleanupTimer` (único punto de escritura del estado). */
export function setMemoryCleanupTimer(value: NodeJS.Timeout | null): void {
  memoryCleanupTimer = value;
}

export let memoryCleanupFirst: NodeJS.Timeout | null = null;

/** Asigna `memoryCleanupFirst` (único punto de escritura del estado). */
export function setMemoryCleanupFirst(value: NodeJS.Timeout | null): void {
  memoryCleanupFirst = value;
}

/** Alma por defecto (`ego.nucleus`) cuando el registry no resuelve el subEgo pedido. */
export let defaultNucleusSoul: SubEgoSoul | null = null;

/** Asigna `defaultNucleusSoul` (único punto de escritura del estado). */
export function setDefaultNucleusSoul(value: SubEgoSoul | null): void {
  defaultNucleusSoul = value;
}

/**
 * E6 (Ola 2) — Estado que hasta ahora vivía en módulos de estado
 * dispersos (`ipc/ipc-state.ts`, `settings-cache.ts`,
 * `models/model-config.ts`). Vive aquí para que el proceso tenga UN único
 * sitio con su estado mutable. Los módulos_originadores lo re-exportan
 * (API pública intacta).
 */

/** Id del proyecto activo (`"default"` hasta que se seleccione uno). */
export let activeProjectId: string = "default";

/** Fija el proyecto activo. */
export function setActiveProjectId(value: string): void {
  activeProjectId = value;
}

/** Caché de la política de permisos resuelta (Zod fail-closed). */
export let cachedPermissionsSettings: PermissionsSettings | null = null;

/** Actualiza la caché de permisos. */
export function setCachedPermissionsSettings(value: PermissionsSettings | null): void {
  cachedPermissionsSettings = value;
}

/** La ventana flotante ya se mostró automáticamente al minimizar. */
export let floatingAutoShownOnMinimize = false;

/** Marca/limpia el auto-mostrado de la ventana flotante. */
export function setFloatingAutoShownOnMinimize(value: boolean): void {
  floatingAutoShownOnMinimize = value;
}

/** El usuario pineó la ventana flotante manualmente. */
export let floatingPinnedManually = false;

/** Marca/limpia el pin manual de la ventana flotante. */
export function setFloatingPinnedManually(value: boolean): void {
  floatingPinnedManually = value;
}

/** Caché de la configuración de compresión (fuente: VantaDB). */
export let cachedCompressionSettings: CompressionSettings | null = null;

/** Actualiza la caché de compresión. */
export function setCachedCompressionSettings(value: CompressionSettings | null): void {
  cachedCompressionSettings = value;
}

/**
 * Turnos LLM en curso cancelables (A1 real). Cada `handleLlmStream` registra
 * su `AbortController` al arrancar y lo libera en `finally`;
 * `ipc.llm.cancel` aborta por `turnId` o todos. El abort es síncrono: el
 * handler de cancelación nunca espera al loop (sin colgar).
 *
 * E6-res: es estado del proceso (un contenedor mutable) → vive aquí, no en
 * el compositor.
 */
export const llmAbortControllers = new Map<string, AbortController>();

/**
 * Configuración de modelo vigente en memoria (NUNCA sale del main).
 * Es estado del proceso: `main.ts` lo lee (binding vivo) y lo escribe con
 * `setCurrentModelConfig` (que delega en `setCurrentModelConfigState`).
 */
export let currentModelConfig: ModelConfig = {
  activeProvider: process.env.OPENAI_API_KEY ? "openai" : process.env.DEEPSEEK_API_KEY ? "deepseek" : "mock",
  apiKey: process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || "",
  baseUrl: process.env.OPENAI_BASE_URL || "",
  modelName: "",
};

/** Escribe la configuración de modelo vigente (estado del proceso). */
export function setCurrentModelConfigState(value: ModelConfig): void {
  currentModelConfig = { ...value };
}
