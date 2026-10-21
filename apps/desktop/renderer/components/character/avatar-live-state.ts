/**
 * E6/Ola 2 (A4) — Estado vivo del avatar: resolución **pura**.
 *
 * ## Por qué existe (y por qué es una función y no un `useMemo`)
 * La resolución vivía dentro de un `useMemo` de `ego-chat.tsx` (un
 * componente de ~1900 líneas): no era testeable sin montar el chat entero.
 * Aquí está la **misma lógica**, sin hooks: determinista, testeable por
 * comportamiento y reutilizable (el chat la consume; los tests la consultan).
 *
 * ## Precedencia (razonada, no arbitraria)
 *
 * | # | Señal | Estado | Por qué en ese puesto |
 * |---|---|---|---|
 * | 1 | `pendingApprovals.length > 0` | `approval_required` | Requiere una decisión **humana ya**: nada del turno compite con un aviso de herramienta. |
 * | 2 | `activeError` | `error` | Fallo **duro**: el turno se está abortando. Un aviso tolerable no puede tapar un error real. |
 * | 3 | último evento de tool **del turno en curso** = `tool_error` | `warning` | Degradación **tolerable**: la tool falló y el modelo sigue. Va dentro de `isStreaming`: si el turno abortó (ya no hay streaming) el aviso desaparece y manda `error` o el reposo. |
 * | 4 | último evento de tool = `tool_call`/`tool_start` | `searching` / `using_tool` | Trabajo en curso con una herramienta. |
 * | 5 | streaming | `thinking` / `generating` | Trabajo normal del modelo. |
 * | 6 | `composerText` no vacío | `listening` | El usuario está escribiendo. |
 * | 7 | — | `idle` | Reposo. |
 *
 * ### Por qué `warning` va por delante de `generating` (decisión)
 * El aviso gana al "está escribiendo" porque **el aviso es más raro y más
 * accionable**: el usuario ya ve que el modelo escribe (el texto fluye); no
 * ve, en cambio, que una herramienta falló. Y el estado `warning` del motor
 * es un estado **vivo** (pose `warn`, movimiento `sway`): el avatar sigue
 * comunicando "algo está pasando", no se queda congelado.
 *
 * ### Por qué el aviso dura lo que dura el turno (decisión)
 * El estado del avatar es función del **último evento de tool**, no del texto
 * (igual que el `tool_call → using_tool` que ya existía). Por eso:
 *
 * - **Un aviso que durase un token (~50 ms) sería invisible**: el modelo
 *   escribe el siguientetrozo y el ámbar desaparecería. Sería un estado
 *   inútil.
 * - **La alternativa** ("warning solo mientras no hay texto nuevo después del
 *   error") exigiría comparar marcas de tiempo del texto contra el error: un
 *   estado más, una regla más y un "parpadeo" del aviso.
 * - **El aviso está acotado**: termina cuando llega el siguiente evento de
 *   tool (la herramienta se reintenta y funciona → el avatar vuelve al
 *   trabajo) o cuando termina el turno. Y —por diseño— **no se filtra al
 *   turno siguiente** (ver `turnStartToolSeq`).
 */
import type { CharacterState } from "./state/character-state.js";

/** Tipos de evento de tool que el chat puede recibir del stream. */
export type AvatarToolEventKind =
  | "tool_call"
  | "tool_result"
  | "tool_start"
  | "tool_end"
  | "tool_error";

/** Evento de tool tal y como lo necesita esta resolución. */
export interface AvatarToolEventLike {
  kind: AvatarToolEventKind;
  toolName: string;
  /**
   * Secuencia monótona del evento. Permite **acotar al turno en curso**:
   * `toolEvents` es acumulativo (el panel los muestra como historial), así
   * que sin este corte un `tool_error` de un turno viejo pintaría de ámbar
   * un turno nuevo.
   */
  seq?: number;
}

/** Entrada de la resolución del estado vivo del avatar. */
export interface AvatarLiveStateInput {
  /** Aprobaciones de turno pendientes (barrera HITL). */
  pendingApprovals: number;
  /** Hay un error DURO del turno en curso. */
  activeError: boolean;
  /** El turno está en streaming. */
  isStreaming: boolean;
  /** Eventos de tool (acumulativos; se acotan con `turnStartToolSeq`). */
  toolEvents: readonly AvatarToolEventLike[];
  /**
   * Secuencia del último evento de tool del turno **anterior**. Los eventos
   * con `seq <= turnStartToolSeq` pertenecen a turnos ya cerrados y NO
   * afectan al avatar.
   */
  turnStartToolSeq?: number;
  /** Rol del último mensaje del chat (`null` si no hay mensajes). */
  lastMessageRole: "assistant" | "user" | null;
  /** Texto del último mensaje del asistente. */
  lastAssistantText: string;
  /** Texto que el usuario está escribiendo en el compositor. */
  composerText: string;
}

/** Herramientas cuyo nombre delata una búsqueda (ojo → `searching`). */
function isSearchTool(toolName: string): boolean {
  const t = toolName.toLowerCase();
  return t.includes("search") || t.includes("memory") || t.includes("vanta");
}

/**
 * El último evento de tool **del turno en curso** (o `undefined`).
 *
 * Acota por `turnStartToolSeq`: los eventos de turnos anteriores no cuentan
 * (si no, un `tool_error` viejo dejaría el avatar en ámbar para siempre).
 */
function lastToolEventOfCurrentTurn(
  events: readonly AvatarToolEventLike[],
  turnStartToolSeq?: number
): AvatarToolEventLike | undefined {
  if (turnStartToolSeq === undefined) return events[events.length - 1];
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i]!;
    if (ev.seq === undefined) continue;
    if (ev.seq > turnStartToolSeq) return ev;
  }
  return undefined;
}

/**
 * Resuelve el estado del avatar a partir del contexto del chat.
 *
 * Función pura: sin hooks, sin DOM, sin estado oculto. Toda la información
 * entra por `input` y el resultado es determinista.
 */
export function resolveAvatarLiveState(
  input: AvatarLiveStateInput
): CharacterState {
  // 1) Decisión humana pendiente: nada del turno la desplaza.
  if (input.pendingApprovals > 0) return "approval_required";
  // 2) Fallo duro del turno: el aviso tolerable no puede taparlo.
  if (input.activeError) return "error";

  if (input.isStreaming) {
    // 3+4) Señal de herramienta del turno en curso.
    const lastTool = lastToolEventOfCurrentTurn(
      input.toolEvents,
      input.turnStartToolSeq
    );
    if (lastTool) {
      if (lastTool.kind === "tool_error") {
        // La tool falló pero el turno continúa: aviso tolerable.
        return "warning";
      }
      if (lastTool.kind === "tool_call" || lastTool.kind === "tool_start") {
        return isSearchTool(lastTool.toolName) ? "searching" : "using_tool";
      }
    }
    // 5) Trabajo normal del modelo.
    if (input.lastMessageRole === "assistant") {
      const txt = input.lastAssistantText;
      if (!txt || (txt.includes("<thinking>") && !txt.includes("</thinking>"))) {
        return "thinking";
      }
      return "generating";
    }
    return "thinking";
  }

  // 6) El usuario está escribiendo.
  if (input.composerText.trim().length > 0) return "listening";
  // 7) Reposo.
  return "idle";
}
