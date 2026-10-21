# ADR 0025: Dos planos de atribución — código realmente derivado vs. asimilación de patrón

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-21 |
| Estado | Aceptado (implementado y verificado en `docs/extractions/**` y `packages/**`) |
| Nivel jerárquico | 4.Architecture (`docs/jerarquia-canonica.md`) |
| Decisor | Owner (alcance: 25 fichas, 2026-10-21) · clasificación y manifiesto A6 · texto técnico A5 y A2-bis · redacción A1 |
| Sustituye a | Nada - fija la convención que `docs/extractions/README.md` §4.3 describía de forma ambigua |
| Relacionado | [ADR-0018](0018-motor-de-personaje.md) · `docs/extractions/README.md` §4.3-§4.4 · `EGO-FIND-82` · `EGO-FIND-83` |

## Contexto

`AGENTS.md` §2 fija la regla de los repos de referencia: *"No copiar código directamente — extraer patterns y adaptar"*.
`docs/extractions/README.md` §4.3 exigía, para **todo fichero derivado de código de un repo de referencia**, la cabecera
`Adapted from <upstream> (<LICENCIA>), <ruta de origen>` y un aviso de licencia en un `LICENSE.md` dentro del paquete.

El problema: **"derivado" y "asimilado" son cosas distintas y la convención las mezclaba**.

La Ola 8 (2026-10-21) lo hizo visible de forma dura. Al clasificar 86 ficheros de `packages/avatar/**` con evidencia mecánica
(residuo de *shingles* de 48 caracteres contra el clon + prueba de literales), 63 resultaron **puertos reales** y 23 **nativos**
de Ego. Y en el catálogo ocurrió lo contrario: 39 celdas y 25 filas afirmaban `Adapted from` sobre implementaciones **propias**
de Ego que solo asimilan un patrón — entre ellas `COUC-03` (`ApprovalEngine`), que no es código derivado de `IslandTypes.swift`.

El riesgo no es estético. `khoj` es **AGPL-3.0**: un crédito falso de derivación es, a la vez, una mentira y un problema de
licencia. `EGO-FIND-83` ya recogió la corrección: el código atribuido a khoj era implementación propia y el owner decidió
*"retirar todo el crédito a khoj"*.

El hallazgo `EGO-FIND-82` decía, con su base de medida de 2026-10-20: *"0 de 313 ficheros de `packages/` llevan la cabecera
canónica"*. La cifra ya no era válida y el hallazgo estaba **partido en dos**: el catálogo y el código.

## Decisión

Se fijan **tres planos** y una regla por plano. El término "atribución" se reserva para el primero.

### Plano 1 — Código realmente derivado (un port literal)

Lleva, en la cabecera del fichero, la forma canónica:

```text
Adapted from <upstream> (<LICENCIA>), <ruta de origen>
```

y su paquete lleva `LICENSE.md` (y `NOTICE` cuando procede) con el aviso del upstream.

- El upstream, la licencia y la ruta se **verifican contra el clon real** (`repos-referencia/<slug>/`): `git config --get
  remote.origin.url`, el fichero `LICENSE`/`LICENSE.md`/`NOTICE` y la existencia del fichero de origen. Nunca de memoria.
- Si el upstream **no declara licencia**, la cabecera lo dice literalmente (`licencia no declarada en el origen`).
  No se infiere ni se completa.

### Plano 2 — Asimilación de patrón (código propio de Ego)

**No** lleva `Adapted from`. Su cabecera dice la verdad: *"implementación propia de Ego; patrón asimilado de `<repo>` (`<ID>`),
sin traducción de código"*.

Cubre tanto el código nativo de un paquete como el que reimplementa una idea de un upstream. La asimilación de un patrón es
**el modo normal** de este repo: no genera obligación de atribución de código, pero sí de no mentir sobre el origen.

### Plano 3 — Catálogo de extracción (fichas y backlogs)

Registra la **procedencia del upstream estudiado** (upstream, licencia, commit verificado, ruta del clon) como **datos**,
nunca como una afirmación de derivación. Una ficha es un documento de análisis escrito por Ego: no es una obra derivada del
repo que estudia.

Consecuencia directa: ninguna fila de catálogo puede afirmar derivación de código salvo que el fichero de Ego citado
**lleve** la cabecera canónica. Y **ninguna** puede acreditarla a `khoj` (AGPL-3.0), por decisión del owner.

### Denominador, reproducibilidad y puerta

- La clasificación **no** es una edición manual: hay un **manifiesto** (fichero → derivado/nativo + upstream + licencia + ruta)
  que es el denominador de la puerta, y un **generador idempotente** que produce las cabeceras desde el manifiesto
  (`--check` → 0 cambios).
- La puerta se ejecuta contra el manifiesto y falla si: un derivado no lleva cabecera · la forma, el upstream, la licencia o
  la ruta no cuadran · **un nativo la lleva** · algo no está clasificado · falta el aviso de licencia en el paquete.
- En CI, donde **no existen los clones de `repos-referencia/`**, la puerta corre en **modo degradado** (`--sin-clones`):
  verifica estructura (forma de la cabecera, coherencia ficha↔backlog, fichero no clasificado, crédito a AGPL) y **omite** lo
  que exige el clon. La salida declara siempre el modo. La verificación fuerte es local.

## Consecuencias

### A favor

- El inventario de obligaciones de licencia es **auditable**: cada fichero con cabecera tiene upstream, licencia y ruta
  verificados contra el clon, y la puerta lo comprueba.
- La clasificación `packages/avatar/**` es **reproducible** (86 ficheros: 63 derivados + 23 nativos) y `LICENSE.md`/`NOTICE`
  se **generan** desde el manifiesto → no pueden divergir.
- La atribución a `khoj` queda **retirada** del código y del catálogo (0 referencias `KHOJ-xx` en `packages/**`; las 5 filas
  de compuerta pasan a `🚫 Descartada`).
- Se corrige la afirmación falsa más dañina del repo: un crédito AGPL sobre código propio.

### En contra

- Hay **dos** formas canónicas conviviendo (la de fichero `Adapted from …` y la de paquete `ADAPTADO de … - ver LICENSE.md`).
  Se documentan ambas en §4.3; la puerta acepta ambas.
- Clasificar exige **comparar contra el clon**, no leer el comentario: es trabajo mecánico real (shingles + literales), no una
  edición de cabeceras.
- El modo degradado de CI **no** detecta que un upstream cambió de licencia. Esa comprobación es local, y la salida lo declara
  para que nadie lo confunda.

## Alternativas descartadas

| Alternativa | Veredicto | Motivo |
| --- | --- | --- |
| Atribución en prosa (`Extraído y adaptado de …`) | Descartada | No es verificable por máquina y se confunde con el plano 2. |
| Absorber las violaciones en el baseline de lint | Descartada | Escondería el error de fondo (la mezcla de planos), no el síntoma. |
| Clonar los 25 repos de referencia en CI | Descartada | Lenta y frágil; el valor de la puerta en CI es estructural. |
| No ejecutar la puerta en CI | Descartada | Dejaría a CI sin detectar ninguna regresión de este tipo. |
| Declarar `MIT` al motor canvas | Descartada | El `LICENSE.md` del clon dice *"según archivo de origen"*: no hay SPDX ni copyright identificable. |
| Indicar solo el upstream (sin ruta) | Descartada | Sin ruta no se puede localizar el fichero de origen: la atribución no es verificable. |

## Pendiente que esta decisión deja abierto

- **D4 (owner, 2026-10-21):** ejecutar la sustitución de los puertos verbatim de Mochi por geometría propia. Quedan 5 ficheros
  (`core/timeline.js`, `render/ara-head.js`, `render/body.js`, `runtime/poses.js`, `studio/sound.js`) más
  `studio/render/accessories.js`, que la evidencia demostró idéntico al clon (366/366) cuando se creía sustituido.
  Mientras tanto están **correctamente atribuidos** como derivados, así que no hay exposición de licencia: la deuda es de
  diseño, no legal.
- La **licencia del motor canvas** queda como *"no declarada en el origen"* hasta que el owner disponga del material con
  licencia clara.
