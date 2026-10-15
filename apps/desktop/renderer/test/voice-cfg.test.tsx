import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  useVoice,
  sanitizeTranscript,
  resolveVoiceSttEnabled,
  resolveVoiceTtsEnabled,
  VOICE_PRIVACY_NOTICE,
  type VoiceRecognitionLike,
} from "../components/voice/useVoice.js";
import {
  VoiceButton,
  VoicePrivacyNotice,
} from "../components/voice/VoiceButton.js";

/**
 * VOICE-01 — Voz STT/TTS opt-in (mock determinístico, sin mic real en CI).
 * Kill switch deny-gana + privacy notice visible + botón ≥44px con aria.
 */

function makeMockRecognition(): VoiceRecognitionLike & { started: boolean } {
  return {
    started: false,
    onresult: null,
    onerror: null,
    onend: null,
    start() {
      this.started = true;
    },
    stop() {
      this.started = false;
      this.onend?.();
    },
  };
}

describe("VOICE-01: voz opt-in + kill switch", () => {
  it("privacy notice visible: proveedor + nunca-segundo-plano", () => {
    // Arrange/Act
    expect(VOICE_PRIVACY_NOTICE).toContain("proveedor");
    expect(VOICE_PRIVACY_NOTICE).toContain("segundo plano");
  });

  it("sanitizeTranscript recorta, colapsa y acota a 4000", () => {
    // Arrange: texto sucio + largo
    const raw = "  hola   mundo  " + "x".repeat(5000);
    // Act
    const clean = sanitizeTranscript(raw);
    // Assert
    expect(clean.startsWith("hola mundo")).toBe(true);
    expect(clean.length).toBeLessThanOrEqual(4000);
  });

  it("kill switch veta STT aunque haya soporte (deny-gana)", () => {
    // Arrange/Act/Assert
    expect(resolveVoiceSttEnabled({ disableVoice: true, supported: true })).toBe(false);
    expect(resolveVoiceSttEnabled({ disableVoice: false, supported: true })).toBe(true);
    expect(resolveVoiceSttEnabled({ disableVoice: false, supported: false })).toBe(false);
  });

  it("TTS exige opt-in y respeta kill (sin autoplay)", () => {
    expect(resolveVoiceTtsEnabled({ disableVoice: false, ttsOptIn: true })).toBe(true);
    expect(resolveVoiceTtsEnabled({ disableVoice: false, ttsOptIn: false })).toBe(false);
    expect(resolveVoiceTtsEnabled({ disableVoice: true, ttsOptIn: true })).toBe(false);
  });

  it("VoiceButton ≥44px con aria-label y estado recording/disabled", async () => {
    // Arrange
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    const onToggle = vi.fn();
    // Act: estado recording habilitado
    await act(async () => {
      root.render(
        <div>
          <VoiceButton captureState="recording" disabled={false} onToggleDictation={onToggle} />
          <VoicePrivacyNotice />
        </div>
      );
    });
    // Assert
    const btn = container.querySelector('[data-testid="composer-voice-button"]') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.getAttribute("aria-label")).toBe("Detener dictado");
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(btn.className).toContain("min-h-[44px]");
    expect(btn.className).toContain("min-w-[44px]");
    expect(container.querySelector('[data-testid="voice-privacy-notice"]')?.textContent).toContain(
      "segundo plano"
    );
    // Act: disabled honesto
    await act(async () => {
      root.render(<VoiceButton captureState="idle" disabled={true} onToggleDictation={onToggle} />);
    });
    expect((container.querySelector('[data-testid="composer-voice-button"]') as HTMLButtonElement).disabled).toBe(true);
    // Cleanup
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("hook: dictado mock compone transcript + speak solo con opt-in", async () => {
    // Arrange: factory mock + sintesis mock + transcript capturado
    const rec = makeMockRecognition();
    const speakFn = vi.fn();
    const cancelFn = vi.fn();
    const transcripts: string[] = [];
    const speakResults: Array<{ spoken: boolean; reason?: string }> = [];
    function Harness({ optIn }: { optIn: boolean }) {
      const v = useVoice({
        recognitionFactory: () => rec,
        synthesis: { speak: speakFn, cancel: cancelFn },
        initialTtsOptIn: optIn,
        onTranscript: (t) => {
          transcripts.push(t);
        },
      });
      return (
        <div>
          <button type="button" data-testid="h-dictate" onClick={v.toggleDictation}>
            dictar
          </button>
          <button
            type="button"
            data-testid="h-speak"
            onClick={() => {
              speakResults.push(v.speak("  lee esto  "));
            }}
          >
            leer
          </button>
        </div>
      );
    }
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    await act(async () => {
      root.render(<Harness optIn={false} />);
    });
    const click = (testid: string) =>
      act(async () => {
        (container.querySelector(`[data-testid="${testid}"]`) as HTMLButtonElement).dispatchEvent(
          new MouseEvent("click", { bubbles: true })
        );
      });
    // Act: dictar → el mock emite resultado
    await click("h-dictate");
    expect(rec.started).toBe(true);
    await act(async () => {
      rec.onresult?.("  hola dictado   test  ");
    });
    expect(transcripts).toEqual(["hola dictado test"]);
    // Act: speak SIN opt-in → no-op
    await click("h-speak");
    expect(speakFn).not.toHaveBeenCalled();
    expect(speakResults[speakResults.length - 1]?.spoken).toBe(false);
    // Act: con opt-in → habla (remount: initialTtsOptIn es estado inicial)
    await act(async () => {
      root.render(<Harness key="optin" optIn={true} />);
    });
    await click("h-speak");
    expect(speakFn).toHaveBeenCalledTimes(1);
    // Cleanup
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
