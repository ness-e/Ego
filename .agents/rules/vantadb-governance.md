# Gobernanza de VantaDB y Registro Upstream — Reglas (Ego)

> **Scope:** `packages/memory/`, integraciones con `NativeVantaDB` (napi-rs), `vantadb-mcp` (subprocess stdio), memoria de proyecto y adaptadores.
> **Status:** 🟢 Vigente
> **Derivado de:** AGENTS.md §4 (Guardrails), Principio 1 (Memoria local persistente) y `docs/VANTADB-FEEDBACK-Y-MEJORAS.md`.

## Reglas

### R-1: Registro canónico obligatorio de fallos, limitaciones y workarounds
- **Must:** Todo error de ejecución, bug, incompatibilidad de tipos (ej. IEEE-754 a enteros, cursores), bloqueo de descriptores de archivos, discrepancia entre documentación y comportamiento real o limitación del motor descubierta durante el desarrollo de Ego DEBE registrarse inmediatamente en [`docs/VANTADB-FEEDBACK-Y-MEJORAS.md`](file:///c:/Users/Eros/VantaDB%20Proyect/Ego/docs/VANTADB-FEEDBACK-Y-MEJORAS.md).
- **Must:** Toda entrada debe seguir la taxonomía canónica (`VDB-BUG-*`, `VDB-INC-*`, `VDB-REQ-*`) especificando: componente afectado, síntoma, causa raíz, workaround en Ego y solución técnica recomendada para VantaDB.
- **Por qué:** VantaDB es el sustrato soberano de Ego pero es un proyecto independiente desarrollado en Rust. Sin un canal canónico y estructurado de retroalimentación, los problemas se pierden en el código cliente y la deuda técnica se cronifica.

### R-2: Prohibición estricta de workarounds silenciosos
- **Must not:** Implementar parches, conversiones de tipos ad-hoc, reintentos defensivos o desvíos lógicos en `packages/memory/` u otros módulos para mitigar fallos de VantaDB sin registrar el hallazgo correspondiente en `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` y referenciar el ID en el código fuente (ej. `// Workaround: VDB-BUG-01`).
- **Por qué:** Los workarounds no documentados ocultan defectos del motor de base de datos, dificultan refactorizaciones futuras e impiden retirar el código defensivo cuando VantaDB publica correcciones en versiones superiores.

### R-3: Coordinación de nuevos requerimientos y capacidades upstream
- **Must:** Cualquier requerimiento de nuevas capacidades de base de datos (ej. cancelación vía `AbortSignal`, APIs de compresión de contexto nativas, extensiones del tokenizer BM25 o comodines en namespaces) debe formalizarse primero en [`docs/engineering/vantadb-readiness-plan.md`](file:///c:/Users/Eros/VantaDB%20Proyect/Ego/docs/engineering/vantadb-readiness-plan.md) y enlazarse con los IDs del backlog de VantaDB antes de asumir su disponibilidad en Ego.
- **Must not:** Diseñar arquitecturas en Ego que dependan de capacidades inexistentes o hipotéticas de VantaDB sin un plan de contingencia (fallback) documentado.
- **Por qué:** Garantiza la estabilidad del runtime de Ego (local-first) respetando la cadencia de release y el principio de no-bloqueo entre ambos proyectos.
