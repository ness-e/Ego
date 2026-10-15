import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApprovalCard } from "../components/tools/ApprovalCard.js";
import type { PendingApprovalInfo } from "../lib/ego.js";

// STAB-07: import estático — @testing-library/react + user-event son
// devDeps declaradas (package.json:38-39). Si faltan, el import falla y
// la suite falla (nunca verde-falso por omisión). Sin gate hasRtl.
const mockRequest: PendingApprovalInfo = {
  approvalId: "app-test-rtl-1",
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

describe("ApprovalCard — RTL por comportamiento (HITL aprobar)", () => {
  afterEach(() => {
    // cleanup() RTL en vez de innerHTML="": vaciar el body a mano arranca
    // el contenedor que React 19 intenta desmontar (removeChild happy-dom).
    cleanup();
  });

  it("aprueba la solicitud al activar el botón Aprobar", async () => {
    // Arrange
    const user = userEvent.setup();
    const onResolve = vi.fn().mockResolvedValue(undefined);
    render(<ApprovalCard request={mockRequest} onResolve={onResolve} />);

    // Act — query prioritaria getByRole (getByRole > getByLabelText > getByText)
    await user.click(screen.getByRole("button", { name: /aprobar/i }));

    // Assert — único assert del test
    expect(onResolve).toHaveBeenCalledWith({ approved: true });
  });
});
