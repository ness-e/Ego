import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * T06 UI-03 — helper `cva` local mínimo (Ponytail ladder: evita una
 * dependencia nueva; `clsx` + `tailwind-merge` ya están instalados).
 * API compatible con el subconjunto usado por el kit: variantes +
 * defaultVariants + className extra con merge de conflictos.
 *
 * ## Por qué NO se usa la librería `cva` (class-variance-authority)
 * `cva` **no está en el grafo de dependencias** del renderer
 * (`apps/desktop/renderer/package.json`): sólo están `clsx` y
 * `tailwind-merge`. Incorporarla añadiría una dependencia (y su peso en el
 * bundle del renderer) para resolver UNA cosa que ya está resuelta:
 *
 * - `clsx` → compose condicional de clases (`cond && "a"`, arrays, objetos).
 * - `tailwind-merge` → **resuelve los conflictos** entre utilidades de
 *   Tailwind (`h-8` vs `h-11`, `px-2` vs `px-3`), que es el 90 % del valor
 *   real de `cva`.
 *
 * Lo que `cva` aporta por encima (variantes booleanas, variantes compuestas,
 * `defaultVariants` por grupo) no lo necesita el kit: cada componente
 * declara sus variantes en un único objeto plano y usa `twMerge` para que
 * el `className` que pase el consumidor gane siempre.
 *
 * Por eso esta función es deliberadamente **una reimplementación mínima**
 * (no una reimplementación de `cva`): mantiene la API pública
 * (`cva`, `cn`, `VariantMap`, `CvaConfig`) para no romper los imports
 * existentes, pero delega TODO el trabajo real de merge en `tailwind-merge`.
 *
 * Nota de mantenimiento: si alguna vez `cva` entra en el grafo de
 * dependencias, esta función debe BORRARSE y los imports apuntar a la
 * librería (principio D3: primitives de librería siempre; ver
 * `docs/design/design-system.md` §8.1).
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
