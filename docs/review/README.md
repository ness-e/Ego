# Review Hub — Ego Cognitive Operating System

| Campo | Valor |
| --- | --- |
| Estado | Activo — Marco de revisión y auditoría técnica |
| Owner | ness-e |
| Fecha | 2026-10-07 |

---

## Propósito

El directorio `docs/review/` centraliza los procesos de auditoría crítica, inspección de código, validación de diseño y revisión técnica de repositorios y subsistemas antes y durante su implementación.

En Ego, ninguna pieza de código entra al núcleo sin pasar por un escrutinio de:
1. **Alineación con los 10 Principios Innegociables** (`docs/product/principios-innegociables.md`).
2. **Jerarquía Canónica de Decisiones** (`docs/jerarquia-canonica.md`).
3. **Guardrails Técnicos de `AGENTS.md`** (No WASM VantaDB, No backend Python obligatorio en P0, No cálculo de embeddings en TS, Context Isolation estricto en Electron).

---

## Contenido del Directorio

* [`backlog-hermes.md`](backlog-hermes.md): 19 tareas (`HERM-01..19`) — gemelo de stack `hermes-agent` (UI assistant-ui, artifacts, hardening Windows, packaging).
* [`backlog-openclaw.md`](backlog-openclaw.md): 15 tareas (`OCLW-01..15`) — `openclaw` (admisión inmutable de runs, auto-reparación de tools, locks y workers).
* [`backlog-coucou.md`](backlog-coucou.md): 16 tareas (`COUC-01..16`) — `coucou` (normalización de eventos en el borde, atención, HITL con ACK, ChangeSet, SafeConfigMutation).
* [`backlog-khoj.md`](backlog-khoj.md): 5 tareas (`KHOJ-01..05`) — `khoj` (chunking de 256 tokens con deduplicación, filtrado de confianza coseno y extracción de hechos).
* [`backlog-helmor.md`](backlog-helmor.md): 4 tareas (`HELM-01..04`) — `helmor` (programador de drenado PTY / coalescencia de ráfagas terminales y puente reactivo de UI).
* [`backlog-career-ops.md`](backlog-career-ops.md): 4 tareas (`CARP-01..04`) — `career-ops` (contrato de datos Usuario vs Sistema, locks atómicos en FS y cuarentena de inputs).
* [`backlog-deepseek-harness.md`](backlog-deepseek-harness.md): 4 tareas (`DSEK-01..04`) — `deepseek-harness` (sesiones versionadas, IDs opacos y patrón supersede sin borrado destructivo).

---

## Criterio de Aceptación para Reviews (Definition of Done)

Para que una revisión se considere cerrada y apta para extracción/implementación:
- [ ] **Origen comprobado:** Identificación exacta del archivo y línea en el repositorio fuente.
- [ ] **Evaluación de impedimentos:** Confirmación de que no introduce dependencias prohibidas.
- [ ] **Adaptación arquitectónica:** Especificación de cómo se reescribe el patrón en TypeScript / Node 22 / VantaDB.
- [ ] **Vínculo con el Backlog:** Asociación directa con uno o más IDs de `docs/roadmap/Backlog.md`.
