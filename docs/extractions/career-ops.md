# Extracción Técnica: Career-Ops (repos-referencia/career-ops) ##

| Campo | Valor |
| --- | --- |
| Estado | Activo — Documento canónico de extracción y análisis de capacidades |
| Repositorio Origen | `repos-referencia/career-ops/` (Commit verificado: oct-2026) |
| Stack del Origen | Node.js (ESM puro `.mjs`) + File System Local + Scripts de Integración |
| Rol en Ego | Referencia de Gobernanza de Datos, Exclusión Mutua en Disco y Escritura Atómica |
| Owner | ness-e |
| Fecha | 2026-10-08 |
| Última revisión | 2026-10-20 — Ola 2 (revisión de fondo; compuertas `CARP-05..08` añadidas) |

---

## 1. Resumen Ejecutivo y Evaluación de Divergencia ##

`career-ops` es una suite local de herramientas para gestión de operaciones profesionales.
Su capa de negocio —búsqueda y postulación de empleo— queda **fuera del alcance de Ego**
(Guardrail §4 de `AGENTS.md`): ni ATS, ni vacantes, ni candidatura, ni CV, ni salario,
ni portales de empleo entran en el producto.

Lo que el repositorio sí aporta a Ego es una capa de **integridad de datos y concurrencia
sobre el sistema de archivos**, de rigor inusual para un proyecto de scripts:

- Un **contrato canónico de propiedad de datos** (`DATA_CONTRACT.md`) que separa la capa de
  usuario (preservada por las actualizaciones) de la capa de sistema (auto-actualizable).
- Un **protocolo de exclusión mutua entre procesos** (`pipeline-lock.mjs`) con directorio de
  lock, sello de propietario, guardia de recuperación, backoff con jitter y veredicto tri-estado.
- **Validadores de cobertura fail-closed** que *derivan* el conjunto de ficheros sujetos a una
  regla en lugar de mantener una lista codificada a mano
  (`validate-system-paths-coverage.mjs`, `validate-untrusted-content-coverage.mjs`).
- Una **primitiva de escritura atómica** (`tracker-utils.mjs`) con reintento ante contención de
  `rename` en Windows y preservación explícita de permisos.
- Un **marcador de procedencia no decadente** (`story-provenance-check.mjs`) que impide que un
  dato derivado sin verificar se presente como hecho establecido.

### Divergencias Fundamentales (Qué Descartamos y Por Qué) ##

| Dimensión | Career-Ops | Ego (Cognitive OS) | Decisión Crítica |
|---|---|---|---|
| **Modelo de Dominio / Negocio** | Scanners de portales de empleo ATS (`scan-ats-full.mjs`), calculadoras de sueldos (`salary-gap.mjs`), trackers de postulaciones de trabajo. | Sistema Operativo Cognitivo (SOC) general de escritorio para ingeniería, producto y memoria. | **DESCARTAR por Violación de Dominio (Guardrail §4 de `AGENTS.md`)**. Todos los módulos de búsqueda laboral, cálculo salarial y sincronización de CVs quedan estrictamente fuera del alcance de Ego. |
| **Persistencia Principal** | Archivos Markdown y JSON dispersos en carpetas locales (`tracker.mjs`). | VantaDB 0.8.0 nativo in-process (`NativeVantaDB` vía napi-rs) con namespaces tipados. | **ADAPTAR**. Ego no almacena el estado principal en JSONs crudos; adopta la lógica de bloqueo y contratos de `career-ops` aplicándola a las herramientas de filesystem (`ACT-04`) y a la exportación `.vdbdump` (`REC-01`, `REC-03`). |
| **Manejo de Errores** | Scripts ESM independientes que abortan con código de salida 1. | Sistema de manejo de errores causal y supervisor con recuperación automática (`ErrorHandler.ts`, `ExecutionManager.ts`). | **ADAPTAR**. Encapsular los patrones de validación en clases TypeScript con tipado estricto Zod y excepciones controladas. |

---

## 2. Catálogo Detallado de Capacidades, Herramientas y Patrones Extraíbles ##

### Bloque A: Contrato Canónico de Separación de Datos (User vs System) ##

*Ubicación en fuente:* `repos-referencia/career-ops/DATA_CONTRACT.md:1-202`

#### A.1 Partición categórica de datos y regla de no-modificación ##

- **Qué hace:** fija una frontera innegociable. La capa de usuario (`DATA_CONTRACT.md:5-64`)
  contiene los ficheros creados o editados por la persona; la regla es explícita: *"If a file is
  user-owned, no update process may modify or delete it"* (`DATA_CONTRACT.md:184`). La capa de
  sistema (`DATA_CONTRACT.md:89-181`) puede reemplazarse con la versión upstream. El documento
  enumera además qué ficheros del sistema son scaffolds `.gitkeep` escribibles y cuáles no.
- **Adaptación en Ego:** fundamento para la política de persistencia de Ego (`CORE-07`), el sistema
  de namespaces en `ego.namespaces.json` (`system/*` vs `users/*` vs `projects/*`) y la exportación
  de proyectos (`REC-01`, `REC-03`).
- **Relación con Backlog Ego:** `CORE-07` (Fase 01), `REC-01`, `REC-03` (Fase 10).
  **Compuerta:** `CARP-01`.

#### A.2 Resolución del raíz de datos y ruta canónica de escritura ##

- **Qué hace:** define una precedencia de resolución (`DATA_CONTRACT.md:188-202`): variables de
  entorno (`CAREER_OPS_ROOT` o `CAREER_OPS_DATA_DIR`) → fichero marcador `.career-ops-data` →
  raíz del repositorio. La lectura del tracker resuelve dos rutas; la escritura va **siempre** a
  la ubicación canónica, de modo que lectura y escritura no divergen nunca.
- **Adaptación en Ego:** equivalente al modelo de `workspacePath` de las herramientas nativas
  (`packages/tools/src/native/index.ts:26-27`, `apps/desktop/src/main.ts:2148`).
- **Relación con Backlog Ego:** `ACT-04` (Fase 02). **Compuerta:** `CARP-01`.

### Bloque B: Concurrencia y Exclusión Mutua en Disco ##

*Ubicación en fuente:* `repos-referencia/career-ops/pipeline-lock.mjs:1-702` y
`repos-referencia/career-ops/tracker-utils.mjs`

#### B.1 Lock de directorio con sello de propietario y guardia de recuperación ##

- **Qué hace:** el lock **es un directorio** (`<path>.lock`) creado con `mkdirSync`, que es atómico
  en POSIX y en Windows (`pipeline-lock.mjs:494`). El poseedor graba `owner.json` con `pid`, `token`
  UUID y `started_at` (`pipeline-lock.mjs:607`). La recuperación de locks caducados se serializa
  detrás de un **segundo directorio guardián** (`<path>.lock.recover`, `pipeline-lock.mjs:502-528`)
  porque, sin él, el propio reciclado sería una carrera TOCTOU. La caducidad se juzga primero por
  **liveness del PID** (`process.kill(pid, 0)`, `pipeline-lock.mjs:182-190`) y sólo después por edad
  del directorio, con un suelo de gracia (`OWNERLESS_GRACE_MS`, `pipeline-lock.mjs:56-59`).
- **Veredicto tri-estado:** la recuperación no devuelve un booleano sino tres veredictos
  (`pipeline-lock.mjs:218-242`): `stale` (se puede borrar), `vanished` (no había nada: **no**
  autoriza a borrar) y `live` (esperar). Borrar sobre `vanished` destruía un lock vivo recién
  creado; el propio código documenta la medición que motivó el cambio.
- **Espera:** backoff con **jitter** (0.5× a 1.5× `retryMs`, `pipeline-lock.mjs:320-324`) y regla de
  progreso: el timeout por tenedor sólo expira si el lock **no ha cambiado de manos** desde la
  última observación (`pipeline-lock.mjs:335-347`). La identidad del directorio se re-verifica
  (`sameLockDirectory`, `pipeline-lock.mjs:126-129`) antes y después de cada borrado, y el `token`
  se relee al final para confirmar que nadie lo reemplazó (`pipeline-lock.mjs:653-657`).
- **Adaptación en Ego:** implementado en `packages/tools/src/native/fs/FileLockManager.ts` y
  consumido por `packages/tools/src/native/fs/NativeFsTool.ts:147`.
- **Relación con Backlog Ego:** `ACT-04` (Fase 02), `REC-01` (Fase 10). **Compuerta:** `CARP-02`.

#### B.2 Transacción de fichero con lock y fallo de liberación reportado ##

- **Qué hace:** el lock se expone como una transacción con `read()`, `replace()` y `close()`; el
  `close()` **no traga** el fallo de limpieza del lock, lo reporta como advertencia
  (`tracker-utils.mjs`, bloque `acquireTrackerLock`).
- **Adaptación en Ego:** equivalente funcional de `FileLockManager.withLock` (liberación en
  `finally` garantizado) en `packages/tools/src/native/fs/FileLockManager.ts:28-41`.
- **Relación con Backlog Ego:** `ACT-04` (Fase 02). **Compuerta:** `CARP-02`.

### Bloque C: Escritura Atómica con Reintento de Contención ##

*Ubicación en fuente:* `repos-referencia/career-ops/tracker-utils.mjs:698-800`

#### C.1 Temporal en el mismo directorio, rename con backoff y `mode` explícito ##

- **Qué hace:** la escritura atómica usa un temporal **en el mismo directorio** (para que el rename
  final sea atómico) con nombre único (`.<basename>.<pid>.<ts>.<uuid>.tmp`); si la escritura o el
  rename fallan, el temporal se borra antes de relanzar el error original
  (`tracker-utils.mjs:776-800`). El `rename` se reintenta ante `EPERM` / `EACCES` / `EBUSY` con
  una escala fija `[1, 2, 5, 10, 25, 50, 100] ms` (`tracker-utils.mjs:698`, `709`, `745-754`),
  porque en Windows un antivirus o el indexador del sistema pueden tener el destino abierto durante
  milisegundos. El `mode` del fichero original se replica sobre el temporal **antes** del rename,
  para que el destino nunca sea observable con permisos más abiertos que los que tenía.
- **Adaptación en Ego:** el patrón tmp + rename ya está en
  `packages/tools/src/native/fs/NativeFsTool.ts:164-184`, `packages/recovery/src/fsAsync.ts:51` y
  `packages/recovery/src/CrashRecoveryEngine.ts:48`; **falta** el reintento de contención.
- **Relación con Backlog Ego:** `REC-01` (Fase 10). **Compuerta:** `CARP-05`.

### Bloque D: Validadores de Cobertura Fail-Closed con Roster Derivado ##

*Ubicación en fuente:* `repos-referencia/career-ops/validate-system-paths-coverage.mjs` y
`repos-referencia/career-ops/validate-untrusted-content-coverage.mjs`

#### D.1 Cobertura de la división system/user del actualizador ##

- **Qué hace:** comprueba que **todo** fichero versionado por git esté cubierto por `SYSTEM_PATHS`
  (capa sistema), `USER_PATHS` (capa usuario) o una exclusión explícita; cualquier fichero
  "huérfano" no lo despliega `update-system.mjs apply` y se perdería en la siguiente actualización
  (`validate-system-paths-coverage.mjs:113-123`, `239-255`). El validador distingue **cuatro**
  políticas de cobertura: `SYSTEM_PATHS`, `USER_PATHS`, exclusiones exactas y exclusiones por
  prefijo de árbol (`validate-system-paths-coverage.mjs:57-123`).
- **Adaptación en Ego:** equivalente conceptual del gate `scripts/audit-extraction-gates.mjs`, que
  deriva el prefijo y el conjunto de IDs de las fichas en lugar de mantener una lista a mano.
- **Relación con Backlog Ego:** `REC-01` (Fase 10). **Compuerta:** `CARP-06`.

#### D.2 Roster derivado por detección de primitivas, con suelo y exclusiones razonadas ##

- **Qué hace:** el conjunto de ficheros que deben llevar la directiva *"Untrusted External Content"*
  **se deriva** de un detector de primitivas de fetch (`FETCH_PRIMITIVES`,
  `validate-untrusted-content-coverage.mjs:49`), de modo que un modo ingestor **nuevo falla en
  cerrado** sin que nadie edite una lista (`deriveIngestingModes`,
  `validate-untrusted-content-coverage.mjs:117-132`). El derive se combina con un **suelo** declarado
  (`ALWAYS_REQUIRED`, `validate-untrusted-content-coverage.mjs:69-77`), con exclusiones que **deben
  llevar su razón escrita** (`validate-untrusted-content-coverage.mjs:57-60`) y con la regla de no
  gobernar la capa de usuario (`isUserLayerPath`, `validate-untrusted-content-coverage.mjs:105-107`).
- **Adaptación en Ego:** misma forma en `scripts/audit-extraction-gates.mjs` (deriva prefijo, IDs y
  recuentos desde las fichas) y en `scripts/check-docs-lint.mjs` (gate de regresión con línea base).
- **Relación con Backlog Ego:** `REC-01` (Fase 10). **Compuerta:** `CARP-06`.

#### D.3 Un chequeo que no puede mirar debe fallar, no pasar ##

- **Qué hace:** si la inspección no devuelve nada, el validador **falla** en lugar de pasar
  (`validate-system-paths-coverage.mjs:217-237`): un `git ls-files` vacío significa que la corrida
  no pudo inspeccionar nada, y reportar éxito convertiría el guard en un no-op. El fichero documenta
  cinco incidentes medidos de ese mismo tipo de fallo.
- **Adaptación en Ego:** aplica a `scripts/audit-extraction-gates.mjs`: si el catálogo de fichas
  desapareciera, el gate debe fallar, no reportar cero tareas.
- **Relación con Backlog Ego:** `REC-01` (Fase 10). **Compuerta:** `CARP-06`.

#### D.4 Módulo importable sin efectos secundarios ##

- **Qué hace:** `isMainModule(import.meta.url)` (`lib/is-main-module.mjs:66-95`) permite que un
  fichero sea a la vez **CLI** y **biblioteca**: la cola de CLI sólo se ejecuta cuando el módulo es
  el entrypoint, de modo que importar sus funciones puras para testearlas no dispara `process.exit()`.
- **Adaptación en Ego:** equivalente a los `index.ts` de paquete con re-export, que exponen la API
  sin ejecutar lógica de arranque.
- **Relación con Backlog Ego:** `ACT-04` (Fase 02). **Compuerta:** `CARP-06`.

### Bloque E: Procedencia No Decadente para Claims Derivados ##

*Ubicación en fuente:* `repos-referencia/career-ops/story-provenance-check.mjs:42-121` y
`repos-referencia/career-ops/AGENTS.md` (sección *Source-of-Truth Boundary*)

#### E.1 Un claim derivado sin marcador es `derived-unverified`, no un hecho ##

- **Qué hace:** el repositorio distingue tres estados de procedencia para un dato: `user-authored`
  (fuente primaria, confianza plena), `derived-unverified` (aparece sólo en un fichero derivado, sin
  trazabilidad a una fuente primaria) y `user-cannot-confirm` (el usuario ha declarado que no sabe
  confirmarlo). **La ausencia de marcador equivale a `derived-unverified`**: el valor por defecto es
  el seguro (`story-provenance-check.mjs:72-88`). El estado `user-cannot-confirm` es **durable** y
  nunca decae a "verificado" por re-citación ni por un re-escaneo posterior
  (`story-provenance-check.mjs:42-43`, `468-471`, `113-116`).
- **Por qué importa:** el fichero documenta el mecanismo de contaminación que evita: una cifra
  inventada una vez en un documento derivado queda absorbida como hecho y citada como verdad por
  documentos posteriores, derivando en cada reuso sin nada que la devuelva a su fuente primaria.
- **Adaptación en Ego:** equivalente al campo `confidence` del schema de conocimiento
  (`packages/knowledge/src/schemas/knowledge.ts:46`) y al ciclo de vida de hechos
  (`packages/knowledge/src/FactLifecycle.ts`), pero **sin** un estado de procedencia no decadente
  por hecho.
- **Relación con Backlog Ego:** `KB-07` (Fase 06). **Compuerta:** `CARP-07`.

### Bloque F: Reserva Atómica de Slots con Rollback ##

*Ubicación en fuente:* `repos-referencia/career-ops/reserve-report-num.mjs:4-16`, `149-252`

#### F.1 Reclamo individual con `O_CREAT|O_EXCL` y liberación de slots en colisión ##

- **Qué hace:** el asignador de números de informe reclama cada slot con `O_CREAT|O_EXCL`, que es
  atómico entre procesos (`reserve-report-num.mjs:4-9`, `149`). Si la rafaga choca, los slots ya
  reclamados **se liberan** y la reserva se reintenta más allá del hueco, dejando huecos
  permanentes pero inofensivos en lugar de duplicados (`reserve-report-num.mjs:229-252`). La
  liberación exige un **token de propiedad** (`reserve-report-num.mjs:260-270`).
- **Adaptación en Ego:** no aplica — Ego no tiene un asignador numérico secuencial (ver §5 `CARP-08`).
- **Relación con Backlog Ego:** — **Compuerta:** `CARP-08`.

---

## 3. Matriz de Extracción vs Descarte ##

| Componente / Feature de Career-Ops | Archivo Fuente | Acción | Justificación Técnica |
|---|---|:---:|---|
| **Contrato de datos Usuario vs Sistema (`DATA_CONTRACT.md`)** | `DATA_CONTRACT.md:1-202` | 📥 **Extraer & Adaptar** | Regla de gobernanza indispensable para garantizar la soberanía de los datos del usuario en Ego. |
| **Lock de directorio con sello de propietario y veredicto tri-estado** | `pipeline-lock.mjs:126-242`, `494-702` | 📥 **Extraer & Adaptar** | Previene condiciones de carrera y corrupción de archivos en escrituras concurrentes de Sub-Egos. |
| **Escritura atómica con reintento de contención de `rename`** | `tracker-utils.mjs:698-800` | 📥 **Extraer & Adaptar** | Cierra la ventana de pérdida de escritura en Windows por lectores transitorios (antivirus, indexador). |
| **Validador de cobertura fail-closed con roster derivado** | `validate-system-paths-coverage.mjs`, `validate-untrusted-content-coverage.mjs` | 📥 **Extraer & Adaptar** | Un consumidor nuevo falla en cerrado sin editar ninguna lista; un chequeo que no puede mirar falla en vez de pasar. |
| **Marcador de procedencia no decadente** | `story-provenance-check.mjs:42-121` | 📥 **Extraer & Adaptar** | Un hecho derivado sin procedencia verificable no puede degradarse a "verificado" por re-citación. |
| **Reserva atómica de rangos numéricos** | `reserve-report-num.mjs:149-252` | 🚫 **Descartada (con justificación)** | Ego no tiene asignador secuencial; el patrón no tiene consumidor (§5 `CARP-08`). |
| **Scrapers de portales de empleo (ATS Dayforce, Interamt, etc.)** | `scan-ats-full.mjs`, `scan-dayforce.mjs` | 🚫 **Descartada (con justificación)** | Dominio ajeno (Guardrail §4 de `AGENTS.md`). No pertenece al alcance de Ego SOC. |
| **Cálculo de brechas salariales y trackers de empleo** | `salary-gap.mjs`, `tracker.mjs` | 🚫 **Descartada (con justificación)** | Dominio ajeno. Ego es un sistema operativo cognitivo, no una plataforma de reclutamiento. |
| **Verificación de estructuras de CVs** | `verify-cv-structure.mjs`, `verify-cv-facts.mjs` | 🚫 **Descartada (con justificación)** | Dominio ajeno y lógica de negocio específica innecesaria. |

---

## 4. Impacto en el Backlog de Ego y Trazabilidad ##

| ID Compuerta | Archivo / Función Career-Ops | Tarea Canónica Ego | Estado en Backlog Review |
|:---:|---|:---:|:---:|
| `CARP-01` | `DATA_CONTRACT.md:5-64` y `:182-186` (User vs System Contract) | `CORE-07` (Fase 01), `REC-01` (Fase 10) | [`docs/review/backlog-career-ops.md`](../review/backlog-career-ops.md) |
| `CARP-02` | `pipeline-lock.mjs:126-242`, `494-702` (Lock atómico de directorio) | `ACT-04` (Fase 02), `REC-01` (Fase 10) | [`docs/review/backlog-career-ops.md`](../review/backlog-career-ops.md) |
| `CARP-03` | `validate-system-paths-coverage.mjs:113-255` (Cobertura system/user) | `ACT-04` (Fase 02), `SEC-01`, `SEC-05` (Fase 11) | [`docs/review/backlog-career-ops.md`](../review/backlog-career-ops.md) |
| `CARP-04` | `validate-untrusted-content-coverage.mjs:49-132` (Cobertura de directiva) | `ACT-06` (Fase 02), `KB-07` (Fase 06), `SEC-04` (Fase 11) | [`docs/review/backlog-career-ops.md`](../review/backlog-career-ops.md) |
| `CARP-05` | `tracker-utils.mjs:698-800` (Escritura atómica con reintento) | `REC-01` (Fase 10) | [`docs/review/backlog-career-ops.md`](../review/backlog-career-ops.md) |
| `CARP-06` | `validate-*-coverage.mjs` + `lib/is-main-module.mjs:66-95` (Fail-closed) | `REC-01` (Fase 10), `ACT-04` (Fase 02) | [`docs/review/backlog-career-ops.md`](../review/backlog-career-ops.md) |
| `CARP-07` | `story-provenance-check.mjs:42-121` (Procedencia no decadente) | `KB-07` (Fase 06) | [`docs/review/backlog-career-ops.md`](../review/backlog-career-ops.md) |
| `CARP-08` | `reserve-report-num.mjs:149-252` (Reserva atómica de slots) | — | [`docs/review/backlog-career-ops.md`](../review/backlog-career-ops.md) |

---

## 5. Estado real verificado (2026-10-20) — Ola 2 de remediación (A5) ##

> Fuente canónica del estado por tarea: [`docs/review/backlog-career-ops.md`](../review/backlog-career-ops.md).
> Criterio de cierre: fichero adaptado **y** caller en producción (grep sobre `packages/` +
> `apps/desktop/`, excluyendo `test/`, `dist/` y `node_modules/`).

| ID | Patrón | Estado | Evidencia / Fundamento |
|---|---|:---:|---|
| `CARP-01` | `DATA_CONTRACT` (User vs System) | 🚫 **Descartada (con justificación)** | `packages/memory/DataContract.ts` sin caller: 0 consumidores fuera del propio fichero y su re-export en `packages/memory/index.ts:10`. La frontera ya la implementan `packages/memory/SensitiveNamespaces.ts` + `QuarantineAwareReads.ts` + `packages/knowledge/src/QuarantineManager.ts` (Ola 1, A2). Cablearlo sería una **tercera** política de gobernanza de datos. |
| `CARP-02` | Lock atómico de directorio | ✅ **Completada** | `packages/tools/src/native/fs/FileLockManager.ts` → `NativeFsTool.ts:147` → `packages/tools/src/native/index.ts:27` → `apps/desktop/src/main.ts:2148` (`registerNativeTools`). |
| `CARP-03` | Whitelist / cobertura de rutas | ✅ **Completada** | `packages/tools/src/native/fs/PathValidator.ts` → `NativeFsTool.ts:58`, `NativeGitTool.ts:43`, `NativeTerminalTool.ts:78`, `NativeFsSearchTools.ts:103` + `apps/desktop/src/main/ipc/register-ipc.ts:19` y `:1930`. |
| `CARP-04` | Cuarentena de contenido no confiable | 🚫 **Descartada (con justificación)** | `packages/memory/UntrustedContentSanitizer.ts` sin caller: 0 consumidores fuera del fichero y su re-export en `packages/memory/index.ts:11` (la única mención externa es un comentario en `packages/models/src/types.ts:77`). La ruta canónica es `packages/knowledge/src/QuarantineManager.ts` (`apps/desktop/src/main.ts:35`, `:2233`). |
| `CARP-05` | Escritura atómica con reintento de `rename` | 🆕 **Pendiente** | El tmp + rename ya existe (`packages/tools/src/native/fs/NativeFsTool.ts:164-184`, `packages/recovery/src/fsAsync.ts:51`) pero **sin** reintento ante `EPERM`/`EACCES`/`EBUSY`. Cableado exacto y responsable en el backlog. |
| `CARP-06` | Validadores fail-closed con roster derivado | 🆕 **Pendiente** | `scripts/audit-extraction-gates.mjs` ya deriva prefijo e IDs, pero **no** falla cuando el catálogo de fichas está vacío. Cableado exacto y responsable en el backlog. |
| `CARP-07` | Procedencia no decadente por hecho | ⏳ **Futura (Fase 06)** | `@ego/knowledge` sólo expone `confidence` escalar (`packages/knowledge/src/schemas/knowledge.ts:46`); no hay estado de procedencia por hecho. |
| `CARP-08` | Reserva atómica de slots numéricos | 🚫 **Descartada (con justificación)** | Ego no tiene asignador secuencial: todos los identificadores se generan con `randomUUID()` (p. ej. `packages/events/src/EventBus.ts:141`). La carrera `max+1` que el patrón resuelve no existe en Ego; introducirlo añadiría un punto de coordinación sin consumidor. |

**Recuento:** 2 `✅ Completada` · 3 `🚫 Descartada` · 2 `🆕 Pendiente` · 1 `⏳ Futura` — **8 tareas**.

---

## 6. Guardrail de dominio — re-verificación (2026-10-20) ##

Barrido sobre `packages/` y `apps/desktop/` (606 ficheros de código; excluye `test/`, `dist/`,
`node_modules/`) de los vectores de dominio de `career-ops` (`dayforce`, `interamt`, `scan-ats`,
`vacancy`, `job-application`, `resume-parser`, `linkedin`, `glassdoor`, `greenhouse`, `ashby`,
`workday`, `icims`, `ats-payload`, `salary`, `cv-template`, `cover-letter`, `career-ops`) y de
`khoj` (`twilio`, `online_search`, `sentence-transformers`, `gte-small`, `smtplib`, `stripe`,
`smtp`, `khoj`).

**Resultado: 0 coincidencias de dominio.** Los únicos hits son de tres clases, ninguna contaminante:

1. **Comentarios de atribución** — `packages/memory/DataContract.ts:49`,
   `packages/memory/UntrustedContentSanitizer.ts:129`, `packages/tools/src/native/fs/FileLockManager.ts:13`
   y las referencias `KHOJ-01..05` en `packages/knowledge/src/`.
2. **el sidecar propio de Ego** `packages/knowledge/src/ingest/PythonSidecarBridge.ts` →
   `scripts/ingest/bulk_import.py` (código de Ego, no de `khoj`).
3. **falsos positivos léxicos** — `packages/memory/SensitiveNamespaces.ts:78` usa `"salary"` como
   **token de namespace sensible** (heurística genérica de PII), y `packages/avatar/**` usa `"stripe"`
   como *marking* de avatar (`packages/avatar/src/core/genome.js:12`). Ninguno es dominio de empleo.

**Contaminación de dominio: LIMPIO.** Lo que este repositorio aporta a Ego es exclusivamente de
ingeniería de sistemas (contrato de propiedad de datos, exclusión mutua en disco, escritura
atómica, validadores fail-closed, procedencia). Ninguna entidad, schema ni dependencia del dominio
de empleo/ATS ha sido importada.

---

## 7. Correcciones registradas en la revisión del 2026-10-20 ##

La ficha anterior (Ola 1, 2026-10-19) contenía tres afirmaciones **falsas** y dos referencias
de cableado **caducas**. Todas quedan corregidas arriba; se listan para trazabilidad.

| # | Afirmación anterior | Realidad verificada en el clon |
|---|---|---|
| F1 | `pipeline-lock.mjs` usa "apertura exclusiva (`fs.open` con flag `wx`)" | El lock de la fuente es un **directorio** creado con `mkdirSync` (`pipeline-lock.mjs:494`) con sello `owner.json`, guardia de recuperación, veredicto tri-estado y jitter. El flag `wx` es de la **adaptación de Ego** (`packages/tools/src/native/fs/FileLockManager.ts:66`), no del original. |
| F2 | `validate-system-paths-coverage.mjs` valida "que todas las operaciones estén confinadas a rutas permitidas… bloqueando escapes hacia `C:\Windows`, `/etc`, claves SSH" | Es un **validador de cobertura de la división system/user del actualizador**: cada fichero versionado debe estar en `SYSTEM_PATHS`, `USER_PATHS` o una exclusión (`validate-system-paths-coverage.mjs:113-255`). No contiene ninguna whitelist de rutas del sistema operativo ni referencias a `C:\Windows`, `/etc` o SSH. |
| F3 | `validate-untrusted-content-coverage.mjs` "aísla payloads en un directorio de cuarentena con permisos restrictivos" | Es un **validador estructural de cobertura de la directiva** *"Untrusted External Content"*: deriva el roster de ficheros ingestores desde un detector de primitivas (`validate-untrusted-content-coverage.mjs:49`, `117-132`). No mueve ficheros ni crea directorios de cuarentena. |
| F4 | `CARP-02` cableada en `apps/desktop/src/main.ts:3086` | La llamada real es `apps/desktop/src/main.ts:2148` (`registerNativeTools(toolRegistry, { workspacePath… })`). |
| F5 | `CARP-03` cableada en `apps/desktop/src/main.ts:22` | `main.ts` **no** importa `PathValidator` (sólo lo menciona en un comentario, `main.ts:1124`). El cableado real es `apps/desktop/src/main/ipc/register-ipc.ts:19` (import) y `:1930` (uso). |

> **Nota de dominio:** las tres afirmaciones falsas (F1–F3) no introducían contaminación de
> dominio — describían mal un patrón de ingeniería, no importaban entidad de negocio. El barrido
> de §6 se mantiene **LIMPIO**.
