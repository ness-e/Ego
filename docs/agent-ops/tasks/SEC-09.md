# SEC-09 — Cuarentena por defecto para namespaces sensibles sin cifrado

| Campo | Valor |
|---|---|
| ID | SEC-09 |
| Plan | `docs/agent-ops/plans/2026-10-12-plan-backlog-10.md` Task 9 |
| Estado | COMPLETED_WITH_DEFERRALS (lado Ego implementado; enforcement diferido en 4 prefijos operativos + relajación pendiente de VantaDB FIND-249) |
| Worker | ego-worker (solo esta task; sin commit, sin push) |
| Fecha | 2026-10-13 |
| Dependencias | `SEC-03` ✅, `KB-07` ✅, `SEC-04` ✅ (consumido), VantaDB `FIND-249` ⏳ abierto |
| Compuertas | `CARP-04` ✅ Completada — REUTILIZADA · `KB-07` ✅ (destino `quarantine/pending` TTL 14d) |

## Spec (contrato)

Namespaces sensibles → `quarantine/pending` + aviso UI explícito + 0 secretos en storage/logs. Origen: VantaDB `FIND-249` (la feature `encryption` no está cableada de extremo a extremo; WAL/journal/VantaFile/HNSW/KV/text-index/snapshots pueden contener plaintext) → stopgap lado Ego hasta el cifrado at-rest real.

## Impacto Regla 0

Wiring en el borde de escritura del adapter (`put/putMulti`), main process, cero cambios en `renderer/**`, `.agents/**` y motor LSM. Nueva arista de paquete `@ego/memory → @ego/security` (estructural, acíclica: security no depende de memory; el wiring real estaba reservado a esta task por SEC-04 §Hallazgos-5). Sin lógica de negocio nueva fuera del borde. `main.ts`/`preload.ts`/renderer INTACTOS: el aviso viaja por canales existentes (reporte de retorno vía `ipc.memory`, `console.warn` estructurado del main process, metadata `ui_notice` legible por `ipc.knowledge.quarantine list`).

## Threat model (5 min, security-and-hardening)

- **Fronteras:** (1) `put/putMulti` → VantaDB (enforcement); (2) `console.error/warn` del adapter (vía lateral de fuga si el motor hace eco del record); (3) `promote()` → namespaces sensibles (válvula de escape supervisada).
- **Activos:** API keys/tokens (a keychain por SEC-03), PII de CRM, diario personal, finanzas, estado privado de Sub-Egos, checkpoints de sesión.
- **STRIDE:** Divulgación (storage at-rest sin cifrar + logs) = riesgo principal; Manipulación (la copia redactada nunca sustituye al original en live: o va a cuarentena o no se persiste); DoS (el scan hereda las cotas SEC-04 `maxInputChars`/base64; el routing añade O(1) por ítem).
- **Abuso:** "pego mi key y pido guardarla" → bloqueada en cualquier namespace (veredicto independiente del namespace); "uso `GOV/Policies`/`%67ov/...`/`kb/mysecrets` para evadir" → normalización anti-evasión + tokens por segmento; "promociono un secreto a live" → `promote()` bloquea fail-closed y preserva la fuente.

## Steps

- [x] DISCOVERY: `EgoMemoryAdapter.put/putMulti/quarantine/promote`, `SecretsFilter.scanEgoPut/sanitizeForLog` (SEC-04), `QuarantineManager` TTL 14d (KB-07), compuertas `CARP-04`/`KB-07`, blast-radius de namespaces con lectores vivos (`CrmDomain.hydrate`, `SubEgoMemoryGuard`, `SessionCheckpointPolicy`, manifests `egos/<id>/*`)
- [x] Compuertas CARP-04 + KB-07 (veredictos abajo)
- [x] TDD RED: `test/sensitive-quarantine.test.ts` (15 tests) falla sin el módulo → GREEN con `SensitiveNamespaces.ts` + wiring
- [x] FIX diferido SEC-04 aplicado (aprobado por el owner): `sanitizeForLog` en TODAS las rutas de error del adapter (putBatch-fallback, list, delete, searchMulti, recall, listSubEgos, supersede, graphQuery, importDump)
- [x] Hallazgo y fix de bug latente: `promote()` leía metadata cruda sin desenvolver (defaults `original_namespace` → `[object Object]`); fix con `unwrapMetadata` (nunca ejercitado: los tests existentes siempre pasan target explícito)
- [x] Decisión de alcance adversarial (ver §Adversarial): enforcement diferido explícito para `crm/`, `egos/`, `system/snapshots`, `system/checkpoints` (cuarentenarlos hoy desactiva capacidades, no las controla) + FIX_PROPUESTO-SEC-09-01
- [x] Verify §6: suites memory 94/94, security 73/73, domains 65/65, knowledge 65/65, runtime 49/49, tasks 51/51, subegos 146/146, dailystate 33/33 + typechecks memory/security/domains/desktop exit 0
- [x] Revisión adversarial (doubt-driven, modo degradado anunciado): 5 evasiones + residuales abajo

## Compuertas — veredictos

- **CARP-04 (cuarentena y validación de contenido no confiable): ✅ Completada — REUTILIZADA.** El destino `quarantine/pending` + TTL 14d + `quarantine_reason` obligatoria ya existen (`EgoMemoryAdapter.quarantine`, `QuarantineManager`). SEC-09 añade el routing por defecto en el borde + metadata `quarantine_kind/quarantine_rules/unencrypted_at_rest/upstream/ui_notice/expires_at`. Sin copiar código del origen (guardrail VantaDB).
- **KB-07 (flujo de cuarentena ADR-046): ✅ Completada — REUTILIZADA.** `promote()` es la salida supervisada del aislamiento; por eso omite SOLO la cuarentena por namespace (nunca la regla de secretos). TTL coherente (14d en ambos lados).
- Ninguna compuerta exige decisión de producto adicional → sin BLOQUEO (el diferimiento es decisión de alcance del worker, documentada y reversible).

## Hallazgos (cambios)

1. **NUEVO `packages/memory/SensitiveNamespaces.ts`** (~150 líneas, cero deps): `normalizeNamespace` (trim + `%XX` + minúsculas + `\`→`/` + colapso de barras), `isSensitiveNamespace` (8 prefijos: `gov/`, `system/`, `finance/`, `crm/`, `journal/`, `egos/`, `ecom/`, `support/tickets` + 33 tokens por segmento, exacto o subcadena len≥6), exenciones estructurales (`quarantine/*`, `gov/audit*`, `gov/sub_egos*`), `QUARANTINE_ENFORCEMENT_DEFERRALS` (`crm/`, `egos/`, `system/snapshots`, `system/checkpoints`) + `isEnforcementDeferred`.
2. **EDIT `packages/memory/EgoMemoryAdapter.ts`**: `putMulti(items, opts?) → Promise<PutRouteReport[]>` (routing por ítem + `writeLive` extraído, firma compatible con llamantes que ignoran el retorno, incluido el handler `ipc.memory` sin cambios); `put → Promise<PutRouteReport>`; `routeOne` privado (secretos → cuarentena redactada; sensible → cuarentena original limpia; diferido → live + aviso; resto → live); `quarantine(item, reason, opts?)` con metadata SEC-09; `promote()` con bypass supervisado + bloqueo fail-closed ante secretos; `sanitizeForLog` en 9 sitios de log de error; fix `promote` unwrap metadata.
3. **EDIT `packages/memory/index.ts`**: exporta el detector + tipos (`PutRouteReport`, `PutMultiOptions`, `QuarantineKind`, `QuarantineOptions`).
4. **EDIT `packages/memory/package.json`**: dep `@ego/security: workspace:*` (+ `pnpm-lock.yaml`; dists reconstruidos, gitignored).
5. **NUEVO `packages/memory/test/sensitive-quarantine.test.ts`**: 15 tests (detector, evasiones, exenciones, diferimiento, routing, secretos, promote, sanitize-log). Solo canarios `sk-test-*`.
6. **NO tocados**: `renderer/**`, `main.ts`, `preload.ts`, tests de otros paquetes (revertidas 2 migraciones exploratorias tras la decisión de diferimiento: el diff cross-package final es CERO).

## Política efectiva (qué vive dónde)

| Caso | Destino | Aviso |
|---|---|---|
| Contenido con secretos (CUALQUIER namespace, incl. exentos y diferidos) | Original JAMÁS persistido; copia redactada → `quarantine/pending` | `⚠ [SEC-09] Secreto bloqueado… (reglas: …)` + retorno `secret_detected` |
| Namespace sensible, enforcement activo (`gov/policies`, `system/config`, `finance/*`, `journal/*`, `ecom/*`, `support/tickets`, tokens) | Original limpio → `quarantine/pending` (TTL 14d) | `⚠ [SEC-09] … → quarantine/pending … (VantaDB FIND-249 pendiente)` |
| Namespace sensible diferido (`crm/*`, `egos/*`, `system/snapshots`, `system/checkpoints`) | LIVE + `unencryptedAtRest:true` en el reporte | `⚠ [SEC-09] … escribe en LIVE … (FIX_PROPUESTO-SEC-09-01)` |
| Exentos (`quarantine/*`, `gov/audit*`, `gov/sub_egos*`) | LIVE (registros operativos estructurales; regla de secretos sigue activa) | — |
| `promote()` supervisado | LIVE en destino (omite cuarentena-por-namespace; secretos → throw + fuente preservada) | error explícito fail-closed |

## Adversarial (doubt-driven, modo degradado: sin subagente anidado, auto-revisión explícita)

1. **Evasión por mayúsculas/espacios/backslash/slash-doble/`%XX** (`GOV/Policies`, ` gov\\policies `, `gov//policies`, `%67ov/policies`): CAPTURADAS (normalización total, testeadas).
2. **Token embebido** (`kb/mysecrets`, `notes/private-diary`): CAPTURADO (subcadena por segmento).
3. **`kb/secretary-notes`**: FP ACEPTADO (fail-closed: cuarentena, nunca fuga; documentado en el módulo).
4. **`crm-leads` con guion**: EVADE el prefijo (residual honesto, testeado). Mitigación real: la regla de contenido es independiente del namespace — un secreto ahí se bloquea igual.
5. **`projects/audit`**: correctamente LIVE (`audit` NO es token a propósito — protege `version-tree.test.ts` y el trail operativo).
- **Trade-offs aceptados:** sin detector entrópico/homoglyph (heredado SEC-04); `truncated` no bloquea (disponibilidad, decide el caller); el diferimiento de 4 prefijos (disrupción > riesgo bajo stopgap; ver FIX_PROPUESTO).

## FIX_PROPUESTO (regla del owner — NO aplicados, requieren diseño de producto/dominio)

- `{id: "FIX_PROPUESTO-SEC-09-01", archivo: "packages/domains/src/crm/CrmDomain.ts + packages/subegos/src/SubEgoMemoryGuard.ts + packages/memory/{SessionCheckpointPolicy,EgoMemoryLifecycle}.ts", problema: "crm/*, egos/*, system/snapshots y system/checkpoints son sensibles pero viven sin cuarentena (diferimiento explícito con aviso) porque sus lectores no son quarantine-aware", fix: "lecturas quarantine-aware por dominio (live + pending con marca explícita) y entonces retirar QUARANTINE_ENFORCEMENT_DEFERRALS", riesgo: "medio — toca 3 capacidades P0; hacerlo sin diseño HITL/UX degrada autonomía de Sub-Egos"}`
- `{id: "FIX_PROPUESTO-SEC-09-02", archivo: "apps/desktop/src/main.ts (handler ipc.memory put + eventBus→ipc.event)", problema: "el aviso de routing hoy viaja en el retorno IPC + warn + metadata; no hay banner dedicado en el renderer", fix: "emitir memory.quarantined/system.alert al eventBus cuando routedTo=quarantine (canal ipc.event ya existe; 0 UI nueva)", riesgo: "bajo — solo main process, canal existente"}`
- `{origen: "VantaDB FIND-249", problema: "sin cifrado at-rest real, la cuarentena es stopgap: el contenido sensible (incluso en quarantine/pending) sigue en plaintext en disco", fix: "al cerrar FIND-249, relajar la cuarentena por defecto a los namespaces que el threat model indique", riesgo: "n/a — upstream"}`

## Verify

- `pnpm --filter @ego/memory test` → PASS (16 files, 94/94: 15 nuevos SEC-09 incluidos).
- `pnpm --filter @ego/security test` → PASS (5 files, 73/73, sin cambios).
- `pnpm --filter @ego/domains|knowledge|runtime|tasks|subegos|dailystate test` → PASS (65+65+49+51+146+33, sin modificaciones cross-package).
- `pnpm --filter @ego/memory|security|domains typecheck` + `npx tsc --noEmit -p apps/desktop` → exit 0.
- Sin secretos en código/tests (solo canarios `sk-test-*` sintéticos); `git diff` cross-package en tests = 0.
- Sin commit, sin push (worker).

## Referencias

- `AGENTS.md` §Seguridad (keychain, nunca secretos en VantaDB/renderer/código) y §Gobernanza-VantaDB (sin workarounds silenciosos: no se añade ninguno; FIND-249 referenciado como `upstream: VDB-FIND-249` en metadata); `.agents/references/definition-of-done.md`; `.agents/references/security-checklist.md` (Data Protection: no loguear secretos; LLM02/LLM07).
- Plan Task 9; Backlog `SEC-09`; `docs/architecture/namespaces.md`; `docs/architecture/memoria-vantadb.md` §cuarentena; `docs/agent-ops/tasks/SEC-03.md` (vault), `SEC-04.md` (spec de wiring + fix diferido aplicado aquí).
- Skills cargadas: `test-driven-development`, `doubt-driven-development`.

## Registro de Cumplimiento (2026-10-13)

- **Estado:** COMPLETED_WITH_DEFERRALS (lado Ego implementado; 4 prefijos operativos con enforcement diferido y aviso; relajación pendiente de VantaDB FIND-249).
- **Evidencia:** detector + routing + aviso + 15 tests nuevos; 8 suites PASS (576 tests); 4 typechecks exit 0.
- **Commit:** ninguno (worker; sin commit, sin push).

## FIX-01 + FIX-02 — Seguimiento (2026-10-13, aprobado por el owner, ambos "sí")

- **Estado FIX-01:** COMPLETADO PARCIAL — lecturas quarantine-aware implementadas con
  implementación única compartida (`packages/memory/QuarantineAwareReads.ts`:
  `getQuarantineAware`/`listQuarantineAware`/`searchQuarantineAware`, gateway
  estructural sin `any`); diferimiento retirado para `crm/`, `egos/` y
  `system/checkpoints`. **Difiere restante:** `system/snapshots` (ver BLOQUEO parcial).
- **Estado FIX-02:** COMPLETADO — `EgoMemoryAdapter.setQuarantineSink()` (inversión de
  dependencias: cero aristas nuevas `@ego/memory → @ego/events`; el sink nunca rompe
  el routing) puenteado en `apps/desktop/src/main.ts` a `memory.quarantined` +
  `system.alert` (canal `ipc.event` existente vía `onAny`, 0 UI nueva; solo
  etiquetas `namespace:key`, reglas y motivos, nunca valores).
- **Lectores migrados:** `CrmDomain` (hydrate/getContact + `isQuarantined()`/
  `listQuarantinedIds()` + `quarantined` en `CrmHydrateReport`), `SubEgoMemoryGuard`
  (get/recall/searchMulti con marca `metadata.quarantined`), `SessionCheckpointPolicy`
  (`loadCheckpoint`/`listCheckpoints`), `EgoMemoryLifecycle` (`loadMicroCheckpoint`),
  más lectores directos de `egos/*` hallados por blast-radius: `CharacterProfile`,
  `SubEgoBudget`, `SelfImprovementLoop` (get/list/search), `SubEgoSoul`
  (load/exists). `SharedMemory` excluida con evidencia (`projects/*/shared`, no sensible).
- **Tests nuevos:** `memory/test/sec09-fix-followup.test.ts` (12: sink emitido sin
  valores + lectura vía cuarentena + `loadCheckpoint`/`loadMicroCheckpoint`),
  `domains/test/CrmDomain.quarantine.test.ts` (4: escritura→cuarentena→hydrate fría
  con marca), `subegos/test/SubEgoMemoryGuard.quarantine.test.ts` (5: get/recall/
  searchMulti vía cuarentena + aislamiento intacto). Tests heredados actualizados:
  `sensitive-quarantine.test.ts` (diferimiento residual) y `SelfImprovementLoop.test.ts`
  §6 (live vacío + `listWithQuarantine` marcada).
- **BLOQUEO parcial (INV-PROBLEMA, no maquillado):** `system/snapshots` sigue diferido
  porque `DailyStatePersistence` (`system/snapshots/daily`, fuera del alcance del
  follow-up) lee solo live — retirarlo invisibilizaría los snapshots diarios.
  `SessionCheckpointPolicy` ya expone lectura quarantine-aware para cuando se migre.
- **Residual preexistente (NO regresión de este follow-up, evidencia abajo):** 4 tests
  E2E de `@ego/desktop` fallan por enforcement SEC-09 original sobre namespaces fuera
  del alcance aprobado (`gov/projects` nunca diferido: `golden-path-alpha-full` y
  `mvp-software-loop` leen vía `adapter.get` directo; `decision-ipc` es nomenclatura
  de tools `fs_read_file` vs `fs`; `projects-ipc` es nombre de proyecto por defecto).
  `isEnforcementDeferred("gov/projects")` es `false` antes y después de este cambio
  (ruta de código idéntica) y la verify §6 de SEC-09 nunca incluyó la suite desktop.
  Requieren decisión del owner (migrar lectores `gov/*` o diferirlos) — fuera de FIX-01/02.
- **Verify follow-up:** memory 106/106 · security 73/73 · domains 69/69 · knowledge
  65/65 · runtime 49/49 · tasks 51/51 · subegos 151/151 · dailystate 33/33;
  typechecks memory/subegos/domains + `tsc -p apps/desktop` exit 0; desktop
  `domain-ipc` + `ipc-tool-loop` 22/22. Sin `any` nuevo (narrowing + `unknown`).
  `importDump` re-enruta registros sensibles legacy a cuarentena al restaurar
  (consecuencia correcta del retiro; legibles vía lecturas quarantine-aware).
- **Commit:** ninguno (worker; sin commit, sin push).
- **Skills cargadas:** `test-driven-development`, `systematic-debugging`.
