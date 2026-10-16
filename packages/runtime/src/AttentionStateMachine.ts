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

// Paridad isla Coucou/avatar (Task1 plan 2026-10-15):
// home(expanded)->compact 15s, compact->hidden 60s,
// greetAuto 600ms (coucou SPEC peek->hidden 600ms), finishedPin 5.2s.
// Sources: docs/extractions/coucou.md §6-7; repos-referencia/coucou/docs/SPEC.md:37;
// repos-referencia/coucou/design/prototype/notch-buddy.html:687 (autoClose 60000).
export const ISLA_TIMING = {
  homeToCompact: 15_000,
  compactToHidden: 60_000,
  greetAuto: 600,
  greetHover: 10_000,
  finishedPin: 5_200,
} as const;

export interface AttentionStateMachineOptions {
  defaultCollapseMs?: number;
  homeMs?: number;
  compactMs?: number;
  greetAutoMs?: number;
  finishedPinMs?: number;
  onTransition?: (ev: AttentionTransitionEvent) => void;
}

export class AttentionStateMachine {
  private currentState: AttentionState = 'hidden';
  private requestQueue: AttentionRequest[] = [];
  private activeRequest: AttentionRequest | null = null;
  private collapseTimerMs = 0;
  private defaultCollapseMs: number;
  private homeMs: number;
  private compactMs: number;
  private pinned = false;
  private readonly greetAutoMs: number;
  private readonly finishedPinMs: number;
  private onTransition?: (event: AttentionTransitionEvent) => void;

  constructor(options: AttentionStateMachineOptions = {}) {
    this.defaultCollapseMs = options.defaultCollapseMs ?? 3000;
    this.homeMs = options.homeMs ?? ISLA_TIMING.homeToCompact;
    this.compactMs = options.compactMs ?? ISLA_TIMING.compactToHidden;
    this.greetAutoMs = options.greetAutoMs ?? ISLA_TIMING.greetAuto;
    this.finishedPinMs = options.finishedPinMs ?? ISLA_TIMING.finishedPin;
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

  public setPinned(v: boolean): void {
    this.pinned = v;
    if (!v) this.evaluateNextState();
  }

  public isPinned(): boolean {
    return this.pinned;
  }

  public getGreetAutoMs(): number {
    return this.greetAutoMs;
  }

  public getFinishedPinMs(): number {
    return this.finishedPinMs;
  }

  public tick(deltaTimeMs: number): void {
    if (this.pinned || this.activeRequest?.pinned) {
      return; // Elementos anclados no colapsan por tiempo
    }

    if (this.collapseTimerMs > 0) {
      this.collapseTimerMs -= deltaTimeMs;
      if (this.collapseTimerMs <= 0) {
        if (this.currentState === 'expanded') {
          // Paridad isla: expanded->compact tras homeMs, conserva el request
          this.collapseTimerMs = this.compactMs;
          this.transitionTo('compact');
        } else if (this.activeRequest) {
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
    if (!highest) {
      this.activeRequest = null;
      this.collapseTimerMs = 0;
      this.transitionTo('hidden');
      return;
    }
    this.activeRequest = highest;

    // Configurar temporizador de colapso si no está fijado.
    // timeoutMs explícito gana (compat); si no, paridad isla por estado.
    if (!highest.pinned) {
      if (highest.timeoutMs !== undefined) {
        this.collapseTimerMs = highest.timeoutMs;
      } else if (highest.state === 'expanded') {
        this.collapseTimerMs = this.homeMs;
      } else if (highest.state === 'compact') {
        this.collapseTimerMs = this.compactMs;
      } else {
        this.collapseTimerMs = this.defaultCollapseMs;
      }
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
