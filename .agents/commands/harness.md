---
description: "Salud del harness: audita .agents/ (commands, agents, skills, prompts, rules) sin modificar producto"
---

> **ENTRY POINT — Harness Command (router)**
> El agente DEBE leer este archivo cuando el usuario envía `/harness`.
> Cierra el loop "quién vigila al harness" (Gate H en `.agents/task-system/prompts/question-gates.md`).

1. Delegar a `harness` (o `ego-harness`) con el scope: diff actual en `.agents/`
   (`git diff --name-only HEAD`, fallback `HEAD~1`) o auditoría completa si no hay diff.
2. El subagente aplica sus checks y devuelve veredicto ✅/🔴 con evidencias.
3. Hallazgos ≥ medium → filas **FIND-\*** en `docs/roadmap/Backlog.md` (esquema canónico de 10 columnas: `.agents/references/backlog-format.md`)
   (esquema `.agents/task-system/prompts/findings.md`, `Origen: /harness <fecha>`).
4. Reporte: `docs/agent-ops/reviews/harness-<YYYYMMDD>-<HHMMSS>.md` + fila en
   `docs/agent-ops/reports/INDEX.md`.

## Notas de herramientas

- `actionlint`: lint de workflows CI/CD.
- `typos`: Fast Gate para ortografía y typos en documentación y código.
- Rotación de lastre: `.agents/task-system/memory/ROTATION.md` (cubre sessions TTL + verify-log).

## SAST versionado

- **semgrep** + **ast-grep**
- **Gate canónico (warn mode, raíz host):**
  `semgrep --config .agents/configs/semgrep-ego.yml --error --severity ERROR --metrics=off .`
- **ast-grep:** `ast-grep scan --config .agents/configs/sgconfig.yml`
- **MCP:** server `semgrep` en configuración MCP (deshabilitado por default; activar por perfil).
