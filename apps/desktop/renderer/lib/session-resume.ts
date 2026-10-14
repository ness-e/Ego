/**
 * T18 — Hidratación de sesiones (renderer, presentación pura).
 *
 * Mapea turnos persistidos de `session/turns` (vía `ipc.sessions.get`,
 * fuente: `EgoMemoryLifecycle.syncTurn`) a mensajes de chat.
 * Función pura: sin imports React/Electron (segura en tests node).
 * Vacío honesto: sin turnos o sin texto → `[]`, nunca inventa mensajes.
 */

/** Registro crudo de turno tal como lo devuelve `ipc.sessions.get`. */
export interface SessionTurnRecord {
  key: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

/** Mensaje hidratable por el runtime de chat (`@assistant-ui/react`). */
export interface HydratedMessage {
  id: string;
  role: "user" | "assistant";
  content: [{ type: "text"; text: string }];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null;
  return value as Record<string, unknown>;
}

function nonEmptyText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function turnTimestamp(turn: SessionTurnRecord, body: Record<string, unknown>): number {
  const meta = asRecord(turn.metadata);
  const fromMeta = meta?.["timestamp"];
  if (typeof fromMeta === "number" && Number.isFinite(fromMeta)) return fromMeta;
  const fromBody = body["timestamp"];
  if (typeof fromBody === "number" && Number.isFinite(fromBody)) return fromBody;
  return 0;
}

/**
 * Convierte turnos persistidos en mensajes ordenados por timestamp
 * ascendente (par user + assistant por turno). Tolera ambos pares de
 * campos (`userPrompt`/`assistantReply` y legacy
 * `userMessage`/`assistantResponse`). Turnos sin texto se omiten.
 */
export function turnsToMessages(turns: SessionTurnRecord[]): HydratedMessage[] {
  const ordered = [...turns].sort((a, b) => {
    const ba = asRecord(a.payload);
    const bb = asRecord(b.payload);
    return turnTimestamp(a, ba ?? {}) - turnTimestamp(b, bb ?? {});
  });
  const messages: HydratedMessage[] = [];
  let n = 0;
  for (const turn of ordered) {
    const body = asRecord(turn.payload);
    if (!body) continue;
    const user =
      nonEmptyText(body["userPrompt"]) ?? nonEmptyText(body["userMessage"]);
    const assistant =
      nonEmptyText(body["assistantReply"]) ??
      nonEmptyText(body["assistantResponse"]);
    if (user) {
      n += 1;
      messages.push({ id: `restored-u${n}`, role: "user", content: [{ type: "text", text: user }] });
    }
    if (assistant) {
      n += 1;
      messages.push({
        id: `restored-a${n}`,
        role: "assistant",
        content: [{ type: "text", text: assistant }],
      });
    }
  }
  return messages;
}
