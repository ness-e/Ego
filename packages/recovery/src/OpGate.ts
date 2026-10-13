import { OpGateOptions, OpGateStatus } from "./types.js";

export class OpGate {
  private inFlightCount = 0;
  private isDraining = false;
  private resolveDrain: ((drained: boolean) => void) | null = null;
  private readonly defaultTimeoutMs: number;

  constructor(options?: OpGateOptions) {
    this.defaultTimeoutMs = options?.drainTimeoutMs ?? 3000;
  }

  /**
   * Envuelve una operación de persistencia o mutación en la compuerta.
   * Rechaza si la compuerta está en proceso de drenado.
   */
  public async withGate<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isDraining) {
      throw new Error("[OpGate] Operación rechazada: La aplicación está cerrándose (Draining).");
    }

    this.inFlightCount++;
    try {
      return await operation();
    } finally {
      this.inFlightCount--;
      if (this.isDraining && this.inFlightCount === 0 && this.resolveDrain) {
        this.resolveDrain(true);
      }
    }
  }

  /**
   * Bloquea la entrada de nuevas operaciones y espera a que las existentes completen su flush.
   */
  public async drain(timeoutMs?: number): Promise<{ drained: boolean; remaining: number }> {
    this.isDraining = true;
    const timeout = timeoutMs ?? this.defaultTimeoutMs;

    if (this.inFlightCount === 0) {
      return { drained: true, remaining: 0 };
    }

    let timer: NodeJS.Timeout | null = null;

    const drainWait = new Promise<boolean>((resolve) => {
      this.resolveDrain = resolve;
      timer = setTimeout(() => {
        resolve(false);
      }, timeout);
    });

    const success = await drainWait;
    // Camarero consumido: el waiter ya se resolvió; liberarlo permite
    // distinguir "drain pendiente" de "drenado completado" en reset().
    this.resolveDrain = null;

    if (timer) {
      clearTimeout(timer);
    }

    return {
      drained: success,
      remaining: this.inFlightCount,
    };
  }

  /**
   * Devuelve el estado actual de la compuerta.
   */
  public getStatus(): OpGateStatus {
    return {
      isDraining: this.isDraining,
      inFlightCount: this.inFlightCount,
    };
  }

  /**
   * Restablece el estado de la compuerta (útil para pruebas o reinicios).
   *
   * Guard (M22): rechaza si hay operaciones en vuelo (las dejaría huérfanas:
   * su `finally` decrementarïa un contador ya reseteado y un `drain()`
   * posterior reportaría éxito con trabajo aún corriendo) o si hay un
   * `drain()` pendiente (lo dejaría sin resolver). Drenar/liberar primero.
   */
  public reset(): void {
    if (this.inFlightCount > 0) {
      throw new Error(
        `[OpGate] reset() rechazado: hay ${this.inFlightCount} operación(es) en vuelo. Drenar antes de restablecer.`
      );
    }
    if (this.resolveDrain !== null) {
      throw new Error("[OpGate] reset() rechazado: hay un drain() pendiente de resolución.");
    }
    this.isDraining = false;
    this.inFlightCount = 0;
    this.resolveDrain = null;
  }
}
