import React from "react";

/**
 * T08 (UI-05 / R-FE-5): ErrorBoundary global. Aísla un crash de render del
 * workspace/chat para que no bloquee el hilo principal: fallback con
 * reintento en vez de pantalla en blanco.
 */
export class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[Ego] Error no capturado en renderer:", error);
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-paper p-8 text-center"
        >
          <p className="text-sm font-semibold text-ink">Ego encontró un error de renderizado</p>
          <p className="max-w-md font-mono text-[11px] text-faint">{this.state.error.message}</p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="rounded bg-ink px-4 py-1.5 text-xs font-semibold text-paper hover:opacity-90"
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
