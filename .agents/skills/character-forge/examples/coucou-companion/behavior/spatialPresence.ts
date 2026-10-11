/**
 * @file spatialPresence.ts
 * @description Máquina de estados espaciales con detección de proximidad e histéresis.
 */

export type SpatialStateName =
  | "hidden"
  | "docked"
  | "flying"
  | "onDesktop"
  | "sleeping"
  | "dragging";

export interface SpatialPresenceConfig {
  wakeDistance: number;    // Radio para despertar (ej. 120 px)
  sleepDistance: number;   // Radio mínimo para dormir (ej. 160 px)
  sleepTimeoutSec: number; // Tiempo de inactividad para dormir (ej. 120 s)
}

export class SpatialPresenceFSM {
  public currentState: SpatialStateName = "onDesktop";
  private idleTimeSec: number = 0;

  constructor(
    public config: SpatialPresenceConfig = {
      wakeDistance: 120,
      sleepDistance: 160,
      sleepTimeoutSec: 120,
    }
  ) {}

  /**
   * Actualiza la máquina espacial según la posición del cursor y el delta de tiempo.
   */
  public update(
    dt: number,
    charPos: { x: number; y: number },
    cursorPos: { x: number; y: number },
    isAgentActive: boolean
  ): SpatialStateName {
    const dist = Math.hypot(cursorPos.x - charPos.x, cursorPos.y - charPos.y);

    if (isAgentActive) {
      this.idleTimeSec = 0;
      if (this.currentState === "sleeping") {
        this.currentState = "onDesktop";
      }
      return this.currentState;
    }

    if (dist < this.config.wakeDistance) {
      this.idleTimeSec = 0;
      if (this.currentState === "sleeping") {
        this.currentState = "onDesktop";
      }
    } else {
      this.idleTimeSec += dt;
      if (
        this.idleTimeSec >= this.config.sleepTimeoutSec &&
        dist >= this.config.sleepDistance &&
        this.currentState === "onDesktop"
      ) {
        this.currentState = "sleeping";
      }
    }

    return this.currentState;
  }

  public setDragging(isDragging: boolean): void {
    if (isDragging) {
      this.currentState = "dragging";
      this.idleTimeSec = 0;
    } else if (this.currentState === "dragging") {
      this.currentState = "onDesktop";
    }
  }

  public wakeImmediately(): void {
    this.idleTimeSec = 0;
    this.currentState = "onDesktop";
  }
}
