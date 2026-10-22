import React from "react";
import { cn } from "../ui-kit/cva.js";

/**
 * EGO-FIND-98 (Ola 10) — Estado vacío **con guía**.
 *
 * ## El defecto
 * El *empty state* del Workbench ("Navegador" y "Temas") dejaba ~70 % de
 * superficie vacía con un texto suelto: se leía como un sitio abandonado, no
 * como una superficie a la que le falta contenido.
 *
 * ## La anatomía (la del design system)
 * Un estado vacío útil dice **tres** cosas, en este orden:
 * 1. **Qué es** esta superficie (título).
 * 2. **Para qué** sirve y **cómo** se usa (descripción).
 * 3. **Qué hacer ahora** (acción).
 *
 * ## Por qué NO es una primitive del `ui-kit`
 * El kit tiene 12 primitives y su tabla es canónica (la publica A1): añadir
 * una 13.ª es una decisión de sistema, no un arreglo de un hueco visual. Este
 * componente vive en la zona del Canvas, donde se usa, y usa **tokens**
 * (`text-ink`, `text-faint`, `border-hairline`, `bg-panel`) → la puerta
 * `design-lint` lo acepta sin excepciones.
 */
export interface EmptyStateProps {
  /** Qué es esta superficie. */
  readonly title: string;
  /** Para qué sirve y cómo se usa. */
  readonly description: string;
  /** Icono (opcional): ancla la mirada. */
  readonly icon?: React.ReactNode;
  /** Acción principal (opcional). */
  readonly action?: React.ReactNode;
  /** Nota al pie (opcional). */
  readonly hint?: string;
  readonly className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  hint,
  className,
}) => (
  <div
    className={cn(
      "flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-hairline bg-panel p-8 text-center",
      className,
    )}
  >
    {icon !== undefined && (
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-raised text-dim" aria-hidden>
        {icon}
      </span>
    )}
    <h3 className="text-sm font-semibold text-ink">{title}</h3>
    <p className="max-w-[46ch] text-xs leading-relaxed text-faint">{description}</p>
    {action !== undefined && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}
    {hint !== undefined && <p className="text-xs text-dim">{hint}</p>}
  </div>
);
