> **ACTIVE INSTRUCTION — Execute Complete Task**
> Cargado por `commands/pipeline.md` (modo TASK, ejecución NOW) o por `/pipeline run` vía sub-agente.
> Path resolution: `skills/X` → `.agents/skills/X/`, `tasks/ID.md` → `docs/agent-ops/tasks/ID.md`
> Ejecutar UNA TAREA COMPLETA por invocación: discovery → implementación → cierre.
> Seguir el flujo según estado (PENDING / IN PROGRESS / FAILED).
> Al finalizar: commit, actualizar plan file, ejecutar skill progreso, handoff y STOP.
> NO continuar a la siguiente tarea — el loop externo (pipeline-run / sub-agentes) lo maneja.
> **PROFUNDIDAD UNIFICADA:** este prompt es la forma canónica de ejecutar UNA tarea
> (usado por `/pipeline task`, `/pipeline run` y ego-lead). Incluye el DISCOVERY completo
> (crea el task file si no existe) y el cierre completo. Si no podés terminar, devolvé
> el bloque `RESULTADO` del § Resultado con el trabajo hecho — **nunca te detengas en silencio**;
> el orquestador reanuda vía `subagent-recovery.md` (SARL).

Las skills base (campaign-executor, progreso, ponytail) se cargan automáticamente vía MCP — no las cargues manualmente.

Paso 0 — Auto-cargar skills según tipo de tarea:
   Llamá `campaign_get_next_task` (MCP) para obtener la tarea activa.
   Con los `Archivos clave`, llamá `campaign_discover_skills_v2` (MCP, canónico — v1 deprecated) con `phase="BUILD"` (o `phase="DEFINE"` si es spec-first) que devuelve skills base + lifecycle + scoring dinámico con justificaciones. Ejecutá `skill <nombre>` para CADA skill.
    Si es bug → además `systematic-debugging`. Si es lógica nueva →
    `test-driven-development`. Si es security-sensitive → `doubt-driven-development`.
    Llamá `campaign_get_workflow` (MCP) con el tipo detectado para cargar el
    perfil unificado v2 (`.agents/task-system/C0-unified.mjs` — bug-fix /
    feature-add / refactor / research / nine-second-saloon). El workflow define
    el template de fases (estados, instrucciones y transiciones por tipo) como
    guía classification-output — NUNCA define allowed_tools de enforcement:
    el enforcement runtime usa SIEMPRE la C0 genérica (`STATE_TOOLS`).

Paso 0b — **Skill Discovery (SDP, obligatorio — unificado vía MCP tool):**
   `campaign_discover_skills_v2` automatiza el SDP completo (SDP v2, scoring dinámico — v1 deprecated): base type + lifecycle mapping (según phase) + scoring por keywords del contrato. Devuelve ≤10 skills con justificaciones.
   a. Llamá `campaign_discover_skills_v2 archivosClave="<Archivos clave>" phase="BUILD" contractKeywords=["<keywords>"] maxSkills=8`
   b. Cargá skills devueltas con `skill <nombre>`
   c. Registrá `SDP: <skills cargadas>` en task file y `SKILLS_CARGADAS:` en RESULTADO (§7).
   d. Si no hay skills beyond base → registrá `SDP: base-only (keywords: <...>)`
   e. (SDP v3) Los **policy pins** (`pinned: [...]` del output) y la **base fija** son OBLIGATORIOS: cargalos siempre. Registrá `SDP: <skills>` incluyendo los `pinned` en el task file. El orquestador registra el outcome al cierre (feedback loop S2 — ver `skills-engineering.md` §SDP v3).

Paso 0c-core — **Lectura obligatoria references (siempre, antes de DISCOVERY):**
   Si la tarea toca código → leer COMPLETO `.agents/references/clean-code-clean-architecture.md` (al menos Apéndice V) + la reference del área (regla `.agents/rules/` que corresponda + checklists de tu rol). Sin lectura completa no hay ACT.

Paso 0c-context — **Notion lazy (anti-multiplicación de tokens):**
   El lead/orquestador lee las 4 páginas del proyecto UNA vez por plan vía `fetch`
   (Notion MCP) y pega el extracto relevante (≤30 líneas) en el prompt de cada
   worker. Los workers NO fetchean Notion (salvo `ego-research` en DISCOVERY
   pesado). Páginas: `Problema` (https://app.notion.com/p/3d4d044597568051bbe6cbb8a876e7b7), `Propuesta` (https://app.notion.com/p/3d4d0445975680cf9b5ecde4dd944c7c), `Nuevas features` (https://app.notion.com/p/3d7d0445975681f0a160d7f7e9b8c9f8), `Plan de accion` (https://app.notion.com/p/3d6d0445975681f69d5df028134190f4). Hijas COMPLETAS solo cuando la tarea mapee a ellas.
   Filtro Ego: solo memoria/core; otros holones NO aplican salvo que la tarea los toque.

INSTRUCCIONES — UNA TAREA COMPLETA POR ITERACIÓN:

Operás en un entorno por turnos. Procesás EXACTAMENTE UNA TAREA COMPLETA
por invocación y te detenés. El loop externo lo maneja el agente que te invocó
(/pipeline run via sub-agentes, o /loop-goal si usás el approach manual).

Las reglas detalladas están en `skills/campaign-executor/SKILL.md` (420L)
y `skills/campaign-executor/RULES.md` (413L). Seguilas exactamente.

## Flujo

### 1. LEER plan file directamente

Usá `campaign_get_next_task` (MCP) para obtener la tarea, o leé el plan file si ya lo tenés. Si se te pasó el plan file por
argumento, leelo con Read tool. Si no, buscá el más reciente en `docs/agent-ops/plans/`.

Buscá la tarea con el ID que te pasaron. Si está ⬜ PENDING o ⏳ IN PROGRESS,
ejecutala. Si está ✅ o ❌, informalo y detenete.

### 2. EJECUTAR TAREA COMPLETA SEGÚN ESTADO

#### ⬜ PENDING

**Discovery:**
- **Gate D (question-gates.md):** tras zero-code planning y ANTES de escribir el
  task file — si blast radius >10 archivos/hot path/API pública, contrato ambiguo,
  **el plan de solución agrega símbolos públicos nuevos (`pub fn`, tool, endpoint,
  método de binding — aunque el tipo auto-detectado diga fix/wrapper)**,
  o feature-add sin spec → `question` al usuario (GO / ajustar / dividir).
- **Gate mecánico spec-first:** task file de feature-add/lógica nueva SIN la sección
  `## Spec` LLENA según la definición canónica (question-gates.md §"Contenido
  válido de `## Spec`": tabla de decisiones O justificación por evidencia por ítem;
  `N/A`/vacía/"contrato mecánico" NO cuentan) → NO se puede entrar a ACT.
  Volvé a DISCOVERY y generá la spec + questions primero.
- Llamá `campaign_detect_task_type` (MCP) con `Archivos clave` → type, skills, checks
- **SDP Automatizado (CORE-005):** Llamá `campaign_discover_skills_v2 archivosClave="<Archivos clave>" phase="BUILD" contractKeywords=["<keywords del contrato>"] maxSkills=8` → devuelve skills con justificaciones. Cargá cada skill con `skill <nombre>` y registrá `SDP: <skills>` en task file.
- Si es bug → además `systematic-debugging`
- Si es security-sensitive → `doubt-driven-development`
- Si es lógica nueva/compleja → `test-driven-development`
- **Code Intelligence (AMBOS — tools NATIVAS: llamada directa, sin `execute`; inventario: `.agents/references/mcp-tools.md`):**
  - `codegraph_codegraph_explore "Archivos clave de la task"` — blast radius inmediato
  - `codebase-memory-mcp_detect_changes scope="impact" direction="inbound" depth=3` — blast radius transitivo, módulos impactados, risk classification
  - `codebase-memory-mcp_get_architecture aspects="['overview','clusters','hotspots','boundaries']"` — contexto arquitectónico
  - `codebase-memory-mcp_check_index_coverage paths=["<archivos clave>"]` — verifica cobertura del índice
  - **Regla:** búsqueda de código SIEMPRE por estas tools antes que `grep`/`read` (fallback solo configs/docs/no indexado).
- **Re-validar Skills tras Discovery (HIGH-007):** si el zero-code planning o web research revela que el tipo de tarea cambió (ej: fix → feature-add), re-invocá `campaign_discover_skills_v2` con el nuevo `phase` y `contractKeywords` actualizados. Cargá skills nuevas y registrá `SDP: <skills actualizadas>`.
- Web research (metasearch/Argus) si hay ambigüedad en APIs externas
- Descomponé en steps atómicos
- Creá task file en `docs/agent-ops/tasks/<ID>.md` SI NO EXISTE.
  **Si ya existe** (tarea reanudada tras un intento previo), LEELO y continuá desde el primer
  step ⬜ PENDING — **no re-hagas steps ya ✅ ni pisés el trabajo hecho.**
  El trabajo parcial vive en el worktree (git diff) y en el task file: respetalo.

**Implementación:**
- **Gate Regla 0 (MUST):** antes de la PRIMERA edición de cualquier archivo,
  el task file debe tener llena la sección **"Impacto mapeado (Regla 0)"**
  (formato en `prompts/task.md`): archivos leídos completos, referencias
  hacia dentro, referencias entrantes y veredicto de impacto. Si el task file
  no la tiene → volver a DISCOVERY y poblarla antes de editar.
- Llamá `campaign_update_task_state` con `"in-progress"` y recitation
- State machine: PLAN → ACT → VERIFY por cada step (~100 líneas por step)
  * Antes de ACT → `campaign_validate_command` (MCP) para validar el comando
  * Antes de la PRIMERA edición en ACT → `campaign_validate_scope` (MCP) con cada archivo a tocar (scope = task file / blast radius)
  * Antes de edit/write/bash que genere contenido → `campaign_validate_output` (MCP, LLM05)
  * Si el comando es riesgoso → `campaign_run_sandboxed` (MCP) — aislamiento = cwd+timeout (NO red/fs): contención, no garantía de seguridad
  * En cada transición de estado → `campaign_enforce_state` (MCP) para pre-call checks
  * Nota: `campaign_enforce_state`/`campaign_validate_*` son pre-call checks **ADVISORY** (no interceptan el tool real) — el enforcement efectivo es del orquestador/hooks, no del MCP.
- Si verify falla: retry ladder:
  1. Retry con feedback procesado
  2. Contexto fresco (~200 tokens resumen)
  **Umbral único (2 fallas mismo-error): Gate V (question-gates.md) → `question`
  al usuario (reintentar fresh / cambiar estrategia / FAILED). Sin respuesta → STOP.**
- Evaluator-Optimizer: correctitud, simplicidad, consistencia
- Self-Harness Gate: propose → evaluate → accept
- Pre-commit Gate: Definition of Done + checklists por tipo
- **FASE SECURITY** (obligatoria cuando el cambio toca trust boundaries):
  * Condición: input de usuario, auth/sesiones, dependencias (nuevas o bump),
    storage/persistencia, FFI (PyO3/WASM/Node), red (server/MCP/HTTP)
  * Skill: `security-and-hardening` — seguí su checklist completa (la skill tiene la suya propia)
  * Gate de verificación: checklist de `security-and-hardening` ✅ +
    `cargo audit` SI hubo cambios de dependencias
- **FASE PERFORMANCE** (obligatoria cuando el cambio toca hot paths):
  * Condición: `vector/` (HNSW, métricas de distancia), `engine.rs`, loops de
    search/ingestión, serialización (ver AGENTS.md Regla 4 y deuda P2)
  * Skill: `performance-optimization`
  * Gate de verificación: comparación contra baseline — medí antes/después
    (bench Criterion o timing simple); sin regresión o regresión documentada
- **Fork/Join en EJECUCIÓN (HIGH-011):** si hay steps ⬜ PENDING consecutivos que operan en archivos DISJUNTOS y sin dependencias mutuas (verificar con `codebase-memory-mcp_trace_path`), podés ejecutarlos en paralelo (max 2 sub-agentes):
  1. Identificá steps independientes: archivos no solapados + sin dependencias en task file
  2. Spawn sub-agentes via `task` tool con prompt reducido (solo ese step + contrato)
  3. Join: esperá ambos, merge results, continuá con step siguiente
  4. Si un sub-agente falla → SARL RESUME individual, no afecta al otro
  5. Budget: cada sub-agente paralelo consume budget propio
- Pre-commit: skill code-review-and-quality + spec OCR (`pwsh .agents/dev-tools/ocr-review.ps1`) como input del reviewer, antes del commit final
- Budget: `BUDGET_LIMITS` (campaign-server.mjs). **Si se agota el budget sin completar → devolvé
  `RESULTADO: 🟡 INCOMPLETO` con el próximo step ⬜ PENDING; NO lo marques FAILED solo por budget.**
  El orquestador decide RESUME/RETRY vía subagent-recovery.md.

**Cierre:**
- **GATE CITAS (TSYS-13, solo research/evidencia):** si la tarea produce evidencia con URLs citadas
  (campo `fuentes`/URLs del task file o `contract.evidencia` de la recitation):
  * Extraé cada URL citada.
  * Check mecánico: resolvé cada URL con `webfetch`/HEAD (o `argus_extract_content` si aplica).
    URL que NO resuelve (404 / dead / timeout) → evidencia **INVALIDA**: reemplazá la fuente
    o descartá el claim — no la presentes como verificada.
  * SIN RED (runner offline): fallback manual documentado — marcá cada cita como
    `[cita NO VERIFICADA — sin red]` en la evidencia y anotá la verificación pendiente
    en `contract.deuda` de la recitation. Nunca la des por verificada.
- Verify full:
  1. `task_verify_cmd command="pnpm build"`
  2. `task_verify_cmd command="pnpm typecheck"`
  3. `task_verify_cmd command="pnpm test"`
  4. `campaign_verify_cmd command="scripts/validate-docs-coverage.ps1"`
  5. OCR delegation review (advisory, sin API key): `pwsh .agents/dev-tools/ocr-review.ps1 -Format json`
     → `ocr delegate rule <paths>` → revisar cada archivo con su Rule Group.
     Critical/High bloquean el commit; Medium → fila `FIND-*`; Low se descarta.
     Detalle: `.agents/references/ocr-review.md`.
- **Review P2-01 risk-tiered (agente distinto — `prompts/task.md` Fase 5):** antes de marcar COMPLETED, clasificá los paths tocados con la tabla (regla mecánica — el tier se decide por globs, no por tamaño del diff; un diff mixto = adversarial si AL MENOS un path matchea):

  | Tier | Paths del diff (globs) | Gate de review |
  |------|------------------------|----------------|
  | **Adversarial** | `docs/api/**` · `src/sdk/**` · `src/parser/**` · `src/storage/**` · `src/wal*.rs` · `src/serialization/**` · `src/index/serialize/**` · `src/binary_header.rs` · `src/node/**` · `src/text_index.rs` (wire = formatos de serialización on-disk postcard, `STORAGE_VERSIONING.md:129` — incluye node payloads VantaFile y metadata de text index) | Review adversarial por agente distinto: `ego-review`/`ego-audit` (fallback sin subagentes: `doubt-driven-development` degradado, marcado como degradado, + escalado al owner). Casos de prueba: `src/sdk/search/fusion.rs` → adversarial · `src/wal_sharded.rs` → adversarial |
  | **Fast** | cualquier otro path (ej. `docs/agent-ops/**`, `.agents/dev-tools/**`, `web/**`, tests, CI) | Verify fast mecánico: `.agents/dev-tools/verify.ps1` ALL PASS + veredicto registrado en §Review (spot-check del reviewer; sin adversarial completo). Casos de prueba: `.agents/dev-tools/verify.ps1` → fast |

  **Sin veredicto registrado en §Review la tarea NO se marca COMPLETED** (aplica a ambos tiers).
  **ACCEPT mecanizado (HARD-07):** al llamar `campaign_update_task_state(completed)` la recitation DEBE incluir el payload `review` — sin él el server devuelve `updated:false` (`reviewBlocked:true`, mensaje accionable) y NO escribe. Payload: `review {mode:'fresh', reviewer, reviewer_context, author_context, verdict:'approve'}` con `reviewer_context ≠ author_context` (P2-01); o `mode:'degraded'` SOLO con `waiver {owner, ref}` (queda registrado en trace/decisions — nunca bypass silencioso). Fuente mecánica: `validateReviewAccept` (`.agents/task-system/config/state-tools.mjs`).
- Si todo pasa: `git add <solo los archivos tocados en esta tarea> && git commit -m "feat: <ID> — <name>"` (el commit SIEMPRE está precedido por el verify full de arriba — nunca commitear un cambio sin verificación mecánica). **El commit es LOCAL: NUNCA ejecutes `git push` — el push requiere instrucción explícita del usuario (AGENTS.md Regla 7 §Política de git).**
- **Learnings (memoria única):** documentá 1-2 aprendizajes vía
  `campaign_memory_write(file="lessons", entry="<tema> | <lección> | ref: <ruta:línea>")`
  — NO editar AGENTS.md manualmente (schema TSYS-15; el server antepone la fecha).
- Llamá `campaign_update_task_state` con `"completed"` y recitation
- Auto-mejora: evaluá qué fue más difícil de lo esperado

**Progreso:**
- Ejecutá `skill progreso`

#### ⏳ IN PROGRESS

- Leé la recitation del plan file para saber dónde quedó
- Continuá con el próximo step (PLAN → ACT → VERIFY)
- Si verify falla: retry ladder (mismo que arriba, con Gate V al agotar el umbral)
- Errores colaterales / hallazgos: **routing en `prompts/findings.md` (fuente única)** —
  lo que no se arregla inline nace como fila `FIND-*` en Backlog desde el discovery,
  nunca solo anotado en plan/recitation. En Gate C, `question` al usuario sobre
  colaterales: arreglar ahora / incluir en commit (el ticket FIND ya existe si aplica).
  Si `git status` muestra archivos fuera del blast radius declarado → confirmar
  alcance del commit antes de `git add`.
- Budget: límites en `BUDGET_LIMITS` (campaign-server.mjs). 2 stalls consecutivos → ❌ FAILED.
  Si el presupuesto se agota sin terminar → devolvé `🟡 INCOMPLETO` con próximo step,
  no te cierres en silencio. Si `campaign_verify_cmd` devuelve `Budget exceeded` →
  `campaign_budget_reset(taskId)` + motivo en la recitation, y reintentá el verify
  (no es falla de código y no cuenta como retry).

**Cuando el último step esté completo + verificado + commiteado:**
- Llamá `campaign_update_task_state` con `"completed"` y recitation
- Ejecutá `skill progreso`

#### ❌ FAILED

- Anotá por qué falló y qué se intentó (los 4 escalones si aplica)
- Llamá `campaign_update_task_state` con `"failed"`
- Ejecutá `skill progreso` para registrar en `docs/ego-review-tracker.html/` (archivo de dominio)
- Detenete. No sigas a la siguiente tarea.

### 3. ACTUALIZAR RECITATION

> Plantilla canónica única: `task-system/prompts/recitation-template.md`
> (render legible + render MCP + bloque RESULTADO).

Después de cada acción, llamá `campaign_update_task_state` con:
- `taskId`: ID de la tarea
- `newState`: `"completed"` | `"failed"` | `"in-progress"`
- `recitation` — **estructura canónica única** (fuente única de verdad: §12.3 —
  plantilla `RESULTADO` — de `docs/Investigaciones/2026-08-10-agent-engineering/agent-03-orchestration.md`,
  SOLO LECTURA). Los campos del MCP son 6 núcleo + `review` (condicional a `completed` — HARD-07, schema campaign-server.mjs); la
  estructura §12 se embeberá DENTRO de `contract` y `result`:
  - `activeGoal`: echo del objetivo (≈ §12 `objective`)
  - `lastAction`: qué se hizo en esta iteración (≈ §12 `resumen`, máx ~200 tokens)
  - `result`: `OK` | `PARTIAL` | `FAILED` — el §12 `status`; estado real, nunca fabricado
  - `nextAction`: próximo paso concreto (archivo + comando)
  - `contract`: CONTRATO §12 (texto — incluye lo que gap-01 §3.3-18 llamaba `invariants`/`debt`):
    - `verificacion`: comando de verificación EXACTO + resultado obtenido (p.ej. `pnpm test` ✅)
    - `evidencia` (obligatoria por claim):
      - `claim`: <afirmación concreta>
        `evidencia`: <URL | file path | tool result>
        `confianza`: alta | media | baja
    - `artefactos`: <paths persistidos en filesystem> — outputs grandes NO en el mensaje
    - `invariantes`: qué NO se puede romper al continuar (dominio/seguridad; del task file) — si nada, "ninguna"
    - `deuda`: deuda pendiente / lo que queda incompleto al cerrar esta iteración — si nada, "ninguna"
    - `queda_pendiente`: <pendiente_adicional §12 — qué debe delegar/validar el orquestador>
  - `nextTask`: ID de la próxima tarea a ejecutar si completa
  - `review`: payload P2-01 — **obligatorio cuando `newState: "completed"`** (HARD-07): `{mode:'fresh', reviewer, reviewer_context, author_context, verdict:'approve'}` con `reviewer_context ≠ author_context`, o `{mode:'degraded', verdict:'approve', waiver:{owner, ref}}`. Sin payload válido el ACCEPT se bloquea (`reviewBlocked:true`).

> La recitation debe dejar al próximo agente en capacidad de continuar SIN
> preguntar al anterior: invariantes, verificación y deuda (eng-03-project.md:198).
> El orquestador valida `result` + evidencia por claim (§12.3); si el bloque no es
> parseable → `⚠️ SIN-FORMATO` (ver § 7). El server solo acepta las claves del schema (6 núcleo + `review` condicional):
> `review` se valida para el ACCEPT y NO se persiste en el bloque del plan — solo el waiver registrado va a trace/decisions.
> Claves top-level como `invariants`/`debt` no existen en el schema
> (campaign-server.mjs, tool `campaign_update_task_state`), van dentro de `contract`.

Sync el task file si aplica.

### 4. HANDOFF

Después de completar una tarea, dejá la recitation apuntando a la siguiente tarea.
El agente que te invocó recogerá la próxima iteración.

### 5. EJECUCIÓN MULTI-TAREA

Si el usuario quiere ejecutar MÁS de una tarea, usá `/pipeline run` que invoca
este mismo prompt por cada tarea vía sub-agentes con contexto fresco. No intentes
loope vos mismo.

```
/pipeline run [plan]
```

### 6. REFERENCIA RÁPIDA

| Modo | Comando | Qué hace |
|------|---------|----------|
| Una tarea | `/pipeline task ID` o `/loop-goal "./prompts/pipeline-full.md"` | Este prompt: una tarea completa |
| Todas | `/pipeline run` | Usa sub-agentes, invoca este prompt por tarea |
| Plan | `/pipeline plan backlog.md` | Crea plan desde backlog |
| Interactivo | `/pipeline` | Detecta estado y sugiere próximo paso |

### 7. RESULTADO — contrato de retorno obligatorio

Al final de CADA invocación devolvé ESTE bloque (el orquestador lo parsea para
decidir si la tarea está terminada o requiere reintentar/reanudar):

```
RESULTADO: ✅ COMPLETO | 🟡 INCOMPLETO | ❌ FALLIDO | ⚠️ SIN-FORMATO
STEPS_OK: <n>/<M> total steps
PROXIMO_STEP: <nombre del próximo step pendiente, o "ninguno">
COMMIT_HASH: <hash o "ninguno">
ARCHIVOS: <paths tocados>
VERIFY_CONTRATO: <pasa | no-corrido | falla>
BLOQUEO: <ninguno | qué impidió terminar>
GATES_EVALUADOS: P:<no|disparado> D:<no|disparado> V:<no|disparado> C:<no|disparado> | <motivo ≤6 palabras por gate>
SKILLS_CARGADAS: <lista de skills cargadas (SDP Paso 0b), o "base-only + SDP sin candidatos">
```

- `✅ COMPLETO`: todos los steps ✅ + `campaign_verify_cmd` del contrato pasa + commit hecho.
- `🟡 INCOMPLETO`: hay trabajo parcial (steps ✅ y ⬜ restantes). Decime el próximo step.
  Ocurre cuando: se agotó el budget, te detuviste a pedir aclaración, o el sub-proceso fue
  interrumpido. **SIEMPRE** actualizá el task file (steps ✅ + Context Save Point) antes de
  devolver INCOMPLETO — es lo que permite reanudar sin perder nada.
- `❌ FALLIDO`: agotaste el retry ladder interno (4 escalones) en VERIFY.
- `⚠️ SIN-FORMATO`: no devolviste el bloque — el orquestador va a re-invocarte pidiéndolo.
  También cuenta como SIN-FORMATO un bloque sin `GATES_EVALUADOS` o con gates
  no-disparados sin motivo (validación en question-gates.md §"Registro obligatorio").
- Mapeo con la recitation canónica (§ 3 / §12): `✅ COMPLETO` ↔ `result: OK`,
  `🟡 INCOMPLETO` ↔ `result: PARTIAL`, `❌ FALLIDO` ↔ `result: FAILED`,
  `⚠️ SIN-FORMATO` = bloque no parseable (ningún status §12 válido).

**Nunca** devuelvas resultados vacíos, "lista", o silencio. Si no pudiste terminar,
la información del bloque es el handoff para que el siguiente intento continúe.

REGLAS (del campaign-executor RULES.md):
- Usá `campaign_get_next_task` (MCP) o leé el plan file directamente
- El contrato es ley — si no se cumple, la tarea no está completa
- Verificación mecánica, nunca auto-reporte
- Ponytail ladder: existe > stdlib > dependency > mínimo código
- ~100 líneas por step, un step por turno, cada step reversible
- No cambies scope. Rápido se arregla, lento → fila `FIND-*` en Backlog (`prompts/findings.md`)
- Stagnation único: 2 fallas mismo-error → Gate V (`question-gates.md`); sin respuesta → STOP
- Budget: límites en `BUDGET_LIMITS` (campaign-server.mjs), 2 stalls consecutivos → FAILED
- 2 fallas de verify con mismo error → Gate V (`question-gates.md`): preguntar al usuario antes de FAILED
- La recitation es el handoff entre iteraciones
- Después de completar una tarea, DETENETE. No sigas a la siguiente.
