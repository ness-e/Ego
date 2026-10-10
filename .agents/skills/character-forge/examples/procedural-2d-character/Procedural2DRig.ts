/**
 * Procedural2DRig — Sistema de Rigging 2D y Cinemática Inversa Analítica
 * Permite posicionar extremidades de personajes vectoriales o Canvas sin dependencias pesadas.
 */

export interface Joint2D {
  x: number;
  y: number;
  angle: number; // Radianes
}

export interface ArmRig2D {
  shoulder: Joint2D;
  elbow: Joint2D;
  hand: Joint2D;
}

export class Procedural2DArmController {
  public readonly upperArmLength: number;
  public readonly forearmLength: number;

  constructor(upperArmLength: number = 35, forearmLength: number = 30) {
    this.upperArmLength = upperArmLength;
    this.forearmLength = forearmLength;
  }

  /**
   * Resuelve la pose analítica del brazo dado el hombro y la posición deseada de la mano
   */
  public solve(
    shoulderX: number,
    shoulderY: number,
    targetX: number,
    targetY: number,
    flipElbow: boolean = false
  ): ArmRig2D {
    const dx = targetX - shoulderX;
    const dy = targetY - shoulderY;
    const dist = Math.hypot(dx, dy);

    const l1 = this.upperArmLength;
    const l2 = this.forearmLength;
    const maxReach = l1 + l2 - 0.001;
    const minReach = Math.abs(l1 - l2) + 0.001;
    const d = Math.max(minReach, Math.min(maxReach, dist));

    // Ángulo del codo (Ley del coseno)
    const cosElbow = (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2);
    const elbowInternal = Math.PI - Math.acos(cosElbow);
    const elbowAngle = flipElbow ? -elbowInternal : elbowInternal;

    // Ángulo base del hombro
    const cosShoulderRel = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
    const shoulderRel = Math.acos(cosShoulderRel);
    const angleToTarget = Math.atan2(dy, dx);
    const shoulderAngle = angleToTarget + (flipElbow ? shoulderRel : -shoulderRel);

    // Posición calculada del codo
    const elbowX = shoulderX + Math.cos(shoulderAngle) * l1;
    const elbowY = shoulderY + Math.sin(shoulderAngle) * l1;

    // Posición calculada de la mano
    const handAngle = shoulderAngle + elbowAngle;
    const handX = elbowX + Math.cos(handAngle) * l2;
    const handY = elbowY + Math.sin(handAngle) * l2;

    return {
      shoulder: { x: shoulderX, y: shoulderY, angle: shoulderAngle },
      elbow: { x: elbowX, y: elbowY, angle: elbowAngle },
      hand: { x: handX, y: handY, angle: handAngle },
    };
  }
}
