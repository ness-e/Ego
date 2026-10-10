import { ApprovalEngine } from './ApprovalEngine.js';
import { PendingApproval, ApprovalDecision } from './types.js';

export interface WidgetPresentationRequest {
  approvalId: string;
  toolName: string;
  riskLevel: string;
  arguments: Record<string, unknown>;
  createdAt: number;
}

export interface WidgetHitlBridgeOptions {
  ackTimeoutMs?: number; // Por defecto 800 ms (patrón Coucou COUC-01)
  onPresent?: (request: WidgetPresentationRequest) => void;
  onFallbackToMain?: (approvalId: string, reason: string) => void;
}

export class WidgetHitlBridge {
  private ackTimeoutMs: number;
  private pendingAcks = new Map<string, NodeJS.Timeout>();
  private activePresentations = new Set<string>();
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

    const presentation: WidgetPresentationRequest = {
      approvalId,
      toolName: approval.toolName,
      riskLevel: approval.riskLevel,
      arguments: approval.arguments,
      createdAt: Date.now(),
    };

    // Emitir solicitud al widget
    if (this.onPresent) {
      try {
        this.onPresent(presentation);
      } catch {
        // Defensive
      }
    }

    // Configurar temporizador de ACK <= 800 ms
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingAcks.delete(approvalId);
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

      this.pendingAcks.set(approvalId, timer);
    });
  }

  public acknowledgePresentation(approvalId: string): boolean {
    const timer = this.pendingAcks.get(approvalId);
    if (!timer) {
      return false;
    }

    clearTimeout(timer);
    this.pendingAcks.delete(approvalId);
    this.activePresentations.add(approvalId);
    return true;
  }

  public async resolve(
    approvalId: string,
    decision: ApprovalDecision
  ): Promise<boolean> {
    this.activePresentations.delete(approvalId);
    const timer = this.pendingAcks.get(approvalId);
    if (timer) {
      clearTimeout(timer);
      this.pendingAcks.delete(approvalId);
    }

    return await this.approvalEngine.resolveApproval(approvalId, decision);
  }

  public isPresentedInWidget(approvalId: string): boolean {
    return this.activePresentations.has(approvalId);
  }

  public clearAll(): void {
    for (const timer of this.pendingAcks.values()) {
      clearTimeout(timer);
    }
    this.pendingAcks.clear();
    this.activePresentations.clear();
  }
}
