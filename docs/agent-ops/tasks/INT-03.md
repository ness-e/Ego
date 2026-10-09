# Task: INT-03 — Entidad Project y Aislamiento de Contexto Dinámico en UI

> **Fase:** 03.1 — MVP Convergence & System Integration  
> **Estado:** ⏳ in_progress  
> **Fecha:** 2026-10-09  
> **Responsable:** coder / Antigravity  
> **Plan:** `docs/agent-ops/plans/2026-10-09-plan-20-tareas-mvp.md`

---

## 1. Contexto & Propósito

El diagnóstico estratégico P0.1 identificó que Ego necesita un caso de uso ancla concreto (Ingeniería de Software / gestión de proyectos reales) y que los proyectos no pueden ser simulaciones efímeras en memoria ni datos estáticos de demo. En el estado actual, `apps/desktop/renderer/components/sidebar.tsx` muestra proyectos estáticos que no representan directorios del sistema de archivos ni aíslan el contexto en VantaDB.

`INT-03` implementa la entidad canónica `ProjectManifest` con validación Zod, persistencia en `projects/<id>/manifest` sobre `EgoMemoryAdapter`, canales IPC en Electron Main para crear, listar y seleccionar proyectos reales vinculados a rutas del filesystem local, y actualiza `sidebar.tsx` para permitir al usuario conmutar de proyecto dinámicamente y reflejar el proyecto activo en todo el sistema.

---

## 2. Criterios de Aceptación (DoD)

- [ ] Contrato y esquema Zod `ProjectManifestSchema` en `packages/memory` o `apps/desktop/src/ipc/schema.ts`:
  - `id`: identificador determinista `proj_<hash>` o `proj_<slug>`.
  - `name`: nombre del proyecto.
  - `rootPath`: ruta absoluta local en el filesystem del usuario.
  - `description`: descripción opcional del proyecto.
  - `activeSubEgoId`: Sub-Ego asignado por defecto al proyecto.
  - `createdAtMs`, `updatedAtMs`: marcas temporales.
- [ ] Canales IPC en Electron Main (`main.ts`):
  - `project:list`: lista los proyectos persistidos en `projects/*/manifest`.
  - `project:create`: crea y persiste un nuevo proyecto validando existencia de la carpeta.
  - `project:get`: recupera los detalles de un proyecto.
  - `project:select`: conmuta el proyecto activo y asocia el contexto a VantaDB.
  - `project:select-folder`: diálogo nativo de Electron (`dialog.showOpenDialog`) para elegir directorio.
- [ ] Exposición segura en `apps/desktop/src/preload.ts` bajo `window.electron.projects`.
- [ ] `sidebar.tsx` actualizado: consume la lista real de proyectos vía IPC, permite crear nuevos con selector de carpeta nativo y destaca el proyecto activo.
- [ ] Persistencia de `activeProjectId` en configuración del usuario para restaurar el proyecto activo tras reiniciar la aplicación.
- [ ] Pruebas unitarias de canales IPC y aislamiento de proyecto pasando.
- [ ] `pnpm typecheck` exit 0.
