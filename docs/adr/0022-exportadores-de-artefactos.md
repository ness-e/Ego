# ADR 0022: Exportadores de artefactos y REPL de expresiones — TypeScript puro, cero dependencias

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-21 |
| Estado | Aceptado (implementado en la Ola 3 por A3) |
| Nivel jerárquico | 4.Architecture (`docs/jerarquia-canonica.md`) |
| Decisor | Owner (Ola 3, Fase 02) · implementación y texto técnico A3 · redacción A1 |

## Contexto

El documento maestro §7.2 exige **exportadores a PDF/DOCX/XLSX/PPTX** y un
**REPL Python**. En el repo había **0 coincidencias** de
`render_pdf|generate_docx|generate_xlsx|generate_pptx`: Ego sólo exportaba
Markdown.

Dos guardrails condicionan la solución:

1. **`AGENTS.md` §4 prohíbe Python en el producto.** El brief de la Ola 3 lo
   reitera: *"Sin Python: implementación TS"*.
2. **El empaquetado de Electron es frágil con lo nativo.** `asarUnpack` sólo
   cubre `*.node`; un binario externo o una dependencia con binario propio
   rompe el bundle o exige una cadena de herramientas que no está en el
   `toolchain` del producto.

A esto se añade una restricción operativa: **A7 tiene el monopolio de
`pnpm install`**. Cualquier dependencia nueva exige un ciclo de instalación
que, en el momento de la decisión, no era ejecutable ni verificable dentro de
la ola.

## Alternativas consideradas

| Alternativa | Licencia | Veredicto | Motivo |
|---|---|---|---|
| `pdfkit` | MIT | ❌ Descartada | Dependencia con tipografías y assets; exige instalación |
| `jspdf` | MIT | ❌ Descartada | 3 MB de bundle y las mismas condiciones de instalación |
| `pdf-lib` | MIT | ❌ Descartada | Mismo motivo; además no cubre DOCX/XLSX/PPTX |
| `docx` | MIT | ❌ Descartada | Cero dependencias pero **arrastra `jszip`** (licencia dual) |
| `exceljs` | MIT | ❌ Descartada | Igual: arrastra `jszip` |
| `xlsx@0.18.5` (SheetJS) | Apache-2.0 | ❌ Descartada | **Ya no se publica en npm**; la versión instalable no recibe mantenimiento y tiene CVEs conocidos |
| `pptxgenjs` | MIT | ❌ Descartada | Arrastra `jszip`; además exige instalación |
| `jszip` | **MIT OR GPL-3.0-or-later** | ❌ Descartada | Licencia **dual**: obliga a elegir rama explícitamente y contaminaría el árbol de licencias |
| `archiver`, `fflate` | MIT | ❌ Descartada | Competidores de un escritor ZIP propio, sin ventaja |
| **Escritor ZIP + escritor PDF propios sobre `node:zlib`** | MIT (runtime de Node) | ✅ **Elegida** | **Cero dependencias**, cero licencias ambiguas, cero cambios de empaquetado, cero entradas para A7 |

**Criterio de decisión:** *¿cuántas dependencias nuevas y con qué licencias
entra un artefacto que el usuario puede exportar?* La respuesta tiene que ser
**cero**: un exportador de PDF no puede-meter en la cadena de suministro del
producto una biblioteca con licencia dual.

## Decisión

1. **Cero dependencias.** Los exportadores se implementan sobre `node:zlib`
   (MIT, runtime de Node):
   - un **escritor ZIP propio** (PKWARE APPNOTE 6.3.3) para DOCX/XLSX/PPTX;
   - un **escritor PDF 1.7 propio** con `xref` de desplazamientos reales y
     **fuente base-14**, sin incrustar ficheros de fuente ⇒ el texto del PDF
     generado es **seleccionable**.
2. **El "REPL Python" es un REPL de expresiones en TypeScript**, llamado
   `eval_expression` (nombre honesto: no es Python). Implementado como
   **intérprete propio** (tokenizador → parser → evaluador) que **no** usa
   `eval`, `new Function`, `node:vm` ni `child_process`: **no existe ninguna
   ruta de ejecución arbitraria**. Lista blanca de funciones puras; acceso a
   propiedades de datos permitido, métodos de datos bloqueados;
   `require`/`process`/`globalThis`/`__proto__`/`constructor` **inexistentes**.
   Presupuesto de pasos acotado.
3. **Si alguna vez hace falta Python, la vía es un servidor MCP Python
   externo** (fuera del producto), nunca una tool nativa.

## Consecuencias

- Positivas:
  - ✅ **Cero superficie de suministro**, cero licencias ambiguas, cero cambios
    de empaquetado Electron, **cero entradas para A7**.
  - ✅ Artefactos **reales y verificables por estructura** (partes OOXML
    obligatorias, cabecera/trailer/`xref` de PDF), **no stubs**.
  - ✅ El REPL no es un `eval` disfrazado: es un intérprete con lista blanca
    y presupuesto de pasos.
  - ✅ Coherente con el **principio D3** (`AGENTS.md` §4): usar primitives de
    librería; aquí la primitive es `node:zlib` (el runtime), no un paquete.
- Negativas:
  - ⚠️ El formato de parche de `fs_edit_patch` (reemplazos exactos, fail-closed
    ante ambigüedad) **no es un diff unificado**: un diff con hunks parciales es
    una **decisión de producto**, no de infraestructura.
  - ⚠️ La generación de PDF cubre **texto con fuente base-14**: **no hay motor
    de layout** (tablas, imágenes, paginación sofisticada). Ampliarlo es
    trabajo futuro, no un bug.
- Deuda asumida:
  - El soporte de **tablas e imágenes** en PDF queda fuera de alcance.
  - El REPL de expresiones **no** es un intérprete de Python: si alguien espera
    `import`/`def`/f-strings, el nombre `eval_expression` y esta ADR son la
    advertencia.

## Referencias

- `packages/tools/src/exporters/` — escritores ZIP (OOXML) y PDF.
- `packages/tools/src/repl/` — tokenizador, parser y evaluador del REPL.
- `packages/tools/test/exporters.test.ts` — verificación por estructura.
- `docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A3-ola3.md` §3 —
  texto técnico de origen (decisión, alternativas con licencias verificadas con
  `npm view <pkg> license`, y los tests con su output).
- `AGENTS.md` §4 — guardrails (prohibición de Python; principio D3 de
  primitives).
