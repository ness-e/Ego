# Extracción Técnica: Career-Ops (repos-referencia/career-ops)

| Campo | Valor |
| --- | --- |
| Estado | Activo — Documento canónico de extracción y análisis de capacidades |
| Repositorio Origen | `repos-referencia/career-ops/` (Commit verificado: oct-2026) |
| Stack del Origen | Node.js (ESM puro `.mjs`) + File System Local + Scripts de Integración |
| Rol en Ego | Referencia de Gobernanza de Datos, Locks Atómicos de Filesystem y Cuarentena de Payloads |
| Owner | ness-e |
| Fecha | 2026-10-08 |

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia

`career-ops` es una suite de herramientas locales para gestión y seguimiento de operaciones profesionales. A pesar de que su capa de negocio está orientada a la búsqueda y postulación de empleo, su arquitectura interna de manejo de datos implementa **mecanismos de integridad de datos y concurrencia sobre el sistema de archivos de muy alto rigor**: un contrato canónico de propiedad de datos (`DATA_CONTRACT.md`), un protocolo de exclusión mutua basado en lockfiles para escrituras concurrentes (`pipeline-lock.mjs`) y suites de validación contra escrituras en rutas prohibidas y contenido no confiable.

### Divergencias Fundamentales (Qué Descartamos y Por Qué)

| Dimensión | Career-Ops | Ego (Cognitive OS) | Decisión Crítica |
|---|---|---|---|
| **Modelo de Dominio / Negocio** | Scanners de portales de empleo ATS (`scan-ats-full.mjs`), calculadoras de sueldos (`salary-gap.mjs`), trackers de postulaciones de trabajo. | Sistema Operativo Cognitivo (SOC) general de escritorio para ingeniería, producto y memoria. | **DESCARTAR por Violación de Dominio (Guardrail §4 de `AGENTS.md`)**. Todos los módulos de búsqueda laboral, cálculo salarial y sincronización de CVs quedan estrictamente fuera del alcance de Ego. |
| **Persistencia Principal** | Archivos Markdown y JSON dispersos en carpetas locales (`tracker.mjs`). | VantaDB 0.8.0 nativo in-process (`NativeVantaDB` vía napi-rs) con namespaces tipados. | **ADAPTAR**. Ego no almacena el estado principal en JSONs crudos; adopta la lógica de bloqueo y contratos de `career-ops` aplicándola a las herramientas de filesystem (`ACT-04`) y a la exportación `.vdbdump` (`REC-01`, `REC-03`). |
| **Manejo de Errores** | Scripts ESM independientes que abortan con código de salida 1. | Sistema de manejo de errores causal y supervisor con recuperación automática (`ErrorHandler.ts`, `ExecutionManager.ts`). | **ADAPTAR**. Encapsular los patrones de validación en clases TypeScript con tipado estricto Zod y excepciones controladas. |

---

## 2. Catálogo Detallado de Capacidades, Herramientas y Patrones Extraíbles

### Bloque A: Contrato Canónico de Separación de Datos (User vs System)
*Ubicación en fuente:* `repos-referencia/career-ops/DATA_CONTRACT.md`

1. **Partición Categórica de Datos (`DATA_CONTRACT.md:1-200`)**
   - **Qué hace:** Establece una frontera innegociable entre:
     - **Archivos y Memorias del Usuario:** Archivos creados, editados o marcados explícitamente por el usuario humano. El sistema tiene **prohibido sobreescribirlos o eliminarlos** sin confirmación explícita (inmutabilidad por defecto).
     - **Archivos y Caches del Sistema:** Índices, embeddings, checkpoints temporales y logs de ejecución generados por agentes. El sistema puede purgarlos, reindexarlos o invalidarlos de forma autónoma.
   - **Adaptación en Ego:** Fundamento para la política de persistencia de Ego (`CORE-07`), el sistema de namespaces en `ego.namespaces.json` (`system/*` vs `users/*` vs `projects/*`) y la exportación de proyectos (`REC-01`, `REC-03`).
   - **Relación con Backlog Ego:** `CORE-07` (Fase 01), `REC-01`, `REC-03` (Fase 10). **Compuerta:** `CARP-01`.

---

### Bloque B: Concurrencia y Exclusión Mutua en Disco (File Locking)
*Ubicación en fuente:* `repos-referencia/career-ops/pipeline-lock.mjs` y `tracker-writer-lock-tests.mjs`

2. **Mecanismo de Lock Atómico con Timeout y Reintentos (`pipeline-lock.mjs`)**
   - **Qué hace:** Implementa un algoritmo de adquisición de lockfile atómico (`.lock`) sobre el sistema de archivos utilizando operaciones de apertura exclusiva (`fs.open` con flag `wx`). Si múltiples herramientas o agentes intentan escribir sobre el mismo recurso simultáneamente, el proceso espera con backoff exponencial hasta que el lock se libere o expire por timeout (evitando deadlocks por procesos caídos).
   - **Herramientas que usa:** Flags de bajo nivel de Node `fs`, temporizadores de backoff, verificación de PID en lockfiles para detectar procesos zombies.
   - **Adaptación en Ego:** Implementar en `packages/execution/src/fs/FileLockManager.ts`. Vital para las herramientas nativas de filesystem de Ego (`ACT-04` `fs.writeFile`) y para evitar carreras cuando múltiples Sub-Egos operan sobre el mismo workspace del usuario.
   - **Relación con Backlog Ego:** `ACT-04` (Fase 02), `REC-01` (Fase 10). **Compuerta:** `CARP-02`.

---

### Bloque C: Seguridad de Rutas y Cuarentena de Contenido No Confiable
*Ubicación en fuente:* `repos-referencia/career-ops/validate-system-paths-coverage.mjs` y `validate-untrusted-content-coverage.mjs`

3. **Auditoría Estricta de Cobertura de Rutas de Sistema (`validate-system-paths-coverage.mjs`)**
   - **Qué hace:** Suite de validación en tiempo de arranque que comprueba que todas las operaciones de lectura y escritura estén confinadas a rutas permitidas (whitelist de directorios de proyecto), bloqueando intentos de escape hacia directorios críticos del sistema operativo (`C:\Windows`, `/etc`, claves SSH, credenciales).
   - **Adaptación en Ego:** Base para la política de sandboxing de herramientas locales en Fase 02 (`ACT-04`, `ACT-06`) y en Fase 11 (`SEC-01`, `SEC-05`).
   - **Relación con Backlog Ego:** `ACT-04`, `SEC-01`, `SEC-05`. **Compuerta:** `CARP-03`.

4. **Cuarentena de Contenido No Confiable (`validate-untrusted-content-coverage.mjs`)**
   - **Qué hace:** Analiza payloads entrantes desde fuentes externas (archivos descargados, respuestas de APIs de terceros) y los aísla en un directorio de cuarentena con permisos restrictivos antes de permitir su indexación o ejecución.
   - **Adaptación en Ego:** Mapeo directo al namespace de Cuarentena de VantaDB (`quarantine/pending` y `EgoMemoryAdapter.promoteFromQuarantine`, ADR-046) y a la aprobación de acciones sensibles (`ACT-06`, `SEC-04`).
   - **Relación con Backlog Ego:** `ACT-06` (Fase 02), `KB-07` (Fase 06), `SEC-04` (Fase 11). **Compuerta:** `CARP-04`.

---

## 3. Matriz de Extracción vs Descarte

| Componente / Feature de Career-Ops | Archivo Fuente | Acción | Justificación Técnica |
|---|---|:---:|---|
| **Contrato de datos Usuario vs Sistema (`DATA_CONTRACT.md`)** | `DATA_CONTRACT.md` | 📥 **Extraer & Adaptar** | Regla de gobernanza indispensable para garantizar la soberanía de los datos del usuario en Ego. |
| **Lockfile atómico para exclusión mutua (`pipeline-lock.mjs`)** | `pipeline-lock.mjs` | 📥 **Extraer & Adaptar** | Previene condiciones de carrera y corrupción de archivos en escrituras concurrentes de Sub-Egos. |
| **Validador de rutas permitidas del sistema** | `validate-system-paths-coverage.mjs` | 📥 **Extraer & Adaptar** | Componente esencial del Sandboxing y del Execution Manager para seguridad de herramientas de disco. |
| **Cuarentena de payloads no confiables** | `validate-untrusted-content-coverage.mjs` | 📥 **Extraer & Adaptar** | Se sincroniza con la arquitectura de cuarentena de hechos de VantaDB (ADR-046). |
| **Scrapers de portales de empleo (ATS Dayforce, Interamt, etc.)** | `scan-ats-full.mjs`, `scan-dayforce.mjs` | 🚫 **Descartar (Justificado)** | Dominio ajeno (Guardrail §4 de `AGENTS.md`). No pertenece al alcance de Ego SOC. |
| **Cálculo de brechas salariales y trackers de empleo** | `salary-gap.mjs`, `tracker.mjs` | 🚫 **Descartar (Justificado)** | Dominio ajeno. Ego es un sistema operativo cognitivo, no una plataforma de reclutamiento. |
| **Verificación de estructuras de CVs** | `verify-cv-structure.mjs`, `verify-cv-facts.mjs` | 🚫 **Descartar (Justificado)** | Dominio ajeno y lógica de negocio específica innecesaria. |

---

## 4. Impacto en el Backlog de Ego y Trazabilidad

| ID Compuerta | Archivo / Función Career-Ops | Tarea Canónica Ego | Estado en Backlog Review |
|:---:|---|:---:|:---:|
| `CARP-01` | `DATA_CONTRACT.md:1-200` (User vs System Contract) | `CORE-07` (Fase 01), `REC-01` (Fase 10) | [`docs/review/backlog-career-ops.md`](../review/backlog-career-ops.md) |
| `CARP-02` | `pipeline-lock.mjs` (Atomic File Lock) | `ACT-04` (Fase 02), `REC-01` (Fase 10) | [`docs/review/backlog-career-ops.md`](../review/backlog-career-ops.md) |
| `CARP-03` | `validate-system-paths-coverage.mjs` (Path Whitelisting) | `ACT-04` (Fase 02), `SEC-01`, `SEC-05` (Fase 11) | [`docs/review/backlog-career-ops.md`](../review/backlog-career-ops.md) |
| `CARP-04` | `validate-untrusted-content-coverage.mjs` (Quarantine) | `ACT-06` (Fase 02), `KB-07` (Fase 06), `SEC-04` (Fase 11) | [`docs/review/backlog-career-ops.md`](../review/backlog-career-ops.md) |
