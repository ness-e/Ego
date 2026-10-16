/**
 * SessionTimelineRewind.ts — Semántica de timeline inmutable y rebobinado de sesiones sobre VantaDB.
 * Extraído y adaptado de Hermes Agent (HERM-14) para Ego SOC.
 *
 * Principio: Inmutabilidad estricta. Nunca se borran registros físicamente de VantaDB Fjall LSM.
 * Al rebobinar a un turno anterior, se bifurca en un branch o se marca el estado activo sin pérdida.
 *
 * Persistencia (H08 — F2T4): el timeline es efímero en memoria por defecto;
 * con adapter, `save()` persiste el estado completo en `sessions/timelines`
 * (clave = sessionId) y `load()` / `open()` lo restauran. La decisión es
 * explícita: sin adapter no hay persistencia (el constructor no falla).
 */

import type { EgoMemoryAdapter } from "./EgoMemoryAdapter.js";

export const TIMELINE_NAMESPACE = "sessions/timelines";

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
  private adapter?: EgoMemoryAdapter;

  constructor(sessionId: string, adapter?: EgoMemoryAdapter) {
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
    this.adapter = adapter;
  }

  /**
   * Fábrica de arranque: construye el timeline y restaura desde VantaDB si existe.
   */
  public static async open(
    sessionId: string,
    adapter: EgoMemoryAdapter
  ): Promise<SessionTimelineRewind> {
    const timeline = new SessionTimelineRewind(sessionId, adapter);
    await timeline.load();
    return timeline;
  }

  /**
   * Persiste el estado completo del timeline en VantaDB (H08).
   * Requiere adapter; sin adapter lanza (persistencia explícita, no silenciosa).
   */
  public async save(): Promise<void> {
    if (!this.adapter) {
      throw new Error(
        "[SessionTimelineRewind] save() requiere un EgoMemoryAdapter (timeline efímero en memoria por defecto)."
      );
    }
    await this.adapter.put({
      namespace: TIMELINE_NAMESPACE,
      key: this.state.sessionId,
      payload: this.state,
      metadata: {
        session_id: this.state.sessionId,
        active_branch: this.state.activeBranchId,
        turns_count: this.state.turns.length,
        ts: Date.now(),
      },
    });
  }

  /**
   * Restaura el estado desde VantaDB. Retorna true si existía, false si no hay
   * nada persistido (arranque limpio). Requiere adapter.
   */
  public async load(): Promise<boolean> {
    if (!this.adapter) {
      throw new Error(
        "[SessionTimelineRewind] load() requiere un EgoMemoryAdapter (timeline efímero en memoria por defecto)."
      );
    }
    let raw: unknown;
    try {
      const rec = await this.adapter.get(TIMELINE_NAMESPACE, this.state.sessionId);
      if (!rec) return false;
      raw = rec.payload;
    } catch {
      return false;
    }
    const parsed = SessionTimelineRewind.parseState(raw, this.state.sessionId);
    if (!parsed) return false;
    this.state = parsed;
    return true;
  }

  private static parseState(payload: unknown, sessionId: string): SessionTimelineState | null {
    const root: unknown =
      typeof payload === "string" ? SessionTimelineRewind.tryJson(payload) : payload;
    if (typeof root !== "object" || root === null) return null;
    const obj = root as Record<string, unknown>;
    if (obj["sessionId"] !== sessionId) return null;
    if (typeof obj["activeBranchId"] !== "string") return null;
    if (typeof obj["branches"] !== "object" || obj["branches"] === null) return null;
    if (!Array.isArray(obj["turns"])) return null;

    const branches: Record<string, SessionBranch> = {};
    for (const [k, v] of Object.entries(obj["branches"] as Record<string, unknown>)) {
      if (typeof v !== "object" || v === null) return null;
      const b = v as Record<string, unknown>;
      if (
        typeof b["branchId"] !== "string" ||
        typeof b["sessionId"] !== "string" ||
        typeof b["forkSequence"] !== "number" ||
        typeof b["name"] !== "string" ||
        typeof b["createdAt"] !== "number"
      ) {
        return null;
      }
      branches[k] = {
        branchId: b["branchId"] as string,
        sessionId: b["sessionId"] as string,
        parentBranchId: typeof b["parentBranchId"] === "string" ? (b["parentBranchId"] as string) : undefined,
        forkSequence: b["forkSequence"] as number,
        name: b["name"] as string,
        createdAt: b["createdAt"] as number,
      };
    }
    if (!branches[obj["activeBranchId"] as string]) return null;

    const turns: TimelineTurn[] = [];
    for (const t of obj["turns"] as Array<unknown>) {
      if (typeof t !== "object" || t === null) return null;
      const r = t as Record<string, unknown>;
      if (
        typeof r["turnId"] !== "string" ||
        typeof r["sessionId"] !== "string" ||
        typeof r["sequence"] !== "number" ||
        (r["role"] !== "user" && r["role"] !== "assistant" && r["role"] !== "system") ||
        typeof r["content"] !== "string" ||
        typeof r["timestamp"] !== "number" ||
        typeof r["branchId"] !== "string"
      ) {
        return null;
      }
      turns.push({
        turnId: r["turnId"] as string,
        sessionId: r["sessionId"] as string,
        sequence: r["sequence"] as number,
        role: r["role"] as "user" | "assistant" | "system",
        content: r["content"] as string,
        timestamp: r["timestamp"] as number,
        branchId: r["branchId"] as string,
        superseded: r["superseded"] === true,
      });
    }

    return {
      sessionId,
      activeBranchId: obj["activeBranchId"] as string,
      branches,
      turns,
    };
  }

  private static tryJson(raw: string): unknown {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
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
    if (!targetTurn) {
      throw new Error(`Turno no encontrado en el timeline: ${targetTurnId}`);
    }

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
      const turn = this.state.turns[i];
      if (turn && turn.branchId === targetTurn.branchId) {
        turn.superseded = true;
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
