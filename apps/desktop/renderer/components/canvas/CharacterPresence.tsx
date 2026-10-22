import React from "react";
import { CharacterBadge } from "../character/CharacterBadge.js";
import { WhyButton } from "../explainability/WhyButton.js";
import { avatarStateFor } from "../../floating/avatar-bridge.js";
import type { ComponentMetadata } from "@ego/ui-runtime";
import type { CharacterState } from "../character/state/character-state.js";

export interface CharacterPresenceProps {
  metadata?: ComponentMetadata;
  className?: string;
  /**
   * EGO-FIND-119 (Ola 10) — El estado de atención REAL.
   *
   * ## El defecto
   * El componente fijaba `state="idle"` y `animated={false}`: 37 líneas de
   * wrapper con un estado que **no expresa** nada. O la presencia
   * contextual existe, o el componente es de *atribución* y no debe fingir
   * una presencia.
   *
   * ## La decisión
   * Este componente es de **ATRIBUCIÓN** (quién generó este componente +
   * por qué), no de presencia viva: vive en el canvas, junto a un canvas que
   * **no tiene** canal de atención (la `AttentionStateMachine` vive en el
   * main y su estado sólo llega a la ventana flotante → `preload.ts`:
   * `FloatingAttentionState`).
   *
   * Por eso:
   * - el estado del avatar sale del **mismo vocabulario y del mismo mapper**
   *   que el avatar flotante (`avatarStateFor`) → una sola verdad;
   * - si el anfitrión **conoce** el estado de atención, se le pasa y el
   *   avatar refleja la presencia real;
   * - si no lo conoce, `idle` no es una mentira: no hay contexto que
   *   expresar (y el badge es de atribución, no un monitor).
   */
  attentionState?: string;
}

export const CharacterPresence: React.FC<CharacterPresenceProps> = ({
  metadata,
  className = "",
  attentionState,
}) => {
  if (!metadata || !metadata.generatedBy) {
    return null;
  }

  const state = (attentionState !== undefined
    ? avatarStateFor(attentionState)
    : "idle") as CharacterState;

  return (
    <div
      className={`flex items-center justify-between px-2 pb-1.5 font-mono text-xs text-faint ${className}`}
    >
      <div className="flex items-center gap-1.5">
        <CharacterBadge
          size={18}
          subEgoId={metadata.generatedBy}
          state={state}
          animated={state !== "idle"}
        />
        <span className="text-faint">Por:</span>
        <span className="font-semibold text-ink">{metadata.generatedBy}</span>
      </div>

      {metadata.why && <WhyButton why={metadata.why} />}
    </div>
  );
};
