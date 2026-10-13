import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ActivityWidget } from "../components/activity-widget/ActivityWidget.js";
import { ego } from "../lib/ego.js";

describe("CANV-11: ActivityWidget — Telemetría reactiva y resoluciones HITL", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("debe iniciar en estado idle con 'VantaDB Core OK'", async () => {
    await act(async () => {
      root.render(<ActivityWidget />);
    });

    const idleWidget = container.querySelector('[data-testid="activity-idle"]');
    expect(idleWidget).not.toBeNull();
    expect(idleWidget?.textContent).toContain("VantaDB Core OK");
  });

  it("debe transicionar a estado working al recibir evento task.started", async () => {
    await act(async () => {
      root.render(<ActivityWidget />);
    });

    const bridge = ego() as any;

    await act(async () => {
      bridge.emitEvent({
        type: "task.started",
        payload: {
          subEgoId: "ego.developer",
          task: "Refactorizando",
        },
      });
    });

    const workingWidget = container.querySelector('[data-testid="activity-working"]');
    expect(workingWidget).not.toBeNull();
    expect(workingWidget?.textContent).toContain("ego.developer: Refactorizando");
  });

  it("debe conmutar a estado approval ante onApprovalRequest y permitir resolver", async () => {
    await act(async () => {
      root.render(<ActivityWidget />);
    });

    const bridge = ego() as any;

    const approvalReq = {
      approvalId: "app-hitl-99",
      action: {
        sessionId: "s-1",
        subEgoId: "ego.dev",
        toolName: "terminal_exec",
        callId: "c-1",
        inputDigest: "abc999",
        createdAt: Date.now(),
      },
      toolName: "terminal_exec",
      toolCategory: "terminal",
      riskLevel: "destructive",
      arguments: { command: "rm -rf build" },
      status: "pending",
      createdAt: Date.now(),
      expiresAt: Date.now() + 60000,
    };

    await act(async () => {
      bridge.emitApprovalRequest(approvalReq);
    });

    const approvalWidget = container.querySelector('[data-testid="activity-approval"]');
    expect(approvalWidget).not.toBeNull();
    expect(approvalWidget?.textContent).toContain("HITL Requerido");

    // Abrir modal con botón "Revisar"
    const reviewBtn = approvalWidget?.querySelector("button");
    expect(reviewBtn).not.toBeNull();

    await act(async () => {
      reviewBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Modal abierto
    const modal = document.querySelector('[role="dialog"]');
    expect(modal).not.toBeNull();
    expect(modal?.textContent).toContain("terminal_exec");

    // Click en botón Aprobar dentro del modal
    const approveBtn = Array.from(modal?.querySelectorAll("button") || []).find((b) =>
      b.textContent?.includes("Aprobar")
    );
    expect(approveBtn).toBeDefined();

    await act(async () => {
      approveBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(bridge.resolveApproval).toHaveBeenCalledWith({
      approvalId: "app-hitl-99",
      approved: true,
      reason: undefined,
    });
  });
});
