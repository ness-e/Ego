export type AttentionState =
  | 'hidden'
  | 'compact'
  | 'expanded'
  | 'alert'
  | 'hitl_approval';

export interface AttentionRequest {
  id: string;
  priority: number; // 0 = baja, 50 = normal, 80 = alta, 100 = crítica/HITL
  state: AttentionState;
  title: string;
  details?: string;
  timeoutMs?: number;
  hitlActionId?: string;
  subEgoId?: string;
  pinned?: boolean;
  createdAt: number;
}

export interface AttentionTransitionEvent {
  previousState: AttentionState;
  currentState: AttentionState;
  activeRequest: AttentionRequest | null;
  timestamp: number;
}

export class AttentionStateMachine {
  private currentState: AttentionState = 'hidden';
  private requestQueue: AttentionRequest[] = [];
  private activeRequest: AttentionRequest | null = null;
  private collapseTimerMs = 0;
  private defaultCollapseMs: number;
  private onTransition?: (event: AttentionTransitionEvent) => void;

  constructor(options: { defaultCollapseMs?: number; onTransition?: (ev: AttentionTransitionEvent) => void } = {}) {
    this.defaultCollapseMs = options.defaultCollapseMs ?? 3000;
    this.onTransition = options.onTransition;
  }

  public getState(): AttentionState {
    return this.currentState;
  }

  public getActiveRequest(): AttentionRequest | null {
    return this.activeRequest;
  }

  public getQueue(): AttentionRequest[] {
    return [...this.requestQueue];
  }

  public requestAttention(
    req: Omit<AttentionRequest, 'createdAt'> & { createdAt?: number }
  ): void {
    const fullReq: AttentionRequest = {
      ...req,
      createdAt: req.createdAt ?? Date.now(),
    };

    // Reemplazo o inserción en cola ordenada por prioridad desc, luego createdAt asc
    this.requestQueue = this.requestQueue.filter((r) => r.id !== fullReq.id);
    this.requestQueue.push(fullReq);
    this.sortQueue();
    this.evaluateNextState();
  }

  public releaseAttention(id: string): void {
    if (this.activeRequest?.id === id) {
      this.activeRequest = null;
    }
    this.requestQueue = this.requestQueue.filter((r) => r.id !== id);
    this.evaluateNextState();
  }

  public clearAll(): void {
    this.activeRequest = null;
    this.requestQueue = [];
    this.transitionTo('hidden');
  }

  public tick(deltaTimeMs: number): void {
    if (this.activeRequest?.pinned) {
      return; // Elementos anclados no colapsan por tiempo
    }

    if (this.collapseTimerMs > 0) {
      this.collapseTimerMs -= deltaTimeMs;
      if (this.collapseTimerMs <= 0) {
        if (this.activeRequest) {
          this.releaseAttention(this.activeRequest.id);
        } else {
          this.transitionTo('hidden');
        }
      }
    }
  }

  private sortQueue(): void {
    this.requestQueue.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.createdAt - b.createdAt;
    });
  }

  private evaluateNextState(): void {
    if (this.requestQueue.length === 0) {
      this.activeRequest = null;
      this.collapseTimerMs = 0;
      this.transitionTo('hidden');
      return;
    }

    const highest = this.requestQueue[0];
    this.activeRequest = highest;

    // Configurar temporizador de colapso si no está fijado
    if (!highest.pinned) {
      this.collapseTimerMs = highest.timeoutMs ?? this.defaultCollapseMs;
    } else {
      this.collapseTimerMs = 0;
    }

    this.transitionTo(highest.state);
  }

  private transitionTo(newState: AttentionState): void {
    if (this.currentState === newState) return;

    const previousState = this.currentState;
    this.currentState = newState;

    if (this.onTransition) {
      try {
        this.onTransition({
          previousState,
          currentState: newState,
          activeRequest: this.activeRequest ? { ...this.activeRequest } : null,
          timestamp: Date.now(),
        });
      } catch {
        // Defensive
      }
    }
  }
}
