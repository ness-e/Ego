#!/usr/bin/env python3
"""compare-visuals.py — comparador de capturas con tolerancia de píxel.

Por qué tolerancia y no igualdad de hash: el motor dibuja sobre canvas 2D y
el rasterizado no es idéntico entre sesiones de navegador (acumulación del
estado del motor, antialiasing, hinting de fuentes). Una diferencia del 1 %
entre dos ejecuciones NORMALES no es una regresión. Lo que sí es una regresión
es un cambio de la FORMA del avatar: un ojo que desaparece, un accesorio que
cambia de sitio, un color que vira.

Por eso la puerta visual compara PORCENTAJE DE PÍXELES DIFERENTES con un
umbral, y no hashes. El hash sigue sirviendo para el caso trivial (fichero
identico -> 0 % sin abrir las imagenes), pero la decision la toma el
comparador de píxeles.

Uso:
    python scripts/compare-visuals.py <referencia.png> <captura.png> [--max-diff 2.0]

Salida: 0 = dentro de tolerancia; 1 = regresion visual; 2 = error de uso.
"""

import argparse
import sys

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    print("ERROR: se necesita Pillow (PIL).", file=sys.stderr)
    raise SystemExit(2)

# Tolerancia por canal: 8/255 cubre el ruido de antialiasing sin perdonar un
# cambio de color real.
CHANNEL_TOLERANCE = 8


def diff_ratio(a_path: str, b_path: str) -> tuple[float, list[tuple[int, int, int, int, float]]]:
    """Fracción de píxeles que difieren y las peores regiones (rejilla 4x4)."""
    a = Image.open(a_path).convert("RGB")
    b = Image.open(b_path).convert("RGB")
    if a.size != b.size:
        return 100.0, [(0, 0, a.size[0], a.size[1], 100.0)]

    pa = a.load()
    pb = b.load()
    w, h = a.size
    grid = 4
    cells = [[0] * grid for _ in range(grid)]
    total = 0
    for y in range(h):
        cy = min(grid - 1, y * grid // h)
        for x in range(w):
            cx = min(grid - 1, x * grid // w)
            ra, ga, ba = pa[x, y]
            rb, gb, bb = pb[x, y]
            if (
                abs(ra - rb) > CHANNEL_TOLERANCE
                or abs(ga - gb) > CHANNEL_TOLERANCE
                or abs(ba - bb) > CHANNEL_TOLERANCE
            ):
                cells[cy][cx] += 1
                total += 1

    ratio = (total / (w * h)) * 100.0
    regions = []
    for cy in range(grid):
        for cx in range(grid):
            n = cells[cy][cx]
            if n:
                regions.append(
                    (
                        cx * w // grid,
                        cy * h // grid,
                        (cx + 1) * w // grid,
                        (cy + 1) * h // grid,
                        (n / ((w // grid) * (h // grid))) * 100.0,
                    )
                )
    regions.sort(key=lambda r: -r[4])
    return ratio, regions


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("reference")
    ap.add_argument("candidate")
    ap.add_argument("--max-diff", type=float, default=2.0, help="%% maximo de pixeles distintos")
    ap.add_argument("--label", default="")
    args = ap.parse_args()

    try:
        ratio, regions = diff_ratio(args.reference, args.candidate)
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: no se pudieron comparar las capturas: {exc}", file=sys.stderr)
        return 2

    label = args.label or args.candidate
    if ratio <= args.max_diff:
        print(f"  OK {label}: {ratio:.2f}% de pixeles distintos (tolerancia {args.max_diff}%)")
        return 0

    print(
        f"  REGRESION {label}: {ratio:.2f}% de pixeles distintos "
        f"(tolerancia {args.max_diff}%)",
        file=sys.stderr,
    )
    for x1, y1, x2, y2, pct in regions[:4]:
        print(f"    region ({x1},{y1})-({x2},{y2}): {pct:.1f}% local", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
