import { describe, it, expect, vi, afterEach } from "vitest";
import { ApprovalCard } from "../components/tools/ApprovalCard.js";
import type { PendingApprovalInfo } from "../lib/ego.js";

// RTL es devDep declarada en package.json pendiente de `pnpm install`.
// Resolución diferida con especificador en variable (sin literal) para no
// romper tsc ni la suite si falta; el describe se salta hasta que exista.
// `any` justificado: tipos del módulo opcional no resolubles pre-install.
const RTL_SPEC = "@testing-library/react";
const USER_EVENT_SPEC = "@testing-library/user-event";

let hasRtl = false;
try {
  const rtl: any = await import(/* @vite-ignore */ RTL_SPEC);
  const ue: any = await import(/* @vite-ignore */ USER_EVENT_SPEC);
  hasRtl = Boolean(rtl?.render && rtl?.screen && ue?.default);
} catch {
  hasRtl = false;
}

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

describe.skipIf(!hasRtl)("ApprovalCard — RTL por comportamiento (HITL aprobar)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("aprueba la solicitud al activar el botón Aprobar", async () => {
    // Arrange
    const { render, screen } = await import(/* @vite-ignore */ RTL_SPEC);
    const userEvent = (await import(/* @vite-ignore */ USER_EVENT_SPEC)).default;
    const user = userEvent.setup();
    const onResolve = vi.fn().mockResolvedValue(undefined);
    render(<ApprovalCard request={mockRequest} onResolve={onResolve} />);

    // Act — query prioritaria getByRole (getByRole > getByLabelText > getByText)
    await user.click(screen.getByRole("button", { name: /aprobar/i }));

    // Assert — único assert del test
    expect(onResolve).toHaveBeenCalledWith({ approved: true });
  });
});
