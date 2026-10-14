"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
} from "@assistant-ui/react";
import { Warning, X, ArrowClockwise } from "@phosphor-icons/react";
import { ego, RecallBadgeInfo, PendingApprovalInfo, ModelConfigInfo } from "../lib/ego";
import { turnsToMessages, type SessionTurnRecord } from "../lib/session-resume.js";
import { ApprovalCard } from "./tools/ApprovalCard";
import { CharacterBadge } from "./character/CharacterBadge.js";
import { FileMentionBadge } from "./FileMentionBadge.js";
import { parseSlashCommand, extractMentions, LOCAL_SLASH_COMMANDS, SLASH_HELP_TEXT } from "./composer-slash.js";
import { useCanvasBridge } from "../hooks/useCanvasBridge";
import { MarkdownText } from "./assistant-ui/markdown-text.js";
import { MessageRenderBoundary } from "./assistant-ui/message-render-boundary.js";

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end my-2">
      <div className="bg-hairline text-ink rounded-card px-3.5 py-2 max-w-[80%]">
        <MessageRenderBoundary resetKey="user-turn">
          <MessagePrimitive.Content
            components={{
              Text: ({ text }) => <MarkdownText text={text} />,
            }}
          />
        </MessageRenderBoundary>
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage({ subEgoId = "ego.nucleus" }: { subEgoId?: string }) {
  return (
    <MessagePrimitive.Root className="flex my-2.5 gap-2.5 items-start">
      <div className="mt-0.5 shrink-0">
        {/* T08: avatar por turno según el Sub-Ego activo (antes fijo ego.nucleus). */}
        <CharacterBadge size={26} subEgoId={subEgoId} state="idle" />
      </div>
      <div className="bg-panel border border-hairline rounded-card px-3.5 py-2.5 max-w-[85%] text-ink">
        <MessageRenderBoundary resetKey="assistant-turn">
          <MessagePrimitive.Content
            components={{
              Text: ({ text }) => <MarkdownText text={text} />,
            }}
          />
        </MessageRenderBoundary>
      </div>
    </MessagePrimitive.Root>
  );
}

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
  kind: "tool_call" | "tool_result";
  callId?: string;
  toolName: string;
  detail: string;
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
function toToolActivity(chunk: ChatDeltaChunk): ToolActivity | null {
  if (chunk.type === "tool_call" && chunk.toolName) {
    return {
      kind: "tool_call",
      callId: chunk.callId,
      toolName: chunk.toolName,
      detail: summarizeArgs(chunk.arguments),
    };
  }
  if (chunk.type === "tool_result" && chunk.toolName) {
    const err = typeof chunk.error === "string" ? chunk.error : "";
    return {
      kind: "tool_result",
      callId: chunk.callId,
      toolName: chunk.toolName,
      detail: err || (chunk.success === false ? "falló" : "ok"),
    };
  }
  return null;
}

const KEYED_PROVIDERS: readonly string[] = ["openai", "anthropic", "google", "deepseek"];

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
  // T08: reflejo en vivo del borrador del composer (@menciones y /comandos).
  // Display-only: el texto fuente sigue en el textarea del runtime (R-FE-2,
  // no se reimplementa el composer). El @ viaja en el prompt; el / local
  // se resuelve en `onNew` sin turno LLM.
  const [draftMentions, setDraftMentions] = useState<string[]>([]);
  const [draftSlash, setDraftSlash] = useState<string | null>(null);
  const composerWrapRef = useRef<HTMLDivElement>(null);

  const handleComposerInput = useCallback((e: React.FormEvent) => {
    const ta = (e.target as HTMLElement).closest("div")?.querySelector("textarea")
      ?? composerWrapRef.current?.querySelector("textarea");
    const value = ta ? ta.value : "";
    setDraftMentions(extractMentions(value));
    const slash = /^\s*\//.test(value) ? parseSlashCommand(value) : null;
    setDraftSlash(slash ? slash.name : null);
  }, []);
  const streamTargetRef = useRef<string | null>(null);
  const currentPromptRef = useRef<string>("");

  const { focusedContext, onAction } = useCanvasBridge();

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

  // Inserta el mensaje assistant del turno en curso si falta, o le anexa texto.
  // Los deltas llegan antes del invoke final: el turno se pinta incremental.
  const appendStreamText = useCallback((id: string, text: string) => {
    if (!text) return;
    setMessages((prev) => {
      const found = prev.some((x) => x.id === id);
      if (found) {
        return prev.map((x) =>
          x.id === id
            ? {
                ...x,
                content: [
                  {
                    type: "text" as const,
                    text: x.content.map((p) => p.text).join("") + text,
                  },
                ],
              }
            : x
        );
      }
      return [
        ...prev,
        { id, role: "assistant" as const, content: [{ type: "text" as const, text }] },
      ];
    });
  }, []);

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
          const tool = toToolActivity(c);
          if (tool) {
            setToolEvents((prev) => [...prev, tool]);
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
          if (tool) setToolEvents((prev) => [...prev, tool]);
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
    currentPromptRef.current = promptText;
    setActiveError(null);
    setToolEvents([]);

    const byokBlock = await getByokBlockReason();
    if (byokBlock) {
      const [u, a] = [nid(), nid()];
      setMessages((prev) => [
        ...prev,
        { id: u, role: "user", content: [{ type: "text", text: promptText }] },
        { id: a, role: "assistant", isError: true, content: [{ type: "text", text: byokBlock }] },
      ]);
      setActiveError({ message: byokBlock, prompt: promptText, timestamp: Date.now() });
      return;
    }

    const [u, a] = [nid(), nid()];
    setMessages((prev) => [
      ...prev,
      { id: u, role: "user", content: [{ type: "text", text: promptText }] },
    ]);
    // Sin placeholder "Procesando…": el banner skeleton con altura reservada
    // ocupa su lugar hasta el primer delta (anti layout-shift); el mensaje
    // assistant se inserta lazy con el primer chunk o el texto final.
    streamTargetRef.current = a;
    setIsStreaming(true);

    try {
      const streamRes = await ego().llmStream({ prompt: promptText, projectId, subEgoId });
      if (streamRes.recallStatus) {
        setLatestRecall(streamRes.recallStatus);
      }

      const badgePrefix = streamRes.recallStatus?.count
        ? `${streamRes.recallStatus.glyph} [VantaDB: ${streamRes.recallStatus.count} recuerdos recuperados]\n\n`
        : "";

      const finalReply = badgePrefix + streamRes.text;
      // 2026-10-14: el fallback a mock del router enmascaraba errores de
      // proveedor (ej. modelo retirado 404) como respuesta real. Señal honesta.
      const isSimulated = streamRes.text.startsWith("[MockResponse");
      const visibleReply = isSimulated
        ? `⚠️ Respuesta simulada (el proveedor falló; revisá tu key y el modelo en Ajustes).\n\n${finalReply}`
        : finalReply;

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
      const errorStr = err instanceof Error ? err.message : String(err);
      setActiveError({
        message: errorStr,
        prompt: promptText,
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
    } finally {
      if (streamTargetRef.current === a) streamTargetRef.current = null;
      setIsStreaming(false);
    }
  }, [projectId, subEgoId, appendStreamText]);

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

  const runtime = useExternalStoreRuntime({
    messages,
    setMessages: (msgs) => setMessages([...msgs]),
    convertMessage: (m) => m,
    onNew: async (m) => {
      const text = m.content
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("");
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
        {/* Banner de Memoria Viva (Hermes RecallStatus + VantaDB) */}
        {latestRecall && latestRecall.count > 0 && (
          <div className="flex items-center gap-2 border-b border-hairline bg-raised/40 px-3 py-1 text-[11px] text-faint">
            <span>{latestRecall.glyph}</span>
            <span>Memoria Activa: {latestRecall.count} fragmentos de {latestRecall.sources.join(", ")}</span>
            <span className="ml-auto font-mono text-[10px] text-dim">~{latestRecall.tokensEstimate} tokens</span>
          </div>
        )}

        <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-3 py-2">
          <ThreadPrimitive.Empty>
            <div className="p-10 text-center text-faint">
              <p className="mb-1.5 text-ink font-semibold">Cerebro Operativo de Ego</p>
              <p className="font-mono text-[13px] text-faint">
                Haz una pregunta o asigna una tarea a tus Sub-Egos.
              </p>
            </div>
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages
            components={{
              UserMessage,
              AssistantMessage: () => (
                <AssistantMessage subEgoId={subEgoId ?? "ego.nucleus"} />
              ),
            }}
          />
        </ThreadPrimitive.Viewport>

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

        {/* Actividad de tools inline (tool_call/tool_result del stream, T02) */}
        {toolEvents.length > 0 && (
          <div
            data-testid="chat-tool-activity"
            aria-live="polite"
            className="max-h-24 overflow-y-auto border-t border-hairline px-3 py-1.5 font-mono text-[11px] text-dim"
          >
            {toolEvents.map((t, i) => (
              <div key={`${t.callId ?? t.toolName}-${i}`} className="truncate">
                {t.kind === "tool_call"
                  ? `🔧 ${t.toolName}${t.detail ? ` ${t.detail}` : ""}…`
                  : t.detail === "ok"
                    ? `✓ ${t.toolName} ok`
                    : `✗ ${t.toolName}: ${t.detail}`}
              </div>
            ))}
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
                className="flex items-center gap-1 rounded bg-rose-500/20 px-2.5 py-1 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/30 transition-colors"
              >
                <ArrowClockwise size={12} weight="bold" />
                <span>Reintentar</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveError(null)}
                aria-label="Cerrar advertencia"
                className="p-1 text-rose-400 hover:text-rose-200 transition-colors"
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
          <div className="flex flex-wrap items-center gap-1.5 border-t border-hairline px-3 pt-2" aria-live="polite">
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

        <ComposerPrimitive.Root className="flex gap-2 px-3 py-2.5 border-t border-hairline">
          <div ref={composerWrapRef} onInput={handleComposerInput} className="flex min-w-0 flex-1">
          <ComposerPrimitive.Input
            autoFocus
            placeholder="Pregunta o instruye a Ego… (@archivo · /help)"
            className="flex-1 px-3.5 py-2.5 bg-panel border border-hairline rounded-card text-ink text-sm placeholder:text-faint focus:outline-none focus:border-dim"
          />
          </div>
          <ComposerPrimitive.Send
            aria-label="Enviar mensaje"
            className="px-[18px] py-2.5 bg-ink text-paper rounded-card font-semibold text-[13px] cursor-pointer"
          >
            Enviar
          </ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}
