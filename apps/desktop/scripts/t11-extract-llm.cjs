/**
 * T11 (Ola 1c) — extrae `handleLlmStream` a `src/main/llm/handle-llm-stream.ts`.
 *
 * El cuerpo se mueve VERBATIM; las referencias a los globales de módulo
 * pasan a leerse de `ctx` (un objeto de contexto explícito). Los getters
 * del `ctx` en `main.ts` garantizan que los valores se leen EN VIVO (p. ej.
 * `activeProjectId` cambia cuando el usuario selecciona otro proyecto).
 */
const fs = require("node:fs");
const path = require("node:path");

const MAIN = path.join(__dirname, "..", "src", "main.ts");
const TARGET = path.join(__dirname, "..", "src", "main", "llm", "handle-llm-stream.ts");

if (fs.existsSync(TARGET)) {
  console.log("ya existe handle-llm-stream.ts");
  process.exit(0);
}

const L = fs.readFileSync(MAIN, "utf8").split(/\r?\n/);
const i = L.findIndex((l) => l.includes("export async function handleLlmStream("));
let d = 0;
let seen = false;
let e = -1;
for (let k = i; k < L.length; k++) {
  for (const ch of L[k]) {
    if (ch === "{") {
      d++;
      seen = true;
    } else if (ch === "}") d--;
  }
  if (seen && d === 0) {
    e = k;
    break;
  }
}
if (e < 0) throw new Error("no se pudo cerrar handleLlmStream");
let body = L.slice(i, e + 1).join("\n");

// Globales de MÓDULO que el cuerpo lee → pasan a leerse de `ctx`.
// OJO: solo los que son globales REALES. `assemblePreTurn`, `subEgoSoul`,
// `callerSystemMessage`, `systemInstruction` y `effectiveSystemPrompt` NO
// lo son (son métodos/locales) y romperían el código.
const CTX = [
  "lifecycle", "eventBus", "toolLoop", "adapter", "compactionJob",
  "compactionSummarizer", "decisionRouter", "decisionAuditor", "decisionTelemetry",
  "loopBreaker", "llmAbortControllers", "activeProjectId", "win",
  "enqueueMainPush", "getCachedCompressionSettings", "getLoopStableHash",
  "updateLoopStableHash", "buildTurnPrompt", "resolveTurnSoul", "drainMainSteerQueue",
  "formatOutOfBandUserMessage", "pushTurnCancelled", "currentModelConfig",
];
for (const g of CTX) {
  body = body.replace(new RegExp(`\\b${g}\\b`, "g"), `ctx.${g}`);
}
// La firma pasa a recibir el contexto.
body = body.replace(
  "export async function handleLlmStream(rawReq: unknown)",
  "export async function handleLlmStream(ctx: HandleLlmStreamCtx, rawReq: unknown)"
);

const header = `/**
 * T11 (Ola 1c) — Handler del turno de LLM (streaming) del main process.
 *
 * Extraído del god-file \`main.ts\` sin cambiar comportamiento: el cuerpo
 * se movió **verbatim** y las referencias a los globales de módulo pasan a
 * leerse de \`ctx\` (contexto explícito, con getters en el \`main.ts\` para
 * que los valores se lean EN VIVO: \`activeProjectId\` cambia cuando el
 * usuario selecciona otro proyecto).
 *
 * El contexto existe para que este módulo NO dependa de los globales de
 * \`main.ts\` (evita el ciclo de imports) y para que las dependencias
 * sean declarativas y testeables.
 */
import type { EventBus } from "@ego/events";
import type {
  EgoMemoryAdapter,
  EgoMemoryLifecycle,
  EgoRecallStatus,
  TurnRecord,
} from "@ego/memory";
import { shouldTriggerCompression } from "@ego/memory";
import type { ModelMessage, PreferredModel } from "@ego/models";
import type {
  DecisionAuditor,
  DecisionRouter,
  DecisionTelemetry,
  DecisionVerdict,
  LoopBreaker,
} from "@ego/decision";
import type {
  ToolExecutionLoop,
  LoopExecutionResult,
  ContextCompactionJob,
  SummarizerFn,
} from "@ego/runtime";
import type { ToolExecutionContext } from "@ego/tools";
import type { SubEgoSoul, AssembledPrompt } from "@ego/subegos";
import type { BrowserWindow } from "electron";
import type { IpcPriority } from "../ipc-priority-queue.js";
import { ChatStreamSchema, type ModelConfig } from "../../ipc/schema.js";

/** Opciones de ensamblado del prompt de turno (misma forma que en main.ts). */
export interface TurnPromptOptions {
  callerSystemMessage?: string;
  subEgoSoul?: SubEgoSoul;
  sessionId?: string;
  ephemeralText?: string;
  isCompressionRebuild?: boolean;
}

/** Contexto de ejecución del turno de LLM (todo lo que el handler necesita). */
export interface HandleLlmStreamCtx {
  lifecycle: EgoMemoryLifecycle;
  eventBus: EventBus;
  toolLoop: ToolExecutionLoop;
  adapter: EgoMemoryAdapter;
  compactionJob: ContextCompactionJob | null;
  compactionSummarizer: SummarizerFn | null;
  decisionRouter: DecisionRouter;
  decisionAuditor: DecisionAuditor;
  decisionTelemetry: DecisionTelemetry;
  loopBreaker: LoopBreaker;
  llmAbortControllers: Map<string, AbortController>;
  activeProjectId: string;
  activeSubEgoId: string;
  win: BrowserWindow | null;
  enqueueMainPush: (
    channel: string,
    payload: unknown,
    priority: IpcPriority,
    coalesceKey?: string
  ) => void;
  getCachedCompressionSettings: () => {
    thresholdRatio: number;
    targetRatio: number;
    autoCompact: boolean;
    maxWindowTokens: number;
    cleanupPeriodDays: number;
    maxSnapshots: number;
    archiveTarget?: string;
  };
  getLoopStableHash: (sessionId: string) => string | undefined;
  updateLoopStableHash: (sessionId: string, stablePrompt: string) => string;
  buildTurnPrompt: (opts?: TurnPromptOptions) => {
    assembled: AssembledPrompt;
    effectiveSystemPrompt: string;
    fingerprint: string;
  };
  resolveTurnSoul: (subEgoId: string) => Promise<SubEgoSoul>;
  drainMainSteerQueue: () => string[];
  formatOutOfBandUserMessage: (text: string) => string;
  pushTurnCancelled: (turnId: string) => void;
  currentModelConfig: ModelConfig;
  assemblePreTurn: (input: unknown) => Promise<unknown>;
}

`;

fs.mkdirSync(path.dirname(TARGET), { recursive: true });
fs.writeFileSync(TARGET, `${header}${body}\n`, "utf8");
console.log(`handle-llm-stream.ts <- ${e - i + 1} líneas`);
