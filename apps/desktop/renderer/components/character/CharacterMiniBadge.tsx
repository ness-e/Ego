import React, { useEffect, useRef } from "react";
import { CharacterEngine, type BotStateName, type RGB, hexToRGB, type EyeShape } from "./core/CharacterEngine.js";

export interface CharacterMiniBadgeProps {
  size?: number; // Tamaño en píxeles CSS (default: 28)
  state?: BotStateName;
  bodyColor?: string | RGB;
  outfitId?: string | null;
  eyeShape?: EyeShape;
  className?: string;
}

export const CharacterMiniBadge: React.FC<CharacterMiniBadgeProps> = ({
  size = 28,
  state = "idle",
  bodyColor = "#EDEDEF",
  outfitId = null,
  eyeShape,
  className = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<CharacterEngine | null>(null);

  if (!engineRef.current) {
    const eng = new CharacterEngine();
    eng.isMini = true;
    engineRef.current = eng;
  }

  const engine = engineRef.current;

  useEffect(() => {
    engine.setState(state, true);
  }, [state, engine]);

  useEffect(() => {
    engine.setOutfit(outfitId);
  }, [outfitId, engine]);

  useEffect(() => {
    if (typeof bodyColor === "string") {
      engine.bodyColor = hexToRGB(bodyColor);
    } else if (Array.isArray(bodyColor)) {
      engine.bodyColor = bodyColor as RGB;
    }
  }, [bodyColor, engine]);

  useEffect(() => {
    if (eyeShape) {
      engine.permanentEye = eyeShape;
    }
  }, [eyeShape, engine]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId: number;
    let lastTime = performance.now();

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const engineSize = size / 0.6;
    canvas.width = Math.round(engineSize * dpr);
    canvas.height = Math.round(engineSize * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      engine.update(dt);

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, engineSize, engineSize);
      engine.draw(ctx, engineSize, engineSize);
      ctx.restore();

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [size, engine]);

  return (
    <span
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
      className={`relative select-none ${className}`}
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
