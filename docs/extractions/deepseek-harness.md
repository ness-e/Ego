# Extracción Técnica: DeepSeek-Harness (repos-referencia/deepseek-harness)

| Campo | Valor |
| --- | --- |
| Estado | Activo — Documento canónico de extracción y análisis de capacidades |
| Repositorio Origen | `repos-referencia/deepseek-harness/` (Commit verificado: oct-2026) |
| Stack del Origen | Monorepo TypeScript (pnpm) + Electron/Node.js + Vitest + Oxlint/Biome + SQLite / JSON Snapshots |
| Rol en Ego | Referencia de Versionado de Sesiones, Patrón Supersede, Identificadores Opacos y Migraciones Aditivas |
| Owner | ness-e |
| Fecha | 2026-10-08 |

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia

`deepseek-harness` es un arnés de ejecución de agentes y orquestación multi-modelo construido como un monorepo TypeScript integral. Su contribución más valiosa para Ego radica en su **modelo de datos temporal y resiliente**: implementa un riguroso patrón de mutaciones no destructivas mediante sustitución suave (*soft-replace / supersede*), preservación inmutable del árbol genealógico de versiones de sesión y el desacoplamiento estricto de identificadores internos mediante IDs opacos.

### Divergencias Fundamentales (Qué Descartamos y Por Qué)

| Dimensión | DeepSeek-Harness | Ego (Cognitive OS) | Decisión Crítica |
|---|---|---|---|
| **Motor de Almacenamiento** | SQLite relacional con esquemas tradicionales + snapshots JSON planos en disco (`packages/storage/`). | VantaDB 0.8.0 nativo in-process (`NativeVantaDB` vía napi-rs) sobre Fjall LSM y búsqueda federada. | **DESCARTAR SQLite**. Ego ejecuta su persistencia sobre VantaDB. El patrón supersede se implementa directamente en los namespaces de VantaDB sin tablas SQL. |
| **Arquitectura de Agentes** | Harness centrado en un modelo monolítico con subprocesos subordinados transitorios. | Multi-Sub-Ego colaborativo con identidades persistentes, memorias privadas (`egos/<id>/*`) y memoria compartida. | **ADAPTAR**. Extraer los esquemas de linaje y versionado de estados, adaptándolos a los manifiestos de Sub-Egos (`SUB-01`) de Ego. |
| **Tool Calling & Sandboxing** | Ejecución directa de subprocesos con envolturas ad-hoc. | Execution Manager centralizado (`ACT-03`) con límites de cuota, timeouts y aprobación HITL obligatoria. | **ADAPTAR**. Las políticas de aislamiento de deepseek-harness se integran dentro de las compuertas de seguridad de Ego (`SEC-01`, `SEC-05`). |

---

## 2. Catálogo Detallado de Capacidades, Herramientas y Patrones Extraíbles

### Bloque A: Versionado Inmutable y Patrón Canónico de Supersede
*Ubicación en fuente:* `repos-referencia/deepseek-harness/snapshots/session/` y `packages/session/` (ADR-028)

1. **Patrón Canónico de Supersede Histórico (`snapshots/session/`, ADR-028)**
   - **Qué hace:** Prohíbe terminantemente la sobreescritura destructiva (`UPDATE` / `DELETE` en caliente) de memorias, hechos y estados de sesión. Cuando una entidad cambia, se genera un nuevo registro inmutable con una nueva versión temporal, y el registro anterior se actualiza marcando `superseded_by: <new_id>` e `is_latest: false`.
   - **Herramientas que usa:** Grafos dirigidos acíclicos (DAG) de versiones, punteros inmutables.
   - **Adaptación en Ego:** Ya extraído y validado en la suite de integración de `EgoMemoryAdapter` (`packages/memory/EgoMemoryAdapter.ts:206` método `supersede()`). Aplica transversalmente a `CORE-07` y a la recuperación ante desastres `REC-01`.
   - **Relación con Backlog Ego:** `CORE-07` (Fase 01), `KB-08` (Fase 06), `REC-01` (Fase 10). **Compuerta:** `DSEK-01`.

2. **Reconstrucción de Estado por Árbol de Versiones (`version-tree`)**
   - **Qué hace:** Algoritmo que, dado un ID de entidad y un timestamp objetivo, recorre el linaje histórico de registros para reconstruir con exactitud milimétrica el estado del sistema en cualquier punto del pasado (*Time-Travel Debugging & State Reconstitution*).
   - **Adaptación en Ego:** Base para las consultas bitemporales (`KB-09` `valid_at` / `invalid_at` y `AS OF`) y para el visor histórico de decisiones en el Daily State (`DS-03`).
   - **Relación con Backlog Ego:** `KB-09` (Fase 06), `DS-03` (Fase 08), `REC-01` (Fase 10). **Compuerta:** `DSEK-02`.

---

### Bloque B: Identificadores Opacos y Migraciones Aditivas
*Ubicación en fuente:* `repos-referencia/deepseek-harness/packages/session/` y `packages/storage/`

3. **Generación de Identificadores de Sesión Opacos e Inmutables**
   - **Qué hace:** Desacopla por completo los nombres legibles o títulos de conversaciones asignados por el usuario de las claves primarias internas del sistema. Utiliza IDs opacos prefijados criptográficamente (ej. `ses_01h7x...`, `sub_01h8y...`), impidiendo que el renombre de una conversación rompa referencias o relaciones de memoria.
   - **Adaptación en Ego:** Convención estándar de claves para todos los namespaces de VantaDB (`session/*`, `projects/*`, `egos/*`).
   - **Relación con Backlog Ego:** `CORE-01`, `CORE-06` (Fase 01), `SUB-01` (Fase 03). **Compuerta:** `DSEK-03`.

4. **Evolución de Esquemas por Migraciones Puramente Aditivas**
   - **Qué hace:** Política estricta de evolución de esquemas de datos:
     - Nunca eliminar una clave o namespace existente en versiones posteriores.
     - Cualquier nuevo requerimiento se introduce mediante campos opcionales con valores predeterminados seguros o nuevos namespaces derivados.
     - Garantiza que cualquier backup histórico o volcado `.vdbdump` pueda importarse en versiones modernas sin requerir migraciones destructivas de base de datos.
   - **Adaptación en Ego:** Estandarización de `packages/memory/SchemaMigrator.ts` (`REC-06`) y de la especificación `ego.namespaces.json`.
   - **Relación con Backlog Ego:** `REC-03`, `REC-06` (Fase 10). **Compuerta:** `DSEK-04`.

---

### Bloque C: Gestión de Credenciales y Compactación de Contexto
*Ubicación en fuente:* `repos-referencia/deepseek-harness/packages/credentials/` y `packages/compaction/`

5. **Aislamiento Seguro de Credenciales (`packages/credentials/`)**
   - **Qué hace:** Capa de abstracción que intermedia entre la configuración de proveedores de modelos y el almacenamiento seguro de credenciales en el sistema operativo, garantizando que las API keys nunca se serialicen en payloads de logging ni en dumps de depuración.
   - **Adaptación en Ego:** Base arquitectónica para `packages/security/CredentialManager.ts` (`SEC-03`) y `SecretsFilter.ts` (`SEC-04`).
   - **Relación con Backlog Ego:** `SEC-03`, `SEC-04` (Fase 11).

6. **Compactación Inteligente de Hilos de Contexto (`packages/compaction/`)**
   - **Qué hace:** Algoritmos de resumen progresivo que recortan mensajes intermedios cuando la ventana de contexto del LLM se satura, reteniendo instrucciones originales de sistema, resúmenes estructurados y los últimos turnos de interacción.
   - **Adaptación en Ego:** Integración en el Cognitive Runtime (`packages/runtime/ContextAssembly.ts`) y en el ciclo de vida de memoria (`CORE-12`).
   - **Relación con Backlog Ego:** `CORE-03`, `CORE-12` (Fase 01).

---

## 3. Matriz de Extracción vs Descarte

| Componente / Feature de DeepSeek-Harness | Archivo Fuente | Acción | Justificación Técnica |
|---|---|:---:|---|
| **Patrón Canónico de Supersede Histórico** | `snapshots/session/`, `ADR-028` | 📥 **Extraer & Adaptar** | Pilar de durabilidad de Ego; ya implementado y validado en `EgoMemoryAdapter.supersede()`. |
| **Árbol de reconstrucción de estado (`version-tree`)** | `packages/session/` | 📥 **Extraer & Adaptar** | Necesario para consultas bitemporales (`KB-09`) y auditoría de decisiones en `REC-01`. |
| **Identificadores opacos prefijados e inmutables** | `packages/session/` | 📥 **Extraer & Adaptar** | Garantiza estabilidad de claves en VantaDB frente a modificaciones de la interfaz. |
| **Migraciones aditivas sin eliminación destructiva** | `packages/storage/` | 📥 **Extraer & Adaptar** | Regla indispensable para la retrocompatibilidad y la importación de `.vdbdump` (`REC-03`, `REC-06`). |
| **Aislamiento de credenciales (Zero Secrets)** | `packages/credentials/` | 📥 **Extraer & Adaptar** | Se transfiere directamente a la arquitectura de seguridad de Ego (`SEC-03`, `SEC-04`). |
| **Compactación progresiva de contexto** | `packages/compaction/` | 📥 **Extraer & Adaptar** | Optimiza el consumo de tokens y previene desbordamientos de ventana en turnos largos. |
| **Almacenamiento relacional en SQLite** | `packages/storage/` | 🚫 **Descartar (Justificado)** | Incompatible con VantaDB 0.8.0 nativo in-process (Fjall LSM + BM25 + HNSW). |
| **Sistemas propietarios de benchmarks y web stress** | `benchmarks/`, `vitest.web-stress.*` | 🚫 **Descartar (Justificado)** | Específico para el testing interno de deepseek; Ego cuenta con su propia estrategia de pruebas E2E. |

---

## 4. Impacto en el Backlog de Ego y Trazabilidad

| ID Compuerta | Archivo / Función DeepSeek-Harness | Tarea Canónica Ego | Estado en Backlog Review |
|:---:|---|:---:|:---:|
| `DSEK-01` | `snapshots/session/`, `ADR-028` (Supersede) | `CORE-07` (Fase 01), `REC-01` (Fase 10) | ✅ Completada en `EgoMemoryAdapter` |
| `DSEK-02` | `packages/session/` (Version-tree) | `CORE-07` (Fase 01), `KB-09` (Fase 06), `REC-01` (Fase 10) | [`docs/review/backlog-deepseek-harness.md`](../review/backlog-deepseek-harness.md) |
| `DSEK-03` | `packages/session/` (Opaque IDs) | `CORE-01`, `CORE-06` (Fase 01), `SUB-01` (Fase 03) | [`docs/review/backlog-deepseek-harness.md`](../review/backlog-deepseek-harness.md) |
| `DSEK-04` | `packages/storage/` (Additive migrations) | `REC-03`, `REC-06` (Fase 10) | [`docs/review/backlog-deepseek-harness.md`](../review/backlog-deepseek-harness.md) |
