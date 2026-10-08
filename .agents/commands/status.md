---
description: "Dashboard de un vistazo: plan activo, último audit, último ship decision, rama actual, próximo paso"
---

Modo ponytail (full) activo vía plugin (ver `.agents/skills/ponytail/SKILL.md`). La skill `progreso` cárgala solo si no corrió en el ritual de inicio de esta sesión.

Generá un dashboard del estado actual del proyecto. Mostrar no más de 30 líneas.

## Sections

### 1. Git Status
- `git status --short` — cambios sin commit
- `git log --oneline -5` — commits recientes
- `git branch --show-current` — rama actual

### 2. Build / Plan activo
- Estado de build: recitation del campaign MCP — `last-build-state.json` eliminado (consolidación 2026-08-25)
- Buscá `docs/agent-ops/state/pipeline-state.json` — si existe, mostrá task inProgress
- Buscá archivos en `docs/agent-ops/plans/` — ordená por fecha, mostrá el más reciente
- Estado: completados / pendientes / failed
- Próximo paso según estado

### 3. Último audit
- Buscá `docs/agent-ops/state/last-audit-state.json` (rápido) o fallback `docs/agent-ops/reviews/audit-*.md` (más reciente)
- Modo, fecha, veredicto (✅/❌)
- Findings críticos si los hay

### 4. Último ship
- Buscá `docs/agent-ops/state/last-ship-state.json` — ship decision, SHA, rollback plan
- Fallback: commit más reciente con mensaje `ship:`
- Rollback plan disponible (sí/no)

### 5. Spec status
- Verificá si existe `SPEC.md` en raíz o `docs/SPEC.md`
- Si no existe, recomendá `/spec`

### 6. Resumen y próximo paso recomendado

Mostrá al final una línea de recomendación basada en el estado:

| Situación | Recomendación |
|-----------|---------------|
| Cambios sin commit | `git add` + `git commit` o `/pipeline task <ID>` |
| Plan pendiente detectado | `/pipeline run` |
| Último audit con failures | `/audit quick` o `/audit review` |
| Todo OK, spec falta | `/spec` |
| Último ship GO sin rollback | Está todo bien. Seguí con `/pipeline` |
| Último ship NO-GO sin resolver | Revisá `docs/agent-ops/reports/` antes de continuar |

### Graceful degradation
Si algún state file no existe, simplemente omití esa sección. No mostrar errores.

## Format

Output como un dashboard markdown con emojis de estado (✅/❌/⏳/⬜) y bullet points.
Mantener una página — no más de 30 líneas de output.
