# Licencia y atribución — `@ego/ui-runtime`

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
| `src/AnsiParser.ts` | `hermes-agent` (Hermes Agent) | `apps/desktop/src/lib/ansi.ts` | MIT | Copyright (c) 2025 Nous Research | Racha de forma de 41 tokens contra el fichero de origen del clon (el tipo `AnsiSegment`, la paleta `AnsiColor` y el escáner SGR) |
| `src/FuzzySearch.ts` | `hermes-agent` (Hermes Agent) | `apps/shared/src/fuzzy.ts` | MIT | Copyright (c) 2025 Nous Research | Racha de forma de 45 tokens contra el fichero de origen del clon (la firma `fuzzyRank<T>` y la puntuación por subcadena) |

## Código nativo (asimilación de patrón, sin código derivado)

| Fichero de este paquete | Patrón estudiado | Nota |
|---|---|---|
| `src/MermaidRenderer.ts` | `openclaw` (OpenClaw) · OCLW-11 | **Implementación propia de Ego; patrón asimilado de OpenClaw, sin traducción de código.** La validación, el saneado anti-XSS y las directivas de tema son propios. |
| `src/MermaidComponent.ts` | `openclaw` (OpenClaw) · OCLW-11 | **Implementación propia de Ego; patrón asimilado de OpenClaw, sin traducción de código.** Aquí se declara el tipo de componente del Canvas y su preparador de props. |
| `src/MockIPCBridge.ts` | `coucou` (Coucou) · COUC-15 | **Implementación propia de Ego; patrón asimilado de Coucou, sin traducción de código.** El puente implementa el contrato de eventos del widget, no el código del upstream. |
| `src/WindowState.ts` | `hermes-agent` (Hermes Agent) · HERM-08 | **Implementación propia de Ego; patrón asimilado de Hermes, sin traducción de código.** La geometría y la restauración son propias. |

El resto de ficheros del paquete son código original de Ego. Los ficheros que
implementan un **patrón** estudiado en un upstream (sin traducción de código) llevan
una cabecera que lo dice explícitamente ("implementación propia de Ego") y **no**
llevan la forma `Adapted from`.

## Aviso de la licencia MIT del upstream

```
MIT License

Copyright (c) 2025 Nous Research

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

Upstream: <https://github.com/nousresearch/hermes-agent> (rama `main`, commit `4787e4d`).

> **Nota de procedencia:** `repos-referencia/` está en `.gitignore`, de modo que la ruta
> del upstream no es resoluble en un clon limpio del repo de Ego. Este fichero es el
> que hace resoluble el aviso.

Ver también `docs/research/licencias-obligaciones.md` y la ficha de extracción
`docs/extractions/hermes-agent.md`.
