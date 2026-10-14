import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * T06 UI-03 — helper `cva` local mínimo (Ponytail ladder: evita una
 * dependencia nueva; `clsx` + `tailwind-merge` ya están instalados).
 * API compatible con el subconjunto usado por el kit: variantes +
 * defaultVariants + className extra con merge de conflictos.
 */
export type VariantMap = Record<string, Record<string, string>>;

export interface CvaConfig<V extends VariantMap> {
  base?: string;
  variants?: V;
  defaultVariants?: { [K in keyof V]?: keyof V[K] };
}

export function cva<V extends VariantMap>(config: CvaConfig<V>) {
  return (
    props?: { [K in keyof V]?: keyof V[K] } & { className?: ClassValue },
  ): string => {
    const { className, ...variantProps } = props ?? {};
    const variantClasses = Object.entries(config.variants ?? {}).map(
      ([key, options]) => {
        const selected =
          (variantProps as Record<string, string | undefined>)[key] ??
          (config.defaultVariants as Record<string, string> | undefined)?.[
            key
          ];
        return selected ? options[selected] ?? "" : "";
      },
    );
    return twMerge(clsx(config.base, ...variantClasses, className));
  };
}

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(...inputs));
}
