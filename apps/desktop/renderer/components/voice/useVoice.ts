import { useCallback, useRef, useState } from "react";

/**
 * VOICE-01 — Voz STT/TTS opt-in con kill switch (lógica aislada del composer).
 * Decisión ponytail: WebSpeech/`speechSynthesis` de la plataforma antes que
 * SDKs; groq/edge-nube solo vía main (`ipc.voice.*`, keys en safeStorage).
 * El renderer nunca toca secretos: este módulo no importa keys ni hace fetch.
 * Sin mic real en CI: el reconocimiento se inyecta (`recognitionFactory`).
 */

export type VoiceCaptureState = "idle" | "recording" | "denied" | "error" | "speaking";

export const VOICE_PRIVACY_NOTICE =
  "El audio se envía al proveedor solo cuando dictás o pedís leer una respuesta. Nunca se graba en segundo plano.";

export const VOICE_MAX_TRANSCRIPT_CHARS = 4000;

/** Limpia el transcript: recorta, colapsa espacios y acota a 4000 chars. */
export function sanitizeTranscript(raw: string): string {
  const collapsed = raw.trim().replace(/\s+/g, " ");
  return collapsed.length > VOICE_MAX_TRANSCRIPT_CHARS
    ? collapsed.slice(0, VOICE_MAX_TRANSCRIPT_CHARS)
    : collapsed;
}

/** STT habilitado: kill switch deny-gana sobre soporte de plataforma. */
export function resolveVoiceSttEnabled(args: {
  disableVoice: boolean;
  supported: boolean;
}): boolean {
  return !args.disableVoice && args.supported;
}

/** TTS habilitado: kill switch deny-gana sobre opt-in explícito. Sin autoplay. */
export function resolveVoiceTtsEnabled(args: {
  disableVoice: boolean;
  ttsOptIn: boolean;
}): boolean {
  return !args.disableVoice && args.ttsOptIn;
}

/** Mínimo estructural del reconocimiento (WebSpeech o mock inyectado). */
export interface VoiceRecognitionLike {
  lang?: string;
  onresult: ((text: string) => void) | null;
  onerror: ((kind: "denied" | "error") => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

/** Mínimo estructural de síntesis (speechSynthesis o mock inyectado). */
export interface VoiceSynthesisLike {
  speak: (utterance: { text: string; rate?: number }) => void;
  cancel: () => void;
}

export interface UseVoiceDeps {
  /** Inyecta reconocimiento (tests/CI); sin él se usa WebSpeech nativo si existe. */
  recognitionFactory?: () => VoiceRecognitionLike | null;
  /** Inyecta síntesis (tests/CI); sin ella se usa `window.speechSynthesis` si existe. */
  synthesis?: VoiceSynthesisLike | null;
  initialTtsOptIn?: boolean;
  onTranscript?: (text: string) => void;
}

function createNativeRecognition(): VoiceRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const Ctor = (w["SpeechRecognition"] ?? w["webkitSpeechRecognition"]) as
    | (new () => {
        lang?: string;
        onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: ((ev: { error?: string }) => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      })
    | undefined;
  if (typeof Ctor !== "function") return null;
  const native = new Ctor();
  const like: VoiceRecognitionLike = {
    onresult: null,
    onerror: null,
    onend: null,
    start: () => native.start(),
    stop: () => {
      try {
        native.stop();
      } catch {
        /* noop: stop idempotente */
      }
    },
  };
  native.onresult = (ev) => {
    const last = ev.results[ev.results.length - 1]?.[0]?.transcript ?? "";
    like.onresult?.(last);
  };
  native.onerror = (ev) => {
    like.onerror?.(ev.error === "not-allowed" ? "denied" : "error");
  };
  native.onend = () => {
    like.onend?.();
  };
  return like;
}

function resolveSynthesis(deps: UseVoiceDeps): VoiceSynthesisLike | null {
  if (deps.synthesis !== undefined) return deps.synthesis;
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    speechSynthesis?: {
      speak: (u: SpeechSynthesisUtterance) => void;
      cancel: () => void;
    };
  };
  const synth = w.speechSynthesis;
  if (!synth) return null;
  return {
    speak: (utterance) => {
      const u = new SpeechSynthesisUtterance(utterance.text);
      if (typeof utterance.rate === "number") u.rate = utterance.rate;
      synth.speak(u);
    },
    cancel: () => synth.cancel(),
  };
}

export interface UseVoiceApi {
  /** Kill switch global: true veta STT y TTS (deny-gana). */
  disableVoice: boolean;
  setDisableVoice: (v: boolean) => void;
  /** Opt-in explícito de lectura (sin autoplay). */
  ttsOptIn: boolean;
  setTtsOptIn: (v: boolean) => void;
  captureState: VoiceCaptureState;
  supported: boolean;
  sttEnabled: boolean;
  ttsEnabled: boolean;
  toggleDictation: () => void;
  speak: (text: string) => { spoken: boolean; reason?: string };
}

export function useVoice(deps: UseVoiceDeps = {}): UseVoiceApi {
  const [disableVoice, setDisableVoice] = useState(false);
  const [ttsOptIn, setTtsOptIn] = useState(deps.initialTtsOptIn ?? false);
  const [captureState, setCaptureState] = useState<VoiceCaptureState>("idle");
  const recRef = useRef<VoiceRecognitionLike | null>(null);
  const onTranscriptRef = useRef(deps.onTranscript);
  onTranscriptRef.current = deps.onTranscript;

  const supported =
    deps.recognitionFactory !== undefined
      ? true
      : createNativeSupportProbe();
  const sttEnabled = resolveVoiceSttEnabled({ disableVoice, supported });
  const ttsEnabled = resolveVoiceTtsEnabled({ disableVoice, ttsOptIn });

  const toggleDictation = useCallback(() => {
    if (disableVoice) return;
    const current = recRef.current;
    if (current) {
      current.stop();
      recRef.current = null;
      setCaptureState("idle");
      return;
    }
    const rec = deps.recognitionFactory
      ? deps.recognitionFactory()
      : createNativeRecognition();
    if (!rec) {
      setCaptureState("denied");
      return;
    }
    rec.onresult = (text: string) => {
      const clean = sanitizeTranscript(text);
      if (clean) onTranscriptRef.current?.(clean);
    };
    rec.onerror = (kind: "denied" | "error") => {
      recRef.current = null;
      setCaptureState(kind);
    };
    rec.onend = () => {
      recRef.current = null;
      setCaptureState((s) => (s === "recording" ? "idle" : s));
    };
    recRef.current = rec;
    try {
      rec.start();
      setCaptureState("recording");
    } catch {
      recRef.current = null;
      setCaptureState("error");
    }
  }, [deps.recognitionFactory, disableVoice]);

  const speak = useCallback(
    (text: string) => {
      if (disableVoice) return { spoken: false as const, reason: "kill-switch" };
      if (!ttsOptIn) return { spoken: false as const, reason: "opt-in-requerido" };
      const clean = sanitizeTranscript(text);
      if (!clean) return { spoken: false as const, reason: "texto-vacio" };
      const synth = resolveSynthesis(deps);
      if (!synth) return { spoken: false as const, reason: "sin-sintesis" };
      try {
        synth.cancel();
        synth.speak({ text: clean });
        setCaptureState("speaking");
        return { spoken: true as const };
      } catch {
        setCaptureState("error");
        return { spoken: false as const, reason: "sintesis-fallo" };
      }
    },
    // `deps.synthesis` es el único campo usado de `deps` (estable en tests).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disableVoice, ttsOptIn, deps.synthesis]
  );

  return {
    disableVoice,
    setDisableVoice,
    ttsOptIn,
    setTtsOptIn,
    captureState,
    supported,
    sttEnabled,
    ttsEnabled,
    toggleDictation,
    speak,
  };
}

/** Feature-detect sin instanciar (render puro, sin efectos). */
function createNativeSupportProbe(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return (
    typeof w["SpeechRecognition"] === "function" ||
    typeof w["webkitSpeechRecognition"] === "function"
  );
}
