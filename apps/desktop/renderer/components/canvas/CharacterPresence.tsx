import React from "react";
import { CharacterBadge } from "../character/CharacterBadge.js";
import { WhyButton } from "../explainability/WhyButton.js";
import type { ComponentMetadata } from "@ego/ui-runtime";

export interface CharacterPresenceProps {
  metadata?: ComponentMetadata;
  className?: string;
}

export const CharacterPresence: React.FC<CharacterPresenceProps> = ({
  metadata,
  className = "",
}) => {
  if (!metadata || !metadata.generatedBy) {
    return null;
  }

  return (
    <div
      className={`flex items-center justify-between px-2 pb-1.5 font-mono text-xs text-faint ${className}`}
    >
      <div className="flex items-center gap-1.5">
        <CharacterBadge
          size={18}
          subEgoId={metadata.generatedBy}
          state="idle"
          animated={false}
        />
        <span className="text-faint">Por:</span>
        <span className="font-semibold text-ink">{metadata.generatedBy}</span>
      </div>

      {metadata.why && <WhyButton why={metadata.why} />}
    </div>
  );
};
