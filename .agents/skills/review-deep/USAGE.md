# USAGE — Review Deep: Cómo ejecutar

## Comando único (un módulo)

```bash
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=@ego/memory" "DEPTH=full"
```

Para revisión rápida:

```bash
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=@ego/memory" "DEPTH=quick"
```

## Todos los módulos en orden (Wave por Wave)

Los módulos de Ego se ejecutan en 6 waves:

```bash
# Wave 0 — Memoria & Persistencia
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=@ego/memory" "DEPTH=full"

# Wave 1 — Modelos & Decisiones
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=@ego/models" "DEPTH=full"

# Wave 2 — Cognitive Runtime
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=@ego/runtime" "DEPTH=full"

# Wave 3 — Ejecución & Gobernanza
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=@ego/execution" "DEPTH=full"

# Wave 4 — Herramientas & Eventos
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=@ego/tools" "DEPTH=full"
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=@ego/events" "DEPTH=full"

# Wave 5 — Desktop App (Main & Renderer)
/loop-goal --prompt-file .agents/skills/review-deep/loop-prompt.md "MODULE=@ego/desktop" "DEPTH=full"
```

## Batch mode para una wave completa

```bash
/pipeline run -PlanFile docs/agent-ops/plans/review-deep-wave0.md
```

Primero creá un plan file con los módulos de la wave.

## Lo que hace internamente por módulo

```
1. Mapea estructura con codegraph / AST (callers, callees, API surface)
2. Static analysis (pnpm build, pnpm typecheck, pnpm test)
3. Web research de mejores prácticas y competidores
4. Triaging de findings (críticos, altos, medios)
5. Registro de hallazgos en docs/roadmap/Backlog.md y memoria persistente
```
