# ADR 0009: ChangeSet payloadRef — trazabilidad sin duplicar contenido #

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-16 |
| Estado | Aceptado |
| Nivel jerárquico | 10.Implementation (`docs/jerarquia-canonica.md`) |

## Contexto ##

`ChangeSetService` (`packages/tools/src/native/git/ChangeSetService.ts`,
COUC-07) agrupa diffs in-memory pero no ata el changeset a su artefacto
destino ni ofrece referencia opaca para carga bajo demanda. El contrato
STAB-14 pedía `artifactId/hunks/payloadRef + ActivityItem.payloadRef`.
Compuerta Opción B: ADAPTAR-delta (no rewrite).

## Decisión ##

- `ChangeSet{artifactId?, payloadRef?}` opcionales (backward compatible:
  `createChangeSet` existente no los emite).
- `ChangeSetService.buildPayloadRef(content)`: `sha256:<12hex>` SHA-256 real
  (`node:crypto`), estable ante CRLF.
- `ChangeSetService.withPayloadRef(cs, artifactId?)`: adjunta trazabilidad de
  forma inmutable (retorna copia); sin `artifactId` no hay `payloadRef`.
- `ActivityItem.payloadRef` NO se crea: no existe ningún `ActivityItem` en el
  codebase (verificado por grep) y crear superficie nueva por especulación
  viola ponytail; el `payloadRef` vive en el `ChangeSet`, listo para que el
  futuro `ActivityItem` lo referencie.

## Consecuencias ##

- Positivas: cero rotura de callers; 4 tests (`ChangeSetPayloadRef.test.ts`),
  suite tools 64/64.
- Negativas: `payloadRef` de 12 hex no es direccionable en store (es digest,
  no puntero) — suficiente para dedup/caché, no para fetch.
- Riesgos: ninguno de regresión (aditivo puro).

## Referencias ##

- `packages/tools/src/native/git/ChangeSetService.ts` (delta STAB-14).
- `packages/tools/test/ChangeSetPayloadRef.test.ts`.
- `docs/agent-ops/tasks/archive/STAB-14.md` (Spec SDD).
