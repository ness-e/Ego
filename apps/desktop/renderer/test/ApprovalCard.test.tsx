import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ApprovalCard } from "../components/tools/ApprovalCard.js";
import type { PendingApprovalInfo } from "../lib/ego.js";

describe("CANV-12: ApprovalCard — Pruebas de Interacción HITL en Happy-DOM", () => {
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

  const mockRequest: PendingApprovalInfo = {
    approvalId: "app-test-1",
    action: {
      sessionId: "sess-1",
      subEgoId: "ego.developer",
      toolName: "fs_write_file",
      callId: "call-1",
      inputDigest: "abc123hash",
      createdAt: Date.now(),
    },
    toolName: "fs_write_file",
    toolCategory: "filesystem",
    riskLevel: "sensitive",
    arguments: {
      path: "src/new-feature.ts",
      content: "export const x = 1;",
    },
    status: "pending",
    createdAt: Date.now(),
    expiresAt: Date.now() + 60000,
  };

  it("debe renderizar detalles de la solicitud y riesgo sensitivo", async () => {
    const onResolve = vi.fn();

    await act(async () => {
      root.render(<ApprovalCard request={mockRequest} onResolve={onResolve} />);
    });

    expect(container.textContent).toContain("fs_write_file");
    expect(container.textContent).toContain("src/new-feature.ts");
    expect(container.textContent).toContain("Aprobar");
    expect(container.textContent).toContain("Rechazar");
  });

  it("debe llamar onResolve con approved=true al hacer click en Aprobar", async () => {
    const onResolve = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      root.render(<ApprovalCard request={mockRequest} onResolve={onResolve} />);
    });

    const approveButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Aprobar")
    );
    expect(approveButton).toBeDefined();

    await act(async () => {
      approveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onResolve).toHaveBeenCalledWith({ approved: true });
  });

  it("debe mostrar campo de motivo y rechazar con el motivo especificado", async () => {
    const onResolve = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      root.render(<ApprovalCard request={mockRequest} onResolve={onResolve} />);
    });

    const rejectButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Rechazar")
    );
    expect(rejectButton).toBeDefined();

    // Click inicial en Rechazar para abrir input de motivo
    await act(async () => {
      rejectButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const reasonInput = container.querySelector("input") as HTMLInputElement;
    expect(reasonInput).not.toBeNull();

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      nativeSetter?.call(reasonInput, "Ruta prohibida");
      reasonInput.dispatchEvent(new Event("input", { bubbles: true }));
      reasonInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const confirmRejectBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Confirmar Rechazo")
    );
    expect(confirmRejectBtn).toBeDefined();

    await act(async () => {
      confirmRejectBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onResolve).toHaveBeenCalledWith({
      approved: false,
      reason: "Ruta prohibida",
    });
  });
});
