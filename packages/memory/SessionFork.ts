import type { EgoMemoryAdapter } from "./EgoMemoryAdapter.js";

/**
 * Handoff formal de fork de sesión (STAB-12, Spec D6/D7).
 * Lo produce `forkSession` y lo valida `SessionHandoffSchema` (IPC, Zod
 * fail-closed) antes de salir del main. `checkpointId` referencia un
 * micro-checkpoint real (`system/checkpoints` vía `createMicroCheckpoint`).
 */
export interface SessionHandoffRecord {
  from: string;
  to: string;
  summary: string;
  findings: string[];
  files: string[];
  issues: string[];
  checkpointId: string;
  copiedTurns: number;
  createdAtMs: number;
}

export interface ForkSessionInput {
  fromSessionId: string;
  toSessionId: string;
  summary: string;
  findings?: string[];
  files?: string[];
  issues?: string[];
}

export interface ForkSessionDeps {
  adapter: EgoMemoryAdapter;
  createCheckpoint: (taskId: string, snapshot: unknown) => Promise<string>;
  nowMs?: () => number;
}

const TURNS_NAMESPACE = "session/turns";
const MAX_TURNS_TO_COPY = 1000;
const MAX_ID_LEN = 128;

/**
 * Bifurca una sesión copiando sus turnos (`session/turns`) a un nuevo
 * `toSessionId` y sellando un micro-checkpoint del fork.
 *
 * Fail-closed: ids vacíos/distintos-obligatorios inválidos lanzan sin tocar
 * memoria; `list()` vacío (F2T6: fallo del motor → `[]` con log) produce un
 * handoff válido con `copiedTurns: 0` + checkpoint igualmente sellado
 * (trazabilidad antes que silencio). Nunca borra el origen.
 */
export async function forkSession(
  input: ForkSessionInput,
  deps: ForkSessionDeps
): Promise<SessionHandoffRecord> {
  const from = input.fromSessionId?.trim() ?? "";
  const to = input.toSessionId?.trim() ?? "";
  const summary = input.summary?.trim() ?? "";
  if (from.length === 0 || from.length > MAX_ID_LEN) {
    throw new Error("[SessionFork] fromSessionId inválido (fail-closed).");
  }
  if (to.length === 0 || to.length > MAX_ID_LEN) {
    throw new Error("[SessionFork] toSessionId inválido (fail-closed).");
  }
  if (from === to) {
    throw new Error("[SessionFork] from y to deben diferir (fail-closed).");
  }
  if (summary.length === 0) {
    throw new Error("[SessionFork] summary vacío (fail-closed).");
  }
  const nowMs = deps.nowMs ?? Date.now;
  const records = await deps.adapter.list(TURNS_NAMESPACE, MAX_TURNS_TO_COPY);
  const sourceTurns = records.filter((r) => r.key.startsWith(`${from}:`));
  let copied = 0;
  for (const turn of sourceTurns) {
    const suffix = turn.key.slice(from.length + 1);
    if (suffix.length === 0) continue;
    await deps.adapter.put({
      namespace: TURNS_NAMESPACE,
      key: `${to}:${suffix}`,
      payload: turn.payload,
      metadata: {
        ...(turn.metadata ?? {}),
        forkedFrom: from,
        forkedAtMs: nowMs(),
      },
    });
    copied++;
  }
  const checkpointId = await deps.createCheckpoint(`fork:${from}->${to}`, {
    from,
    to,
    copiedTurns: copied,
    summary,
  });
  return {
    from,
    to,
    summary,
    findings: [...(input.findings ?? [])],
    files: [...(input.files ?? [])],
    issues: [...(input.issues ?? [])],
    checkpointId,
    copiedTurns: copied,
    createdAtMs: nowMs(),
  };
}
