#!/usr/bin/env python3
"""capture.py — captura determinista del Robot Studio (señal, no reloj).

Por qué este script y no un "--wait-ms" fijo: el motor canvas carga su
backend con un `import()` dinámico, así que el tiempo hasta que hay algo
pintado depende de la cache y del arranque de Chrome. Capturar a los N
milisegundos fija produce lienzos en blanco de forma intermitente — y un
lienzo en blanco es un FALSO VERDE: el gate visual "pasa" porque el hash
cambió, cuando en realidad no se midió nada.

Este script espera la SEÑAL explicita del harness
(`window.__egoAvatarReady === true`) y solo entonces captura. Si la señal no
llega, falla con error en vez de guardar una imagen vacía.

Uso:
    python scripts/capture.py <url> <salida.png> [--timeout 15000]
"""

import argparse
import sys

from playwright.sync_api import sync_playwright

# La sombra del DOM se serializa con este evento; el harness lo dispara al
# terminar de pintar el fotograma.
READY_FLAG = "__egoAvatarReady"


def capture(url: str, out: str, timeout_ms: int, width: int, height: int) -> int:
    errors: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--force-color-profile=srgb", "--disable-lcd-text"])
        page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=1)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.goto(url, wait_until="load", timeout=timeout_ms)
        # La senal del harness: el motor ya esta listo y el fotograma pintado.
        page.wait_for_function(f"window.{READY_FLAG} === true", timeout=timeout_ms)
        # El puntero se aparta del lienzo: si no, el motor registra un "hover"
        # cuyo instante de entrada depende del arranque del navegador y la
        # mirada del avatar varia entre capturas.
        page.mouse.move(0, 0)
        # Dos frames mas para que el repintado posterior al resize se asiente.
        page.evaluate(
            "() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))"
        )
        # Se captura SOLO el escenario (no la ventana): el resultado son 400x400
        # del avatar, sin el fondo ni el margen.
        page.locator("#stage").screenshot(path=out, type="png")
        browser.close()

    if errors:
        for e in errors:
            print(f"  [consola] {e}", file=sys.stderr)
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("url")
    ap.add_argument("out")
    ap.add_argument("--timeout", type=int, default=20000)
    ap.add_argument("--width", type=int, default=400)
    ap.add_argument("--height", type=int, default=400)
    args = ap.parse_args()
    try:
        return capture(args.url, args.out, args.timeout, args.width, args.height)
    except Exception as exc:  # noqa: BLE001 — el script debe fallar con clarity
        print(f"ERROR: captura fallida para {args.url}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
