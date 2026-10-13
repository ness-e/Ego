# HIG-03 — Eliminar `any` en `apps/desktop/src/main.ts`

- **Estado:** ⏳ IN PROGRESS
- **Contrato:** `grep -c ": any" apps/desktop/src/main.ts` → 0 sin justificación + `pnpm --filter @ego/desktop typecheck` exit 0 + `pnpm --filter @ego/desktop test` (suites IPC) PASS.
- **Ruta:** ego-desktop. **Scope:** SOLO `apps/desktop/src/main.ts` (+ este taskfile). Prohibidos: resto de `src/`, `packages/**`, `.agents/**`. Sin commit ni push.
- **SDP:** `test-driven-development`, `systematic-debugging` (pinned por task) + base `campaign-executor`.
- **Referencias leídas:** `pipeline-full.md`, `clean-code-clean-architecture.md` (Apéndice V normativo), `definition-of-done.md`, `.agents/rules/electron-ipc.md`.

## Impacto mapeado (Regla 0)

- **Archivo leído completo:** `apps/desktop/src/main.ts` (2720 líneas). Tipos canónicos verificados en fuente (no asumidos):
  - `EgoRecallStatus` — `packages/memory/EgoMemoryLifecycle.ts:9` (exportado vía `packages/memory/index.ts`).
  - `LoopExecutionResult["usage"]` — `packages/runtime/src/types.ts:108-121` (ya importado como tipo en `main.ts:14`).
  - `EventBus.emit` overloads — `packages/events/src/EventBus.ts:29-51`; `EgoEventType` — `packages/events/src/types.ts:5-55` (NO contiene `subego.registered|subego.state_changed|project.switched|settings.model_updated`).
  - `SubEgoRegistry.register(manifest: SubEgoManifest)` — `packages/subegos/src/SubEgoRegistry.ts:159`; `adapter.registerSubEgo(manifest: SubEgoManifest)` — `packages/memory/EgoMemoryAdapter.ts:1112`.
  - `SubEgoFactory.fromTemplate(id, overrides?: Partial<SubEgoCreateInput>)` — `packages/subegos/src/SubEgoFactory.ts:303` (`SubEgoCreateInput` en `packages/subegos/src/types.ts:131`, exportado vía index).
  - `CreateBacklogItemInput` + `updateBacklogItemStatus(id, status: BacklogItemStatus)` — `packages/domains/src/product/ProductDomain.ts:12,183`; `BacklogItemStatusSchema` — `packages/domains/src/product/types.ts:3`.
  - `CreateDealInput` + `updateDealStage(id, newStage: DealStage)` — `packages/domains/src/crm/CrmDomain.ts:24,324`; `DealStageSchema` — `packages/domains/src/crm/types.ts:17`.
  - `CreateSubEgoSchema.overrides: z.record(z.unknown())` y `DomainProductBacklogSchema/DomainCrmDealsSchema.payload: z.unknown()` — `apps/desktop/src/ipc/schema.ts:81,373,393` (frontera: unknown real).
- **Referencias hacia dentro (main.ts consume):** `@ego/memory` (tipos + adapter), `@ego/runtime` (tipos), `@ego/events` (tipos), `@ego/domains` (tipos + schemas), `@ego/subegos` (tipos). Solo se amplían imports `type`/schema; cero cambios runtime salvo narrowing con throw en enums inválidos.
- **Referencias entrantes:** `apps/desktop/test/*.test.ts` importan `../src/main.js` compilado (`handleLlmStream`, `setupModelProviders`, etc.). El `pretest` (gate HIG-02) reconstruye `dist/` → los tests validan el código nuevo. `domain-ipc.test.ts` ejercita `updateStatus` con `"in_progress"` válido → la validación de enums no rompe suites existentes.
- **Veredicto:** impacto contenido en `main.ts`; comportamiento idéntico para inputs válidos. Único cambio conductual: `status`/`stage` inválidos ahora lanzan `[IPC Security]` en el borde en vez de fluir al dominio (mejora, patrón del archivo).

## Inventario (20 sitios `any` en código; `grep ": any"` → 9; resto `as any`/`catch`)

| # | Línea(s) | Sitio | Clase | Fix |
|---|---|---|---|---|
| 1 | 958 | `recallStatus: any` (retorno `handleLlmStream`) | tipo perezoso | `EgoRecallStatus` |
| 2 | 959 | `usage?: any` | tipo perezoso | `LoopExecutionResult["usage"]` |
| 3-5 | 1117, 1896, 2325 | `catch (x: any)` | boundary error | `catch (x)` + `instanceof Error` narrowing |
| 6-7 | 1170, 1172 | `let payload: any` / `{ payload: any }` | deserialización | `unknown` |
| 8 | 1531 | `req.overrides as any` | tipo perezoso | `as Partial<SubEgoCreateInput>` |
| 9-10 | 1560, 1562 | `manifest as any` (register ×2) | cast innecesario (ya `SubEgoManifest`) | quitar cast |
| 11-14 | 1567, 1602, 1953, 2210 | `"..." as any` (nombres evento no canónicos) | boundary tipado EventBus | helper `emitDesktopEvent` (cast `as unknown as EgoEventType`, 1 punto) |
| 15 | 2583 | `payload as any` (create backlog) | deserialización | `as CreateBacklogItemInput` (dominio valida vía `BacklogItemSchema.parse`) |
| 16 | 2586 | `status: any` | deserialización | `unknown` + `BacklogItemStatusSchema.safeParse` + throw |
| 17 | 2633 | `payload as any` (create deal) | deserialización | `as CreateDealInput` (dominio valida vía `CrmDealSchema`) |
| 18 | 2636 | `stage: any` | deserialización | `unknown` + `DealStageSchema.safeParse` + throw |

(L503 menciona `` `any` `` en prosa de un comentario — documentación, se conserva.)

## Steps

- [x] S1 DISCOVERY: inventario + tipos canónicos + taskfile con Regla 0.
- [x] S2 ACT: imports de tipos/schemas + helper `emitDesktopEvent` + firma `handleLlmStream`.
- [x] S3 ACT: catches + payload unknown + overrides + registers sin cast.
- [x] S4 ACT: 4 emits legacy + handlers producto/CRM con narrowing de enums.
- [x] S5 VERIFY: `grep -c ": any"` → 0, `grep -n "any"` solo comentarios/`onAny`, typecheck exit 0, tests desktop 27f/138t PASS.

## FIX_PROPUESTO (fuera de alcance — NO implementar)

- **HIG-03-F1:** canonizar `subego.registered`, `subego.state_changed`, `project.switched`, `settings.model_updated` en `CanonicalEventPayloadMap` (`packages/events/src/types.ts`) y retirar el helper `emitDesktopEvent`. Requiere tocar `packages/**` (prohibido en esta task).
- **HIG-03-F2 (hallazgo de esta task):** unificar las dos definiciones divergentes de `SubEgoManifest` — `packages/memory/sub-egos.ts` vs `packages/subegos/src/types.ts:83` (+ `SubEgoManifestSchema`). El `as any` original ocultaba el desajuste (al custom-branch le faltan `responsibilities`, `capabilities`, `permissions`, `behavior` y 2 campos más según tsc); hoy se puentea con `as unknown as Parameters<SubEgoRegistry["register"]>[0]` y la validación runtime `validateSubEgoManifest` (`SubEgoRegistry.ts:163`) sigue siendo la guarda efectiva. Requiere tocar `packages/**`.

## Verify (contrato)

- `grep -c ": any" apps/desktop/src/main.ts` → 0
- `pnpm --filter @ego/desktop typecheck` → exit 0
- `pnpm --filter @ego/desktop test` → PASS (incl. `domain-ipc`, `ipc-*`, `mcp-*`, `subegos-ipc`)
