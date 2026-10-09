# Plan de Ejecución: Convergencia MVP y Fundación Multi-Sub-Ego (20 Tareas)

> **Inicio:** 2026-10-09  
> **Estado:** ⏳ EN PROGRESO  
> **Fuente:** `docs/roadmap/Backlog.md` (Fase 03 y Fase 03.1)  
> **Autonomous:** false  

## Resumen

| Resultado | Count |
|-----------|-------|
| ✅ DO | 20 |
| 🟡 DEFER | 0 |
| ❌ SKIP | 0 |
| 🔴 BLOQUEADO | 0 |

Status: ⬆️ uphill = 6 (decisión formal de silueta de personaje, esquema de render vectorial 2D, integración por turnos de streaming con ToolLoop, persistencia de claves BYOK, modelo reactivo de conmutación de proyectos y puente interactivo HITL en chat) · ⬇️ downhill = 84 (steps atómicos de implementación, bindings IPC, componentes React y suites de pruebas unitarias/E2E).

---

## Tasks

### Task 1: SUB-05 — Shared Memory y protocolo de intercambio de contexto

- **Appetite:** max 2d
- **Esfuerzo:** 🟡 2d
- **Prioridad:** 🔴 P0
- **Archivos clave:** `packages/subegos/src/SharedMemory.ts`, `packages/subegos/test/SharedMemory.test.ts`
- **Verificación real:** ✅ CÓDIGO-REAL — `SubEgoMemoryIsolation` existe (`SUB-04`), pero no existe un canal unificado `SharedMemory` con protocolo de publicación/suscripción y leases temporales sobre `shared/*`. Callers: `DelegationRouter`, `SubEgoRuntime`.
- **Gate Justificación:** Principio Innegociable §2 y §4: Múltiples Sub-Egos cooperantes requieren un bus de contexto compartido estructurado sin colisionar en namespaces privados.
- **Gate Result:** ✅ DO
- **Contrato:** `pnpm --filter @ego/subegos test` (suite `SharedMemory.test.ts` en exit code 0 verificando escrituras, lecturas con lease temporal y broadcast de contexto compartido).
- **Task file:** `docs/agent-ops/tasks/SUB-05.md`
- **Estado:** ⬜ PENDING
- **Branch:** master
- **Commit:** —

  **Checklist Shape Up:**
  1. *¿Es el problema correcto?* Sí; evita que la delegación entre Sub-Egos deba transferir payloads masivos en el prompt, usando VantaDB `shared/*` por referencia.
  2. *¿Es correcto el appetite/scope?* Sí; 2 días permite implementar el protocolo de lease temporal y namespaces compartidos.
  3. *¿Es AHORA?* Sí; bloquea la delegación recursiva de `SUB-06`.

  **Cynefin:** 🟨 Complicado — Concurrencia de lectura/escritura y caducidad de leases en memoria VantaDB.
  
  **Top 3 Riesgos:**
  1. *Riesgo 1 (Probabilidad):* Conflictos de sobrescritura concurrente en la misma clave compartida por dos Sub-Egos paralelos.
  2. *Riesgo 2 (Impacto):* Acumulación de leases huérfanos que degraden el espacio de almacenamiento local.
  3. *Riesgo 3 (Contrato):* Falla de tipado en eventos de suscripción cruzada entre procesos.

  **Pre-mortem:**
  - *Fallo probable 1:* El TTL del lease expira mientras un Sub-Ego delegado todavía está procesando el payload.
  - *Fallo probable 2:* Filtración de datos de un proyecto a otro por claves compartidas globales sin prefijo `projects/<id>/shared/*`.
  - *Fallo probable 3:* Deadlock en la adquisición de locks de escritura para claves compartidas.

  **Stop conditions / Circuit breaker:**
  - *Appetite excedido:* Si en 2 días el bus de eventos de suscripción introduce complejidad excesiva, limitar la primera versión a un modelo de lectura/escritura determinista con lock atómico.
  - *Rabbit hole:* Si surgen problemas de rendimiento en Fjall LSM, persistir leases en caché volátil in-memory sincronizada a disco por batch.

  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta (mitigación) | Trigger / Due |
  |---|---|---|---|
  | 🟡×🔴 | Polución entre proyectos en espacio compartido | Enforzar prefijo canónico `projects/<id>/shared/*` | Al definir interfaz de claves |
  | 🟡×🟠 | Expiración prematura de lease | Implementar renovación de heartbeat por Sub-Ego activo | Al diseñar `acquireLease` |
  | 🟢×🟡 | Sobrecarga de polling en cambios compartidos | Integrar con `EventBus` tipado existente | Al diseñar el watcher |

  **Uphill / Downhill:**
  - ⬆️ Uphill: 0 (patrón de leases temporales y namespaces compartidos formalizado en `namespaces.md`).
  - ⬇️ Downhill: 4 steps (clase `SharedMemory`, métodos `publish`/`acquireLease`/`release`, integración con `SubEgoMemoryGuard`, suite de Vitest).

  **DoD Task Level:**
  - [ ] Clase `SharedMemory` soporta publicación, suscripción y leases temporales con TTL.
  - [ ] Claves compartidas quedan estrictamente aisladas bajo `projects/<proj_id>/shared/*`.
  - [ ] Tests de estrés concurrente pasan limpiamente en `@ego/subegos`.
  - [ ] `pnpm typecheck` pasa sin errores.

  **Iteraciones:**
  | # | Acción | Resultado | Herramienta |
  |---|--------|-----------|-------------|
  | — | — | — | — |

  **Notas:** Basado en patrones de `openclaw` y `career-ops` (Data Contracts).

---

### Task 2: SUB-06 — Comunicación y delegación inter-Sub-Ego

- **Appetite:** max 2d
- **Esfuerzo:** 🟡 2d
- **Prioridad:** 🔴 P0
- **Archivos clave:** `packages/subegos/src/DelegationRouter.ts`, `packages/subegos/test/DelegationRouter.test.ts`
- **Verificación real:** ✅ CÓDIGO-REAL — `SubEgoRuntime` gestiona instancias vivas, pero no existe la abstracción `DelegationRouter` que reciba una sub-tarea de un Sub-Ego emisor, valide permisos de delegación en `SubEgoManifest.permissions`, gestione el call stack y limite la profundidad.
- **Gate Justificación:** Principio Innegociable §4 y §7: Sub-Egos deben cooperar recursivamente sin bucles infinitos ni escalamiento no autorizado.
- **Gate Result:** ✅ DO
- **Contrato:** `pnpm --filter @ego/subegos test` (suite `DelegationRouter.test.ts` verificando delegación padre->hijo, intercepción de bucles recursivos `depth > maxDepth` y retorno de resultados integrados).
- **Task file:** `docs/agent-ops/tasks/SUB-06.md`
- **Estado:** ⬜ PENDING
- **Branch:** master
- **Commit:** —

  **Checklist Shape Up:**
  1. *¿Es el problema correcto?* Sí; resuelve el mecanismo central de la arquitectura multi-agente donde un Sub-Ego generalista delega a uno especialista.
  2. *¿Es correcto el appetite/scope?* Sí; 2 días para el enrutador y la pila de ejecución jerárquica.
  3. *¿Es AHORA?* Sí; requerido para el Golden Path Alpha.

  **Cynefin:** 🟨 Complicado — Prevención de recursión infinita (A -> B -> A) y propagación segura de contexto/presupuesto.
  
  **Top 3 Riesgos:**
  1. *Riesgo 1 (Probabilidad):* Bucles recursivos infinitos que consuman el presupuesto de tokens.
  2. *Riesgo 2 (Impacto):* Pérdida del contexto original de la consulta al delegar en múltiples niveles.
  3. *Riesgo 3 (Contrato):* Sub-Ego hijo hereda permisos que el Sub-Ego padre no posee.

  **Pre-mortem:**
  - *Fallo probable 1:* El router no comprueba la lista de sub-egos permitidos en el manifiesto del delegador y permite invocar herramientas fuera de scope.
  - *Fallo probable 2:* Deadlock si una tarea delegada espera sincrónicamente la respuesta del delegador.
  - *Fallo probable 3:* Pérdida de trazas de auditoría al retornar resultados integrados.

  **Stop conditions / Circuit breaker:**
  - *Appetite excedido:* Si tras 2 días el call-stack asíncrono no converge, restringir la delegación a un único nivel jerárquico (profundidad máxima = 1).
  - *Rabbit hole:* Si surgen bloqueos en la resolución de promesas, adoptar un patrón estrictamente asíncrono basado en mensajes tipados.

  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta (mitigación) | Trigger / Due |
  |---|---|---|---|
  | 🟡×🔴 | Recursión cíclica (A -> B -> A) | Mantener `visitedEgos: Set<string>` en el contexto de delegación | Al iniciar `delegateTask` |
  | 🟡×🟠 | Escalada de privilegios | El hijo solo puede ejecutar herramientas autorizadas en la intersección Padre ∩ Hijo | Al invocar hijo |
  | 🟢×🟡 | Agotamiento de presupuesto en sub-tareas | Heredar cuota compartida del padre descontando tokens | Al instanciar ejecución |

  **Uphill / Downhill:**
  - ⬆️ Uphill: 0 (arquitectura jerárquica y stack de delegación formalizados en `vision-general.md`).
  - ⬇️ Downhill: 4 steps (clase `DelegationRouter`, validación de permisos en manifiesto, detector de ciclos, suite de Vitest).

  **DoD Task Level:**
  - [ ] `DelegationRouter` implementado con límite de profundidad configurable (`maxDepth = 3`).
  - [ ] Validación estricta de permisos de delegación en `SubEgoManifest`.
  - [ ] Detección y bloqueo inmediato de ciclos A -> B -> A con error descriptivo.
  - [ ] Suite de pruebas unitarias pasando al 100%.

  **Iteraciones:**
  | # | Acción | Resultado | Herramienta |
  |---|--------|-----------|-------------|
  | — | — | — | — |

  **Notas:** Integración directa con `SubEgoRuntime` (`SUB-03`) y `SharedMemory` (`SUB-05`).

---

### Task 3: SUB-07 — Registro y catálogo de Sub-Egos en namespace `gov/sub_egos`

- **Appetite:** max 1.5d
- **Esfuerzo:** 🟡 1.5d
- **Prioridad:** 🔴 P0
- **Archivos clave:** `packages/subegos/src/SubEgoRegistry.ts`, `packages/subegos/test/SubEgoRegistry.test.ts`
- **Verificación real:** ✅ CÓDIGO-REAL — Manifiestos se crean con `SubEgoFactory`, pero no se persisten ni indexan en el namespace `gov/sub_egos` de VantaDB en un catálogo unificado con búsqueda y filtros.
- **Gate Justificación:** Principio Innegociable §1 y §4: Los Sub-Egos creados por el usuario o precargados deben persistirse localmente para sobrevivir reinicios y estar disponibles para selección.
- **Gate Result:** ✅ DO
- **Contrato:** `pnpm --filter @ego/subegos test` (suite `SubEgoRegistry.test.ts` validando registro, actualización, recuperación, listado por dominios y persistencia en VantaDB).
- **Task file:** `docs/agent-ops/tasks/SUB-07.md`
- **Estado:** ⬜ PENDING
- **Branch:** master
- **Commit:** —

  **Checklist Shape Up:**
  1. *¿Es el problema correcto?* Sí; permite al usuario y al sistema descubrir qué Sub-Egos están instalados y activos.
  2. *¿Es correcto el appetite/scope?* Sí; 1.5 días es suficiente para el registro sobre `EgoMemoryAdapter`.
  3. *¿Es AHORA?* Sí; la UI de escritorio necesita consultar este registro.

  **Cynefin:** 🟦 Obvio — Operaciones CRUD estándar sobre namespace `gov/sub_egos/*` con validación Zod.
  
  **Top 3 Riesgos:**
  1. *Riesgo 1 (Probabilidad):* Colisión de IDs de Sub-Egos entre plantillas del sistema y Sub-Egos definidos por el usuario.
  2. *Riesgo 2 (Impacto):* Registro de manifiestos corruptos que quiebren la carga de la aplicación al arrancar.
  3. *Riesgo 3 (Contrato):* Falta de soporte para borrado suave (`soft-delete` o deshabilitación).

  **Pre-mortem:**
  - *Fallo probable 1:* Modificación accidental de un Sub-Ego inmutable del sistema (ej. `ego.nucleus`).
  - *Fallo probable 2:* Deserialización fallida si la versión del schema Zod cambia.
  - *Fallo probable 3:* El listado es lento al no usar índices por dominio.

  **Stop conditions / Circuit breaker:**
  - *Appetite excedido:* Limitar a consultas simples por clave antes de añadir filtros complejos de texto.
  - *Rabbit hole:* Si la indexación en VantaDB genera lentitud, mantener índice in-memory sincronizado en el adaptador.

  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta (mitigación) | Trigger / Due |
  |---|---|---|---|
  | 🟡×🔴 | Mutación no autorizada de Sub-Egos núcleo | Proteger IDs del sistema (`ego.*`) contra edición o borrado | Al registrar/actualizar |
  | 🟢×🟠 | Corrupción de manifiesto en disco | Validar con `SubEgoManifestSchema.parse` antes de escribir en VantaDB | En `registerSubEgo` |
  | 🟢×🟡 | Colisión de IDs | Generar slug determinista con hash o sufijo incremental | En creación |

  **Uphill / Downhill:**
  - ⬆️ Uphill: 0 (namespace `gov/sub_egos` y schema de manifiesto cerrados).
  - ⬇️ Downhill: 3 steps (clase `SubEgoRegistry`, métodos CRUD, suite Vitest).

  **DoD Task Level:**
  - [ ] `SubEgoRegistry` permite registrar, actualizar, deshabilitar y listar Sub-Egos.
  - [ ] Persistencia real en namespace `gov/sub_egos/<id>`.
  - [ ] Sub-Egos del sistema quedan marcados como de solo lectura.
  - [ ] 100% de tests unitarios pasando.

  **Iteraciones:**
  | # | Acción | Resultado | Herramienta |
  |---|--------|-----------|-------------|
  | — | — | — | — |

  **Notas:** Soporte para compuerta `DSEK-01` (inmutabilidad y versionado).

---

### Task 4: SUB-08 — Selector de Sub-Ego y delegación manual/automática en UI

- **Appetite:** max 2d
- **Esfuerzo:** 🟡 2d
- **Prioridad:** 🔴 P0
- **Archivos clave:** `apps/desktop/renderer/components/SubEgoSelector.tsx`, `apps/desktop/renderer/src/App.tsx`
- **Verificación real:** ✅ CÓDIGO-REAL — `union.tsx` y placeholders en `chat.tsx` no conectan la selección del Sub-Ego emisor ni muestran las insignias de especialidad.
- **Gate Justificación:** Principio Innegociable §4 y §8: El usuario debe poder elegir conscientemente qué Sub-Ego atiende la consulta o permitir la selección automática por Ego.
- **Gate Result:** ✅ DO
- **Contrato:** `pnpm build` y tests de componentes verificando conmutación reactiva de Sub-Ego activo y paso de ID en el payload del chat IPC.
- **Task file:** `docs/agent-ops/tasks/SUB-08.md`
- **Estado:** ⬜ PENDING
- **Branch:** master
- **Commit:** —

  **Checklist Shape Up:**
  1. *¿Es el problema correcto?* Sí; da visibilidad en la interfaz al paradigma de Sub-Egos.
  2. *¿Es correcto el appetite/scope?* Sí; 2 días para el selector accesible y su vinculación al estado global de la app.
  3. *¿Es AHORA?* Sí; la interfaz actual no permite conmutar entre especialistas.

  **Cynefin:** 🟨 Complicado — Coordinación del estado de React con los canales IPC y el prompt del chat.
  
  **Top 3 Riesgos:**
  1. *Riesgo 1 (Probabilidad):* Re-renderizados excesivos del chat al cambiar de Sub-Ego en pleno streaming.
  2. *Riesgo 2 (Impacto):* Enviar un mensaje con un Sub-Ego seleccionado que no tenga permiso para el modelo actual.
  3. *Riesgo 3 (Contrato):* Problemas de accesibilidad o teclado en el dropdown/pill de selección.

  **Pre-mortem:**
  - *Fallo probable 1:* El usuario cambia el Sub-Ego a mitad de una respuesta en streaming y se rompe el canal.
  - *Fallo probable 2:* El selector no refleja Sub-Egos creados dinámicamente en tiempo de ejecución.
  - *Fallo probable 3:* El estado del Sub-Ego activo se pierde al recargar la ventana.

  **Stop conditions / Circuit breaker:**
  - *Appetite excedido:* Limitar el selector a un menú desplegable nativo limpio antes de implementar animaciones complejas de micro-interacción.
  - *Rabbit hole:* Si el estado global de React se desincroniza, manejarlo como estado local en `App.tsx` con persistencia en `localStorage`.

  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta (mitigación) | Trigger / Due |
  |---|---|---|---|
  | 🟡×🟠 | Cambio de Sub-Ego durante streaming activo | Deshabilitar el selector visualmente mientras `isStreaming === true` | Al renderizar selector |
  | 🟢×🟡 | Desincronización con el backend | Suscribirse a eventos de `gov/sub_egos` vía IPC | En `useEffect` inicial |
  | 🟢×🟢 | Estilo visual discordante | Reutilizar tokens de Tailwind y diseño de `@assistant-ui/react` | En maquetación |

  **Uphill / Downhill:**
  - ⬆️ Uphill: 0 (diseño de selector especificado en `character-system.md` y `hermes-agent`).
  - ⬇️ Downhill: 3 steps (componente `SubEgoSelector.tsx`, integración en la cabecera del chat, persistencia del Sub-Ego seleccionado).

  **DoD Task Level:**
  - [ ] Componente `SubEgoSelector` renderiza lista de Sub-Egos activos.
  - [ ] Opción "Automático (Ego Core)" disponible por defecto.
  - [ ] Conmutación deshabilita/habilita herramientas según los permisos del Sub-Ego.
  - [ ] Compilación TypeScript de `@ego/renderer` limpia.

  **Iteraciones:**
  | # | Acción | Resultado | Herramienta |
  |---|--------|-----------|-------------|
  | — | — | — | — |

  **Notas:** Se integrará posteriormente con los mini-avatares de `CHAR-08`.

---

### Task 5: SUB-09 — Presupuesto de tokens/coste y límites de ejecución por Sub-Ego

- **Appetite:** max 1.5d
- **Esfuerzo:** 🟡 1.5d
- **Prioridad:** 🔴 P0
- **Archivos clave:** `packages/subegos/src/SubEgoBudget.ts`, `packages/subegos/test/SubEgoBudget.test.ts`
- **Verificación real:** ✅ CÓDIGO-REAL — `SubEgoManifest.ts` declara campos opcionales de presupuesto, pero ningún middleware intercepta ni descuenta tokens en tiempo real ni frena tareas descontroladas.
- **Gate Justificación:** Principio Innegociable §5 y §7: Protección de costes del usuario (BYOK / AI Credits) y prevención de ejecuciones desbocadas.
- **Gate Result:** ✅ DO
- **Contrato:** `pnpm --filter @ego/subegos test` (suite `SubEgoBudget.test.ts` verificando conteo acumulado, corte inmediato ante exceso de cuota e informe de métricas).
- **Task file:** `docs/agent-ops/tasks/SUB-09.md`
- **Estado:** ⬜ PENDING
- **Branch:** master
- **Commit:** —

  **Checklist Shape Up:**
  1. *¿Es el problema correcto?* Sí; evita sorpresas de facturación y consumo desmedido de tokens en bucles de herramientas.
  2. *¿Es correcto el appetite/scope?* Sí; 1.5 días para la máquina contable y el hook de interrupción.
  3. *¿Es AHORA?* Sí; debe estar activo antes de validar delegaciones complejas.

  **Cynefin:** 🟦 Obvio — Acumulador determinista de tokens y cálculo de costos por modelo con límites duros.
  
  **Top 3 Riesgos:**
  1. *Riesgo 1 (Probabilidad):* Discrepancia entre los tokens estimados localmente y los tokens reales devueltos por el proveedor LLM.
  2. *Riesgo 2 (Impacto):* Cortar una tarea legítima a mitad de la escritura de un archivo crítico.
  3. *Riesgo 3 (Contrato):* No persistir el consumo acumulado entre reinicios de la aplicación.

  **Pre-mortem:**
  - *Fallo probable 1:* El proveedor LLM no incluye metadatos de uso (`usage.totalTokens`) y el budget no contabiliza el consumo.
  - *Fallo probable 2:* El Sub-Ego agota el presupuesto y entra en un bucle infinito de reintentos de error consumiendo más.
  - *Fallo probable 3:* El coste monetario calculado es incorrecto por desactualización de precios por millón de tokens.

  **Stop conditions / Circuit breaker:**
  - *Appetite excedido:* Si los metadatos de uso no vienen estandarizados, aplicar estimación heurística por caracteres como fallback seguro.
  - *Rabbit hole:* Si el cálculo monetario introduce demasiadas monedas y tablas de precios, limitar la cuota a número absoluto de tokens por turno y sesión.

  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta (mitigación) | Trigger / Due |
  |---|---|---|---|
  | 🟡×🟠 | Ausencia de `usage` en streaming | Estimar longitud de texto de prompt + respuesta como cota superior | En retorno del stream |
  | 🟢×🔴 | Aborto destructivo durante mutación de FS | Exigir que la verificación de cuota ocurra ANTES de lanzar cada tool | En pre-ejecución |
  | 🟢×🟡 | Persistencia de uso | Guardar métricas en `egos/<id>/metrics/usage` en VantaDB | Al finalizar turno |

  **Uphill / Downhill:**
  - ⬆️ Uphill: 0 (lógica de presupuestos documentada en `SubEgoManifest.ts`).
  - ⬇️ Downhill: 3 steps (clase `SubEgoBudgetTracker`, integración con `ExecutionManager`, suite de Vitest).

  **DoD Task Level:**
  - [ ] Tracker contabiliza tokens de entrada, salida y costo estimado.
  - [ ] Emite evento y rechaza la ejecución si se sobrepasa `maxTokensPerTurn` o `maxCostPerSession`.
  - [ ] Persistencia de métricas en VantaDB.
  - [ ] Tests unitarios en verde al 100%.

  **Iteraciones:**
  | # | Acción | Resultado | Herramienta |
  |---|--------|-----------|-------------|
  | — | — | — | — |

  **Notas:** Conectable al `ExecutionManager` de `packages/execution`.

---

### Task 6: SUB-10 — Validación E2E del Golden Path Alpha (Pasos 10 al 14)

- **Appetite:** max 2d
- **Esfuerzo:** 🟡 2d
- **Prioridad:** 🔴 P0
- **Archivos clave:** `tests/e2e/subegos-delegation.test.ts`
- **Verificación real:** ✅ CÓDIGO-REAL — Existen tests aislados en `@ego/subegos`, pero ninguna suite E2E automatizada que ejecute la secuencia completa de la arquitectura multi-Sub-Ego: Solicitud -> Selección -> Shared Memory -> Delegación hijo -> Retorno de resultado -> Persistencia.
- **Gate Justificación:** Criterio de Finalización Canónico (Roadmap Fase 03): Múltiples Sub-Egos cooperan para resolver una tarea sin que el usuario intervenga en la orquestación.
- **Gate Result:** ✅ DO
- **Contrato:** `pnpm test` ejecuta `tests/e2e/subegos-delegation.test.ts` con exit code 0 en modo offline/mock y determinista.
- **Task file:** `docs/agent-ops/tasks/SUB-10.md`
- **Estado:** ⬜ PENDING
- **Branch:** master
- **Commit:** —

  **Checklist Shape Up:**
  1. *¿Es el problema correcto?* Sí; es la compuerta de verificación formal de la Fase 03 completa.
  2. *¿Es correcto el appetite/scope?* Sí; 2 días para ensamblar el escenario de prueba integrado y asertos.
  3. *¿Es AHORA?* Sí; cierra y certifica la Fase 03 antes de avanzar.

  **Cynefin:** 🟨 Complicado — Orquestación del ciclo de vida multi-componente sin llamadas a APIs externas de pago.
  
  **Top 3 Riesgos:**
  1. *Riesgo 1 (Probabilidad):* Flakiness en tests asíncronos por esperas de temporizador no deterministas.
  2. *Riesgo 2 (Impacto):* Ocultar fallos reales si los mocks simplifican demasiado el comportamiento de `DelegationRouter`.
  3. *Riesgo 3 (Contrato):* Bloqueo de descriptores de archivos en VantaDB nativo en Windows durante los tests.

  **Pre-mortem:**
  - *Fallo probable 1:* El test falla esporádicamente en Windows por lentitud en el cierre de descriptores de VantaDB.
  - *Fallo probable 2:* El mock del proveedor no simula adecuadamente el formato de tool calling multi-turno.
  - *Fallo probable 3:* El test no verifica la reapertura de la base de datos tras la delegación.

  **Stop conditions / Circuit breaker:**
  - *Appetite excedido:* Si la orquestación E2E completa se atasca por Electron, aislar la suite a nivel Node.js en `@ego/subegos` y `tests/e2e`.
  - *Rabbit hole:* Si VantaDB causa contención de bloqueos en tests rápidos, usar directorios temporales aislados por suite.

  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta (mitigación) | Trigger / Due |
  |---|---|---|---|
  | 🟡×🔴 | Contención de archivos en Windows | Usar directorios únicos `tmp/ego-test-<timestamp>` por ejecución de test | En setup del test |
  | 🟡×🟠 | Flakiness por timeouts | Usar promesas deterministas con sincronización de eventos de `EventBus` | En asertos |
  | 🟢×🟡 | Mocks desalineados | Reutilizar `MockProvider` canónico de `@ego/models` | En configuración |

  **Uphill / Downhill:**
  - ⬆️ Uphill: 0 (escenario Golden Path Pasos 10-14 detallado en `roadmap.md`).
  - ⬇️ Downhill: 3 steps (fixture del escenario multi-Sub-Ego, asertos de delegación y memoria, verificación de persistencia).

  **DoD Task Level:**
  - [ ] Escenario multi-Sub-Ego verificado: Ego Core -> Especialista Investigador -> Especialista Validador -> Resultado integrado.
  - [ ] Persistencia de turnos de ambos Sub-Egos comprobada en VantaDB.
  - [ ] 0 regresiones en las 183+ pruebas existentes del monorepo.
  - [ ] Ejecución en CI/local en < 10 segundos.

  **Iteraciones:**
  | # | Acción | Resultado | Herramienta |
  |---|--------|-----------|-------------|
  | — | — | — | — |

  **Notas:** Hito final de verificación técnica de la Fase 03.

---

### Task 7: SUB-11 — Sub-Ego Soul / Alma: Definición de Personalidad y Tono

- **Appetite:** max 1.5d
- **Esfuerzo:** 🟢 1d
- **Prioridad:** 🔴 P0
- **Archivos clave:** `packages/subegos/src/SubEgoSoul.ts`, `packages/subegos/test/SubEgoSoul.test.ts`
- **Verificación real:** ✅ CÓDIGO-REAL — `docs/architecture/subego-soul.md` existe pero la clase `SubEgoSoul` no está implementada en `@ego/subegos`. Gap confirmado: no hay inyector dinámico de directrices de tono, valores innegociables y estilo de razonamiento en los prompts de los Sub-Egos.
- **Gate Justificación:** Principio Innegociable §4: Cada Sub-Ego debe poseer una identidad consistente y un alma (`soul`) que rija su tono y comportamiento sin desviaciones.
- **Gate Result:** ✅ DO
- **Contrato:** `pnpm --filter @ego/subegos test` (suite `SubEgoSoul.test.ts` validando parseo de directrices, persistencia en `egos/<id>/soul` y ensamblado de prompt contextualizado).
- **Task file:** `docs/agent-ops/tasks/SUB-11.md`
- **Estado:** ⬜ PENDING
- **Branch:** master
- **Commit:** —

  **Checklist Shape Up:**
  1. *¿Es el problema correcto?* Sí; estandariza cómo los Sub-Egos adoptan su rol y voz sin quemar prompts ad-hoc.
  2. *¿Es correcto el appetite/scope?* Sí; 1 día es suficiente para la abstracción y su persistencia.
  3. *¿Es AHORA?* Sí; sienta las bases para vincular la identidad visual con la personalidad (`CHAR-04`).

  **Cynefin:** 🟦 Obvio — Estructura declarativa Zod con serialización en VantaDB e inyección en el system prompt.
  
  **Top 3 Riesgos:**
  1. *Riesgo 1 (Probabilidad):* Consumo excesivo de tokens de contexto si la definición del alma es demasiado extensa.
  2. *Riesgo 2 (Impacto):* Sobrescritura accidental de directrices de seguridad innegociables del sistema por un prompt de alma personalizado.
  3. *Riesgo 3 (Contrato):* Falta de tipado en los rasgos de personalidad.

  **Pre-mortem:**
  - *Fallo probable 1:* El usuario inyecta en el alma instrucciones que intentan anular los guardrails del sistema (Prompt Injection).
  - *Fallo probable 2:* El alma no se persiste en VantaDB y se reinicia al valor por defecto.
  - *Fallo probable 3:* El ensamblado de contexto genera un orden incorrecto (el alma prevalece sobre las instrucciones del usuario).

  **Stop conditions / Circuit breaker:**
  - *Appetite excedido:* Limitar el alma a campos predefinidos (`tone`, `verbosity`, `analyticalBias`, `coreRules`) antes de permitir Markdown libre arbitrario.

  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta (mitigación) | Trigger / Due |
  |---|---|---|---|
  | 🟡×🔴 | Intento de bypass de guardrails vía alma | Enforzar precedencia: `System Rules > Soul > User Prompt` | En ensamblado de prompt |
  | 🟢×🟡 | Longitud excesiva de texto de alma | Limitar `maxCharacters` a 4,000 en validación Zod | En `SubEgoSoulSchema` |
  | 🟢×🟢 | Desincronización con manifiesto | Persistir referencia en `SubEgoManifest.soulRef` | En guardado |

  **Uphill / Downhill:**
  - ⬆️ Uphill: 0 (especificación técnica completa en `docs/architecture/subego-soul.md`).
  - ⬇️ Downhill: 3 steps (esquema Zod, clase `SubEgoSoul`, suite de Vitest).

  **DoD Task Level:**
  - [ ] Esquema `SubEgoSoulSchema` con validación Zod.
  - [ ] Inyector de system prompt con jerarquía estricta de precedencia.
  - [ ] Persistencia y recuperación en VantaDB `egos/<id>/soul`.
  - [ ] Tests unitarios en verde al 100%.

  **Iteraciones:**
  | # | Acción | Resultado | Herramienta |
  |---|--------|-----------|-------------|
  | — | — | — | — |

  **Notas:** Vinculación directa con `CHAR-04`.

---

### Task 8: SUB-12 — Superación Personal & Closed Learning Loop (Auto-Reflexión)

- **Appetite:** max 2d
- **Esfuerzo:** 🟡 2d
- **Prioridad:** 🔴 P0
- **Archivos clave:** `packages/subegos/src/SelfImprovementLoop.ts`, `packages/subegos/test/SelfImprovementLoop.test.ts`
- **Verificación real:** ✅ CÓDIGO-REAL — `KHOJ-05` (extracción de hechos y auto-reflexión) está pendiente de adaptación; actualmente los Sub-Egos no aprenden de sus errores ni refuerzan estrategias exitosas tras completar una tarea.
- **Gate Justificación:** Principio Innegociable §1 y §4: Un Sistema Operativo Cognitivo debe acumular sabiduría operativa localmente; los Sub-Egos deben volverse mejores con cada uso.
- **Gate Result:** ✅ DO
- **Contrato:** `pnpm --filter @ego/subegos test` (suite `SelfImprovementLoop.test.ts` probando extracción de lecciones post-ejecución, deduplicación y refuerzo de estrategias en VantaDB).
- **Task file:** `docs/agent-ops/tasks/SUB-12.md`
- **Estado:** ⬜ PENDING
- **Branch:** master
- **Commit:** —

  **Checklist Shape Up:**
  1. *¿Es el problema correcto?* Sí; cierra el bucle de aprendizaje continuo sin reentrenar pesos de modelos neuronales.
  2. *¿Es correcto el appetite/scope?* Sí; 2 días para el analizador de reflexiones y persistencia de hechos.
  3. *¿Es AHORA?* Sí; evita que los Sub-Egos repitan los mismos errores sintácticos o de razonamiento.

  **Cynefin:** 🟨 Complicado — Extracción sintética de aprendizajes evitando alucinaciones o polución de la memoria episódica.
  
  **Top 3 Riesgos:**
  1. *Riesgo 1 (Probabilidad):* Polución de memoria con reflexiones triviales que inflen el contexto en turnos futuros.
  2. *Riesgo 2 (Impacto):* Costo adicional de inferencia al ejecutar un turno de reflexión post-tarea.
  3. *Riesgo 3 (Contrato):* Registrar aprendizajes contradictorios o erróneos si la tarea falló por causas externas.

  **Pre-mortem:**
  - *Fallo probable 1:* El bucle de auto-reflexión se dispara en cada turno trivial saturando la base de datos de VantaDB.
  - *Fallo probable 2:* Las lecciones extraídas no se desduplican y se acumulan réplicas exactas.
  - *Fallo probable 3:* El proceso de reflexión bloquea la respuesta al usuario.

  **Stop conditions / Circuit breaker:**
  - *Appetite excedido:* Ejecutar la auto-reflexión únicamente cuando la tarea contenga errores recuperados o sea marcada explícitamente como hito importante.
  - *Rabbit hole:* Si la inferencia de reflexión encarece el uso, realizar el análisis mediante heurísticas locales basadas en eventos de error de herramientas.

  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta (mitigación) | Trigger / Due |
  |---|---|---|---|
  | 🟡×🟠 | Bloqueo de UI por reflexión post-tarea | Ejecutar en background de forma desacoplada y asíncrona | Tras emitir respuesta |
  | 🟡×🟡 | Duplicación de hechos aprendidos | Deduplicar lecciones mediante hashing o similitud léxica | Antes de escribir en DB |
  | 🟢×🔴 | Reflexión sobre tareas fallidas por red | Clasificar errores antes de reflexionar (no reflexionar sobre fallos de red) | En filtro de entrada |

  **Uphill / Downhill:**
  - ⬆️ Uphill: 1 (definición del formato canónico de lecciones aprendidas).
  - ⬇️ Downhill: 4 steps (clase `SelfImprovementLoop`, filtros de activación, persistencia en `egos/<id>/lessons`, suite Vitest).

  **DoD Task Level:**
  - [ ] Clase `SelfImprovementLoop` extrae lecciones solo ante eventos relevantes.
  - [ ] Deduplicación de lecciones implementada.
  - [ ] Lecciones persistidas en `egos/<id>/lessons/*` en VantaDB.
  - [ ] Pruebas unitarias en verde.

  **Iteraciones:**
  | # | Acción | Resultado | Herramienta |
  |---|--------|-----------|-------------|
  | — | — | — | — |

  **Notas:** Implementa la compuerta canónica `KHOJ-05`.

---

### Task 9: CHAR-03 — Prototipos de siluetas originales no humanoides y elección de la identidad de Ego

- **Appetite:** max 2d
- **Esfuerzo:** 🟡 2d
- **Prioridad:** 🔴 P0
- **Archivos clave:** `docs/research/character-prototypes/`, `docs/product/character-art-direction.md`
- **Verificación real:** ✅ CÓDIGO-REAL — `CHAR-01` y `CHAR-02` completadas documentaron que el sistema actual arrastra elementos squircle de Mochi y ropa humana. No existen siluetas no humanoides a 16/24/48 px evaluadas formalmente.
- **Gate Justificación:** Criterio de originalidad y marca: Ego requiere una criatura visual distintiva (entidad energética, bio-digital o fractal) sin vestimenta humana ni clichés de mascotas infantiles.
- **Gate Result:** ✅ DO
- **Contrato:** Archivo HTML autocontenido con 3 variantes de silueta evaluadas en matrices de píxeles (16, 24, 48 px) y veredicto formal documentado en `character-art-direction.md`.
- **Task file:** `docs/agent-ops/tasks/CHAR-03.md`
- **Estado:** ✅ COMPLETED
- **Branch:** master
- **Commit:** —

  **Checklist Shape Up:**
  1. *¿Es el problema correcto?* Sí; define la identidad visual inconfundible de Ego antes de programar su motor procedural.
  2. *¿Es correcto el appetite/scope?* Sí; 2 días para prototipar en un archivo HTML aislado sin ensuciar la app.
  3. *¿Es AHORA?* Sí; bloquea todo el trabajo de renderizado de `CHAR-04`..`CHAR-08`.

  **Cynefin:** 🟨 Complicado — Dirección de arte, legibilidad a baja resolución y originalidad conceptual.
  
  **Top 3 Riesgos:**
  1. *Riesgo 1 (Probabilidad):* Siluetas demasiado complejas que pierdan definición a 16x16 px en la barra de tareas o selector.
  2. *Riesgo 2 (Impacto):* Elección de una silueta que recuerde demasiado a un asistente existente (ej. Clippy, Siri orb).
  3. *Riesgo 3 (Contrato):* Retrasos por debates estéticos subjetivos sin criterios objetivos de decisión.

  **Pre-mortem:**
  - *Fallo probable 1:* El prototipo incluye SVG pesados difíciles de parametrizar proceduralmente en Canvas.
  - *Fallo probable 2:* La forma no permite transmitir estados expresivos (pensando, aprobando, error) de manera intuitiva.
  - *Fallo probable 3:* Falta de escalabilidad para variantes morfológicas de los Sub-Egos.

  **Stop conditions / Circuit breaker:**
  - *Appetite excedido:* Limitar la evaluación a 3 candidatos geométricos abstractos (Monolito pulsante, Poliedro fractal, Núcleo bio-luminiscente) y cerrar decisión con el criterio técnico más simple de renderizar.

  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta (mitigación) | Trigger / Due |
  |---|---|---|---|
  | 🟡×🔴 | Ilegibilidad a 16 px | Probar primero a 16x16 px antes de diseñar a 48 px | Al crear prototipos |
  | 🟡×🟠 | Complejidad de interpolación | Priorizar formas basadas en geometría vectorial analítica | En elección de silueta |
  | 🟢×🟡 | Subjetividad artística | Evaluar con matriz de puntuación: legibilidad, coste Canvas, originalidad | En acta de decisión |

  **Uphill / Downhill:**
  - ⬆️ Uphill: 0 (elección formal de la silueta definitiva completada).
  - ⬇️ Downhill: 0 (prototipo HTML funcional y acta técnica cerrados).

  **DoD Task Level:**
  - [x] 3 siluetas prototipadas en SVG/Canvas en HTML aislado.
  - [x] Pruebas de legibilidad a 16, 24 y 48 px documentadas.
  - [x] Silueta ganadora seleccionada y aprobada (Monolito Cuántico Pulsante).
  - [x] Criterios de anatomía formalizados en `character-art-direction.md`.

  **Iteraciones:**
  | # | Acción | Resultado | Herramienta |
  |---|--------|-----------|-------------|
  | 1 | Prototipado Canvas 2D de 3 candidatos, matriz de evaluación y acta de elección | Ganador Candidato A (9.53 pts). Prototipo HTML interactivo y dirección de arte canónica cerrada | `write_to_file` |

  **Notas:** Sin código de producto; prototipo documental y de laboratorio.

---

### Task 10: CHAR-04 — Contrato `CharacterProfile` (identidad visual con `traits`, sin `outfit`) y vínculo con `SubEgoManifest`

- **Appetite:** max 1.5d
- **Esfuerzo:** 🟡 1.5d
- **Prioridad:** 🔴 P0
- **Archivos clave:** `packages/subegos/src/CharacterProfile.ts`, `packages/subegos/test/CharacterProfile.test.ts`
- **Verificación real:** ✅ CÓDIGO-REAL — `SubEgoManifest.ts` tiene campos de metadatos, pero carece de un contrato tipado Zod para la morfología visual del personaje (forma base, colores primario/secundario, aura, rasgos geométricos).
- **Gate Justificación:** Principio Innegociable §4: La apariencia del personaje debe ser un dato estructurado y reproducible, disociado de la lógica de renderizado.
- **Gate Result:** ✅ DO
- **Contrato:** `pnpm --filter @ego/subegos test` (suite `CharacterProfile.test.ts` validando esquemas Zod de rasgos anatómicos, serialización y validación cruzada con `SubEgoManifest`).
- **Task file:** `docs/agent-ops/tasks/CHAR-04.md`
- **Estado:** ⬜ PENDING
- **Branch:** master
- **Commit:** —

  **Checklist Shape Up:**
  1. *¿Es el problema correcto?* Sí; desvincula el modelo de datos de la implementación visual (eliminando conceptos obsoletos como "outfit" o vestimenta humana).
  2. *¿Es correcto el appetite/scope?* Sí; 1.5 días para el esquema Zod y sus validadores.
  3. *¿Es AHORA?* Sí; necesario antes de programar el renderer de Canvas (`CHAR-05`).

  **Cynefin:** 🟦 Obvio — Esquema fuertemente tipado en TypeScript con validación en tiempo de ejecución.
  
  **Top 3 Riesgos:**
  1. *Riesgo 1 (Probabilidad):* Introducir propiedades dependientes de tecnología específica (ej. coordenadas CSS o pixeles fijos).
  2. *Riesgo 2 (Impacto):* Incompatibilidad con perfiles preexistentes de Sub-Egos en VantaDB.
  3. *Riesgo 3 (Contrato):* Rasgos morfológicos insuficientes para diferenciar visualmente los Sub-Egos.

  **Pre-mortem:**
  - *Fallo probable 1:* El contrato permite valores no normalizados (ej. colores fuera de gamut o coordenadas infinitas).
  - *Fallo probable 2:* Se mezclan propiedades de estado reactivo (`CharacterState`) con la identidad fija (`CharacterProfile`).
  - *Fallo probable 3:* El esquema no soporta valores por defecto limpios para Sub-Egos sin configuración visual explícita.

  **Stop conditions / Circuit breaker:**
  - *Appetite excedido:* Mantener el perfil con parámetros abstractos normalizados (0.0 a 1.0) para tamaño, curvatura, tono cromático y pulsación.

  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta (mitigación) | Trigger / Due |
  |---|---|---|---|
  | 🟡×🟠 | Acoplamiento a píxeles | Normalizar todos los rasgos a valores flotantes [0..1] o tokens canónicos | En diseño de Zod |
  | 🟢×🔴 | Ruptura de `SubEgoManifest` | Hacer el campo `characterProfile?: CharacterProfile` totalmente opcional | En extensión de schema |
  | 🟢×🟡 | Faltan rasgos distintivos | Permitir array `traits: TraitIdentifier[]` extensible | En definición de tipos |

  **Uphill / Downhill:**
  - ⬆️ Uphill: 0 (reglas de identidad sin vestimenta acordadas en `character-audit-and-coucou-inventory.md`).
  - ⬇️ Downhill: 3 steps (esquema Zod `CharacterProfileSchema`, métodos de serialización, suite Vitest).

  **DoD Task Level:**
  - [ ] Esquema `CharacterProfile` definido sin atributos de ropa humana.
  - [ ] Parámetros normalizados para escala, geometría, paleta cromática y aura.
  - [ ] Integración opcional validada dentro de `SubEgoManifest`.
  - [ ] Tests unitarios en verde.

  **Iteraciones:**
  | # | Acción | Resultado | Herramienta |
  |---|--------|-----------|-------------|
  | — | — | — | — |

  **Notas:** Conecta `CHAR-03` con el motor procedural de `CHAR-05`.

---

### Task 11: CHAR-05 — Motor procedural base y renderer vectorial (Canvas 2D)

- **Appetite:** max 3d
- **Esfuerzo:** 🟡 2-3d
- **Prioridad:** 🔴 P0
- **Archivos clave:** `apps/desktop/renderer/components/character/ProceduralCharacterCanvas.tsx`, `apps/desktop/renderer/components/character/core/`
- **Verificación real:** ✅ CÓDIGO-REAL — Actualmente no existe ningún componente de canvas vectorial en `apps/desktop/renderer`. Solo existen iconos estáticos Lucide. Coucou dependía de SpriteKit nativo no portable a Electron Chromium.
- **Gate Justificación:** Criterio UX/UI y rendimiento: La representación visual de Ego debe ejecutarse a 60 FPS con mínimo consumo de CPU/GPU mediante Canvas 2D nativo sin librerías pesadas externas.
- **Gate Result:** ✅ DO
- **Contrato:** Componente React que renderiza la silueta procedural elegida en un elemento `<canvas>` determinista a 16, 24, 48 y 128 px con golden frames visuales verificados.
- **Task file:** `docs/agent-ops/tasks/CHAR-05.md`
- **Estado:** ⬜ PENDING
- **Branch:** master
- **Commit:** —

  **Checklist Shape Up:**
  1. *¿Es el problema correcto?* Sí; provee el motor gráfico determinista desacoplado de dependencias externas.
  2. *¿Es correcto el appetite/scope?* Sí; 3 días para el motor 2D con renderizado determinista de frames.
  3. *¿Es AHORA?* Sí; requerido para dar presencia viva a la aplicación.

  **Cynefin:** 🟨 Complicado — Matemáticas vectoriales de Canvas 2D, escalado de DPI en pantallas Retina/Windows 4K y rendimiento.
  
  **Top 3 Riesgos:**
  1. *Riesgo 1 (Probabilidad):* Fugas de memoria o degradación de rendimiento por loops `requestAnimationFrame` no cancelados.
  2. *Riesgo 2 (Impacto):* Pixelación o borrosidad en pantallas de alta densidad de píxeles (HiDPI / Windows fractional scaling).
  3. *Riesgo 3 (Contrato):* Consumo de CPU excesivo en segundo plano.

  **Pre-mortem:**
  - *Fallo probable 1:* El canvas redibuja continuamente a 60 FPS incluso cuando el personaje está completamente estático en reposo.
  - *Fallo probable 2:* `devicePixelRatio` no se maneja adecuadamente provocando distorsión en monitores 125%/150%.
  - *Fallo probable 3:* El código de dibujo interactúa con el DOM bloqueando el hilo de eventos de React.

  **Stop conditions / Circuit breaker:**
  - *Appetite excedido:* Implementar renderizado reactivo bajo demanda (dibujar solo cuando el estado cambia) antes de animación continua.
  - *Rabbit hole:* Si las matemáticas procedurales se vuelven hipercomplejas, dibujar trazados vectoriales predefinidos con deformación paramétrica.

  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta (mitigación) | Trigger / Due |
  |---|---|---|---|
  | 🟡×🔴 | Consumo de CPU en reposo | Pausar el loop de render cuando el estado es estático (Dirty Flag pattern) | En diseño del loop |
  | 🟡×🟠 | Desenfoque en pantallas HiDPI | Multiplicar dimensiones de canvas por `window.devicePixelRatio` y escalar contexto | En inicialización |
  | 🟢×🟡 | Fuga de memoria en unmount | Limpiar rigurosamente `cancelAnimationFrame` en el hook de limpieza | En `useEffect` |

  **Uphill / Downhill:**
  - ⬆️ Uphill: 1 (ajuste fino de curvas bezier paramétricas para la silueta).
  - ⬇️ Downhill: 4 steps (setup de canvas HiDPI, pipeline de dibujo modular, dirty flag de optimización, golden tests).

  **DoD Task Level:**
  - [ ] Renderer en Canvas 2D sin dependencias de librerías externas pesadas.
  - [ ] Soporte impecable de escalado HiDPI / Retina.
  - [ ] Dirty-flag para detener el redibujado en reposo (0% CPU en idle).
  - [ ] Golden frames capturados y verificados.

  **Iteraciones:**
  | # | Acción | Resultado | Herramienta |
  |---|--------|-----------|-------------|
  | — | — | — | — |

  **Notas:** Absorbe y reemplaza la necesidad técnica de `CANV-08`.

---

### Task 12: CHAR-06 — Estados, expresiones, interpolación y animaciones de interacción

- **Appetite:** max 2.5d
- **Esfuerzo:** 🟡 2-3d
- **Prioridad:** 🟠 Alta
- **Archivos clave:** `apps/desktop/renderer/components/character/state/CharacterStateMachine.ts`, `apps/desktop/renderer/components/character/state/`
- **Verificación real:** ✅ CÓDIGO-REAL — `COUC-06` (Attention FSM) y 14 estados canónicos documentados en `character-art-direction.md`, pero sin implementación en TypeScript de la máquina de estados e interpolador de transiciones.
- **Gate Justificación:** Explicabilidad UX: El usuario debe comprender el estado interno de Ego (atento, procesando, esperando aprobación humana, en error, satisfecho) mediante sutiles transiciones cinéticas.
- **Gate Result:** ✅ DO
- **Contrato:** Máquina de estados tipada que interpola suavemente canales abstractos (`gaze`, `pulse`, `aura`, `accent`) entre los 14 estados canónicos sin saltos bruscos.
- **Task file:** `docs/agent-ops/tasks/CHAR-06.md`
- **Estado:** ⬜ PENDING
- **Branch:** master
- **Commit:** —

  **Checklist Shape Up:**
  1. *¿Es el problema correcto?* Sí; transforma el render estático en un indicador intuitivo de actividad cognitiva.
  2. *¿Es correcto el appetite/scope?* Sí; 2.5 días para la máquina de estados e interpolación por resorte/lerp.
  3. *¿Es AHORA?* Sí; vincula la actividad del Cognitive Runtime con la respuesta visual.

  **Cynefin:** 🟨 Complicado — Ecuaciones de interpolación (lerp/springs) y gramática de transiciones.
  
  **Top 3 Riesgos:**
  1. *Riesgo 1 (Probabilidad):* Transiciones erráticas o saltos visuales si se cambian estados a alta frecuencia.
  2. *Riesgo 2 (Impacto):* Sobrecarga visual que distraiga al usuario de su flujo de trabajo principal.
  3. *Riesgo 3 (Contrato):* Desalineación entre los eventos del runtime y los estados visuales.

  **Pre-mortem:**
  - *Fallo probable 1:* El personaje parpadea convulsivamente ante ráfagas de tokens de streaming.
  - *Fallo probable 2:* La FSM queda atrapada en un estado transitorio y no regresa a reposo tras un error.
  - *Fallo probable 3:* El interpolador acumula retraso (lag) respecto a la acción real del sistema.

  **Stop conditions / Circuit breaker:**
  - *Appetite excedido:* Limitar las interpolaciones a funciones de relajación lineal (`lerp` simple con damping) antes de físicas complejas de resortes.

  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta (mitigación) | Trigger / Due |
  |---|---|---|---|
  | 🟡×🟠 | Saturación por ráfagas de streaming | Coalescer eventos de actividad rápida a estado continuo `thinking` | En listener de stream |
  | 🟢×🔴 | Estado bloqueado | Timeout de seguridad de 5s para auto-retornar a `idle` si no hay actividad | En FSM |
  | 🟢×🟡 | Distracción del usuario | Mantener micro-movimientos sutiles (<10% de variación de amplitud) | En afinación visual |

  **Uphill / Downhill:**
  - ⬆️ Uphill: 1 (definición matemática de canales de animación).
  - ⬇️ Downhill: 3 steps (máquina de estados finitos, interpolador cinético lerp, tests de transición de estados).

  **DoD Task Level:**
  - [ ] 14 estados canónicos tipados e implementados en la FSM.
  - [ ] Interpolación suave entre canales sin saltos de frame.
  - [ ] Auto-recuperación a estado `idle` tras inactividad.
  - [ ] Tests de integración de la FSM en verde.

  **Iteraciones:**
  | # | Acción | Resultado | Herramienta |
  |---|--------|-----------|-------------|
  | — | — | — | — |

  **Notas:** Conecta con el sistema de atención de `COUC-06`.

---

### Task 13: CHAR-07 — Presets y `TraitRegistry` de rasgos compatibles con la criatura

- **Appetite:** max 2d
- **Esfuerzo:** 🟡 2d
- **Prioridad:** 🟡 Media
- **Archivos clave:** `apps/desktop/renderer/components/character/traits/TraitRegistry.ts`, `apps/desktop/renderer/components/character/traits/`
- **Verificación real:** ✅ CÓDIGO-REAL — No existe catálogo de rasgos morfológicos ni presets configurables para los Sub-Egos del sistema.
- **Gate Justificación:** Personalización y distinción: Cada Sub-Ego debe distinguirse visualmente de forma instantánea mediante rasgos geométricos consistentes con su función.
- **Gate Result:** ✅ DO
- **Contrato:** Registro modular de rasgos que permite consultar, validar y aplicar presets morfológicos a partir de un `CharacterProfile`.
- **Task file:** `docs/agent-ops/tasks/CHAR-07.md`
- **Estado:** ⬜ PENDING
- **Branch:** master
- **Commit:** —

  **Checklist Shape Up:**
  1. *¿Es el problema correcto?* Sí; permite que cada Sub-Ego tenga su propia variante visual sin redibujar el personaje desde cero.
  2. *¿Es correcto el appetite/scope?* Sí; 2 días para el registro y al menos 5 presets de dominio.
  3. *¿Es AHORA?* Sí; da sentido visual a la diversidad de Sub-Egos.

  **Cynefin:** 🟦 Obvio — Catálogo estructurado de funciones de modificación procedural sobre la silueta base.
  
  **Top 3 Riesgos:**
  1. *Riesgo 1 (Probabilidad):* Presets con rasgos incompatibles que rompan la geometría de la silueta base.
  2. *Riesgo 2 (Impacto):* Presets difíciles de distinguir a resoluciones pequeñas (16 px).
  3. *Riesgo 3 (Contrato):* Código acoplado difícil de extender para nuevos Sub-Egos.

  **Pre-mortem:**
  - *Fallo probable 1:* El registro permite traits contradictorios que se solapen visualmente.
  - *Fallo probable 2:* Faltan presets para los Sub-Egos por defecto de `SubEgoFactory`.
  - *Fallo probable 3:* El rendimiento se degrada al combinar múltiples traits en el mismo frame.

  **Stop conditions / Circuit breaker:**
  - *Appetite excedido:* Limitar las variantes iniciales a diferenciación cromática y pulsos de aura antes de deformaciones geométricas complejas.

  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta (mitigación) | Trigger / Due |
  |---|---|---|---|
  | 🟡×🟠 | Incompatibilidad de rasgos | Validar compatibilidad de traits en el registro antes de aplicar | En `applyTraits` |
  | 🟢×🟡 | Presets no reconocibles | Enfocar la distinción en color primario y frecuencia de aura | En diseño de presets |
  | 🟢×🟢 | Mantenibilidad | Diseñar cada trait como una función pura de modificación de contexto 2D | En arquitectura |

  **Uphill / Downhill:**
  - ⬆️ Uphill: 0 (patrón de rasgos derivado del wardrobe de Coucou adaptado).
  - ⬇️ Downhill: 3 steps (clase `TraitRegistry`, implementación de 5 presets canónicos, suite de pruebas unitarias).

  **DoD Task Level:**
  - [ ] `TraitRegistry` implementado con registro y consulta fuertemente tipados.
  - [ ] 5 presets de dominio creados (`researcher`, `code_reviewer`, `copywriter`, `analyst`, `planner`).
  - [ ] Pruebas unitarias de compatibilidad y renderizado passing.

  **Iteraciones:**
  | # | Acción | Resultado | Herramienta |
  |---|--------|-----------|-------------|
  | — | — | — | — |

  **Notas:** Basado en la adaptación técnica de `COUC-06` y `CHAR-04`.

---

### Task 14: CHAR-08 — Integración en iconos, botones, chat y selector de Sub-Egos

- **Appetite:** max 2d
- **Esfuerzo:** 🟡 2d
- **Prioridad:** 🟠 Alta
- **Archivos clave:** `apps/desktop/renderer/components/character/CharacterBadge.tsx`, `apps/desktop/renderer/components/sub-egos.tsx`, `apps/desktop/renderer/components/chat.tsx`
- **Verificación real:** ✅ CÓDIGO-REAL — Los mensajes del chat y las tarjetas de Sub-Egos utilizan avatares estáticos o iniciales de texto. No hay integración con el canvas del personaje.
- **Gate Justificación:** Cierre de la experiencia de personaje: Conecta la identidad visual en todos los puntos de contacto de la interfaz sin introducir sobrecarga gráfica.
- **Gate Result:** ✅ DO
- **Contrato:** Mini-avatares interactivos del personaje renderizados eficientemente en burbujas de chat, tarjetas del catálogo y el selector de Sub-Egos.
- **Task file:** `docs/agent-ops/tasks/CHAR-08.md`
- **Estado:** ⬜ PENDING
- **Branch:** master
- **Commit:** —

  **Checklist Shape Up:**
  1. *¿Es el problema correcto?* Sí; materializa el sistema de personajes en toda la experiencia de usuario.
  2. *¿Es correcto el appetite/scope?* Sí; 2 días para el componente wrapper y su colocación estratégica.
  3. *¿Es AHORA?* Sí; corona la integración de la identidad visual de Ego.

  **Cynefin:** 🟨 Complicado — Múltiples instancias de Canvas concurrentes en la misma vista sin colapsar el rendimiento.
  
  **Top 3 Riesgos:**
  1. *Riesgo 1 (Probabilidad):* Demasiados elementos `<canvas>` simultáneos en hilos de chat largos degradando la memoria de Chromium.
  2. *Riesgo 2 (Impacto):* Retrasos en el scroll del chat por re-renders continuos de avatares.
  3. *Riesgo 3 (Contrato):* Desajuste visual con el diseño sobrio de la interfaz.

  **Pre-mortem:**
  - *Fallo probable 1:* Cada mensaje del chat crea un canvas animado continuo consumiendo toda la GPU.
  - *Fallo probable 2:* Los avatares se ven borrosos al redimensionarse en badges de 24 px.
  - *Fallo probable 3:* El scroll del chat pierde los 60 FPS por sobrecarga de renderizado.

  **Stop conditions / Circuit breaker:**
  - *Appetite excedido:* En el historial del chat, renderizar los avatares pasados como imágenes bitmap estáticas cacheadas (`toDataURL` / canvas offscreen) y animar únicamente el avatar activo del turno actual.

  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta (mitigación) | Trigger / Due |
  |---|---|---|---|
  | 🔴×🔴 | Sobrecarga de múltiples canvas en chat | Cachear avatares de turnos anteriores como imágenes estáticas | En diseño de `CharacterBadge` |
  | 🟡×🟠 | Caída de framerate en scroll | Virtualización de mensajes o render diferido fuera de viewport | En integración con chat |
  | 🟢×🟡 | Inconsistencia de estilos | Usar contenedores con bordes sutiles y fondo neutro oscuro | En CSS |

  **Uphill / Downhill:**
  - ⬆️ Uphill: 1 (estrategia de cacheado bitmap para optimización en listas largas).
  - ⬇️ Downhill: 3 steps (componente `CharacterBadge`, integración en chat y catálogo, pruebas de rendimiento de scroll).

  **DoD Task Level:**
  - [ ] Componente `CharacterBadge` ligero con soporte para modo estático cacheado y modo interactivo.
  - [ ] Integración en mensajes de chat y selector de Sub-Egos.
  - [ ] 60 FPS estables durante el scroll de conversaciones largas.
  - [ ] Build limpio de `@ego/renderer`.

  **Iteraciones:**
  | # | Acción | Resultado | Herramienta |
  |---|--------|-----------|-------------|
  | — | — | — | — |

  **Notas:** Cumple la regla innegociable de no saturar la vista con ilustraciones pesadas.

---

### Task 15: INT-01 — Cableado del Fast-Path `ToolExecutionLoop` en `main.ts`

- **Appetite:** max 2d
- **Esfuerzo:** 🟡 1-2d
- **Prioridad:** 🔴 P0
- **Archivos clave:** `apps/desktop/src/main.ts:286`, `apps/desktop/test/ipc-tool-loop.test.ts`
- **Verificación real:** ✅ CÓDIGO-REAL — `main.ts` línea 286 salta `ToolExecutionLoop` e invoca directamente `modelRouter.streamText()`. Las herramientas nativas de `@ego/tools` y los MCPs no se ejecutan durante la interacción de chat.
- **Gate Justificación:** Carencia crítica P0.2 del diagnóstico: Conecta las herramientas, el motor de ejecución y el loop multi-turno con el fast-path conversacional de la aplicación de escritorio.
- **Gate Result:** ✅ DO
- **Contrato:** El canal IPC `ipc.llm.stream` invoca `ToolExecutionLoop.run()` con `ToolRegistry` y `ExecutionManager`, ejecutando herramientas solicitadas por el modelo y emitiendo chunks y eventos de ejecución a la UI.
- **Task file:** `docs/agent-ops/tasks/INT-01.md`
- **Estado:** ⬜ PENDING
- **Branch:** master
- **Commit:** —

  **Checklist Shape Up:**
  1. *¿Es el problema correcto?* Sí; es el eslabón perdido principal entre el Cognitive Runtime y la aplicación de escritorio.
  2. *¿Es correcto el appetite/scope?* Sí; 2 días para adaptar el handler IPC de streaming a la ejecución con herramientas.
  3. *¿Es AHORA?* Sí; sin esto Ego es solo un chatbot de texto sin capacidades de acción.

  **Cynefin:** 🟨 Complicado — Coordinación del streaming de texto token a token junto con pausas para llamadas a herramientas y aprobaciones en Electron.
  
  **Top 3 Riesgos:**
  1. *Riesgo 1 (Probabilidad):* Bloqueo o desincronización de los streams de IPC si una herramienta tarda en responder.
  2. *Riesgo 2 (Impacto):* Fallos en la reanudación del bucle conversacional tras ejecutar una herramienta multi-turno.
  3. *Riesgo 3 (Contrato):* Ruptura del contrato existente de `@assistant-ui/react` en el renderer.

  **Pre-mortem:**
  - *Fallo probable 1:* El stream envía texto de la herramienta mezclado con la respuesta final confundiendo a la UI.
  - *Fallo probable 2:* Un timeout en una herramienta no se propaga limpiamente al canal de streaming de Electron.
  - *Fallo probable 3:* El loop ejecuta herramientas desautorizadas por falta de contexto del emisor.

  **Stop conditions / Circuit breaker:**
  - *Appetite excedido:* Enviar eventos estructurados discretos (`tool-call`, `tool-result`, `text-chunk`) por canales IPC separados para no corromper el stream de texto.
  - *Rabbit hole:* Si el streaming de AI SDK v7 causa incompatibilidades con el loop multi-turno, procesar las llamadas a tools turno a turno emitiendo eventos de estado a la UI.

  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta (mitigación) | Trigger / Due |
  |---|---|---|---|
  | 🟡×🔴 | Ruptura del streaming al invocar tools | Emitir eventos IPC tipados específicos (`onToolCallStart`, `onToolCallResult`) | En integración IPC |
  | 🟡×🟠 | Re-entrada o llamadas concurrentes | Serializar peticiones por conversación con cola de ejecución | En `main.ts` |
  | 🟢×🟡 | Errores no capturados en tools | Encapsular en el `ErrorHandler` de `packages/runtime` | En ejecución |

  **Uphill / Downhill:**
  - ⬆️ Uphill: 1 (formato de eventos IPC para tool calls compatibles con el renderer).
  - ⬇️ Downhill: 4 steps (instanciación de `ToolExecutionLoop` en `main.ts`, inyección de `ToolRegistry`, cableado de eventos de streaming, suite de tests IPC).

  **DoD Task Level:**
  - [ ] `main.ts` utiliza `ToolExecutionLoop` en `ipc.llm.stream`.
  - [ ] Las herramientas locales de nivel A (`read_file`, `write_file`) son invocables por el LLM en el chat.
  - [ ] Los eventos de ejecución se emiten y visualizan sin romper el streaming de texto.
  - [ ] Suite de pruebas de integración passing.

  **Iteraciones:**
  | # | Acción | Resultado | Herramienta |
  |---|--------|-----------|-------------|
  | — | — | — | — |

  **Notas:** Resuelve el hallazgo nuclear de P0.2.

---

### Task 16: INT-02 — Conexión de Proveedores Reales y BYOK en Desktop

- **Appetite:** max 1.5d
- **Esfuerzo:** 🟢 1d
- **Prioridad:** 🔴 P0
- **Archivos clave:** `apps/desktop/src/main.ts:50`, `packages/models/src/ModelRouter.ts`, `packages/models/src/providers/`
- **Verificación real:** ✅ CÓDIGO-REAL — `main.ts` inicializa `new ModelRouter()` que solo tiene `MockProvider`. Las clases de OpenAI/Anthropic existen en `@ego/models` pero no se registran ni leen variables de entorno o almacén seguro en Electron main.
- **Gate Justificación:** Carencia crítica P0.2 del diagnóstico: Ego debe operar con modelos reales de frontera para ejecutar razonamiento y tareas del mundo real.
- **Gate Result:** ✅ DO
- **Contrato:** `ModelRouter` en Electron main detecta y registra proveedores reales basados en variables de entorno (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) y configuración local persistente, permitiendo inferencia real.
- **Task file:** `docs/agent-ops/tasks/INT-02.md`
- **Estado:** ⬜ PENDING
- **Branch:** master
- **Commit:** —

  **Checklist Shape Up:**
  1. *¿Es el problema correcto?* Sí; elimina la dependencia del mock y permite al usuario usar sus propias claves API (BYOK).
  2. *¿Es correcto el appetite/scope?* Sí; 1.5 días para registrar los proveedores en `main.ts` y permitir inyección de claves.
  3. *¿Es AHORA?* Sí; indispensable para probar el bucle con inteligencia real.

  **Cynefin:** 🟦 Obvio — Registro de adaptadores existentes con credenciales del entorno y configuración.
  
  **Top 3 Riesgos:**
  1. *Riesgo 1 (Probabilidad):* Filtración o exposición de claves de API en logs o hacia el renderer process.
  2. *Riesgo 2 (Impacto):* Fallo al arrancar si ninguna clave está configurada (debe mantener fallback a `MockProvider` o aviso claro).
  3. *Riesgo 3 (Contrato):* Incompatibilidad de versión en las librerías de cliente de AI SDK v7.

  **Pre-mortem:**
  - *Fallo probable 1:* El usuario no tiene claves configuradas y la app lanza una excepción no controlada en vez de ofrecer guía de configuración.
  - *Fallo probable 2:* Las claves se envían inadvertidamente al renderer por un evento de depuración.
  - *Fallo probable 3:* El router intenta llamar a un proveedor no disponible sin aplicar fallback automático.

  **Stop conditions / Circuit breaker:**
  - *Appetite excedido:* Si el gestor de credenciales de Keychain del SO requiere mucho tiempo, usar variables de entorno de Node en main process como primer paso seguro.

  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta (mitigación) | Trigger / Due |
  |---|---|---|---|
  | 🟡×🔴 | Exposición de claves al renderer | Almacenar y resolver claves estrictamente en Main Process (Principio §6) | En inicialización |
  | 🟡×🟠 | Ausencia de claves en primer inicio | Fallback limpio a `MockProvider` con notificación instructiva en UI | Al instanciar router |
  | 🟢×🟡 | Errores de cuota/saldo en API | Capturar excepciones de proveedor y devolver mensaje inteligible | En inferencia |

  **Uphill / Downhill:**
  - ⬆️ Uphill: 0 (patrón BYOK y adaptadores de modelos ya implementados en `@ego/models`).
  - ⬇️ Downhill: 3 steps (registro de proveedores en `main.ts`, lectura segura de entorno/configuración, pruebas de conexión).

  **DoD Task Level:**
  - [ ] `ModelRouter` en Electron Main registra proveedores reales OpenAI, Anthropic y Ollama.
  - [ ] Fallback a `MockProvider` si no hay claves disponibles sin quebrar la app.
  - [ ] Secretos nunca expuestos al renderer process ni persistidos en VantaDB.
  - [ ] Pruebas unitarias de registro en verde.

  **Iteraciones:**
  | # | Acción | Resultado | Herramienta |
  |---|--------|-----------|-------------|
  | — | — | — | — |

  **Notas:** Resuelve el segundo gran bloqueo de P0.2.

---

### Task 17: INT-03 — Entidad `Project` y Aislamiento de Contexto Dinámico en UI

- **Appetite:** max 2d
- **Esfuerzo:** 🟡 1-2d
- **Prioridad:** 🔴 P0
- **Archivos clave:** `apps/desktop/renderer/components/sidebar.tsx`, `packages/memory/src/ProjectMemory.ts`, `apps/desktop/src/main.ts`
- **Verificación real:** ✅ CÓDIGO-REAL — `sidebar.tsx` utiliza proyectos mockeados estáticos. No existe la entidad `ProjectManifest` persistida en VantaDB bajo `projects/<id>/*` ni la conmutación dinámica de conversaciones por proyecto.
- **Gate Justificación:** Carencia estratégica P0.1 del diagnóstico: Ego debe operar sobre proyectos reales (ej. carpetas locales de código) y mantener contexto, decisiones y scratchpads aislados por proyecto.
- **Gate Result:** ✅ DO
- **Contrato:** El sidebar permite crear/seleccionar proyectos reales persistidos en VantaDB, vinculando un directorio local y conmutando automáticamente el contexto del chat y la memoria.
- **Task file:** `docs/agent-ops/tasks/INT-03.md`
- **Estado:** ⬜ PENDING
- **Branch:** master
- **Commit:** —

  **Checklist Shape Up:**
  1. *¿Es el problema correcto?* Sí; materializa el Principio Innegociable §2 (Project Memory) como base operativa del producto.
  2. *¿Es correcto el appetite/scope?* Sí; 2 días para la entidad de proyecto en VantaDB y la vinculación reactiva en el sidebar.
  3. *¿Es AHORA?* Sí; es el paso 1 del Golden Path del MVP.

  **Cynefin:** 🟨 Complicado — Conmutación de contexto multi-proyecto en UI y aislamiento de namespaces en VantaDB.
  
  **Top 3 Riesgos:**
  1. *Riesgo 1 (Probabilidad):* Mezcla de historial de chat o archivos temporales entre dos proyectos al conmutar rápidamente.
  2. *Riesgo 2 (Impacto):* Selección de carpetas protegidas del sistema operativo como directorio de proyecto (ej. `C:\Windows`).
  3. *Riesgo 3 (Contrato):* Desincronización del estado del sidebar al reiniciar Electron.

  **Pre-mortem:**
  - *Fallo probable 1:* El usuario cambia de proyecto y el chat sigue enviando el ID del proyecto anterior.
  - *Fallo probable 2:* La persistencia del proyecto en VantaDB no guarda la ruta absoluta del repositorio.
  - *Fallo probable 3:* El diálogo nativo de selección de carpetas de Electron bloquea el renderer.

  **Stop conditions / Circuit breaker:**
  - *Appetite excedido:* Limitar el selector de carpetas a diálogo nativo de Electron (`dialog.showOpenDialog`) antes de crear exploradores de archivos complejos.

  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta (mitigación) | Trigger / Due |
  |---|---|---|---|
  | 🟡×🔴 | Polución de contexto entre proyectos | Limpiar el estado activo del chat y recargar memoria al cambiar de proyecto | En conmutador |
  | 🟡×🟠 | Rutas no válidas o inexistentes | Validar existencia del directorio en el FS antes de persistir proyecto | Al crear proyecto |
  | 🟢×🟡 | Persistencia de último proyecto | Guardar `activeProjectId` en `gov/settings` para restaurar al abrir | Al cambiar activo |

  **Uphill / Downhill:**
  - ⬆️ Uphill: 1 (diseño del schema `ProjectManifest` y ciclo de vida de conmutación).
  - ⬇️ Downhill: 4 steps (esquema Zod de proyecto, canales IPC de proyectos en `main.ts`, reactividad en `sidebar.tsx`, suite de pruebas).

  **DoD Task Level:**
  - [ ] Esquema `ProjectManifest` validado y persistido en `projects/<id>/manifest`.
  - [ ] `sidebar.tsx` lista proyectos reales y permite crear nuevos vinculando una carpeta local.
  - [ ] Al seleccionar un proyecto, las conversaciones y scratchpads se cargan desde su namespace.
  - [ ] Pruebas unitarias de aislamiento passing.

  **Iteraciones:**
  | # | Acción | Resultado | Herramienta |
  |---|--------|-----------|-------------|
  | — | — | — | — |

  **Notas:** Habilita el Paso 1 y Paso 2 de la Guía Canónica del MVP (`guia-mvp.md`).

---

### Task 18: INT-04 — Integración UI de Sub-Egos (`SubEgosView` ↔ Fábrica y Runtime)

- **Appetite:** max 2d
- **Esfuerzo:** 🟡 1-2d
- **Prioridad:** 🟠 Alta
- **Archivos clave:** `apps/desktop/renderer/components/sub-egos.tsx`, `apps/desktop/src/preload.ts`, `apps/desktop/src/main.ts`
- **Verificación real:** ✅ CÓDIGO-REAL — `sub-egos.tsx` muestra datos mockeados y botones sin acción. `SubEgoFactory` y `SubEgoRuntime` existen en `@ego/subegos` pero no están expuestos en el puente IPC ni conectados al panel de control de Sub-Egos en la UI.
- **Gate Justificación:** Carencia P0.2 del diagnóstico: El usuario debe poder inspeccionar, instanciar y configurar Sub-Egos directamente desde la interfaz gráfica de escritorio.
- **Gate Result:** ✅ DO
- **Contrato:** La vista `sub-egos.tsx` en Electron lista los Sub-Egos reales de `SubEgoRegistry`, permite crear nuevos especialistas usando las plantillas de `SubEgoFactory` y refleja el estado de ejecución de `SubEgoRuntime`.
- **Task file:** `docs/agent-ops/tasks/INT-04.md`
- **Estado:** ⬜ PENDING
- **Branch:** master
- **Commit:** —

  **Checklist Shape Up:**
  1. *¿Es el problema correcto?* Sí; convierte el catálogo y la fábrica de Sub-Egos en una herramienta visual utilizable.
  2. *¿Es correcto el appetite/scope?* Sí; 2 días para conectar los métodos IPC y el estado reactivo en React.
  3. *¿Es AHORA?* Sí; desbloquea la interacción del usuario con especialistas.

  **Cynefin:** 🟨 Complicado — Conexión bidireccional segura vía Preload IPC tipado entre React y `@ego/subegos`.
  
  **Top 3 Riesgos:**
  1. *Riesgo 1 (Probabilidad):* Violación de guardrails de seguridad si el preload expone métodos sin tipado ni sanitización.
  2. *Riesgo 2 (Impacto):* Fallo en la UI si un Sub-Ego tiene un manifiesto con campos opcionales no contemplados en los componentes.
  3. *Riesgo 3 (Contrato):* Pérdida de reactividad si el estado en Main process cambia y el Renderer no se entera.

  **Pre-mortem:**
  - *Fallo probable 1:* El usuario crea un Sub-Ego y la lista no se actualiza hasta que reinicia la aplicación.
  - *Fallo probable 2:* La validación Zod falla en Main pero el error no se muestra de forma legible en el modal de creación.
  - *Fallo probable 3:* El preload expone instancias crudas de Node en lugar de objetos JSON serializados.

  **Stop conditions / Circuit breaker:**
  - *Appetite excedido:* Implementar primero la creación por plantillas predefinidas antes del editor libre de JSON/YAML en UI.

  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta (mitigación) | Trigger / Due |
  |---|---|---|---|
  | 🟡×🔴 | Exposición insegura en Preload | Mantener `contextIsolation=true`, pasando solo DTOs serializados | En `preload.ts` |
  | 🟡×🟠 | Errores de validación mudos | Propagar mensajes de error de Zod estructurados a la UI | En IPC handlers |
  | 🟢×🟡 | Desincronización de lista | Emitir evento IPC `ego:subegos:changed` tras cada mutación | Tras registrar |

  **Uphill / Downhill:**
  - ⬆️ Uphill: 0 (contratos de `SubEgoFactory` y `SubEgoRegistry` ya cerrados).
  - ⬇️ Downhill: 4 steps (canales IPC en `main.ts`, métodos expuestos en `preload.ts`, componentes en `sub-egos.tsx`, tests).

  **DoD Task Level:**
  - [ ] Métodos IPC tipados para listar, crear (plantillas) y consultar Sub-Egos.
  - [ ] `sub-egos.tsx` consume datos reales sin rastro de mocks.
  - [ ] Creación de Sub-Egos funcional desde la interfaz gráfica.
  - [ ] Build limpio de desktop y renderer.

  **Iteraciones:**
  | # | Acción | Resultado | Herramienta |
  |---|--------|-----------|-------------|
  | — | — | — | — |

  **Notas:** Cumple el hito de visualización de `ACT-04` y `SUB-02`.

---

### Task 19: INT-05 — Tarjetas de Aprobación HITL Interactivas en el Chat

- **Appetite:** max 1.5d
- **Esfuerzo:** 🟢 1d
- **Prioridad:** 🔴 P0
- **Archivos clave:** `apps/desktop/renderer/components/ActionApprovalCard.tsx`, `apps/desktop/renderer/components/chat.tsx`, `apps/desktop/src/main.ts`
- **Verificación real:** ✅ CÓDIGO-REAL — `ApprovalEngine` y el canal IPC de aprobación existen en el backend (`ACT-06`), pero la UI del chat no renderiza una tarjeta interactiva ante `ipc.approval.request` para que el usuario pueda hacer clic en "Aprobar" o "Rechazar" y resolver la promesa vía `ipc.approval.resolve`.
- **Gate Justificación:** Principio Innegociable §6 (Gobernanza): Acciones sensibles (escritura de archivos, ejecución de comandos) exigen confirmación humana interactiva clara antes de ejecutarse.
- **Gate Result:** ✅ DO
- **Contrato:** Cuando una herramienta sensible solicita autorización, aparece una tarjeta interactiva en el chat con detalles de la acción y botones "Aprobar" / "Rechazar", desbloqueando o abortando la ejecución en vivo.
- **Task file:** `docs/agent-ops/tasks/INT-05.md`
- **Estado:** ⬜ PENDING
- **Branch:** master
- **Commit:** —

  **Checklist Shape Up:**
  1. *¿Es el problema correcto?* Sí; cierra la brecha de interacción humana en el bucle (Human-in-the-Loop).
  2. *¿Es correcto el appetite/scope?* Sí; 1.5 días para el componente visual y la resolución de la promesa IPC.
  3. *¿Es AHORA?* Sí; es indispensable para ejecutar herramientas de escritura con seguridad.

  **Cynefin:** 🟦 Obvio — Componente de UI que escucha un evento IPC, presenta los datos y envía la respuesta booleana.
  
  **Top 3 Riesgos:**
  1. *Riesgo 1 (Probabilidad):* Timeout de aprobación que se active mientras el usuario todavía está leyendo los detalles.
  2. *Riesgo 2 (Impacto):* Renderizar detalles ambiguos que no permitan entender qué archivo se va a modificar.
  3. *Riesgo 3 (Contrato):* Botón de aprobación presionado dos veces provocando errores de resolución en el backend.

  **Pre-mortem:**
  - *Fallo probable 1:* El usuario recarga la app mientras hay una solicitud pendiente y la promesa queda colgada en main.
  - *Fallo probable 2:* Los diffs o parámetros de la herramienta son demasiado grandes y desbordan la tarjeta visual.
  - *Fallo probable 3:* El evento de resolución no llega al `ApprovalEngine` correcto por desajuste de `actionId`.

  **Stop conditions / Circuit breaker:**
  - *Appetite excedido:* Mostrar vista previa en texto plano de los parámetros antes de implementar visores complejos de diffs lado a lado.

  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta (mitigación) | Trigger / Due |
  |---|---|---|---|
  | 🟡×🟠 | Timeout mientras el usuario decide | Configurar timeout generoso (ej. 120s) con cuenta regresiva visible | En componente |
  | 🟢×🔴 | Desajuste de `actionId` | Pasar el SHA-256 inmutable de `ActionIdentity` en cada evento | En IPC dispatch |
  | 🟢×🟡 | Doble clic en Aprobar | Deshabilitar botones inmediatamente tras el primer clic | En handler de React |

  **Uphill / Downhill:**
  - ⬆️ Uphill: 0 (contrato de aprobación ya especificado en `ApprovalEngine.ts`).
  - ⬇️ Downhill: 3 steps (componente `ActionApprovalCard.tsx`, integración en hilo de chat, pruebas interactivas).

  **DoD Task Level:**
  - [ ] Componente `ActionApprovalCard` muestra emisor, herramienta, parámetros y riesgo.
  - [ ] Botones "Aprobar" y "Rechazar" resuelven la solicitud en Electron Main en tiempo real.
  - [ ] La tarjeta refleja el resultado (Aprobada / Rechazada / Expirada).
  - [ ] Tests de integración passing.

  **Iteraciones:**
  | # | Acción | Resultado | Herramienta |
  |---|--------|-----------|-------------|
  | — | — | — | — |

  **Notas:** Cumple la compuerta canónica `COUC-04` (HITL con ACK interactivo).

---

### Task 20: INT-06 — Validación E2E del Bucle Completo de MVP (Software Engineering)

- **Appetite:** max 2d
- **Esfuerzo:** 🟡 2d
- **Prioridad:** 🔴 P0
- **Archivos clave:** `tests/e2e/mvp-software-loop.test.ts`, `docs/product/guia-mvp.md`
- **Verificación real:** ✅ CÓDIGO-REAL — No existe una prueba de integración E2E que ejecute los 6 pasos del Golden Path canónico del MVP definidos en `guia-mvp.md`.
- **Gate Justificación:** Criterio de Finalización Canónico del MVP: Demostración empírica de que Ego funciona como un producto completo de punta a punta en su caso de uso ancla.
- **Gate Result:** ✅ DO
- **Contrato:** `pnpm test` ejecuta `tests/e2e/mvp-software-loop.test.ts` con exit code 0 validando: Creación de proyecto -> Inferencia con modelo -> Delegación a Sub-Ego -> Tool con HITL -> Persistencia en VantaDB -> Reapertura intacta.
- **Task file:** `docs/agent-ops/tasks/INT-06.md`
- **Estado:** ⬜ PENDING
- **Branch:** master
- **Commit:** —

  **Checklist Shape Up:**
  1. *¿Es el problema correcto?* Sí; es la prueba de fuego de que las piezas desconectadas forman ahora un producto armónico y confiable.
  2. *¿Es correcto el appetite/scope?* Sí; 2 días para la suite de integración automatizada del bucle completo.
  3. *¿Es AHORA?* Sí; cierra la Fase 03.1 y valida la propuesta de valor del MVP.

  **Cynefin:** 🟨 Complicado — Coordinación determinista de todo el stack (Electron main, VantaDB, modelos, runtime, Sub-Egos, herramientas y persistencia).
  
  **Top 3 Riesgos:**
  1. *Riesgo 1 (Probabilidad):* Tiempos de ejecución excesivos de la suite de pruebas.
  2. *Riesgo 2 (Impacto):* Falsos positivos si la prueba no valida la lectura real del disco tras el reinicio simulado.
  3. *Riesgo 3 (Contrato):* Fragilidad ante variaciones de latencia en entornos Windows.

  **Pre-mortem:**
  - *Fallo probable 1:* La prueba pasa en memoria pero falla al intentar leer el archivo generado en el filesystem real.
  - *Fallo probable 2:* El ciclo de aprobación HITL en el test genera una promesa colgada que agota el timeout de Vitest.
  - *Fallo probable 3:* El estado del proyecto no se restaura con exactitud tras reiniciar el adaptador de memoria.

  **Stop conditions / Circuit breaker:**
  - *Appetite excedido:* Estructurar la prueba con pasos modulares desacoplados verificando asertos intermedios para identificar inmediatamente cualquier fallo.

  **Risk Register:**
  | Prob×Impacto | Riesgo | Respuesta (mitigación) | Trigger / Due |
  |---|---|---|---|
  | 🟡×🔴 | Contención de base de datos en test | Cerrar y reabrir explícitamente `NativeVantaDB` con espera de flushing | En fase de reinicio |
  | 🟡×🟠 | Timeouts en Vitest | Configurar timeout de suite a 30s para permitir todo el ciclo cerrado | En config de test |
  | 🟢×🟡 | Polución del disco local | Ejecutar todo el test dentro de carpeta efímera `tmp/mvp-e2e-<uuid>` | En `beforeAll`/`afterAll` |

  **Uphill / Downhill:**
  - ⬆️ Uphill: 0 (los 6 pasos del Golden Path están formalizados y cerrados en `guia-mvp.md`).
  - ⬇️ Downhill: 4 steps (setup del fixture de proyecto, ejecución del flujo conversacional con tool, simulación de reinicio de la app, asertos de persistencia).

  **DoD Task Level:**
  - [ ] Suite E2E `mvp-software-loop.test.ts` implementada y pasando al 100%.
  - [ ] Los 6 pasos del Golden Path de `guia-mvp.md` verificados con éxito.
  - [ ] Persistencia y reanudación comprobadas tras simulación de reinicio de Ego.
  - [ ] 0 regresiones en todo el monorepo.

  **Iteraciones:**
  | # | Acción | Resultado | Herramienta |
  |---|--------|-----------|-------------|
  | — | — | — | — |

  **Notas:** Certifica el cumplimiento de los 7 criterios de Definition of Done del MVP.

---

## Próximo Paso Recomendado

Para ejecutar este plan de campaña mediante el pipeline formal:

```powershell
/pipeline run -PlanFile docs/agent-ops/plans/2026-10-09-plan-20-tareas-mvp.md
```
