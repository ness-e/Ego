import React, { useEffect, useRef } from "react";
import { CharacterEngine, type BotStateName, type RGB, hexToRGB } from "./core/CharacterEngine.js";

export interface CharacterCanvasProps {
  size?: number; // Tamaño en píxeles CSS (default: 120)
  state?: BotStateName;
  outfitId?: string | null;
  bodyColor?: string | RGB | null;
  interactive?: boolean; // Permite que el personaje siga el cursor del ratón
  className?: string;
  onClick?: () => void;
}

export const CharacterCanvas: React.FC<CharacterCanvasProps> = ({
  size = 120,
  state = "idle",
  outfitId = null,
  bodyColor = null,
  interactive = true,
  className = "",
  onClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<CharacterEngine | null>(null);

  // Inicializar motor
  if (!engineRef.current) {
    engineRef.current = new CharacterEngine();
  }

  const engine = engineRef.current;

  // Actualizar estado y outfit ante cambios de props
  useEffect(() => {
    engine.setState(state);
  }, [state, engine]);

  useEffect(() => {
    engine.setOutfit(outfitId);
  }, [outfitId, engine]);

  useEffect(() => {
    if (typeof bodyColor === "string") {
      engine.bodyColor = hexToRGB(bodyColor);
    } else if (Array.isArray(bodyColor)) {
      engine.bodyColor = bodyColor as RGB;
    } else {
      engine.bodyColor = null;
    }
  }, [bodyColor, engine]);

  // Bucle de animación a 60 fps sincronizado con el ciclo de vida de React
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId: number;
    let lastTime = performance.now();

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      engine.update(dt);

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      engine.draw(ctx, size, size);
      ctx.restore();

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [size, engine]);

  // Interacción del ratón
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    engine.lookAt(nx, ny);
  };

  const handleMouseLeave = () => {
    if (!interactive) return;
    engine.lookAt(0, 0);
  };

  const handleClick = () => {
    engine.emit("heart", 3);
    engine.anim("sy", [[0.85, 70, (t) => t], [1.15, 120, (t) => t], [1, 100, (t) => t]]);
    onClick?.();
  };

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: "inline-block",
        cursor: onClick ? "pointer" : "default",
      }}
      className={`select-none ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    />
  );
};
