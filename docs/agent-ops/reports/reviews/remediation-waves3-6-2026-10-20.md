# Cierre de la remediación — Olas 3 a 6 (2026-10-20)

**Alcance:** cierre de las olas 3, 4, 4b, 5 y 6 de la remediación iniciada por la auditoría de 8 agentes.
**Estado:** ✅ **23/23 checks en verde** · árbol limpio · 69 commits sin publicar.
**Informe fuente:** [`review-full-2026-10-19.md`](./review-full-2026-10-19.md) · **Plan y veredicto:** [`../../plans/2026-10-19-remediation-wave1/VERDICT.md`](../../plans/2026-10-19-remediation-wave1/VERDICT.md)

---

## 1. Qué se cerró en estas olas

| Ámbito | Antes | Después |
|---|---|---|
| `main.ts` | 5 401 líneas | **866** |
| `register-ipc.ts` | 2 570 líneas (nuevo god file) | **84** (22 módulos por dominio de canal + gate de 6 checks) |
| Resolución de `vantadb` | 18 de 20 miembros resolvían el **global 0.6.1** | **20/20 in-repo 0.9.0** + puerta `vantadb:check` bloqueante |
| CI con VantaDB | stub no-op | **binding real**, round-trip verificado, 0 stubs |
| Patrones de extracción | 32 en el limbo | **0 en el limbo** (25 repos, 289 tareas) |
| Código muerto asimilado | 20 módulos sin cablear | **20 retirados** con veredicto |
| Tests | 603 (núcleo) | **2 200+** en total; renderer 536, desktop 407, avatar 291 |
| Puertas de calidad | 3 | **12** en `scripts/` + `design-lint` (12 reglas) |
| ADRs | 11 (con colisión de numeración) | **24**, sin colisiones |
| Hallazgos del Backlog | 95 filas | **86 completadas · 6 parciales · 18 pendientes** |

## 2. Capacidades nuevas (Fase 03 y Fase 06)

- **E5 — identidad declarativa**: `SOUL.md`/`AGENT.md` con frontmatter + cuerpo, cargador con **fallback** al loader en código y **fail-closed** de identidad.
- **E5 — presupuestos**: `SubEgoBudgetCircuitBreaker` con 4 límites medibles (tokens, coste por llamada, diario, tiempo) que **degrada** a un modelo más barato o **detiene** con error tipado. Tope efectivo = MÍNIMO(Sub-Ego, router).
- **E13 — divulgación progresiva**: `lookup_skills` (resumen primero, cuerpo bajo demanda), `search_tools` (sin schema), `expand_tools` (schema completo, fail-closed).
- **E2 — path cognitivo nativo**: cableadas `graphragSearch`, `memoryRecall` (con `trust_aware`), `contextAssemble`, `memoryConsolidate`, `memoryReinforce`. El puente es **HybridRuntime**: alcanza el binding por `db.inner` (campo público en el JS compilado) → **no hace falta un fix upstream** para el camino cognitivo.
- **E4 — exportadores** PDF/DOCX/XLSX/PPTX **sin una sola dependencia** (`node:zlib` + escritores propios), con validación estructural real del artefacto; y `eval_expression`, un intérprete de expresiones propio que **no** usa `eval`, `new Function`, `node:vm` ni `child_process`.

## 3. Los 5 bugs de producción que los tests verdes escondían

1. **`toolEvents` acumulativo** → un `tool_error` del turno 1 pintaba de ámbar **todos los turnos siguientes** (aviso falso permanente). Detectado por A4 al aplicar el diff de A6.
2. **El estimate del turno nunca llevaba `costUsd`** → la rama de coste del circuit breaker **no se ejecutaba** nunca. Detectado por A4 al cerrar el circuito de extremo a extremo.
3. **La trampa del tope 0**: `getMaxCostPerCallUsd()` devolvía `0` en vez de `undefined` → el breaker calculaba MÍNIMO(Sub-Ego, 0) = 0 y **detenía todos los turnos**. Detectado por A2-bis.
4. **La lista blanca de `design-lint` indexada por ID posicional** → un hex nuevo desplazaba los IDs y la excepción dejaba de suprimir nada. Ahora indexada por **hash del contenido**, y el contrato cambió de "contar" a "no dejar subir el presupuesto sin justificar".
5. **`UntrustedContentSanitizer` retirado sin replacement** → el `TrustBoundary` cubre el canal dual y el taint, pero la **detección** de vectores de inyección perdió su módulo. **Escalado al owner** (hueco de capacidad, no un bug cerrado).

## 4. Verificación empírica de VantaDB (binding 0.9.0)

Ejecutada contra el binario, no contra la documentación. **9 resueltos · 2 parciales · 3 persisten · 2 nuevos**.

- **Resueltos**: `cursor: undefined` · `search` con texto vacío · uso tras `close()` (ahora lanza) · borrado físico (las tombstones **ya no** son legibles) · `query_vector: []` (el workaround de Ego es retirable) · `contextAssemble` **preserva el system prompt y los pares `tool_call`/`tool_result`** → la invariante del ADR-0020 está **verde**.
- **Persisten**: la unión `VantaValue` es **plana** (sin `Map`/`Object` recursivo) · **no hay embeddings** (sin `embed-local` compilado) · **cifrado at-rest no expuesto**.
- **Nuevos**: `VDB-REQ-14` — pre-reserva de **320,03 MB por store**, no parametrizable (`ConnectOptions` solo expone `read_only` y `memory_limit`). `VDB-REQ-15` — `memoryRecall({trust_aware})` ofrece re-rank con confianza: **capacidad disponible**, ya cableada.
- **`vantadb-node@0.9.0` está publicado en npm** (Apache-2.0, 3 SO, x64+arm64, con firmas y `sha512`) → **`DIST-09` resuelto** y `EGO-FIND-64` cerrado.
- **`EGO-FIND-80` resuelto contra la fuente primaria**: la API **no prescribe orden**; la correspondencia es por `tool_use_id` y la concurrencia está autorizada → la implementación de A2 es **más estricta** que la API → `EGO-FIND-43` desbloqueado sin tocar código.

## 5. Puertas nuevas (impiden la recaida)

`verify-ci-triggers` (un workflow que no puede dispararse = rojo) · `verify-vantadb-resolution` (resolución fuera del repo = rojo) · `verify-vantadb-ids` (un `Workaround:` sin ID registrado = rojo) · `verify-paths` (ruta inválida o fichero de 0 B = rojo) · `verify-lint-budget` (el presupuesto **solo puede bajar**) · `verify-backlog-gates` (Backlog ≠ catálogo = rojo) · `audit-extraction-gates` (un `Completada` sin caller real = rojo) · `verify-real-binding` · `preflight-disk` (falla en 1,1 s con un mensaje accionable si el disco no da margen) · `check-docs-lint` (absorbe formato de worklogs, pero **nunca** un documento mal formado) · `design-lint` R1–R12 · `verify-harness`.

## 6. Decisiones del owner pendientes

| # | Decisión | Por qué no la puede cerrar un agente |
|---|---|---|
| 1 | **Canal de obtención del token MCP** (EGO-FIND-81) | Sin canal, un cliente MCP externo no puede autenticarse |
| 2 | **Cifrado at-rest** para `egos/*` y `system/*` (VDB-REQ-08) | 0 soporte en el binding 0.9.0; afecta al 100 % del estado persistente |
| 3 | **Certificados de firma** (DIST-04) | Sin certificados, el instalador va unsigned |
| 4 | **Pre-reserva de 320 MB por store** (VDB-REQ-14) | Upstream: no es parametrizable |
| 5 | **Wrapper `vantadb@0.9.0` sin re-exportar las APIs cognitivas** (VDB-REQ-16a) | Upstream; mitigado en Ego por el puente HybridRuntime (fail-soft) |
| 6 | **Registro global vs. vista filtrada por Sub-Ego** | Producto: A4 recomienda una **vista filtrada** por `subEgoId` (sin clones, sin divergencia con las tools tardías) |
| 7 | **Replacement del detector de inyección de prompt** | Capacidad: el módulo se retiró y la detección quedó sin cubrir |

## 7. Método (lo que funcionó y lo que no)

**Funcionó**: 8 agentes con **propiedad exclusiva de ficheros** + handoffs con **diff exacto** (cero colisiones en ~1 000 ficheros y 4 olas); TDD real con el rojo pegado; **objetivos medibles convertidos en puertas de CI**; y medir antes de asumir (3 "flaky" resultaron ser bugs de producción).

**No funcionó y quedó registrado**: un fixer de markdown **no dirigido por el linter** dañó 2 handoffs ajenos (recuperados del storage de sesiones); un `grep` que cuenta **comentarios** como callers produjo **3 falsos verdes** de extracción; y un `.npmrc` con `public-hoist-pattern` **purga `node_modules`** y en Windows falla con `ERR_PNPM_EPERM` cuando hay agentes vivos.

---

*Verificado por el orquestador el 2026-10-20 con 23 checks en verde sobre el árbol commiteado. 69 commits sin publicar: la publicación queda a decisión del owner.*
