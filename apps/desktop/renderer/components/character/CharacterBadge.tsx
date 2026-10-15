// CharacterBadge.tsx — Mini-Avatar Adaptativo con FSM y TraitRegistry (CHAR-08)
// Diseñado para chat river, selector de Sub-Egos y tarjetas del catálogo.
// Regla anti-fatiga y rendimiento: por defecto opera en StillPose estático (1 solo render).
// Solo anima si animated={true} (turno activo).

import React, { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CharacterEngine } from "./core/CharacterEngine.js";
import { CharacterStateMachine, type CharacterState } from "./state/CharacterStateMachine.js";
import { TraitRegistry, type DomainCharacterPreset } from "./traits/TraitRegistry.js";
import type { HeadFrame } from "./wardrobe/CharacterWardrobe.js";
import { MOTION } from "../canvas/DesignSystemProvider.js";
import {
  CharacterMorphController,
  presetToMorphTarget,
  type MorphTarget,
} from "./transitions/CharacterMorph.js";

export interface CharacterBadgeProps {
  subEgoId?: string;
  state?: CharacterState;
  size?: number;          // Dimensión en píxeles CSS (default: 28)
  animated?: boolean;     // Si es false, renderiza 1 fotograma estático sin rAF continuo
  baseForm?: "delta-core" | "coucou-mochi"; // Geometría de silueta
  outfitId?: string | null; // Override opcional de atuendo
  className?: string;
  title?: string;
}

export const CharacterBadge: React.FC<CharacterBadgeProps> = ({
  subEgoId = "ego.nucleus",
  state = "idle",
  size = 28,
  animated = false,
  baseForm,
  outfitId,
  className = "",
  title,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fsmRef = useRef<CharacterStateMachine | null>(null);
  const engineRef = useRef<CharacterEngine | null>(null);
  const morphRef = useRef<CharacterMorphController | null>(null);
  const prevTargetRef = useRef<MorphTarget | null>(null);
  const renderSingleFrameRef = useRef<(() => void) | null>(null);
  // Microanim framer-motion: morph crossfade envuelto; reduced-motion → animation none.
  const reduceMotion = useReducedMotion() ?? false;

  // Inicialización de FSM y Engine en ref
  if (!fsmRef.current) {
    fsmRef.current = new CharacterStateMachine(state);
  }
  if (!engineRef.current) {
    const eng = new CharacterEngine();
    eng.isMini = true;
    engineRef.current = eng;
  }
  if (!morphRef.current) {
    morphRef.current = new CharacterMorphController(450);
  }

  const fsm = fsmRef.current;
  const engine = engineRef.current;
  const morph = morphRef.current;

  // Obtener preset de dominio
  const preset: DomainCharacterPreset = TraitRegistry.getPreset(subEgoId);

  // Sincronizar estado en FSM y engine
  useEffect(() => {
    fsm.setState(state);
  }, [state, fsm]);

  useEffect(() => {
    const nextTarget = presetToMorphTarget(preset, outfitId, baseForm);

    // Configurar dibujado de traits mediante capas si existen
    engine.customBackDraw = (ctx: CanvasRenderingContext2D, head: HeadFrame) => {
      if (preset.traits && preset.traits.length > 0) {
        TraitRegistry.renderLayer("back", ctx, head, preset.traits, preset.accentColor, 0.9);
      }
    };

    engine.customFrontDraw = (ctx: CanvasRenderingContext2D, head: HeadFrame) => {
      if (preset.traits && preset.traits.length > 0) {
        TraitRegistry.renderLayer("front", ctx, head, preset.traits, preset.accentColor, 0.95);
        TraitRegistry.renderLayer("overlay", ctx, head, preset.traits, preset.accentColor, fsm.channels.aura);
      }
    };

    const prevTarget = prevTargetRef.current;
    if (
      prevTarget &&
      (prevTarget.bodyColor[0] !== nextTarget.bodyColor[0] ||
        prevTarget.bodyColor[1] !== nextTarget.bodyColor[1] ||
        prevTarget.bodyColor[2] !== nextTarget.bodyColor[2] ||
        prevTarget.eyeShape !== nextTarget.eyeShape ||
        prevTarget.baseForm !== nextTarget.baseForm ||
        prevTarget.outfitId !== nextTarget.outfitId)
    ) {
      // Iniciar interpolación morfológica (CHAR-09)
      morph.start(
        prevTarget,
        nextTarget,
        (current) => {
          engine.bodyColor = current.bodyColor;
          engine.permanentEye = current.eyeShape;
          engine.setShape(current.baseForm ?? "delta-core");
          engine.setOutfit(current.outfitId ?? null);
          if (!animated && renderSingleFrameRef.current) {
            renderSingleFrameRef.current();
          }
        },
        () => {
          prevTargetRef.current = nextTarget;
        }
      );
    } else {
      // Primera inicialización o sin cambios morfológicos
      engine.bodyColor = nextTarget.bodyColor;
      engine.permanentEye = nextTarget.eyeShape;
      engine.setShape(nextTarget.baseForm ?? "delta-core");
      engine.setOutfit(nextTarget.outfitId ?? null);
      prevTargetRef.current = nextTarget;
      if (!animated && renderSingleFrameRef.current) {
        renderSingleFrameRef.current();
      }
    }

    return () => {
      morph.cancel();
    };
  }, [preset, outfitId, baseForm, engine, fsm, animated, morph]);

  // Ciclo de renderizado (Estático vs Animado continuo)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const engineSize = size / 0.6;
    canvas.width = Math.round(engineSize * dpr);
    canvas.height = Math.round(engineSize * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const renderFrame = () => {
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, engineSize, engineSize);

      // Sincronizar parámetros de la FSM en el engine
      engine.tilt = fsm.channels.tilt;

      // Dibujar criatura
      engine.draw(ctx, engineSize, engineSize);
      ctx.restore();
    };

    renderSingleFrameRef.current = renderFrame;

    if (!animated) {
      // Modo StillPose: 1 solo fotograma determinista sin consumir rAF
      fsm.update(0.016);
      engine.update(0.016);
      renderFrame();
      return;
    }

    // Modo Animado: rAF a 60fps para el turno activo
    let animId: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      fsm.update(dt);
      engine.update(dt);
      renderFrame();

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [size, animated, fsm, engine, preset]);

  return (
    <motion.span
      layout={reduceMotion ? false : true}
      initial={reduceMotion ? false : { opacity: 0.6, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={reduceMotion ? { duration: 0 } : { duration: MOTION.surface }}
      role="img"
      aria-label={title || preset.name}
      className={`inline-flex items-center justify-center overflow-hidden shrink-0 select-none ${className}`}
      title={title || preset.name}
      data-morph="wrapped"
      style={
        reduceMotion
          ? { width: `${size}px`, height: `${size}px`, animation: "none" }
          : { width: `${size}px`, height: `${size}px` }
      }
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          width: `${size / 0.6}px`,
          height: `${size / 0.6}px`,
          pointerEvents: "none",
        }}
      />
    </motion.span>
  );
};
