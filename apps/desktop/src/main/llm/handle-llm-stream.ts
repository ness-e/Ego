/**
 * T11 (Ola 1c) — Handler del turno de LLM (streaming) del main process.
 *
 * Extraído del god-file `main.ts` sin cambiar comportamiento: el cuerpo
 * se movió **verbatim** y las referencias a los globales de módulo pasan a
 * leerse de `ctx` (contexto explícito, con getters en el `main.ts` para
 * que los valores se lean EN VIVO: `activeProjectId` cambia cuando el
 * usuario selecciona otro proyecto).
 *
 * El contexto existe para que este módulo NO dependa de los globales de
 * `main.ts` (evita el ciclo de imports) y para que las dependencias
 * sean declarativas y testeables.
 */
import type { EventBus } from "@ego/events";
import { newCorrelationId } from "@ego/events";
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
// E5 (Ola 5 · T1): el circuito de presupuesto del Sub-Ego se evalúa antes
// del turno y se registra después.
import { estimateTokens as estimatePromptTokens } from "../subegos/budget-guard.js";
import type { TurnBudgetOutcome } from "../subegos/budget-guard.js";
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
  /**
   * E5 (Ola 5 · T1): evalúa el circuito de presupuesto del Sub-Ego antes
   * del turno. Opcional: si no está, el turno no tiene presupuesto (tests,
   * arranque temprano).
   */
  evaluateTurnBudget?: (args: {
    subEgoId: string;
    estimate: { tokens?: number; costUsd?: number };
    /** Prompt del turno: permite estimar el COSTE con las tarifas reales. */
    prompt?: string;
  }) => Promise<TurnBudgetOutcome>;
  /**
   * E5 (Ola 5 · T1): registra el consumo real del turno en el circuito.
   */
  recordTurnBudget?: (args: {
    subEgoId: string;
    usage: { tokens: number; durationMs: number; model?: string };
  }) => Promise<void>;
  drainMainSteerQueue: () => string[];
  formatOutOfBandUserMessage: (text: string) => string;
  pushTurnCancelled: (turnId: string) => void;
  currentModelConfig: ModelConfig;
}

export async function handleLlmStream(ctx: HandleLlmStreamCtx, rawReq: unknown): Promise<{
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

  const sessionId = req.sessionId || ctx.lifecycle?.currentSessionId || "default_session";
  const turnId = `turn_${Date.now()}`;
  const turnStartTime = Date.now();
  // A1 real: el turno registra su controlador para `ipc.llm.cancel`.
  const abortController = new AbortController();
  ctx.llmAbortControllers.set(turnId, abortController);
  // Recall vacío por defecto: si el abort llega antes del pre-turn, el path
  // de cancelación en `catch` responde igual sin colgar ni inventar hits.
  let recallStatus: EgoRecallStatus = {
    count: 0,
    glyph: "🧠",
    sources: [],
    tokensEstimate: 0,
    hits: [],
  };

  // EGO-FIND-74 (A2, Ola 2): id de CORRELACIÓN del turno. Es la raíz de la
  // traza: el `ToolExecutionLoop` deriva de él un span hijo por tool call
  // (`childCorrelationId(correlationId, "tool:<nombre>")`) y lo propaga en los
  // eventos `tool.started`, `tool.executed`, `tool.failed` y `approval.*`.
  // Sin esto, el bus del proceso no puede unir "el turno" con "la tool que
  // falló" — y el camino de ERROR es justo el que más hace falta para
  // diagnosticar.
  const correlationId = newCorrelationId();

  ctx.eventBus?.emit("task.started", {
    taskId: turnId,
    startedAt: turnStartTime,
  }, {
    source: "desktop.ipc.llm.stream",
    sessionId,
    traceId: turnId,
    severity: "info",
    metadata: { correlationId },
  });

  try {
    // FASE 2: Pre-Turn Context Assembly & Recall (Prefetch + Glifo 🧠)
    const preTurn = await ctx.lifecycle.assemblePreTurn(req.prompt);
    const contextText = preTurn.contextText;
    recallStatus = preTurn.recallStatus;

    // FASE DECISION INTELLIGENCE: Evaluación de Intención, Enrutamiento y Precondiciones (DEC-01..DEC-08)
    let verdict: DecisionVerdict | null = null;
    if (ctx.decisionRouter) {
      const tDecStart = performance.now();
      verdict = await ctx.decisionRouter.decide({
        prompt: req.prompt,
        projectId: req.projectId || ctx.activeProjectId,
        workspacePath: process.env.EGO_WORKSPACE_PATH || process.cwd(),
        activeSubEgoId: req.subEgoId || "ego.nucleus"
      });
      const tDecTotal = Math.round(performance.now() - tDecStart);

      // Verificación de bucles recursivos de delegación (DEC-06, OCLW-02, HERM-03)
      if (ctx.loopBreaker) {
        const breakCheck = ctx.loopBreaker.evaluate(
          verdict.subEgoId,
          verdict.intentDigest,
          verdict.admittedRunContext,
          verdict.confidence
        );

        if (breakCheck.shouldBreak && breakCheck.clarification) {
          const clarificationText = `[Pausa de Supervisión Cognitiva: ${breakCheck.reason}]\n${breakCheck.clarification.question}\n\nOpciones:\n` +
            breakCheck.clarification.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n');

          if (ctx.win && !ctx.win.isDestroyed()) {
            // CFG-11: interactiva (orden sensible, sin coalesce).
            ctx.enqueueMainPush("ipc.chat.delta", {
              type: "text",
              text: clarificationText,
              delta: clarificationText
            }, "interactive");
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
      if (ctx.decisionAuditor) {
        await ctx.decisionAuditor.recordVerdict(verdict);
      }

      // Telemetría de decisión (DEC-08)
      if (ctx.decisionTelemetry) {
        ctx.decisionTelemetry.record({
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

    // Informar a la UI del estado de memoria inyectada.
    // CFG-11: lectura idempotente → coalesce por turno (el último gana).
    if (ctx.win && !ctx.win.isDestroyed()) {
      ctx.enqueueMainPush("ipc.chat.recall_status", recallStatus, "interactive", `recall:${turnId}`);
    }

    // STAB-05: trigger pre-compactación (archive-first, nunca trunca aquí).
    // Si el turno estimado supera el threshold de `gov/settings/compression`,
    // se archiva el historial en `kb/history_archive` vía `maybePreCompact`
    // y el turno corre como rebuild sancionado (`isCompressionRebuild: true`,
    // único cache-break permitido). Falla defensivo: sin archive no hay
    // rebuild, el turno sigue normal.
    let isCompressionRebuild = false;
    {
      const compressionSettings = ctx.getCachedCompressionSettings();
      const preEstimate = Math.ceil((req.prompt.length + contextText.length) / 4);
      const evaluation = shouldTriggerCompression(
        preEstimate,
        compressionSettings.maxWindowTokens,
        compressionSettings
      );
      if (evaluation.shouldCompact) {
        try {
          const rows = await ctx.adapter.list("session/turns", 200);
          const history: TurnRecord[] = [];
          for (const row of rows) {
            if (typeof row.key !== "string" || !row.key.startsWith(`${sessionId}:`)) continue;
            const p = row.payload;
            if (p !== null && typeof p === "object" && typeof (p as Record<string, unknown>)["turnId"] === "string") {
              history.push(p as TurnRecord);
            }
          }
          const pre = await ctx.lifecycle.maybePreCompact(
            sessionId,
            history,
            preEstimate,
            compressionSettings.maxWindowTokens,
            compressionSettings
          );
          isCompressionRebuild = pre.triggered;
        } catch (err) {
          console.warn("[Ego Main] Pre-compactación STAB-05 omitida (turno sigue normal):", err);
        }
      }
    }

    // STAB-03: system 3-tiers vía PromptAssembly (byte-stable por sesión).
    // El recall fresco (contextText) viaja como overlay efímero API-call-time:
    // nunca contamina el prefijo cacheado. Los steers drenan como user
    // standalone con el marcador out-of-band exacto (única autoridad mid-turn).
    const subEgoId = req.subEgoId || verdict?.subEgoId || "ego.nucleus";
    const soul = await ctx.resolveTurnSoul(subEgoId);
    const turnPrompt = ctx.buildTurnPrompt({
      subEgoSoul: soul,
      callerSystemMessage: req.systemPrompt,
      sessionId,
      ephemeralText: contextText,
      isCompressionRebuild,
    });
    const systemInstruction = turnPrompt.effectiveSystemPrompt;

    // Ensamblar mensajes para el modelo
    const messages: ModelMessage[] = [];
    messages.push({ role: "system", content: systemInstruction });
    messages.push({ role: "user", content: req.prompt });
    for (const steer of ctx.drainMainSteerQueue()) {
      messages.push({ role: "user", content: ctx.formatOutOfBandUserMessage(steer) });
    }

    const execContext: ToolExecutionContext = {
      callId: turnId,
      sessionId,
      projectId: req.projectId || "default_project",
      subEgoId,
    };

    // E5 (Ola 5 · T1): el circuito de presupuesto del Sub-Ego se evalúa
    // ANTES del turno. Si el circuito detiene, el turno falla con el ERROR
    // TIPADO (no con un string suelto); si degrada, el turno sigue con el
    // modelo barato que el circuito eligió.
    let turnModelConfig = ctx.currentModelConfig;
    if (ctx.evaluateTurnBudget) {
      const budget = await ctx.evaluateTurnBudget({
        subEgoId,
        estimate: { tokens: estimatePromptTokens(req.prompt ?? "") },
        prompt: req.prompt ?? "",
      });
      if (budget.stop) {
        throw (
          budget.error ??
          new Error(
            budget.reason ??
              `El presupuesto del Sub-Ego '${subEgoId}' no permite este turno.`
          )
        );
      }
      if (budget.modelConfig) {
        turnModelConfig = budget.modelConfig;
        // Ola 6 · T2: la degradación DEBE ser visible. `system.alert` es el
        // canal que ya consume el `NotifyCenter` del renderer (notificación
        // in-app, y OS si el usuario lo habilita) y el `StructuredLogger`
        // (log estructurado). El aviso dice QUÉ modelo se eligió y POR QUÉ:
        // sin esto, el turno se ejecutaba con otro modelo y nadie lo sabía.
        const from = ctx.currentModelConfig.modelName ?? "(sin modelo)";
        const to = budget.modelConfig.modelName ?? turnModelConfig.modelName ?? "?";
        const message =
          `Presupuesto: el turno degrada de '${from}' a '${to}'. ` +
          `${budget.reason ?? "El coste estimado supera el tope efectivo."}`;
        ctx.eventBus?.emit(
          "system.alert",
          {
            code: "system.alert",
            message,
            details: {
              kind: "budget_degraded",
              subEgoId,
              from,
              to,
              reason: budget.reason ?? null,
              effectiveCostCapUsd:
                (budget.decision as { effectiveCostCapUsd?: number })
                  .effectiveCostCapUsd ?? null,
            },
          },
          {
            source: "desktop.ipc.llm.stream",
            severity: "warn",
            metadata: { correlationId },
          }
        );
        console.warn(`[Ego Main] ${message}`);
      }
    }

    // Modelo elegido por el usuario (2026-10-14: el picker/Ajustes gobierna
    // de verdad; vacío = el router decide por rol). Hilo hasta el loop.
    // STAB-06: el tuning global (temperature/reasoningEffort) viaja en el
    // PreferredModel y además como override per-call del loop.
    // E5: si el circuito de presupuesto degradó el turno, `turnModelConfig`
    // es el del modelo barato (no el del usuario).
    const preferredModel: PreferredModel | undefined = (() => {
      const name = turnModelConfig.modelName?.trim();
      if (!name) return undefined;
      const tuning = {
        ...(turnModelConfig.temperature !== undefined
          ? { temperature: turnModelConfig.temperature }
          : {}),
        ...(turnModelConfig.reasoningEffort !== undefined
          ? { reasoningEffort: turnModelConfig.reasoningEffort }
          : {}),
      };
      const p = turnModelConfig.activeProvider;
      if (p !== "mock" && p !== "ollama" && ["openai", "anthropic", "google", "deepseek"].includes(p)) {
        return { modelId: name, providerId: p as PreferredModel["providerId"], ...tuning };
      }
      if (p === "ollama") return { modelId: name, providerId: "ollama", ...tuning };
      return undefined;
    })();

    // Ejecutar loop cognitivo multi-turno a través de ToolExecutionLoop (INT-01).
    // La señal viaja hasta generate/stream: el provider que la honre aborta
    // mid-token; el que no, completa el turno en vuelo y el loop se detiene
    // en el siguiente checkpoint (`aborted`, sin colgar).
    // STAB-05: el loop hace enforcement del prefijo estable (sha256 de la
    // parte 3-tiers sin overlay) salvo rebuild por compresión; el hash
    // baseline se fija en el primer turno de cada sesión.
    const prevStableHash = ctx.getLoopStableHash(sessionId);
    ctx.updateLoopStableHash(sessionId, turnPrompt.assembled.systemPrompt);
    const loopResult: LoopExecutionResult = await ctx.toolLoop.run({
      messages,
      context: execContext,
      role: "general-chat",
      preferredModel,
      // STAB-06: tuning global también sin modelName (el loop lo hila
      // por encima del PreferredModel y por debajo de lo explícito).
      ...(ctx.currentModelConfig.temperature !== undefined
        ? { temperature: ctx.currentModelConfig.temperature }
        : {}),
      ...(ctx.currentModelConfig.reasoningEffort !== undefined
        ? { reasoningEffort: ctx.currentModelConfig.reasoningEffort }
        : {}),
      systemPrompt: systemInstruction,
      stableSystemPrompt: turnPrompt.assembled.systemPrompt,
      cachedSystemPromptFingerprint: prevStableHash,
      isCompressionRebuild,
      traceId: turnId,
      eventBus: ctx.eventBus,
      // EGO-FIND-74: raíz de la correlación del turno. El runtime deriva de
      // ella los spans hijos de cada tool call (`tool:<nombre>`) y los
      // propaga en `tool.started` / `tool.executed` / `tool.failed` → la
      // ruta de ERROR queda correlacionada con su turno.
      correlationId,
      abortSignal: abortController.signal
    });

    // Turno cancelado (por `ipc.llm.cancel` o señal abortada): push
    // `turn-cancelled` para cerrar el stream remoto, sin persistir reply
    // vacío en la sesión y sin emitir `task.completed` engañoso (el loop ya
    // emitió `task.failed` con `ABORTED`).
    if (loopResult.status === "aborted" || abortController.signal.aborted) {
      ctx.pushTurnCancelled(turnId);
      return {
        ok: false,
        turnId,
        text: "",
        recallStatus,
        usage: loopResult.usage,
        status: "aborted"
      };
    }

    const finalText = loopResult.finalText || "";

    // E5 (Ola 5 · T1): el consumo real del turno entra en el circuito de
    // presupuesto (tokens + duración). El coste en USD lo conoce el router
    // (A2): el desktop lo registra como 0 y no lo inventa.
    if (ctx.recordTurnBudget) {
      try {
        await ctx.recordTurnBudget({
          subEgoId,
          usage: {
            tokens: loopResult.usage?.totalTokens ?? 0,
            durationMs: Date.now() - turnStartTime,
            model: turnModelConfig.modelName,
          },
        });
      } catch (err) {
        // La contabilidad del presupuesto NUNCA tumba el turno.
        console.warn("[Ego Main] Registro de presupuesto fallido (turno continúa):", err);
      }
    }

    // Retransmitir texto final hacia la UI.
    // CFG-11: interactiva (orden sensible, sin coalesce: es autoritativa).
    if (finalText && ctx.win && !ctx.win.isDestroyed()) {
      ctx.enqueueMainPush("ipc.chat.delta", {
        type: "text",
        text: finalText,
        delta: finalText
      }, "interactive");
    }

    // A2-01 / EGO-FIND-21: compactación REAL del historial del turno.
    // Antes sólo se archivaba (`maybePreCompact`); el historial nunca se podaba
    // y la ventana de contexto crecía sin cota.
    {
      const history = loopResult.messages;
      const totalChars = history.reduce(
        (acc, m) => acc + (m.content?.length ?? 0),
        0
      );
      const estimatedTokens = Math.ceil(totalChars / 4);
      const windowTokens = Math.max(1, ctx.getCachedCompressionSettings().maxWindowTokens);
      const usageRatio = estimatedTokens / windowTokens;
      const need = ctx.compactionJob?.evaluate({
        messages: history,
        estimatedTokens,
        usageRatio,
      });
      if (need?.shouldCompact && ctx.compactionJob) {
        try {
          const compacted = await ctx.compactionJob.compact(
            { messages: history, estimatedTokens, usageRatio },
            {
              isCompressionRebuild: true,
              sessionId,
              // T8 (A2-ola1b, Diff E): resumidor LLM real (no heurístico).
              ...(ctx.compactionSummarizer ? { summarizer: ctx.compactionSummarizer } : {}),
            }
          );
          // `compacted.summary` queda archivado en kb/history_archive
          // (compacted.archiveKey) y `compacted.messages` es el historial
          // podado + resumen. Para que el PRÓXIMO turno arranque compacto,
          // persistir `compacted.messages` como contexto de sesión
          // (p. ej. `ctx.lifecycle.syncTurn(sessionId, turnId, compacted.summary, …)`
          //  o un slot `session/compacted/<sessionId>`), porque `messages` es
          // local al turno y muere al terminar.
          await ctx.adapter.put({
            namespace: "session/turns",
            key: `${sessionId}:compacted:${turnId}`,
            payload: {
              sessionId,
              turnId,
              summary: compacted.summary,
              archiveKey: compacted.archiveKey,
              keptRatio: compacted.keptRatio,
              trigger: compacted.trigger,
            },
            metadata: {
              type: "context_compaction",
              source: "runtime.context_compaction",
            },
          });
        } catch (err) {
          // Fail-soft: la compactación nunca debe tumbar el turno.
          console.warn(
            "[Ego Main] Compactación de contexto fallida (turno continúa):",
            err
          );
        }
      }
    }

    // FASE 4: Post-Turn Synchronization (Persistencia inmutable L1 en VantaDB)
    const recalledKeys = recallStatus.hits.map((h) => `${h.namespace}:${h.key}`);
    await ctx.lifecycle.syncTurn(sessionId, turnId, req.prompt, finalText, recalledKeys);

    ctx.eventBus?.emit("task.completed", {
      taskId: turnId,
      durationMs: Date.now() - turnStartTime,
      result: { turnId, textLength: finalText.length, usage: loopResult.usage, steps: loopResult.steps },
    }, {
      source: "desktop.ipc.llm.stream",
      sessionId,
      traceId: turnId,
      severity: "info",
      // EGO-FIND-74: el turno cierra la traza; sin su `correlationId` los
      // spans hijos (`tool:<nombre>`) quedan huérfanos.
      metadata: { correlationId },
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
    // Cancelación que escapó como excepción (AbortError del provider fuera
    // del loop): respuesta `aborted` limpia en vez de error visible.
    if (abortController.signal.aborted) {
      ctx.pushTurnCancelled(turnId);
      return {
        ok: false,
        turnId,
        text: "",
        recallStatus,
        status: "aborted"
      };
    }
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (ctx.win && !ctx.win.isDestroyed()) {
      ctx.win.webContents.send("ipc.chat.error", { turnId, error: errorMsg });
    }

    ctx.eventBus?.emit("task.failed", {
      taskId: turnId,
      error: errorMsg,
      code: "STREAM_ERROR",
    }, {
      source: "desktop.ipc.llm.stream",
      sessionId,
      traceId: turnId,
      severity: "error",
      // EGO-FIND-74: la ruta de ERROR del turno también lleva su
      // `correlationId` (sin él, un turno fallido no se puede unir con los
      // `tool.failed` que loprovinaron).
      metadata: { correlationId },
    });

    throw new Error(`[Cognitive Runtime Error]: ${errorMsg}`);
  } finally {
    ctx.llmAbortControllers.delete(turnId);
  }
}
