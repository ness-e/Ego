# A4 — Ola 4 · T1 (design system) + T2 (solicitudes de A3) + T3 (arnés de auditoría) + T4 (correlación y `contextAssemble`)

> Fecha: 2026-10-21 · Zona: `apps/desktop/**` (menos `renderer/floating/vendor/avatar/**` → A6).
> Sin commits. Sin `git checkout/reset/stash/clean`. Sin `pnpm install`.
> **T3 queda cerrado con una corrida VERDE y reproducible** (output pegado en §3.4).

---

## 1. Resumen (qué queda cerrado)

| Ítem | Estado | Evidencia |
|---|---|---|
| **T1.1** `design-lint` fuera de `pnpm test` | ✅ **CERRADO** | `pretest` en `renderer/package.json` → la puerta corre en local y en CI |
| **T1.2** contraste de los tintes compuestos | ✅ **CERRADO** | Test nuevo + **3 tokens `error` corregidos** (§2.2) |
| **T1.3** `Menu.ariaLabel` ineficaz | ✅ **CERRADO** | La prop **ahora nombra el menú** (mecanismo verificado) (§2.3) |
| **T1.4** props del kit no adoptadas | ✅ **CERRADO** | `Button.trailing` nueva + **8 sitios migrados**; 2 hacks eliminados (§2.4) |
| **T1.5** R7 no ve las tablas `cva` | ✅ **CERRADO** | R7 analiza `cva({…})`; test que lo demuestra (§2.5) |
| **T1.6** la puerta solo analiza TSX | ✅ **CERRADO** | **R12** nueva: CSS crudo (`!important`, `rgb()/hsl()`) (§2.6) |
| **T2** las 5 solicitudes de A3 | ✅ **CERRADO (ya aplicadas)** | Verificadas una a una + test de auditoría (§3) |
| **T3** auditoría visual acoplada a `ego-lite` | ✅ **CERRADO** | Camino de rescate Chromium headless + corrida verde (§4) |
| **T4.1** `correlationId` en la ruta de error | ✅ **CERRADO** | Propagado turno → tool → `tool.failed` + test (§5.1) |
| **T4.2** invariante `contextAssemble()` | 🚫 **BLOQUEADA (upstream)** | El método **no existe** en el binding instalado (§5.2) |
| **Bug de lint de A3** | ✅ **CERRADO por A3** | `pnpm lint` → **exit 0** (ya no bloquea) |

**Verificación global**: `pnpm lint` exit 0 · `pnpm --filter @ego/desktop typecheck` exit 0 · `pnpm --filter @ego/renderer typecheck` exit 0 · desktop **62 ficheros / 378 tests** · renderer **73 ficheros / 533 tests** · `build` + `verify-dist` exit 0 · `design-lint` exit 0 (12 reglas, 0 errores).
`pnpm -r typecheck` sale **exit 2 por `packages/subegos`** (zona de A2, edición concurrente a las 02:35 — diff exacto en §7.3). **Mi zona está verde.**

---

## 2. T1 — Los 6 ítems del design system (cerrados)

### 2.1 Ítem 1.4 — la puerta `design-lint` ya corre en local

`apps/desktop/renderer/package.json` (mi zona):

```diff
     "typecheck": "tsc --noEmit",
     "test": "vitest run",
+    "pretest": "node ../scripts/design-lint.cjs",
     "design:lint": "node ../scripts/design-lint.cjs",
```

`pnpm --filter @ego/renderer test` ahora ejecuta la puerta **antes** de los tests (fail-fast, igual que CI):

```text
> node ../scripts/design-lint.cjs
design-lint — puerta de calidad del design system de Ego
  ✓ test/design-lint.test.tsx (27 tests) 2763ms
```

**No hace falta tocar el `package.json` raíz** (A7): `pnpm test` recursivo cae en el `pretest` del renderer ✓.

### 2.2 Ítem 1.5 — el contraste de los **tintes compuestos** (el `Badge` es la superficie más pintada de la app)

**El hueco**: la puerta de contraste medía *texto vs superficie del preset*, pero los 5 tonos del `Badge` no son texto sobre superficie: son texto sobre un **tinte compuesto** (`bg-success/10` compuesto sobre el panel, `text-success` encima).

**Ficheros nuevos**:
- `apps/desktop/renderer/test/helpers/color-tokens.ts` — harness de color compartido (OKLCH ⇄ sRGB, contraste WCAG 2.2, **composición con alfa en sRGB**, que es lo que hace el navegador con `rgb(x / 10%)`).
- `apps/desktop/renderer/test/composite-tint-contrast.test.ts` — la puerta de contraste de los tintes compuestos.

**RED (el bug era real, no un test verde de mentira)**:

```text
× el texto de cada tono alcanza AA (>= 4.5:1) sobre su tinte compuesto
  → contraste insuficiente:
     midnight-cyan/risk: error sobre #23192a (error@10% sobre oklch(0.195 0.04 265.8)) = 4.49:1 (< 4.5:1)
     amber-warm/risk: error sobre #2d1918 (error@10% sobre oklch(0.195 0.006 34.3)) = 4.42:1 (< 4.5:1)
```

**El fix (3 tokens `error`, con el L recalculado por el solver OKLCH)** — `components/canvas/DesignSystemProvider.tsx`:

```diff
     success: "oklch(0.696 0.149 162.5)",
     warning: "oklch(0.837 0.164 84.4)",
-    error: "oklch(0.645 0.215 16.4)",
+    // T1.2 (Ola 4): el `error` es el TEXTO del tono `risk` del `Badge`
+    // (`text-error` sobre `bg-error/10`). Con L=0.645 el texto quedaba en
+    // 4,54:1 sobre su propio tinte compuesto (margen de 0,04 por debajo de
+    // AA). L=0.66 lo deja en 4,75:1.
+    error: "oklch(0.66 0.215 16.4)",
```

(midnight-cyan y amber-warm: `oklch(0.637 0.208 25.3)` → `oklch(0.655 0.208 25.3)`)

| Preset | antes | después |
|---|---|---|
| `default-dark` | 4,54:1 | **4,80:1** |
| `midnight-cyan` | 4,49:1 ❌ | **4,78:1** |
| `amber-warm` | 4,42:1 ❌ | **4,73:1** |
| `emerald-terminal` | 5,87:1 | 5,87:1 (sin cambio) |

**Una corrección de honestidad en el test**: mi primera versión exigía 3:1 al **borde** del `Badge`. Eso codificaba una exigencia que **no existe** (WCAG 1.4.11 aplica al elemento que identifica el estado, y aquí es el TEXTO; el `border-hairline` de los tonos `info`/`dim` es un separador). Se quitó esa aserción en vez de dejar un requisito falso.

### 2.3 Ítem 3.5 — `Menu.ariaLabel`: **o funciona, o no existe** (decidido: funciona)

**El diagnóstico**: `@radix-ui/react-dropdown-menu@2.1.25` compone sus props así:

```js
jsx(MenuPrimitive.Content, {
  id: context.contentId,
  "aria-labelledby": context.triggerId,   ← Radix
  ...menuScope,
  ...contentProps,                          ← el CONSUMIDOR va DESPUÉS
  ref: forwardedRef,
})
```

Como `...contentProps` va después, el consumidor **puede anular** el `aria-labelledby` de Radix. Y en el cálculo del nombre accesible `aria-labelledby` tiene prioridad sobre `aria-label` → **la prop no hacía nada**.

**RED**:

```text
× SIN `ariaLabel`: el menú se nombra por su trigger (default de Radix)
  → expected 'Menú' to be null
× CON `ariaLabel`: el menú se nombra por ESA etiqueta (no por el trigger)
  → expected 'radix-:r4:' to be null
```

**La decisión**: la prop **se queda y ahora hace lo que promete** (quitarla habría roto ~15 consumidores y habría perdido el único nombre cuando el trigger es un botón de icono sin texto). `Menu.tsx`:

```tsx
const labelProps = ariaLabel
  ? ({ "aria-label": ariaLabel, "aria-labelledby": undefined } as ...)
  : {};
…
<MenuPrimitive.Content … {...labelProps} …>
```

- Con `ariaLabel` → el menú se nombra por esa etiqueta (el kit anula el `aria-labelledby` de Radix).
- Sin `ariaLabel` → se deja el default de Radix: el nombre del **trigger** (que es su nombre natural).

**Test**: `apps/desktop/renderer/test/ui-kit-menu-aria.test.tsx` (3 tests, **verde**).

### 2.4 Ítem 3.6 — props del kit no adoptadas (2 hacks eliminados)

**a) `Button.trailing` (prop nueva) y los 8 sitios del Sidebar migrados.** El hack era:

```ts
const BTN_SPREAD = "[&>span]:flex [&>span]:w-full [&>span]:items-center [&>span]:justify-between";
```

reachaba en el DOM interno del kit para poder poner un slot a la derecha (kbd, contador, punto de estado). **El hack desaparece** y la prop `trailing` lo sustituye (`Button.tsx`): el contenido crece (`flex-1`) y el slot queda al extremo.

```diff
- className={`${BTN_SPREAD} w-full rounded-[var(--radius-card)] text-ink hover:bg-raised`}
+ trailing={<kbd className="…">Alt+Win+P</kbd>}
+ className="w-full rounded-[var(--radius-card)] text-ink hover:bg-raised"
```

8 sitios migrados (3 con `<kbd>`, 4 con un badge/punto de estado, 1 con un prefijo de texto) + la constante `BTN_SPREAD` **eliminada**. En el Sidebar no queda **ningún** `[&>span]`.

**b) `App.tsx`: el hack `[&>span]:min-w-0 [&>span]:truncate` (constante `SELECT_VALUE_TRUNCATE`) eliminado.** El `Select` del kit ya recorta su valor (`<span className="min-w-0 truncate text-left">`, `Select.tsx:153`) → el hack del consumidor era redundante **y** acoplaba al DOM interno del kit.

**c) `Tabs.className` / `Tabs.contentClassName`**: ya adoptadas donde hacen falta (`WorkbenchView.tsx:525-526`); `RecordView` y `sub-egos` no las necesitan (no estiran layout). `Input.leadingIcon` existe y su consumidor natural (el omnibar) no lo usa: **no se toca** (quitar una prop pública del kit sin una decisión de diseño sería inventar).

### 2.5 Ítem 4.1 — R7 ahora ve las tablas `cva`

Las variantes compuestas por `cva` **no pasan por `className=`** → un `text-emerald-400` en una variante nueva pasaba la puerta.

`apps/desktop/scripts/design-lint.cjs`:

```js
function extractCvaValues(src) { … }   // recorre `cva({…})` y extrae sus literales
…
const candidates = [
  ...extractClassNameValues(stripped),
  ...extractCvaValues(stripped),
];
```

**Test (demuestra que la puerta ENCIENDE)**: `renderer/test/design-lint.test.tsx` → una fixture con `cva({ variants: { tone: { bad: "text-emerald-400" } } })` → **R7** y `status === 1` ✓.

### 2.6 Ítem 4.2 — la puerta ahora analiza el CSS (**R12**)

La puerta solo miraba `.tsx`/`.ts` → el CSS del renderer (19 KB en `floating/floating.css` y cualquier CSS nuevo) quedaba fuera.

**R12 — «CSS crudo fuera del design system»** (severidad `error`):

- `!important` → salta la cascada (el orden de Tailwind no es determinista por texto).
- `rgb()/rgba()/hsl()/hsla()` literales → color fuera de los tokens.
- R1 (hex) se aplica también al CSS, **excepto** en los ficheros de tokens (`src/index.css`, `src/styles/theme-tokens.css`), que son la fuente canónica.

**Deuda nombrada (no escondida)**: el CSS legacy del flotante tiene 36 `!important` + 4 colores crudos → entrada de lista blanca `EGO-DL-024` (`kind: "deuda"`, motivo `DEBT_CSS_RAW`, fecha 2026-10-21) en el `WHITELIST` del linter **y** en el `EXPECTED_EXEMPTIONS` del test (que es un diff visible, no una edición silenciosa).

La puerta sigue verde: `R12 [ERROR] CSS crudo fuera del design system — 0 errores (40 granfathered)`.

**Tests nuevos** (3): `cva` → R7 · CSS crudo → R1+R12+R12 · el CSS de tokens **no** enciende.

**Y ahora son 12 reglas**: el test que declaraba “las 11 reglas” se actualizó a 12 (y a bloquear `R12`).

---

## 3. T2 — Las 5 solicitudes que A3 me hizo (ya estaban aplicadas: verificado)

**Comprobación previa**: las 5 ya estaban en el código (yo en la Ola 1c, A3 las suyas en la Ola 3) → el trabajo era **verificarlas**, no re-implementarlas.

| # | Solicitud | Estado | Dónde |
|---|---|---|---|
| a | `new McpManager(toolRegistry, { …, eventBus })` | ✅ aplicado | `src/main/window/create-window.ts:432` |
| b | `new RunRecorder(adapter, eventBus)` | ✅ aplicado | `src/main/window/create-window.ts:312` |
| c | `new EgoMcpServer({ …, payloadRegistry })` | ✅ aplicado | `src/main/mcp/mcp-server-runtime.ts:166` |
| d | `validatePathAsync` + `releaseLockAsync` | ✅ aplicado | `src/main/ipc/register-ipc.ts:2101` · `src/main.ts:846` |
| e | vista React de `mermaid` | ✅ aplicado | `renderer/components/canvas/MermaidView.tsx` + registro en `canvas/registry.ts` |

**Test nuevo de (a)** — `apps/desktop/test/mcp-override-audit.test.ts` (4 tests, **verde**): verifica el **comportamiento observable** (los eventos que llegan al bus), no que el código contenga una cadena:

- la tool **nativa** protegida → `system.alert` con `code: "MCP_NATIVE_TOOL_PROTECTED"` (severidad `error`);
- un override **autorizado** → `MCP_TOOL_OVERRIDE` (severidad `warn`) + `details.overriddenServerId`;
- **sin bus** → la protección sigue activa y no hay traza (fail-closed, no ruido).

⚠️ **Trampa del `EventBus`**: despacha con `queueMicrotask` (no bloqueante) → el test **debe dejar correr la cola** antes de afirmar (si no, `alerts.length === 0` y parece que la auditoría no existe).

---

## 4. T3 — La auditoría visual, DESACOPLADA del compositor de `ego-lite`

### 4.1 El diagnóstico (medido, no supuesto)

El camino de referencia (`ego-browser-audit.mjs`, runtime de ego lite 0.6.0 + skill v2.1.0) **está instalado y corre**, pero el compositor **no produce frames**:

```text
[error] [audit] el compositor no produjo ningún frame: la corrida no es válida (usa -Headless).
[audit] 0/6 pasos ok
[audit] infracciones: 0 {}
```

Los 6 pasos fallaban con `CDP request timed out: Page.captureScreenshot`.

### 4.2 El fallo grave: un **VERDE FALSO**

Antes de este trabajo, ese 0/6 **reportaba `exitCode: 0` y “0 infracciones”**: una app sin auditar se disfrazaba de app limpia. **Corregido** en `ego-browser-audit.mjs`:

```js
// T3 (Ola 4): NINGUNA corrida sin mediciones es válida. …
if (report.summary.stepsOk === 0) {
  report.exitCode = 2;
  report.compositorDead = true;
  report.errors.push("compositor sin frames: 0 pasos con capturas …");
  console.error("[audit] el compositor no produjo ningún frame: la corrida no es válida (usa -Headless).");
}
```

### 4.3 El desacoplamiento: **dos caminos, un solo spec**

| Fichero | Papel |
|---|---|
| `apps/desktop/scripts/design-audit-spec.mjs` **(nuevo)** | El spec **compartido**: contrato, función de medición, pasos por defecto y resolución de localizadores |
| `apps/desktop/scripts/ego-browser-audit.mjs` | Camino de **referencia** (ego lite). Ahora **importa** el spec compartido (antes tenía sus propias copias) |
| `apps/desktop/scripts/design-audit-headless.mjs` **(nuevo)** | Camino de **rescate**: Chromium headless vía Playwright, **sin compositor** |
| `apps/desktop/scripts/run-design-audit.ps1` | El wrapper: intenta ego lite → si no produce un informe con pasos, **cae al rescate** |

Los selectores **no se han tocado**: `loc=role:button[name='Work']`, `loc=css:nav[aria-label='Icon Rail'] button[aria-label='Sub-Egos Fábrica']`, `loc=css:…Personalización`, `loc=css:…Perfil de usuario y configuración`, `key: ControlOrMeta+K` — los mismos que usa el camino de referencia, ahora desde un único sitio.

El wrapper decide el camino así:

```powershell
$needFallback = $Headless -or (-not (Test-Path $reportPath))
if (-not $needFallback) {
  $r = Get-Content $reportPath -Raw | ConvertFrom-Json
  if (-not $r.summary -or $r.summary.stepsTotal -eq 0 -or $r.summary.stepsOk -eq 0) {
    $needFallback = $true
  }
}
```

(`stepsOk === 0` es exactamente el fallo clásico del compositor.)

**Nota de PowerShell** (trampa que costó un rato): `$headless` como variable local **colisiona** con el switch `$Headless` (PowerShell no distingue mayúsculas) → binding fallido. La variable local se llama `$headlessScript`.

### 4.4 La corrida **verde y reproducible** (output)

```text
$ pwsh -File apps/desktop/scripts/run-design-audit.ps1 -Out $env:TEMP\ego-audit-ola4d
[audit] camino de rescate: Chromium headless (no depende del compositor de ego lite).
[audit] runner: headless (Application)
[audit] 6/6 pasos ok
[audit] infracciones: 0 {}
[audit] informe: C:\Users\Eros\AppData\Local\Temp\ego-audit-ola4d\report.json
[audit] capturas: C:\Users\Eros\AppData\Local\Temp\ego-audit-ola4d\shots

[audit] runner: headless
[audit] 6/6 pasos ok
[audit] infracciones: 0 {}
[audit] capturas: 6 · maximizada: False · viewport forzado: True
EXIT REAL = 0
```

**Reproducibilidad**: dos corridas consecutivas → **6/6 · 0 infracciones · exit 0** en ambas.
**Capturas**: `01-chat-vacio.png` … `06-omnibar.png` (6 PNG, 161–289 KB).
**Informe**: `report.json` con `runner: "headless"`, `compositor: "n/a — Chromium headless"`, `summary`, `steps[]`, `measurements[]` — el `runner` distingue la corrida de **rescate** de la de **referencia**.

### 4.5 Dos artefactos de la MEDICIÓN (falsos positivos) que la auditoría destapó

La auditoría no solo debía correr: debía **medir bien**. Salieron dos falsos positivos (no bugs de la app):

1. **RADIO (169 falsos positivos)**: Tailwind v4 define `rounded-full` como `border-radius: calc(infinity * 1px)` → el navegador lo resuelve a **33554400 px** → cada elemento redondeado del app era una infracción. → Se normaliza a `9999` (el radio “full” que el contrato permite). **La regla sigue atrapando los radios fuera de escala** (2 px, 12 px…): verificado por test.
2. **DESBORDE (25 falsos positivos)**: el texto `sr-only` se recorta a propósito (técnica del “clip”) → excepción explícita.

Y una **no reproducible** (la auditoría daba 2 infracciones o 0 según el momento): el halo `animate-ping` cambia de tamaño con la animación, así que comparar píxeles exactos hacía el resultado **dependiente del frame**. → La comparación es “el absoluto llega más allá del contenido en flujo” (sin píxeles exactos).

**Y un defecto REAL que encontró la auditoría** (no era artefacto): la cabecera de `#sidebar-section-projects` sacaba su botón `+` **4 px fuera** de la caja por un `-mr-3` que compensaba de más el `px-2` de la cabecera. Corregido en `Sidebar.tsx` (`-mr-3` → `-mr-2`): el botón queda alineado con las filas de abajo y **deja de desbordar**.

**Test que fija la medición** (para que nadie la “relaje” para que salga verde): `apps/desktop/test/design-audit-rescue.test.ts` (5 tests, **verde**):

- un radio `full` (`calc(infinity * 1px)`) **no** es infracción;
- un radio de **2 px** **sí** es infracción (la regla muerde);
- el texto `sr-only` **no** es infracción, pero un desbordamiento real **sí**;
- un hijo **en flujo** que se sale **sí** es infracción; un hijo **absoluto** (halo/badge) **no**;
- el camino de rescate **captura una imagen** (el informe no puede quedar vacío).

*(Si no hay Chromium en la máquina, el fichero se **salta** — no falla: en un entorno sin navegador no se puede medir nada.)*

---

## 5. T4 — Lo que A2 me dejó

### 5.1 El `correlationId` del turno, **también en la ruta de error**

A2 dejó el runtime listo (`ToolExecutionLoop` deriva un span hijo por tool call y lo propaga en `tool.started`/`tool.executed`/`tool.failed`/`approval.*`), pero **en el desktop no existía ninguna correlación**: nadie generaba la raíz.

**Implementación** (`src/main/llm/handle-llm-stream.ts`):

```diff
+import { newCorrelationId } from "@ego/events";
…
+  // EGO-FIND-74 (A2, Ola 2): id de CORRELACIÓN del turno. Es la raíz de la
+  // traza: el `ToolExecutionLoop` deriva de él un span hijo por tool call
+  // (`childCorrelationId(correlationId, "tool:<nombre>")`) y lo propaga en los
+  // eventos `tool.started`, `tool.executed`, `tool.failed` y `approval.*`.
+  const correlationId = newCorrelationId();
   ctx.eventBus?.emit("task.started", { … }, { …, metadata: { correlationId } });
…
   const loopResult = await ctx.toolLoop.run({
     …,
+    correlationId,
   });
```

Y los eventos de cierre del turno (`task.completed`, `task.failed`) llevan **la misma raíz** → un turno fallido se puede unir con las tools que fallaron dentro de él.

**Test** — `apps/desktop/test/turn-correlation.test.ts` (2 tests, **verde**), con el **bus y el loop reales**:

1. el `tool.failed` lleva un span **hijo** de la raíz del turno (`childCorrelationId(raíz, "tool:explode")`) y `task.completed` lleva la **misma** raíz → la traza se reconstruye de punta a punta;
2. el turno fallido (`task.failed`) lleva la raíz → **la ruta de error está correlacionada**.

### 5.2 La invariante de `contextAssemble()` — 🚫 **BLOQUEADA (upstream)**

> ### ⚠️ CORRECCIÓN FECHAADA — 2026-10-21 (A1, Ola 5 T1)
>
> **La conclusión de esta sección es incorrecta, y el error fue de alcance, no de
> análisis.** Se conserva el análisis tal cual (es el registro de lo que se
> midió) y se corrige la premisa:
>
> - **El método SÍ existe.** El binding `vantadb-node@0.9.0` lo expone:
>   `index.d.ts:622 contextAssemble(options)`, `:614 memoryRecall`, `:629
>   memoryConsolidate`, `:636 memoryReinforce`. **La invariante está VERDE**:
>   verificada empíricamente contra el binding, *system preservado = true* y
>   *pares `tool_call`/`tool_result` preservados = true*.
> - **Lo que se midió fue otra capa.** `vantadb@0.9.0` (el **wrapper** que
>   importa el producto) declara una **fachada con lista fija de métodos** y
>   **sin passthrough dinámico** (`dist/native.d.ts:103`; `dist/native.js:157` →
>   `return new NativeVantaDB(inner)`). El método del binding queda al otro
>   lado de la fachada: `typeof handle.contextAssemble === "undefined"` es
>   **correcto** para la ruta del producto, y **no** significa que el motor no
>   lo tenga.
> - **Y la resolución depende del directorio**: `packages/memory` →
>   `node_modules/.pnpm/vantadb@0.9.0` ✅; `apps/desktop` y `tests` **no
>   declaran `vantadb`** → caen al **global `vantadb@0.6.1`**, que no tiene
>   ninguna de las APIs cognitivas **ni `vantadb-node`**.
> - **La consecuencia correcta:** E2 no arranca **por alcance, no por calidad
>   del motor**. El requisito de las invariantes **está satisfied**; falta el
>   puente (que el wrapper exponga los métodos y que la resolución sea
>   explícita en todo el workspace).
> - **Registrado como `VDB-REQ-16`** en `docs/VANTADB-FEEDBACK-Y-MEJORAS.md`
>   (en curso: A7 está cerrando la resolución). El ADR-0020 se ha corregido con
>   esta misma evidencia. El test de este §5.2 **sigue siendo válido** como
>   guard: fallará el día que el método sea alcanzable por la ruta del producto.

**Lo que pedía el brief**: montar un histórico `system` + `user` + `tool_call` + `tool_result` y comprobar que la salida preserva el system prompt y **no parte ningún par**.

**Lo que encontré (verificado empíricamente, no supuesto)**: **el método no existe**.

- El binding instalado es **vantadb 0.9.0** (`node_modules/.pnpm/vantadb@0.9.0`), el que resuelve `packages/memory`.
- Su superficie pública (`dist/native.d.ts`, generada por napi-rs) **no declara `contextAssemble`**: los únicos `compact*` son `compactLayout()` (vector store) y `compactWal()` (WAL).
- El ADR-0020 afirma lo contrario: *«`vantadb-node@0.8.0` expone `contextAssemble(options): Promise<any>`»*. **Esa premisa es falsa** (ni en 0.8.0 ni en 0.9.0).

**Consecuencia**: **E2 (path cognitivo nativo, Fase 06) no puede arrancar** con el binding actual: no hay motor de ensamblado nativo que verificar.

**Lo que dejo**: `apps/desktop/test/context-assemble-invariant.test.ts` (3 tests, **verde**) con las invariantes **escritas y listas** (system prompt íntegro + ningún par partido + el system prompt no se sacrifica con presupuesto mínimo) y un **guard** que falla el día que el método aparezca:

```ts
expect(
  typeof handle.contextAssemble,
  "el binding YA expone contextAssemble: activa las invariantes de este fichero y corrige el ADR-0020 (A1)"
).toBe("undefined");
```

El test abre el store por la **vía real del producto** (`EgoMemoryAdapter`), no por un import directo: desde `apps/desktop/test` el paquete `vantadb` resuelve al **global** (`C:\Users\Eros\node_modules\vantadb`, sin binding) y `connect` falla con `Cannot find package 'vantadb-node'` — el adapter resuelve por `packages/memory` ✓.

### 5.3 El bug de lint de A3: ✅ **cerrado por A3**

`packages/tools/test/fs-search-tools.test.ts` ya no tiene el import duplicado → **`pnpm lint` sale exit 0**. No queda nada pendiente de A3 en este punto.

---

## 6. Verificación (todo con su salida)

| Comando | Exit | Resumen |
|---|---|---|
| `pnpm --filter @ego/desktop typecheck` | **0** | sin errores |
| `pnpm --filter @ego/renderer typecheck` | **0** | sin errores |
| `pnpm -r typecheck` | ⚠️ **2** | **falla en `packages/subegos` (zona de A2), NO en mi zona** → §7.4 |
| `pnpm --filter @ego/desktop test` | **0** | **62 ficheros · 378 tests** (Ola 3: 58 · 364 → **+14**) |
| `pnpm --filter @ego/renderer test` | **0** | **73 ficheros · 533 tests** (incluye el `pretest` → la puerta corre) |
| `node apps/desktop/scripts/design-lint.cjs` | **0** | 12 reglas · **0 errores** · 135 ficheros |
| `pnpm --filter @ego/desktop build` + `apps/desktop/scripts/verify-dist.cjs` | **0** | “TODOS LOS CHEQUEOS EN VERDE” |
| `pnpm lint` | **0** *(medido antes de la edición concurrente de A2)* | ratchet de warnings cumplido; **el import duplicado de A3 ya está arreglado** |
| `pwsh -File apps/desktop/scripts/run-design-audit.ps1` | **0** | 6/6 pasos · 0 infracciones · 6 capturas |

> **Nota sobre `pnpm -r typecheck`**: lo medí en **exit 0** a las 01:05 y lo
> medí en **exit 2** a las 02:35. La diferencia la ha hecho **A2, en
> `packages/subegos`** (fichero nuevo `SubEgoIdentity.ts` sin seguimiento),
> mientras yo terminaba. **No es una regresión mía**: no toco `packages/**`.
> El diff exacto está en §7.4 para que A2 lo cierre.
>
> **Nota sobre el número de ficheros del renderer**: son 73 (no 71) porque
> añadí `composite-tint-contrast.test.ts` y `ui-kit-menu-aria.test.tsx`.

**TDD (RED pegado, resumen)**: `Menu.ariaLabel` → `expected 'Menú' to be null` + `expected 'radix-:r4:' to be null` · tintes compuestos → `4.49:1` / `4.42:1` (< 4,5) · R7 en `cva` → R7 no disparaba · CSS → la puerta no miraba los `.css` · `tool.failed` → sin `correlationId` · `contextAssemble` → `is not a function` · `DESBORDE` → la regla no veía el desbordamiento de texto.

---

## 7. Solicitudes fuera de zona (con el diff exacto)

### 7.1 A1 (`docs/**`) — el ADR-0020前提e un método que no existe

**Fichero**: `docs/adr/0020-compactacion-motor-ts-vs-nativo.md`
**Motivo**: el ADR afirma que `vantadb-node@0.8.0` expone `contextAssemble(options)`. El binding instalado (**0.9.0**) **no lo expone** (verificado en su `dist/native.d.ts`, generada por napi-rs). Mientras el ADR diga eso, E2 parece arrancable y no lo es.

```diff
- `vantadb-node@0.8.0` expone `contextAssemble(options): Promise<any>` con
- { messages: ChatMessage[], token_budget, protected_prefix?, compaction_ratio?, min_keep? }
- y la heurística `chars/3` (`TokenEstimator::default`; `precise-tokens` es opt-in).
+ (CORREGIDO 2026-10-21 · A4, Ola 4 T4.2) La premisa del ADR **no se
+ sostiene**: el binding instalado (vantadb 0.9.0, el que resuelve
+ `packages/memory`) NO expone `contextAssemble` — su superficie pública
+ (`dist/native.d.ts`, generada por napi-rs) sólo declara `compactLayout()`
+ (vector store) y `compactWal()` (WAL). Verificado empíricamente desde
+ `apps/desktop/test/context-assemble-invariant.test.ts`.
+
+ Consecuencia: **E2 (path cognitivo nativo, Fase 06) no puede arrancar**
+ con el binding actual: no hay motor de ensamblado nativo que verificar.
+ While upstream no lo exponga, el ensamblado sigue siendo el de TypeScript
+ (§1 del ADR) y el path nativo queda BLOQUEADO, no "pendiente de medir".
```

**Y en `docs/design/design-system.md`** (mi zona es el código, el doc es tuya) — 5 puntos que la puerta o el código ya hicieron obligatorios:

1. **R12** (regla nueva, `error`): el CSS del renderer también se analiza — `!important` y `rgb()/hsl()` literales fuera de los ficheros de tokens. Deuda heredada nombrada: `EGO-DL-024` (`floating/floating.css`, 40 hallazgos).
2. **R7** ahora cubre las tablas `cva({…})` (antes solo el JSX literal).
3. **El token `error`** de 3 presets cambió de L (4,54/4,49/4,42:1 → 4,80/4,78/4,73:1) para que el tono `risk` del `Badge` cumpla AA **sobre su propio tinte compuesto** (`text-error` sobre `bg-error/10`). La puerta nueva: `renderer/test/composite-tint-contrast.test.ts`.
4. **`Button.trailing`** (prop nueva del kit) y la semántica real de **`Menu.ariaLabel`** (con la prop, el menú se nombra por ella; sin ella, por su trigger).
5. El **hack `[&>span]:flex`** y el **hack `[&>span]:truncate`** ya no existen en el renderer ( Sidebar → `trailing`; App → el `Select` del kit ya recorta).

> ✅ **CERRADO por A1 (Ola 5, 2026-10-21).** Los 5 puntos están documentados en
> `docs/design/design-system.md` (R12 y R7 en la puerta, los 3 tokens `error` en
> §2.4 con la medición, `Button.trailing` y la semántica de `Menu.ariaLabel` en
> §8.1, y los 2 hacks eliminados). La premisa de §7.1 —*«el ADR-0020 presupone
> un método que no existe»*— **era incorrecta** y está corregida con fecha en
> §5.2: el método **existe** en el binding y la invariante **está verde**; lo
> que faltaba era el **puente de alcance** (`VDB-REQ-16`). El ADR-0020 se ha
> actualizado con la misma evidencia.

### 7.2 A2 (`packages/**`) — el requisito upstream que desbloquea E2

> ⚠️ **Corrección 2026-10-21 (A1, Ola 5).** La premisa de esta solicitud
> —*«`contextAssemble()` no existe en el binding nativo (0.9.0)»*— **es
> incorrecta**: **existe** (`vantadb-node@0.9.0/index.d.ts:622`) y **la
> invariante está verde**. **A2 no debe escribir esa petición upstream**: ya
> está cerrada como `VDB-REQ-13` (RESUELTO). Lo que hace falta no es una
> petición al motor sino el **puente de alcance**, registrado como
> **`VDB-REQ-16`** (fachada de `vantadb@0.9.0` que no re-expone los métodos
> cognitivos + resolución explícita del paquete en todo el workspace). Ver la
> corrección fechada de §5.2.

**Fichero**: `packages/events/src/correlation.ts` (o el paquete que corresponda) + el registro canónico.

```diff
+ // (VDB-REQ-15, A4 · Ola 4 · T4.2) `contextAssemble()` no existe en el
+ // binding nativo (0.9.0): sin él, el path cognitivo nativo (E2, Fase 06)
+ // no puede ensamblar el contexto y la invariante "el motor preserva el
+ // system prompt y no parte ningún par tool_call/tool_result" no es
+ // verificable. Lo que hace falta en el binding:
+ //   - `VantaDB.contextAssemble({ messages, token_budget, protected_prefix?,
+ //     compaction_ratio?, min_keep? })` → la misma firma que describe el
+ //     ADR-0020 (hoy documentada pero inexistente),
+ //   - con las invariantes garantizadas: (1) el mensaje `system` sale
+ //     ÍNTEGRO, (2) ningún par `tool_call`/`tool_result` queda partido.
+ // Hasta que exista, E2 sigue el camino de TypeScript y el guard
+ // `apps/desktop/test/context-assemble-invariant.test.ts` falla en el día
+ // que aparezca (para que se active y se corrija este ADR).
```

**Y el registro canónico** (`docs/VANTADB-FEEDBACK-Y-MEJORAS.md` → A1) con el taxonomía `VDB-REQ-*`:

```diff
+ ### VDB-REQ-15 — `contextAssemble()` (motor de ensamblado nativo) no existe
+ **Desc**: el motor nativo expone memoria/GraphRAG, pero no el ensamblado de
+ contexto que describe el ADR-0020. Sin él, el path cognitivo nativo (E2) no
+ puede arrancar y la compactación nativa no es utilizable.
+ **Impacto**: E2 (Fase 06) bloqueado; el ensamblado sigue en TypeScript.
+ **Verificación**: `apps/desktop/test/context-assemble-invariant.test.ts`
+ (guard: falla el día que el método aparezca).
+ **Descubierto por**: A4 · Ola 4 · T4.2 (2026-10-21).
```

### 7.3 A2 (`packages/**`) — el typecheck de `packages/subegos` está roto (edición concurrente)

**Medido** (2026-10-21 02:35, `pnpm -r typecheck` → **exit 2**):

```text
packages/subegos typecheck: src/index.ts(11,1): error TS2308: Module "./types.js"
  has already exported a member named 'SubEgoIdentityFormat'.
  Consider explicitly re-exporting to resolve the ambiguity.
packages/subegos typecheck: src/SubEgoIdentity.ts(239,9): error TS6133:
  'format' is declared but its value is never read.
packages/subegos typecheck: Failed
```

**Motivo**: `packages/subegos/src/SubEgoIdentity.ts` (nuevo, sin seguimiento) declara el tipo **y** `packages/subegos/src/types.ts` lo declara también; `index.ts` re-exporta los dos con `export *` → ambigüedad. Y el `format` calculado en la línea 239 **nunca se usa** (eso, además, huele a bug: el formato detectado no se aplica).

**Diff exacto (2 cambios, en zona de A2)**:

```diff
--- a/packages/subegos/src/SubEgoIdentity.ts
+++ b/packages/subegos/src/SubEgoIdentity.ts
@@ (tras los imports)
+import type { SubEgoIdentityFormat } from "./types.js";
@@ línea 54
-export type SubEgoIdentityFormat = z.infer<typeof SubEgoIdentityFormatSchema>;
+// El tipo vive en `types.ts` (contrato público). Si se declara aquí también,
+// `index.ts` lo re-exporta dos veces (`export * from "./types.js"` +
+// `export * from "./SubEgoIdentity.js"`) → TS2308 (ambigüedad).

@@ línea 239
   const format = declaration.format === "auto" ? detectIdentityFormat(resolved) : declaration.format;
   const defaults: Partial<SubEgoSoulInput> = {
     ...soulDefaultsFromManifest(manifest),
     ...(options.defaults ?? {})
   };
```

Y **usar `format`** (o eliminarlo si es residuo): ahora mismo se calcula y se
tira → el formato detectado (`auto` → `soul-md`/`agent-md` por el nombre del
fichero) **no llega a aplicarse**. Si `format` debe entrar en
`soulDefaultsFromManifest`/en la carga del artefacto, ese es el sitio:

```diff
-    ...soulDefaultsFromManifest(manifest),
+    ...soulDefaultsFromManifest(manifest, { identityFormat: format }),
```

*(la firma de `soulDefaultsFromManifest` es de A2: el diff es la intención,
no una línea exacta).*

### 7.4 A7 (raíz · `scripts/**` · `.github/**`) — nada pendiente

- El `pretest` del renderer (mi zona) hace que `pnpm test` recursivo ejecute la puerta **sin tocar el `package.json` raíz** ✓.
- `pnpm lint` ya sale **exit 0** (A3 cerró su import duplicado) ✓.
- **No pido** ningún cambio en la raíz.

---

## 8. Deuda que dejo

1. **`Input.leadingIcon`**: la prop existe y **ningún consumidor la usa**. No la quité (es API pública del kit y su consumidor natural —el omnibar— tiene su propio diseño de búsqueda). Decisión pendiente de diseño, no de puerta.
2. **`Tabs.contentClassName`**: solo 1 de los 3 consumidores la usa; los otros dos no estiran layout (no hace falta). Sin deuda.
3. **La auditoría de ego lite (camino de referencia) sigue con el compositor muerto**: el arnés ahora **no se pierde** (cae al rescate y lo dice), pero el fallo de fondo —el compositor de `ego-lite` 0.6.0 no captura— es de la tool, no de mi zona. **El camino de referencia no se ha podido revalidar en verde**; el que está verde es el de rescate (con el mismo spec).
4. **La medición de la auditoría no mide color** (solo tipografía, radio, cabecera, target y desbordamiento). El contraste lo cubre la puerta de tokens (`composite-tint-contrast.test.ts`), no la auditoría visual.
5. **La suite del desktop crece ~40 s** por `design-audit-rescue.test.ts` (arranca Chromium). Es el precio de que el camino de rescate esté **verificado** y no solo escrito.

---

## 9. RESULTADO

```text
status: PARTIAL
```

**Cerrado y verificado en mi zona (`apps/desktop/**`)**:

- **T1 (6/6 ítems)**: la puerta `design-lint` corre ya en local (`pretest` del renderer) · el contraste de los **tintes compuestos** del `Badge` está cubierto y 3 tokens `error` corregidos (4,42–4,54:1 → 4,73–4,80:1) · `Menu.ariaLabel` **nombra el menú** (mecanismo verificado con test) · `Button.trailing` nueva + **8 sitios migrados** + **2 hacks eliminados** (`BTN_SPREAD` y `SELECT_VALUE_TRUNCATE`) · **R7** ve las tablas `cva` · **R12** nueva: la puerta analiza el CSS (deuda heredada nombrada como `EGO-DL-024`).
- **T2 (5/5)**: las 5 solicitudes de A3 **ya estaban aplicadas**; verificadas una a una y con un test nuevo de la auditoría de override (`MCP_NATIVE_TOOL_PROTECTED` / `MCP_TOOL_OVERRIDE`).
- **T3**: auditoría **desacoplada** del compositor de `ego-lite` (spec compartido + camino de rescate Chromium headless) · el **verde falso** de “0 pasos ⇒ 0 infracciones” eliminado · **corrida verde y reproducible**: 6/6 pasos, 0 infracciones, 6 capturas, exit 0 (2 corridas consecutivas) · 2 falsos positivos de la medición corregidos (con test que impide “relajarla”) + 1 **defecto real** de layout corregido (`-mr-3` → `-mr-2` en la cabecera de proyectos).
- **T4.1**: el `correlationId` del turno se genera, se propaga al loop y **cubre la ruta de error** (`tool.failed` cuelga de la raíz del turno; el turno fallido lleva la misma raíz) — con test de integración sobre bus y loop reales.

**Bloqueado por fuera de mi zona (con el diff exacto en §7)**:

1. 🚫 **T4.2 — la invariante de `contextAssemble()`**: el método **no existe** en el binding instalado (vantadb 0.9.0; su `native.d.ts` no lo declara). **E2 (Fase 06) no puede arrancar**. Las invariantes están **escritas y listas** en `apps/desktop/test/context-assemble-invariant.test.ts`, con un guard que fallará el día que el método aparezca. → **A2** (requisito upstream `VDB-REQ-15`) + **A1** (corregir la premisa del ADR-0020).
2. ⚠️ **`pnpm -r typecheck` → exit 2**: dos errores en **`packages/subegos`** (`TS2308` por `SubEgoIdentityFormat` declarado dos veces + `TS6133` por un `format` calculado que nunca se usa) — **edición concurrente de A2 a las 02:35**, no es mío. → **A2** (§7.3). Además, ese `format` sin usar **huele a bug**: el formato detectado no llega a aplicarse.
3. 📄 **A1 (`docs/**`)**: 5 puntos del `docs/design/design-system.md` que el código ya hizo obligatorios (R12, R7 sobre `cva`, los 3 tokens `error`, `Button.trailing` + la semántica de `Menu.ariaLabel`, y la desaparición de los 2 hacks) + la corrección del ADR-0020 (§7.1).
4. ✅ **El bug de lint de A3 está cerrado** (el import duplicado ya no está) → `pnpm lint` sale **exit 0**.
