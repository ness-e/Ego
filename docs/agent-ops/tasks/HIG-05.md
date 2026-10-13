# HIG-05 — Verificar residuales M16 (path edge Windows, colisión audit keys por ms)

- **Estado:** ✅ COMPLETED (verificado mecánicamente; commit pendiente del orquestador)
- **Contrato:** tests que fijan path edge + audit-ms, o aceptación documentada firmada.
- **SDP:** test-driven-development, systematic-debugging (+ base campaign-executor).
- **Archivos clave:** `packages/domains/src/engineering/WorktreeManager.ts` (`assertInsideRoot`, `validateBranchName`), `packages/domains/src/engineering/EngineeringDomain.ts` (gates F2T5), `packages/knowledge/src/FactLifecycle.ts` (audit keys).
- **Prohibidos:** resto de `src/`, `.agents/**`. Sin commit, sin push (ego-worker).

## Spec (decisiones)

| # | Decisión | Opción elegida |
|---|---|---|
| 1 | `assertInsideRoot`: `rel.startsWith("..")` vs segmentado | Segmentado (`..` exacto o `..`+sep): el actual sobrerrechaza `..foo` (hijo legítimo). Fail-closed hoy, pero incorrecto → fix mínimo. |
| 2 | `candidate == root` (`rel === ""`) | Mantener rechazo (un worktree sobre el root principal lo ensuciaría; `removeWorktree` ya protege el principal). Sin cambio. |
| 3 | Case-edge Windows (`C:\Repo` vs `c:\repo\..`) | `path.win32.relative` ya es case-insensitive (verificado por sonda node): escape se rechaza, interior con distinta caja se acepta. Test lo fija, sin cambio de código. |
| 4 | Audit keys mismo ms (`audit_${now}_${action}_${factId}`) | Colisión real: 2 eventos (ms,action,factId) idénticos → misma key → `put` sobrescribe y se pierde 1 registro. Fix mínimo: sufijo aleatorio. Sin lectores que parseen la key (grep: solo escritura en `FactLifecycle.ts:301-302`), por lo que el sufijo no rompe nada. |
| 5 | Formato del sufijo | `${now}_${action}_${factId}_${rand36(8)}`: unicidad cross-proceso; tests con `Date.now` mockeado prueban unicidad sin mockear `Math.random`. |

## Impacto mapeado (Regla 0)

- **Archivos leídos completos:** `packages/domains/src/engineering/WorktreeManager.ts` (315L), `packages/knowledge/src/FactLifecycle.ts` (317L); parcial: `EngineeringDomain.ts` (solo gates, vía grep), tests `GitSanitizationApproval.test.ts` (115L), `FactLifecycleAudit.test.ts` (198L).
- **Referencias hacia dentro (lo que toco y qué usa):** `assertInsideRoot` ← `createWorktree` (:170), `removeWorktree` (:281); `validateTargetRef` ← `EngineeringDomain.proposeChanges` (:266). `writeAudit` ← `promoteFromQuarantine`, `supersedeFact`, `consolidateMemories(retire)`. Nadie lee/parsea keys `audit_*` (grep `kb/audit` en `packages/` solo escritura + tests).
- **Referencias entrantes:** suites existentes que deben seguir verdes: `GitSanitizationApproval.test.ts`, `FactLifecycleAudit.test.ts`, `EngineeringDomain.test.ts`.
- **Veredicto de impacto:** blast radius = 2 funciones puras + 1 método privado sin lectores. Riesgo bajo. Fix de 2 líneas efectivas + 2 archivos de test nuevos (sin tocar tests existentes).

## Steps

- [x] S1 DISCOVERY
- [x] S2 RED: 2 fallos (`..foo`×2) + 1 fallo (keys duplicadas mismo ms) — fallos reales confirmados.
- [x] S3 GREEN: fix `..`+sep + sufijo random; nuevos tests 7/7 y 2/2 PASS.
- [x] S4 VERIFY: domains 76/76 + knowledge 67/67 + typechecks exit 0. Sin commit (INV owner: ego-worker no commitea).

## Evidencia (sondas)

- `path.win32.relative('C:\\Repo','c:\\')` → `".."` (rechazado ✅, case-edge OK).
- `path.win32.relative('C:\\Repo','C:\\Repo\\..foo')` → `"..foo"` → `startsWith("..")` = true → rechazado ❌ (falso positivo real: `..foo` es hijo legítimo).
- Audit: `key = audit_${now}_${action}_${factId}` determinista en (ms,action,fact) → 2 eventos mismo ms colisionan (pérdida de 1 registro best-effort).
