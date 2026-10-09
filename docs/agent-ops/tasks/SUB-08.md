# Task: SUB-08 — Vista y Panel de Gestión de Sub-Egos en UI (SubEgosView)

> **Fase:** 03 — Sub-Egos (P0-Alpha)  
> **Estado:** ✅ completed  
> **Fecha:** 2026-10-09  
> **Responsable:** coder / Antigravity  
> **Plan:** `docs/agent-ops/plans/2026-10-09-plan-20-tareas-mvp.md`

---

## 1. Contexto & Propósito

El usuario necesita una interfaz interactiva de alta fidelidad para gestionar sus especialistas cognitivos (`SubEgosView.tsx` / `sub-egos.tsx`), inspeccionar sus manifiestos y cuotas, crear nuevos Sub-Egos con las 3 modalidades canónicas (`SubEgoFactory`: plantillas de dominio, formulario guiado y editor JSON/YAML), y ver el estado operativo y rasgos cromáticos de cada especialista sin depender de configuraciones manuales en ficheros.

`SUB-08` refactoriza `apps/desktop/renderer/components/sub-egos.tsx` para transformarlo en el panel de control oficial de Sub-Egos:
1. Visualización de Sub-Egos en tarjetas con rol, descripción, badges de estado (`active` / `paused`), namespace en VantaDB (`egos/<id>/*`) y límites de presupuesto (`maxTokensPerCall`, `maxDailyCostUsd`).
2. Modal de creación multi-pestaña con las 3 modalidades:
   - **Modalidad A (Plantillas):** Selector visual de plantillas de dominio oficiales (`developer`, `researcher`, `product_manager`, `analyst`, `copywriter`) con previsualización de capacidades y botón de instanciación inmediata.
   - **Modalidad B (Personalizado):** Formulario con nombre, rol, instrucciones del sistema, herramientas autorizadas y límites de presupuesto.
   - **Modalidad C (Declarativo):** Editor de manifiesto en formato JSON o YAML con validación sintáctica en tiempo real.
3. Botón de alternancia de estado (Pausar / Activar) con feedback visual inmediato y persistencia en `gov/sub_egos`.
4. Integración con el `CharacterMiniBadge` de cada especialista.

---

## 2. Criterios de Aceptación (DoD)

- [x] `SubEgosView.tsx` renderiza la cuadrícula de Sub-Egos activos y pausados obtenidos en tiempo real de VantaDB.
- [x] Modal de creación soporta 3 pestañas: Plantillas de dominio, Formulario interactivo y Editor JSON/YAML.
- [x] Carga dinámica de plantillas disponibles desde IPC (`getDomainTemplates`).
- [x] Creación de Sub-Ego actualiza reactivamente la lista y emite feedback.
- [x] Botón de alternancia activa/pausa el Sub-Ego con persistencia en `gov/sub_egos` e impide mutar `ego.nucleus`.
- [x] Componente renderizado dentro del Dynamic Workspace cuando se selecciona la pestaña de Sub-Egos o desde el Sidebar.
- [x] `pnpm typecheck` exit 0 y `pnpm build` sin errores.
