# Recitation Template — plantilla canónica única (TSYS)

> Fuente única del formato de handoff. `skills/campaign-executor/SKILL.md`
> (§Recitation block) y `task-system/prompts/pipeline-full.md` (§3 + §7) la
> referencian — no la redefinen. Dos renderizados del mismo contenido:
> legible (`=== RECITATION ===`) y schema MCP (6 claves de
> `campaign-server.mjs:673-680` — `invariants`/`debt` van DENTRO de `contract`).

## Render legible (plan file / task file)

```
=== RECITATION ===
Objetivo activo: TASK-N — ID
Estado: plan / act / verify / stall / research / collateral / evaluate / review / accept / completed / failed
Última acción: qué se acaba de hacer
Resultado: ✅ / ❌
State: ESTADO (desde: ESTADO_ANTERIOR)
Próxima acción: paso concreto (archivo + comando)
Contrato: comando de verificación exacto + resultado
Invariantes: qué NO se puede romper al continuar (o "ninguna")
Comandos de verificación: comando exacto + resultado esperado/obtenido
Deuda: pendiente al cerrar esta iteración (o "ninguna")
Próxima tarea si completa: TASK-N+1 — ID
last-synced: YYYY-MM-DDTHH:MM
=== END RECITATION ===
```

## Render MCP (`campaign_update_task_state`)

| Clave MCP | ← fuente del bloque legible |
|---|---|
| `activeGoal` | Objetivo activo |
| `lastAction` | Última acción (≈ resumen, máx ~200 tokens) |
| `result` | `OK` ↔ ✅ COMPLETED · `PARTIAL` ↔ ⏳ IN PROGRESS · `FAILED` ↔ ❌ FAILED |
| `nextAction` | Próxima acción (archivo + comando) |
| `contract` | Contrato + verificación + evidencia por claim (`claim/evidencia/confianza`) + artefactos + invariantes + deuda + queda_pendiente |
| `nextTask` | Próxima tarea si completa |

`RESULTADO` (§7 pipeline-full.md) es el resumen parseable por el orquestador:
`RESULTADO / STEPS_OK / PROXIMO_STEP / COMMIT_HASH / ARCHIVOS /
VERIFY_CONTRATO / BLOQUEO / GATES_EVALUADOS / SKILLS_CARGADAS`.
`⚠️ SIN-FORMATO` = bloque ausente o `GATES_EVALUADOS` sin motivo por gate.
