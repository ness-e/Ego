# Handoff A1 (Ola 5) — 2026-07-21 — La contradicción del repo, resuelta + ADRs y filas pendientes

> **Agente:** A1 (documentación canónica, ADRs, Backlog, informes)
> **Ola:** 5 — T1 (contradicción de `contextAssemble`) · T2 (ADR-0024 de E5/E13) ·
> T3 (filas que A3 y A4 dejaron) · T4 (coherencia de los docs canónicos).
> **Plan:** `docs/agent-ops/plans/2026-10-19-remediation-wave1/A1-docs.md` (continuación)
> **Zona:** `docs/**` salvo `docs/{review,extractions}/**` (A5),
> `docs/research/{verificacion-anthropic-tool-order,arquitectura-master-matrix}.md` (A8).
> **Sin commits. Sin `git checkout/reset/stash/clean`. Sin `pnpm install`.**
> **No he tocado `packages/**`, `apps/**`, raíz ni `scripts/**`.**

---

## 1. T1 — La contradicción del repo, resuelta con la evidencia de las DOS partes

### 1.1 Qué se contradecía

| Parte | Afirmación |
|---|---|
| `docs/adr/0020-compactacion-motor-ts-vs-nativo.md` (§Contexto 2) | El binding expone `contextAssemble(options)`; el nativo es una función pura, sin estado, y funciona incluso con la BD cerrándose |
| `handoff/A4-ola4.md` §5.2 y §7.1 (Ola 4) | *«el método no existe»* · *«el ADR-0020 presupone un método que no existe»* · *«E2 no puede arrancar»* |

Un repo que se contradice sobre el motor de contexto no puede decidir nada. Esta ola lo
resuelve.

### 1.2 Lo que verifiqué (3 capas, medidas sobre el árbol instalado)

| Capa | ¿Expone `contextAssemble`? | Evidencia |
|---|---|---|
| **`vantadb-node@0.9.0`** (binding napi-rs) | **SÍ** — y las 4 APIs cognitivas más | `index.d.ts:622 contextAssemble(options)` · `:614 memoryRecall(options)` · `:629 memoryConsolidate(options)` · `:636 memoryReinforce(hit, outcome)` |
| **`vantadb@0.9.0`** (wrapper TS, `vantadb/native`) | **NO** — su fachada declara una **lista fija** de métodos, **sin `Proxy` ni passthrough dinámico** | `vantadb@0.9.0/dist/native.d.ts:103` (`class NativeVantaDB implements NativeClientBinding`) · `dist/native.js:157` → `return new NativeVantaDB(inner)` |
| **`vantadb@0.6.1`** (global, fuera del repo) | **NO** — y **sin `vantadb-node`** | `C:\Users\Eros\node_modules\vantadb` (importarlo daría `VANTADB_NOT_FOUND: Node not found: 7`) |

**Y la resolución depende del directorio** (medido):

| Paquete | `node_modules` | ¿Enlaza `vantadb`? | Resuelve a |
|---|---|---|---|
| `packages/memory` | 11 entradas | **sí** | `node_modules/.pnpm/vantadb@0.9.0` ✅ |
| `apps/desktop` | 305 entradas | **NO** | global `vantadb@0.6.1` ❌ |
| `tests` | 7 entradas | **NO** | global `vantadb@0.6.1` ❌ |

**El dato que cambia el diagnóstico:** los **manifiestos ya están corregidos** —
`packages/memory/package.json`, `apps/desktop/package.json:38` y `tests/package.json:20`
declaran `"vantadb": "0.9.0"` (A7). Lo que **no** está materializado es el **enlace**: la
**instalación del árbol está incompleta** (`node_modules/.bin` **no existe** en la raíz,
`node_modules/.modules.yaml` y `node_modules/.pnpm/lock.yaml` **no existen**, y el paquete
`vitepress` ha **desaparecido** del store).

### 1.3 El veredicto corregido

- **La premisa del ADR-0020 era correcta** (el binding expone `contextAssemble`) y **la
  invariante está garantizada**: *system preservado = true* y *pares
  `tool_call`/`tool_result` preservados = true* ⇒ **puerta VERDE**.
- **A4 acertó en lo que midió**: `typeof handle.contextAssemble === "undefined"` **es cierto**
  para la ruta del producto (la fachada no lo expone). **Se equivocó en la conclusión**: el
  fallo era de **alcance**, no de motor.
- **E2 no arranca por alcance, no por calidad del motor.**
- La parte que **no depende de Ego** (que el wrapper re-exponga los métodos) queda como
  petición upstream: **`VDB-REQ-16`**.

### 1.4 Dónde está corregido

| Fichero | Qué se corrigió |
|---|---|
| `docs/adr/0020-compactacion-motor-ts-vs-nativo.md` | §2.1 nuevo (las 3 capas + la resolución por directorio) · §Decisión 3 (puerta **verde** + **segunda condición**: el puente de alcance) · §Deuda · §Referencias (y las referencias `main.ts:1731…` **obsoletas** → `create-window.ts:196/226` + `handle-llm-stream.ts:397/247`) |
| `docs/agent-ops/plans/.../handoff/A4-ola4.md` | **Corrección fechada** al principio de §5.2 (sin reescribir su análisis) · §7.1: la solicitud a A1 queda **cerrada** · §7.2: la solicitud a A2 queda **con la premisa corregida** (A2 **no** debe escribir esa petición upstream) |
| `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` | `VDB-REQ-16` **nueva** (índice + detalle + síntesis) · `VDB-REQ-13` con el **matiz de alcance** (la verificación se hizo contra el binding directo, no contra la ruta del producto) |
| `docs/roadmap/Backlog.md` | `EGO-FIND-29` → 🟡 con el estado real · `EGO-FIND-80` → ✅ (A8 verificó en la fuente primaria) · `EGO-FIND-43` → ✅ con la evidencia de que **la API no prescribe orden** · `EGO-FIND-94` **nueva** |
| `docs/agent-ops/plans/.../VERDICT.md` | §7.2 nuevo: *«la contradicción del repo, resuelta»* con la tabla de las 3 capas |

---

## 2. T2 — ADR-0024 (E5 + E13)

`docs/adr/0024-identidad-declarativa-y-presupuestos.md` (nuevo), con el texto de A3
(`handoff/A3-ola4b.md` §2.6) y la plantilla canónica: contexto · alternativas descartadas ·
decisión (4 puntos: artefacto declarativo, circuit breaker de 3 dimensiones, política de
modelos no duplicada, **escalera de metatools**) · consecuencias · referencias.

**Referencia a los 3 metatools de E13** (`lookup_skills`, `search_tools`, `expand_tools`) con
la regla de gobernanza: *un metatool ve **sólo lo que su registro ve*** — la divulgación
progresiva sirve para **descubrir**, no para **escalar privilegios**.

### 2.1 Numeración de ADRs — coordinación

| Número | Contenido | Dueño |
|---|---|---|
| `0022` | Exportadores de artefactos y REPL (E4) | **A1** (Ola 4) |
| `0023` | Path cognitivo nativo | **A2** — *libre y reservado* |
| `0024` | Identidad declarativa + presupuestos + metatools (E5/E13) | **A1** (este turno, número propuesto por A3) |

> ⚠️ **Colisión resuelta, pero que hay que saber:** el contrato de la Ola 3
> (`OLA3-CONTRATO.md`) reservaba `docs/adr/0022-*` para **A2**. Yo tomé el `0022` en la
> Ola 4 para E4, de modo que **A2 debe usar el `0023`**. Lo he escrito en
> `docs/adr/README.md` para que el índice no contradiga al árbol.

---

## 3. T3 — Las 8 filas que A3 y A4 dejaron sin registrar

| Id | Qué | Estado |
|---|---|---|
| `EGO-FIND-88` | E5 — la identidad de los Sub-Egos vivía en código (`SubEgoSoul.ts`) | 🟡 Parcial |
| `EGO-FIND-89` | E5 — sin límite de tiempo ni degradación en el presupuesto | 🟡 Parcial |
| `EGO-FIND-90` | E13 — 0 metatools: las skills no eran consultables | 🟡 Parcial |
| `EGO-FIND-91` | La puerta `design-lint` no veía las tablas `cva` ni el CSS (R7 + **R12** nueva) | ✅ Completada |
| `EGO-FIND-92` | El contraste no medía los **tintes compuestos** del `Badge` | ✅ Completada |
| `EGO-FIND-93` | La auditoría visual estaba atada a un compositor que no captura (**verde falso**) | ✅ Completada |
| `EGO-FIND-94` | `vantadb` se resuelve fuera del repo y el wrapper no expone las APIs cognitivas (`VDB-REQ-16`) | 🆕 Pendiente (A7) |
| `EGO-FIND-95` | **`register-ipc.ts` con 2 570 líneas: el nuevo god file** tras descomponer `main.ts` | 🆕 Pendiente (A4) |

**Por qué E5/E13 quedan 🟡 y no ✅:** la matriz de capacidades de `AGENTS.md` §4 exige
**Implementado + Integrado + Verificado**, y esas dos capacidades están
**SPECIFIED + IMPLEMENTED + VERIFIED en `packages/**`** pero **aún no son alcanzables desde
la app**: A4 tiene **3 diffs de producción pendientes** (`handoff/A4-ola4b.md` §5.3) y A2 debe
exponer los dos métodos del router. **Implementado ≠ integrado**, y decirlo así es lo que
impide que la siguiente ola dé por cerrado algo que el usuario aún no puede usar.

**`EGO-FIND-95` — la deuda que se mudó de fichero (medida):**

| Fichero | Líneas |
|---|---|
| `apps/desktop/src/main/ipc/register-ipc.ts` | **2 570** |
| `apps/desktop/src/main/window/create-window.ts` | 1 094 |
| `apps/desktop/src/ipc/schema.ts` | 1 006 |
| `apps/desktop/src/main.ts` | **865** |

`main.ts` **bajó** de 5 401 a 865 (E6/E6-res, ✅) y el problema **se mudó**: el registro de
handlers IPC triplica al siguiente fichero. Un god file no es un fichero largo, es un fichero
largo **del que dependen todos los demás**. La fila dice lo que queda abierto: **no hay
objetivo de líneas definido para él** (el de `main.ts` era < 1 100 y ya se cumple) ⇒ hay que
**decidir el criterio** antes de tocarlo (¿dividir por dominio, por canal IPC o por proceso?).

---

## 4. T4 — Coherencia de los docs canónicos

- **`docs/dev/e2e-skip-inventory.md` §1.0 — re-verificado por mí** (no copiado): **16 ficheros ·
  11 `describe.skip` · 5 sin skip · 0 `it.skip` · 0 `.only`**, `git status --short -- tests/gui`
  **vacío**, y el último handoff de A2 sigue siendo `A2-ola2-vitest3.md` (no hay
  `A2-ola3/4/5.md`). **El estado no ha cambiado** desde la medición de la Ola 4, y la
  "reactivación de 12 specs" **sigue sin aterrizar**.
- **`VERDICT.md` §7** — reescrito: §7.0 Ola 3 (con E2-bis/T-X3 **cerrada por A8**), §7.1 Ola 4/4b
  (E5/E13 **implementadas, no integradas** · design system 6/6 · auditoría desacoplada ·
  `correlationId` en la ruta de error · la resolución en curso · E2 bloqueada por alcance),
  §7.2 **la contradicción resuelta**, §7.3 las 8 filas nuevas, §7.4 el plan vigente.
- **`docs/adr/README.md`** — 24 ADRs + la nota de numeración (0022/0023/0024).
- **`docs/research/README.md`** — **no tocado** (A8).

---

## 5. Solicitudes fuera de zona (NO aplicadas) — con diff exacto

### 5.1 A7 (raíz · `scripts/**` · `.github/**`) — materializar el enlace de `vantadb` + el árbol roto

**Los manifiestos ya están correctos** (los hizo A7): `apps/desktop/package.json:38` y
`tests/package.json:20` declaran `"vantadb": "0.9.0"`. Lo que falta es que la instalación
**materialice** el enlace.

```bash
# diagnóstico (lo he medido yo):
#   packages/memory/node_modules/vantadb   -> EXISTE   (11 entradas)
#   apps/desktop/node_modules/vantadb      -> NO EXISTE (305 entradas)
#   tests/node_modules/vantadb             -> NO EXISTE (7 entradas)
pnpm install
```

**Verificación que pido** (no una afirmación):

```bash
# 1. los tres enlaces existen
ls packages/memory/node_modules/vantadb apps/desktop/node_modules/vantadb tests/node_modules/vantadb
# 2. y los tres resuelven a la MISMA versión
node -e "for (const p of ['packages/memory','apps/desktop','tests']) { const r = require('node:fs').realpathSync(p + '/node_modules/vantadb'); console.log(p, '->', r) }"
```

> **También hay un blocker de entorno que afecta a `pnpm docs:build`:** el paquete
> **`vitepress` ha desaparecido del store** (sólo queda su árbol de dependencias) y
> **`node_modules/.bin` no existe en la raíz** ⇒ `pnpm docs:build` falla con
> *«"vitepress" no se reconoce como un comando interno o externo»*. El build **estaba
> verde** al final de la Ola 4 (`build complete in 122.36s`). Es el mismo install
> incompleto, no un problema de contenido.

### 5.2 A2 (`packages/**`) — tres cosas

**(a) NO escribir la petición upstream de las invariantes.** Ya está cerrada:
`VDB-REQ-13` RESUELTO. La petición correcta es `VDB-REQ-16` y su texto ya está en el
registro. La solicitud que A4 te deja en su handoff §7.2 **tiene la premisa corregida**
(le he puesto la corrección fechada encima).

**(b) Exponer los dos métodos del router** (para que E5 sea integrable) — diff de A3:

```diff
  // packages/models/src/ModelRouter.ts (o el fichero que corresponda)
+ /**
+  * Tope de coste por llamada **global** del router, para que el circuit breaker
+  * de presupuesto de Sub-Ego pueda calcular el mínimo efectivo.
+  */
+ getMaxCostPerCallUsd(): number | undefined;
+
+ /**
+  * Modelo más barato disponible que satisfaga el tope indicado.
+  * Devuelve `undefined` si no hay ninguno: el circuito **detiene** (fail-closed),
+  * nunca degrada a un `mock`.
+  */
+ resolveCheaperModel(maxCostPerCallUsd: number): string | undefined;
```

**(c) Usar el `0023` para el ADR del path cognitivo** (el `0022` lo ocupa E4; ver §2.1).

### 5.3 A4 (`apps/desktop/**`) — tres cosas

**(a) El mensaje del guard de `contextAssemble` dice ahora la mitad de la verdad.** El test
afirma que *el binding* no expone el método, pero la comprobación es sobre **el handle**
(la fachada). Con lo verificado, lo correcto es hablar de la **fachada**:

```diff
  // apps/desktop/test/context-assemble-invariant.test.ts
  expect(
    typeof handle.contextAssemble,
-   "el binding YA expone contextAssemble: activa las invariantes de este fichero y corrige el ADR-0020 (A1)"
+   "la fachada de vantadb YA expone contextAssemble (VDB-REQ-16): activa las invariantes de este fichero"
  ).toBe("undefined");
```

> El guard **sigue siendo válido y útil**: el día que la fachada exponga el método, falla
> el día que hay que activar las invariantes. Lo que cambia es su mensaje.

**(b) Los 3 diffs de producción de E5/E13** (handoff `A4-ola4b.md` §5.3): sin ellos,
`EGO-FIND-88/89/90` no salen de 🟡.

**(c) `register-ipc.ts` (2 570 líneas): falta el criterio antes de tocarlo.** La fila
`EGO-FIND-95` lo dice; la decisión (dividir por dominio, por canal IPC o por proceso) es
de A4 o del owner.

### 5.4 A3 (`packages/**`) — nada pendiente de mi parte

Su ADR está redactado (`0024`) y sus 3 filas de Backlog abiertas. Lo que le devuelve la Ola 5
es la confirmación de que **no están cerradas** (implementadas ≠ integradas).

### 5.5 Owner — `EGO-FIND-81` (canal del token MCP)

Sin la decisión del canal (env `EGO_MCP_TOKEN` vs. fichero `0600` vs. ambos) no se puede
escribir la guía de `docs/user/`.

---

## 6. Verificación

| Comando | Exit | Resumen |
|---|---|---|
| `node scripts/verify-vantadb-ids.mjs` | **0** | **0 errores** · 4 avisos (W2 ×4, peticiones upstream) · **26 IDs** |
| `node docs/testing/check-docs-paths.mjs` | **0** | 383 docs · **0 enlaces rotos** · **0 rutas inexistentes** en docs canónicos |
| `node scripts/check-docs-lint.mjs` | **0** | **0 regresiones** · 7 097 violaciones en 337 ficheros (base 7 123 → **−26**) |
| `pnpm docs:build` | **1** | ⛔ **BLOQUEADO por el entorno**, no por el contenido — ver §5.1. El build **estaba verde** al final de la Ola 4 (122,36 s) y el paquete `vitepress` ha desaparecido del store. Los controles equivalentes de contenido **pasan**: enlaces rotos 0, lint 0 regresiones, y **ningún `{{` nuevo** en mis ficheros (la regla `EGO-VUE-INTERPOLATION` sigue activa en la config). |
| Round-trip Ego→studio→Ego | — | **15/15 identidad, 0 LOSSY** (A6, Ola 3) |
| Estado del Backlog | — | **81 ✅ · 6 🟡 · 8 🆕** (95 filas `EGO-FIND`) |
| Resolución de `vantadb` | — | **3 capas medidas** · el binding tiene las 4 APIs · la fachada no · fuera de `packages/memory` se resuelve el global `0.6.1` |

---

## 7. Deuda / no resuelto

1. **`pnpm docs:build` no se puede ejecutar** por el install incompleto (§5.1). Bloqueo: **A7**
   (raíz). Es el **único** check de la ola que no he podido dejar en verde, y la causa es
   ajena a mi zona.
2. **La fachada de `vantadb@0.9.0` no re-expone los métodos cognitivos** ⇒ E2 sigue
   bloqueado. Bloqueo: **upstream VantaDB** (`VDB-REQ-16`, parte a). La parte (b) ya la
   hizo A7; falta **materializar** el enlace.
3. **E5/E13 no son alcanzables desde la app** (3 diffs de A4 + 2 métodos de A2) ⇒
   `EGO-FIND-88/89/90` quedan 🟡. Bloqueo: **A2 + A4**.
4. **El criterio de división de `register-ipc.ts`** (2 570 líneas) está sin decidir.
   Bloqueo: **A4 / owner**.
5. **La auditoría visual no mide color** (solo tipografía, radio, cabecera, target y
   desbordamiento) y **el camino de referencia** (ego lite) sigue con el compositor muerto
   ⇒ no se ha podido revalidar en verde. Bloqueo: la tool `ego-lite`, fuera del repo.
6. **La lista blanca de `design-lint` sigue indexada por ID posicional** (`EGO-DL-0NN`): se
   autodesactiva bajo refactor. Bloqueo: **A4/A7**.
7. **Los 11 `describe.skip`** de la suite GUI siguen sin reactivarse. Bloqueo: **A2**
   (sin handoff desde la Ola 2).
8. **El canal del token MCP (`EGO-FIND-81`)** sigue bloqueado por el **owner**.

---

## 8. Nota de estado del árbol

Working tree sucio y compartido con A2–A8 — **esperado por contrato** (README §5.5).
**No he hecho ningún commit, ni `git checkout/reset/stash/clean`, ni `pnpm install`.**
No he tocado `packages/**`, `apps/**`, raíz ni `scripts/**`.

> **Ficheros de otros agentes que `git status` puede mostrar y no son míos:**
> `docs/research/**` (A5 y A8), `packages/tools/**` · `packages/subegos/**` (A3),
> `apps/desktop/**` (A4), `packages/avatar/**` (A6), raíz y `scripts/**` (A7),
> `packages/{memory,knowledge,runtime,...}/**` (A2).
>
> ⚠️ **El árbol de `node_modules` está incompleto** (§5.1): eso no es un cambio de
> fuentes, pero afecta a cualquier agente que intente ejecutar los tests.
