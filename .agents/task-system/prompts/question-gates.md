> **CANONICAL SPEC — Question Gates HITL (fuente única, TSYS-H7)**
> Referenciado por: plan.md (Gate P) · pipeline-full.md / iter-loop-tools.md (Gates D/V/C)
> · pipeline-run.md · subagent-recovery.md. Los prompts REFERENCIAN este archivo;
> nunca lo redefinen. Si este archivo cambia, los gates cambian en un solo lugar.

# Question Gates — control del usuario vía `question` tool

## Principios

1. Las questions SIEMPRE llevan opciones concretas + default recomendado
   (`(Recomendado)` primero en la lista). Nunca preguntas abiertas sin contexto.
2. El resultado de cada gate se registra en la recitation (`contract` o
   `lastAction`) y, si cambia dirección, vía `campaign_emit_event` con
   `decision_reason` (queda en el trace log).
3. Máximo 1 ronda de questions por gate por tarea (el usuario ya decidió; no
   re-preguntar lo decidido salvo que el código contradiga la decisión).
4. Si el harness no expone `question`, fallback: reporte estructurado y STOP
   esperando input del usuario (nunca asumir GO).
5. **Cero Asunciones Silenciosas (Zero Silent Assumptions):** Si una instrucción
   carece de contexto, tiene múltiples interpretaciones, o deja decisiones
   técnicas/de producto abiertas (nombres de API, flujos de error, dependencias,
   persistencia, contratos de interfaz), el agente DEBE investigar y formular
   preguntas estructuradas al desarrollador. Prohibido asumir silenciosamente un
   camino sin validarlo.
6. **Valor Pedagógico y Estratégico:** Cada pregunta debe formularse con contexto
   técnico claro, exponiendo alternativas reales con pros y contras. El objetivo es
   asegurar la participación activa del desarrollador, fomentar decisiones conscientes
   y alinear la evolución del producto con su visión estratégica.

## Routing de questions (quién pregunta)

| Contexto | Cómo se pregunta |
|---|---|
| Orquestador (`/pipeline`, `/pipeline run`, ego-lead) | Directo vía `ask_question` / `question` tool |
| Sub-agente CON `question` en permissions (hoy: solo ego-lead, ego-review) | Directo |
| Sub-agente SIN `question` (worker/arch/engine/audit/chaos/tuner/docs/research) | Devolver bloque `RESULTADO` con `BLOQUEO: <gate + opciones>` — **el orquestador hace la pregunta** al recibirlo y reanuda vía SARL con la respuesta. El sub-agente NUNCA asume GO. |

> Estado 2026-08-23 verificado con grep sobre `.agents/agents/*.md`: solo
> ego-lead y ego-review referencian `question`. Al dar `question` a más
> agentes (TSYS-11), actualizar esta tabla.

## Gate P — Plan/Triage (en plan.md)

**Cuándo:** durante el triage del backlog, ANTES de fijar el gate final.

| Disparador | Question |
|---|---|
| **Decisiones no declaradas o arquitectura abierta** | Investigar el alcance del plan e interrogar al usuario sobre bifurcaciones arquitectónicas, bibliotecas a utilizar o trade-offs de diseño. |
| **Instrucciones o requerimientos ambiguos** (≥2 interpretaciones) | Mostrar las interpretaciones viables con pros/contras y pedir elección antes de congelar el plan. |
| Tarea prioridad 🔴 | Confirmar inclusión/scope: opciones GO (como está) / Ajustar scope / DEFER / SKIP |
| **Agrega símbolos/contratos públicos nuevos** (`pub fn`/struct público, tool MCP, endpoint HTTP/CLI, método de binding PyO3/WASM/TS/NAPI, componente consumible) | Tratar como feature-add: mini-spec con `prompts/spec-template.md` §5 → decisiones abiertas al usuario (una ronda, opciones + default recomendado) ANTES de aprobar DO. |
| feature-add o lógica nueva | **Spec-driven guiado**: generar mini-spec con `prompts/spec-template.md` → preguntar al usuario las decisiones abiertas de §5 (una ronda, opciones + default recomendado) ANTES de aprobar DO. |
| Resumen final del triage | Confirmar el set DEFER/SKIP completo antes de escribir el plan file. |

## Gate D — Discovery (en pipeline-full.md §Discovery, iter-loop-tools MODO DISCOVERY)

**Cuándo:** tras zero-code planning, ANTES de escribir el task file y ANTES de pasar a `ACT`.

| Disparador | Question |
|---|---|
| **Toda decisión de implementación no declarada en el contrato** | Relevar parámetros, tipos de datos, política de reintentos, comportamiento ante errores y nombres de funciones → preguntar con alternativas y `(Recomendado)`. |
| **Instrucción o caso borde ambiguo descubierto en código** | Detenerse y presentar los caminos técnicos posibles con sus trade-offs para que el usuario decida conscientemente. |
| Blast radius > 10 archivos o toca hot path/WAL/API pública | Mostrar blast radius resumido + approach propuesto → GO / ajustar / dividir en tareas. |
| **El plan de solución agrega símbolos/contratos públicos nuevos** | Confirmar diseño de la superficie pública (nombres, firmas, semántica de error) → GO / ajustar. |
| Tarea feature-add/lógica nueva sin mini-spec | Generar mini-spec y confirmar criterio de aceptación con el usuario. |

## Contenido válido de `## Spec` (definición canónica del gate mecánico spec-first)

Una sección `## Spec` en el task file cuenta como **LLENA** solo si cumple UNO de:

1. **Tabla de decisiones** (spec-template.md §5): ≥1 fila con ≥2 alternativas reales
   + tradeoff de una línea + default recomendado (+ columna `Resuelto` si pasó por
   `question`), O
2. **Justificación por evidencia por ítem**: cada decisión técnica marcada
   `✅ decidido-por-evidencia (ref: archivo:línea | doc oficial)` — un solo camino
   viable también se registra, nunca se omite.

❌ **NO válida:** `N/A`, vacía, o solo "contrato mecánico" sin las decisiones.
**Excepción única:** tarea 100% docs/markdown sin decisiones técnicas → escribir
`sin decisiones técnicas` + lista de archivos tocados (verificable).

**Verificación del gate (quien ejecuta ACT y quien revisa):** antes de entrar a ACT,
leer la `## Spec` y validar contra esta definición. Si es inválida → volver a
DISCOVERY (generar spec + questions). En review (P2-01), el revisor chequea que la
spec existente cumpla esta definición — un `N/A` en una tarea con símbolos públicos
nuevos es hallazgo bloqueante.

## Gate V — Verify-falla×2 (en pipeline-full.md, subagent-recovery.md)

**Cuándo:** se alcanzó el umbral único de **2 fallas de verify con el mismo error**
(archivo+línea+mensaje). Reemplaza el escalate-a-humano silencioso.

Question obligatoria con evidencia: los 2 errores, qué intentos hubo, opciones:
1. Reintentar con contexto fresco (RETRY, consume budget)
2. Cambiar de estrategia (STRATEGY — describí la alternativa propuesta)
3. Marcar ❌ FAILED y pasar a la siguiente (FAIL_MODE aplica)

Sin respuesta → STOP (no marcar FAILED unilateralmente salvo FAIL_MODE=stop explícito).

## Gate C — Cierre (en pipeline-full.md MODO CIERRE)

**Cuándo:** durante el cierre, antes del commit final.

| Disparador | Question |
|---|---|
| Errores colaterales encontrados | Arreglar ahora (<30min, mismo archivo) / incluir en este commit — el ticket derivado ya existe como fila `FIND-*` en Backlog si no se arregló inline (`prompts/findings.md`, fuente única) |
| `git status` muestra archivos FUERA del blast radius declarado | Incluirlos en el commit / dejarlos sin commit (staged aparte) / investigar origen |
| Plan completado (cierre de campaña) | Confirmar archivado del plan y migración masiva a progreso |
| **Cierre de tarea → ACCEPT mecanizado (HARD-07)** | NO es question: es enforcement. `campaign_update_task_state(completed)` exige payload `review` válido (`validateReviewAccept`, `.agents/task-system/config/state-tools.mjs`): `mode:'fresh'` con `reviewer_context ≠ author_context` + `verdict:'approve'`, o `mode:'degraded'` + `waiver {owner, ref}` (registro trace/decisions). Sin payload → `updated:false` (`reviewBlocked:true`). Waiver degradado = decisión owner registrada, nunca auto-waiver |

## Gate H — Harness (cambios en `.agents/`)

**Cuándo:** el diff toca `commands/`, `agents/`, `skills/`, `task-system/prompts/`,
`rules/`, `references/`, `plugins/` o `mcp-profiles/`.

| Disparador | Acción |
|---|---|
| Cualquier cambio en `.agents/` | `/harness` en verde (vía `ego-harness`) antes del commit del harness |
| `/harness` 🔴 con hallazgos ≥ medium | Filas `FIND-*` + fix en el mismo PR del harness, no "después" |
| Eval de agentes con regresión (`python evals/agent/run_eval.py` ≠ 10/10 en L9 de `/audit full`) | NO-GO: no se mergea ni shippea hasta 10/10 en main (FIND-151) |
| Lurkr con hallazgos nuevos sobre baseline (tras 2026-10-08, `--fail-on high`) | Bloquea build: triajear (FP → baseline con justificación, real → fix) |

Quien vigila al harness es `ego-harness` (leaf, nunca el implementador del cambio). El ACCEPT de la tarea del harness también pasa por el gate mecanizado HARD-07 (payload `review` obligatorio para `completed` — ver Gate C). **Rollout HARD-07:** el enforcement vive en `campaign-server.mjs` y el proceso MCP en ejecución mantiene el código previo — activa al reiniciar el proceso (las sesiones abiertas no quedan protegidas hasta entonces).

## Anti-abuso y Límites de Supresión

- Los gates NO aplican a cambios sintácticos puramente mecánicos (formateo, typos en comentarios, bumps de versión menores).
- Una familia aprobada explícitamente por el usuario en esta sesión (mismo plan,
  mismo objetivo) suprime Gate P/D individual solo para tareas de
  fix/test/docs/refactor estrictamente acotadas y sin decisiones abiertas.
- **Excepción Innegociable (Zero Silent Assumptions):** Si cualquier tarea (incluyendo fix, refactor o test)
  descubre decisiones no declaradas en el contrato, ambigüedades en cómo resolver el problema,
  o bifurcaciones entre enfoques técnicos viables, **Gate D NO se suprime bajo ninguna circunstancia**.
  El agente debe formular la pregunta con opciones antes de escribir código.
- Las tareas **feature-add o con símbolos públicos nuevos** dentro de una familia
  aprobada SÍ disparan **UNA `question` batched de confirmación de spec** (1 ronda,
  todas las decisiones abiertas juntas, opciones + default recomendado) antes de
  ACT. Racional: la aprobación del plan cubre el QUÉ de cada tarea; la spec de una
  feature nueva define el CÓMO técnico, que el plan no detalla.
- Si el plan file declara `> **Autonomous:** true`, la autonomía cubre la ejecución mecánica,
  pero **cualquier decisión no declarada o ambigüedad arquitectónica sigue requiriendo confirmación**
  para evitar desvíos silenciosos del producto.


## Non-stop / run defaults (D12)

`/pipeline run` opera non-stop con defaults seguros + log estructurado:
- **Gate D crítico → `question`** (blast radius >10 / hot path / API pública / contrato ambiguo / símbolos públicos nuevos → GO / ajustar / dividir). D no-crítico (🟢 trivial, contrato mecánico) no pregunta.
- **Gate V → `question` obligatoria** (2 fallas verify mismo-error → reintentar fresh / cambiar estrategia / FAILED; sin respuesta → STOP).
- **Gate C → auto+log** (colaterales <30min mismo archivo se arreglan inline, resto ticket `FIND-*`; `git status` fuera de blast radius se deja sin commit salvo decisión; cierre de campaña confirma archivado). Solo pregunta en casos de seguridad (archivos fuera de blast radius) o cierre de campaña.
- Todo default aplicado queda en recitation + `GATES_EVALUADOS` (audit trail); el orquestador no re-pregunta lo ya decidido.

## Registro obligatorio de gates (`gates_evaluados` — auditable)

Todo bloque RESULTADO (pipeline-full.md §7, subagent-recovery.md §4) incluye la línea:

```
GATES_EVALUADOS: P:<no|disparado> D:<no|disparado> V:<no|disparado> C:<no|disparado> | <motivo por gate, ≤6 palabras>
```

Ejemplo: `GATES_EVALUADOS: P:no(familia aprobada) D:no(fix 🟢 blast radius 3) V:no C:si→colaterales resueltos inline`

Reglas del orquestador al recibir el bloque:
1. **Campo ausente o sin motivo** en un gate no-disparado → tratar como
   `⚠️ SIN-FORMATO` y re-invocar pidiendo el campo (RESUME, nivel 1 SARL).
2. Un gate marcado `disparado` debe corresponder con un `BLOQUEO:` relevado,
   una `question` registrada en recitation, o su respuesta documentada.
   Discrepancia → re-invocar con feedback.
3. El campo se persiste en la recitation (`contract.queda_pendiente` o trace) —
   queda como audit trail de que los gates se evaluaron, no solo ejecutados.

Esto convierte los gates de "criterio del sub-agente" a "checklist verificable":
el sub-agente debe demostrar que LOS EVALUÓ aunque no dispararan ninguno.
