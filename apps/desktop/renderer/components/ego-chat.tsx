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
  ArrowDown,
  ArrowRight,
  ArrowUp,
  At,
  Coins,
  DownloadSimple,
  Paperclip,
  Books,
  Globe,
  Flask,
  ChartBar,
  ImageSquare,
  PencilSimple,
  Plus,
  Prohibit,
  Robot,
  CaretDown,
  Check,
  Lightning,
  ShieldCheck,
  Stop,
} from "@phosphor-icons/react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { MOTION } from "./canvas/DesignSystemProvider.js";
import { ego, RecallBadgeInfo, PendingApprovalInfo, ModelConfigInfo } from "../lib/ego";
import { turnsToMessages, type SessionTurnRecord } from "../lib/session-resume.js";
import { ApprovalCard } from "./tools/ApprovalCard";
import { CharacterBadge } from "./character/CharacterBadge.js";
import type { CharacterState } from "./character/state/character-state.js";
// E6/Ola 2 (A4): la resolución del estado vivo del avatar es una función
// pura (testeable sin montar el chat).
import { resolveAvatarLiveState } from "./character/avatar-live-state.js";
import { FileMentionBadge } from "./FileMentionBadge.js";
import { parseSlashCommand, extractMentions, LOCAL_SLASH_COMMANDS, SLASH_HELP_TEXT } from "./composer-slash.js";
import { useCanvasBridge } from "../hooks/useCanvasBridge";
import { useVoice } from "./voice/useVoice.js";
import { VoiceButton, VoicePrivacyNotice } from "./voice/VoiceButton.js";
import { MarkdownText } from "./assistant-ui/markdown-text.js";
import { MessageRenderBoundary } from "./assistant-ui/message-render-boundary.js";
import { toTurnUsage, type TurnUsage } from "./daily-state/MetricsConsole.js";
import { ToolExecutionCard } from "./chat/ToolExecutionCard.js";
import {
  ChatMessageList,
  type ChatMessageRole,
} from "./chat/ChatMessageList.js";
import { useChatTranscript, type Msg } from "./chat/chat-transcript-store.js";
import { Button } from "./ui-kit/Button.js";
import { Menu, type MenuItem } from "./ui-kit/Menu.js";

/**
 * Niveles de intensidad de razonamiento del composer.
 * El tipo es explícito (y no `Record<string, string>`) porque el proyecto
 * activa `noUncheckedIndexedAccess`: con un `Record<string, string>` el
 * indexado devuelve `string | undefined` y obliga a castear en cada uso.
 */
type ReasoningEffort = "auto" | "low" | "medium" | "high";

const ChatActionsContext = createContext<{
  onRewind?: (messageId: string) => void;
  onRetry?: () => void;
  subEgoId?: string;
  avatarLiveState?: CharacterState;
  isStreaming?: boolean;
  lastMessageId?: string;
}>({});

/**
 * Marca de "seleccionado" para los ítems de un `Menu`, con ANCHO FIJO.
 *
 * ## Por qué no va en el `shortcut`
 * El primitive `Menu` del kit sólo ofrece `icon` (izquierda), `label` y
 * `shortcut` (derecha, con tipografía mono). El check de "activo" no cabe en
 * ninguno de los dos slots sin romper la semántica (el `shortcut` reserva
 * para atajos de teclado), así que se dibuja en el slot `icon` y los ítems
 * NO seleccionados dejan un hueco de 12×12 px: la lista queda alineada.
 */
function selectedMark(active: boolean) {
  return active ? (
    <Check size={12} className="text-brand" />
  ) : (
    <span className="inline-block h-3 w-3" aria-hidden />
  );
}

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
      // `contentVisibility`/`containIntrinsicSize` son propiedades CSS de
      // virtualización: no existen como utilidad Tailwind v4.3.3.
      // design-lint: allow
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 96px" }}
    >
      <div className="max-w-[min(82%,600px)] rounded-[var(--radius-card)] border border-hairline bg-raised px-4 py-2.5 text-ink shadow-[var(--ego-elevation-l1)]">
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
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-card)] transition-colors hover:bg-raised hover:text-ink cursor-pointer"
          />
          {messageId && onRewind && (
            <Button
              variant="ghost"
              size="md"
              onClick={() => onRewind(messageId)}
              aria-label="Rebobinar aquí"
              title="Rebobinar historial hasta este turno"
              icon={<ArrowCounterClockwise size={12} />}
              className="font-mono"
            >
              Rebobinar
            </Button>
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
      // `contentVisibility`/`containIntrinsicSize` son propiedades CSS de
      // virtualización: no existen como utilidad Tailwind v4.3.3.
      // design-lint: allow
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 140px" }}
    >
      {/* Recuadro de Avatar de 44x44px de alta calidad */}
      <div className="w-11 h-11 rounded-[var(--radius-card)] bg-raised border border-hairline p-0.5 shadow-[var(--ego-elevation-l1)] flex items-center justify-center shrink-0">
        <CharacterBadge
          size={40}
          subEgoId={subEgoId}
          state={isLast ? (avatarLiveState ?? "idle") : "idle"}
          animated={isLast && Boolean(isStreaming)}
        />
      </div>
      <div className="min-w-0 flex-1 px-3.5 py-1 text-ink">
        <div className="flex items-center gap-1.5 mb-1.5 font-sans">
          <span className="text-xs font-semibold text-ink">{subEgoId}</span>
          <span className="rounded-full bg-raised border border-hairline px-2 py-0.5 text-xs font-mono text-dim">
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
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-card)] transition-colors hover:bg-raised hover:text-ink cursor-pointer"
          />
          <ActionBarPrimitive.Reload
            aria-label="Regenerar respuesta"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-card)] transition-colors hover:bg-raised hover:text-ink cursor-pointer"
          />
          {messageId && onRewind && (
            <Button
              variant="ghost"
              size="md"
              onClick={() => onRewind(messageId)}
              aria-label="Rebobinar aquí"
              title="Rebobinar historial hasta este turno"
              icon={<ArrowCounterClockwise size={12} />}
              className="font-mono"
            >
              Rebobinar
            </Button>
          )}
          {onRetry && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRetry}
              aria-label="Reintentar último turno"
              title="Reintentar último turno"
              icon={<ArrowClockwise size={13} />}
            />
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

/**
 * T8 (EGO-FIND-73): el tipo del mensaje vive en el store del transcript
 * (fuera del componente) para que el store y el chat compartan EXACTAMENTE
 * la misma forma. Se re-exporta aquí por compatibilidad con los tests y
 * consumidores que ya importaban `Msg` desde `ego-chat`.
 */
export type { Msg };

/**
 * T21 (PERF-VIRTUA) / UI-05 / T1 (EGO-FIND-20): Virtualización con virtua por encima de umbral.
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
 *
 * T1 (EGO-FIND-20) — por qué se usa `Unstable_MessageById` y NO `MessageByIndex`:
 * `ThreadPrimitive.MessageByIndex` resuelve el mensaje por ÍNDICE contra el store de
 * assistant-ui (`aui.thread.message({index})` → `useClientLookup`). El `<Virtualizer>`
 * itera el array local `messages` (estado React), que adelanta al store en un tick
 * durante el streaming. Al añadir un turno, el índice renderizado puede exceder
 * `thread.messages.length` → throw `useClientLookup: index N out of bounds`.
 * `ThreadPrimitive.Unstable_MessageById` resuelve por ID y **devuelve `null` en vez de
 * lanzar** cuando el id todavía no existe en el store — exactamente el contrato que la
 * librería documenta para windowing. Además desacopla el mensaje de su posición, lo que
 * sobrevive a reordenamientos y al propio windowing.
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
  // T8 (EGO-FIND-73): el transcript vive en un store Zustand dedicado, no
  // en `useState` del componente raíz. Motivo: cada delta de streaming
  // provocaba un re-render del componente raíz COMPLETO (25 useState +
  // 25 refs + el runtime de assistant-ui) y, en cascada, de todos los
  // consumidores del `ChatActionsContext`.
  const messages = useChatTranscript((s) => s.messages);
  const setMessages = useChatTranscript((s) => s.setMessages);
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
  /**
   * E6/Ola 2 (A4): secuencia del último evento de tool del turno ANTERIOR.
   * Acota la señal de tool al TURNO EN CURSO: `toolEvents` es acumulativo
   * (el panel los muestra como historial), así que sin este corte un
   * `tool_error` de un turno viejo pintaría de ámbar (`warning`) un turno
   * nuevo, que es un aviso FALSO.
   */
  const turnStartToolSeqRef = useRef(0);
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

  // Los 5 selectores del composer (acciones, modelo, intensidad, modo y
  // Sub-Ego) se resolvieron con el primitive `Menu` del kit (Radix
  // DropdownMenu): el estado "abierto/cerrado", el clic fuera y la tecla
  // Escape los gestiona la librería. Antes eran 5 booleanos + 5 refs + un
  // listener global de `mousedown` replicados a mano.

  /**
   * D12 — UNA sola fuente de verdad para el modelo: `useUiStore.activeModelId`.
   *
   * ## El defecto medido
   * El composer mostraba "Llama 3.2 Local" mientras la cabecera global y la
   * del chat mostraban "Claude 3.7 Sonnet". La causa: el composer mantenía su
   * PROPIO `selectedModel` y, al cargar el catálogo de modelos, lo
   * sobrescribía con el PRIMER modelo disponible (`loaded[0]`) — el orden del
   * catálogo no dice nada sobre el modelo que el usuario tiene activo.
   *
   * ## La solución
   * El composer deja de tener estado propio: lee y escribe el modelo activo
   * de la app (el mismo valor que pintan las dos cabeceras). El catálogo
   * pasa a ser sólo el contenido del MENÚ: ya no puede cambiar la selección.
   */
  // EGO-FIND-97 (Ola 10): el chat ya NO elige el modelo (esa decisión es
  // global y vive en la barra superior → `useUiStore.activeModelId` + el
  // `ModelPicker`). Se retiran el estado y el catálogo propios del chat.
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>("auto");
  const [executionMode, setExecutionMode] = useState<"manual" | "auto">("manual");
  const [availableSubEgos, setAvailableSubEgos] = useState<Array<{ id: string; name: string }>>([
    { id: "ego.nucleus", name: "Ego Núcleo" },
    { id: "ego.dev", name: "Sub-Ego Dev" },
    { id: "ego.copywriter", name: "Ego Copywriter" },
  ]);

  // Carga de Sub-Egos desde el bridge.
  //
  // EGO-FIND-97 (Ola 10): el chat ya no puebla un menú de modelos (el
  // modelo es global → su catálogo vive en el `ModelPicker`), así que la
  // carga de modelos se retira de aquí.
  useEffect(() => {
    let cancelled = false;
    async function initCatalog() {
      try {
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

  const handleSelectEffort = useCallback((eff: "auto" | "low" | "medium" | "high") => {
    setReasoningEffort(eff);
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
    // E6/Ola 2 (A4): la resolución vive en una FUNCIÓN PURA
    // (`character/avatar-live-state.ts`): testeable por comportamiento y sin
    // hooks. Aquí solo se le pasan las señales del chat.
    const lastMsg = messages[messages.length - 1];
    const lastAssistantText =
      lastMsg && lastMsg.role === "assistant"
        ? lastMsg.content.map((c) => c.text).join("")
        : "";
    return resolveAvatarLiveState({
      pendingApprovals: pendingApprovals.length,
      activeError: Boolean(activeError),
      isStreaming,
      toolEvents,
      turnStartToolSeq: turnStartToolSeqRef.current,
      lastMessageRole: lastMsg ? lastMsg.role : null,
      lastAssistantText,
      composerText,
    });
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
    // E6/Ola 2 (A4): corte de turno. Los eventos de tool anteriores a este
    // punto pertenecen a turnos ya cerrados: el avatar no debe pintarse de
    // `warning` por un fallo de un turno pasado.
    turnStartToolSeqRef.current = toolSeqRef.current;

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

  const effortLabels: Record<ReasoningEffort, string> = {
    auto: "Auto",
    low: "Bajo",
    medium: "Medio",
    high: "Alto",
  };

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
  // Rol por id: el estado local va un tick por delante del store de assistant-ui,
  // así que este mapa puede contener ids que el store todavía no conoce.
  // `ChatMessageList` solo lo consulta para los ids que SÍ están en el store.
  const roleById = useMemo(() => {
    const map = new Map<string, ChatMessageRole>();
    for (const m of messages) map.set(m.id, m.role);
    return map;
  }, [messages]);

  // ─────────────────────────────────────────────────────────────────────────
  // Ítems de los 5 menús del composer.
  //
  // Antes cada menú era un `<div>` flotante copy-paste con su propio estado
  // booleano (`isPlusMenuOpen`, `isModelMenuOpen`, …) y su propio estilo
  // (`bg-[#202024] border-white/10 shadow-2xl backdrop-blur-xl`). Ahora los
  // 5 comparten el primitive `Menu` del kit (Radix DropdownMenu), que aporta
  // estilo, roles ARIA, navegación por teclado y cierre automático.
  // ─────────────────────────────────────────────────────────────────────────
  const activeSubEgoId = subEgoId ?? "ego.nucleus";

  const plusMenuItems = useMemo<MenuItem[]>(
    () => [
      {
        label: "Agregar fotos y archivos",
        icon: <Paperclip size={16} />,
        onSelect: () => fileInputRef.current?.click(),
      },
      {
        label: "Agregar desde la biblioteca",
        icon: <Books size={16} />,
        onSelect: () => {
          const ta = composerWrapRef.current?.querySelector("textarea");
          if (ta) {
            ta.value = ta.value ? `${ta.value} @` : "@";
            ta.dispatchEvent(new Event("input", { bubbles: true }));
            ta.focus();
          }
        },
      },
      {
        label: "Busca en la web",
        icon: <Globe size={16} />,
        onSelect: () => fillComposer("Busca en la web sobre "),
      },
      {
        label: "Investigación profunda",
        icon: <Flask size={16} />,
        onSelect: () => fillComposer("Investiga a fondo en VantaDB "),
      },
      {
        label: "Proyectar en Canvas",
        icon: <ChartBar size={16} />,
        onSelect: () => fillComposer("Proyecta en Canvas un dashboard interactivo de "),
      },
      {
        label: "Delegar a especialista",
        icon: <Robot size={16} />,
        onSelect: () => fillComposer("@investigador "),
      },
    ],
    [fillComposer]
  );

  const subEgoMenuItems = useMemo<MenuItem[]>(
    () =>
      availableSubEgos.map((se) => ({
        label: se.name,
        icon: selectedMark(se.id === activeSubEgoId),
        // El Sub-Ego activo lo posee el padre (prop `subEgoId`): este menú es
        // INFORMATIVO. Antes de la migración tampoco cambiaba nada — sólo
        // cerraba el panel — así que se conserva ese comportamiento.
        onSelect: () => {},
      })),
    [availableSubEgos, activeSubEgoId]
  );

  const effortMenuItems = useMemo<MenuItem[]>(
    () =>
      (["auto", "low", "medium", "high"] as const).map((eff) => ({
        label: effortLabels[eff],
        icon: selectedMark(reasoningEffort === eff),
        onSelect: () => handleSelectEffort(eff),
      })),
    [reasoningEffort, handleSelectEffort]
  );

  const modeMenuItems = useMemo<MenuItem[]>(
    () =>
      [
        { id: "manual", label: "Manual (HITL)", desc: "Pide confirmación" },
        { id: "auto", label: "Auto (Fluido)", desc: "Ejecución continua" },
      ].map((m) => ({
        label: m.label,
        shortcut: m.desc,
        icon: selectedMark(executionMode === m.id),
        onSelect: () => setExecutionMode(m.id as "manual" | "auto"),
      })),
    [executionMode]
  );

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="h-full flex flex-col">
        {/* Cabecera del Chat con Avatar de size 36 y acción discreta.
            Altura `h-11` (44 px) para igualar el ritmo vertical del shell
            (`src/App.tsx`): antes el header del chat crecía con `py-2` y
            quedaba desfasado respecto del resto de la app. */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-hairline bg-panel px-4 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[var(--radius-card)] bg-raised border border-hairline flex items-center justify-center p-0.5">
              <CharacterBadge
                subEgoId={subEgoId ?? "ego.nucleus"}
                size={36}
                state={avatarLiveState}
                animated={avatarLiveState !== "idle"}
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-ink text-sm">Ego Chat</span>
                <span className="rounded-full border border-success/30 bg-success/10 px-1.5 py-0.5 text-xs font-mono text-success">
                  En línea
                </span>
              </div>
              <span className="text-xs text-faint font-mono">
                {subEgoId ?? "ego.nucleus"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="md"
              onClick={exportConversationMarkdown}
              aria-label="Exportar conversación a Markdown"
              title="Exportar conversación actual (.md)"
              disabled={messages.length === 0}
              icon={<DownloadSimple size={13} />}
            >
              <span className="hidden sm:inline">Exportar (.md)</span>
            </Button>
          </div>
        </div>

        {/* Banner de Memoria Activa */}
        {latestRecall && latestRecall.count > 0 && (
          <div className="flex items-center gap-2 border-b border-hairline bg-raised px-3 py-1 text-xs text-faint">
            <span>{latestRecall.glyph}</span>
            <span>Memoria Activa: {latestRecall.count} fragmentos de {latestRecall.sources.join(", ")}</span>
            <span className="ml-auto font-mono text-xs text-dim">~{latestRecall.tokensEstimate} tokens</span>
          </div>
        )}

        <ThreadPrimitive.Viewport
          ref={viewportRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 100);
          }}
          className="relative flex-1 overflow-y-auto px-3 py-2"
          // `overflow-anchor` (CSS scroll anchoring) no tiene utilidad en
          // Tailwind v4.3.3: sin él, prepender un turno salta el scroll.
          // design-lint: allow
          style={{ overflowAnchor: "auto" }}
        >
          {/* Estado Inicial Sereno (¿Por dónde empezamos? + Avatar de Estudio Grande) */}
          <ThreadPrimitive.Empty>
            <div className="h-full min-h-[440px] flex flex-col items-center justify-center p-6 text-center text-faint max-w-2xl w-full mx-auto my-auto select-none">
              {/* Recuadro de estudio grande de alta calidad */}
              <div className="w-28 h-28 rounded-[var(--radius-card)] bg-raised border border-hairline shadow-[var(--ego-elevation-l2)] flex items-center justify-center mx-auto mb-5 p-2 transition-transform hover:scale-105 duration-[var(--motion-duration-surface)]">
                <CharacterBadge
                  subEgoId={subEgoId ?? "ego.nucleus"}
                  size={104}
                  state={avatarLiveState}
                  animated
                />
              </div>

              {/* Título principal limpio y subtítulo canónico exacto */}
              <h1 className="text-base font-semibold text-ink tracking-tight mb-1.5 font-sans">
                ¿Por dónde empezamos?
              </h1>
              <p className="font-sans text-sm text-faint mb-8 font-medium">
                Cerebro Operativo de Ego · Inteligencia, memoria y ejecución local
              </p>

              {/* 3–4 filas de sugerencias limpias con icono sutil.
                  Los iconos son de Phosphor (antes eran emoji: la iconografía
                  del sistema es vectorial y monocroma, no pictogramas sueltos). */}
              <div className="w-full max-w-lg space-y-2.5 mb-2">
                {[
                  {
                    icon: <ImageSquare size={20} />,
                    title: "Proyectar un dashboard o tabla en el Canvas",
                    desc: "Crea visualizaciones interactivas y tablas de datos",
                    prompt: "Proyecta en Canvas un dashboard interactivo con tablas y gráficos",
                  },
                  {
                    icon: <PencilSimple size={20} />,
                    title: "Analizar arquitectura y revisar código del proyecto",
                    desc: "Inspecciona dependencias, estructura y áreas de mejora",
                    prompt: "Analiza la arquitectura del proyecto y revisa el código fuente actual",
                  },
                  {
                    icon: <Globe size={20} />,
                    title: "Buscar en memoria VantaDB o investigar en la web",
                    desc: "Consulta hechos persistentes y conocimiento conectado",
                    prompt: "Busca en la memoria VantaDB las decisiones clave del proyecto",
                  },
                  {
                    icon: <Robot size={20} />,
                    title: "Delegar una tarea a un Sub-Ego especialista",
                    desc: "Asigna tareas a ingenieros, investigadores o redactores",
                    prompt: "Delega la tarea a un Sub-Ego especialista",
                  },
                ].map((starter) => (
                  <button
                    key={starter.title}
                    type="button"
                    onClick={() => fillComposer(starter.prompt)}
                    className="group w-full flex items-center gap-3.5 px-4 py-3 rounded-[var(--radius-card)] border border-hairline bg-panel hover:bg-raised hover:border-strong transition-colors text-left shadow-[var(--ego-elevation-l1)] cursor-pointer"
                  >
                    <span className="text-faint shrink-0 group-hover:text-brand transition-colors">
                      {starter.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm text-ink group-hover:text-brand transition-colors truncate">
                        {starter.title}
                      </div>
                      <div className="text-xs text-faint truncate mt-0.5">
                        {starter.desc}
                      </div>
                    </div>
                    <ArrowRight
                      size={14}
                      className="text-faint group-hover:text-ink transition-colors shrink-0"
                    />
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
            <ChatMessageList
              roleById={roleById}
              components={messageComponents}
              viewportRef={viewportRef}
              threshold={threshold}
            />
          </ChatActionsContext.Provider>
        </ThreadPrimitive.Viewport>

        {/* Jump to latest */}
        {!stick && (
          <div className="flex justify-center border-t border-hairline bg-paper px-3 py-1.5">
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                const el = viewportRef.current;
                if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
                setStick(true);
              }}
              aria-label="Saltar al último mensaje"
              icon={<ArrowDown size={13} />}
            >
              Jump to latest
            </Button>
          </div>
        )}

        {/* Skeleton de streaming */}
        {isStreaming && (
          <div
            data-testid="chat-streaming-skeleton"
            aria-busy="true"
            aria-label="Generando respuesta"
            className="mx-3 my-2 min-h-14 rounded-[var(--radius-card)] border border-hairline bg-panel px-3.5 py-2.5"
          >
            <div className="h-2.5 w-2/3 animate-pulse rounded-full bg-raised" />
            <div className="mt-2 h-2.5 w-1/2 animate-pulse rounded-full bg-raised" />
          </div>
        )}

        {/* Actividad de tools inline */}
        {toolEvents.length > 0 && (
          <div
            data-testid="chat-tool-activity"
            role="status"
            aria-live="polite"
            className="max-h-48 overflow-y-auto border-t border-hairline px-3 py-1.5 font-mono text-xs text-dim space-y-1"
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
            className="flex items-center gap-1.5 border-t border-hairline px-3 py-1.5 font-mono text-xs text-dim"
          >
            <Coins size={13} className="shrink-0" aria-hidden />
            <span>
              Último turno: {(lastTurnUsage.totalTokens ?? lastTurnUsage.promptTokens + lastTurnUsage.completionTokens).toLocaleString()} tokens
              {" "}({lastTurnUsage.promptTokens.toLocaleString()} prompt + {lastTurnUsage.completionTokens.toLocaleString()} respuesta)
              {" "}· ${lastTurnUsage.estimatedCostUsd.toFixed(4)}
            </span>
          </div>
        )}

        {/* Error interactivo.
            D13 — el mensaje ya no se corta a media palabra ("…usar el bac."):
            `truncate` recortaba la última palabra sinopsis. Ahora se muestran
            hasta DOS líneas con `line-clamp-2` y el texto COMPLETO viaja en el
            `title` (hover) para no perder información. */}
        {activeError && (
          <div className="flex items-start justify-between gap-2 border-t border-error/30 bg-error/10 px-3.5 py-2 text-xs text-error">
            <div className="flex min-w-0 items-start gap-2 pr-2">
              <Warning size={15} className="mt-0.5 shrink-0 text-error" />
              <div className="min-w-0" title={activeError.message}>
                <span className="font-semibold text-error">Fallo en turno: </span>
                <span className="line-clamp-2 text-ink">{activeError.message}</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="danger"
                size="md"
                onClick={handleRetry}
                icon={<ArrowClockwise size={12} weight="bold" />}
              >
                Reintentar
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setActiveError(null)}
                aria-label="Cerrar advertencia"
                icon={<X size={13} />}
              />
            </div>
          </div>
        )}

        {/* Aprobaciones HITL */}
        {pendingApprovals.length > 0 && (
          <div className="max-h-72 overflow-y-auto border-t border-hairline bg-raised px-3.5 py-2">
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
          <div className="flex items-center justify-between border-t border-hairline bg-raised px-3 py-1.5 font-mono text-xs text-dim">
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
              <span className="font-mono text-xs text-dim">
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
                className={`inline-flex items-center gap-1.5 rounded-[var(--radius-card)] border border-hairline px-2.5 py-1 font-mono text-xs ${a.quarantined ? "bg-error/10 text-error" : "bg-panel text-ink"}`}
              >
                {a.dataUrl ? (
                  <img src={a.dataUrl} alt={a.name} className="h-4 w-4 shrink-0 rounded-[var(--radius-card)] object-cover" />
                ) : a.quarantined ? (
                  <Prohibit size={12} className="shrink-0" aria-hidden />
                ) : (
                  <Paperclip size={12} className="shrink-0" aria-hidden />
                )}
                <span className="truncate max-w-[120px]">{a.name}</span>
                <span className="text-dim">·{a.permission}</span>
                {/* Botón interno del chip: NO se le declara tamaño (ni 28 ni
                    32 px) porque un target de 44 px inflaría el chip hasta
                    52 px de alto. El area pulsable la aporta el `padding`. */}
                <button
                  type="button"
                  onClick={() => removeAttachment(a.id)}
                  aria-label={`Quitar adjunto ${a.name}`}
                  className="ml-1 rounded-md p-0.5 text-faint hover:bg-raised hover:text-ink cursor-pointer"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
            {attachError && <span className="font-mono text-xs text-error">{attachError}</span>}
          </div>
        )}

        {/* Composer Flotante tipo Cápsula Elegante (Estilo Claude / Inicio.png) */}
        <div className="relative p-3">
          {/* Autocompletado @archivo — typeahead, NO es un popover de botón:
              se abre por tecleo, así que sigue siendo un panel posicionado
              (el primitive `Popover` del kit exige un trigger botón). */}
          {mentionQuery !== null && filteredSuggestions.length > 0 && (
            <div className="absolute bottom-full mb-2 left-3 z-30 w-72 rounded-[var(--radius-card)] border border-hairline bg-raised p-1.5 text-xs font-mono shadow-[var(--ego-elevation-l2)]">
              <div className="px-2 py-1 text-xs text-faint border-b border-hairline mb-1 font-sans font-medium flex items-center justify-between">
                <span>Mencionar archivo</span>
                <span className="text-xs text-dim">click para insertar</span>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-0.5">
                {filteredSuggestions.map((path) => (
                  <button
                    key={path}
                    type="button"
                    onClick={() => handleSelectMention(path)}
                    className="w-full text-left px-2 py-1.5 rounded-[var(--radius-card)] hover:bg-panel text-ink text-xs flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="truncate">{path}</span>
                    <span className="text-xs text-faint ml-2 shrink-0">@</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Menú de acciones y adjuntos (botón ＋): vive en la barra de
              herramientas del composer (abajo). Se colapsó en el primitive
              `Menu` del kit (Radix DropdownMenu): antes era un `<div>`
              flotante copy-paste con `bg-[#202024] border-white/10
              shadow-2xl backdrop-blur-xl` y su propio booleano de estado. */}

          <ComposerPrimitive.Root className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-hairline bg-panel p-3.5 shadow-[var(--ego-elevation-l2)] transition-colors focus-within:border-brand">
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
                className="w-full bg-transparent border-0 p-1 text-ink font-sans text-sm leading-relaxed placeholder:text-faint focus:outline-none focus:ring-0 resize-none max-h-48 overflow-y-auto"
              />
            </div>

            {/* Nivel 2: Barra de herramientas inferior con selectores (Estilo Claude) */}
            <div className="flex items-center justify-between pt-2 border-t border-hairline gap-2 flex-wrap">
              {/* Izquierda: Herramientas (+, @, Sub-Ego).
                  Los 3 menús de esta barra usan `contentClassName` para fijar
                  la elevación L2 del panel: el primitive trae `shadow-2xl`
                  (escala vieja) y `contentClassName` lo sobrescribe con
                  `shadow-[var(--ego-elevation-l2)]` (escala canónica). */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <Menu
                  trigger={
                    <Button
                      variant="secondary"
                      size="icon"
                      aria-label="Adjuntar archivos"
                      title="Acciones y adjuntos (+)"
                      data-testid="composer-attach-button"
                      icon={<Plus size={16} />}
                    />
                  }
                  items={plusMenuItems}
                  align="start"
                  side="top"
                  sideOffset={8}
                  ariaLabel="Acciones y adjuntos"
                  contentClassName="w-72 shadow-[var(--ego-elevation-l2)]"
                />

                <Button
                  variant="secondary"
                  size="icon"
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
                  icon={<At size={16} />}
                />

                {/* Selector de Sub-Ego */}
                <Menu
                  trigger={
                    <Button
                      variant="secondary"
                      size="md"
                      title="Sub-Ego activo"
                      aria-label="Seleccionar Sub-Ego activo"
                      icon={<Robot size={13} className="shrink-0 text-brand" />}
                    >
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <span className="truncate max-w-[95px]">{activeSubEgoId}</span>
                        <CaretDown size={11} className="shrink-0 text-faint" />
                      </span>
                    </Button>
                  }
                  items={subEgoMenuItems}
                  align="start"
                  side="top"
                  sideOffset={6}
                  ariaLabel="Sub-Ego activo"
                  contentClassName="shadow-[var(--ego-elevation-l2)]"
                />
              </div>

              {/* Derecha: Intensidad, Modo, Voz y Envío.
                  EGO-FIND-97 (Ola 10): el selector de MODELO desaparece de
                  aquí — el modelo es un ajuste GLOBAL de la app (el Model
                  Router) y su sitio es la barra superior (una sola
                  superficie). Aquí sólo viven los ajustes DEL TURNO. */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* 1. Selector de Intensidad / Razonamiento */}
                <Menu
                  trigger={
                    <Button
                      variant="secondary"
                      size="md"
                      title="Intensidad de razonamiento cognitivo"
                      aria-label="Intensidad de razonamiento cognitivo"
                    >
                      <span className="inline-flex items-center gap-1">
                        <Lightning size={12} className="text-brand shrink-0" />
                        <span>{effortLabels[reasoningEffort]}</span>
                        <CaretDown size={10} className="text-faint shrink-0" />
                      </span>
                    </Button>
                  }
                  items={effortMenuItems}
                  align="end"
                  side="top"
                  sideOffset={6}
                  ariaLabel="Intensidad de razonamiento"
                  contentClassName="shadow-[var(--ego-elevation-l2)]"
                />

                {/* 2. Selector de Modo (Manual / Auto) */}
                <Menu
                  trigger={
                    <Button
                      variant="secondary"
                      size="md"
                      title="Modo de ejecución: Manual (HITL) o Auto"
                      aria-label="Modo de ejecución"
                    >
                      <span className="inline-flex items-center gap-1">
                        <ShieldCheck
                          size={12}
                          className={executionMode === "manual" ? "text-brand shrink-0" : "text-success shrink-0"}
                        />
                        <span>{executionMode === "manual" ? "Manual" : "Auto"}</span>
                        <CaretDown size={10} className="text-faint shrink-0" />
                      </span>
                    </Button>
                  }
                  items={modeMenuItems}
                  align="end"
                  side="top"
                  sideOffset={6}
                  ariaLabel="Modo de ejecución"
                  contentClassName="shadow-[var(--ego-elevation-l2)]"
                />

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
                      className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-error text-on-brand transition-colors hover:bg-error/90"
                    >
                      <Stop size={13} weight="fill" aria-hidden />
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
                      {/* CTA de envío: `bg-brand` + `text-on-brand` (ámbar del
                          sistema con texto de alto contraste). NO se usa
                          `text-white` sobre ámbar: es una de las 7
                          combinaciones prohibidas (§7 #7). */}
                      <ComposerPrimitive.Send
                        aria-label="Enviar mensaje"
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-brand text-on-brand shadow-[var(--ego-elevation-l1)] transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:bg-raised disabled:text-dim disabled:shadow-none"
                      >
                        <ArrowUp size={16} weight="bold" aria-hidden />
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
