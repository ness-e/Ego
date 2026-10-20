import { useMemo } from "react";
import {
  MermaidComponentPropsSchema,
  prepareMermaidComponent,
  type MermaidComponentProps,
} from "@ego/ui-runtime";
import type { ComponentRendererProps } from "./registry.js";

/**
 * OCLW-11 (A3) — Vista React del tipo de componente `mermaid` del Canvas.
 *
 * `@ego/ui-runtime` no depende de React: el paquete registra la
 * *preparación* (validación + saneado anti-XSS + re-validación) y el host
 * (el renderer de Electron) aporta la vista visual bajo el mismo
 * `componentKind`.
 *
 * ## Fail-closed
 * `prepareMermaidComponent` devuelve `valid: false` si el diagrama no pasa
 * la validación o contiene patrones inseguros. En ese caso **no se renderiza
 * nada**: ni el fuente, ni un error con el contenido. El motivo
 * (`error`) sí se muestra, pero es un texto controlado por el paquete (no
 * una eco del input).
 *
 * ## Por qué el fuente va en `<pre>` y no como SVG
 * Renderizar el diagrama a SVG exige el paquete `mermaid` (~1 MB) en el
 * bundle del renderer. Esta vista expone el **fuente saneado** (que es lo
 * que el modelo produjo) con el tipo de diagrama detectado; convertirlo a
 * SVG queda para cuando exista un renderizador de diagramas propio. Lo que
 * NO se hace es inventar un dibujo: el texto es el dato real.
 */
export function MermaidView({ props }: ComponentRendererProps) {
  const prepared = useMemo(() => prepareMermaidComponent(props), [props]);

  if (!prepared.valid) {
    // Fail-closed: no se renderiza el contenido. Solo el motivo (texto
    // controlado por el paquete).
    return (
      <div
        data-mermaid-view="invalid"
        className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 text-[11px] text-rose-300"
      >
        Diagrama Mermaid no válido: {prepared.error ?? "contenido rechazado"}
      </div>
    );
  }

  const source = prepared.source ?? "";

  return (
    <div
      data-mermaid-view="valid"
      data-mermaid-type={prepared.diagramType}
      className="rounded-lg border border-hairline bg-panel p-3"
    >
      <div className="mb-1.5 flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-faint">
        <span>Mermaid</span>
        {prepared.diagramType ? (
          <span className="rounded border border-hairline px-1.5 py-0.5">
            {prepared.diagramType}
          </span>
        ) : null}
      </div>
      <pre className="m-0 overflow-x-auto whitespace-pre font-mono text-[11px] leading-relaxed text-ink">
        {source}
      </pre>
    </div>
  );
}

/** Re-export del schema para quien registre el tipo sin importar el paquete. */
export { MermaidComponentPropsSchema, type MermaidComponentProps };
