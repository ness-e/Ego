// E6 (Ola 2): arranque de la ventana principal (extraído del god-file).
import { createWindow, type CreateWindowDeps } from "./main/window/create-window.js";

import { app, Tray, Menu, nativeImage, screen } from "electron";
import { join, resolve as resolveFsPath, isAbsolute as isAbsoluteFsPath, relative as relativeFsPath } from "node:path";
import { createHash } from "node:crypto";

import { type ChildProcess } from "node:child_process";
import { deflateSync } from "node:zlib";
import { EgoMemoryAdapter } from "@ego/memory";
import { ModelRouter, OpenAICompatibleProvider, AiSdkOpenAIProvider, AiSdkAnthropicProvider, AiSdkGoogleProvider, AiSdkOpenAICompatibleProvider } from "@ego/models";
import type { ModelProviderFactory } from "@ego/models";
import { AttentionStateMachine } from "@ego/runtime";
import { SubEgoWorktreeManager } from "@ego/subegos";
import {
  SubEgoSoul,
  applyEphemeralOverlay,
  assertSystemPromptStable,
  formatOutOfBandUserMessage,
  type AssembledPrompt,
} from "@ego/subegos";
import { ProjectManifestSchema, type ProjectManifest } from "./ipc/schema.js";
import { MemoryCleanupJob } from "@ego/tasks";
import { CredentialManager, CredentialPool } from "@ego/security";
import { WindowStateManager } from "./windows/WindowStateManager.js";
import {
  FloatingWindowManager,
  syncFromAttention,
} from "./windows/FloatingWindow.js";

// T11 (EGO-FIND-54): módulos extraídos del god-file.
import { defaultWorkspaceRoot } from "./main/path-scope.js";
import { DegradedObfBackend } from "./main/credentials/vault.js";
import { currentModelConfig, isCustomBaseURL, isNonEmptyKey, mergeModelKeys, OPENAI_DEFAULT_BASE_URL, resolveEnvModelKeys, type ResolvedModelKeys } from "./main/models/model-config.js";
import { activeProjectId } from "./main/ipc/ipc-state.js";
// T11 (Ola 1c): handler del turno de LLM (extraído del god-file).
import { handleLlmStream } from "./main/llm/handle-llm-stream.js";
// T1 (VERDICT R2): resolver de secretos D2 (keychain del SO, solo main).
// T2 (VERDICT R1): servidor MCP de Ego (HTTP streamable en loopback).
// T11 (EGO-FIND-54): runtime MCP (persistencia, secretos, saneado).
import { buildMcpPersistedRecord, deleteMcpEnvSecrets, extractPersistedMcpRecord, getMcpCredentialManager, mcpEnvKeysForCleanup, needsMcpEnvMigration, sanitizeMcpRuntimeStateForRenderer, storeMcpEnvSecrets } from "./main/mcp-runtime.js";
// STAB-09: núcleos puros extraídos de este god-file (5047 líneas). La API
// pública de `main.js` se mantiene vía re-export para las 10 suites de
// `test/` que importan de aquí.
import {
  TRAY_COLORS,
  pngChunk,
  trayTooltipFor,
  pauseAllTasks,
  resumeAllTasks,
  type EgoTrayStatus,
} from "./main/tray-status.js";
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





function ensureFloatMgr(): FloatingWindowManager {
  if (!floatMgr) {
    const created = new FloatingWindowManager();
    setFloatMgr(created);
    return created;
  }
  return floatMgr;
}


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
  setMainPushDrainScheduled(false);
  for (const msg of mainPushQueue.drain(Date.now(), 256)) {
    sendMainPushNow(msg.channel, msg.payload);
  }
  if (mainPushQueue.size() > 0 && !mainPushDrainScheduled) {
    setMainPushDrainScheduled(true);
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
    setMainPushDrainScheduled(true);
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
  setTrayStatus(next);
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

function getAttentionFsm(): AttentionStateMachine {
  if (!attentionFsm) {
    const created = new AttentionStateMachine({
      onTransition: (ev) => {
        try {
          ensureFloatMgr().updateState({ attentionState: syncFromAttention(ev.currentState) });
        } catch {
          // noop
        }
      },
    });
    setAttentionFsm(created);
    return created;
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
    const created = new Tray(createTrayIcon(trayStatus));
    setTray(created);
    created.setToolTip(trayTooltipFor(trayStatus));
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
    created.on("click", restore);
    created.setContextMenu(Menu.buildFromTemplate([
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
    setTray(null);
  }
}

// E6 (Ola 2): los accessors del runtime viven con el estado.
export {
  getKnowledgeIndexer,
  getHybridSearch,
  getGraphRagEngine,
  getQuarantineManager,
  getFactLifecycle,
  getBitemporalQueries,
  getProjectMemoryGraph,
  getSubEgoRegistry,
  getEventBus,
  getModelRouter,
  getToolRegistry,
  getToolLoop,
  getApprovalEngine,
  getExecutionManager,
  getLifecycle,
  getActiveProjectId,
  getDecisionRouter,
  getDecisionAuditor,
  getDecisionTelemetry,
  getLoopBreaker,
  getOpGate,
  getCrashRecoveryEngine,
  getBackgroundEngine,
  getWorkerTaskPool,
  getProactivityEngine,
  getTaskCheckpointManager,
} from "./main/state/runtime-getters.js";

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


/** Singleton del pool de keys de modelos (vault en memoria sobre safeStorage). */
export function getModelCredentialPool(): CredentialPool {
  const existing = modelCredentialPool;
  if (existing) return existing;
  // BUGFIX 2026-10-15 (saveModelConfig lanzaba tras T21): el pool usaba
  // `mainProcessCryptoBackend` directo (fail-closed: lanza sin safeStorage)
  // mientras `encryptCredential` degrada a `obf:` legacy. En esta máquina
  // safeStorage no está disponible, así que el save moría en
  // `setProviderKeys`. El pool usa el mismo degradado que el resto del
  // save (memoria del proceso + `obf:` reversible, nunca texto plano).
  const manager = new CredentialManager(new DegradedObfBackend());
  setModelCredentialManager(manager);
  const pool = new CredentialPool(manager);
  setModelCredentialPool(pool);
  return pool;
}

/** Solo tests: inyecta un pool falso en el singleton de sesión. */
export function setModelCredentialPoolForTests(pool: CredentialPool | null): void {
  setModelCredentialPool(pool);
  if (pool === null) setModelCredentialManager(null);
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

import { getCachedPermissionsSettings, getCachedCompressionSettings, parsePermissionsSettings } from "./main/settings-cache.js";

// E6 (Ola 2): estado mutable del proceso main (bindings VIVOS).
// Los setters son el único punto de escritura; ver el módulo para el contrato.
import { crashRecoveryEngine, opGate, windowStateManager, adapter, lifecycle, displayChangeListener, compactionJob, compactionSummarizer, modelRouter, approvalEngine, toolLoop, subEgoRegistry, delegationRuntime, decisionRouter, decisionAuditor, decisionTelemetry, loopBreaker, mcpManager, mcpServerHandle, runRecorder, skillScanner, eventBus, knowledgeIndexer, hybridSearch, graphRagEngine, quarantineManager, factLifecycle, bitemporalQueries, projectMemoryGraph, knowledgeExport, documentParser, dailyStateEngine, dailyStatePersistence, goalPrioritizer, decisionsFeed, win, backgroundEngine, workerTaskPool, proactivityEngine, tray, trayStatus, floatMgr, mainPushDrainScheduled, attentionFsm, modelCredentialPool, memoryCleanupTimer, memoryCleanupFirst, defaultNucleusSoul } from "./main/state/app-context.js";
import { setDisplayChangeListener, setDelegationRuntime, setMcpServerHandle, setRunRecorder, setTray, setTrayStatus, setFloatMgr, setMainPushDrainScheduled, setAttentionFsm, setModelCredentialManager, setModelCredentialPool, setMemoryCleanupTimer, setMemoryCleanupFirst, setDefaultNucleusSoul } from "./main/state/app-context.js";


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
  setMemoryCleanupFirst(setTimeout(() => {
      setMemoryCleanupFirst(null);
      void runCleanup();
    }, 60_000)
  );
  if (typeof memoryCleanupFirst === "object" && memoryCleanupFirst !== null && "unref" in memoryCleanupFirst) {
    (memoryCleanupFirst as NodeJS.Timeout).unref();
  }
  setMemoryCleanupTimer(setInterval(() => {
    void runCleanup();
  }, 24 * 60 * 60 * 1000));
  if (typeof memoryCleanupTimer === "object" && memoryCleanupTimer !== null && "unref" in memoryCleanupTimer) {
    (memoryCleanupTimer as NodeJS.Timeout).unref();
  }
}

/** Solo tests: detiene los timers periódicos sin efectos colaterales. */
export function stopMemoryCleanupForTests(): void {
  if (memoryCleanupFirst) {
    clearTimeout(memoryCleanupFirst);
    setMemoryCleanupFirst(null);
  }
  if (memoryCleanupTimer) {
    clearInterval(memoryCleanupTimer);
    setMemoryCleanupTimer(null);
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

export function getDefaultNucleusSoul(): SubEgoSoul {
  if (!defaultNucleusSoul) {
    const created = new SubEgoSoul({
      id: "ego.nucleus",
      name: "Nucleus",
      tone: "rigorous-analytical",
      reasoningStyle: "first-principles",
    });
    setDefaultNucleusSoul(created);
    return created;
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


if (app && typeof app.whenReady === "function") {
  void app.whenReady().then(async () => {
    try {
/** Dependencias que `createWindow` recibe del compositor (E6). */
const createWindowDeps: CreateWindowDeps = {
  ensureFloatMgr,
  enqueueMainPush,
  refreshTrayStatus,
  floatingSnapshot,
  syncFloatingFromEngine,
  ensureTray,
  syncModelCredentialPool,
  scheduleMemoryCleanup,
  createIpcDeps,
};

      await createWindow(createWindowDeps);
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
      setTray(null);
      // T2 (VERDICT R1): cerrar el servidor MCP de Ego (libera el puerto
      // loopback, cierra el listener HTTP y REVOCA el token bearer).
      if (mcpServerHandle) {
        try {
          await mcpServerHandle.close();
        } catch (mcpErr) {
          console.warn("[Ego Desktop] Error al cerrar el servidor MCP:", mcpErr);
        }
        setMcpServerHandle(null);
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
        setRunRecorder(null);
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
        setDisplayChangeListener(null);
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
        setDelegationRuntime(undefined);
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

