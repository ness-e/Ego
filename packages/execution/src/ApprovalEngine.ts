import * as crypto from "node:crypto";
import { assertSameApproval, type ApprovalIdentity } from "@ego/events";
import type { ToolCategory, ToolDefinition, ToolExecutionContext, ToolRiskLevel } from "@ego/tools";
import type {
  ActionIdentity,
  ApprovalAuditEntry,
  ApprovalDecision,
  ApprovalEngineConfig,
  GovernanceMode,
  PendingApproval
} from "./types.js";

/**
 * Forma laxa de una identidad de aprobación: admite los alias históricos
 * (`id`, `toolName`, `argsDigest`) junto a los campos canónicos.
 * Permite normalizar sin `as any` (A2-21).
 */
interface ApprovalIdentityLike {
  id?: string;
  runId?: string;
  taskId?: string;
  subEgoId?: string;
  toolId?: string;
  toolName?: string;
  inputDigest?: string;
  argsDigest?: string;
}

/** Lee una propiedad string opcional de un objeto de forma segura. */
function readOptionalString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Normaliza una identidad de aprobación a la forma canónica
 * (`runId`, `taskId`, `subEgoId`, `toolId`, `inputDigest`), resolviendo los
 * alias heredados. No muta la entrada (A2-21).
 */
export function normalizeApprovalIdentity(source: ApprovalIdentityLike): ApprovalIdentity {
  const inputDigest = source.inputDigest ?? source.argsDigest ?? "";
  const toolId = source.toolId ?? source.toolName ?? "";
  const runId = source.runId ?? source.id ?? "";
  return {
    runId,
    taskId: source.taskId ?? runId,
    subEgoId: source.subEgoId ?? "ego.nucleus",
    toolId,
    inputDigest,
  };
}

/**
 * Función auxiliar para serialización canónica determinista de objetos.
 * Ordena alfabéticamente las claves de cualquier objeto o array anidado.
 */
export function canonicalJsonStringify(val: unknown): string {
  if (val === null || typeof val !== "object") {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return `[${val.map(canonicalJsonStringify).join(",")}]`;
  }
  const obj = val as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(
    (k) => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`
  );
  return `{${pairs.join(",")}}`;
}

/**
 * Calcula la identidad causal exacta e inmutable de una acción (COUC-03).
 */
export function computeActionIdentity(params: {
  sessionId: string;
  subEgoId?: string;
  toolName: string;
  callId: string;
  arguments: unknown;
}): ActionIdentity {
  const canonicalArgs = canonicalJsonStringify(params.arguments);
  const inputDigest = crypto
    .createHash("sha256")
    .update(canonicalArgs, "utf8")
    .digest("hex");

  return {
    sessionId: params.sessionId,
    subEgoId: params.subEgoId || "ego.nucleus",
    toolName: params.toolName,
    callId: params.callId,
    inputDigest,
    createdAt: Date.now()
  };
}

interface PendingEntry {
  approval: PendingApproval;
  resolve: (decision: ApprovalDecision) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

/**
 * ApprovalEngine — Sistema de Aprobación de Acciones Sensibles Human-in-the-Loop (ACT-06).
 *
 * Implementa el Principio Innegociable 6 de Ego:
 * - Interceptor de seguridad previo a la ejecución.
 * - Validación inmutable de identidad causal (`ActionIdentity`).
 * - Retención asíncrona de promesas (ACK en el borde) con soporte de timeout y abort.
 * - Desinfección de argumentos modificados.
 * - Auditoría inmutable de decisiones.
 */
export class ApprovalEngine {
  private readonly config: Required<Omit<ApprovalEngineConfig, "onApprovalRequested" | "onApprovalResolved" | "auditSink">> & {
    onApprovalRequested?: (req: PendingApproval) => void;
    onApprovalResolved?: (req: PendingApproval, decision: ApprovalDecision) => void;
    auditSink?: (entry: ApprovalAuditEntry) => void | Promise<void>;
  };
  private readonly pendingMap = new Map<string, PendingEntry>();

  constructor(config: ApprovalEngineConfig = {}) {
    this.config = {
      mode: config.mode ?? "standard",
      defaultTimeoutMs: config.defaultTimeoutMs ?? 120_000, // 2 minutos
      rules: config.rules ?? [],
      onApprovalRequested: config.onApprovalRequested,
      onApprovalResolved: config.onApprovalResolved,
      auditSink: config.auditSink
    };
  }

  /**
   * Emite una entrada de auditoría al sink best-effort (SEC-06): un sink que
   * lanza o rechaza NUNCA interrumpe el flujo de aprobación.
   */
  private emitAudit(entry: ApprovalAuditEntry): void {
    const sink = this.config.auditSink;
    if (!sink) return;
    try {
      const result = sink(entry);
      if (result && typeof (result as Promise<void>).catch === "function") {
        (result as Promise<void>).catch(() => {
          // Best-effort: la auditoría no bloquea ni contamina el flujo.
        });
      }
    } catch {
      // Best-effort: ver test "un auditSink que lanza no rompe el flujo".
    }
  }

  public get mode(): GovernanceMode {
    return this.config.mode;
  }

  /**
   * Evalúa si una llamada a una herramienta requiere aprobación humana previa.
   */
  public evaluateRequirement(
    tool: { name: string; category?: ToolCategory; riskLevel?: ToolRiskLevel; requiresApproval?: boolean },
    _args: Record<string, unknown>,
    _context: ToolExecutionContext
  ): { required: boolean; reason?: string } {
    // 1. Reglas explícitas configuradas en el motor
    for (const rule of this.config.rules) {
      if (rule.toolName && rule.toolName === tool.name) {
        return { required: rule.requireApproval, reason: rule.reason || `Regla explícita para herramienta ${tool.name}` };
      }
      if (rule.category && rule.category === tool.category) {
        return { required: rule.requireApproval, reason: rule.reason || `Regla explícita para categoría ${tool.category}` };
      }
      if (rule.riskLevel && rule.riskLevel === tool.riskLevel) {
        return { required: rule.requireApproval, reason: rule.reason || `Regla explícita para nivel de riesgo ${tool.riskLevel}` };
      }
    }

    // 2. Si la herramienta se autodeclara con requiresApproval explícito
    if (tool.requiresApproval === true) {
      return { required: true, reason: `Herramienta ${tool.name} marcada con aprobación obligatoria` };
    }

    // 3. Evaluación según el GovernanceMode de Ego
    const risk = tool.riskLevel || "safe";

    switch (this.config.mode) {
      case "strict":
        // En modo estricto, todo lo que no sea estrictamente "safe" requiere aprobación
        if (risk !== "safe") {
          return {
            required: true,
            reason: `Modo de gobernanza ESTRICTO: la acción tiene nivel de riesgo "${risk}"`
          };
        }
        break;

      case "standard":
        // En modo estándar, destructive SIEMPRE requiere aprobación; sensitive también por defecto
        if (risk === "destructive") {
          return {
            required: true,
            reason: `Acción DESTRUCTIVA (${tool.name}) requiere confirmación humana innegociable`
          };
        }
        if (risk === "sensitive") {
          return {
            required: true,
            reason: `Acción SENSIBLE (${tool.name}) requiere confirmación humana en modo estándar`
          };
        }
        break;

      case "permissive":
        // Solo acciones destructivas irreversibles
        if (risk === "destructive") {
          return {
            required: true,
            reason: `Acción DESTRUCTIVA (${tool.name}) requiere confirmación en modo permisivo`
          };
        }
        break;
    }

    return { required: false };
  }

  /**
   * Registra una solicitud de aprobación y congela la ejecución hasta recibir resolución humana.
   * Cumple con la compuerta COUC-04 (conexión mantenida hasta ACK o timeout).
   */
  public async requestApproval(params: {
    tool: Pick<ToolDefinition, "name" | "category" | "riskLevel">;
    arguments: Record<string, unknown>;
    context: ToolExecutionContext;
    callId: string;
    timeoutMs?: number;
    abortSignal?: AbortSignal;
    metadata?: Record<string, unknown>;
  }): Promise<ApprovalDecision> {
    const actionIdentity = computeActionIdentity({
      sessionId: params.context.sessionId,
      subEgoId: params.context.subEgoId,
      toolName: params.tool.name,
      callId: params.callId,
      arguments: params.arguments
    });

    const approvalId = `appr_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const timeoutMs = params.timeoutMs ?? this.config.defaultTimeoutMs;
    const expiresAt = Date.now() + timeoutMs;

    const pendingApproval: PendingApproval = {
      approvalId,
      action: actionIdentity,
      toolName: params.tool.name,
      toolCategory: params.tool.category,
      riskLevel: params.tool.riskLevel,
      arguments: params.arguments,
      status: "pending",
      createdAt: Date.now(),
      expiresAt,
      metadata: params.metadata
    };

    return new Promise<ApprovalDecision>((resolve, reject) => {
      // Temporizador de timeout determinista
      const timer = setTimeout(() => {
        const entry = this.pendingMap.get(approvalId);
        if (entry) {
          this.pendingMap.delete(approvalId);
          entry.approval.status = "timed_out";
          const decision: ApprovalDecision = {
            approved: false,
            reason: `Timeout de aprobación humana excedido (${timeoutMs}ms). Acción cancelada por seguridad.`,
            timestamp: Date.now()
          };
          this.emitAudit({
            approvalId,
            phase: "timed_out",
            toolName: params.tool.name,
            sessionId: actionIdentity.sessionId,
            subEgoId: actionIdentity.subEgoId,
            callId: actionIdentity.callId,
            inputDigest: actionIdentity.inputDigest,
            approved: false,
            reason: decision.reason,
            timestamp: Date.now()
          });
          this.config.onApprovalResolved?.(entry.approval, decision);
          resolve(decision);
        }
      }, timeoutMs);

      // Manejo de cancelación cooperativa si se suministra AbortSignal
      if (params.abortSignal) {
        if (params.abortSignal.aborted) {
          clearTimeout(timer);
          pendingApproval.status = "aborted";
          this.emitAudit({
            approvalId,
            phase: "aborted",
            toolName: params.tool.name,
            sessionId: actionIdentity.sessionId,
            subEgoId: actionIdentity.subEgoId,
            callId: actionIdentity.callId,
            inputDigest: actionIdentity.inputDigest,
            approved: false,
            reason: "Operación abortada por señal de cancelación (AbortSignal).",
            timestamp: Date.now()
          });
          resolve({
            approved: false,
            reason: "Operación abortada por señal de cancelación (AbortSignal).",
            timestamp: Date.now()
          });
          return;
        }

        params.abortSignal.addEventListener(
          "abort",
          () => {
            const entry = this.pendingMap.get(approvalId);
            if (entry) {
              clearTimeout(entry.timer);
              this.pendingMap.delete(approvalId);
              entry.approval.status = "aborted";
              const decision: ApprovalDecision = {
                approved: false,
                reason: "Operación abortada por señal de cancelación (AbortSignal).",
                timestamp: Date.now()
              };
              this.emitAudit({
                approvalId,
                phase: "aborted",
                toolName: params.tool.name,
                sessionId: actionIdentity.sessionId,
                subEgoId: actionIdentity.subEgoId,
                callId: actionIdentity.callId,
                inputDigest: actionIdentity.inputDigest,
                approved: false,
                reason: decision.reason,
                timestamp: Date.now()
              });
              this.config.onApprovalResolved?.(entry.approval, decision);
              resolve(decision);
            }
          },
          { once: true }
        );
      }

      this.pendingMap.set(approvalId, {
        approval: pendingApproval,
        resolve,
        reject,
        timer
      });

      this.emitAudit({
        approvalId,
        phase: "requested",
        toolName: params.tool.name,
        sessionId: actionIdentity.sessionId,
        subEgoId: actionIdentity.subEgoId,
        callId: actionIdentity.callId,
        inputDigest: actionIdentity.inputDigest,
        timestamp: Date.now()
      });
      this.config.onApprovalRequested?.(pendingApproval);
    });
  }

  /**
   * Calcula el digest SHA-256 canónico de los argumentos de una herramienta.
   */
  public static computeArgsDigest(_toolName: string, args: unknown): string {
    const canonical = canonicalJsonStringify(args);
    return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
  }

  /**
   * Resuelve una solicitud pendiente de aprobación humana.
   * Valida la identidad causal esperada si se especifica (COUC-03).
   */
  public resolveApproval(
    approvalId: string,
    decision: ApprovalDecision,
    optionsOrExpectedIdentity?: { expectedDigest?: string; expectedIdentity?: ApprovalIdentity } | ApprovalIdentity,
    maybeExpectedIdentity?: ApprovalIdentity
  ): boolean {
    const entry = this.pendingMap.get(approvalId);
    if (!entry) {
      return false;
    }

    if (entry.approval.status !== "pending") {
      return false;
    }

    let options: { expectedDigest?: string; expectedIdentity?: ApprovalIdentity } | undefined;
    let expectedIdentity: ApprovalIdentity | undefined;

    if (maybeExpectedIdentity) {
      expectedIdentity = maybeExpectedIdentity;
      if (optionsOrExpectedIdentity && typeof optionsOrExpectedIdentity === "object" && "expectedDigest" in optionsOrExpectedIdentity) {
        options = optionsOrExpectedIdentity as { expectedDigest?: string };
      }
    } else if (optionsOrExpectedIdentity) {
      if (typeof optionsOrExpectedIdentity === "object") {
        if ("expectedDigest" in optionsOrExpectedIdentity || "expectedIdentity" in optionsOrExpectedIdentity) {
          options = optionsOrExpectedIdentity as { expectedDigest?: string; expectedIdentity?: ApprovalIdentity };
          expectedIdentity = options.expectedIdentity;
        } else {
          expectedIdentity = optionsOrExpectedIdentity as ApprovalIdentity;
        }
      }
    }

    const request = entry.approval;

    // Validación de identidad causal estricta (COUC-03)
    if (options?.expectedDigest) {
      if (request.action.inputDigest !== options.expectedDigest) {
        throw new Error(
          `[ApprovalEngine] Violación de identidad causal: el digest esperado (${options.expectedDigest}) ` +
          `no coincide con la acción retenida (${request.action.inputDigest}).`
        );
      }
    }

    if (expectedIdentity) {
      // A2-21: la normalización de alias (`toolId`/`toolName`, `inputDigest`/
      // `argsDigest`, `runId`/`id`) se hace sobre una forma ESTRUCTURADA y
      // tipada, sin `as any` y sin mutar el objeto de entrada.
      const requestArgsDigest = readOptionalString(
        request as unknown as Record<string, unknown>,
        "argsDigest"
      );
      const argsDigest =
        requestArgsDigest ??
        ApprovalEngine.computeArgsDigest(request.toolName, request.arguments);

      const actualLike = normalizeApprovalIdentity({
        id: request.approvalId,
        toolName: request.toolName,
        argsDigest,
        runId: request.action?.sessionId ?? request.approvalId,
        taskId: request.action?.callId ?? request.approvalId,
        subEgoId: request.action?.subEgoId ?? "ego.nucleus",
        toolId: request.toolName,
        inputDigest: argsDigest,
      });

      const expectedLike = expectedIdentity as unknown as ApprovalIdentityLike;
      const expectedBase = normalizeApprovalIdentity(expectedLike);

      // Compatibilidad de alias (heredada, sin `as any`): los campos que el
      // esperado NO fija se toman del real; y si el esperado tampoco fijó
      // `runId`, el run efectivo es el id de la propia aprobación.
      const actual: ApprovalIdentity = {
        ...actualLike,
        runId: expectedLike.runId !== undefined ? actualLike.runId : request.approvalId,
      };
      const effectiveExpected: ApprovalIdentity = {
        runId: expectedLike.runId !== undefined ? expectedBase.runId : request.approvalId,
        taskId: expectedLike.taskId !== undefined ? expectedBase.taskId : actualLike.taskId,
        subEgoId:
          expectedLike.subEgoId !== undefined ? expectedBase.subEgoId : actualLike.subEgoId,
        toolId: expectedBase.toolId,
        inputDigest: expectedBase.inputDigest,
      };

      assertSameApproval(effectiveExpected, actual);
    }

    clearTimeout(entry.timer);
    this.pendingMap.delete(approvalId);

    entry.approval.status = decision.approved ? "approved" : "rejected";

    const resolvedDecision: ApprovalDecision = {
      ...decision,
      timestamp: Date.now()
    };

    this.emitAudit({
      approvalId,
      phase: "resolved",
      toolName: entry.approval.toolName,
      sessionId: entry.approval.action.sessionId,
      subEgoId: entry.approval.action.subEgoId,
      callId: entry.approval.action.callId,
      inputDigest: entry.approval.action.inputDigest,
      approved: resolvedDecision.approved,
      reason: resolvedDecision.reason,
      timestamp: Date.now()
    });
    this.config.onApprovalResolved?.(entry.approval, resolvedDecision);
    entry.resolve(resolvedDecision);
    return true;
  }

  /**
   * Rechaza expresamente una solicitud de aprobación pendiente.
   */
  public rejectApproval(approvalId: string, reason: string = "Rechazado por el usuario"): boolean {
    return this.resolveApproval(approvalId, {
      approved: false,
      reason
    });
  }

  /**
   * Consulta una solicitud de aprobación por ID.
   */
  public getPendingApproval(approvalId: string): PendingApproval | undefined {
    return this.pendingMap.get(approvalId)?.approval;
  }

  /**
   * Retorna todas las solicitudes de aprobación actualmente en espera de respuesta humana.
   */
  public listPendingApprovals(): PendingApproval[] {
    return Array.from(this.pendingMap.values()).map((e) => e.approval);
  }

  /**
   * Cancela y limpia todas las solicitudes pendientes (ej. en shutdown o reset de sesión).
   */
  public clearAll(reason: string = "Sesión reiniciada o motor detenido"): void {
    for (const [id, entry] of this.pendingMap.entries()) {
      clearTimeout(entry.timer);
      entry.approval.status = "aborted";
      this.emitAudit({
        approvalId: id,
        phase: "aborted",
        toolName: entry.approval.toolName,
        sessionId: entry.approval.action.sessionId,
        subEgoId: entry.approval.action.subEgoId,
        callId: entry.approval.action.callId,
        inputDigest: entry.approval.action.inputDigest,
        approved: false,
        reason,
        timestamp: Date.now()
      });
      entry.resolve({
        approved: false,
        reason,
        timestamp: Date.now()
      });
      this.pendingMap.delete(id);
    }
  }
}
