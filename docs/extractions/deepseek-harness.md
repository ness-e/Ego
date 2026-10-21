# Extracción Técnica: DeepSeek-Harness (repos-referencia/deepseek-harness) #

| Campo | Valor |
| --- | --- |
| Estado | Activo — Documento canónico de extracción y análisis de capacidades |
| Repositorio Origen | `repos-referencia/deepseek-harness/` (upstream `deepseek-ai/deepseek-harness`, commit `5badb15`, origen `packages/session/session-persistence-jsonl/package.json`) |
| Licencia del origen | MIT — deepseek-ai/deepseek-harness |
| Commit verificado | 5badb15 |
| Ruta de origen | `packages/session/session-persistence-jsonl/package.json` |
| Stack del Origen | Monorepo TypeScript ESM (pnpm workspaces) + Node ≥22.19 + Vitest + Oxlint + SQLite (`node:sqlite`) + logs de sesión JSONL/Zstd |
| Rol en Ego | Referencia de Versionado de Sesiones, Patrón Supersede, Identificadores Opacos y Migraciones Aditivas |
| Owner | ness-e |
| Fecha | 2026-10-08 (Ola 1) · 2026-10-20 (Ola 3 de remediación) |

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia ##

`deepseek-harness` es un arnés de ejecución de agentes y orquestación multi-modelo construido como monorepo
TypeScript integral (`packages/<grupo>/<paquete>`). Su aportación a Ego **no está en el stack** —Node ≥22, SQLite y
logs JSONL en disco son incompatibles con los guardrails— sino en cinco **protocolos de persistencia** transferibles:

1. **Publicación durable exclusiva de generaciones inmutables**: se prepara un artefacto nuevo, se verifica en un
   *worker* aislado, se publica con `link()` atómico y se revalida la identidad física del origen justo antes de
   publicar (`packages/session/session-persistence-jsonl/src/generation.ts`).
2. **Formato de sesión versionado con catálogo de migraciones generado**: `SESSION_FORMAT_VERSION` es el único número
   mantenido a mano y un generador deriva el orden de los códecs y exige que las migraciones adyacentes formen una
   cadena completa (`packages/session/session-format-catalog/src/generated.ts`).
3. **Reparación de cola abierta por eventos sintéticos deterministas**: un log con turno abierto se cierra con eventos
   sintéticos —nunca se borra historia— y códigos de recuperación explícitos
   (`packages/core/session/src/repair.ts`).
4. **Checkpoints semánticos *fail-closed***: la persistencia se fuerza (`flush`) antes de cada petición al modelo, de
   cada *tool* de nivel superior y de cada paso del agente; si el *flush* falla, la llamada no se despacha
   (`packages/session/session-checkpoint-policy/src/index.ts`).
5. **Identificadores opacos por tipado, no por prefijo**: `Branded<B>` (`packages/util/brand/src/index.ts`) impide en
   tiempo de compilación pasar un `SessionId` donde se espera un `ToolCallId`.

**Corrección de encuadre (Ola 3).** El patrón `superseded_by` / `is_latest` que la ficha de la Ola 1 atribuía a este
repositorio **es de Ego** (su ADR-028), no de `deepseek-harness`: en el clon **no existe ningún `ADR-028`** y
`packages/` **no escribe ningún `superseded_by`**. El clon aproxima el mismo objetivo con un *log* *append-only*
(`session.jsonl`, versiones `session.vN.jsonl`) donde un evento posterior *supersede* semánticamente a otro sin
puntero de sustitución. La Ola 3 separa ambas cosas: `DSEK-01` sigue siendo un hallazgo **de Ego** (verificado, con
hueco de cableado) y `DSEK-06`..`DSEK-12` recogen lo que el clon sí aporta.

### Divergencias Fundamentales (Qué Descartamos y Por Qué) ###

| Dimensión | DeepSeek-Harness | Ego (Cognitive OS) | Decisión Crítica |
|---|---|---|---|
| **Motor de Almacenamiento** | SQLite (`node:sqlite`, `packages/storage/storage-sqlite/`) + logs de sesión JSONL/Zstd en disco. | VantaDB 0.8.0 nativo in-process (`NativeVantaDB` vía napi-rs) sobre Fjall LSM y búsqueda federada. | **DESCARTAR SQLite**. Ego ejecuta su persistencia sobre VantaDB; el patrón de *generación inmutable* se adapta a los namespaces de VantaDB. |
| **Log de Sesiones** | Fichero JSONL *append-only* con versiones `session.vN.jsonl` y cabecera `version`. | Namespaces VantaDB (`session/turns`, `kb/facts`) con registros mutables. | **ADAPTAR**. El *append-only* y el corte marcado se traducen a metadatos de linaje (`supersedes` / `superseded_by`). |
| **Arquitectura de Agentes** | Harness centrado en un modelo monolítico con subprocesos subordinados transitorios. | Multi-Sub-Ego colaborativo con identidades persistentes, memorias privadas (`egos/<id>/*`) y memoria compartida. | **ADAPTAR**. Extraer los esquemas de linaje y versionado de estados, adaptándolos a los manifiestos de Sub-Egos (`SUB-01`). |
| **Tool Calling y Sandboxing** | Ejecución directa de subprocesos con envolturas ad-hoc. | Execution Manager centralizado (`ACT-03`) con límites de cuota, timeouts y aprobación HITL obligatoria. | **ADAPTAR**. Las políticas de aislamiento se integran dentro de las compuertas de seguridad de Ego (`SEC-01`, `SEC-05`). |
| **Credenciales** | Fichero `$DSH_HOME/.credentials.yaml` con permisos de propietario y rechazo si otro usuario puede leerlo (`packages/credentials/credentials-local/src/index.ts`). | `CredentialManager` con keychain del SO + `SecretsFilter` (`packages/security/`). | **ADAPTAR (Ego ya es más fuerte)**. Se conserva el patrón de *rechazo al abrir*; el almacén del SO ya está implementado. |

---

## 2. Catálogo Detallado de Capacidades, Herramientas y Patrones Extraíbles ##

### Bloque A: Versionado Inmutable y Patrón Canónico de Supersede ###

*Ubicación en fuente:* `packages/session/session-persistence-jsonl/` y `packages/core/session/`.
La Ola 1 citaba `snapshots/session/`, que según `snapshots/AGENTS.md` es **el corpus de fixtures de prueba**, no la
implementación del producto.

1. **Patrón Canónico de Supersede Histórico (ADR-028 de Ego, no del clon)**
   - **Qué hace:** Prohíbe terminantemente la sobreescritura destructiva (`UPDATE` / `DELETE` en caliente) de
     memorias, hechos y estados de sesión. Cuando una entidad cambia, se genera un registro nuevo y el anterior se
     remarca con `superseded_by` e `is_latest: false` conservando su trazabilidad causal.
   - **Adaptación en Ego:** `FactLifecycle.supersedeFact` (`packages/knowledge/src/FactLifecycle.ts:117`) y
     `EgoMemoryAdapter.supersedeFact` (`packages/memory/EgoMemoryAdapter.ts:892`, implementación `:900`).
   - **Estado real:** el **lado de escritura no tiene caller de producción** (ver §5, `DSEK-01`). El lado de lectura
     sí está vivo (`packages/memory/EgoMemoryLifecycle.ts:160`, `packages/knowledge/src/HybridSearch.ts:76`).
   - **Relación con Backlog Ego:** `CORE-07` (Fase 01), `KB-08` (Fase 06), `REC-01` (Fase 10).
     **Compuerta:** `DSEK-01`.
2. **Reconstrucción de Estado por Árbol de Versiones (`version-tree`)**
   - **Qué hace:** Recorre los punteros causales `supersedes` (hacia atrás) y `superseded_by` (hacia adelante) para
     reconstruir el linaje completo de una entidad y el estado en un instante dado.
   - **Adaptación en Ego:** base de las consultas bitemporales (`KB-09`, `valid_at` / `invalid_at` y `AS OF`) y del
     visor histórico de decisiones del Daily State (`DS-03`).
   - **Estado real:** asimilado en `EgoMemoryAdapter.getVersionHistory` (`packages/memory/EgoMemoryAdapter.ts:986`) y
     `getAtTimestamp` (`:1048`), **sin caller de producción** (ver §5, `DSEK-02`).
   - **Relación con Backlog Ego:** `KB-09` (Fase 06), `DS-03` (Fase 08), `REC-01` (Fase 10).
     **Compuerta:** `DSEK-02`.

### Bloque B: Identificadores Opacos y Migraciones Aditivas ###

*Ubicación en fuente:* `packages/util/brand/`, `packages/session/session-format-catalog/` y
`packages/session/session-format-v*-to-v*/`. La Ola 1 apuntaba a `packages/session/` y `packages/storage/`.

1. **Generación de Identificadores de Sesión Opacos e Inmutables**
   - **Qué hace en el clon:** desacopla el *título* legible de la identidad interna mediante **marcas de tipo**
     (`Branded<B>`, `packages/util/brand/src/index.ts:18,28`) sobre valores `randomUUID()` opacos
     (`packages/acp/acp/src/index.ts:199`). No hay prefijos lexicográficos tipo `ses_01h7x…`.
   - **Adaptación en Ego:** convención estándar de claves para todos los namespaces de VantaDB
     (`session/*`, `projects/*`, `egos/*`). Ego usa un prefijo propio (`sess_<base36>_<entropía>`,
     `packages/memory/OpaqueId.ts:30`) que **no procede del clon**; el valor transferible es la marca de tipo y el
     acoplamiento nombre ↔ clave.
   - **Relación con Backlog Ego:** `CORE-01`, `CORE-06` (Fase 01), `SUB-01` (Fase 03).
     **Compuerta:** `DSEK-03`.
2. **Evolución de Esquemas por Migraciones Puramente Aditivas**
   - **Qué hace en el clon:** el formato de sesión tiene una versión (`SESSION_FORMAT_VERSION`) y una cadena de
     migraciones adyacentes (`v0→v1→v2→v3→v4`) cuyo orden lo **deriva un generador**, no una lista escrita a mano
     (`packages/session/session-format-catalog/src/generated.ts:16-45`,
     `scripts/gen-session-format-catalog.ts`). Cada formato ya publicado queda congelado.
   - **Adaptación en Ego:** `packages/recovery/src/SchemaMigrator.ts` (`REC-06`) y la especificación
     `ego.namespaces.json`, con la condición de no romper la importación de `.vdbdump` (`REC-03`).
   - **Relación con Backlog Ego:** `REC-03`, `REC-06` (Fase 10). **Compuerta:** `DSEK-04`.

### Bloque C: Gestión de Credenciales y Compactación de Contexto ###

*Ubicación en fuente:* `packages/credentials/` y `packages/compaction/`.

1. **Aislamiento Seguro de Credenciales (`packages/credentials/`)**
   - **Qué hace en el clon:** documento YAML de credenciales con permisos de propietario; la apertura **rechaza** el
     fichero si otro usuario puede leerlo (`packages/credentials/credentials-local/src/index.ts:96,142`) y rechaza
     cualquier clave o estructura desconocida (`:196-223`). **No usa el almacén seguro del sistema operativo.**
   - **Adaptación en Ego:** `packages/security/src/CredentialManager.ts` (`SEC-03`) y `SecretsFilter.ts` (`SEC-04`),
     que ya resuelven el almacenamiento en el keychain del SO: el patrón transferible es el *fail-closed* al abrir,
     no el almacén.
   - **Relación con Backlog Ego:** `SEC-03`, `SEC-04` (Fase 11).
2. **Compactación Inteligente de Hilos de Contexto (`packages/compaction/`)**
   - **Qué hace:** Algoritmos de resumen progresivo que recortan mensajes intermedios cuando la ventana de contexto
     del LLM se satura, reteniendo instrucciones originales de sistema, resúmenes estructurados y los últimos turnos.
   - **Adaptación en Ego:** `packages/runtime/src/ContextCompaction.ts` y el ciclo de vida de memoria (`CORE-12`).
   - **Relación con Backlog Ego:** `CORE-03`, `CORE-12` (Fase 01).

### Bloque D: Hallazgos Nuevos de la Ola 3 (2026-10-20) ###

1. **Publicación Durable Exclusiva con Verificación Aislada**
   - **Qué hace:** el artefacto se prepara en un fichero temporal con `wx`, se `fsync`, se verifica en un *worker*
     aislado (`packages/session/session-persistence-jsonl/src/migration-verifier.ts`), se publica con `link()` (atómico
     y exclusivo: `EEXIST` significa que otro publicador ganó) y se acepta idempotentemente si los bytes del
     ganador coinciden. Antes de publicar se **revalida la identidad física del origen** (`dev`/`ino`/`size`/`mtime`)
     y si cambió se aborta (`generation.ts:162-168, 884-944`).
   - **Adaptación en Ego:** publicación de exportaciones de proyecto y de instantáneas de recuperación.
   - **Relación con Backlog Ego:** `REC-03`, `REC-06` (Fase 10). **Compuerta:** `DSEK-06`.
2. **Catálogo de Migraciones Generado y Cadena Adyacente Completa**
   - **Qué hace:** un generador (`scripts/gen-session-format-catalog.ts`) deriva el orden de los códecs y **falla** si
     las migraciones no llegan a la versión actual; el catálogo resultante se versiona en código
     (`packages/session/session-format-catalog/src/generated.ts`).
   - **Adaptación en Ego:** `packages/recovery/src/SchemaMigrator.ts` — el catálogo de pasos de migración debe ser
     **derivado**, no escrito a mano, y su cadena debe ser contigua.
   - **Relación con Backlog Ego:** `REC-06` (Fase 10). **Compuerta:** `DSEK-07`.
3. **Reparación de Cola Abierta por Eventos Sintéticos Deterministas**
   - **Qué hace:** `openTurnClosers` (`packages/core/session/src/repair.ts:53-98`) escanea el log, detecta el turno
     abierto y devuelve eventos sintéticos (`step/end`, `turn/end`, resultados de error) con dos causas
     (`interrupted` por caída, `forked` por bifurcación) y dos códigos (`TOOL_NOT_STARTED`, `TOOL_OUTCOME_UNKNOWN`).
     **No borra historia**: añade el cierre al final del log.
   - **Adaptación en Ego:** cierre de turnos huérfanos en `session/turns` tras un crash y tras un *fork*.
   - **Relación con Backlog Ego:** `REC-01`, `CORE-07` (Fases 01 y 10). **Compuerta:** `DSEK-08`.
4. **Bifurcación por Prefijo Inclusivo con Corte Marcado**
    - **Qué hace:** `buildForkSeed` (`packages/core/session/src/fork.ts:21-30`) copia el prefijo inclusivo exacto,
      marca el corte con un evento `session/end-seed` (`inherited: true`) y cierra la cola abierta con causales
      `forked`; los pasos ya cerrados se preservan sin cambios.
    - **Adaptación en Ego:** `packages/memory/SessionFork.ts` copia los turnos y marca `forkedFrom`, pero **no registra
      el corte heredado ni cierra un turno abierto**.
    - **Relación con Backlog Ego:** `CORE-07`, `STAB-12` (Fases 01 y 02). **Compuerta:** `DSEK-09`.
5. **Identificadores Opacos por Marca de Tipo**
    - **Qué hace:** `brandString<T>` (`packages/util/brand/src/index.ts:28`) aplica una marca de compilación sin
      cambiar el valor; el resultado es que `SessionId`, `ToolCallId` y `WorkspaceId` no son intercambiables aunque
      ambos sean `string` subyacentes.
    - **Adaptación en Ego:** tipar `SessionId`, `SubEgoId` y `FactId` sobre `packages/memory/OpaqueId.ts`.
    - **Relación con Backlog Ego:** `CORE-01`, `CORE-06` (Fase 01). **Compuerta:** `DSEK-10`.
6. **Escritura Atómica de Fichero y Serialización entre Procesos**
    - **Qué hace:** `writeFileAtomic` (`packages/util/atomic-write/src/index.ts:79`) escribe un hermano con sufijo
      aleatorio en modo `wx`, lo renombra sobre el destino y conserva los permisos del *inodo* nuevo; `withFileLock`
      serializa escritores entre procesos con un fichero `.lock` y permite el relevo si el proceso titular ya no
      existe.
    - **Adaptación en Ego:** escritura de exportaciones de proyecto y de ficheros de estado en disco.
    - **Relación con Backlog Ego:** `REC-03` (Fase 10). **Compuerta:** `DSEK-11`.
7. **Retención Acotada de Salidas con Metadatos Exactos de Omisión**
    - **Qué hace:** `packages/util/output-retention/src/index.ts` acota la salida visible al modelo y devuelve
      **exactamente** lo que se retuvo y lo que se omitió (`Omitted = { kind: 'exact', count }`), distinguiendo
      "el retenedor omitió por presupuesto" de "el origen estaba incompleto".
    - **Adaptación en Ego:** `packages/runtime/src/ContextCompaction.ts` hoy usa un presupuesto de *caracteres* con
      un aviso agregado (`:309,328-329`), sin metadatos exactos por unidad.
    - **Relación con Backlog Ego:** `CORE-03`, `CORE-12` (Fase 01). **Compuerta:** `DSEK-12`.

---

## 3. Matriz de Extracción vs Descarte ##

| Componente / Feature de DeepSeek-Harness | Archivo Fuente | Acción | Justificación Técnica |
|---|---|:---:|---|
| **Patrón Canónico de Supersede Histórico** | ADR-028 de **Ego** | 📥 **Extraer & Adaptar** | Pilar de durabilidad de Ego; la escritura vive en `FactLifecycle.supersedeFact` pero **sin caller de producción** (`DSEK-01`). |
| **Árbol de reconstrucción de estado (`version-tree`)** | `packages/memory/EgoMemoryAdapter.ts` | 📥 **Extraer & Adaptar** | Necesario para consultas bitemporales (`KB-09`) y auditoría de decisiones en `REC-01` (`DSEK-02`). |
| **Identificadores opacos** | `packages/util/brand/` + `packages/memory/OpaqueId.ts` | 📥 **Extraer & Adaptar** | Estabilidad de claves en VantaDB frente a cambios de interfaz (`DSEK-03`, `DSEK-10`). |
| **Migraciones aditivas encadenadas** | `packages/session/session-format-catalog/` | 📥 **Extraer & Adaptar** | Regla indispensable para la retrocompatibilidad y la importación de `.vdbdump` (`DSEK-04`, `DSEK-07`). |
| **Publicación durable exclusiva** | `packages/session/session-persistence-jsonl/src/generation.ts` | 📥 **Extraer & Adaptar** | Publicación atómica, idempotente y verificada (`DSEK-06`). |
| **Reparación de cola abierta** | `packages/core/session/src/repair.ts` | 📥 **Extraer & Adaptar** | Cierre determinista de turnos huérfanos sin borrar historia (`DSEK-08`). |
| **Bifurcación con corte marcado** | `packages/core/session/src/fork.ts` | 📥 **Extraer & Adaptar** | Trazabilidad del linaje en el fork de sesión (`DSEK-09`). |
| **Escritura atómica y bloqueo entre procesos** | `packages/util/atomic-write/` | 📥 **Extraer & Adaptar** | Publicación de ficheros sin estado intermedio observable (`DSEK-11`). |
| **Retención acotada de salidas** | `packages/util/output-retention/` | 📥 **Extraer & Adaptar** | Límite de contexto con metadatos exactos de omisión (`DSEK-12`). |
| **Aislamiento de credenciales (Zero Secrets)** | `packages/credentials/` | 📥 **Extraer & Adaptar** | Se transfiere el *fail-closed* al abrir; el keychain del SO ya está implementado en Ego (`SEC-03`, `SEC-04`). |
| **Compactación progresiva de contexto** | `packages/compaction/` | 📥 **Extraer & Adaptar** | Optimiza el consumo de tokens y previene desbordamientos de ventana en turnos largos. |
| **Almacenamiento relacional en SQLite** | `packages/storage/storage-sqlite/` | 🚫 **Descartada (con justificación)** | Incompatible con VantaDB 0.8.0 nativo in-process (Fjall LSM + BM25 + HNSW). |
| **Rechazo de versión en SQLite sin migraciones** | `packages/storage/storage-sqlite/src/schema.ts:20,55` | 🚫 **Descartada (con justificación)** | El backend **rechaza** toda versión distinta y no migra; contradice la política aditiva que se quiere extraer. |
| **Sistemas propietarios de benchmarks y web stress** | `benchmarks/`, `vitest.web-stress.*` | 🚫 **Descartada (con justificación)** | Específico para el testing interno de deepseek; Ego cuenta con su propia estrategia de pruebas E2E. |

---

## 4. Impacto en el Backlog de Ego y Trazabilidad ##

| ID Compuerta | Archivo / Función DeepSeek-Harness | Tarea Canónica Ego | Estado en Backlog Review |
|:---:|---|:---:|:---:|
| `DSEK-01` | ADR-028 de **Ego** (`FactLifecycle.supersedeFact`) | `CORE-07` (Fase 01), `REC-01` (Fase 10) | [`docs/review/backlog-deepseek-harness.md`](../review/backlog-deepseek-harness.md) |
| `DSEK-02` | `packages/memory/EgoMemoryAdapter.ts` (version-tree) | `CORE-07` (Fase 01), `KB-09` (Fase 06), `REC-01` (Fase 10) | [`docs/review/backlog-deepseek-harness.md`](../review/backlog-deepseek-harness.md) |
| `DSEK-03` | `packages/util/brand/` + `packages/memory/OpaqueId.ts` (IDs opacos) | `CORE-01`, `CORE-06` (Fase 01), `SUB-01` (Fase 03) | [`docs/review/backlog-deepseek-harness.md`](../review/backlog-deepseek-harness.md) |
| `DSEK-04` | `packages/session/session-format-catalog/` (migraciones aditivas) | `REC-03`, `REC-06` (Fase 10) | [`docs/review/backlog-deepseek-harness.md`](../review/backlog-deepseek-harness.md) |
| `DSEK-05` | `packages/session/session-checkpoint-policy/` (fail-closed) | `CORE-07`, `TOOL-01` (Fases 01 y 02), `REC-01` (Fase 10) | [`docs/review/backlog-deepseek-harness.md`](../review/backlog-deepseek-harness.md) |
| `DSEK-06` | `packages/session/session-persistence-jsonl/src/generation.ts` | `REC-03`, `REC-06` (Fase 10) | [`docs/review/backlog-deepseek-harness.md`](../review/backlog-deepseek-harness.md) |
| `DSEK-07` | `packages/session/session-format-catalog/src/generated.ts` | `REC-06` (Fase 10) | [`docs/review/backlog-deepseek-harness.md`](../review/backlog-deepseek-harness.md) |
| `DSEK-08` | `packages/core/session/src/repair.ts` | `REC-01` (Fase 10), `CORE-07` (Fase 01) | [`docs/review/backlog-deepseek-harness.md`](../review/backlog-deepseek-harness.md) |
| `DSEK-09` | `packages/core/session/src/fork.ts` | `CORE-07` (Fase 01), `STAB-12` (Fase 02) | [`docs/review/backlog-deepseek-harness.md`](../review/backlog-deepseek-harness.md) |
| `DSEK-10` | `packages/util/brand/src/index.ts` | `CORE-01`, `CORE-06` (Fase 01) | [`docs/review/backlog-deepseek-harness.md`](../review/backlog-deepseek-harness.md) |
| `DSEK-11` | `packages/util/atomic-write/src/index.ts` | `REC-03` (Fase 10) | [`docs/review/backlog-deepseek-harness.md`](../review/backlog-deepseek-harness.md) |
| `DSEK-12` | `packages/util/output-retention/src/index.ts` | `CORE-03`, `CORE-12` (Fase 01) | [`docs/review/backlog-deepseek-harness.md`](../review/backlog-deepseek-harness.md) |

---

## 5. Estado real verificado (2026-10-20) — Ola 3 de remediación (A5) ##

> Fuente canónica del estado por tarea: [`docs/review/backlog-deepseek-harness.md`](../review/backlog-deepseek-harness.md).
> Criterio de cierre: fichero adaptado **y** caller en producción (grep sobre `packages/` +
> `apps/desktop/`, excluyendo `test/`). Verificado con `git grep` sobre el árbol de trabajo.

| ID | Patrón | Estado | Evidencia / Fundamento |
|---|---|:---:|---|
| `DSEK-01` | Supersede histórico (soft-replace) | 🚫 Descartada (con justificación) | 🚫 Escritura no alcanzable: `supersedeFact` (`packages/knowledge/src/FactLifecycle.ts:117`) sólo se invoca desde `consolidateMemories` (`:183`), sin callers de producción. `EgoMemoryAdapter.supersedeFact` (`packages/memory/EgoMemoryAdapter.ts:892`) tampoco. |
| `DSEK-02` | Version-tree / time-travel | 🚫 Descartada (con justificación) | 🚫 Sin caller: `packages/memory/EgoMemoryAdapter.ts:986,1048`. Las queries bitemporales en producción son `packages/knowledge/src/BitemporalQueries.ts`. **Codigo muerto:** modulo asimilado sin caller de produccion -> retirar. Zona duenosa: @ego/memory (A2). **Codigo muerto:** modulo asimilado sin caller de produccion -> retirar. Zona duenosa: @ego/memory (A2). **Codigo muerto:** modulo asimilado sin caller de produccion -> retirar. Zona duenosa: @ego/memory (A2). |
| `DSEK-03` | IDs opacos | 🚫 Descartada (con justificación) | 🚫 Sin caller efectivo: `generateOpaqueId` (`packages/memory/OpaqueId.ts:30`) sólo lo usa `SessionCheckpointPolicy.ts:155`, que tampoco está cableada. Los `sessionId` en producción son cadenas libres (`apps/desktop/src/ipc/schema.ts:712`). **Codigo muerto:** modulo asimilado sin caller de produccion -> retirar. Zona duenosa: @ego/memory (A2). **Codigo muerto:** modulo asimilado sin caller de produccion -> retirar. Zona duenosa: @ego/memory (A2). **Codigo muerto:** modulo asimilado sin caller de produccion -> retirar. Zona duenosa: @ego/memory (A2). |
| `DSEK-04` | Migraciones aditivas | 🚫 Descartada (con justificación) | 🚫 Sin ejecucion real: `ProjectImport.ts:16` es `import type` y la dependencia es opcional; `SnapshotManager.ts:100` instancia `new ProjectImport(this.adapter)` sin migrador, luego `if (this.schemaMigrator)` (`:181`) nunca es true. 0 ocurrencias de `new SchemaMigrator`. La migracion aditiva vive en `ProjectImport` + `KnowledgeExport` + `SensitiveNamespaces`. **Owner: A3.** **Codigo muerto:** modulo asimilado sin caller de produccion -> retirar. Zona duenosa: @ego/recovery (A3). |
| `DSEK-05` | Checkpoint policy fail-closed | 🚫 Descartada (con justificación) | 🚫 Sin caller: `packages/memory/SessionCheckpointPolicy.ts:43`; `DailyStatePersistence.ts:138` es un **comentario**, no un import. La frontera real es `packages/security/src/ToolPermissions.ts` (`evaluateToolCall` -> `register-ipc.ts`). **Codigo muerto:** modulo asimilado sin caller de produccion -> retirar. Zona duenosa: @ego/memory (A2). **Codigo muerto:** modulo asimilado sin caller de produccion -> retirar. Zona duenosa: @ego/memory (A2). **Codigo muerto:** modulo asimilado sin caller de produccion -> retirar. Zona duenosa: @ego/memory (A2). |
| `DSEK-06` | Publicación durable exclusiva | ⏳ Futura (Fase 10) | Fuente: `packages/session/session-persistence-jsonl/src/generation.ts:817-843` (`publishCurrentExclusive` con `link()` atómico y `EEXIST` → conflicto), `:884-944` (`publishPreparedMigration` con revalidación de identidad física del origen antes de publicar), `:492-551` (`verifyJsonlCurrentGeneration`) y `packages/session/session-persistence-jsonl/src/migration-verifier.ts:20-21` (verificación en *worker* aislado con límite de concurrencia). **Ego no tiene equivalente**: `packages/recovery/src/ProjectImport.ts` y `packages/recovery/src/ProjectExport.ts` no aplican publicación exclusiva ni verificación previa. Cableado en Fase 10 (REC-03/REC-06): publicar el `.vdbdump` con temporal único → verificar en aislamiento → `link()` atómico → revalidar identidad de origen. |
| `DSEK-07` | Catálogo de migraciones generado | ⏳ Futura (Fase 10) | Fuente: `packages/session/session-format-catalog/src/generated.ts:16-45` (`currentVersion: 4` + 4 migraciones adyacentes) y `scripts/gen-session-format-catalog.ts`, que deriva el orden de los códecs y **falla** si las migraciones no alcanzan la versión actual; cookbook en `docs/cookbook/adding-a-session-format-version.md:42`. **Ego**: `packages/recovery/src/SchemaMigrator.ts` declara su cadena de pasos a mano y detecta discontinuidad en caliente (`:128`), sin catálogo generado ni verificación de contigüidad previa. Cableado en Fase 10 (REC-06): derivar el catálogo de migraciones desde una única fuente versionada. |
| `DSEK-08` | Reparación de cola abierta | ⏳ Futura (Fase 10) | Fuente: `packages/core/session/src/repair.ts:53-98` (`openTurnClosers`) con causas `interrupted` / `forked` (`:29`) y códigos `TOOL_NOT_STARTED` / `TOOL_OUTCOME_UNKNOWN` (`:15,18`); el texto que ve el modelo distingue "omitido por presupuesto" de "origen incompleto". **Ego**: `packages/recovery/src/CrashRecoveryEngine.ts` cubre *dirty shutdown*, *lock* de disco y *heartbeat* (`:92-175`), pero **no** repara colas de turno abiertas en `session/turns`. Cableado en Fase 10 (REC-01): cerrar turnos huérfanos con eventos sintéticos al recuperar, sin borrar historia. |
| `DSEK-09` | Fork con corte marcado | 🆕 Pendiente | 🆕 Falta el evento de corte `session/end-seed` y el conteo `inheritedEventCount` en `packages/memory/SessionFork.ts` (solo hay `forkedFrom`/`forkedAtMs` en `:81-82`). **Owner: A2.** |
| `DSEK-10` | IDs opacos por marca de tipo | 🆕 Pendiente | 🆕 Falta la marca de tipo de compilacion (`Branded<>`/`brandString`): 0 hits; los IDs siguen siendo `string` sin distincion. **Owner: A2.** |
| `DSEK-11` | Escritura atómica y bloqueo entre procesos | ⏳ Futura (Fase 10) | Fuente: `packages/util/atomic-write/src/index.ts:79` (`writeFileAtomic`: hermano con sufijo aleatorio en `wx`, `rename` sobre el destino, permisos del *inodo* nuevo) y `:1-11` (`withFileLock`: serialización entre procesos con relevo si el titular murió). **Ego** no tiene equivalente para sus ficheros de estado en disco; las exportaciones de `packages/recovery/src/ProjectExport.ts` no pasan por un temporal + `rename`. Cableado en Fase 10 (REC-03): escribir toda salida a disco con temporal + `rename` y usar el *lock* para el ciclo read-modify-write. |
| `DSEK-12` | Retención acotada de salidas | 🆕 Pendiente | 🆕 Falta la retencion acotada con metadatos exactos de omision (`Omitted` / `ItemRetainer` / `TextRetainer`): 0 hits. **Owner: A2.** |

**Recuento:** 0 `✅ Completada` · 5 `🚫 Descartada` · 3 `🆕 Pendiente` · 4 `⏳ Futura` — **12 tareas**.

---

## 6. Correcciones de la Ola 3 sobre afirmaciones de la ficha de la Ola 1 ##

| Afirmación de la Ola 1 | Realidad verificada el 2026-10-20 | Veredicto |
|---|---|:---:|
| `ADR-028` es un artefacto de `deepseek-harness` | `grep ADR-028` en el clon → **0 coincidencias**. El ADR-028 es de **Ego** y se referencia desde `packages/memory/EgoMemoryAdapter.ts:890`. | 🚫 **Descartada (con justificación)** — atribución cruzada de un ADR propio a un repo de referencia. |
| El patrón `superseded_by` / `is_latest` está implementado en `packages/` del clon | `git grep superseded_by -- packages` → **ninguna escritura de registro**; solo semántica de evento (`packages/api/session-controller/src/client/contract/events.ts:29`) y de mensaje (`packages/llm/llm/src/message.ts:60`). | 🚫 **Descartada (con justificación)** — el patrón es de Ego; el clon aporta *log append-only*, no punteros de sustitución. |
| La implementación del versionado está en `snapshots/session/` | `snapshots/AGENTS.md` describe ese árbol como **corpus de fixtures de prueba**; la implementación está en `packages/session/session-persistence-jsonl/` y `packages/core/session/`. | 🚫 **Descartada (con justificación)** — se citaba el árbol de tests como fuente de producto. |
| Las migraciones aditivas del clon están en `packages/storage/` | `packages/storage/storage-sqlite/src/schema.ts:20` fija `STORAGE_SQLITE_SCHEMA_VERSION = 1` y `:55` **rechaza** toda versión distinta (*"this unreleased format has no migrations"*). | 🚫 **Descartada (con justificación)** — el backend citado hace lo contrario de lo que se le atribuye. |
| Los IDs opacos del clon usan prefijos tipo `ses_01h7x…` | El clon usa `randomUUID()` con marca de tipo (`packages/util/brand/src/index.ts:28`); el prefijo `sess_<base36>_<entropía>` es la convención **propia de Ego** (`packages/memory/OpaqueId.ts:30`). | 🚫 **Descartada (con justificación)** — el ejemplo de la ficha no existe en el repositorio citado. |
| Las credenciales del clon viven en el almacén seguro del sistema operativo | `packages/credentials/credentials-local/src/index.ts:2` las guarda en `$DSH_HOME/.credentials.yaml` con permisos de propietario (`:96,142`). | 🚫 **Descartada (con justificación)** — el keychain del SO es la implementación **de Ego**, más fuerte que la del clon. |
| `DSEK-01`, `DSEK-03` y `DSEK-05` tienen caller en producción | 0 callers de producción para `FactLifecycle.supersedeFact`, `generateOpaqueId` y `SessionCheckpointPolicy` (ver §5). | 🆕 **Pendiente** — el patrón existe y está probado, pero el **cableado de producción falta**. |
| `EgoMemoryAdapter.supersedeFact` está en `:867` (interfaz) y `:875` (implementación) | Las líneas reales son `:892` (declaración) y `:900` (implementación); `getVersionHistory` en `:986` y `getAtTimestamp` en `:1048`. | 🚫 **Descartada (con justificación)** — referencias de línea desfasadas (el fichero creció). |

---

## 7. Corregendum sobre el identificador del método de supersede ##

La redacción original de esta ficha decía: *"Ya extraído y validado en la suite de integración de
`EgoMemoryAdapter` (`packages/memory/EgoMemoryAdapter.ts:206` método `supersede()`)"*.

Verificación 2026-10-19 (Ola 1) y 2026-10-20 (Ola 3):

| Afirmación original | Realidad verificada | Estado |
|---|---|:---:|
| `EgoMemoryAdapter.ts:206` contiene `supersede()` | La línea 206 no es el método; los símbolos reales son `supersedeFact` (declaración `:892`, implementación `:900`) y `excludeSuperseded` (opción `:109`). | 🚫 **Descartada (con justificación)** — la referencia de línea y el nombre del método eran incorrectos. |
| `EgoMemoryAdapter.supersedeFact` es la implementación validada en producción | El método **no tiene caller**; la implementación viva del patrón es `FactLifecycle.supersedeFact` (`packages/knowledge/src/FactLifecycle.ts:117`), que reproduce el patrón sobre `adapter.put/get` — pero su único invocante (`consolidateMemories`, `:232`) tampoco tiene caller de producción. | 🆕 **Pendiente** — el patrón **existe** y está probado, pero ningún camino de producción lo ejecuta todavía. |
