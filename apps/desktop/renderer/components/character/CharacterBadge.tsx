// CharacterBadge.tsx — Mini-Avatar Adaptativo con FSM y TraitRegistry (CHAR-08)
// Diseñado para chat river, selector de Sub-Egos y tarjetas del catálogo.
// Regla anti-fatiga y rendimiento: por defecto opera en StillPose estático (1 solo render).
// Solo anima si animated={true} (turno activo).

import React, { useEffect, useRef } from "react";
import { CharacterEngine, hexToRGB } from "./core/CharacterEngine.js";
import { CharacterStateMachine, type CharacterState } from "./state/CharacterStateMachine.js";
import { TraitRegistry, type DomainCharacterPreset } from "./traits/TraitRegistry.js";
import type { HeadFrame } from "./wardrobe/CharacterWardrobe.js";

export interface CharacterBadgeProps {
  subEgoId?: string;
  state?: CharacterState;
  size?: number;          // Dimensión en píxeles CSS (default: 28)
  animated?: boolean;     // Si es false, renderiza 1 fotograma estático sin rAF continuo
  className?: string;
  title?: string;
}

export const CharacterBadge: React.FC<CharacterBadgeProps> = ({
  subEgoId = "ego.nucleus",
  state = "idle",
  size = 28,
  animated = false,
  className = "",
  title,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fsmRef = useRef<CharacterStateMachine | null>(null);
  const engineRef = useRef<CharacterEngine | null>(null);

  // Inicialización de FSM y Engine en ref
  if (!fsmRef.current) {
    fsmRef.current = new CharacterStateMachine(state);
  }
  if (!engineRef.current) {
    const eng = new CharacterEngine();
    eng.isMini = true;
    engineRef.current = eng;
  }

  const fsm = fsmRef.current;
  const engine = engineRef.current;

  // Obtener preset de dominio
  const preset: DomainCharacterPreset = TraitRegistry.getPreset(subEgoId);

  // Sincronizar estado en FSM y engine
  useEffect(() => {
    fsm.setState(state);
  }, [state, fsm]);

  useEffect(() => {
    // Configuración morfológica del motor según el preset
    engine.bodyColor = hexToRGB(preset.bodyColors[0]);
    engine.permanentEye = preset.eyeShape;

    // Configurar dibujado de traits mediante capas
    engine.customBackDraw = (ctx: CanvasRenderingContext2D, head: HeadFrame) => {
      TraitRegistry.renderLayer("back", ctx, head, preset.traits, preset.accentColor, 0.9);
    };

    engine.customFrontDraw = (ctx: CanvasRenderingContext2D, head: HeadFrame) => {
      TraitRegistry.renderLayer("front", ctx, head, preset.traits, preset.accentColor, 0.95);
      TraitRegistry.renderLayer("overlay", ctx, head, preset.traits, preset.accentColor, fsm.channels.aura);
    };
  }, [preset, engine, fsm]);

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
      engine.permanentEye = preset.eyeShape;

      // Dibujar criatura
      engine.draw(ctx, engineSize, engineSize);
      ctx.restore();
    };

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
    <span
      className={`inline-flex items-center justify-center overflow-hidden shrink-0 select-none ${className}`}
      title={title || preset.name}
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: `${size / 0.6}px`,
          height: `${size / 0.6}px`,
          pointerEvents: "none",
        }}
      />
    </span>
  );
};
