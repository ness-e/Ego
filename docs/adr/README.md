# ADRs — decisiones de arquitectura de Ego

| Campo | Valor |
|---|---|
| Estado | Activo — índice de las decisiones de arquitectura |
| Owner | ness-e |
| Fecha | 2026-10-20 |
| Convención | `NNNN-titulo.md`, numeración **sin colisiones**, plantilla común |

> **Qué es un ADR.** Registra **por qué** se tomó una decisión, no qué se
> construyó: el contexto, la decisión, las alternativas descartadas y las
> consecuencias. El código muestra el *qué*; el ADR explica el *por qué*, qué
> alternativas se consideraron y qué trade-offs se aceptaron.
>
> **Cuándo escribir uno.** Elegir framework o dependencia mayor · cambiar un
> modelo de datos o un esquema · decidir un mecanismo de seguridad · cualquier
> decisión costosa de revertir.
>
> **Ciclo de vida.** `PROPOSED → ACCEPTED → (SUPERSEDED | DEPRECATED)`. Un ADR
> aceptado **no se edita** para cambiar la decisión: se escribe uno nuevo que
> lo referencia. Los ADRs **no se borran**: son contexto histórico.
> Plantilla y reglas: `.agents/references/definition-of-done.md` (raíz del repo)
> y la skill `documentation-and-adrs`.

## Índice por estado

| Estado | ADRs |
|---|---|
| Aceptado | 0002, 0003, 0004, 0005, 0006, 0007, 0008, 0009, 0010, 0011, 0012, 0013, 0014, 0015, 0016, 0017, 0019 |
| Aceptado (parcial) | 0018 (la consolidación física de `CharacterEngine` queda pendiente) · 0020 (el motor nativo queda condicionado a una puerta de invariantes) |
| Superseded | 0001 (`electron-vite` 5.x lo sustituye) |

## Las decisiones

| # | Decisión | Fecha | Nivel |
|---|---|---|---|
| [0001](0001-electron-vite.md) | Electron + Vite como shell desktop | 2026-10-15 | 10 · Implementation · **Superseded por T11** |
| [0002](0002-vantadb-primero.md) | VantaDB primero (memoria local embebida) | 2026-10-15 | 4 · Architecture |
| [0003](0003-renderer-tonto.md) | Renderer tonto (solo presentación) | 2026-10-15 | 4 · Architecture |
| [0004](0004-dark-only.md) | Dark-only (sin tema claro) | 2026-10-15 | 5 · Experience Design |
| [0005](0005-promptassembly-turno.md) | System prompt en 3 tiers (PromptAssembly) | 2026-10-16 | 4 · Architecture |
| [0006](0006-approval-identity.md) | ApprovalIdentity: sellado de decisiones HITL por contexto | 2026-10-16 | 4 · Architecture |
| [0007](0007-interaction-transport.md) | InteractionTransport: admisión HITL con timeout | 2026-10-16 | 4 · Architecture |
| [0008](0008-worker-policy.md) | WorkerPolicy: policy pura sobre pool cooperativo | 2026-10-16 | 4 · Architecture |
| [0009](0009-changeset-payloadref.md) | ChangeSet `payloadRef` sin duplicar contenido | 2026-10-16 | 10 · Implementation |
| [0010](0010-netpolicy-security.md) | Frontera SSRF en `@ego/security` | 2026-10-16 | 4 · Architecture |
| [0011](0011-stab14-asimilados-descartes.md) | STAB-14: mapa canónico asimilados/descartes | 2026-10-16 | 4 · Architecture |
| [0012](0012-docs-site.md) | VitePress como generador canónico del sitio | 2026-10-16 | 10 · Implementation |
| [0013](0013-codemirror6-en-canvas.md) | CodeMirror 6 en el editor del Canvas | 2026-10-19 | 10 · Implementation |
| [0014](0014-virtualizacion-chat-virtua.md) | Virtualización del chat con `virtua` | 2026-10-19 | 10 · Implementation |
| [0015](0015-radix-select-accesible.md) | `Select` del `ui-kit` sobre Radix | 2026-10-19 | 10 · Implementation |
| [0016](0016-shiki-web-worker.md) | Resaltado Shiki en Web Worker | 2026-10-19 | 10 · Implementation |
| [0017](0017-context-compaction-llm-inyectable.md) | Compactación con resumidor inyectable | 2026-10-19 | 4 · Architecture |
| [0018](0018-motor-de-personaje.md) | `@ego/avatar` es el motor de personaje | 2026-10-19 | 4 · Architecture |
| [0019](0019-canal-dual-taint-tracking.md) | Canal dual (P-LLM/Q-LLM) con taint tracking | 2026-10-19 | 4 · Architecture |
| [0020](0020-compactacion-motor-ts-vs-nativo.md) | Motor de compactación: `ContextCompaction` (TS) canónico | 2026-10-20 | 4 · Architecture |

## Referencias

- [`docs/jerarquia-canonica.md`](../jerarquia-canonica.md) — los 12 niveles de autoridad.
- [`docs/index.md`](../index.md) — índice maestro del corpus.
- [`docs/VANTADB-FEEDBACK-Y-MEJORAS.md`](../VANTADB-FEEDBACK-Y-MEJORAS.md) — registro canónico de los hallazgos y
  workarounds de VantaDB (verificado mecánicamente por `scripts/verify-vantadb-ids.mjs`).
- `AGENTS.md` §4 — guardrails que un ADR no puede contradecir.
