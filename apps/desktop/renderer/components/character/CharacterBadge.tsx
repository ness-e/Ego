// CharacterBadge.tsx — Mini-Avatar 2.5D Adaptativo basado en <ego-avatar> (Robot Studio)
// Diseñado para chat river, selector de Sub-Egos, ActivityWidget y tarjetas de catálogo.
// Reemplaza el antiguo triángulo plano por el Robot Studio 2.5D (HybridRobotAvatar) con visor oscuro,
// ojos LED expresivos, accesorios tácticos y micro-animaciones interactivas al clic.

import React, { useEffect, useRef, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { TraitRegistry } from "./traits/TraitRegistry.js";
import type { CharacterState } from "./state/character-state.js";
import { MOTION } from "../canvas/DesignSystemProvider.js";

// Registro automático del web component <ego-avatar>.
//
// T5 / A6 (VERDICT): la **fuente canónica** del motor es el paquete
// `@ego/avatar` (ADR-0018, decisión D5 del owner: se mantienen las TRES
// copias — upstream / paquete / vendorizada). El espejo vendorizado NO se
// importa aquí: se mantiene en el repo (cadena MIT + puerta `sync:check`)
// pero importarlo además duplicaría el chunk del motor en el bundle
// (+181 KB). Los dos ficheros son byte-idénticos (mismo SHA-256) y el
// registro del custom element está protegido (`!customElements.get(...)`).
import "@ego/avatar/runtime/avatar-element.js";

import type { BaseFormType } from "./wardrobe/WardrobeSelector.js";

export interface CharacterBadgeProps {
  subEgoId?: string;
  state?: CharacterState | string;
  size?: number;          // Dimensión en píxeles CSS (default: 28)
  animated?: boolean;     // Si es false, renderiza sin rAF continuo
  baseForm?: BaseFormType; // Geometría de silueta
  outfitId?: string | null; // Override opcional de atuendo
  className?: string;
  title?: string;
  mode?: "svg" | "studio";
  onClick?: (e: React.MouseEvent<HTMLSpanElement>) => void;
}

/**
 * Mapea cada Sub-Ego a un Preset fiel del Robot Studio de Ego.
 */
export function subEgoIdToStudioPreset(subEgoId: string = "ego.nucleus"): string {
  const id = subEgoId.toLowerCase();
  if (id === "ego.nucleus" || id.includes("nucleus")) return "ego-nucleus";
  if (id === "researcher" || id === "planner" || id.includes("cyber") || id.includes("search")) return "ego-cyber";
  if (id === "code_reviewer" || id.includes("dev") || id.includes("code")) return "cx-faithful";
  if (id === "copywriter" || id.includes("sentinel") || id.includes("security") || id.includes("guard")) return "ego-sentinel";
  if (id === "analyst" || id.includes("architect") || id.includes("arch")) return "ego-architect";
  return "cx-faithful";
}

/**
 * Mapea estados canónicos del personaje (vocabulario `CharacterState`) al
 * vocabulario de <ego-avatar>.
 */
export function mapCharacterStateToAvatarState(state?: CharacterState | string): string {
  if (!state) return "idle";
  const s = String(state).toLowerCase();
  switch (s) {
    case "idle":
      return "idle";
    case "listening":
      return "listening";
    case "thinking":
      return "thinking";
    case "generating":
    case "working":
    case "using_tool":
      return "working";
    case "searching":
      return "searching";
    case "waiting":
      return "waiting";
    case "approval_required":
    case "approval":
    case "alert":
    case "attention":
      return "approval";
    case "question":
      return "question";
    case "success":
      return "success";
    case "finished":
      return "finished";
    case "error":
      return "error";
    case "ratelimit":
      return "ratelimit";
    case "sleeping":
      return "sleeping";
    case "dizzy":
      return "dizzy";
    default:
      return "idle";
  }
}

export const CharacterBadge: React.FC<CharacterBadgeProps> = ({
  subEgoId = "ego.nucleus",
  state = "idle",
  size = 28,
  animated = false,
  baseForm,
  outfitId: _outfitId,
  className = "",
  title,
  mode,
  onClick,
}) => {
  const avatarRef = useRef<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion() ?? false;

  // Inicializar TraitRegistry para obtener el nombre canónico si no se provee title
  TraitRegistry.initialize();
  const preset = TraitRegistry.getPreset(subEgoId);
  const badgeTitle = title || preset?.name || subEgoId;

  // Tamaño visual ampliado para encuadre y nitidez de estudio
  const displaySize = size < 36 ? Math.max(size + 10, 36) : size;

  // Modo por defecto: Robot Studio siempre (salvo que explícitamente mode === "svg" o baseForm === "delta-core")
  const effectiveMode: "svg" | "studio" =
    mode ?? (baseForm === "delta-core" ? "svg" : "studio");
  const studioPreset = subEgoIdToStudioPreset(subEgoId);
  const avatarState = mapCharacterStateToAvatarState(state);

  // Sincronizar preset del studio en el web component si cambia
  useEffect(() => {
    const el = avatarRef.current as any;
    if (!el) return;
    if (typeof el.applyStudioPreset === "function") {
      try {
        el.applyStudioPreset(studioPreset);
      } catch {}
    } else if (typeof el.setAttribute === "function") {
      try {
        el.setAttribute("preset", studioPreset);
      } catch {}
    }
  }, [studioPreset]);

  // Sincronizar estado en el web component
  useEffect(() => {
    const el = avatarRef.current as any;
    if (!el) return;
    if (typeof el.setState === "function") {
      try {
        el.setState(avatarState, { immediate: true });
      } catch {}
    } else if (typeof el.setAttribute === "function") {
      try {
        el.setAttribute("state", avatarState);
      } catch {}
    }
  }, [avatarState]);

  // Disparar emote interactivo al hacer clic
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>) => {
      onClick?.(e);
      const el = avatarRef.current as any;
      if (!el) return;
      if (typeof el.play === "function") {
        void el.play("happy").catch(() => {});
      } else if (typeof el.setAttribute === "function") {
        el.setAttribute("state", "finished");
        setTimeout(() => {
          try {
            el.setAttribute("state", avatarState);
          } catch {}
        }, 1500);
      }
    },
    [onClick, avatarState]
  );

  return (
    <motion.span
      layout={reduceMotion ? false : true}
      initial={reduceMotion ? false : { opacity: 0.6, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={reduceMotion ? { duration: 0 } : { duration: MOTION.surface }}
      role="img"
      aria-label={badgeTitle}
      className={`inline-flex items-center justify-center shrink-0 select-none cursor-pointer rounded-xl bg-[#11131a]/90 border border-white/[0.08] shadow-inner overflow-visible p-0.5 ${className}`}
      title={badgeTitle}
      data-morph="wrapped"
      onClick={handleClick}
      style={
        reduceMotion
          ? { width: `${displaySize}px`, height: `${displaySize}px`, animation: "none" }
          : { width: `${displaySize}px`, height: `${displaySize}px` }
      }
    >
      {React.createElement("ego-avatar", {
        ref: avatarRef,
        seed: subEgoId,
        state: avatarState,
        size: String(displaySize),
        mode: effectiveMode,
        preset: studioPreset,
        "pointer-follow": animated ? "true" : "false",
        sound: "false",
        motion: reduceMotion || !animated ? "reduce" : "auto",
        style: {
          width: "100%",
          height: "100%",
          display: "block",
          pointerEvents: "none",
        },
        "aria-hidden": "true",
      })}
    </motion.span>
  );
};
