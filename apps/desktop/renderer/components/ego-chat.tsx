"use client";
import { useState, useEffect, useRef, useCallback, memo, createContext, useContext, useMemo } from "react";
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
  ActionBarPrimitive,
  useAuiState,
} from "@assistant-ui/react";
import { Warning, X, ArrowClockwise, ArrowCounterClockwise, DownloadSimple } from "@phosphor-icons/react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { MOTION } from "./canvas/DesignSystemProvider.js";
import { ego, RecallBadgeInfo, PendingApprovalInfo, ModelConfigInfo } from "../lib/ego";
import { turnsToMessages, type SessionTurnRecord } from "../lib/session-resume.js";
import { ApprovalCard } from "./tools/ApprovalCard";
import { CharacterBadge } from "./character/CharacterBadge.js";
import type { CharacterState } from "./character/state/CharacterStateMachine.js";
import { FileMentionBadge } from "./FileMentionBadge.js";
import { parseSlashCommand, extractMentions, LOCAL_SLASH_COMMANDS, SLASH_HELP_TEXT } from "./composer-slash.js";
import { useCanvasBridge } from "../hooks/useCanvasBridge";
import { useVoice } from "./voice/useVoice.js";
import { VoiceButton, VoicePrivacyNotice } from "./voice/VoiceButton.js";
import { MarkdownText } from "./assistant-ui/markdown-text.js";
import { MessageRenderBoundary } from "./assistant-ui/message-render-boundary.js";
import { toTurnUsage, type TurnUsage } from "./daily-state/MetricsConsole.js";
import { ToolExecutionCard } from "./chat/ToolExecutionCard.js";

const ChatActionsContext = createContext<{
  onRewind?: (messageId: string) => void;
  onRetry?: () => void;
  subEgoId?: string;
  avatarLiveState?: CharacterState;
  isStreaming?: boolean;
  lastMessageId?: string;
}>({});

/**
 * Virtualización barata por turnos (sin cambiar UX ni romper aria-live):
 * cada burbuja usa `content-visibility:auto` + `contain-intrinsic-size`
 * para que el navegador omita layout/paint fuera del viewport. El hilo
 * sigue siendo `ThreadPrimitive.Messages` (claves estables por message id
 * del runtime, nunca por índice) + ancla end vía `stick` (<100px).
 */
function UserMessageInner() {
  const { onRewind } = useContext(ChatActionsContext);
  const messageId = useAuiState((s) => (s as unknown as { message?: { id?: string } }).message?.id);

  return (
    <MessagePrimitive.Root
      className="flex justify-end my-2"
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 96px" }}
    >
      <div className="max-w-[min(82%,600px)] bg-hairline text-ink rounded-card px-3.5 py-2">
        <MessageRenderBoundary resetKey="user-turn">
          <MessagePrimitive.Content
            components={{
              Text: ({ text }) => <MarkdownText text={text} />,
            }}
          />
        </MessageRenderBoundary>
        <ActionBarPrimitive.Root className="mt-1 flex items-center justify-end gap-1 text-faint">
          <ActionBarPrimitive.Copy
            aria-label="Copiar mensaje"
            className="rounded p-1 transition-colors hover:bg-raised hover:text-ink"
          />
          {messageId && onRewind && (
            <button
              type="button"
              onClick={() => onRewind(messageId)}
              aria-label="Rebobinar aquí"
              title="Rebobinar historial hasta este turno"
              className="rounded p-1 text-[11px] font-mono flex items-center gap-1 transition-colors hover:bg-raised hover:text-ink cursor-pointer"
            >
              <ArrowCounterClockwise size={12} />
              <span>Rebobinar</span>
            </button>
          )}
        </ActionBarPrimitive.Root>
      </div>
    </MessagePrimitive.Root>
  );
}

// Sin props: nunca re-render por padre; el contenido interno sigue
// actualizándose vía contexto del runtime (MessagePrimitive).
const UserMessage = memo(UserMessageInner);
UserMessage.displayName = "UserMessage";

function AssistantMessageInner({
  subEgoId = "ego.nucleus",
  onRetry,
}: {
  subEgoId?: string;
  onRetry?: () => void;
}) {
  const { onRewind, avatarLiveState, isStreaming, lastMessageId } = useContext(ChatActionsContext);
  const messageId = useAuiState((s) => (s as unknown as { message?: { id?: string } }).message?.id);
  const isLast = Boolean(messageId && lastMessageId && messageId === lastMessageId);

  return (
    <MessagePrimitive.Root
      className="flex my-2.5 gap-2.5 items-start"
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 140px" }}
    >
      <div className="mt-0.5 shrink-0">
        {/* Regla de Estabilidad Visual: tamaño 28, anima solo si es el último y está en stream */}
        <CharacterBadge
          size={28}
          subEgoId={subEgoId}
          state={isLast ? (avatarLiveState ?? "idle") : "idle"}
          animated={isLast && Boolean(isStreaming)}
        />
      </div>
      <div className="min-w-0 flex-1 px-3.5 py-2.5 text-ink">
        <div className="flex items-center gap-1.5 mb-1 font-sans">
          <span className="text-[11px] font-semibold text-ink">{subEgoId}</span>
          <span className="rounded-full bg-raised border border-hairline/70 px-1.5 py-0.2 text-[9px] font-mono text-dim">
            Robot Studio
          </span>
        </div>
        <MessageRenderBoundary resetKey="assistant-turn">
          <MessagePrimitive.Content
            components={{
              Text: ({ text }) => <MarkdownText text={text} />,
            }}
          />
        </MessageRenderBoundary>
        <ActionBarPrimitive.Root className="mt-1 flex items-center gap-1 text-faint">
          <ActionBarPrimitive.Copy
            aria-label="Copiar respuesta"
            className="rounded p-1 transition-colors hover:bg-raised hover:text-ink"
          />
          <ActionBarPrimitive.Reload
            aria-label="Regenerar respuesta"
            className="rounded p-1 transition-colors hover:bg-raised hover:text-ink"
          />
          {messageId && onRewind && (
            <button
              type="button"
              onClick={() => onRewind(messageId)}
              aria-label="Rebobinar aquí"
              title="Rebobinar historial hasta este turno"
              className="rounded p-1 text-[11px] font-mono flex items-center gap-1 transition-colors hover:bg-raised hover:text-ink cursor-pointer"
            >
              <ArrowCounterClockwise size={12} />
              <span>Rebobinar</span>
            </button>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              aria-label="Reintentar último turno"
              title="Reintentar último turno"
              className="rounded p-1 min-h-[44px] min-w-[44px] inline-flex items-center justify-center transition-colors hover:bg-raised hover:text-ink"
            >
              <ArrowClockwise size={13} />
            </button>
          )}
        </ActionBarPrimitive.Root>
      </div>
    </MessagePrimitive.Root>
  );
}

// Comparador custom: solo subEgoId/onRetry. Los tokens del stream llegan
// por contexto del runtime, no por props — así las burbujas históricas no
// re-renderizan cuando el turno en curso acumula deltas.
const AssistantMessage = memo(
  AssistantMessageInner,
  (prev, next) => prev.subEgoId === next.subEgoId && prev.onRetry === next.onRetry
);
AssistantMessage.displayName = "AssistantMessage";


type Msg = {
  id: string;
  role: "user" | "assistant";
  content: [{ type: "text"; text: string }];
  recall?: RecallBadgeInfo;
  isError?: boolean;
};

interface ActiveChatError {
  message: string;
  prompt: string;
  timestamp: number;
}

let n = 0;
const nid = () => `m${++n}`;

type ChatDeltaChunk = {
  type?: string;
  delta?: string;
  text?: string;
  callId?: string;
  toolName?: string;
  arguments?: unknown;
  success?: boolean;
  output?: unknown;
  error?: unknown;
};

type ToolActivity = {
  kind: "tool_call" | "tool_result" | "tool_start" | "tool_end" | "tool_error";
  callId?: string;
  toolName: string;
  detail: string;
  arguments?: unknown;
  output?: unknown;
  error?: unknown;
  success?: boolean;
  durationMs?: number;
  /** Clave estable por evento (nunca índice de map) para followOnAppend. */
  seq: number;
};

function summarizeArgs(args: unknown): string {
  try {
    const s = JSON.stringify(args);
    return s.length > 120 ? `${s.slice(0, 117)}…` : s;
  } catch {
    return "";
  }
}

/** Convierte un chunk/evento de tool en actividad pintable; null si no es tool. */
function toToolActivity(chunk: ChatDeltaChunk): Omit<ToolActivity, "seq"> | null {
  const type = chunk.type;
  if (!chunk.toolName && type !== "tool_call" && type !== "tool_result" && type !== "tool_start" && type !== "tool_end" && type !== "tool_error") {
    return null;
  }
  const toolName = chunk.toolName || "tool";

  if (type === "tool_call" || type === "tool_start") {
    return {
      kind: type === "tool_start" ? "tool_start" : "tool_call",
      callId: chunk.callId,
      toolName,
      detail: summarizeArgs(chunk.arguments),
      arguments: chunk.arguments,
    };
  }
  if (type === "tool_result" || type === "tool_end" || type === "tool_error") {
    const err = typeof chunk.error === "string" ? chunk.error : "";
    return {
      kind: type === "tool_error" ? "tool_error" : type === "tool_end" ? "tool_end" : "tool_result",
      callId: chunk.callId,
      toolName,
      detail: err || (chunk.success === false ? "falló" : "ok"),
      output: chunk.output,
      error: chunk.error,
      success: chunk.success,
      arguments: chunk.arguments,
    };
  }
  return null;
}

const KEYED_PROVIDERS: readonly string[] = ["openai", "anthropic", "google", "deepseek"];

/**
 * CFG-12 — Composer con adjuntos backend (alcance: solo renderer).
 * Decisión ponytail: reusar IPC existente (`ipc.llm.*` con `prompt: string`);
 * sin schema/main nuevos. La validación es fail-closed en el renderer:
 * tipo fuera de allowlist o tamaño >10MB → cuarentena (nunca viaja al turno).
 * Permisos inline heredan CFG-06 (deny-gana: deny > ask > allow; sin match → ask).
 */
export const CFG12_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const CFG12_ALLOWED_MIME: readonly string[] = [
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];
const CFG12_ALLOWED_EXT: readonly string[] = [
  ".txt", ".md", ".csv", ".json", ".pdf", ".png", ".jpg", ".jpeg", ".webp",
];

export type Cfg12PermissionDecision = "allow" | "ask" | "deny";
export interface Cfg12PermissionRule {
  pattern: string;
  decision: Cfg12PermissionDecision;
}
export interface ComposerAttachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  permission: Cfg12PermissionDecision;
  quarantined: boolean;
  reason?: string;
  textContent?: string;
  dataUrl?: string;
}
// VOICE-01: STT/TTS opt-in implementado abajo (`useVoice` + `VoiceButton` +
// `ipc.voice.*` en main). El turno futuro con audio binario sigue pendiente:
// llevaría `{ audioInput?: { format: "wav"; bytesB64: string } }` por
// `ipc.voice.stt` (groq en main); este tipo queda como contrato documentado.
export type VoiceCapabilityState = "disabled-future" | "listening" | "speaking";

export function isAllowedAttachmentType(mime: string, name: string): boolean {
  const m = mime.toLowerCase();
  if ((CFG12_ALLOWED_MIME as readonly string[]).includes(m)) return true;
  const lower = name.toLowerCase();
  return CFG12_ALLOWED_EXT.some((ext) => lower.endsWith(ext));
}

function cfg12RuleMatches(rule: Cfg12PermissionRule, att: { mime: string; name: string }): boolean {
  return att.mime.includes(rule.pattern) || att.name.includes(rule.pattern);
}

/** Hereda CFG-06: deny-gana entre reglas que matchean; sin match → "ask" (fail-closed). */
export function resolveAttachmentPermission(
  rules: Cfg12PermissionRule[],
  att: { mime: string; name: string }
): Cfg12PermissionDecision {
  let sawAsk = false;
  let sawAllow = false;
  for (const rule of rules) {
    if (!cfg12RuleMatches(rule, att)) continue;
    if (rule.decision === "deny") return "deny";
    if (rule.decision === "ask") sawAsk = true;
    else sawAllow = true;
  }
  if (sawAsk) return "ask";
  if (sawAllow) return "allow";
  return "ask";
}

export function validateComposerAttachment(
  file: { name: string; mime: string; size: number },
  rules: Cfg12PermissionRule[] = []
): ComposerAttachment {
  const permission = resolveAttachmentPermission(rules, { mime: file.mime, name: file.name });
  if (!isAllowedAttachmentType(file.mime, file.name)) {
    return {
      id: `${Date.now()}-${file.name}`,
      name: file.name, mime: file.mime, size: file.size,
      permission: "deny", quarantined: true, reason: `Tipo no permitido (${file.mime || "sin mime"})`,
    };
  }
  if (file.size > CFG12_MAX_ATTACHMENT_BYTES) {
    return {
      id: `${Date.now()}-${file.name}`,
      name: file.name, mime: file.mime, size: file.size,
      permission: "deny", quarantined: true, reason: "Supera 10MB",
    };
  }
  if (permission === "deny") {
    return {
      id: `${Date.now()}-${file.name}`,
      name: file.name, mime: file.mime, size: file.size,
      permission, quarantined: true, reason: "Vetado por permiso inline (deny gana)",
    };
  }
  return {
    id: `${Date.now()}-${file.name}`,
    name: file.name, mime: file.mime, size: file.size,
    permission, quarantined: false,
  };
}

/** Prompt efectivo: adjuntos válidos como metadatos; cuarentena nunca viaja. */
export function buildPromptWithAttachments(prompt: string, atts: ComposerAttachment[]): string {
  const valid = atts.filter((a) => !a.quarantined);
  if (valid.length === 0) return prompt;
  const lines = valid.map(
    (a) => `- ${a.name} (${a.mime || "mime desconocido"}, ${(a.size / 1024).toFixed(1)}KB, permiso:${a.permission})`
  );
  let out = `${prompt}\n[Adjuntos (${valid.length}):\n${lines.join("\n")}]`;

  const extraBlocks = valid
    .map((a) => {
      if (a.textContent) {
        return `\n\n--- Adjunto: ${a.name} ---\n\`\`\`\n${a.textContent}\n\`\`\``;
      }
      if (a.dataUrl) {
        return `\n\n[Imagen adjunta: ${a.name} (${a.mime})]`;
      }
      return "";
    })
    .filter(Boolean);

  if (extraBlocks.length > 0) {
    out += extraBlocks.join("");
  }

  return out;
}

/**
 * CFG-11 — Marcas input-to-paint por frontera (medir, no optimizar a ciegas).
 * `tSend` se acuña antes de `llmStream`, `tFirst` con el primer delta con
 * texto, `tPaint` un frame después del flush que lo pinta (doble rAF).
 * Objetivo documentado: primera pintura <800ms tras el envío. El log
 * `chat.first_token` sale UNA vez por turno vía `console.debug` (sin spam,
 * sin secretos: solo turn id + latencias) — el rAF batching existente queda
 * intacto.
 */
export const CFG11_FIRST_PAINT_TARGET_MS = 800;

export interface Cfg11PaintMarks {
  tSend: number;
  tFirst: number | null;
  tPaint: number | null;
  logged: boolean;
}

export function createPaintMarks(tSend: number): Cfg11PaintMarks {
  return { tSend, tFirst: null, tPaint: null, logged: false };
}

/** Latencia envío → primer delta (null si aún no llegó). */
export function firstTokenLatencyMs(m: Cfg11PaintMarks): number | null {
  return m.tFirst === null ? null : m.tFirst - m.tSend;
}

/** Latencia envío → primera pintura (null si aún no pintó). */
export function inputToPaintMs(m: Cfg11PaintMarks): number | null {
  return m.tPaint === null ? null : m.tPaint - m.tSend;
}

/**
 * Bloqueo mock (decisión owner): sin keys del proveedor activo no hay
 * respuesta simulada — se retorna el mensaje de error BYOK explícito.
 * Retorna null cuando el turno puede proceder.
 */
async function getByokBlockReason(): Promise<string | null> {
  let cfg: ModelConfigInfo;
  try {
    cfg = await ego().settings.getModelConfig();
  } catch {
    return null; // settings no disponible: no bloquear
  }
  if (!cfg || typeof cfg.activeProvider !== "string") return null;
  const provider = cfg.activeProvider;
  if (provider === "mock") {
    return (
      `Chat bloqueado: el proveedor activo es "mock" y las respuestas simuladas están ` +
      `bloqueadas por decisión del owner. Configurá tu key BYOK en Ajustes para usar el ` +
      `backend real (sin keys no se genera texto).`
    );
  }
  if (KEYED_PROVIDERS.includes(provider)) {
    const providerKey = (cfg as unknown as Record<string, unknown>)[`${provider}Key`];
    const hasKey = [providerKey, cfg.apiKey].some(
      (k) => typeof k === "string" && k.trim().length > 0
    );
    if (!hasKey) {
      return (
        `Chat bloqueado: sin clave del proveedor activo "${provider}". Configurá tu key ` +
        `BYOK en Ajustes — las respuestas mock están bloqueadas y no se genera texto simulado.`
      );
    }
  }
  return null;
}

export interface EgoChatProps {
  projectId?: string;
  subEgoId?: string;
  /** T18: sesión activa a hidratar (`ipc.sessions.get`); null = hilo vacío honesto. */
  sessionId?: string | null;
}

export function EgoChat({ projectId, subEgoId, sessionId }: EgoChatProps = {}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [latestRecall, setLatestRecall] = useState<RecallBadgeInfo | null>(null);
  const [activeError, setActiveError] = useState<ActiveChatError | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalInfo[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [toolEvents, setToolEvents] = useState<ToolActivity[]>([]);
  // A1/A2: cancelación del turno en curso. El AbortController vive en el
  // renderer (cierra el estado de stream local); el backend se cablea vía
  // `ipc.llm.cancel` cuando el puente lo expone (ver `handleCancel`).
  const abortRef = useRef<AbortController | null>(null);
  // A2: stick-to-bottom (<100px). `viewportRef` mide el scroll del
  // ThreadPrimitive.Viewport; `stick` decide autoscroll vs "Jump to latest".
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [stick, setStick] = useState(true);
  // Perf-streaming: buffer de deltas por message id + flush 1x rAF.
  // Los chunks IPC (`onChatDelta`) acumulan texto en `pendingStreamRef`;
  // un único `setMessages` por frame aplica todos los deltas pendientes.
  // Sin esto, N tokens = N setState + N parse markdown + N autoscrolls.
  const pendingStreamRef = useRef<Map<string, string>>(new Map());
  const streamRafRef = useRef<number | null>(null);
  // Clave estable para actividad de tools (nunca índice de map).
  const toolSeqRef = useRef(0);
  // CFG-11: marcas input-to-paint del turno en curso (tSend/tFirst/tPaint).
  // Solo refs + 1 log/turno: ningún setState, ningún cambio de UX.
  const paintMarksRef = useRef<Cfg11PaintMarks | null>(null);
  // Autoscroll throttled a rAF (evita layout-thrash por frame de stream).
  const stickRafRef = useRef<number | null>(null);
  // T19: coste del turno actual desde `streamRes.usage` (solo lectura;
  // streaming y preferencia de modelo intactos). Null = vacío honesto.
  const [lastTurnUsage, setLastTurnUsage] = useState<TurnUsage | null>(null);
  // T08: reflejo en vivo del borrador del composer (@menciones y /comandos).
  // Display-only: el texto fuente sigue en el textarea del runtime (R-FE-2,
  // no se reimplementa el composer). El @ viaja en el prompt; el / local
  // se resuelve en `onNew` sin turno LLM.
  const [draftMentions, setDraftMentions] = useState<string[]>([]);
  const [draftSlash, setDraftSlash] = useState<string | null>(null);
  const [composerText, setComposerText] = useState("");
  // CFG-12: adjuntos del composer (metadata local; el contenido viaja como
  // resumen en el prompt por `ipc.llm.*` existente — sin binarios al main).
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const composerWrapRef = useRef<HTMLDivElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  const defaultFileSuggestions = useMemo(
    () => [
      "apps/desktop/renderer/App.tsx",
      "apps/desktop/src/main.ts",
      "packages/memory/src/index.ts",
      "packages/runtime/src/index.ts",
      "docs/architecture/vision-general.md",
      "README.md",
      "package.json",
    ],
    []
  );

  const filteredSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    if (!mentionQuery) return defaultFileSuggestions;
    const q = mentionQuery.toLowerCase();
    const matched = defaultFileSuggestions.filter((f) => f.toLowerCase().includes(q));
    return matched.length > 0 ? matched : [mentionQuery];
  }, [mentionQuery, defaultFileSuggestions]);

  const handleSelectMention = useCallback((filePath: string) => {
    const ta = composerWrapRef.current?.querySelector("textarea");
    if (!ta) return;
    const currentVal = ta.value;
    const replaced = currentVal.replace(/(?:^|\s)@([a-zA-Z0-9_\-\./]*)$/, (match) => {
      const prefix = match.startsWith(" ") ? " " : "";
      return `${prefix}@${filePath} `;
    });
    ta.value = replaced;
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.focus();
    setComposerText(replaced);
    setMentionQuery(null);
  }, []);

  const handleComposerInput = useCallback((e: React.FormEvent) => {
    const ta = (e.target as HTMLElement).closest("div")?.querySelector("textarea")
      ?? composerWrapRef.current?.querySelector("textarea");
    const value = ta ? ta.value : "";
    setComposerText(value);
    setDraftMentions(extractMentions(value));
    const slash = /^\s*\//.test(value) ? parseSlashCommand(value) : null;
    setDraftSlash(slash ? slash.name : null);

    const m = /(?:^|\s)@([a-zA-Z0-9_\-\./]*)$/.exec(value);
    if (m) {
      setMentionQuery(m[1] ?? "");
    } else {
      setMentionQuery(null);
    }
  }, []);
  const streamTargetRef = useRef<string | null>(null);
  const currentPromptRef = useRef<string>("");
  // VOICE-01: última respuesta del asistente (solo lectura por gesto con
  // opt-in; nunca autoplay). Ref sin setState: `executeTurn` la acuña antes
  // del setMessages que re-renderiza.
  const lastAssistantRef = useRef<string>("");

  // VOICE-01: el dictado compone texto al composer (display-only intacto: el
  // texto fuente sigue en el textarea del runtime; acá solo se anexa).
  const insertTranscript = useCallback(
    (text: string) => {
      const ta = composerWrapRef.current?.querySelector("textarea");
      if (!ta || !text) return;
      const sep = ta.value && !ta.value.endsWith(" ") ? " " : "";
      ta.value = `${ta.value}${sep}${text}`;
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      setComposerText(ta.value);
      setDraftMentions(extractMentions(ta.value));
    },
    []
  );
  const voice = useVoice({ onTranscript: insertTranscript });

  // VOICE-01: el kill switch persiste en main (`gov/settings/voice`); sin
  // puente (mocks de test) rigen los defaults locales. Solo lectura al montar.
  useEffect(() => {
    let cancelled = false;
    // Sin puente voice (mocks de test viejos) no hay nada que cargar.
    const statusPromise = ego().voice?.getStatus?.();
    if (!statusPromise) return;
    void (statusPromise as Promise<{ ok?: unknown; disableVoice?: unknown }>)
      .then((s) => {
        if (cancelled || !s || s.ok !== true) return;
        if (s.disableVoice) voice.setDisableVoice(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // `voice.*` estable (setState); corre una vez al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVoiceKillSwitch = useCallback(
    (v: boolean) => {
      voice.setDisableVoice(v);
      void ego()
        .voice?.setConfig?.({ disableVoice: v, privacyAcknowledged: true })
        .catch(() => {});
    },
    [voice]
  );

  const { focusedContext, onAction } = useCanvasBridge();

  // Estado reactivo en vivo del Mini-Avatar Adaptativo (FSM)
  const avatarLiveState: CharacterState = useMemo(() => {
    if (pendingApprovals.length > 0) return "approval_required";
    if (activeError) return "error";
    if (isStreaming) {
      if (toolEvents.length > 0) {
        const lastTool = toolEvents[toolEvents.length - 1];
        if (lastTool && (lastTool.kind === "tool_call" || lastTool.kind === "tool_start")) {
          const tName = lastTool.toolName.toLowerCase();
          if (tName.includes("search") || tName.includes("memory") || tName.includes("vanta")) {
            return "searching";
          }
          return "using_tool";
        }
      }
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === "assistant") {
        const txt = lastMsg.content.map((c) => c.text).join("");
        if (!txt || (txt.includes("<thinking>") && !txt.includes("</thinking>"))) {
          return "thinking";
        }
        return "generating";
      }
      return "thinking";
    }
    if (composerText.trim().length > 0) return "listening";
    return "idle";
  }, [pendingApprovals.length, activeError, isStreaming, toolEvents, messages, composerText]);

  // STAB-13: morph Send→Cancel (layoutId compartido, crossfade 150ms
  // MOTION.micro; reduced-motion → instantáneo). Sin migrar de lib.
  const reduceMotion = useReducedMotion();
  const composerTransition = reduceMotion ? { duration: 0 } : { duration: MOTION.micro };

  // T18: resume real — al cambiar la sesión activa se hidratan los turnos
  // persistidos (`ipc.sessions.get` → `session/turns` en VantaDB) en mensajes.
  // Vacío honesto si no hay turnos o el puente falla: nunca se inventan.
  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    void ego()
      .sessions?.get?.({ sessionId })
      .then((res) => {
        if (cancelled || !res || res.ok !== true) return;
        const turns = Array.isArray(res.turns) ? (res.turns as SessionTurnRecord[]) : [];
        if (!cancelled) setMessages(turnsToMessages(turns));
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Subscripción reactiva a solicitudes de aprobación HITL (ACT-07)
  useEffect(() => {
    const unsub = ego().onApprovalRequest?.((req) => {
      setPendingApprovals((prev) => {
        if (prev.some((p) => p.approvalId === req.approvalId)) return prev;
        return [...prev, req];
      });
    });
    return () => {
      unsub?.();
    };
  }, []);

  const handleResolveApproval = useCallback(
    async (
      approvalId: string,
      decision: {
        approved: boolean;
        reason?: string;
        modifiedArguments?: Record<string, unknown>;
      }
    ) => {
      // HITL unificado (T02): canal ÚNICO `ipc.approval.resolve` para widget y
      // card, misma firma (motivo/args opcionales). `ipc.gov.approve` queda
      // DEPRECATED (se mantiene en main/preload por compatibilidad; no usar).
      await ego().resolveApproval({
        approvalId,
        approved: decision.approved,
        reason: decision.reason,
        modifiedArguments: decision.modifiedArguments,
      });
      setTimeout(() => {
        setPendingApprovals((prev) => prev.filter((p) => p.approvalId !== approvalId));
      }, 1200);
    },
    []
  );

  // Subscripción reactiva a eventos de error de IPC emitidos desde el main process
  useEffect(() => {
    const unsub = ego().onChatError?.((err) => {
      setActiveError({
        message: err.error,
        prompt: currentPromptRef.current || "",
        timestamp: err.timestamp || Date.now(),
      });
    });
    return () => {
      unsub?.();
    };
  }, []);

  // Drena el buffer de deltas en UN solo setMessages (1x por frame).
  // Copia única del array + índice por id: O(turnos + deltas del frame).
  const flushStreamBuffer = useCallback(() => {
    streamRafRef.current = null;
    const pending = pendingStreamRef.current;
    if (pending.size === 0) return;
    const entries = Array.from(pending.entries());
    pending.clear();
    setMessages((prev) => {
      const idxById = new Map<string, number>();
      for (let i = 0; i < prev.length; i++) {
        const m = prev[i];
        if (m) idxById.set(m.id, i);
      }
      let out: Msg[] | null = null;
      const ensureOut = () => (out ??= [...prev]);
      let changed = false;
      for (const [id, delta] of entries) {
        if (!delta) continue;
        const idx = idxById.get(id);
        if (idx !== undefined) {
          const arr = ensureOut();
          const cur = arr[idx];
          if (!cur) continue;
          const curText = cur.content.map((p) => p.text).join("");
          arr[idx] = {
            ...cur,
            content: [{ type: "text" as const, text: curText + delta }],
          };
          changed = true;
        } else {
          const arr = ensureOut();
          arr.push({
            id,
            role: "assistant" as const,
            content: [{ type: "text" as const, text: delta }],
          });
          idxById.set(id, arr.length - 1);
          changed = true;
        }
      }
      return changed && out ? out : prev;
    });
  }, []);

  const scheduleStreamFlush = useCallback(() => {
    if (streamRafRef.current !== null) return;
    if (typeof requestAnimationFrame !== "undefined") {
      streamRafRef.current = requestAnimationFrame(() => {
        flushStreamBuffer();
      });
    } else {
      // Fallback headless (sin rAF): microtarea coalescente. Centinela -1
      // (los ids reales de rAF son >= 1): no hay nada que cancelar.
      streamRafRef.current = -1;
      queueMicrotask(() => {
        flushStreamBuffer();
      });
    }
  }, [flushStreamBuffer]);

  // Cancela el rAF pendiente al desmontar (sin setState post-unmount).
  useEffect(() => {
    return () => {
      if (streamRafRef.current !== null) {
        if (typeof cancelAnimationFrame !== "undefined" && streamRafRef.current >= 0) {
          try {
            cancelAnimationFrame(streamRafRef.current);
          } catch {
            /* noop */
          }
        }
        streamRafRef.current = null;
      }
      pendingStreamRef.current.clear();
      if (stickRafRef.current !== null) {
        if (typeof cancelAnimationFrame !== "undefined") {
          try {
            cancelAnimationFrame(stickRafRef.current);
          } catch {
            /* noop */
          }
        }
        stickRafRef.current = null;
      }
    };
  }, []);

  // Inserta el mensaje assistant del turno en curso si falta, o le anexa texto.
  // Los deltas llegan antes del invoke final: se acumulan en `pendingStreamRef`
  // y se pintan 1x por frame (rAF), no 1x por token.
  const appendStreamText = useCallback(
    (id: string, text: string) => {
      if (!text) return;
      const prev = pendingStreamRef.current.get(id) ?? "";
      pendingStreamRef.current.set(id, prev + text);
      scheduleStreamFlush();
    },
    [scheduleStreamFlush]
  );

  // Streaming real (T02): el main ya emite `ipc.chat.delta`
  // (text/tool_call/tool_result); acá se suscribe. Sin suscripción no hay stream.
  useEffect(() => {
    const unsubs: Array<() => void> = [];
    const bridge = ego();

    if (bridge.onChatDelta) {
      unsubs.push(
        bridge.onChatDelta((chunk: { type: string; delta?: string }) => {
          const target = streamTargetRef.current;
          if (!target) return;
          const c = chunk as ChatDeltaChunk;
          // CFG-11: marca tFirst con el primer delta con texto y captura
          // tPaint un frame después del flush que lo pinta (doble rAF).
          // Fallback headless (sin rAF): captura sincrónica coalescente.
          const marks = paintMarksRef.current;
          const firstText = c.delta ?? c.text ?? "";
          if (marks && marks.tFirst === null && firstText) {
            marks.tFirst = performance.now();
            const snapshot = marks;
            const turn = target;
            const capture = () => {
              // Turno cancelado o superado en el medio: no se loguea rancio.
              if (snapshot.logged || paintMarksRef.current !== snapshot) return;
              snapshot.logged = true;
              snapshot.tPaint = performance.now();
              const ft = firstTokenLatencyMs(snapshot);
              const ip = inputToPaintMs(snapshot);
              console.debug(
                `[chat.first_token] turn=${turn} first_token_ms=${ft} input_to_paint_ms=${ip} target_ms=${CFG11_FIRST_PAINT_TARGET_MS}`
              );
            };
            if (typeof requestAnimationFrame !== "undefined") {
              requestAnimationFrame(() => {
                if (typeof requestAnimationFrame !== "undefined") {
                  requestAnimationFrame(capture);
                } else {
                  capture();
                }
              });
            } else {
              capture();
            }
          }
          const tool = toToolActivity(c);
          if (tool) {
            const seq = ++toolSeqRef.current;
            setToolEvents((prev) => [...prev, { ...tool, seq }]);
            return;
          }
          appendStreamText(target, c.delta ?? c.text ?? "");
        })
      );
    }
    if (bridge.onRecallStatus) {
      unsubs.push(bridge.onRecallStatus((status) => setLatestRecall(status)));
    }
    if (bridge.onEvent) {
      unsubs.push(
        bridge.onEvent((event: unknown) => {
          if (!event || typeof event !== "object") return;
          const tool = toToolActivity(event as ChatDeltaChunk);
          if (tool) {
            const seq = ++toolSeqRef.current;
            setToolEvents((prev) => [...prev, { ...tool, seq }]);
          }
        })
      );
    }
    return () => {
      streamTargetRef.current = null;
      unsubs.forEach((u) => u());
    };
  }, [appendStreamText]);

  const executeTurn = useCallback(async (promptText: string) => {
    if (!promptText.trim()) return;
    // CFG-12: el turno lleva el resumen de adjuntos válidos; la cuarentena
    // nunca viaja. Se limpia el composer tras acuñar el prompt efectivo.
    const fullPrompt = buildPromptWithAttachments(promptText, attachments);
    const promptTextEffective = fullPrompt;
    setAttachments([]);
    setAttachError(null);
    // A1: cada turno acuña su AbortController; `handleCancel`/Esc lo aborta.
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    currentPromptRef.current = promptTextEffective;
    setActiveError(null);
    // Conserva los toolEvents previos para que no desaparezcan de golpe entre turnos
    // T19: el badge muestra el turno actual; sin `usage` nuevo no hay
    // coste que mostrar (nunca rastro del turno anterior).
    setLastTurnUsage(null);

    const byokBlock = await getByokBlockReason();
    if (byokBlock) {
      const [u, a] = [nid(), nid()];
      setMessages((prev) => [
        ...prev,
        { id: u, role: "user", content: [{ type: "text", text: promptTextEffective }] },
        { id: a, role: "assistant", isError: true, content: [{ type: "text", text: byokBlock }] },
      ]);
      setActiveError({ message: byokBlock, prompt: promptTextEffective, timestamp: Date.now() });
      return;
    }

    const [u, a] = [nid(), nid()];
    setMessages((prev) => [
      ...prev,
      { id: u, role: "user", content: [{ type: "text", text: promptTextEffective }] },
    ]);
    // Sin placeholder "Procesando…": el banner skeleton con altura reservada
    // ocupa su lugar hasta el primer delta (anti layout-shift); el mensaje
    // assistant se inserta lazy con el primer chunk o el texto final.
    streamTargetRef.current = a;
    setIsStreaming(true);
    // CFG-11: tSend se acuña justo antes del invoke (frontera de envío).
    paintMarksRef.current = createPaintMarks(performance.now());

    try {
      const streamRes = await ego().llmStream({
        prompt: promptTextEffective,
        projectId,
        subEgoId,
        // 2026-10-15: el hilo SIEMPRE viaja con su sessionId. Sin esto todos
        // los turnos caían al bucket del lifecycle (`default_session`) y el
        // historial por sesión (picker/resume) jamás acumulaba nada.
        ...(sessionId ? { sessionId } : {}),
      });
      if ((streamRes as { status?: string }).status === "aborted") {
        // A1 real: el main abortó el loop (`ipc.llm.cancel`) y el invoke
        // resolvió `aborted` en vez de rechazar — no es error visible.
        // El buffer rAF del turno se descarta: el texto final manda.
        pendingStreamRef.current.delete(a);
        setMessages((prev) =>
          prev.some((x) => x.id === a)
            ? prev.map((x) =>
                x.id === a
                  ? { ...x, content: [{ type: "text" as const, text: "_Turno cancelado por el usuario._" }] }
                  : x
              )
            : [...prev, { id: a, role: "assistant" as const, content: [{ type: "text" as const, text: "_Turno cancelado por el usuario._" }] }]
        );
        return;
      }
      if (streamRes.recallStatus) {
        setLatestRecall(streamRes.recallStatus);
      }
      // T19: `usage.{promptTokens,completionTokens,estimatedCostUsd}` ya viaja
      // en el turno (main.ts `handleLlmStream`); acá solo se expone en la UI.
      setLastTurnUsage(toTurnUsage(streamRes.usage, streamRes.turnId));

      // A6: sin badge `[VantaDB: …]` inyectado en el texto del turno — el
      // recall vive como componente separado (banner Memoria Activa +
      // `recall` del mensaje), nunca como prefijo del contenido.
      const finalReply = streamRes.text;
      // 2026-10-14: el fallback a mock del router enmascaraba errores de
      // proveedor (ej. modelo retirado 404) como respuesta real. Señal honesta.
      const isSimulated = streamRes.text.startsWith("[MockResponse");
      const visibleReply = isSimulated
        ? `⚠️ Respuesta simulada (el proveedor falló; revisá tu key y el modelo en Ajustes).\n\n${finalReply}`
        : finalReply;
      // VOICE-01: acuña la última respuesta para "Leer" (opt-in, por gesto).
      lastAssistantRef.current = visibleReply;

      // El texto final es autoritativo: descarta deltas aún en buffer rAF.
      pendingStreamRef.current.delete(a);
      setMessages((prev) => {
        const body: { content: Msg["content"]; recall: RecallBadgeInfo } = {
          content: [{ type: "text", text: visibleReply }],
          recall: streamRes.recallStatus,
        };
        return prev.some((x) => x.id === a)
          ? prev.map((x) => (x.id === a ? { ...x, ...body } : x))
          : [...prev, { id: a, role: "assistant" as const, ...body }];
      });
    } catch (err) {
      // A1: turno abortado por el usuario (Cancel/Esc) — no es error visible.
      pendingStreamRef.current.delete(a);
      if (ctrl.signal.aborted) {
        setMessages((prev) =>
          prev.some((x) => x.id === a)
            ? prev.map((x) =>
                x.id === a
                  ? { ...x, content: [{ type: "text" as const, text: "_Turno cancelado por el usuario._" }] }
                  : x
              )
            : prev
        );
      } else {
        const errorStr = err instanceof Error ? err.message : String(err);
        setActiveError({
          message: errorStr,
          prompt: promptTextEffective,
          timestamp: Date.now(),
        });

        setMessages((prev) => {
          const body: { isError: true; content: Msg["content"] } = {
            isError: true,
            content: [{ type: "text", text: `⚠️ Error en ejecución de turno: ${errorStr}` }],
          };
          return prev.some((x) => x.id === a)
            ? prev.map((x) => (x.id === a ? { ...x, ...body } : x))
            : [...prev, { id: a, role: "assistant" as const, ...body }];
        });
      }
    } finally {
      if (streamTargetRef.current === a) streamTargetRef.current = null;
      // CFG-11: las marcas NO se anulan acá a propósito — la captura tPaint
      // viaja en doble-rAF y puede disparar después del resolve; el próximo
      // turno las sobrescribe y `handleCancel` las descarta al cancelar.
      if (abortRef.current === ctrl) abortRef.current = null;
      setIsStreaming(false);
    }
  }, [projectId, subEgoId, sessionId, attachments]);

  // A1/A2: cancela el turno en curso. Cierra el estado local de stream de
  // inmediato (AbortController) y aborta el loop remoto vía
  // `ipc.llm.cancel` (el main detiene generate/tools entre turnos y emite
  // `turn-cancelled`; el invoke resuelve `aborted`, rama tratada arriba).
  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    streamTargetRef.current = null;
    // CFG-11: turno cancelado antes de pintar → sin log rancio (la captura
    // pendiente verifica `paintMarksRef.current !== snapshot` y se omite).
    paintMarksRef.current = null;
    // Descarta deltas en buffer + cancela el frame pendiente: sin esto un
    // rAF tardío pintaría texto tras "Turno cancelado".
    pendingStreamRef.current.clear();
    if (streamRafRef.current !== null) {
      if (typeof cancelAnimationFrame !== "undefined" && streamRafRef.current >= 0) {
        try {
          cancelAnimationFrame(streamRafRef.current);
        } catch {
          /* noop */
        }
      }
      streamRafRef.current = null;
    }
    setIsStreaming(false);
    void ego()
      .llmCancel?.()
      .catch(() => {});
  }, []);

  // CFG-12: ingesta de adjuntos (fail-closed: tipo/tamaño/permiso → cuarentena).
  const handleFiles = useCallback((files: FileList | File[] | null) => {
    if (!files) return;
    const list = Array.from(files);
    const validated = list.map((f) =>
      validateComposerAttachment({ name: f.name, mime: f.type, size: f.size })
    );
    setAttachments((prev) => [...prev, ...validated]);
    const blocked = validated.filter((v) => v.quarantined);
    setAttachError(
      blocked.length > 0
        ? `${blocked.length} adjunto(s) en cuarentena: ${blocked.map((b) => b.reason ?? b.name).join("; ")}`
        : null
    );

    // Lectura real de archivos adjuntos (multimodalidad / texto en vivo)
    list.forEach((f, idx) => {
      const v = validated[idx];
      if (!v || v.quarantined) return;

      if (f.type && f.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          setAttachments((prev) =>
            prev.map((att) => (att.id === v.id ? { ...att, dataUrl } : att))
          );
        };
        reader.readAsDataURL(f);
      } else if (f.size <= 64 * 1024) {
        if (typeof f.text === "function") {
          f.text()
            .then((text) => {
              setAttachments((prev) =>
                prev.map((att) => (att.id === v.id ? { ...att, textContent: text } : att))
              );
            })
            .catch(() => {});
        } else {
          const reader = new FileReader();
          reader.onload = () => {
            const text = reader.result as string;
            setAttachments((prev) =>
              prev.map((att) => (att.id === v.id ? { ...att, textContent: text } : att))
            );
          };
          reader.readAsText(f);
        }
      }
    });
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // A2: Esc cancela el turno en curso (mismo Abort que el botón Cancel).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && abortRef.current) {
        e.preventDefault();
        handleCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleCancel]);

  // A2: autoscroll solo con stick (<100px del fondo). Sin stick se muestra
  // "Jump to latest" y el viewport no salta (lectura de historial intacta).
  // Follow-on-append throttled a 1x rAF: sin esto cada delta del stream
  // forzaba un layout (scrollHeight) + paint.
  useEffect(() => {
    if (!stick) return undefined;
    if (stickRafRef.current !== null) return undefined;
    if (typeof requestAnimationFrame !== "undefined") {
      stickRafRef.current = requestAnimationFrame(() => {
        stickRafRef.current = null;
        const el = viewportRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
      return () => {
        if (stickRafRef.current !== null) {
          try {
            cancelAnimationFrame(stickRafRef.current);
          } catch {
            /* noop */
          }
          stickRafRef.current = null;
        }
      };
    }
    const el = viewportRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    return undefined;
  }, [messages, isStreaming, toolEvents, stick]);

  // Sincronización reactiva: acciones disparadas en el Canvas alimentan el Chat (CANV-03 / COUC-07)
  useEffect(() => {
    const unsub = onAction((act) => {
      // T04: el evento ya viaja estructurado (payload ?? {} en CanvasBridge);
      // se adjunta serializado para que el turno conserve la carga útil.
      const payload = act.payload ?? {};
      const suffix = Object.keys(payload).length > 0 ? ` ${JSON.stringify(payload)}` : "";
      void executeTurn(`[Acción de Canvas en ${act.componentId}]: ${act.actionId}${suffix}`);
    });
    return () => {
      unsub();
    };
  }, [onAction, executeTurn]);

  const handleRetry = useCallback(() => {
    if (!activeError?.prompt) return;
    const promptToRetry = activeError.prompt;
    executeTurn(promptToRetry);
  }, [activeError, executeTurn]);

  const handleRewind = useCallback((targetId: string) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === targetId);
      if (idx < 0) return prev;
      return prev.slice(0, idx + 1);
    });
  }, []);

  const exportConversationMarkdown = useCallback(() => {
    if (messages.length === 0) return;
    const lines: string[] = [
      `# Conversación de Ego SOC`,
      `Fecha: ${new Date().toLocaleString()}`,
      `Sub-Ego: ${subEgoId ?? "ego.nucleus"}`,
      `---`,
      "",
    ];
    for (const m of messages) {
      const roleName = m.role === "user" ? "Usuario" : `Sub-Ego (${subEgoId ?? "ego.nucleus"})`;
      const text = m.content
        .map((c) => (c.type === "text" ? c.text : ""))
        .join("\n");
      lines.push(`### ${roleName}:\n\n${text}\n`);
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ego-chat-${Date.now()}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [messages, subEgoId]);

  const fillComposer = useCallback((promptText: string) => {
    const ta = composerWrapRef.current?.querySelector("textarea");
    if (ta) {
      ta.value = promptText;
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      ta.focus();
      setComposerText(promptText);
    }
  }, []);

  const runtime = useExternalStoreRuntime({
    messages,
    setMessages: (msgs) => setMessages([...msgs]),
    convertMessage: (m) => m,
    onReload: async () => {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
      if (lastUserMsg) {
        const text = lastUserMsg.content
          .map((p) => (p.type === "text" ? p.text : ""))
          .join("");
        if (text) {
          await executeTurn(text);
        }
      }
    },
    onNew: async (m) => {
      const text = m.content
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("");
      setComposerText("");
      // T08: slash-commands locales (no consumen turno ni tocan streaming).
      const slash = parseSlashCommand(text);
      if (slash && LOCAL_SLASH_COMMANDS.has(slash.name)) {
        if (slash.name === "clear") {
          setMessages([]);
          setToolEvents([]);
          setActiveError(null);
        } else if (slash.name === "help") {
          const [u, a] = [nid(), nid()];
          setMessages((prev) => [
            ...prev,
            { id: u, role: "user", content: [{ type: "text", text }] },
            { id: a, role: "assistant", content: [{ type: "text", text: SLASH_HELP_TEXT }] },
          ]);
        }
        setDraftMentions([]);
        setDraftSlash(null);
        return;
      }
      setDraftMentions([]);
      setDraftSlash(null);
      await executeTurn(text);
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="h-full flex flex-col">
        {/* Cabecera del Chat River 2.0 con Exportar (.md) y Avatar Reactivo */}
        <div className="flex items-center justify-between border-b border-hairline px-3.5 py-2 text-xs bg-panel/40 shrink-0">
          <div className="flex items-center gap-2">
            <CharacterBadge
              subEgoId={subEgoId ?? "ego.nucleus"}
              size={26}
              state={avatarLiveState}
              animated={avatarLiveState !== "idle"}
            />
            <span className="font-semibold text-ink">Ego Chat</span>
            <span className="rounded-full bg-raised border border-hairline px-2 py-0.5 text-[10px] font-mono text-dim">
              {subEgoId ?? "ego.nucleus"}
            </span>
          </div>
          <button
            type="button"
            onClick={exportConversationMarkdown}
            aria-label="Exportar conversación a Markdown"
            title="Exportar conversación actual (.md)"
            disabled={messages.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-hairline bg-raised/70 px-2.5 py-1 text-[11px] font-medium text-faint hover:text-ink hover:bg-raised transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <DownloadSimple size={13} />
            <span>Exportar (.md)</span>
          </button>
        </div>

        {/* Banner de Memoria Viva (Hermes RecallStatus + VantaDB) */}
        {latestRecall && latestRecall.count > 0 && (
          <div className="flex items-center gap-2 border-b border-hairline bg-raised/40 px-3 py-1 text-[11px] text-faint">
            <span>{latestRecall.glyph}</span>
            <span>Memoria Activa: {latestRecall.count} fragmentos de {latestRecall.sources.join(", ")}</span>
            <span className="ml-auto font-mono text-[10px] text-dim">~{latestRecall.tokensEstimate} tokens</span>
          </div>
        )}

        <ThreadPrimitive.Viewport
          ref={viewportRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 100);
          }}
          className="relative flex-1 overflow-y-auto px-3 py-2"
          style={{ overflowAnchor: "auto" }}
        >
          <ThreadPrimitive.Empty>
            <div className="flex flex-col items-center justify-center p-8 text-center text-faint max-w-xl mx-auto">
              <div className="mb-4">
                <CharacterBadge subEgoId={subEgoId ?? "ego.nucleus"} size={72} state={avatarLiveState} animated />
              </div>
              <p className="mb-1.5 text-ink font-semibold text-base font-sans">Cerebro Operativo de Ego</p>
              <p className="font-sans text-[13px] text-faint mb-6">
                Haz una pregunta o asigna una tarea a tus Sub-Egos.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
                {[
                  { title: "Analizar arquitectura del proyecto", desc: "Revisa estructura y dependencias" },
                  { title: "Proyectar reporte de métricas en el Canvas", desc: "Abre el dashboard en Workspace" },
                  { title: "Buscar decisiones clave en VantaDB", desc: "Consulta el historial persistente" },
                  { title: "Revisar estado de Git y tareas pendientes", desc: "Verifica cambios y roadmap" },
                ].map((starter) => (
                  <button
                    key={starter.title}
                    type="button"
                    onClick={() => fillComposer(starter.title)}
                    className="group flex flex-col p-3 rounded-xl border border-hairline bg-panel hover:bg-raised hover:border-dim transition-all text-left shadow-sm cursor-pointer"
                  >
                    <span className="font-medium text-[12px] text-ink group-hover:text-brand transition-colors">
                      {starter.title}
                    </span>
                    <span className="text-[11px] text-faint mt-0.5 line-clamp-1">
                      {starter.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </ThreadPrimitive.Empty>
          <ChatActionsContext.Provider
            value={{
              onRewind: handleRewind,
              onRetry: handleRetry,
              subEgoId: subEgoId ?? "ego.nucleus",
              avatarLiveState,
              isStreaming,
              lastMessageId: messages[messages.length - 1]?.id,
            }}
          >
            <ThreadPrimitive.Messages
              components={{
                UserMessage,
                AssistantMessage: () => (
                  <AssistantMessage subEgoId={subEgoId ?? "ego.nucleus"} onRetry={handleRetry} />
                ),
              }}
            />
          </ChatActionsContext.Provider>
        </ThreadPrimitive.Viewport>

        {/* A2: Jump to latest — solo sin stick (el viewport no salta solo). */}
        {!stick && (
          <div className="flex justify-center border-t border-hairline bg-paper/80 px-3 py-1.5">
            <button
              type="button"
              onClick={() => {
                const el = viewportRef.current;
                if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
                setStick(true);
              }}
              aria-label="Saltar al último mensaje"
              className="rounded-card border border-hairline bg-panel px-3 py-1.5 text-[11px] font-semibold text-ink shadow-sm transition-colors hover:bg-raised cursor-pointer"
            >
              ↓ Jump to latest
            </button>
          </div>
        )}

        {/* Skeleton de streaming con altura reservada (anti layout-shift, T02) */}
        {isStreaming && (
          <div
            data-testid="chat-streaming-skeleton"
            aria-busy="true"
            aria-label="Generando respuesta"
            className="mx-3 my-2 min-h-[56px] rounded-card border border-hairline bg-panel px-3.5 py-2.5"
          >
            <div className="h-2.5 w-2/3 animate-pulse rounded bg-hairline" />
            <div className="mt-2 h-2.5 w-1/2 animate-pulse rounded bg-hairline" />
          </div>
        )}

        {/* Actividad de tools inline (ToolExecutionCard interactiva, T02) */}
        {toolEvents.length > 0 && (
          <div
            data-testid="chat-tool-activity"
            role="status"
            aria-live="polite"
            className="max-h-48 overflow-y-auto border-t border-hairline px-3 py-1.5 font-mono text-[11px] text-dim space-y-1"
          >
            {toolEvents.map((t) => (
              <ToolExecutionCard
                key={t.callId ? `${t.kind}-${t.callId}-${t.seq}` : `${t.kind}-${t.toolName}-${t.seq}`}
                event={t}
              />
            ))}
          </div>
        )}

        {/* T19: badge de coste del turno actual (HERM-21). Solo si `usage` vino. */}
        {lastTurnUsage && (
          <div
            data-testid="chat-turn-cost"
            role="status"
            aria-live="polite"
            className="border-t border-hairline px-3 py-1.5 font-mono text-[11px] text-dim"
          >
            🪙 Último turno: {(lastTurnUsage.totalTokens ?? lastTurnUsage.promptTokens + lastTurnUsage.completionTokens).toLocaleString()} tokens
            {" "}({lastTurnUsage.promptTokens.toLocaleString()} prompt + {lastTurnUsage.completionTokens.toLocaleString()} respuesta)
            {" "}· ${lastTurnUsage.estimatedCostUsd.toFixed(4)}
          </div>
        )}

        {/* Tarjeta interactiva de Error de Turno con Reintento (CORE-14) */}
        {activeError && (
          <div className="flex items-center justify-between border-t border-rose-500/30 bg-rose-950/40 px-3.5 py-2 text-xs text-rose-200">
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <Warning size={15} className="text-rose-400 shrink-0" />
              <div className="truncate">
                <span className="font-semibold text-rose-300">Fallo en turno: </span>
                <span className="text-rose-100/90">{activeError.message}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleRetry}
                className="flex items-center gap-1 rounded bg-rose-500/20 px-2.5 py-1 min-h-[44px] text-[11px] font-semibold text-rose-200 hover:bg-rose-500/30 transition-colors"
              >
                <ArrowClockwise size={12} weight="bold" />
                <span>Reintentar</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveError(null)}
                aria-label="Cerrar advertencia"
                className="p-1 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-rose-400 hover:text-rose-200 transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Panel de Solicitudes de Aprobación HITL activas (ACT-07 / HERM-03 / OCLW-08) */}
        {pendingApprovals.length > 0 && (
          <div className="border-t border-hairline bg-raised/20 px-3.5 py-2 max-h-72 overflow-y-auto">
            {pendingApprovals.map((req) => (
              <ApprovalCard
                key={req.approvalId}
                request={req}
                onResolve={(decision) => handleResolveApproval(req.approvalId, decision)}
              />
            ))}
          </div>
        )}

        {/* Pastilla de contexto enfocado en Canvas (CANV-03 / CANV-04) */}
        {focusedContext && (
          <div className="flex items-center justify-between bg-raised/60 px-3 py-1.5 text-[11px] text-dim border-t border-hairline font-mono">
            <span className="truncate">
              Enfoque Canvas: <strong className="text-ink">{focusedContext.componentId}</strong>
              {focusedContext.excerpt ? ` — "${focusedContext.excerpt}"` : ""}
            </span>
          </div>
        )}

        {/* T08: menciones @ y slash / del borrador (FileMentionBadge + hint). */}
        {(draftMentions.length > 0 || draftSlash) && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-hairline px-3 pt-2" role="status" aria-live="polite">
            {draftMentions.map((path) => (
              <FileMentionBadge key={path} path={path} compact />
            ))}
            {draftSlash && (
              <span className="font-mono text-[11px] text-dim">
                {LOCAL_SLASH_COMMANDS.has(draftSlash)
                  ? `/${draftSlash} — comando local (no consume turno)`
                  : `/${draftSlash} — se enviará como texto al turno`}
              </span>
            )}
          </div>
        )}

        {/* CFG-12: adjuntos con permiso inline + cuarentena visible. */}
        {(attachments.length > 0 || attachError) && (
          <div
            data-testid="composer-attachments"
            role="status"
            aria-live="polite"
            className="flex flex-wrap items-center gap-1.5 border-t border-hairline px-3 pt-2"
          >
            {attachments.map((a) => (
              <span
                key={a.id}
                data-testid={a.quarantined ? "attachment-quarantined" : "attachment-chip"}
                title={a.quarantined ? `Cuarentena: ${a.reason ?? "bloqueado"}` : `${a.mime}, ${(a.size / 1024).toFixed(1)}KB`}
                className={`inline-flex items-center gap-1.5 rounded-card border border-hairline px-2 py-1 font-mono text-[11px] ${a.quarantined ? "bg-rose-950/40 text-rose-200" : "bg-panel text-ink"}`}
              >
                {a.dataUrl ? (
                  <img src={a.dataUrl} alt={a.name} className="h-4 w-4 rounded object-cover shrink-0" />
                ) : (
                  <span>{a.quarantined ? "⛔" : "📎"}</span>
                )}
                <span className="truncate max-w-[120px]">{a.name}</span>
                <span className="text-dim">·{a.permission}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(a.id)}
                  aria-label={`Quitar adjunto ${a.name}`}
                  className="ml-1 rounded p-0.5 hover:bg-raised cursor-pointer"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
            {attachError && <span className="font-mono text-[11px] text-rose-300">{attachError}</span>}
          </div>
        )}

        {/* Floating Capsule Composer */}
        <div className="relative p-2.5">
          {/* Autocompletado @archivo popover */}
          {mentionQuery !== null && filteredSuggestions.length > 0 && (
            <div className="absolute bottom-full mb-2 left-3 z-30 w-72 rounded-xl border border-hairline bg-panel/95 shadow-xl backdrop-blur-md p-1.5 text-xs font-mono">
              <div className="px-2 py-1 text-[10px] text-faint border-b border-hairline mb-1 font-sans font-medium flex items-center justify-between">
                <span>Mencionar archivo</span>
                <span className="text-[9px] text-dim">click para insertar</span>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-0.5">
                {filteredSuggestions.map((path) => (
                  <button
                    key={path}
                    type="button"
                    onClick={() => handleSelectMention(path)}
                    className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-raised text-ink text-[11px] flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="truncate">{path}</span>
                    <span className="text-[10px] text-faint ml-2 shrink-0">@</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <ComposerPrimitive.Root className="flex flex-col gap-2 rounded-2xl border border-hairline bg-panel/95 shadow-xl backdrop-blur-md p-3">
            {/* Nivel 1: Input ocupando el 100% del ancho, rows={2}, font-sans text-[13.5px] leading-relaxed */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              aria-label="Adjuntar archivos"
              data-testid="composer-file-input"
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <div ref={composerWrapRef} onInput={handleComposerInput} className="w-full">
              <ComposerPrimitive.Input
                submitMode="ctrlEnter"
                rows={2}
                placeholder="Pregunta o instruye a Ego… (@archivo · /help · Ctrl+Enter envía)"
                className="w-full bg-transparent border-0 p-1 text-ink font-sans text-[13.5px] leading-relaxed placeholder:text-faint focus:outline-none focus:ring-0 resize-none max-h-48 overflow-y-auto"
              />
            </div>

            {/* Nivel 2: Barra de herramientas inferior interna */}
            <div className="flex items-center justify-between pt-1 border-t border-hairline/40 gap-2">
              {/* Izquierda: Herramientas (+, @) y controles de voz compactos sin checkboxes cuadrados */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Adjuntar archivos"
                  title="Adjuntar archivos o imágenes"
                  data-testid="composer-attach-button"
                  className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg border border-hairline/80 bg-raised/60 hover:bg-raised text-faint hover:text-ink text-sm font-semibold transition-colors cursor-pointer"
                >
                  ＋
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const ta = composerWrapRef.current?.querySelector("textarea");
                    if (ta) {
                      ta.value = ta.value + "@";
                      ta.dispatchEvent(new Event("input", { bubbles: true }));
                      ta.focus();
                    }
                  }}
                  title="Mencionar archivo del proyecto (@)"
                  aria-label="Mencionar archivo"
                  className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg border border-hairline/80 bg-raised/60 hover:bg-raised text-faint hover:text-ink text-xs font-mono transition-colors cursor-pointer"
                >
                  @
                </button>

                {/* Controles de voz integrados con inputs sr-only para tests */}
                <div data-testid="voice-controls" className="flex items-center gap-1 ml-1 text-xs">
                  <label
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-sans transition-all cursor-pointer border ${
                      voice.ttsOptIn
                        ? "bg-brand/15 text-brand border-brand/30 font-medium"
                        : "bg-raised/40 text-faint border-hairline/60 hover:text-ink hover:bg-raised"
                    }`}
                    title="Leer respuestas en voz alta (opt-in)"
                  >
                    <input
                      type="checkbox"
                      checked={voice.ttsOptIn}
                      onChange={(e) => voice.setTtsOptIn(e.target.checked)}
                      aria-label="Leer respuestas en voz alta (opt-in)"
                      className="sr-only"
                    />
                    <span>🔊</span>
                    <span className="hidden sm:inline">Voz</span>
                  </label>

                  {voice.ttsOptIn && (
                    <button
                      type="button"
                      onClick={() => {
                        void voice.speak(lastAssistantRef.current);
                      }}
                      disabled={!voice.ttsEnabled || lastAssistantRef.current.length === 0}
                      aria-label="Leer última respuesta en voz alta"
                      title="Lee la última respuesta"
                      data-testid="voice-read-button"
                      className="min-h-[44px] inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-sans border border-hairline bg-raised/50 hover:bg-raised text-faint hover:text-ink transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <span>▶️</span>
                      <span className="hidden sm:inline">Leer última</span>
                    </button>
                  )}

                  <label
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-sans transition-all cursor-pointer border ${
                      voice.disableVoice
                        ? "bg-rose-950/40 text-rose-300 border-rose-800/40 font-medium"
                        : "bg-raised/40 text-faint border-hairline/60 hover:text-ink hover:bg-raised"
                    }`}
                    title="Desactivar toda la voz (kill switch)"
                  >
                    <input
                      type="checkbox"
                      checked={voice.disableVoice}
                      onChange={(e) => handleVoiceKillSwitch(e.target.checked)}
                      aria-label="Desactivar toda la voz (kill switch)"
                      data-testid="voice-killswitch"
                      className="sr-only"
                    />
                    <span>⛔</span>
                    <span className="hidden sm:inline">Silenciar</span>
                  </label>
                </div>
              </div>

              {/* Derecha: Dictado de voz + botón Enviar / Cancelar */}
              <div className="flex items-center gap-2">
                <VoiceButton
                  captureState={voice.captureState}
                  disabled={!voice.sttEnabled}
                  onToggleDictation={voice.toggleDictation}
                />
                <AnimatePresence mode="wait" initial={false}>
                  {isStreaming ? (
                    <motion.button
                      key="composer-cancel"
                      layoutId="composer-action"
                      initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={composerTransition}
                      type="button"
                      onClick={handleCancel}
                      aria-label="Cancelar turno en curso"
                      title="Cancelar turno (Esc)"
                      className="min-h-[44px] min-w-[44px] flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-medium text-xs shadow-sm cursor-pointer transition-colors"
                    >
                      <span className="text-[10px]">■</span>
                      <span>Cancelar</span>
                    </motion.button>
                  ) : (
                    <motion.span
                      key="composer-send"
                      layoutId="composer-action"
                      initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={composerTransition}
                      className="inline-flex"
                    >
                      <ComposerPrimitive.Send
                        aria-label="Enviar mensaje"
                        className="min-h-[44px] min-w-[44px] flex items-center gap-1.5 px-3.5 py-2 bg-ink text-paper hover:opacity-90 rounded-xl font-medium text-xs shadow-sm cursor-pointer transition-all"
                      >
                        <span className="font-bold text-[13px] leading-none">↑</span>
                        <span>Enviar</span>
                      </ComposerPrimitive.Send>
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </ComposerPrimitive.Root>
        </div>

        {/* Aviso de privacidad accesible para tests sin ensuciar la UI */}
        <div className="sr-only">
          <VoicePrivacyNotice />
        </div>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}
