import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventIngress } from "../src/EventIngress.js";
import { EventBus } from "../src/EventBus.js";

describe("COUC-02: EventIngress No Bloqueante por Defecto", () => {
  let eventBus: EventBus;
  let ingress: EventIngress;

  beforeEach(() => {
    eventBus = new EventBus();
    ingress = new EventIngress(eventBus, 500); // 500ms timeout en tests
  });

  it("despacha eventos informativos de forma fire-and-forget retornando inmediatamente status 'accepted'", async () => {
    let busReceived = false;
    eventBus.on("tool.executed", () => {
      busReceived = true;
    });

    const result = await ingress.ingressRaw("PostToolUse", {
      tool: "fs_read_file",
      result: "content",
      durationMs: 12,
    });

    expect(result.status).toBe("accepted");
    expect(result.isInteractive).toBe(false);
    expect(result.durationMs).toBeLessThan(100);

    // Dar tiempo para la microtarea/emisión asíncrona
    await new Promise((r) => setTimeout(r, 10));
    expect(busReceived).toBe(true);
  });

  it("retiene síncronamente solicitudes interactivas (approval.required) esperando resolución", async () => {
    const promise = ingress.ingressRaw("PermissionRequest", {
      requestId: "appr_123",
      action: "fs_write_file",
      riskLevel: "destructive",
    });

    expect(ingress.getPendingInteractiveCount()).toBe(1);

    // Resolver la interacción pendiente
    const resolved = ingress.resolveInteractive({
      approvalId: "appr_123",
      approved: true,
      decision: "allow",
      resolvedBy: "admin-user",
    });

    expect(resolved).toBe(true);
    const result = await promise;

    expect(result.status).toBe("resolved");
    expect(result.isInteractive).toBe(true);
    expect((result.decision as any)?.approved).toBe(true);
    expect((result.decision as any)?.decision).toBe("allow");
    expect(ingress.getPendingInteractiveCount()).toBe(0);
  });

  it("aplica fallback y resuelve con status 'timed_out' si expira el tiempo límite", async () => {
    const result = await ingress.ingressRaw(
      "PermissionRequest",
      { requestId: "appr_timeout" },
      { timeoutMs: 50, fallbackDecision: "ask" }
    );

    expect(result.status).toBe("timed_out");
    expect(result.isInteractive).toBe(true);
    expect((result.decision as any)?.approved).toBe(false);
    expect((result.decision as any)?.decision).toBe("ask");
    expect(ingress.getPendingInteractiveCount()).toBe(0);
  });

  it("cancela interacciones pendientes al invocar clearPending()", async () => {
    const p1 = ingress.ingressRaw("PermissionRequest", { requestId: "appr_a" }, { timeoutMs: 1000 });
    const p2 = ingress.ingressRaw("PermissionRequest", { requestId: "appr_b" }, { timeoutMs: 1000 });

    expect(ingress.getPendingInteractiveCount()).toBe(2);

    ingress.clearPending();
    expect(ingress.getPendingInteractiveCount()).toBe(0);

    const r1 = await p1;
    const r2 = await p2;
    expect(r1.status).toBe("rejected");
    expect(r2.status).toBe("rejected");
  });
});
