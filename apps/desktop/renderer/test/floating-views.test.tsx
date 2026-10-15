import { describe, it, expect } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

// S1 RED: estos módulos no existen todavía → FAIL (`Cannot find module`
// o `buildApproval is not a function`). GREEN los crea (S2–S4).
import { buildApproval, buildQuestion, buildPill, buildHeader, buildOverview } from "../floating/views.js";
import { StepTicker, TICKER_ROW_H, TICKER_DURATION_MS, TICKER_MAX_QUEUE } from "../floating/ticker.js";
import {
  countdownWindowS,
  countdownWidthPx,
  CountdownController,
  COUNTDOWN_AUTOCLOSE_S,
  COUNTDOWN_BAR_PX,
} from "../floating/countdown.js";

describe("Task6: ticker (port mecanismo coucou/views/ticker.ts)", () => {
  it("constantes del contrato: ROW_H 22 / DURATION 380 / MAX_QUEUE 4", () => {
    expect(TICKER_ROW_H).toBe(22);
    expect(TICKER_DURATION_MS).toBe(380);
    expect(TICKER_MAX_QUEUE).toBe(4);
  });

  it("sync encola steps y tick avanza current→completed sin CSS transitions", () => {
    const t = new StepTicker();
    expect(typeof t.sync).toBe("function");
    expect(typeof t.tick).toBe("function");
    t.sync({ steps: ["a", "b"], stepIndex: 0 });
    expect(t.currentText).toBe("a");
    t.sync({ steps: ["a", "b"], stepIndex: 1 });
    // Drena la animación con el reloj del ticker (JS-driven, no timers).
    let guard = 0;
    t.tick(1_000);
    while (t.animating && guard++ < 50) t.tick(1_000 + guard * 100);
    expect(t.currentText).toBe("b");
    const rows = t.el.querySelectorAll(".ego-ticker-row");
    expect(rows.length).toBe(3);
    for (const r of rows) expect((r as HTMLElement).style.transition).toBe("");
  });

  it("queue overflow descarta oldest (se queda con los últimos MAX_QUEUE)", () => {
    const t = new StepTicker();
    t.sync({ steps: ["s0"], stepIndex: 0 });
    // Ráfaga de 6 steps sin tick intermedio: solo caben 4 en cola.
    t.sync({ steps: ["s0", "s1", "s2", "s3", "s4", "s5", "s6"], stepIndex: 6 });
    expect(t.queueLength).toBeLessThanOrEqual(TICKER_MAX_QUEUE);
    let now = 10_000;
    let guard = 0;
    while (t.animating && guard++ < 50) {
      now += 500;
      t.tick(now);
    }
    expect(t.currentText).toBe("s6");
  });
});

describe("Task6: approval view (botones 1 vez + idempotente)", () => {
  it("expone approve/deny y muestra la línea del comando", () => {
    const host = buildApproval({
      getData: () => ({ approvalId: "r1", toolName: "Bash", command: "rm -rf /tmp/x", riskLevel: "high" }),
      onDecide: () => {},
    });
    host.sync();
    expect(host.el.querySelector(".ego-approve-btn")).not.toBeNull();
    expect(host.el.querySelector(".ego-deny-btn")).not.toBeNull();
    expect(host.el.textContent).toContain("rm -rf /tmp/x");
  });

  it("no reconstruye botones en re-sync (no traga click) y doble-click es idempotente", () => {
    let calls = 0;
    const host = buildApproval({
      getData: () => ({ approvalId: "r1", toolName: "Bash", command: "ls" }),
      onDecide: () => calls++,
    });
    host.sync();
    host.sync();
    host.sync();
    expect(host.el.querySelectorAll("button").length).toBe(2);
    const allow = host.el.querySelector(".ego-approve-btn") as HTMLButtonElement;
    allow.click();
    allow.click();
    expect(calls).toBe(1);
    expect(allow.disabled).toBe(true);
  });

  it("deny resuelve deny una sola vez", () => {
    const seen: string[] = [];
    const host = buildApproval({
      getData: () => ({ approvalId: "r2", toolName: "Write", command: "f.txt" }),
      onDecide: (d) => seen.push(d),
    });
    host.sync();
    (host.el.querySelector(".ego-deny-btn") as HTMLButtonElement).click();
    expect(seen).toEqual(["deny"]);
  });
});

describe("Task6: question view (1-4q / 2-4opts)", () => {
  it("renderiza título + opciones y responde inline", () => {
    const answered: Array<{ q: string; o: number }> = [];
    const host = buildQuestion({
      getData: () => ({
        id: "q1",
        title: "¿Cómo continúo?",
        questions: [{ id: "q1a", text: "Elige ruta", options: ["A", "B", "C"] }],
      }),
      onAnswer: (q, o) => answered.push({ q, o }),
    });
    host.sync();
    expect(host.el.textContent).toContain("¿Cómo continúo?");
    const opts = host.el.querySelectorAll(".ego-qopt");
    expect(opts.length).toBe(3);
    (opts[1] as HTMLButtonElement).click();
    expect(answered).toEqual([{ q: "q1a", o: 1 }]);
  });
});

describe("Task6: pill badge solo si focusId != id", () => {
  const task = { id: "t1", name: "Dev", color: "#22C55E", pillBadge: "approval" as const };
  it("muestra badge cuando NO tiene foco", () => {
    const pill = buildPill(task, { focused: false, onFocus: () => {} });
    expect(pill.querySelector(".ego-pill-badge")).not.toBeNull();
  });
  it("suprime badge cuando tiene foco", () => {
    const pill = buildPill(task, { focused: true, onFocus: () => {} });
    expect(pill.querySelector(".ego-pill-badge")).toBeNull();
  });
});

describe("Task6: header tabs overview/prompt/upload + settings/sound", () => {
  it("marca tab activo y dispara navegación", () => {
    const seen: string[] = [];
    const host = buildHeader({
      view: "prompt",
      onNavigate: (v) => seen.push(v),
      soundEnabled: true,
      onToggleSound: () => {},
      onOpenSettings: () => {},
    });
    host.sync();
    const tabs = host.el.querySelectorAll(".ego-tab");
    expect(tabs.length).toBe(3);
    expect(host.el.querySelector(".ego-tab.on")?.getAttribute("data-view")).toBe("prompt");
    expect(host.el.querySelector(".ego-sound-btn")).not.toBeNull();
    expect(host.el.querySelector(".ego-settings-btn")).not.toBeNull();
    (tabs[0] as HTMLButtonElement).click();
    expect(seen).toEqual(["overview"]);
  });
});

describe("Task6: overview integra ticker + pills", () => {
  it("ticker muestra step actual y tick avanza por frames", () => {
    const host = buildOverview({
      getFocus: () => ({
        id: "t1",
        name: "Dev",
        color: "#22C55E",
        steps: ["uno", "dos"],
        stepIndex: 0,
      }),
      getOthers: () => [],
      onFocus: () => {},
    });
    host.sync();
    expect(host.el.querySelector(".ego-ticker")).not.toBeNull();
    expect(typeof host.tick).toBe("function");
  });
});

describe("Task6: countdown (window=min(10,autoClose*0.6), bar 160px)", () => {
  it("autoClose default 15s y bar 160px", () => {
    expect(COUNTDOWN_AUTOCLOSE_S).toBe(15);
    expect(COUNTDOWN_BAR_PX).toBe(160);
  });

  it("window = min(10, autoClose*0.6)", () => {
    expect(countdownWindowS(15)).toBeCloseTo(9);
    expect(countdownWindowS(30)).toBe(10);
  });

  it("ancho proporcional dentro de la ventana, 0 fuera/expirado", () => {
    expect(countdownWidthPx(8.1, 15)).toBeCloseTo(144);
    expect(countdownWidthPx(4.5, 15)).toBeCloseTo(80);
    expect(countdownWidthPx(10, 15)).toBe(0);
    expect(countdownWidthPx(-1, 15)).toBe(0);
  });

  it("controller expira a 0 y respeta pinned", () => {
    const c = new CountdownController();
    c.update(1_000, 20_000, { autoCloseS: 15 });
    expect(c.el.style.width).toBe("0px"); // lejos del colapso: oculta
    c.update(19_500, 20_000, { autoCloseS: 15 }); // 0.5s restantes < window 9s
    expect(parseFloat(c.el.style.width)).toBeGreaterThan(0);
    c.update(21_000, 20_000, { autoCloseS: 15 }); // expirado
    expect(c.el.style.width).toBe("0px");
    c.update(19_500, 20_000, { autoCloseS: 15, pinned: true });
    expect(c.el.style.width).toBe("0px");
  });
});

describe("Task6: CountdownBar React smoke", () => {
  it("monta sin romper", async () => {
    const { CountdownBar } = await import("../floating/countdown.js");
    let root: Root | null = null;
    const host = document.createElement("div");
    document.body.appendChild(host);
    try {
      root = createRoot(host);
      await act(async () => {
        root?.render(createElement(CountdownBar, { collapseAtMs: null }));
      });
      expect(host.querySelector(".ego-countdown")).not.toBeNull();
    } finally {
      if (root) await act(async () => root?.unmount());
      host.remove();
    }
  });
});
