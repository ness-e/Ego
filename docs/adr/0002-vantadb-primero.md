# ADR 0002: VantaDB primero (memoria local embebida) #

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-15 |
| Estado | Aceptado |
| Nivel jerárquico | 4.Architecture (`docs/jerarquia-canonica.md`) |

## Contexto ##

El principio 1 de Ego exige memoria local persistente como base del
sistema, sin depender de servicios en la nube para el funcionamiento
diario (ver `AGENTS.md` §2, 10 principios).

## Decisión ##

Usar **VantaDB 0.8.0 embebido in-process** vía `NativeVantaDB` de
`"vantadb/native"` (napi-rs), accesible **solo desde el proceso
principal** a través del gateway único `EgoMemoryAdapter`.

- Fast path léxico BM25 puro en el binding in-process.
- Inferencia densa ONNX y capas cognitivas L0-L3 solo en el subproceso
  `vantadb-mcp` (88 tools, memoria `vanta-memory`).
- Queda prohibido: cliente WASM `"vantadb"`, `vantadb-server` en
  desktop y `vanta-proxy` (FROZEN).

## Consecuencias ##

- Positivas: local-first real, sin red para memoria; un solo punto de
  acceso auditable (`EgoMemoryAdapter`); snapshots `.vdbdump` soberanos.
- Negativas: todo workaround de motor debe registrarse en
  `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` (taxonomía `VDB-BUG-*`,
  `VDB-INC-*`, `VDB-REQ-*`); sin ese registro la tarea no cierra (DoD).
- Riesgos: calcular embeddings en TypeScript en el fast path degradaría
  el rendimiento; bloqueado por guardrail.

## Referencias ##

- `AGENTS.md` §1 (memoria), §4 (guardrails + gobernanza VantaDB).
- `docs/roadmap/Backlog.md` — Fase 01 (Core: memoria + persistencia),
  Fase 06 (Knowledge), Fase 10 (Recovery).
- `docs/architecture/memoria-vantadb.md`.
- `docs/VANTADB-FEEDBACK-Y-MEJORAS.md`.
