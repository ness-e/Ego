---
description: "Automatic rollback: recover from a failed ship or broken deployment by reverting to the last known-good state"
---

> **ENTRY POINT — Rollback Command (router)**
> El agente DEBE leer este archivo cuando el usuario envía `/rollback`.
> Procedimiento canónico: `.agents/references/ship-runbook.md` §Rollback
> (este archivo no lo duplica). Skill genérica upstream: `shipping-and-launch`
> (sección rollback).

Invoke the shipping-and-launch skill (rollback section), siguiendo el runbook
Ego (`.agents/references/ship-runbook.md` §Rollback, pasos Discover →
Preconditions → Revert → Finalize).

> **Prerrequisito:** `/ship` previo (fallback: git history).
> **Output:** `docs/agent-ops/reports/rollback-<timestamp>.md`.

Reglas: operaciones unrevertibles (pérdida de datos, migraciones destructivas)
abortan con advertencia; el plan exacto del ship manda sobre el genérico; si un
paso de Revert falla, stop inmediato y reportar hecho vs pendiente. Al cerrar:
`/status` → dashboard post-rollback.
