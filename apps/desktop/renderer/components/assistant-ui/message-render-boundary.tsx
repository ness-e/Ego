import { Component, type ReactNode } from "react";

/**
 * Detecta errores de lookup transitorios en el almacén interno de `@assistant-ui/react`.
 * Ocurre cuando un suscriptor lee un índice que la lista de partes ya no posee durante streaming acelerado.
 */
const isTransientLookupError = (error: unknown): boolean =>
  error instanceof Error &&
  /(useClientLookup|tapClient(Lookup|Resource)).*out of bounds/i.test(error.message);

const MAX_TRANSIENT_RETRIES = 5;

interface MessageRenderBoundaryProps {
  resetKey: string;
  messageId?: string;
  children: ReactNode;
  fallback?: ReactNode;
}

interface MessageRenderBoundaryState {
  error: Error | null;
}

/**
 * MessageRenderBoundary — Error Boundary granular por mensaje.
 * Aísla errores de renderizado de widgets o anomalías de lookup en `@assistant-ui/react`,
 * evitando que un fallo individual rompa la ventana o el hilo completo.
 * Extraído y adaptado de Hermes Agent (HERM-04).
 */
export class MessageRenderBoundary extends Component<
  MessageRenderBoundaryProps,
  MessageRenderBoundaryState
> {
  state: MessageRenderBoundaryState = { error: null };

  private retryTimer: number | null = null;
  private transientRetries = 0;

  static getDerivedStateFromError(error: Error): MessageRenderBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    if (!isTransientLookupError(error) || this.transientRetries >= MAX_TRANSIENT_RETRIES) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    this.transientRetries += 1;
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null;
      this.setState({ error: null });
    }, 16);
  }

  componentDidUpdate(
    prevProps: MessageRenderBoundaryProps,
    prevState: MessageRenderBoundaryState
  ) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
      return;
    }

    if (prevState.error && !this.state.error) {
      this.transientRetries = 0;
      if (this.retryTimer !== null) {
        window.clearTimeout(this.retryTimer);
        this.retryTimer = null;
      }
    }
  }

  componentWillUnmount() {
    if (this.retryTimer !== null) {
      window.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  render() {
    if (this.state.error) {
      // Si el error fue transitorio y todavía estamos en reintentos, silenciar render momentáneamente
      if (isTransientLookupError(this.state.error) && this.transientRetries < MAX_TRANSIENT_RETRIES) {
        return null;
      }

      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="my-2 rounded border border-rose-500/30 bg-rose-950/20 px-3 py-2 text-xs text-rose-300">
          <div className="font-semibold text-rose-400">Error al renderizar mensaje</div>
          <div className="mt-1 font-mono text-[11px] opacity-80">
            {this.state.error.message || "Error desconocido en el árbol de componentes"}
          </div>
          <button
            type="button"
            className="mt-2 rounded bg-rose-900/40 px-2 py-0.5 text-[10px] text-rose-200 hover:bg-rose-900/60 transition-colors"
            onClick={() => this.setState({ error: null })}
          >
            Reintentar render
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
