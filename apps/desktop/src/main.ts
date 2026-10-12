import { app, BrowserWindow, ipcMain, dialog, safeStorage } from "electron";
import { join } from "node:path";
import { stat } from "node:fs/promises";
import {
  EgoMemoryAdapter,
  EgoMemoryLifecycle,
  SubEgoManifest,
  createSubEgoId,
} from "@ego/memory";
import { ModelRouter, ModelMessage, OpenAICompatibleProvider, AiSdkOpenAIProvider, AiSdkAnthropicProvider, AiSdkGoogleProvider, AiSdkOpenAICompatibleProvider, MockProvider, OLLAMA_DEFAULT_BASE_URL } from "@ego/models";
import { ToolRegistry, registerNativeTools, type ToolExecutionContext } from "@ego/tools";
import { McpManager, SkillScanner } from "@ego/integrations";
import { EventBus, StructuredLogger } from "@ego/events";
import { ToolExecutionLoop, type LoopExecutionResult } from "@ego/runtime";
import { ApprovalEngine, ExecutionManager, type PendingApproval } from "@ego/execution";
import {
  SubEgoRegistry,
  SubEgoFactory,
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
} from "./ipc/schema.js";
import {
  DomainRegistry,
  EngineeringDomain,
  ProductDomain,
  KnowledgeDomain,
  AnalyticsDomain,
  CrmDomain,
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
import { WindowStateManager } from "./windows/WindowStateManager.js";

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
 * Cifra una credencial sensible usando safeStorage del SO (Keychain/DPAPI).
 * Prohibición absoluta de guardar API keys en texto plano en VantaDB.
 */
export function encryptCredential(plainText: string): string {
  if (!plainText) return "";
  try {
    if (typeof safeStorage !== "undefined" && safeStorage.isEncryptionAvailable()) {
      const encryptedBuffer = safeStorage.encryptString(plainText);
      return `enc:${encryptedBuffer.toString("base64")}`;
    }
  } catch (err) {
    console.warn("[Security] Fallo al cifrar con safeStorage:", err);
  }
  return `obf:${Buffer.from(plainText, "utf-8").toString("base64")}`;
}

/**
 * Descifra una credencial sensible protegida por safeStorage del SO.
 */
export function decryptCredential(stored: string): string {
  if (!stored) return "";
  try {
    if (stored.startsWith("enc:")) {
      const b64 = stored.slice(4);
      const buffer = Buffer.from(b64, "base64");
      if (typeof safeStorage !== "undefined" && safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(buffer);
      }
    } else if (stored.startsWith("obf:")) {
      const b64 = stored.slice(4);
      return Buffer.from(b64, "base64").toString("utf-8");
    }
  } catch (err) {
    console.warn("[Security] Fallo al descifrar credencial con safeStorage:", err);
  }
  return stored;
}

/**
 * Enmascara una API key para devolver a la UI sin exponer el secreto en claro (ej. sk-...3a8f).
 */
export function maskApiKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "••••••••";
  const prefix = key.slice(0, 4);
  const suffix = key.slice(-4);
  return `${prefix}...${suffix}`;
}

/** Alias del enmascarado de keys para respuestas hacia el renderer (nunca el secreto). */
export const maskKey = maskApiKey;

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

/**
 * Procesa una solicitud de chat ejecutando el ciclo cognitivo ToolExecutionLoop con
 * streaming, persistencia inmutable en VantaDB y control de ejecución (INT-01).
 */
export async function handleLlmStream(rawReq: unknown): Promise<{
  ok: boolean;
  turnId: string;
  text: string;
  recallStatus: any;
  usage?: any;
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

    // Ejecutar loop cognitivo multi-turno a través de ToolExecutionLoop (INT-01)
    const loopResult: LoopExecutionResult = await toolLoop.run({
      messages,
      context: execContext,
      role: "general-chat",
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
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
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

  // Restaurar configuración persistida de modelos BYOK si existe (gov/settings)
  // Solo main: las keys descifradas con safeStorage nunca salen de este proceso.
  try {
    const savedConfig = await adapter.get("gov/settings", "model_config");
    if (savedConfig) {
      let payload: any = savedConfig;
      if (typeof savedConfig === "object" && savedConfig !== null && "payload" in savedConfig) {
        payload = (savedConfig as { payload: any }).payload;
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

        // Keys por proveedor (anthropic/google/openai/deepseek persistidos por UI).
        const persistedKeys = resolvePersistedModelKeys(payload);
        if (Object.keys(persistedKeys).length > 0) {
          setupModelProviders(modelRouter, persistedKeys);
        }

        let resolvedKey = "";
        if (payload.apiKeyEncrypted) {
          resolvedKey = decryptCredential(payload.apiKeyEncrypted);
        } else if (payload.apiKey && typeof payload.apiKey === "string") {
          // Migración automática de legado plano a cifrado con safeStorage
          resolvedKey = payload.apiKey;
          const reEncrypted = encryptCredential(resolvedKey);
          await adapter.put({
            namespace: "gov/settings",
            key: "model_config",
            payload: {
              ...(payload as Record<string, unknown>),
              activeProvider: payload.activeProvider,
              apiKeyEncrypted: reEncrypted,
              baseUrl: payload.baseUrl,
              modelName: payload.modelName,
            },
            metadata: { updatedAtMs: Date.now(), migrated: true },
          });
        }

        const restoredConfig: ModelConfig = {
          activeProvider: payload.activeProvider || "mock",
          apiKey: resolvedKey,
          baseUrl: payload.baseUrl,
          modelName: payload.modelName,
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

  // Restaurar servidores MCP persistidos en VantaDB si existen (gov/mcp_servers)
  try {
    const savedServers = await adapter.list("gov/mcp_servers", 50);
    for (const record of savedServers) {
      let rawPayload = record.payload;
      if (typeof rawPayload === "string") {
        try {
          rawPayload = JSON.parse(rawPayload);
        } catch {
          // Si no es JSON plano, se ignora
        }
      }
      const item = rawPayload as { config?: any; enabled?: boolean } | undefined;
      if (item && item.config) {
        await mcpManager.registerServer(item.config, item.enabled ?? true);
      }
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
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (windowState.isMaximized) {
    win.maximize();
  }

  windowStateManager.trackWindow(win);

  // Retransmitir eventos hacia Chromium Renderer (Activity Widget, Observabilidad)
  eventBus.onAny((event) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("ipc.event", event);
    }
  });

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
        ...(req.overrides as any),
      }) as unknown as SubEgoManifest;
    } else if ("mode" in req && req.mode === "declaration") {
      manifest = SubEgoFactory.fromRawDeclaration(req.rawText, req.format) as unknown as SubEgoManifest;
    } else {
      const subEgoId = createSubEgoId(req.name);
      manifest = {
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
      };
    }

    await subEgoRegistry.register(manifest as any);
    try {
      await adapter.registerSubEgo(manifest as any);
    } catch {
      // noop
    }

    eventBus?.emit("subego.registered" as any, {
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
      updated = (await subEgoRegistry.enable(subEgoId)) as unknown as SubEgoManifest;
    } else {
      updated = (await subEgoRegistry.disable(subEgoId)) as unknown as SubEgoManifest;
    }

    eventBus?.emit("subego.state_changed" as any, {
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
  ipcMain.handle("ipc.mcp.listServers", async () => {
    return mcpManager.listServers();
  });

  ipcMain.handle("ipc.mcp.addServer", async (_e, rawReq: unknown) => {
    const parseResult = AddMcpServerSchema.safeParse(rawReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Configuración de servidor MCP inválida: ${parseResult.error.message}`);
    }

    const { config, enabled } = parseResult.data;
    const runtimeState = await mcpManager.registerServer(config, enabled);

    try {
      await adapter.put({
        namespace: "gov/mcp_servers",
        key: config.id,
        payload: { config, enabled },
        metadata: { updatedAtMs: Date.now() },
      });
    } catch (persistErr) {
      console.warn(`[Ego Main] Error al persistir servidor MCP '${config.id}' en VantaDB:`, persistErr);
    }

    return runtimeState;
  });

  ipcMain.handle("ipc.mcp.removeServer", async (_e, rawReq: unknown) => {
    const parseResult = RemoveMcpServerSchema.safeParse(rawReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Solicitud de eliminación MCP inválida: ${parseResult.error.message}`);
    }

    const { id } = parseResult.data;
    const removed = await mcpManager.removeServer(id);

    try {
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
      const existing = (await adapter.get("gov/mcp_servers", id)) as { payload?: unknown } | null;
      if (existing && existing.payload && typeof existing.payload === "object") {
        const payload = existing.payload as { config: any; enabled?: boolean };
        payload.enabled = enabled;
        await adapter.put({
          namespace: "gov/mcp_servers",
          key: id,
          payload,
          metadata: { updatedAtMs: Date.now() },
        });
      }
    } catch (updateErr) {
      console.warn(`[Ego Main] Error al actualizar estado de servidor MCP '${id}' en VantaDB:`, updateErr);
    }

    return state;
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
    } catch (fsErr: any) {
      throw new Error(`Ruta de directorio inaccesible o inexistente: ${fsErr.message}`);
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

    eventBus?.emit("project.switched" as any, {
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
    const parseResult = ModelConfigSchema.safeParse(rawReq);
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

    eventBus?.emit("settings.model_updated" as any, {
      activeProvider: effectiveConfig.activeProvider,
      timestamp: Date.now(),
    }, {
      source: "desktop.ipc.settings.saveModelConfig",
      severity: "info",
    });

    // Respuesta enmascarada hacia el Renderer (ningún secreto en claro).
    return { ok: true, config: toMaskedModelConfigResponse({ ...effectiveConfig, apiKey: effectiveApiKey }) };
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

  ipcMain.handle("ipc.decision.listAudits", async (_e, limit: unknown) => {
    const lim = typeof limit === "number" ? limit : 50;
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
      } catch (err: any) {
        return { ok: false, error: err?.message || "Error al promover fact" };
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

  ipcMain.handle("ipc.knowledge.export", async (_e, projectId?: unknown) => {
    const pId = typeof projectId === "string" ? projectId : activeProjectId;
    const pkg = await knowledgeExport.exportPackage(pId);
    return { ok: true, pkg };
  });

  ipcMain.handle("ipc.knowledge.import", async (_e, pkg: unknown) => {
    if (typeof pkg !== "object" || pkg === null) {
      return { ok: false, error: "Paquete de importación inválido" };
    }
    const result = await knowledgeExport.importPackage(pkg as any);
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

  ipcMain.handle("ipc.daily.getSnapshot", async (_e, date: unknown) => {
    const dateStr = typeof date === "string" ? date : DailyStateEngine.getTodayDateString();
    const snapshot = await dailyStatePersistence.getSnapshot(dateStr);
    return { ok: true, snapshot };
  });

  ipcMain.handle("ipc.daily.listSnapshots", async (_e, limit?: unknown) => {
    const lim = typeof limit === "number" ? limit : 30;
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

    if (action === "create" && payload && typeof payload === "object") {
      const item = await productDomain.createBacklogItem(payload as any);
      return { ok: true, item };
    } else if (action === "updateStatus" && payload && typeof payload === "object") {
      const p = payload as { id: string; status: any };
      const item = await productDomain.updateBacklogItemStatus(p.id, p.status);
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

    if (action === "create" && payload && typeof payload === "object") {
      const deal = await crmDomain.createDeal(payload as any);
      return { ok: true, deal };
    } else if (action === "updateStage" && payload && typeof payload === "object") {
      const p = payload as { id: string; stage: any };
      const deal = await crmDomain.updateDealStage(p.id, p.stage);
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

  // Carga de la aplicación (Vite Dev Server en desarrollo o bundle compilado)
  const isDev = !app.isPackaged && process.env.NODE_ENV !== "production";
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    console.log(`[Ego Desktop] Conectando a Vite Dev Server: ${process.env.VITE_DEV_SERVER_URL}`);
    await win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const htmlPath = join(app.getAppPath(), "renderer/dist/index.html");
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

