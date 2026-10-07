# Plan Hub — Ego Cognitive Operating System

| Campo | Valor |
| --- | --- |
| Estado | Activo — Marco de planificación táctica y planes de ejecución |
| Owner | ness-e |
| Fecha | 2026-10-07 |

---

## Propósito

El directorio `docs/plan/` aloja los planes de ejecución tácticos, planes de migración, planes de contingencia y desgloses de sprint para implementar las 12 fases del Vertical Slice descritas en [`docs/roadmap/Backlog.md`](../roadmap/Backlog.md) y [`docs/PLAN-EGO.md`](../PLAN-EGO.md).

Mientras que `PLAN-EGO.md` define la estrategia macro de producto y arquitectura, `docs/plan/` desglosa el "cómo y cuándo" táctico para la ingeniería diaria.

---

## Contenido del Directorio

* Planes de ejecución por fase (Fase 01: Core Cognitivo, Fase 02: Acción, etc.).
* Planes de contingencia (Fallback de modelos, degradación controlada offline sin VantaDB daemon).
* Procedimientos de migración de esquema y almacenamiento (`ego_memory.vdb`).
* Estrategia de testing y validación de los Golden Paths (Alpha y Beta).

---

## Principio de Planificación en Ego

1. **Vertical Slice sobre Capas Horizontales**: Cada incremento debe entregar un flujo E2E funcional (Input de usuario → Memoria/Contexto → Razonamiento → Ejecución de Tool → Renderizado en UI).
2. **Presupuesto Explícito de UX**: 15–20% del esfuerzo en P0 se asigna a UX ("Funcional primero. Usable siempre. Perfecto después").
3. **No Bloquear en Terceros**: La arquitectura debe operar de forma resiliente con las capacidades disponibles en P0 (ej. híbrido `NativeVantaDB` + `vantadb-mcp` stdio mientras madura `VantaCognitiveAPI` en `vantadb-node`).
