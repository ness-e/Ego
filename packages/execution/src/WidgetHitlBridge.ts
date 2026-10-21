import { ApprovalEngine, computeActionIdentity } from './ApprovalEngine.js';
import { PendingApproval, ApprovalDecision, ActionIdentity } from './types.js';

export interface WidgetPresentationRequest {
  approvalId: string;
  toolName: string;
  riskLevel: string;
  arguments: Record<string, unknown>;
  createdAt: number;
  /**
   * R10b: identidad causal + digest SHA-256 recomputado server-side con
   * `ApprovalEngine.computeActionIdentity`. La UI lo muestra y lo exige
   * antes de aprobar (ver `ApprovalCard`: bloquea sin `inputDigest`).
   */
  action: ActionIdentity;
  inputDigest: string;
}

export interface WidgetHitlBridgeOptions {
  ackTimeoutMs?: number; // Por defecto 800 ms (patrón Coucou COUC-01)
  onPresent?: (request: WidgetPresentationRequest) => void;
  onFallbackToMain?: (approvalId: string, reason: string) => void;
}

/** Opciones de resolución con identidad exacta (COUC-03). */
export interface WidgetResolveOptions {
  /**
   * Digest SHA-256 esperado de la acción. Si se provee y no coincide con
   * el pendiente del engine (ni con el presentado), la resolución se
   * rechaza sin reenviar — nunca se resuelve solo por toolName.
   */
  expectedDigest?: string;
}

interface PendingAck {
  timer: NodeJS.Timeout;
  resolve: (presented: boolean) => void;
}

/**
 * WidgetHitlBridge - HITL flotante<->main (WIDG-04, COUC-03/04).
 *
 * **Implementación propia de Ego** (patrón asimilado de Coucou · COUC-01/03):
 * el contrato mecánico que se implementa es el de
 * `repos-referencia/coucou/windows/src/island/hooks.ts:273-328`, pero **el
 * código es propio** (no hay `State`/`Bridge`/`island`: el puente es un
 * contrato de eventos entre el widget flotante y el main). Sin atribución de
 * código derivado.
 *
 * El contrato que se implementa:
 * - `presentApproval()` emite al widget y espera ACK <= 800 ms.
 * - Si ACK: resuelve `true`, mantiene pending + digest presentado.
 * - Si NO ACK: fallback a main (`onFallbackToMain`) y resuelve `false`
 *   SIN colgar al executor (el engine retiene su propio timeout).
 * - Una sola tarjeta a la vez: segundo approval distinto con uno pendiente
 *   o activo → decline inmediato (duplicate).
 * - `resolve()` solo con identidad exacta; pendiente ausente (timeout) →
 *   decline seguro sin reenviar al engine.
 * - `dismissExternal()` para cierre externo → `"Handled in X"`.
 */
export class WidgetHitlBridge {
  private ackTimeoutMs: number;
  private pendingAcks = new Map<string, PendingAck>();
  private activePresentations = new Set<string>();
  private presentedDigests = new Map<string, string>();
  private onPresent?: (request: WidgetPresentationRequest) => void;
  private onFallbackToMain?: (approvalId: string, reason: string) => void;

  constructor(
    private approvalEngine: ApprovalEngine,
    options: WidgetHitlBridgeOptions = {}
  ) {
    this.ackTimeoutMs = options.ackTimeoutMs ?? 800;
    this.onPresent = options.onPresent;
    this.onFallbackToMain = options.onFallbackToMain;
  }

  public async presentApproval(approval: PendingApproval): Promise<boolean> {
    const { approvalId } = approval;

    // COUC-04 / hooks.ts:286-289: una tarjeta, un request. Cualquier
    // present con otro pendiente o activo nunca reemplaza silenciosamente
    // al primero → decline inmediato (duplicate).
    if (this.pendingAcks.size > 0 || this.activePresentations.size > 0) {
      const holder =
        [...this.pendingAcks.keys(), ...this.activePresentations][0];
      if (this.onFallbackToMain) {
        try {
          this.onFallbackToMain(
            approvalId,
            `duplicate approval while ${holder} pending`
          );
        } catch {
          // Defensive
        }
      }
      return false;
    }

    // R10b: adjuntar la ActionIdentity recomputada con
    // `ApprovalEngine.computeActionIdentity` (no se confía en el objeto
    // recibido: el digest se deriva de toolName + argumentos canónicos).
    const identity = computeActionIdentity({
      sessionId: approval.action.sessionId,
      subEgoId: approval.action.subEgoId,
      toolName: approval.toolName,
      callId: approval.action.callId,
      arguments: approval.arguments,
    });

    const presentation: WidgetPresentationRequest = {
      approvalId,
      toolName: approval.toolName,
      riskLevel: approval.riskLevel,
      arguments: approval.arguments,
      createdAt: Date.now(),
      action: identity,
      inputDigest: identity.inputDigest,
    };

    // Emitir solicitud al widget
    if (this.onPresent) {
      try {
        this.onPresent(presentation);
      } catch {
        // Defensive
      }
    }
    this.presentedDigests.set(approvalId, identity.inputDigest);

    // Esperar ACK <= 800 ms; ambas ramas hacen settle (nunca cuelga).
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingAcks.delete(approvalId);
        this.presentedDigests.delete(approvalId);
        // Si no hubo ACK en 800ms, devolver control a la UI principal
        if (this.onFallbackToMain) {
          try {
            this.onFallbackToMain(approvalId, 'ACK timeout exceeded (800ms)');
          } catch {
            // Defensive
          }
        }
        resolve(false);
      }, this.ackTimeoutMs);

      this.pendingAcks.set(approvalId, { timer, resolve });
    });
  }

  public acknowledgePresentation(approvalId: string): boolean {
    const entry = this.pendingAcks.get(approvalId);
    if (!entry) {
      return false;
    }

    clearTimeout(entry.timer);
    this.pendingAcks.delete(approvalId);
    this.activePresentations.add(approvalId);
    entry.resolve(true);
    return true;
  }

  public async resolve(
    approvalId: string,
    decision: ApprovalDecision,
    options?: WidgetResolveOptions
  ): Promise<boolean> {
    const engine = this.approvalEngine as ApprovalEngine & {
      getPendingApproval?: (id: string) => PendingApproval | undefined;
    };
    const pending =
      typeof engine.getPendingApproval === 'function'
        ? engine.getPendingApproval(approvalId)
        : undefined;

    // Timeout o ya resuelto en el engine → decline seguro sin reenviar.
    if (typeof engine.getPendingApproval === 'function' && !pending) {
      this.activePresentations.delete(approvalId);
      this.presentedDigests.delete(approvalId);
      return false;
    }

    // COUC-03: identidad exacta o nada. El digest esperado debe coincidir
    // con el pendiente del engine (y con el presentado si lo hubo).
    if (options?.expectedDigest) {
      const engineDigest = pending?.action.inputDigest;
      const presentedDigest = this.presentedDigests.get(approvalId);
      const matchesEngine =
        !engineDigest || options.expectedDigest === engineDigest;
      const matchesPresented =
        !presentedDigest || options.expectedDigest === presentedDigest;
      if (!matchesEngine || !matchesPresented) {
        return false;
      }
    }

    this.activePresentations.delete(approvalId);
    this.presentedDigests.delete(approvalId);
    const ack = this.pendingAcks.get(approvalId);
    if (ack) {
      clearTimeout(ack.timer);
      this.pendingAcks.delete(approvalId);
    }

    return await this.approvalEngine.resolveApproval(approvalId, decision);
  }

  /**
   * Cierre externo (ventana flotante cerrada, resuelto en otra UI).
   * Limpia la presentación SIN tocar el engine (el pendiente sigue
   * resoluble por main) y reporta dónde se atendió.
   */
  public dismissExternal(approvalId: string, where: string): string {
    const ack = this.pendingAcks.get(approvalId);
    if (ack) {
      clearTimeout(ack.timer);
      this.pendingAcks.delete(approvalId);
      ack.resolve(false);
    }
    this.activePresentations.delete(approvalId);
    this.presentedDigests.delete(approvalId);
    return `Handled in ${where}`;
  }

  public isPresentedInWidget(approvalId: string): boolean {
    return this.activePresentations.has(approvalId);
  }

  public clearAll(): void {
    for (const entry of this.pendingAcks.values()) {
      clearTimeout(entry.timer);
      entry.resolve(false);
    }
    this.pendingAcks.clear();
    this.activePresentations.clear();
    this.presentedDigests.clear();
  }
}
