import { z } from "zod";
import { MermaidRenderer, type MermaidThemeTokens } from "./MermaidRenderer.js";

/**
 * Componente de Canvas "mermaid" (OCLW-11).
 *
 * `MermaidRenderer` implementaba la validación, el saneado anti-XSS y la
 * generación de directivas de tema, pero **no tenía caller**: era código
 * asimilado sin cablear (A5).
 *
 * CABLEADO (Ola 1b, T5.3)
 * ------------------------
 * Aquí se declara el **tipo de componente** del Canvas y su **preparador** de
 * props (validación + saneado + directivas de tema). El paquete
 * `@ego/ui-runtime` no depende de React: por eso el "renderer" registrado
 * es un descriptor con el preparador, y el **host** (el renderer de Electron,
 * zona de A4) aporta la vista visual bajo el mismo `componentKind`.
 *
 * Contrato de seguridad: un diagrama Mermaid con `<script>`, `javascript:`
 * u `onerror=` se rechaza ANTES de llegar al DOM, y el código saneado es el
 * único que se entrega al renderizador.
 */

/** Tipo de componente del Canvas para diagramas Mermaid. */
export const MERMAID_COMPONENT_KIND = "mermaid";

/** Tokens de tema que se interpolan en las directivas de Mermaid. */
export const MermaidThemeTokensSchema = z.object({
  background: z.string().min(1),
  foreground: z.string().min(1),
  primary: z.string().min(1),
  border: z.string().min(1),
  darkMode: z.boolean(),
});

/** Props del componente Mermaid del Canvas. */
export const MermaidComponentPropsSchema = z.object({
  /** Código fuente del diagrama Mermaid. */
  source: z.string().min(1),
  /** Tokens de tema para las directivas de renderizado. */
  theme: MermaidThemeTokensSchema.optional(),
});

export type MermaidComponentProps = z.infer<typeof MermaidComponentPropsSchema>;

/**
 * Resultado de preparar las props de un componente Mermaid.
 */
export interface PreparedMermaidComponent {
  /** `true` si el diagrama es válido y seguro. */
  readonly valid: boolean;
  /** Código fuente saneado (sólo si es válido). */
  readonly source?: string;
  /** Tipo de diagrama detectado (flowchart, sequenceDiagram, …). */
  readonly diagramType?: string;
  /** Directivas de tema listo para interpolar. */
  readonly themeDirectives?: string;
  /** Motivo del rechazo. */
  readonly error?: string;
}

/**
 * Prepara (valida + sanea + normaliza) las props de un componente Mermaid.
 *
 * Fail-closed: si el diagrama no es válido o contiene patrones inseguros,
 * devuelve `valid: false` y NUNCA un `source` (el host no debe renderizar).
 */
export function prepareMermaidComponent(props: unknown): PreparedMermaidComponent {
  const parsed = MermaidComponentPropsSchema.safeParse(props);
  if (!parsed.success) {
    return {
      valid: false,
      error: `Props de Mermaid inválidas: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    };
  }

  const { source, theme } = parsed.data;

  const validation = MermaidRenderer.validate(source);
  if (!validation.valid) {
    return { valid: false, error: validation.error ?? "Diagrama Mermaid inválido." };
  }

  const sanitized = MermaidRenderer.sanitize(source);

  // Re-validación tras el saneado (fail-closed).
  const revalidation = MermaidRenderer.validate(sanitized);
  if (!revalidation.valid) {
    return {
      valid: false,
      error: `El diagrama sigue siendo inválido tras el saneado: ${revalidation.error ?? "motivo desconocido"}`,
    };
  }

  return {
    valid: true,
    source: sanitized,
    diagramType: revalidation.diagramType,
    themeDirectives: theme
      ? MermaidRenderer.generateThemeDirectives(theme as MermaidThemeTokens)
      : undefined,
  };
}

/**
 * Descriptor del componente Mermaid registrado en el registry del Canvas.
 *
 * El host (renderer de Electron) lo consume así:
 *
 * ```ts
 * const prepared = registry.prepare("mermaid", manifest.props);
 * if (!prepared.valid) return <ErrorView message={prepared.error} />;
 * return <MermaidView source={prepared.source} themeDirectives={prepared.themeDirectives} />;
 * ```
 */
export interface MermaidComponentDescriptor {
  readonly kind: typeof MERMAID_COMPONENT_KIND;
  readonly propsSchema: typeof MermaidComponentPropsSchema;
  readonly prepare: typeof prepareMermaidComponent;
}

/**
 * Crea el descriptor del componente Mermaid.
 */
export function createMermaidComponentDescriptor(): MermaidComponentDescriptor {
  return {
    kind: MERMAID_COMPONENT_KIND,
    propsSchema: MermaidComponentPropsSchema,
    prepare: prepareMermaidComponent,
  };
}
