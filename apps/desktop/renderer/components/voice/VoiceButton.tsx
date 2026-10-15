import type { VoiceCaptureState } from "./useVoice.js";
import { VOICE_PRIVACY_NOTICE } from "./useVoice.js";

/**
 * VOICE-01 — Botón mic + notice de privacidad (presentación pura).
 * ≥44px, `aria-label` por estado, `aria-pressed` en recording.
 * Sin secretos, sin mic real: el dictado lo gobierna `useVoice`.
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
    <button
      type="button"
      onClick={onToggleDictation}
      disabled={disabled}
      aria-label={label}
      aria-pressed={recording}
      title={disabled ? "Voz deshabilitada (kill switch o sin soporte)" : "Dictar al composer (WebSpeech local)"}
      data-testid="composer-voice-button"
      className="min-h-[44px] min-w-[44px] px-3 py-2.5 bg-panel border border-hairline rounded-card text-[15px] text-ink cursor-pointer transition-colors hover:bg-raised disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {recording ? "⏺" : "🎙"}
    </button>
  );
}

export function VoicePrivacyNotice() {
  return (
    <p
      data-testid="voice-privacy-notice"
      role="note"
      className="font-mono text-[11px] text-dim px-3 pt-1"
    >
      🎙 {VOICE_PRIVACY_NOTICE}
    </p>
  );
}
