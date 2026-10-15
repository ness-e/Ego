# ADR 0008: WorkerPolicy — policy pura sobre pool cooperativo (sin threads) #

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-16 |
| Estado | Aceptado |
| Nivel jerárquico | 4.Architecture (`docs/jerarquia-canonica.md`) |

## Contexto ##

El patrón worker-pool (helmor/openclaw) exige prioridad, presupuesto, backoff
y salud. En Ego, `LocalTaskPool` (`packages/tasks/src/WorkerTaskPool.ts`) es
cooperativo en el hilo principal por diseño documentado (F4T8 H11): los
handlers son clausuras arbitrarias no transferibles entre hilos, de modo que
migrar a `worker_threads` reales rompería la API y excede el appetite.
Compuerta Opción B STAB-14: ADAPTAR como capa de política, no como threads.

## Decisión ##

`packages/tasks/src/WorkerPolicy.ts` (policy pura, sin I/O, sin importar el pool):

- `shouldAdmit(queued, active)`: budget `maxQueue/maxConcurrent` (negativos → `false`).
- `sortByPriority`: prioridad desc, desempate `createdAt` asc (misma disciplina
  que `AttentionStateMachine.sortQueue`).
- `nextDelay(attempt)`: backoff `min(base*2^attempt, cap)`, determinista.
- `recordSuccess/recordFailure/isHealthy`: degradado tras
  `maxConsecutiveFailures`, recupera con 1 éxito.
- Gate D-3: threads reales explícitamente rechazados (evidencia F4T8 H11).

## Consecuencias ##

- Positivas: backoff/salud testeables sin timers ni hilos; 4 tests,
  suite tasks 63/63 sin regresión.
- Negativas: cómputo CPU-intensivo síncrono sigue bloqueando el hilo igual
  que sin pool (limitación heredada y documentada del pool).
- Riesgos: la policy no se auto-aplica — el dispatcher futuro debe llamarla
  antes de `LocalTaskPool.execute`; wiring pendiente como follow-up.

## Referencias ##

- `packages/tasks/src/WorkerPolicy.ts`, `packages/tasks/test/WorkerPolicy.test.ts`.
- `packages/tasks/src/WorkerTaskPool.ts:43-60` (alcance cooperativo F4T8 H11).
- `docs/agent-ops/tasks/STAB-14.md` (Spec SDD, Gate D-3).
