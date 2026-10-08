# Extractions Hub — Ego Cognitive Operating System

| Campo | Valor |
| --- | --- |
| Estado | Activo — Catálogo de extracción de repositorios de referencia |
| Owner | ness-e |
| Fecha | 2026-10-07 |

---

## 1. Propósito y Filosofía de Extracción

El directorio `docs/extractions/` contiene las fichas técnicas formales de los repositorios clonados o analizados como referencia arquitectónica (`repos-referencia/` y externos).

> **REGLA DE ORO DE EGO (de `AGENTS.md`):**
> *"Estos repositorios son referencia de patrones. NO copiar código directamente — extraer patrones de diseño y adaptar rigurosamente a la arquitectura canónica de Ego (TypeScript strict, Node.js 22 Main Process, React 19 Renderer, y VantaDB como sustrato local in-process)."*

### Regla de Extracción Condicionada (Protocolo de Dos Vías)

Toda extracción de código, patrones o arquitecturas desde repositorios de referencia debe someterse a la siguiente bifurcación estricta:

1. **Vía 1 — Mejora de lo Ya Definido (Fast-Track de Optimización):**
   - Aplica cuando el patrón resuelve o acelera una capacidad que **ya fue aprobada y definida** en la arquitectura y backlog de Ego (ej. componentes de `@assistant-ui/react`, hardening de Electron en Windows, selectores del `ModelRouter`, contratos de `EgoMemoryAdapter`).
   - *Condición:* Solo puede **mejorar, optimizar o robustecer** lo existente. No puede alterar los contratos maestros ni violar guardrails (ej. no meter backend Python ni SQLite).
   - *Flujo:* Mapeo directo a la tarea del Backlog Maestro (`CORE-*`, `ACT-*`, `CANV-*`) -> Adaptación en TypeScript -> Test de integración.

2. **Vía 2 — Evaluación Previa de lo No Definido (Gate de Research & Aprobación):**
   - Aplica cuando se descubre una funcionalidad o patrón en el repositorio fuente que **no estaba contemplada ni definida** en las especificaciones de Ego (ej. aislamiento de subagentes vía `git worktree`, ejecución de herramientas mediante RPC kernel local sin turnos de modelo, o gateway omnicanal multicanal Telegram/Discord).
   - *Condición Innegociable:* **PROHIBIDO implementar o extraer directamente**.
   - *Flujo Obligatorio:*
     1. **Evaluación de Utilidad Real:** ¿Aporta valor al Cognitive OS o introduce sobreingeniería innecesaria?
     2. **Investigación de Viabilidad & Trade-offs:** FMEA, impacto en dependencias, compatibilidad con la jerarquía canónica de decisiones.
     3. **Ficha de Documentación Técnica:** Se redacta un documento en `docs/research/` justificando *qué es, por qué se extraería y cómo encajaría* en Ego.
     4. **Aprobación del Owner:** Solo tras validación explícita se promueve a tarea en `docs/roadmap/Backlog.md`.

---

## 2. Metodología de Documentación de Extracción

Cada repositorio analizado debe contar con un documento dedicado en esta carpeta (`docs/extractions/<repo-name>.md`) siguiendo la siguiente estructura estándar:

### Estructura Estándar de Ficha de Extracción

1. **Ficha de Identidad del Repo**:
   - Nombre, autor, licencia, versión analizada y ruta local (`repos-referencia/...`).
   - Stack tecnológico del proyecto analizado.
2. **Evaluación de Similitud / Divergencia con Ego**:
   - Qué problemas resuelve de forma análoga a Ego.
   - Qué decisiones arquitectónicas del repositorio son incompatibles con los Guardrails de Ego (ej. backend en Python vs Node 22, SQLite vs VantaDB Fjall LSM, etc.).
3. **Catálogo de Patrones Extraíbles (Inventario Quirúrgico)**:
   - **Ruta exacta del archivo y rango de líneas en el repo fuente**.
   - Nombre del patrón / componente.
   - Qué hace y por qué es valioso.
   - **Plan de adaptación en Ego**: Cómo se traduce a TypeScript/React 19/VantaDB sin acoplamiento.
4. **Matriz de Extracción vs Descarte**:
   - Tabla clara: Componente Fuente | Acción (Extraer & Adaptar / Descartar / Solo Inspiración) | Justificación Técnica.
5. **Impacto en el Backlog de Ego**:
   - Vínculo explícito con las tareas del Backlog canónico de Ego (`docs/roadmap/Backlog.md`).

---

## 3. Repositorios de Referencia Mapeados

| Repositorio | Naturaleza / Stack | Archivo de Extracción / Backlog | Estado de Revisión | Foco Principal en Ego |
|---|---|---|:---:|---|
| **hermes-agent** | Electron 40 + React 19 + assistant-ui + Python backend | [`hermes-agent.md`](hermes-agent.md) / [`backlog-hermes.md`](../review/backlog-hermes.md) | 🔍 Activo (`HERM-01..19`) | UI Chat/Composer, Artifacts, layout de ventanas, hardening Windows, packaging |
| **openclaw** | Node.js + WebSocket + SQLite Kysely | [`openclaw.md`](openclaw.md) / [`backlog-openclaw.md`](../review/backlog-openclaw.md) | 🔍 Activo (`OCLW-01..15`) | Admisión de runs, auto-reparación de tools, locks de sesión, workers |
| **coucou** | Swift/macOS + Tauri 2/Rust/TS | [`coucou.md`](coucou.md) / [`backlog-coucou.md`](../review/backlog-coucou.md) | 🔍 Activo (`COUC-01..16`) | Normalización en el borde, atención, HITL con ACK, ChangeSet, SafeConfigMutation |
| **khoj** | Python FastAPI + Next.js + SQLite/pgvector | [`khoj.md`](khoj.md) / [`backlog-khoj.md`](../review/backlog-khoj.md) | 🔍 Activo (`KHOJ-01..05`) | Chunking de 256 tokens con solapamiento y hash, cosine thresholding, extracción de hechos |
| **helmor** | Tauri 2 (Rust) + React 19 + PTY | [`helmor.md`](helmor.md) / [`backlog-helmor.md`](../review/backlog-helmor.md) | 🔍 Activo (`HELM-01..04`) | Terminal output scheduler (coalescencia PTY 16KB/tick, ring-buffer 2MB), UI sync bridge |
| **career-ops** | Node.js ESM (`.mjs`) + Filesystem | [`career-ops.md`](career-ops.md) / [`backlog-career-ops.md`](../review/backlog-career-ops.md) | 🔍 Activo (`CARP-01..04`) | `DATA_CONTRACT.md` (User vs System), locks atómicos de filesystem (`pipeline-lock.mjs`), cuarentena |
| **deepseek-harness** | Monorepo TypeScript (pnpm) + Electron/Node | [`deepseek-harness.md`](deepseek-harness.md) / [`backlog-deepseek-harness.md`](../review/backlog-deepseek-harness.md) | 🔍 Activo (`DSEK-01..04`) | Sesiones versionadas, IDs opacos, patrón supersede sin borrado (`ADR-028`), migraciones aditivas |
