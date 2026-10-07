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

* [`backlog-hermes.md`](backlog-hermes.md): Backlog exhaustivo de revisión y extracción de patrones de `hermes-agent` (gemelo de stack Electron + React 19 + assistant-ui), cruzado con las 12 fases de Ego.
* Auditorías de dependencias y de contratos IPC.
* Registros de Code Review y validación de Golden Paths.

---

## Criterio de Aceptación para Reviews (Definition of Done)

Para que una revisión se considere cerrada y apta para extracción/implementación:
- [ ] **Origen comprobado:** Identificación exacta del archivo y línea en el repositorio fuente.
- [ ] **Evaluación de impedimentos:** Confirmación de que no introduce dependencias prohibidas.
- [ ] **Adaptación arquitectónica:** Especificación de cómo se reescribe el patrón en TypeScript / Node 22 / VantaDB.
- [ ] **Vínculo con el Backlog:** Asociación directa con uno o más IDs de `docs/roadmap/Backlog.md`.
