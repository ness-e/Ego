import type { VoiceCaptureState } from "./useVoice.js";
import { VOICE_PRIVACY_NOTICE } from "./useVoice.js";
import { Button } from "../ui-kit/Button.js";

/**
 * VOICE-01 — Botón mic + notice de privacidad (presentación pura).
 * ≥44px, `aria-label` por estado, `aria-pressed` en recording.
 * Sin secretos, sin mic real: el dictado lo gobierna `useVoice`.
 *
 * FASE 1 (design system): el control es el `Button` del kit (`size="icon"`),
 * con el mínimo táctil de 44 px declarado explícitamente porque lo verifica
 * `test/voice-cfg.test.tsx` (`min-h-[44px]` / `min-w-[44px]`).
 */

export interface VoiceButtonProps {
  captureState: VoiceCaptureState;
  disabled: boolean;
  onToggleDictation: () => void;
}

export function VoiceButton({ captureState, disabled, onToggleDictation }: VoiceButtonProps) {
  const recording = captureState === "recording";
  const label = disabled
    ? "Entrada de voz deshabilitada"
    : recording
      ? "Detener dictado"
      : "Dictar por voz";
  return (
    <Button
      type="button"
      size="icon"
      variant="secondary"
      onClick={onToggleDictation}
      disabled={disabled}
      aria-label={label}
      aria-pressed={recording}
      title={disabled ? "Voz deshabilitada (kill switch o sin soporte)" : "Dictar al composer (WebSpeech local)"}
      data-testid="composer-voice-button"
      className="min-h-[44px] min-w-[44px] text-base"
    >
      {recording ? "⏺" : "🎙"}
    </Button>
  );
}

export function VoicePrivacyNotice() {
  return (
    <p
      data-testid="voice-privacy-notice"
      role="note"
      className="font-mono text-xs text-dim px-3 pt-1"
    >
      🎙 {VOICE_PRIVACY_NOTICE}
    </p>
  );
}
