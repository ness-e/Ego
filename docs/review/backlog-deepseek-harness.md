---
title: DeepSeek-Harness Review & Extraction Backlog — Ego SOC
kind: review
status: active
description: "Backlog especializado para la revisión, extracción de versionado y patrón supersede de DeepSeek-Harness hacia Ego."
tags: [ego, deepseek-harness, extraction, review, supersede, session-versioning, migrations]
schema: "10-column canonical schema (.agents/references/backlog-format.md compatible)"
---

# DeepSeek-Harness Review & Extraction Backlog — Ego SOC

> **Propósito:** Registro canónico y secuencial de auditoría, extracción de patrones y adaptación del código fuente de `repos-referencia/deepseek-harness` hacia el monorepo de Ego.
> **Regla de Operación:** *No copiar código directamente*. Extraer el patrón de versionado de sesiones con IDs opacos y la estrategia de migraciones sin borrado destructivo (patrón supersede), adaptándolos a los namespaces de VantaDB Fjall LSM.
> **Esquema:** Tabla canónica de 10 columnas:
> `| ID | Severidad | Hallazgo | Archivo DeepSeek-Harness | Esfuerzo | Prioridad | Estado | Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |`

---

## 1. Resumen Ejecutivo de Tareas de Extracción

| Grupo de Trabajo | Rango IDs | Tareas | Fases de Ego Impactadas | Prioridad | Beneficio Principal |
|---|---|:---:|---|:---:|---|
| **A. Versionado & Supersede** | `DSEK-01..02` | 2 | Fase 01 (`CORE`), Fase 10 (`REC`) | 🔴 P0 | Preservación del linaje histórico de registros sin mutaciones destructivas |
| **B. Identificadores Opacos & Migraciones** | `DSEK-03..04` | 2 | Fase 01 (`CORE`), Fase 10 (`REC`) | 🟠 P1 | Estabilidad de referencias de sesión e invariantes de esquema en VantaDB |
| **C. Durabilidad & Checkpoint Policy** | `DSEK-05` | 1 | Fase 01 (`CORE`), Fase 02 (`TOOL`), Fase 10 (`REC`) | 🔴 P0 | Barrera fail-closed previa a side-effects y snapshots semánticos periódicos |
| **TOTAL** | `DSEK-01..05` | **5** | **Fases 01, 02, 10** | — | **Ahorro estimado: 2 semanas de diseño de resiliencia histórica y fail-closed** |

---

## 2. Catálogo Detallado de Extracción (10 Columnas Canónicas)

| ID | Severidad | Hallazgo | Archivo DeepSeek-Harness | Esfuerzo | Prioridad | Estado | Descripción & Adaptación en Ego | Relaciones Ego | Dependencias |
|---|---|---|---|---|---|---|---|---|---|
| `DSEK-01` | 🔴 Crítica | **Patrón Canónico de Supersede Histórico (Soft-Replace)** | `snapshots/session/`, `ADR-028` | 🟢 0.5d | 🔴 P0 | ✅ Completada | Estrategia de reemplazo donde una mutación genera un nuevo registro y marca el anterior como `superseded_by` e `is_latest: false` sin borrarlo. Implementado en `packages/memory/EgoMemoryAdapter.ts` (`supersedeFact`). | Ego: `CORE-07`, `REC-01` | — |
| `DSEK-02` | 🟠 Alta | **Reconstrucción de estado por árbol de versiones (`version-tree`) y time-travel** | `snapshots/session/` | 🟢 1d | 🟠 P1 | ✅ Completada | Algoritmo causal para navegar punteros `supersedes` hacia atrás y `superseded_by` hacia adelante, más consulta time-travel en instante temporal (`getAtTimestamp`). Implementado en `packages/memory/EgoMemoryAdapter.ts` (`getVersionHistory`, `getAtTimestamp`). Verificado en `packages/memory/test/version-tree.test.ts`. | Ego: `CORE-07`, `REC-01` | `DSEK-01` |
| `DSEK-03` | 🟠 Alta | **Generación de identificadores de sesión opacos e inmutables** | `snapshots/session/` | 🟢 0.5d | 🟠 P1 | ✅ Completada | Convención de nombrado seguro `${prefix}_${timestamp_base36}_${entropy}` que garantiza orden lexicográfico y desacopla la semántica de negocio. Implementado en `packages/memory/OpaqueId.ts` (`generateOpaqueId`, `parseOpaqueId`, `isOpaqueId`). Verificado en `packages/memory/test/opaque-id.test.ts`. | Ego: `CORE-01`, `CORE-06` | — |
| `DSEK-04` | 🟡 Media | **Migraciones puramente aditivas sin eliminación de esquema** | `snapshots/session/` | 🟢 1d | 🟠 P1 | ✅ Completada | Regla de evolución de esquemas de VantaDB que prohíbe el borrado de namespaces antiguos, garantizando retrocompatibilidad con dumps pasados. Implementado en `packages/recovery/src/SchemaMigrator.ts`. Verificado en `packages/recovery/test/SchemaMigrator.test.ts`. | Ego: `REC-03`, `REC-05` | — |
| `DSEK-05` | 🔴 Crítica | **Session Checkpoint Policy & Barrera Fail-Closed de Herramientas** | `packages/session/session-checkpoint-policy/` | 🟢 1d | 🔴 P0 | ✅ Completada | Política de checkpoints y despacho de herramientas que aborta la llamada a la herramienta si la persistencia previa en `gov/audit` falla (`failClosedOnToolFlushError`). Checkpoints periódicos automáticos en `system/snapshots`. Implementado en `packages/memory/SessionCheckpointPolicy.ts`. Verificado en `packages/memory/test/checkpoint-policy.test.ts`. | Ego: `CORE-07`, `TOOL-01`, `REC-01` | `DSEK-03` |

---

## 3. Integración en el Flujo de Construcción de Ego

```mermaid
flowchart TD
    subgraph DeepSeekExtraction ["repos-referencia/deepseek-harness"]
        D_SUP["DSEK-01..02 (Supersede Pattern & Version Tree)"]
        D_MIG["DSEK-03..04 (Opaque IDs & Additive Migrations)"]
    end

    subgraph EgoBacklog ["Ego Backlog Maestro"]
        CORE["Fase 01: Core Cognitivo<br/>CORE-07 VantaDB Persistencia"]
        REC["Fase 10: Recovery & Hardening<br/>REC-01 Integridad, REC-03 Migraciones"]
    end

    D_SUP --> CORE
    D_SUP --> REC
    D_MIG --> CORE
    D_MIG --> REC
```
