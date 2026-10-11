/**
 * @file outfitSystem.ts
 * @description Sistema de accesorios 2.5D con anillos de corte y división por oclusión Z.
 */

import { SuperellipsoidGeometry, type Point3D } from "../geometry/superellipsoid";

export interface OutfitPiece {
  id: string;
  name: string;
  cuttingHeightY: number; // Altura de corte en [-1, 1]
  renderBack(ctx: CanvasRenderingContext2D, ringBack: Point3D[], scale: number): void;
  renderFront(ctx: CanvasRenderingContext2D, ringFront: Point3D[], scale: number): void;
}

export class OutfitManager {
  constructor(private geom: SuperellipsoidGeometry) {}

  /**
   * Genera el anillo de sección transversal a altura yCorte rotado según (yaw, pitch).
   * Devuelve las dos mitades ordenadas por profundidad Z (back vs front).
   */
  public computeCuttingRing(
    yCorte: number,
    yaw: number,
    pitch: number,
    numSamples: number = 36
  ): { back: Point3D[]; front: Point3D[] } {
    const back: Point3D[] = [];
    const front: Point3D[] = [];

    for (let i = 0; i < numSamples; i++) {
      const lambda = (i / numSamples) * Math.PI * 2;
      const localPt = this.geom.surfacePoint(yCorte, lambda);
      const rotPt = SuperellipsoidGeometry.rotatePoint(localPt, yaw, pitch);

      if (rotPt.z < 0) {
        back.push(rotPt);
      } else {
        front.push(rotPt);
      }
    }

    return { back, front };
  }
}
