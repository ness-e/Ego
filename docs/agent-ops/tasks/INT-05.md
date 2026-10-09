# Task: INT-05 — Tarjetas de Aprobación HITL Interactivas en el Chat

> **Fase:** 03.1 — MVP Convergence & System Integration  
> **Estado:** ⏳ in_progress  
> **Fecha:** 2026-10-09  
> **Responsable:** coder / Antigravity  
> **Plan:** `docs/agent-ops/plans/2026-10-09-plan-20-tareas-mvp.md`

---

## 1. Contexto & Propósito

El Principio Innegociable §6 (Gobernanza y Aprobaciones) estipula que las acciones sensibles (como escribir o modificar archivos del sistema, ejecutar comandos en la terminal o realizar operaciones con impacto externo) no pueden ejecutarse de manera autónoma sin consentimiento humano explícito si la política lo exige.
Actualmente, el backend de Electron cuenta con `ApprovalEngine` (`packages/execution`) y expone los canales IPC `ipc.approval.request` e `ipc.approval.resolve`. Sin embargo, la interfaz de usuario en `chat.tsx` no renderiza ninguna tarjeta interactiva para que el usuario visualice los detalles de la solicitud y tome la decisión de aprobar o denegar en tiempo real.

`INT-05` implementa el componente `ActionApprovalCard.tsx` en `apps/desktop/renderer/components/ActionApprovalCard.tsx`, lo integra en el flujo de conversación de `chat.tsx`, y conecta la respuesta interactiva con el canal IPC `window.electron.approval.resolve` para desbloquear o cancelar de inmediato la ejecución de la herramienta en vivo.

---

## 2. Criterios de Aceptación (DoD)

- [ ] Componente `ActionApprovalCard.tsx` en `apps/desktop/renderer/components/`:
  - Renderiza el ID de la solicitud, la acción solicitada (`action`), los parámetros (ej. comando de terminal, ruta de archivo) y la justificación o nivel de riesgo.
  - Botones claros y accesibles: "Aprobar acción" (color de acento) y "Denegar" (neutral/destructivo).
  - Estado visual de procesamiento y feedback tras la resolución (Aprobada / Rechazada / Expirada).
- [ ] Integración en `apps/desktop/renderer/components/chat.tsx`:
  - Escucha de eventos `ipc.approval.request` desde Electron Main.
  - Renderizado inline dentro de la conversación como una tarjeta de gobernanza.
  - Llamada a `window.electron.approval.resolve(requestId, decision)` al interactuar el usuario.
- [ ] Soporte de expiración / timeout visual sincronizado con el backend.
- [ ] Pruebas unitarias de renderizado y resolución de eventos.
- [ ] `pnpm typecheck` exit 0 y `pnpm build` sin errores.
