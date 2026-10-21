# Handoff A5-ola8 — Procedencia del catálogo de extracción (EGO-FIND-82) — 2026-10-21

> **Resumen en una línea:** la atribución falsa que introduje en la Ola 8 está **deshecha**; las
> 25 fichas registran ahora la **procedencia** del upstream (upstream · licencia · commit · ruta)
> dentro de su tabla de metadatos sin partir ninguna tabla; **0** filas de catálogo afirman
> derivación de código; y la puerta `verify-extraction-provenance.mjs` está **en verde (exit 0)**
> con test propio de 8 casos (rojo→verde, output pegado en §4).

**Zona tocada:** `docs/extractions/**` · `docs/review/**` (sólo lectura) · el handoff que ahora
lees. **Nada más.** Sin commits (73 commits sin publicar siguen como estaban), sin
`git checkout/reset/stash/clean`, sin `pnpm install`.

---

## Índice

1. [Cambios aplicados (ficheros propios)](#1-cambios-aplicados-ficheros-propios) — 1.1 la atribución
   falsa deshecha · 1.2 recuento final por repo · 1.3 la puerta · 1.4 el test · 1.5 README §4.3/§4.4 ·
   1.6 la lista de derivados · 1.7 ficheros modificados
2. [Solicitudes fuera de zona (NO aplicadas)](#2-solicitudes-fuera-de-zona-no-aplicadas) — 2.1 A1
   (texto exacto de `EGO-FIND-82`) · 2.2 A6 · 2.3 A2bis · 2.4 A7 · 2.5 A8
3. [Verificación](#3-verificación)
4. [Test rojo → verde (TDD)](#4-test-rojo--verde-tdd)
5. [Deuda / no resuelto](#5-deuda--no-resuelto)

---

## 1. Cambios aplicados (ficheros propios)

### 1.1 T1 — La atribución falsa, deshecha

**Qué estaba mal (mi error de la Ola 8):** escribí `| Atribución | Adapted from <upstream>
(<LIC>), <ruta> |` en las 25 fichas y antepuse `Adapted from … —` seguido de un espacio a la celda de descripción de
las filas `✅ Completada` de 5 backlogs (`coucou`, `helmor`, `hermes`, `mcp-servers`,
`openclaw`). Eso afirmaba una **derivación de código que no existe**: la ficha es un
**documento de análisis escrito por Ego** y `COUC-03` («Correlación Exacta de Acción
Autorizada») es el `ApprovalEngine` **propio** de Ego, no código derivado de `IslandTypes.swift`.
Además rompía 25/25 tablas (la fila insertada iba seguida de una línea en blanco) y en
`coucou.md` quedaba **sola en medio de la prosa**, sin cabecera ni separador.

**Qué he hecho (todo por script, no a mano):**

| # | Acción | Resultado |
|---|---|---|
| 1 | `normalize-attribution.mjs` reescrito con el **modelo de 2 planos** y arranca en modo *reparación* (además de normalizar, deshace lo que la Ola 8 había roto) | 39 prefijos `Adapted from … —` seguido de un espacio eliminados de las celdas |
| 2 | La fila `\| Atribución \| … \|` legacy se **elimina** junto con su línea en blanco (para que la tabla no quede partida) | 25/25 fichas |
| 3 | Se escriben **dentro** de la tabla de metadatos existente las filas `Licencia del origen`, `Commit verificado` y `Ruta de origen` | 25/25 fichas |
| 4 | La fila `Repositorio Origen` se normaliza a la forma canónica: `` `repos-referencia/<slug>/` (upstream `<owner/repo>`, commit `<sha>`, origen `<fichero>`) `` | 25/25 fichas |
| 5 | `coucou.md` (que **no tenía** tabla de metadatos) recibe una tabla mínima bien formada: cabecera + separador `\|---\|---\|` + las 3 filas | 1 ficha |
| 6 | Reparación de los `\|\|` **sin escapar** dentro de una celda (rompen la tabla en GitHub): `openclaw.md` | 1 ficha |
| 7 | Higiene MD022/MD058/MD012: una línea en blanco antes de la tabla y exactamente una después | `coucou.md` |

**Estado final de los 5 backlogs:** los prefijos falsos se eliminaron y las celdas quedaron
**byte-idénticas a `HEAD`** — `git status` ya **no** lista `docs/review/**` (la atribución falsa
está deshecha, no "arreglada"). **0** filas de catálogo en las 25 fichas y en los 25 backlogs
afirman hoy derivación de código.

### 1.2 Recuento final por repo (25/25 fichas con procedencia verificada)

Todo sale del **clon real** (`git config --get remote.origin.url`, el `LICENSE` del clon y
`git rev-parse --short=7 HEAD`), nunca de memoria:

| # | Ficha | Upstream | Licencia | Clon | Commit verificado | Ruta de origen |
|--:|---|---|---|---|---|---|
| 1 | `ag-ui.md` | `ag-ui-protocol/ag-ui` | MIT | `repos-referencia/ag-ui/` | `3decbe8` | `sdks/typescript/packages/core/src/generated/types.ts` |
| 2 | `career-ops.md` | `career-ops-hq/career-ops` | MIT | `repos-referencia/career-ops/` | `24745c5` | `DATA_CONTRACT.md` |
| 3 | `claude-squad.md` | `smtg-ai/claude-squad` | **AGPL-3.0** | `repos-referencia/claude-squad/` | `ce1ffb4` | `session/instance.go` |
| 4 | `cline.md` | `cline/cline` | Apache-2.0 | `repos-referencia/cline/` | `ca7402c` | `sdk/packages/core/src/hooks/checkpoint-hooks.ts` |
| 5 | `codex.md` | `openai/codex` | Apache-2.0 | `repos-referencia/codex/` | `0144894` | `codex-rs/sandboxing/src/policy_transforms.rs` |
| 6 | `continue.md` | `continuedev/continue` | Apache-2.0 | `repos-referencia/continue/` | `5522c6f` | `packages/config-yaml/src/schemas/models.ts` |
| 7 | `coucou.md` | `Louis-CFM/coucou` | MIT | `repos-referencia/coucou/` | `595092b` | `NotchBuddy/Sources/App/HookServer.swift` |
| 8 | `crush.md` | `charmbracelet/crush` | MIT | `repos-referencia/crush/` | `8fa35a0` | `internal/agent/tools/diagnostics.go` |
| 9 | `deepseek-harness.md` | `deepseek-ai/deepseek-harness` | MIT | `repos-referencia/deepseek-harness/` | `5badb15` | `packages/session/session-persistence-jsonl/package.json` |
| 10 | `gemini-cli.md` | `google-gemini/gemini-cli` | Apache-2.0 | `repos-referencia/gemini-cli/` | `76e4d7c` | `packages/core/src/policy/config.test.ts` |
| 11 | `goose.md` | `aaif-goose/goose` | Apache-2.0 | `repos-referencia/goose/` | `9920efa` | `crates/goose/src/tool_inspection.rs` |
| 12 | `graphiti.md` | `getzep/graphiti` | Apache-2.0 | `repos-referencia/graphiti/` | `6e3e3cb` | `graphiti_core/edges.py` |
| 13 | `graphrag.md` | `microsoft/graphrag` | MIT | `repos-referencia/graphrag/` | `5faaaf4` | `packages/graphrag/graphrag/index/workflows/factory.py` |
| 14 | `helmor.md` | `dohooo/helmor` | Apache-2.0 | `repos-referencia/helmor/` | `a76cda1` | `src/components/terminal-output-scheduler.ts` |
| 15 | `hermes-agent.md` | `nousresearch/hermes-agent` | MIT | `repos-referencia/hermes-agent/` | `4787e4d` | `apps/desktop/src/components/assistant-ui/ansi-text.tsx` |
| 16 | `khoj.md` | `khoj-ai/khoj` | **AGPL-3.0** | `repos-referencia/khoj/` | `ae229ca` | `src/khoj/processor/content/__init__.py` |
| 17 | `mcp-servers.md` | `modelcontextprotocol/servers` | Apache-2.0 | `repos-referencia/mcp-servers/` | `51b6382` | `src/everything/server/index.ts` |
| 18 | `mem0.md` | `mem0ai/mem0` | Apache-2.0 | `repos-referencia/mem0/` | `0724291` | `mem0/memory/main.py` |
| 19 | `mini-swe-agent.md` | `SWE-agent/mini-swe-agent` | MIT | `repos-referencia/mini-swe-agent/` | `04d809c` | `src/minisweagent/agents/default.py` |
| 20 | `openclaw.md` | `openclaw/openclaw` | MIT | `repos-referencia/openclaw/` | `0c7a83d` | `src/agents/admitted-run-context.ts` |
| 21 | `opencode.md` | `sst/opencode` | MIT | `repos-referencia/opencode/` | `db45c95` | `packages/core/src/permission/sql.ts` |
| 22 | `openhands.md` | `OpenHands/OpenHands` | MIT | `repos-referencia/openhands/` | `8d39305` | `src/types/agent-server/session-frames.ts` |
| 23 | `qwen-code.md` | `QwenLM/qwen-code` | Apache-2.0 | `repos-referencia/qwen-code/` | `6ec1b83` | `packages/core/src/subagents/agent-frontmatter-schema.test.ts` |
| 24 | `swe-agent.md` | `SWE-agent/SWE-agent` | MIT | `repos-referencia/swe-agent/` | `3ea751c` | `sweagent/tools/__init__.py` |
| 25 | `vibe-kanban.md` | `BloopAI/vibe-kanban` | Apache-2.0 | `repos-referencia/vibe-kanban/` | `d5cbb53` | `crates/worktree-manager/src/worktree_manager.rs` |

**Las 25 fichas quedaron con las 3 filas de procedencia dentro de la tabla de metadatos
existente** (las 18 fichas nuevas, de tabla horizontal de 7 columnas, pasaron a 10 columnas;
las 7 heredadas, de tabla vertical `| Campo | Valor |`,3 filas más). Ninguna
tabla se ha partido: `check-docs-lint` no reporta ni una sola violación nueva.

### 1.3 T2 — La puerta `verify-extraction-provenance.mjs` (en verde)

**Antes:** fallaba con 13 discrepancias (11 `commit-ausente` + 1 `upstream-inexistente` para
`modelcontextprotocol/servers`, cuyo slug de clon es `mcp-servers`). **Ahora: exit 0, 25/25 OK.**

Cambios sustantivos respecto a la versión que escribí antes:

| # | Antes | Ahora |
|--:|---|---|
| 1 | exigía la forma `Adapted from …` en la ficha | exige la **fila de procedencia**: `Licencia del origen` (upstream + licencia), `Commit verificado`, `Ruta de origen` + `Repositorio Origen` normalizado |
| 2 | derivaba el clon del **nombre** del upstream | mapea **upstream → clon** por el **remote de cada clon** (`modelcontextprotocol/servers` → `mcp-servers`) |
| 3 | leía el commit de una etiqueta fija | lee la fila `Commit verificado` (vertical **y** horizontal) y la compara con el HEAD real |
| 4 | — | **nuevo**: comprueba que la `Ruta de origen` **existe dentro** del clon |
| 5 | — | **nuevo**: una fila de catálogo **no** puede afirmar derivación de código salvo que el fichero de Ego citado **lleve** la cabecera canónica (`derivacion-sin-cabecera`) |
| 6 | — | **nuevo**: **ninguna** fila puede afirmar derivación de `khoj` (AGPL-3.0) — decisión del owner en `EGO-FIND-83` (`credito-retirado`) |
| 7 | contar 2 veces una fila presente en ficha **y** backlog | deduplica por `id + upstream + ficheros` (la misma fila en ficha y backlog es **una** afirmación) |
| 8 | aceptaba 1 forma de cabecera canónica | acepta las **dos** que conviven en el repo: `Adapted from <up> (<LIC>), <ruta>` **y** `ADAPTADO de <ruta> (<LIC>, <copyright>) — ver LICENSE.md` (la convención por paquete del owner) |
| 9 | — | conserva `--root` (fixtures) y añade `--json` |

### 1.4 T3 — Test de la puerta (TDD real, 8 casos)

`docs/extractions/tools/verify-extraction-provenance.test.mjs` · `node --test` · **8 pass / 0 fail**.
Los clones de fixture son **repos git reales** (remote + commit) para que la puerta los resuelva
igual que los de `repos-referencia/`. Salida pegada en §4.

| # | Caso | Esperado |
|--:|---|---|
| 1 | ficha conforme | 0 discrepancias · exit 0 |
| 2 | upstream sin clon | 1 (`upstream-inexistente`) · exit 1 |
| 3 | licencia que no coincide con el `LICENSE` real | 1 (`licencia-distinta`) · exit 1 |
| 4 | commit desfasado | 1 (`commit-desfasado`) · exit 1 |
| 5 | fila que afirma derivación **sin** cabecera en el código | 1 (`derivacion-sin-cabecera`) · exit 1 |
| 6 | fila que afirma derivación de `khoj` | 1 (`credito-retirado`) · exit 1 |
| 7 | la misma fila **con** cabecera canónica (forma 1) | 0 discrepancias · exit 0 |
| 8 | cabecera canónica forma 2 (`ADAPTADO de … ver LICENSE.md`) | 0 discrepancias · exit 0 |

### 1.5 T4 — `docs/extractions/README.md` §4.3 y §4.4

- **§4.3** reescrito como el **modelo de 2 planos** (código realmente derivado vs. ficha) y con
  el **estado real medido**, que **no** era el «8 de 90» que decía antes:

  | Elemento | Estado real medido (2026-10-21) |
  |---|---|
  | Forma 1 `Adapted from <upstream> (<LIC>), <ruta>` | **14 de 1 144** ficheros de `packages/**` — los 14 en `packages/avatar/` (7 en `src/` + 7 en `dist/`, artefacto de build) |
  | Forma 2 `ADAPTADO de <ruta> (<LIC>, <copyright>) — ver LICENSE.md` | **6 de 1 144** — también sólo en `packages/avatar/` (`src/{core/anim.js,runtime/micro.js,runtime/sound.js}` + sus 3 en `dist/`) |
  | Atribución en **prosa** (forma no canónica) | **42** en 11 paquetes (`tool-call-repair` 9, `ui-runtime` 9, `memory` 6, `avatar` 5, `execution`/`recovery`/`subegos` 3 cada uno, `tools` 2, `events`/`runtime` 1 cada uno) |
  | Paquetes con fichero de licencia en el paquete | **2 de 19** (`avatar/`, `tool-call-repair/`) |
  | `packages/avatar/src/` | **47** `.js` (la ficha decía 49) · **7** con forma 1 (la ficha decía 8: `src/studio/render/geometry.js` ya **no** la lleva, A6 lo sustituyó) |

- **§4.4** pasa de «pendiente de implementación» a **implementada y en verde**, con la tabla de
  las 9 comprobaciones reales (código de fallo incluido), el formato de salida, el generador
  idempotente y los comandos de uso.

### 1.6 T5 — `docs/extractions/coucou.md` §52.4: **intocada**

La lista de ficheros derivados **sin** cabecera canónica sigue siendo la **lista autoritativa**
(no la he editado: meter cabeceras en `packages/avatar/**` es zona de A6). Lo que la lista dice
sigue siendo correcto salvo los **recuentos**, que he actualizado en el README (§1.5) y que
detallo en §2.2.

### 1.7 Ficheros modificados (26 + 3 nuevos)

- **25 fichas**: `docs/extractions/{ag-ui,career-ops,claude-squad,cline,codex,continue,coucou,crush,deepseek-harness,gemini-cli,goose,graphiti,graphrag,helmor,hermes-agent,khoj,mcp-servers,mem0,mini-swe-agent,openclaw,opencode,openhands,qwen-code,swe-agent,vibe-kanban}.md`
- **1 doc**: `docs/extractions/README.md`
- **3 nuevos**: `docs/extractions/tools/{normalize-attribution.mjs,verify-extraction-provenance.mjs,verify-extraction-provenance.test.mjs}`
- **0 modificados** en `docs/review/**` (las atribuciones falsas se deshicieron y las celdas
  volvieron a su texto original, byte a byte).

---

## 2. Solicitudes fuera de zona (NO aplicadas)

### 2.1 Para A1 — `docs/roadmap/Backlog.md` (fila `EGO-FIND-82`, L1207)

**Por qué hay que tocarla:** el texto actual dice *"0 de 313 ficheros de `packages/` llevan la
cabecera canónica"* y *"27 con atribución en prosa"* — esas cifras están **desfasadas** (la base
de medida era de 2026-10-20 y el árbol cambió) y el hallazgo ya está **partido en dos**: la parte
del **catálogo de extracción** está **hecha** (25 fichas + puerta en verde) y la parte del
**código derivado** sigue abierta. La fila actual no refleja ninguna de las dos cosas.

Además, **una afirmación de la fila actual es inexacta**: dice que
`packages/tool-call-repair/LICENSE.md` *"y sus 3 cabeceras **ya están** en formato canónico
(derivación real de OpenClaw, MIT)"*. Medido: ese paquete tiene `LICENSE.md` (sin `NOTICE`) y sus
3 ficheros de `src/` (`balanced-json.ts`, `coercion.ts`, `grammar.ts`) usan la forma
**`Extraído y adaptado de OpenClaw …` en prosa**, que **no** es la forma canónica por paquete
(`ADAPTADO de <ruta> (<LIC>, <copyright>) — ver LICENSE.md`). Es decir: **la atribución es
veraz, pero la forma no es la canónica.**

**Texto exacto para la fila `EGO-FIND-82`** (10 celdas, sustituye a la de L1207):

```text
| `EGO-FIND-82` | 🔴 Crítica | **Cadena de atribución de licencia: el catálogo de extracción ya la tiene (25/25 fichas con procedencia verificada + puerta en verde); queda desplegarla en el CÓDIGO derivado de `packages/**`** | `docs/extractions/README.md` §4.3-§4.4 · `docs/extractions/tools/{normalize-attribution.mjs,verify-extraction-provenance.mjs,verify-extraction-provenance.test.mjs}` · `packages/avatar/**` · `packages/tool-call-repair/**` | 🟡 1-2d | 🟠 P0 | 🆕 Pendiente | **Hecho por A5 (Ola 8, 2026-10-21) — mitad "catálogo":** las 25 fichas de `docs/extractions/*.md` registran ahora la **procedencia** del upstream (`Licencia del origen` = `<LICENCIA> — <owner/repo>`, `Commit verificado` = HEAD real del clon, `Ruta de origen` = fichero real del clon) **dentro** de su tabla de metadatos, sin partir ninguna tabla; **0** filas de catálogo afirman derivación de código (la Ola 8 las había prefijado con `Adapted from …` — atribución falsa, revertida: la ficha es un documento de análisis escrito por Ego, no una obra derivada); la puerta `docs/extractions/tools/verify-extraction-provenance.mjs` está **implementada y en verde** (exit 0, 25/25) con test propio de 8 casos (rojo→verde). **Pendiente — mitad "código":** desplegar la cabecera canónica en los ficheros **realmente derivados** de `packages/**`. Medición real (2026-10-21, barrido de 1 144 ficheros `.ts/.tsx/.js/.mjs/.cjs`): **14** con forma `Adapted from <upstream> (<LIC>), <ruta>` (los 14 en `packages/avatar/`: 7 en `src/` + 7 en `dist/`), **6** con forma `ADAPTADO de <ruta> (<LIC>, <copyright>) — ver LICENSE.md` (también sólo en `packages/avatar/`), **42** con atribución en **prosa** (no canónica) en 11 paquetes (`tool-call-repair` 9, `ui-runtime` 9, `memory` 6, `avatar` 5, `execution`/`recovery`/`subegos` 3, `tools` 2, `events`/`runtime` 1) y **2 de 19** paquetes con fichero de licencia en el paquete (sólo `avatar/` y `tool-call-repair/`). Corrección sobre el texto anterior: `packages/tool-call-repair` **no** está en formato canónico — sus 3 `src/` usan prosa — y la cifra «313 ficheros» ya no es la base válida. Nota de convención: la forma canónica del owner es la **por paquete** (`ADAPTADO de … — ver LICENSE.md` + `LICENSE.md` + `NOTICE` + `check-attribution.mjs`), no la forma 1; §4.3 del README ya documenta las dos. | `docs/research/licencias-obligaciones.md` §Procedimiento de atribución · `docs/extractions/README.md` §4.3-§4.4 | `EGO-FIND-83` |
```

> **Nota para A1:** la severidad `🔴 Crítica` y la prioridad `🟠 P0` son ahora discutibles — la mitad del
> catálogo está cerrada y verificada por gate. **No las he tocado**: la decisión es tuya. Si
> quieres rebajarlas, los valores que propongo son `🟠 Alta` / `🟠 P1`.

### 2.2 Para A6 — `packages/avatar/**` (cabecera canónica en código derivado)

**Lista autoritativa** de ficheros derivados que **aún no** llevan cabecera canónica — la de
[`docs/extractions/coucou.md`](../../../../extractions/coucou.md) §52.4 (no la he editado):

| # | Fichero | Qué declara hoy |
|--:|---|---|
| 1 | `packages/avatar/src/core/timeline.js:2` | `PORTES VERBATIM` (origen `coucou mochi/engine.ts`) |
| 2 | `packages/avatar/src/runtime/poses.js:11` | `Tabla base verbatim (core.js:8-57)` |
| 3 | `packages/avatar/src/studio/render/particles.js:1` | `port verbatim de avatar_studio_cx_artlab_mochi_2_0.html` |
| 4 | `packages/avatar/src/studio/render/visor.js:1` | `puerto verbatim del avatar studio` |
| 5 | `packages/avatar/src/studio/rig/eyes.js:1` | `puerto verbatim del avatar studio` |
| 6 | `packages/avatar/src/studio/rig/hands.js:2` | `Puerto verbatim de avatar_studio_cx_artlab_mochi_2_0.html` |
| 7 | `packages/avatar/src/studio/sound.js:1` | `verbatim de avatar_studio_cx_artlab_mochi_2_0.html` |
| 8 | `packages/avatar/src/render/ara-head.js:1` | verbatim — **origen `agent-robot-avatar`** (MIT © CX ArtLab), upstream distinto |
| 9 | `packages/avatar/src/render/body.js:3` | verbatim — **origen `agent-robot-avatar`** (MIT © CX ArtLab), upstream distinto |
| 10 | `packages/avatar/src/render/projection.js:2` | `PORTADO de vendor/coucou/mochi/engine.ts drawEyes() (líneas 749-784, MIT)` |
| 11 | `packages/avatar/src/render/static.js:3` | port de `vendor/coucou-swift/MochiStill.swift` |

**Lo que se pide a A6 (no aplicado — zona de A6):**

| # | Cambio pedido | Detalle |
|--:|---|---|
| **A5-S40** | Poner la cabecera canónica a los ficheros **que sean puerto literal** | Forma del owner (por paquete): `// ADAPTADO de <ruta del upstream> (<LIC>, <copyright>) — ver LICENSE.md`. La forma 1 (`Adapted from <upstream> (<LIC>), <ruta>`) también la acepta la puerta. **Ojo**: la cabecera debe distinguir **dos upstreams distintos** — `vendor/coucou/**` (Mochi, MIT © Louis Raillart) y `agent-robot-avatar` (ARA, MIT © CX ArtLab) — porque la decisión D4 del owner sustituye **la geometría de Mochi**, no la de ARA. |
| **A5-S41** | Sustituir la geometría de Mochi por geometría propia (D4) y **retirar** entonces las cabeceras de Mochi | No es una atribución que se pueda "normalizar": es código que va a desaparecer. |
| **A5-S42** | Verificar el recuento de `packages/avatar/src/` | La ficha §52.4 dice «49 ficheros de `src/`» y «8 la llevan»; el medido es **47** y **7** (`src/studio/render/geometry.js` ya no la lleva). El texto lo he actualizado en el README §4.3; **la ficha §52.4 no la he tocado** (queda como lista autoritativa tuya). |
| **A5-S43** | `packages/tool-call-repair/` (si lo tocas tú) | Sus 3 `src/` usan prosa (`Extraído y adaptado de OpenClaw …`), no la forma canónica; el paquete tiene `LICENSE.md` pero **sin `NOTICE`**. Es zona de A2bis, pero la lista de forma canónica es tuya. |

### 2.3 Para A2bis — `packages/{memory,tasks,runtime,events,knowledge,models,decision,execution,security,tool-call-repair}/**`

**42 ficheros** de `packages/**` tienen atribución en **prosa** (forma no canónica). Reparto en
tu zona: `tool-call-repair` (9), `ui-runtime` (9 — **no es tuya**, aviso aparte), `memory` (6),
`execution` (3), `recovery` (3 — **no es tuya**), `subegos` (3 — **no es tuya**), `events` (1),
`runtime` (1). El pedido es el mismo que para A6: subir la prosa a la forma canónica por
paquete **sólo** en los ficheros que sean realmente derivados, y dejar en prosa (o sin cabecera)
los que sean implementación propia de Ego. La lista exacta de 42 sale del barrido descrito en
el README §4.3; no la he pegado aquí para no duplicar una lista que puede quedar desfasada —
**pídela y la regenero** (o corre el barrido: son las primeras 15 líneas de cada fichero bajo
`packages/**` que contengan `Extraído y adaptado de` / `Adaptado de` / `Extraído de`).

### 2.4 Para A7 — `scripts/**`: mover los 2 scripts y cablear la puerta a CI

Los 2 ejecutables están hoy en `docs/extractions/tools/` porque **`scripts/**` es tu zona**. El
contrato de la puerta ya está escrito en [`docs/extractions/README.md`](../../../../extractions/README.md)
§4.4; lo que falta es el **cableado**.

**Diff exacto a aplicar** (A7, zona `scripts/**`):

| # | Cambio pedido | Detalle |
|--:|---|---|
| **A5-S44** | Mover `docs/extractions/tools/verify-extraction-provenance.mjs` → `scripts/verify-extraction-provenance.mjs` | Sin cambios de lógica. El script ya resuelve su `ROOT` a partir de `import.meta.url` (`join(HERE, "..", "..", "..")`) → al moverlo a `scripts/` **ese `join` pasa a tener 2 niveles, no 3**. Hay que cambiarlo a `join(HERE, "..")` **y** actualizar la ruta del test. |
| **A5-S45** | Mover el test junto a él: `scripts/verify-extraction-provenance.test.mjs` | El test deriva la ruta de la puerta de `dirname(fileURLToPath(import.meta.url))` → **si mueves la puerta pero no el test (o al revés), el test deja de encontrarla**. Muévelos juntos o ajusta la constante. |
| **A5-S46** | Mover también el generador `docs/extractions/tools/normalize-attribution.mjs` → `scripts/normalize-attraction.mjs` | Mismo cambio de `ROOT` (`join(HERE, "..")`). Es el **generador**, no un gate: no hace falta en CI, pero que no quede en `docs/` (un `docs/` no debe contener ejecutables que mutan las fichas). |
| **A5-S47** | Añadir la puerta al job `verify` de `.github/workflows/ci.yml` | `node scripts/verify-extraction-provenance.mjs` → **exit 0**. **Antes** del typecheck/tests (fail-fast), como el `design-lint`. La puerta necesita `git` (lee el remote y el HEAD de cada clon) → el checkout de CI ya es un repo git ✅, pero los **clones de `repos-referencia/` no existen en CI** → **la puerta fallará en CI con 25 × `upstream-inexistente`**. Opciones: (a) la CI no la ejecuta y sólo se ejecuta en local (documentado); (b) se le da un flag `--sin-clones` que sólo valida la forma de las fichas y la coherencia ficha↔backlog; (c) la CI clona los 25 repos (pesado). **Decisión de A7** — la puerta tal cual está designed para el árbol con clones. |
| **A5-S48** | `scripts/sync-extraction-indexes.mjs` (`CATALOG`) | Sigue con los recuentos viejos (A5-S3, ya pedido en la Ola 5). La Ola 8 **no** cambia los recuentos de tareas (`✅53 · 🚫72 · 🆕130 · ⏳34`, 289 en total) — sólo la procedencia. |

### 2.5 Para A8 (informativo)

`docs/extractions/README.md` §4.3-§4.4 y `docs/extractions/coucou.md` §52.4 han cambiado de
contenido; si la matriz de secciones del VERDICT §7 cita el texto anterior («8 de 90», «0 de
313»), hay que refrescarlo.

---

## 3. Verificación

| # | Comando | Exit | Resumen |
|--:|---|:--:|---|
| 1 | `node docs/extractions/tools/normalize-attribution.mjs --check` | **0** | `fichas procesadas: 25 · cambios: 0` → **idempotente** |
| 2 | `node docs/extractions/tools/verify-extraction-provenance.mjs` | **0** | `OK: 25 fichas con procedencia verificada (upstream, licencia, commit, ruta de origen e IDs)` |
| 3 | `node --test docs/extractions/tools/verify-extraction-provenance.test.mjs` | **0** | `tests 8 · pass 8 · fail 0` |
| 4 | `node scripts/audit-extraction-gates.mjs` | **0** | `✅53 · 🚫72 · 🆕130 · ⏳34 · en el limbo=0` · `No canónicos: 0` |
| 5 | `node scripts/verify-backlog-gates.mjs` | **0** | `filas de compuerta coherentes: 546` |
| 6 | `node docs/testing/check-docs-paths.mjs` | **0** | `0 enlaces rotos, 0 rutas inexistentes en docs canónicos` |
| 7 | `node scripts/check-docs-lint.mjs` | **0** | `7147 violaciones actuales : 7148 en la base` → **ninguna nueva** (una menos que la base) |

Además, comprobado a mano:

- **0** filas de catálogo (fichas + backlogs) afirma derivación de código.
- **39** prefijos `Adapted from … —` seguido de un espacio eliminados; **0** restantes en celdas de descripción
  (los que quedan son **prosa que describe la regla** — p. ej. la fila `Licencia` de `ag-ui.md`
  dice «cualquier porte debe llevar cabecera `Adapted from …`» — que es correcto).
- `git status --porcelain -- docs/extractions docs/review` → **26 modificados + `tools/` nuevo**;
  **`docs/review/**` no aparece** ⇒ los 5 backlogs volvieron a su texto original byte a byte.

---

## 4. Test rojo → verde (TDD)

**ROJO** — estado *pre-fix* reconstruido en un árbol temporal (los 2 fallos reales que el test
encontró: el fixture heredaba `commit.gpgsign` global del entorno → el commit del clon de
fixture fallaba; y la puerta contaba **dos** veces una fila presente en ficha **y** backlog):

```text
$ node --test a5-red/verify-extraction-provenance.test.mjs
ℹ tests 7
ℹ pass  2
ℹ fail  5
✖ 2. upstream sin clon → 1 discrepancia (upstream-inexistente)
  AssertionError: esperaba 1 discrepancia, hubo 2: demo: licencia-distinta: la ficha declara
  Apache-2.0, el LICENSE real del clon dice MIT | demo: commit-desfasado: no se puede leer el
  HEAD del clon
✖ 5. fila que afirma derivación sin cabecera canónica → 1 (derivacion-sin-cabecera)
  AssertionError: esperaba 1 discrepancia, hubo 3: demo: commit-desfasado: no se puede leer el
  HEAD del clon | demo: derivacion-sin-cabecera: DEMO-01 afirma derivación de código pero
  ninguno de los ficheros citados [packages/demo/derived.ts] lleva la cabecera canónica
✖ 6. fila que afirma derivación de khoj (AGPL) → 1 (credito-retirado, EGO-FIND-83)
  AssertionError: esperaba 1 discrepancia, hubo 3: demo: commit-desfasado: … | demo:
  credito-retirado: DEMO-01 afirma derivación de khoj-ai/khoj (EGO-FIND-83 la retiró) | demo:
  credito-retirado: DEMO-01 afirma derivación de khoj-ai/khoj (EGO-FIND-83 la retiró)
Exited with code 1
```

**VERDE** — tras las 2 correcciones (`git config commit.gpgsign false` en el clon de fixture;
dedup de afirmaciones por `id + upstream + ficheros`):

```text
$ node --test docs/extractions/tools/verify-extraction-provenance.test.mjs
✔ 1. ficha conforme → 0 discrepancias
✔ 2. upstream sin clon → 1 discrepancia (upstream-inexistente)
✔ 3. licencia distinta del LICENSE real → 1 discrepancia (licencia-distinta)
✔ 4. commit desfasado → 1 discrepancia (commit-desfasado)
✔ 5. fila que afirma derivación sin cabecera canónica → 1 (derivacion-sin-cabecera)
✔ 6. fila que afirma derivación de khoj (AGPL) → 1 (credito-retirado, EGO-FIND-83)
✔ 7. la misma fila con cabecera canónica en el fichero → 0 discrepancias
✔ 8. cabecera canonica forma 2 (ADAPTADO de ... ver LICENSE.md) → 0 discrepancias
ℹ tests 8
ℹ pass 8
ℹ fail 0
Exited with code 0
```

---

## 5. Deuda / no resuelto

| # | Deuda | Dueño | Nota |
|--:|---|---|---|
| 1 | **La cabecera canónica en el código derivado de `packages/**`** (14 forma 1 · 6 forma 2 · 42 en prosa · 17 paquetes sin `LICENSE.md`) | A6 (avatar) · A2bis (resto) | Es la mitad de `EGO-FIND-82` que **no** era mía. Detalle en §2.2 y §2.3. |
| 2 | **Mover los 2 ejecutables a `scripts/**` y cablear la puerta a CI** | A7 | §2.4. Ojo con el `--root` y con los clones: **en CI no existen los clones de `repos-referencia/`** ⇒ la puerta tal cual fallará allí. |
| 3 | `docs/extractions/coucou.md` §52.4 conserva los recuentos antiguos («49 ficheros», «8 la llevan») | A6 | No la he tocado por decisión explícita (es la lista autoritativa de A6). Los recuentos reales están en el README §4.3. |
| 4 | `docs/roadmap/Backlog.md` §`EGO-FIND-82` sigue con el texto viejo | A1 | §2.1 da el texto exacto de sustitución. |
| 5 | `scripts/sync-extraction-indexes.mjs` (`CATALOG`) sigue con los recuentos anteriores | A7 | Petición heredada de la Ola 5 (A5-S3); esta ola **no** cambia los recuentos de tareas. |
| 6 | `repos-referencia/avatar/` **no tiene remote git** | — | El generador lo resuelve por la ficha y lo reporta en `NO RESUELTOS`; la puerta lo acepta vía `upstream` declarado. No bloquea (el resto de los 24 sí tiene remote). |
| 7 | `khoj` (AGPL-3.0) sigue en el catálogo (25 repos / 289 tareas) | A1 | `EGO-FIND-83` («retirar todo el crédito a khoj») lo decide; mi puerta **impide** que una fila afirme derivación de khoj, pero **no** lo borra del catálogo. |
