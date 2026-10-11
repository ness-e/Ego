/**
 * @file superellipsoid.ts
 * @description Geometría analítica de superficie superelíptica de revolución 2.5D.
 */

export interface SuperellipsoidParams {
  a: number; // Semieje X
  b: number; // Semieje Y
  c: number; // Semieje Z
  p: number; // Exponente de la superelipse (2.7 = Preset Mochi)
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export class SuperellipsoidGeometry {
  constructor(public params: SuperellipsoidParams) {
    if (params.p <= 0) throw new Error("El exponente p debe ser positivo estricto");
  }

  /**
   * Radio transversal analítico a una altura relativa y en [-1, 1].
   * r(y) = (1 - |y|^p)^(1/p)
   */
  public radiusAt(y: number): number {
    const absY = Math.min(1.0, Math.abs(y));
    const inner = 1.0 - Math.pow(absY, this.params.p);
    return inner <= 0 ? 0 : Math.pow(inner, 1.0 / this.params.p);
  }

  /**
   * Punto de superficie para latitud y en [-1, 1] y longitud lambda en [0, 2pi).
   */
  public surfacePoint(y: number, lambda: number): Point3D {
    const clampedY = Math.max(-1.0, Math.min(1.0, y));
    const r = this.radiusAt(clampedY);
    return {
      x: this.params.a * r * Math.sin(lambda),
      y: this.params.b * clampedY,
      z: this.params.c * r * Math.cos(lambda),
    };
  }

  /**
   * Vector normal analítico normalizado ||N|| = 1.0.
   */
  public surfaceNormal(y: number, lambda: number): Point3D {
    if (y >= 0.999) return { x: 0, y: 1, z: 0 };
    if (y <= -0.999) return { x: 0, y: -1, z: 0 };

    const { a, b, c, p } = this.params;
    const absY = Math.abs(y);
    const signY = Math.sign(y);
    const rPrime = -Math.pow(absY, p - 1) * signY * Math.pow(1 - Math.pow(absY, p), (1 / p) - 1);

    const nx = b * c * Math.sin(lambda);
    const ny = -a * c * rPrime;
    const nz = a * b * Math.cos(lambda);

    const len = Math.hypot(nx, ny, nz) || 1.0;
    return { x: nx / len, y: ny / len, z: nz / len };
  }

  /**
   * Rotación en el espacio de la cabeza usando convención R_y(psi) * R_x(theta).
   */
  public static rotatePoint(p: Point3D, yaw: number, pitch: number): Point3D {
    // 1. Cabeceo (Pitch alrededor de X)
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const y1 = p.y * cosP - p.z * sinP;
    const z1 = p.y * sinP + p.z * cosP;

    // 2. Guiñada (Yaw alrededor de Y)
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const x2 = p.x * cosY + z1 * sinY;
    const z2 = -p.x * sinY + z1 * cosY;

    return { x: x2, y: y1, z: z2 };
  }
}
