# ADR 0006: ApprovalIdentity — sellado de decisiones HITL por contexto #

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-16 |
| Estado | Aceptado |
| Nivel jerárquico | 4.Architecture (`docs/jerarquia-canonica.md`) |

## Contexto ##

El patrón `admitted-run-context` de openclaw liga una admisión a su contexto
de ejecución. En Ego, `approval.required/resolved` (`packages/events/src/types.ts`)
correlacionaban por `approvalId` sin atar run/tarea/sub-ego/tool/input: una
decisión aprobada podía —por bug, no por diseño— aplicarse a otro tool o con
otro payload. Compuerta Opción B STAB-14: ADAPTAR (reimplementación TS, nunca
copia de referencia).

## Decisión ##

`packages/events/src/ApprovalIdentity.ts` (junto a `EventNormalizer`/hooks STAB-12):

- `buildApprovalIdentity({runId, taskId, subEgoId, toolId, input})` sella
  `inputDigest = sha256(canonicalJson(input))` (claves ordenadas, determinista).
- `assertSameApproval(expected, actual)` fail-closed: lanza
  `ApprovalIdentityMismatchError(field)` ante la primera divergencia en
  `runId/taskId/subEgoId/toolId/inputDigest` (decisión cruzada rechazada).
- `isSameApproval` variante booleana para filtros no críticos.
- Ubicación `events` (no `security`, Gate D-1): es identidad de correlación,
  no secreto; los tipos approval ya viven en events.

## Consecuencias ##

- Positivas: reutilización cruzada de aprobaciones imposible por construcción;
  digest canónico estable entre serializaciones; 5 tests
  (`ApprovalIdentity.test.ts`), suite events 38/38.
- Negativas: inputs no-JSON-canónicos exóticos (BigInt, undefined en arrays)
  sellan por `JSON.stringify` con caída a `"null"` — documentado, no throw.
- Riesgos: adoptantes futuros deben llamar `assertSameApproval` en el punto
  de aplicación (ApprovalEngine/loop); el sellado solo no ejecuta nada.

## Referencias ##

- `packages/events/src/ApprovalIdentity.ts`, `packages/events/test/ApprovalIdentity.test.ts`.
- `packages/events/src/types.ts:121-122` (approval.required/resolved).
- `docs/agent-ops/tasks/archive/STAB-14.md` (Spec SDD, Gate D-1).
