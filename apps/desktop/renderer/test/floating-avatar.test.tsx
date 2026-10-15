import { describe, it, expect, afterEach } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FloatingAvatar } from "../floating/floating-avatar.js";
import {
  avatarStateFor,
  seedForSubEgo,
  motionFor,
  presenceFor,
} from "../floating/avatar-bridge.js";

describe("Task2: avatar bridge (D1, NO Mochi)", () => {
  it("mapea AttentionState->avatar state (contrato Task2)", () => {
    expect(avatarStateFor("hitl_approval")).toBe("approval");
    expect(avatarStateFor("hidden")).toBe("idle");
    expect(avatarStateFor("expanded")).toBe("working");
    expect(avatarStateFor("compact")).toBe("thinking");
  });

  it("mapea alert->approval y estados avatar passthrough", () => {
    expect(avatarStateFor("alert")).toBe("approval");
    expect(avatarStateFor("question")).toBe("question");
    expect(avatarStateFor("error")).toBe("error");
    expect(avatarStateFor("unknown-state")).toBe("idle");
  });

  it("seed determinista por SubEgo: `subego:${id}`", () => {
    expect(seedForSubEgo("ego.developer")).toBe("subego:ego.developer");
    expect(seedForSubEgo(undefined)).toBe("subego:ego");
    expect(seedForSubEgo(null)).toBe("subego:ego");
    // Determinismo: misma entrada => misma salida.
    expect(seedForSubEgo("x")).toBe(seedForSubEgo("x"));
  });

  it("reduced-motion -> motion reduce (avatar solo acepta auto|full|reduce)", () => {
    expect(motionFor(true)).toBe("reduce");
    expect(motionFor(false)).toBe("auto");
  });

  it("presence: expanded/hitl->home, compact->compact, hidden->hidden", () => {
    expect(presenceFor("expanded")).toBe("home");
    expect(presenceFor("hitl_approval")).toBe("home");
    expect(presenceFor("compact")).toBe("compact");
    expect(presenceFor("hidden")).toBe("hidden");
  });
});

describe("FloatingAvatar — componente mini (D1)", () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    host?.remove();
    host = null;
  });

  it("renderiza <ego-avatar> con seed/state/size/motion/presence del contrato", async () => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(
        createElement(FloatingAvatar, {
          attentionState: "hitl_approval",
          subEgoId: "ego.developer",
          size: 120,
        }),
      );
    });
    const el = host?.querySelector("ego-avatar");
    expect(el).not.toBeNull();
    expect(el?.getAttribute("seed")).toBe("subego:ego.developer");
    expect(el?.getAttribute("state")).toBe("approval");
    expect(el?.getAttribute("size")).toBe("120");
    expect(el?.getAttribute("presence")).toBe("home");
    expect(["auto", "reduce"]).toContain(el?.getAttribute("motion"));
  });
});
