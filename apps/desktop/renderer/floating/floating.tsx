import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { FloatingAvatar } from "./floating-avatar.js";
import type { EgoFloatingBridge, FloatingStateSnapshot } from "../../src/preload";
import {
  buildApproval,
  buildHeader,
  buildNote,
  buildOverview,
  buildQuestion,
  type ApprovalData,
  type ApprovalDecision,
  type HeaderView,
  type QuestionData,
  type ViewHost,
} from "./views.js";
import { CountdownController, COUNTDOWN_AUTOCLOSE_S } from "./countdown.js";
import { DropQueue, UploadCanvas } from "./upload-canvas.js";
import { UploadSeq } from "./upload-seq.js";

declare global {
  interface Window {
    egoFloating?: EgoFloatingBridge;
  }
}

/** Puente mínimo de `window.ego` que la flotante necesita (mismo preload que
 *  la ventana principal — `FloatingWindowView.ts:52` — sin IPC nuevo). */
interface FloatingEgoBridge {
  onApprovalRequest?: (cb: (req: unknown) => void) => () => void;
  knowledge?: {
    ingest?: (req: unknown) => Promise<unknown>;
  };
}

function readEgoBridge(): FloatingEgoBridge | null {
  const w = window as unknown as { ego?: FloatingEgoBridge };
  return w.ego ?? null;
}

const INITIAL_STATE: FloatingStateSnapshot = {
  visible: true,
  muted: false,
  attentionState: "hidden",
};

/** Etiqueta corta del estado para la píldora (Task6 la reemplaza por vistas). */
function labelFor(state: FloatingStateSnapshot["attentionState"]): string {
  switch (state) {
    case "hitl_approval":
      return "Aprobación";
    case "alert":
      return "Alerta";
    case "expanded":
      return "Trabajando";
    case "compact":
      return "Pensando";
    case "hidden":
    default:
      return "Ego";
  }
}

/** Fallback etiquetado hasta que `onApprovalRequest` entregue el payload real
 *  (el snapshot `egoFloating.onState` no trae approvalId — sin IPC nuevo). */
const PREVIEW_APPROVAL: ApprovalData = {
  approvalId: "floating-preview",
  toolName: "Ego",
  command: "Vista previa — esperando aprobación real…",
};

/** Fallback etiquetado para `alert` (no existe canal de preguntas en el bridge;
 *  crear IPC está prohibido en esta tarea). */
const PREVIEW_QUESTION: QuestionData = {
  id: "floating-preview",
  title: "Sin preguntas pendientes",
  questions: [
    {
      id: "q-preview",
      text: "Las preguntas del SubEgo aparecerán aquí.",
      options: ["Entendido", "Abrir Ego"],
    },
  ],
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Línea display del approval desde `arguments` (regla Task7: nunca solo el
 *  tool — `command ?? path/filePath/url`, si no resumen `k=v` ≤200ch). */
function commandFor(toolName: string, args: Record<string, unknown> | undefined): string {
  if (!args) return toolName;
  for (const k of ["command", "path", "filePath", "url"]) {
    const v = args[k];
    if (typeof v === "string" && v.length > 0) return v.slice(0, 200);
  }
  const keys = Object.keys(args).sort();
  if (keys.length === 0) return toolName;
  return `${toolName} ${keys.map((k) => `${k}=${String(args[k]).slice(0, 60)}`).join(" ")}`.slice(0, 200);
}

/** Monta un `ViewHost` imperativo en el mount estático `#id` del shell Task3
 *  (`floating.html`): append + `hidden=false` + `sync()`; al ocultar/desmontar
 *  retira el nodo y restaura `hidden`. `mountKey` re-sincroniza ante datos. */
function StaticMount({
  id,
  host,
  mountKey,
  visible,
}: {
  id: string;
  host: ViewHost;
  mountKey: string;
  visible: boolean;
}): null {
  useEffect(() => {
    const node = document.getElementById(id);
    if (!node || !visible) return;
    if (host.el.parentNode !== node) node.appendChild(host.el);
    node.hidden = false;
    // Los builders son puros y no lanzan; el try evita tumbar el flotante
    // ante un host defectuoso sin ensuciar la consola (0 console.error nuevos).
    try {
      host.sync();
    } catch {
      /* no-op: el mount queda con el último contenido válido */
    }
    return () => {
      host.el.remove();
      const n = document.getElementById(id);
      if (n && n.childElementCount === 0) n.hidden = true;
    };
  }, [id, host, mountKey, visible]);
  return null;
}

function noop(): void {}

/**
 * Contención FIND-12-01 (placeholder estable, sin tocar el avatar).
 * Si el custom element `<ego-avatar>` está inerte o a medio registrar
 * (vendor 404 / registro parcial del worker paralelo), React lanza al
 * actualizar sus props en commit y SIN boundary desmonta TODO el árbol
 * (incluidas las tarjetas HITL — verificado en prístino). Este boundary lo
 * contiene a un placeholder estable; con el vendor sano nunca se activa.
 */
export class AvatarSafe extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(): void {
    // Intencionalmente sin console.error: la causa raíz es del worker
    // paralelo (FIND-12-01) y el orquestador la verifica por separado.
  }

  render(): ReactNode {
    if (this.state.failed) return <div data-avatar-fallback="true" aria-hidden="true" />;
    return this.props.children;
  }
}

export function FloatingApp() {
  const [snapshot, setSnapshot] = useState<FloatingStateSnapshot>(INITIAL_STATE);
  const [approval, setApproval] = useState<ApprovalData | null>(null);
  const [headerView, setHeaderView] = useState<HeaderView>("overview");
  const [collapseAtMs, setCollapseAtMs] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [, bumpSteps] = useState(0);

  const attention = snapshot.attentionState;
  const approvalRef = useRef<ApprovalData | null>(null);
  approvalRef.current = approval;

  useEffect(() => {
    const bridge = window.egoFloating;
    if (!bridge) return;
    return bridge.onState((next) => {
      setSnapshot(next);
    });
  }, []);

  // Payload real del HITL vía el canal existente `ipc.approval.request`
  // (preload `onApprovalRequest`); sin él rige el fallback `floating-preview`.
  useEffect(() => {
    const ego = readEgoBridge();
    if (!ego || typeof ego.onApprovalRequest !== "function") return;
    return ego.onApprovalRequest((req: unknown) => {
      if (!isRecord(req) || typeof req["approvalId"] !== "string") return;
      const toolName = typeof req["toolName"] === "string" ? req["toolName"] : "Ego";
      const args = isRecord(req["arguments"]) ? req["arguments"] : undefined;
      setApproval({
        approvalId: req["approvalId"] as string,
        toolName,
        command: commandFor(toolName, args),
      });
    });
  }, []);

  // Countdown canónico 15s: se arma al salir de hidden, se limpia al volver.
  // Reloj `performance.now()` (misma época que el timestamp del rAF que lo
  // consume; `Date.now()` es otra época y dejaría la barra en 0 para siempre).
  useEffect(() => {
    if (attention === "hidden") {
      setCollapseAtMs(null);
      return;
    }
    setCollapseAtMs((prev) => prev ?? performance.now() + COUNTDOWN_AUTOCLOSE_S * 1000);
  }, [attention]);

  // Pasos del overview: solo los drops alimentan el ticker (el snapshot no trae
  // steps; el feed de tareas del main es deuda futura — sin IPC nuevo aquí).
  const stepsRef = useRef<{ steps: string[]; index: number }>({ steps: [], index: 0 });

  const overviewHost = useMemo<ViewHost>(
    () =>
      buildOverview({
        getFocus: () => {
          const s = stepsRef.current;
          if (s.steps.length === 0) return null;
          return { id: "drop-queue", name: "Subidas", color: "#34D399", steps: s.steps, stepIndex: s.index };
        },
        getOthers: () => [],
        onFocus: noop,
      }),
    [],
  );

  const pushStep = useCallback(
    (label: string) => {
      const s = stepsRef.current;
      s.steps = [...s.steps.slice(-7), label];
      s.index = s.steps.length - 1;
      try {
        overviewHost.sync();
      } catch {
        /* no-op: ver StaticMount */
      }
      bumpSteps((n) => n + 1);
    },
    [overviewHost],
  );

  const handleDecide = useCallback((d: ApprovalDecision) => {
    const data = approvalRef.current ?? PREVIEW_APPROVAL;
    const p =
      d === "allow" ? window.egoFloating?.approve(data.approvalId) : window.egoFloating?.deny(data.approvalId);
    // Sin console.error: un id preview o un main caído rechazan en silencio.
    void p?.catch(noop);
  }, []);

  const approvalHost = useMemo<ViewHost>(
    () =>
      buildApproval({
        getData: () => approvalRef.current ?? PREVIEW_APPROVAL,
        onDecide: (d) => handleDecide(d),
      }),
    [handleDecide],
  );

  const questionHost = useMemo<ViewHost>(
    () =>
      buildQuestion({
        getData: () => PREVIEW_QUESTION,
        onAnswer: noop,
      }),
    [],
  );

  const headerHost = useMemo<ViewHost>(
    () =>
      buildHeader({
        view: headerView,
        onNavigate: (v) => setHeaderView(v),
        soundEnabled: !snapshot.muted,
        onToggleSound: () => {
          void toggleMuteRef.current();
        },
        onOpenSettings: noop,
      }),
    // Se reconstruye por vista/mute (buildHeader captura valores al construir).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [headerView, snapshot.muted],
  );

  const promptNote = useMemo<ViewHost>(() => buildNote(() => "Pregunta desde la ventana principal de Ego."), []);

  const countdownCtrl = useMemo(() => new CountdownController(), []);
  const countdownHost = useMemo<ViewHost>(() => ({ el: countdownCtrl.el, sync: noop }), [countdownCtrl]);

  const uploadCanvas = useMemo(
    () =>
      new UploadCanvas({
        ask: () => setHeaderView("overview"),
        cancel: () => {
          UploadSeq.deactivate();
          setHeaderView("overview");
        },
      }),
    [],
  );

  // Ingest existente: `window.ego.knowledge.ingest` (preload+main ya lo exponen).
  // Sin bridge → `{ok:false}` graceful; cada archivo emite ticks al ticker.
  const dropQueue = useMemo(
    () =>
      new DropQueue({
        ingest: async (req) => {
          try {
            const fn = readEgoBridge()?.knowledge?.ingest;
            if (!fn) return { ok: false, error: "bridge ausente" };
            const res = await fn({ filePath: req.filePath });
            return isRecord(res) && res["ok"] === true ? { ok: true } : { ok: false, error: "ingest no-ok" };
          } catch {
            return { ok: false, error: "ingest falló" };
          }
        },
        onStep: (label) => pushStep(label),
      }),
    [pushStep],
  );

  const toggleMute = useCallback(async () => {
    const next = !snapshot.muted;
    await window.egoFloating?.setMuted(next);
    setSnapshot((prev) => ({ ...prev, muted: next }));
  }, [snapshot.muted]);
  const toggleMuteRef = useRef(toggleMute);
  toggleMuteRef.current = toggleMute;

  // Canvas del drop: el dueño (este rAF) le da `draw` por frame mientras la
  // secuencia está activa; `UploadSeq` solo avanza por eventos de drag.
  const canvasSlotRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const slot = canvasSlotRef.current;
    if (!slot) return;
    slot.appendChild(uploadCanvas.el);
    return () => {
      uploadCanvas.el.remove();
    };
  }, [uploadCanvas]);

  // Un solo rAF: ticker + countdown + upload. Detenido en hidden (0% CPU idle).
  useEffect(() => {
    if (attention === "hidden") return;
    let raf = 0;
    const frame = (t: number): void => {
      try {
        overviewHost.tick?.(t);
      } catch {
        /* no-op */
      }
      try {
        countdownCtrl.update(t, collapseAtMs, {});
      } catch {
        /* no-op */
      }
      try {
        if (UploadSeq.isActive) uploadCanvas.draw(UploadSeq.frame(), t / 1000);
      } catch {
        /* no-op */
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [attention, collapseAtMs, overviewHost, countdownCtrl, uploadCanvas]);

  // FIND-11-02: Escape colapsa la VISTA local (expanded/alert/hitl_approval ->
  // compact; compact -> hidden; hidden = no-op). Solo vista: no resuelve ni
  // rechaza HITL (sin llamadas a approve/deny; el pending sigue en main).
  // Coherente con AttentionStateMachine expanded->compact->hidden. Patrón
  // ActivityTray (ActivityTray.tsx:102-110), adaptado: sin trigger externo,
  // el foco cae al mute (único control persistente). Solo Escape: Tab/Enter
  // intactos (Enter idempotente en views.tsx:317).
  const muteRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (snapshot.attentionState === "hidden") return;
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      const next = snapshot.attentionState === "compact" ? "hidden" : "compact";
      setSnapshot((prev) =>
        prev.attentionState === "hidden" ? prev : { ...prev, attentionState: next },
      );
      muteRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [snapshot.attentionState]);

  // FIND-12-02: Enter aprueba sobre la tarjeta montada. Solo en hitl_approval;
  // con foco en un control nativo se deja el comportamiento nativo (el builder
  // es idempotente — views.tsx:317 — así que Enter+click no duplican).
  useEffect(() => {
    if (snapshot.attentionState !== "hitl_approval") return;
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key !== "Enter" || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "BUTTON" || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT"))
        return;
      const btn = document.querySelector("#approval-card .ego-approve-btn") as HTMLButtonElement | null;
      if (!btn || btn.disabled) return;
      e.preventDefault();
      btn.click();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [snapshot.attentionState]);

  const seqActiveRef = useRef(false);
  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
    if (!seqActiveRef.current) {
      seqActiveRef.current = true;
      UploadSeq.enterZone(e.clientX, e.clientY);
    } else {
      UploadSeq.updateCursor(e.clientX, e.clientY);
    }
  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // La isla queda abierta por spec (exitZone no-op): solo se apaga el realce.
    if (e.currentTarget === e.target) setDragOver(false);
  }, []);
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      seqActiveRef.current = false;
      const files = Array.from(e.dataTransfer?.files ?? []);
      const first = files[0] as unknown as { name?: unknown; path?: unknown } | undefined;
      const name = first && typeof first.name === "string" && first.name.length > 0 ? first.name : "archivo";
      uploadCanvas.setFile({ name });
      UploadSeq.performDrop(2.4);
      const paths = files
        .map((f) => (f as unknown as { path?: unknown }).path)
        .filter((p): p is string => typeof p === "string" && p.length > 0);
      if (paths.length > 0) {
        void dropQueue.dropInZone(paths).catch(noop);
      } else {
        // File web sin path (browser): sin ingest (exige filePath), solo tick.
        pushStep(`Recibido ${name}`);
      }
    },
    [dropQueue, pushStep, uploadCanvas],
  );

  const showTicker = attention !== "hidden";
  const showApproval = attention === "hitl_approval" || attention === "alert";
  const showCountdown = attention !== "hidden";
  const approvalKey = approval?.approvalId ?? "floating-preview";
  const tickerKey = `${attention}`;

  return (
    <main
      data-attention={snapshot.attentionState}
      data-muted={snapshot.muted}
      className="relative flex flex-col items-center justify-center p-3.5 rounded-3xl bg-zinc-950/80 backdrop-blur-xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.45)] ring-1 ring-white/5 transition-all duration-300 select-none overflow-hidden"
    >
      <style>{`
        main[data-attention] {
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        #status-pill {
          margin-top: 6px;
          padding: 2px 8px;
          border-radius: 9999px;
          font-size: 10px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.85);
          letter-spacing: 0.02em;
        }
        button[data-mute] {
          margin-top: 8px;
          padding: 3px 10px;
          border-radius: 6px;
          font-size: 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.65);
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }
        button[data-mute]:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #ffffff;
        }
      `}</style>
      <AvatarSafe>
        <FloatingAvatar
          attentionState={snapshot.attentionState}
          subEgoId={snapshot.activeSubEgoId ?? null}
          size={120}
        />
      </AvatarSafe>
      <div id="status-pill">{labelFor(snapshot.attentionState)}</div>
      <div id="floating-header-slot">
        <StaticMount id="floating-header-slot" host={headerHost} mountKey={`${headerView}:${snapshot.muted}`} visible={showTicker} />
      </div>
      {headerView === "prompt" ? (
        <div id="floating-prompt-slot">
          <StaticMount id="floating-prompt-slot" host={promptNote} mountKey="prompt" visible={showTicker} />
        </div>
      ) : null}
      {/* Ticker/overview (Task6 StepTicker) en el mount estable #ticker. */}
      <StaticMount id="ticker" host={overviewHost} mountKey={tickerKey} visible={showTicker && headerView === "overview"} />
      {/* Approval/question (Task6) en el mount estable #approval-card. */}
      {attention === "hitl_approval" ? (
        <StaticMount id="approval-card" host={approvalHost} mountKey={`approval:${approvalKey}`} visible={showApproval} />
      ) : attention === "alert" ? (
        <StaticMount id="approval-card" host={questionHost} mountKey="question:preview" visible={showApproval} />
      ) : null}
      {/* Countdown (Task6) en el mount estable #countdown. */}
      <StaticMount id="countdown" host={countdownHost} mountKey="countdown" visible={showCountdown} />
      {/* Zona drop (Task9 UploadCanvas + DropQueue → knowledge.ingest existente). */}
      <div
        data-dropzone="true"
        data-active={dragOver}
        role="region"
        aria-label="Soltar archivos para subir"
        onDragEnter={onDragEnter}
        onDragOver={onDragEnter}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div ref={canvasSlotRef} data-canvas-slot="true" />
      </div>
      <button ref={muteRef} type="button" data-mute="true" onClick={toggleMute} aria-pressed={snapshot.muted}>
        {snapshot.muted ? "Silenciado" : "Sonido"}
      </button>
    </main>
  );
}

/** Entrada del flotante: monta una sola vez (Task6 añade ViewHost aquí). */
export function mountFloating(el: HTMLElement): () => void {
  const root = createRoot(el);
  root.render(<FloatingApp />);
  return () => {
    root.unmount();
  };
}

const host = typeof document !== "undefined" ? document.getElementById("floating-root") : null;
if (host) {
  mountFloating(host);
}
