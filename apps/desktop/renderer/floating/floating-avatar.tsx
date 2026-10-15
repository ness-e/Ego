import { createElement, useEffect, useMemo, useState } from "react";
import {
  avatarStateFor,
  motionFor,
  presenceFor,
  seedForSubEgo,
} from "./avatar-bridge.js";

export interface FloatingAvatarProps {
  /** Estado de atención del flotante (expanded|compact|hidden|hitl_approval|...). */
  attentionState: string;
  /** Id del SubEgo visible (default: núcleo "ego"). */
  subEgoId?: string | null;
  /** Tamaño px del mini (default 120). */
  size?: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace React {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace JSX {
      interface IntrinsicElements {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "ego-avatar": any;
      }
    }
  }
}

const AVATAR_ELEMENT_SPEC = "../../repos-referencia/avatar/src/index.js";

/**
 * Criatura avatar mini para el flotante (D1, NO Mochi).
 * Render presentation-only: `<ego-avatar seed size state presence motion>`.
 * El custom element se importa diferido solo en browser y una sola vez;
 * sin DOM/customElements (SSR/tests) renderiza el tag sin registrar.
 */
export function FloatingAvatar({ attentionState, subEgoId = null, size = 120 }: FloatingAvatarProps) {
  const seed = seedForSubEgo(subEgoId);
  const state = avatarStateFor(attentionState);
  const presence = presenceFor(attentionState);
  const prefersReduced = useMemo(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  const [motion] = useState(() => motionFor(prefersReduced));

  useEffect(() => {
    let cancelled = false;
    async function ensureElement(): Promise<void> {
      if (typeof window === "undefined" || typeof customElements === "undefined") return;
      if (customElements.get("ego-avatar")) return;
      try {
        await import(/* @vite-ignore */ AVATAR_ELEMENT_SPEC);
      } catch {
        if (!cancelled) {
          // Sin elemento registrado el tag queda inerte; no romper el flotante.
        }
      }
    }
    void ensureElement();
    return () => {
      cancelled = true;
    };
  }, []);

  return createElement("ego-avatar", {
    seed,
    state,
    size: String(size),
    presence,
    motion,
    "pointer-follow": "false",
    sound: "false",
    "data-attention": attentionState,
  });
}
