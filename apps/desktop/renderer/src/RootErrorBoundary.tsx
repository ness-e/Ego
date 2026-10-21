import React from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { Button } from "../components/ui-kit/Button.js";

/**
 * T08 (UI-05 / R-FE-5): ErrorBoundary global. Aísla un crash de render del
 * workspace/chat para que no bloquee el hilo principal: fallback con
 * reintento en vez de pantalla en blanco.
 *
 * ## D6 — por qué esta pantalla se compone con el kit
 * Es la pantalla que el usuario ve cuando TODO ha fallado: el último
 * mensaje de la app. Antes se veía un `<button>` suelto con `rounded` (4 px),
 * 28 px de alto y `hover:opacity-90` — una atenuación que baja el contraste
 * del TEXTO y del FONDO a la vez (rompe AA) y un radio fuera de la escala de
 * radios del sistema (`rounded-md` · `rounded-[var(--radius-card)]` ·
 * `rounded-full`).
 *
 * Ahora:
 * · superficie `bg-panel` + `rounded-[var(--radius-card)]` + `border-hairline`
 *   (las 4 superficies canónicas: paper → panel → raised);
 * · acción con `Button variant="primary" size="md"` del kit → `bg-ink
 *   text-paper` con `hover:bg-ink/90` (alfa SÓLO en el fondo: el texto no se
 *   atenúa) y los 9 estados del contrato;
 * · iconografía Phosphor (`WarningCircle`) en vez de emoji.
 *
 * El texto del error se muestra COMPLETO (sin `truncate`): si la app se
 * rompe, el usuario necesita el motivo, no un trocito.
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
          className="flex h-screen w-screen items-center justify-center bg-paper p-8"
        >
          <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-[var(--radius-card)] border border-hairline bg-panel px-6 py-8 text-center shadow-[var(--ego-elevation-l2)]">
            <WarningCircle size={28} className="text-error" aria-hidden />
            <div className="flex flex-col gap-1.5">
              <p className="text-base font-semibold text-ink">
                Ego encontró un error de renderizado
              </p>
              <p className="break-words font-mono text-xs text-dim">
                {this.state.error.message}
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={this.handleRetry}
              className="rounded-[var(--radius-card)]"
            >
              Reintentar
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
