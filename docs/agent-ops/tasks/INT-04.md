# Task: INT-04 — Integración UI de Sub-Egos (SubEgosView ↔ Fábrica y Runtime)

> **Fase:** 03.1 — MVP Convergence & System Integration  
> **Estado:** ✅ completed  
> **Fecha:** 2026-10-09  
> **Responsable:** coder / Antigravity  
> **Plan:** `docs/agent-ops/plans/2026-10-09-plan-20-tareas-mvp.md`

---

## 1. Contexto & Propósito

El diagnóstico estratégico identificó que la fábrica y el runtime de Sub-Egos (`SubEgoFactory`, `SubEgoRegistry`, `SubEgoRuntime`) existen en el paquete `@ego/subegos`, pero no están conectados integralmente a los canales IPC de Electron Main ni expuestos a la interfaz de usuario en Chromium. Actualmente, `apps/desktop/renderer/components/sub-egos.tsx` cuenta con un formulario básico y consume `ego().listSubEgos()`, pero no ofrece creación desde plantillas de dominio (`DOMAIN_TEMPLATES`), ni edición declarativa JSON/YAML, ni alternancia de estados de activación/pausa sobre el catálogo persistente de VantaDB (`gov/sub_egos`).

`INT-04` establece los contratos IPC completos para:
1. Listar Sub-Egos persistidos con metadatos completos y estado de activación (`ipc.subegos.list`).
2. Listar plantillas de dominio registradas (`ipc.subegos.getTemplates`).
3. Crear Sub-Egos mediante plantillas (`fromTemplate`), declaraciones JSON/YAML (`fromDeclaration`) o formulario estándar (`ipc.subegos.create`).
4. Alternar estado activo/pausado de un Sub-Ego con persistencia en `gov/sub_egos` (`ipc.subegos.toggleState`).
5. Exponer estos métodos en `preload.ts` y sincronizarlos con `EgoBridge`.

---

## 2. Criterios de Aceptación (DoD)

- [x] Esquemas de validación Zod en `apps/desktop/src/ipc/schema.ts`:
  - `CreateSubEgoInputSchema` con soporte para creación por plantilla, JSON/YAML o campos directos.
  - `ToggleSubEgoStateSchema` para mutaciones de ciclo de vida (`active` | `paused`).
- [x] Handlers IPC en `apps/desktop/src/main.ts`:
  - Conexión con `SubEgoRegistry` y `SubEgoFactory` de `@ego/subegos`.
  - Persistencia y consulta en namespace soberano `gov/sub_egos`.
  - Protección estricta de identidades nucleares (`ego.nucleus`).
- [x] Exposición tipada en `apps/desktop/src/preload.ts` (`window.ego.subegos`).
- [x] Tipos actualizados en `apps/desktop/renderer/lib/ego.ts`.
- [x] Pruebas unitarias de IPC y esquemas en verde (`apps/desktop/test/subegos-ipc.test.ts`).
- [x] `pnpm typecheck` exit 0 y `pnpm test` exit 0.
