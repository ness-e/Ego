# ADR 0017: `ContextCompaction` con resumidor LLM inyectable y fallback heurístico #

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-19 |
| Estado | Aceptado |
| Nivel jerárquico | 4.Architecture (`docs/jerarquia-canonica.md`) |

## Contexto ##

El historial de turnos de una sesión crece sin cota: `main.ts` lo archiva en
`kb/history_archive` pero nunca lo compacta ni lo resume. El prompt del turno
lo monta `PromptAssembly` (ADR-0005) sobre ese historial, de modo que un
proyecto con semanas de uso produce prompts desproporcionados, sin ventana de
contexto y con coste de inferencia creciente.

La compactación necesita resumir. Resumir necesita un modelo, y acoplar el
módulo de compactación a un proveedor concreto lo haría imposible de probar
en modo determinista y dependiente de red.

El commit `86c4f80`
("feat(runtime): add injectable LLM summarizer with heuristics fallback and
tool-pair preservation to ContextCompaction") introduce el diseño actual.

## Decisión ##

`packages/runtime/src/ContextCompaction.ts` define un **resumidor inyectable**
con *fallback* heurístico determinista.

- Contrato: `SummarizerFn` (alias retrocompatible `ContextSummarizer`) —
  `(input, signal) => Promise<string>`.
- Si se inyecta un `summarizer`, `ContextCompactionJob` lo invoca con el
  `DEFAULT_SUMMARIZER_SYSTEM_PROMPT` (o uno propio vía
  `summarizerSystemPrompt`) y respeta `summarizerTimeoutMs` (15 000 ms por
  defecto).
- Si **no** se inyecta ninguno, el módulo usa un **resumidor heurístico
  determinista**: sin red, sin coste y reproducible en tests.
- La compactación **preserva los pares tool-call/tool-result**: un turno con
  herramienta no puede resumirse dejando la llamada huérfana de su resultado.
- La salida se archiva en el namespace de historial
  (`kb/history_archive`) con registro `CompactionArchiveRecord`.

## Alternativas consideradas ##

- **Acoplar el compactador a un proveedor concreto (descartada):** ataría el
  módulo a un SDK y haría la compactación imposible de probar sin red.
- **Truncar por tokens sin resumir (descartada):** pierde el hilo del
  proyecto; el principio 2 (Project Memory) exige conservar el estado, no solo
  la última ventana.
- **Resumir siempre con LLM (descartada):** depende de red y de cuota en cada
  compaction; no es determinista.
- **Resumidor inyectable + fallback heurístico (elegida):** el producto usa
  el LLM (mejor calidad) y los tests usan el heurístico (determinismo).

## Consecuencias ##

- Positivas: el módulo es testeable sin red; el coste de compactación es
  controlable; la degradación ante fallo del LLM es explícita y no silenciosa.
- Negativas: el resumen heurístico pierde detalle semántico; el prompt de
  sistema por defecto (`DEFAULT_SUMMARIZER_SYSTEM_PROMPT`) es una constante
  que puede desalinearse del estilo de Ego.
- Deuda asumida: **`ContextCompactionJob` no está instanciado en producción**
  (0 instanciaciones en `src/`): `main.ts` solo archiva el historial sin
  compactar. `compactSync()` además ignora `opts.summarizer` y `autoMemory`
  está declarado pero no implementado. Registrado como `EGO-FIND-21`
  (crítico) en `docs/roadmap/Backlog.md` (A2).
- Riesgo: mientras el módulo no se cablee, el crecimiento del historial sigue
  sin cota; la compactación no aporta nada por sí sola.

## Referencias ##

- `packages/runtime/src/ContextCompaction.ts`
- `docs/roadmap/Backlog.md` (`EGO-FIND-21`)
- `docs/adr/0005-promptassembly-turno.md` (ensamblado del prompt por capas)
- `packages/subegos/src/PromptAssembly.ts`
