/**
 * @file renderer2d.ts
 * @description Pipeline de renderizado en Canvas 2D con orden estricto de 9 capas y luz volumétrica.
 */

import { SuperellipsoidGeometry } from "../geometry/superellipsoid";
import type { ResolvedVisualPose } from "../behavior/stateArbiter";

export interface RenderContext2D {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  scale: number;
}

export class CompanionRenderer2D {
  private bodyPathCache: Path2D | null = null;

  constructor(private geom: SuperellipsoidGeometry) {
    this.rebuildBodyPath(80);
  }

  private rebuildBodyPath(steps: number = 80): void {
    const path = new Path2D();
    const rx = this.geom.params.a;
    const ry = this.geom.params.b;
    const exp = 2.0 / this.geom.params.p;

    for (let i = 0; i <= steps; i++) {
      const theta = (i / steps) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const x = rx * Math.sign(cosT) * Math.pow(Math.abs(cosT), exp);
      const y = ry * Math.sign(sinT) * Math.pow(Math.abs(sinT), exp);

      if (i === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    }
    path.closePath();
    this.bodyPathCache = path;
  }

  /**
   * Ejecuta el pipeline de renderizado en las 9 capas canónicas.
   */
  public render(
    rc: RenderContext2D,
    pose: ResolvedVisualPose,
    yaw: number,
    pitch: number,
    lightNorm: { x: number; y: number },
    scaleX: number,
    scaleY: number
  ): void {
    const { ctx, width, height, scale } = rc;
    const cx = width / 2;
    const cy = height / 2;
    const R = this.geom.params.a * scale;

    ctx.clearRect(0, 0, width, height);

    // 1. CAPA 1: Sombra arrojada de contacto en el suelo
    ctx.save();
    const shadowOffset = -lightNorm.x * 25;
    ctx.translate(cx + shadowOffset, cy + this.geom.params.b * scale * 0.95);
    const groundShadow = ctx.createRadialGradient(0, 0, R * 0.1, 0, 0, R * 1.1);
    groundShadow.addColorStop(0, "rgba(5, 8, 15, 0.55)");
    groundShadow.addColorStop(0.6, "rgba(5, 8, 15, 0.2)");
    groundShadow.addColorStop(1, "rgba(5, 8, 15, 0)");
    ctx.fillStyle = groundShadow;
    ctx.beginPath();
    ctx.ellipse(0, 0, R * 1.05, R * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Matriz del cuerpo
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scaleX * scale, scaleY * scale * pose.bodySquashY);

    if (this.bodyPathCache) {
      // 3. CAPA 3: Cuerpo con gradiente de luz difuso orientado
      const lightGrad = ctx.createLinearGradient(
        lightNorm.x * R * 0.9, lightNorm.y * R * 0.9,
        -lightNorm.x * R * 0.9, -lightNorm.y * R * 0.9
      );
      lightGrad.addColorStop(0, "#f8fafc");
      lightGrad.addColorStop(0.6, "#cbd5e1");
      lightGrad.addColorStop(1, "#94a3b8");
      ctx.fillStyle = lightGrad;
      ctx.fill(this.bodyPathCache);

      // 4. CAPA 4: Oclusión interna (penumbra de terminador)
      ctx.save();
      ctx.clip(this.bodyPathCache);
      const innerOcclusion = ctx.createRadialGradient(
        -lightNorm.x * R * 0.45, -lightNorm.y * R * 0.45, R * 0.2,
        0, 0, R * 1.3
      );
      innerOcclusion.addColorStop(0, "rgba(15, 23, 42, 0.45)");
      innerOcclusion.addColorStop(0.55, "rgba(15, 23, 42, 0.15)");
      innerOcclusion.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = innerOcclusion;
      ctx.fill(this.bodyPathCache);

      // 7. CAPA 7: Highlight especular suave
      const specGrad = ctx.createRadialGradient(
        lightNorm.x * R * 0.45, lightNorm.y * R * 0.45, 0,
        lightNorm.x * R * 0.45, lightNorm.y * R * 0.45, R * 0.45
      );
      specGrad.addColorStop(0, "rgba(255, 255, 255, 0.7)");
      specGrad.addColorStop(0.4, "rgba(255, 255, 255, 0.2)");
      specGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = specGrad;
      ctx.fill(this.bodyPathCache);

      // 5. CAPA 5: Rasgos faciales (Ojos esféricos anamórficos)
      const eyeSpacing = 0.38;
      const rx = this.geom.params.a;
      const ry = this.geom.params.b;

      [-1, 1].forEach((side) => {
        const eyeYaw = side * eyeSpacing + yaw * 0.45;
        const eyePitch = pitch * 0.35;
        const cp = Math.cos(eyePitch);
        const eyeX = Math.sin(eyeYaw) * cp * rx;
        const eyeY = -Math.sin(eyePitch) * ry;

        const fx = Math.max(0.2, Math.cos(eyeYaw));
        const fy = Math.max(0.3, cp);

        ctx.save();
        ctx.translate(eyeX, eyeY);
        ctx.scale(fx, fy);
        ctx.fillStyle = "#16171b";

        if (pose.eyeShape === "happy") {
          ctx.lineWidth = 4;
          ctx.lineCap = "round";
          ctx.strokeStyle = "#16171b";
          ctx.beginPath();
          ctx.arc(0, 2, 9, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
        } else if (pose.eyeShape === "closed") {
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          ctx.strokeStyle = "#16171b";
          ctx.beginPath();
          ctx.arc(0, -2, 8, Math.PI * 0.15, Math.PI * 0.85);
          ctx.stroke();
        } else if (pose.eyeShape === "flat") {
          ctx.beginPath();
          ctx.roundRect(-8, -2, 16, 4, 2);
          ctx.fill();
        } else {
          // Pill estándar
          const h = pose.eyeShape === "wide" ? 14 : 11;
          ctx.beginPath();
          ctx.roundRect(-5, -h / 2, 10, h, 5);
          ctx.fill();
        }
        ctx.restore();
      });

      ctx.restore(); // Fin clip
    }
    ctx.restore(); // Fin matriz del cuerpo

    // 8. CAPA 8: Indicadores operativos y Badges
    if (pose.badge) {
      ctx.save();
      const badgeY = cy - this.geom.params.b * scale * 0.85;
      ctx.translate(cx, badgeY);

      if (pose.badge === "bang") {
        ctx.fillStyle = pose.badgeColor;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.font = "800 14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("!", 0, 1);
      } else if (pose.badge === "dots") {
        const t = performance.now() / 1000;
        ctx.fillStyle = pose.badgeColor;
        for (let i = 0; i < 3; i++) {
          const phi = (t * 4.5 - i * 0.5) % (Math.PI * 2);
          const r = 2.5 + Math.max(0, Math.sin(phi)) * 1.5;
          ctx.beginPath();
          ctx.arc((i - 1) * 8, 0, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }
}
