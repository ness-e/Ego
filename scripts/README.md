# scripts/ — Ledger de utilidades (F6T12/M32)

Estado verificado 2026-10-12. Un script está **mantenido** solo si tiene
referencias vivas (código, CI, docs activas o taskfiles del plan maestro).
El resto son **one-offs archivados**: se conservan por historia, no usar
como dependencia.

## Mantenidos

| Script | Referencias vivas |
|---|---|
| `fix_links.py` | Repara `](docs/...)` relativos-a-raíz en `docs/` (C10). Uso: `python scripts/fix_links.py [--check]`. Citado en `docs/agent-ops/tasks/F6T12-repo-docs.md` y el plan maestro F6T12. |
| `ingest/bulk_import.py` | Sidecar de ingesta masiva vía stdio JSONL. Invocado por `packages/knowledge/src/ingest/PythonSidecarBridge.ts`. Trazado por `KB-02` en `docs/roadmap/Backlog.md`. |

## Archivados (one-offs, sin referencias vivas)

| Script | Origen probable |
|---|---|
| `adapt_opencode.py` | Migración puntual de formato opencode (jul-2026). |
| `extract_docx.py` | Extracción puntual de DOCX a texto (may-2026). |
| `freeze_prd_07_11.py` | Congelado puntual de PRD (may-2026). |
| `generate_review_tracker.py` | Generó `docs/ego-review-tracker.html` (jul-2026). Solo referenciado por `update_tracker_arch.py` (también archivado). |
| `integrate_overview_sections.py` | Integración puntual de secciones overview (may-2026). |
| `scaffold_docs.py` | Andamiaje inicial de docs (jul-2026). |
| `split_prd.py` | División puntual de PRD (may-2026). |
| `update_tracker_arch.py` | Actualización puntual del tracker (may-2026). |

Regla: antes de archivar definitivamente (borrar) cualquiera de estos,
pedir decisión del owner. Prohibido añadirles dependientes nuevos.
