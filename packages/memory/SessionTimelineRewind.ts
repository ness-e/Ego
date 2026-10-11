/**
 * SessionTimelineRewind.ts — Semántica de timeline inmutable y rebobinado de sesiones sobre VantaDB.
 * Extraído y adaptado de Hermes Agent (HERM-14) para Ego SOC.
 *
 * Principio: Inmutabilidad estricta. Nunca se borran registros físicamente de VantaDB Fjall LSM.
 * Al rebobinar a un turno anterior, se bifurca en un branch o se marca el estado activo sin pérdida.
 */

export interface TimelineTurn {
  turnId: string;
  sessionId: string;
  sequence: number;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  branchId: string;
  superseded?: boolean;
}

export interface SessionBranch {
  branchId: string;
  sessionId: string;
  parentBranchId?: string;
  forkSequence: number;
  name: string;
  createdAt: number;
}

export interface SessionTimelineState {
  sessionId: string;
  activeBranchId: string;
  branches: Record<string, SessionBranch>;
  turns: TimelineTurn[];
}

export class SessionTimelineRewind {
  private state: SessionTimelineState;

  constructor(sessionId: string) {
    this.state = {
      sessionId,
      activeBranchId: "main",
      branches: {
        main: {
          branchId: "main",
          sessionId,
          forkSequence: 0,
          name: "Principal",
          createdAt: Date.now(),
        },
      },
      turns: [],
    };
  }

  /**
   * Agrega un nuevo turno al timeline inmutable de la sesión.
   */
  appendTurn(
    role: "user" | "assistant" | "system",
    content: string,
    turnId?: string
  ): TimelineTurn {
    const sequence = this.state.turns.length + 1;
    const turn: TimelineTurn = {
      turnId: turnId || `turn_${this.state.sessionId}_${sequence}`,
      sessionId: this.state.sessionId,
      sequence,
      role,
      content,
      timestamp: Date.now(),
      branchId: this.state.activeBranchId,
      superseded: false,
    };

    this.state.turns.push(turn);
    return turn;
  }

  /**
   * Rebobina la sesión hasta un turno objetivo.
   * Si `forkBranch` es true, crea una nueva rama a partir de ese punto sin mutar la historia previa.
   * Si `forkBranch` es false, marca los turnos posteriores en la rama actual como superseded.
   */
  rewindToTurn(
    targetTurnId: string,
    options: { forkBranch?: boolean; branchName?: string } = {}
  ): { targetTurn: TimelineTurn; activeTurns: TimelineTurn[]; newBranchId?: string } {
    const targetIndex = this.state.turns.findIndex((t) => t.turnId === targetTurnId);
    if (targetIndex === -1) {
      throw new Error(`Turno no encontrado en el timeline: ${targetTurnId}`);
    }

    const targetTurn = this.state.turns[targetIndex];

    if (options.forkBranch) {
      const newBranchId = `branch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      this.state.branches[newBranchId] = {
        branchId: newBranchId,
        sessionId: this.state.sessionId,
        parentBranchId: targetTurn.branchId,
        forkSequence: targetTurn.sequence,
        name: options.branchName || `Bifurcación desde #${targetTurn.sequence}`,
        createdAt: Date.now(),
      };
      this.state.activeBranchId = newBranchId;

      return {
        targetTurn,
        activeTurns: this.getActiveTimeline(),
        newBranchId,
      };
    }

    // Modo in-branch: marca los turnos posteriores como superseded sin borrarlos físicamente
    for (let i = targetIndex + 1; i < this.state.turns.length; i++) {
      if (this.state.turns[i].branchId === targetTurn.branchId) {
        this.state.turns[i].superseded = true;
      }
    }

    return {
      targetTurn,
      activeTurns: this.getActiveTimeline(),
    };
  }

  /**
   * Retorna la proyección visible de turnos activos para la rama actual.
   */
  getActiveTimeline(): TimelineTurn[] {
    const activeBranch = this.state.branches[this.state.activeBranchId];
    if (!activeBranch) {
      return [];
    }

    // Si es rama secundaria, hereda los turnos de la rama padre hasta forkSequence
    if (activeBranch.parentBranchId) {
      const parentTurns = this.state.turns.filter(
        (t) =>
          t.branchId === activeBranch.parentBranchId &&
          t.sequence <= activeBranch.forkSequence &&
          !t.superseded
      );
      const childTurns = this.state.turns.filter(
        (t) => t.branchId === activeBranch.branchId && !t.superseded
      );
      return [...parentTurns, ...childTurns];
    }

    return this.state.turns.filter(
      (t) => t.branchId === this.state.activeBranchId && !t.superseded
    );
  }

  /**
   * Cambia de rama activa.
   */
  switchBranch(branchId: string): void {
    if (!this.state.branches[branchId]) {
      throw new Error(`Rama inexistente: ${branchId}`);
    }
    this.state.activeBranchId = branchId;
  }

  /**
   * Retorna el estado completo del timeline para serialización en VantaDB.
   */
  getState(): SessionTimelineState {
    return { ...this.state };
  }
}
