---
kind: review
status: active
description: "Backlog especializado para la revisión, extracción de versionado y patrón supersede de DeepSeek-Harness hacia Ego."
tags: [ego, deepseek-harness, extraction, review, supersede, session-versioning, migrations]
schema: "10-column canonical schema (.agents/references/backlog-format.md compatible)"
---

# DeepSeek-Harness Review & Extraction Backlog — Ego SOC #

> **Propósito:** Registro canónico y secuencial de auditoría, extracción de patrones y adaptación técnica de
> `repos-referencia/deepseek-harness` hacia el monorepo de Ego.
> **Regla de Operación:** *No copiar código directamente*. Extraer el patrón de versionado de sesiones con IDs opacos y
> la estrategia de migraciones sin borrado destructivo (patrón supersede), adaptándolos a los namespaces de VantaDB.
> **Esquema:** Tabla canónica de 10 columnas:
> `| ID | Severidad | Hallazgo | Archivo DeepSeek-Harness | Esfuerzo | Prioridad | Estado |`
> `Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |`

---

## 0. Verificación de estado (2026-10-20) — Ola 3 de remediación ##

Cada fila fue re-auditada contra el **código real** del clon (`repos-referencia/deepseek-harness/`) y contra el **código
real de Ego**. Criterio de `✅ Completada`: existe el fichero adaptado **y** hay un caller en producción (grep sobre
`packages/` + `apps/desktop/`, excluyendo `test/`, `dist/` y `node_modules/`).

| Estado | Significado canónico |
|---|---|
| `✅ Completada` | Asimilado, integrado y con **caller en producción verificado**. La celda cita la ruta real. |
| `🚫 Descartada (con justificación)` | El patrón no se aplica en Ego, fue sustituido por otro módulo canónico, o viola un guardrail. La celda contiene el motivo técnico. |
| `🆕 Pendiente` | Asimilado (el código existe y está probado) pero **sin caller en producción**. La celda dice el cableado exacto y quién lo ejecuta. |
| `⏳ Futura (fase)` | Diferido a una fase posterior, con fase destino explícita. |

**Búsquedas de verificación ejecutadas (2026-10-20):**

```text
git grep -n -E "supersedeFact|consolidateMemories" -- packages apps
  -> packages/knowledge/src/FactLifecycle.ts:117,183,232 + packages/memory/EgoMemoryAdapter.ts:892,893,900
     + packages/knowledge/test/* + packages/memory/test/*
  -> 0 callers de produccion de la escritura de supersede
git grep -n -E "generateOpaqueId|SessionCheckpointPolicy|getVersionHistory|getAtTimestamp|SchemaMigrator" -- packages apps
  -> packages/memory/{OpaqueId,SessionCheckpointPolicy,EgoMemoryAdapter}.ts + packages/recovery/src/SchemaMigrator.ts
     + packages/memory/index.ts:8 (re-export) + packages/recovery/src/index.ts:7 (re-export)
  -> 0 callers de produccion
git grep -n -E "DreamConsolidator|MemoryCurator" -- packages apps
  -> packages/tasks/src/{DreamConsolidator,MemoryCurator}.ts + packages/tasks/src/index.ts:10-11
     + packages/tasks/test/*   -> 0 instanciaciones en src/ (huerfanos)
git grep -n -E "state: *.superseded" -- packages apps
  -> FactLifecycle.ts:159 + EgoMemoryAdapter.ts:955 + DreamConsolidator.ts:299 + MemoryCurator.ts:185
```

**Correcciones aplicadas en la Ola 3 (2026-10-20):**

1. `DSEK-01`, `DSEK-03` y `DSEK-05` estaban en `✅ Completada` con una cadena de cableado **falsa**: la evidencia
   citaba `packages/dailystate/src/DailyStatePersistence.ts:131` y `apps/desktop/src/main.ts:142,733,150`, pero
   `DailyStatePersistence` **no importa** `SessionCheckpointPolicy` (la línea `138` solo lo nombra en un comentario) y
   las líneas reales de `main.ts` son `:36` (import), `:2234` (instanciación) y `:698` (accesor). Las tres filas
   bajan a `🆕 Pendiente`.
2. Las líneas citadas del adapter estaban desfasadas: `supersedeFact` está en `:892`/`:900` (no `:867`/`:875`),
   `getVersionHistory` en `:986` (no `:961`) y `getAtTimestamp` en `:1048` (no `:1023`); la opción `excludeSuperseded`
   está en `:109` (no `:99`).
3. La atribución de fuente de la ficha era incorrecta en cuatro puntos: `ADR-028` **no existe** en el clon (es un ADR
   de Ego), `snapshots/session/` es el corpus de fixtures de prueba (la implementación está en `packages/session/`),
   `packages/storage/` **rechaza** toda versión de esquema distinta y no migra (las migraciones están en
   `packages/session/session-format-catalog/`), y los IDs del clon son `randomUUID()` con marca de tipo (no prefijos
   `ses_01h7x…`). Detalle en `docs/extractions/deepseek-harness.md` §6.

---

## 1. Resumen Ejecutivo de Tareas de Extracción ##

| Grupo de Trabajo | Rango IDs | Tareas | Fases de Ego Impactadas | Prioridad | Beneficio Principal |
|---|---|:---:|---|:---:|---|
| **A. Versionado & Supersede** | `DSEK-01..02` | 2 | Fase 01 (`CORE`), Fase 10 (`REC`) | 🔴 P0 | Preservación del linaje histórico de registros sin mutaciones destructivas |
| **B. Identificadores Opacos & Migraciones** | `DSEK-03..04` | 2 | Fase 01 (`CORE`), Fase 10 (`REC`) | 🟠 P1 | Estabilidad de referencias de sesión e invariantes de esquema en VantaDB |
| **C. Durabilidad & Checkpoint Policy** | `DSEK-05` | 1 | Fase 01 (`CORE`), Fase 02 (`TOOL`), Fase 10 (`REC`) | 🔴 P0 | Barrera fail-closed previa a side-effects y persistencia semántica periódica |
| **D. Protocolos de Publicación y Recuperación** | `DSEK-06..08`, `DSEK-11` | 4 | Fase 10 (`REC`) | 🔴 P0 | Publicación atómica verificada, cadena de migraciones derivada y cierre de colas abiertas |
| **E. Fork, Tipado de IDs y Retención de Salidas** | `DSEK-09..10`, `DSEK-12` | 3 | Fase 01 (`CORE`), Fase 02 (`STAB`) | 🟠 P1 | Corte de linaje trazable, IDs no intercambiables y límites de contexto auditables |
| **TOTAL** | `DSEK-01..12` | **12** | **Fases 01, 02, 10** | — | — |

**Recuento de estados (verificado programáticamente sobre las 12 filas de la tabla §2):**

| `✅ Completada` | `🚫 Descartada` | `🆕 Pendiente` | `⏳ Futura` | Total |
|:---:|:---:|:---:|:---:|:---:|
| 0 | 0 | 8 | 4 | **12** |

> **Nota de alcance (Ola 3).** El repo es de la Ola 1, pero ninguna de sus cinco filas originales tenía caller de
> producción una vez re-verificadas con `git grep`: el **camino de escritura** del supersede, `generateOpaqueId` y
> `SessionCheckpointPolicy` no los invoca ningún módulo de producción. El recuento de `✅ Completada` es por tanto
> **0**, y las 12 filas cierran en `🆕 Pendiente` (asimilado y cableado pendiente) o `⏳ Futura (Fase 10)`
> (protocolo que exige infraestructura nueva en la fase de Recovery). Cero filas en el limbo.

---

## 2. Catálogo Detallado de Extracción (10 Columnas Canónicas) ##

| ID | Severidad | Hallazgo | Archivo DeepSeek-Harness | Esfuerzo | Prioridad | Estado | Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |
|---|---|---|---|---|---|---|---|---|---|
| `DSEK-01` | 🔴 Crítica | **Patrón Canónico de Supersede Histórico (Soft-Replace)** | ADR-028 de **Ego** (no del clon) | 🟢 0.5d | 🔴 P0 | 🆕 Pendiente | `FactLifecycle.supersedeFact` (`packages/knowledge/src/FactLifecycle.ts:117`) escribe el hecho nuevo con `supersedes` / `is_latest: true` y remarca el previo con `is_latest: false` y `superseded_by`, sin borrado. **Sin caller de producción**: su único invocante es `consolidateMemories` (`:232`), y `consolidateMemories` solo se llama desde `packages/knowledge/test/*`. `EgoMemoryAdapter.supersedeFact` (`packages/memory/EgoMemoryAdapter.ts:892`, impl. `:900`) tampoco tiene caller. Las cuatro únicas escrituras de `state: "superseded"` en código de producción son `FactLifecycle.ts:159`, `EgoMemoryAdapter.ts:955`, `packages/tasks/src/DreamConsolidator.ts:299` y `packages/tasks/src/MemoryCurator.ts:185` — las dos últimas huérfanas (`new DreamConsolidator` / `new MemoryCurator` = 0 en `src/`). La clase sí está instanciada (`apps/desktop/src/main.ts:2234`) y su `promoteFromQuarantine` se llama desde `apps/desktop/src/main/ipc/register-ipc.ts:1390`, pero el camino de escritura no es alcanzable desde producción; solo el lado de lectura está vivo (`packages/memory/EgoMemoryLifecycle.ts:160`, `packages/knowledge/src/HybridSearch.ts:76`). **Cableado:** invocar `consolidateMemories` desde la ingesta de Knowledge (`packages/knowledge/src/KnowledgeIndexer.ts`) o desde el curador, y unificar con `EgoMemoryLifecycle.runDreamConsolidation` (`packages/memory/EgoMemoryLifecycle.ts:374`, vivo vía `apps/desktop/src/main.ts:1958,1975`) — owner A2. | Ego: `CORE-07`, `REC-01` | — |
| `DSEK-02` | 🟠 Alta | **Reconstrucción de estado por árbol de versiones (`version-tree`) y time-travel** | `packages/memory/EgoMemoryAdapter.ts` | 🟢 1d | 🟠 P1 | 🆕 Pendiente | asimilado en `packages/memory/EgoMemoryAdapter.ts:986` (`getVersionHistory`) y `:1048` (`getAtTimestamp`) — **líneas reales corregidas**; la ficha citaba `:961` y `:1023` — **sin caller en producción**: `git grep` solo devuelve `packages/memory/test/version-tree.test.ts`. **Divergencia semántica confirmada:** conviven dos motores temporales —`packages/knowledge/src/BitemporalQueries.ts:93` (`asOf`) filtra por intervalo de **tiempo de validez** `valid_at`/`invalid_at` (`:104-111`) y está en producción (`apps/desktop/src/main.ts:2235`, IPC en `apps/desktop/src/main/ipc/register-ipc.ts:1416`); `getAtTimestamp` reconstruye por **tiempo de transacción** (`created_at` / `superseded_at`, `:1052-1057`)—. **Cableado:** delegar desde `BitemporalQueries` al `EgoMemoryAdapter` o retirar los duplicados — owner A2. | Ego: `CORE-07`, `REC-01` | `DSEK-01` |
| `DSEK-03` | 🟠 Alta | **Generación de identificadores de sesión opacos e inmutables** | `packages/util/brand/` + `packages/memory/OpaqueId.ts` | 🟢 0.5d | 🟠 P1 | 🆕 Pendiente | convención de Ego `${prefix}_${timestamp_base36}_${entropy}` en `packages/memory/OpaqueId.ts:30` (`generateOpaqueId`, `parseOpaqueId`, `isOpaqueId`), probada en `packages/memory/test/opaque-id.test.ts`. **Sin caller de producción**: sus únicos usos son `packages/memory/SessionCheckpointPolicy.ts:4,155` (que a su vez no tiene caller) y el test. La cadena que declaraba la Ola 1 (`OpaqueId.ts` → `SessionCheckpointPolicy.ts` → `DailyStatePersistence.ts:131` → `main.ts:150`) **se rompe en el tercer eslabón**: `packages/dailystate/src/DailyStatePersistence.ts` no importa `SessionCheckpointPolicy` (`:138` es un comentario). En producción los `sessionId` son cadenas libres del renderer (`apps/desktop/src/ipc/schema.ts:712,719,742,748`) con fallback literal `"default_session"` (`apps/desktop/src/main.ts:1417,1459`; `packages/tools/src/ToolRegistry.ts:251,264`) y el alta usa `"session_init"` (`apps/desktop/src/main.ts:1959`). **Cableado:** acuñar el `sessionId` con `generateOpaqueId("sess")` en el alta de sesión y en el esquema IPC — owner A2. | Ego: `CORE-01`, `CORE-06` | — |
| `DSEK-04` | 🟡 Media | **Migraciones puramente aditivas sin eliminación de esquema** | `packages/session/session-format-catalog/` | 🟢 1d | 🟠 P1 | 🆕 Pendiente | asimilado en `packages/recovery/src/SchemaMigrator.ts` **sin caller de producción**: `git grep` solo devuelve `packages/recovery/src/index.ts:7` (re-export) y `packages/recovery/test/SchemaMigrator.test.ts`. La importación/exportación en producción la resuelven `packages/recovery/src/ProjectImport.ts` + `packages/knowledge/src/KnowledgeExport.ts`, y el contrato de namespaces (invariante de esquema, sin borrado) vive hoy en `packages/memory/SensitiveNamespaces.ts`. **Corrección de fuente:** la Ola 1 atribuía las migraciones a `packages/storage/`, pero `packages/storage/storage-sqlite/src/schema.ts:20` fija `STORAGE_SQLITE_SCHEMA_VERSION = 1` y `:55` rechaza toda versión distinta (*"this unreleased format has no migrations"*); las migraciones reales del clon están en `packages/session/session-format-catalog/` y `packages/session/session-format-v*-to-v*/`. **Cableado:** invocar `SchemaMigrator` en `ProjectImport` para validar que un dump antiguo respete el esquema vigente (owner A3) o retirarlo. | Ego: `REC-03`, `REC-05` | — |
| `DSEK-05` | 🔴 Crítica | **Session Checkpoint Policy & Barrera Fail-Closed de Herramientas** | `packages/session/session-checkpoint-policy/` | 🟢 1d | 🔴 P0 | 🆕 Pendiente | el origen (`packages/session/session-checkpoint-policy/src/index.ts`) tiene **tres** frontiers *fail-closed* —`llm/stream` (`:64`), `tools/execute` de nivel superior (`:70`) y `agent/pre-step` (`:79`)— todos vía `ctx.sessions.flush(session)`; **no** tiene checkpoints periódicos, ni namespace `gov/audit`, ni bandera `failClosedOnToolFlushError` (la descripción de la Ola 1 mezclaba la implementación de Ego con la del clon). En Ego existe `packages/memory/SessionCheckpointPolicy.ts` (clase en `:43`, `beforeModelStream` `:63`, `beforeToolDispatch` `:84`, `recordTurn` `:146`) con las tres fronteras y `failClosedOnToolFlushError` (`:45,53`), **pero sin caller de producción**: solo el re-export `packages/memory/index.ts:8`, comentarios en `packages/memory/QuarantineAwareReads.ts:10` y `packages/memory/SensitiveNamespaces.ts:149`, y tests. **Cableado:** instanciar la política en `apps/desktop/src/main.ts` y engancharla al `ToolExecutionLoop` (`packages/runtime/src/ToolExecutionLoop.ts:269,852`) para abortar la herramienta si falla la persistencia previa — owner A2. | Ego: `CORE-07`, `TOOL-01`, `REC-01` | `DSEK-03` |
| `DSEK-06` | 🔴 Crítica | **Publicación durable exclusiva con verificación aislada** | `packages/session/session-persistence-jsonl/src/generation.ts` | 🟡 2d | 🔴 P0 | ⏳ Futura (Fase 10) | el artefacto se prepara en temporal con `wx` y `fsync` (`:715-787`), se verifica en un *worker* aislado (`packages/session/session-persistence-jsonl/src/migration-verifier.ts:20-21`, límite `MAX_CONCURRENT_VERIFIERS = 2`), se publica con `link()` atómico y exclusivo (`:817-843`: `EEXIST` significa que otro publicador ganó) y se acepta idempotentemente si los bytes del ganador coinciden (`:921-937`); antes de publicar se revalida la identidad física del origen (`dev`/`ino`/`size`/`mtimeNs`, `:162-168`) y si cambió se aborta con `JsonlGenerationSourceChangedError` (`:112-119`). **Ego no tiene equivalente**: `packages/recovery/src/ProjectImport.ts` y `packages/recovery/src/ProjectExport.ts` no aplican publicación exclusiva ni verificación previa. **Cableado (Fase 10, REC-03/REC-06):** publicar el `.vdbdump` con temporal único → verificar en aislamiento → `link()` atómico → revalidar identidad del origen. | Ego: `REC-03`, `REC-06` | — |
| `DSEK-07` | 🟠 Alta | **Catálogo de migraciones generado y cadena adyacente completa** | `packages/session/session-format-catalog/src/generated.ts` | 🟡 1.5d | 🟠 P1 | ⏳ Futura (Fase 10) | `SESSION_FORMAT_VERSION` es el único número mantenido a mano (`packages/core/session/src/types.ts`); `scripts/gen-session-format-catalog.ts` deriva el orden de los códecs y **falla** si las migraciones adyacentes no alcanzan la versión actual, y el resultado se versiona en código (`packages/session/session-format-catalog/src/generated.ts:16-45`: `currentVersion: 4` + 4 migraciones v0→v1→v2→v3→v4). Cookbook: `docs/cookbook/adding-a-session-format-version.md:42`. **Ego**: `packages/recovery/src/SchemaMigrator.ts` declara su cadena de pasos a mano y detecta discontinuidad en caliente (`:128`), sin catálogo generado ni verificación de contigüidad previa. **Cableado (Fase 10, REC-06):** derivar el catálogo de migraciones desde una única fuente versionada y fallar en build si la cadena no es contigua. | Ego: `REC-06` | `DSEK-04` |
| `DSEK-08` | 🟠 Alta | **Reparación de cola abierta por eventos sintéticos deterministas** | `packages/core/session/src/repair.ts` | 🟡 2d | 🟠 P1 | ⏳ Futura (Fase 10) | `openTurnClosers` (`:53-98`) escanea el log, detecta el turno abierto y devuelve eventos sintéticos (`step/end`, `turn/end` y resultados de error) con dos causas —`interrupted` (crash) y `forked` (bifurcación)— (`:29`), dos códigos de recuperación (`TOOL_NOT_STARTED` `:15`, `TOOL_OUTCOME_UNKNOWN` `:18`) y un texto que el modelo ve para decidir si reintentar (idempotencia). Nunca borra historia: añade el cierre al final del log. **Ego**: `packages/recovery/src/CrashRecoveryEngine.ts` cubre *dirty shutdown*, *lock* en disco y *heartbeat* (`:92-175`), pero **no** repara colas de turno abiertas en `session/turns`. **Cableado (Fase 10, REC-01):** cerrar turnos huérfanos con eventos sintéticos al recuperar, sin borrar historia. | Ego: `REC-01`, `CORE-07` | `DSEK-01` |
| `DSEK-09` | 🟠 Alta | **Bifurcación por prefijo inclusivo con corte marcado** | `packages/core/session/src/fork.ts` | 🟢 1d | 🟠 P1 | 🆕 Pendiente | `buildForkSeed` (`:21-30`) copia el prefijo inclusivo exacto, marca el corte con un evento `session/end-seed` (`inherited: true`) y cierra la cola abierta con causales `forked`; los pasos y turnos ya cerrados se preservan sin cambios y los eventos heredados se cuentan aparte del prefijo (`inheritedEventCount`). **Ego**: `packages/memory/SessionFork.ts:49-104` copia los turnos por prefijo de clave, marca `forkedFrom` / `forkedAtMs` (`:81-82`), sella un micro-checkpoint y **nunca borra el origen** (fail-closed en ids y summary, `:56-66`), pero **no registra el corte heredado ni cierra un turno abierto** (tope `MAX_TURNS_TO_COPY = 1000`, `:37`). **Cableado:** registrar el corte y los cierres sintéticos en el `SessionHandoffRecord` — owner A2 / STAB-12. | Ego: `CORE-07`, `STAB-12` | `DSEK-08` |
| `DSEK-10` | 🟡 Media | **Identificadores opacos por marca de tipo (branding)** | `packages/util/brand/src/index.ts` | 🟢 0.5d | 🟠 P1 | 🆕 Pendiente | `Branded<B>` (`:18`) y `brandString<T>` (`:28`) aplican una marca **de compilación** sin cambiar el valor: un `SessionId` no se puede pasar donde se espera un `ToolCallId` aunque ambos sean `string`; el valor sigue siendo un `randomUUID()` opaco (`packages/acp/acp/src/index.ts:199`). **Ego**: `packages/memory/OpaqueId.ts` aporta el prefijo y el orden lexicográfico, pero los identificadores siguen siendo `string` sin marca (`packages/runtime/src/types.ts:32`). **Cableado:** marcar `SessionId`, `SubEgoId` y `FactId` sobre `OpaqueId.ts` sin coste en runtime — owner A2. | Ego: `CORE-01`, `CORE-06` | `DSEK-03` |
| `DSEK-11` | 🟠 Alta | **Escritura atómica de fichero y serialización entre procesos** | `packages/util/atomic-write/src/index.ts` | 🟢 1d | 🟠 P1 | ⏳ Futura (Fase 10) | `writeFileAtomic` (`:79`) escribe un hermano con sufijo aleatorio en modo `wx` (el `open` no sigue un symlink plantado en la ruta temporal), conserva los permisos del *inodo* nuevo a través del `rename` y reintenta `EACCES`/`EBUSY`/`EPERM` transitorios de Windows (`:18-43`); `withFileLock` (`:1-11`) serializa escritores entre procesos con un `.lock` creado en `wx` y permite el relevo si el proceso titular ya no existe; los lectores quedan sin bloqueo porque el commit por `rename` es atómico. **Ego** no tiene equivalente para sus ficheros de estado en disco: `packages/recovery/src/ProjectExport.ts` no pasa por temporal + `rename`. **Cableado (Fase 10, REC-03):** escribir toda salida a disco con temporal + `rename`, y usar el *lock* para el ciclo read-modify-write. | Ego: `REC-03` | — |
| `DSEK-12` | 🟡 Media | **Retención acotada de salidas con metadatos exactos de omisión** | `packages/util/output-retention/src/index.ts` | 🟡 1.5d | 🟠 P1 | 🆕 Pendiente | acota la salida visible al modelo y devuelve exactamente lo retenido y lo omitido (`Omitted = { kind: 'none' }`, `{ kind: 'exact', count }`, `{ kind: 'unknown' }`, `:40-44`), con dos retentores —`ItemRetainer` (unidades lógicas ordenadas) y `TextRetainer` (bytes con `head` / `tail` / `headTail` preservando fronteras UTF-8)— y la garantía explícita de que `truncated` significa "el retenedor omitió por presupuesto", **nunca** "el origen estaba incompleto" (`:11-15`). **Ego**: `packages/runtime/src/ContextCompaction.ts:309` usa un presupuesto de **caracteres** y `:328-329` emite un aviso agregado (`"... [y N mensaje(s) más omitidos por presupuesto de caracteres]"`), sin bytes ni metadatos exactos por unidad. **Cableado:** adoptar el contrato `Omitted` en la compactación y en el límite de bytes de resultados de herramienta — owner CORE-03. | Ego: `CORE-03`, `CORE-12` | — |

---

## 3. Integración en el Flujo de Construcción de Ego ##

```mermaid
flowchart TD
    subgraph DeepSeekExtraction ["repos-referencia/deepseek-harness"]
        D_SUP["DSEK-01..02 (Supersede Pattern & Version Tree)"]
        D_MIG["DSEK-03..04 (Opaque IDs & Additive Migrations)"]
        D_CHK["DSEK-05 (Checkpoint Policy fail-closed)"]
        D_PUB["DSEK-06..08, DSEK-11 (Publicación, Migraciones, Repair, Atomic Write)"]
        D_FORK["DSEK-09..10, DSEK-12 (Fork cut, Brand IDs, Output Retention)"]
    end

    subgraph EgoBacklog ["Ego Backlog Maestro"]
        CORE["Fase 01: Core Cognitivo<br/>CORE-07 VantaDB Persistencia"]
        STAB["Fase 02: Acción<br/>STAB-12 Fork de Sesión"]
        REC["Fase 10: Recovery & Hardening<br/>REC-01 Integridad, REC-03 Migraciones"]
    end

    D_SUP --> CORE
    D_SUP --> REC
    D_MIG --> CORE
    D_MIG --> REC
    D_CHK --> CORE
    D_CHK --> STAB
    D_PUB --> REC
    D_FORK --> CORE
    D_FORK --> STAB
```

---

## 4. Descarte a nivel de componente (matriz de la ficha `docs/extractions/deepseek-harness.md` §3) ##

| Componente / Feature de DeepSeek-Harness | Archivo Fuente | Acción | Justificación Técnica |
|---|---|:---:|---|
| Almacenamiento relacional en SQLite | `packages/storage/storage-sqlite/` | 🚫 **Descartada (con justificación)** | Incompatible con VantaDB 0.8.0 nativo in-process (Fjall LSM + BM25 + HNSW). |
| Rechazo de versión en SQLite sin migraciones | `packages/storage/storage-sqlite/src/schema.ts:20,55` | 🚫 **Descartada (con justificación)** | El backend rechaza toda versión distinta y no migra: contradice la política aditiva que se pretende extraer. |
| Sistemas propietarios de benchmarks y web stress | `benchmarks/`, `vitest.web-stress.*` | 🚫 **Descartada (con justificación)** | Específico para el testing interno de deepseek; Ego cuenta con su propia estrategia de pruebas E2E (`docs/testing/`). |

---

## 5. Deuda abierta derivada de esta verificación (→ handoff A5) ##

| # | Ítem | Tipo | Owner | Bloqueante |
|---|---|---|---|---|
| D1 | `DSEK-01`: el camino de escritura del supersede no es alcanzable desde producción (`FactLifecycle.supersedeFact` solo lo invoca `consolidateMemories`, sin caller) | Código | A2 | No |
| D2 | `DSEK-02`: `getVersionHistory` / `getAtTimestamp` duplican la lógica bitemporal de `packages/knowledge/src/BitemporalQueries.ts` con **semántica temporal distinta** (tiempo de transacción vs tiempo de validez) | Código | A2 | No |
| D3 | `DSEK-01`: `EgoMemoryAdapter.supersedeFact` es código muerto frente a `FactLifecycle.supersedeFact`; además `packages/tasks/src/DreamConsolidator.ts` y `packages/tasks/src/MemoryCurator.ts` están huérfanos (`0` instanciaciones en `src/`) y duplican la consolidación que ya vive en `EgoMemoryLifecycle.runDreamConsolidation` (`packages/memory/EgoMemoryLifecycle.ts:374`, en producción vía `apps/desktop/src/main.ts:1958,1975`) | Código | A2 | No |
| D4 | `DSEK-03` / `DSEK-05`: `generateOpaqueId` y `SessionCheckpointPolicy` no tienen caller; la cadena de evidencia de la Ola 1 (`DailyStatePersistence.ts:131` → `main.ts:150`) era ficticia | Código | A2 | No |
| D5 | `DSEK-04`: `SchemaMigrator` sin caller tras la reescritura del import/export de proyecto (A3) | Código | A3 | No |
| D6 | `DSEK-06..08`, `DSEK-11`: cuatro protocolos de publicación/recovery que exigen infraestructura nueva en Fase 10 (publicación exclusiva, catálogo derivado, repair de cola, escritura atómica) | Diseño | A3 | No |
| D7 | Contadores desincronizados fuera de estos dos ficheros: `docs/extractions/README.md` §3 y §4.1, y `docs/review/README.md` siguen declarando `DSEK-01..05` / 5 tareas / `3 ✅ · 2 🆕` | Documentación | A5 | No |
