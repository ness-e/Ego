import { memo, useMemo } from "react";
import { parseAnsi, hasAnsiCodes, type AnsiColor } from "@ego/ui-runtime";

interface AnsiTextProps {
  text: string;
  className?: string;
}

const COLOR_CLASSES: Record<AnsiColor, string> = {
  black: "text-zinc-600 dark:text-zinc-400",
  red: "text-red-600 dark:text-red-400",
  green: "text-emerald-600 dark:text-emerald-400",
  yellow: "text-amber-600 dark:text-amber-400",
  blue: "text-sky-600 dark:text-sky-400",
  magenta: "text-purple-600 dark:text-purple-400",
  cyan: "text-teal-600 dark:text-teal-400",
  white: "text-zinc-200 dark:text-zinc-100",
  "bright-black": "text-zinc-500 dark:text-zinc-400",
  "bright-red": "text-red-500 dark:text-red-300",
  "bright-green": "text-emerald-500 dark:text-emerald-300",
  "bright-yellow": "text-amber-500 dark:text-amber-300",
  "bright-blue": "text-sky-500 dark:text-sky-300",
  "bright-magenta": "text-purple-500 dark:text-purple-300",
  "bright-cyan": "text-teal-500 dark:text-teal-300",
  "bright-white": "text-white",
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
