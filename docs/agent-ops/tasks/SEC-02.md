# SEC-02 — IPC validado con Zod en Main

| Campo | Valor |
|---|---|
| ID | SEC-02 |
| Plan | `docs/agent-ops/plans/2026-10-12-plan-backlog-10.md` Task 2 |
| Estado | COMPLETED (inventario 50/50 + 5 fixes mínimos + test de cobertura) |
| Worker | ego-desktop (solo esta task; sin commit, sin push) |
| Fecha | 2026-10-13 |

## Spec (contrato)

Todo handler IPC valida schema + test de payload inválido rechazado por handler
(o inventario que prueba cobertura total). Sin `any`. Sin secretos. Sin lógica de negocio.

## Impacto Regla 0

Renderer untrusted: todo input del renderer se valida en main antes de uso.
Superficie: 50 `ipcMain.handle` en `apps/desktop/src/main.ts` + `handleLlmStream`.
Sin cambios en `packages/**`, sin cambios en `renderer/**`, sin secretos tocados.

## Steps

- [x] DISCOVERY: leer `ipc/schema.ts`, `ipc.ts` (50 invoke + 7 push), `main.ts` (handlers), `preload.ts` (firmas)
- [x] Compuertas Opción B: N/A nuevas — misma área que SEC-01; se citan sus veredictos (abajo)
- [x] Inventario 50/50: por cada `ipcMain.handle`, verificar `safeParse` antes de uso
- [x] TDD RED: `test/ipc-zod-coverage.test.ts` creado primero (7 fallos iniciales)
- [x] Fixes mínimos + test GREEN 7/7 + suites IPC 61/61 + typecheck exit 0
- [x] Referencias: `AGENTS.md` §Seguridad, `.agents/rules/electron-ipc.md`, `.agents/references/definition-of-done.md`, `docs/engineering/lenguajes.md` (cita §32 verificada: INEXISTENTE — ver notas)

## Compuertas Opción B (veredictos citados de SEC-01)

- **Coucou §26 (secret handling) / §27 (typed bridge) / §33 (safe URL): ADAPTADA.** Sin acción en SEC-02; ningún fix toca secretos ni el bridge tipado.
- **CARP-03 (path coverage): ASIMILADA** en `PathValidator.ts` (capa tools). Sin acción.
- **HERM-19 (skills linter): NO APLICA** (scope = validación de skills, no IPC). Sin acción.
- Ninguna compuerta exige decisión de producto → sin BLOQUEO.

## Inventario (50 handlers)

- **34 validados con Zod preexistente** (incl. `ipc.llm.stream` vía `handleLlmStream` → `ChatStreamSchema.safeParse`, y `ipc.projects.list` que valida payloads persistidos con `ProjectManifestSchema`).
- **11 sin argumento** (sin input del renderer → sin validación requerida): `subegos.list`, `subegos.getTemplates`, `mcp.listServers`, `projects.list`, `projects.getActive`, `projects.selectFolder`, `snapshots`, `settings.getModelConfig`, `decision.telemetry`, `domains.list`, `daily.saveSnapshot`.
- **5 GAPS con coerción manual `typeof` (FIXED en esta task):** `decision.listAudits`, `knowledge.export`, `knowledge.import`, `daily.getSnapshot`, `daily.listSnapshots`.

## Hallazgos (fixes mínimos)

1. **FIND-SEC02-01 (FIXED): 5 handlers sin Zod.** Nuevos schemas en `ipc/schema.ts`: `DecisionListAuditsSchema`, `KnowledgeExportSchema`, `KnowledgeImportSchema`, `DailyGetSnapshotSchema` (regex + refine calendario real), `DailyListSnapshotsSchema`. Handlers rechazan con `{ ok:false, error }` (estilo del vecindario). Defaults preservados: 50 / activeProjectId / today / 30. Compat preload verificada (`listAudits(10)` sigue válido; `undefined` aceptado en los 5).
2. **FIND-SEC02-02 (FIXED, seguridad): `ipc.knowledge.import` aceptaba `string` → `fs.readFile` (lectura arbitraria de archivos desde renderer untrusted).** `KnowledgeImportSchema` solo acepta objeto-paquete inline (`version/projectId/checksum/records` + `records ≤ 100000`); strings/paths rechazados. `importPackage` conserva verificación SHA-256 downstream (defensa en profundidad). Ningún caller legítimo pasaba paths (renderer mock solo eco; preload `pkg: unknown` sin uso de paths).
3. **FIND-SEC02-03 (FIXED, hardening): `domains.product.backlog` / `domains.crm.deals` aceptaban arrays en `payload`** (`typeof [] === "object"` → `createBacklogItem([] as any)`). Guard `!Array.isArray(payload)` en las 4 ramas create/update. Payload interior sigue `z.unknown()` por diseño (CRUD flexible) — limitación documentada, no fix.
4. **Leniencias aceptadas (documentadas, no fixes):** `daily.isFirstLaunch` tolera parse fallido con fallback seguro a hoy (sin op privilegiada); `NaN`/`Infinity` ya rechazados por `.int()` en los schemas numéricos.

## Límites conocidos (residual → SEC-08)

- Payloads interiores `z.unknown()` de backlog/CRM (`p.id/p.status/p.stage` con cast `as any` preexistente) no se validan a nivel IPC; endurecerlos exige schemas de dominio (fuera del fix mínimo). Cubrir con suite de inyección SEC-08.
- `DailyStateJournalSchema.date` usa regex débil heredado (acepta `2026-13-99`); solo se endureció el schema nuevo `DailyGetSnapshotSchema`. Alinear journal en SEC-08 o task dedicada.

## Review (veredicto)

- Fix: `apps/desktop/src/ipc/schema.ts` (+52, 5 schemas), `apps/desktop/src/main.ts` (5 handlers + 4 guards array + import; 0 `any` nuevo — el `rec.payload as unknown` es cast a `unknown`, no `any`).
- Test: `apps/desktop/test/ipc-zod-coverage.test.ts` (7 tests, TDD: RED 7 fallos → GREEN 7/7; incluye inventario mecánico 50/50 + payloads adversariales por handler).
- `pnpm --filter @ego/desktop typecheck` → exit 0.
- Suites IPC: 10 archivos / 61 tests PASS (`ipc-zod-coverage`, `ipc-contract`, `ipc`, `knowledge-ipc`, `daily-state-ipc`, `domain-ipc`, `mcp-ipc`, `subegos-ipc`, `projects-ipc`, `preload-bridge`). `decision-ipc` (1 fallo `fs_read_file` vs `fs`) es PREEXISTENTE en HEAD y ajeno (verificado con stash).
- Rollback: `git checkout HEAD -- apps/desktop/src/ipc/schema.ts apps/desktop/src/main.ts` + borrar `apps/desktop/test/ipc-zod-coverage.test.ts`.
- Referencia `lenguajes.md` §32: **no existe** (el doc tiene 6 secciones sin numerar; la afirmación Zod/IPC está en línea 31). Cita del plan marcada como stale.

## Registro de Cumplimiento (2026-10-13)

- **Estado:** ✅ COMPLETED
- **Evidencia:** inventario 50/50 + 7 tests + typecheck exit 0. Sin commit (orden del paquete).
