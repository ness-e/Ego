# Plan A5 — Extracción de repos de referencia: honestidad del backlog de compuertas

**Agente:** A5 (sesión `ses_ea9e4f31bffevf1saQbgL1bzhF`) · **Persona:** `.opencode/agents/ego-docs.md`
**Zona exclusiva:** `docs/extractions/**`, `docs/review/**`, `docs/research/{coucou,hermes-agent,openclaw}-deep-dive.md`
**Prohibido:** `packages/**`, `apps/**`, `tests/**`, `docs/{index.md,adr,roadmap,product,architecture,engineering,user,design,operations,deployment,testing,references}/**`

## Objetivo

Cumplir el **Protocolo de Compuertas de Extracción e Inspección Previa** de `AGENTS.md` §4: cada patrón extraído debe terminar en `✅ Completada` (adaptado e integrado, con caller en producción) o `🚫 Descartada (con justificación)`. **Nunca en el limbo.**

Estado real medido: **43 de 81 asimilados y en producción · 32 asimilados sin cablear (limbo) · 2 falsos verdes sin fichero · 3 IDs huérfanos · 0 filas `🚫 Descartada` en 7 backlogs**.

## Tareas

### T1 — Resolver los 2 falsos verdes críticos (`EGO-FIND-28`)
- `docs/review/backlog-openclaw.md:50-51` marca **OCLW-16** (`packages/tools/src/HotReloadToolLoader.ts`) y **OCLW-17** (`packages/tools/src/WorkspaceFileWatcher.ts`) como "✅ Completada" — **ninguno de los dos ficheros existe** (`Select-String "HotReload|FileWatcher|watch("` en `packages/` → 0).
- Para cada uno: o **lo implementas** (pero `packages/tools/` es zona de A3 → hándalo a A3 con la especificación), o lo marcas `🚫 Descartada (con justificación)` con el motivo técnico real.
- **No lo dejes en "Completada" sin fichero.** Es el hallazgo más grave de tu ámbito.
- `docs/roadmap/Backlog.md:42` sigue anunciando "hot-reloading de tools y file watcher" → **no lo edites** (es zona de A1): anótalo en tu handoff para que A1 lo corrija.

### T2 — Instaurar el guardrail de descarte en los 7 backlogs (`EGO-FIND-28`)
`AGENTS.md` §4 exige `🚫 Descartada (con justificación)` — hoy hay **0 filas** en los 7 `docs/review/backlog-*.md` (81 filas).
- Añade el estado canónico a cada backlog y **resuelve las 32 filas en limbo** (asimilado sin cablear): cada una termina en ✅ (con caller real en producción) o 🚫 (con motivo). Verifica el caller con grep en `packages/` + `apps/desktop/src/`, excluyendo `test/`.
- Los descartes a nivel de componente ya existen en `docs/extractions/*.md` (coucou 0, hermes 8, khoj 11, openclaw 7, helmor 8, career-ops 6, deepseek 5) pero con vocabulario distinto ("DESCARTAR", "Qué NO extraer"). **Normaliza a la forma canónica** `🚫 Descartada (con justificación)` y añade la columna/tabla que falte. `docs/extractions/coucou.md` (la ficha más grande, 1 700+ líneas) tiene **0** menciones de descarte → es la brecha mayor.

### T3 — IDs huérfanos y recuentos desfasados (`A5-03`, `A5-15`, `A5-16`)
- **COUC-22** y **OCLW-15** no tienen fila en el catálogo (solo aparecen en la matriz de fases). Crea las filas con estado explícito o corrige los contadores.
- `docs/extractions/README.md:66-72` declara `COUC-01..16`, `HERM-01..19`, `OCLW-01..15`, `KHOJ-01..05` — los backlogs reales tienen 22/22/17/6. **Sincroniza** (es tu zona).
- `docs/roadmap/Backlog.md:41-47` da recuentos distintos de `docs/review/README.md` y `docs/extractions/README.md` → **genera los recuentos desde los backlogs** o fija una sola fuente y referencia desde las otras dos. (El maestro lo reescribe A1.)

### T4 — Reetiquetar los falsos verdes restantes (`EGO-FIND-28` parcial)
Verifica el caller en producción y reetiqueta con la ruta real:
- **KHOJ-04** `FactExtractor` — marcado Completada, **0 consumidores** (`FactLifecycle` no lo invoca) → cablear (A3/A2 pueden hacerlo) o 🚫.
- **CARP-01** `DataContract` (existe, sin import fuera de `packages/memory/index.ts`) · **CARP-04** `UntrustedContentSanitizer` (sin caller; la cuarentena real está en `packages/knowledge/src/QuarantineManager.ts` — **ruta distinta, divergencia no documentada**).
- **DSEK-02** `getVersionHistory`/`getAtTimestamp` (0 consumidores; las queries bitemporales reales están en `packages/knowledge/src/BitemporalQueries.ts`) · **DSEK-04** `SchemaMigrator` (sin caller).
- **HERM-08** `WindowState.ts` declarado en `packages/ui-runtime/` pero el gestor real (`apps/desktop/src/windows/WindowStateManager.ts`) **no lo importa** (implementación paralela divergente) → documentar la divergencia.
- **HERM-12** `SlashCommandParser` existe pero el composer usa un parser propio (`renderer/components/composer-slash.ts`).
- **HERM-19** `SkillLinter` sin ruta en la ficha → añadir `packages/integrations/src/skills/SkillLinter.ts:82`.
- **HERM-06/07** (`WindowsUserEnv`, `WindowsSandboxFallback` en `packages/recovery/src/`) sin caller.
- **HELM-03** `useTerminalSession` existe pero sin consumidor; **HELM-01/02**: el terminal IPC de `main.ts` **no usa `TerminalOutputBuffer`** (doble camino de salida sin coalescer).
- **HELM-05** la ficha promete "coalescencia PTY" pero **no hay `node-pty`** en el workspace (el terminal usa `spawn` de `node:child_process`) → reescribe la nota como "coalescencia sobre pipes" o documenta la deuda real.
- **KHOJ-03**: la ficha dice `packages/knowledge/src/filters/CosineThresholdFilter.ts` — el real es **`ScoreThresholdFilter.ts`** (y el test es `ScoreThresholdFilter.test.ts`, no `HybridSearch.test.ts`).
- **OCLW-09**: `packages/tools/src/native/security/NetPolicy.ts` **sin caller**; la política viva es una "réplica léxica" sin DNS en `packages/security/src/ToolPermissions.ts` → documentar. (A3 unifica; tú registras el estado.)
- **OCLW-05**: `SessionLifecycleLocks` solo se cita como *string* en `WorkbenchView.tsx:88`, y con una ruta **obsoleta** `packages/memory/src/…` que **no existe** (los ficheros están en la raíz del paquete) → corrige la ruta del manifiesto o documéntalo.

### T5 — Atribución y legal del avatar (`EGO-FIND-24` parcial, `A5-04..A5-07`)
Tu zona: `docs/extractions/**` y `docs/research/*-deep-dive.md`.
- `packages/avatar/src/studio/render/{body,ears,eyes,mouth,accessories}.js` son **puertos verbatim** del HTML "Mochi" y `avatar-element.js:2052` conserva el preset `'coucou-mochi'` → contradice `AGENTS.md` §2 ("no copiar código directamente") y la decisión *"ningún nombre, dibujo, sonido ni icono de Mochi entra al producto"*.
- `packages/avatar/README.md:130,146,193` y `DESIGN.md:243,329` referencian `LICENSE.md` **5 veces** pero el fichero **no existe**; el `LICENSE` raíz es solo Apache-2.0 y no incluye los avisos MIT de Coucou/avatar.
- Cabeceras de atribución no cumplen el formato canónico `Adapted from Louis-CFM/coucou (MIT), <ruta>` (grep `Louis-CFM` en `packages/`+`apps/` → **0**).
- **Tu trabajo (documentación)**: redacta el **Veredicto de Descarte Justificado** para los puertos verbatim de Mochi (o la excepción formal que el owner debe aprobar), y documenta la cadena de atribución exigida. **A6** mueve los ficheros de licencia (su zona). Si no puedes determinar la decisión de producto, deja el veredicto como `🚫 Descartada (pendiente de aprobación del owner)` y anótalo en tu handoff.

### T6 — Contaminación de dominio: re-verificar (`A5` §Contaminación)
El barrido dio **LIMPIO** ✅ (0 entidades ATS de `career-ops`, 0 scrapers/`gte-small`/Twilio de `khoj`; los hits de `khoj` son comentarios de atribución y `bulk_import.py` es el sidecar propio de Ego).
- **Re-verifica** tras los cambios de la ola (A2/A3 pueden haber introducido algo): `dayforce|interamt|scan-ats|ATS|vacancy|candidate|salary|jobApplication|resumeParser|linkedin|indeed|glassdoor|twilio|online_search|sentence-transformers|gte-small|Stripe|SMTP` en `packages/` y `apps/` (excluye `node_modules`/`dist`).
- Documenta el resultado en la ficha correspondiente de `docs/extractions/`.

### T7 — Actualizar el informe de estado de la extracción
`docs/agent-ops/reports/reviews/review-full-2026-10-19.md` es la fuente de los hallazgos; tu salida canónica es el estado real por repo.
- Actualiza `docs/extractions/README.md` con la **tabla maestra**: repo | patrones declarados | ✅ asimilado+integrado | ⚠️ asimilado sin cablear | 🚫 descartado | en el limbo | nota.
- Actualiza los 7 `docs/review/backlog-*.md` con el estado real y la justificación.

## DoD específico

- Los 7 backlogs usan la taxonomía canónica (`✅ Completada` / `🚫 Descartada (con justificación)` / `🆕 Pendiente` / `⏳ Futura`) sin filas en el limbo.
- 0 IDs referenciados en `docs/roadmap/Backlog.md:41-47` o `docs/extractions/README.md` que no tengan fila.
- Todas las rutas citadas en las fichas existen en el repo (verificado con `Test-Path`).
- 0 contaminación de dominio (barrido re-verificado).
- El recuento de la tabla maestra cuadra con el recuento programático de filas.

## Handoff

`docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A5.md`
Incluye: (a) correcciones para `docs/roadmap/Backlog.md:41-47` (para A1), (b) especificación de OCLW-16/17 para A3, (c) la decisión pendiente de Mochi para el owner.
