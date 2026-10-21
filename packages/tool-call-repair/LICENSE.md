# Licencia y atribución — `@ego/tool-call-repair`

Este paquete contiene código **adaptado** de un proyecto de terceros. La cláusula de
atribución de la licencia original se reproduce aquí para que el aviso de copyright sea
resoluble dentro de este repositorio, tal como exige la licencia MIT.

## Código derivado

| Fichero de este paquete | Origen | Licencia | Copyright |
|---|---|---|---|
| `src/grammar.ts` | `packages/tool-call-repair/src/grammar.ts` de OpenClaw | MIT | Copyright (c) 2026 OpenClaw Foundation |
| `src/coercion.ts` | `packages/normalization-core` de OpenClaw | MIT | Copyright (c) 2026 OpenClaw Foundation |
| `src/balanced-json.ts` | `packages/normalization-core/balanced-json.ts` de OpenClaw | MIT | Copyright (c) 2026 OpenClaw Foundation |

El resto de ficheros del paquete son código original de Ego.

## Aviso de la licencia MIT del upstream

```
MIT License

Copyright (c) 2026 OpenClaw Foundation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Upstream: <https://github.com/openclaw/openclaw> (rama `main`, commit `ce1ffb4`).

> **Nota de procedencia:** `repos-referencia/` está en `.gitignore`, de modo que la ruta
> del upstream no es resoluble en un clon limpio del repo de Ego. Este fichero es el
> que hace resoluble el aviso.

Ver también `docs/research/licencias-obligaciones.md` y la ficha de extracción
`docs/extractions/openclaw.md`.
