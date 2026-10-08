import type { ModelMessage, ModelRole } from "@ego/models";
import { ModelRouter } from "@ego/models";
import { ToolRegistry } from "@ego/tools";
import type {
  ApprovalDecision,
  ApprovalRequest,
  LoopExecutionResult,
  LoopRunOptions,
  ToolExecutionLoopConfig,
  ToolExecutionResult
} from "./types.js";

/**
 * Loop cognitivo multi-turno para Tool Calling (ACT-02).
 *
 * Orquesta la interacción cíclica entre el modelo y las herramientas:
 * 1. Envío de mensajes y esquemas JSON Schema al ModelRouter.
 * 2. Detección e intercepción de llamadas a herramientas (`tool_calls`).
 * 3. Validación estricta de parámetros en tiempo de ejecución con Zod.
 * 4. Gobernanza Human-in-the-Loop (HITL): suspensión o despacho a handlers de aprobación.
 * 5. Ejecución segura con contexto e inyección causal del resultado como rol `tool`.
 * 6. Manejo resiliente de fallos para autocorrección guiada por el modelo.
 * 7. Control de cuota y límite de iteraciones (anti-bucles infinitos).
 */
export class ToolExecutionLoop {
  private readonly router: ModelRouter;
  private readonly registry: ToolRegistry;
  private readonly config: ToolExecutionLoopConfig;

  constructor(
    router: ModelRouter,
    registry: ToolRegistry,
    config: ToolExecutionLoopConfig = {}
  ) {
    this.router = router;
    this.registry = registry;
    this.config = {
      maxSteps: 10,
      defaultRole: "reasoning-heavy",
      ...config
    };
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

    let step = 0;
    const totalUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0
    };

    while (step < maxSteps) {
      step++;

      if (options.abortSignal?.aborted) {
        return {
          status: "aborted",
          messages,
          steps: step,
          error: "Operación abortada por señal de cancelación (AbortSignal).",
          usage: totalUsage
        };
      }

      this.config.onStep?.({
        step,
        action: "model_called",
        details: { messageCount: messages.length, role }
      });

      // Exportar herramientas declaradas en el registro
      const toolSchemas = this.registry.exportJsonSchemas().map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }));

      // Llamada al ModelRouter con soporte de tools
      const res = await this.router.generateText(role, {
        messages,
        tools: toolSchemas.length > 0 ? toolSchemas : undefined,
        systemPrompt,
        abortSignal: options.abortSignal
      });

      // Acumular métricas de uso
      totalUsage.promptTokens += res.usage.promptTokens;
      totalUsage.completionTokens += res.usage.completionTokens;
      totalUsage.totalTokens += res.usage.totalTokens;
      totalUsage.estimatedCostUsd += res.usage.estimatedCostUsd;

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

        for (const call of res.toolCalls) {
          this.config.onToolCall?.(call);

          const tool = this.registry.get(call.name);
          if (!tool) {
            const errorPayload = {
              status: "error",
              message: `Herramienta "${call.name}" no encontrada en el registro de Ego.`
            };
            messages.push({
              role: "tool",
              toolCallId: call.id,
              name: call.name,
              content: JSON.stringify(errorPayload)
            });
            continue;
          }

          // Validación estricta con Zod
          const validation = this.registry.validateInput(call.name, call.arguments);
          if (!validation.success) {
            const errorPayload = {
              status: "error",
              message: `Argumentos inválidos para la herramienta "${call.name}".`,
              validationErrors: validation.error.format()
            };
            messages.push({
              role: "tool",
              toolCallId: call.id,
              name: call.name,
              content: JSON.stringify(errorPayload)
            });
            continue;
          }

          let finalArgs = validation.data;

          // Verificación de política HITL (aprobación humana)
          const requiresApproval = this.registry.resolveApprovalRequirement(tool);
          if (requiresApproval) {
            const approvalReq: ApprovalRequest = {
              approvalId: `appr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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

            if (approvalHandler) {
              const decision = await approvalHandler(approvalReq);
              this.config.onStep?.({
                step,
                action: "approval_resolved",
                details: { approved: decision.approved, reason: decision.reason }
              });

              if (!decision.approved) {
                const rejectionPayload = {
                  status: "rejected",
                  message: decision.reason || "Acción rechazada por el usuario o directiva de gobernanza."
                };
                messages.push({
                  role: "tool",
                  toolCallId: call.id,
                  name: tool.name,
                  content: JSON.stringify(rejectionPayload)
                });
                continue;
              }

              if (decision.modifiedArguments) {
                finalArgs = decision.modifiedArguments;
              }
            } else {
              // Si requiere aprobación y no hay handler inmediato, suspendemos el ciclo
              return {
                status: "approval_required",
                pendingApproval: approvalReq,
                messages,
                steps: step,
                usage: totalUsage
              };
            }
          }

          // Ejecución material de la herramienta
          const startTime = Date.now();
          this.config.onStep?.({
            step,
            action: "tool_executing",
            details: { toolName: tool.name, callId: call.id }
          });

          let executionResult: ToolExecutionResult;
          try {
            const output = await tool.execute(finalArgs, options.context);
            const durationMs = Date.now() - startTime;
            executionResult = {
              callId: call.id,
              toolName: tool.name,
              success: true,
              output,
              durationMs
            };

            messages.push({
              role: "tool",
              toolCallId: call.id,
              name: tool.name,
              content: typeof output === "string" ? output : JSON.stringify(output)
            });
          } catch (err) {
            const durationMs = Date.now() - startTime;
            const errorMsg = err instanceof Error ? err.message : String(err);
            executionResult = {
              callId: call.id,
              toolName: tool.name,
              success: false,
              error: errorMsg,
              durationMs
            };

            // Inyección causal del error para permitir autocorrección del modelo
            messages.push({
              role: "tool",
              toolCallId: call.id,
              name: tool.name,
              content: JSON.stringify({
                status: "error",
                message: `Fallo durante la ejecución de "${tool.name}": ${errorMsg}`
              })
            });
          }

          this.config.onToolResult?.(executionResult);
          this.config.onStep?.({
            step,
            action: "tool_executed",
            details: { toolName: tool.name, success: executionResult.success }
          });
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

      return {
        status: "completed",
        finalText: res.text,
        messages,
        steps: step,
        usage: totalUsage
      };
    }

    // Límite de turnos alcanzado
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
    const tool = this.registry.get(pendingApproval.toolName);

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
      try {
        const output = await tool.execute(argsToExecute, options.context);
        messages.push({
          role: "tool",
          toolCallId: pendingApproval.callId,
          name: tool.name,
          content: typeof output === "string" ? output : JSON.stringify(output)
        });
      } catch (err) {
        messages.push({
          role: "tool",
          toolCallId: pendingApproval.callId,
          name: tool.name,
          content: JSON.stringify({
            status: "error",
            message: `Error al reanudar herramienta: ${err instanceof Error ? err.message : String(err)}`
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
