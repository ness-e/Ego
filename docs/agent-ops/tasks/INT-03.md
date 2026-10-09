# Task: INT-03 — Entidad Project y Aislamiento de Contexto Dinámico en UI

> **Fase:** 03.1 — MVP Convergence & System Integration  
> **Estado:** ✅ completed  
> **Fecha:** 2026-10-09  
> **Responsable:** coder / Antigravity  
> **Plan:** `docs/agent-ops/plans/2026-10-09-plan-20-tareas-mvp.md`

---

## 1. Contexto & Propósito

El diagnóstico estratégico P0.1 identificó que Ego necesita un caso de uso ancla concreto (Ingeniería de Software / gestión de proyectos reales) y que los proyectos no pueden ser simulaciones efímeras en memoria ni datos estáticos de demo. En el estado actual, `apps/desktop/renderer/components/sidebar.tsx` muestra proyectos estáticos que no representan directorios del sistema de archivos ni aíslan el contexto en VantaDB.

`INT-03` implementa la entidad canónica `ProjectManifest` con validación Zod, persistencia en `projects/<id>/manifest` sobre `EgoMemoryAdapter`, canales IPC en Electron Main para crear, listar y seleccionar proyectos reales vinculados a rutas del filesystem local, y actualiza `sidebar.tsx` para permitir al usuario conmutar de proyecto dinámicamente y reflejar el proyecto activo en todo el sistema.

---

## 2. Criterios de Aceptación (DoD)

- [x] Contrato y esquema Zod `ProjectManifestSchema` en `apps/desktop/src/ipc/schema.ts`:
  - `id`: identificador determinista `proj_<hash>` o `proj_<slug>`.
  - `name`: nombre del proyecto.
  - `rootPath`: ruta absoluta local en el filesystem del usuario.
  - `description`: descripción opcional del proyecto.
  - `activeSubEgoId`: Sub-Ego asignado por defecto al proyecto.
  - `createdAtMs`, `updatedAtMs`: marcas temporales.
- [x] Canales IPC en Electron Main (`main.ts`):
  - `ipc.projects.list`: lista los proyectos persistidos en `gov/projects` y garantiza default ("Ego Core").
  - `ipc.projects.create`: crea y persiste un nuevo proyecto validando existencia de la carpeta en FS.
  - `ipc.projects.getActive`: recupera los detalles del proyecto activo.
  - `ipc.projects.select`: conmuta el proyecto activo y emite evento reactivo `ipc.projects.changed` y `eventBus:project.switched`.
  - `ipc.projects.selectFolder`: diálogo nativo de Electron (`dialog.showOpenDialog`) para elegir directorio.
- [x] Exposición segura en `apps/desktop/src/preload.ts` bajo `window.ego.projects` y `window.ego.onProjectChanged`.
- [x] `sidebar.tsx` actualizado: consume la lista real de proyectos vía IPC, permite crear nuevos con selector de carpeta nativo, modal dedicado de creación y destaca el proyecto activo.
- [x] Conexión de `projectId` en `App.tsx` y propagación al stream conversacional en `ego-chat.tsx`.
- [x] Pruebas unitarias de canales IPC y aislamiento de proyecto en `apps/desktop/test/projects-ipc.test.ts` (7 tests pasando al 100%).
- [x] `pnpm typecheck` exit 0 y `pnpm test` exit 0.
