> **ENTRY POINT — Audit Command (router)**
> El agente DEBE leer este archivo cuando el usuario envía un mensaje que empieza con `/audit`.
>
> **CONSOLIDACIÓN:** `/audit` es un ROUTER sobre la skill `unified-review` (`.agents/skills/unified-review/`).
> Mapea el modo, invoca la skill, y aplica el contrato de salida (reporte + INDEX + backlog).
> Perfil por defecto: `default` (o específico del proyecto si existe en `profiles/<proyecto>.yml`).
> Diseño legacy conservado como referencia: `.agents/task-system/prompts/audit-full.md`
> (no lo carga ningún comando; no editar, la skill es la fuente viva).

Cargá las skills `progreso`, luego `unified-review` (modo ponytail full activo vía plugin — ver `.agents/skills/ponytail/SKILL.md`).

## Router: modo según el argumento

| Invocación | unified-review | Uso |
|------------|----------------|-----|
| `/audit quick` | `--mode quick --profile default` | Gate mecánico (~2min): linters / type-check / test |
| `/audit certify` | `--mode certify --profile default` | Pre-push/merge gate secuencial, hard stop al primer error |
| `/audit review` | `--mode review --profile default` | Deep review + code review sin CLI pesado |
| `/audit` o `/audit full` | `--mode full --profile default` | Pipeline completo con scoring ISO |

Si el usuario pasa `--profile <nombre>`, úsalo en lugar de `default` (ej: `--profile ego`).

## Ejecución

1. Cargá la skill `unified-review` y ejecutá su flujo para el modo elegido
   (la skill define las fases, waves y sub-agentes — este archivo no los duplica).
2. Pre-check estándar: si no hay diff (`git diff --name-only HEAD` vacío), usá
   `git diff --name-only HEAD~1` como scope del review.
2b. OCR delegation spec como input de L9 (sin API key):
   `pwsh .agents/dev-tools/ocr-review.ps1 -Format json` → `ocr delegate rule <paths>`
   (detalle: `.agents/references/ocr-review.md`).
3. En modo `certify`: ejecución secuencial con hard stop al primer fallo
   ("❌ LAYER N FAILED — abortando" / "✅ CERTIFY PASSED — safe to push").

## Contrato de salida (post-ejecución, obligatorio)

1. **Reporte:** `docs/agent-ops/reviews/audit-<modo>-<YYYYMMDD>-<HHMMSS>.md` (naming
   zero-padded, igual que unified-review) con scoreboard por fase, findings
   priorizados (Critical/Important/Suggestion con file:line + fix), FODA y veredicto.
2. **Estado:** `docs/agent-ops/state/last-audit-state.json`:
   `{timestamp, mode, veredicto: PASS|FAIL, findings_critical, report_file}`
3. **INDEX:** fila en `docs/agent-ops/reports/INDEX.md`; si un audit previo del mismo modo
   queda superado, marcá el anterior `superado`.
4. **Backlog:** hallazgos ≥ medium → filas **FIND-\*** en `docs/roadmap/Backlog.md` (esquema canónico de 10 columnas: `.agents/references/backlog-format.md`)
   sección `## Hallazgos pendientes de reportes` (esquema único, fuente canónica
   `.agents/task-system/prompts/findings.md`; NO crear prefijos AUD-/REVIEW- nuevos). Cada fila con
   `Origen: <este reporte>`.

## Mensaje final

- PASS: "✅ AUDIT PASSED (<modo>)" + resumen de findings
- FAIL: "❌ AUDIT FAILED — fix errors above before shipping"
