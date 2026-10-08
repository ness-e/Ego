# USAGE — Review Deep: Cómo ejecutar

## Comando único (un módulo)

```bash
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=Ego-sdk" "DEPTH=full"
```

Para revisión rápida (sin web research ni competitor):

```bash
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=Ego-sdk" "DEPTH=quick"
```

## Todos los módulos en orden (Wave por Wave)

Los módulos se ejecutan en 7 waves, de mayor a menor impacto:

```bash
# Wave 0 — Core crítico
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=Ego-sdk" "DEPTH=full"
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=Ego-engine" "DEPTH=full"
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=Ego-wal" "DEPTH=full"

# Wave 1 — Indexación
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=Ego-vector" "DEPTH=full"
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=Ego-index" "DEPTH=full"

# Wave 2 — Gobernanza
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=Ego-governance" "DEPTH=full"

# Wave 3 — SDKs
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=Ego-python" "DEPTH=full"
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=Ego-ts" "DEPTH=full"
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=Ego-wasm" "DEPTH=full"

# Wave 4 — Infra
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=Ego-server" "DEPTH=full"
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=Ego-mcp" "DEPTH=full"

# Wave 5 — Adaptadores (paralelizable con FAIL_MODE=parallel)
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=Ego-openai" "DEPTH=quick"
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=Ego-ollama" "DEPTH=quick"
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=Ego-litellm" "DEPTH=quick"
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=Ego-mem0" "DEPTH=quick"
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=Ego-letta" "DEPTH=quick"
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=Ego-crewai" "DEPTH=quick"
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=Ego-dspy" "DEPTH=quick"
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=Ego-haystack" "DEPTH=quick"
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=Ego-langchain" "DEPTH=quick"
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=Ego-llamaindex" "DEPTH=quick"

# Wave 6 — Utils
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=Ego-crypto" "DEPTH=full"
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=Ego-cli" "DEPTH=full"
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=Ego-enterprise" "DEPTH=quick"
```

## Batch mode para una wave completa

```bash
/pipeline run -PlanFile docs/dev/plans/review-deep-wave0.md
```

Primero creá un plan file con los módulos de la wave (formato de campaign-executor).

## Lo que hace internamente por módulo

```
1. Mapea estructura con codegraph (callers, callees, API surface)
2. Corre tools: cargo check, clippy, machete, outdated, audit, deny
3. Escanea patrones: expect, unwrap, unsafe, todo, clone, lock
4. Review manual asistido: errores, performance, concurrencia, seguridad, arquitectura, testing
5. (full) Investiga cada hallazgo en internet
6. (full) Compara con competidores por feature
7. Triage: fix ahora / backlog (FIND-NNN) / descartar
8. Actualiza Backlog.md
9. Reporta y cede el turno
```

## IDs de hallazgos

Todos los hallazgos que van al backlog usan el prefijo `FIND-NNN` (esquema único de hallazgos — `prompts/findings.md`; el prefijo `DRV-` quedó cerrado a nuevos ingresos, las filas históricas no se renombran).
