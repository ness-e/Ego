/**
 * @file spring.ts
 * @description Oscilador armónico amortiguado con integración estable Euler semi-implícita.
 */

export class DampedSpring {
  public value: number;
  public velocity: number = 0;
  public target: number;

  constructor(
    public omega: number = 14.0, // Frecuencia angular (rad/s)
    public zeta: number = 0.70,  // Coeficiente de amortiguamiento (0.7 = crítico suave)
    initial: number = 0
  ) {
    this.value = initial;
    this.target = initial;
  }

  /**
   * Actualiza el resorte con un delta de tiempo medido.
   */
  public update(dt: number): number {
    const displacement = this.value - this.target;
    const accel = -this.omega * this.omega * displacement - 2.0 * this.zeta * this.omega * this.velocity;
    this.velocity += accel * dt;
    this.value += this.velocity * dt;
    return this.value;
  }

  /**
   * Inyecta una fuerza impulsiva instantánea.
   */
  public perturb(impulse: number): void {
    this.velocity += impulse;
  }

  /**
   * Reajusta la posición y resetea la velocidad.
   */
  public snapTo(val: number): void {
    this.value = val;
    this.target = val;
    this.velocity = 0;
  }
}
