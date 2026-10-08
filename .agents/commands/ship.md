---
description: Run the pre-launch checklist via parallel fan-out to specialist personas, then synthesize a go/no-go decision with a rollback plan
---

> **ENTRY POINT — Ship Command (router)**
> El agente DEBE leer este archivo cuando el usuario envía `/ship`.
> Procedimiento canónico: `.agents/references/ship-runbook.md` (este archivo
> no lo duplica). Skill genérica upstream: `shipping-and-launch`.

Invoke the shipping-and-launch skill, siguiendo el runbook Ego
(`.agents/references/ship-runbook.md` Fases A→B→C).

> **Pre-flight:** `/audit quick` o `/audit certify` antes de `/ship`. Audit FAILED → default NO-GO.
> **Output:** siempre `docs/agent-ops/reports/ship-<timestamp>.md` + `docs/agent-ops/state/last-ship-state.json`.

1. **Fan-out** (runbook Fase A): `ego-audit` + `ego-chaos` + `ego-tuner` en
   paralelo vía `task(description, prompt, subagent_type)` en un solo turno.
2. **Merge** (runbook Fase B): el contexto principal sintetiza (no una persona).
3. **Decisión** (runbook Fase C): GO | NO-GO + blockers + rollback plan obligatorio.
4. Escribir reporte + `docs/agent-ops/state/last-ship-state.json` (requeridos por `/rollback` y `/status`).
