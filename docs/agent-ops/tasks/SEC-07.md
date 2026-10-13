# SEC-07 — Purga criptográfica ADR-046/VER-02

> Contrato: borrado verificable + test de irrecuperabilidad a nivel API.
> Docs: `docs/architecture/memoria-vantadb.md` §14 (cita verificada 2026-10-13:
> "Purga criptográfica (VER-02): Destrucción verificable de claves y datos
> sensibles en cumplimiento de políticas de privacidad").

## Compuertas / ADR

- N/A nuevas (plan §Task 7).
- `docs/architecture/adr/` **no existe** en el repo (verificado 2026-10-13:
  `docs/architecture/` contiene 12 `.md` sin subdirectorio `adr/`). ADR-046 y
  VER-02 existen solo como **menciones** (`memoria-vantadb.md` §14 y §16,
  `namespaces.md`, `Backlog.md`, `roadmap.md`). No se inventan documentos ADR;
  esta task cita las menciones canónicas.

## Implementación (solo esto + tests; prohibidos motor Fjall/LSM, renderer, .agents)

- [x] `packages/security/src/CryptoErasure.ts` (nuevo): `CryptoErasure`
      (sobrescritura N pasadas → rotación epoch → `delete` → verificación de
      lectura fail-closed) + `ScopeKeyRegistry` (epochs por scope, claves
      derivadas HMAC-SHA-256 nunca almacenadas, `seal`/`open` AES-256-GCM,
      zero-fill en `rotate`/`destroy`) + `ErasureVerificationError`.
      Store estructural (`ErasureStore`): `EgoMemoryAdapter` lo satisface sin
      importar `@ego/memory` (cero aristas nuevas, como `SecretsFilter`).
- [x] `packages/security/src/index.ts`: re-export del módulo.
- [x] `packages/security/test/CryptoErasure.test.ts` (nuevo, TDD RED→GREEN):
      10 tests — get-tras-erase null, claves rotadas (open previo lanza),
      orden put×N→delete, fail-closed (delete no-op y fantasma en list),
      idempotencia not-found, validación sin tocar store, eraseNamespace,
      `physicalErasure: "api-level-only"`, barrel.

## Límite honesto (no se promete)

Borrado físico del LSM (segmentos Fjall inmutables, WAL, compactación,
snapshots): fuera del alcance de este módulo. Garantías reales: ilegible vía
`get`/`list` + material de claves destruido. El receipt lo declara en
`physicalErasure: "api-level-only"`. Trade-off documentado: `eraseMany` /
`eraseNamespace` son fail-fast (un fallo aborta con throw, receipts parciales
no retornados); la primitiva auditable es `eraseOne`.

## Verify (§6 plan + comandos exactos task)

- `pnpm --filter @ego/security test` → PASS (5 files / 73 tests, incl. 10 nuevos)
- `pnpm --filter @ego/security typecheck` → exit 0
- Sin commit (ego-worker)

## Rollback

Archivos nuevos + añadido al barrel; revert por archivo (`CryptoErasure.ts`,
`CryptoErasure.test.ts`, hunk de `index.ts`). Sin cambios de comportamiento
en código existente (63 tests previos siguen verdes).

## Registro de Cumplimiento (2026-10-13)

- **Estado:** ✅ COMPLETED (verificado, sin commit)
- **Fixes propuestos:** ninguno (sin hallazgos fuera de alcance)
