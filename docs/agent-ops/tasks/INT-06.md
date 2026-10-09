# Task: INT-06 — Validación E2E del Bucle Completo de MVP (Software Engineering)

> **Fase:** 03.1 — MVP Software Engineering Anchor & Full Vertical Slice  
> **Estado:** ✅ completed  
> **Fecha:** 2026-10-09  
> **Responsable:** coder / Antigravity  
> **Plan:** `docs/agent-ops/plans/2026-10-09-plan-20-tareas-mvp.md`

---

## 1. Contexto & Propósito

Criterio de Finalización Canónico del MVP: Demostración empírica de que Ego funciona como un producto completo de punta a punta en su caso de uso ancla (Ingeniería de Software Local-First), integrando todos los subsistemas sin mocks en el fast path y con persistencia real durable.

`INT-06` implementa la suite E2E de validación del Golden Path de 6 pasos definido en `docs/product/guia-mvp.md`:
- **Paso 1: Configurar & Conectar (BYOK / ModelRouter):** Resolución determinista de modelos y soporte para proveedores reales con fallback seguro.
- **Paso 2: Importar Repositorio / Proyecto:** Creación de entidad `ProjectManifest` en `gov/projects` y aislamiento de memoria.
- **Paso 3: Asignar Tarea & Especialista:** Activación del Sub-Ego de ingeniería (`ego.code-reviewer`) en el proyecto y ensamblado de contexto.
- **Paso 4: Ejecución con Aprobación HITL:** Intercepción obligatoria de mutaciones de código en disco (`fs_write_file`), emisión de `PendingApproval` e interactividad de aprobación del operador humano.
- **Paso 5: Materialización en Canvas / Workspace:** Creación física del archivo en el workspace, registro del artefacto en el estado del proyecto y persistencia del turno.
- **Paso 6: Persistencia Multi-Día y Reanudación:** Simulación de reinicio forzado en frío (Cold Reboot) cerrando y reabriendo `EgoMemoryAdapter` y comprobando la restauración exacta de todos los datos en VantaDB.

---

## 2. Criterios de Aceptación (DoD)

- [x] Suite de prueba E2E en `apps/desktop/test/mvp-software-loop.test.ts` y en `tests/e2e/mvp-software-loop.test.ts`.
- [x] Los 6 pasos del Golden Path canónico de `guia-mvp.md` verificados con éxito.
- [x] Retención HITL verificada: la herramienta sensible no se ejecuta antes de la confirmación humana.
- [x] Escritura física de archivos en workspace real y registro del artefacto en memoria.
- [x] Reinicio en frío (Cold Reboot) ejecutado y verificado sin pérdida de información ni corrupción de descriptores.
- [x] 100% de tests passing en `@ego/desktop` (54 tests passing) y monorepo general (300+ tests passing).
- [x] Compilación y typecheck limpios (`pnpm build` y `pnpm typecheck` exit 0).
