# Licencia y atribución — `@ego/tools`

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
| `src/native/git/ChangeSetService.ts` | `coucou` (Coucou) | `NotchBuddy/Sources/CoucouKit/DiffEngine.swift` | MIT | Copyright (c) 2026 Louis Raillard | Racha de forma compartida con el fichero de origen del clon (el `DiffEngine.swift` de Coucou) |

## Código nativo (asimilación de patrón, sin código derivado)

| Fichero de este paquete | Patrón estudiado | Nota |
|---|---|---|
| `src/native/git/GitParser.ts` | `openclaw` (OpenClaw) · OCLW-08 | **Implementación propia de Ego; patrón asimilado de OpenClaw, sin traducción de código.** El parser de Unidiff y `porcelain status` es propio. |
| `src/native/git/SessionDiffRevisions.ts` | `openclaw` (OpenClaw) · OCLW-07 | **Implementación propia de Ego; patrón asimilado de OpenClaw, sin traducción de código.** Allí se resuelve el *merge-base* de una rama; aquí se registra el SHA base de la sesión. |
| `src/native/fs/FileLockManager.ts` | `career-ops` (Career-Ops) · CARP-02 | **Implementación propia de Ego; patrón asimilado de Career-Ops, sin traducción de código.** La API y la estrategia de recuperación son propias. |

El resto de ficheros del paquete son código original de Ego. Los ficheros que
implementan un **patrón** estudiado en un upstream (sin traducción de código) llevan
una cabecera que lo dice explícitamente ("implementación propia de Ego") y **no**
llevan la forma `Adapted from`.

## Aviso de la licencia MIT del upstream

```
MIT License

Copyright (c) 2026 Louis Raillard

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

Upstream: <https://github.com/Louis-CFM/coucou> (rama `main`, commit `595092b`).

> **Nota de procedencia:** `repos-referencia/` está en `.gitignore`, de modo que la ruta
> del upstream no es resoluble en un clon limpio del repo de Ego. Este fichero es el
> que hace resoluble el aviso.

Ver también `docs/research/licencias-obligaciones.md` y la ficha de extracción
`docs/extractions/coucou.md`.
