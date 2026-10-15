# STAB-16 — DIST-04/06/09 owner-gated (docs-only)

> **Estado:** ✅ COMPLETED docs-only (commit `9ba99d4`+amend; code BLOQUEADO hasta certs owner)
> **Tipo:** docs-only (BLOQUEADO para código hasta certs Apple/Win + VM limpia owner — Gate P vinculante)
> **Plan:** `docs/agent-ops/plans/2026-10-16-plan-estabilizacion-ego.md` Task 17
> **SDP:** shipping-and-launch (staged/rollback) + base. Sin re-descubrimiento: tarea docs-only, sin decisiones técnicas abiertas (todo owner-gated).
> **Gate D:** sin ronda de preguntas — justificación por evidencia: no hay bifurcaciones técnicas propias; cada ítem abierto (certs, VM, canal publish) está declarado BLOQUEO owner en Backlog DIST-04/06/09 y Gate P 2026-10-16. Preguntar al owner "qué certificado" no aporta nada accionable al agente.

## Contrato (ley)

Spec `scripts/release/sign.mjs` + secretos `APPLE_ID/WIN_CERT` documentados como owner-gated
+ publish por canal listo SIN descomentar + staged manual prerelease→observación→promote
+ rollback=reinstalación + SHASUMS (corrupción sí, suplantación no) + release-notes-template
+ checklist unsigned + FAQ update.
**PROHIBIDO:** descomentar publish, añadir electron-updater, tocar `updater.ts:downloadUpdate`,
subir secrets, compilar nativo, firmar.

## Spec (docs-only — contenido válido: justificación por evidencia por ítem)

| Ítem | Decisión | Evidencia |
|---|---|---|
| `sign.mjs` | Stub SPEC que falla cerrado (`BLOQUEO DIST-04`), cero lógica de firma | Sin certs no hay implementación posible; fingir firma = bloqueante prohibido |
| Secretos | Solo NOMBRES + dónde los aporta el owner; ningún valor en repo | `grep APPLE_ID\|WIN_CERT\|CSC_` limpio pre/post (ver Verify) |
| `publish` | Bloque comentado `electron-builder.config.cjs:36-52` intacto, SOLO lectura | Plantilla A (github) + B (generic) ya existe; descomentar sin firma generaría updates no verificables |
| Updater | `downloadUpdate→deferred` intacto, SOLO lectura | `updater.ts:183-191`; diferencial real = blockmap NSIS vía electron-updater solo con firma |
| Staged/rollback | Manual prerelease→observación→promote; rollback=reinstalación | `distribution.md` §3/§5 ya lo describe; skill shipping-and-launch confirma patrón sin auto-update forzoso |
| SHASUMS | Script `generate-checksums.cjs` existente; límite honesto documentado | Corrupción sí, suplantación no — autenticidad real llega con DIST-04 |
| Release notes | Plantilla existente, sin cambios necesarios | `release-notes-template.md` ya exige `None` explícito + firma unsigned declarada |
| FAQ | §7 existe; añadir aviso unsigned + verificación hash | `docs/user/faq.md:52-58` |

## Impacto mapeado (Regla 0)

- **Archivos leídos completos:** `docs/roadmap/Backlog.md:476-484` (DIST-01..12),
  `apps/desktop/electron-builder.config.cjs` (completo, 91L — SOLO lectura),
  `apps/desktop/src/updater.ts:170-191` (SOLO lectura),
  `docs/deployment/distribution.md` (completo, 126L),
  `docs/deployment/release-notes-template.md` (completo, 38L),
  `docs/user/faq.md:40-69`, `apps/desktop/package.json` (completo).
- **Referencias hacia dentro:** `sign.mjs` (nuevo) referencia solo `distribution.md` §2 y Backlog DIST-04;
  no es importado por ningún build/test (no existe `scripts/release/` previo; `package.json` scripts intactos).
- **Referencias entrantes:** `distribution.md:60-61` ya anticipa `sign.mjs` ("Crearlo es parte de DIST-04")
  → el stub cierra esa referencia sin activar nada.
- **Veredicto:** blast = `docs/deployment/*` + `docs/user/faq.md` + `scripts/release/sign.mjs` (nuevo, inerte)
  + este task file + Backlog (solo si cambia estado — NO; estados DIST los toca el owner/plan).
  Cero código prod tocado. `electron-builder.config.cjs` y `updater.ts` NO se editan.

## Steps

- [x] S1 — Discovery: lecturas + greps (publish comentado ✅, sin electron-updater dep ✅, sin secrets ✅)
- [x] S2 — Crear `scripts/release/sign.mjs` SPEC (stub fail-closed, cero lógica firma)
- [x] S3 — `distribution.md` §2: tabla secretos owner-gated (nombres + aporte owner, sin valores)
- [x] S4 — FAQ §7: aviso unsigned + verificación hash con SHASUMS
- [x] S5 — Verify contrato + commit local (NUNCA push) + cierre plan
