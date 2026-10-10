import * as THREE from 'three';

export interface CharacterAnimState {
  breathingPeriod?: number;
  springStiffness?: number;
  springDamping?: number;
}

/**
 * CharacterAnimationEngine — Controla la cinemática física y loops orgánicos del personaje
 * Garantiza 0 Garbage Collection en ejecución a 60-120 FPS.
 */
export class CharacterAnimationEngine {
  private headTargetQuat = new THREE.Quaternion();
  private headEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  
  // Resorte para inercia de antena
  private antennaAngleZ = 0;
  private antennaVelZ = 0;
  private prevHeadYaw = 0;

  // Parpadeo aperiódico
  private blinkTimer = 0;
  private nextBlinkInterval = 3.2;
  private isBlinking = false;
  private blinkProgress = 0;

  /**
   * Actualiza la respiración orgánica con conservación exacta de volumen
   */
  public updateBreathing(time: number, outScale: THREE.Vector3): void {
    const breath = Math.sin(time * 2.4) * 0.03;
    const sy = 1.0 + breath;
    const sRadial = 1.0 / Math.sqrt(sy); // Volumen constante: Sx * Sy * Sz = 1.0
    outScale.set(sRadial, sy, sRadial);
  }

  /**
   * Actualiza la orientación amortiguada de la cabeza con límites angulares rígidos
   */
  public updateLookAt(
    currentHeadQuat: THREE.Quaternion,
    normalizedPointer: [number, number],
    dt: number,
    stiffness: number = 8.0
  ): void {
    const MAX_YAW = (34 * Math.PI) / 180;
    const MAX_PITCH = (22 * Math.PI) / 180;

    const targetYaw = Math.max(-1, Math.min(1, normalizedPointer[0])) * MAX_YAW;
    const targetPitch = -Math.max(-1, Math.min(1, normalizedPointer[1])) * MAX_PITCH;

    this.headEuler.set(targetPitch, targetYaw, 0, 'YXZ');
    this.headTargetQuat.setFromEuler(this.headEuler);

    // Slerp suave (damping)
    currentHeadQuat.slerp(this.headTargetQuat, stiffness * dt);
  }

  /**
   * Actualiza la inercia elástica de la antena
   */
  public updateAntennaPhysics(currentHeadYaw: number, dt: number, wiggleFactor: number = 1.0): number {
    const headAngularAcc = (currentHeadYaw - this.prevHeadYaw) / Math.max(0.001, dt);
    this.prevHeadYaw = currentHeadYaw;

    const k = 120 * wiggleFactor;
    const d = 9;
    const force = -k * this.antennaAngleZ - d * this.antennaVelZ - headAngularAcc * 0.4;
    this.antennaVelZ += force * dt;
    this.antennaAngleZ += this.antennaVelZ * dt;

    return this.antennaAngleZ;
  }

  /**
   * Genera el factor de parpadeo biológico [0.0 = cerrado, 1.0 = abierto]
   */
  public updateBlink(dt: number): number {
    if (!this.isBlinking) {
      this.blinkTimer += dt;
      if (this.blinkTimer >= this.nextBlinkInterval) {
        this.isBlinking = true;
        this.blinkTimer = 0;
        this.blinkProgress = 0;
        this.nextBlinkInterval = 2.4 + Math.random() * 3.6;
      }
      return 1.0;
    }

    this.blinkProgress += dt / 0.15; // 150ms duración
    if (this.blinkProgress >= 1.0) {
      this.isBlinking = false;
      return 1.0;
    }

    return Math.abs(Math.sin(this.blinkProgress * Math.PI - Math.PI / 2));
  }
}
