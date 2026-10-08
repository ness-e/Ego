# Ship / Rollback Runbook — procedimiento canónico Ego

> Fuente única del procedimiento de `/ship` y `/rollback`. Los commands
> `.agents/commands/ship.md` y `rollback.md` son routers delgados — no duplicar
> fases acá y allá. Skill genérica upstream: `shipping-and-launch` (checklists
> genéricos web); este runbook es la adaptación Ego (gates mecánicos Rust,
> thresholds `canonical_p99`, OIDC tokenless). Tablas de release/rollout:
> `agents/ego-lead.md` §§2a–2b (fuente de thresholds y plantillas).

## Pre-flight (obligatorio)

`/audit quick` o `/audit certify` antes de `/ship`. Audit FAILED → default NO-GO.

## Fase A — Parallel fan-out

Tres subagentes en paralelo vía `task(description, prompt, subagent_type)` de
OpenCode — las 3 llamadas en un solo turno:

1. **`ego-audit`** — security + memory-safety: bloques `unsafe`, fronteras FFI,
   `cargo audit`/`deny`, supply chain. Sin review funcional (va en Fase B).
2. **`ego-chaos`** — coverage + resiliencia: gaps de fuzzing/chaos, edge cases,
   races, concurrencia. Output: análisis + tests recomendados.
3. **`ego-tuner`** — performance + observabilidad: RED metrics en endpoints
   nuevos, regresión de benchmarks en hot paths (`canonical_p99` before/after),
   tamaño binario, backpressure.

Sin `task` disponible: secuencial, el merge igual funciona.

## Fase B — Merge (contexto principal, ninguna persona)

1. **Code Quality** — Critical/Important de `ego-audit` + tests/lint/build.
   Deduplicar. Five-axis funcional acá (correctness, readability, architecture).
2. **Security** — Critical/High de `ego-audit` = blockers.
3. **Performance** — de `ego-tuner`; Core Web Vitals si aplica.
4. **Accessibility** — keyboard, screen reader, contraste (checklist propia).
5. **Infrastructure** — env vars, migraciones, monitoring, feature flags.
6. **Documentation** — README, ADRs, changelog.

## Fase C — Decisión + rollback obligatorio

```markdown
## Ship Decision: GO | NO-GO
### Blockers (must fix) — [persona origen: finding Critical + file:line]
### Recommended fixes — [persona origen: Important + file:line]
### Acknowledged risks — [riesgo + mitigación]
### Rollback plan — triggers, procedimiento exacto, RTO, SHA previo
### Specialist reports (full) — ego-audit, ego-chaos, ego-tuner
```

Escribir siempre: `docs/agent-ops/reports/ship-<timestamp>.md` +
`docs/agent-ops/state/last-ship-state.json` (`timestamp, decision, sha_shipped,
previous_sha, rollback_plan, trigger_conditions`).

## Reglas

1. Fan-out en paralelo, nunca secuencial. Personas no se llaman entre sí.
2. Rollback plan obligatorio antes de cualquier GO.
3. Critical de cualquier persona → default NO-GO salvo aceptación explícita.
4. Skip fan-out solo si: ≤2 archivos Y diff <50 líneas Y no toca
   auth/pagos/datos/config-env. Default: fan-out.

## Rollback (post-ship fallido)

Prerrequisito: `/ship` previo (fallback: git history).

1. **Discover** — último `docs/agent-ops/reports/ship-*.md` + `docs/agent-ops/state/last-ship-state.json`
   + `git log --oneline -20 --grep:"ship:"`. Identificar SHA shippeado, rollback
   plan, triggers cumplidos, flags/migraciones aplicadas.
2. **Preconditions** — working tree limpio (`git status --porcelain`, si no:
   stash o abortar). Target SHA del plan o elegido por usuario.
   `git merge-base --is-ancestor <target> HEAD` debe dar 0.
   **Unrevertible check:** migraciones destructivas (DROP/DELETE sin WHERE) →
   abortar, intervención manual.
3. **Revert** — `git revert --no-commit <target>..HEAD` (conflicto → `git merge
   --abort` + reportar). Revertir flags/env/configs. Rollback de migraciones si
   existe. Compilar+testear (`just verify` o `just verify-quick`); si falla →
   `git reset --hard HEAD` + reportar.
4. **Finalize** — `git commit -m "rollback: revert <desc>"`. Health check.
   Reporte `docs/agent-ops/reports/rollback-<timestamp>.md` (causa, SHAs,
   lecciones, link al ship). Si el plan del ship daba pasos exactos, esos mandan
   sobre este procedimiento genérico.
