export type StateListener<T> = (state: T) => void;

/**
 * Store reactivo genérico ligero desacoplado de frameworks UI específicos (Patrón Coucou COUC-05).
 * Soporta suscripciones inmutables, actualización parcial y reseteo sin dependencias de React o Electron.
 */
export class ReactiveStore<T extends Record<string, unknown>> {
  private state: T;
  private readonly initialState: T;
  private readonly listeners = new Set<StateListener<T>>();

  constructor(initialState: T) {
    this.initialState = { ...initialState };
    this.state = { ...initialState };
  }

  public getState(): Readonly<T> {
    return this.state;
  }

  public setState(updater: Partial<T> | ((prev: Readonly<T>) => Partial<T>)): void {
    const patch = typeof updater === "function" ? updater(this.state) : updater;
    const nextState = { ...this.state, ...patch };

    // Comparación superficial rápida
    let hasChanged = false;
    for (const key of Object.keys(patch)) {
      if ((this.state as any)[key] !== (nextState as any)[key]) {
        hasChanged = true;
        break;
      }
    }

    if (!hasChanged) return;

    this.state = nextState;
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  public subscribe(listener: StateListener<T>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public reset(): void {
    this.setState(this.initialState);
  }

  public getSubscriberCount(): number {
    return this.listeners.size;
  }
}
