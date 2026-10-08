# OpenCodeReview — Delegation Mode (Ego)

> Canonical OCR doc for agents. On-demand: load when a task/plan reaches
> VERIFY/REVIEW, or when `/audit` runs L9. Edit here, not in prompts.

## Qué es

[OpenCodeReview](https://github.com/alibaba/open-code-review) (`ocr`, v1.12.2+,
instalado global vía npm) es el revisor de código IA de Alibaba, open-sourced
tras 2 años de uso interno. Combina **ingeniería determinista** (selección de
archivos, bundling, reglas por path, posicionamiento) con un **agente** que
razona sobre el diff.

**Delegation mode** = OCR aporta el scaffolding determinista (qué revisar +
con qué checklist); el host agent (OpenCode / ego-*) aporta el razonamiento
con su propio LLM. **Sin API key, sin endpoint LLM, sin costo extra.**

## Cuándo usarlo (gates)

| Gate | Comando | Veredicto |
|------|---------|-----------|
| Cierre de cada tarea (pipeline-full.md §Cierre paso 5) | `pwsh dev-tools/ocr-review.ps1 -Format json` | Critical/High bloquean el commit |
| Review por agente distinto (task.md §Phase 5) | spec OCR como input del revisor | revisor verifica Critical/High antes del veredicto |
| Cierre paso a paso (iter-loop-tools.md §MODO CIERRE) | idem, modo text si es interactivo | idem |
| `/audit` L9 (Ego.yml `ocr_delegation`) | spec OCR como input cognitivo | cuenta como evidencia de review |

## Workflow (5 pasos, el agente ejecuta 3-5)

```powershell
# 1+2. Spec en un solo JSON { preview, rules } — para agentes (recomendado)
pwsh dev-tools/ocr-review.ps1 -Format json [-Output result.json]
# 3. Diff por archivo — git directo según el modo del preview:
git diff HEAD -- <path>        # workspace (tracked)
git diff <merge_base>..<to> -- <path>   # rango (ver campo mode/ref del preview)
git show <commit> -- <path>    # un commit
cat <path>                     # untracked nuevo
# 4. Revisar cada archivo contra su Rule Group (+ contrato de la tarea como contexto)
# 5. Reportar por severidad:
#    Critical/High → bloquean, se corrigen ahora
#    Medium        → fila FIND-* en docs/dev/Backlog.md (prompts/findings.md)
#    Low           → se descarta en silencio salvo valor claro
```

Variantes del wrapper: `-Commit <hash>` (un commit), `-From main -To <rama>`
(rango), `-Background "<contrato>"` (contexto de negocio de la tarea),
`-Output result.json` (guardar spec para el reviewer).

## Reglas Ego que OCR ya cubre

El rule engine built-in para `**/*.rs` mapea directo a AGENTS.md Regla 4:
`unwrap/expect/panic` en paths de producción, `unsafe` sin rationale SAFETY,
`clone()` innecesario, guards de Mutex/RwLock a través de `.await`, FFI sin
validar, O(n²) evitable. No duplica `clippy/fmt/nextest` — los complementa
a nivel cognitivo (el linter dice *qué*; OCR razona *por qué importa*).

## Upgrade opcional (con LLM propio)

Si algún día se configura endpoint (`ocr config provider/model`), el mismo
wrapper se reemplaza por `ocr review --format json` (OCR maneja el LLM).
Delegation sigue siendo el default: cero costo, cero secretos en disco.

## CI

`.github/workflows/ocr-delegate.yml` (INFORMATIONAL, non-blocking): publica el
spec `preview+rule` como artifact en cada PR. Nunca bloquea el merge.
