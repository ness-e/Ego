# Plan de Ejecución: Fundación Multi-Sub-Ego (SUB-02, SUB-03, SUB-04)

> **Inicio:** 2026-10-09  
> **Estado:** ⏳ EN PROGRESO  
> **Fuente:** `docs/roadmap/Backlog.md`  
> **Autonomous:** false  

## Resumen

| Resultado | Count |
|-----------|-------|
| ✅ DO | 3 |
| 🟡 DEFER | 0 |
| ❌ SKIP | 0 |
| 🔴 BLOQUEADO | 0 |

Status: ⬆️ uphill = 2 (interfaz conversacional desacoplada de UI y política TTL de descarga de runtime) · ⬇️ downhill = 18 (steps atómicos de implementación y pruebas unitarias).

---

## Tasks

### Task 1: SUB-02 — Fábrica Inteligente de Sub-Egos (3 modalidades)

- **Appetite:** max 2d (Shape Up limit — no extender más allá de las 3 modalidades estipuladas)
- **Esfuerzo:** 🟡 2d
- **Prioridad:** 🔴 P0
- **Archivos clave:** `packages/subegos/src/SubEgoFactory.ts`, `packages/subegos/src/templates/`, `packages/subegos/test/SubEgoFactory.test.ts`
- **Verificación real:** ✅ CÓDIGO-REAL — `SubEgoManifest.ts` y esquemas Zod existen en `@ego/subegos`. Gap confirmado: no existe la clase ni los métodos de fábrica para creación conversacional, plantillas de dominio (`HERM-12`) ni parsing JSON/YAML. Callers futuros: Desktop UI (`SubEgosView.tsx`), Cognitive Runtime y CLI.
- **Gate Justificación:** Requisito nuclear de la Fase 03 para aprovisionar especialistas sin requerir redacción manual de JSON en crudo. Tarea atómica y bien delimitada.
- **Gate Result:** ✅ DO
- **Contrato:** `pnpm --filter @ego/subegos test` (suite `SubEgoFactory.test.ts` con cobertura de las 3 modalidades: conversacional, plantillas y parsing declarativo).
- **Task file:** `docs/agent-ops/tasks/SUB-02.md`
- **Estado:** ✅ COMPLETED
- **Branch:** master
- **Commit:** —

  **Checklist Shape Up:**
  1. *¿Es el problema correcto?* Sí; Ego requiere que los usuarios creen Sub-Egos mediante diálogo natural, presets probados o YAML/JSON avanzado.
  2. *¿Es correcto el appetite/scope?* Sí; 2 días es adecuado para la fábrica modular sin depender de la UI de React.
  3. *¿Es AHORA?* Sí; bloquea la instanciación de Sub-Egos de dominio y la integración con el chat.

  **Cynefin:** 🟨 Complicado — Requiere estructurar la lógica de preguntas y refinamiento conversacional sin acoplarse indebidamente a Electron ni React.
  
  **Top 3 Riesgos:**
  1. *Riesgo 1 (Probabilidad):* Acoplamiento indebido de la fábrica conversacional a componentes de React en lugar de un motor agnóstico de turnos.
  2. *Riesgo 2 (Impacto):* Generación de manifiestos con permisos excesivos en plantillas por defecto.
  3. *Riesgo 3 (Contrato):* Fallos en la serialización/deserialización de esquemas complejos de presupuesto o alma en YAML/JSON.

  **Pre-mortem:**
  - *Fallo probable 1:* La modalidad conversacional intenta implementar una máquina de chat completa en lugar de una interfaz de sesión de refinamiento funcional por turnos.
  - *Fallo probable 2:* Las plantillas de dominio quedan desactualizadas respecto al esquema estricto de `SubEgoManifestSchema` provocando fallos de Zod al instanciar.
  - *Fallo probable 3:* Soporte incompleto de YAML que fuerce dependencias pesadas en el bundle de producción.

  **Stop conditions / Circuit breaker:**
  - *Appetite excedido:* Si tras 2 días la modalidad conversacional no está cerrada, aislar plantillas y JSON/YAML y diferir el asistente a `SUB-02b`.
  - *Rabbit hole:* Si la integración de un parser YAML introduce conflictos de tipos o librerías incompatibles con Node 22, limitar a JSON estricto en la primera iteración.
  - *Premisa invalidada:* Si `SubEgoManifestSchema` sufre mutaciones de esquema incompatibles.

  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta (mitigación) | Trigger / Due |
  |---|---|---|---|
  | 🟡×🔴 | Acoplamiento de la fábrica conversacional a React | Diseñar `ConversationalSubEgoBuilder` como FSM pura agnóstica de I/O | Al iniciar diseño de la interfaz |
  | 🟡×🟠 | Permisos o namespaces laxos en plantillas | Definir plantillas con principio de mínimo privilegio (`quarantine/pending`, `kb/docs`) | Revisión de plantillas |
  | 🟢×🟡 | Dependencia pesada de parsing YAML | Usar `yaml` estándar liviano o soporte nativo JSON/YAML con validación Zod | Configuración de dependencias |

  **Uphill / Downhill:**
  - ⬆️ Uphill: 1 (definición del protocolo conversacional por turnos).
  - ⬇️ Downhill: 5 steps (plantillas de dominio, validador de importación, FSM conversacional, tests unitarios, exportación en index).

  **DoD Task Level:**
  - [ ] `SubEgoFactory` implementa las 3 modalidades con tipos estrictos.
  - [ ] Al menos 5 plantillas canónicas de dominio implementadas (`researcher`, `code_reviewer`, `copywriter`, `analyst`, `planner`).
  - [ ] Suite de Vitest `SubEgoFactory.test.ts` en exit code 0.
  - [ ] Monorepo compila y pasa typecheck (`pnpm typecheck`, `pnpm build`).

  **Iteraciones:**
  | # | Acción | Resultado | Herramienta |
  |---|--------|-----------|-------------|
  | — | — | — | — |

  **Notas:** Integración con la compuerta `HERM-12` para comandos rápidos de invocación de plantillas.

---

### Task 2: SUB-03 — Sub-Ego Runtime y ciclo de vida (Lazy Activation)

- **Appetite:** max 2d (Shape Up limit)
- **Esfuerzo:** 🟡 2d
- **Prioridad:** 🔴 P0
- **Archivos clave:** `packages/subegos/src/SubEgoRuntime.ts`, `packages/subegos/test/SubEgoRuntime.test.ts`
- **Verificación real:** ✅ CÓDIGO-REAL — `ToolExecutionLoop` existe en `packages/runtime` pero no posee gestión de ciclo de vida ni aislamiento por especialista. Gap confirmado: los Sub-Egos carecen de un runtime que los active bajo demanda y los descargue tras inactividad.
- **Gate Justificación:** Principio Innegociable §4 y §10: los Sub-Egos no deben retenerse en RAM indefinidamente; deben operar bajo demanda con lazy activation y gestión de estado estricta.
- **Gate Result:** ✅ DO
- **Contrato:** `pnpm --filter @ego/subegos test` (suite `SubEgoRuntime.test.ts` probando ciclo de vida, activación perezosa, inyección de herramientas y descarga por TTL).
- **Task file:** `docs/agent-ops/tasks/SUB-03.md`
- **Estado:** ✅ COMPLETED
- **Branch:** master
- **Commit:** —

  **Checklist Shape Up:**
  1. *¿Es el problema correcto?* Sí; previene fugas de memoria y sobrecarga en Electron cuando coexisten múltiples especialistas.
  2. *¿Es correcto el appetite/scope?* Sí; 2 días permiten una FSM sólida con temporizador de idle.
  3. *¿Es AHORA?* Sí; es el prerrequisito para la delegación multi-Sub-Ego (`SUB-06`) y el Activity Widget.

  **Cynefin:** 🟨 Complicado — Máquina de estados concurrentes y gestión de timers en Node.js sin race conditions ni timers huérfanos.

  **Top 3 Riesgos:**
  1. *Riesgo 1 (Impacto):* Timers de TTL huérfanos que impidan que el proceso Node/Electron finalice limpiamente en tests o shutdown.
  2. *Riesgo 2 (Probabilidad):* Race condition al descargar un Sub-Ego mientras se le asigna un nuevo turno de ejecución.
  3. *Riesgo 3 (Contrato):* Pérdida de estado efímero del scratchpad durante la transición a `suspended`.

  **Pre-mortem:**
  - *Fallo probable 1:* La activación perezosa bloquea el event loop durante la instanciación de herramientas complejas.
  - *Fallo probable 2:* `unref()` no configurado en los temporizadores de inactividad provocando bloqueos de salida en Vitest.
  - *Fallo probable 3:* El runtime asume acceso directo a VantaDB en lugar de pasar por `EgoMemoryAdapter`.

  **Stop conditions / Circuit breaker:**
  - *Appetite excedido:* Si la integración con `ToolExecutionLoop` se vuelve laberíntica en más de 2 días, desacoplar el runtime en un gestor de instancias puro y testearlo como unidad aislada.
  - *Rabbit hole:* Si surgen race conditions en cancelaciones asíncronas, introducir una cola serializada de peticiones por Sub-Ego.

  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta (mitigación) | Trigger / Due |
  |---|---|---|---|
  | 🟡×🔴 | Bloqueo de proceso por timers activos | Usar `.unref()` en todos los `setTimeout` de TTL de inactividad | Implementación del timer de descarga |
  | 🟡×🟠 | Invocación concurrente en transición `unloading` | Encolar peticiones y revertir transición a `active` inmediatamente | Tests de concurrencia |
  | 🟢×🟡 | Consumo elevado de RAM por instancias inactivas | Configurar TTL conservador por defecto (ej. 60.000 ms) | Configuración de runtime |

  **Uphill / Downhill:**
  - ⬆️ Uphill: 1 (política de expiración y concurrencia durante transición de descarga).
  - ⬇️ Downhill: 6 steps (definición de estados FSM, gestión de pool de instancias, timer de descarga con `.unref()`, integración con contexto de ejecución, pruebas unitarias y exportación).

  **DoD Task Level:**
  - [ ] `SubEgoRuntime` gestiona estados `unloaded`, `idle`, `active`, `suspended`.
  - [ ] Lazy activation comprobada: una instancia no existe en RAM hasta su primer turno.
  - [ ] Política de TTL descarga automáticamente instancias ociosas.
  - [ ] Pruebas unitarias de concurrencia y timers pasan al 100%.

  **Iteraciones:**
  | # | Acción | Resultado | Herramienta |
  |---|--------|-----------|-------------|
  | — | — | — | — |

  **Notas:** Prepara el terreno para el bus de orquestación inter-agente (`SUB-06`).

---

### Task 3: SUB-04 — Aislamiento de estado privado `egos/<id>/*` en VantaDB

- **Appetite:** max 1.5d (Shape Up limit)
- **Esfuerzo:** 🟡 1.5d
- **Prioridad:** 🔴 P0
- **Archivos clave:** `packages/memory/EgoMemoryAdapter.ts`, `packages/subegos/src/SubEgoMemoryIsolation.ts`, `packages/subegos/test/SubEgoMemoryIsolation.test.ts`
- **Verificación real:** ✅ CÓDIGO-REAL — `EgoMemoryAdapter.ts` existe y manipula namespaces, pero no aplica control perimetral estricto de emisor (`callerId`) sobre el prefijo `egos/<id>/*`. `validateNamespaceAccess` existe en `SubEgoManifest.ts` pero no está conectado a las llamadas de memoria. Gap confirmado: Sub-Egos podrían acceder a namespaces privados de otros especialistas sin validación.
- **Gate Justificación:** Principio Innegociable §1 y §6: Soberanía y seguridad de datos. El estado privado de un Sub-Ego debe estar estrictamente confinado y solo ser accesible por él mismo o por el núcleo (`ego.nucleus`).
- **Gate Result:** ✅ DO
- **Contrato:** `pnpm --filter @ego/subegos test` y `pnpm --filter @ego/memory test` (verificación de rechazo inmediato de operaciones no autorizadas entre especialistas y paso exitoso de operaciones legítimas).
- **Task file:** `docs/agent-ops/tasks/SUB-04.md`
- **Estado:** ✅ COMPLETED
- **Branch:** master
- **Commit:** —

  **Checklist Shape Up:**
  1. *¿Es el problema correcto?* Sí; protege contra la polución y fuga de datos entre agentes especializados.
  2. *¿Es correcto el appetite/scope?* Sí; 1.5 días es suficiente para implementar el guard de memoria y adaptadores perimetrales.
  3. *¿Es AHORA?* Sí; debe estar activo antes de permitir que múltiples Sub-Egos persistan memorias concurrentemente.

  **Cynefin:** 🟨 Complicado — Reglas de autorización en memoria y compatibilidad con operaciones multi-clave.

  **Top 3 Riesgos:**
  1. *Riesgo 1 (Impacto):* Bloqueo accidental de lecturas legítimas del orquestador central (`ego.nucleus`) a estados de Sub-Egos.
  2. *Riesgo 2 (Probabilidad):* Bypasses en operaciones masivas `putMulti` si no se valida cada elemento del lote.
  3. *Riesgo 3 (Contrato):* Degradación de rendimiento en hot path de memoria por validaciones redundantes de regex.

  **Pre-mortem:**
  - *Fallo probable 1:* `putMulti` valida únicamente el primer registro del lote, permitiendo inyecciones en namespaces ajenos en los siguientes registros.
  - *Fallo probable 2:* Las consultas de búsqueda vectorial / híbrida no filtran por el namespace autorizado del caller devolviendo hechos de otros Sub-Egos.
  - *Fallo probable 3:* Excepciones de denegación no capturadas causan caídas inesperadas en lugar de flujos de error estructurados.

  **Stop conditions / Circuit breaker:**
  - *Appetite excedido:* Si la modificación directa de `EgoMemoryAdapter` causa regresiones en los tests existentes de `memory.test.ts`, implementar un wrapper decorador `SubEgoMemoryGuard` en `@ego/subegos` que envuelva el adapter sin mutar la clase base.
  - *Rabbit hole:* Si surgen conflictos con el motor nativo napi-rs, validar en la capa TypeScript antes de llamar a `NativeVantaDB`.

  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta (mitigación) | Trigger / Due |
  |---|---|---|---|
  | 🟡×🔴 | Validación incompleta en operaciones por lote | Iterar y validar cada item de `putMulti` antes de cualquier escritura atómica | Implementación del guard |
  | 🟡×🟠 | Bloqueo al núcleo de Ego (`ego.nucleus`) | Permitir bypass explícito y verificado solo para la identidad `"ego.nucleus"` | Especificación de reglas |
  | 🟢×🟡 | Sobrecarga de rendimiento en chequeo de namespaces | Reutilizar la función compilada `validateNamespaceAccess` | Benchmark de memoria |

  **Uphill / Downhill:**
  - ⬆️ Uphill: 0 (las reglas de perimetría y namespaces ya están especificadas en `namespaces.md` y `SubEgoManifest.ts`).
  - ⬇️ Downhill: 5 steps (creación de `SubEgoMemoryGuard`, integración con `validateNamespaceAccess`, validación de `putMulti`/`get`/`delete`, tests exhaustivos de seguridad, verificación de tests de memoria existentes).

  **DoD Task Level:**
  - [ ] Intentos de acceso cruzado entre Sub-Egos sobre `egos/<id>/*` son interceptados y rechazados con error tipado.
  - [ ] Cada Sub-Ego puede leer y escribir sin fricción en su propio `egos/<su_id>/*`.
  - [ ] `ego.nucleus` mantiene acceso de supervisión y gobernanza a todos los namespaces.
  - [ ] Todos los tests de `@ego/memory` y `@ego/subegos` pasan al 100%.

  **Iteraciones:**
  | # | Acción | Resultado | Herramienta |
  |---|--------|-----------|-------------|
  | — | — | — | — |

  **Notas:** Compuerta `DSEK-03` implementada; sienta las bases para el control de acceso en namespaces compartidos (`SUB-05`).

---

## Próximo Paso Recomendado

Para ejecutar este plan de campaña mediante el pipeline formal:

```powershell
/pipeline run -PlanFile docs/agent-ops/plans/2026-10-09-subegos-foundation.md
```

=== RECITATION SUB-02 ===
Campaign ID: 
Objetivo activo: 
Estado: completed
Última acción: Estado actualizado a COMPLETED
Resultado: COMPLETED
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===

=== RECITATION SUB-03 ===
Campaign ID: 
Objetivo activo: 
Estado: completed
Última acción: Estado actualizado a COMPLETED
Resultado: COMPLETED
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===

=== RECITATION SUB-04 ===
Campaign ID: 
Objetivo activo: 
Estado: completed
Última acción: Estado actualizado a COMPLETED
Resultado: COMPLETED
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===
