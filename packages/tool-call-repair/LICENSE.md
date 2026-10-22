# Licencia y atribución — `@ego/tool-call-repair`

Este paquete contiene código **derivado** de un proyecto de terceros. La cláusula de
atribución de la licencia original se reproduce aquí para que el aviso de copyright sea
resoluble dentro de este repositorio, tal como exige la licencia MIT.

> **El denominador del contrato es `provenance.manifest.json`** (en este paquete):
> declara fichero a fichero qué es derivado y qué es nativo, con el upstream, la
> licencia, la ruta de origen y la **evidencia medida**. La puerta
> `scripts/check-attribution.mjs` verifica este fichero contra el manifiesto (y
> `NOTICE` recoge el aviso por upstream). Un fichero sin clasificar, un derivado
> sin cabecera canónica o un nativo con cabecera canónica ⇒ **exit 1**.

## Código derivado

Un fichero **realmente derivado** (un port literal) lleva la cabecera canónica
`// Adapted from <upstream> (<LICENCIA>), <ruta de origen>`.

| Fichero de este paquete | Origen | Ruta de origen | Licencia | Copyright | Evidencia (medida) |
|---|---|---|---|---|---|
| `src/grammar.ts` | `openclaw` (OpenClaw) | `packages/tool-call-repair/src/grammar.ts` | MIT | Copyright (c) 2026 OpenClaw Foundation | Racha de forma de 31 tokens contra el fichero de origen del clon + residuo verbatim de 176 shingles (racha de 223 caracteres) |
| `src/balanced-json.ts` | `openclaw` (OpenClaw) | `packages/normalization-core/src/balanced-json.ts` | MIT | Copyright (c) 2026 OpenClaw Foundation | Racha de forma de 74 tokens contra el fichero de origen del clon + residuo verbatim de 631 shingles (rachas de 224 y 197 caracteres) |

## Código nativo (asimilación de patrón, sin código derivado)

| Fichero de este paquete | Patrón estudiado | Nota |
|---|---|---|
| `src/coercion.ts` | `openclaw` (OpenClaw) `packages/normalization-core` | **Implementación propia de Ego; patrón asimilado de OpenClaw, sin traducción de código.** Las heurísticas (`yes/y/on/no/n/off` como booleanos, números como cadenas, la exención de las claves de contenido `content/body/code/script/query/message/prompt`) no tienen equivalente en el upstream. |

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

Upstream: <https://github.com/openclaw/openclaw> (rama `main`, commit `0c7a83d`).

> **Nota de procedencia:** `repos-referencia/` está en `.gitignore`, de modo que la ruta
> del upstream no es resoluble en un clon limpio del repo de Ego. Este fichero es el
> que hace resoluble el aviso.

Ver también `docs/research/licencias-obligaciones.md` y la ficha de extracción
`docs/extractions/openclaw.md`.
