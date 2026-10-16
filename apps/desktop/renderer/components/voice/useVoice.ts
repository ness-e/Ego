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

function getSpeechRecognitionCtor() {
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
  return typeof Ctor === "function" ? Ctor : null;
}

function createIpcMediaRecorderRecognition(): VoiceRecognitionLike | null {
  if (typeof window === "undefined" || typeof navigator === "undefined") return null;
  const ego = (window as unknown as { ego?: { voice?: { stt?: (req: { audioB64: string }) => Promise<{ ok?: boolean; text?: string; denied?: boolean }> } } })?.ego;
  if (
    !ego?.voice?.stt ||
    !navigator.mediaDevices?.getUserMedia ||
    typeof MediaRecorder === "undefined"
  ) {
    return null;
  }

  let mediaStream: MediaStream | null = null;
  let mediaRecorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let isStopped = false;

  const like: VoiceRecognitionLike = {
    onresult: null,
    onerror: null,
    onend: null,
    start: () => {
      isStopped = false;
      chunks = [];
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          if (isStopped) {
            stream.getTracks().forEach((t) => t.stop());
            like.onend?.();
            return;
          }
          mediaStream = stream;
          try {
            const recorder = new MediaRecorder(stream);
            mediaRecorder = recorder;
            recorder.ondataavailable = (ev) => {
              if (ev.data && ev.data.size > 0) {
                chunks.push(ev.data);
              }
            };
            recorder.onerror = () => {
              like.onerror?.("error");
            };
            recorder.onstop = () => {
              mediaStream?.getTracks().forEach((t) => t.stop());
              mediaStream = null;
              if (chunks.length === 0) {
                like.onend?.();
                return;
              }
              const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
              const reader = new FileReader();
              reader.onloadend = async () => {
                try {
                  const resultStr = typeof reader.result === "string" ? reader.result : "";
                  const commaIdx = resultStr.indexOf(",");
                  const audioB64 = commaIdx >= 0 ? resultStr.slice(commaIdx + 1) : resultStr;
                  const res = await ego.voice!.stt!({ audioB64 });
                  if (res?.ok && typeof res.text === "string") {
                    like.onresult?.(res.text);
                  } else if (res?.denied) {
                    like.onerror?.("denied");
                  } else {
                    like.onerror?.("error");
                  }
                } catch {
                  like.onerror?.("error");
                } finally {
                  like.onend?.();
                }
              };
              reader.onerror = () => {
                like.onerror?.("error");
                like.onend?.();
              };
              reader.readAsDataURL(blob);
            };
            recorder.start();
          } catch {
            stream.getTracks().forEach((t) => t.stop());
            mediaStream = null;
            like.onerror?.("error");
          }
        })
        .catch((err: unknown) => {
          const name = (err as { name?: string })?.name;
          if (name === "NotAllowedError" || name === "PermissionDeniedError") {
            like.onerror?.("denied");
          } else {
            like.onerror?.("error");
          }
        });
    },
    stop: () => {
      isStopped = true;
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        try {
          mediaRecorder.stop();
        } catch {
          // noop
        }
      } else if (mediaStream) {
        mediaStream.getTracks().forEach((t) => t.stop());
        mediaStream = null;
        like.onend?.();
      }
    },
  };

  return like;
}

function createNativeRecognition(): VoiceRecognitionLike | null {
  const Ctor = getSpeechRecognitionCtor();
  if (Ctor) {
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

  // Fallback: si no hay WebSpeech en window, recurrir a IPC STT con MediaRecorder
  return createIpcMediaRecorderRecognition();
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
  if (getSpeechRecognitionCtor() !== null) return true;

  // Fallback IPC STT: si existe window.ego?.voice?.stt y soporte MediaRecorder/getUserMedia
  const ego = (window as unknown as { ego?: { voice?: { stt?: unknown } } })?.ego;
  const hasIpcStt = typeof ego?.voice?.stt === "function";
  const hasMediaDevices =
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined";

  return Boolean(hasIpcStt && hasMediaDevices);
}
