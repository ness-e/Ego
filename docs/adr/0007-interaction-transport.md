# ADR 0007: InteractionTransport — admisión HITL con timeout que nunca bloquea #

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-16 |
| Estado | Aceptado |
| Nivel jerárquico | 4.Architecture (`docs/jerarquia-canonica.md`) |

## Contexto ##

El patrón isla/fsm + bridge de coucou publica interacciones y espera admisión
del usuario. Portar el bridge con sockets WS internos violaría la arquitectura
Ego (EventBus + IPC tipado, sin WS internos — descarte justificado STAB-14).
Compuerta Opción B STAB-14: ADAPTAR solo la semántica submit/resolve/cancel +
`admit()` con timeout corto.

## Decisión ##

`packages/events/src/InteractionTransport.ts`:

- `submit(id)` idempotente (duplicado no asentado → retorna el pendiente).
- `resolve(id, approved|denied)` / `cancel(id, reason)` asientan una vez;
  segunda llamada retorna `false`.
- `admit(id, {timeoutMs=250})` retorna `Promise<boolean>` que NUNCA rechaza:
  `true` solo si se aprobó antes del timeout; `false` en timeout, cancel,
  denegación o id desconocido (fallback sin bloqueo: el caller aplica su
  política fail-closed sin colgar el loop).
- Waiters huérfanos se podan al disparar el timeout (sin leaks por admit
  expirados); `get/pendingCount` para diagnóstico.

## Consecuencias ##

- Positivas: el loop nunca se cuelga esperando UI; 5 tests
  (`InteractionTransport.test.ts`), suite events 38/38.
- Negativas: timeout default 250ms es opinión local (no viene de referencia);
  cada caller debe elegir su `timeoutMs` según criticidad.
- Riesgos: `false` por timeout es indistinguible de denegación para el caller
  que no inspeccione `get(id)` — documentado en el contrato del método.

## Referencias ##

- `packages/events/src/InteractionTransport.ts`, `packages/events/test/InteractionTransport.test.ts`.
- `docs/agent-ops/tasks/archive/STAB-14.md` (Spec SDD).
