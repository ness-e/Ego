---
description: "Pipeline unificado: crear plan desde backlog, definir tarea, ejecutar backlog completo. Modos: plan | task | run | interactive"
---

> **ENTRY POINT — Pipeline Command**
> El agente DEBE leer este archivo cuando el usuario envía un mensaje que empieza con `/pipeline`.
> Path resolution: `prompts/X.md` → `.agents/task-system/prompts/X.md`
> Skills: `skills/X` → `.agents/skills/X/`
> Tasks: `tasks/ID.md` → `docs/agent-ops/tasks/ID.md` (fallback `.agents/skills/campaign-executor/tasks/ID.md`)
> Instrucciones: cargar cada prompt con Read tool y ejecutar secuencialmente.
> Al finalizar: handoff y stop (no continuar sin que el usuario lo pida).
> **Consolidación 2026-08-25 + migración 2026-09-05 (legacy-eliminado):** router canónico `plan|task|run|interactive` (ver Router).
> `/build` fue eliminado 2026-09-25 — usar `/pipeline task`. Ex-alias eliminados: ver tabla Migración.

Cargá las skills campaign-executor, brainstorming, writing-plans, planning-and-task-breakdown, progreso (modo ponytail full activo vía plugin — ver `skills/ponytail/SKILL.md`).

Si el modo es `plan` (crear plan desde backlog), cargá también `spec-driven-development` — backlog items pueden necesitar specs antes de partir en tareas.

Entrada: $1
Si no se especificó entrada, usá `docs/roadmap/Backlog.md` en modo plan.

## Router: detectar modo según el argumento

- Si el argumento es `plan` + ruta → **MODO PLAN**: creá plan desde backlog.

**Agents:** Pipeline delega automáticamente a sub-agentes según el tipo de tarea (ver Modo Tarea → Routing). `/pipeline task <ID>` detecta el área que toca el task ID y rutea al agente especializado (ego-worker, ego-engine, ego-arch, ego-audit, ego-tuner, ego-docs, ego-chaos, o ego-lead para CI/CD/release).
- Si el argumento empieza con `task ` → **MODO TAREA**: extraé el ID y definí/ejecutá esa tarea con delegación automática a sub-agente.
- Si el argumento es `run` + plan opcional → **MODO RUN**: ejecutá backlog completo sin parar.
> **Migración (legacy-eliminado 2026-09-05):** los nombres históricos dejan de rutear. Usá el canónico.
> | Histórico (eliminado) | Canónico |
> |---|---|
> | `pipeline` (suelto) | `/pipeline run` |
> | `ejecución` | `/pipeline run` + "Depuración paso a paso" |
> | `mcp` | `/pipeline run` + "Depuración paso a paso" |
- Si no hay argumento → **MODO INTERACTIVO**: detectá estado actual y sugerí próximo paso.

Cross-command flow: pipeline → audit → ship → rollback
  - `/pipeline` planifica y ejecuta tareas (único orquestador de ejecución)
  - `/audit` certifica la calidad antes de ship (router sobre unified-review)
  - OCR delegation (`pwsh .agents/dev-tools/ocr-review.ps1`, sin API key) corre en el cierre
    de cada tarea (pipeline-full.md §Cierre paso 5) como input del reviewer
  - `/ship` decide GO/NO-GO con fan-out a 3 personas
  - `/rollback` si el ship falla

---

## MODO PLAN — Crear plan desde backlog

```
/pipeline plan docs/roadmap/Backlog.md
```

**Paso 0 — Spec existente o auto-generada.** Buscá `SPEC.md` en raíz, `docs/SPEC.md`, o archivos en `spec/`. Si existe, úsalo como contexto. Si NO existe y el backlog incluye tareas feature-add: generala primero siguiendo el flujo automático de `.agents/commands/spec.md` (contexto del repo → tabla de decisiones → UNA ronda de `question` tool con opciones + `(Recomendado)` → escribir `SPEC.md`). No sigas a triage sin resolver las decisiones abiertas.

**Enter plan mode — read only, no code changes.**

Cargá `prompts/plan.md` con `{{BACKLOG_PATH}}` = ruta del backlog.

Aplicá triage gate (✅ DO / 🟡 DEFER / ❌ SKIP / 🔴 BLOQUEADO).

### Reglas del gate
1. Bug ya inexistente o feature ya implementada → SKIP
2. Cosmético sin queja de usuario → DEFER
3. Esfuerzo >> impacto → DEFER o SKIP
4. Dependencia no lista → BLOQUEADO
5. Prioridad original es sugerencia, no orden

### Proceso de planificación
1. Identificá el grafo de dependencias entre componentes
2. Sliced vertical: un path completo por tarea (no capas horizontales)
3. Cada tarea debe tener acceptance criteria y verification steps
4. Agregá checkpoints entre fases

### Formato del plan file
Creá `docs/agent-ops/plans/<FECHA>-<nombre>.md` con:
- Solo tareas ✅ DO, ordenadas por prioridad real
- Gate Justificación para cada una
- Contrato verificable (condición booleana que un comando puede verificar)
- Task file: `docs/agent-ops/tasks/<ID>.md` (aún no existe)
- Estado inicial ⬜ PENDING
- Tabla resumen al inicio (DO / DEFER / SKIP / BLOQUEADO)
- Fuente del backlog

Opcional: ~~también guardá en `tasks/plan.md`~~ (eliminado 2026-08-25 — ubicación única `docs/agent-ops/plans/`; `/build` ya no lee planes propios).

### Auto-detección de formato
- El backlog usa el esquema canónico de 10 columnas (`.agents/references/backlog-format.md`) → parseá determinísticamente (`` `ID` `` backticked + columna Estado; excluí 🧊/🔮/❌ del triage)
- Si no reconoce el formato → el agente interpreta con LLM para extraer tareas

**Al finalizar, mostrá:**
```
Plan creado en docs/agent-ops/plans/<FECHA>-<nombre>.md
Próximo paso recomendado:
  /pipeline run                    → ejecutar backlog completo sin parar
  /pipeline task <ID>              → definir/ejecutar una tarea específica
```

---

## MODO TAREA — Definir/ejecutar tarea compleja

```
/pipeline task DRV-068
```

Task ID: {id extraído después de "task "}

**PASO 0 — GATE de proceso (no salteable; su evidencia queda en el task file):**
1. Leé COMPLETO `.agents/task-system/prompts/task.md` ANTES de cualquier acción y ejecutá sus fases 1→5 en orden (auto-tipo → feature-add SDD → discovery+blast radius → web research → steps atómicos → Review).
2. Herramientas campaign MCP **obligatorias**: `campaign_detect_task_type` (tipo/routing), `campaign_discover_skills_v2` (SDP, fase correcta), `campaign_verify_cmd` (contrato mecánico ANTES del commit), `campaign_update_task_state` (estado + recitation). Equivalentes manuales NO cuentan.
3. El task file DEBE usar el formato canónico de `task.md` §"Formato del task file" (Impacto mapeado Regla 0, Spec SDD, Invariantes de dominio, Deuda Regla 6, DoD multi-nivel, Incógnitas/Pendientes, SECURITY/PERFORMANCE, Steps, Review P2-01). El template reducido de campaign-executor NO es válido.
4. **Gate Review P2-01** (`task.md` Fase 5): la tarea NO se marca COMPLETED sin review de agente DISTINTO registrado en §Review del task file. Fallback si no hay subagentes: `doubt-driven-development` degradado (marcado como degradado) + escalado al owner — registrado igualmente en §Review.
5. **Fallback sin subagentes (provider gating):** NO improvisar ejecución sin gates — cargá `prompts/pipeline-full.md` y ejecutá inline manteniendo TODOS los gates (SDP, Gate D/V/C, verify full, review P2-01). "Todo directo" es un fallback de DELEGACIÓN, nunca una exención de GATES.

1. Buscá la tarea en:
   - El plan file más reciente (`docs/agent-ops/plans/`)
   - `docs/roadmap/Backlog.md`
   - Si no se encuentra en ninguna, preguntale al usuario
2. Si no existe task file → cargá `prompts/task.md` y ejecutá sus 4 fases:
   - Auto-detect type → codegraph_codegraph_explore → blast radius → web research → atomic steps
   - Creá `docs/agent-ops/tasks/<ID>.md`
3. **Routing automático a sub-agente** — determiná el área del task ID y delega:
   La tabla canónica de routing vive en `agents/ego-lead.md` § Routing (misma lógica: área → sub-agente → ejemplos de IDs). Úsala; no la dupliques acá.

   **Flujo:**
   1. Lookup: identificá el área según el task ID prefix o descripción
   2. Analyze: `campaign_detect_task_type` con archivos clave del plan/backlog
   3. Load skills: `campaign_discover_skills_v2` con archivos clave + phase + skills extra según área
   4. **DISCOVERY (híbrido):** tareas 🟡/🔴 con DISCOVERY pesado (web research
      multi-doc, extracción de contenido, blast radius amplio) → fork a
      `ego-research` (`task(subagent_type="ego-research", ...)` — read-only,
      digest ≤500 palabras + bloque RESULTADO §7) → el lead arma el task file
      con el digest. 🟢 con DISCOVERY liviano → queda inline (codegraph +
      búsqueda puntual). NO fragmentar por step: la delegación cubre la fase
      pesada completa (R4: SARL RESUME ya conserva contexto del ejecutor).
   5. Delegate: `task(subagent_type="ego-<area>", prompt="...")` con entry point, acceptance criteria, y verification command, usando la plantilla completa de `prompts/pipeline-run.md` §6.f (Contexto verificado + Estado del task file)
5. Review: el sub-agente devuelve resultado, revisalo. Si el resultado es INCOMPLETO,
       FAILED, vacío o "se detuvo solo" → aplicá la escalera `prompts/subagent-recovery.md`
       (RESUME misma sesión con `task_id` → RETRY fresco → STRATEGY → ESCALATE). Nunca rehagas
       el trabajo ya hecho del task file/worktree. Verify mecánico (`campaign_verify_cmd`)
       antes de dar la tarea por completada.
    6. **Progreso**: ejecutá `skill progreso` (Trigger 1 — Complete a task) para:
       - **Eliminar la fila** del Backlog.md (no tachar; el registro queda en `docs/ego-review-tracker.html/` por dominio; items removidos sin completar → `docs/ego-review-tracker.html/historial/backlog-history.md`)
       - Migrar a `docs/ego-review-tracker.html/` (archivo de dominio, sin duplicados)
       - Actualizar el plan file si existe
       - Validar doc coverage con `scripts/validate-docs-coverage.ps1`
       - Registrar en `campaign_memory_write` si aplica
    7. **Auto-commit (local)**: validá el contrato mecánicamente PRIMERO (`campaign_verify_cmd` con el comando del task file); solo si pasa, creá commit local con conventional commit + task ID (sin preguntar). Sin verify mecánico no se commitea — nunca saltar el gate. **NUNCA `git push`**: el push requiere instrucción explícita del usuario (AGENTS.md Regla 7 §Política de git).
    - Para comandos multi-tarea (ej: `/pipeline run` con FAIL_MODE=parallel): múltiples sub-agentes en paralelo
    8. Si el usuario quiere ejecutar AHORA sin esperar task file → cargá `prompts/pipeline-full.md` y delegá al sub-agente según el routing de (3)

**Al finalizar, mostrá:**
```
Task file creado: docs/agent-ops/tasks/<ID>.md
Delegado a: ego-<area>
Para ejecutar más:
  /pipeline run                      → backlog completo
  /pipeline task <ID2>               → siguiente tarea
```

---

## MODO RUN — Ejecutar backlog completo (non-stop)

```
/pipeline run [docs/agent-ops/plans/mi-plan.md]
```

Ejecutá TODAS las tareas del plan file una por una hasta completar.
Usá `prompts/pipeline-run.md` con el plan file correspondiente.

> **Profundidad unificada:** cada tarea se ejecuta en un sub-agente que sigue
> `prompts/pipeline-full.md` (DISCOVERY → EJECUCIÓN → CIERRE) — la MISMA profundidad que
> `/pipeline task`. El sub-agente crea el task file si no existe o continúa el existente.
> El tipo de sub-agente (`subagent_type`) sale del campo `Ruta` del plan
> (ego-worker, ego-tuner, ego-audit, …).
> Si un sub-agente devuelve resultado incompleto/fallido/detenido → escalera SARL
> (`prompts/subagent-recovery.md`): RESUME misma sesión → RETRY fresco → STRATEGY → ESCALATE.
> Ningún INCOMPLETE se marca FAILED sin pasar por SARL; el trabajo hecho nunca se pierde.

> Si no se especifica plan file, detectá automáticamente el más reciente en `docs/agent-ops/plans/`.
> Si no hay plan file, mostrá error: "No hay plan file. Usá `/pipeline plan docs/roadmap/Backlog.md` primero."

### FAIL_MODE
Por defecto `FAIL_MODE=parallel` (alineado a `prompts/pipeline-run.md:23`). Se puede modificar:
- **FAIL_MODE=stop** — se detiene al primer error
- **FAIL_MODE=skip** — no parar en fallos, marcar como failed y continuar
- **FAIL_MODE=parallel** — waves paralelas de tareas independientes (default)
  (editar variable en `prompts/pipeline-run.md`)

**FAIL_MODE=parallel en detalle:**
1. Identificá tareas sin dependencias entre sí
2. Agrupalas en waves según el grafo de dependencias
3. Wave 0: tareas sin dependencias → N sub-agentes paralelos
4. Wave 1: tareas que dependen de Wave 0 → N sub-agentes
5. MAX_CONCURRENT = min(3, tareas_en_wave)   # límite por RAM en Windows
6. Cada tarea paralela es su propio sub-agente (contexto fresco)
7. Si una tarea de una wave falla, las tareas dependientes en waves posteriores quedan BLOQUEADAS

Al terminar cada tarea: commit **local** con conventional commit + task ID (nunca push — solo con instrucción explícita del usuario; AGENTS.md Regla 7 §Política de git).
Al terminar todas las tareas: ejecutá `skill progreso` (Trigger 1) y reportá campaña completada.

### Depuración paso a paso

- **Una tarea completa por iteración (manual):**
  `/loop-goal "Ejecutá UNA TAREA COMPLETA siguiendo .agents/task-system/prompts/pipeline-full.md"`
  Cada iteración procesa UNA TAREA COMPLETA (discovery → implementación → verify → commit → skill progreso). Requiere re-ejecutar `/loop-goal` manualmente por tarea.
- **Un paso por iteración (MCP, útil para depurar):**
  `/loop-goal "Ejecutá UNA iteración siguiendo .agents/task-system/prompts/iter-loop-tools.md"`
  Usa `campaign_get_next_task`/`campaign_update_task_state`/`campaign_verify_cmd` + `campaign_discover_skills_v2`. Cada iteración procesa UN PASO. Usá `campaign_session_track` para persistencia entre iteraciones.
  Si hay múltiples planes activos, listalos y pedí al usuario que elija.

---

## MODO INTERACTIVO — Sin argumentos

Detectá el estado actual:

0. **Primero: buscá checkpoint** `docs/agent-ops/state/pipeline-state.json` (fallback `docs/pipeline-state.json`)
   - Si existe y tiene `inProgress` → mostrá "Pipeline en pausa en task {inProgress}. Usá `/pipeline run` para continuar."
   - Si existe y no hay `inProgress` pero hay completed/failed → mostrá resumen y recomendá `/pipeline run`
1. Buscá plan files en `docs/agent-ops/plans/`
2. Si hay un plan file ⏳ EN PROGRESO:
   - Leé el resumen (completados/pendientes/failed)
   - Mostrá: "Tienes un plan en progreso: N/M completadas. Usá `/pipeline run` para continuar."
3. Si hay plan file pero no iniciado (solo ⬜ PENDING):
   - Mostrá: "Plan listo con N tareas. Usá `/pipeline run` para empezar."
4. Si no hay plan file:
   - Mostrá: "No hay plan activo. Usá `/pipeline plan docs/roadmap/Backlog.md` para crear uno."
5. Si hay tareas en progreso sin plan:
   - Mostrá las tareas y recomendá `/pipeline plan` o `/pipeline task <ID>`

---

## Al final de cualquier modo

Mostrá el comando exacto para lo que sigue:

| Después de... | Mostrar... |
|--------------|------------|
| Crear plan | `/pipeline run` *(backlog completo)* o `/pipeline task <ID>` *(primera tarea)* |
| Definir tarea | `/pipeline task <ID2>` *(siguiente)* o `/pipeline run` *(backlog completo)* |
| Ejecutar pipeline | `/audit quick` *(verificar calidad)* o `/ship` *(preparar release)* o `/status` *(dashboard)* |
| Cualquier modo | También disponible: `/audit`, `/ship`, `/rollback`, `/status` |

---

## Mapa rápido

| Comando | Qué hace | Llama a |
|---------|----------|---------|
| `/pipeline plan backlog.md` | Crear plan | `prompts/plan.md` |
| `/pipeline task ID` | Definir/ejecutar tarea | `prompts/task.md` → `prompts/pipeline-full.md` |
| `/pipeline run [plan]` | Ejecutar backlog completo (profundidad unificada) | `prompts/pipeline-run.md` → `pipeline-full.md` por sub-agente + `subagent-recovery.md` |
| `/pipeline` | Detectar estado y sugerir | auto-detect |
| ~~`/pipeline pipeline` · `/pipeline ejecución`~~ | *(eliminado 2026-09-05 → usar `/pipeline run`)* | ver Migración |

---

## Apéndice: Prompt Templates (Referencia Rápida)

| # | Propósito | Prompt / Comando |
|---|-----------|-----------------|
| 0 | **Iniciar pipeline** (triage + gate + crear plan) | `/pipeline plan docs/roadmap/Backlog.md` |
| 1 | **Depuración paso a paso** (un step por iteración) | `/loop-goal "Ejecutá UNA iteración siguiendo \`.agents/task-system/prompts/iter-loop-tools.md\`"` |
| 2 | **Una tarea completa** (discovery → impl → verify → commit) | `/pipeline task <ID>` |
| 3 | **Backlog completo** (sub-agentes, auto) | `/pipeline run` |
| 4 | **FAIL_MODE=skip** (no parar en fallos) | `/pipeline run` con FAIL_MODE=skip |
| 5 | **FAIL_MODE=parallel** (waves paralelas) | `/pipeline run` con FAIL_MODE=parallel |
