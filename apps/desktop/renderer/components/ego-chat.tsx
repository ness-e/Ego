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
import {
  Warning,
  X,
  ArrowClockwise,
  ArrowCounterClockwise,
  DownloadSimple,
  Paperclip,
  Books,
  Globe,
  Flask,
  ChartBar,
  Robot,
  CaretDown,
  Check,
  Sparkle,
  Lightning,
  ShieldCheck,
} from "@phosphor-icons/react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Virtualizer } from "virtua";
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
 * para que el navegador omita layout/paint fuera del viewport.
 */
function UserMessageInner() {
  const { onRewind } = useContext(ChatActionsContext);
  const messageId = useAuiState((s) => (s as unknown as { message?: { id?: string } }).message?.id);

  return (
    <MessagePrimitive.Root
      className="flex justify-end my-2"
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 96px" }}
    >
      <div className="max-w-[min(82%,600px)] bg-hairline text-ink rounded-2xl px-4 py-2.5 shadow-sm">
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
            className="rounded-lg p-1 transition-colors hover:bg-raised hover:text-ink cursor-pointer"
          />
          {messageId && onRewind && (
            <button
              type="button"
              onClick={() => onRewind(messageId)}
              aria-label="Rebobinar aquí"
              title="Rebobinar historial hasta este turno"
              className="rounded-lg p-1 text-[11px] font-mono flex items-center gap-1 transition-colors hover:bg-raised hover:text-ink cursor-pointer"
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
      className="flex my-3 gap-3 items-start"
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 140px" }}
    >
      {/* Recuadro de Avatar de 44x44px de alta calidad */}
      <div className="w-11 h-11 rounded-2xl bg-[#13151f] border border-white/10 p-0.5 shadow-md flex items-center justify-center shrink-0">
        <CharacterBadge
          size={40}
          subEgoId={subEgoId}
          state={isLast ? (avatarLiveState ?? "idle") : "idle"}
          animated={isLast && Boolean(isStreaming)}
        />
      </div>
      <div className="min-w-0 flex-1 px-3.5 py-1 text-ink">
        <div className="flex items-center gap-1.5 mb-1.5 font-sans">
          <span className="text-[12px] font-semibold text-ink">{subEgoId}</span>
          <span className="rounded-full bg-raised/80 border border-hairline px-2 py-0.2 text-[9.5px] font-mono text-dim">
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
            className="rounded-lg p-1 transition-colors hover:bg-raised hover:text-ink cursor-pointer"
          />
          <ActionBarPrimitive.Reload
            aria-label="Regenerar respuesta"
            className="rounded-lg p-1 transition-colors hover:bg-raised hover:text-ink cursor-pointer"
          />
          {messageId && onRewind && (
            <button
              type="button"
              onClick={() => onRewind(messageId)}
              aria-label="Rebobinar aquí"
              title="Rebobinar historial hasta este turno"
              className="rounded-lg p-1 text-[11px] font-mono flex items-center gap-1 transition-colors hover:bg-raised hover:text-ink cursor-pointer"
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
              className="rounded-lg p-1 min-h-[44px] min-w-[44px] inline-flex items-center justify-center transition-colors hover:bg-raised hover:text-ink cursor-pointer"
            >
              <ArrowClockwise size={13} />
            </button>
          )}
        </ActionBarPrimitive.Root>
      </div>
    </MessagePrimitive.Root>
  );
}

const AssistantMessage = memo(
  AssistantMessageInner,
  (prev, next) => prev.subEgoId === next.subEgoId && prev.onRetry === next.onRetry
);
AssistantMessage.displayName = "AssistantMessage";

export type Msg = {
  id: string;
  role: "user" | "assistant";
  content: [{ type: "text"; text: string }];
  recall?: RecallBadgeInfo;
  isError?: boolean;
};

/**
 * T21 (PERF-VIRTUA) / UI-05: Virtualización con virtua por encima de umbral.
 *
 * Decisión arquitectónica (@assistant-ui 0.15 + virtua):
 * 1. ThreadPrimitive.Messages de @assistant-ui no admite contenedor externo ni virtualización
 *    nativa directa sin romper la jerarquía del ThreadViewport.
 * 2. VList crea un div contenedor con scroll propio (overflowY: auto), lo que generaría doble scrollbar
 *    anidado dentro de ThreadPrimitive.Viewport, rompiendo el scroll-lock inteligente, el ancla y
 *    las mediciones de tamaño.
 * 3. En hilos cortos (<= 60 mensajes), React y los navegadores modernos gestionan el árbol sin jank,
 *    aprovechando content-visibility: auto + contain-intrinsic-size ya presentes por turno.
 * 4. Happy-DOM (entorno de pruebas vitest) no calcula layout (alturas y scrollHeight son 0),
 *    por lo que un Virtualizer incondicional en hilos cortos rompería todas las suites de tests.
 * 5. Por tanto, aplicamos virtualización con Virtualizer (asociado a scrollRef={viewportRef})
 *    SOLO cuando messageCount > threshold (por defecto 60), manteniendo el render nativo
 *    para hilos cortos.
 * 6. Con keepMounted={[messages.length - 1]}, el último mensaje (turno activo / streaming)
 *    permanece SIEMPRE montado en el DOM, garantizando que el streaming no se interrumpa.
 */
export const CHAT_VIRTUALIZATION_THRESHOLD = 60;

export function shouldVirtualizeChat(
  messageCount: number,
  threshold: number = CHAT_VIRTUALIZATION_THRESHOLD
): boolean {
  return messageCount > threshold;
}

export function getChatKeepMountedIndices(messagesLength: number): readonly number[] {
  return messagesLength > 0 ? [messagesLength - 1] : [];
}

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

export function firstTokenLatencyMs(m: Cfg11PaintMarks): number | null {
  return m.tFirst === null ? null : m.tFirst - m.tSend;
}

export function inputToPaintMs(m: Cfg11PaintMarks): number | null {
  return m.tPaint === null ? null : m.tPaint - m.tSend;
}

async function getByokBlockReason(): Promise<string | null> {
  let cfg: ModelConfigInfo;
  try {
    cfg = await ego().settings.getModelConfig();
  } catch {
    return null;
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

function formatModelName(id: string): string {
  const lower = id.toLowerCase();
  if (lower.includes("3-7-sonnet") || lower.includes("3.7-sonnet")) return "Claude 3.7 Sonnet";
  if (lower.includes("3-5-sonnet") || lower.includes("3.5-sonnet") || lower.includes("sonnet-4")) return "Claude 3.5 Sonnet";
  if (lower.includes("3-5-haiku") || lower.includes("3.5-haiku")) return "Claude 3.5 Haiku";
  if (lower.includes("gemini-2.5-pro") || lower.includes("gemini-pro")) return "Gemini 2.5 Pro";
  if (lower.includes("gemini-2.5-flash") || lower.includes("gemini-3.8-flash") || lower.includes("gemini-flash")) return "Gemini Flash";
  if (lower.includes("gpt-4o-mini")) return "GPT-4o Mini";
  if (lower.includes("gpt-4o")) return "GPT-4o";
  if (lower.includes("o3-mini")) return "o3 Mini";
  if (lower.includes("deepseek-reasoner") || lower.includes("r1")) return "DeepSeek R1";
  if (lower.includes("deepseek-chat")) return "DeepSeek Chat";
  if (lower.includes("llama")) return "Llama 3.2 Local";
  if (lower.includes("qwen")) return "Qwen 2.5 Local";
  return id.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface EgoChatProps {
  projectId?: string;
  subEgoId?: string;
  sessionId?: string | null;
  initialMessages?: Msg[];
  virtualizationThreshold?: number;
}

export function EgoChat({
  projectId,
  subEgoId,
  sessionId,
  initialMessages,
  virtualizationThreshold,
}: EgoChatProps = {}) {
  const [messages, setMessages] = useState<Msg[]>(() => initialMessages ?? []);
  const [latestRecall, setLatestRecall] = useState<RecallBadgeInfo | null>(null);
  const [activeError, setActiveError] = useState<ActiveChatError | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalInfo[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [toolEvents, setToolEvents] = useState<ToolActivity[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [stick, setStick] = useState(true);

  const pendingStreamRef = useRef<Map<string, string>>(new Map());
  const streamRafRef = useRef<number | null>(null);
  const toolSeqRef = useRef(0);
  const paintMarksRef = useRef<Cfg11PaintMarks | null>(null);
  const stickRafRef = useRef<number | null>(null);

  const [lastTurnUsage, setLastTurnUsage] = useState<TurnUsage | null>(null);
  const [draftMentions, setDraftMentions] = useState<string[]>([]);
  const [draftSlash, setDraftSlash] = useState<string | null>(null);
  const [composerText, setComposerText] = useState("");

  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const composerWrapRef = useRef<HTMLDivElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  // Estados de controles del Composer (Estilo inicio claude.png + Inicio.png + Boton de mas.png)
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isEffortMenuOpen, setIsEffortMenuOpen] = useState(false);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [isSubEgoMenuOpen, setIsSubEgoMenuOpen] = useState(false);

  const [selectedModel, setSelectedModel] = useState<string>("claude-3-7-sonnet");
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string; provider: string }>>([
    { id: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet", provider: "anthropic" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "google" },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "google" },
    { id: "gpt-4o", name: "GPT-4o", provider: "openai" },
    { id: "deepseek-r1", name: "DeepSeek R1", provider: "deepseek" },
  ]);
  const [reasoningEffort, setReasoningEffort] = useState<"auto" | "low" | "medium" | "high">("auto");
  const [executionMode, setExecutionMode] = useState<"manual" | "auto">("manual");
  const [availableSubEgos, setAvailableSubEgos] = useState<Array<{ id: string; name: string }>>([
    { id: "ego.nucleus", name: "Ego Núcleo" },
    { id: "ego.dev", name: "Sub-Ego Dev" },
    { id: "ego.copywriter", name: "Ego Copywriter" },
  ]);

  const plusMenuRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const effortMenuRef = useRef<HTMLDivElement>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const subEgoMenuRef = useRef<HTMLDivElement>(null);

  // Carga de modelos disponibles desde el bridge
  useEffect(() => {
    let cancelled = false;
    async function initCatalog() {
      try {
        const provRes = await ego().models?.listProviders?.();
        const configuredProviders = provRes?.providers?.filter((p) => p.configured) ?? [];
        const loaded: Array<{ id: string; name: string; provider: string }> = [];

        for (const prov of configuredProviders) {
          if (prov.id === "mock") continue;
          try {
            const mRes = await ego().models?.listModels?.({ provider: prov.id as "openai" | "anthropic" | "google" | "deepseek" | "ollama" });
            if (mRes && mRes.models) {
              for (const m of mRes.models) {
                loaded.push({ id: m, name: formatModelName(m), provider: prov.id });
              }
            }
          } catch {
            // Ignorar fallos de red por proveedor
          }
        }

        if (!cancelled && loaded.length > 0) {
          setAvailableModels(loaded);
          const first = loaded[0];
          if (first) {
            setSelectedModel(first.id);
          }
        }

        // Cargar Sub-Egos
        const subRes = await ego().subegos?.list?.();
        if (!cancelled && subRes && subRes.length > 0) {
          setAvailableSubEgos(subRes.map((s) => ({ id: s.id, name: s.name })));
        }
      } catch {
        // Fallback activo sin romper
      }
    }
    void initCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cierre de menús flotantes al hacer clic afuera o presionar Escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (plusMenuRef.current && !plusMenuRef.current.contains(target)) {
        setIsPlusMenuOpen(false);
      }
      if (modelMenuRef.current && !modelMenuRef.current.contains(target)) {
        setIsModelMenuOpen(false);
      }
      if (effortMenuRef.current && !effortMenuRef.current.contains(target)) {
        setIsEffortMenuOpen(false);
      }
      if (modeMenuRef.current && !modeMenuRef.current.contains(target)) {
        setIsModeMenuOpen(false);
      }
      if (subEgoMenuRef.current && !subEgoMenuRef.current.contains(target)) {
        setIsSubEgoMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsPlusMenuOpen(false);
        setIsModelMenuOpen(false);
        setIsEffortMenuOpen(false);
        setIsModeMenuOpen(false);
        setIsSubEgoMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const handleSelectModel = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    setIsModelMenuOpen(false);
    try {
      const win = window as unknown as { ego?: { models?: { setActiveModel?: (m: string) => void }; settings?: { setConfig?: (c: { key: string; value: unknown }) => void } } };
      win.ego?.models?.setActiveModel?.(modelId);
      win.ego?.settings?.setConfig?.({ key: "defaultModel", value: modelId });
    } catch {
      // Ignorar
    }
  }, []);

  const handleSelectEffort = useCallback((eff: "auto" | "low" | "medium" | "high") => {
    setReasoningEffort(eff);
    setIsEffortMenuOpen(false);
    try {
      const win = window as unknown as { ego?: { settings?: { setConfig?: (c: { key: string; value: unknown }) => void } } };
      win.ego?.settings?.setConfig?.({ key: "reasoningEffort", value: eff });
    } catch {
      // Ignorar
    }
  }, []);

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
  const lastAssistantRef = useRef<string>("");

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

  useEffect(() => {
    let cancelled = false;
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

  const reduceMotion = useReducedMotion();
  const composerTransition = reduceMotion ? { duration: 0 } : { duration: MOTION.micro };

  useEffect(() => {
    if (!sessionId) {
      if (initialMessages) {
        setMessages(initialMessages);
      } else {
        setMessages([]);
      }
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
  }, [sessionId, initialMessages]);

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
      streamRafRef.current = -1;
      queueMicrotask(() => {
        flushStreamBuffer();
      });
    }
  }, [flushStreamBuffer]);

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

  const appendStreamText = useCallback(
    (id: string, text: string) => {
      if (!text) return;
      const prev = pendingStreamRef.current.get(id) ?? "";
      pendingStreamRef.current.set(id, prev + text);
      scheduleStreamFlush();
    },
    [scheduleStreamFlush]
  );

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    const bridge = ego();

    if (bridge.onChatDelta) {
      unsubs.push(
        bridge.onChatDelta((chunk: { type: string; delta?: string }) => {
          const target = streamTargetRef.current;
          if (!target) return;
          const c = chunk as ChatDeltaChunk;
          const marks = paintMarksRef.current;
          const firstText = c.delta ?? c.text ?? "";
          if (marks && marks.tFirst === null && firstText) {
            marks.tFirst = performance.now();
            const snapshot = marks;
            const turn = target;
            const capture = () => {
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
    const fullPrompt = buildPromptWithAttachments(promptText, attachments);
    const promptTextEffective = fullPrompt;
    setAttachments([]);
    setAttachError(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    currentPromptRef.current = promptTextEffective;
    setActiveError(null);
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
    streamTargetRef.current = a;
    setIsStreaming(true);
    paintMarksRef.current = createPaintMarks(performance.now());

    try {
      const streamRes = await ego().llmStream({
        prompt: promptTextEffective,
        projectId,
        subEgoId,
        ...(sessionId ? { sessionId } : {}),
      });
      if ((streamRes as { status?: string }).status === "aborted") {
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
      setLastTurnUsage(toTurnUsage(streamRes.usage, streamRes.turnId));

      const finalReply = streamRes.text;
      const isSimulated = streamRes.text.startsWith("[MockResponse");
      const visibleReply = isSimulated
        ? `⚠️ Respuesta simulada (el proveedor falló; revisá tu key y el modelo en Ajustes).\n\n${finalReply}`
        : finalReply;
      lastAssistantRef.current = visibleReply;

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
      if (abortRef.current === ctrl) abortRef.current = null;
      setIsStreaming(false);
    }
  }, [projectId, subEgoId, sessionId, attachments]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    streamTargetRef.current = null;
    paintMarksRef.current = null;
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

  useEffect(() => {
    const unsub = onAction((act) => {
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

  const effortLabels: Record<string, string> = {
    auto: "Auto",
    low: "Bajo",
    medium: "Medio",
    high: "Alto",
  };

  const currentModelDisplayName = useMemo(() => {
    const found = availableModels.find((m) => m.id === selectedModel);
    return found ? found.name : formatModelName(selectedModel);
  }, [availableModels, selectedModel]);

  const assistantMessageComponent = useCallback(
    () => <AssistantMessage subEgoId={subEgoId ?? "ego.nucleus"} onRetry={handleRetry} />,
    [subEgoId, handleRetry]
  );

  const messageComponents = useMemo(
    () => ({
      UserMessage,
      AssistantMessage: assistantMessageComponent,
    }),
    [assistantMessageComponent]
  );

  const threshold = virtualizationThreshold ?? CHAT_VIRTUALIZATION_THRESHOLD;
  const isVirtualized = shouldVirtualizeChat(messages.length, threshold);
  const keepMountedIndices = useMemo(
    () => getChatKeepMountedIndices(messages.length),
    [messages.length]
  );

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="h-full flex flex-col">
        {/* Cabecera del Chat con Avatar de size 36 y acción discreta */}
        <div className="flex items-center justify-between border-b border-hairline px-4 py-2 text-xs bg-panel/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#13151f] border border-white/10 flex items-center justify-center p-0.5 shadow-sm">
              <CharacterBadge
                subEgoId={subEgoId ?? "ego.nucleus"}
                size={36}
                state={avatarLiveState}
                animated={avatarLiveState !== "idle"}
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-ink text-[12.5px]">Ego Chat</span>
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 text-[9px] font-mono text-emerald-400">
                  En línea
                </span>
              </div>
              <span className="text-[10.5px] text-faint font-mono">
                {subEgoId ?? "ego.nucleus"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={exportConversationMarkdown}
              aria-label="Exportar conversación a Markdown"
              title="Exportar conversación actual (.md)"
              disabled={messages.length === 0}
              className="flex items-center gap-1.5 rounded-xl border border-hairline bg-raised/50 px-2.5 py-1.5 text-[11px] font-medium text-faint hover:text-ink hover:bg-raised transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <DownloadSimple size={13} />
              <span className="hidden sm:inline">Exportar (.md)</span>
            </button>
          </div>
        </div>

        {/* Banner de Memoria Activa */}
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
          {/* Estado Inicial Sereno (¿Por dónde empezamos? + Avatar de Estudio Grande) */}
          <ThreadPrimitive.Empty>
            <div className="h-full min-h-[440px] flex flex-col items-center justify-center p-6 text-center text-faint max-w-2xl w-full mx-auto my-auto select-none">
              {/* Recuadro de estudio grande de alta calidad */}
              <div className="w-28 h-28 rounded-3xl bg-[#13151f] border border-white/10 shadow-2xl flex items-center justify-center mx-auto mb-5 p-2 transition-transform hover:scale-105 duration-300">
                <CharacterBadge
                  subEgoId={subEgoId ?? "ego.nucleus"}
                  size={104}
                  state={avatarLiveState}
                  animated
                />
              </div>

              {/* Título principal limpio y subtítulo canónico exacto */}
              <h1 className="text-2xl sm:text-3xl font-semibold text-ink tracking-tight mb-1.5 font-sans">
                ¿Por dónde empezamos?
              </h1>
              <p className="font-sans text-[13px] text-faint mb-8 font-medium">
                Cerebro Operativo de Ego · Inteligencia, memoria y ejecución local
              </p>

              {/* 3–4 filas de sugerencias limpias con icono sutil */}
              <div className="w-full max-w-lg space-y-2.5 mb-2">
                {[
                  {
                    icon: "🖼️",
                    title: "Proyectar un dashboard o tabla en el Canvas",
                    desc: "Crea visualizaciones interactivas y tablas de datos",
                    prompt: "Proyecta en Canvas un dashboard interactivo con tablas y gráficos",
                  },
                  {
                    icon: "✏️",
                    title: "Analizar arquitectura y revisar código del proyecto",
                    desc: "Inspecciona dependencias, estructura y áreas de mejora",
                    prompt: "Analiza la arquitectura del proyecto y revisa el código fuente actual",
                  },
                  {
                    icon: "🌐",
                    title: "Buscar en memoria VantaDB o investigar en la web",
                    desc: "Consulta hechos persistentes y conocimiento conectado",
                    prompt: "Busca en la memoria VantaDB las decisiones clave del proyecto",
                  },
                  {
                    icon: "🤖",
                    title: "Delegar una tarea a un Sub-Ego especialista",
                    desc: "Asigna tareas a ingenieros, investigadores o redactores",
                    prompt: "Delega la tarea a un Sub-Ego especialista",
                  },
                ].map((starter) => (
                  <button
                    key={starter.title}
                    type="button"
                    onClick={() => fillComposer(starter.prompt)}
                    className="group w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl border border-white/5 bg-[#18181b]/40 hover:bg-[#202024] hover:border-white/15 transition-all text-left shadow-sm cursor-pointer"
                  >
                    <span className="text-xl shrink-0 group-hover:scale-110 transition-transform">
                      {starter.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-[13px] text-ink group-hover:text-brand transition-colors truncate">
                        {starter.title}
                      </div>
                      <div className="text-[11.5px] text-faint truncate mt-0.5">
                        {starter.desc}
                      </div>
                    </div>
                    <span className="text-faint/60 group-hover:text-ink text-sm transition-colors shrink-0">
                      →
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
            {isVirtualized ? (
              <Virtualizer
                scrollRef={viewportRef}
                data={messages}
                keepMounted={keepMountedIndices}
                itemSize={120}
              >
                {(msg, index) => (
                  <div
                    key={msg.id}
                    data-testid="chat-message-turn"
                    data-message-id={msg.id}
                    data-role={msg.role}
                    style={{
                      contentVisibility: "auto",
                      containIntrinsicSize: msg.role === "user" ? "auto 96px" : "auto 140px",
                    }}
                  >
                    <ThreadPrimitive.MessageByIndex
                      index={index}
                      components={messageComponents}
                    />
                  </div>
                )}
              </Virtualizer>
            ) : (
              <ThreadPrimitive.Messages
                components={messageComponents}
              />
            )}
          </ChatActionsContext.Provider>
        </ThreadPrimitive.Viewport>

        {/* Jump to latest */}
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
              className="rounded-xl border border-hairline bg-panel px-3 py-1.5 text-[11px] font-semibold text-ink shadow-sm transition-colors hover:bg-raised cursor-pointer"
            >
              ↓ Jump to latest
            </button>
          </div>
        )}

        {/* Skeleton de streaming */}
        {isStreaming && (
          <div
            data-testid="chat-streaming-skeleton"
            aria-busy="true"
            aria-label="Generando respuesta"
            className="mx-3 my-2 min-h-[56px] rounded-2xl border border-hairline bg-panel px-3.5 py-2.5"
          >
            <div className="h-2.5 w-2/3 animate-pulse rounded bg-hairline" />
            <div className="mt-2 h-2.5 w-1/2 animate-pulse rounded bg-hairline" />
          </div>
        )}

        {/* Actividad de tools inline */}
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

        {/* Badge de coste de turno */}
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

        {/* Error interactivo */}
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
                className="flex items-center gap-1 rounded-xl bg-rose-500/20 px-2.5 py-1 min-h-[44px] text-[11px] font-semibold text-rose-200 hover:bg-rose-500/30 transition-colors cursor-pointer"
              >
                <ArrowClockwise size={12} weight="bold" />
                <span>Reintentar</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveError(null)}
                aria-label="Cerrar advertencia"
                className="p-1 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-rose-400 hover:text-rose-200 transition-colors cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Aprobaciones HITL */}
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

        {/* Enfoque Canvas */}
        {focusedContext && (
          <div className="flex items-center justify-between bg-raised/60 px-3 py-1.5 text-[11px] text-dim border-t border-hairline font-mono">
            <span className="truncate">
              Enfoque Canvas: <strong className="text-ink">{focusedContext.componentId}</strong>
              {focusedContext.excerpt ? ` — "${focusedContext.excerpt}"` : ""}
            </span>
          </div>
        )}

        {/* Menciones @ y /comandos */}
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

        {/* Adjuntos del composer */}
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
                className={`inline-flex items-center gap-1.5 rounded-xl border border-hairline px-2.5 py-1 font-mono text-[11px] ${a.quarantined ? "bg-rose-950/40 text-rose-200" : "bg-panel text-ink"}`}
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

        {/* Composer Flotante tipo Cápsula Elegante (Estilo Claude / Inicio.png) */}
        <div className="relative p-3">
          {/* Autocompletado @archivo popover */}
          {mentionQuery !== null && filteredSuggestions.length > 0 && (
            <div className="absolute bottom-full mb-2 left-3 z-30 w-72 rounded-2xl border border-hairline bg-panel/95 shadow-xl backdrop-blur-md p-1.5 text-xs font-mono">
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

          {/* Menú flotante desplegable del botón + (Idéntico a Boton de mas.png) */}
          {isPlusMenuOpen && (
            <div
              ref={plusMenuRef}
              className="absolute bottom-full mb-3 left-3 z-50 w-80 rounded-2xl bg-[#202024] border border-white/10 shadow-2xl p-1.5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="px-3 py-1.5 text-[10.5px] font-medium text-faint border-b border-white/5 mb-1 flex items-center justify-between">
                <span>Acciones y adjuntos</span>
                <span className="text-[9.5px] text-dim font-mono">Ego SOC</span>
              </div>
              <div className="space-y-0.5">
                {[
                  {
                    icon: <Paperclip size={16} className="text-sky-400" />,
                    title: "Agregar fotos y archivos",
                    desc: "Cargar desde la computadora",
                    action: () => {
                      setIsPlusMenuOpen(false);
                      fileInputRef.current?.click();
                    },
                  },
                  {
                    icon: <Books size={16} className="text-amber-400" />,
                    title: "Agregar desde la biblioteca",
                    desc: "Explora y menciona archivos (@)",
                    action: () => {
                      setIsPlusMenuOpen(false);
                      const ta = composerWrapRef.current?.querySelector("textarea");
                      if (ta) {
                        ta.value = ta.value ? `${ta.value} @` : "@";
                        ta.dispatchEvent(new Event("input", { bubbles: true }));
                        ta.focus();
                      }
                    },
                  },
                  {
                    icon: <Globe size={16} className="text-emerald-400" />,
                    title: "Busca en la web",
                    desc: "Información en tiempo real",
                    action: () => {
                      setIsPlusMenuOpen(false);
                      fillComposer("Busca en la web sobre ");
                    },
                  },
                  {
                    icon: <Flask size={16} className="text-violet-400" />,
                    title: "Investigación profunda",
                    desc: "Obtén un informe detallado con VantaDB",
                    action: () => {
                      setIsPlusMenuOpen(false);
                      fillComposer("Investiga a fondo en VantaDB ");
                    },
                  },
                  {
                    icon: <ChartBar size={16} className="text-rose-400" />,
                    title: "Proyectar en Canvas",
                    desc: "Crea tablas, gráficos o artefactos interactivos",
                    action: () => {
                      setIsPlusMenuOpen(false);
                      fillComposer("Proyecta en Canvas un dashboard interactivo de ");
                    },
                  },
                  {
                    icon: <Robot size={16} className="text-cyan-400" />,
                    title: "Delegar a especialista",
                    desc: "Asigna la tarea a un Sub-Ego",
                    action: () => {
                      setIsPlusMenuOpen(false);
                      fillComposer("@investigador ");
                    },
                  },
                ].map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={item.action}
                    className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-white/5 text-left transition-colors cursor-pointer group"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/5 group-hover:border-white/10">
                      {item.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-medium text-white group-hover:text-white/90">
                        {item.title}
                      </div>
                      <div className="text-[10.5px] text-faint group-hover:text-dim truncate">
                        {item.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <ComposerPrimitive.Root className="flex flex-col gap-2 rounded-3xl border border-white/10 bg-[#161822]/90 shadow-2xl backdrop-blur-xl p-3.5 transition-all focus-within:border-white/20">
            {/* Input de archivo montado para tests */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              aria-label="Adjuntar archivos"
              data-testid="composer-file-input"
              className="sr-only"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />

            {/* Nivel 1: Textarea espaciosa y legible */}
            <div ref={composerWrapRef} onInput={handleComposerInput} className="w-full">
              <ComposerPrimitive.Input
                submitMode="ctrlEnter"
                rows={2}
                placeholder="Pregunta o instruye a Ego… (@archivo · /help · Ctrl+Enter envía)"
                className="w-full bg-transparent border-0 p-1 text-ink font-sans text-[14px] leading-relaxed placeholder:text-faint/70 focus:outline-none focus:ring-0 resize-none max-h-48 overflow-y-auto"
              />
            </div>

            {/* Nivel 2: Barra de herramientas inferior con selectores (Estilo Claude) */}
            <div className="flex items-center justify-between pt-2 border-t border-white/5 gap-2 flex-wrap">
              {/* Izquierda: Herramientas (+, @, Sub-Ego) */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsPlusMenuOpen((prev) => !prev)}
                  aria-label="Adjuntar archivos"
                  aria-expanded={isPlusMenuOpen}
                  title="Acciones y adjuntos (+)"
                  data-testid="composer-attach-button"
                  className={`min-h-[34px] min-w-[34px] flex items-center justify-center rounded-xl border transition-all cursor-pointer ${
                    isPlusMenuOpen
                      ? "bg-white/15 text-white border-white/20"
                      : "border-white/10 bg-white/5 hover:bg-white/10 text-faint hover:text-ink"
                  }`}
                >
                  <span className="text-base font-semibold leading-none">＋</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const ta = composerWrapRef.current?.querySelector("textarea");
                    if (ta) {
                      ta.value = ta.value ? `${ta.value} @` : "@";
                      ta.dispatchEvent(new Event("input", { bubbles: true }));
                      ta.focus();
                    }
                  }}
                  title="Mencionar archivo del proyecto (@)"
                  aria-label="Mencionar archivo"
                  className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-faint hover:text-ink text-xs font-mono transition-all cursor-pointer"
                >
                  @
                </button>

                {/* Selector de Sub-Ego */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsSubEgoMenuOpen((prev) => !prev)}
                    className="min-h-[34px] px-2.5 flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-ink text-[11.5px] font-medium transition-all cursor-pointer"
                  >
                    <span className="text-cyan-400">🤖</span>
                    <span className="truncate max-w-[95px]">{subEgoId ?? "ego.nucleus"}</span>
                    <CaretDown size={11} className="text-faint" />
                  </button>
                  {isSubEgoMenuOpen && (
                    <div
                      ref={subEgoMenuRef}
                      className="absolute bottom-full mb-2 left-0 z-40 w-56 rounded-2xl bg-[#202024] border border-white/10 shadow-2xl p-1.5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
                    >
                      <div className="px-2.5 py-1 text-[10px] text-faint border-b border-white/5 mb-1 font-medium">
                        Sub-Ego Activo
                      </div>
                      {availableSubEgos.map((se) => (
                        <button
                          key={se.id}
                          type="button"
                          onClick={() => {
                            setIsSubEgoMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                            se.id === (subEgoId ?? "ego.nucleus")
                              ? "bg-white/10 text-white font-medium"
                              : "text-faint hover:text-ink hover:bg-white/5"
                          }`}
                        >
                          <span className="truncate">{se.name}</span>
                          {se.id === (subEgoId ?? "ego.nucleus") && (
                            <Check size={12} className="text-brand shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Derecha: Selector de Modelo (SOLO disponibles), Intensidad, Modo, Voz y Envío */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* 1. Selector de Modelo (SOLO disponibles) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsModelMenuOpen((prev) => !prev)}
                    aria-expanded={isModelMenuOpen}
                    title="Seleccionar modelo de lenguaje (solo disponibles)"
                    className="min-h-[34px] px-2.5 flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-ink text-[11.5px] font-medium transition-all cursor-pointer"
                  >
                    <Sparkle size={13} className="text-violet-400 shrink-0" />
                    <span className="truncate max-w-[110px]">{currentModelDisplayName}</span>
                    <CaretDown size={11} className="text-faint shrink-0" />
                  </button>
                  {isModelMenuOpen && (
                    <div
                      ref={modelMenuRef}
                      className="absolute bottom-full mb-2 right-0 z-40 w-64 rounded-2xl bg-[#202024] border border-white/10 shadow-2xl p-1.5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
                    >
                      <div className="px-3 py-1.5 text-[10.5px] font-medium text-faint border-b border-white/5 mb-1 flex items-center justify-between">
                        <span>Modelos Disponibles</span>
                        <span className="text-[9.5px] text-emerald-400 font-mono">Activos</span>
                      </div>
                      <div className="max-h-56 overflow-y-auto space-y-0.5">
                        {availableModels.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleSelectModel(m.id)}
                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer group ${
                              m.id === selectedModel
                                ? "bg-white/10 text-white font-medium"
                                : "text-faint hover:text-ink hover:bg-white/5"
                            }`}
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <div className="truncate text-[12px]">{m.name}</div>
                              <div className="text-[10px] text-dim uppercase tracking-wider">{m.provider}</div>
                            </div>
                            {m.id === selectedModel && <Check size={13} className="text-brand shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Selector de Intensidad / Razonamiento */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsEffortMenuOpen((prev) => !prev)}
                    aria-expanded={isEffortMenuOpen}
                    title="Intensidad de razonamiento cognitivo"
                    className="min-h-[34px] px-2 flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-ink text-[11px] font-medium transition-all cursor-pointer"
                  >
                    <Lightning size={12} className="text-amber-400 shrink-0" />
                    <span>{effortLabels[reasoningEffort]}</span>
                    <CaretDown size={10} className="text-faint shrink-0" />
                  </button>
                  {isEffortMenuOpen && (
                    <div
                      ref={effortMenuRef}
                      className="absolute bottom-full mb-2 right-0 z-40 w-44 rounded-2xl bg-[#202024] border border-white/10 shadow-2xl p-1.5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
                    >
                      <div className="px-2.5 py-1 text-[10px] text-faint border-b border-white/5 mb-1 font-medium">
                        Intensidad
                      </div>
                      {(["auto", "low", "medium", "high"] as const).map((eff) => (
                        <button
                          key={eff}
                          type="button"
                          onClick={() => handleSelectEffort(eff)}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                            reasoningEffort === eff
                              ? "bg-white/10 text-white font-medium"
                              : "text-faint hover:text-ink hover:bg-white/5"
                          }`}
                        >
                          <span>{effortLabels[eff]}</span>
                          {reasoningEffort === eff && <Check size={12} className="text-brand shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Selector de Modo (Manual / Auto) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsModeMenuOpen((prev) => !prev)}
                    aria-expanded={isModeMenuOpen}
                    title="Modo de ejecución: Manual (HITL) o Auto"
                    className="min-h-[34px] px-2 flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-ink text-[11px] font-medium transition-all cursor-pointer"
                  >
                    <ShieldCheck size={12} className={executionMode === "manual" ? "text-cyan-400" : "text-emerald-400"} />
                    <span>{executionMode === "manual" ? "Manual" : "Auto"}</span>
                    <CaretDown size={10} className="text-faint shrink-0" />
                  </button>
                  {isModeMenuOpen && (
                    <div
                      ref={modeMenuRef}
                      className="absolute bottom-full mb-2 right-0 z-40 w-48 rounded-2xl bg-[#202024] border border-white/10 shadow-2xl p-1.5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
                    >
                      <div className="px-2.5 py-1 text-[10px] text-faint border-b border-white/5 mb-1 font-medium">
                        Modo de Ejecución
                      </div>
                      {[
                        { id: "manual", label: "Manual (HITL)", desc: "Pide confirmación" },
                        { id: "auto", label: "Auto (Fluido)", desc: "Ejecución continua" },
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setExecutionMode(m.id as "manual" | "auto");
                            setIsModeMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                            executionMode === m.id
                              ? "bg-white/10 text-white font-medium"
                              : "text-faint hover:text-ink hover:bg-white/5"
                          }`}
                        >
                          <div>
                            <div className="text-[11.5px] font-medium">{m.label}</div>
                            <div className="text-[9.5px] text-dim">{m.desc}</div>
                          </div>
                          {executionMode === m.id && <Check size={12} className="text-brand shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Controles de voz con VoiceButton y checkboxes sr-only para tests */}
                <div data-testid="voice-controls" className="flex items-center gap-1 text-xs">
                  <VoiceButton
                    captureState={voice.captureState}
                    disabled={!voice.sttEnabled}
                    onToggleDictation={voice.toggleDictation}
                  />
                  <input
                    type="checkbox"
                    checked={voice.ttsOptIn}
                    onChange={(e) => voice.setTtsOptIn(e.target.checked)}
                    aria-label="Leer respuestas en voz alta (opt-in)"
                    className="sr-only"
                  />
                  <input
                    type="checkbox"
                    checked={voice.disableVoice}
                    onChange={(e) => handleVoiceKillSwitch(e.target.checked)}
                    aria-label="Desactivar toda la voz (kill switch)"
                    data-testid="voice-killswitch"
                    className="sr-only"
                  />
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
                      className="sr-only"
                    >
                      Leer última
                    </button>
                  )}
                </div>

                {/* Botón Circular de Envío / Cancelar (Estilo inicio claude.png y STAB-13) */}
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
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-rose-600 hover:bg-rose-500 text-white rounded-full font-medium text-xs shadow-md cursor-pointer transition-colors"
                    >
                      <span className="text-[12px] leading-none">■</span>
                      <span className="sr-only">Cancelar</span>
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
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-white text-black hover:bg-white/90 rounded-full font-bold text-sm shadow-md cursor-pointer transition-all"
                      >
                        <span className="text-[15px] leading-none font-bold">↑</span>
                        <span className="sr-only">Enviar</span>
                      </ComposerPrimitive.Send>
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </ComposerPrimitive.Root>
        </div>

        {/* Aviso de privacidad accesible para tests */}
        <div className="sr-only">
          <VoicePrivacyNotice />
        </div>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}
