# C0-unified — State Machine Canónica v2 (absorbente)

> **Fuente canónica v2** (código): `.agents/task-system/C0-unified.mjs`
> Este `.md` es la vista humana. Si divergen, manda el `.mjs`
> (verificado por `.agents/task-system/config/parity-check.mjs`).
>
> **Legacy deprecated con pointer (siguen funcionando):**
> `config/state-tools.mjs` (enforcement) · `workflows/*.json` (phase templates)
> · `prompts/iter-loop-tools.md` tabla (prose) — todos apuntan acá.

## 1. Estados C0 (10) — allowed / denied

Fuente ejecutable: `STATE_TOOLS` en `C0-unified.mjs` (re-export exacto de
`config/state-tools.mjs` — cero divergencia por construcción).

| Estado | Tools permitidas | Tools denegadas | Nota |
|--------|-----------------|-----------------|------|
| PLAN | read, grep, glob, codegraph_*, codebase-memory-mcp_search_graph, codebase-memory-mcp_trace_path, codebase-memory-mcp_get_code_snippet, codebase-memory-mcp_get_architecture, codebase-memory-mcp_query_graph, codebase-memory-mcp_search_code, codebase-memory-mcp_detect_changes, codebase-memory-mcp_index_status, codebase-memory-mcp_check_index_coverage, codebase-memory-mcp_get_graph_schema, codebase-memory-mcp_list_projects, codebase-memory-mcp_index_repository, campaign_*, skill, bash, websearch, webfetch, argus_*, metasearch_* | edit, write, campaign_verify_cmd, cargo-mcp_*, rust-analyzer-mcp_* | sólo lectura e investigación |
| ACT | edit, write, bash, campaign_*, read, grep, glob, codegraph_*, codebase-memory-mcp_*, skill, cargo-mcp_*, rust-analyzer-mcp_* | delete | scope enforcement vía campaign_validate_scope; output validation vía campaign_validate_output; max 100 líneas / 5 archivos |
| VERIFY | bash, campaign_verify_cmd, campaign_*, cargo-mcp_*, read, grep | edit, write | sólo verificación — nada que cambie archivos |
| COLLATERAL | bash, read, grep, glob, codegraph_*, codebase-memory-mcp_search_graph, codebase-memory-mcp_trace_path, codebase-memory-mcp_get_code_snippet, codebase-memory-mcp_get_architecture, codebase-memory-mcp_query_graph, codebase-memory-mcp_search_code, codebase-memory-mcp_detect_changes, codebase-memory-mcp_index_status, codebase-memory-mcp_check_index_coverage, codebase-memory-mcp_get_graph_schema, codebase-memory-mcp_list_projects, codebase-memory-mcp_index_repository, campaign_* | edit, write | diagnóstico de errores colaterales |
| RESEARCH | read, grep, glob, codegraph_*, codebase-memory-mcp_search_graph, codebase-memory-mcp_trace_path, codebase-memory-mcp_get_code_snippet, codebase-memory-mcp_get_architecture, codebase-memory-mcp_query_graph, codebase-memory-mcp_search_code, codebase-memory-mcp_detect_changes, codebase-memory-mcp_index_status, codebase-memory-mcp_check_index_coverage, codebase-memory-mcp_get_graph_schema, codebase-memory-mcp_list_projects, codebase-memory-mcp_index_repository, websearch, webfetch, argus_*, metasearch_*, campaign_*, bash | edit, write | sólo investigación (bash read-only; classifyBashWrite bloquea writes) |
| EVALUATE | read, grep, codegraph_*, codebase-memory-mcp_search_graph, codebase-memory-mcp_trace_path, codebase-memory-mcp_get_code_snippet, codebase-memory-mcp_get_architecture, codebase-memory-mcp_query_graph, codebase-memory-mcp_search_code, codebase-memory-mcp_detect_changes, codebase-memory-mcp_index_status, codebase-memory-mcp_check_index_coverage, codebase-memory-mcp_get_graph_schema, codebase-memory-mcp_list_projects, codebase-memory-mcp_index_repository, campaign_* | edit, write, bash | auto-revisión cognitiva |
| REVIEW | read, grep, codegraph_*, codebase-memory-mcp_search_graph, codebase-memory-mcp_trace_path, codebase-memory-mcp_get_code_snippet, codebase-memory-mcp_get_architecture, codebase-memory-mcp_query_graph, codebase-memory-mcp_search_code, codebase-memory-mcp_detect_changes, codebase-memory-mcp_index_status, codebase-memory-mcp_check_index_coverage, codebase-memory-mcp_get_graph_schema, codebase-memory-mcp_list_projects, codebase-memory-mcp_index_repository, campaign_*, skill | edit, write, bash | revisión de código, sin cambios (agente DISTINTO, P2-01) |
| ACCEPT | campaign_*, skill, read, bash | edit, write | aceptación, no implementación |
| CLOSE | bash, campaign_*, skill, read | edit, write | commit y cierre |
| STALL | campaign_*, read | edit, write, bash, cargo-mcp_* | bloqueado — sólo lectura y reporte |

> **CBM:** los estados read-only listan el subset de lectura + mantenimiento (sin `delete_project`/`manage_adr`/`ingest_traces`); ACT usa la familia completa (`codebase-memory-mcp_*`).

Antes de cada tool call: `campaign_validate_action` / `campaign_enforce_state`.
En ACT antes de edit/write: `campaign_validate_scope` (Regla 0) +
`campaign_validate_output` (LLM05). En VERIFY: `allowed_commands` + `blocked_env`.

## 2. Transiciones + guardas (Statewright pattern)

```
PLAN     → ACT
ACT      → VERIFY
VERIFY   → PLAN      (falló → reintentar)
VERIFY   → STALL     (2 same-error → Gate V)
VERIFY   → COLLATERAL (pasó → errores colaterales)
COLLATERAL → RESEARCH (ambigüedad → investigar)
RESEARCH → ACT       (investigado → implementar)
COLLATERAL → EVALUATE (sin errores → evaluar)
EVALUATE → REVIEW    (auto-evaluación pasa → revisión)
EVALUATE → ACT       (auto-evaluación falla → re-implementar)
REVIEW   → VERIFY    (review encuentra issues → re-verificar)
REVIEW   → ACCEPT    (review pasa → aceptar)
ACCEPT   → CLOSE     (aceptado → commit)
```

Inválidas: `PLAN→EVALUATE` (no implementado) · `ACT→ACCEPT` (no verificado) ·
`ACT→CLOSE` (no revisado) · `ACT→REVIEW` (no evaluado).

Guardas: `VERIFY→STALL` solo con 2 fallas verify MISMO error
(archivo+línea+mensaje) → Gate V. `VERIFY→PLAN` con Agente de Diagnóstico
(causa raíz sintetizada, no error crudo). Evaluator-optimizer máx 2 iteraciones.

## 3. Instrucciones por tipo (phase templates — guía, NO enforcement)

Los estados de fase (`localizing`/`spec`/`audit`/`scoping`/`diagnose`…)
**NO pasan por `campaign_enforce_state`**. Son classification-output:
dicen QUÉ fases aplicar y en qué orden; las tools permitidas las define
siempre la C0 genérica (§1). Detalle ejecutable: `TYPE_PROFILES` en
`C0-unified.mjs` (espejo de `workflows/*.json`).

| Tipo | Fase inicial | Fases | Instrucción inicial |
|------|-------------|-------|---------------------|
| bug-fix | localizing | localizing → planning → implementing → testing → review → accept → close | grep + extract: captura file/line scope del bug en recitation; no editar aún en planning |
| feature-add | spec | spec → implement → verify → review → accept → close | codegraph_* + codebase-memory-mcp_* (code intelligence) + define API boundary (tipos/traits/firmas); spec-first gate sin `## Spec` llena no hay ACT |
| refactor | audit | audit → migrate → cleanup → verify → review → accept → close | blast radius (callers/callees/impls) + lista de archivos; migrar 1 call-site por vez + `cargo check` |
| research | scoping | scoping → searching → extracting → synthesizing → verifying → review → accept → close | 3-5 sub-queries; no buscar aún; citas verificables (Gate CITAS TSYS-13) |
| nine-second-saloon | diagnose | diagnose → investigate → propose_fix → approve_fix → execute_fix → verify → review → accept → close | read-only hasta approval humana; fix seguro/específico/reversible |

## 4. Límites BUDGET_LIMITS (espejo — enforcer: campaign-server.mjs)

| Control | Límite | Comportamiento |
|---------|--------|----------------|
| maxIterations | 10 | Al alcanzar → ❌ FAILED |
| maxToolCalls | 15 | campaign_verify_cmd rechaza |
| maxSubAgents | 40 | HARD STOP + reporte parcial |
| maxConsecutiveFails | 5 | FAIL_MODE pasa a "stop" |
| maxDurationMinutes | 120 | Budget expired → ❌ |
| Stagnation (Gate V) | 2 fallas mismo-error | question + campaign_stalled_tasks + STOP sin respuesta |

Si esta tabla diverge del server, manda el server; corregir acá.

## 5. DoD (contrato multi-nivel)

- **Task:** contrato verificable del task file + capa determinista + tests del cambio.
- **Commit:** atómico (~100 líneas), conventional commit, diff limpio, verificación mecánica.
- **Release:** `dev-tools/verify.ps1` completo, changelog, semver, pre-push gate.
- **Ratchet:** `accept` lee `dod_version`: V1 (contrato/output/blast-radius/deuda/docs)
  → V2 (+ponytail-review, +test-coverage) → V3 (+no secrets, +conventional-commit).

## 6. Gates D / V / C (+ P contexto)

- **D (Discovery):** tras zero-code planning, antes del task file. Dispara con
  blast radius >10 / hot path / API pública / símbolos públicos nuevos /
  contrato ambiguo / feature-add sin spec → `question` (GO/ajustar/dividir).
- **V (Verify×2):** 2 fallas verify mismo error → `question` obligatoria
  (fresh / estrategia / FAILED); sin respuesta → STOP.
- **C (Cierre):** antes del commit. Colaterales <30min inline, resto `FIND-*`;
  `git status` fuera de blast radius se deja sin commit; pregunta solo en
  seguridad/cierre de campaña.
- **P (Plan):** triage en plan.md — contexto, no lo evalúa el loop.

Registro obligatorio: `GATES_EVALUADOS: P:… D:… V:… C:… | motivos ≤6 palabras`.

## 7. Flag v2 + migración legacy→v2

- Sin flag → comportamiento legacy exacto (enforce_state inalterado).
- `campaign_get_workflow(name, {unified:true})` y
  `campaign_classify_workflow(…, {unified:true})` devuelven además `unified`
  (perfil §1-§6 + `canonical` + `deprecated`) sin quitar campos legacy.
- Global: `C0_V2=1` activa el perfil unificado por defecto.
- Sunset: cuando parity lleve 30 días en verde, los `.json` pasan a
  generarse desde `TYPE_PROFILES` (no a mano). Hasta entonces: JSON a mano +
  parity que compara instructions iniciales.

## 8. Verificación

```bash
node --check .agents/task-system/C0-unified.mjs
node .agents/task-system/config/parity-check.mjs   # 10/10 en .mjs + .md + SKILL.md
rg -n "C0-unified" .agents/task-system --max-count=2
node --test .agents/task-system/mcp/
```
