import type { ModelMessage, ModelRole, ToolCall } from "@ego/models";
import { createHash } from "node:crypto";
import { ModelRouter } from "@ego/models";
import { ToolRegistry } from "@ego/tools";
import type { ToolDefinition } from "@ego/tools";
import { ExecutionManager, type ApprovalEngine } from "@ego/execution";
import type { EventBus } from "@ego/events";
import { childCorrelationId } from "@ego/events";
import type {
  ApprovalDecision,
  ApprovalRequest,
  LoopExecutionResult,
  LoopGovernanceGates,
  LoopHookVerdict,
  LoopRunOptions,
  ToolExecutionLoopConfig,
  ToolExecutionResult
} from "./types.js";
import { ErrorHandler } from "./ErrorHandler.js";
import { ToolCallRepairEngine } from "@ego/tool-call-repair";
import { assembleTrustedPrompt, isTainted, screenUntrustedContent } from "./TrustBoundary.js";
import {
  resolveVisibleTool,
  toolViewFor,
  visibleToolNames,
} from "./ToolVisibility.js";

/** Error de cancelación cooperativa (DOM AbortError de fetch/AI SDK). */
function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error) {
    if (err.name === "AbortError") return true;
    const msg = err.message.toLowerCase();
    if (msg.includes("aborted") || msg.includes("operation was aborted")) return true;
  }
  return false;
}

interface LoopUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

/**
 * Loop cognitivo multi-turno para Tool Calling (ACT-02).
 *
 * Orquesta la interacción cíclica entre el modelo y las herramientas:
 * 1. Envío de mensajes y esquemas JSON Schema al ModelRouter.
 * 2. Detección e intercepción de llamadas a herramientas (`tool_calls`).
 * 3. Validación estricta de parámetros en tiempo de ejecución con Zod.
 * 4. Gobernanza Human-in-the-Loop (HITL): suspensión o despacho a handlers de aprobación.
 * 5. Ejecución supervisada mediante ExecutionManager (timeouts, cuotas y cancelación).
 * 6. Manejo resiliente de fallos para autocorrección guiada por el modelo (ACT-08).
 * 7. Control de cuota y límite de iteraciones (anti-bucles infinitos).
 * 8. Telemetría y observabilidad integral vía EventBus (ACT-12 / COUC-01).
 */
export class ToolExecutionLoop {
  private readonly router: ModelRouter;
  private readonly registry: ToolRegistry;
  private readonly executionManager: ExecutionManager;
  private readonly approvalEngine?: ApprovalEngine;
  private readonly errorHandler: ErrorHandler;
  private readonly eventBus?: EventBus;
  private readonly config: ToolExecutionLoopConfig;

  constructor(
    router: ModelRouter,
    registry: ToolRegistry,
    config: ToolExecutionLoopConfig = {}
  ) {
    this.router = router;
    this.registry = registry;
    this.executionManager = config.executionManager ?? new ExecutionManager();
    this.approvalEngine = config.approvalEngine;
    this.eventBus = config.eventBus;
    this.errorHandler =
      config.errorHandler ??
      new ErrorHandler(this.registry, config.errorHandlerConfig);
    this.config = {
      maxSteps: 10,
      defaultRole: "reasoning-heavy",
      ...config
    };
  }

  /**
   * Gate de gobernanza pre-ejecución (STAB-12, Spec D4).
   * Orden fail-closed: permiso (deny veta / requireApproval fuerza HITL) →
   * hook PreToolUse (bloqueo veta). Sin gates configurados = proceed.
   * Cero eco: los mensajes nombran REGLAS/hooks, nunca args.
   */
  private applyGovernanceGates(
    tool: ToolDefinition,
    call: { id: string; name: string; args: unknown },
    ctx: { sessionId: string; traceId: string | undefined; eventBus: EventBus | undefined }
  ): { rejected?: string; forceApproval: boolean } {
    const gates: LoopGovernanceGates | undefined = this.config.governance;
    if (!gates) return { forceApproval: false };
    if (gates.permissionCheck) {
      const verdict = gates.permissionCheck({
        toolName: tool.name,
        category: tool.category,
        riskLevel: tool.riskLevel,
        origin: tool.origin,
        mcpServerId: tool.mcpServerId,
        args: call.args,
      });
      if (verdict.decision === "deny") {
        ctx.eventBus?.emit("hook.decided", {
          phase: "permission-check",
          toolName: tool.name,
          sessionId: ctx.sessionId,
          allow: false,
          reason: `denied:${verdict.rule}`,
        }, {
          source: "runtime.tool_loop",
          sessionId: ctx.sessionId,
          traceId: ctx.traceId,
          severity: "warn",
        });
        ctx.eventBus?.emit("tool.failed", {
          callId: call.id,
          toolName: tool.name,
          error: `Acción vetada por la política de permisos (regla '${verdict.rule}').`,
          durationMs: 0,
        }, {
          source: "runtime.tool_loop",
          sessionId: ctx.sessionId,
          traceId: ctx.traceId,
          severity: "warn",
        });
        return {
          rejected: `Acción vetada por la política de permisos (regla '${verdict.rule}').`,
          forceApproval: false,
        };
      }
      if (verdict.decision === "requireApproval") {
        return { forceApproval: true };
      }
    }
    if (gates.preToolUse) {
      const hook: LoopHookVerdict = gates.preToolUse(tool.name, ctx.sessionId);
      if (hook.matchedHookId || !hook.allow) {
        ctx.eventBus?.emit("hook.decided", {
          hookId: hook.matchedHookId,
          phase: "PreToolUse",
          toolName: tool.name,
          sessionId: ctx.sessionId,
          allow: hook.allow,
          reason: hook.reason,
        }, {
          source: "runtime.tool_loop",
          sessionId: ctx.sessionId,
          traceId: ctx.traceId,
          severity: hook.allow ? "info" : "warn",
        });
      }
      if (!hook.allow) {
        return {
          rejected: `Herramienta interceptada por hook (motivo '${hook.reason}').`,
          forceApproval: false,
        };
      }
    }
    return { forceApproval: false };
  }

  /**
   * Observación PostToolUse (STAB-12): nunca bloquea; emite `hook.decided`
   * solo cuando un hook matchea (evita spam de auditoría).
   */
  private observePostToolUse(
    toolName: string,
    sessionId: string,
    traceId: string | undefined,
    eventBus: EventBus | undefined
  ): void {
    const post = this.config.governance?.postToolUse;
    if (!post) return;
    const hook: LoopHookVerdict = post(toolName, sessionId);
    if (!hook.matchedHookId) return;
    eventBus?.emit("hook.decided", {
      hookId: hook.matchedHookId,
      phase: "PostToolUse",
      toolName,
      sessionId,
      allow: hook.allow,
      reason: hook.reason,
    }, {
      source: "runtime.tool_loop",
      sessionId,
      traceId,
      severity: "info",
    });
  }

  /**
   * Checkpoint cooperativo de cancelación: si la señal se abortó, emite el
   * evento de telemetría y construye el resultado `aborted` limpio.
   * Retorna `null` cuando el turno sigue vivo (sin efecto colateral).
   */
  private abortCheckpoint(
    options: LoopRunOptions,
    messages: ModelMessage[],
    step: number,
    totalUsage: LoopUsage,
    eventBus: EventBus | undefined,
    sessionId: string,
    traceId: string | undefined
  ): LoopExecutionResult | null {
    if (!options.abortSignal?.aborted) return null;
    eventBus?.emit("task.failed", {
      taskId: sessionId,
      error: "Operación abortada por señal de cancelación (AbortSignal).",
      code: "ABORTED"
    }, {
      source: "runtime.tool_loop",
      sessionId,
      traceId,
      severity: "warn"
    });

    return {
      status: "aborted",
      messages,
      steps: step,
      error: "Operación abortada por señal de cancelación (AbortSignal).",
      usage: totalUsage
    };
  }

  /**
   * Clasifica un error lanzado durante el turno: cancelación real
   * (señal abortada o AbortError del provider) → resultado `aborted`
   * limpio; cualquier otro error se propaga intacto al caller.
   */
  private abortResultForError(
    err: unknown,
    options: LoopRunOptions,
    messages: ModelMessage[],
    step: number,
    totalUsage: LoopUsage,
    eventBus: EventBus | undefined,
    sessionId: string,
    traceId: string | undefined
  ): LoopExecutionResult | null {
    if (options.abortSignal?.aborted || isAbortError(err)) {
      return this.abortCheckpoint(
        { ...options, abortSignal: options.abortSignal ?? AbortSignal.abort() },
        messages,
        step,
        totalUsage,
        eventBus,
        sessionId,
        traceId
      );
    }
    return null;
  }

  /**
   * Ejecuta el ciclo cognitivo multi-turno hasta completar la tarea o requerir aprobación.
   */
  public async run(options: LoopRunOptions): Promise<LoopExecutionResult> {
    const messages: ModelMessage[] = [...options.messages];
    const maxSteps = options.maxSteps ?? this.config.maxSteps ?? 10;
    const role: ModelRole = options.role ?? this.config.defaultRole ?? "reasoning-heavy";
    const systemPrompt = options.systemPrompt ?? this.config.systemPrompt;
    const approvalHandler = options.approvalHandler ?? this.config.approvalHandler;
    const approvalEngine = options.approvalEngine ?? this.approvalEngine;
    const errorHandler: ErrorHandler = options.errorHandler ?? this.errorHandler;
    const eventBus = options.eventBus ?? this.eventBus;
    const sessionId = options.context.sessionId;
    const traceId = options.traceId ?? sessionId;
    // EGO-FIND-74: correlación del turno. Se propaga a los eventos de tool
    // para poder reconstruir la traza (turno → tool calls → logs).
    const correlationId = options.correlationId;
    const correlationMeta = correlationId ? { correlationId } : undefined;
    const loopStartTime = Date.now();

    // Ola 9 (A4): la VISTA filtrada del registro de tools por Sub-Ego.
    // Sin Sub-Ego (turno del usuario/app) es `null` ⇒ se usa el registro
    // global: es la vista del usuario, no la de un Sub-Ego.
    const toolView = toolViewFor(this.registry, options.context.subEgoId);

    // STAB-05: enforcement del prefijo cacheado (deuda `types.ts:77-87`).
    // Si hay fingerprint fijado (opción > config) y el system difiere, el
    // turno se rechaza SIN llamar al modelo — salvo rebuild explícito por
    // compresión (`isCompressionRebuild: true`, único cache-break
    // sancionado, espejo de `assertSystemPromptStable` en @ego/subegos).
    const cachedFingerprint =
      options.cachedSystemPromptFingerprint ?? this.config.cachedSystemPromptFingerprint;
    // El overlay efímero muta cada turno por diseño: el check hashea la
    // parte estable (`stableSystemPrompt`) cuando el caller la declara.
    const stableForCheck = options.stableSystemPrompt ?? systemPrompt;
    if (cachedFingerprint !== undefined && stableForCheck !== undefined) {
      const candidate = createHash("sha256").update(stableForCheck, "utf8").digest("hex");
      if (candidate !== cachedFingerprint && options.isCompressionRebuild !== true) {
        return {
          status: "error",
          messages,
          steps: 0,
          error:
            "System prompt mutado mid-turn fuera de compresión: la única reconstrucción " +
            "permitida usa { isCompressionRebuild: true }.",
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
        };
      }
    }

    let step = 0;
    const totalUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0
    };

    while (step < maxSteps) {
      step++;

      const checkpoint = this.abortCheckpoint(
        options, messages, step, totalUsage, eventBus, sessionId, traceId
      );
      if (checkpoint) return checkpoint;

      this.config.onStep?.({
        step,
        action: "model_called",
        details: { messageCount: messages.length, role }
      });

      // Superficie del modelo: la VISTA del Sub-Ego del turno (Ola 9). Sin
      // Sub-Ego es el registro global (el usuario ve todo).
      const toolSchemas = (toolView
        ? toolView.exportJsonSchemas()
        : this.registry.exportJsonSchemas()
      ).map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }));

      // Llamada al ModelRouter con soporte de tools (+ modelo preferido del usuario).
      // El provider puede no soportar abort mid-token: si ignora la señal, el
      // checkpoint post-generate detiene el loop igual entre turnos.
      //
      // EGO-FIND-60 (T5): el prompt se ensambla por canales — el contenido no
      // confiable (`trust: "untrusted"`) viaja en el canal de datos, nunca en
      // el canal de control, de modo que un texto externo no puede alterar
      // instrucciones aunque contenga tags de control.
      const promptMessages = assembleTrustedPrompt(messages);
      let res;
      try {
        res = await this.router.generateText(role, {
          messages: promptMessages,
          tools: toolSchemas.length > 0 ? toolSchemas : undefined,
          systemPrompt,
          abortSignal: options.abortSignal,
          // STAB-06: tuning per-call hilado al provider (gana sobre PreferredModel).
          ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
          ...(options.reasoningEffort !== undefined ? { reasoningEffort: options.reasoningEffort } : {}),
        }, undefined, options.preferredModel);
      } catch (err) {
        const aborted = this.abortResultForError(
          err, options, messages, step, totalUsage, eventBus, sessionId, traceId
        );
        if (aborted) return aborted;
        throw err;
      }

      const postGenerate = this.abortCheckpoint(
        options, messages, step, totalUsage, eventBus, sessionId, traceId
      );
      if (postGenerate) return postGenerate;

      // Acumular métricas de uso
      totalUsage.promptTokens += res.usage.promptTokens;
      totalUsage.completionTokens += res.usage.completionTokens;
      totalUsage.totalTokens += res.usage.totalTokens;
      totalUsage.estimatedCostUsd += res.usage.estimatedCostUsd;

      // Auto-reparación e intercepción de llamadas a herramientas emitidas en texto plano (OCLW-03)
      if ((!res.toolCalls || res.toolCalls.length === 0) && res.text) {
        const extracted = ToolCallRepairEngine.extractFromText(res.text);
        if (extracted.length > 0) {
          res.toolCalls = extracted.map((ext, idx) => ({
            id: `call_repaired_${Date.now()}_${idx}`,
            name: ext.name,
            arguments: ext.arguments
          }));
          res.text = ToolCallRepairEngine.stripToolCalls(res.text);
        }
      }

      // Si el modelo solicita invocar herramientas
      if (res.toolCalls && res.toolCalls.length > 0) {
        // Añadir turno del asistente conteniendo las llamadas solicitadas
        messages.push({
          role: "assistant",
          content: res.text || "",
          toolCalls: res.toolCalls
        });

        this.config.onStep?.({
          step,
          action: "tools_requested",
          details: { requestedTools: res.toolCalls.map((tc) => tc.name) }
        });

        // ══════════════════════════════════════════════════════════════════
        // E1 (EGO-FIND-43) — Tool calls CONCURRENTES con orden garantizado.
        // ══════════════════════════════════════════════════════════════════
        //
        // POR QUÉ 3 FASES Y NO UN `Promise.all` SOBRE EL BUCLE:
        // el proveedor exige que cada `tool_result` siga en orden a su
        // `tool_use`. Verificado contra el source del SDK:
        // `@ai-sdk/anthropic@4.0.78` → `src/convert-to-anthropic-prompt.ts`,
        // `groupIntoBlocks()` (L1569-1577): los mensajes `tool` CONSECUTIVOS se
        // agrupan en un único bloque `user` y sus partes `tool_result` se
        // empujan EN EL ORDEN DEL ARRAY de mensajes. Por tanto el orden del
        // array `messages` de Ego ES el orden de los `tool_result` del payload:
        // ejecutar en paralelo y emitir por orden de completación violaría el
        // contrato del proveedor.
        //
        // Diseño en 3 fases:
        //   A) PREPARACIÓN (secuencial, por tool, en orden): lookup, reparación,
        //      validación, gates de gobernanza y aprobación HITL. Sin I/O.
        //   B) EJECUCIÓN (concurrente): las tools aprobadas se lanzan a la vez;
        //      el `ExecutionManager` gobierna `maxConcurrentExecutions`, la cola,
        //      el timeout por llamada, el abort, el truncado por bytes, el
        //      circuit breaker y la quota por Sub-Ego.
        //   C) EMISIÓN (secuencial, en orden): los resultados se empujan al
        //      array `messages` en el ORDEN ORIGINAL de los `tool_use`.
        //
        // Un tool que falla NO aborta el turno: su resultado de error ocupa SU
        // posición (aislamiento de fallos).
        type ToolCallPlan =
          | { kind: "message"; message: ModelMessage; correlationId?: string }
          | {
              kind: "execute";
              call: ToolCall;
              tool: ToolDefinition;
              args: Record<string, unknown>;
              correlationId?: string;
            };

        const plans: ToolCallPlan[] = [];
        let suspended: ApprovalRequest | null = null;

        // ── FASE A: PREPARACIÓN (secuencial, en orden) ─────────────────────
        for (const call of res.toolCalls) {
          // Cancelación entre herramientas: no ejecutar más tools del turno.
          const betweenTools = this.abortCheckpoint(
            options, messages, step, totalUsage, eventBus, sessionId, traceId
          );
          if (betweenTools) return betweenTools;

          this.config.onToolCall?.(call);

          // EGO-FIND-74: span hijo determinista por tool call
          // (`tool:<nombre>`), para correlacionar start ↔ executed ↔ log.
          const toolCorrelationId = correlationId
            ? childCorrelationId(correlationId, `tool:${call.name}`)
            : undefined;
          const toolMeta = toolCorrelationId ? { correlationId: toolCorrelationId } : correlationMeta;

          // Punto 2 (Ola 9): la resolución de la ejecución va contra la
          // VISTA del Sub-Ego, no contra el global. Una tool de otro Sub-Ego
          // NO se ejecuta: es un error tipado ("no es tuya" ≠ "no existe").
          const resolvedTool = resolveVisibleTool(
            this.registry,
            call.name,
            options.context.subEgoId
          );
          const tool = resolvedTool.tool;
          eventBus?.emit("tool.started", {
            callId: call.id,
            toolName: call.name,
            input: call.arguments,
            riskLevel: tool?.riskLevel
          }, {
            source: "runtime.tool_loop",
            sessionId,
            traceId,
            severity: "info",
            metadata: toolMeta
          });

          if (!tool) {
            const notVisible = resolvedTool.notVisible;
            eventBus?.emit("tool.failed", {
              callId: call.id,
              toolName: call.name,
              error: notVisible
                ? notVisible.message
                : `Herramienta '${call.name}' no encontrada.`,
              durationMs: 0
            }, {
              source: "runtime.tool_loop",
              sessionId,
              traceId,
              severity: "error",
              metadata: toolMeta
            });

            // "No es tuya" ⇒ error TIPADO (TOOL_NOT_VISIBLE) con el dueño:
            // el modelo debe entender que la tool existe pero no le
            // corresponde, y no pedirla otra vez. Y el catálogo que se le
            // sugiere es el de SU vista (no el global: no se filtra).
            const enriched = notVisible
              ? {
                  status: "error" as const,
                  category: "TOOL_NOT_VISIBLE" as const,
                  toolName: call.name,
                  callId: call.id,
                  message: notVisible.message,
                  remedyHint:
                    `Usa una de las herramientas disponibles para "${options.context.subEgoId ?? "este turno"}".`,
                  rawError: notVisible.name,
                }
              : errorHandler.handleToolNotFound(
                  call,
                  visibleToolNames(this.registry, options.context.subEgoId)
                );
            plans.push({
              kind: "message",
              message: {
                role: "tool",
                toolCallId: call.id,
                name: call.name,
                content: errorHandler.formatErrorResponse(enriched)
              }
            });
            continue;
          }

          // Auto-reparación sintáctica heurística de argumentos (OCLW-03, OCLW-04)
          const repaired = ToolCallRepairEngine.repair({
            name: call.name,
            arguments: call.arguments
          });
          const repairedArgs = repaired ? repaired.arguments : errorHandler.repairArguments(call.name, call.arguments);

          // Validación estricta con Zod
          const validation = this.registry.validateInput(call.name, repairedArgs);
          if (!validation.success) {
            eventBus?.emit("tool.failed", {
              callId: call.id,
              toolName: call.name,
              error: validation.error.message || `Validación fallida para '${call.name}'.`,
              durationMs: 0
            }, {
              source: "runtime.tool_loop",
              sessionId,
              traceId,
              severity: "error",
              metadata: toolMeta
            });

            const enriched = errorHandler.handleValidationError(call, validation.error);
            plans.push({
              kind: "message",
              message: {
                role: "tool",
                toolCallId: call.id,
                name: call.name,
                content: errorHandler.formatErrorResponse(enriched)
              }
            });
            continue;
          }

          let finalArgs = validation.data;

          // Gate de gobernanza STAB-12 (Spec D4): deny/hook vetan con mensaje
          // al modelo; requireApproval fuerza la vía HITL existente.
          const gate = this.applyGovernanceGates(
            tool,
            { id: call.id, name: call.name, args: call.arguments },
            { sessionId, traceId, eventBus }
          );
          if (gate.rejected) {
            plans.push({
              kind: "message",
              message: {
                role: "tool",
                toolCallId: call.id,
                name: call.name,
                content: JSON.stringify({ status: "rejected", message: gate.rejected })
              }
            });
            continue;
          }

          // Verificación de política HITL (aprobación humana) — POR TOOL.
          //
          // EGO-FIND-60 (T5): si el historial contiene contenido NO CONFIABLE
          // (procedencia externa) y la herramienta es destructiva o de riesgo
          // alto, la llamada se escala a aprobación humana aunque la política
          // por defecto no la exigiría: el contenido externo pudo haber
          // influenceado los argumentos.
          const taintedDestructiveGuard =
            (tool.riskLevel === "destructive" || tool.riskLevel === "sensitive") &&
            messages.some(isTainted);

          const requiresApproval =
            gate.forceApproval ||
            taintedDestructiveGuard ||
            (approvalEngine
              ? approvalEngine.evaluateRequirement(tool, finalArgs, options.context).required
              : this.registry.resolveApprovalRequirement(tool));

          if (requiresApproval) {
            let decision: ApprovalDecision;
            const approvalId = `appr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

            if (approvalEngine) {
              this.config.onStep?.({
                step,
                action: "approval_requested",
                details: { toolName: tool.name, callId: call.id }
              });

              eventBus?.emit("approval.required", {
                approvalId,
                action: tool.name,
                riskLevel: tool.riskLevel,
                details: finalArgs,
                timeoutMs: 120_000
              }, {
                source: "runtime.tool_loop",
                sessionId,
                traceId,
                severity: "warn",
                metadata: toolMeta
              });

              try {
                decision = await approvalEngine.requestApproval({
                  tool,
                  arguments: finalArgs,
                  context: options.context,
                  callId: call.id,
                  abortSignal: options.abortSignal
                });
              } catch (err) {
                const aborted = this.abortResultForError(
                  err, options, messages, step, totalUsage, eventBus, sessionId, traceId
                );
                if (aborted) return aborted;
                throw err;
              }

              this.config.onStep?.({
                step,
                action: "approval_resolved",
                details: { approved: decision.approved, reason: decision.reason }
              });

              eventBus?.emit("approval.resolved", {
                approvalId,
                approved: decision.approved,
                resolvedBy: "user",
                reason: decision.reason
              }, {
                source: "runtime.tool_loop",
                sessionId,
                traceId,
                severity: "info",
                metadata: toolMeta
              });
            } else if (approvalHandler) {
              const approvalReq: ApprovalRequest = {
                approvalId,
                toolName: tool.name,
                toolCategory: tool.category,
                riskLevel: tool.riskLevel,
                arguments: finalArgs,
                callId: call.id,
                sessionId: options.context.sessionId,
                subEgoId: options.context.subEgoId,
                timestamp: Date.now()
              };

              this.config.onStep?.({
                step,
                action: "approval_requested",
                details: { toolName: tool.name, approvalId: approvalReq.approvalId }
              });

              eventBus?.emit("approval.required", {
                approvalId: approvalReq.approvalId,
                action: tool.name,
                riskLevel: tool.riskLevel,
                details: finalArgs
              }, {
                source: "runtime.tool_loop",
                sessionId,
                traceId,
                severity: "warn",
                metadata: toolMeta
              });

              try {
                decision = await approvalHandler(approvalReq);
              } catch (err) {
                const aborted = this.abortResultForError(
                  err, options, messages, step, totalUsage, eventBus, sessionId, traceId
                );
                if (aborted) return aborted;
                throw err;
              }

              this.config.onStep?.({
                step,
                action: "approval_resolved",
                details: { approved: decision.approved, reason: decision.reason }
              });

              eventBus?.emit("approval.resolved", {
                approvalId: approvalReq.approvalId,
                approved: decision.approved,
                resolvedBy: "user",
                reason: decision.reason
              }, {
                source: "runtime.tool_loop",
                sessionId,
                traceId,
                severity: "info",
                metadata: toolMeta
              });
            } else {
              // Sin handler ni engine inmediato: se suspende el ciclo.
              // Los planes ANTERIORES a esta llamada ya se han resuelto y se
              // emiten (en orden) antes de devolver la suspensión; los
              // posteriores NO se ejecutan (mismo contrato que el serie).
              suspended = {
                approvalId,
                toolName: tool.name,
                toolCategory: tool.category,
                riskLevel: tool.riskLevel,
                arguments: finalArgs,
                callId: call.id,
                sessionId: options.context.sessionId,
                subEgoId: options.context.subEgoId,
                timestamp: Date.now()
              };
              break;
            }

            if (!decision.approved) {
              const rejectionPayload = {
                status: "rejected",
                message: decision.reason || "Acción rechazada por el usuario o directiva de gobernanza."
              };
              plans.push({
                kind: "message",
                message: {
                  role: "tool",
                  toolCallId: call.id,
                  name: tool.name,
                  content: JSON.stringify(rejectionPayload)
                }
              });
              continue;
            }

            if (decision.modifiedArguments) {
              finalArgs = decision.modifiedArguments;
            }
          }

          plans.push({ kind: "execute", call, tool, args: finalArgs, correlationId: toolCorrelationId });
        }

        // ── FASE B: EJECUCIÓN (concurrente) ────────────────────────────────
        // Los planes previos a una suspensión sí se ejecutan (su resultado
        // debe estar en `messages` antes de devolver la suspensión); los
        // posteriores, no (mismo contrato que la ejecución en serie).
        const execSlots = plans.filter(
          (p): p is Extract<ToolCallPlan, { kind: "execute" }> => p.kind === "execute"
        );

        const execManager = options.executionManager ?? this.executionManager;
        const parallel = this.config.parallelToolCalls !== false;

        for (const slot of execSlots) {
          this.config.onStep?.({
            step,
            action: "tool_executing",
            details: { toolName: slot.tool.name, callId: slot.call.id }
          });
        }

        type ExecResult = Awaited<ReturnType<typeof execManager.execute>>;
        const runSlot = (slot: Extract<ToolCallPlan, { kind: "execute" }>) =>
          execManager.execute(slot.tool, slot.args, options.context, {
            abortSignal: options.abortSignal
          });

        // `Promise.allSettled` conserva el ORDEN de entrada en el array de
        // resultados ⇒ `settled[i]` corresponde a `execSlots[i]`.
        let settled: PromiseSettledResult<ExecResult>[];
        if (parallel) {
          settled = await Promise.allSettled(execSlots.map((slot) => runSlot(slot)));
        } else {
          settled = [];
          for (const slot of execSlots) {
            try {
              settled.push({ status: "fulfilled", value: await runSlot(slot) });
            } catch (reason: unknown) {
              settled.push({ status: "rejected", reason });
            }
          }
        }

        // ── FASE C: EMISIÓN (secuencial, en el orden original) ─────────────
        let slotIndex = 0;
        for (const plan of plans) {
          if (plan.kind === "message") {
            messages.push(plan.message);
            continue;
          }

          const outcome = settled[slotIndex++];
          const { call, tool } = plan;

          if (!outcome) {
            // Sin resultado (no debería ocurrir): error defensivo en posición.
            messages.push({
              role: "tool",
              toolCallId: call.id,
              name: tool.name,
              content: JSON.stringify({
                status: "error",
                message: "La herramienta no produjo resultado."
              })
            });
            continue;
          }

          if (outcome.status === "rejected") {
            // La llamada lanzó fuera del contrato del ExecutionManager
            // (p. ej. cancelación). Si es cancelación → turno abortado; si no,
            // se AISLA: el error ocupa SU posición y el turno continúa.
            const aborted = this.abortResultForError(
              outcome.reason, options, messages, step, totalUsage, eventBus, sessionId, traceId
            );
            if (aborted) return aborted;

            const rawMessage =
              outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
            const enriched = errorHandler.handleExecutionError(call, rawMessage, 0);
            messages.push({
              role: "tool",
              toolCallId: call.id,
              name: tool.name,
              content: errorHandler.formatErrorResponse(enriched)
            });
            continue;
          }

          const execRes = outcome.value;
          const executionResult: ToolExecutionResult = {
            callId: call.id,
            toolName: tool.name,
            success: execRes.status === "success",
            output: execRes.output,
            error: execRes.error,
            durationMs: execRes.durationMs,
            correlationId: plan.correlationId
          };
          const planMeta = plan.correlationId
            ? { correlationId: plan.correlationId }
            : correlationMeta;

          if (execRes.status === "success") {
            errorHandler.notifySuccess();
            eventBus?.emit("tool.executed", {
              callId: call.id,
              toolName: tool.name,
              durationMs: execRes.durationMs,
              result: execRes.output
            }, {
              source: "runtime.tool_loop",
              sessionId,
              traceId,
              severity: "info",
              metadata: planMeta
            });
            const toolContent =
              typeof execRes.output === "string"
                ? execRes.output
                : JSON.stringify(execRes.output);
            // Ola 9: la salida de una herramienta es contenido EXTERNO. Se
            // detecta en el punto de ingesta: si es sospechosa, el mensaje
            // queda marcado como no confiable ⇒ viaja por el canal sin
            // privilegios (ADR-0019) y no puede alterar instrucciones.
            // Fail-open: si el detector falla, se degrada (nunca se bloquea).
            const screened = this.config.injectionPolicy
              ? screenUntrustedContent(toolContent, {
                  ...this.config.injectionPolicy,
                  scope: "all-except-trusted",
                })
              : null;
            if (screened?.verdict === "suspicious") {
              this.config.injectionPolicy?.onDetect?.({
                verdict: "suspicious",
                action: "degrade",
                affected: 1,
                signals: screened.signals,
                detectorFailed: screened.detectorFailed,
              });
              eventBus?.emit("tool.executed", {
                callId: call.id,
                toolName: tool.name,
                durationMs: execRes.durationMs,
                result: { injectionSuspected: true, signals: screened.signals.length }
              }, {
                source: "runtime.tool_loop",
                sessionId,
                traceId,
                severity: "warn",
                metadata: planMeta
              });
            }
            messages.push({
              role: "tool",
              toolCallId: call.id,
              name: tool.name,
              content: toolContent,
              ...(screened?.verdict === "suspicious" ? { trust: "untrusted" as const } : {}),
            });
          } else {
            const errorMsg = execRes.error || "Fallo durante la ejecución.";
            eventBus?.emit("tool.failed", {
              callId: call.id,
              toolName: tool.name,
              error: errorMsg,
              durationMs: execRes.durationMs
            }, {
              source: "runtime.tool_loop",
              sessionId,
              traceId,
              severity: "error",
              metadata: planMeta
            });
            const enriched = errorHandler.handleExecutionError(
              call,
              errorMsg,
              execRes.durationMs
            );
            messages.push({
              role: "tool",
              toolCallId: call.id,
              name: tool.name,
              content: errorHandler.formatErrorResponse(enriched)
            });
          }

          this.config.onToolResult?.(executionResult);
          // Observación PostToolUse STAB-12: nunca bloquea (el efecto ya
          // ocurrió); solo audita cuando un hook matchea.
          this.observePostToolUse(tool.name, sessionId, traceId, eventBus);
          this.config.onStep?.({
            step,
            action: "tool_executed",
            details: { toolName: tool.name, success: executionResult.success }
          });
        }

        if (suspended) {
          // Suspensión HITL: se devuelven los resultados ya emitidos (en orden)
          // y la solicitud de aprobación pendiente. Las tool calls posteriores a
          // esta NO se ejecutan (mismo contrato que la ejecución en serie).
          return {
            status: "approval_required",
            pendingApproval: suspended,
            messages,
            steps: step,
            usage: totalUsage
          };
        }

        // Continúa la siguiente iteración multi-turno
        continue;
      }

      // Respuesta final del modelo (sin más tool_calls solicitadas)
      messages.push({
        role: "assistant",
        content: res.text
      });

      this.config.onStep?.({
        step,
        action: "completed",
        details: { finalTextLength: res.text.length }
      });

      eventBus?.emit("task.completed", {
        taskId: sessionId,
        durationMs: Date.now() - loopStartTime,
        result: { steps: step, finalTextLength: res.text.length, totalTokens: totalUsage.totalTokens }
      }, {
        source: "runtime.tool_loop",
        sessionId,
        traceId,
        severity: "info"
      });

      return {
        status: "completed",
        finalText: res.text,
        messages,
        steps: step,
        usage: totalUsage
      };
    }

    // Límite de turnos alcanzado
    eventBus?.emit("task.failed", {
      taskId: sessionId,
      error: `Se excedió el número máximo de pasos permitidos (${maxSteps}) sin llegar a una respuesta terminal.`,
      code: "MAX_STEPS_EXCEEDED"
    }, {
      source: "runtime.tool_loop",
      sessionId,
      traceId,
      severity: "warn"
    });

    return {
      status: "max_steps_exceeded",
      messages,
      steps: step,
      error: `Se excedió el número máximo de pasos permitidos (${maxSteps}) sin llegar a una respuesta terminal.`,
      usage: totalUsage
    };
  }

  /**
   * Reanuda la ejecución tras la resolución de una solicitud de aprobación suspendida.
   */
  public async resume(
    pendingApproval: ApprovalRequest,
    decision: ApprovalDecision,
    options: LoopRunOptions
  ): Promise<LoopExecutionResult> {
    const messages = [...options.messages];
    // Ola 9: la reanudación tras aprobación también resuelve contra la VISTA
    // del Sub-Ego (fail-closed): si la tool dejó de ser visible (o nunca lo
    // fue), no se ejecuta.
    const tool = resolveVisibleTool(
      this.registry,
      pendingApproval.toolName,
      pendingApproval.subEgoId ?? options.context.subEgoId
    ).tool;
    const eventBus = options.eventBus ?? this.eventBus;
    const sessionId = options.context.sessionId;
    const traceId = options.traceId ?? sessionId;

    if (!decision.approved) {
      messages.push({
        role: "tool",
        toolCallId: pendingApproval.callId,
        name: pendingApproval.toolName,
        content: JSON.stringify({
          status: "rejected",
          message: decision.reason || "Acción rechazada por el usuario."
        })
      });
    } else if (tool) {
      const argsToExecute = decision.modifiedArguments || pendingApproval.arguments;
      const execManager = options.executionManager ?? this.executionManager;

      eventBus?.emit("tool.started", {
        callId: pendingApproval.callId,
        toolName: tool.name,
        input: argsToExecute,
        riskLevel: tool.riskLevel
      }, {
        source: "runtime.tool_loop",
        sessionId,
        traceId,
        severity: "info"
      });

      const execRes = await execManager.execute(tool, argsToExecute, options.context, {
        abortSignal: options.abortSignal
      }).catch((err: unknown) => {
        if (options.abortSignal?.aborted || isAbortError(err)) {
          eventBus?.emit("task.failed", {
            taskId: sessionId,
            error: "Operación abortada por señal de cancelación (AbortSignal).",
            code: "ABORTED"
          }, {
            source: "runtime.tool_loop",
            sessionId,
            traceId,
            severity: "warn"
          });
          return null;
        }
        throw err;
      });

      if (execRes === null) {
        return {
          status: "aborted",
          messages,
          steps: 0,
          error: "Operación abortada por señal de cancelación (AbortSignal).",
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 }
        };
      }

      if (execRes.status === "success") {
        eventBus?.emit("tool.executed", {
          callId: pendingApproval.callId,
          toolName: tool.name,
          durationMs: execRes.durationMs,
          result: execRes.output
        }, {
          source: "runtime.tool_loop",
          sessionId,
          traceId,
          severity: "info"
        });

        messages.push({
          role: "tool",
          toolCallId: pendingApproval.callId,
          name: tool.name,
          content:
            typeof execRes.output === "string"
              ? execRes.output
              : JSON.stringify(execRes.output)
        });
      } else {
        const errorMsg = execRes.error || "Fallo durante la ejecución.";
        eventBus?.emit("tool.failed", {
          callId: pendingApproval.callId,
          toolName: tool.name,
          error: errorMsg,
          durationMs: execRes.durationMs
        }, {
          source: "runtime.tool_loop",
          sessionId,
          traceId,
          severity: "error"
        });

        messages.push({
          role: "tool",
          toolCallId: pendingApproval.callId,
          name: tool.name,
          content: JSON.stringify({
            status: execRes.status,
            message: `Error al reanudar herramienta: ${errorMsg}`
          })
        });
      }
    }

    // Continuar el loop a partir del nuevo historial
    return this.run({
      ...options,
      messages
    });
  }
}