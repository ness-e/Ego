import { memo, useMemo } from "react";
import { parseAnsi, hasAnsiCodes, type AnsiColor } from "@ego/ui-runtime";

interface AnsiTextProps {
  text: string;
  className?: string;
}

/**
 * Paleta ANSI → clases del design system.
 *
 * ## Por qué se eliminaron las variantes `dark:`
 * La app es dark-only (4 presets, decisión T05). Cada entrada declaraba el
 * color claro + su gemelo `dark:` que NUNCA se aplicaba: código muerto que
 * hacía la tabla más difícil de leer sin ningún efecto visual.
 *
 * ## Por qué el "blanco" ANSI es `text-ink`
 * `text-white` estaba fuera de los tokens del sistema (§1). `text-ink` es el
 * token de texto del design system y sobre un terminal oscuro cumple la
 * misma función (blanco roto). Los colores ANSI restantes son acentos
 * semánticos de estado, expresamente permitidos por §1.
 *
 * ## EXCEPCIÓN DOCUMENTADA: los 8 tonos ANSI NO se migran a tokens
 * Esta tabla es **DATO**, no cromo de UI: reproduce la paleta SGR de un
 * terminal, y el color ES el contenido (verde = "esto funcionó", rojo =
 * "esto falló"). Es el mismo criterio que el design-lint ya aplica al motor
 * de avatar (`AVATAR_ENGINE`: "la paleta de sprites es dato del avatar, no
 * tema de UI").
 *
 * El sistema de tokens tiene 4 acentos semánticos (`error` rojo, `success`
 * verde, `warning` ámbar, `brand` ámbar en `default-dark` / cian en
 * `midnight-cyan`). Migrar la tabla ANSI a esos 4 tokens:
 * · colapsaría los 8 tonos ANSI a ~4 (magenta y azul se quedarían sin
 *   token propio) y perdería la distinción normal/brillante;
 * · en `default-dark` el token `brand` es ÁMBAR, así que el cian ANSI se
 *   pintaría ámbar y el azul ANSI también: la salida del terminal dejaría de
 *   ser fiel al comando que la produjo.
 *
 * Por eso la tabla mantiene sus tonos crudos a propósito. La puerta
 * `design-lint` (R7) sólo prohíbe `white`/`black`/`zinc-*`, y aquí no hay
 * ninguno: el `white` ya está tokenizado como `text-ink`.
 */
const COLOR_CLASSES: Record<AnsiColor, string> = {
  black: "text-dim",
  red: "text-red-400",
  green: "text-emerald-400",
  yellow: "text-amber-400",
  blue: "text-sky-400",
  magenta: "text-purple-400",
  cyan: "text-teal-400",
  white: "text-ink",
  "bright-black": "text-faint",
  "bright-red": "text-red-300",
  "bright-green": "text-emerald-300",
  "bright-yellow": "text-amber-300",
  "bright-blue": "text-sky-300",
  "bright-magenta": "text-purple-300",
  "bright-cyan": "text-teal-300",
  "bright-white": "text-ink",
};

/**
 * AnsiText: Renders terminal outputs with ANSI SGR codes as styled React spans.
 * Si no contiene códigos ANSI, renderiza un span plano evitando sobrecoste de parsing.
 */
export const AnsiText = memo(({ text, className = "" }: AnsiTextProps) => {
  const segments = useMemo(() => {
    return hasAnsiCodes(text) ? parseAnsi(text) : null;
  }, [text]);

  if (!segments) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={`font-mono ${className}`}>
      {segments.map((segment, index) => {
        const colorClass = segment.fg ? COLOR_CLASSES[segment.fg] ?? "" : "";
        const boldClass = segment.bold ? "font-bold" : "";
        return (
          <span
            key={`ansi-seg-${index}`}
            className={`${colorClass} ${boldClass}`.trim() || undefined}
          >
            {segment.text}
          </span>
        );
      })}
    </span>
  );
});
