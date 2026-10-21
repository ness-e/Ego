// E6 (Ola 2): arranque de la ventana principal (extraído del god-file).
import { createWindow, type CreateWindowDeps } from "./main/window/create-window.js";

import { app, screen } from "electron";
import { join, resolve as resolveFsPath, isAbsolute as isAbsoluteFsPath, relative as relativeFsPath } from "node:path";
import { createHash } from "node:crypto";

import { type ChildProcess } from "node:child_process";
import {
  SubEgoSoul,
  applyEphemeralOverlay,
  assertSystemPromptStable,
  formatOutOfBandUserMessage,
  type AssembledPrompt,
} from "@ego/subegos";
import { WindowStateManager } from "./windows/WindowStateManager.js";

// T11 (EGO-FIND-54): módulos extraídos del god-file.
import { defaultWorkspaceRoot } from "./main/path-scope.js";
import { currentModelConfig } from "./main/models/model-config.js";
// E5 (Ola 5 · T1): identidad declarativa (SOUL.md/AGENT.md) + circuito de
// presupuesto del Sub-Ego. El primero hace que el artefacto declarado
// llegue al turno; el segundo, que el presupuesto declarado se vigile.
import {
  resolveSubEgoIdentity,
  isRequiredIdentityMissing,
} from "./main/subegos/identity.js";
import {
  evaluateTurnBudget,
  recordTurnBudget,
  type TurnBudgetOutcome,
} from "./main/subegos/budget-guard.js";
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
// Ola 6 · T2: el estimador de coste del PROPIO router (para no duplicar su
// heurística de tokens de salida) y el tipo de la configuración de turno.
import { estimateCallCostUsd } from "@ego/models";
import type { ModelConfig } from "./ipc/schema.js";
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

/** Deriva verde/azul/rojo del estado real del engine (COUC-19 mínimo). */

/** Task4 (D2): snapshot de trabajo para `shouldAutoShow` (engine + flotante). */


/**
 * Recomputa la atención de la isla flotante y el tray usando AttentionStateMachine canónica.
 * Mantiene jerarquía de estados: hitl_approval (approval) > compact/expanded > hidden.
 */

/** Task4 (D2): sincroniza flotante + tray desde el engine (una sola llamada). */

/**
 * Task10 (COUC-19): emite el canal `tray:id` al renderer principal
 * (el tray es espejo del estado: click/acciones notifican sin tumbar main).
 */

/**
 * Task10 (COUC-19): Pause detiene el BackgroundEngine (running+queued →
 * paused) SIN cerrar ventanas; Reanudar lo re-encola. Lógica pura en
 * `main/tray-status.ts` (testeable); aquí solo wiring + sync visual.
 */


/** Task10 (WIDG-05/COUC-19): tray completo — Abrir/Settings/Pause/Quit + `tray:id`. */

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


/** Singleton del pool de keys de modelos (vault en memoria sobre safeStorage). */

/** Solo tests: inyecta un pool falso en el singleton de sesión. */

/**
 * Rehidrata el pool desde keys efectivas (env + persistidas) y lo conecta
 * al router. V1: 1 slot por proveedor; el pool soporta N (arrays multi-key
 * diferidos sin cambio de forma del payload).
 */

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
import { crashRecoveryEngine, opGate, windowStateManager, adapter, lifecycle, displayChangeListener, compactionJob, compactionSummarizer, modelRouter, approvalEngine, toolLoop, subEgoRegistry, delegationRuntime, decisionRouter, decisionAuditor, decisionTelemetry, loopBreaker, mcpManager, mcpServerHandle, runRecorder, skillScanner, eventBus, knowledgeIndexer, hybridSearch, graphRagEngine, quarantineManager, factLifecycle, bitemporalQueries, projectMemoryGraph, knowledgeExport, documentParser, dailyStateEngine, dailyStatePersistence, goalPrioritizer, decisionsFeed, win, backgroundEngine, workerTaskPool, proactivityEngine, tray, mainPushDrainScheduled, defaultNucleusSoul, llmAbortControllers } from "./main/state/app-context.js";
import { setDisplayChangeListener, setDelegationRuntime, setMcpServerHandle, setRunRecorder, setTray, setMainPushDrainScheduled, setDefaultNucleusSoul } from "./main/state/app-context.js";

// E6-res (Ola 3): bloques extraídos del compositor a módulos propios.
import { ensureFloatMgr, refreshTrayStatus, floatingSnapshot, syncFloatingFromEngine, ensureTray } from "./main/tray/tray-controller.js";
import { getOrCreateDefaultProject } from "./main/subsystems/default-project.js";
import { syncModelCredentialPool } from "./main/models/model-pool.js";
import { scheduleMemoryCleanup } from "./main/subsystems/memory-cleanup.js";
export { getOrCreateDefaultProject } from "./main/subsystems/default-project.js";
export { getModelCredentialPool, setModelCredentialPoolForTests, syncModelCredentialPool } from "./main/models/model-pool.js";
export { scheduleMemoryCleanup, stopMemoryCleanupForTests } from "./main/subsystems/memory-cleanup.js";


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



/** Solo tests: detiene los timers periódicos sin efectos colaterales. */

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
 * Resuelve el alma del subEgo del turno: registry → identidad declarativa
 * (`SOUL.md`/`AGENT.md`, E5) → fallback al nucleus por defecto.
 *
 * ## Semántica de fallo (E5)
 * - Identidad **no obligatoria** e ilegible → fallback al manifiesto + aviso.
 * - Identidad **obligatoria** (`required: true`) e ilegible → **error
 *   tipado**: el turno NO puede continuar con el nucleus (sería sustituir
 *   en silencio la identidad que el Sub-Ego declaró).
 * - Registry vacío o error de registry → nucleus (fail-open de IDENTIDAD,
 *   nunca de gobernanza).
 */
export async function resolveTurnSoul(subEgoId: string): Promise<SubEgoSoul> {
  try {
    const manifest = await subEgoRegistry?.get(subEgoId);
    if (manifest) {
      // E5: si el manifiesto declara su artefacto de identidad, se carga
      // desde disco; si no, el loader en código sigue siendo la fuente.
      const resolution = await resolveSubEgoIdentity(manifest, {
        workspacePath: defaultWorkspaceRoot(),
      });
      for (const warning of resolution.warnings) {
        console.warn(`[resolveTurnSoul] ${warning}`);
      }
      return resolution.soul;
    }
  } catch (err) {
    // Fail-closed de IDENTIDAD: la identidad obligatoria ausente es un
    // error de gobernanza, no un motivo para servir otra identidad.
    if (isRequiredIdentityMissing(err)) throw err;
    // Fallback intencional al nucleus (fail-open solo en identidad, nunca en permisos).
  }
  return getDefaultNucleusSoul();
}

/**
 * E5 (Ola 5 · T1) — Evalúa el circuito de presupuesto del Sub-Ego ANTES del
 * turno.
 *
 * Sin manifiesto (Sub-Ego desconocido) no hay presupuesto declarado → el
 * turno pasa. Con manifiesto, el circuito decide: `allow`, `degrade` (con el
 * modelo barato y su configuración) o `stop` (error tipado).
 */
export async function evaluateTurnBudgetForTurn(args: {
  subEgoId: string;
  estimate: { tokens?: number; costUsd?: number };
  prompt?: string;
}): Promise<TurnBudgetOutcome> {
  const manifest = (await subEgoRegistry?.get(args.subEgoId)) ?? null;
  return evaluateTurnBudget({
    subEgoId: args.subEgoId,
    manifest,
    // El `ModelRouter` satisface estructuralmente `BudgetAwareRouterLike`
    // (`getMaxCostPerCallUsd` / `resolveCheaperModel`, añadidos en A2-bis):
    // el tope efectivo pasa a ser el MÍNIMO(Sub-Ego, router) y la
    // degradación a un modelo más barato deja de ser teórica.
    router: modelRouter,
    estimate: {
      ...args.estimate,
      // Ola 6 · T2: el COSTE se estima con las **tarifas reales** del
      // modelo vigente (el estimador del propio router). Sin esto el tope
      // de coste no se evaluaba nunca: el circuito sólo veía tokens.
      ...(args.estimate.costUsd === undefined
        ? { costUsd: estimateTurnCostUsd(args.prompt ?? "") }
        : {}),
    },
    // La configuración del modelo degradado se construye desde la fuente
    // canónica de A2-bis (`resolveModelDescriptor`): un id registrado →
    // su descriptor; un id no registrado con provider conocido → descriptor
    // dinámico. Sin ella, el guard DETIENE (fail-closed: seguir con el
    // modelo caro violaría el tope).
    resolveModelConfig: (modelId) => resolveModelConfigById(modelId),
  });
}

/**
 * Ola 6 · T2 — Configuración de turno de un **id de modelo** cualquiera.
 *
 * `null` si no hay forma de construirla (el guard DETIENE entonces).
 */
export async function resolveModelConfigById(
  modelId: string
): Promise<ModelConfig | undefined> {
  const descriptor = await modelRouter.resolveModelDescriptor(modelId);
  if (!descriptor) return undefined;
  return {
    activeProvider: descriptor.provider,
    apiKey: currentModelConfig.apiKey ?? "",
    baseUrl: currentModelConfig.baseUrl ?? "",
    modelName: descriptor.id,
  } as ModelConfig;
}

/**
 * Ola 6 · T2 — Coste estimado del turno (USD) con las tarifas reales.
 *
 * El estimador es el del PROPIO router (`estimateCallCostUsd`), para no
 * duplicar su heurística de tokens de salida.
 */
function estimateTurnCostUsd(prompt: string): number | undefined {
  const modelId = currentModelConfig.modelName?.trim();
  if (!modelId) return undefined;
  const descriptor = modelRouter.getModelDescriptor(modelId);
  if (!descriptor) return undefined;
  const cost = estimateCallCostUsd(descriptor, {
    messages: [{ role: "user", content: prompt }],
  });
  return Number.isFinite(cost) ? cost : undefined;
}

/**
 * E5 (Ola 5 · T1) — Registra el consumo real del turno en el circuito.
 */
export async function recordTurnBudgetForTurn(args: {
  subEgoId: string;
  usage: { tokens: number; durationMs: number; model?: string };
}): Promise<void> {
  const manifest = (await subEgoRegistry?.get(args.subEgoId)) ?? null;
  await recordTurnBudget({
    subEgoId: args.subEgoId,
    manifest,
    // El `ModelRouter` satisface estructuralmente `BudgetAwareRouterLike`
    // (A2-bis) → sin cast.
    router: modelRouter,
    usage: args.usage,
  });
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
  // E5 (Ola 5 · T1): el circuito de presupuesto del Sub-Ego se evalúa antes
  // del turno y se registra después.
  get evaluateTurnBudget() { return evaluateTurnBudgetForTurn; },
  get recordTurnBudget() { return recordTurnBudgetForTurn; },
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

