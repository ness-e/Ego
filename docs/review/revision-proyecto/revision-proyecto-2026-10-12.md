# Revisión paralela del proyecto Ego — Reporte completo — 2026-10-12

**Fecha:** 2026-10-12
**Carpeta:** `docs/review/revision-proyecto`
**Archivo único:** `revision-proyecto-2026-10-12.md` (este archivo reemplaza los fragmentados)
**Método:** 5 subagentes en paralelo por partes (orquestación estilo `unified-review`).
**Archivos revisados:** ~174
**Hallazgos totales:** ~88 (10 Critical P0 / 31 High P1 / 33 Medium P2 / 14 Low P3)

## Estado de resolución (actualizado 2026-10-12)

| Hallazgo | Estado | Evidencia / Plan |
|---|---|---|
| C01 tool-calling descartado | ✅ Cerrado | Test contrato + fix + adapters AI SDK; commits `e4f37b9,54a6a8c,4ebb592,b90edb8,a5e31fa,46c0322,86f401a,59978b8,d4fc2d7` + ESM `51acf7d`; verificado en `pnpm dev` real |
| C02 contrato `get()` | ✅ Cerrado | Plan `2026-10-12-c02-get-envelope.md` 7/7; envelope + unwrap + 86 callers + M13; commits `1c86755,33025c8,8a8a2e6,5f13137,c67aa20,c80fb88` |
| C03-list (`list()` tagged) | ✅ Cerrado | Plan `2026-10-12-c03-list-unwrap.md` 6/6; commits `b54037b,360a0af,02bd576,ac6e8ff,e759d28,315dc3a`; deuda legacy → `EGO-FIND-01` |
| C05 typecheck security | ✅ Parcial | Campo muerto eliminado + tests mínimos (commit `96e582a`); cifrado real sigue en F1T1 |
| Resto (C03-M12, C04, C06-C10, H, M, L) | ⏳ Planeado | Plan maestro `2026-10-12-plan-maestro-hallazgos.md` (13 tasks F1T1–F6T13) + taskfiles en `docs/agent-ops/tasks/` |
| EGO-FIND-01 dumps legacy | 🆕 Registrado | Fila en Backlog (Hallazgos pendientes), sin tocar Estados |

## Partes revisadas

| Parte | Alcance | Archivos |
|-------|---------|----------|
| 1/5 Core | `packages/runtime,execution,tools,tool-call-repair,events,models,decision` | 65 |
| 2/5 Memoria | `packages/memory,knowledge,integrations,domains` | 57 |
| 3/5 Tasks-Seguridad | `packages/tasks,dailystate,subegos,recovery,security,ui-runtime` | 78 |
| 4/5 Desktop | `apps/desktop + tsconfig.base + pnpm-workspace + ci.yml` | 24 |
| 5/5 Docs | `docs/, AGENTS.md, README, Preguntas y respuestas, scripts/, tests/, ci.yml` | 24 |

> Nota: los conteos por parte se solapan en config raíz, por eso suman >174 únicos.

## Verificación de deuda aceptada (global)

Para cada hallazgo se verificó si era deuda aceptada/descartada formalmente:

- Búsqueda en `docs/roadmap/Backlog.md` de `🚫 Descartada`, `aceptad*`, `wontfix`: solo aparece la definición del proceso (`Backlog.md:53`), 0 descartes reales para estos IDs.
- Búsqueda en `docs/VANTADB-FEEDBACK-Y-MEJORAS.md`: registrados `VDB-BUG-01..05, VDB-INC-01..03, VDB-REQ-01..07` como upstream, pero **los workarounds en código que los usan sin citar `// Workaround: VDB-XXX` violan `AGENTS.md:157`** y no cuentan como aceptados.
- `git status`: `packages/security/` untracked, sin entrada en Backlog que lo ampare.
- Conclusión: **ningún hallazgo de este reporte consta como deuda aceptada**. Todos son deuda abierta.

## Cómo leer cada ficha

1. **Referencia** `archivo:línea`
2. **Qué se encontró** (hecho observable)
3. **Por qué es un problema** (impacto técnico / riesgo / guardrail violado)
4. **Cómo verificarlo** (qué leer / qué comando)
5. **Recomendación**
6. **Deuda aceptada:** Sí/No + evidencia

## Estado de verificación dinámica

Revisión estática (lectura + análisis de tipos/imports/config). Solo se contempló `tsc --noEmit` puntual en desktop. No se ejecutó `pnpm build/test` completo en esta pasada. Los hallazgos marcados como "rompe typecheck/build/CI" son por lectura de código + contrato, pendientes de confirmación con un run (`pnpm typecheck`, `pnpm -r test`) antes de corregir.

---

# P0 — Critical (10)

> Prioridad: corregir antes de cualquier release / antes de marcar fases como completadas.
> Verificación deuda: ninguno consta como `🚫 Descartada` ni deuda aceptada en `Backlog.md` ni en `VANTADB-FEEDBACK-Y-MEJORAS.md`.

---

## C01 — Tool-calling descartado en proveedor OpenAI-compatible
**Ref:** `packages/models/src/providers/OpenAICompatibleProvider.ts:45`

**Qué se encontró:**
`generate()` y `stream()` construyen el payload a `/chat/completions` sin mapear `options.tools` ni `options.toolChoice`, y no parsean `message.tool_calls` de la respuesta. El `ToolExecutionLoop` sí prepara los schemas, pero el provider los tira.

**Por qué es un problema:**
Todo el diseño Fase 02 (tool calling + ExecutionManager + approval) depende de que el modelo devuelva llamadas estructuradas. Si el provider las descarta en silencio, el sistema parece funcionar (responde texto) pero jamás ejecuta herramientas vía modelo real. Solo funciona con `MockProvider` o reparación de texto plano, lo que enmascara el fallo en dev y rompe en producción con cualquier proveedor OpenAI-compatible.

**Cómo verificarlo:**
Leer `OpenAICompatibleProvider.ts` función `generate/stream`, buscar `tools` en el payload. Comparar con `MockProvider` que sí retorna `ToolCall[]`. Test: pasar `options.tools=[{name:"fs_read_file",...}]` y comprobar que el request HTTP no contiene `tools`.

**Recomendación:**
Mapear `options.tools` a `payload.tools=[{type:"function",function:{name,description,parameters}}]`, pasar `tool_choice`, y parsear `choices[0].message.tool_calls` a `ToolCall[]`. Acumular deltas SSE en `stream()`. Añadir test de contrato provider-real vs mock.

**Deuda aceptada:** No. Sin entrada en Backlog ni ADR que lo ampare.

---

## C02 — Contrato `get()` vs `{payload,metadata}` roto
**Ref:** `packages/memory/EgoMemoryAdapter.ts:165` ; llamadores `KnowledgeIndexer.ts:51,140`, `FactLifecycle.ts:31,111`, `ProjectMemoryGraph.ts:93`

**Qué se encontró:**
`EgoMemoryAdapter.get(key)` retorna `unknown` = payload parseado. Los 5 llamadores lo castean a `{payload,metadata}` y leen `.metadata.content_hash`, `.metadata.*`. `metadata` siempre `undefined`.

**Por qué es un problema:**
La idempotencia por `content_hash` nunca acierta → cada reindex duplica chunks en `kb/docs`. `promote/supersede` leen metadatos inexistentes → cuarentena y ciclo de vida operan a ciegas. Es corrupción lógica silenciosa, no un crash visible.

**Cómo verificarlo:**
Leer `EgoMemoryAdapter.get()` y un llamador, ej. `KnowledgeIndexer.ts:46-60`. Ver que `existing.metadata` es acceso sobre payload. Test: `put` con metadata, luego `get` y comprobar que no hay envoltorio.

**Recomendación:**
Cambiar `get()` a envoltorio `{key,payload,metadata}` o añadir `getRecord()`. Corregir los 5 llamadores. Test de contrato `get-vs-list`.

**Deuda aceptada:** No.

---

## C03 — Metadatos etiquetados sin desenvolver en lectores bitemporales
**Ref:** `packages/knowledge/src/BitemporalQueries.ts:40` ; también `QuarantineManager.ts:62`, `FactLifecycle.ts:40`, `KnowledgeIndexer`

**Qué se encontró:**
Por `VDB-BUG-02/04` el adapter guarda metadata como tagged `{Float:v,String:v,Bool:v,'Null'}`. Los lectores hacen `meta['valid_at'] as number` directo, sin `unwrap`.

**Por qué es un problema:**
Con metadata etiquetada el valor es objeto, no número → cae al fallback (`valid_at=0`, `confidence=0.8`). `asOf()`, `listPending()`, `promote()` reconstruyen historia incorrecta. La capa bitemporal (Fase 06) miente.

**Cómo verificarlo:**
Leer `EgoMemoryAdapter.ts:72` (etiquetado) y `BitemporalQueries.ts:33-50` (lectura directa). Test con `put` real y `asOf(now)`.

**Recomendación:**
Exportar `unwrapMetadata()` del adapter (o helper compartido) y usarlo en todos los lectores. Test con metadata tagged real. Registrar trazabilidad `// Workaround: VDB-BUG-02`.

**Deuda aceptada:** No. `VDB-BUG-02/04` registrados upstream, pero el desenvolver faltante no está aceptado.

---

## C04 — Paquete `@ego/security` muerto y sin cablear
**Ref:** `packages/security/package.json:5` (paquete untracked `?? packages/security/`)

**Qué se encontró:**
`git status` muestra `packages/security/` sin trackear. `main` apunta a `./dist/index.js` inexistente (sin `src/index.ts`). Grep de `@ego/security` en `packages/*` y `apps/*`: 0 importadores.

**Por qué es un problema:**
Es código que parece capacidad de seguridad pero no existe para el build. Cualquier plan que asuma "Fase 11 usa `@ego/security`" es falso. Además ensucia el workspace y confunde la revisión.

**Cómo verificarlo:**
`git status --short`, `ls packages/security/src`, `grep -r "@ego/security" packages apps`.

**Recomendación:**
O crear `src/index.ts` que exporte `CredentialManager`, verificar `build`, y referenciarlo desde `apps/desktop`, o eliminar el paquete si la implementación queda en `main.ts`.

**Deuda aceptada:** No.

---

## C05 — `typecheck` roto en `@ego/security`
**Ref:** `packages/security/src/CredentialManager.ts:25` — `TS6133 'key' declarado nunca leído`

**Qué se encontró:**
El constructor genera `key` y lo ignora. `tsc` con `noUnusedLocals` falla.

**Por qué es un problema:**
Rompe `pnpm typecheck` y `pnpm build` del workspace. Bloquea CI si se incluye el paquete. Señala cifrado incompleto (se genera clave y no se usa).

**Cómo verificarlo:**
`pnpm --filter @ego/security typecheck`.

**Recomendación:**
Eliminar el campo o usarlo en cifrado real (XOR/AES-GCM con `sessionKey`).

**Deuda aceptada:** No.

---

## C06 — Cifrado falso (base64 `obf:`)
**Ref:** `packages/security/src/CredentialManager.ts:35` + `apps/desktop/src/main.ts:271` (fallback mismo patrón)

**Qué se encontró:**
`encrypt` retorna `obf:` + base64 reversible, no cifrado.

**Por qué es un problema:**
Da falsa sensación de seguridad. Cualquiera decodifica la "API key cifrada". Viola el guardrail "credenciales en keychain/safeStorage, nunca en claro/ofuscado".

**Cómo verificarlo:**
Leer `InMemoryCryptoBackend.encrypt/decrypt`. Decodificar un valor con `atob`.

**Recomendación:**
Marcar clase como solo-test con warning explícito. Proveer `SafeStorageBackend` real que delegue a `Electron safeStorage` (como ya hace `main.ts:258-291`). En `main.ts:271` mostrar advertencia UI cuando se usa fallback y reintentar con safeStorage al arrancar.

**Deuda aceptada:** No.

---

## C07 — `isHardwareProtected()` miente
**Ref:** `packages/security/src/CredentialManager.ts:66`

**Qué se encontró:**
Retorna `backend.isAvailable()`, que en memoria siempre es `true`.

**Por qué es un problema:**
La UI/política puede asumir protección hardware y relajar controles. Es un falso positivo de seguridad.

**Cómo verificarlo:**
Leer `InMemoryCryptoBackend.isAvailable()`.

**Recomendación:**
Retornar `false` en backend memoria; exponer `hardwareBacked` real según `safeStorage.isEncryptionAvailable()`.

**Deuda aceptada:** No.

---

## C08 — Vault en memoria sin persistencia
**Ref:** `packages/security/src/CredentialManager.ts:56`

**Qué se encontró:**
Secretos en `Map` local, sin `put` a VantaDB ni archivo cifrado ni keychain.

**Por qué es un problema:**
Al reiniciar se pierde todo. `CredentialManager` no cumple su propósito. Si `apps/desktop` llegara a usarlo, login/API keys pedirían reingreso cada arranque.

**Cómo verificarlo:**
Buscar `persist/save/load` en el archivo: ausentes.

**Recomendación:**
Persistir vía safeStorage/archivo cifrado o documentar como sesión efímera y cablear con `main.ts` que ya persiste.

**Deuda aceptada:** No.

---

## C09 — Tests E2E huérfanos, nunca corren
**Ref:** `tests/e2e/golden-path-alpha.test.ts:1` (6 en `tests/e2e/` +1 en `tests/chaos/`)

**Qué se encontró:**
Sin `package.json` propio, `pnpm-workspace.yaml` solo incluye `apps/**,packages/**`. `pnpm -r test` y CI jamás los ejecutan.

**Por qué es un problema:**
Las suites Golden Path Alpha/Beta que el Backlog marca ✅ no corren en ningún pipeline. La marca ✅ es falsa confianza. Regressions en flujo completo pasan inadvertidas.

**Cómo verificarlo:**
`cat pnpm-workspace.yaml`, `cat package.json:18`, `ls tests/e2e`, `cat .github/workflows/ci.yml` (sin step E2E raíz).

**Recomendación:**
Añadir `tests/**` al workspace con su `package.json` (vitest) o mover E2E a un paquete `tests`, y agregar step en `ci.yml`. Renombrar `test:e2e` actual (corre `@ego/memory`) a `test:memory`.

**Deuda aceptada:** No.

---

## C10 — Links rotos en planes a `docs/extractions/`
**Ref:** `docs/agent-ops/plans/2026-10-09-fase-04-dynamic-workspace.md:30` (+6 planes, ~40 instancias)

**Qué se encontró:**
Enlazan `docs/extractions/hermes-agent.md` con ruta relativa a raíz. Resueltos desde `docs/agent-ops/plans/` apuntan a `plans/docs/extractions/...` inexistente.

**Por qué es un problema:**
Toda la evidencia de compuertas Opción B (inspección previa) queda ilocalizable. Un revisor no puede verificar que la extracción se hizo. `scripts/fix_links.py` solo cubre `Ver docs/prd/`, no este caso.

**Cómo verificarlo:**
Abrir cualquier plan Fase 04/07/10, clic en link extractions, o `grep -r "docs/extractions" docs/agent-ops/plans`.

**Recomendación:**
Reescribir a `../../extractions/...` o rutas absolutas desde raíz. Extender `fix_links.py`.

**Deuda aceptada:** No.

---

# P1 — High, parte 1: Core + Memoria (H01–H10)

## H01 — Colisión de tipos `AdmittedRunContext`
**Ref:** `packages/execution/src/AdmittedRunContext.ts:27` vs `packages/decision/.../verdict.ts`
**Qué:** execution define `{operationalRunInstance,admissionSource,executionIdentityToken,...}`, decision define `{runId,timestamp,depth,origin}`. `ExecutionOptions.admittedRunContext` usa el primero; veredictos producen el segundo.
**Por qué:** imposible pasar contexto decisión→ExecutionManager sin conversión manual. Riesgo de bypass de admisión o crash de tipos en integración Fase 02/05. Es incompatibilidad de contratos entre dos capas que deben hablarse: si alguien intenta conectar el veredicto de decisión con el manager de ejecución, TypeScript lo rechaza o se hace un cast inseguro.
**Verificar:** leer ambos archivos, buscar `AdmittedRunContext` en `ExecutionManager` y `DecisionRouter`.
**Recomendación:** renombrar (`DecisionAdmittedRunContext` vs `ExecutionAdmittedRunContext`) o unificar en tipo canónico + adaptador.
**Deuda:** No.

## H02 — Nombres de herramientas inexistentes desde clasificador
**Ref:** `packages/decision/src/IntentClassifier.ts:112` (+`DeterministicRules`)
**Qué:** emite `['fs','git','terminal']`, reales son `fs_read_file,fs_write_file,git_status,git_diff,terminal_exec`. `SubEgoSelector` filtra por intersección exacta.
**Por qué:** `allowedTools` queda vacío aunque haya Sub-Ego capaz; `DecisionVerdict.toolsEnabled` porta nombres inejecutables. Delegación Fase 03 rota en silencio: el router cree que ningún subagente puede atender, aunque sí pueda.
**Verificar:** `grep -n "suggestedTools|candidate.tools" packages/decision/src`, comparar con `registerNativeTools` en `packages/tools`.
**Recomendación:** emitir nombres canónicos o mapa alias→nombre + test de coherencia contra registry.
**Deuda:** No.

## H03 — Evento `metrics.turn` fuera de contrato
**Ref:** `packages/decision/src/Telemetry.ts:53` (`as unknown as any`)
**Qué:** `record()` emite `metrics.turn` inexistente en `EgoEventType`/`CanonicalEventPayloadMap`, con cast `any` prohibido por `AGENTS.md`.
**Por qué:** telemetría fuera de contrato no es validada por `EventBus`; consumidores tipados la pierden; el `any` oculta el error al compilador. Además sienta precedente de saltarse el contrato de eventos.
**Verificar:** leer `Telemetry.ts:53` y `packages/events` tipos.
**Recomendación:** añadir evento + payload al mapa canónico, eliminar cast.
**Deuda:** No.

## H04 — `getDb()` expone motor crudo
**Ref:** `packages/memory/EgoMemoryAdapter.ts:83`
**Qué:** getter retorna `NativeVantaDB` directo.
**Por qué:** cualquier consumidor salta normalización, auditoría, cuarentena y el guardrail "todo por adapter". Hace inútil el gateway único: dos caminos distintos escriben con reglas distintas y los datos divergen.
**Verificar:** `grep -rn "getDb()" packages apps`.
**Recomendación:** eliminar o devolver handle read-only; auditar llamadores.
**Deuda:** No.

## H05 — Dependencias VantaDB irreproducibles + WASM presente
**Ref:** `packages/memory/package.json:24-26`, `apps/desktop/package.json:29-30`
**Qué:** `vantadb:0.8.0` + `vantadb-node:file:../../../VantaDB/vantadb-node` (ruta fuera del repo). Código importa `vantadb/native` y `vantadb/types`. Existe `node_modules/vantadb-wasm` no declarado (binding prohibido).
**Por qué:** instalación no portable; CI usa stub ficticio (`ci.yml:29-65`) y nunca verifica binding real; WASM viola "solo NativeVantaDB napi-rs". En otra máquina `pnpm install` falla o resuelve otro binario.
**Verificar:** `cat packages/memory/package.json`, `ls packages/memory/node_modules | grep vanta`, `cat ci.yml`.
**Recomendación:** una sola dep canónica versionada con subpaths `./native,./types`, eliminar `file:` y desinstalar/bloquear wasm. Documentar en `readiness-plan`.
**Deuda:** No.

## H06 — `KnowledgeDomain` con schema incompatible
**Ref:** `packages/domains/src/knowledge/KnowledgeDomain.ts:5`
**Qué:** define `KnowledgeFactSchema {claim,source,tags,verified,fechas ISO}` vs `Fact` canónico `{subject,predicate,object,validAt,state}`. Escribe `kb/facts` con `JSON.stringify` sin metadata.
**Por qué:** lectores bitemporales/cuarentena no parsean estos hechos. Dos fuentes de verdad divergen: lo que escribe dominios no lo entiende knowledge.
**Verificar:** comparar `KnowledgeDomain.ts:5-40` con `packages/knowledge/src/schemas/knowledge.ts`.
**Recomendación:** migrar a `indexFact/adapter.put` con metadata tipada.
**Deuda:** No.

## H07 — Dominios sin rehidratación (pérdida en reboot)
**Ref:** `packages/domains/src/knowledge/KnowledgeDomain.ts:101`, `CrmDomain.ts:46-48`, `ProductDomain.ts:43-45`
**Qué:** facts en `Map` memoria, VantaDB espejo write-only. `getFact/searchKnowledge/synthesize` solo leen `Map`; `searchKnowledge` ni llama a `HybridSearch`.
**Por qué:** tras cold reboot se pierde todo. Viola "toda feature = persistencia". El usuario cree que guardó conocimiento/CRM/producto y al reiniciar desapareció.
**Verificar:** buscar `load/hydrate/list(` en esos dominios: ausentes.
**Recomendación:** `load/hydrate` desde `adapter.list()` al arrancar; leer de VantaDB o eliminar `Map`. Test cold-reboot por dominio.
**Deuda:** No.

## H08 — `SessionTimelineRewind` sin persistencia
**Ref:** `packages/memory/SessionTimelineRewind.ts:169`
**Qué:** turns/branches en objeto local, `getState()` dice "para serialización en VantaDB" pero sin `put/get`.
**Por qué:** rewind/branches se pierden al cerrar. Misma violación de persistencia. El comentario promete durabilidad que el código no implementa.
**Verificar:** `grep -n "adapter.put|adapter.get" packages/memory/SessionTimelineRewind.ts` → 0.
**Recomendación:** `saveTimeline/loadTimeline` vía adapter (`session/timelines`) en `appendTurn/rewindToTurn`, o documentar como efímera.
**Deuda:** No.

## H09 — Fallback silencioso anula umbral anti-alucinación
**Ref:** `packages/knowledge/src/HybridSearch.ts:54`
**Qué:** si el filtro descarta todo, usa `rawHits.slice(0,topK)` sin filtrar. RRF ficticio (una lista reordenada `1/(60+rank)`, sobrescribe BM25).
**Por qué:** derrota guarda KHOJ-03; devuelve lo que el filtro consideró malo sin avisar. Score original se pierde. El sistema anti-alucinación queda desactivado justo cuando más importa (cuando nada pasa el umbral).
**Verificar:** leer `HybridSearch.ts:40-70`.
**Recomendación:** eliminar fallback o exigir flag+log+`minConfidence=0`; RRF real multi-lista o renombrar a re-rank; preservar score.
**Deuda:** No.

## H10 — Umbral coseno sobre BM25
**Ref:** `packages/knowledge/src/filters/CosineThresholdFilter.ts:23`
**Qué:** umbral 0.70 pensado para coseno [0,1] aplicado a BM25 no acotado.
**Por qué:** corte arbitrario: filtra válidos o deja pasar ruido según escala del índice. BM25 típico va de 0 a >10 según longitud/IDF; 0.70 no significa nada ahí.
**Verificar:** leer filtro + `HybridSearch` scores.
**Recomendación:** renombrar a `ScoreThresholdFilter`, calibrar contra distribución BM25 real o normalizar a [0,1]. Documentar en KHOJ-03.
**Deuda:** No.

---

# P1 — High, parte 2: Tasks, Desktop, Docs, Integraciones (H11–H31)

## H11 — `WorkerTaskPool` no usa workers
**Ref:** `packages/tasks/src/WorkerTaskPool.ts:86`
**Qué:** documentada como pool en worker threads (OCLW-10) pero ejecuta con `setImmediate` en hilo principal.
**Por qué:** cómputo pesado congela UI/main igual. Promesa de paralelismo falsa. Quien la usa para "no bloquear" sigue bloqueando.
**Recomendación:** renombrar a `LocalTaskPool` o migrar a `node:worker_threads`. **Deuda:** No.

## H12 — Timeout no libera slot + doble conteo
**Ref:** `packages/tasks/src/WorkerTaskPool.ts:80`
**Qué:** `reject` por timeout no saca de cola ni decrementa `activeWorkers`; al terminar el handler, `resolve+reject` incrementan ambos contadores.
**Por qué:** slots fugados, métricas mentirosas, capacidad degradada con el tiempo.
**Recomendación:** flag `timedOut`, remover de cola, ignorar resolución tardía. **Deuda:** No.

## H13 — `pause()` termina en `cancelled`
**Ref:** `packages/tasks/src/BackgroundEngine.ts:234`
**Qué:** `pause()` en running marca `paused` y aborta; `runTask` ve `aborted` y sobrescribe a `cancelled`. `resume()` nunca aplica.
**Por qué:** máquina de estados inconsistente, pausa imposible. El usuario pausa y el sistema cancela.
**Recomendación:** distinguir pausa de cancelación o flag cooperativo sin abort. **Deuda:** No.

## H14 — Fuga `activeRuns`
**Ref:** `packages/tasks/src/RunRecorder.ts:157`
**Qué:** `finishRun()` persiste pero nunca `delete`.
**Por qué:** crecimiento ilimitado + `getSnapshot()` devuelve finalizados como activos.
**Recomendación:** `activeRuns.delete(runId)` tras persistir o historial acotado. **Deuda:** No.

## H15 — Checksum decorativo
**Ref:** `packages/dailystate/src/DailyStatePersistence.ts:80`
**Qué:** ante mismatch solo `console.warn` y retorna registro manipulado válido.
**Por qué:** integridad SHA-256 inútil; corrupción se propaga como válida.
**Recomendación:** retornar `null`/lanzar + evento `system.alert`. **Deuda:** No.

## H16 — `applyChangeSet` miente en insert/delete
**Ref:** `packages/ui-runtime/src/CanvasBridge.ts:152`
**Qué:** solo `replace/update`; `insert/delete` sin mutación pero retornan `true` + emiten `canvas.mutation`.
**Por qué:** llamador cree aplicado. Divergencia canvas-estado silenciosa.
**Recomendación:** implementar o retornar `false`+warn. **Deuda:** No.

## H17 — Mock auto-aprueba
**Ref:** `packages/ui-runtime/src/MockIPCBridge.ts:85`
**Qué:** `approve/resolveApproval` retornan aprobado sin humano.
**Por qué:** valida en dev flujos HITL que en prod exigirían aprobación. Riesgo de probar seguridad contra stub permisivo y creer que el flujo es seguro.
**Recomendación:** documentar stub inseguro o modo `strict` que rechace. **Deuda:** No.

## H18 — `apiKey` en claro en bridge
**Ref:** `packages/ui-runtime/src/MockIPCBridge.ts:45`
**Qué:** `saveModelConfig({apiKey})` aceptada sin cifrar ni zod.
**Por qué:** modela patrón contra keychain/safeStorage. Si el preload real copia el mock, la key viaja en claro.
**Recomendación:** no transportar en claro; usar CredentialManager + zod. **Deuda:** No.

## H19 — Mock sin validación zod
**Ref:** `packages/ui-runtime/src/MockIPCBridge.ts:8`
**Qué:** `memory/llmStream/subegos/mcp` aceptan `unknown/any` sin esquemas.
**Por qué:** fija precedente contra IPC validado para el preload real.
**Recomendación:** validar con esquemas compartidos con `apps/desktop`. **Deuda:** No.

## H20 — Recovery con `any` + export sin paginar
**Ref:** `packages/recovery/src/ProjectExport.ts:15,61` (+`ProjectImport:16,SchemaMigrator:23,SnapshotManager:19,types.ts:157`)
**Qué:** `adapter:any`, métodos opcionales sin tipos; lista namespaces con límite único 50000.
**Por qué:** evade contrato `EgoMemoryAdapter`; OOM en main en DB grandes. Exportar 50k registros de golpe en el proceso Electron lo puede tumbar.
**Recomendación:** tipar `ExportableMemory`, paginar con cursor y streamear NDJSON. **Deuda:** No.

## H21 — Colisión evento daily
**Ref:** `packages/dailystate/src/DecisionsFeed.ts:117`
**Qué:** `recordDecision` emite `daily.state.synthesized`, mismo que `DailyStateEngine.synthesize`.
**Por qué:** dos hechos distintos mismo nombre rompen consumidores del bus. Un listener no distingue "se registró una decisión" de "se sintetizó el día".
**Recomendación:** `daily.decision.recorded`. **Deuda:** No.

## H22 — Background sin approval
**Ref:** `packages/tasks/src/BackgroundEngine.ts:94`
**Qué:** triggers proactivos y file-watch ejecutan sin hook permiso/aprobación. `@ego/security` no lo provee.
**Por qué:** gap Fase 11 (gobernanza). Automatismo sin gate: una tarea de fondo puede tocar filesystem/git sin pedir permiso.
**Recomendación:** policy hook `requiresApproval/riesgo` antes de handlers; documentar gap. **Deuda:** No.

## H23–H24 — Deps VantaDB en desktop (ver H05)
**Ref:** `apps/desktop/package.json:29,30`
**Qué:** `vantadb` WASM + `vantadb-node file:...` fuera del repo.
**Por qué:** viola guardrails, rompe reproducibilidad, CI con stub. Mismo root cause que H05 pero en app.
**Recomendación:** eliminar `vantadb` si sin import directo; versionar `vantadb-node`. **Deuda:** No.

## H25 — IPC muerto knowledge/decision
**Ref:** `apps/desktop/src/main.ts:1359`
**Qué:** 11+3 handlers sin puente en `preload.ts` ni tipos en `renderer/lib/ego.ts`, sin consumidores.
**Por qué:** Fases 06/DEC a medio cablear, superficie inalcanzable desde UI. Código muerto que amplía superficie IPC sin uso.
**Recomendación:** añadir a `contextBridge` + `EgoBridge` o eliminar handlers. **Deuda:** No.

## H26 — Ventana sin sandbox
**Ref:** `apps/desktop/src/windows/FloatingWindowPrototype.ts:41`
**Qué:** `nodeIntegration:false,contextIsolation:true` pero sin `sandbox:true` ni preload.
**Por qué:** viola `sandbox=true` exigido; aislamiento degradado. Una segunda ventana con menos aislamiento es el eslabón débil.
**Recomendación:** añadir `sandbox:true` + preload dedicado. **Deuda:** No.

## H27 — Q6,Q8,Q17 faltantes
**Ref:** `Preguntas y respuestas.txt:1` vs `AGENTS.md:4`
**Qué:** 22 secciones, faltan 3 de 25.
**Por qué:** trazabilidad Q→decisión rota. Si una decisión cita Q6/Q8/Q17 no se puede auditar.
**Recomendación:** restaurar o corregir conteo y citas. **Deuda:** No.

## H28 — Gates pendientes vs tareas ✅
**Ref:** `docs/roadmap/Backlog.md:151-153,239`
**Qué:** HERM-12,17,19 y COUC-15 🆕 pero SUB/CANV ✅.
**Por qué:** viola inspección previa mandatoria Opción B (`AGENTS.md:116-119`). Se marcó completitud sin cerrar compuertas.
**Recomendación:** cerrar/descartar formalmente con justificación o revertir estado. **Deuda:** No.

## H29 — CI parity gaps
**Ref:** `.github/workflows/ci.yml:68`
**Qué:** `--no-frozen-lockfile` vs frozen exigido; `test:e2e` nunca corre; `oxlint` sin pin; build sin gate typecheck independiente.
**Por qué:** CI no reproduce repo, no ejecuta E2E, no reproducible. Lo que pasa en CI no garantiza lo que pasa en local.
**Recomendación:** frozen, pinear oxlint, step E2E o eliminar script engañoso. **Deuda:** No.

## H30 — DIST-11/12 stale
**Ref:** `docs/roadmap/Backlog.md:486`
**Qué:** describen lint como `echo+typecheck` y dev como `electron .`, ambos falsos hoy.
**Por qué:** planifica sobre realidad vieja. Alguien que tome DIST-11/12 trabaja sobre supuestos falsos.
**Recomendación:** reescribir/cerrar. **Deuda:** No.

## H31 — MCP: error tragado + PAT en env + spawn sin allowlist
**Ref:** `packages/integrations/src/mcp/McpManager.ts:97`, `McpClient.ts:255`
**Qué:** `connectServer` retorna estado con `lastError` en vez de lanzar; token en `process.env`; `spawnProcess(command/args)` sin allowlist, `shell:true` posible.
**Por qué:** llamador asume éxito; credencial en env viola keychain; config maliciosa logra RCE. `overrideExisting:true` agrava porque una herramienta tercera puede sobrescribir nativa.
**Recomendación:** `Result` explícito, token vía Credential Manager/IPC, allowlist + prohibir `shell:true`, default `sensitive` auditado. **Deuda:** No.

---

# P2 — Medium (33)

Formato compacto: Ref | Qué | Por qué | Recomendación. Todos verificados **No es deuda aceptada**.

## Core / Modelos / Decisión

**M01** `packages/runtime/src/types.ts:32` ApprovalDecision duplicado (runtime `{approved,reason?,modifiedArguments?}` vs execution `{+resolvedBy?,timestamp?}`). Por qué: hoy compatibles, mañana divergen en silencio porque dos definiciones evolucionan por separado. → Definir una vez en `@ego/execution`, re-exportar.

**M02** `packages/runtime/src/types.ts:78,95` `errorHandler?: any` sin justificar (viola `any` prohibido). Por qué: oculta contrato de errores, el compilador no ayuda. → Tipar `ErrorHandler`.

**M03** `packages/decision/src/DecisionCascade.ts:102` Tier-2/fallback → `ego.nucleus` vs `DecisionRouter` → `pm/analyst/crm`. Por qué: dos rutas discrepan para mismos dominios; según qué camino se tome, el mismo dominio va a distinto subagente. → Tabla única dominio→subEgo.

**M04** `packages/models/src/ModelRouter.ts:60` salta provider no registrado en silencio, cae a mock. Por qué: mala config parece funcionar; en dev todo "anda" con mock y en prod falla. → `console.warn` + documentar registro de `OpenAICompatibleProvider`.

**M05** `packages/memory/package.json:24` `vantadb` + `vantadb-node file:` sin verificar subpaths `./native,./types`. Por qué: puede compilar contra paquete que no exporta lo usado. → Verificar exports, eliminar no usado, smoke test CI.

## Memoria / Knowledge

**M06** `packages/memory/EgoMemoryAdapter.ts:96` + `EgoMemoryLifecycle.ts:172` + `readiness-plan §2` afirman auto-embed ONNX. Por qué: contradice `VDB-INC-01` (BM25 puro, denso solo en `vantadb-mcp`) y `KnowledgeIndexer.ts:15`. Quien lee el comentario implementa asumiendo embeddings que no existen. → Corregir 3 textos.

**M07** `packages/memory/EgoMemoryAdapter.ts:175,187` `list()->[]`, `delete()->false`, `searchMulti` solo warn. Por qué: no distingue vacío de fallo motor; un fallo de disco parece "sin resultados". → Propagar `Result` o log estructurado + test fallo inyectado.

**M08** `packages/memory/SessionCheckpointPolicy.ts:40` `beforeModelStream` fail-open (warn) vs `beforeToolDispatch` fail-closed. Por qué: flush fallido pre-stream queda sin señalizar, inconsistente con la propia política del archivo. → Retornar `{proceed:false}` coherente.

**M09** `packages/memory/EgoMemoryAdapter.ts:145,706,576` + `EgoMemoryLifecycle.ts:100` 4-5 workarounds sin `// Workaround: VDB-XXX` (put→putBatch, cursor omit VDB-BUG-01, graph fallback, texto vacío VDB-BUG-05, puntuación VDB-REQ-03). Por qué: viola DoD gobernanza `AGENTS.md:157`; sin cita no hay trazabilidad a upstream. → Añadir citas + verificar registro.

**M10** `packages/knowledge/src/ProjectMemoryGraph.ts:85` `explainArtifact` limit 10 + N+1 puts sin batch/flush. Por qué: pierde trazas más allá de la ventana, sin atomicidad/durabilidad. → Paginar con cursor, `putMulti+flush`.

**M11** `packages/knowledge/src/FactLifecycle.ts:60` propaga meta etiquetada (doble `{Float:{Float}}`), borra cuarentena sin tx ni audit. Por qué: corrompe meta, crash deja duplicado (inserta nuevo y luego borra viejo sin transacción). → Desenvolver, auditar, documentar ventana.

**M12** `packages/knowledge/src/BitemporalQueries.ts:33` `asOf` pagina `limit*2` sin cursor, descarta `historical`, deriva `state` por fecha no almacenado. Por qué: historia parcial en namespaces grandes. → Cursor hasta agotar o exigir `VDB-REQ-06`, leer `state/is_latest`.

**M13** `packages/knowledge/src/KnowledgeIndexer.ts:46` idempotencia inútil por C02 + N gets sin flush. Por qué: duplica y sin durabilidad WAL. → Tras fix C02, batch + `flush`, test doble index.

**M14** `packages/knowledge/src/KnowledgeExport.ts:60` checksum `JSON.stringify` orden-dependiente + `lines[]` en RAM. Por qué: falla ante reorden inocuo, OOM en DB grandes. → Hash canónico + streaming.

## Integraciones / Dominios

**M15** Ver H31: endurecer `inferRiskLevel`, auditar `overrideExisting:true` en `McpManager.ts:90`. Por qué: una integración tercera no debe sobrescribir nativas sin gate explícito.

**M16** `packages/domains/src/engineering/WorktreeManager.ts:58`, `EngineeringDomain.ts:59,209` `execFile git` con `repoRoot/branchName/cwd` sin sanitizar ni approval. Por qué: path traversal + mutación git sin HITL. Un `branchName` como `../../x` o `; rm` (según cómo se pase) es riesgo. → Confinar a workspace, regex branch, approval.

## Tasks / Daily / Recovery / UI

**M17** `packages/security/src/CredentialManager.ts:145` `export/importVault` sin HMAC/version. Por qué: acepta esquemas manipulados o indescifrables. → Version+HMAC, rechazar si backend incompatible.

**M18** `packages/ui-runtime/src/MermaidRenderer.ts:104` `replace` sin `/g`. Por qué: solo primera ocurrencia de `<script>/javascript:` se limpia; múltiples sobreviven al sanitizado. → `replaceAll` + revalidar.

**M19** `packages/ui-runtime/src/MermaidRenderer.ts:119` interpola `tokens.*` en comillas sin escape. Por qué: token con `'` inyecta config Mermaid. → Validar hex/color o escapar.

**M20** `packages/tasks/src/ProactivityEngine.ts:157` fallback `includes` para globs. Por qué: falsos +/-, ej. `docs/**/*.md` casa mal. → Solo regex estricta o minimatch.

**M21** `packages/tasks/src/ProactivityEngine.ts:135` `*/step` como `(val-min)%step`. Por qué: desalineado cron para dom/month con `min!=0`. → `val%step===0` + tests.

**M22** `packages/recovery/src/OpGate.ts:78` `reset()` a 0 con ops en vuelo. Por qué: corrompe `drain`, oculta trabajo pendiente. → Solo si `inFlight===0` o solo-tests con drain.

**M23** `packages/tasks/src/BackgroundEngine.ts:181` `maxRetries!` + `runTask` fire-forget. Por qué: frágil a refactor, oculta rechazos si `runTask` llegara a lanzar. → Variable local + `void` con catch.

**M24** `packages/dailystate/src/DailyStateEngine.ts:42` + `DecisionsFeed` duplican `parseActorId`, rama `.String` sospechosa. Por qué: deriva entre ambas; la rama `.String` (objeto con campo String mayúscula) huele a tipo VantaDB filtrado sin documentar. → Helper común + tests.

## Desktop

**M25** `apps/desktop/src/ipc.ts:2` contrato 6 canales vs ~35 en `main.ts`. Por qué: no sirve como fuente de verdad ni auditoría; la superficie real no está tipada en un lugar. → Regenerar/derivar tipo.

**M26** `apps/desktop/src/preload.ts:8` `any` en callbacks, `(window as any).ego`, sin `Window.ego`. Por qué: sin tipado fuerte main/preload/renderer; cada lado evoluciona por su cuenta. → Interfaz `EgoBridge` compartida.

**M27** `apps/desktop/electron-builder.config.cjs:13` `buildResources: assets/` inexistente. Por qué: empaquetado sin iconos o falla según versión. → Crear `assets/` o eliminar + verificar artefactos.

**M28** `apps/desktop/package.json:6` exige electron-vite sin dep ni config. Por qué: docs vs realidad (tsc+vites separados, sin pipeline unificado). → Alinear docs o migrar.

**M29** `apps/desktop/package.json:35` Electron 33 (=Node20) vs engines Node22. Por qué: runtime distribuido distinto al exigido; Node 22 llega con Electron 36+. → Subir a Electron ≥36 o ajustar docs.

**M30** `apps/desktop/renderer/package.json:8` `tsc -b` sin composite. Por qué: frágil (TS6304 / comportamiento distinto a `tsc -p`). → `tsc --noEmit -p` o composite+references.

**M31** `apps/desktop/renderer/tsconfig.json:29` no extiende base, omite `hooks/,test/`. Por qué: divergencia strict, CI no cubre tests garantizado (hooks solo por importación transitiva). → Extender base + includes.

## Docs / Repo

**M32** `AGENTS.md:86` 64 md vs 106 reales; `Backlog.md:479` rutas inexistentes (`sign.mjs`, `CLEAN_MACHINE_TEST.md`, `docs/user/`, `tests/security/`, `electron-builder.yml`); `Backlog.md:95` IDs VantaDB sin prefijo; `scripts/*.py` 8/9 huérfanos; `package.json:19` `test:e2e` engañoso; `docs/agent-ops/tasks/` 31/130 fichas. Por qué: credibilidad, planificación sobre artefactos inexistentes, evidencia dispersa. → Actualizar conteo, crear/corregir rutas antes Fase 11-12, prefijar `VDB-`, archivar one-offs o declararlos, renombrar a `test:memory`, completar fichas o declarar evidencia alternativa.

---

# P3 — Low (14)

Todos **No es deuda aceptada**. Higiene, robustez menor, documentar antes de ignorar.

**L01** `packages/decision/package.json:22` `@ego/models` sin import en `src` (igual `zod` en runtime/models sin uso en src). → Eliminar o mover a devDeps. Verificar con `grep -r "from '@ego/models'" packages/decision/src`. Por qué importa: deps muertas agrandan install y confunden (¿falta capacidad o sobra dep?).

**L02** `packages/decision/tsconfig.json:1` único con `NodeNext` + exclude test. → Unificar en `tsconfig.base.json` o documentar por qué decision difiere. Por qué: desacople oculta errores de resolución `.js`.

**L03** `packages/execution/src/ExecutionManager.ts:141` `activeExecutions` por `callId` de llamante sin validar unicidad. → Validar no vacío, advertir/sufijar colisión o generar id interno. Por qué: dos ejecuciones mismo `callId` se pisan y `abort` mata la equivocada.

**L04** `packages/tools/src/schema-converter.ts:112` sin `ZodLiteral/Date/Tuple` → fallback `{type:'object'}` engañoso. → Añadir ramas + test round-trip. Por qué: el modelo recibe schemas mentirosos y genera args malos.

**L05** `packages/tools/src/ToolRegistry.ts:231` `toAiSdkTools()` con `callId` aleatorio + `sessionId 'default_session'` sin `contextFactory`. → Exigir factory o contexto base real. Por qué: se pierde trazabilidad EventBus/Approval.

**L06** `packages/memory/EgoMemoryAdapter.ts:1` layout raíz sin `src/` vs resto con `src/dist/test`. → Migrar a `src/`. Por qué: tooling no uniforme.

**L07** `packages/memory/tsconfig.json:4` `rootDir '.'` + `include ['*.ts','**/*.ts']`. → Alinear a `src/`. Por qué: incluirá `dist` si cambia exclude.

**L08** `packages/knowledge/src/ingest/PythonSidecarBridge.ts:38` `__dirname` en ESM + `cwd()` frágil, spawn sin timeout/kill, chunks sin límite. → `import.meta.url/fileURLToPath`, timeout+kill, backpressure. Por qué: OOM en ingesta masiva + cuelgue ante sidecar colgado. Relacionado a `VDB-INC-02` citado en `bulk_import.py:4`.

**L09** `packages/memory/test/contract-vantadb.test.ts:5` acceso directo Native fuera del adapter. → Documentar excepción (CONTRACT-01) o mover. Por qué: en lectura estricta viola "todo por adapter".

**L10** `catch (err:any)` + `Array<QueuedTask<any>>` + `sanitize(raw?:any)` en `SessionCheckpointPolicy.ts:40,70`, `SessionLifecycleLocks.ts:18`, `ui-runtime/WindowState.ts:36`, `ReactiveStore.ts:28`, `recovery/StorageHealthLatch.ts:33`. → `unknown` + narrowing o justificación exigida por `AGENTS.md`. Por qué: `any` propaga inseguridad de tipos; `err.message` lanza si no es Error.

**L11** `packages/knowledge/package.json:19` `@ego/models workspace:*` sin import (extractor por regex). → Eliminar o implementar extracción con modelo. Por qué: dep muerta o capacidad faltante.

**L12** `packages/recovery/src/CrashRecoveryEngine.ts:193` `updateHeartbeat` read-modify-write no atómico sobre `ego.lock`, sin fsync. → Temporal + rename atómico. Por qué: dos instancias se pisan.

**L13** `packages/subegos/tsconfig.json`, `packages/security/tsconfig.json` omiten `NodeNext`/exclude de tasks/dailystate/recovery/ui-runtime. → Unificar base. Por qué: cobertura typecheck desigual.

**L14** Docs/higiene: `docs/VANTADB-FEEDBACK-Y-MEJORAS.md:1` 7 links `file:///c:/...` no portables → relativas; `Backlog.md:453` SEC-06 en curso sin gates Fase11 → ejecutar matriz Opción B; `character-prototypes/...dots...html:1` resto nominal `dots` vs descarte formal `AGENTS.md:147` → renombrar o nota legacy; `apps/desktop/src/main.ts:271,1755` fallback `obf:` sin aviso + `dev: electron .` stale → aviso UI + script `concurrently vite+electron`.

---

# Anexos — salida de los 5 subagentes

## A1 — Core (65 archivos)

```json
{"parte":"core","archivos_revisados":65,"hallazgos":[
{"severidad":"critical","archivo":"packages/models/src/providers/OpenAICompatibleProvider.ts:45","descripcion":"generate() y stream() ignoran por completo options.tools y options.toolChoice.","recomendacion":"Mapear options.tools a payload.tools con tool_choice y parsear message.tool_calls."},
{"severidad":"high","archivo":"packages/execution/src/AdmittedRunContext.ts:27","descripcion":"Colisión de tipos homónimos incompatibles execution vs decision.","recomendacion":"Renombrar o unificar con adaptador."},
{"severidad":"high","archivo":"packages/decision/src/IntentClassifier.ts:112","descripcion":"Pseudo-nombres fs/git/terminal inexistentes en registry.","recomendacion":"Nombres canónicos + test contra registry."},
{"severidad":"high","archivo":"packages/decision/src/Telemetry.ts:53","descripcion":"metrics.turn con as unknown as any fuera de contrato.","recomendacion":"Añadir a EgoEventType y payload, eliminar cast."},
{"severidad":"medium","archivo":"packages/runtime/src/types.ts:32","descripcion":"ApprovalDecision duplicado.","recomendacion":"Definir en @ego/execution, re-exportar."},
{"severidad":"medium","archivo":"packages/runtime/src/types.ts:78","descripcion":"errorHandler?: any sin justificar.","recomendacion":"Tipar ErrorHandler."},
{"severidad":"medium","archivo":"packages/decision/src/DecisionCascade.ts:102","descripcion":"Tier-2/fallback vs Router discrepan.","recomendacion":"Tabla única."},
{"severidad":"medium","archivo":"packages/models/src/ModelRouter.ts:60","descripcion":"Salta provider ausente en silencio a mock.","recomendacion":"Warn + documentar registro."},
{"severidad":"medium","archivo":"packages/memory/package.json:24","descripcion":"vantadb + file: sin verificar subpaths.","recomendacion":"Verificar exports, smoke test."},
{"severidad":"low","archivo":"packages/decision/package.json:22","descripcion":"@ego/models sin import.","recomendacion":"Eliminar o devDeps."},
{"severidad":"low","archivo":"packages/decision/tsconfig.json:1","descripcion":"NodeNext solo ahí.","recomendacion":"Unificar o documentar."},
{"severidad":"low","archivo":"packages/execution/src/ExecutionManager.ts:141","descripcion":"callId sin unicidad.","recomendacion":"Validar o generar interno."},
{"severidad":"low","archivo":"packages/tools/src/schema-converter.ts:112","descripcion":"Sin ZodLiteral/Date/Tuple.","recomendacion":"Añadir ramas."},
{"severidad":"low","archivo":"packages/tools/src/ToolRegistry.ts:231","descripcion":"default_session sin factory.","recomendacion":"Exigir factory."},
{"severidad":"low","archivo":"packages/memory/EgoMemoryAdapter.ts:1","descripcion":"Layout raíz vs src/.","recomendacion":"Migrar a src/."}]}
```

Detalle íntegro original conservado en historial de chat 2026-10-11 (sesión core).

## A2 — Memoria (57 archivos)

Claves: `EgoMemoryAdapter.ts:83` getDb (high); `package.json:24-26` file+wasm (high); `EgoMemoryAdapter.ts:165` get roto (critical); `BitemporalQueries.ts:40` tagged (critical); `KnowledgeDomain.ts:5` schema (high); `KnowledgeDomain.ts:101` + Crm/Product sin rehidratar (high); `SessionTimelineRewind.ts:169` sin persistencia (high); `HybridSearch.ts:54` fallback (high); `CosineThresholdFilter.ts:23` umbral (high); mediums auto-embed erróneo, list→[], fail-open, workarounds sin cita, N+1, doble etiquetado, paginación parcial, idempotencia inútil, MCP env/spawn, git sin sanitizar, checksum frágil; lows any, dep muerta, tsconfig, sidecar, test directo.

## A3 — Tasks-seguridad (78 archivos)

Claves: 5 criticals security (pkg muerto, TS6133, obf, hardware, vault); highs WorkerPool, timeout, pause, activeRuns, checksum, CanvasBridge, mocks, recovery any/50k, evento duplicado, sin approval; resto en P2/P3.

## A4 — Desktop (24 archivos)

Claves: highs WASM, file:, IPC muerto, sin sandbox; mediums contrato 6/35, preload any, assets inexistente, sin electron-vite, Electron33/Node20, tsc -b, tsconfig; lows obf, dev stale.

## A5 — Docs (24 archivos)

Claves: criticals tests huérfanos + links rotos; highs Q faltantes, gates vs ✅, CI parity, DIST stale; resto rutas, conteo, IDs, scripts, test:e2e, fichas, file:///, SEC-06, dots.

---

_Generado 2026-10-12. Consolidación explicada de los 5 reportes paralelos del 2026-10-11. Ningún hallazgo consta como deuda aceptada._
