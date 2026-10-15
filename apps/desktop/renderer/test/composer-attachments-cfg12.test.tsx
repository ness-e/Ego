import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  EgoChat,
  CFG12_MAX_ATTACHMENT_BYTES,
  validateComposerAttachment,
  resolveAttachmentPermission,
  buildPromptWithAttachments,
  isAllowedAttachmentType,
} from "../components/ego-chat.js";

/**
 * CFG-12 — Composer con adjuntos backend (contrato mínimo).
 * capabilities.attachments real: allowlist + 10MB + cuarentena fail-closed;
 * permisos inline heredan CFG-06 (deny-gana); voz = TODO VOICE deshabilitado.
 */
describe("CFG-12: Composer attachments", () => {
  it("límite 10MB exacto", () => {
    expect(CFG12_MAX_ATTACHMENT_BYTES).toBe(10 * 1024 * 1024);
  });

  it("allowlist: pdf/png/txt pasan, exe/sh bloqueados", () => {
    expect(isAllowedAttachmentType("application/pdf", "a.pdf")).toBe(true);
    expect(isAllowedAttachmentType("image/png", "a.png")).toBe(true);
    expect(isAllowedAttachmentType("text/plain", "a.txt")).toBe(true);
    expect(isAllowedAttachmentType("application/x-msdownload", "a.exe")).toBe(false);
    expect(isAllowedAttachmentType("application/x-sh", "run.sh")).toBe(false);
  });

  it("oversize → cuarentena con motivo (nunca viaja)", () => {
    const v = validateComposerAttachment({
      name: "big.pdf",
      mime: "application/pdf",
      size: CFG12_MAX_ATTACHMENT_BYTES + 1,
    });
    expect(v.quarantined).toBe(true);
    expect(v.reason).toMatch(/10MB/);
    expect(buildPromptWithAttachments("hola", [v])).toBe("hola");
  });

  it("tipo denegado → cuarentena deny", () => {
    const v = validateComposerAttachment({ name: "x.exe", mime: "application/x-msdownload", size: 10 });
    expect(v.quarantined).toBe(true);
    expect(v.permission).toBe("deny");
  });

  it("deny-gana CFG-06: deny veta aunque haya allow", () => {
    const att = { mime: "image/png", name: "foto.png" };
    expect(
      resolveAttachmentPermission(
        [
          { pattern: "image", decision: "allow" },
          { pattern: "foto", decision: "deny" },
        ],
        att
      )
    ).toBe("deny");
    expect(resolveAttachmentPermission([], att)).toBe("ask");
    expect(
      resolveAttachmentPermission([{ pattern: "image", decision: "allow" }], att)
    ).toBe("allow");
  });

  it("permiso deny por regla → cuarentena con motivo de permiso", () => {
    const v = validateComposerAttachment(
      { name: "foto.png", mime: "image/png", size: 100 },
      [{ pattern: "image", decision: "deny" }]
    );
    expect(v.quarantined).toBe(true);
    expect(v.reason).toMatch(/deny/);
  });

  it("adjunto válido viaja como metadatos en el prompt", () => {
    const v = validateComposerAttachment({ name: "doc.pdf", mime: "application/pdf", size: 1024 });
    expect(v.quarantined).toBe(false);
    const full = buildPromptWithAttachments("resume esto", [v]);
    expect(full).toContain("resume esto");
    expect(full).toContain("doc.pdf");
    expect(full).toContain("permiso:");
  });
});

describe("CFG-12: Composer UI (adjuntar + voz futura)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalEgo: unknown;

  beforeEach(() => {
    originalEgo = (window as unknown as { ego?: unknown }).ego;
    (window as unknown as { ego?: unknown }).ego = {
      llmStream: vi.fn(async () => ({
        ok: true,
        turnId: "t",
        text: "ok",
        recallStatus: { count: 0, glyph: "🧠", sources: [], tokensEstimate: 0 },
      })),
      llmCancel: vi.fn(async () => ({ ok: true })),
      resolveApproval: vi.fn(async () => ({ ok: true })),
      settings: { getModelConfig: vi.fn(async () => ({ activeProvider: "mock" })) },
      sessions: { get: vi.fn(async () => ({ ok: false })) },
      memory: vi.fn(async () => ({ ok: true })),
      onChatDelta: () => () => {},
      onRecallStatus: () => () => {},
      onChatError: () => () => {},
      onApprovalRequest: () => () => {},
      onEvent: () => () => {},
    };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    (window as unknown as { ego?: unknown }).ego = originalEgo;
  });

  it("botón ＋ y voz deshabilitada honesta presentes", async () => {
    await act(async () => {
      root.render(<EgoChat />);
    });
    expect(container.querySelector('[data-testid="composer-attach-button"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="composer-file-input"]')).not.toBeNull();
    const voice = container.querySelector('[data-testid="composer-voice-button"]');
    expect(voice).not.toBeNull();
    expect((voice as HTMLButtonElement).disabled).toBe(true);
  });
});
