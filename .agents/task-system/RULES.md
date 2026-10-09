# Campaign Executor — North Star + Reglas Invariantes

> **Este archivo no cambia.** Todo el pipeline referencia esta visión como anchor.
> Si una iteración se desvía, vuelve acá. No se edita durante ejecución.

---

## VISIÓN: North Star del Campaign Executor

### Propósito

Automatizar la ejecución de campañas de tareas desde backlog con **calidad
consistente** y **cero supervision overhead**: que un dev pueda dejar N tareas
encargadas y volver a encontrar todo hecho, verificado y comiteado.

### Criterios de éxito

| Dimensión | Target |
|-----------|--------|
| **Tasa de completado** | >90% de tareas en 1er intento |
| **Falsos positivos** | 0 — no marcar complete si algo falla |
| **Regresión silenciosa** | 0 — no romper tests que antes pasaban |
| **Deuda técnica** | no introducir más de la que se resuelve |
| **Tiempo dev** | 100% del foco en código, 0% en coordinar el loop |

### Principios invariantes

1. **El contrato es ley** — cada tarea tiene una condición booleana verificable.
   Si el contrato no se cumple, la tarea no está completa. Punto.

2. **Primero entender, después tocar** — Fase Discovery no es opcional.
   codegraph_codegraph_explore antes de la primera línea de código.

3. **Verificación mecánica, nunca auto-reporte** — el compilador, el test runner
   y el linter son los únicos que pueden decir "pasa". No confiar en resúmenes
   escritos por el agente.

4. **Un paso a la vez** — ~100 líneas por commit. Si un cambio es más grande,
   dividirlo. Cada paso debe poder revertirse individualmente.

5. **Ponytail: el mínimo que funciona** — subir la escalera antes de cada
   bloque de código: ya existe > stdlib > platform > dependency > una línea > mínimo.

6. **Errores colaterales se atrapan, no se ignoran** — si durante una tarea
   encontrás otro bug: rápido se arregla (<30min), lento se difiere a Backlog.
   Nunca se deja pasar sin registro.

7. **Progreso visible siempre** — después de cada paso, plan file actualizado
   + recitation. El loop nunca debe estar más de 3-5 iteraciones sin reportar
   progreso.

8. **Stagnation = Gate V** — umbral único: 2 fallas de verify con el mismo error
   (archivo+línea+mensaje) → `question` al usuario (`question-gates.md` Gate V);
   sin respuesta → STOP. No seguir dando vueltas.

9. **Presupuesto finito** — límites únicos en `BUDGET_LIMITS`
   (`campaign-server.mjs:216-222`: 10 iteraciones / 15 tool calls / 40 sub-agentes /
   5 consecutive fails / 120 min); 2 stalls consecutivos → FAILED. Pasado el tope, FAILED.

10. **Auto-mejora** — después de cada tarea, evaluar: ¿qué fue más difícil de
    lo esperado? ¿el proceso mejoró o empeoró? Actualizar discoverys en el
    proceso.

### Árbol de decisión (antes de empezar)

```
¿Querés ejecutar tareas desde un backlog?
  ├─ Sí → /pipeline plan docs/roadmap/Backlog.md
  │       (crea plan file + muestra próximo paso)
  │
  └─ No → ¿Querés definir una tarea a profundidad?
       ├─ Sí → /pipeline task CORE-NN
       │       (investiga, crea task file con steps atómicos)
       │
       └─ No → ¿Querés ejecutar un plan existente?
├─ Completo → /pipeline run (orquestador con sub-agentes, profundidad unificada)
├─ Una tarea → /pipeline run -SingleTask CORE-NN
└─ Paso a paso → /loop-goal + iter-loop-tools.md (una iteración)
```

### Relación con archivos

```
RULES.md / VISION.md          ← north star (este archivo, no se modifica)
.agents/task-system/prompts/plan.md               ← crear plan desde backlog (triage gate)
.agents/task-system/prompts/task.md               ← definir tarea a profundidad
.agents/task-system/prompts/iter-loop-tools.md    ← ejecutar una iteración del loop
.agents/commands/pipeline.md                      ← entry point: plan | task | run | interactive
.agents/task-system/prompts/pipeline-run.md       ← orquestador de backlog (sub-agentes)
.agents/task-system/prompts/pipeline-full.md      ← prompt canónico de ejecución de tarea
.agents/task-system/prompts/subagent-recovery.md  ← SARL (recovery de sub-agentes)
SKILL.md                      ← referencia completa del skill
tasks/<ID>.md               ← auto-generated task definitions (resuelve a docs/agent-ops/tasks/<ID>.md; fallback legacy .agents/skills/campaign-executor/tasks/<ID>.md)
.agents/references/           ← referencias canónicas de Ego
```

---

## Reglas Invariantes (operativas)

### 1. Un paso por turno

OpenCode opera por turnos (Request-Response). Cada invocación ejecuta
EXACTAMENTE UNA acción atómica. `/pipeline run` itera por vos con sub-agentes;
`/loop-goal` para una iteración interactiva.

### 2. Estado en archivos, no en contexto

El contexto se resetea en cada invocación. El plan file y el task file
son la única fuente de verdad. Siempre leer antes de actuar, siempre
escribir después.

### 3. La recitation es el handoff

Después de cada acción, escribir el bloque RECITATION al final del plan
file. Es lo único que persiste entre iteraciones. Sin recitation, la
próxima iteración arranca perdida.

### 4. Verificación mecánica siempre

Nunca auto-reportar "anda". Siempre ejecutar un comando real:
- `pnpm build`
- `pnpm typecheck`
- `pnpm test`
- `npx tsc --noEmit -p apps/desktop`

### TypeScript & Electron Safety Rules (Ego)

- `any` estrictamente prohibido en código de producción (`strict: true`). Si es indispensable una aserción, usar `unknown` + type guard documentado.
- Context isolation forzoso: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` en BrowserWindow.
- IPC fuertemente tipado: todas las invocaciones renderer-main deben validarse mediante contratos canónicos.
- Zero uncaught exceptions: envolver llamadas asíncronas y operaciones de filesystem o NativeVantaDB con `Result<T, E>` o bloques controlados con `EgoError`.

### Capa Determinista (barreras infranqueables)

Estas verificaciones NO se saltan bajo ninguna circunstancia:

0. **Output Validation (LLM05)**: Antes de escribir cualquier archivo que contenga shell commands, IPC handlers, HTML o file paths, validar con `task_validate_output` MCP tool. Output del agente NO es confiable — sanitizar antes de write.
1. `pnpm typecheck` (o `npx tsc --noEmit -p apps/desktop`) — cero errores de tipado
2. `pnpm build` — compilación limpia de main y renderer
3. `pnpm test` — pruebas unitarias pasan
4. Si el diff modifica IPC o preload → verificación de aislamiento de Electron
5. Si el componente es crítico (MemoryAdapter, CognitiveRuntime, ExecutionManager) → pruebas de error, timeout y abort

### 6. Versioned DoD Thresholds (ratchet — solo sube, nunca baja)

Current: **DoD v1** (baseline)
Next: bump `NEXT_DOD_VERSION` en este archivo cuando se cumplan todas las condiciones de la versión actual.

| Versión | Nuevos checks (suman a los anteriores) |
|---------|----------------------------------------|
| v1 (baseline) | Capa determinista (0-5) + Pre-commit gate (7 items) |
| v2 (coverage) | `pnpm test` con cobertura mínima 70% en módulos nuevos. Security checklist obligatorio (no condicional). |
| v3 (hardening) | Validación estricta de esquemas IPC. Auditoría de dependencias (`pnpm audit`). |
| v4 (enterprise) | 90% coverage mín. Review de contratos de IPC/Memory obligatorio antes de commit. |

Regla: **No se puede saltar una versión.** Si NEXT_DOD_VERSION = v2, todos los checks de v1 + v2 aplican. Para pasar a v3, v2 debe estar estable por 5 tareas consecutivas.

### 5. Ponytail ladder

1. ¿Ya existe en el codebase? → reusar
2. ¿Stdlib lo hace? → stdlib
3. ¿Feature nativa del platform? → usarla
4. ¿Dependency ya instalada? → usarla
5. ¿Una línea? → una línea
6. Recién acá: código mínimo que funciona

### 6. Atomicidad

Cada cambio: ~100 líneas máximo. Un paso del task file = una acción =
un commit. Si el cambio es más grande, partilo en más steps.

### 7. No cambiar scope

Si encontrás algo extra (bug no relacionado, feature faltante) durante
la ejecución: anotalo en Notas, no lo implementes. Seguí con la tarea
actual.

### 8. Sync bidireccional plan ↔ task

- Plan file y task file se referencian mutuamente
- Ambos tienen `last-synced: <fecha>`
- Después de cada acción, actualizar ambos
- El pipeline valida sync antes de cada iteración

### 9. Stagnation detection (umbral único → Gate V)

- 2 fallas de verify con el mismo error (archivo+línea+mensaje) → Gate V (`question-gates.md`): `question` al usuario; sin respuesta → STOP
- El pipeline detecta stall vía `campaign_stalled_tasks` y pregunta al usuario

### 10. Skills según tipo de tarea

| Tipo | Skills a cargar |
|------|-----------------|
| Rust | source-driven-development, campaign-executor |
| Frontend | frontend-ui-engineering |
| API pública | api-and-interface-design |
| Bug | systematic-debugging |
| Review | code-review-and-quality, doubt-driven-development |
| Docs | writing-guidelines |
| Siempre | campaign-executor, progreso, ponytail (full) |

### 10b. Bug fixes — Gate de Fase 1 (Iron Law)

Fuente: skill `systematic-debugging` — *Iron Law: no fixes sin investigación
de causa raíz primero*. El pipeline exige método correcto, no solo test verde.
Para cualquier tarea tipo `fix:` (Bug), el task file debe evidenciar la Fase 1
de debugging ANTES de implementar el fix:

| Requisito | Evidencia escrita (antes de codear) |
|-----------|--------------------------------------|
| Repro | Reproducción determinística: pasos exactos o comando que reproduce el bug |
| Hipótesis | Causa raíz probable, escrita ANTES del fix |
| 1 variable controlada | Exactamente UNA variable cambiada por intento |

**Gate:** el step de fix y sus pasos Verify solo pueden definirse tras poblar
la sección "Fase 1 — Evidencia de Debugging" del task file. Referencia del
gate: `repro|Phase 1|Iron Law`.

### 10c. Review por agente distinto (P2-01)

El REVIEW de una tarea NUNCA lo ejecuta el mismo contexto que implementó.
Para cualquier tarea (obligatorio en 🔴), el review lo hace un agente
distinto — `ego-audit` (persona leaf: `task: * deny`, no puede
implementar, solo revisa) o la persona `ego-review` / skill `review-deep`
si está disponible — cubriendo (1) enfoque y (2) cómo se probó.

- Sin review de agente distinto registrado en el task file, la tarea NO se
  marca COMPLETED aunque el contrato pase.
- Fallback si no hay agente distinto disponible: `doubt-driven-development`
  como gate mandatorio para 🔴 — verificación adversarial en contexto fresco.

### 10d. Refactor 2-sombreros — no cambia comportamiento (P3-06)

Contrato (Fowler): **un commit de refactor no cambia comportamiento.** Los
cambios de comportamiento y los de estructura van en commits distintos, con
tests verdes ENTRE ambos:

| Sombrero | Cambia comportamiento | Commit | Gate |
|----------|----------------------|--------|------|
| Comportamiento (feature/fix) | sí | `feat:` / `fix:` | tests verdes del nuevo comportamiento |
| Estructura (refactor) | no | `refactor:` | mismos tests verdes SIN tocarlos |

Gate: si un "refactor" requiere modificar tests para que pasen, entonces
cambió comportamiento — es un commit de comportamiento disfrazado. Partirlo
en dos commits (uno de comportamiento, uno de estructura).

## Apéndice A: HarnessCard (CAR Decomposition)

| Capa | Dimensión | Implementación |
|------|-----------|----------------|
| **Control** | State machine | C0 en iter-loop-tools.md: 10 estados, guards, per-state tool enforcement |
| | Budgets | 15 tool calls, 40 sub-agents, 5 fails, 120min por tarea |
| | DoD | 4 versiones ratcheted (v1 baseline → v4 enterprise) |
| | Capa determinista | 6 barreras infranqueables (clippy, fmt, tests, miri, fuzz, output validation) |
| | MoM ladder | 4 tiers (haiku → sonnet/gpt-4o → deepseek-v4 → humano) |
| | Pre-commit gate | 7 checks: DoD, security, perf, testing, ponytail, tests, docs |
| | Stagnation detection | 2 fallas mismo-error → Gate V (`question-gates.md`) |
| **Agency** | Step ordering | Task file con steps atómicos, zero-code planning antes de código |
| | File edits | ~100 líneas/commit, edit con oldString/newString |
| | Verify strategy | Mecánico (cargo, npx), Agente de Diagnóstico en falla |
| | Sub-agent spawning | `task` tool para research isolation, fork/join paralelo |
| | Self-Harness Gate | Propose → Evaluate (5 condiciones) → Accept/Reject |
| **Runtime** | Execution | MCP server (campaign-* tools), cargo-mcp, rust-analyzer-mcp |
| | Sub-agents | `task` tool, research isolation pattern, fork/join groups |
| | Sandbox | `campaign_run_sandboxed` vía PowerShell aislado |
| | Memory | `memory/lessons.md`, `memory/decisions.md` + `campaign_memory_read/write`. Esquema por línea (TSYS-15): `- <fecha-auto> | <tema> | <decisión\|lección> | ref: <ruta:línea>`; la fecha la agrega el server (`write` recibe solo `entry`); read por tema vía `rg -n <tema> .agents/task-system/memory/*.md` |
| | Tracing | JSONL events a `traces/<campaign-id>.jsonl` via tracer.mjs |
| | Plan files | `docs/agent-ops/plans/<plan>.md` + `docs/agent-ops/plans/<plan>.budget.json` |

### Rule 11 — Session lifecycle

Una tarea completa + commiteada → sesión cerrada mentalmente.
La siguiente tarea arranca con contexto fresco. No arrastres estado entre tareas.
Si necesitás continuar algo, dejalo en la recitation o en Context Save Point.

### Rule 12 — Bounded Memory (Context Budget)

Fuente: awesome-harness-engineering (OpenHands, Anthropic context engineering)

El contexto no es un dumping ground. Solo se preserva entre iteraciones:

| Qué se guarda | Qué se descarta |
|---------------|-----------------|
| Goals activos | Tool outputs cerrados |
| Progreso del step actual | Logs de builds pasados |
| Archivos críticos modificados | Diffs completos (git los tiene) |
| Tests que fallan | Mensajes de éxito |
| Recitation block | Conversación previa |

Reglas:
1. Si el contexto crece >20% del límite del modelo, usar sub-agentes vía task tool para aislar investigación
2. Antes de cada iteración, evaluar: "¿esto es necesario para el próximo paso?"
3. Useful failures se mantienen en contexto (lo que salió mal es diagnóstico, no ruido)
4. Backpressure on low-value work: si una tarea genera ruido sin progreso >3 iteraciones, abortar

### Rule 13 — 12-Factor Agents (Production Discipline)

Fuente: awesome-harness-engineering (HumanLayer: 12-Factor Agents)

| Factor | Aplicación en Campaign Executor |
|--------|---------------------------------|
| 1. Explicit prompts | Cada tarea tiene un prompt completo (plan.md, task.md, iter-loop-tools.md) |
| 2. State ownership | Plan file + task file son la única fuente de verdad. No confiar en contexto de sesión. |
| 3. Clean pause-resume | Recitation block permite retomar exactamente donde se quedó |
| 4. Logs as event streams | El pipeline emite eventos JSONL a traces/<campaign-id>.jsonl |
| 5. Disposable agents | Cada iteración arranca contexto fresco. Sin estado en memoria del agente. |
| 6. Backward compatibility | Nunca romper el formato de plan file — otros scripts lo leen |
| 7. Fail fast, fail visibly | Stagnation detection + MoM ladder. No reintentar con el mismo modelo. |
| 8. Runtime verification | campaign_verify_cmd — nunca auto-reporte |
| 9. Bounded resources | Budget: 15 tool calls, 40 sub-agents, 5 fails, 120min por tarea |
| 10. Observable | JSONL logs + correlation ID + structured recitation |

### Rule 14 — Correlation ID Tracing

Fuente: REFERENCE-SYNTHESIS.md (prioridad #1: alta)

Cada campaña genera un UUID al inicio (CampaignId). Este ID se propaga a:

| Destino | Dónde se escribe |
|---------|------------------|
| Plan file | `> **Campaign ID:** <uuid>` en el header |
| JSONL log | Cada línea: `{"event":"...", "campaign_id":"<uuid>", ...}` |
| Recitation | Bloque RECITATION en cada iteración |
| Git commits | `Campaign: <uuid>` en el footer del commit message |
| Task files | `campaign_id: <uuid>` en el header |

El correlation ID permite conectar:
- Una iteración del loop → su log JSONL → el commit → el task file
- Sin correlation ID, cada componente es un silo aislado

### Rule 15 — Bootstrap Pattern (init.sh)

Fuente: Anthropic — "Effective harnesses for long-running agents"

Cada tarea importante debería tener un `init.sh` (o `init.ps1` en Windows) que:

1. Verifica el entorno (herramientas instaladas, versiones, variables de entorno)
2. Limpia estado residual de ejecuciones anteriores
3. Prepara directorios temporales si es necesario
4. Establece el correlation ID de la ejecución
5. Imprime un resumen del estado inicial

```powershell
# Ejemplo de init.ps1 para tarea de campaña
param([string]$CampaignId)
Write-Host "=== init.ps1 — Campaign $CampaignId ==="
# 1. Verificar herramientas
@("cargo", "git", "python") | ForEach-Object {
    if (-not (Get-Command $_ -ErrorAction SilentlyContinue)) {
        Write-Error "Missing: $_"; exit 1
    }
}
# 2. Limpiar estado residual
Remove-Item -Path ".campaign/temp/*" -Recurse -ErrorAction SilentlyContinue
# 3. Correlation ID
$env:CAMPAIGN_ID = $CampaignId
Write-Host "Ready: Campaign $CampaignId"
```

Reglas:
- `init.sh`/`init.ps1` se ejecuta UNA vez al inicio de la campaña, no por iteración
- Si falla, la campaña no arranca — error es mejor que ejecución en entorno roto
- Debe ser idempotente (ejecutar dos veces no rompe nada)

### Rule 16 — While-Loop Harness (Ralph Pattern)

Fuente: Geoffrey Huntley — "Ralph Wiggum as a Software Engineer"

El patrón más simple de loop que funciona:

```bash
while :; do cat PROMPT.md | agent; done
```

En nuestro contexto (OpenCode + campaign system):

| Elemento | Cómo se aplica |
|----------|---------------|
| **PROMPT.md** | `iter-loop-tools.md` — el prompt de iteración |
| **agent** | OpenCode con los MCP tools de campaign |
| **loop externo** | `/loop-goal` (interactivo) o `pipeline-run.md` (orquestador con sub-agentes) |
| **determinismo** | Cada iteración arranca contexto fresco (Disposable Agents) |
| **handoff** | Recitation block en el plan file |

La versión Ego del while-loop:

```text
(por iteración)
  → /loop-goal "Una iteración leyendo iter-loop-tools.md"
  → Estado en plan file + recitation
  → repite hasta que todas las tareas estén ✅ o ❌
```

Este patrón es la base conceptual de todo el campaign executor — no agregar complejidad innecesaria al loop.

### Rule 17 — Lurkr Scanner (CI Gate for Agent Risks)

Fuente: [agentveil-protocol/lurkr](https://github.com/agentveil-protocol/lurkr)

El Lurkr scanner se ejecuta en CI y detecta riesgos de agentes de IA:

| Riesgo | Detecta |
|--------|---------|
| Shadow capabilities | Código no explicitado en el prompt del agente |
| Credentials en contexto LLM | API keys, tokens, secrets en archivos que el agente leería |
| eval/subprocess en @tool | Código que ejecuta comandos sin sanitización |
| Prompt interpolation directa | Strings armadas con ${} en prompts |
| MCP endpoints no verificados | Llamadas a MCP URLs sin validación |

**Gate de CI** (agregar al workflow de CI):
```yaml
- name: Lurkr scanner
  run: npx lurkr scan .agents/ --report-format json
```

Por ahora: no bloqueante, solo informativo. Cuando el ecosistema madure, el Lurkr gate será obligatorio antes de deploy.

### Rule 18 — Context Condensation (OpenHands Pattern)

Fuente: OpenHands — "Context Condensation for More Efficient AI Agents"

Entre iteraciones del loop, condensar el contexto preservando solo:

| Preservar | Descartar |
|-----------|----------|
| Goals activos | Logs de builds pasados |
| Archivos modificados en este step | Output de tool calls previas |
| Tests que fallan actualmente | Mensajes de éxito |
| Recitation block | Conversación completa previa |
| Correlation ID | Errores ya resueltos |

En la práctica:
1. El loop escribe el recitation block al final de cada iteración
2. La próxima iteración LEE el plan file + recitation — eso ES la condensación
3. No necesita lógica extra: el recitation block es nuestro mecanismo de condensación
4. Si una tarea excede 15 tool calls sin progreso, fork a sub-agente vía `task` tool para aislar investigación

Límite práctico: si el plan file supera 200 líneas, hay que archivarlo y empezar uno nuevo (clean state).

### Rule 19 — AgentKit Patterns (Event-Driven Durable Agents)

Fuente: Inngest AgentKit

Para tareas que requieren durabilidad (continuar después de crash):

| Patrón | Descripción |
|--------|-------------|
| **Workflow-aware** | Cada paso registra estado en JSON durable (`.campaign/budget.json`) |
| **Event-driven** | Las transiciones del state machine C0 son eventos |
| **Idempotency** | Cada paso puede re-ejecutarse sin side effects |
| **Retry with backoff** | Si un paso falla, esperar 2^retry segundos antes de reintentar |

No implementar como dependency — implementar como convention en el pipeline existente.
- Budget tracking via JSON es el estado durable
- C0 state machine en iter-loop-tools.md maneja transiciones
- Retry con backoff: `Start-Sleep -Seconds [Math]::Pow(2, $retryCount)`

## Apéndice B: Contenedor de tareas fallidas — Failed-task container (tasks/closed/) — TIR-04b

> Decisión 2026-08-17 (TIR-04b): formaliza el Failed-task container citado desde el plan; WONTFIT infraestructura DLQ nueva. El contenedor es `tasks/closed/` (resuelve a `docs/agent-ops/tasks/closed/`; fallback legacy `.agents/skills/campaign-executor/tasks/closed/`).

**Las 3 reglas del contenedor — Failed-task container:**

1. **Al ESCALATE (SARL nivel 4):** mover el task file a `tasks/closed/<ID>.md` (nunca borrarlo). El plan file conserva la fila ❌ FAILED + recitation.
2. **Re-procesamiento:** una tarea en `tasks/closed/` se re-abre con `task_update_state` "pending" tras revisión humana; el task file vuelve a la raíz de `tasks/` para reanudar desde el primer step ⬜ PENDING.
3. **Índice único de fallidas:** `rg "❌ FAILED" docs/agent-ops/plans/` lista todas las tareas fallidas vivas cruzando planes. Alternativa PowerShell: `Select-String -Pattern "❌ FAILED" -Path "docs/agent-ops/plans/*.md"`.

**Glosario:** `tasks/complete/` = completadas y archivadas · `tasks/closed/` = Failed-task container — fallidas que agotaron la escalera SARL y esperan decisión humana · `docs/agent-ops/plans/archive/` = planes cerrados (uno u otro estado).

