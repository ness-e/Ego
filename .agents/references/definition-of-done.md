# Definition of Done

A standing, project-wide bar that every change must clear before it counts as done. Unlike acceptance criteria, which vary per task and answer "did we build the right thing?", the Definition of Done is the same every time and answers "is this finished to our standard?". Use it as the final gate in `planning-and-task-breakdown`, `incremental-implementation`, and `shipping-and-launch`.

## Definition of Done vs. Acceptance Criteria

| | Acceptance Criteria | Definition of Done |
|---|---|---|
| Scope | Specific to one task or spec | Applies to every increment |
| Changes | Different for each item | Fixed and reused |
| Answers | "Did we build *this thing*?" | "Is it *ready*?" |
| Owner | Defined when planning the task | Defined once for the project |
| Example | "User can reset password via email link" | "Tests pass, no regressions, docs updated" |

The two are complementary. A task is done only when **its** acceptance criteria are met **and** the standing Definition of Done is satisfied. Skipping either leaves work that looks finished but is not.

## The Standing Checklist

Apply this to every change before declaring it done.

### Correctness
- [ ] All acceptance criteria for the task are met
- [ ] Code runs and behaves as intended, verified at runtime, not just compiled or typechecked
- [ ] New behavior is covered by tests that fail without the change and pass with it
- [ ] Existing tests still pass; no regressions introduced
- [ ] Edge cases and error paths are handled, not just the happy path

### Quality
- [ ] Code reveals intent through naming and structure; no comments needed to explain *what* it does
- [ ] No duplicated business logic
- [ ] No dead code, debug output, or commented-out blocks left behind
- [ ] Changes are scoped to the task; no unrelated refactors snuck in
- [ ] Linting and formatting pass

The depth behind these items lives in `code-review-and-quality` (the five-axis review) and `code-simplification` (reducing complexity without changing behavior).

### Integration
- [ ] Change works with the rest of the system, not just in isolation
- [ ] Database migrations, config changes, and feature flags are accounted for
- [ ] Backward compatibility considered for any public interface or API change

### Documentation
- [ ] Public interfaces, APIs, and user-facing behavior are documented
- [ ] Architectural decisions worth preserving are recorded (see `documentation-and-adrs`)
- [ ] Documentation describes the current state in timeless language, not the change history

### Ship-readiness
- [ ] Security implications reviewed for any untrusted input, auth, or data handling (see `security-and-hardening`)
- [ ] Observability in place for new critical paths (logs, metrics, traces) (see `observability-and-instrumentation`)
- [ ] Rollback path exists for anything risky (see `shipping-and-launch`)
- [ ] rollback plan declared explicitly in the task file for features touching production or risky paths (concrete `git revert` steps or a flag-off), with feature flags in place when gradual deployment is required
- [ ] The human has reviewed and approved before merge or deploy

## How to Apply

- **Per task**: confirm the Correctness and Quality sections before checking the task off.
- **Per feature**: confirm Integration and Documentation before considering the feature complete.
- **Per release**: the full checklist is the floor; `shipping-and-launch` adds the deploy-specific gates on top.
- **Per release — post-release**: after releasing, verify in production that the release broke nothing before closing the iteration.
- **Per release — monitoring**: monitor logs, metrics, and error rates as part of that post-release verification.

Tailor the list to the project once, then reuse it unchanged. A Definition of Done that is renegotiated every sprint is not a Definition of Done.

## Red Flags

- "It's done, I just haven't run it yet": unverified work is not done.
- "Tests pass" used as a synonym for done while docs, regressions, or runtime verification are skipped.
- A different bar applied depending on deadline pressure.
- Acceptance criteria treated as the whole bar, with no standing quality floor.
- "Done" declared before human review on changes that need it.

---

# Ego — Definition of Ready (DoR)

Applicable to every item admitted to the active backlog (`docs/roadmap/Backlog.md` or `docs/review/backlog-*.md`). An item is ready to be picked up only when all of the following hold:

- [ ] Row uses the canonical 10-column schema (`.agents/references/backlog-format.md`): `ID | Severidad | Hallazgo | Archivo:línea | Esfuerzo | Prioridad | Estado | Descripción | Relaciones | Dependencias`
- [ ] Unique ID assigned (e.g. `CORE-01`, `ACT-04`, `HERM-03`)
- [ ] Priority defined (`🔴 P0` · `🟠 P1` · `🟡 P2` · `🔵 P3` · `⬜ Sin priorizar`)
- [ ] Involved files / target path known (`Archivo:línea`)
- [ ] Effort estimated
- [ ] Relations / dependencies declared (`Relaciones` / `Dependencias`)
- [ ] Verified against real code and codebase contracts (not assumed)

# Ego — Project-specific DoD & Verification Commands

The standing checklist above applies to every change. Ego additionally requires these concrete quality commands to pass (verified via `.agents/dev-tools/verify.ps1` and `.agents/dev-tools/floor-guard.ps1`):

- [ ] Code compiles and typechecks strictly across workspace: `pnpm -r exec tsc --noEmit` or `pwsh .agents/dev-tools/verify.ps1`
- [ ] Electron desktop build succeeds: `pnpm --filter @ego/desktop build`
- [ ] Tests pass without regressions: `pnpm test` (or task-scoped test suite)
- [ ] Floor Guard clean: `pwsh .agents/dev-tools/floor-guard.ps1` (5 minimum floor checks pass)
- [ ] Architectural guardrails respected (`AGENTS.md` §4: VantaDB via `EgoMemoryAdapter`, no direct VantaDB in renderer, no SQLite, no Next.js in desktop)
- [ ] Documentation updated if public interfaces, IPC channels or schema changed
- [ ] Task synchronized atomically across all files via `task_update_state` (`Backlog.md`, task file, plan, reports)

# Ego — Protocolo de Veredicto de Descarte Justificado en Compuertas

Cuando una tarea corresponde a una compuerta de inspección o extracción (`docs/review/backlog-*.md` o `GATES: <ID>`):
- **Criterio de Descarte:** Si el análisis concluye que el patrón no aplica a Ego (por violar guardrails de `AGENTS.md`, depender de SQLite/Python o introducir sobreingeniería innecesaria), se emite un **Veredicto de Descarte Justificado**.
- **Estado Asignado:** `🚫 Descartada: <Fundamento técnico>`
- **Cumplimiento de Gate:** El descarte justificado **satisface formalmente la compuerta** sin requerir implementación de código ni creación de tests vacíos.
- **Registro:** Se documenta en la celda de estado del backlog correspondiente y se genera la sección `## Veredicto de Descarte Justificado` en el task file, liberando las tareas dependientes downstream de manera inmediata y limpia.

# Ego — Feature Shippable Checklist

Aplica como compuerta de integración a ramas principales, además del standing checklist:

- [ ] **(a) Tests funcionales & unitarios** — tests que demuestran la funcionalidad y cubren casos de error
- [ ] **(b) Documentación canónica** — especificación técnica, tipos en preload/IPC y referencias sincronizadas
- [ ] **(c) Observabilidad & Explicabilidad** — eventos tipados en el Event Bus (`EgoEvent`) y trazabilidad de turnos
- [ ] **(d) Resiliencia & Rollback** — capacidad de revertir de forma atómica (`git revert`) sin corrupción de base de datos
- [ ] **(e) Sin deuda técnica oculta** — cero `any` injustificados, cero stubs ciegos sin registrar en Backlog
