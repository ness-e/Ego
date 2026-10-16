// views.tsx — Vistas del flotante (Task 6, WIDG-02/CANV-11).
//
// Port del MECANISMO de `repos-referencia/coucou/windows/src/views/views.ts`
// (MIT, (c) Louis Raillart): `ViewHost{el/sync/tick/focus}`, overview con
// ticker-vs-card, pill-badge, approval con botones construidos 1 vez, question,
// error/finished/confused/note, header con tabs, MiniGrid compacto. Solo
// mecanismo: DOM propio con clases `ego-*`, textos Ego en español, SIN iconos
// coucou, SIN Mochi/minibots, SIN notch (la geometría vive en floating-anim.ts).
//
// Diseño Ego (difiere de coucou a propósito):
// - Builders PUROS `(data, actions)`: sin singleton global de estado. El
//   renderer es presentación (`apps/desktop/AGENTS.md`); los datos entran por
//   providers y las decisiones salen por callbacks que Task7 puentea a
//   `egoFloating.approve/deny` + `WidgetHitlBridge`.
// - `ApprovalData` alinea con `WidgetPresentationRequest`
//   (`packages/execution/src/WidgetHitlBridge.ts:4-17`); Task7 deriva
//   `command` (línea display) de `arguments`.
// - Question 1-4 preguntas / 2-4 opciones (plan Task 6): respondible inline
//   vía onAnswer (Ego sí responde; coucou delegaba al terminal).

import { createElement, useEffect, useRef, type ReactElement } from "react";
import { StepTicker } from "./ticker.js";

/** Contrato mínimo de una vista viva (coucou views.ts:31-38). */
export interface ViewHost {
  el: HTMLElement;
  sync(): void;
  /** Foco de teclado al activarse (solo vistas con campo/botón principal). */
  focus?(): void;
  /** Avance por frame mientras la vista está visible (ticker/countdown). */
  tick?(nowMs: number): void;
}

export type FloatingViewName =
  | "overview"
  | "empty"
  | "approval"
  | "question"
  | "error"
  | "finished"
  | "confused"
  | "note";

export type PillBadge = "approval" | "finished" | "error";

export interface TaskPill {
  id: string;
  name: string;
  color: string;
  pillBadge?: PillBadge;
}

export interface FocusTask extends TaskPill {
  steps: string[];
  stepIndex: number;
}

/** Línea display + identidad para aprobar (alinea WidgetPresentationRequest). */
export interface ApprovalData {
  approvalId: string;
  toolName: string;
  /** Línea exacta que se autoriza (comando, path o URL) — Task7 la deriva. */
  command: string;
  riskLevel?: string;
  taskName?: string;
  taskColor?: string;
}

export type ApprovalDecision = "allow" | "deny";

export interface QuestionItem {
  id: string;
  text: string;
  /** 2–4 opciones (el builder recorta a 4). */
  options: string[];
}

export interface QuestionData {
  id: string;
  title: string;
  /** 1–4 preguntas (el builder recorta a 4). */
  questions: QuestionItem[];
}

export type HeaderView = "overview" | "prompt" | "upload" | "settings";

// --- Piezas compartidas (DOM propio, clases ego-*) ---

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function btn(
  label: string,
  kind: "primary" | "secondary",
  cls: string,
  onClick: () => void,
  kbd?: string,
): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `ego-btn ${kind} ${cls}`;
  const span = el("span", undefined, label);
  b.append(span);
  if (kbd) b.append(el("span", "ego-kbd", kbd));
  b.addEventListener("click", onClick);
  return b;
}

function dot(color: string, size: number): HTMLElement {
  const d = el("span", "ego-dot");
  d.style.width = `${size}px`;
  d.style.height = `${size}px`;
  d.style.background = color;
  return d;
}

function clear(node: HTMLElement): void {
  node.replaceChildren();
}

// --- Pill (badge solo si focusId != id) ---

export function buildPill(
  task: TaskPill,
  opts: { focused: boolean; onFocus: (id: string) => void },
): HTMLElement {
  const pill = el("div", "ego-pill");
  pill.style.borderColor = `${task.color}24`;
  pill.append(dot(task.color, 8), el("span", "ego-pill-label", task.name));
  pill.addEventListener("click", () => opts.onFocus(task.id));
  // Suprimida en foco: evita ruido sobre la tarea que ya se está mirando.
  if (task.pillBadge && !opts.focused) {
    const colors = { approval: "#F5A524", finished: "#22C55E", error: "#F4505E" } as const;
    const badge = el("div", "ego-pill-badge");
    const inner = el("i", undefined, task.pillBadge === "approval" ? "!" : task.pillBadge === "finished" ? "✓" : "×");
    inner.style.background = colors[task.pillBadge];
    badge.append(inner);
    pill.append(badge);
  }
  return pill;
}

/** MiniGrid compacto 2x2 (máx 4 tareas, coucou island.ts:863-877). */
export function buildCompactMiniGrid(
  tasks: TaskPill[],
  onFocus: (id: string) => void,
): HTMLElement {
  const grid = el("div", "ego-minigrid");
  grid.dataset.cols = "2";
  for (const t of tasks.slice(0, 4)) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "ego-minicell";
    cell.title = t.name;
    cell.append(dot(t.color, 13));
    cell.addEventListener("click", () => onFocus(t.id));
    grid.append(cell);
  }
  return grid;
}

// --- Header (tabs overview/prompt/upload + settings/sound) ---

export function buildHeader(opts: {
  view: HeaderView;
  onNavigate: (v: HeaderView) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenSettings: () => void;
}): ViewHost {
  const tabs: Array<{ v: HeaderView; label: string }> = [
    { v: "overview", label: "Resumen" },
    { v: "prompt", label: "Preguntar" },
    { v: "upload", label: "Subir" },
  ];
  const tabBtns = tabs.map(({ v, label }) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ego-tab";
    b.dataset.view = v;
    b.textContent = label;
    b.addEventListener("click", () => opts.onNavigate(v));
    return b;
  });
  const soundBtn = document.createElement("button");
  soundBtn.type = "button";
  soundBtn.className = "ego-sound-btn";
  soundBtn.setAttribute("aria-label", "Audio cabecera");
  soundBtn.addEventListener("click", () => opts.onToggleSound());
  const settingsBtn = document.createElement("button");
  settingsBtn.type = "button";
  settingsBtn.className = "ego-settings-btn";
  settingsBtn.textContent = "Ajustes";
  settingsBtn.addEventListener("click", () => opts.onOpenSettings());

  const host = el("div", "ego-header");
  const tabRow = el("div", "ego-tabs");
  tabRow.append(...tabBtns);
  const actions = el("div", "ego-header-actions");
  actions.append(soundBtn, settingsBtn);
  host.append(tabRow, actions);

  return {
    el: host,
    sync() {
      for (const b of tabBtns) b.classList.toggle("on", b.dataset.view === opts.view);
      settingsBtn.classList.toggle("on", opts.view === "settings");
      soundBtn.textContent = opts.soundEnabled ? "Audio" : "Mudo";
      soundBtn.setAttribute("aria-pressed", String(opts.soundEnabled));
    },
  };
}

// --- Overview (ticker + pills) ---

export function buildOverview(opts: {
  getFocus: () => FocusTask | null;
  getOthers: () => TaskPill[];
  onFocus: (id: string) => void;
  onOpenTarget?: () => void;
}): ViewHost {
  const ticker = new StepTicker();
  const who = el("div", "ego-who");
  const tickerSlot = el("div", "ego-ticker-slot");
  tickerSlot.append(who, ticker.el);
  const pills = el("div", "ego-pills");
  const host = el("div", "ego-view ego-overview");
  const left = el("div", "ego-card ego-left");
  left.append(tickerSlot);
  if (opts.onOpenTarget) {
    const jump = document.createElement("button");
    jump.type = "button";
    jump.className = "ego-jump";
    jump.title = "Abrir";
    jump.textContent = "↗";
    const target = opts.onOpenTarget;
    jump.addEventListener("click", target);
    left.append(jump);
  }
  const right = el("div", "ego-card ego-right");
  right.append(pills);
  host.append(left, right);

  let pillKey = "";
  let lastFocusId: string | null = "__none__";
  let lastFocusKey = "";

  return {
    el: host,
    tick(nowMs: number) {
      ticker.tick(nowMs);
    },
    sync() {
      const focus = opts.getFocus();
      if (focus?.id !== lastFocusId) {
        lastFocusId = focus?.id ?? null;
        lastFocusKey = "";
        ticker.sync(null); // re-seed: la sesión anterior no scrollea
      }
      if (focus && focus.steps.length > 0) {
        const key = `${focus.id}~${focus.stepIndex}~${focus.steps.join("|")}`;
        if (key !== lastFocusKey) {
          lastFocusKey = key;
          // Nombre + herramienta de la tarea en foco.
          clear(who);
          who.append(dot(focus.color, 7), el("span", "ego-who-name", focus.name));
          if (focus.steps.length > 1) {
            who.append(
              el("span", "ego-who-count", `${Math.min(focus.stepIndex + 1, focus.steps.length)}/${focus.steps.length}`),
            );
          }
        }
        ticker.sync({ steps: focus.steps, stepIndex: focus.stepIndex });
        tickerSlot.style.display = "";
      } else {
        clear(who);
        who.append(el("span", "ego-who-idle", "Nada en curso."));
        tickerSlot.style.display = "";
        ticker.sync(null);
      }

      const others = opts.getOthers().slice(0, 4);
      const key = others.map((t) => `${t.id}:${t.pillBadge ?? ""}:${t.id === lastFocusId}`).join("|");
      if (key !== pillKey) {
        pillKey = key;
        clear(pills);
        for (const t of others) {
          pills.append(buildPill(t, { focused: t.id === lastFocusId, onFocus: opts.onFocus }));
        }
      }
    },
  };
}

// --- Approval (botones construidos 1 vez + idempotente) ---

export function buildApproval(
  opts: { getData: () => ApprovalData; onDecide: (d: ApprovalDecision) => void },
): ViewHost {
  const who = el("div", "ego-who");
  const code = el("div", "ego-code");
  const row = el("div", "ego-actions");
  const host = el("div", "ego-view ego-approval");
  const card = el("div", "ego-card ego-wash-amber");
  card.append(who, code, row);
  host.append(card);

  let builtFor: string | null = null;
  let decided = false;
  let allowBtn: HTMLButtonElement | null = null;
  let denyBtn: HTMLButtonElement | null = null;

  function decide(d: ApprovalDecision): void {
    if (decided) return; // idempotente: doble-click / Enter+click no duplican
    decided = true;
    if (allowBtn) allowBtn.disabled = true;
    if (denyBtn) denyBtn.disabled = true;
    opts.onDecide(d);
  }

  return {
    el: host,
    focus() {
      allowBtn?.focus();
    },
    sync() {
      const data = opts.getData();
      // Nueva aprobación: re-habilita (los botones se reconstruyen 1 vez por id).
      if (data.approvalId !== builtFor) {
        builtFor = data.approvalId;
        decided = false;
        clear(row);
        denyBtn = btn("Denegar", "secondary", "ego-deny-btn", () => decide("deny"), "N");
        allowBtn = btn("Permitir", "primary", "ego-approve-btn", () => decide("allow"), "Y");
        row.append(denyBtn, allowBtn);
      }
      clear(who);
      who.append(dot("#F5A524", 8), el("span", "ego-who-name", data.taskName ?? data.toolName));
      who.append(el("span", "ego-who-label", "necesita permiso"));
      // La línea que se autoriza: comando/path/URL exacto, no solo el tool.
      code.textContent = data.command || data.toolName || "…";
    },
  };
}

// --- Question (1-4 preguntas / 2-4 opciones, respuesta inline) ---

export function buildQuestion(opts: {
  getData: () => QuestionData;
  onAnswer: (questionId: string, optionIndex: number) => void;
}): ViewHost {
  const title = el("div", "ego-title");
  const list = el("div", "ego-qlist");
  const host = el("div", "ego-view ego-question");
  const card = el("div", "ego-card ego-wash-cyan");
  card.append(title, list);
  host.append(card);

  let builtFor: string | null = null;
  const answered = new Set<string>();

  return {
    el: host,
    sync() {
      const data = opts.getData();
      if (data.id !== builtFor) {
        builtFor = data.id;
        answered.clear();
        title.textContent = data.title;
        clear(list);
        for (const q of data.questions.slice(0, 4)) {
          const block = el("div", "ego-qblock");
          block.append(el("div", "ego-qtext", q.text));
          const optsRow = el("div", "ego-qopts");
          q.options.slice(0, 4).forEach((text, i) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "ego-qopt";
            b.textContent = text;
            b.addEventListener("click", () => {
              if (answered.has(q.id)) return;
              answered.add(q.id);
              for (const sib of optsRow.querySelectorAll("button")) {
                (sib as HTMLButtonElement).disabled = true;
              }
              opts.onAnswer(q.id, i);
            });
            optsRow.append(b);
          });
          block.append(optsRow);
          list.append(block);
        }
      }
    },
  };
}

// --- Error / Finished / Confused / Note ---

export function buildError(opts: {
  getTitle: () => string;
  getDetail: () => string;
  onRetry?: () => void;
  onOpen?: () => void;
}): ViewHost {
  const title = el("div", "ego-title");
  const detail = el("div", "ego-detail");
  const row = el("div", "ego-actions");
  if (opts.onRetry) {
    const retry = opts.onRetry;
    row.append(btn("Reintentar", "primary", "ego-retry-btn", retry));
  }
  if (opts.onOpen) {
    const open = opts.onOpen;
    row.append(btn("Abrir", "secondary", "ego-open-btn", open));
  }
  const host = el("div", "ego-view ego-error");
  const card = el("div", "ego-card ego-wash-red");
  card.append(title, detail, row);
  host.append(card);
  return {
    el: host,
    sync() {
      title.textContent = opts.getTitle();
      detail.textContent = opts.getDetail();
    },
  };
}

export function buildFinished(opts: {
  getTitle: () => string;
  onOpenTerminal?: () => void;
  onCollapse?: () => void;
}): ViewHost {
  const title = el("div", "ego-title");
  const row = el("div", "ego-actions");
  if (opts.onOpenTerminal) {
    const open = opts.onOpenTerminal;
    row.append(btn("Abrir terminal", "primary", "ego-terminal-btn", open));
  }
  if (opts.onCollapse) {
    const collapse = opts.onCollapse;
    row.append(btn("OK", "secondary", "ego-ok-btn", collapse));
  }
  const host = el("div", "ego-view ego-finished");
  const card = el("div", "ego-card ego-wash-green");
  card.append(title, row);
  host.append(card);
  return {
    el: host,
    sync() {
      title.textContent = opts.getTitle();
    },
  };
}

export function buildConfused(): ViewHost {
  const host = el("div", "ego-view ego-confused");
  const card = el("div", "ego-card ego-wash-pink");
  card.append(
    el("div", "ego-title", "Demasiadas señales a la vez."),
    el("div", "ego-sub", "Dame un segundo…"),
  );
  host.append(card);
  return { el: host, sync() {} };
}

export function buildNote(getMessage: () => string): ViewHost {
  const title = el("div", "ego-title");
  const host = el("div", "ego-view ego-note");
  const card = el("div", "ego-card");
  card.append(title);
  host.append(card);
  return {
    el: host,
    sync() {
      title.textContent = getMessage();
    },
  };
}

export function buildEmpty(opts: { onAsk: () => void }): ViewHost {
  const host = el("div", "ego-view ego-empty");
  const card = el("div", "ego-card");
  const body = el("div", "ego-empty-body");
  body.append(
    el("div", "ego-title", "Nada en curso."),
    el("div", "ego-sub", "Suelta un archivo o pregúntame algo."),
  );
  const ask = opts.onAsk;
  body.append(btn("Preguntar", "primary", "ego-ask-btn", ask));
  card.append(body);
  host.append(card);
  return { el: host, sync() {} };
}

// --- Registry (Task7 lo monta y alterna por vista activa) ---

export interface ViewsDeps {
  overview: Parameters<typeof buildOverview>[0];
  header: Parameters<typeof buildHeader>[0];
  approval: Parameters<typeof buildApproval>[0];
  question: Parameters<typeof buildQuestion>[0];
  error: Parameters<typeof buildError>[0];
  finished: Parameters<typeof buildFinished>[0];
  note: () => string;
  onAsk: () => void;
}

export function buildViews(deps: ViewsDeps): Map<FloatingViewName, ViewHost> {
  const map = new Map<FloatingViewName, ViewHost>();
  map.set("overview", buildOverview(deps.overview));
  map.set("empty", buildEmpty({ onAsk: deps.onAsk }));
  map.set("approval", buildApproval(deps.approval));
  map.set("question", buildQuestion(deps.question));
  map.set("error", buildError(deps.error));
  map.set("finished", buildFinished(deps.finished));
  map.set("confused", buildConfused());
  map.set("note", buildNote(deps.note));
  return map;
}

/** Monta un ViewHost dentro de un contenedor React (Task7/floating.tsx). */
export function ViewMount({ host }: { host: ViewHost }): ReactElement {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const slot = ref.current;
    if (!slot) return;
    slot.appendChild(host.el);
    host.sync();
    return () => {
      host.el.remove();
    };
  }, [host]);
  return createElement("div", { className: "ego-view-slot", ref });
}
