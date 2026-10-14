import { app, BrowserWindow, ipcMain, dialog, safeStorage, Tray, Menu, nativeImage, session } from "electron";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import { deflateSync } from "node:zlib";
import {
  EgoMemoryAdapter,
  EgoMemoryLifecycle,
  createSubEgoId,
  type EgoRecallStatus,
} from "@ego/memory";
import { ModelRouter, ModelMessage, OpenAICompatibleProvider, AiSdkOpenAIProvider, AiSdkAnthropicProvider, AiSdkGoogleProvider, AiSdkOpenAICompatibleProvider, MockProvider, OLLAMA_DEFAULT_BASE_URL, ModelCatalog, CATALOG_CACHE_TTL_MS, type CatalogProviderId } from "@ego/models";
import type { PreferredModel, ModelProviderFactory } from "@ego/models";
import { ToolRegistry, registerNativeTools, PathValidator, type ToolExecutionContext } from "@ego/tools";
import { McpManager, SkillScanner, type McpServerConfig, type McpServerRuntimeState } from "@ego/integrations";
import { EventBus, StructuredLogger } from "@ego/events";
import { ToolExecutionLoop, type LoopExecutionResult } from "@ego/runtime";
import { ApprovalEngine, ExecutionManager, type PendingApproval } from "@ego/execution";
import {
  SubEgoRegistry,
  SubEgoFactory,
  fromMemoryManifest,
  type SubEgoCreateInput,
  type SubEgoManifest,
} from "@ego/subegos";
import {
  DecisionRouter,
  DecisionAuditor,
  DecisionTelemetry,
  LoopBreaker,
  IntentRequestSchema,
  type DecisionVerdict
} from "@ego/decision";
import {
  MemoryOpSchema,
  CreateSubEgoSchema,
  ToggleSubEgoStateSchema,
  ApproveActionSchema,
  ResolveApprovalSchema,
  ChatStreamSchema,
  AddMcpServerSchema,
  RemoveMcpServerSchema,
  ToggleMcpServerSchema,
  ListToolsFilterSchema,
  ScanSkillsSchema,
  ProjectManifestSchema,
  CreateProjectSchema,
  SelectProjectSchema,
  type ProjectManifest,
  ModelConfigSchema,
  type ModelConfig,
  KnowledgeIngestSchema,
  KnowledgeHybridSearchSchema,
  KnowledgeGraphRagSchema,
  KnowledgeQuarantineActionSchema,
  KnowledgeAsOfSchema,
  KnowledgeExplainArtifactSchema,
  DailyStateGetSummarySchema,
  DailyStateRefineGoalsSchema,
  DailyStateGetDecisionsSchema,
  DailyStateResolveApprovalsBatchSchema,
  DailyStateJournalSchema,
  DailyStateFirstLaunchSchema,
  DomainGetSchema,
  DomainSwitchSchema,
  DomainEngineeringStatusSchema,
  DomainProductBacklogSchema,
  DomainKnowledgeSearchSchema,
  DomainAnalyticsSeriesSchema,
  DomainCrmDealsSchema,
  DecisionListAuditsSchema,
  KnowledgeExportSchema,
  KnowledgeImportSchema,
  DailyGetSnapshotSchema,
  DailyListSnapshotsSchema,
  TasksListSchema,
  TasksCancelSchema,
  TerminalSpawnSchema,
  TerminalStdinSchema,
  TerminalKillSchema,
  SessionsListSchema,
  SessionGetSchema,
  SessionResumeSchema,
  DailyListApprovalsSchema,
  ModelsListSchema,
} from "./ipc/schema.js";
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
} from "@ego/tasks";
import {
  CredentialManager,
  CredentialPool,
  SyncSafeStorageBackend,
} from "@ego/security";
import { WindowStateManager } from "./windows/WindowStateManager.js";
import { initAutoUpdater, resolveUpdateFeedUrl } from "./updater.js";

let crashRecoveryEngine: CrashRecoveryEngine;
let opGate: OpGate;
let windowStateManager: WindowStateManager;
let adapter: EgoMemoryAdapter;
let lifecycle: EgoMemoryLifecycle;
let modelRouter: ModelRouter;
let approvalEngine: ApprovalEngine;
let executionManager: ExecutionManager;
let toolRegistry: ToolRegistry;
let toolLoop: ToolExecutionLoop;
let subEgoRegistry: SubEgoRegistry;
let decisionRouter: DecisionRouter;
let decisionAuditor: DecisionAuditor;
let decisionTelemetry: DecisionTelemetry;
let loopBreaker: LoopBreaker;
let mcpManager: McpManager;
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
let activeProjectId: string = "default";

// T03: motores de tareas en background + terminal viva + tray mínimo.
let backgroundEngine: BackgroundEngine;
let workerTaskPool: WorkerTaskPool;
let proactivityEngine: ProactivityEngine;
let taskCheckpointManager: TaskCheckpointManager;
let tray: Tray | null = null;
type EgoTrayStatus = "idle" | "thinking" | "hitl";
let trayStatus: EgoTrayStatus = "idle";

/**
 * Conjunto seguro documentado para tareas (R5 deny-by-default): solo estos
 * `metadata.kind` ejecutan directo; cualquier otro queda `paused` y sale
 * vía HITL (`resume()` tras aprobación en ApprovalCard/ActivityTray).
 */
const TASK_SAFE_KINDS = new Set(["indexing", "sync", "maintenance", "notification"]);

interface TerminalSession {
  id: string;
  command: string;
  cwd: string;
  proc: ChildProcess;
  startedAt: number;
  timeoutTimer: NodeJS.Timeout;
}

const terminalSessions = new Map<string, TerminalSession>();
const MAX_TERMINAL_SESSIONS = 8;
const TERMINAL_DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Denylist en el ingress IPC (R5, defensa en profundidad). Espejo intencional
 * de `packages/tools/src/native/terminal/NativeTerminalTool.ts:10-17`: el
 * guardrail fuerte vive en el tool + `PathValidator` + `requiresApproval`;
 * este pre-chequeo evita siquiera spawnear lo letal desde el renderer
 * (untrusted). La lista es bypasseable por naturaleza — nunca es la única
 * defensa (decisión owner T03/R5).
 */
const TERMINAL_FORBIDDEN_PATTERNS = [
  /rm\s+-rf\s+[\/\\]/i,
  /rmdir\s+\/s\s+\/q\s+[a-zA-Z]:[\/\\]/i,
  /format\s+[a-zA-Z]:/i,
  /:(){ :|:& };:/,
  /mkfs/i,
  /dd\s+if=.*of=\/dev\/(sd|nvme|hd)/i,
];

/** Conjunto seguro documentado para `ipc.terminal.spawn` (R5 deny-by-default). */
const TERMINAL_SAFE_COMMANDS = new Set([
  "ls", "dir", "pwd", "echo", "cat", "type", "git", "pnpm", "node", "npm",
]);

/** Subcomandos de git de solo lectura permitidos en terminal viva. */
const GIT_SAFE_SUBCOMMANDS = new Set([
  "status", "diff", "log", "branch", "show", "rev-parse",
]);

function isTerminalCommandAllowed(command: string): boolean {
  const tokens = command.trim().split(/\s+/);
  const head =
    (tokens[0] ?? "").split(/[\\/]/).pop()?.toLowerCase().replace(/\.exe$/, "") ?? "";
  if (!TERMINAL_SAFE_COMMANDS.has(head)) return false;
  if (head === "git") {
    return GIT_SAFE_SUBCOMMANDS.has((tokens[1] ?? "").toLowerCase());
  }
  return true;
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

const TRAY_COLORS: Record<EgoTrayStatus, [number, number, number]> = {
  idle: [52, 211, 153], // verde esmeralda
  thinking: [56, 189, 248], // azul
  hitl: [251, 113, 133], // rojo
};

let crcTable: Int32Array | null = null;

function getCrcTable(): Int32Array {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crcTable[n] = c;
    }
  }
  return crcTable;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([typeBuf, data])) {
    crc = table[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
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

function trayTooltipFor(status: EgoTrayStatus): string {
  if (status === "thinking") return "Ego — pensando…";
  if (status === "hitl") return "Ego — requiere aprobación (HITL)";
  return "Ego — inactivo";
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

/** Tray mínimo útil: click restaura, menú Mostrar/Salir, tooltip de estado. */
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
      } catch {
        // noop
      }
    };
    tray.on("click", restore);
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Mostrar Ego", click: restore },
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

/**
 * Backend de cifrado canónico (@ego/security) sobre el safeStorage real del
 * main process (F1T2). La lógica cripto (prefijos `enc:`/`obf:`, base64,
 * errores fail-closed) vive en el paquete; este bloque solo adapta su API
 * síncrona, que es la que exigen los call sites de settings. El restore
 * `gov/settings` no cambia de semántica: vacío → `""`, sin cifrado del
 * SO → ofuscación legada `obf:` con warn (migración), nunca texto plano.
 */
const mainProcessCryptoBackend = new SyncSafeStorageBackend(
  typeof safeStorage !== "undefined" && safeStorage.isEncryptionAvailable()
    ? {
        isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
        encryptString: (plainText: string) => safeStorage.encryptString(plainText),
        decryptString: (encrypted: Buffer) => safeStorage.decryptString(encrypted),
      }
    : null
);

/**
 * Cifra una credencial sensible usando safeStorage del SO (Keychain/DPAPI).
 * Prohibición absoluta de guardar API keys en texto plano en VantaDB.
 */
export function encryptCredential(plainText: string): string {
  if (!plainText) return "";
  try {
    return mainProcessCryptoBackend.encrypt(plainText);
  } catch (err) {
    console.warn("[Security] Fallo al cifrar con safeStorage, usando ofuscación legada:", err);
    return `obf:${Buffer.from(plainText, "utf-8").toString("base64")}`;
  }
}

/**
 * Descifra una credencial sensible protegida por safeStorage del SO.
 */
export function decryptCredential(stored: string): string {
  if (!stored) return "";
  try {
    return mainProcessCryptoBackend.decrypt(stored);
  } catch (err) {
    console.warn("[Security] Fallo al descifrar credencial con safeStorage:", err);
  }
  return stored;
}

/**
 * Enmascara una API key para devolver a la UI sin exponer el secreto en claro (ej. sk-...3a8f).
 */
export function maskApiKey(key: string): string {
  return CredentialManager.maskSecret(key);
}

/** Alias del enmascarado de keys para respuestas hacia el renderer (nunca el secreto). */
export const maskKey = maskApiKey;

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

/** Segmentos de nombre de var de entorno que denotan secreto. */
const MCP_SECRET_ENV_SEGMENTS: ReadonlySet<string> = new Set([
  "KEY",
  "KEYS",
  "TOKEN",
  "TOKENS",
  "SECRET",
  "SECRETS",
  "PAT",
  "PATS",
  "PASSWORD",
  "PASSWD",
  "PWD",
  "AUTH",
  "CREDENTIAL",
  "CREDENTIALS",
  "PRIVATE",
  "SIGNATURE",
]);

/**
 * Heurística de secreto por nombre de variable de entorno (comparación por
 * segmento en mayúsculas; ver bloque de diseño F1T2/F5T10).
 */
export function isMcpSecretEnvName(name: unknown): boolean {
  if (typeof name !== "string" || name.length === 0) return false;
  const segments = name.toUpperCase().split(/[^A-Z0-9]+/);
  return segments.some((segment) => MCP_SECRET_ENV_SEGMENTS.has(segment));
}

/**
 * Divide un `env` MCP en valores públicos (persisten en claro) y nombres de
 * secretos (van al vault + `envRef`). Nunca registra ni retorna valores.
 */
export function splitMcpServerEnv(env: Record<string, string> | undefined): {
  publicEnv: Record<string, string>;
  secretNames: string[];
} {
  const publicEnv: Record<string, string> = {};
  const secretNames: string[] = [];
  if (!env) return { publicEnv, secretNames };
  for (const [name, value] of Object.entries(env)) {
    if (isMcpSecretEnvName(name)) {
      secretNames.push(name);
    } else if (typeof value === "string") {
      publicEnv[name] = value;
    }
  }
  return { publicEnv, secretNames };
}

/** Servicio del vault para un servidor: `mcp/<server-id>/env` (cuenta = var). */
export function mcpEnvVaultService(serverId: string): string {
  return `mcp/${serverId}/env`;
}

/**
 * Detecta valores enmascarados para el renderer (`sk-t...7890`, `••••`).
 * Una máscara NUNCA se almacena como secreto (patrón settings Task 10).
 */
export function isMaskedMcpEnvValue(value: unknown): boolean {
  return (
    typeof value === "string" && (value.includes("...") || value.includes("••••"))
  );
}

/** Referencia persistida a los secretos de un servidor (sin texto plano). */
export interface McpEnvSecretsRef {
  service: string;
  keys: string[];
  encrypted: Record<string, string>;
}

/** Registro `gov/mcp_servers`: config saneada + referencia opaca a secretos. */
export interface PersistedMcpServerRecord {
  config: McpServerConfig;
  enabled: boolean;
  envRef?: McpEnvSecretsRef;
}

/**
 * Superficie mínima del vault que los handlers MCP necesitan. `CredentialManager`
 * la satisface estructuralmente (también `McpTokenStore.getSecret`).
 */
export interface McpEnvSecretVault {
  storeSecret(service: string, account: string, secret: string): Promise<void>;
  getSecret(service: string, account: string): Promise<string | null>;
  deleteSecret(service: string, account: string): boolean | Promise<boolean>;
}

/**
 * Secretos almacenables del env entrante: no vacíos y no enmascarados. Las
 * máscaras del renderer se resuelven contra lo guardado, jamás se persisten.
 */
export function collectStorableMcpSecrets(
  env: Record<string, string> | undefined
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!env) return out;
  const { secretNames } = splitMcpServerEnv(env);
  for (const name of secretNames) {
    const value: unknown = env[name];
    if (typeof value === "string" && value.length > 0 && !isMaskedMcpEnvValue(value)) {
      out[name] = value;
    }
  }
  return out;
}

/**
 * Construye el payload persistible: config SIN secretos + `envRef` con blobs
 * `enc:` opacos. `encrypt` se inyecta (prod: `encryptCredential`).
 * Garantía: `JSON.stringify(resultado)` nunca contiene un secreto en claro.
 */
export function buildMcpPersistedRecord(
  config: McpServerConfig,
  enabled: boolean,
  encrypt: (plainText: string) => string
): PersistedMcpServerRecord {
  const { publicEnv } = splitMcpServerEnv(config.env);
  const secrets = collectStorableMcpSecrets(config.env);
  const names = Object.keys(secrets);
  const sanitized: McpServerConfig = { ...config };
  if (Object.keys(publicEnv).length > 0) {
    sanitized.env = publicEnv;
  } else {
    delete sanitized.env;
  }
  if (names.length === 0) {
    return { config: sanitized, enabled };
  }
  const encrypted: Record<string, string> = {};
  for (const name of names) {
    const value: unknown = secrets[name];
    if (typeof value === "string") {
      encrypted[name] = encrypt(value);
    }
  }
  return {
    config: sanitized,
    enabled,
    envRef: { service: mcpEnvVaultService(config.id), keys: names, encrypted },
  };
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== "object" || value === null) return false;
  return Object.values(value as Record<string, unknown>).every(
    (entry) => typeof entry === "string"
  );
}

/**
 * Tolera los shapes históricos de `gov/mcp_servers`: `{ config, enabled }`
 * legado con env en claro, envelope de adapter `{ payload }` y JSON en
 * string. Retorna `null` si no hay config válida. Sin `any`.
 */
export function extractPersistedMcpRecord(raw: unknown): PersistedMcpServerRecord | null {
  let node: unknown = raw;
  if (typeof node === "string") {
    try {
      node = JSON.parse(node) as unknown;
    } catch {
      return null;
    }
  }
  if (typeof node === "object" && node !== null && "payload" in node) {
    const envelope = node as { payload?: unknown };
    if (typeof envelope.payload === "object" && envelope.payload !== null) {
      node = envelope.payload;
    } else if (typeof envelope.payload === "string") {
      try {
        node = JSON.parse(envelope.payload) as unknown;
      } catch {
        return null;
      }
    }
  }
  if (typeof node !== "object" || node === null) return null;
  const record = node as Record<string, unknown>;
  const rawConfig = record.config;
  if (typeof rawConfig !== "object" || rawConfig === null) return null;
  const cfg = rawConfig as Record<string, unknown>;
  if (typeof cfg.id !== "string" || cfg.id.length === 0) return null;
  if (typeof cfg.name !== "string" || typeof cfg.command !== "string") return null;
  const config: McpServerConfig = {
    id: cfg.id,
    name: cfg.name,
    transport: cfg.transport === "sse" ? "sse" : "stdio",
    command: cfg.command,
  };
  if (
    Array.isArray(cfg.args) &&
    cfg.args.every((entry: unknown): entry is string => typeof entry === "string")
  ) {
    config.args = [...cfg.args];
  }
  if (isStringRecord(cfg.env)) {
    config.env = { ...cfg.env };
  }
  if (typeof cfg.cwd === "string") config.cwd = cfg.cwd;
  if (typeof cfg.toolPrefix === "string") config.toolPrefix = cfg.toolPrefix;
  if (typeof cfg.timeoutMs === "number" && Number.isInteger(cfg.timeoutMs) && cfg.timeoutMs > 0) {
    config.timeoutMs = cfg.timeoutMs;
  }
  const enabled = typeof record.enabled === "boolean" ? record.enabled : true;
  const rawRef = record.envRef;
  if (typeof rawRef === "object" && rawRef !== null) {
    const ref = rawRef as Record<string, unknown>;
    if (
      typeof ref.service === "string" &&
      Array.isArray(ref.keys) &&
      ref.keys.every((entry: unknown): entry is string => typeof entry === "string")
    ) {
      const encrypted: Record<string, string> = {};
      if (isStringRecord(ref.encrypted)) {
        Object.assign(encrypted, ref.encrypted);
      }
      return { config, enabled, envRef: { service: ref.service, keys: [...ref.keys], encrypted } };
    }
  }
  return { config, enabled };
}

/**
 * Un registro necesita migración si trae secretos en claro en `config.env`
 * sin `envRef` (deuda F1T2/F5T10). Patrón restore de models.
 */
export function needsMcpEnvMigration(persisted: PersistedMcpServerRecord): boolean {
  if (persisted.envRef) return false;
  const env = persisted.config.env;
  if (!env) return false;
  return Object.entries(env).some(
    ([name, value]) =>
      isMcpSecretEnvName(name) &&
      typeof value === "string" &&
      value.length > 0 &&
      !isMaskedMcpEnvValue(value)
  );
}

/**
 * Rehidrata el env runtime: público en claro + secretos (vault primero,
 * blob `enc:` como respaldo). Retorna `missingSecrets` para warn visible en
 * vez de arranque a ciegas. `vaultGet` se inyecta (prod: Credential Manager).
 */
export async function resolveMcpRuntimeEnv(
  persisted: PersistedMcpServerRecord,
  decrypt: (stored: string) => string,
  vaultGet?: (service: string, account: string) => Promise<string | null>
): Promise<{ env?: Record<string, string>; missingSecrets: string[] }> {
  const { publicEnv } = splitMcpServerEnv(persisted.config.env);
  const keys = persisted.envRef?.keys ?? [];
  const service = persisted.envRef?.service ?? mcpEnvVaultService(persisted.config.id);
  const encrypted = persisted.envRef?.encrypted ?? {};
  const merged: Record<string, string> = { ...publicEnv };
  const missingSecrets: string[] = [];
  for (const name of keys) {
    let value: string | null = null;
    if (vaultGet) {
      try {
        value = await vaultGet(service, name);
      } catch (err) {
        console.warn(`[Security] Vault inaccesible para MCP env '${name}':`, err);
      }
    }
    if ((value === null || value.length === 0) && typeof encrypted[name] === "string") {
      const blob: unknown = encrypted[name];
      if (typeof blob === "string") {
        try {
          const decrypted = decrypt(blob);
          if (decrypted.length > 0) value = decrypted;
        } catch (err) {
          console.warn(`[Security] No se pudo descifrar MCP env '${name}':`, err);
        }
      }
    }
    if (value !== null && value.length > 0) {
      merged[name] = value;
    } else {
      missingSecrets.push(name);
    }
  }
  return { env: Object.keys(merged).length > 0 ? merged : undefined, missingSecrets };
}

/**
 * Claves del vault a borrar al eliminar un servidor (referencia o legado).
 */
export function mcpEnvKeysForCleanup(persisted: PersistedMcpServerRecord): string[] {
  if (persisted.envRef) return [...persisted.envRef.keys];
  return splitMcpServerEnv(persisted.config.env).secretNames;
}

/**
 * Env para el renderer: secretos enmascarados, público intacto.
 */
export function maskMcpEnvForRenderer(
  env: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!env) return undefined;
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(env)) {
    out[name] = isMcpSecretEnvName(name) ? maskKey(value) : value;
  }
  return out;
}

/**
 * Estado runtime para el renderer sin secretos en claro (fuga IPC cerrada).
 */
export function sanitizeMcpRuntimeStateForRenderer(
  state: McpServerRuntimeState
): McpServerRuntimeState {
  const maskedEnv = maskMcpEnvForRenderer(state.config.env);
  if (maskedEnv === undefined) return state;
  return { ...state, config: { ...state.config, env: maskedEnv } };
}

/**
 * Vault de sesión para env MCP sobre el llavero del SO (vía
 * `mainProcessCryptoBackend`). Reutiliza `CredentialManager` canónico de
 * `@ego/security`; no duplica cripto. `storeSecret` puede lanzar sin
 * safeStorage: los handlers lo tratan best-effort con warn (el cifrado
 * persiste igual).
 */
let mcpCredentialManager: CredentialManager | null = null;

export function getMcpCredentialManager(): CredentialManager {
  if (!mcpCredentialManager) {
    mcpCredentialManager = new CredentialManager(mainProcessCryptoBackend);
  }
  return mcpCredentialManager;
}

/** Solo tests: inyecta un vault falso en el singleton de sesión. */
export function setMcpCredentialManagerForTests(manager: CredentialManager | null): void {
  mcpCredentialManager = manager;
}

/** Guarda secretos de un servidor en el vault (servicio `mcp/<id>/env`). */
export async function storeMcpEnvSecrets(
  vault: McpEnvSecretVault,
  serverId: string,
  secrets: Record<string, string>
): Promise<void> {
  const service = mcpEnvVaultService(serverId);
  for (const [name, value] of Object.entries(secrets)) {
    await vault.storeSecret(service, name, value);
  }
}

/** Borra secretos de un servidor del vault (best-effort, propaga errores). */
export async function deleteMcpEnvSecrets(
  vault: McpEnvSecretVault,
  serverId: string,
  names: string[]
): Promise<void> {
  const service = mcpEnvVaultService(serverId);
  for (const name of names) {
    await vault.deleteSecret(service, name);
  }
}

/**
 * Claves de proveedor resueltas SOLO en main (BYOK vía bootstrap env + gov/settings
 * cifrado con safeStorage). Este objeto nunca sale del main process: no se loguea,
 * no se envía por IPC, y las respuestas al renderer usan `maskKey`.
 */
export interface ResolvedModelKeys {
  openai?: string;
  anthropic?: string;
  google?: string;
  deepseek?: string;
  openaiBaseURL?: string;
  deepseekBaseURL?: string;
  ollamaBaseURL?: string;
}

const OPENAI_DEFAULT_BASE_URL = "https://api.openai.com/v1";

function isNonEmptyKey(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Bootstrap documentado INT-02, solo en main: lee `process.env` como fuente
 * inicial (`OPENAI_API_KEY`/`DEEPSEEK_API_KEY`/`OLLAMA_BASE_URL` más
 * `ANTHROPIC_API_KEY`/`GOOGLE_API_KEY` y base URLs custom). Sin keys → `{}` y
 * todo resuelve a mock (fallback seguro, nunca lanza).
 */
export function resolveEnvModelKeys(env: NodeJS.ProcessEnv = process.env): ResolvedModelKeys {
  const keys: ResolvedModelKeys = {};
  if (isNonEmptyKey(env.OPENAI_API_KEY)) keys.openai = env.OPENAI_API_KEY;
  if (isNonEmptyKey(env.ANTHROPIC_API_KEY)) keys.anthropic = env.ANTHROPIC_API_KEY;
  if (isNonEmptyKey(env.GOOGLE_API_KEY)) keys.google = env.GOOGLE_API_KEY;
  if (isNonEmptyKey(env.DEEPSEEK_API_KEY)) keys.deepseek = env.DEEPSEEK_API_KEY;
  if (isNonEmptyKey(env.OPENAI_BASE_URL)) keys.openaiBaseURL = env.OPENAI_BASE_URL;
  if (isNonEmptyKey(env.DEEPSEEK_BASE_URL)) keys.deepseekBaseURL = env.DEEPSEEK_BASE_URL;
  if (isNonEmptyKey(env.OLLAMA_BASE_URL)) keys.ollamaBaseURL = env.OLLAMA_BASE_URL;
  return keys;
}

/**
 * Resuelve keys desde el payload `gov/settings/model_config` (ya cargado en main).
 * Tolera el shape nuevo por proveedor (`<p>KeyEncrypted`/`<p>Key` + baseURLs) y el
 * legado de clave única (`apiKeyEncrypted`/`apiKey` + `activeProvider`/`baseUrl`).
 * Descifra con `decryptCredential` (safeStorage). Nunca lanza: payload
 * desconocido → `{}`.
 */
export function resolvePersistedModelKeys(payload: unknown): ResolvedModelKeys {
  if (!payload || typeof payload !== "object") return {};
  const p = payload as Record<string, unknown>;
  const keys: ResolvedModelKeys = {};
  const pick = (encrypted: unknown, plain: unknown): string | undefined => {
    if (typeof encrypted === "string" && encrypted.length > 0) {
      const decrypted = decryptCredential(encrypted);
      if (isNonEmptyKey(decrypted)) return decrypted;
    }
    if (isNonEmptyKey(plain)) return plain;
    return undefined;
  };
  const openai = pick(p.openaiKeyEncrypted, p.openaiKey);
  if (openai) keys.openai = openai;
  const anthropic = pick(p.anthropicKeyEncrypted, p.anthropicKey);
  if (anthropic) keys.anthropic = anthropic;
  const google = pick(p.googleKeyEncrypted, p.googleKey);
  if (google) keys.google = google;
  const deepseek = pick(p.deepseekKeyEncrypted, p.deepseekKey);
  if (deepseek) keys.deepseek = deepseek;

  // Legado de clave única: pertenece al activeProvider (openai/deepseek).
  const active = typeof p.activeProvider === "string" ? p.activeProvider : "";
  const legacy = pick(p.apiKeyEncrypted, p.apiKey);
  if (legacy && (active === "openai" || active === "deepseek") && !keys[active]) {
    keys[active] = legacy;
  }

  if (isNonEmptyKey(p.ollamaBaseURL)) {
    keys.ollamaBaseURL = p.ollamaBaseURL;
  } else if (active === "ollama" && isNonEmptyKey(p.baseUrl)) {
    keys.ollamaBaseURL = p.baseUrl;
  }
  if (isNonEmptyKey(p.openaiBaseURL)) {
    keys.openaiBaseURL = p.openaiBaseURL;
  } else if (active === "openai" && isNonEmptyKey(p.baseUrl)) {
    keys.openaiBaseURL = p.baseUrl;
  }
  if (isNonEmptyKey(p.deepseekBaseURL)) {
    keys.deepseekBaseURL = p.deepseekBaseURL;
  } else if (active === "deepseek" && isNonEmptyKey(p.baseUrl)) {
    keys.deepseekBaseURL = p.baseUrl;
  }
  return keys;
}

/**
 * Fusiona keys con precedencia explícita: lo persistido por UI (BYOK cifrado)
 * gana sobre el bootstrap env. Campos vacíos no pisan valores existentes.
 */
export function mergeModelKeys(base: ResolvedModelKeys, override: ResolvedModelKeys): ResolvedModelKeys {
  const merged: ResolvedModelKeys = { ...base };
  for (const [field, value] of Object.entries(override) as Array<[keyof ResolvedModelKeys, string | undefined]>) {
    if (isNonEmptyKey(value)) merged[field] = value;
  }
  return merged;
}

/**
 * Resuelve keys en memoria (plaintext de `currentModelConfig`, NUNCA sale
 * del main) al shape `ResolvedModelKeys`. Espeja la precedencia de
 * `resolvePersistedModelKeys` sin descifrado: por proveedor + legado.
 */
export function resolveMemoryModelKeys(config: ModelConfig): ResolvedModelKeys {
  const keys: ResolvedModelKeys = {};
  if (isNonEmptyKey(config.openaiKey)) keys.openai = config.openaiKey;
  if (isNonEmptyKey(config.anthropicKey)) keys.anthropic = config.anthropicKey;
  if (isNonEmptyKey(config.googleKey)) keys.google = config.googleKey;
  if (isNonEmptyKey(config.deepseekKey)) keys.deepseek = config.deepseekKey;
  const active = config.activeProvider;
  if (isNonEmptyKey(config.apiKey) && (active === "openai" || active === "deepseek") && !keys[active]) {
    keys[active] = config.apiKey;
  }
  if (isNonEmptyKey(config.openaiBaseURL)) keys.openaiBaseURL = config.openaiBaseURL;
  else if (active === "openai" && isNonEmptyKey(config.baseUrl)) keys.openaiBaseURL = config.baseUrl;
  if (isNonEmptyKey(config.deepseekBaseURL)) keys.deepseekBaseURL = config.deepseekBaseURL;
  else if (active === "deepseek" && isNonEmptyKey(config.baseUrl)) keys.deepseekBaseURL = config.baseUrl;
  if (isNonEmptyKey(config.ollamaBaseURL)) keys.ollamaBaseURL = config.ollamaBaseURL;
  else if (active === "ollama" && isNonEmptyKey(config.baseUrl)) keys.ollamaBaseURL = config.baseUrl;
  return keys;
}

export interface ConfiguredModelProvider {
  id: CatalogProviderId | "mock";
  configured: boolean;
}

/**
 * T15: proveedores con `configured` = key presente en memoria.
 * Ollama (local) y mock siempre configurados: no exigen secreto.
 */
export function getConfiguredProviders(keys: ResolvedModelKeys): ConfiguredModelProvider[] {
  return [
    { id: "openai", configured: isNonEmptyKey(keys.openai) },
    { id: "anthropic", configured: isNonEmptyKey(keys.anthropic) },
    { id: "google", configured: isNonEmptyKey(keys.google) },
    { id: "deepseek", configured: isNonEmptyKey(keys.deepseek) },
    { id: "ollama", configured: true },
    { id: "mock", configured: true },
  ];
}

export interface CatalogCredentials {
  apiKey?: string;
  baseURL?: string;
  credentialFingerprint: string;
}

/**
 * T15: credenciales efectivas del catálogo desde keys en memoria.
 * El fingerprint es SHA-256 del secreto (opaco, no reversible): es lo
 * único que llega a la key de cache persistida. NUNCA se loguea la key
 * (cero `console.*` en esta función, como en `probeModelKey`).
 */
export function resolveCatalogCredentials(
  provider: CatalogProviderId,
  keys: ResolvedModelKeys
): CatalogCredentials {
  let apiKey: string | undefined;
  let baseURL: string | undefined;
  if (provider === "openai") {
    if (isNonEmptyKey(keys.openai)) apiKey = keys.openai;
    if (isNonEmptyKey(keys.openaiBaseURL)) baseURL = keys.openaiBaseURL;
  } else if (provider === "anthropic") {
    if (isNonEmptyKey(keys.anthropic)) apiKey = keys.anthropic;
  } else if (provider === "google") {
    if (isNonEmptyKey(keys.google)) apiKey = keys.google;
  } else if (provider === "deepseek") {
    if (isNonEmptyKey(keys.deepseek)) apiKey = keys.deepseek;
    if (isNonEmptyKey(keys.deepseekBaseURL)) baseURL = keys.deepseekBaseURL;
  } else {
    if (isNonEmptyKey(keys.ollamaBaseURL)) baseURL = keys.ollamaBaseURL;
  }
  const credentialFingerprint = createHash("sha256")
    .update(`${provider}:${apiKey ?? ""}:${baseURL ?? ""}`, "utf8")
    .digest("hex")
    .slice(0, 32);
  const creds: CatalogCredentials = { credentialFingerprint };
  if (apiKey !== undefined) creds.apiKey = apiKey;
  if (baseURL !== undefined) creds.baseURL = baseURL;
  return creds;
}

function isCustomBaseURL(url: string | undefined, def: string): url is string {
  return isNonEmptyKey(url) && url.replace(/\/+$/, "") !== def.replace(/\/+$/, "");
}

function registerOpenAIProvider(router: ModelRouter, apiKey: string, baseURL?: string): void {
  if (isCustomBaseURL(baseURL, OPENAI_DEFAULT_BASE_URL)) {
    // Endpoint custom (p. ej. LMStudio/proxy): adaptador directo legacy.
    router.registerProvider(
      new OpenAICompatibleProvider({ providerId: "openai", baseUrl: baseURL, apiKey })
    );
  } else {
    router.registerProvider(
      new AiSdkOpenAIProvider({ apiKey, ...(isNonEmptyKey(baseURL) ? { baseURL } : {}) })
    );
  }
}

/**
 * Registra proveedores AI SDK y BYOK en el ModelRouter (INT-02 + AI SDK adapters).
 * Solo main: combina el bootstrap env documentado con las keys persistidas
 * (gov/settings descifrado, segundo parámetro). Registra un `AiSdk*Provider`
 * por key presente, el legacy `OpenAICompatibleProvider` solo para custom
 * `baseUrl`, Ollama local por defecto y siempre `MockProvider` como fallback.
 * Ninguna key sale del main (sin logs de secretos, sin eventos al renderer).
 */
export let currentModelConfig: ModelConfig = {
  activeProvider: process.env.OPENAI_API_KEY ? "openai" : process.env.DEEPSEEK_API_KEY ? "deepseek" : "mock",
  apiKey: process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || "",
  baseUrl: process.env.OPENAI_BASE_URL || "",
  modelName: "",
};

/**
 * T13 probe-before-save (hermes P3): valida la key del proveedor activo
 * contra su API (list models, timeout 15s) ANTES de persistir.
 * - 401/403/404 → throw accionable "key inválida", el caller NO persiste.
 * - Red ausente/timeout/5xx → `{verified:false, networkUnreachable:true}`
 *   con `warn`: el caller advierte pero permite guardar (flag visible).
 * - `mock` → `{verified:true}` (nada que validar). `ollama` prueba
 *   conectividad local sin secreto.
 * Seguridad: la key viaja SOLO en el header/query del fetch y NUNCA se
 * incluye en mensajes, errores ni logs (cero `console.*` en esta función).
 */
export interface ModelKeyProbeResult {
  verified: boolean;
  warn?: string;
  networkUnreachable?: boolean;
}

export interface ModelKeyProbeInput {
  provider: ModelConfig["activeProvider"];
  key?: string;
  openaiBaseURL?: string;
  deepseekBaseURL?: string;
  ollamaBaseURL?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export async function probeModelKey(input: ModelKeyProbeInput): Promise<ModelKeyProbeResult> {
  const { provider } = input;
  if (provider === "mock") return { verified: true };
  const timeoutMs = input.timeoutMs ?? 15000;
  const fetchImpl = input.fetchImpl ?? fetch;
  const normBase = (b: string | undefined): string | undefined => {
    const t = b?.trim().replace(/\/+$/, "");
    return t ? t : undefined;
  };

  let url = "";
  const headers: Record<string, string> = {};
  const secret = input.key?.trim() ?? "";
  if (provider === "ollama") {
    url = `${normBase(input.ollamaBaseURL) ?? OLLAMA_DEFAULT_BASE_URL}/api/tags`;
  } else if (!secret) {
    return { verified: false, warn: "Sin key para validar: se guarda sin probe (fallback mock intacto)." };
  } else if (provider === "openai") {
    url = `${normBase(input.openaiBaseURL) ?? "https://api.openai.com/v1"}/models`;
    headers["Authorization"] = `Bearer ${secret}`;
  } else if (provider === "anthropic") {
    url = "https://api.anthropic.com/v1/models";
    headers["x-api-key"] = secret;
    headers["anthropic-version"] = "2023-06-01";
  } else if (provider === "google") {
    url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(secret)}`;
  } else if (provider === "deepseek") {
    url = `${normBase(input.deepseekBaseURL) ?? "https://api.deepseek.com"}/models`;
    headers["Authorization"] = `Bearer ${secret}`;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { method: "GET", headers, signal: ctrl.signal });
    if (res.ok) return { verified: true };
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      throw new Error(
        `[BYOK] La key de ${provider} es inválida (HTTP ${res.status} al validar contra su API). ` +
          `Verificá la key y el proveedor activo. No se persistió ningún cambio.`
      );
    }
    return {
      verified: false,
      networkUnreachable: true,
      warn: `Validación no concluyente (HTTP ${res.status}): se guarda sin verificar.`,
    };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("[BYOK]")) throw err;
    const reason = err instanceof Error && err.name === "AbortError" ? "timeout" : "red no disponible";
    return {
      verified: false,
      networkUnreachable: true,
      warn: `No se pudo validar la key (${reason}): se guarda sin verificar.`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Aplica una configuración de modelo validada al ModelRouter (INT-02 + Task 10).
 * Valida con `ModelConfigSchema` (zod) y exige key no vacía para openai/
 * anthropic/google/deepseek: sin key válida no registra nada y el fallback
 * mock queda intacto. Resuelve la key efectiva por proveedor (`<p>Key` con
 * fallback al legado `apiKey` cuando el proveedor activo coincide) y la
 * baseURL efectiva (`<p>BaseURL` con fallback al legado `baseUrl`).
 */
export function applyModelConfig(router: ModelRouter, config: ModelConfig): void {
  const parsed = ModelConfigSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`[IPC Security] Configuración de modelo inválida: ${parsed.error.message}`);
  }
  const valid = parsed.data;
  currentModelConfig = { ...valid };
  const legacyKey = isNonEmptyKey(valid.apiKey) ? valid.apiKey : undefined;
  const legacyBase = isNonEmptyKey(valid.baseUrl) ? valid.baseUrl : undefined;
  if (valid.activeProvider === "openai") {
    const key = isNonEmptyKey(valid.openaiKey) ? valid.openaiKey : legacyKey;
    if (!key) return;
    const base = isNonEmptyKey(valid.openaiBaseURL) ? valid.openaiBaseURL : legacyBase;
    registerOpenAIProvider(router, key, base);
  } else if (valid.activeProvider === "anthropic") {
    const key = isNonEmptyKey(valid.anthropicKey) ? valid.anthropicKey : legacyKey;
    if (!key) return;
    router.registerProvider(new AiSdkAnthropicProvider({ apiKey: key }));
  } else if (valid.activeProvider === "google") {
    const key = isNonEmptyKey(valid.googleKey) ? valid.googleKey : legacyKey;
    if (!key) return;
    router.registerProvider(new AiSdkGoogleProvider({ apiKey: key }));
  } else if (valid.activeProvider === "deepseek") {
    const key = isNonEmptyKey(valid.deepseekKey) ? valid.deepseekKey : legacyKey;
    if (!key) return;
    const base = isNonEmptyKey(valid.deepseekBaseURL) ? valid.deepseekBaseURL : legacyBase;
    router.registerProvider(
      new AiSdkOpenAICompatibleProvider({
        providerId: "deepseek",
        apiKey: key,
        ...(base ? { baseURL: base } : {}),
      })
    );
  } else if (valid.activeProvider === "ollama") {
    const base = isNonEmptyKey(valid.ollamaBaseURL)
      ? valid.ollamaBaseURL
      : (legacyBase ?? OLLAMA_DEFAULT_BASE_URL);
    router.registerProvider(
      new AiSdkOpenAICompatibleProvider({
        providerId: "ollama",
        apiKey: "ollama",
        baseURL: base,
      })
    );
  }
  // mock: nada que registrar (MockProvider siempre presente vía setup/ctor).
}

/**
 * Registra proveedores reales y BYOK en el ModelRouter (INT-02 + AI SDK adapters).
 */
export function setupModelProviders(router: ModelRouter, extraKeys: ResolvedModelKeys = {}): void {
  // 1. Bootstrap env documentado (INT-02 stop-condition) + keys persistidas (BYOK UI).
  const keys = mergeModelKeys(resolveEnvModelKeys(), extraKeys);

  // 2. OpenAI (BYOK vía key presente; legacy solo para custom baseUrl).
  if (isNonEmptyKey(keys.openai)) {
    registerOpenAIProvider(router, keys.openai, keys.openaiBaseURL);
  }

  // 3. Anthropic (Claude, formato nativo vía SDK).
  if (isNonEmptyKey(keys.anthropic)) {
    router.registerProvider(new AiSdkAnthropicProvider({ apiKey: keys.anthropic }));
  }

  // 4. Google (Gemini, formato nativo vía SDK).
  if (isNonEmptyKey(keys.google)) {
    router.registerProvider(new AiSdkGoogleProvider({ apiKey: keys.google }));
  }

  // 5. DeepSeek (BYOK vía key presente, OpenAI-compatible vía SDK).
  if (isNonEmptyKey(keys.deepseek)) {
    router.registerProvider(
      new AiSdkOpenAICompatibleProvider({
        providerId: "deepseek",
        apiKey: keys.deepseek,
        ...(isNonEmptyKey(keys.deepseekBaseURL) ? { baseURL: keys.deepseekBaseURL } : {}),
      })
    );
  }

  // 6. Ollama (Local Offline por defecto; dummy key sin secreto real).
  router.registerProvider(
    new AiSdkOpenAICompatibleProvider({
      providerId: "ollama",
      apiKey: "ollama",
      baseURL: keys.ollamaBaseURL ?? OLLAMA_DEFAULT_BASE_URL,
    })
  );

  // 7. Mock siempre: fallback determinista sin keys ni red.
  router.registerProvider(new MockProvider());
}

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
    modelCredentialManager = new CredentialManager(mainProcessCryptoBackend);
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

/**
 * Procesa una solicitud de chat ejecutando el ciclo cognitivo ToolExecutionLoop con
 * streaming, persistencia inmutable en VantaDB y control de ejecución (INT-01).
 */
export async function handleLlmStream(rawReq: unknown): Promise<{
  ok: boolean;
  turnId: string;
  text: string;
  recallStatus: EgoRecallStatus;
  usage?: LoopExecutionResult["usage"];
  status: string;
}> {
  const parseResult = ChatStreamSchema.safeParse(rawReq);
  if (!parseResult.success) {
    throw new Error(`[IPC Security] Solicitud de chat inválida: ${parseResult.error.message}`);
  }
  const req = parseResult.data;

  const sessionId = req.sessionId || lifecycle?.currentSessionId || "default_session";
  const turnId = `turn_${Date.now()}`;
  const turnStartTime = Date.now();

  eventBus?.emit("task.started", {
    taskId: turnId,
    startedAt: turnStartTime,
  }, {
    source: "desktop.ipc.llm.stream",
    sessionId,
    traceId: turnId,
    severity: "info",
  });

  try {
    // FASE 2: Pre-Turn Context Assembly & Recall (Prefetch + Glifo 🧠)
    const { contextText, recallStatus } = await lifecycle.assemblePreTurn(req.prompt);

    // FASE DECISION INTELLIGENCE: Evaluación de Intención, Enrutamiento y Precondiciones (DEC-01..DEC-08)
    let verdict: DecisionVerdict | null = null;
    if (decisionRouter) {
      const tDecStart = performance.now();
      verdict = await decisionRouter.decide({
        prompt: req.prompt,
        projectId: req.projectId || activeProjectId,
        workspacePath: process.env.EGO_WORKSPACE_PATH || process.cwd(),
        activeSubEgoId: req.subEgoId || "ego.nucleus"
      });
      const tDecTotal = Math.round(performance.now() - tDecStart);

      // Verificación de bucles recursivos de delegación (DEC-06, OCLW-02, HERM-03)
      if (loopBreaker) {
        const breakCheck = loopBreaker.evaluate(
          verdict.subEgoId,
          verdict.intentDigest,
          verdict.admittedRunContext,
          verdict.confidence
        );

        if (breakCheck.shouldBreak && breakCheck.clarification) {
          const clarificationText = `[Pausa de Supervisión Cognitiva: ${breakCheck.reason}]\n${breakCheck.clarification.question}\n\nOpciones:\n` +
            breakCheck.clarification.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n');

          if (win && !win.isDestroyed()) {
            win.webContents.send("ipc.chat.delta", {
              type: "text",
              text: clarificationText,
              delta: clarificationText
            });
          }

          return {
            ok: true,
            turnId,
            text: clarificationText,
            recallStatus,
            status: "paused_clarification"
          };
        }
      }

      // Registro inmutable en gov/audit (DEC-07)
      if (decisionAuditor) {
        await decisionAuditor.recordVerdict(verdict);
      }

      // Telemetría de decisión (DEC-08)
      if (decisionTelemetry) {
        decisionTelemetry.record({
          runId: verdict.admittedRunContext.runId,
          intentId: verdict.intentId,
          classifyMs: Math.round(tDecTotal * 0.7),
          subEgoSelectMs: Math.round(tDecTotal * 0.15),
          preconditionsMs: Math.round(tDecTotal * 0.15),
          totalDecisionMs: tDecTotal,
          decidedBy: verdict.decidedBy
        });
      }
    }

    // Informar a la UI del estado de memoria inyectada
    if (win && !win.isDestroyed()) {
      win.webContents.send("ipc.chat.recall_status", recallStatus);
    }

    // Ensamblar mensajes para el modelo
    const messages: ModelMessage[] = [];
    const systemInstruction = [
      "Eres Ego, un Sistema Operativo Cognitivo de élite, riguroso, analítico y local-first.",
      req.systemPrompt || "",
      contextText,
    ]
      .filter(Boolean)
      .join("\n\n");

    messages.push({ role: "system", content: systemInstruction });
    messages.push({ role: "user", content: req.prompt });

    const execContext: ToolExecutionContext = {
      callId: turnId,
      sessionId,
      projectId: req.projectId || "default_project",
      subEgoId: req.subEgoId || verdict?.subEgoId || "ego.nucleus",
    };

    // Modelo elegido por el usuario (2026-10-14: el picker/Ajustes gobierna
    // de verdad; vacío = el router decide por rol). Hilo hasta el loop.
    const preferredModel: PreferredModel | undefined = (() => {
      const name = currentModelConfig.modelName?.trim();
      if (!name) return undefined;
      const p = currentModelConfig.activeProvider;
      if (p !== "mock" && p !== "ollama" && ["openai", "anthropic", "google", "deepseek"].includes(p)) {
        return { modelId: name, providerId: p as PreferredModel["providerId"] };
      }
      if (p === "ollama") return { modelId: name, providerId: "ollama" };
      return undefined;
    })();

    // Ejecutar loop cognitivo multi-turno a través de ToolExecutionLoop (INT-01)
    const loopResult: LoopExecutionResult = await toolLoop.run({
      messages,
      context: execContext,
      role: "general-chat",
      preferredModel,
      systemPrompt: systemInstruction,
      traceId: turnId,
      eventBus
    });

    const finalText = loopResult.finalText || "";

    // Retransmitir texto final hacia la UI
    if (finalText && win && !win.isDestroyed()) {
      win.webContents.send("ipc.chat.delta", {
        type: "text",
        text: finalText,
        delta: finalText
      });
    }

    // FASE 4: Post-Turn Synchronization (Persistencia inmutable L1 en VantaDB)
    const recalledKeys = recallStatus.hits.map((h) => `${h.namespace}:${h.key}`);
    await lifecycle.syncTurn(sessionId, turnId, req.prompt, finalText, recalledKeys);

    eventBus?.emit("task.completed", {
      taskId: turnId,
      durationMs: Date.now() - turnStartTime,
      result: { turnId, textLength: finalText.length, usage: loopResult.usage, steps: loopResult.steps },
    }, {
      source: "desktop.ipc.llm.stream",
      sessionId,
      traceId: turnId,
      severity: "info",
    });

    return {
      ok: loopResult.status === "completed",
      turnId,
      text: finalText,
      recallStatus,
      usage: loopResult.usage,
      status: loopResult.status
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (win && !win.isDestroyed()) {
      win.webContents.send("ipc.chat.error", { turnId, error: errorMsg });
    }

    eventBus?.emit("task.failed", {
      taskId: turnId,
      error: errorMsg,
      code: "STREAM_ERROR",
    }, {
      source: "desktop.ipc.llm.stream",
      sessionId,
      traceId: turnId,
      severity: "error",
    });

    throw new Error(`[Cognitive Runtime Error]: ${errorMsg}`);
  }
}

export async function createWindow(): Promise<void> {
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

  modelRouter = new ModelRouter();
  setupModelProviders(modelRouter);
  await syncModelCredentialPool(modelRouter);

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
        };
        applyModelConfig(modelRouter, restoredConfig);
      }
    }
  } catch (cfgErr) {
    console.warn("[Ego Main] Error al restaurar configuración de modelos de VantaDB:", cfgErr);
  }

  eventBus = new EventBus();
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
    workspacePath: process.env.EGO_WORKSPACE_PATH || process.cwd()
  });

  mcpManager = new McpManager(toolRegistry);
  skillScanner = new SkillScanner();
  subEgoRegistry = new SubEgoRegistry(adapter);
  decisionRouter = new DecisionRouter();
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
        return !TASK_SAFE_KINDS.has(kind);
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
        refreshTrayStatus();
      },
    },
    onTaskEvent: (event) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send("ipc.event", { kind: event.type, task: event.task });
      }
      refreshTrayStatus();
    },
  });
  workerTaskPool = new WorkerTaskPool();
  proactivityEngine = new ProactivityEngine();

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

  approvalEngine = new ApprovalEngine({
    mode: "standard",
    onApprovalRequested: (pending: PendingApproval) => {
      win?.webContents.send("ipc.approval.request", pending);
    },
  });

  executionManager = new ExecutionManager({
    maxConcurrentExecutions: 5,
    defaultTimeoutMs: 60_000
  });

  toolLoop = new ToolExecutionLoop(modelRouter, toolRegistry, {
    executionManager,
    approvalEngine,
    eventBus,
    maxSteps: 8,
    defaultRole: "general-chat",
    onToolCall: (call) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send("ipc.chat.delta", {
          type: "tool_call",
          callId: call.id,
          toolName: call.name,
          arguments: call.arguments
        });
      }
    },
    onToolResult: (res) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send("ipc.chat.delta", {
          type: "tool_result",
          callId: res.callId,
          toolName: res.toolName,
          success: res.success,
          output: res.output,
          error: res.error
        });
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
    },
  });

  if (windowState.isMaximized) {
    win.maximize();
  }

  windowStateManager.trackWindow(win);

  // R13/SEC-01 — CSP estricta vía cabeceras (defensa en profundidad sobre la
  // meta CSP de `renderer/index.html`; `sandbox:true` ya mitiga el riesgo base).
  // Permite el dev-server Vite local (http+ws en 127.0.0.1:5173); en producción
  // empaquetada solo rige 'self' + data:/blob: para assets.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' http://127.0.0.1:5173",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' http://127.0.0.1:5173 ws://127.0.0.1:5173",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp],
      },
    });
  });

  // Retransmitir eventos hacia Chromium Renderer (Activity Widget, Observabilidad)
  eventBus.onAny((event) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("ipc.event", event);
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

  // 2. Canales de Sub-Egos con validación Zod y Fábrica Inteligente (INT-04 / SUB-02)
  ipcMain.handle("ipc.subegos.list", async () => {
    try {
      const list = await subEgoRegistry.list();
      if (list && list.length > 0) return list;
      return adapter.listSubEgos();
    } catch (err) {
      console.warn("[Ego Main] Error al listar Sub-Egos:", err);
      return adapter.listSubEgos();
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

  // 3. Gobernanza HITL con validación Zod (ACT-06, ACT-07)
  ipcMain.handle("ipc.approval.resolve", async (_e, rawReq: unknown) => {
    const parseResult = ResolveApprovalSchema.safeParse(rawReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Solicitud de resolución de aprobación inválida: ${parseResult.error.message}`);
    }

    const { approvalId, approved, reason, modifiedArguments } = parseResult.data;
    const ok = approvalEngine.resolveApproval(approvalId, {
      approved,
      reason,
      modifiedArguments,
      resolvedBy: "user",
    });

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

    return skillScanner.scan(parseResult.data);
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
    activeProjectId = id;

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

  ipcMain.handle("ipc.projects.selectFolder", async () => {
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      title: "Seleccionar Carpeta del Proyecto",
      properties: ["openDirectory", "createDirectory"]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
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
        currentModelConfig = { ...currentModelConfig, ...resolved };
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

    const parsed = req.filePath
      ? await documentParser.parseFile(req.filePath)
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
    const explanation = await projectMemoryGraph.explainArtifact(req.filePath);
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
    const targetRoot = parseResult.data.workspaceRoot || process.env.EGO_WORKSPACE_PATH || process.cwd();
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

  ipcMain.handle("ipc.terminal.spawn", async (_e, rawReq: unknown) => {
    const parseResult = TerminalSpawnSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const { command, cwd, timeoutMs } = parseResult.data;
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
    const workspace = process.env.EGO_WORKSPACE_PATH || process.cwd();
    let executionCwd: string;
    try {
      executionCwd = cwd ? PathValidator.validatePath(cwd, workspace) : workspace;
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
      if (opGate) {
        const drainResult = await opGate.drain(3000);
        console.log(`[Ego Desktop] Drenado OpGate completado: drained=${drainResult.drained}, pendientes=${drainResult.remaining}`);
      }
      if (adapter) {
        await adapter.close();
      }
      if (crashRecoveryEngine) {
        crashRecoveryEngine.releaseLock();
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

