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
  /** Modo de renderizado: "studio" (Robot Studio 2.5D) o "svg". Default "studio". */
  mode?: "studio" | "svg";
  /** Preset del studio (default: "ego-nucleus"). */
  preset?: string;
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

// FIND-12-01 / A6 (Ola 1b): el motor de personaje se importa desde el
// PAQUETE `@ego/avatar` (fuente canónica, ADR-0018). Vite resuelve el
// specifier de paquete estáticamente, así que el MPA del flotante lo
// empaqueta igual que el resto.
//
// El specifier original (`repos-referencia/avatar/src/index.js`) apuntaba
// FUERA del root del dev-server y producía un 404 en dev y en prod,
// dejando el `<ego-avatar>` inerte (box 0×0). La copia vendorizada bajo
// `renderer/floating/vendor/avatar/` lo resolvió; hoy se conserva como
// fallback (decisión D5: las tres copias se mantienen) y el paquete es el
// canónico.
//
// El import del elemento DEBE ser un LITERAL: Vite no analiza
// `import(CONST)` y lo deja suelto → 404 en prod (out/renderer/).
// Test: floating-avatar-vendor.

/**
 * Criatura avatar mini para el flotante (D1, NO Mochi).
 * Render presentation-only: `<ego-avatar seed size state presence motion mode="studio" preset="ego-nucleus">`.
 * El custom element se importa diferido solo en browser y una sola vez;
 * sin DOM/customElements (SSR/tests) renderiza el tag sin registrar.
 */
export function FloatingAvatar({
  attentionState,
  subEgoId = null,
  size = 120,
  mode = "studio",
  preset = "ego-nucleus",
}: FloatingAvatarProps) {
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
        // Literal a propósito (ver nota arriba): el bundler lo emite en dev
        // y prod (out/renderer/floating/) como chunk code-split.
        //
        // A6 (Ola 1b): el PAQUETE `@ego/avatar` es la fuente canónica. El
        // espejo vendorizado NO se importa (D5: la copia se mantiene en el
        // repo para la cadena MIT y la puerta `sync:check`, pero importarlo
        // además duplicaría el chunk del motor en el bundle: +181 KB).
        await import("@ego/avatar/runtime/avatar-element.js");
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
    mode,
    preset,
    // Rig de manos flotantes articuladas (5 dedos) del Robot Studio. El
    // atributo `hands` es la vía que el motor expone para encenderlas: sin
    // él el rig queda en modo `auto` (solo visible durante los 10 s que dura
    // el temporizador de una interacción) y en la app nunca se ve.
    // `always` → siempre visibles.
    hands: "always",
    "pointer-follow": "false",
    sound: "false",
    "data-attention": attentionState,
  });
}
