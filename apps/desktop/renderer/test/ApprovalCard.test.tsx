import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApprovalCard } from "../components/tools/ApprovalCard.js";
import type { PendingApprovalInfo } from "../lib/ego.js";

// STAB-08: migrado de createRoot+act+querySelector a RTL por comportamiento.
// Queries en prioridad getByRole; interacción real vía user-event.
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

describe("CANV-12: ApprovalCard — Interacción HITL por comportamiento", () => {
  afterEach(() => {
    cleanup();
  });

  it("renderiza detalles de la solicitud y riesgo sensitivo", async () => {
    const onResolve = vi.fn();
    render(<ApprovalCard request={mockRequest} onResolve={onResolve} />);

    expect(screen.getByText(/fs_write_file/)).toBeTruthy();
    expect(screen.getByText(/src\/new-feature\.ts/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /aprobar/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /rechazar/i })).toBeTruthy();
  });

  it("llama onResolve con approved=true al activar Aprobar", async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn().mockResolvedValue(undefined);
    render(<ApprovalCard request={mockRequest} onResolve={onResolve} />);

    await user.click(screen.getByRole("button", { name: /aprobar/i }));

    expect(onResolve).toHaveBeenCalledWith({ approved: true });
  });

  it("rechaza con el motivo escrito en el campo de motivo", async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn().mockResolvedValue(undefined);
    render(<ApprovalCard request={mockRequest} onResolve={onResolve} />);

    await user.click(screen.getByRole("button", { name: /rechazar/i }));
    await user.type(
      screen.getByPlaceholderText(/motivo del rechazo/i),
      "Ruta prohibida",
    );
    await user.click(screen.getByRole("button", { name: /confirmar rechazo/i }));

    expect(onResolve).toHaveBeenCalledWith({
      approved: false,
      reason: "Ruta prohibida",
    });
  });
});
